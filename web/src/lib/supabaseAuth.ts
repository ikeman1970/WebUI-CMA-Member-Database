import type { NextApiRequest } from 'next';
import { createClient } from '@supabase/supabase-js';
import { prisma } from '@/lib/prisma';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase configuration in environment.');
}

const supabaseUrlValue = supabaseUrl;
const supabaseServiceRoleKeyValue = supabaseServiceRoleKey;

export const ACCESS_TOKEN_COOKIE = 'supabase_access_token';
export const REFRESH_TOKEN_COOKIE = 'supabase_refresh_token';

export function parseCookies(cookieHeader: string | null | undefined) {
  if (!cookieHeader) return {};

  return cookieHeader.split(';').reduce<Record<string, string>>((acc, part) => {
    const [key, ...value] = part.trim().split('=');
    acc[key] = value.join('=');
    return acc;
  }, {});
}

export function getAuthorizationToken(req: NextApiRequest) {
  const header = req.headers.authorization;
  if (typeof header === 'string' && header.toLowerCase().startsWith('bearer ')) {
    return header.slice(7).trim();
  }

  const cookies = parseCookies(req.headers.cookie ?? null);
  return cookies[ACCESS_TOKEN_COOKIE] || null;
}

export function createSupabaseServerClient() {
  return createClient(supabaseUrlValue!, supabaseServiceRoleKeyValue!, {
    auth: { persistSession: false }
  });
}

export async function getSupabaseUser(req: NextApiRequest) {
  const accessToken = getAuthorizationToken(req);
  if (!accessToken) return null;

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser(accessToken);

  if (error || !data?.user) {
    return null;
  }

  return data.user;
}

export async function requireAuthenticatedAccount(req: NextApiRequest) {
  const user = await getSupabaseUser(req);
  if (!user?.email) return null;

  return await prisma.account.findFirst({
    where: { email: user.email }
  });
}

/**
 * Set the RLS context for the current request.
 * This must be called before any database queries that rely on RLS policies.
 * 
 * @param accountId - The ID of the authenticated account
 */
export async function setRLSContext(accountId: string | null | undefined) {
  if (!accountId) {
    // Clear context if no account
    await prisma.$executeRawUnsafe('SELECT set_config(?, ?, ?)', 'app.current_account_id', '', false);
    return;
  }

  // Set the app.current_account_id session variable
  // This will be used by RLS policies to determine access
  await prisma.$executeRawUnsafe('SELECT set_config(?, ?, ?)', 'app.current_account_id', accountId, false);
}

/**
 * Helper to authenticate a request and set RLS context in one call.
 * Useful for API endpoints that need both auth and RLS.
 */
export async function authenticateAndSetRLSContext(req: NextApiRequest) {
  const account = await requireAuthenticatedAccount(req);
  if (!account) {
    return null;
  }

  await setRLSContext(account.id);
  return account;
}
