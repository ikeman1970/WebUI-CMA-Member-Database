import type { NextApiRequest, NextApiResponse } from 'next';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '@/lib/supabaseAuth';

function buildExpiredCookie(name: string) {
  return `${name}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  res.setHeader('Set-Cookie', [
    buildExpiredCookie(ACCESS_TOKEN_COOKIE),
    buildExpiredCookie(REFRESH_TOKEN_COOKIE)
  ]);

  return res.status(200).json({ message: 'Logged out' });
}
