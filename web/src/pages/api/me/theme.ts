import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { authenticateAndSetRLSContext } from '@/lib/supabaseAuth';

type ThemePreference = 'light' | 'dark';

function normalizeTheme(value: unknown): ThemePreference | null {
  if (value === 'light' || value === 'dark') {
    return value;
  }
  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const account = await authenticateAndSetRLSContext(req);
  if (!account) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      themePreference: normalizeTheme(account.themePreference) ?? 'dark'
    });
  }

  if (req.method !== 'PUT') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const nextTheme = normalizeTheme((req.body as { themePreference?: string })?.themePreference);
  if (!nextTheme) {
    return res.status(400).json({ message: 'themePreference must be "light" or "dark".' });
  }

  const updated = await prisma.account.update({
    where: { id: account.id },
    data: { themePreference: nextTheme }
  });

  return res.status(200).json({
    themePreference: normalizeTheme(updated.themePreference) ?? 'dark'
  });
}
