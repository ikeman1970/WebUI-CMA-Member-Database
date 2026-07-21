import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { email } = req.body as { email?: string };

  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  try {
    // Look up account by email (bypass RLS with raw SQL)
    const accounts = await prisma.$queryRaw`
      SELECT id, email, username FROM app."Account" 
      WHERE "email" = ${email}
      LIMIT 1
    ` as any[];

    const account = accounts?.[0];

    // Always return success message (don't reveal if account exists)
    const message = 'If an account exists with this email, your username has been sent to that email address.';

    if (!account) {
      console.log(`[FORGOT-USERNAME] No account found for email: ${email}`);
      return res.status(200).json({ message });
    }

    // In test mode, log to console instead of sending email
    const emailContent = `
Username Recovery
=================

Hello,

You requested to recover your username. Here is your account information:

Username: ${account.username}
Email: ${account.email}

If you didn't request this, please ignore this email.
    `;

    console.log('[FORGOT-USERNAME] Sending username recovery email');
    console.log('---');
    console.log(`To: ${process.env.TEST_EMAIL_ADDRESS || email}`);
    console.log(`Subject: Your CMADirectoryApp Username`);
    console.log('---');
    console.log(emailContent);
    console.log('---');

    return res.status(200).json({ message });
  } catch (error) {
    console.error('[FORGOT-USERNAME ERROR]', error);
    return res.status(500).json({ message: 'An error occurred processing your request' });
  }
}
