import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { authenticateAndSetRLSContext } from '@/lib/supabaseAuth';
import {
  getDefaultMemberDirectoryConfig,
  normalizeMemberDirectoryConfig,
  OPTIONAL_DIRECTORY_FIELD_DEFINITIONS,
  type DirectoryOptionalFieldKey
} from '@/lib/memberDirectory';

const adminRoles = new Set([
  'root', 'superuser', 'admin',           // System
  'president', 'secretary',                // Chapter
  'ceo', 'board', 'board_advisor',        // National
  'evangelist',                            // Regional
  'state_coordinator', 'area_rep'         // State
]);
const CONFIG_KEY = 'memberDirectorySharing';

function isAdminRole(role: string | null | undefined) {
  return adminRoles.has((role ?? '').toLowerCase());
}

async function readConfig() {
  const setting = await prisma.appSetting.findUnique({ where: { key: CONFIG_KEY } });
  return normalizeMemberDirectoryConfig(setting?.value ?? getDefaultMemberDirectoryConfig());
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

    const body = req.body as { optionalFields?: unknown };
    const allowedOptionalFields = new Set<DirectoryOptionalFieldKey>(OPTIONAL_DIRECTORY_FIELD_DEFINITIONS.map((field) => field.key));
    const optionalFields = Array.isArray(body.optionalFields)
      ? Array.from(new Set(
          body.optionalFields
            .map((field) => String(field).trim())
            .filter((field): field is DirectoryOptionalFieldKey => allowedOptionalFields.has(field as DirectoryOptionalFieldKey))
        ))
      : [];

    const config = { optionalFields };

    await prisma.appSetting.upsert({
      where: { key: CONFIG_KEY },
      create: { key: CONFIG_KEY, value: config },
      update: { value: config }
    });

    return res.status(200).json(config);
  }

  return res.status(405).json({ message: 'Method not allowed' });
}