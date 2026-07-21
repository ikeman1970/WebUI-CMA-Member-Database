import * as XLSX from 'xlsx';
import {
  enforceWorkbookFileGuards,
  enforceWorkbookStructureGuards,
  getReportingImportRowLimit
} from '@/lib/workbookSecurity';

export type ParsedReportingWorkbookRow = Record<string, string | number | boolean | null | undefined> & {
  chapterId?: string;
  chapterNumber?: string;
  chapterName?: string;
  reportMonth?: string;
};

const memberSheetPattern = /^Members\s*\d+$/i;
const outcomeMetricHeaders = new Set(['salvations', 'rededications', 'other ministry']);
const guestMetricHeaders = new Set(['guests', 'guest count', 'guest attendance', 'visitor', 'visitors', 'guest']);

function normalizeHeader(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-z0-9# ]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function normalizeText(value: unknown) {
  const text = String(value ?? '').trim();
  return text.length > 0 ? text : null;
}

function parseReportMonth(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const excelEpoch = Date.UTC(1899, 11, 30);
    const utcMillis = excelEpoch + Math.round(value * 86400000);
    const parsed = new Date(utcMillis);
    if (!Number.isNaN(parsed.getTime())) {
      return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), 1));
    }
  }

  const text = normalizeText(value);
  if (!text) {
    return null;
  }

  const titleMatch = text.match(/date:\s*(.+)$/i);
  const candidate = titleMatch ? titleMatch[1] : text;
  const parsed = new Date(candidate);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), 1));
}

function monthKey(date: Date) {
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${date.getUTCFullYear()}-${month}`;
}

function parseCellCount(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }

  const text = String(value).trim();
  if (!text) {
    return null;
  }

  const numeric = text.replace(/,/g, '');
  if (/^-?\d+(\.\d+)?$/.test(numeric)) {
    const parsed = Number.parseFloat(numeric);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (/^(✔|✓|x|yes|true|checked)$/i.test(text)) {
    return 1;
  }

  return 1;
}

function extractHeaderLabel(row: unknown[], index: number) {
  return normalizeText(row[index]);
}

export async function parseReportingWorkbookFile(file: File, chapterId?: string) {
  enforceWorkbookFileGuards(file);

  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const memberSheetNames = workbook.SheetNames.filter((sheetName) => memberSheetPattern.test(sheetName));

  enforceWorkbookStructureGuards({
    sheetCount: workbook.SheetNames.length,
    rowCount: 0,
    maxRows: getReportingImportRowLimit(),
    contextLabel: 'reporting-import'
  });

  if (memberSheetNames.length === 0) {
    return [] as ParsedReportingWorkbookRow[];
  }

  const firstSheet = workbook.Sheets[memberSheetNames[0]];
  const firstRows = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, { header: 1, defval: null, blankrows: false, raw: false });

  enforceWorkbookStructureGuards({
    sheetCount: workbook.SheetNames.length,
    rowCount: firstRows.length,
    maxRows: getReportingImportRowLimit(),
    contextLabel: 'reporting-import'
  });
  const reportMonth = parseReportMonth(firstRows[1]?.[1]);

  if (!reportMonth) {
    return [] as ParsedReportingWorkbookRow[];
  }

  const metrics = new Map<string, number>();
  const eventColumns = new Map<string, { section: string | null; title: string }>();
  const sectionTotals = new Map<string, number>();
  const guestsByMonth = new Map<number, number>(); // Track guests by sheet index
  let totalAttendance = 0;

  for (let sheetIndex = 0; sheetIndex < memberSheetNames.length; sheetIndex += 1) {
    const sheetName = memberSheetNames[sheetIndex];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, blankrows: false, raw: false });

    enforceWorkbookStructureGuards({
      sheetCount: workbook.SheetNames.length,
      rowCount: rows.length,
      maxRows: getReportingImportRowLimit(),
      contextLabel: 'reporting-import'
    });

    const headerRow = rows[2] ?? [];
    const sectionRow = rows[1] ?? [];
    const maxColumns = Math.max(headerRow.length, sectionRow.length);

    const columns: Array<{ index: number; header: string; section: string | null; isOutcomeMetric: boolean; isGuestMetric: boolean }> = [];
    let currentSection: string | null = null;

    for (let index = 4; index < maxColumns; index += 1) {
      const sectionLabel = extractHeaderLabel(sectionRow, index);
      if (sectionLabel) {
        currentSection = sectionLabel;
      }

      const headerLabel = extractHeaderLabel(headerRow, index);
      if (!headerLabel) {
        continue;
      }

      const normalizedHeader = normalizeHeader(headerLabel);
      columns.push({
        index,
        header: headerLabel,
        section: currentSection,
        isOutcomeMetric: outcomeMetricHeaders.has(normalizedHeader),
        isGuestMetric: guestMetricHeaders.has(normalizedHeader)
      });
    }

    let monthGuestCount = 0;

    for (let rowIndex = 3; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex] ?? [];
      const attendeeName = normalizeText(row[1]);
      const memberNumber = normalizeText(row[2]);

      let rowHadAnyValue = Boolean(attendeeName || memberNumber);

      for (const column of columns) {
        const rawValue = row[column.index];
        const count = parseCellCount(rawValue);
        if (count === null || count === 0) {
          continue;
        }

        rowHadAnyValue = true;

        if (column.isGuestMetric) {
          monthGuestCount += count;
        } else {
          metrics.set(column.header, (metrics.get(column.header) ?? 0) + count);

          if (!column.isOutcomeMetric) {
            totalAttendance += count;
            if (column.section) {
              sectionTotals.set(column.section, (sectionTotals.get(column.section) ?? 0) + count);
            }
            eventColumns.set(column.header, { section: column.section, title: column.header });
          }
        }
      }

      if (!rowHadAnyValue) {
        continue;
      }
    }

    if (monthGuestCount > 0) {
      guestsByMonth.set(sheetIndex + 1, monthGuestCount);
    }
  }

  const row: ParsedReportingWorkbookRow = {
    chapterId,
    'report month': monthKey(reportMonth),
    'Monthly Event Attendance': totalAttendance,
    'Event Count': Array.from(eventColumns.values()).filter((column) => (metrics.get(column.title) ?? 0) > 0).length
  };

  for (const [section, total] of sectionTotals.entries()) {
    row[`${section} Attendance`] = total;
  }

  for (let month = 1; month <= 3; month += 1) {
    const guestCount = guestsByMonth.get(month);
    if (guestCount !== undefined && guestCount > 0) {
      row[`Guest Month ${month}`] = guestCount;
    }
  }

  for (const [metric, value] of metrics.entries()) {
    row[metric] = value;
  }

  return [row];
}