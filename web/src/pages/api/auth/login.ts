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

  console.log('[BOOTSTRAP] Email env:', bootstrapEmail ? 'set' : 'NOT SET');
  console.log('[BOOTSTRAP] Password env:', bootstrapPassword ? 'set' : 'NOT SET');

  if (!bootstrapEmail || !bootstrapPassword) {
    console.log('[BOOTSTRAP] Missing bootstrap config, returning null');
    return null;
  }

  const identifierMatches = usernameOrEmail === bootstrapEmail || usernameOrEmail === bootstrapUsername;
  console.log('[BOOTSTRAP] Identifier match:', identifierMatches, `(input: ${usernameOrEmail}, email: ${bootstrapEmail}, username: ${bootstrapUsername})`);
  
  if (!identifierMatches || password !== bootstrapPassword) {
    console.log('[BOOTSTRAP] Credentials do not match, returning null');
    return null;
  }

  // Allow bootstrap for bootstrap email/username regardless of mode
  // This ensures initial root account creation works in production
  console.log('[BOOTSTRAP] Bootstrap credentials match, proceeding with account creation');

  // Look up or create account using raw SQL to bypass RLS
  console.log('[BOOTSTRAP] Looking up existing account...');
  const existingAccounts = await prisma.$queryRaw`
    SELECT * FROM app."Account" 
    WHERE "email" = ${bootstrapEmail} OR "username" = ${bootstrapUsername}
    LIMIT 1
  ` as any[];
  
  let account = existingAccounts?.[0];
  console.log('[BOOTSTRAP] Existing account:', account ? account.id : 'None');

  if (account) {
    // Update existing account
    console.log('[BOOTSTRAP] Updating existing account');
    await prisma.$executeRawUnsafe(
      `UPDATE app."Account" SET "role" = ?, "accountType" = ?, "scopeType" = ?, "type" = ?, "mustChangePassword" = ?, "isDisabled" = ? WHERE "id" = ?`,
      'root',
      'internal',
      'global',
      'admin',
      false,
      false,
      account.id
    );
  } else {
    // Create new account using raw SQL to bypass RLS
    const newId = require('crypto').randomUUID();
    console.log('[BOOTSTRAP] Creating new account with ID:', newId);
    await prisma.$executeRawUnsafe(
      `INSERT INTO app."Account" (id, email, username, role, "accountType", "scopeType", "type", "mustChangePassword", "isDisabled", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      newId,
      bootstrapEmail,
      bootstrapUsername,
      'root',
      'internal',
      'global',
      'admin',
      false,
      false,
      new Date(),
      new Date()
    );
    account = { id: newId, email: bootstrapEmail, username: bootstrapUsername };
    console.log('[BOOTSTRAP] New account created');
  }

  // Ensure Supabase auth user exists
  console.log('[BOOTSTRAP] Creating/updating Supabase auth user');
  await ensureBootstrapAuthUser(bootstrapEmail, bootstrapPassword);
  console.log('[BOOTSTRAP] Supabase auth user ready');
  
  return account;
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

  let supabaseAuth: any;

  try {
    // First, try to authenticate with Supabase
    const supabase = createSupabaseServerClient();
    
    console.log('[LOGIN] Attempting auth with:', usernameOrEmail);
    
    // Attempt login with provided credentials - this will fail for new bootstrap root
    supabaseAuth = await supabase.auth.signInWithPassword({
      email: usernameOrEmail,
      password
    });

    console.log('[LOGIN] Initial auth result:', supabaseAuth.error ? `Error: ${supabaseAuth.error.message}` : 'Success');

    // If Supabase auth fails, try bootstrap logic
    if (supabaseAuth.error) {
      console.log('[LOGIN] Auth failed, attempting bootstrap...');
      const bootstrapAccount = await bootstrapRootIfEligible(usernameOrEmail, password);
      
      console.log('[LOGIN] Bootstrap result:', bootstrapAccount ? `Account created: ${bootstrapAccount.id}` : 'Not eligible for bootstrap');
      
      if (bootstrapAccount?.email) {
        // Bootstrap account created, set up auth user
        console.log('[LOGIN] Ensuring Supabase auth user exists...');
        await ensureBootstrapAuthUser(bootstrapAccount.email, password);
        
        console.log('[LOGIN] Retrying Supabase auth after bootstrap...');
        // Now retry Supabase auth
        supabaseAuth = await supabase.auth.signInWithPassword({
          email: bootstrapAccount.email,
          password
        });
        
        console.log('[LOGIN] Retry result:', supabaseAuth.error ? `Error: ${supabaseAuth.error.message}` : 'Success');
      }
    }

    if (supabaseAuth.error || !supabaseAuth.data.session?.access_token) {
      console.log('[LOGIN] Final auth failed:', supabaseAuth.error?.message);
      return res.status(401).json({ message: supabaseAuth.error?.message ?? 'Invalid credentials.' });
    }
    
    console.log('[LOGIN] Supabase auth succeeded');
  } catch (error) {
    console.error('[LOGIN ERROR]', error);
    return res.status(500).json({ message: 'Login error: ' + (error instanceof Error ? error.message : String(error)) });
  }

  // Supabase auth successful - now look up the CMA Account
  try {
    const supabaseUser = supabaseAuth.data.user;
    if (!supabaseUser?.id) {
      console.log('[LOGIN] No Supabase user ID');
      return res.status(401).json({ message: 'Unable to verify auth.' });
    }

    console.log('[LOGIN] Supabase user ID:', supabaseUser.id, 'Email:', supabaseUser.email);

    // Query Account by email or username - bypassing RLS for login (use raw SQL)
    console.log('[LOGIN] Looking up Account record...');
    const accounts = await prisma.$queryRaw`
      SELECT * FROM app."Account" 
      WHERE "email" = ${supabaseUser.email} OR "username" = ${usernameOrEmail}
      LIMIT 1
    ` as any[];
    const account = accounts?.[0] || null;

    console.log('[LOGIN] Account lookup result:', account ? `Found: ${account.id}` : 'Not found');

    if (!account) {
      return res.status(401).json({ message: 'Account not found.' });
    }

    // Now set RLS context with the correct Account ID
    console.log('[LOGIN] Setting RLS context...');
    await setRLSContext(account.id);
    console.log('[LOGIN] RLS context set');

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

    console.log('[LOGIN] Setting auth cookies');
    res.setHeader('Set-Cookie', [
      buildCookie(SUPABASE_ACCESS_TOKEN_COOKIE, accessToken, maxAge),
      buildCookie(SUPABASE_REFRESH_TOKEN_COOKIE, refreshToken, maxAge * 30)
    ]);

    console.log('[LOGIN] Updating lastLoginAt');
    await prisma.account.update({
      where: { id: account.id },
      data: { lastLoginAt: new Date() }
    });

    console.log('[LOGIN] Success - returning account');
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
  } catch (error) {
    console.error('[LOGIN ACCOUNT LOOKUP ERROR]', error);
    return res.status(500).json({ message: 'Account lookup error: ' + (error instanceof Error ? error.message : String(error)) });
  }
}
