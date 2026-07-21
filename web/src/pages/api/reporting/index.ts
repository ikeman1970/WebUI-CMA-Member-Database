import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { authenticateAndSetRLSContext } from '@/lib/supabaseAuth';
import {
  canEditReportingForChapter,
  canImportReporting,
  canViewReporting,
  getReportingChapterWhere
} from '@/lib/reportingAccess';

type TrendTotals = Record<string, number>;

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
  return `${date.getUTCFullYear()}-${month}`;
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
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

  if (!scopedAccount || !canViewReporting(scopedAccount)) {
    return res.status(403).json({ message: 'Not authorized to view reporting.' });
  }

  const visibleChapters = await prisma.chapter.findMany({
    where: getReportingChapterWhere(scopedAccount),
    select: {
      id: true,
      number: true,
      name: true,
      city: true,
      state: true,
      region: true
    },
    orderBy: [{ number: 'asc' }, { name: 'asc' }]
  });

  const visibleChapterIds = visibleChapters.map((chapter) => chapter.id);
  const requestedChapterId = String(req.query.chapterId ?? '').trim();
  if (requestedChapterId && !visibleChapterIds.includes(requestedChapterId)) {
    return res.status(403).json({ message: 'Not authorized to access this chapter reporting scope.' });
  }

  const scopedChapterIds = requestedChapterId ? [requestedChapterId] : visibleChapterIds;
  const editableChapterIds = visibleChapterIds.filter((chapterId) => canEditReportingForChapter(scopedAccount, chapterId));
  const canImport = canImportReporting(scopedAccount) && editableChapterIds.length > 0;

  const mode = String(req.query.mode ?? 'snapshot').trim().toLowerCase();

  if (mode === 'quarterly') {
    const today = new Date();
    const defaultFrom = new Date(Date.UTC(today.getUTCFullYear(), 0, 1)); // Q1 default: Jan 1
    const fromDate = parseMonthInput(req.query.from, defaultFrom);
    const toDate = parseMonthInput(req.query.to, today);

    if (fromDate > toDate) {
      return res.status(400).json({ message: 'From month must be before or equal to To month.' });
    }

    const snapshots = await prisma.chapterReportingSnapshot.findMany({
      where: {
        chapterId: { in: scopedChapterIds },
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

    // Aggregate quarterly metrics
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

      // Parse known metrics from workbook
      for (const [key, rawValue] of Object.entries(metrics)) {
        const normalizedKey = normalizeMetricKey(key).toLowerCase();
        const numeric = asFiniteNumber(rawValue);
        
        if (numeric === null) continue;

        // Event attendance metrics
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
        }
        // Ministry outcomes
        else if (normalizedKey === 'salvations') {
          q.salvations += numeric;
        } else if (normalizedKey === 'rededications') {
          q.rededications += numeric;
        } else if (normalizedKey === 'other ministry') {
          q.otherMinistry += numeric;
        }
        // Guest tracking
        else if (normalizedKey === 'guest month 1') {
          q.guestMonth1 += numeric;
        } else if (normalizedKey === 'guest month 2') {
          q.guestMonth2 += numeric;
        } else if (normalizedKey === 'guest month 3') {
          q.guestMonth3 += numeric;
        }
      }
    }

    const quarterlyRows = Array.from(quarterlyByChapter.entries()).map(([chapterId, metrics]) => {
      const chapter = visibleChapters.find((c) => c.id === chapterId);
      return {
        chapterId,
        chapter: chapter || { id: chapterId, number: null, name: null, city: null, state: null, region: null },
        ...metrics,
        secularEventAvgParticipation: metrics.secularEventCount > 0 ? Math.round(metrics.secularEventAttendance / metrics.secularEventCount) : 0,
        outreachEventAvgParticipation: metrics.outreachEventCount > 0 ? Math.round(metrics.outreachEventAttendance / metrics.outreachEventCount) : 0,
        fellowshipEventAvgParticipation: metrics.fellowshipEventCount > 0 ? Math.round(metrics.fellowshipEventAttendance / metrics.fellowshipEventCount) : 0
      };
    });

    return res.status(200).json({
      mode: 'quarterly',
      from: monthKey(fromDate),
      to: monthKey(toDate),
      chapters: visibleChapters,
      rows: quarterlyRows,
      permissions: {
        canView: true,
        canImport,
        editableChapterIds
      }
    });
  }

  if (mode === 'trend') {
    const today = new Date();
    const defaultFrom = new Date(Date.UTC(today.getUTCFullYear(), Math.max(0, today.getUTCMonth() - 5), 1));
    const fromDate = parseMonthInput(req.query.from, defaultFrom);
    const toDate = parseMonthInput(req.query.to, today);

    if (fromDate > toDate) {
      return res.status(400).json({ message: 'From month must be before or equal to To month.' });
    }

    const snapshots = await prisma.chapterReportingSnapshot.findMany({
      where: {
        chapterId: { in: scopedChapterIds },
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

    const allMetricKeys = new Set<string>();
    const trendByMonth = new Map<string, TrendTotals>();
    const byChapter = new Map<string, { chapter: (typeof visibleChapters)[number]; months: Map<string, TrendTotals> }>();

    for (const snapshot of snapshots) {
      const key = monthKey(snapshot.reportMonth);
      const bucket = trendByMonth.get(key) ?? {};
      const chapterBucket = byChapter.get(snapshot.chapterId) ?? {
        chapter: {
          id: snapshot.chapter.id,
          number: snapshot.chapter.number,
          name: snapshot.chapter.name,
          city: snapshot.chapter.city,
          state: snapshot.chapter.state,
          region: snapshot.chapter.region
        },
        months: new Map<string, TrendTotals>()
      };
      const chapterMonthBucket = chapterBucket.months.get(key) ?? {};
      const metrics = extractMetrics(snapshot.metrics);

      for (const [metricKey, rawValue] of Object.entries(metrics)) {
        const numeric = asFiniteNumber(rawValue);
        if (numeric === null) {
          continue;
        }

        allMetricKeys.add(metricKey);
        bucket[metricKey] = (bucket[metricKey] ?? 0) + numeric;
        chapterMonthBucket[metricKey] = (chapterMonthBucket[metricKey] ?? 0) + numeric;
      }

      trendByMonth.set(key, bucket);
      chapterBucket.months.set(key, chapterMonthBucket);
      byChapter.set(snapshot.chapterId, chapterBucket);
    }

    const rows = Array.from(trendByMonth.entries()).map(([month, totals]) => ({ month, totals }));
    const byChapterRows = Array.from(byChapter.values()).map((entry) => ({
      chapter: entry.chapter,
      rows: Array.from(entry.months.entries()).map(([month, totals]) => ({ month, totals }))
    }));

    return res.status(200).json({
      mode: 'trend',
      from: monthKey(fromDate),
      to: monthKey(toDate),
      chapters: visibleChapters,
      availableMetrics: Array.from(allMetricKeys).sort((a, b) => a.localeCompare(b)),
      rows,
      byChapterRows,
      permissions: {
        canView: true,
        canImport,
        editableChapterIds
      }
    });
  }

  const monthDate = parseMonthInput(req.query.month, new Date());

  const snapshots = await prisma.chapterReportingSnapshot.findMany({
    where: {
      chapterId: { in: scopedChapterIds },
      reportMonth: monthDate
    },
    orderBy: [{ chapter: { number: 'asc' } }, { chapter: { name: 'asc' } }],
    include: {
      chapter: {
        select: {
          id: true,
          number: true,
          name: true,
          city: true,
          state: true,
          region: true
        }
      }
    }
  });

  const allMetricKeys = new Set<string>();
  const rows = snapshots.map((snapshot) => {
    const metrics = extractMetrics(snapshot.metrics);
    for (const key of Object.keys(metrics)) {
      allMetricKeys.add(key);
    }

    return {
      id: snapshot.id,
      chapterId: snapshot.chapterId,
      chapter: snapshot.chapter,
      reportMonth: monthKey(snapshot.reportMonth),
      sourceFileName: snapshot.sourceFileName,
      metrics,
      editable: editableChapterIds.includes(snapshot.chapterId)
    };
  });

  return res.status(200).json({
    mode: 'snapshot',
    month: monthKey(monthDate),
    chapters: visibleChapters,
    metricColumns: Array.from(allMetricKeys).sort((a, b) => a.localeCompare(b)),
    rows,
    permissions: {
      canView: true,
      canImport,
      editableChapterIds
    }
  });
}
