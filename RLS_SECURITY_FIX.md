# CMA Directory - RLS Security Fix Guide

## Problem
Supabase security linter found **RLS (Row Level Security) disabled** on all public tables:
- Account, Chapter, OrgUnit, Person, OfficerAssignment, Motorcycle, RoleNote, EmergencyContact, Session
- Session table also exposed sensitive `token` column without RLS protection

## Solution Implemented

### 1. Created RLS Migration
📁 **File:** [web/supabase/migrations/20260720_rls_security.sql](../web/supabase/migrations/20260720_rls_security.sql)

This migration:
- ✅ Enables RLS on all 10 affected tables
- ✅ Creates security functions for authorization checks
- ✅ Implements 30+ RLS policies based on your authorization model
- ✅ Protects sensitive data (tokens, emergency contacts, etc.)

### 2. Added RLS Context Helpers
📁 **Files Created:**
- [web/src/lib/withRLSContext.ts](../web/src/lib/withRLSContext.ts) - Middleware wrappers
- Updated [web/src/lib/supabaseAuth.ts](../web/src/lib/supabaseAuth.ts) - Context functions

### 3. Key Features of RLS Implementation

#### Authorization Model Enforced:
```
- Superusers/Root: Full access to all data
- Chapter Admins: Full access to their chapter's data
  (via active OfficerAssignment)
- Personal Access: Users can see their own account and records
- Org Unit Access: OrgUnit managers can see their unit
```

#### Tables Protected:
| Table | Protection | Read By |
|-------|-----------|---------|
| Account | Credentials | Owner only + Superuser |
| Session | **Tokens** | Owner only + Superuser |
| Chapter | Chapter data | Chapter admins + Superuser |
| Person | Member data | Chapter admins + Superuser + Self |
| OfficerAssignment | Officer roles | Chapter admins + Superuser + Officer |
| Motorcycle | Motorcycles | Owner + Chapter admin + Superuser |
| RoleNote | Role notes | Chapter admin + Superuser |
| EmergencyContact | EC data | Chapter admin + Superuser + Self |
| ChapterEvent* | Events | Chapter admin + Superuser |

---

## How to Apply This Fix

### Option A: Supabase Web Dashboard (Recommended)
1. Go to [supabase.com](https://supabase.com) → Your Project → SQL Editor
2. Create new query
3. Copy entire contents of [web/supabase/migrations/20260720_rls_security.sql](../web/supabase/migrations/20260720_rls_security.sql)
4. Paste and Run
5. Verify: No errors in output

### Option B: Supabase CLI
```bash
cd web
supabase db execute --file supabase/migrations/20260720_rls_security.sql
```

### Option C: psql (if installed)
```bash
cd web
psql $DATABASE_URL -f supabase/migrations/20260720_rls_security.sql
```

---

## Critical: Update Your Auth Flow

**Without this step, RLS will block all database access.** The RLS policies rely on a session variable `app.current_account_id` to identify the current user.

### Step 1: Update Login Endpoint
Your login endpoint already returns the account ID. Ensure it's being used client-side and passed to subsequent requests.

### Step 2: Set RLS Context in API Endpoints

**Simple Option:** Use the middleware wrapper
```typescript
// Before:
export default async (req, res) => {
  const account = await requireAuthenticatedAccount(req);
  // ... rest of handler
};

// After:
import { withRLSContext } from '@/lib/withRLSContext';

export default withRLSContext(async (req, res, account) => {
  // RLS context is automatically set
  // Database queries now respect RLS policies
  // account is guaranteed to be authenticated
});
```

**Advanced Option:** Manual control
```typescript
import { authenticateAndSetRLSContext } from '@/lib/supabaseAuth';

export default async (req, res) => {
  const account = await authenticateAndSetRLSContext(req);
  if (!account) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  // RLS context is now set for all Prisma queries
  // ...
};
```

### Step 3: Update High-Priority Endpoints

Priority endpoints to update (these handle sensitive data):
1. `/api/members/[id]` - Member details
2. `/api/members/index` - Member list
3. `/api/chapters/[id]` - Chapter details
4. `/api/chapters/[id]/officers` - Officer assignments
5. `/api/me/*` - Current user endpoints
6. `/api/reporting/*` - Reporting endpoints

---

## Verification Checklist

### ✅ Before Going to Production:

1. **Apply the migration**
   - [ ] Run migration in Supabase Dashboard or CLI
   - [ ] Check for errors

2. **Update API endpoints**
   - [ ] Identify all endpoints that query protected tables
   - [ ] Add `withRLSContext` wrapper or manual `setRLSContext()` call
   - [ ] Test with sample requests

3. **Test access control**
   - [ ] Login as superuser → Can see all data
   - [ ] Login as chapter admin → Can only see their chapter
   - [ ] Login as member → Can only see themselves + directory fields
   - [ ] Unauthenticated request → Gets 401 or empty results

4. **Test sensitive endpoints**
   - [ ] `/api/members/[id]` - Non-admin can't access other members
   - [ ] `/api/chapters/[id]` - Non-admin can't access other chapters
   - [ ] Session tokens never leaked in any response

5. **Monitor logs**
   - [ ] No "permission denied" SQL errors in Supabase logs
   - [ ] All auth endpoints working as before

---

## Troubleshooting

### "permission denied for schema public"
- **Cause:** RLS context not set before database query
- **Fix:** Use `withRLSContext` middleware or call `setRLSContext()` manually

### "relation not found" or similar error
- **Cause:** RLS policies reference wrong schema
- **Fix:** Verify all references use `app.` schema prefix (should be in migration already)

### RLS blocking legitimate access
- **Cause:** Authorization check too restrictive
- **Fix:** Review relevant policy in `20260720_rls_security.sql` and adjust `WHERE` clause
- **Example:** Officer assignments might need to check inactive periods differently

### Performance degradation
- **Cause:** Poorly optimized RLS policies with N+1 queries
- **Fix:** Add indexes on `chapter_id`, `person_id`, `org_unit_id` if not present
- **Status:** Already done in schema

---

## Next Steps

1. **This week:** Apply migration and test
2. **This week:** Update priority API endpoints with RLS context
3. **Next week:** Audit all other endpoints and update remaining handlers
4. **Test:** Run full test suite to catch any regressions
5. **Release:** Deploy with confidence that data is protected

---

## Reference

- Supabase RLS Docs: https://supabase.com/docs/guides/database/row-level-security
- RLS Query Performance: https://supabase.com/docs/guides/database/postgres/row-level-security
- CMA Database Schema: [web/prisma/schema.prisma](../web/prisma/schema.prisma)

---

## Questions?

If RLS policies need adjustment, review the authorization logic in:
- [web/src/lib/chapterDirectoryAccess.ts](../web/src/lib/chapterDirectoryAccess.ts) - Current auth checks (reference)
- [web/supabase/migrations/20260720_rls_security.sql](../web/supabase/migrations/20260720_rls_security.sql) - RLS policies (to update)
