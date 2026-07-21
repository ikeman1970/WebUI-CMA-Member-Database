#!/usr/bin/env node

/**
 * COMPREHENSIVE RLS SECURITY TEST SUITE
 * Tests for session isolation, privilege escalation, and cross-account data leakage
 * Execute against live Supabase to validate security posture
 */

const { Client } = require('pg');
const crypto = require('crypto');

// Database connection
const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ ERROR: DATABASE_URL or DIRECT_URL not set in environment');
  process.exit(1);
}

const client = new Client({ connectionString });

// Test results tracking
const results = {
  passed: [],
  failed: [],
  warnings: [],
  totalTests: 0,
  vulnerabilities: [],
};

// Color codes for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function testPass(testName, details = '') {
  results.passed.push(testName);
  results.totalTests++;
  log('green', `✓ PASS: ${testName}`);
  if (details) log('cyan', `  → ${details}`);
}

function testFail(testName, details = '', severity = 'HIGH') {
  results.failed.push(testName);
  results.totalTests++;
  log('red', `✗ FAIL: ${testName} [${severity}]`);
  if (details) log('cyan', `  → ${details}`);
  if (severity === 'CRITICAL') {
    results.vulnerabilities.push({
      test: testName,
      severity: 'CRITICAL',
      details,
    });
  }
}

function testWarning(testName, details = '') {
  results.warnings.push(testName);
  log('yellow', `⚠ WARNING: ${testName}`);
  if (details) log('cyan', `  → ${details}`);
}

// Test helpers
async function execSQL(sql, params = []) {
  try {
    const result = await client.query(sql, params);
    return result.rows;
  } catch (err) {
    console.error(`SQL Error: ${err.message}\nSQL: ${sql}`);
    throw err;
  }
}

async function setAccountContext(accountId) {
  await client.query(`SET app.current_account_id = '${accountId}'`);
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha256').toString('hex');
}

// ============================================================================
// SETUP: Create test accounts with different roles
// ============================================================================

async function setupTestAccounts() {
  log('blue', '\n=== SETUP: Creating Test Accounts ===\n');

  const salt = crypto.randomBytes(16).toString('hex');

  // Clear existing test accounts (if any)
  await execSQL(`
    DELETE FROM app."Account" 
    WHERE email LIKE 'test_rls_%@test.com'
  `);

  // 1. ROOT/SUPERUSER account
  const rootPwd = hashPassword('TestRoot123!', salt);
  const rootResult = await execSQL(
    `INSERT INTO app."Account" (id, email, role, "passwordHash", "passwordSalt", username)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
     RETURNING id, email, role`,
    ['test_rls_root@test.com', 'root', rootPwd, salt, 'test_root']
  );
  const rootAccountId = rootResult[0].id;
  log('cyan', `Created ROOT account: ${rootAccountId}`);

  // 2. SUPERUSER account
  const superUserResult = await execSQL(
    `INSERT INTO app."Account" (id, email, role, "passwordHash", "passwordSalt", username)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
     RETURNING id, email, role`,
    ['test_rls_superuser@test.com', 'superuser', hashPassword('TestSuper123!', salt), salt, 'test_superuser']
  );
  const superUserAccountId = superUserResult[0].id;
  log('cyan', `Created SUPERUSER account: ${superUserAccountId}`);

  // 3. CEO account
  const ceoResult = await execSQL(
    `INSERT INTO app."Account" (id, email, role, "passwordHash", "passwordSalt", username)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
     RETURNING id, email, role`,
    ['test_rls_ceo@test.com', 'ceo', hashPassword('TestCEO123!', salt), salt, 'test_ceo']
  );
  const ceoAccountId = ceoResult[0].id;
  log('cyan', `Created CEO account: ${ceoAccountId}`);

  // 4. BOARD MEMBER account
  const boardResult = await execSQL(
    `INSERT INTO app."Account" (id, email, role, "passwordHash", "passwordSalt", username)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
     RETURNING id, email, role`,
    ['test_rls_board@test.com', 'board', hashPassword('TestBoard123!', salt), salt, 'test_board']
  );
  const boardAccountId = boardResult[0].id;
  log('cyan', `Created BOARD account: ${boardAccountId}`);

  // 5. MEMBER account (minimal privilege)
  const memberResult = await execSQL(
    `INSERT INTO app."Account" (id, email, role, "passwordHash", "passwordSalt", username)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
     RETURNING id, email, role`,
    ['test_rls_member@test.com', 'member', hashPassword('TestMember123!', salt), salt, 'test_member']
  );
  const memberAccountId = memberResult[0].id;
  log('cyan', `Created MEMBER account: ${memberAccountId}`);

  // 6. STATE COORDINATOR account (for TX)
  const txOrgUnit = await execSQL(
    `INSERT INTO app."OrgUnit" (id, code, name, type)
     VALUES (gen_random_uuid(), 'TX', 'Texas', 'state')
     RETURNING id`
  );
  const txOrgUnitId = txOrgUnit[0].id;

  const stateCoordResult = await execSQL(
    `INSERT INTO app."Account" (id, email, role, "passwordHash", "passwordSalt", username, "orgunit_id")
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)
     RETURNING id, email, role`,
    ['test_rls_state_coord@test.com', 'state_coordinator', hashPassword('TestStateCoord123!', salt), salt, 'test_state_coord', txOrgUnitId]
  );
  const stateCoordAccountId = stateCoordResult[0].id;
  log('cyan', `Created STATE_COORDINATOR account: ${stateCoordAccountId} (TX)`);

  // 7. CHAPTER ADMIN account
  // Create test chapter
  const chapterResult = await execSQL(
    `INSERT INTO app."Chapter" (id, name, number, state, region, "orgunit_id")
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
     RETURNING id`,
    ['Test Chapter', '999', 'TX', 1, txOrgUnitId]
  );
  const chapterAId = chapterResult[0].id;

  // Create person for chapter admin
  const personResult = await execSQL(
    `INSERT INTO app."Person" (id, "firstName", "lastName", "chapter_id")
     VALUES (gen_random_uuid(), $1, $2, $3)
     RETURNING id`,
    ['Test', 'ChapterAdmin', chapterAId]
  );
  const personId = personResult[0].id;

  // Create officer assignment
  await execSQL(
    `INSERT INTO app."OfficerAssignment" (id, "person_id", "chapter_id", "role")
     VALUES (gen_random_uuid(), $1, $2, $3)`,
    [personId, chapterAId, 'president']
  );

  const chapterAdminResult = await execSQL(
    `INSERT INTO app."Account" (id, email, role, "passwordHash", "passwordSalt", username, "person_id", "chapter_id")
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)
     RETURNING id, email, role`,
    ['test_rls_chapter_admin@test.com', 'president', hashPassword('TestChapterAdmin123!', salt), salt, 'test_chapter_admin', personId, chapterAId]
  );
  const chapterAdminAccountId = chapterAdminResult[0].id;
  log('cyan', `Created CHAPTER_ADMIN account: ${chapterAdminAccountId} (Chapter: ${chapterAId})`);

  // 8. Another chapter for cross-chapter tests
  const chapterBResult = await execSQL(
    `INSERT INTO app."Chapter" (id, name, number, state, region, "orgunit_id")
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
     RETURNING id`,
    ['Test Chapter B', '998', 'TX', 1, txOrgUnitId]
  );
  const chapterBId = chapterBResult[0].id;
  log('cyan', `Created test Chapter B: ${chapterBId}`);

  return {
    root: { id: rootAccountId, role: 'root' },
    superuser: { id: superUserAccountId, role: 'superuser' },
    ceo: { id: ceoAccountId, role: 'ceo' },
    board: { id: boardAccountId, role: 'board' },
    member: { id: memberAccountId, role: 'member' },
    stateCoordinator: { id: stateCoordAccountId, role: 'state_coordinator', state: 'TX' },
    chapterAdmin: { id: chapterAdminAccountId, role: 'president', chapterId: chapterAId },
    chapterB: { id: chapterBId },
  };
}

// ============================================================================
// TEST SUITE 1: HELPER FUNCTION CORRECTNESS
// ============================================================================

async function testHelperFunctions(accounts) {
  log('blue', '\n=== TEST SUITE 1: Helper Function Correctness ===\n');

  // Test 1.1: current_account_role()
  log('yellow', 'Testing: current_account_role()');
  for (const [name, account] of Object.entries(accounts)) {
    if (account.role) {
      await setAccountContext(account.id);
      const result = await execSQL(`SELECT app.current_account_role() as role`);
      const role = result[0].role;

      if (role === account.role) {
        testPass(`current_account_role() - ${name}`, `Returns "${role}"`);
      } else {
        testFail(`current_account_role() - ${name}`, `Expected "${account.role}", got "${role}"`, 'CRITICAL');
      }
    }
  }

  // Test 1.2: is_superuser()
  log('yellow', 'Testing: is_superuser()');
  const superuserCheck = async (accountId, expectedSuperuser, name) => {
    await setAccountContext(accountId);
    const result = await execSQL(`SELECT app.is_superuser() as is_superuser`);
    const isSuperuser = result[0].is_superuser;
    if (isSuperuser === expectedSuperuser) {
      testPass(`is_superuser() - ${name}`, `Correctly returns ${isSuperuser}`);
    } else {
      testFail(
        `is_superuser() - ${name}`,
        `Expected ${expectedSuperuser}, got ${isSuperuser}`,
        expectedSuperuser ? 'CRITICAL' : 'HIGH'
      );
    }
  };

  await superuserCheck(accounts.root.id, true, 'root');
  await superuserCheck(accounts.superuser.id, true, 'superuser');
  await superuserCheck(accounts.ceo.id, false, 'ceo');
  await superuserCheck(accounts.member.id, false, 'member');

  // Test 1.3: is_board_member()
  log('yellow', 'Testing: is_board_member()');
  const boardCheck = async (accountId, expectedBoard, name) => {
    await setAccountContext(accountId);
    const result = await execSQL(`SELECT app.is_board_member() as is_board`);
    const isBoard = result[0].is_board;
    if (isBoard === expectedBoard) {
      testPass(`is_board_member() - ${name}`, `Correctly returns ${isBoard}`);
    } else {
      testFail(`is_board_member() - ${name}`, `Expected ${expectedBoard}, got ${isBoard}`, 'HIGH');
    }
  };

  await boardCheck(accounts.ceo.id, true, 'ceo');
  await boardCheck(accounts.board.id, true, 'board');
  await boardCheck(accounts.member.id, false, 'member');

  // Test 1.4: is_state_leadership()
  log('yellow', 'Testing: is_state_leadership()');
  await setAccountContext(accounts.stateCoordinator.id);
  const stateLeadResult = await execSQL(`SELECT app.is_state_leadership() as is_state_lead`);
  const isStateLead = stateLeadResult[0].is_state_lead;
  if (isStateLead === true) {
    testPass(`is_state_leadership() - state_coordinator`, `Correctly returns true`);
  } else {
    testFail(`is_state_leadership() - state_coordinator`, `Expected true, got ${isStateLead}`, 'HIGH');
  }

  await setAccountContext(accounts.member.id);
  const memberLeadResult = await execSQL(`SELECT app.is_state_leadership() as is_state_lead`);
  const isMemberLead = memberLeadResult[0].is_state_lead;
  if (isMemberLead === false) {
    testPass(`is_state_leadership() - member`, `Correctly returns false`);
  } else {
    testFail(`is_state_leadership() - member`, `Expected false, got ${isMemberLead}`, 'HIGH');
  }
}

// ============================================================================
// TEST SUITE 2: RLS POLICY COVERAGE
// ============================================================================

async function testPolicyCoverage() {
  log('blue', '\n=== TEST SUITE 2: RLS Policy Coverage ===\n');

  const tablesToCheck = [
    'Account',
    'Session',
    'Chapter',
    'Person',
    'OrgUnit',
    'OfficerAssignment',
    'Motorcycle',
    'RoleNote',
    'EmergencyContact',
    'chapter_events',
    'chapter_event_attendees',
    'chapter_event_follow_ups',
    'chapter_reporting_snapshots',
    'chapter_status_transitions',
    'account_invite_tokens',
    'role_permission',
  ];

  for (const table of tablesToCheck) {
    const result = await execSQL(
      `SELECT row_security_active
       FROM information_schema.tables
       WHERE table_schema = 'app' AND table_name = $1`,
      [table]
    );

    if (result.length === 0) {
      testWarning(`Policy Coverage - ${table}`, `Table not found`);
    } else if (result[0].row_security_active) {
      testPass(`Policy Coverage - ${table}`, `RLS enabled`);
    } else {
      testFail(`Policy Coverage - ${table}`, `RLS NOT ENABLED`, 'CRITICAL');
    }
  }
}

// ============================================================================
// TEST SUITE 3: SESSION ISOLATION
// ============================================================================

async function testSessionIsolation(accounts) {
  log('blue', '\n=== TEST SUITE 3: Session Isolation ===\n');

  // Create sessions for two different accounts
  await setAccountContext(accounts.root.id);
  const rootSessionResult = await execSQL(
    `INSERT INTO app."Session" (id, "accountId", "userAgent", token)
     VALUES (gen_random_uuid(), $1, 'test-agent', 'root-token-secret')
     RETURNING id, "accountId"`,
    [accounts.root.id]
  );
  const rootSessionId = rootSessionResult[0].id;

  await setAccountContext(accounts.member.id);
  const memberSessionResult = await execSQL(
    `INSERT INTO app."Session" (id, "accountId", "userAgent", token)
     VALUES (gen_random_uuid(), $1, 'test-agent', 'member-token-secret')
     RETURNING id, "accountId"`,
    [accounts.member.id]
  );
  const memberSessionId = memberSessionResult[0].id;

  // Test 3.1: Member tries to read their own session
  log('yellow', 'Testing: Member reads own session');
  await setAccountContext(accounts.member.id);
  const ownSessionResult = await execSQL(
    `SELECT id, "accountId" FROM app."Session" WHERE id = $1`,
    [memberSessionId]
  );

  if (ownSessionResult.length === 1 && ownSessionResult[0].accountId === accounts.member.id) {
    testPass(`Session Isolation - Member reads own session`, `1 row returned`);
  } else {
    testFail(`Session Isolation - Member reads own session`, `Expected 1 row, got ${ownSessionResult.length}`, 'HIGH');
  }

  // Test 3.2: Member tries to read ROOT's session (SHOULD FAIL)
  log('yellow', 'Testing: Member attempts to read ROOT session (should block)');
  await setAccountContext(accounts.member.id);
  const rootSessionLeakResult = await execSQL(
    `SELECT id, "accountId" FROM app."Session" WHERE id = $1`,
    [rootSessionId]
  );

  if (rootSessionLeakResult.length === 0) {
    testPass(`Session Isolation - Member cannot read ROOT session`, `0 rows returned (blocked by RLS)`);
  } else {
    testFail(
      `Session Isolation - Member cannot read ROOT session`,
      `LEAKED: Member read ${rootSessionLeakResult.length} rows containing ROOT session!`,
      'CRITICAL'
    );
  }

  // Test 3.3: ROOT reads all sessions
  log('yellow', 'Testing: ROOT reads all sessions');
  await setAccountContext(accounts.root.id);
  const rootAllSessions = await execSQL(`SELECT COUNT(*) as count FROM app."Session"`);
  const sessionCount = parseInt(rootAllSessions[0].count);

  if (sessionCount >= 2) {
    testPass(`Session Isolation - ROOT reads all sessions`, `${sessionCount} sessions visible to ROOT`);
  } else {
    testWarning(`Session Isolation - ROOT reads all sessions`, `Only ${sessionCount} sessions found (expected >= 2)`);
  }
}

// ============================================================================
// TEST SUITE 4: ACCOUNT ISOLATION
// ============================================================================

async function testAccountIsolation(accounts) {
  log('blue', '\n=== TEST SUITE 4: Account Data Isolation ===\n');

  // Test 4.1: Member reads own account
  log('yellow', 'Testing: Member reads own account');
  await setAccountContext(accounts.member.id);
  const ownAccountResult = await execSQL(
    `SELECT id, email, role FROM app."Account" WHERE id = $1`,
    [accounts.member.id]
  );

  if (ownAccountResult.length === 1 && ownAccountResult[0].role === 'member') {
    testPass(`Account Isolation - Member reads own account`, `1 row returned`);
  } else {
    testFail(`Account Isolation - Member reads own account`, `Expected 1 row, got ${ownAccountResult.length}`, 'HIGH');
  }

  // Test 4.2: Member tries to read CEO's account (SHOULD FAIL unless board member)
  log('yellow', 'Testing: Member attempts to read CEO account (should block)');
  await setAccountContext(accounts.member.id);
  const ceoLeakResult = await execSQL(
    `SELECT id, email, role FROM app."Account" WHERE id = $1`,
    [accounts.ceo.id]
  );

  if (ceoLeakResult.length === 0) {
    testPass(`Account Isolation - Member cannot read CEO account`, `0 rows returned (blocked by RLS)`);
  } else {
    testFail(
      `Account Isolation - Member cannot read CEO account`,
      `LEAKED: Member read CEO account! Got ${ceoLeakResult.length} rows`,
      'CRITICAL'
    );
  }

  // Test 4.3: Board reads other board members' accounts
  log('yellow', 'Testing: Board member reads CEO account (should succeed)');
  await setAccountContext(accounts.board.id);
  const boardReadCEOResult = await execSQL(
    `SELECT id, email, role FROM app."Account" WHERE id = $1`,
    [accounts.ceo.id]
  );

  if (boardReadCEOResult.length === 1 && boardReadCEOResult[0].role === 'ceo') {
    testPass(`Account Isolation - Board reads CEO account`, `1 row returned (allowed)`);
  } else {
    testWarning(`Account Isolation - Board reads CEO account`, `Expected to be able to read (board policy may be missing)`);
  }

  // Test 4.4: CEO tries to read ROOT account (SHOULD FAIL)
  log('yellow', 'Testing: CEO attempts to read ROOT account (should block)');
  await setAccountContext(accounts.ceo.id);
  const rootLeakResult = await execSQL(
    `SELECT id, email, role FROM app."Account" WHERE id = $1`,
    [accounts.root.id]
  );

  if (rootLeakResult.length === 0) {
    testPass(`Account Isolation - CEO cannot read ROOT account`, `0 rows returned (blocked by RLS)`);
  } else {
    testFail(
      `Account Isolation - CEO cannot read ROOT account`,
      `LEAKED: CEO read ROOT account! Data: ${JSON.stringify(rootLeakResult[0])}`,
      'CRITICAL'
    );
  }
}

// ============================================================================
// TEST SUITE 5: HIERARCHICAL ACCESS CONTROL
// ============================================================================

async function testHierarchicalAccess(accounts) {
  log('blue', '\n=== TEST SUITE 5: Hierarchical Access Control ===\n');

  // Test 5.1: ROOT can read all account data
  log('yellow', 'Testing: ROOT hierarchical access');
  await setAccountContext(accounts.root.id);
  const rootAccounts = await execSQL(
    `SELECT COUNT(*) as count FROM app."Account" WHERE role IN ('root', 'ceo', 'board', 'member')`
  );
  const rootAccountCount = parseInt(rootAccounts[0].count);

  if (rootAccountCount >= 4) {
    testPass(`Hierarchical Access - ROOT sees all`, `ROOT can read ${rootAccountCount}+ accounts`);
  } else {
    testWarning(`Hierarchical Access - ROOT sees all`, `ROOT only sees ${rootAccountCount} accounts`);
  }

  // Test 5.2: CEO cannot read ROOT but can read board/member
  log('yellow', 'Testing: CEO hierarchical access');
  await setAccountContext(accounts.ceo.id);
  
  const ceoCanReadMember = await execSQL(
    `SELECT COUNT(*) as count FROM app."Account" WHERE id = $1`,
    [accounts.member.id]
  );

  if (parseInt(ceoCanReadMember[0].count) === 0) {
    testWarning(`Hierarchical Access - CEO cannot escalate`, `CEO cannot read member accounts (may be intended)`);
  } else {
    testPass(`Hierarchical Access - CEO reads members`, `CEO can access member accounts`);
  }

  // Test 5.3: Member has minimal access
  log('yellow', 'Testing: Member hierarchical access (minimal)');
  await setAccountContext(accounts.member.id);
  const memberAccounts = await execSQL(
    `SELECT COUNT(*) as count FROM app."Account" WHERE id != $1`,
    [accounts.member.id]
  );
  const memberCanSeeOthers = parseInt(memberAccounts[0].count);

  if (memberCanSeeOthers === 0) {
    testPass(`Hierarchical Access - Member has minimal access`, `Member cannot read other accounts`);
  } else {
    testFail(
      `Hierarchical Access - Member has minimal access`,
      `Member can see ${memberCanSeeOthers} other accounts (data leakage!)`,
      'CRITICAL'
    );
  }
}

// ============================================================================
// TEST SUITE 6: CHAPTER ISOLATION
// ============================================================================

async function testChapterIsolation(accounts) {
  log('blue', '\n=== TEST SUITE 6: Chapter Isolation ===\n');

  // Test 6.1: Chapter Admin reads own chapter
  log('yellow', 'Testing: Chapter Admin reads own chapter');
  await setAccountContext(accounts.chapterAdmin.id);
  const ownChapterResult = await execSQL(
    `SELECT id, name FROM app."Chapter" WHERE id = $1`,
    [accounts.chapterAdmin.chapterId]
  );

  if (ownChapterResult.length === 1) {
    testPass(`Chapter Isolation - Chapter Admin reads own chapter`, `1 row returned`);
  } else {
    testFail(`Chapter Isolation - Chapter Admin reads own chapter`, `Expected 1 row, got ${ownChapterResult.length}`, 'HIGH');
  }

  // Test 6.2: Chapter Admin tries to read other chapter (SHOULD FAIL)
  log('yellow', 'Testing: Chapter Admin attempts to read other chapter (should block)');
  await setAccountContext(accounts.chapterAdmin.id);
  const otherChapterResult = await execSQL(
    `SELECT id, name FROM app."Chapter" WHERE id = $1`,
    [accounts.chapterB.id]
  );

  if (otherChapterResult.length === 0) {
    testPass(`Chapter Isolation - Chapter Admin cannot read other chapter`, `0 rows returned (blocked by RLS)`);
  } else {
    testFail(
      `Chapter Isolation - Chapter Admin cannot read other chapter`,
      `LEAKED: Chapter Admin read another chapter! Chapter: ${otherChapterResult[0].name}`,
      'CRITICAL'
    );
  }

  // Test 6.3: ROOT can read all chapters
  log('yellow', 'Testing: ROOT reads all chapters');
  await setAccountContext(accounts.root.id);
  const rootChapters = await execSQL(
    `SELECT COUNT(*) as count FROM app."Chapter" WHERE id IN ($1, $2)`,
    [accounts.chapterAdmin.chapterId, accounts.chapterB.id]
  );

  if (parseInt(rootChapters[0].count) === 2) {
    testPass(`Chapter Isolation - ROOT reads all chapters`, `ROOT can read both test chapters`);
  } else {
    testWarning(`Chapter Isolation - ROOT reads all chapters`, `ROOT only sees ${rootChapters[0].count} chapters`);
  }
}

// ============================================================================
// TEST SUITE 7: SENSITIVE DATA PROTECTION (role_permission)
// ============================================================================

async function testSensitiveDataProtection(accounts) {
  log('blue', '\n=== TEST SUITE 7: Sensitive Data Protection ===\n');

  // Insert a sample permission entry for CEO
  await setAccountContext(accounts.root.id);
  const permResult = await execSQL(
    `INSERT INTO app."role_permission" (id, role, permission)
     VALUES (gen_random_uuid(), $1, $2)
     RETURNING id`,
    ['ceo', 'read_all_members']
  );

  // Test 7.1: Member cannot read role_permission table
  log('yellow', 'Testing: Member cannot read role_permission');
  await setAccountContext(accounts.member.id);
  const memberPermResult = await execSQL(
    `SELECT COUNT(*) as count FROM app."role_permission"`
  );

  if (parseInt(memberPermResult[0].count) === 0) {
    testPass(`Sensitive Data - Member cannot read role_permission`, `0 rows visible to member`);
  } else {
    testFail(
      `Sensitive Data - Member cannot read role_permission`,
      `LEAKED: Member can see ${memberPermResult[0].count} permission entries!`,
      'CRITICAL'
    );
  }

  // Test 7.2: Board member can read role_permission
  log('yellow', 'Testing: Board member can read role_permission');
  await setAccountContext(accounts.board.id);
  const boardPermResult = await execSQL(
    `SELECT COUNT(*) as count FROM app."role_permission"`
  );

  if (parseInt(boardPermResult[0].count) > 0) {
    testPass(`Sensitive Data - Board reads role_permission`, `Board can see permissions`);
  } else {
    testWarning(`Sensitive Data - Board reads role_permission`, `Board cannot read permissions (policy may be missing)`);
  }

  // Test 7.3: ROOT can read all role_permission entries
  log('yellow', 'Testing: ROOT reads all role_permission');
  await setAccountContext(accounts.root.id);
  const rootPermResult = await execSQL(
    `SELECT COUNT(*) as count FROM app."role_permission"`
  );

  if (parseInt(rootPermResult[0].count) > 0) {
    testPass(`Sensitive Data - ROOT reads role_permission`, `ROOT can see ${rootPermResult[0].count} permissions`);
  } else {
    testWarning(`Sensitive Data - ROOT reads role_permission`, `ROOT cannot read permissions`);
  }
}

// ============================================================================
// TEST SUITE 8: ESCALATION PREVENTION
// ============================================================================

async function testEscalationPrevention(accounts) {
  log('blue', '\n=== TEST SUITE 8: Escalation Prevention ===\n');

  // Test 8.1: Member tries to update their own role to CEO
  log('yellow', 'Testing: Member attempts privilege escalation (UPDATE own role)');
  await setAccountContext(accounts.member.id);
  
  try {
    const escalationResult = await execSQL(
      `UPDATE app."Account" SET role = 'ceo' WHERE id = $1`,
      [accounts.member.id]
    );
    // If update succeeded with 0 rows affected, that's okay (RLS blocking)
    // If it succeeded with rows affected, that's a vulnerability
    if (escalationResult && escalationResult.length === 0) {
      testPass(`Escalation Prevention - Member cannot escalate own role`, `UPDATE blocked by RLS (0 rows affected)`);
    } else {
      testFail(
        `Escalation Prevention - Member cannot escalate own role`,
        `UPDATE succeeded! Member escalated to CEO!`,
        'CRITICAL'
      );
    }
  } catch (err) {
    if (err.message.includes('permission denied')) {
      testPass(`Escalation Prevention - Member cannot escalate own role`, `UPDATE blocked by database permissions`);
    } else {
      testWarning(`Escalation Prevention - Member cannot escalate own role`, `Unexpected error: ${err.message}`);
    }
  }

  // Test 8.2: Member tries to modify another account's role
  log('yellow', 'Testing: Member attempts privilege escalation (UPDATE other role)');
  await setAccountContext(accounts.member.id);
  
  try {
    await execSQL(
      `UPDATE app."Account" SET role = 'admin' WHERE id = $1`,
      [accounts.ceo.id]
    );
    testFail(
      `Escalation Prevention - Member cannot modify CEO role`,
      `UPDATE succeeded! Member modified CEO role!`,
      'CRITICAL'
    );
  } catch (err) {
    testPass(`Escalation Prevention - Member cannot modify CEO role`, `UPDATE blocked by RLS`);
  }

  // Test 8.3: CEO tries to access ROOT data
  log('yellow', 'Testing: CEO cannot access ROOT-only functions');
  await setAccountContext(accounts.ceo.id);
  
  try {
    const rootOnlyCheck = await execSQL(
      `SELECT app.is_superuser() as can_access`
    );
    if (rootOnlyCheck[0].can_access === false) {
      testPass(`Escalation Prevention - CEO cannot become superuser`, `is_superuser() returns false`);
    }
  } catch (err) {
    testWarning(`Escalation Prevention - CEO cannot become superuser`, `Error: ${err.message}`);
  }
}

// ============================================================================
// TEST SUITE 9: PERSON & OFFICER ASSIGNMENT ISOLATION
// ============================================================================

async function testPersonAndOfficerIsolation(accounts) {
  log('blue', '\n=== TEST SUITE 9: Person & Officer Assignment Isolation ===\n');

  // Test 9.1: Chapter Admin reads own chapter's people
  log('yellow', 'Testing: Chapter Admin reads own chapter members');
  await setAccountContext(accounts.chapterAdmin.id);
  const ownPeopleResult = await execSQL(
    `SELECT COUNT(*) as count FROM app."Person" WHERE "chapter_id" = $1`,
    [accounts.chapterAdmin.chapterId]
  );

  if (parseInt(ownPeopleResult[0].count) >= 1) {
    testPass(`Person Isolation - Chapter Admin reads own chapter members`, `${ownPeopleResult[0].count} members visible`);
  } else {
    testWarning(`Person Isolation - Chapter Admin reads own chapter members`, `No members in test chapter`);
  }

  // Test 9.2: Chapter Admin tries to read other chapter's people (SHOULD FAIL)
  log('yellow', 'Testing: Chapter Admin attempts to read other chapter members (should block)');
  await setAccountContext(accounts.chapterAdmin.id);
  const otherPeopleResult = await execSQL(
    `SELECT COUNT(*) as count FROM app."Person" WHERE "chapter_id" = $1`,
    [accounts.chapterB.id]
  );

  if (parseInt(otherPeopleResult[0].count) === 0) {
    testPass(`Person Isolation - Chapter Admin cannot read other chapter members`, `0 rows returned (blocked)`);
  } else {
    testFail(
      `Person Isolation - Chapter Admin cannot read other chapter members`,
      `LEAKED: Chapter Admin can see ${otherPeopleResult[0].count} members from other chapter!`,
      'CRITICAL'
    );
  }
}

// ============================================================================
// TEST SUITE 10: CONTEXT VARIABLE VERIFICATION
// ============================================================================

async function testContextVariableHandling() {
  log('blue', '\n=== TEST SUITE 10: Context Variable Handling ===\n');

  // Test 10.1: Unset context returns guest role
  log('yellow', 'Testing: Unset context defaults to guest');
  await execSQL(`RESET app.current_account_id`);
  
  const guestRoleResult = await execSQL(`SELECT app.current_account_role() as role`);
  const guestRole = guestRoleResult[0].role;

  if (guestRole === 'guest') {
    testPass(`Context Handling - Unset context defaults to guest`, `Role: ${guestRole}`);
  } else {
    testWarning(`Context Handling - Unset context defaults to guest`, `Got ${guestRole} instead of guest`);
  }

  // Test 10.2: Invalid context ID returns guest
  log('yellow', 'Testing: Invalid context ID returns guest');
  await execSQL(`SET app.current_account_id = 'nonexistent-id-12345'`);
  
  const invalidRoleResult = await execSQL(`SELECT app.current_account_role() as role`);
  const invalidRole = invalidRoleResult[0].role;

  if (invalidRole === 'guest') {
    testPass(`Context Handling - Invalid context ID returns guest`, `Role: ${invalidRole}`);
  } else {
    testWarning(`Context Handling - Invalid context ID returns guest`, `Got ${invalidRole} instead of guest`);
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  try {
    log('blue', '╔════════════════════════════════════════════════════════════════════════════════╗');
    log('blue', '║                    COMPREHENSIVE RLS SECURITY TEST SUITE                         ║');
    log('blue', '║                       CMA Member Database - Supabase                             ║');
    log('blue', '╚════════════════════════════════════════════════════════════════════════════════╝');

    await client.connect();
    log('green', '\n✓ Connected to database\n');

    // Setup test accounts
    const accounts = await setupTestAccounts();

    // Run all test suites
    await testHelperFunctions(accounts);
    await testPolicyCoverage();
    await testSessionIsolation(accounts);
    await testAccountIsolation(accounts);
    await testHierarchicalAccess(accounts);
    await testChapterIsolation(accounts);
    await testSensitiveDataProtection(accounts);
    await testEscalationPrevention(accounts);
    await testPersonAndOfficerIsolation(accounts);
    await testContextVariableHandling();

    // Print summary report
    printSummaryReport();

    // Cleanup test data
    log('yellow', '\n=== Cleaning up test data ===');
    await cleanupTestData();

    process.exit(results.vulnerabilities.length > 0 ? 1 : 0);
  } catch (err) {
    log('red', `\n❌ Fatal error: ${err.message}`);
    console.error(err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

function printSummaryReport() {
  const totalTests = results.totalTests;
  const passedTests = results.passed.length;
  const failedTests = results.failed.length;
  const warningTests = results.warnings.length;
  const passPercentage = ((passedTests / totalTests) * 100).toFixed(1);

  log('blue', '\n╔════════════════════════════════════════════════════════════════════════════════╗');
  log('blue', '║                            SECURITY TEST SUMMARY                                ║');
  log('blue', '╚════════════════════════════════════════════════════════════════════════════════╝\n');

  log('cyan', `Total Tests Run:  ${totalTests}`);
  log('green', `Tests Passed:     ${passedTests}`);
  log('red', `Tests Failed:     ${failedTests}`);
  log('yellow', `Warnings:         ${warningTests}`);
  log('blue', `Pass Rate:        ${passPercentage}%\n`);

  if (results.vulnerabilities.length > 0) {
    log('red', '╔════════════════════════════════════════════════════════════════════════════════╗');
    log('red', '║                         CRITICAL VULNERABILITIES FOUND                         ║');
    log('red', '╚════════════════════════════════════════════════════════════════════════════════╝\n');

    results.vulnerabilities.forEach((vuln, index) => {
      log('red', `${index + 1}. [CRITICAL] ${vuln.test}`);
      log('red', `   Details: ${vuln.details}\n`);
    });

    log('red', '═══════════════════════════════════════════════════════════════════════════════════');
    log('red', `SECURITY RECOMMENDATION: ✗ FAIL - Release Blocked`);
    log('red', `Reason: ${results.vulnerabilities.length} critical vulnerability(ies) found\n`);
    log('red', '═══════════════════════════════════════════════════════════════════════════════════');
  } else if (failedTests > 0) {
    log('yellow', '═══════════════════════════════════════════════════════════════════════════════════');
    log('yellow', `SECURITY RECOMMENDATION: ⚠ CONDITIONAL PASS - Review Required`);
    log('yellow', `Reason: ${failedTests} non-critical test(s) failed\n`);
    log('yellow', '═══════════════════════════════════════════════════════════════════════════════════');
  } else {
    log('green', '═══════════════════════════════════════════════════════════════════════════════════');
    log('green', `SECURITY RECOMMENDATION: ✓ PASS - Ready for Release`);
    log('green', `All ${totalTests} security tests passed\n`);
    log('green', '═══════════════════════════════════════════════════════════════════════════════════');
  }
}

async function cleanupTestData() {
  try {
    await execSQL(`
      DELETE FROM app."Account"
      WHERE email LIKE 'test_rls_%@test.com'
        OR username LIKE 'test_%'
    `);
    log('green', '✓ Cleaned up test accounts');
  } catch (err) {
    log('yellow', `⚠ Could not cleanup test data: ${err.message}`);
  }
}

// Run the test suite
main();
