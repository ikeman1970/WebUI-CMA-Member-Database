import { createHash, randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { createSupabaseServerClient } from '@/lib/supabaseAuth';

const DEFAULT_INVITE_HOURS = 72;
const SUPABASE_INVITE_REDIRECT_PATH = '/set-password';

export type InviteDispatchResult = {
  mode: 'blocked-nonprod' | 'simulated' | 'sent';
  recipient: string;
};

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function buildInviteToken() {
  return randomBytes(32).toString('hex');
}

function getAppBaseUrl() {
  return process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

function getInviteHours() {
  const configured = Number.parseInt(process.env.INVITE_TOKEN_EXPIRY_HOURS ?? '', 10);
  if (Number.isNaN(configured) || configured <= 0) {
    return DEFAULT_INVITE_HOURS;
  }
  return configured;
}

function allowNonProdRecipient(email: string) {
  const allowlist = (process.env.NON_PROD_EMAIL_ALLOWLIST ?? '')
    .split(',')
    .map((item) => normalizeEmail(item))
    .filter(Boolean);

  if (allowlist.length === 0) {
    return false;
  }

  return allowlist.includes(normalizeEmail(email));
}

function shouldSendRealEmail(email: string) {
  const enabled = String(process.env.ENABLE_INVITE_EMAIL_SEND ?? '').trim().toLowerCase();
  if (!['1', 'true', 'yes', 'on'].includes(enabled)) {
    return false;
  }

  if (process.env.NODE_ENV === 'production') {
    return true;
  }

  return allowNonProdRecipient(email);
}

export async function findSupabaseUserIdByEmail(email: string) {
  const supabase = createSupabaseServerClient();
  const normalized = normalizeEmail(email);
  const perPage = 100;

  for (let page = 1; page <= 20; page += 1) {
    const users = await supabase.auth.admin.listUsers({ page, perPage });
    const match = users.data.users.find((user) => normalizeEmail(user.email ?? '') === normalized);
    if (match?.id) {
      return match.id;
    }

    if (users.data.users.length < perPage) {
      break;
    }
  }

  return null;
}

export async function createOrUpdateSupabaseIdentity(email: string) {
  const supabase = createSupabaseServerClient();
  const normalized = normalizeEmail(email);

  const existingUserId = await findSupabaseUserIdByEmail(normalized);
  if (existingUserId) {
    return existingUserId;
  }

  const bootstrapPassword = randomBytes(24).toString('base64url');
  const created = await supabase.auth.admin.createUser({
    email: normalized,
    password: bootstrapPassword,
    email_confirm: true
  });

  if (created.error || !created.data.user?.id) {
    throw new Error(created.error?.message ?? 'Failed to create auth identity.');
  }

  return created.data.user.id;
}

export async function dispatchInviteEmail(email: string, setupLink: string): Promise<InviteDispatchResult> {
  const normalized = normalizeEmail(email);
  if (!shouldSendRealEmail(normalized)) {
    if (process.env.NODE_ENV === 'production') {
      return { mode: 'simulated', recipient: normalized };
    }
    return { mode: 'blocked-nonprod', recipient: normalized };
  }

  const supabase = createSupabaseServerClient();
  const redirectUrl = new URL(`${getAppBaseUrl()}${SUPABASE_INVITE_REDIRECT_PATH}`);
  try {
    const setupUrl = new URL(setupLink);
    const inviteToken = setupUrl.searchParams.get('invite');
    if (inviteToken) {
      redirectUrl.searchParams.set('invite', inviteToken);
    }
  } catch {
    // Ignore malformed setup links and rely on the default redirect path.
  }
  const invited = await supabase.auth.admin.inviteUserByEmail(normalized, {
    redirectTo: redirectUrl.toString()
  });

  if (invited.error) {
    throw new Error(invited.error.message);
  }

  return { mode: 'sent', recipient: normalized };
}

export async function provisionAccountInvite(input: {
  personId: string;
  email: string;
  chapterId?: string | null;
  createdByAccountId?: string | null;
}) {
  const email = normalizeEmail(input.email);
  const authUserId = await createOrUpdateSupabaseIdentity(email);

  const existingAccount = await prisma.account.findFirst({
    where: { personId: input.personId }
  });

  const resolvedAccount = existingAccount
    ? await prisma.account.update({
        where: { id: existingAccount.id },
        data: {
          email,
          username: email,
          authUserId,
          chapterId: input.chapterId ?? null,
          personId: input.personId,
          mustChangePassword: true,
          isDisabled: false,
          accountType: 'member',
          scopeType: 'chapter',
          type: 'member',
          role: 'member'
        }
      })
    : await prisma.account.create({
        data: {
          email,
          username: email,
          authUserId,
          chapterId: input.chapterId ?? null,
          personId: input.personId,
          mustChangePassword: true,
          isDisabled: false,
          accountType: 'member',
          scopeType: 'chapter',
          type: 'member',
          role: 'member'
        }
      });

  await prisma.accountInviteToken.updateMany({
    where: {
      accountId: resolvedAccount.id,
      usedAt: null
    },
    data: {
      usedAt: new Date()
    }
  });

  const rawToken = buildInviteToken();
  const expiresAt = new Date(Date.now() + getInviteHours() * 60 * 60 * 1000);

  await prisma.accountInviteToken.create({
    data: {
      tokenHash: hashToken(rawToken),
      accountId: resolvedAccount.id,
      personId: input.personId,
      inviteEmail: email,
      expiresAt,
      createdByAccountId: input.createdByAccountId ?? null
    }
  });

  const setupLink = `${getAppBaseUrl()}${SUPABASE_INVITE_REDIRECT_PATH}?invite=${encodeURIComponent(rawToken)}`;

  const dispatch = await dispatchInviteEmail(email, setupLink);

  return {
    accountId: resolvedAccount.id,
    email,
    mustChangePassword: true,
    invite: {
      token: rawToken,
      setupLink,
      expiresAt: expiresAt.toISOString(),
      dispatchMode: dispatch.mode
    }
  };
}

export async function getValidInviteToken(token: string) {
  const tokenHash = hashToken(token);
  const record = await prisma.accountInviteToken.findUnique({
    where: { tokenHash }
  });

  if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
    return null;
  }

  return record;
}

export async function markInviteTokenUsed(token: string) {
  const tokenHash = hashToken(token);

  const claimed = await prisma.accountInviteToken.updateMany({
    where: {
      tokenHash,
      usedAt: null,
      expiresAt: {
        gt: new Date()
      }
    },
    data: {
      usedAt: new Date()
    }
  });

  if (claimed.count === 0) {
    return null;
  }

  return true;
}
