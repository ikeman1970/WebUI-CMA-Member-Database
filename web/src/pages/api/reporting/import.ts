import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { authenticateAndSetRLSContext } from '@/lib/supabaseAuth';
import { canEditReportingForChapter, canImportReporting } from '@/lib/reportingAccess';
import { getReportingImportRowLimit } from '@/lib/workbookSecurity';

type ImportRow = Record<string, unknown>;

const chapterIdAliases = new Set(['chapter id', 'chapterid', 'chapter uuid', 'chapter guid', 'chapter key']);
const chapterNumberAliases = new Set([
  'chapter number',
  'chapternumber',
  'chapter #',
  'chapter no',
  'chapter #.',
  'chapter num',
  'chapter'
]);
const chapterNameAliases = new Set(['chapter name', 'chapter title', 'chapter_name', 'chapter']);
const monthAliases = new Set([
  'month',
  'report month',
  'report_month',
  'reporting month',
  'reporting period',
  'report period',
  'attendance month',
  'meeting month',
  'meeting date',
  'date of meeting',
  'date',
  'month ending'
]);

function normalizeHeader(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-z0-9# ]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function normalizeTextValue(value: unknown) {
  const text = String(value ?? '').trim();
  return text || null;
}

function parseMonthValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    // Excel serial date value (1900 date system).
    const excelEpoch = Date.UTC(1899, 11, 30);
    const utcMillis = excelEpoch + Math.round(value * 86400000);
    const parsed = new Date(utcMillis);
    if (!Number.isNaN(parsed.getTime())) {
      return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), 1));
    }
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
  }

  const text = normalizeTextValue(value);
  if (!text) {
    return null;
  }

  const monthMatch = text.match(/^(\d{4})-(\d{1,2})$/);
  if (monthMatch) {
    const year = Number.parseInt(monthMatch[1], 10);
    const month = Number.parseInt(monthMatch[2], 10);
    if (month >= 1 && month <= 12) {
      return new Date(Date.UTC(year, month - 1, 1));
    }
  }

  const altMonthMatch = text.match(/^(\d{1,2})\/(\d{4})$/);
  if (altMonthMatch) {
    const month = Number.parseInt(altMonthMatch[1], 10);
    const year = Number.parseInt(altMonthMatch[2], 10);
    if (month >= 1 && month <= 12) {
      return new Date(Date.UTC(year, month - 1, 1));
    }
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), 1));
}

function asMetricValue(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  const text = String(value).trim();
  if (!text) {
    return null;
  }

  const numeric = text.replace(/,/g, '');
  if (/^-?\d+(\.\d+)?$/.test(numeric)) {
    const parsed = Number.parseFloat(numeric);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return text;
}

function getRowField(row: ImportRow, aliases: Set<string>) {
  for (const [key, value] of Object.entries(row)) {
    if (aliases.has(normalizeHeader(key))) {
      return value;
    }
  }
  return null;
}

function monthKey(date: Date) {
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${date.getUTCFullYear()}-${month}`;
}

function inferChapterNumberFromFileName(fileName: string | undefined) {
  if (!fileName) {
    return null;
  }

  const baseName = String(fileName).trim();
  if (!baseName) {
    return null;
  }

  const matches = baseName.match(/\d{2,5}/g);
  if (!matches || matches.length === 0) {
    return null;
  }

  // Prefer the first plausible chapter-like number token from the file name.
  return matches[0];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const account = await authenticateAndSetRLSContext(req);
  if (!account) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  const scopedAccount = await prisma.account.findUnique({
    where: { id: account.id },
    include: {
      chapter: true,
      orgUnit: true,
      person: {
        include: {
          chapter: true,
          officerAssignments: true
        }
      }
    }
  });

  if (!scopedAccount || !canImportReporting(scopedAccount)) {
    return res.status(403).json({ message: 'Not authorized to import reporting data.' });
  }

  const { rows, fileName } = req.body as {
    rows?: unknown;
    fileName?: string;
  };

  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ message: 'Rows are required.' });
  }

  if (rows.length > getReportingImportRowLimit()) {
    return res.status(413).json({
      message: `Import exceeds the safe row limit of ${getReportingImportRowLimit()}.`
    });
  }

  const chapters = await prisma.chapter.findMany({
    select: {
      id: true,
      number: true,
      name: true
    }
  });

  const editableChapters = chapters.filter((chapter) => canEditReportingForChapter(scopedAccount, chapter.id));
  if (editableChapters.length === 0) {
    return res.status(403).json({ message: 'No editable chapter scope for reporting imports.' });
  }

  const editableById = new Map(editableChapters.map((chapter) => [chapter.id, chapter]));
  const editableByNumber = new Map(
    editableChapters
      .filter((chapter) => chapter.number)
      .map((chapter) => [String(chapter.number).trim().toLowerCase(), chapter])
  );
  const editableByName = new Map(
    editableChapters
      .filter((chapter) => chapter.name)
      .map((chapter) => [String(chapter.name).trim().toLowerCase(), chapter])
  );

  const inferredFileChapterNumber = inferChapterNumberFromFileName(fileName);

  let imported = 0;
  const skipped: Array<{ row: number; reason: string }> = [];

  for (let index = 0; index < rows.length; index += 1) {
    const rowNumber = index + 2;
    const row = rows[index];

    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      skipped.push({ row: rowNumber, reason: 'Row is not an object.' });
      continue;
    }

    const record = row as ImportRow;
    const chapterIdRaw = normalizeTextValue(getRowField(record, chapterIdAliases));
    const chapterNumberRaw = normalizeTextValue(getRowField(record, chapterNumberAliases));
    const chapterNameRaw = normalizeTextValue(getRowField(record, chapterNameAliases));

    let chapter = null as { id: string; number: string | null; name: string | null } | null;

    if (chapterIdRaw && editableById.has(chapterIdRaw)) {
      chapter = editableById.get(chapterIdRaw) ?? null;
    }

    if (!chapter && chapterNumberRaw) {
      chapter = editableByNumber.get(chapterNumberRaw.toLowerCase()) ?? null;
    }

    if (!chapter && chapterNameRaw) {
      chapter = editableByName.get(chapterNameRaw.toLowerCase()) ?? null;
    }

    if (!chapter && inferredFileChapterNumber) {
      chapter = editableByNumber.get(inferredFileChapterNumber.toLowerCase()) ?? null;
    }

    if (!chapter && editableChapters.length === 1) {
      chapter = editableChapters[0];
    }

    if (!chapter) {
      skipped.push({ row: rowNumber, reason: 'Unable to resolve an editable chapter for row.' });
      continue;
    }

    const monthValue = getRowField(record, monthAliases);
    const reportMonth = parseMonthValue(monthValue);
    if (!reportMonth) {
      skipped.push({ row: rowNumber, reason: 'Missing or invalid month value.' });
      continue;
    }

    const metrics: Record<string, string | number | boolean | null> = {};
    for (const [key, value] of Object.entries(record)) {
      const normalizedKey = normalizeHeader(key);
      if (
        chapterIdAliases.has(normalizedKey)
        || chapterNumberAliases.has(normalizedKey)
        || chapterNameAliases.has(normalizedKey)
        || monthAliases.has(normalizedKey)
      ) {
        continue;
      }

      const cleanKey = key.trim();
      if (!cleanKey) {
        continue;
      }

      const metricValue = asMetricValue(value);
      if (metricValue === null) {
        continue;
      }

      metrics[cleanKey] = metricValue;
    }

    if (Object.keys(metrics).length === 0) {
      skipped.push({ row: rowNumber, reason: 'No metric values found in row.' });
      continue;
    }

    await prisma.chapterReportingSnapshot.upsert({
      where: {
        chapterId_reportMonth: {
          chapterId: chapter.id,
          reportMonth
        }
      },
      create: {
        chapterId: chapter.id,
        reportMonth,
        metrics,
        sourceFileName: normalizeTextValue(fileName),
        importedByAccountId: scopedAccount.id
      },
      update: {
        metrics,
        sourceFileName: normalizeTextValue(fileName),
        importedByAccountId: scopedAccount.id,
        importedAt: new Date()
      }
    });

    imported += 1;
  }

  return res.status(200).json({
    imported,
    skipped,
    editableChapterCount: editableChapters.length,
    monthSummary: `Imported ${imported} row(s).`,
    importedMonths: Array.from(
      new Set(
        rows
          .map((row) => {
            if (!row || typeof row !== 'object' || Array.isArray(row)) {
              return null;
            }
            const parsed = parseMonthValue(getRowField(row as ImportRow, monthAliases));
            return parsed ? monthKey(parsed) : null;
          })
          .filter(Boolean) as string[]
      )
    )
  });
}
