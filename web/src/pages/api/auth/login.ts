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
  try {
    const bootstrapEmail = process.env.BOOTSTRAP_ROOT_EMAIL;
    const bootstrapUsername = process.env.BOOTSTRAP_ROOT_USERNAME ?? 'root';
    const bootstrapPassword = process.env.BOOTSTRAP_ROOT_PASSWORD;

    console.log('[BOOTSTRAP] Starting bootstrap check');
    console.log('[BOOTSTRAP] Config - Email:', bootstrapEmail, 'Username:', bootstrapUsername, 'PasswordSet:', !!bootstrapPassword);

    if (!bootstrapEmail || !bootstrapPassword) {
      console.log('[BOOTSTRAP] Missing config');
      return null;
    }

    const emailMatch = usernameOrEmail === bootstrapEmail;
    const usernameMatch = usernameOrEmail === bootstrapUsername;
    const passwordMatch = password === bootstrapPassword;

    console.log('[BOOTSTRAP] Matching - Email:', emailMatch, 'Username:', usernameMatch, 'Password:', passwordMatch);

    if (!(emailMatch || usernameMatch) || !passwordMatch) {
      console.log('[BOOTSTRAP] Credentials do not match');
      return null;
    }

    console.log('[BOOTSTRAP] Credentials match! Creating account...');

    // Create new account using raw SQL
    const newId = require('crypto').randomUUID();
    console.log('[BOOTSTRAP] New account ID:', newId);
    
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
    
    console.log('[BOOTSTRAP] Account created successfully');
    
    // Create Supabase auth user
    console.log('[BOOTSTRAP] Creating Supabase auth user...');
    await ensureBootstrapAuthUser(bootstrapEmail, bootstrapPassword);
    console.log('[BOOTSTRAP] Supabase auth user created');
    
    return { id: newId, email: bootstrapEmail, username: bootstrapUsername };
  } catch (error) {
    console.error('[BOOTSTRAP ERROR]', error instanceof Error ? error.message : String(error));
    throw error;
  }
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
      console.log('[LOGIN] Auth failed with error:', supabaseAuth.error.message);
      console.log('[LOGIN] Attempting bootstrap...');
      console.log('[LOGIN] BOOTSTRAP_ROOT_EMAIL env:', process.env.BOOTSTRAP_ROOT_EMAIL);
      console.log('[LOGIN] Input credentials:', { usernameOrEmail, passwordMatch: password === process.env.BOOTSTRAP_ROOT_PASSWORD });
      
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

    // Query Account by email - bypassing RLS for login (use raw SQL)
    console.log('[LOGIN] Looking up Account record...');
    const accounts = await prisma.$queryRaw`
      SELECT * FROM app."Account" 
      WHERE "email" = ${supabaseUser.email}
      LIMIT 1
    ` as any[];
    let account = accounts?.[0] || null;

    console.log('[LOGIN] Account lookup result:', account ? `Found: ${account.id}` : 'Not found');

    // If account doesn't exist, check if this is the bootstrap email and create it
    if (!account && supabaseUser.email === process.env.BOOTSTRAP_ROOT_EMAIL) {
      console.log('[LOGIN] Account not found but Supabase user exists for bootstrap email - creating Account record');
      const newId = require('crypto').randomUUID();
      
      try {
        await prisma.$executeRawUnsafe(
          `INSERT INTO app."Account" (id, email, username, role, "accountType", "scopeType", "type", "mustChangePassword", "isDisabled", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          newId,
          process.env.BOOTSTRAP_ROOT_EMAIL,
          process.env.BOOTSTRAP_ROOT_USERNAME ?? 'root',
          'root',
          'internal',
          'global',
          'admin',
          false,
          false,
          new Date(),
          new Date()
        );
        console.log('[LOGIN] Account record created for bootstrap email');
        account = { 
          id: newId, 
          email: process.env.BOOTSTRAP_ROOT_EMAIL, 
          username: process.env.BOOTSTRAP_ROOT_USERNAME ?? 'root',
          role: 'root'
        };
      } catch (createError) {
        console.error('[LOGIN] Failed to create Account record:', createError instanceof Error ? createError.message : String(createError));
        return res.status(500).json({ message: 'Account setup failed' });
      }
    }

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
