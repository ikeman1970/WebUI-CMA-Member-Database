import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { authenticateAndSetRLSContext } from '@/lib/supabaseAuth';
import { canViewReporting } from '@/lib/reportingAccess';

function parseMonthInput(value: string | string[] | undefined, fallback: Date) {
  if (!value) {
    return new Date(Date.UTC(fallback.getUTCFullYear(), fallback.getUTCMonth(), 1));
  }

  const input = Array.isArray(value) ? value[0] : value;
  const trimmed = String(input ?? '').trim();
  if (!trimmed) {
    return new Date(Date.UTC(fallback.getUTCFullYear(), fallback.getUTCMonth(), 1));
  }

  const monthMatch = trimmed.match(/^(\d{4})-(\d{1,2})$/);
  if (monthMatch) {
    const year = Number.parseInt(monthMatch[1], 10);
    const month = Number.parseInt(monthMatch[2], 10);
    if (Number.isFinite(year) && Number.isFinite(month) && month >= 1 && month <= 12) {
      return new Date(Date.UTC(year, month - 1, 1));
    }
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), 1));
  }

  return new Date(Date.UTC(fallback.getUTCFullYear(), fallback.getUTCMonth(), 1));
}

function monthKey(date: Date) {
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return date.getUTCFullYear() + '-' + month;
}

function normalizeMetricKey(key: string) {
  return key.trim().replace(/\s+/g, ' ');
}

function extractMetrics(metrics: unknown) {
  if (!metrics || typeof metrics !== 'object' || Array.isArray(metrics)) {
    return {} as Record<string, unknown>;
  }

  const entries = Object.entries(metrics as Record<string, unknown>);
  const next: Record<string, unknown> = {};

  for (const [rawKey, value] of entries) {
    const key = normalizeMetricKey(rawKey);
    if (!key) {
      continue;
    }
    next[key] = value;
  }

  return next;
}

function asFiniteNumber(value: unknown) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const cleaned = value.replace(/,/g, '').trim();
  if (!cleaned || !/^-?\d+(\.\d+)?$/.test(cleaned)) {
    return null;
  }

  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function escapeCSV(value: unknown): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const account = await authenticateAndSetRLSContext(req);
  if (!account) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  const canView = await canViewReporting(account);
  if (!canView) {
    return res.status(403).json({ message: 'Not authorized' });
  }

  const format = typeof req.query.format === 'string' ? req.query.format.toLowerCase() : 'csv';
  if (!['csv', 'json'].includes(format)) {
    return res.status(400).json({ message: 'Format must be csv or json' });
  }

  const today = new Date();
  const defaultFrom = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
  const fromDate = parseMonthInput(req.query.from, defaultFrom);
  const toDate = parseMonthInput(req.query.to, today);

  if (fromDate > toDate) {
    return res.status(400).json({ message: 'From month must be before or equal to To month.' });
  }

  // Get scoped chapters for authorization
  const scopedAccount = await prisma.account.findUnique({
    where: { id: account.id },
    include: { chapter: true }
  });

  if (!scopedAccount) {
    return res.status(401).json({ message: 'Account not found' });
  }

  const scopedChapterIds: string[] = [];
  if (scopedAccount.chapter?.id) {
    scopedChapterIds.push(scopedAccount.chapter.id);
  }

  const snapshots = await prisma.chapterReportingSnapshot.findMany({
    where: {
      chapterId: { in: scopedChapterIds.length > 0 ? scopedChapterIds : undefined },
      reportMonth: {
        gte: fromDate,
        lte: toDate
      }
    },
    orderBy: [{ reportMonth: 'asc' }, { chapterId: 'asc' }],
    select: {
      chapter: {
        select: {
          id: true,
          number: true,
          name: true,
          city: true,
          state: true,
          region: true
        }
      },
      chapterId: true,
      reportMonth: true,
      metrics: true
    }
  });

  interface QuarterlyMetrics {
    secularEventCount: number;
    secularEventAttendance: number;
    outreachEventCount: number;
    outreachEventAttendance: number;
    fellowshipEventCount: number;
    fellowshipEventAttendance: number;
    salvations: number;
    rededications: number;
    otherMinistry: number;
    guestMonth1: number;
    guestMonth2: number;
    guestMonth3: number;
  }

  const quarterlyByChapter = new Map<string, QuarterlyMetrics>();

  for (const snapshot of snapshots) {
    if (!quarterlyByChapter.has(snapshot.chapterId)) {
      quarterlyByChapter.set(snapshot.chapterId, {
        secularEventCount: 0,
        secularEventAttendance: 0,
        outreachEventCount: 0,
        outreachEventAttendance: 0,
        fellowshipEventCount: 0,
        fellowshipEventAttendance: 0,
        salvations: 0,
        rededications: 0,
        otherMinistry: 0,
        guestMonth1: 0,
        guestMonth2: 0,
        guestMonth3: 0
      });
    }

    const metrics = extractMetrics(snapshot.metrics);
    const q = quarterlyByChapter.get(snapshot.chapterId)!;

    for (const [key, rawValue] of Object.entries(metrics)) {
      const normalizedKey = normalizeMetricKey(key).toLowerCase();
      const numeric = asFiniteNumber(rawValue);

      if (numeric === null) continue;

      if (normalizedKey.includes('secular') && normalizedKey.includes('attendance')) {
        q.secularEventAttendance += numeric;
      } else if (normalizedKey.includes('secular') && normalizedKey.includes('event')) {
        if (!normalizedKey.includes('attendance')) {
          q.secularEventCount = Math.max(q.secularEventCount, numeric);
        }
      } else if (normalizedKey.includes('outreach') && normalizedKey.includes('attendance')) {
        q.outreachEventAttendance += numeric;
      } else if (normalizedKey.includes('outreach') && normalizedKey.includes('event')) {
        if (!normalizedKey.includes('attendance')) {
          q.outreachEventCount = Math.max(q.outreachEventCount, numeric);
        }
      } else if (normalizedKey.includes('fellowship') && normalizedKey.includes('attendance')) {
        q.fellowshipEventAttendance += numeric;
      } else if (normalizedKey.includes('fellowship') && normalizedKey.includes('event')) {
        if (!normalizedKey.includes('attendance')) {
          q.fellowshipEventCount = Math.max(q.fellowshipEventCount, numeric);
        }
      } else if (normalizedKey === 'salvations') {
        q.salvations += numeric;
      } else if (normalizedKey === 'rededications') {
        q.rededications += numeric;
      } else if (normalizedKey === 'other ministry') {
        q.otherMinistry += numeric;
      } else if (normalizedKey === 'guest month 1') {
        q.guestMonth1 += numeric;
      } else if (normalizedKey === 'guest month 2') {
        q.guestMonth2 += numeric;
      } else if (normalizedKey === 'guest month 3') {
        q.guestMonth3 += numeric;
      }
    }
  }

  const rows = Array.from(quarterlyByChapter.entries()).map(([chapterId, metrics]) => {
    const chapter = snapshots.find((s) => s.chapterId === chapterId)?.chapter;
    return {
      chapterId,
      chapterNumber: chapter?.number,
      chapterName: chapter?.name,
      chapterCity: chapter?.city,
      chapterState: chapter?.state,
      chapterRegion: chapter?.region,
      ...metrics,
      secularEventAvgParticipation:
        metrics.secularEventCount > 0 ? Math.round(metrics.secularEventAttendance / metrics.secularEventCount) : 0,
      outreachEventAvgParticipation:
        metrics.outreachEventCount > 0 ? Math.round(metrics.outreachEventAttendance / metrics.outreachEventCount) : 0,
      fellowshipEventAvgParticipation:
        metrics.fellowshipEventCount > 0 ? Math.round(metrics.fellowshipEventAttendance / metrics.fellowshipEventCount) : 0
    };
  });

  if (format === 'json') {
    const output = {
      exportDate: new Date().toISOString(),
      period: monthKey(fromDate) + ' to ' + monthKey(toDate),
      chapters: rows
    };
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="CMA-Quarterly-Report-' + monthKey(fromDate) + '.json"');
    return res.status(200).json(output);
  }

  // CSV format
  const headers = [
    'Chapter #',
    'Chapter Name',
    'City',
    'State',
    'Region',
    'Secular Events',
    'Secular Attendance',
    'Secular Avg/Event',
    'Outreach Events',
    'Outreach Attendance',
    'Outreach Avg/Event',
    'Fellowship Events',
    'Fellowship Attendance',
    'Fellowship Avg/Event',
    'Salvations',
    'Rededications',
    'Other Ministry',
    'Guests Month 1',
    'Guests Month 2',
    'Guests Month 3'
  ];

  const csvLines = [headers.map(escapeCSV).join(',')];

  for (const row of rows) {
    const line = [
      escapeCSV(row.chapterNumber || ''),
      escapeCSV(row.chapterName || ''),
      escapeCSV(row.chapterCity || ''),
      escapeCSV(row.chapterState || ''),
      escapeCSV(row.chapterRegion || ''),
      row.secularEventCount,
      row.secularEventAttendance,
      row.secularEventAvgParticipation,
      row.outreachEventCount,
      row.outreachEventAttendance,
      row.outreachEventAvgParticipation,
      row.fellowshipEventCount,
      row.fellowshipEventAttendance,
      row.fellowshipEventAvgParticipation,
      row.salvations,
      row.rededications,
      row.otherMinistry,
      row.guestMonth1,
      row.guestMonth2,
      row.guestMonth3
    ];
    csvLines.push(line.map((v) => escapeCSV(v)).join(','));
  }

  const csv = csvLines.join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="CMA-Quarterly-Report-' + monthKey(fromDate) + '.csv"');
  return res.status(200).send(csv);
}
