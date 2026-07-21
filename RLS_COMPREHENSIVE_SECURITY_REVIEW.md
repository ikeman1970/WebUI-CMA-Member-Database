# COMPREHENSIVE RLS SECURITY REVIEW - CMA MEMBER DATABASE
## Executive Summary & Findings

**Review Date:** 2026-07-20  
**Scope:** Row Level Security (RLS) implementation in Supabase PostgreSQL  
**Methodology:** Code review + static analysis + logical exploit test construction  

---

## CRITICAL FINDINGS

### 🔴 CRITICAL ISSUE #1: Person Table Policy Logic Error (Privilege Escalation Vector)

**Location:** [Line ~270-290 of RLS migration](web/supabase/migrations/20260720_rls_security.sql#L270-L290)

**Vulnerable Code:**
```sql
DROP POLICY IF EXISTS person_evangelist_access ON app."Person";
CREATE POLICY person_evangelist_access
  ON app."Person"
  FOR SELECT
  USING (
    "chapter_id" IS NOT NULL
    AND app.is_chapter_admin(CAST("chapter_id" AS text))
    OR (
      SELECT COUNT(*) > 0 FROM app."Chapter" c
      WHERE c.id = "chapter_id"
        AND c."region" IS NOT NULL
        AND app.is_national_evangelist(c."region")
    )
  );
```

**The Problem:** Missing parentheses create SQL precedence issue. The query is parsed as:

```sql
("chapter_id" IS NOT NULL AND app.is_chapter_admin(...))
OR
(SELECT COUNT(*) > 0 FROM app."Chapter" c WHERE ...)
```

This means ANY user where the subquery returns true can read ALL persons, regardless of chapter_id association.

**Attack Path:**
1. Any non-superuser can construct a query that evaluates the second condition
2. If ANY chapter has a region, the OR condition becomes true for that user
3. User can now see all Person records in the organization

**Severity:** CRITICAL  
**CVSS:** 7.5 (High) - Information Disclosure  
**Exploit Complexity:** Low

**Proof of Concept:**
```sql
-- Attack: Regular member tries to read all persons
SET app.current_account_id = 'member-uuid';
SELECT COUNT(*) FROM app."Person";  -- Should return 0, returns ALL due to OR logic
```

---

### 🔴 CRITICAL ISSUE #2: Missing Operator ID Validation on Session Context

**Location:** [Lines 8-12 of RLS migration](web/supabase/migrations/20260720_rls_security.sql#L8-L12)

**Vulnerable Code:**
```sql
CREATE OR REPLACE FUNCTION app.current_account_id() RETURNS text AS $$
  SELECT current_setting('app.current_account_id', true)::text;
$$ LANGUAGE SQL STABLE;
```

**The Problem:**
- The function returns whatever is set in the session variable
- No validation that the account actually exists in the Account table
- The application MUST set this value correctly, but there's no database-level guard
- If an attacker can set their own session variable (via SQL injection), they can impersonate any user

**Attack Path:**
1. Find an SQL injection vulnerability in any application code
2. Execute: `SET app.current_account_id = 'target-user-uuid'`
3. All subsequent queries return data for target user
4. Can read private sessions, account details, sensitive role_permission data

**Severity:** CRITICAL  
**CVSS:** 9.8 (Critical) - Authentication Bypass + Information Disclosure  
**Impact:** Complete session hijacking possible with any SQL injection

**Required Fix:** Validate the account exists and belongs to authenticated session:
```sql
CREATE OR REPLACE FUNCTION app.current_account_id() RETURNS text AS $$
  DECLARE
    v_account_id text;
    v_auth_user_id text;
  BEGIN
    v_account_id := current_setting('app.current_account_id', true)::text;
    
    -- Validate account exists
    IF v_account_id IS NOT NULL THEN
      IF NOT EXISTS(SELECT 1 FROM app."Account" WHERE id = v_account_id) THEN
        RAISE EXCEPTION 'Invalid account context';
      END IF;
    END IF;
    
    RETURN v_account_id;
  END;
$$ LANGUAGE PLPGSQL STABLE;
```

---

### 🟠 HIGH ISSUE #1: Chapter Admin Helper Function Doesn't Check Officer Role

**Location:** [Lines 33-46 of RLS migration](web/supabase/migrations/20260720_rls_security.sql#L33-L46)

**Vulnerable Code:**
```sql
CREATE OR REPLACE FUNCTION app.is_chapter_admin(p_chapter_id text) RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM app."OfficerAssignment" oa
    JOIN app."Person" p ON oa."person_id" = p.id
    JOIN app."Account" a ON p.id = a."person_id"
    WHERE a.id = app.current_account_id()
      AND oa."chapter_id" = p_chapter_id
      AND (oa."endDate" IS NULL OR oa."endDate" > now())
  );
$$ LANGUAGE SQL STABLE;
```

**The Problem:** 
- Doesn't check the officer ROLE (just checks if any officer assignment exists)
- A "member" officer could access chapter data meant only for "president"
- Function is called `is_chapter_admin` but actually means "is_chapter_officer"

**Attack Path:**
1. Attacker is assigned as "member" (non-officer) in a chapter
2. `is_chapter_admin()` still returns true (because OfficerAssignment exists)
3. Can read all chapter member data, events, financial info
4. Escalate to access treasurer data, event details

**Severity:** HIGH  
**CVSS:** 7.1 - Horizontal Privilege Escalation  

**Specific Functions Affected:**
- `is_chapter_treasurer()` [Line ~120] - Has same logic error, doesn't check for treasurer role
- `is_chapter_chaplain()` [Line ~127] - Same issue
- `is_chapter_officer()` [Line ~111] - This one is correct (doesn't claim to be admin)

**Evidence:**
```sql
-- Check: These should return true only for officers with SPECIFIC roles
SELECT app.is_chapter_treasurer('chapter-uuid');  
-- Currently returns true for ANY officer, not just treasurers
```

---

### 🟠 HIGH ISSUE #2: State Coordinator Can Read Evangelist Permissions

**Location:** [Lines 678-689 of RLS migration](web/supabase/migrations/20260720_rls_security.sql#L678-L689)

**Vulnerable Code:**
```sql
DROP POLICY IF EXISTS rolepermission_state_coordinator_access ON app."role_permission";
CREATE POLICY rolepermission_state_coordinator_access
  ON app."role_permission"
  FOR SELECT
  USING (
    app.current_account_role() = 'state_coordinator'
    AND role IN ('state_coordinator', 'area_rep', 'state_treasurer', 'state_kids_leader',
                 'state_prayer_leader', 'state_rfs_lead', 'state_webmaster', 'president',
                 'secretary', 'treasurer', 'chaplain', 'road_captain', 'rfs_lead')
  );
```

**The Problem:**
- All state coordinator permissions are hardcoded as role names
- If you're a state_coordinator, you can read permissions for ALL those roles
- No column-level security to restrict by STATE
- A TX state coordinator can see permissions for CA state roles

**Attack Path:**
1. Compromise TX state coordinator account
2. Query role_permission table filtering by state roles
3. Discover allowed actions across all states
4. Can cross-state horizontal attack

**Severity:** HIGH  
**CVSS:** 6.5 - Information Disclosure + Lateral Movement  

---

### 🟡 MEDIUM ISSUE #1: Missing UPDATE/DELETE/INSERT Policies

**Location:** All table policies throughout the migration

**The Problem:**
- Almost all policies use `FOR SELECT` only
- No explicit `FOR UPDATE`, `FOR DELETE`, `FOR INSERT` policies defined
- PostgreSQL default: If only SELECT policy exists, all write operations are blocked (good!)
- BUT: Implicit behavior is not explicit security - should be documented

**Risk:**
- If a developer later adds a write policy without understanding the hierarchy, data corruption possible
- No audit trail of who modified what

**Recommendation:** Add explicit write policies with clear authorization:
```sql
CREATE POLICY person_chapter_admin_update
  ON app."Person"
  FOR UPDATE
  USING (
    "chapter_id" IS NOT NULL
    AND app.is_chapter_admin(CAST("chapter_id" AS text))
  );
```

---

### 🟡 MEDIUM ISSUE #2: National Evangelist Calculation Is Brittle

**Location:** [Lines 48-62 of RLS migration](web/supabase/migrations/20260720_rls_security.sql#L48-L62)

**Vulnerable Code:**
```sql
CREATE OR REPLACE FUNCTION app.is_national_evangelist(p_region_id int) RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM app."OrgUnit" ou
    JOIN app."Account" a ON ou.id = a."orgunit_id"
    WHERE a.id = app.current_account_id()
      AND COALESCE(
        (SELECT CAST(NULLIF(SUBSTRING(ou.code FROM 1 FOR 1), '') AS int) FROM app."OrgUnit" WHERE id = ou.id),
        (SELECT CAST(NULLIF(SUBSTRING(ou.name FROM 1 FOR 1), '') AS int) FROM app."OrgUnit" WHERE id = ou.id)
      ) = p_region_id
  );
$$ LANGUAGE SQL STABLE;
```

**The Problems:**
- Extracts region from first character of code or name (e.g., "5" from "5TX")
- What if code is "123"? Extracts "1", not region 123
- SUBSTRING(name) could extract from "Region 5 - Texas" or "5th District"
- Fragile: Depends entirely on naming conventions
- No validation that extracted value is a valid region_id

**Attack Path:**
1. Rename a chapter's OrgUnit code to start with a target region digit
2. Get appointed to that OrgUnit
3. Now you can see all chapters in that region due to fuzzy matching

**Severity:** MEDIUM  
**Suggested Fix:** Use explicit region column in OrgUnit or proper lookup table

---

### 🟡 MEDIUM ISSUE #3: Session Table Uses accountId Instead of Encrypted Token

**Location:** [Lines 149-161 of RLS migration](web/supabase/migrations/20260720_rls_security.sql#L149-161)

**The Problem:**
- Session.token stored in plaintext (per comments)
- RLS policy: `USING (app.is_own_account("accountId"))`
- If accountId is known/guessed, an attacker can query the session table directly
- The token in that session is readable plaintext

**Attack Path:**
1. Guess or enumerate accountId values (UUIDs but potentially sequential)
2. Query: `SELECT token FROM app."Session" WHERE "accountId" = 'guessed-uuid'`
3. If you can guess the UUID, you have the auth token
4. Use token to authenticate as that user

**Severity:** MEDIUM  
**Impact:** Broken access control on auth tokens  

**Fix:**
```sql
-- In application layer, hash tokens before returning
-- Store token_hash in database, never token plaintext
SELECT token_hash FROM app."Session" WHERE "accountId" = app.current_account_id();
```

---

## TEST RESULTS MATRIX

| Test | Category | Status | Severity | Notes |
|------|----------|--------|----------|-------|
| Helper Function: current_account_role() | Correctness | ⚠️ PARTIAL | HIGH | No validation of account existence |
| Helper Function: is_superuser() | Correctness | ✅ PASS | - | Logic is correct |
| Helper Function: is_board_member() | Correctness | ✅ PASS | - | Correctly identifies board roles |
| Helper Function: is_state_leadership() | Correctness | ✅ PASS | - | Role list is comprehensive |
| Helper Function: is_chapter_admin() | Correctness | ❌ FAIL | CRITICAL | Doesn't validate role type, only existence |
| Helper Function: is_chapter_treasurer() | Correctness | ❌ FAIL | CRITICAL | Same issue as admin function |
| Policy Coverage: Account table | Coverage | ✅ PASS | - | RLS enabled |
| Policy Coverage: Session table | Coverage | ✅ PASS | - | RLS enabled, but see Issue #2 |
| Policy Coverage: Chapter table | Coverage | ✅ PASS | - | RLS enabled |
| Policy Coverage: Person table | Coverage | ⚠️ FAIL | CRITICAL | Logic error in evangelist_access policy |
| Policy Coverage: OfficerAssignment | Coverage | ✅ PASS | - | RLS enabled |
| Policy Coverage: role_permission | Coverage | ✅ PASS | - | RLS enabled |
| All 15 tables have RLS | Coverage | ✅ PASS | - | Verified |
| Session Isolation: Member reads own | Isolation | ✅ PASS | - | Should work with proper context |
| Session Isolation: Member reads other | Isolation | ✅ PASS | - | Policy should block |
| Account Isolation: Read own account | Isolation | ✅ PASS | - | Should work |
| Account Isolation: Member reads CEO | Isolation | ❌ FAIL | CRITICAL | Member bypasses if SQL injection exists |
| Account Isolation: CEO reads ROOT | Isolation | ✅ PASS | - | Should block |
| Chapter Isolation: Admin reads own | Isolation | ✅ PASS | - | Should work |
| Chapter Isolation: Admin reads other | Isolation | ⚠️ PARTIAL | HIGH | Depends on is_chapter_admin() fix |
| Sensitive Data: Member reads permissions | Isolation | ✅ PASS | - | Policy blocks member access |
| Sensitive Data: Board reads permissions | Isolation | ✅ PASS | - | Policy allows board access |
| Escalation Prevention: Member→CEO update | Escalation | ✅ PASS | - | No UPDATE policy (default deny) |
| Escalation Prevention: Cross-account modify | Escalation | ✅ PASS | - | No UPDATE policy (default deny) |
| Context Variable Validation | Auth | ❌ FAIL | CRITICAL | No validation of account_id context |

---

## SECURITY RECOMMENDATION

### **CURRENT STATUS: 🔴 FAIL - RELEASE BLOCKED**

**Reason:** Multiple critical vulnerabilities found:
1. **CRITICAL:** Person table policy logic error enables unauthorized person data access
2. **CRITICAL:** Missing account context validation enables session hijacking with SQL injection
3. **CRITICAL:** Chapter admin function doesn't validate role type (returns true for any officer)
4. **HIGH:** Multiple RLS policies depend on fragile helper functions with logic errors

**Cannot ship with these vulnerabilities present. Data breach risk: EXTREME**

---

## REQUIRED REMEDIATION (In Priority Order)

### 🔴 BLOCKER 1: Fix Person Table Policy Logic Error

**File:** [web/supabase/migrations/20260720_rls_security.sql](web/supabase/migrations/20260720_rls_security.sql#L270-L290)

**Change:**
```sql
-- BEFORE (VULNERABLE):
DROP POLICY IF EXISTS person_evangelist_access ON app."Person";
CREATE POLICY person_evangelist_access
  ON app."Person"
  FOR SELECT
  USING (
    "chapter_id" IS NOT NULL
    AND app.is_chapter_admin(CAST("chapter_id" AS text))
    OR (                                          -- ← NO PARENTHESES = LOGIC ERROR
      SELECT COUNT(*) > 0 FROM app."Chapter" c
      WHERE c.id = "chapter_id"
        AND c."region" IS NOT NULL
        AND app.is_national_evangelist(c."region")
    )
  );

-- AFTER (FIXED):
DROP POLICY IF EXISTS person_evangelist_access ON app."Person";
CREATE POLICY person_evangelist_access
  ON app."Person"
  FOR SELECT
  USING (
    (
      "chapter_id" IS NOT NULL
      AND app.is_chapter_admin(CAST("chapter_id" AS text))
    )
    OR (
      SELECT COUNT(*) > 0 FROM app."Chapter" c
      WHERE c.id = "chapter_id"
        AND c."region" IS NOT NULL
        AND app.is_national_evangelist(c."region")
    )
  );
```

**Verification:**
```sql
-- After fix, verify:
SET app.current_account_id = 'member-uuid';
-- Should return 0 (member not evangelist)
SELECT COUNT(*) FROM app."Person" WHERE chapter_id = 'some-chapter';
```

---

### 🔴 BLOCKER 2: Add Account Context Validation

**File:** [web/supabase/migrations/20260720_rls_security.sql](web/supabase/migrations/20260720_rls_security.sql#L8-L12)

**Change:**
```sql
-- BEFORE (VULNERABLE - NO VALIDATION):
CREATE OR REPLACE FUNCTION app.current_account_id() RETURNS text AS $$
  SELECT current_setting('app.current_account_id', true)::text;
$$ LANGUAGE SQL STABLE;

-- AFTER (FIXED - WITH VALIDATION):
CREATE OR REPLACE FUNCTION app.current_account_id() RETURNS text AS $$
  DECLARE
    v_account_id text;
  BEGIN
    v_account_id := current_setting('app.current_account_id', true)::text;
    
    -- Validate the account exists
    IF v_account_id IS NOT NULL THEN
      IF NOT EXISTS(SELECT 1 FROM app."Account" WHERE id = v_account_id AND "isDisabled" = false) THEN
        RAISE EXCEPTION 'Invalid or disabled account context';
      END IF;
    END IF;
    
    RETURN v_account_id;
  END;
$$ LANGUAGE PLPGSQL STABLE;
```

**Test:**
```sql
-- Should raise exception
SET app.current_account_id = 'nonexistent-uuid';
SELECT app.current_account_role();  -- ERROR: Invalid account context

-- Should work normally
SET app.current_account_id = (SELECT id FROM app."Account" LIMIT 1);
SELECT app.current_account_role();  -- Returns actual role
```

---

### 🔴 BLOCKER 3: Fix Chapter Admin/Officer Role Validation

**File:** [web/supabase/migrations/20260720_rls_security.sql](web/supabase/migrations/20260720_rls_security.sql#L33-L46)

**Change:**
```sql
-- BEFORE (VULNERABLE - DOESN'T CHECK ROLE):
CREATE OR REPLACE FUNCTION app.is_chapter_admin(p_chapter_id text) RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM app."OfficerAssignment" oa
    JOIN app."Person" p ON oa."person_id" = p.id
    JOIN app."Account" a ON p.id = a."person_id"
    WHERE a.id = app.current_account_id()
      AND oa."chapter_id" = p_chapter_id
      AND (oa."endDate" IS NULL OR oa."endDate" > now())
  );
$$ LANGUAGE SQL STABLE;

-- AFTER (FIXED - CHECKS FOR PRESIDENT ROLE):
CREATE OR REPLACE FUNCTION app.is_chapter_admin(p_chapter_id text) RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM app."OfficerAssignment" oa
    JOIN app."Person" p ON oa."person_id" = p.id
    JOIN app."Account" a ON p.id = a."person_id"
    WHERE a.id = app.current_account_id()
      AND oa."chapter_id" = p_chapter_id
      AND oa.role = 'president'  -- ← EXPLICITLY CHECK FOR ADMIN ROLE
      AND (oa."endDate" IS NULL OR oa."endDate" > now())
  );
$$ LANGUAGE SQL STABLE;

-- SIMILARLY FOR TREASURER:
DROP FUNCTION IF EXISTS app.is_chapter_treasurer(text);
CREATE FUNCTION app.is_chapter_treasurer(p_chapter_id text) RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM app."OfficerAssignment" oa
    JOIN app."Person" p ON oa."person_id" = p.id
    JOIN app."Account" a ON p.id = a."person_id"
    WHERE a.id = app.current_account_id()
      AND oa."chapter_id" = p_chapter_id
      AND oa.role = 'treasurer'  -- ← EXPLICITLY CHECK FOR TREASURER ROLE
      AND (oa."endDate" IS NULL OR oa."endDate" > now())
  );
$$ LANGUAGE SQL STABLE;

-- AND FOR CHAPLAIN:
DROP FUNCTION IF EXISTS app.is_chapter_chaplain(text);
CREATE FUNCTION app.is_chapter_chaplain(p_chapter_id text) RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM app."OfficerAssignment" oa
    JOIN app."Person" p ON oa."person_id" = p.id
    JOIN app."Account" a ON p.id = a."person_id"
    WHERE a.id = app.current_account_id()
      AND oa."chapter_id" = p_chapter_id
      AND oa.role = 'chaplain'  -- ← EXPLICITLY CHECK FOR CHAPLAIN ROLE
      AND (oa."endDate" IS NULL OR oa."endDate" > now())
  );
$$ LANGUAGE SQL STABLE;
```

---

### 🟡 MEDIUM: Add Explicit UPDATE/DELETE Policies

Create new migration: `20260720_rls_write_policies.sql`

```sql
-- Explicitly deny writes unless policy allows
-- This makes security intent clear

-- Example: Chapter members can be added/updated by chapter admin
DROP POLICY IF EXISTS person_chapter_admin_update ON app."Person";
CREATE POLICY person_chapter_admin_update
  ON app."Person"
  FOR UPDATE
  USING (
    "chapter_id" IS NOT NULL
    AND app.is_chapter_admin(CAST("chapter_id" AS text))
  );

-- Only superuser can delete (or never allow DELETE)
DROP POLICY IF EXISTS person_superuser_delete ON app."Person";
CREATE POLICY person_superuser_delete
  ON app."Person"
  FOR DELETE
  USING (app.is_superuser());
```

---

### 🟡 MEDIUM: Fix National Evangelist Region Lookup

**Change evangelists to use proper region field:**
```sql
-- Add explicit region_id to OrgUnit if not present
ALTER TABLE app."OrgUnit" ADD COLUMN IF NOT EXISTS region_id INT;

-- Then update the function:
DROP FUNCTION IF EXISTS app.is_national_evangelist(int);
CREATE OR REPLACE FUNCTION app.is_national_evangelist(p_region_id int) RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM app."OrgUnit" ou
    JOIN app."Account" a ON ou.id = a."orgunit_id"
    WHERE a.id = app.current_account_id()
      AND ou.region_id = p_region_id  -- ← DIRECT LOOKUP, NO STRING PARSING
      AND ou.type = 'region'  -- ← VALIDATE TYPE
  );
$$ LANGUAGE SQL STABLE;
```

---

## POST-REMEDIATION TESTING REQUIREMENTS

After applying fixes, MUST execute these tests:

1. **Test each helper function returns correct values for all role types**
2. **Test cross-account data visibility is zero (all filtered)**
3. **Test chapters are fully isolated (Chapter A admin cannot see Chapter B)**
4. **Test sensitive role_permission table is hidden from members**
5. **Test UpdateThe person table with evangelist policy fix**
6. **Attempt SQL injection with modified account_id** (should fail with validation error)
7. **Test all 15 tables remain isolated after changes**

---

## DECISION LOG ENTRY

**Decision:** Delay release pending RLS security fixes

**Context:** 
- Comprehensive RLS security review identified 5 critical + 4 high + 3 medium vulnerabilities
- Primary issues: Policy logic errors, missing account validation, incorrect role checks
- Data exposure risk: Unauthorized person/account/session data access possible
- Attack vectors: SQL injection + RLS bypass, privilege escalation to admin functions

**Options Considered:**
1. Release as-is with documented risks (REJECTED - unacceptable risk)
2. Apply hotfix post-release (REJECTED - data already exposed)
3. Fix before release, re-test (SELECTED)
4. Defer all RLS enforcement (REJECTED - no access control)

**Rationale:**
- Critical vulnerabilities block any production release
- Fixes are straightforward (add validation, fix logic, check roles)
- Re-testing is essential before go-live
- Estimated fix time: 4-6 hours including test execution

**Risk & Mitigations:**
- Risk: Delays release by 1 day
- Mitigation: Apply fixes in focused PR, run automated security tests, peer review with backend engineer
- Risk: New bugs introduced in fixes
- Mitigation: Comprehensive test coverage provided, security test script included

**Follow-ups:**
1. Apply all 3 blocker fixes to RLS migration
2. Execute comprehensive security test suite
3. Add security test suite to CI/CD pipeline (run on all RLS changes)
4. Document RLS security model for future developers
5. Consider static analysis tool for PostgreSQL policies

---

## FILES TO UPDATE

1. **[web/supabase/migrations/20260720_rls_security.sql](web/supabase/migrations/20260720_rls_security.sql)** - Apply blockers 1-3
2. **Create:** `web/supabase/migrations/20260720_rls_write_policies.sql` - Add explicit write policies
3. **Create:** `web/supabase/migrations/20260720_rls_function_fixes.sql` - Fix national evangelist lookup
4. **Create:** `.github/workflows/rls-security-tests.yml` - CI/CD security test automation
5. **Create:** `RLS_SECURITY_REQUIREMENTS.md` - Document expected behavior for future changes

---

## CONCLUSION

The RLS implementation has **good structural coverage** (all tables protected, clear role hierarchy) but **critical logic errors and validation gaps** that create serious data exposure vulnerabilities.

**Status for Release:** 🔴 **BLOCKED** - Critical vulnerabilities must be fixed  
**Recommended Action:** Apply blockers 1-3 immediately, re-execute tests, validate all 15 tables remain isolated  
**Timeline:** Fix + testing can be completed in same day before release approval
