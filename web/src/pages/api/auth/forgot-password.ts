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
    const message = 'If an account exists with this email, a password reset link has been sent.';

    if (!account) {
      console.log(`[FORGOT-PASSWORD] No account found for email: ${email}`);
      return res.status(200).json({ message });
    }

    // Generate a password reset token (in production, this would be stored in DB with expiry)
    const resetToken = require('crypto').randomBytes(32).toString('hex');
    const resetLink = `${process.env.APP_BASE_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

    // In test mode, log to console instead of sending email
    const emailContent = `
Password Reset Request
======================

Hello ${account.username},

You requested a password reset. Click the link below to reset your password:

${resetLink}

This link will expire in 1 hour.

If you didn't request this, please ignore this email.
    `;

    console.log('[FORGOT-PASSWORD] Sending password reset email');
    console.log('---');
    console.log(`To: ${process.env.TEST_EMAIL_ADDRESS || email}`);
    console.log(`Subject: Password Reset Request`);
    console.log('---');
    console.log(emailContent);
    console.log('---');

    return res.status(200).json({ message });
  } catch (error) {
    console.error('[FORGOT-PASSWORD ERROR]', error);
    return res.status(500).json({ message: 'An error occurred processing your request' });
  }
}
