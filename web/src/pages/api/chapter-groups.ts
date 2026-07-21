import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { authenticateAndSetRLSContext } from '@/lib/supabaseAuth';
import { normalizeStateCode } from '@/lib/stateLabels';

const adminRoles = new Set([
  'root', 'superuser', 'admin',           // System
  'president', 'secretary',                // Chapter
  'ceo', 'board', 'board_advisor',        // National
  'evangelist',                            // Regional
  'state_coordinator', 'area_rep'         // State
]);
const CONFIG_KEY = 'chapterStateGroups';

type ChapterGroup = {
  stateCode: string;
  label?: string;
};

function isAdminRole(role: string | null | undefined) {
  return adminRoles.has((role ?? '').toLowerCase());
}

function normalizeGroups(value: unknown): ChapterGroup[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const byCode = new Map<string, ChapterGroup>();
  for (const item of value) {
    const stateCode = normalizeStateCode((item as { stateCode?: unknown })?.stateCode);
    if (!stateCode) {
      continue;
    }

    const label = String((item as { label?: unknown })?.label ?? '').trim();
    byCode.set(stateCode, {
      stateCode,
      ...(label ? { label } : {})
    });
  }

  return Array.from(byCode.values()).sort((a, b) => a.stateCode.localeCompare(b.stateCode));
}

async function readGroups() {
  const setting = await prisma.appSetting.findUnique({ where: { key: CONFIG_KEY } });
  const raw = (setting?.value as { groups?: unknown } | null)?.groups;
  return normalizeGroups(raw);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const account = await authenticateAndSetRLSContext(req);
  if (!account) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  if (req.method === 'GET') {
    return res.status(200).json({ groups: await readGroups() });
  }

  if (req.method === 'POST') {
    if (!isAdminRole(account.role)) {
      return res.status(403).json({ message: 'Insufficient permissions.' });
    }

    const body = req.body as { stateCode?: unknown; label?: unknown };
    const stateCode = normalizeStateCode(body.stateCode);
    if (!stateCode) {
      return res.status(400).json({ message: 'State code is required.' });
    }

    const label = String(body.label ?? '').trim();
    const existing = await readGroups();
    const next = normalizeGroups([
      ...existing,
      {
        stateCode,
        ...(label ? { label } : {})
      }
    ]);

    await prisma.appSetting.upsert({
      where: { key: CONFIG_KEY },
      create: { key: CONFIG_KEY, value: { groups: next } },
      update: { value: { groups: next } }
    });

    return res.status(200).json({ groups: next });
  }

  return res.status(405).json({ message: 'Method not allowed' });
}
