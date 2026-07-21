import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { authenticateAndSetRLSContext } from '@/lib/supabaseAuth';
import { getRegionCodeFromState } from '@/lib/regions';
import { parseChapterStatus, normalizeChapterStatusOrDefault, recordChapterStatusTransition } from '@/lib/chapterStatus';

type ImportRow = {
  number?: string;
  name?: string;
  city?: string;
  state?: string;
  status?: string;
  region?: string | number;
  country?: string;
};

function normalize(value: string | undefined) {
  const trimmed = (value ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseRegion(region: string | number | undefined, fallbackState: string | null) {
  if (typeof region === 'number' && Number.isFinite(region)) {
    return region;
  }

  if (typeof region === 'string') {
    const parsed = Number.parseInt(region.trim(), 10);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return getRegionCodeFromState(fallbackState);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const account = await authenticateAndSetRLSContext(req);
  if (!account) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  const role = (account.role ?? '').toLowerCase();
  if (!['root', 'admin', 'superuser'].includes(role)) {
    return res.status(403).json({ message: 'Insufficient permissions.' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { rows } = req.body as { rows?: ImportRow[] };
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ message: 'No import rows provided.' });
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const number = normalize(row.number);
    const name = normalize(row.name);

    if (!number || !name) {
      skipped += 1;
      continue;
    }

    const data = {
      number,
      name,
      city: normalize(row.city),
      state: normalize(row.state),
      status: normalize(row.status),
      country: normalize(row.country) ?? 'USA',
      region: parseRegion(row.region, normalize(row.state))
    };

    const incomingStatus = data.status;
    if (incomingStatus && !parseChapterStatus(incomingStatus)) {
      skipped += 1;
      continue;
    }

    const existing = await prisma.chapter.findFirst({
      where: { number }
    });

    if (existing) {
      const priorStatus = existing.status ? String(existing.status).trim().toLowerCase() : null;
      const nextStatus = incomingStatus ? normalizeChapterStatusOrDefault(incomingStatus, 'active') : priorStatus;

      await prisma.chapter.update({
        where: { id: existing.id },
        data: {
          ...data,
          status: incomingStatus ? nextStatus : undefined
        }
      });

      if (nextStatus && nextStatus !== priorStatus) {
        await recordChapterStatusTransition({
          chapterId: existing.id,
          fromStatus: priorStatus,
          toStatus: nextStatus,
          changedByAccountId: account.id,
          reason: 'chapter-import-update'
        });
      }

      updated += 1;
    } else {
      const newStatus = normalizeChapterStatusOrDefault(incomingStatus, 'active');

      const createdChapter = await prisma.chapter.create({
        data: {
          ...data,
          status: newStatus
        }
      });

      await recordChapterStatusTransition({
        chapterId: createdChapter.id,
        fromStatus: null,
        toStatus: newStatus,
        changedByAccountId: account.id,
        reason: 'chapter-import-create'
      });

      created += 1;
    }
  }

  return res.status(200).json({ created, updated, skipped });
}
