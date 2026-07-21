# Example: Updating an API Endpoint for RLS

## Before (Without RLS)
```typescript
// web/src/pages/api/me.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuthenticatedAccount } from '@/lib/supabaseAuth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const account = await requireAuthenticatedAccount(req);
  if (!account) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

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
    personId: account.personId
  });
}
```

## After (With RLS Protection)

### Option 1: Using the Middleware Wrapper (Recommended)
```typescript
// web/src/pages/api/me.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { withRLSContext } from '@/lib/withRLSContext';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Account is guaranteed to be authenticated
  // RLS context is automatically set
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
    personId: account.personId
  });
}

export default withRLSContext(handler);
```

### Option 2: Manual RLS Context (More Control)
```typescript
// web/src/pages/api/me.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateAndSetRLSContext } from '@/lib/supabaseAuth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // This authenticates AND sets RLS context in one call
  const account = await authenticateAndSetRLSContext(req);
  if (!account) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

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
    personId: account.personId
  });
}
```

## What Changed?

| Aspect | Before | After |
|--------|--------|-------|
| Auth | `requireAuthenticatedAccount()` | `withRLSContext()` or `authenticateAndSetRLSContext()` |
| RLS Context | ❌ Not set | ✅ Automatically set |
| Database Access | No policy enforcement | ✅ RLS policies enforced |
| Account Param | Must check for null | ✅ Guaranteed non-null |
| Error Handling | Manual 401 checks | ✅ Automatic with `withRLSContext()` |

## When to Use Which?

### Use `withRLSContext()` wrapper when:
- ✅ Endpoint is simple and requires authentication
- ✅ Endpoint only does SELECT queries
- ✅ You want automatic error handling
- ✅ No custom logic needed between auth and handler

### Use `authenticateAndSetRLSContext()` when:
- ✅ Endpoint has complex logic
- ✅ You need explicit control over error handling
- ✅ You need to check specific fields of account
- ✅ You have POST/PUT/DELETE operations

## Endpoints to Update (Priority Order)

1. **Sensitive User Data**
   - `/api/members/[id].ts`
   - `/api/members/index.ts`
   - `/api/me/*`

2. **Chapter Management**
   - `/api/chapters/[id].ts`
   - `/api/chapters/index.ts`
   - `/api/chapters/[id]/officers.ts`

3. **Reporting & Events**
   - `/api/reporting/*`
   - `/api/reporting/events.ts`
   - `/api/reporting/access.ts`

4. **Everything Else**
   - All remaining endpoints that use Prisma

---

## Testing Your Changes

### Test as Superuser
```bash
# Should see all data
curl -H "Cookie: supabase_access_token=<SUPERUSER_TOKEN>" http://localhost:3000/api/members
```

### Test as Chapter Admin
```bash
# Should only see members from their chapter
curl -H "Cookie: supabase_access_token=<CHAPTER_ADMIN_TOKEN>" http://localhost:3000/api/members
```

### Test as Regular Member
```bash
# Should get 401 or empty list
curl -H "Cookie: supabase_access_token=<MEMBER_TOKEN>" http://localhost:3000/api/members
```

### Test Unauthenticated
```bash
# Should get 401
curl http://localhost:3000/api/members
```
