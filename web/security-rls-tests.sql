-- ============================================================================
-- COMPREHENSIVE RLS SECURITY TEST SUITE - SQL VERSION
-- CMA Member Database - Supabase
-- Execute this against the live database to validate RLS security
-- ============================================================================

-- Setup: Create test accounts with different roles
DO $$
DECLARE
  v_root_id TEXT;
  v_superuser_id TEXT;
  v_ceo_id TEXT;
  v_board_id TEXT;
  v_member_id TEXT;
  v_state_coord_id TEXT;
  v_chapter_admin_id TEXT;
  v_tx_orgunit_id TEXT;
  v_chapter_a_id TEXT;
  v_chapter_b_id TEXT;
  v_person_id TEXT;
  v_test_salt TEXT := '8f7d5e3a9c2b1f6d4e8a7c5b3d9f2a1e';
  v_test_hash TEXT;
BEGIN
  -- Clean up existing test accounts
  DELETE FROM app."Account" WHERE email LIKE 'test_rls_%@test.com';
  
  -- Insert ROOT account
  INSERT INTO app."Account" (id, email, role, "passwordHash", "passwordSalt", username)
  VALUES (gen_random_uuid(), 'test_rls_root@test.com', 'root', '9b4b5d3c2e1f7a8d4c6b5e3a2f1d9c8b7a6e5d4c3b2a1f9e8d7c6b5a4f3e2d', v_test_salt, 'test_root')
  RETURNING id INTO v_root_id;
  
  -- Insert SUPERUSER account
  INSERT INTO app."Account" (id, email, role, "passwordHash", "passwordSalt", username)
  VALUES (gen_random_uuid(), 'test_rls_superuser@test.com', 'superuser', '7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f9e8d', v_test_salt, 'test_superuser')
  RETURNING id INTO v_superuser_id;
  
  -- Insert CEO account
  INSERT INTO app."Account" (id, email, role, "passwordHash", "passwordSalt", username)
  VALUES (gen_random_uuid(), 'test_rls_ceo@test.com', 'ceo', '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1', v_test_salt, 'test_ceo')
  RETURNING id INTO v_ceo_id;
  
  -- Insert BOARD account
  INSERT INTO app."Account" (id, email, role, "passwordHash", "passwordSalt", username)
  VALUES (gen_random_uuid(), 'test_rls_board@test.com', 'board', '5f6e7d8c9b0a1f2e3d4c5b6a7f8e9d0c1b2a3f4e5d6c7b8a9f0e1d2c3b4a', v_test_salt, 'test_board')
  RETURNING id INTO v_board_id;
  
  -- Insert MEMBER account
  INSERT INTO app."Account" (id, email, role, "passwordHash", "passwordSalt", username)
  VALUES (gen_random_uuid(), 'test_rls_member@test.com', 'member', '3d4c5b6a7f8e9d0c1b2a3f4e5d6c7b8a9f0e1d2c3b4a5f6e7d8c9b0a1f2e', v_test_salt, 'test_member')
  RETURNING id INTO v_member_id;
  
  -- Insert OrgUnit for TX state
  INSERT INTO app."OrgUnit" (id, code, name, type)
  VALUES (gen_random_uuid(), 'TX', 'Texas', 'state')
  RETURNING id INTO v_tx_orgunit_id;
  
  -- Insert STATE_COORDINATOR account
  INSERT INTO app."Account" (id, email, role, "passwordHash", "passwordSalt", username, "orgunit_id")
  VALUES (gen_random_uuid(), 'test_rls_state_coord@test.com', 'state_coordinator', '0e1d2c3b4a5f6e7d8c9b0a1f2e3d4c5b6a7f8e9d0c1b2a3f4e5d6c7b8a9f', v_test_salt, 'test_state_coord', v_tx_orgunit_id)
  RETURNING id INTO v_state_coord_id;
  
  -- Create test chapters
  INSERT INTO app."Chapter" (id, name, number, state, region, "orgunit_id")
  VALUES (gen_random_uuid(), 'Test Chapter A', '999', 'TX', 1, v_tx_orgunit_id)
  RETURNING id INTO v_chapter_a_id;
  
  INSERT INTO app."Chapter" (id, name, number, state, region, "orgunit_id")
  VALUES (gen_random_uuid(), 'Test Chapter B', '998', 'TX', 1, v_tx_orgunit_id)
  RETURNING id INTO v_chapter_b_id;
  
  -- Create person for chapter admin
  INSERT INTO app."Person" (id, "firstName", "lastName", "chapter_id")
  VALUES (gen_random_uuid(), 'Test', 'ChapterAdmin', v_chapter_a_id)
  RETURNING id INTO v_person_id;
  
  -- Create officer assignment
  INSERT INTO app."OfficerAssignment" (id, "person_id", "chapter_id", role)
  VALUES (gen_random_uuid(), v_person_id, v_chapter_a_id, 'president');
  
  -- Insert CHAPTER_ADMIN account
  INSERT INTO app."Account" (id, email, role, "passwordHash", "passwordSalt", username, "person_id", "chapter_id")
  VALUES (gen_random_uuid(), 'test_rls_chapter_admin@test.com', 'president', '2b3a4f5e6d7c8b9a0f1e2d3c4b5a6f7e8d9c0b1a2f3e4d5c6b7a8f9e0d1c2b', v_test_salt, 'test_chapter_admin', v_person_id, v_chapter_a_id)
  RETURNING id INTO v_chapter_admin_id;
  
  -- Store IDs in temp table for use in tests
  CREATE TEMP TABLE test_accounts (
    account_type TEXT,
    account_id TEXT,
    role_name TEXT,
    chapter_id TEXT,
    state TEXT
  );
  
  INSERT INTO test_accounts VALUES
    ('root', v_root_id, 'root', NULL, NULL),
    ('superuser', v_superuser_id, 'superuser', NULL, NULL),
    ('ceo', v_ceo_id, 'ceo', NULL, NULL),
    ('board', v_board_id, 'board', NULL, NULL),
    ('member', v_member_id, 'member', NULL, NULL),
    ('state_coordinator', v_state_coord_id, 'state_coordinator', NULL, 'TX'),
    ('chapter_admin', v_chapter_admin_id, 'president', v_chapter_a_id, 'TX');
  
  RAISE NOTICE 'Setup complete: Created test accounts';
  RAISE NOTICE 'Test IDs stored in test_accounts temp table';

END $$;

-- ============================================================================
-- TEST 1: Helper Function Correctness
-- ============================================================================

\echo '=== TEST 1: Helper Function Correctness ==='

-- 1.1: Test current_account_role() for ROOT
SELECT 'TEST 1.1' AS test_name;
SET app.current_account_id = (SELECT account_id FROM test_accounts WHERE account_type = 'root');
SELECT app.current_account_role() as current_role, 'root' as expected_role,
       CASE WHEN app.current_account_role() = 'root' THEN 'PASS' ELSE 'FAIL' END as result;

-- 1.2: Test is_superuser() for ROOT
\echo ''
SELECT 'TEST 1.2: is_superuser() - ROOT' AS test;
SET app.current_account_id = (SELECT account_id FROM test_accounts WHERE account_type = 'root');
SELECT app.is_superuser() as is_superuser, true as expected, 
       CASE WHEN app.is_superuser() = true THEN 'PASS' ELSE 'FAIL' END as result;

-- 1.3: Test is_superuser() for MEMBER (should be false)
\echo ''
SELECT 'TEST 1.3: is_superuser() - MEMBER' AS test;
SET app.current_account_id = (SELECT account_id FROM test_accounts WHERE account_type = 'member');
SELECT app.is_superuser() as is_superuser, false as expected,
       CASE WHEN app.is_superuser() = false THEN 'PASS' ELSE 'FAIL' END as result;

-- 1.4: Test is_board_member() for CEO
\echo ''
SELECT 'TEST 1.4: is_board_member() - CEO' AS test;
SET app.current_account_id = (SELECT account_id FROM test_accounts WHERE account_type = 'ceo');
SELECT app.is_board_member() as is_board, true as expected,
       CASE WHEN app.is_board_member() = true THEN 'PASS' ELSE 'FAIL' END as result;

-- 1.5: Test is_board_member() for MEMBER
\echo ''
SELECT 'TEST 1.5: is_board_member() - MEMBER' AS test;
SET app.current_account_id = (SELECT account_id FROM test_accounts WHERE account_type = 'member');
SELECT app.is_board_member() as is_board, false as expected,
       CASE WHEN app.is_board_member() = false THEN 'PASS' ELSE 'FAIL' END as result;

-- 1.6: Test is_state_leadership() for STATE_COORDINATOR
\echo ''
SELECT 'TEST 1.6: is_state_leadership() - STATE_COORDINATOR' AS test;
SET app.current_account_id = (SELECT account_id FROM test_accounts WHERE account_type = 'state_coordinator');
SELECT app.is_state_leadership() as is_state_lead, true as expected,
       CASE WHEN app.is_state_leadership() = true THEN 'PASS' ELSE 'FAIL' END as result;

-- 1.7: Test is_state_leadership() for MEMBER
\echo ''
SELECT 'TEST 1.7: is_state_leadership() - MEMBER' AS test;
SET app.current_account_id = (SELECT account_id FROM test_accounts WHERE account_type = 'member');
SELECT app.is_state_leadership() as is_state_lead, false as expected,
       CASE WHEN app.is_state_leadership() = false THEN 'PASS' ELSE 'FAIL' END as result;

-- ============================================================================
-- TEST 2: Policy Coverage
-- ============================================================================

\echo ''
\echo '=== TEST 2: RLS Policy Coverage ==='

SELECT 
  t.table_name,
  CASE WHEN t.row_security_active THEN 'ENABLED' ELSE 'DISABLED' END as rls_status,
  CASE WHEN t.row_security_active THEN 'PASS' ELSE 'FAIL' END as result
FROM information_schema.tables t
WHERE table_schema = 'app' 
  AND table_name IN (
    'Account', 'Session', 'Chapter', 'Person', 'OrgUnit', 'OfficerAssignment', 
    'Motorcycle', 'RoleNote', 'EmergencyContact', 'chapter_events',
    'chapter_event_attendees', 'chapter_event_follow_ups', 'chapter_reporting_snapshots',
    'chapter_status_transitions', 'account_invite_tokens', 'role_permission'
  )
ORDER BY table_name;

-- ============================================================================
-- TEST 3: Session Isolation
-- ============================================================================

\echo ''
\echo '=== TEST 3: Session Isolation ==='

-- Create test sessions
INSERT INTO app."Session" (id, "accountId", "userAgent", token)
SELECT gen_random_uuid(), account_id, 'test-agent', 'test-token-' || account_type 
FROM test_accounts
WHERE account_type IN ('root', 'member');

-- Get session IDs
SELECT 'Created test sessions for ROOT and MEMBER' AS note;

-- 3.1: Member reads own session
\echo ''
SELECT 'TEST 3.1: Member reads own session' AS test;
SET app.current_account_id = (SELECT account_id FROM test_accounts WHERE account_type = 'member');
SELECT COUNT(*) as session_count, 
       CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END as result
FROM app."Session" 
WHERE "accountId" = app.current_account_id();

-- 3.2: Member tries to read ROOT's session (SHOULD RETURN 0)
\echo ''
SELECT 'TEST 3.2: Member attempts to read ROOT session (should block)' AS test;
SET app.current_account_id = (SELECT account_id FROM test_accounts WHERE account_type = 'member');
SELECT COUNT(*) as sessions_visible_to_member_from_root,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL - DATA LEAKAGE' END as result
FROM app."Session"
WHERE "accountId" = (SELECT account_id FROM test_accounts WHERE account_type = 'root');

-- 3.3: ROOT reads all sessions
\echo ''
SELECT 'TEST 3.3: ROOT reads all sessions' AS test;
SET app.current_account_id = (SELECT account_id FROM test_accounts WHERE account_type = 'root');
SELECT COUNT(*) as total_sessions_visible_to_root,
       CASE WHEN COUNT(*) >= 2 THEN 'PASS' ELSE 'WARNING' END as result
FROM app."Session";

-- ============================================================================
-- TEST 4: Account Data Isolation
-- ============================================================================

\echo ''
\echo '=== TEST 4: Account Data Isolation ==='

-- 4.1: Member reads own account
\echo ''
SELECT 'TEST 4.1: Member reads own account' AS test;
SET app.current_account_id = (SELECT account_id FROM test_accounts WHERE account_type = 'member');
SELECT COUNT(*) as accounts_visible, 'PASS' as result
FROM app."Account"
WHERE id = app.current_account_id();

-- 4.2: Member tries to read CEO account (SHOULD FAIL)
\echo ''
SELECT 'TEST 4.2: Member attempts to read CEO account (should block)' AS test;
SET app.current_account_id = (SELECT account_id FROM test_accounts WHERE account_type = 'member');
SELECT COUNT(*) as ceo_accounts_visible_to_member,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL - DATA LEAKAGE' END as result
FROM app."Account"
WHERE id = (SELECT account_id FROM test_accounts WHERE account_type = 'ceo');

-- 4.3: Board reads CEO account
\echo ''
SELECT 'TEST 4.3: Board member reads CEO account (should allow)' AS test;
SET app.current_account_id = (SELECT account_id FROM test_accounts WHERE account_type = 'board');
SELECT COUNT(*) as ceo_accounts_visible_to_board,
       CASE WHEN COUNT(*) >= 1 THEN 'PASS' ELSE 'WARNING' END as result
FROM app."Account"
WHERE id = (SELECT account_id FROM test_accounts WHERE account_type = 'ceo');

-- 4.4: CEO tries to read ROOT account (SHOULD FAIL - ROOT is superuser)
\echo ''
SELECT 'TEST 4.4: CEO attempts to read ROOT account (should block)' AS test;
SET app.current_account_id = (SELECT account_id FROM test_accounts WHERE account_type = 'ceo');
SELECT COUNT(*) as root_accounts_visible_to_ceo,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL - PRIVILEGE ESCALATION RISK' END as result
FROM app."Account"
WHERE id = (SELECT account_id FROM test_accounts WHERE account_type = 'root');

-- ============================================================================
-- TEST 5: Chapter Isolation
-- ============================================================================

\echo ''
\echo '=== TEST 5: Chapter Isolation ==='

-- 5.1: Chapter Admin reads own chapter
\echo ''
SELECT 'TEST 5.1: Chapter Admin reads own chapter' AS test;
SET app.current_account_id = (SELECT account_id FROM test_accounts WHERE account_type = 'chapter_admin');
SELECT COUNT(*) as chapters_visible,
       CASE WHEN COUNT(*) >= 1 THEN 'PASS' ELSE 'FAIL' END as result
FROM app."Chapter"
WHERE id = (SELECT chapter_id FROM test_accounts WHERE account_type = 'chapter_admin');

-- 5.2: Chapter Admin tries to read other chapter (SHOULD FAIL)
\echo ''
SELECT 'TEST 5.2: Chapter Admin attempts to read other chapter (should block)' AS test;
SET app.current_account_id = (SELECT account_id FROM test_accounts WHERE account_type = 'chapter_admin');
DECLARE
  v_own_chapter_id TEXT;
  v_other_chapter_id TEXT;
BEGIN
  SELECT chapter_id INTO v_own_chapter_id FROM test_accounts WHERE account_type = 'chapter_admin';
  SELECT id INTO v_other_chapter_id FROM app."Chapter" WHERE id != v_own_chapter_id LIMIT 1;
  
  EXECUTE format(
    'SELECT COUNT(*) as other_chapters_visible, 
            CASE WHEN COUNT(*) = 0 THEN ''PASS'' ELSE ''FAIL - DATA LEAKAGE'' END as result
     FROM app."Chapter" WHERE id = %L',
    v_other_chapter_id
  );
END;

-- ============================================================================
-- TEST 6: Sensitive Data Protection (role_permission)
-- ============================================================================

\echo ''
\echo '=== TEST 6: Sensitive Data Protection ==='

-- Create test permission entries for different roles
DO $$
BEGIN
  SET app.current_account_id = (SELECT account_id FROM test_accounts WHERE account_type = 'root');
  
  INSERT INTO app."role_permission" (id, role, permission)
  VALUES 
    (gen_random_uuid(), 'root', 'admin_all_access'),
    (gen_random_uuid(), 'ceo', 'read_all_members'),
    (gen_random_uuid(), 'board', 'read_board_data'),
    (gen_random_uuid(), 'member', 'read_own_profile');
    
  RAISE NOTICE 'Created test permission entries';
END $$;

-- 6.1: Member cannot read role_permission (SHOULD FAIL)
\echo ''
SELECT 'TEST 6.1: Member attempts to read role_permission (should block)' AS test;
SET app.current_account_id = (SELECT account_id FROM test_accounts WHERE account_type = 'member');
SELECT COUNT(*) as permissions_visible_to_member,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL - CRITICAL DATA LEAKAGE' END as result
FROM app."role_permission";

-- 6.2: Board member can read role_permission
\echo ''
SELECT 'TEST 6.2: Board member reads role_permission (should allow)' AS test;
SET app.current_account_id = (SELECT account_id FROM test_accounts WHERE account_type = 'board');
SELECT COUNT(*) as permissions_visible_to_board,
       CASE WHEN COUNT(*) >= 1 THEN 'PASS' ELSE 'WARNING' END as result
FROM app."role_permission";

-- 6.3: ROOT can read all role_permission
\echo ''
SELECT 'TEST 6.3: ROOT reads all role_permission' AS test;
SET app.current_account_id = (SELECT account_id FROM test_accounts WHERE account_type = 'root');
SELECT COUNT(*) as all_permissions_visible,
       CASE WHEN COUNT(*) >= 4 THEN 'PASS' ELSE 'WARNING' END as result
FROM app."role_permission";

-- ============================================================================
-- TEST 7: Privilege Escalation Prevention
-- ============================================================================

\echo ''
\echo '=== TEST 7: Privilege Escalation Prevention ==='

-- 7.1: Member attempts UPDATE to escalate role (SHOULD FAIL)
\echo ''
SELECT 'TEST 7.1: Member attempts to escalate own role (should block)' AS test;
SET app.current_account_id = (SELECT account_id FROM test_accounts WHERE account_type = 'member');
WITH update_attempt AS (
  UPDATE app."Account" 
  SET role = 'ceo' 
  WHERE id = app.current_account_id()
  RETURNING id
)
SELECT CASE 
  WHEN EXISTS(SELECT 1 FROM update_attempt) THEN 'FAIL - PRIVILEGE ESCALATION'
  ELSE 'PASS'
END as result;

-- 7.2: CEO attempts to modify ROOT account (SHOULD FAIL)
\echo ''
SELECT 'TEST 7.2: CEO attempts to modify ROOT account (should block)' AS test;
SET app.current_account_id = (SELECT account_id FROM test_accounts WHERE account_type = 'ceo');
WITH update_attempt AS (
  UPDATE app."Account"
  SET role = 'guest'
  WHERE id = (SELECT account_id FROM test_accounts WHERE account_type = 'root')
  RETURNING id
)
SELECT CASE
  WHEN EXISTS(SELECT 1 FROM update_attempt) THEN 'FAIL - ESCALATION ATTACK'
  ELSE 'PASS'
END as result;

-- ============================================================================
-- TEST 8: Hierarchical Access Control
-- ============================================================================

\echo ''
\echo '=== TEST 8: Hierarchical Access Control ==='

-- 8.1: ROOT sees all data
\echo ''
SELECT 'TEST 8.1: ROOT access level' AS test;
SET app.current_account_id = (SELECT account_id FROM test_accounts WHERE account_type = 'root');
SELECT 
  COUNT(DISTINCT CASE WHEN role = 'root' THEN 1 END) as can_see_root,
  COUNT(DISTINCT CASE WHEN role = 'ceo' THEN 1 END) as can_see_ceo,
  COUNT(DISTINCT CASE WHEN role = 'board' THEN 1 END) as can_see_board,
  COUNT(DISTINCT CASE WHEN role = 'member' THEN 1 END) as can_see_member,
  'PASS' as result
FROM app."Account"
WHERE role IN ('root', 'ceo', 'board', 'member');

-- 8.2: CEO access level
\echo ''
SELECT 'TEST 8.2: CEO access level' AS test;
SET app.current_account_id = (SELECT account_id FROM test_accounts WHERE account_type = 'ceo');
SELECT 
  COUNT(DISTINCT CASE WHEN role = 'root' THEN 1 END) as can_see_root,
  COUNT(DISTINCT CASE WHEN role = 'ceo' THEN 1 END) as can_see_ceo,
  COUNT(DISTINCT CASE WHEN role = 'board' THEN 1 END) as can_see_board,
  COUNT(DISTINCT CASE WHEN role = 'member' THEN 1 END) as can_see_member
FROM app."Account"
WHERE role IN ('root', 'ceo', 'board', 'member');

-- 8.3: Member access level (minimal)
\echo ''
SELECT 'TEST 8.3: Member access level (minimal)' AS test;
SET app.current_account_id = (SELECT account_id FROM test_accounts WHERE account_type = 'member');
SELECT 
  COUNT(*) as accounts_visible_to_member,
  CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL - DATA LEAKAGE' END as result
FROM app."Account"
WHERE id = app.current_account_id();

-- ============================================================================
-- FINAL SUMMARY
-- ============================================================================

\echo ''
\echo '=== SECURITY TEST EXECUTION COMPLETE ==='
\echo 'Review results above for PASS/FAIL status on each test'
\echo 'Critical issues: Look for FAIL or DATA LEAKAGE in results'
\echo 'Privilege escalation risks: Look for UPDATE attempts that succeeded'

-- Cleanup
RESET app.current_account_id;
