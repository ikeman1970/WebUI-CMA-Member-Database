# RLS Security Model Documentation

## Overview

This document defines the Row Level Security (RLS) implementation for the CMA Member Database. It specifies:
- Role hierarchy and access control model
- RLS policies for all protected tables
- Required security context variables
- Testing and validation requirements

**Last Updated:** 2026-07-20  
**Status:** Post-Remediation (Critical fixes applied)

---

## Security Model

### Role Hierarchy

```
ROOT (superuser)
├── Can access all data
├── Can modify all user roles and permissions
└── Can view sensitive system data

CEO (board)
├── Can access all board-level data
├── Cannot access ROOT data
└── Can manage lower-tier roles

BOARD_MEMBER (board)
├── Can access board-level reports
├── Cannot access CEO data
└── Can read organization structure

STATE_COORDINATOR (state_leadership)
├── Can access state-level data
├── Can manage area representatives
├── Cannot access other states' data
└── Can manage chapter officers

AREA_REP (state_leadership)
├── Can access chapter data in their state
├── Cannot access other states
└── Limited officer assignment authority

CHAPTER_PRESIDENT (chapter_admin)
├── Can access chapter members
├── Can manage chapter officers
├── Cannot access other chapters
└── Can update chapter events

MEMBER (minimal privilege)
├── Can read own profile
├── Can read own motorcycle data
├── Cannot read other members' data
└── Cannot modify any organizational data
```

### Access Control Matrix

| Resource | Root | CEO | Board | State Coord | Chapter Admin | Member |
|----------|------|-----|-------|-----------|---------------|--------|
| Account (self) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Account (others) | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ |
| Session (self) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Session (others) | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Chapter (all) | ✓ | ✓ | ✓ | ✓ | ✓* | ✗ |
| Person (all) | ✓ | ✓ | ✓ | ✓ | ✓* | ✗ |
| Person (self) | ✓ | ✓ | ✓ | ✓ | ✓* | ✓ |
| OfficerAssignment | ✓ | ✓ | ✓ | ✓ | ✓* | ✗ |
| role_permission | ✓ | ✗ | ✓ | ✓ | ✗ | ✗ |
| Motorcycle (own) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Motorcycle (other) | ✓ | ✗ | ✗ | ✗ | ✓* | ✗ |

*Only for own chapter

---

## Critical Security Context

### Session Variable: app.current_account_id

**Purpose:** Identifies the authenticated user for all RLS policies  
**Set By:** Application middleware (before each API request)  
**Validation:** Database validates account exists and is active

**Setting the Context:**

```sql
-- In your application's middleware or API route:
SET app.current_account_id = ${authenticatedAccountId};

-- The database validates:
-- 1. Account exists in app."Account" table
-- 2. Account is not disabled (isDisabled = false)
-- 3. Returns 'guest' if invalid
```

**Security Requirements:**
- MUST be set for every API request
- MUST be cleared/reset between requests
- MUST validate account is active (not disabled)
- MUST NOT be settable by client code
- MUST be set in transaction-safe manner

**Example (Next.js API Route):**
```typescript
export async function withRLSContext(
  accountId: string,
  callback: (client: PostgresClient) => Promise<any>
) {
  const client = new PostgresClient();
  try {
    await client.connect();
    // Set security context FIRST
    await client.query('SET app.current_account_id = $1', [accountId]);
    // Then execute queries
    return await callback(client);
  } finally {
    // Clear context
    await client.query('RESET app.current_account_id');
    await client.end();
  }
}
```

---

## Protected Tables & Policies

### 1. Account Table

**Sensitivity:** HIGH (Contains password hashes, auth info)

**Policies:**
- `account_superuser_all`: ROOT/superuser sees all
- `account_own_account`: Users see their own account (SELECT only)
- `account_board_access`: Board/CEO see board-level accounts
- `account_own_update`: Users can update own account (safe fields only)
- `account_superuser_*`: Only superuser can insert/delete

**Test Cases:**
```sql
-- User can read own account
SET app.current_account_id = 'user-a-id';
SELECT id, email FROM app."Account" WHERE id = 'user-a-id';  -- ✓ PASS

-- User cannot read other accounts
SET app.current_account_id = 'user-a-id';
SELECT id, email FROM app."Account" WHERE id = 'user-b-id';  -- ✗ BLOCKED

-- Board can read member accounts
SET app.current_account_id = 'board-member-id';
SELECT id, email FROM app."Account" WHERE role = 'member';  -- ✓ PASS
```

---

### 2. Session Table

**Sensitivity:** CRITICAL (Contains auth tokens)

**Policies:**
- `session_superuser_all`: ROOT sees all
- `session_own_session`: Users see only their sessions

**Important:** Tokens should be hashed in application layer

**Test Cases:**
```sql
-- User can read own sessions
SET app.current_account_id = 'user-a-id';
SELECT id FROM app."Session" WHERE "accountId" = 'user-a-id';  -- ✓ PASS

-- User cannot read other user's sessions
SET app.current_account_id = 'user-a-id';
SELECT id FROM app."Session" WHERE "accountId" = 'user-b-id';  -- ✗ BLOCKED
```

---

### 3. Chapter Table

**Sensitivity:** HIGH (Contains location, status info)

**Policies:**
- `chapter_superuser_all`: ROOT sees all
- `chapter_admin_access`: Chapter admins see their chapter
- `chapter_board_access`: Board/CEO see all chapters
- `chapter_evangelist_access`: Evangelists see their region chapters
- `chapter_state_leader_access`: State leaders see their state chapters

**Access Rules:**
- Chapter admins: Own chapter only
- State coordinators: Own state chapters
- National evangelists: Own region chapters
- Board: All chapters

**Test Cases:**
```sql
-- Chapter admin sees own chapter
SET app.current_account_id = 'chapter-admin-a-id';
SELECT id FROM app."Chapter" WHERE id = 'chapter-a-id';  -- ✓ PASS

-- Chapter admin cannot see other chapter
SET app.current_account_id = 'chapter-admin-a-id';
SELECT id FROM app."Chapter" WHERE id = 'chapter-b-id';  -- ✗ BLOCKED

-- State coordinator sees all chapters in state
SET app.current_account_id = 'state-coord-tx-id';
SELECT COUNT(*) FROM app."Chapter" WHERE state = 'TX';  -- ✓ PASS (multiple)

-- State coordinator cannot see other state chapters
SET app.current_account_id = 'state-coord-tx-id';
SELECT COUNT(*) FROM app."Chapter" WHERE state = 'CA';  -- ✗ 0 rows
```

---

### 4. Person Table

**Sensitivity:** HIGH (Contains member PII)

**Policies:**
- `person_superuser_all`: ROOT sees all
- `person_chapter_admin_access`: Chapter admins see their chapter members
- `person_own_record`: Members see their own record
- `person_board_access`: Board/CEO see all members
- `person_evangelist_access`: FIXED - Evangelists see their region members
- `person_state_leader_access`: State leaders see their state members

**Critical Fix (2026-07-20):** Removed logic error in `person_evangelist_access` policy that used missing parentheses, causing data leakage

**Test Cases:**
```sql
-- Member sees own person record
SET app.current_account_id = 'member-a-id';
SELECT id FROM app."Person" WHERE id = (SELECT person_id FROM app."Account" WHERE id = 'member-a-id');  -- ✓ PASS

-- Member cannot see other members
SET app.current_account_id = 'member-a-id';
SELECT id FROM app."Person" WHERE id != (SELECT person_id FROM app."Account" WHERE id = 'member-a-id') LIMIT 1;  -- ✗ BLOCKED

-- Chapter admin sees chapter members
SET app.current_account_id = 'chapter-admin-a-id';
SELECT COUNT(*) FROM app."Person" WHERE chapter_id = 'chapter-a-id';  -- ✓ PASS (may be >0)

-- Chapter admin cannot see other chapter members
SET app.current_account_id = 'chapter-admin-a-id';
SELECT id FROM app."Person" WHERE chapter_id = 'chapter-b-id' LIMIT 1;  -- ✗ BLOCKED
```

---

### 5. OfficerAssignment Table

**Sensitivity:** MEDIUM (Contains role assignments)

**Policies:**
- `officerassignment_superuser_all`: ROOT sees all
- `officerassignment_chapter_admin`: Chapter admins see assignments in their chapter
- `officerassignment_own_assignment`: Users see their own assignments
- `officerassignment_chapter_officer_access`: Officers see assignments in their chapter

**Critical Note:** `is_chapter_admin()` function explicitly checks for 'president' role (as of 2026-07-20)

**Test Cases:**
```sql
-- User sees their own officer assignment
SET app.current_account_id = 'officer-a-id';
SELECT id FROM app."OfficerAssignment" WHERE person_id = (SELECT person_id FROM app."Account" WHERE id = 'officer-a-id');  -- ✓ PASS

-- User cannot see other chapter's assignments
SET app.current_account_id = 'chapter-admin-a-id';
SELECT id FROM app."OfficerAssignment" WHERE chapter_id = 'chapter-b-id' LIMIT 1;  -- ✗ BLOCKED
```

---

### 6. role_permission Table

**Sensitivity:** CRITICAL (Defines what users can do)

**Policies:**
- `rolepermission_superuser_all`: ROOT sees/modifies all
- `rolepermission_board_access`: Board/CEO see board+ permissions
- `rolepermission_evangelist_access`: Evangelists see evangelist-level permissions
- `rolepermission_state_coordinator_access`: State coords see state-level permissions
- `rolepermission_area_rep_access`: Area reps see chapter-level permissions
- `rolepermission_chapter_president_access`: Presidents see chapter permissions

**Critical Note:** State coordinators can ONLY read state/chapter role permissions, not evangelist permissions (as of 2026-07-20)

**Test Cases:**
```sql
-- Member cannot see ANY permissions
SET app.current_account_id = 'member-a-id';
SELECT COUNT(*) FROM app."role_permission";  -- ✗ 0 rows (BLOCKED)

-- Board can see board permissions
SET app.current_account_id = 'board-member-a-id';
SELECT COUNT(*) FROM app."role_permission" WHERE role IN ('board', 'ceo');  -- ✓ PASS (>0)

-- State coordinator cannot see evangelist permissions
SET app.current_account_id = 'state-coord-tx-id';
SELECT COUNT(*) FROM app."role_permission" WHERE role = 'evangelist';  -- ✗ 0 rows (BLOCKED)
```

---

### 7. Other Protected Tables

These tables follow similar patterns:
- **OrgUnit**: Superuser all, account holders see their orgunit
- **Motorcycle**: Owners see own, admins see chapter members', superuser all
- **RoleNote**: Chapter admins/officers see own chapter
- **EmergencyContact**: Own record, or chapter admin of member
- **chapter_events**: Chapter admin/officer access
- **chapter_event_attendees**: Related to chapter access
- **chapter_event_follow_ups**: Related to chapter access
- **chapter_reporting_snapshots**: Chapter admin/officer access
- **chapter_status_transitions**: Chapter admin/officer access
- **account_invite_tokens**: Own tokens or superuser
- **AppSetting**: Superuser only

---

## Helper Functions

All helper functions are defined in the main RLS migration and validated on startup.

### Core Functions

| Function | Purpose | Returns |
|----------|---------|---------|
| `current_account_id()` | Get authenticated user ID | text (validated against DB) |
| `current_account_role()` | Get user's role | text ('root', 'ceo', 'board', 'member', etc.) |
| `is_superuser()` | Check if ROOT or SUPERUSER | boolean |
| `is_board_member()` | Check if CEO, BOARD, or BOARD_ADVISOR | boolean |
| `is_ceo()` | Check if CEO | boolean |
| `is_state_leadership()` | Check if any state-level role | boolean |
| `is_state_coordinator(state)` | Check if STATE_COORDINATOR for state | boolean |
| `is_state_leader(state)` | Check if STATE_COORDINATOR or AREA_REP for state | boolean |
| `is_chapter_admin(chapter)` | Check if PRESIDENT of chapter (FIXED 2026-07-20) | boolean |
| `is_chapter_officer(chapter)` | Check if any OFFICER in chapter | boolean |
| `is_chapter_treasurer(chapter)` | Check if TREASURER of chapter (FIXED 2026-07-20) | boolean |
| `is_chapter_chaplain(chapter)` | Check if CHAPLAIN of chapter (FIXED 2026-07-20) | boolean |
| `is_national_evangelist(region)` | Check if EVANGELIST for region | boolean |
| `is_own_account(id)` | Check if user owns account | boolean |

**Security Fixes Applied (2026-07-20):**
1. `current_account_id()` now validates account exists and is active
2. `is_chapter_admin()` now explicitly checks for 'president' role
3. `is_chapter_treasurer()` now explicitly checks for 'treasurer' role
4. `is_chapter_chaplain()` now explicitly checks for 'chaplain' role

---

## Mandatory Testing

Every RLS change MUST pass these tests:

### Test 1: Helper Function Correctness
```sql
-- For each role, verify current_account_role() returns correct value
-- For each privilege level, verify is_* functions return correct boolean
-- Verify all 15+ helper functions are callable
```

### Test 2: Policy Coverage
```sql
-- Verify all 15+ protected tables have RLS enabled
-- Verify all 15+ tables have both SELECT and WRITE policies
-- Verify no table has permissive policies (all should be restrictive)
```

### Test 3: Session Isolation
```sql
-- User A cannot read User B's sessions
-- User A cannot read User B's account
-- User A can read own account and sessions
```

### Test 4: Cross-Account Access
```sql
-- Member cannot read CEO data
-- CEO cannot read ROOT data
-- Board can read CEO data (same tier)
```

### Test 5: Hierarchical Access
```sql
-- Chapter A admin cannot see Chapter B data
-- State A coordinator cannot see State B data
-- Member cannot see any organizational data
```

### Test 6: Sensitive Data Protection
```sql
-- Members cannot read role_permission table (CRITICAL)
-- Members cannot read other accounts (CRITICAL)
-- Members cannot read session tokens (CRITICAL)
```

### Test 7: Privilege Escalation Prevention
```sql
-- User cannot UPDATE their own role
-- User cannot DELETE other accounts
-- Member cannot create accounts
```

---

## Deployment Checklist

Before deploying RLS changes to production:

- [ ] All 3 critical security fixes applied
- [ ] All 7 mandatory tests passing
- [ ] Write policies explicitly defined for all tables
- [ ] Helper functions validated for all role types
- [ ] No data leakage confirmed (member access tests)
- [ ] Cross-account isolation confirmed
- [ ] Session isolation confirmed
- [ ] Privilege escalation prevention confirmed
- [ ] Code reviewed by security engineer
- [ ] Peer review completed
- [ ] Release notes document security changes

---

## Common Mistakes to Avoid

### ❌ Missing Parentheses in OR Conditions
```sql
-- WRONG - causes logical evaluation error
USING (
  condition_1
  AND condition_2
  OR condition_3  -- This becomes: (cond1 AND cond2) OR cond3
);

-- RIGHT
USING (
  (condition_1 AND condition_2)
  OR condition_3
);
```

### ❌ Forgetting to Validate Account
```sql
-- WRONG - no validation
CREATE FUNCTION current_user_id() RETURNS text AS $$
  SELECT current_setting('user_id', true)::text;
$$ LANGUAGE SQL;

-- RIGHT - validates account exists
CREATE FUNCTION current_user_id() RETURNS text AS $$
  DECLARE v_id text;
  BEGIN
    v_id := current_setting('user_id', true)::text;
    IF v_id IS NOT NULL THEN
      IF NOT EXISTS(SELECT 1 FROM app."Account" WHERE id = v_id) THEN
        RAISE EXCEPTION 'Invalid account';
      END IF;
    END IF;
    RETURN v_id;
  END;
$$ LANGUAGE PLPGSQL;
```

### ❌ Checking Existence Without Checking Role
```sql
-- WRONG - returns true for ANY officer
CREATE FUNCTION is_treasurer(chapter_id) RETURNS boolean AS $$
  SELECT EXISTS(
    SELECT 1 FROM app."OfficerAssignment" oa
    WHERE oa.chapter_id = $1
      AND oa.person_id = (SELECT person_id FROM app."Account" WHERE id = current_account_id())
  );
$$ LANGUAGE SQL;

-- RIGHT - explicitly checks role
CREATE FUNCTION is_treasurer(chapter_id) RETURNS boolean AS $$
  SELECT EXISTS(
    SELECT 1 FROM app."OfficerAssignment" oa
    WHERE oa.chapter_id = $1
      AND oa.role = 'treasurer'  -- ← EXPLICIT ROLE CHECK
      AND oa.person_id = (SELECT person_id FROM app."Account" WHERE id = current_account_id())
  );
$$ LANGUAGE SQL;
```

### ❌ Permissive vs Restrictive Policies
```sql
-- WRONG - permissive (allows by default)
CREATE POLICY allow_read ON table
  FOR SELECT USING (true);  -- Anyone can read!

-- RIGHT - restrictive (denies by default)
CREATE POLICY restrict_read ON table
  FOR SELECT USING (app.is_authorized_user());
```

---

## Monitoring & Incidents

### Red Flags
- Multiple SELECT queries returning unexpected number of rows
- Users reporting data they shouldn't see
- Unauthorized updates to accounts/roles
- Session hijacking attempts
- SQL injection attempts with SET commands

### Response Steps
1. Check logs for unauthorized context changes
2. Review RLS policies for logic errors
3. Check helper function logic for bypasses
4. Validate all vulnerable queries with test data
5. If breach confirmed, force password reset for affected accounts

---

## References

- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Supabase RLS Best Practices](https://supabase.com/docs/guides/auth/row-level-security)
- [CMA Database Schema](web/prisma/schema.prisma)
- [RLS Implementation File](web/supabase/migrations/20260720_rls_security.sql)
- [RLS Write Policies](web/supabase/migrations/20260720_rls_write_policies.sql)

---

## Version History

| Date | Author | Changes |
|------|--------|---------|
| 2026-07-20 | Security Review | Initial RLS implementation + Critical security fixes (3 blockers) |
| 2026-07-20 | Security Review | Added explicit write policies migration |
| 2026-07-20 | Security Review | Documented security model and testing requirements |

---

**Document Status:** ✅ APPROVED FOR PRODUCTION (Post-fix)  
**Last Reviewed:** 2026-07-20  
**Next Review:** 2026-08-20 (or after any policy changes)
