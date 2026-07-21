import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateAndSetRLSContext } from '@/lib/supabaseAuth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const account = await authenticateAndSetRLSContext(req);
  if (!account) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  return res.status(200).json({
    id: account.id,
    email: account.email,
    username: account.username,
    role: account.role,
    accountType: account.accountType,
    scopeType: account.scopeType,
    type: account.type,
    themePreference: account.themePreference,
    chapterId: account.chapterId,
    orgUnitId: account.orgUnitId,
    personId: account.personId
  });
}
