import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { authenticateAndSetRLSContext } from '@/lib/supabaseAuth';
import { normalizeRegionNames } from '@/lib/regionLabels';

const adminRoles = new Set([
  'root', 'superuser', 'admin',           // System
  'president', 'secretary',                // Chapter
  'ceo', 'board', 'board_advisor',        // National
  'evangelist',                            // Regional
  'state_coordinator', 'area_rep'         // State
]);
const CONFIG_KEY = 'regionNames';

function isAdminRole(role: string | null | undefined) {
  return adminRoles.has((role ?? '').toLowerCase());
}

async function readConfig() {
  const setting = await prisma.appSetting.findUnique({ where: { key: CONFIG_KEY } });
  const value = (setting?.value as { names?: unknown } | null)?.names;
  return { names: normalizeRegionNames(value) };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const account = await authenticateAndSetRLSContext(req);
  if (!account) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  if (req.method === 'GET') {
    return res.status(200).json(await readConfig());
  }

  if (req.method === 'PUT') {
    if (!isAdminRole(account.role)) {
      return res.status(403).json({ message: 'Insufficient permissions.' });
    }

    const body = req.body as { names?: unknown };
    const names = normalizeRegionNames(body.names);

    await prisma.appSetting.upsert({
      where: { key: CONFIG_KEY },
      create: { key: CONFIG_KEY, value: { names } },
      update: { value: { names } }
    });

    return res.status(200).json({ names });
  }

  return res.status(405).json({ message: 'Method not allowed' });
}
