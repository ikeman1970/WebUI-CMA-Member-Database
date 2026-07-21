import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { authenticateAndSetRLSContext } from '@/lib/supabaseAuth';
import { canEditReportingForChapter } from '@/lib/reportingAccess';

interface ChangeRecord {
  timestamp: string;
  changedBy: string;
  accountId: string;
  changes: Array<{
    field: string;
    oldValue: unknown;
    newValue: unknown;
  }>;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const account = await authenticateAndSetRLSContext(req);
  if (!account) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  const { snapshotId, chapterId, reportMonth, metricUpdates } = req.body;

  if (!snapshotId || !metricUpdates || typeof metricUpdates !== 'object') {
    return res.status(400).json({ message: 'Missing required fields: snapshotId, metricUpdates' });
  }

  // Get the current snapshot
  const snapshot = await prisma.chapterReportingSnapshot.findUnique({
    where: { id: snapshotId },
    include: {
      chapter: {
        select: {
          id: true
        }
      }
    }
  });

  if (!snapshot) {
    return res.status(404).json({ message: 'Snapshot not found' });
  }

  // Check permissions
  if (!canEditReportingForChapter(account, snapshot.chapterId)) {
    return res.status(403).json({ message: 'Not authorized to edit this snapshot' });
  }

  // Get account info for audit trail
  const scopedAccount = await prisma.account.findUnique({
    where: { id: account.id },
    include: { person: true }
  });

  const accountDisplay = scopedAccount?.person 
    ? [scopedAccount.person.firstName, scopedAccount.person.lastName].filter(Boolean).join(' ')
    : scopedAccount?.username || 'Unknown';

  // Build change records
  const currentMetrics = snapshot.metrics as Record<string, unknown>;
  const changes: ChangeRecord['changes'] = [];

  for (const [field, newValue] of Object.entries(metricUpdates)) {
    const oldValue = currentMetrics[field];
    if (oldValue !== newValue) {
      changes.push({ field, oldValue, newValue });
    }
  }

  if (changes.length === 0) {
    return res.status(200).json({ message: 'No changes to apply' });
  }

  // Update metrics and track change
  const updatedMetrics = {
    ...currentMetrics,
    ...metricUpdates
  };

  const changeRecord: ChangeRecord = {
    timestamp: new Date().toISOString(),
    changedBy: accountDisplay,
    accountId: account.id,
    changes
  };

  const changeHistory = Array.isArray(snapshot.changeHistory) 
    ? [...(snapshot.changeHistory as unknown[]), changeRecord]
    : [changeRecord];

  const updated = await prisma.chapterReportingSnapshot.update({
    where: { id: snapshotId },
    data: {
      metrics: updatedMetrics,
      changeHistory: changeHistory as any
    },
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

  return res.status(200).json({
    message: 'Snapshot updated successfully',
    snapshot: {
      id: updated.id,
      chapterId: updated.chapterId,
      chapter: updated.chapter,
      reportMonth: updated.reportMonth,
      sourceFileName: updated.sourceFileName,
      metrics: updated.metrics,
      changeHistory: updated.changeHistory
    }
  });
}
