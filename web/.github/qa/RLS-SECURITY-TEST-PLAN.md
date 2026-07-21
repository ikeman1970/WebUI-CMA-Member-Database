# RLS Security & Access Control Test Plan
**Project:** CMA Member Directory Web UI  
**Date:** 2026-07-20  
**Scope:** PostgreSQL Row Level Security (RLS) enforcement across all PostgREST-exposed tables  
**Prepared by:** QA + Security Engineering  

---

## 1. EXECUTIVE SUMMARY

This test plan validates the complete Row Level Security implementation covering:
- ✅ **15 tables** with RLS enabled
- ✅ **50+ RLS policies** with hierarchical access control  
- ✅ **20 organizational roles** with graduated permissions
- ✅ **14 helper functions** enforcing role hierarchy (Root → Board → State → Chapter)
- ✅ **Session variable context** (`app.current_account_id`) set per-request

**Test Objective:** Confirm RLS denies unauthorized access, permits authorized access, and enforces role hierarchy across all data paths.

**Acceptance Criteria:**
- All authorized paths return correct data without RLS bypass
- All unauthorized paths return `403 Forbidden` or empty result sets
- All helper functions return correct boolean values per role
- Session context isolation prevents cross-account access
- Role hierarchy enforced at database layer (not API layer)

---

## 2. TEST SCOPE & CONSTRAINTS

### 2.1 Tables Under Test
| Table | RLS Status | Policies | Priority |
|-------|-----------|----------|----------|
| `Account` | ✅ Enabled | 3 | CRITICAL |
| `Session` | ✅ Enabled | 2 | CRITICAL |
| `Chapter` | ✅ Enabled | 6 | CRITICAL |
| `Person` | ✅ Enabled | 6 | CRITICAL |
| `OrgUnit` | ✅ Enabled | 2 | HIGH |
| `OfficerAssignment` | ✅ Enabled | 3 | HIGH |
| `Motorcycle` | ✅ Enabled | 3 | HIGH |
| `RoleNote` | ✅ Enabled | 2 | HIGH |
| `EmergencyContact` | ✅ Enabled | 4 | HIGH |
| `chapter_events` | ✅ Enabled | 3 | MEDIUM |
| `chapter_event_attendees` | ✅ Enabled | 3 | MEDIUM |
| `chapter_event_follow_ups` | ✅ Enabled | 3 | MEDIUM |
| `chapter_reporting_snapshots` | ✅ Enabled | 3 | MEDIUM |
| `chapter_status_transitions` | ✅ Enabled | 3 | MEDIUM |
| `role_permission` | ✅ Enabled | 6 | CRITICAL |
| `account_invite_tokens` | ✅ Enabled | 2 | HIGH |
| `AppSetting` | ✅ Enabled | 1 | LOW |

### 2.2 Test Environment
- **Database:** Supabase PostgreSQL (production-like)
- **Auth Layer:** Supabase Auth (JWT-based)
- **Access Method:** Supabase PostgREST REST API + Direct SQL
- **Test Client:** curl, Postman, or Node.js test suite
- **Network:** Local + staging (no production until sign-off)

### 2.3 Out of Scope
- Application-layer authorization (tested separately)
- Prisma ORM query filtering
- API endpoint business logic
- Frontend UI access control
- Audit logging (separate test)

---

## 3. HELPER FUNCTION TEST CASES

All helper functions must return correct boolean values per role hierarchy.

### 3.1 Role Hierarchy Functions

#### Test: `current_account_id()` Returns Session Context

| Test ID | Query | Expected | Role | Status |
|---------|-------|----------|------|--------|
| HF-001 | `SELECT app.current_account_id();` after `SET app.current_account_id = 'acct-123'` | `acct-123` | Any | ⏳ |
| HF-002 | `SELECT app.current_account_id();` without SET | `NULL` or empty | Any | ⏳ |

#### Test: `current_account_role()` Returns Correct Role

| Test ID | Account Role | Expected Return | Status |
|---------|--------------|-----------------|--------|
| HF-003 | `root` | `'root'` | ⏳ |
| HF-004 | `ceo` | `'ceo'` | ⏳ |
| HF-005 | `board` | `'board'` | ⏳ |
| HF-006 | `president` | `'president'` | ⏳ |
| HF-007 | `member` | `'member'` | ⏳ |
| HF-008 | Invalid/unknown role | `'guest'` | ⏳ |

#### Test: `is_superuser()` True Only for Root/Superuser

| Test ID | Role | Expected | Status |
|---------|------|----------|--------|
| HF-009 | `root` | `true` | ⏳ |
| HF-010 | `superuser` | `true` | ⏳ |
| HF-011 | `ceo` | `false` | ⏳ |
| HF-012 | `board` | `false` | ⏳ |
| HF-013 | `president` | `false` | ⏳ |
| HF-014 | `member` | `false` | ⏳ |

#### Test: `is_board_member()` True for CEO/Board/Board Advisor

| Test ID | Role | Expected | Status |
|---------|------|----------|--------|
| HF-015 | `ceo` | `true` | ⏳ |
| HF-016 | `board` | `true` | ⏳ |
| HF-017 | `board_advisor` | `true` | ⏳ |
| HF-018 | `state_coordinator` | `false` | ⏳ |
| HF-019 | `president` | `false` | ⏳ |
| HF-020 | `member` | `false` | ⏳ |

#### Test: `is_state_leadership()` True for State-Level Roles

| Test ID | Role | Expected | Status |
|---------|------|----------|--------|
| HF-021 | `state_coordinator` | `true` | ⏳ |
| HF-022 | `area_rep` | `true` | ⏳ |
| HF-023 | `state_treasurer` | `true` | ⏳ |
| HF-024 | `state_kids_leader` | `true` | ⏳ |
| HF-025 | `state_prayer_leader` | `true` | ⏳ |
| HF-026 | `state_rfs_lead` | `true` | ⏳ |
| HF-027 | `state_webmaster` | `true` | ⏳ |
| HF-028 | `president` | `false` | ⏳ |
| HF-029 | `member` | `false` | ⏳ |

---

## 4. CRITICAL PATH: SESSION CONTEXT ISOLATION

**Objective:** Verify session context prevents cross-account data leakage.

### Test Case: ROOT-001 - Context Variable Isolation

**Test:** Set account context for Account A, verify Account B data blocked

```sql
-- Setup: Create two test accounts
INSERT INTO app."Account" (id, email, role, "person_id") 
VALUES 
  ('account-a', 'a@test.cma', 'member', 'person-a'),
  ('account-b', 'b@test.cma', 'member', 'person-b');

-- Test: Set context to Account A
SET app.current_account_id = 'account-a';

-- Query: Try to read Account B's own account data
SELECT * FROM app."Account" WHERE id = 'account-b';

-- Expected: No rows returned (403 Forbidden)
-- Actual: ⏳
```

**Pass Criteria:**  
✅ Account A cannot read Account B's record  
✅ Account A can read its own record  

---

### Test Case: ROOT-002 - Session Isolation Across Requests

**Test:** Verify context doesn't leak between API requests

```
Request 1: Set app.current_account_id = 'account-a'
           SELECT * FROM app."Account"
           Expected: Account A's record only

Request 2: Set app.current_account_id = 'account-b'
           SELECT * FROM app."Account"
           Expected: Account B's record only

Request 3: (No context set)
           SELECT * FROM app."Account"
           Expected: No rows (403)
```

**Pass Criteria:**  
✅ Each request sees only its own context  
✅ No cross-request leakage  

---

## 5. ROLE HIERARCHY TEST CASES

**Objective:** Verify hierarchical access control: Root → Board → State → Chapter

### 5.1 Superuser (Root) Access - Should See All Data

| Test ID | Table | Query | Expected | Status |
|---------|-------|-------|----------|--------|
| HIER-001 | `Account` | SELECT all | All rows | ⏳ |
| HIER-002 | `Chapter` | SELECT all | All rows | ⏳ |
| HIER-003 | `Person` | SELECT all | All rows | ⏳ |
| HIER-004 | `OfficerAssignment` | SELECT all | All rows | ⏳ |
| HIER-005 | `role_permission` | SELECT all | All rows | ⏳ |

**Test Script:**
```sql
SET app.current_account_id = 'root-account-id';
SELECT COUNT(*) FROM app."Account";          -- Expected: ALL
SELECT COUNT(*) FROM app."Chapter";          -- Expected: ALL
SELECT COUNT(*) FROM app."Person";           -- Expected: ALL
SELECT COUNT(*) FROM app."role_permission";  -- Expected: ALL
```

### 5.2 CEO Access - Should See Chapter/Person/Officer Data (Not Sessions)

| Test ID | Table | Query | Expected | Notes |
|---------|-------|-------|----------|-------|
| HIER-010 | `Chapter` | SELECT all | All rows | CEO can manage all chapters |
| HIER-011 | `Person` | SELECT all | All rows | CEO can manage all members |
| HIER-012 | `OfficerAssignment` | SELECT all | All rows | CEO can manage all officers |
| HIER-013 | `Session` | SELECT all | 0 rows (403) | CEO cannot read sessions |
| HIER-014 | `role_permission` | SELECT all | All rows | CEO can manage permissions |

**Test Script:**
```sql
SET app.current_account_id = 'ceo-account-id';
SELECT COUNT(*) FROM app."Chapter";           -- Expected: ALL
SELECT COUNT(*) FROM app."Person";            -- Expected: ALL
SELECT COUNT(*) FROM app."OfficerAssignment"; -- Expected: ALL
SELECT COUNT(*) FROM app."Session";           -- Expected: 0 (403)
SELECT COUNT(*) FROM app."role_permission";   -- Expected: ALL
```

### 5.3 Board Member Access - Limited to Board-Level Data

| Test ID | Table | Query | Expected | Status |
|---------|-------|-------|----------|--------|
| HIER-020 | `Chapter` | SELECT all | All chapters | ⏳ |
| HIER-021 | `Person` | SELECT all | All persons | ⏳ |
| HIER-022 | `role_permission` | SELECT all | Board-level roles only | ⏳ |
| HIER-023 | `Session` | SELECT all | 0 rows (403) | ⏳ |

### 5.4 State Coordinator Access - Limited to State-Level Data

| Test ID | Query | Expected | Status |
|---------|-------|----------|--------|
| HIER-030 | SELECT chapters WHERE state = 'CA' | Rows returned | ⏳ |
| HIER-031 | SELECT chapters WHERE state = 'TX' | 0 rows (403) | ⏳ |
| HIER-032 | SELECT persons WHERE chapter in state 'CA' | Rows returned | ⏳ |
| HIER-033 | SELECT role_permission WHERE role IN (state_coordinator, area_rep, etc) | Rows returned | ⏳ |
| HIER-034 | SELECT role_permission WHERE role = 'ceo' | 0 rows (403) | ⏳ |

### 5.5 Chapter President Access - Limited to Chapter-Level Data

| Test ID | Query | Expected | Status |
|---------|-------|----------|--------|
| HIER-040 | SELECT persons WHERE chapter_id = 'own-chapter' | Rows returned | ⏳ |
| HIER-041 | SELECT persons WHERE chapter_id = 'other-chapter' | 0 rows (403) | ⏳ |
| HIER-042 | SELECT officers WHERE chapter_id = 'own-chapter' | Rows returned | ⏳ |
| HIER-043 | SELECT role_permission WHERE role IN (president, secretary, treasurer, etc) | Rows returned | ⏳ |
| HIER-044 | SELECT role_permission WHERE role = 'state_coordinator' | 0 rows (403) | ⏳ |

### 5.6 Member Access - Minimal Data (Own Record + Public Events)

| Test ID | Query | Expected | Status |
|---------|-------|----------|--------|
| HIER-050 | SELECT * FROM Account WHERE id = own-account | 1 row | ⏳ |
| HIER-051 | SELECT * FROM Account WHERE id != own-account | 0 rows (403) | ⏳ |
| HIER-052 | SELECT * FROM chapter_events | Rows (public events) | ⏳ |
| HIER-053 | SELECT * FROM role_permission | 0 rows (403) | ⏳ |

---

## 6. TABLE-SPECIFIC RLS TEST CASES

### 6.1 Account Table RLS

#### Test: AUTH-001 - Superuser Can Access All Accounts

```sql
SET app.current_account_id = 'root-id';
SELECT COUNT(*) FROM app."Account";
-- Expected: > 0 (all rows)
```

**Status:** ⏳

#### Test: AUTH-002 - User Can Only See Own Account

```sql
SET app.current_account_id = 'user-123';
SELECT id FROM app."Account" WHERE id = 'user-123';
-- Expected: 1 row

SELECT id FROM app."Account" WHERE id != 'user-123';
-- Expected: 0 rows (403)
```

**Status:** ⏳

#### Test: AUTH-003 - Board Member Can See Other Accounts

```sql
SET app.current_account_id = 'board-member-id';
SELECT COUNT(*) FROM app."Account";
-- Expected: > 1 (all accounts)
```

**Status:** ⏳

---

### 6.2 Session Table RLS (CRITICAL - Contains Auth Tokens)

#### Test: SESS-001 - User Can Only Access Own Sessions

```sql
SET app.current_account_id = 'user-456';
SELECT id FROM app."Session" WHERE "accountId" = 'user-456';
-- Expected: User's sessions only

SELECT id FROM app."Session" WHERE "accountId" != 'user-456';
-- Expected: 0 rows (403)
```

**Status:** ⏳

#### Test: SESS-002 - Non-Superuser Cannot Access Other User Sessions

```sql
SET app.current_account_id = 'user-789';
SELECT COUNT(*) FROM app."Session";
-- Expected: 0 (only own sessions, or 0 if none)

SET app.current_account_id = 'user-123';
SELECT COUNT(*) FROM app."Session" WHERE "accountId" = 'user-789';
-- Expected: 0 rows (403)
```

**Status:** ⏳

---

### 6.3 Chapter Table RLS

#### Test: CHAP-001 - Superuser Sees All Chapters

```sql
SET app.current_account_id = 'root-id';
SELECT COUNT(*) FROM app."Chapter";
-- Expected: Total chapter count
```

**Status:** ⏳

#### Test: CHAP-002 - Chapter Admin Sees Own Chapter

```sql
SET app.current_account_id = 'chapter-admin-id';
SELECT COUNT(*) FROM app."Chapter" WHERE id = 'admin-chapter-id';
-- Expected: 1 row

SELECT COUNT(*) FROM app."Chapter" WHERE id != 'admin-chapter-id';
-- Expected: 0 rows or limited set
```

**Status:** ⏳

#### Test: CHAP-003 - State Coordinator Sees State Chapters

```sql
SET app.current_account_id = 'state-coordinator-ca';
SELECT COUNT(*) FROM app."Chapter" WHERE state = 'CA';
-- Expected: > 0

SELECT COUNT(*) FROM app."Chapter" WHERE state = 'TX';
-- Expected: 0 rows (403)
```

**Status:** ⏳

---

### 6.4 Person Table RLS

#### Test: PERS-001 - Chapter Admin Sees Chapter Members

```sql
SET app.current_account_id = 'chapter-admin-id';
SELECT COUNT(*) FROM app."Person" WHERE chapter_id = 'admin-chapter-id';
-- Expected: > 0

SELECT COUNT(*) FROM app."Person" WHERE chapter_id != 'admin-chapter-id';
-- Expected: 0 rows or limited
```

**Status:** ⏳

#### Test: PERS-002 - User Sees Own Record Only

```sql
SET app.current_account_id = 'user-111';
-- Assume user-111 has person_id = 'person-111'
SELECT id FROM app."Person" WHERE id = 'person-111';
-- Expected: 1 row (own record)

SELECT COUNT(*) FROM app."Person" WHERE id != 'person-111';
-- Expected: 0 rows
```

**Status:** ⏳

---

### 6.5 OfficerAssignment Table RLS

#### Test: OFFR-001 - Chapter Admin Sees Chapter Officers

```sql
SET app.current_account_id = 'chapter-admin-id';
SELECT COUNT(*) FROM app."OfficerAssignment" WHERE chapter_id = 'admin-chapter-id';
-- Expected: > 0
```

**Status:** ⏳

#### Test: OFFR-002 - Officer Sees Own Assignment

```sql
SET app.current_account_id = 'officer-user-id';
-- Assume linked to person-222 with assignment in chapter-xyz
SELECT COUNT(*) FROM app."OfficerAssignment" WHERE person_id = 'person-222';
-- Expected: > 0
```

**Status:** ⏳

---

### 6.6 role_permission Table RLS (HIERARCHICAL)

#### Test: RPERM-001 - Root Sees All Roles

```sql
SET app.current_account_id = 'root-id';
SELECT COUNT(*) FROM app."role_permission";
-- Expected: 20 (all roles)
```

**Status:** ⏳

#### Test: RPERM-002 - Board Member Sees Board-Level Roles

```sql
SET app.current_account_id = 'board-member-id';
SELECT COUNT(*) FROM app."role_permission" 
WHERE role IN ('board', 'board_advisor', 'ceo');
-- Expected: 3

SELECT COUNT(*) FROM app."role_permission" 
WHERE role = 'root';
-- Expected: 0 rows (403)
```

**Status:** ⏳

#### Test: RPERM-003 - State Coordinator Sees State + Chapter Roles

```sql
SET app.current_account_id = 'state-coordinator-id';
SELECT role FROM app."role_permission" ORDER BY role;
-- Expected: state_coordinator, area_rep, president, secretary, treasurer, etc.

SELECT role FROM app."role_permission" WHERE role = 'ceo';
-- Expected: 0 rows (403)
```

**Status:** ⏳

#### Test: RPERM-004 - Chapter President Sees Chapter Roles Only

```sql
SET app.current_account_id = 'chapter-president-id';
SELECT role FROM app."role_permission";
-- Expected: president, secretary, treasurer, chaplain, road_captain, rfs_lead, member

SELECT role FROM app."role_permission" WHERE role = 'state_coordinator';
-- Expected: 0 rows (403)
```

**Status:** ⏳

---

## 7. FAILURE MODE TEST CASES

**Objective:** Verify unauthorized access attempts are blocked.

### 7.1 Missing Context (No Account Set)

| Test ID | Query | Expected | Status |
|---------|-------|----------|--------|
| FAIL-001 | SELECT * FROM app."Account"; (no SET) | 0 rows (403) | ⏳ |
| FAIL-002 | SELECT * FROM app."Chapter"; (no SET) | 0 rows (403) | ⏳ |
| FAIL-003 | SELECT * FROM app."Person"; (no SET) | 0 rows (403) | ⏳ |

**Script:**
```sql
-- Without setting context, queries fail
SELECT COUNT(*) FROM app."Account";
-- Expected: 0 rows (RLS blocks all access)
```

### 7.2 Invalid Context

| Test ID | Query | Expected | Status |
|---------|-------|----------|--------|
| FAIL-010 | SET app.current_account_id = 'nonexistent-id'; SELECT * FROM app."Chapter"; | 0 rows (403) | ⏳ |
| FAIL-011 | SET app.current_account_id = ''; SELECT * FROM app."Chapter"; | 0 rows (403) | ⏳ |
| FAIL-012 | SET app.current_account_id = NULL; SELECT * FROM app."Chapter"; | 0 rows (403) | ⏳ |

### 7.3 Role Escalation Attempts (Member Tries to Access CEO Data)

| Test ID | Scenario | Expected | Status |
|---------|----------|----------|--------|
| FAIL-020 | Member account tries SELECT from role_permission | 0 rows (403) | ⏳ |
| FAIL-021 | Member account tries SELECT all chapters | 0 rows (403) | ⏳ |
| FAIL-022 | Member account tries SELECT all persons | 0 rows (own + public only) | ⏳ |

**Script:**
```sql
SET app.current_account_id = 'member-account-id';
SELECT COUNT(*) FROM app."role_permission";
-- Expected: 0 rows (members cannot see permissions)

SELECT COUNT(*) FROM app."Chapter" WHERE state IS NOT NULL;
-- Expected: 0 rows (members cannot see chapters)
```

### 7.4 Cross-Chapter Access Attempts

| Test ID | Scenario | Expected | Status |
|---------|----------|----------|--------|
| FAIL-030 | Chapter A admin tries to read Chapter B persons | 0 rows (403) | ⏳ |
| FAIL-031 | Chapter A president tries to modify Chapter B officers | 0 rows (403) | ⏳ |
| FAIL-032 | Chapter A treasurer tries to read Chapter B financials | 0 rows (403) | ⏳ |

**Script:**
```sql
SET app.current_account_id = 'chapter-a-admin-id';
SELECT COUNT(*) FROM app."Person" WHERE chapter_id = 'chapter-b-id';
-- Expected: 0 rows (403)
```

### 7.5 Cross-State Access Attempts (State Coordinator)

| Test ID | Scenario | Expected | Status |
|---------|----------|----------|--------|
| FAIL-040 | CA State Coordinator tries to read TX chapters | 0 rows (403) | ⏳ |
| FAIL-041 | CA State Coordinator tries to read TX persons | 0 rows (403) | ⏳ |
| FAIL-042 | CA State Coordinator tries to modify TX officers | 0 rows (403) | ⏳ |

**Script:**
```sql
SET app.current_account_id = 'ca-state-coordinator-id';
SELECT COUNT(*) FROM app."Chapter" WHERE state = 'TX';
-- Expected: 0 rows (403)
```

---

## 8. SUCCESS PATH TEST CASES

**Objective:** Verify authorized access works correctly.

### 8.1 Superuser (Root) Full Access

| Test ID | Action | Expected | Status |
|---------|--------|----------|--------|
| SUCC-001 | Root reads all accounts | > 0 rows | ⏳ |
| SUCC-002 | Root reads all chapters | > 0 rows | ⏳ |
| SUCC-003 | Root modifies role permission | 1 row affected | ⏳ |
| SUCC-004 | Root reads all sessions | > 0 rows | ⏳ |

### 8.2 CEO Access to Board-Level Data

| Test ID | Action | Expected | Status |
|---------|--------|----------|--------|
| SUCC-010 | CEO reads all chapters | > 0 rows | ⏳ |
| SUCC-011 | CEO reads all persons | > 0 rows | ⏳ |
| SUCC-012 | CEO manages role permissions | Success | ⏳ |
| SUCC-013 | CEO cannot read sessions | 0 rows (expected) | ⏳ |

### 8.3 State Coordinator State-Level Access

| Test ID | Action | Expected | Status |
|---------|--------|----------|--------|
| SUCC-020 | State Coordinator reads own state chapters | > 0 rows | ⏳ |
| SUCC-021 | State Coordinator reads own state persons | > 0 rows | ⏳ |
| SUCC-022 | State Coordinator manages state-level roles | Success | ⏳ |
| SUCC-023 | State Coordinator cannot read other state data | 0 rows | ⏳ |

### 8.4 Chapter President Chapter-Level Access

| Test ID | Action | Expected | Status |
|---------|--------|----------|--------|
| SUCC-030 | President reads own chapter members | > 0 rows | ⏳ |
| SUCC-031 | President reads own chapter officers | > 0 rows | ⏳ |
| SUCC-032 | President manages chapter events | Success | ⏳ |
| SUCC-033 | President cannot read other chapters | 0 rows | ⏳ |

### 8.5 Member Self-Service Access

| Test ID | Action | Expected | Status |
|---------|--------|----------|--------|
| SUCC-040 | Member reads own account | 1 row | ⏳ |
| SUCC-041 | Member reads own motorcycle | 1 row (if owner) | ⏳ |
| SUCC-042 | Member reads public events | > 0 rows | ⏳ |
| SUCC-043 | Member cannot read permissions | 0 rows | ⏳ |

---

## 9. EDGE CASE TEST CASES

### 9.1 Expired Officer Assignments

**Scenario:** Officer has endDate in past; should be treated as non-officer

| Test ID | Setup | Query | Expected | Status |
|---------|-------|-------|----------|--------|
| EDGE-001 | Create assignment with endDate = yesterday | SELECT as expired officer | 0 rows (403) | ⏳ |
| EDGE-002 | Create assignment with endDate = tomorrow | SELECT as active officer | Rows | ⏳ |
| EDGE-003 | Create assignment with endDate = NULL | SELECT as active officer | Rows | ⏳ |

### 9.2 Multiple Roles per Account

**Scenario:** User with multiple concurrent roles (e.g., Chapter President + State Coordinator)

| Test ID | Roles | Query | Expected | Status |
|---------|-------|-------|----------|--------|
| EDGE-010 | President + State Coordinator | SELECT chapters | Both state + chapter data | ⏳ |
| EDGE-011 | President + CEO | SELECT all | All data (CEO scope) | ⏳ |

### 9.3 No OrgUnit Association

**Scenario:** Account without orgunit_id; helper functions must handle NULL

| Test ID | Scenario | Expected | Status |
|---------|----------|----------|--------|
| EDGE-020 | Account.orgunit_id IS NULL, is_national_evangelist() called | false | ⏳ |
| EDGE-021 | Account.orgunit_id IS NULL, is_state_coordinator() called | false | ⏳ |

### 9.4 Recursive Hierarchy Queries

**Scenario:** Deep hierarchy lookups (e.g., Person → Chapter → OrgUnit → State)

| Test ID | Query | Expected | Status |
|---------|-------|----------|--------|
| EDGE-030 | Member reads own chapter (4 levels deep) | 1 row | ⏳ |
| EDGE-031 | State Coordinator reads persons across chapters | Multi-row | ⏳ |

### 9.5 Concurrent Session Context Isolation

**Scenario:** Two API requests in flight simultaneously

| Test ID | Request A | Request B | Expected | Status |
|---------|-----------|-----------|----------|--------|
| EDGE-040 | Set context = user-A, SELECT chapters | Set context = user-B, SELECT chapters | A sees user-A data, B sees user-B data | ⏳ |

---

## 10. SECURITY CHECKLIST

**Objective:** Validate application security best practices for RLS.

### 10.1 Context Setting

- ✅ Session variable is set on EVERY authenticated API request
- ✅ Context is set BEFORE any data query executes
- ✅ Context is set per-request (not reused globally)
- ✅ Invalid/expired tokens do NOT set context
- ⏳ Context persists correctly for entire request lifetime
- ⏳ Context is cleared/reset after request completes

### 10.2 Helper Function Security

- ✅ All helper functions use `STABLE` or `IMMUTABLE` hints
- ✅ Helper functions only query necessary columns
- ✅ Helper functions return boolean (no data leakage)
- ✅ Helper functions handle NULL gracefully
- ⏳ Helper functions reject NULL context with false
- ⏳ No helper function directly queries user input

### 10.3 RLS Policy Coverage

- ✅ All public-facing tables have RLS enabled
- ✅ All policies use DROP IF EXISTS pattern (idempotent)
- ✅ No table has both SELECT/INSERT/UPDATE/DELETE gaps
- ✅ All policies reference helper functions (not hardcoded roles)
- ⏳ Sensitive tables (Session, AppSetting) have most restrictive policies
- ⏳ No table has empty policy list (default-deny)

### 10.4 Hierarchy Enforcement

- ✅ Root/Superuser can access all data
- ✅ CEO cannot escalate to Root
- ✅ Board members see appropriate scope
- ✅ State leaders see state + chapter data only
- ✅ Chapter leaders see chapter data only
- ✅ Members see minimal data (own + public)
- ⏳ No policy allows horizontal escalation (peer → different chapter)

### 10.5 Token & Session Safety

- ✅ Session tokens are sensitive data (RLS restricted)
- ✅ Only account owner can read own session
- ✅ Superuser can audit sessions (if needed)
- ✅ Expired sessions cannot set context
- ⏳ Session table cannot be accessed via PostgREST except by owner/admin

### 10.6 Data Leakage Prevention

- ✅ No error messages reveal data existence
- ✅ No UNION-based bypass vectors in policies
- ✅ No OR conditions allow unintended access
- ⏳ Row count queries return 0, not "403 error"
- ⏳ No policy allows reading by guessing IDs
- ⏳ No implicit joins expose hidden data

### 10.7 Performance & DoS Prevention

- ✅ Helper functions are marked STABLE (query optimizer can cache)
- ✅ Policies don't use expensive subqueries in WHERE conditions
- ✅ No recursive policy joins (would loop infinitely)
- ⏳ Large result sets don't timeout (pagination required)
- ⏳ Subqueries in policies have index support

---

## 11. TEST EXECUTION INSTRUCTIONS

### 11.1 Prerequisites

1. **Access Supabase Dashboard**
   - Go to Supabase Project → SQL Editor
   - Ensure you are connected to the production-like database

2. **Prepare Test Data**
   - Create test accounts with various roles (root, ceo, board, state_coordinator, chapter_president, member)
   - Create test chapters, persons, and officer assignments
   - Link accounts to appropriate organizations/chapters

3. **Review Migration Status**
   - Verify all RLS migrations have been applied
   - Confirm all tables have RLS enabled
   - Confirm all policies are active

### 11.2 Test Execution by Category

#### Phase 1: Helper Functions (30 min)
- Execute tests HF-001 through HF-029
- Document boolean results per role
- Verify correct role hierarchy

#### Phase 2: Session Context Isolation (20 min)
- Execute tests ROOT-001 through ROOT-002
- Verify no cross-account leakage
- Confirm context is per-request

#### Phase 3: Role Hierarchy (45 min)
- Execute tests HIER-001 through HIER-050
- Verify each role sees correct scope
- Document data visibility per level

#### Phase 4: Table-Specific RLS (60 min)
- Execute AUTH, SESS, CHAP, PERS, OFFR tests
- Run one test per table systematically
- Document authorization results

#### Phase 5: Failure Modes (30 min)
- Execute tests FAIL-001 through FAIL-042
- Verify all unauthorized attempts are blocked
- Confirm no data leakage on failures

#### Phase 6: Success Paths (30 min)
- Execute tests SUCC-001 through SUCC-043
- Verify authorized access works correctly
- Document role access patterns

#### Phase 7: Edge Cases (30 min)
- Execute tests EDGE-001 through EDGE-040
- Verify system handles boundary conditions
- Document unexpected behaviors

**Total Execution Time:** ~4.5 hours (can be parallelized)

### 11.3 Test Result Logging

For each test:
```
TEST ID: [ID]
Query: [SQL]
Account Role: [role]
Set Context: [account-id]
Expected: [description]
Actual: [result]
Status: [PASS/FAIL/BLOCKED]
Notes: [observations]
```

Example:
```
TEST ID: HIER-010
Query: SELECT COUNT(*) FROM app."Chapter"
Account Role: CEO
Set Context: ceo-account-id
Expected: All rows (>0)
Actual: 47
Status: PASS
Notes: CEO can see all chapters across all states
```

---

## 12. EXPECTED RESULTS & PASS/FAIL CRITERIA

### 12.1 Pass Criteria

✅ **PASS** if:
- All helper functions return correct boolean values per role
- Session context prevents cross-account access
- Each role sees exactly the scope defined in hierarchy
- All unauthorized access attempts return 0 rows (or 403)
- All authorized access attempts return correct data
- No data leakage occurs in failure modes
- Edge cases are handled gracefully
- Performance is acceptable (queries < 500ms)

### 12.2 Fail Criteria

❌ **FAIL** if:
- Any helper function returns incorrect value
- Cross-account data leakage occurs
- Unauthorized user sees restricted data
- Role hierarchy is not enforced at database level
- Error messages reveal sensitive information
- Performance degrades significantly
- Any RLS policy is missing or incomplete
- Session tokens are exposed to unauthorized users

### 12.3 Sign-Off Thresholds

| Category | Pass Threshold | Confidence |
|----------|---|---|
| Helper Functions | 100% (29/29) | CRITICAL |
| Session Isolation | 100% (2/2) | CRITICAL |
| Role Hierarchy | 95% (48/50 min) | CRITICAL |
| Table-Specific RLS | 90% (15/17 min) | CRITICAL |
| Failure Modes | 100% (21/21) | CRITICAL |
| Success Paths | 95% (40/43 min) | HIGH |
| Edge Cases | 90% (36/40 min) | MEDIUM |
| Security Checklist | 95% (20/21 min) | HIGH |

**Release Gate:** Cannot proceed to production without 100% on CRITICAL tests.

---

## 13. RISK MATRIX & MITIGATIONS

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| RLS policies have gaps | Medium | CRITICAL | Exhaustive policy review + test all tables |
| Session context leaks between requests | Low | CRITICAL | Context isolation testing + middleware review |
| Helper functions return wrong values | Low | HIGH | Unit test all role combinations |
| Cross-account data visible | Low | CRITICAL | Dedicated cross-account tests |
| Performance degrades with RLS | Medium | HIGH | Load test 1000+ concurrent requests |
| Unauthorized escalation possible | Low | CRITICAL | Test all failure modes + role combinations |

---

## 14. SIGN-OFF

### Prepared By
- QA Engineer: _____________________________ Date: _______
- Security Engineer: _____________________________ Date: _______

### Reviewed By
- Backend Lead: _____________________________ Date: _______

### Approved For Production
- Engineering Manager: _____________________________ Date: _______

**Test Execution Date:** _______________________  
**Result Summary:** ______ PASS / ______ FAIL / ______ CONDITIONAL  
**Known Issues:** _____________________________________________  
**Release Recommendation:** ____________________________________

---

## 15. APPENDIX: SQL TEST TEMPLATES

### Template 1: Helper Function Test
```sql
-- Set context
SET app.current_account_id = 'account-id';

-- Get role
SELECT app.current_account_role();
-- Expected: [role]

-- Check superuser
SELECT app.is_superuser();
-- Expected: true/false

-- Check board member
SELECT app.is_board_member();
-- Expected: true/false
```

### Template 2: Access Control Test
```sql
-- Set context
SET app.current_account_id = 'user-account-id';

-- Test table access
SELECT COUNT(*) FROM app."[TABLE]" WHERE [condition];
-- Expected: [row_count]

-- Test denied access
SELECT COUNT(*) FROM app."[TABLE]" WHERE [restricted_condition];
-- Expected: 0 (or 403 error)
```

### Template 3: Cross-Account Test
```sql
-- Request A: Set context to user-a
SET app.current_account_id = 'user-a-id';
SELECT id FROM app."Account" WHERE id = 'user-b-id';
-- Expected: 0 rows

-- Request B: Switch context to user-b
SET app.current_account_id = 'user-b-id';
SELECT id FROM app."Account" WHERE id = 'user-a-id';
-- Expected: 0 rows
```

### Template 4: Hierarchy Scope Test
```sql
-- Set state coordinator context
SET app.current_account_id = 'state-coordinator-ca';

-- See own state
SELECT COUNT(*) FROM app."Chapter" WHERE state = 'CA';
-- Expected: > 0

-- Cannot see other state
SELECT COUNT(*) FROM app."Chapter" WHERE state = 'TX';
-- Expected: 0 rows (403)
```

---

**Document Version:** 1.0  
**Last Updated:** 2026-07-20  
**Status:** Ready for Execution  
**Next Review:** After test completion
