import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { createSupabaseServerClient, setRLSContext } from '@/lib/supabaseAuth';

const SUPABASE_ACCESS_TOKEN_COOKIE = 'supabase_access_token';
const SUPABASE_REFRESH_TOKEN_COOKIE = 'supabase_refresh_token';

function buildCookie(name: string, value: string, maxAge: number) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${name}=${encodeURIComponent(value)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

async function bootstrapRootIfEligible(usernameOrEmail: string, password: string) {
  const bootstrapEmail = process.env.BOOTSTRAP_ROOT_EMAIL;
  const bootstrapUsername = process.env.BOOTSTRAP_ROOT_USERNAME ?? 'root';
  const bootstrapPassword = process.env.BOOTSTRAP_ROOT_PASSWORD;

  if (!bootstrapEmail || !bootstrapPassword) {
    return null;
  }

  const identifierMatches = usernameOrEmail === bootstrapEmail || usernameOrEmail === bootstrapUsername;
  if (!identifierMatches || password !== bootstrapPassword) {
    return null;
  }

  // For production, check if admin accounts exist and block bootstrap
  // For dev/test (NODE_ENV !== 'production'), allow bootstrap anytime for testing
  if (process.env.NODE_ENV === 'production') {
    const existingAdmin = await prisma.account.findFirst({
      where: {
        OR: [
          { role: { equals: 'root', mode: 'insensitive' } },
          { role: { equals: 'superuser', mode: 'insensitive' } },
          { role: { equals: 'admin', mode: 'insensitive' } }
        ]
      }
    });

    if (existingAdmin) {
      return null;
    }
  }

  const account = await prisma.account.findFirst({
    where: {
      OR: [{ email: bootstrapEmail }, { username: bootstrapUsername }]
    }
  });

  const resolvedAccount = account
    ? await prisma.account.update({
        where: { id: account.id },
        data: {
          email: bootstrapEmail,
          username: bootstrapUsername,
          role: 'root',
          accountType: 'internal',
          scopeType: 'global',
          type: 'admin',
          mustChangePassword: false,
          isDisabled: false
        }
      })
    : await prisma.account.create({
        data: {
          email: bootstrapEmail,
          username: bootstrapUsername,
          role: 'root',
          accountType: 'internal',
          scopeType: 'global',
          type: 'admin',
          mustChangePassword: false,
          isDisabled: false
        }
      });

  await ensureBootstrapAuthUser(bootstrapEmail, bootstrapPassword);
  return resolvedAccount;
}

async function ensureBootstrapAuthUser(email: string, password: string) {
  const supabase = createSupabaseServerClient();
  const findExistingUser = async () => {
    const perPage = 100;

    for (let page = 1; page <= 20; page += 1) {
      const users = await supabase.auth.admin.listUsers({ page, perPage });
      const match = users.data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
      if (match) {
        return match;
      }

      if (users.data.users.length < perPage) {
        break;
      }
    }

    return null;
  };

  const existingUser = await findExistingUser();

  if (existingUser) {
    const { error } = await supabase.auth.admin.updateUserById(existingUser.id, {
      password,
      email_confirm: true
    });

    if (error) {
      throw new Error(error.message);
    }

    return existingUser;
  }

  try {
    const { error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (error) {
      throw new Error(error.message);
    }
  } catch (caughtError) {
    const message = caughtError instanceof Error ? caughtError.message : String(caughtError);
    if (!/already been registered|already registered/i.test(message)) {
      throw caughtError;
    }

    const duplicateUser = await findExistingUser();
    if (!duplicateUser) {
      throw caughtError;
    }

    const { error } = await supabase.auth.admin.updateUserById(duplicateUser.id, {
      password,
      email_confirm: true
    });

    if (error) {
      throw new Error(error.message);
    }
  }

  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { usernameOrEmail, password } = req.body as { usernameOrEmail?: string; password?: string };
  if (!usernameOrEmail || !password) {
    return res.status(400).json({ message: 'Missing username/email or password.' });
  }

  // First, try to authenticate with Supabase
  const supabase = createSupabaseServerClient();
  
  // Attempt login with provided credentials - this will fail for new bootstrap root
  let supabaseAuth = await supabase.auth.signInWithPassword({
    email: usernameOrEmail,
    password
  });

  // If Supabase auth fails, try bootstrap logic
  if (supabaseAuth.error) {
    const bootstrapAccount = await bootstrapRootIfEligible(usernameOrEmail, password);
    
    if (bootstrapAccount?.email) {
      // Bootstrap account created, set up auth user
      await ensureBootstrapAuthUser(bootstrapAccount.email, password);
      
      // Now retry Supabase auth
      supabaseAuth = await supabase.auth.signInWithPassword({
        email: bootstrapAccount.email,
        password
      });
    }
  }

  if (supabaseAuth.error || !supabaseAuth.data.session?.access_token) {
    return res.status(401).json({ message: supabaseAuth.error?.message ?? 'Invalid credentials.' });
  }

  // Supabase auth successful - now look up the CMA Account
  const supabaseUser = supabaseAuth.data.user;
  if (!supabaseUser?.id) {
    return res.status(401).json({ message: 'Unable to verify auth.' });
  }

  // Query Account by email or username - bypassing RLS for login (use raw SQL)
  const accounts = await prisma.$queryRaw`
    SELECT * FROM app."Account" 
    WHERE "email" = ${supabaseUser.email} OR "username" = ${usernameOrEmail}
    LIMIT 1
  ` as any[];
  const account = accounts?.[0] || null;

  if (!account) {
    return res.status(401).json({ message: 'Account not found.' });
  }

  // Now set RLS context with the correct Account ID
  await setRLSContext(account.id);

  if (!account) {
    return res.status(401).json({ message: 'Account not found.' });
  }

  if (account.isDisabled) {
    return res.status(403).json({ message: 'Account is disabled. Contact an administrator.' });
  }

  if (account.mustChangePassword) {
    return res.status(403).json({
      message: 'Password setup is required before sign-in. Use your invite link to set a password.',
      requiresPasswordSetup: true,
      passwordSetupPath: '/set-password'
    });
  }

  const accessToken = supabaseAuth.data.session.access_token;
  const refreshToken = supabaseAuth.data.session.refresh_token ?? '';
  const maxAge = 60 * 60 * 24;

  res.setHeader('Set-Cookie', [
    buildCookie(SUPABASE_ACCESS_TOKEN_COOKIE, accessToken, maxAge),
    buildCookie(SUPABASE_REFRESH_TOKEN_COOKIE, refreshToken, maxAge * 30)
  ]);

  await prisma.account.update({
    where: { id: account.id },
    data: { lastLoginAt: new Date() }
  });

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
    personId: account.personId,
    mustChangePassword: account.mustChangePassword
  });
}
