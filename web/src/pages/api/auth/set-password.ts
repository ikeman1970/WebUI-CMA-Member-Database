import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { createSupabaseServerClient } from '@/lib/supabaseAuth';
import { getValidInviteToken, markInviteTokenUsed } from '@/lib/accountInvite';

function toNonEmptyString(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { inviteToken, password } = req.body as { inviteToken?: string; password?: string };
  const normalizedToken = toNonEmptyString(inviteToken);
  const normalizedPassword = toNonEmptyString(password);

  if (!normalizedToken || !normalizedPassword) {
    return res.status(400).json({ message: 'inviteToken and password are required.' });
  }

  if (normalizedPassword.length < 12) {
    return res.status(400).json({ message: 'Password must be at least 12 characters.' });
  }

  const invite = await getValidInviteToken(normalizedToken);
  if (!invite) {
    return res.status(400).json({ message: 'Invite token is invalid or expired.' });
  }

  const account = await prisma.account.findUnique({
    where: { id: invite.accountId }
  });

  if (!account || !account.email) {
    return res.status(404).json({ message: 'Account not found for invite.' });
  }

  const supabase = createSupabaseServerClient();
  let authUserId = account.authUserId;

  if (!authUserId) {
    const users = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const match = users.data.users.find((user) => (user.email ?? '').toLowerCase() === account.email?.toLowerCase());
    authUserId = match?.id ?? null;
  }

  if (!authUserId) {
    return res.status(404).json({ message: 'Auth identity not found for account.' });
  }

  const updatedUser = await supabase.auth.admin.updateUserById(authUserId, {
    password: normalizedPassword,
    email_confirm: true
  });

  if (updatedUser.error) {
    return res.status(500).json({ message: updatedUser.error.message });
  }

  const tokenMarked = await markInviteTokenUsed(normalizedToken);
  if (!tokenMarked) {
    return res.status(400).json({ message: 'Invite token has already been used.' });
  }

  await prisma.account.update({
    where: { id: account.id },
    data: {
      authUserId,
      mustChangePassword: false,
      lastPasswordChangeAt: new Date()
    }
  });

  return res.status(200).json({
    message: 'Password set successfully. You can now sign in.',
    accountId: account.id
  });
}
