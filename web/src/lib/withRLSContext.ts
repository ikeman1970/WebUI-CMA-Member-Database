import type { NextApiRequest, NextApiResponse } from 'next';
import { setRLSContext, authenticateAndSetRLSContext } from '@/lib/supabaseAuth';

/**
 * Wraps an API handler to automatically set RLS context for authenticated requests.
 * 
 * Usage:
 *   export default withRLSContext(async (req, res, account) => {
 *     // account is automatically authenticated and RLS context is set
 *     // database queries will respect RLS policies
 *   });
 * 
 * @param handler - The API handler function
 * @param requireAuth - If true, return 401 if not authenticated (default: true)
 */
export function withRLSContext<T = void>(
  handler: (
    req: NextApiRequest,
    res: NextApiResponse<T>,
    account: { id: string; email?: string | null; role?: string | null } | null
  ) => Promise<void> | void,
  requireAuth = true
) {
  return async (req: NextApiRequest, res: NextApiResponse<T>) => {
    try {
      const account = await authenticateAndSetRLSContext(req);

      if (requireAuth && !account) {
        return res.status(401).json({ message: 'Unauthorized' } as any);
      }

      // RLS context is now set for this request
      return await handler(req, res, account);
    } catch (error) {
      console.error('[RLS Middleware Error]', error);
      return res.status(500).json({ message: 'Internal server error' } as any);
    }
  };
}

/**
 * Simpler wrapper that just sets RLS context without requiring auth.
 * Useful for public endpoints that should still respect RLS policies.
 */
export function withOptionalRLSContext<T = void>(
  handler: (req: NextApiRequest, res: NextApiResponse<T>) => Promise<void> | void
) {
  return async (req: NextApiRequest, res: NextApiResponse<T>) => {
    try {
      // Try to authenticate and set context, but don't fail if not authenticated
      const account = await authenticateAndSetRLSContext(req);

      // If not authenticated, clear the context
      if (!account) {
        await setRLSContext(null);
      }

      return await handler(req, res);
    } catch (error) {
      console.error('[Optional RLS Middleware Error]', error);
      return res.status(500).json({ message: 'Internal server error' } as any);
    }
  };
}
