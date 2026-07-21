-- Enable RLS on all tables exposed via PostgREST
-- This migration addresses Supabase security linter findings

-- ============================================================================
-- HELPER FUNCTIONS FOR RLS
-- ============================================================================

-- Get current account ID from JWT claims
-- The app must set 'account_id' in JWT claims during authentication
-- SECURITY: Validates account exists and is not disabled
CREATE OR REPLACE FUNCTION app.current_account_id() RETURNS text AS $$
  DECLARE
    v_account_id text;
  BEGIN
    v_account_id := current_setting('app.current_account_id', true)::text;
    
    -- Validate the account exists and is active
    IF v_account_id IS NOT NULL THEN
      IF NOT EXISTS(
        SELECT 1 FROM app."Account" 
        WHERE id = v_account_id AND "isDisabled" = false
      ) THEN
        RAISE EXCEPTION 'Invalid or disabled account context';
      END IF;
    END IF;
    
    RETURN v_account_id;
  END;
$$ LANGUAGE PLPGSQL STABLE;

-- Get current account's role
CREATE OR REPLACE FUNCTION app.current_account_role() RETURNS text AS $$
  SELECT COALESCE(
    (SELECT role FROM app."Account" WHERE id = app.current_account_id()),
    'guest'
  )::text;
$$ LANGUAGE SQL STABLE;

-- Check if current account is a superuser/root
CREATE OR REPLACE FUNCTION app.is_superuser() RETURNS boolean AS $$
  SELECT app.current_account_role() IN ('root', 'superuser');
$$ LANGUAGE SQL STABLE;

-- Check if current account is an active chapter admin (president role)
-- SECURITY: Explicitly checks for president role, not just any officer
CREATE OR REPLACE FUNCTION app.is_chapter_admin(p_chapter_id text) RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM app."OfficerAssignment" oa
    JOIN app."Person" p ON oa."person_id" = p.id
    JOIN app."Account" a ON p.id = a."person_id"
    WHERE a.id = app.current_account_id()
      AND oa."chapter_id" = p_chapter_id
      AND oa."role" = 'president'
      AND (oa."endDate" IS NULL OR oa."endDate" > now())
  );
$$ LANGUAGE SQL STABLE;

-- Check if current account is the same account
CREATE OR REPLACE FUNCTION app.is_own_account(account_id text) RETURNS boolean AS $$
  SELECT account_id = app.current_account_id();
$$ LANGUAGE SQL STABLE;

-- Check if current account is a National Evangelist for a specific region
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

-- Check if current account is a Board member or CEO
CREATE OR REPLACE FUNCTION app.is_board_member() RETURNS boolean AS $$
  SELECT app.current_account_role() IN ('ceo', 'board', 'board_advisor');
$$ LANGUAGE SQL STABLE;

-- Check if current account is the CEO
CREATE OR REPLACE FUNCTION app.is_ceo() RETURNS boolean AS $$
  SELECT app.current_account_role() = 'ceo';
$$ LANGUAGE SQL STABLE;

-- Check if current account is a State Coordinator for a specific state
CREATE OR REPLACE FUNCTION app.is_state_coordinator(p_state_code text) RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM app."OrgUnit" ou
    JOIN app."Account" a ON ou.id = a."orgunit_id"
    WHERE a.id = app.current_account_id()
      AND a.role = 'state_coordinator'
      AND UPPER(ou.code) = UPPER(p_state_code)
  );
$$ LANGUAGE SQL STABLE;

-- Check if current account is an Area Rep for a specific state
CREATE OR REPLACE FUNCTION app.is_area_rep(p_state_code text) RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM app."OrgUnit" ou
    JOIN app."Account" a ON ou.id = a."orgunit_id"
    WHERE a.id = app.current_account_id()
      AND a.role IN ('area_rep', 'area_rep_youth', 'area_rep_fast_lane')
      AND UPPER(ou.code) = UPPER(p_state_code)
  );
$$ LANGUAGE SQL STABLE;

-- Check if current account is a state-level leader (coordinator or area rep)
CREATE OR REPLACE FUNCTION app.is_state_leader(p_state_code text) RETURNS boolean AS $$
  SELECT app.is_state_coordinator(p_state_code) OR app.is_area_rep(p_state_code);
$$ LANGUAGE SQL STABLE;

-- Check if current account holds any state-level leadership position
CREATE OR REPLACE FUNCTION app.is_state_leadership() RETURNS boolean AS $$
  SELECT app.current_account_role() IN (
    'state_coordinator',
    'area_rep',
    'area_rep_youth',
    'area_rep_fast_lane',
    'state_treasurer',
    'state_kids_leader',
    'state_prayer_leader',
    'state_rfs_lead',
    'state_webmaster',
    'goodie_rep'
  );
$$ LANGUAGE SQL STABLE;

-- Check if current account is an active chapter officer
CREATE OR REPLACE FUNCTION app.is_chapter_officer(p_chapter_id text) RETURNS boolean AS $$
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

-- Check if current account is a chapter treasurer
-- SECURITY: Explicitly checks for treasurer role
CREATE OR REPLACE FUNCTION app.is_chapter_treasurer(p_chapter_id text) RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM app."OfficerAssignment" oa
    JOIN app."Person" p ON oa."person_id" = p.id
    JOIN app."Account" a ON p.id = a."person_id"
    WHERE a.id = app.current_account_id()
      AND oa."chapter_id" = p_chapter_id
      AND oa."role" = 'treasurer'
      AND (oa."endDate" IS NULL OR oa."endDate" > now())
  );
$$ LANGUAGE SQL STABLE;

-- Check if current account is a chapter chaplain
-- SECURITY: Explicitly checks for chaplain role
CREATE OR REPLACE FUNCTION app.is_chapter_chaplain(p_chapter_id text) RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM app."OfficerAssignment" oa
    JOIN app."Person" p ON oa."person_id" = p.id
    JOIN app."Account" a ON p.id = a."person_id"
    WHERE a.id = app.current_account_id()
      AND oa."chapter_id" = p_chapter_id
      AND oa."role" = 'chaplain'
      AND (oa."endDate" IS NULL OR oa."endDate" > now())
  );
$$ LANGUAGE SQL STABLE;

-- ============================================================================
-- ACCOUNT TABLE - RLS
-- ============================================================================

ALTER TABLE app."Account" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS account_superuser_all ON app."Account";
CREATE POLICY account_superuser_all
  ON app."Account"
  FOR ALL
  USING (app.is_superuser());

DROP POLICY IF EXISTS account_own_account ON app."Account";
CREATE POLICY account_own_account
  ON app."Account"
  FOR SELECT
  USING (app.is_own_account(id));

DROP POLICY IF EXISTS account_board_access ON app."Account";
CREATE POLICY account_board_access
  ON app."Account"
  FOR SELECT
  USING (app.is_board_member());

-- ============================================================================
-- SESSION TABLE - RLS (Sensitive: contains token)
-- ============================================================================

ALTER TABLE app."Session" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS session_superuser_all ON app."Session";
CREATE POLICY session_superuser_all
  ON app."Session"
  FOR ALL
  USING (app.is_superuser());

DROP POLICY IF EXISTS session_own_session ON app."Session";
CREATE POLICY session_own_session
  ON app."Session"
  FOR SELECT
  USING (app.is_own_account("accountId"));

-- ============================================================================
-- CHAPTER TABLE - RLS
-- ============================================================================

ALTER TABLE app."Chapter" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chapter_superuser_all ON app."Chapter";
CREATE POLICY chapter_superuser_all
  ON app."Chapter"
  FOR ALL
  USING (app.is_superuser());

DROP POLICY IF EXISTS chapter_admin_access ON app."Chapter";
CREATE POLICY chapter_admin_access
  ON app."Chapter"
  FOR SELECT
  USING (app.is_chapter_admin("id"));

DROP POLICY IF EXISTS chapter_board_access ON app."Chapter";
CREATE POLICY chapter_board_access
  ON app."Chapter"
  FOR SELECT
  USING (app.is_board_member());

DROP POLICY IF EXISTS chapter_evangelist_access ON app."Chapter";
CREATE POLICY chapter_evangelist_access
  ON app."Chapter"
  FOR SELECT
  USING (
    "region" IS NOT NULL
    AND app.is_national_evangelist("region")
  );

DROP POLICY IF EXISTS chapter_state_leader_access ON app."Chapter";
CREATE POLICY chapter_state_leader_access
  ON app."Chapter"
  FOR SELECT
  USING (
    "state" IS NOT NULL
    AND app.is_state_leader("state")
  );

DROP POLICY IF EXISTS chapter_officer_access ON app."Chapter";
CREATE POLICY chapter_officer_access
  ON app."Chapter"
  FOR SELECT
  USING (app.is_chapter_officer("id"));

-- ============================================================================
-- PERSON TABLE - RLS
-- ============================================================================

ALTER TABLE app."Person" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS person_superuser_all ON app."Person";
CREATE POLICY person_superuser_all
  ON app."Person"
  FOR ALL
  USING (app.is_superuser());

DROP POLICY IF EXISTS person_chapter_admin_access ON app."Person";
CREATE POLICY person_chapter_admin_access
  ON app."Person"
  FOR SELECT
  USING (
    "chapter_id" IS NOT NULL
    AND app.is_chapter_admin(CAST("chapter_id" AS text))
  );

DROP POLICY IF EXISTS person_own_record ON app."Person";
CREATE POLICY person_own_record
  ON app."Person"
  FOR SELECT
  USING (
    id IN (
      SELECT "person_id" FROM app."Account" WHERE id = app.current_account_id()
    )
  );

DROP POLICY IF EXISTS person_board_access ON app."Person";
CREATE POLICY person_board_access
  ON app."Person"
  FOR SELECT
  USING (app.is_board_member());

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

DROP POLICY IF EXISTS person_state_leader_access ON app."Person";
CREATE POLICY person_state_leader_access
  ON app."Person"
  FOR SELECT
  USING (
    (
      SELECT COUNT(*) > 0 FROM app."Chapter" c
      WHERE c.id = "chapter_id"
        AND c."state" IS NOT NULL
        AND app.is_state_leader(c."state")
    )
  );

DROP POLICY IF EXISTS person_chapter_officer_access ON app."Person";
CREATE POLICY person_chapter_officer_access
  ON app."Person"
  FOR SELECT
  USING (
    "chapter_id" IS NOT NULL
    AND app.is_chapter_officer(CAST("chapter_id" AS text))
  );

-- ============================================================================
-- ACCOUNT TABLE - RLS (Linked to Person/Chapter)
-- ============================================================================

ALTER TABLE app."Account" ENABLE ROW LEVEL SECURITY;

-- Already done above, but ensuring coverage for related data

-- ============================================================================
-- ORGUNIT TABLE - RLS
-- ============================================================================

ALTER TABLE app."OrgUnit" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS orgunit_superuser_all ON app."OrgUnit";
CREATE POLICY orgunit_superuser_all
  ON app."OrgUnit"
  FOR ALL
  USING (app.is_superuser());

DROP POLICY IF EXISTS orgunit_account_associated ON app."OrgUnit";
CREATE POLICY orgunit_account_associated
  ON app."OrgUnit"
  FOR SELECT
  USING (
    id IN (
      SELECT "orgunit_id" FROM app."Account" WHERE id = app.current_account_id()
    )
  );

-- ============================================================================
-- OFFICERASSIGNMENT TABLE - RLS
-- ============================================================================

ALTER TABLE app."OfficerAssignment" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS officerassignment_superuser_all ON app."OfficerAssignment";
CREATE POLICY officerassignment_superuser_all
  ON app."OfficerAssignment"
  FOR ALL
  USING (app.is_superuser());

DROP POLICY IF EXISTS officerassignment_chapter_admin ON app."OfficerAssignment";
CREATE POLICY officerassignment_chapter_admin
  ON app."OfficerAssignment"
  FOR SELECT
  USING (
    "chapter_id" IS NOT NULL
    AND app.is_chapter_admin(CAST("chapter_id" AS text))
  );

DROP POLICY IF EXISTS officerassignment_own_assignment ON app."OfficerAssignment";
CREATE POLICY officerassignment_own_assignment
  ON app."OfficerAssignment"
  FOR SELECT
  USING (
    "person_id" IN (
      SELECT "person_id" FROM app."Account" WHERE id = app.current_account_id()
    )
  );

DROP POLICY IF EXISTS officerassignment_chapter_officer_access ON app."OfficerAssignment";
CREATE POLICY officerassignment_chapter_officer_access
  ON app."OfficerAssignment"
  FOR SELECT
  USING (
    "chapter_id" IS NOT NULL
    AND app.is_chapter_officer(CAST("chapter_id" AS text))
  );

-- ============================================================================
-- MOTORCYCLE TABLE - RLS
-- ============================================================================

ALTER TABLE app."Motorcycle" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS motorcycle_superuser_all ON app."Motorcycle";
CREATE POLICY motorcycle_superuser_all
  ON app."Motorcycle"
  FOR ALL
  USING (app.is_superuser());

DROP POLICY IF EXISTS motorcycle_owner_access ON app."Motorcycle";
CREATE POLICY motorcycle_owner_access
  ON app."Motorcycle"
  FOR SELECT
  USING (
    "owner_id" IN (
      SELECT "person_id" FROM app."Account" WHERE id = app.current_account_id()
    )
  );

DROP POLICY IF EXISTS motorcycle_chapter_admin_access ON app."Motorcycle";
CREATE POLICY motorcycle_chapter_admin_access
  ON app."Motorcycle"
  FOR SELECT
  USING (
    "owner_id" IN (
      SELECT p.id FROM app."Person" p
      WHERE p."chapter_id" IS NOT NULL
        AND app.is_chapter_admin(CAST(p."chapter_id" AS text))
    )
  );

DROP POLICY IF EXISTS motorcycle_chapter_officer_access ON app."Motorcycle";
CREATE POLICY motorcycle_chapter_officer_access
  ON app."Motorcycle"
  FOR SELECT
  USING (
    "owner_id" IN (
      SELECT p.id FROM app."Person" p
      WHERE p."chapter_id" IS NOT NULL
        AND app.is_chapter_officer(CAST(p."chapter_id" AS text))
    )
  );

-- ============================================================================
-- ROLENOTE TABLE - RLS
-- ============================================================================

ALTER TABLE app."RoleNote" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rolenote_superuser_all ON app."RoleNote";
CREATE POLICY rolenote_superuser_all
  ON app."RoleNote"
  FOR ALL
  USING (app.is_superuser());

DROP POLICY IF EXISTS rolenote_chapter_admin ON app."RoleNote";
CREATE POLICY rolenote_chapter_admin
  ON app."RoleNote"
  FOR SELECT
  USING (
    "chapter_id" IS NOT NULL
    AND app.is_chapter_admin(CAST("chapter_id" AS text))
  );

DROP POLICY IF EXISTS rolenote_chapter_officer ON app."RoleNote";
CREATE POLICY rolenote_chapter_officer
  ON app."RoleNote"
  FOR SELECT
  USING (
    "chapter_id" IS NOT NULL
    AND app.is_chapter_officer(CAST("chapter_id" AS text))
  );

-- ============================================================================
-- EMERGENCYCONTACT TABLE - RLS
-- ============================================================================

ALTER TABLE app."EmergencyContact" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS emergencycontact_superuser_all ON app."EmergencyContact";
CREATE POLICY emergencycontact_superuser_all
  ON app."EmergencyContact"
  FOR ALL
  USING (app.is_superuser());

DROP POLICY IF EXISTS emergencycontact_chapter_admin ON app."EmergencyContact";
CREATE POLICY emergencycontact_chapter_admin
  ON app."EmergencyContact"
  FOR SELECT
  USING (
    "person_id" IN (
      SELECT p.id FROM app."Person" p
      WHERE p."chapter_id" IS NOT NULL
        AND app.is_chapter_admin(CAST(p."chapter_id" AS text))
    )
  );

DROP POLICY IF EXISTS emergencycontact_own_record ON app."EmergencyContact";
CREATE POLICY emergencycontact_own_record
  ON app."EmergencyContact"
  FOR SELECT
  USING (
    "person_id" IN (
      SELECT "person_id" FROM app."Account" WHERE id = app.current_account_id()
    )
  );

DROP POLICY IF EXISTS emergencycontact_chapter_officer_access ON app."EmergencyContact";
CREATE POLICY emergencycontact_chapter_officer_access
  ON app."EmergencyContact"
  FOR SELECT
  USING (
    "person_id" IN (
      SELECT p.id FROM app."Person" p
      WHERE p."chapter_id" IS NOT NULL
        AND app.is_chapter_officer(CAST(p."chapter_id" AS text))
    )
  );

-- ============================================================================
-- CHAPTEREVENT TABLE - RLS
-- ============================================================================

ALTER TABLE app."chapter_events" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chapterevent_superuser_all ON app."chapter_events";
CREATE POLICY chapterevent_superuser_all
  ON app."chapter_events"
  FOR ALL
  USING (app.is_superuser());

DROP POLICY IF EXISTS chapterevent_chapter_admin ON app."chapter_events";
CREATE POLICY chapterevent_chapter_admin
  ON app."chapter_events"
  FOR SELECT
  USING (app.is_chapter_admin(CAST("chapter_id" AS text)));

DROP POLICY IF EXISTS chapterevent_chapter_officer ON app."chapter_events";
CREATE POLICY chapterevent_chapter_officer
  ON app."chapter_events"
  FOR SELECT
  USING (app.is_chapter_officer(CAST("chapter_id" AS text)));

-- ============================================================================
-- CHAPTEREVENTATTENDEE TABLE - RLS
-- ============================================================================

ALTER TABLE app."chapter_event_attendees" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chaptereventattendee_superuser_all ON app."chapter_event_attendees";
CREATE POLICY chaptereventattendee_superuser_all
  ON app."chapter_event_attendees"
  FOR ALL
  USING (app.is_superuser());

DROP POLICY IF EXISTS chaptereventattendee_chapter_admin ON app."chapter_event_attendees";
CREATE POLICY chaptereventattendee_chapter_admin
  ON app."chapter_event_attendees"
  FOR SELECT
  USING (
    "event_id" IN (
      SELECT id FROM app."chapter_events"
      WHERE app.is_chapter_admin(CAST("chapter_id" AS text))
    )
  );

DROP POLICY IF EXISTS chaptereventattendee_chapter_officer ON app."chapter_event_attendees";
CREATE POLICY chaptereventattendee_chapter_officer
  ON app."chapter_event_attendees"
  FOR SELECT
  USING (
    "event_id" IN (
      SELECT id FROM app."chapter_events"
      WHERE app.is_chapter_officer(CAST("chapter_id" AS text))
    )
  );

-- ============================================================================
-- CHAPTEREVENTFOLLOWUP TABLE - RLS
-- ============================================================================

ALTER TABLE app."chapter_event_follow_ups" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chaptereventfollowup_superuser_all ON app."chapter_event_follow_ups";
CREATE POLICY chaptereventfollowup_superuser_all
  ON app."chapter_event_follow_ups"
  FOR ALL
  USING (app.is_superuser());

DROP POLICY IF EXISTS chaptereventfollowup_chapter_admin ON app."chapter_event_follow_ups";
CREATE POLICY chaptereventfollowup_chapter_admin
  ON app."chapter_event_follow_ups"
  FOR SELECT
  USING (
    "event_id" IN (
      SELECT id FROM app."chapter_events"
      WHERE app.is_chapter_admin(CAST("chapter_id" AS text))
    )
  );

DROP POLICY IF EXISTS chaptereventfollowup_chapter_officer ON app."chapter_event_follow_ups";
CREATE POLICY chaptereventfollowup_chapter_officer
  ON app."chapter_event_follow_ups"
  FOR SELECT
  USING (
    "event_id" IN (
      SELECT id FROM app."chapter_events"
      WHERE app.is_chapter_officer(CAST("chapter_id" AS text))
    )
  );

-- ============================================================================
-- CHAPTERREPORTINGSNAPSHOT TABLE - RLS
-- ============================================================================

ALTER TABLE app."chapter_reporting_snapshots" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chapterreportingsnapshot_superuser_all ON app."chapter_reporting_snapshots";
CREATE POLICY chapterreportingsnapshot_superuser_all
  ON app."chapter_reporting_snapshots"
  FOR ALL
  USING (app.is_superuser());

DROP POLICY IF EXISTS chapterreportingsnapshot_chapter_admin ON app."chapter_reporting_snapshots";
CREATE POLICY chapterreportingsnapshot_chapter_admin
  ON app."chapter_reporting_snapshots"
  FOR SELECT
  USING (app.is_chapter_admin(CAST("chapter_id" AS text)));

DROP POLICY IF EXISTS chapterreportingsnapshot_chapter_officer ON app."chapter_reporting_snapshots";
CREATE POLICY chapterreportingsnapshot_chapter_officer
  ON app."chapter_reporting_snapshots"
  FOR SELECT
  USING (app.is_chapter_officer(CAST("chapter_id" AS text)));

-- ============================================================================
-- CHAPTERSTATUSTRANSITION TABLE - RLS
-- ============================================================================

ALTER TABLE app."chapter_status_transitions" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chapterstatustransition_superuser_all ON app."chapter_status_transitions";
CREATE POLICY chapterstatustransition_superuser_all
  ON app."chapter_status_transitions"
  FOR ALL
  USING (app.is_superuser());

DROP POLICY IF EXISTS chapterstatustransition_chapter_admin ON app."chapter_status_transitions";
CREATE POLICY chapterstatustransition_chapter_admin
  ON app."chapter_status_transitions"
  FOR SELECT
  USING (app.is_chapter_admin(CAST("chapter_id" AS text)));

DROP POLICY IF EXISTS chapterstatustransition_chapter_officer ON app."chapter_status_transitions";
CREATE POLICY chapterstatustransition_chapter_officer
  ON app."chapter_status_transitions"
  FOR SELECT
  USING (app.is_chapter_officer(CAST("chapter_id" AS text)));

-- ============================================================================
-- ACCOUNTINVITETOKEN TABLE - RLS
-- ============================================================================

ALTER TABLE app."account_invite_tokens" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS accountinvitetoken_superuser_all ON app."account_invite_tokens";
CREATE POLICY accountinvitetoken_superuser_all
  ON app."account_invite_tokens"
  FOR ALL
  USING (app.is_superuser());

DROP POLICY IF EXISTS accountinvitetoken_own_or_admin ON app."account_invite_tokens";
CREATE POLICY accountinvitetoken_own_or_admin
  ON app."account_invite_tokens"
  FOR SELECT
  USING (
    "account_id" = app.current_account_id()
    OR app.is_superuser()
  );

-- ============================================================================
-- APPSETTING TABLE - RLS
-- ============================================================================

ALTER TABLE app."AppSetting" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS appsetting_superuser_all ON app."AppSetting";
CREATE POLICY appsetting_superuser_all
  ON app."AppSetting"
  FOR ALL
  USING (app.is_superuser());

-- Public read access to non-sensitive settings (optional)
-- For now, restrict to superusers only

-- ============================================================================
-- ROLEPERMISSION TABLE - RLS (Hierarchical: Root → Board → State → Chapter)
-- ============================================================================

ALTER TABLE app."role_permission" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rolepermission_superuser_all ON app."role_permission";
CREATE POLICY rolepermission_superuser_all
  ON app."role_permission"
  FOR ALL
  USING (app.is_superuser());

DROP POLICY IF EXISTS rolepermission_board_access ON app."role_permission";
CREATE POLICY rolepermission_board_access
  ON app."role_permission"
  FOR SELECT
  USING (app.is_board_member());

-- National Evangelists can read/write evangelist-level permissions
DROP POLICY IF EXISTS rolepermission_evangelist_access ON app."role_permission";
CREATE POLICY rolepermission_evangelist_access
  ON app."role_permission"
  FOR SELECT
  USING (
    app.current_account_role() = 'evangelist'
    AND role IN ('evangelist', 'support_center_events', 'support_center_executive', 
                 'support_center_facilities', 'support_center_finance', 'support_center_goodies', 
                 'support_center_graphics')
  );

-- State Coordinators can read/write state + chapter-level permissions
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

-- Area Reps can read/write chapter-level permissions in their state
DROP POLICY IF EXISTS rolepermission_area_rep_access ON app."role_permission";
CREATE POLICY rolepermission_area_rep_access
  ON app."role_permission"
  FOR SELECT
  USING (
    app.current_account_role() IN ('area_rep', 'area_rep_youth', 'area_rep_fast_lane')
    AND role IN ('president', 'secretary', 'treasurer', 'chaplain', 'road_captain', 'rfs_lead')
  );

-- Chapter Presidents can read/write chapter-level permissions only
DROP POLICY IF EXISTS rolepermission_chapter_president_access ON app."role_permission";
CREATE POLICY rolepermission_chapter_president_access
  ON app."role_permission"
  FOR SELECT
  USING (
    app.current_account_role() = 'president'
    AND role IN ('president', 'secretary', 'treasurer', 'chaplain', 'road_captain', 'rfs_lead', 'member')
  );

-- ============================================================================
-- IMPORTANT NOTES FOR IMPLEMENTATION
-- ============================================================================

/*
  CRITICAL: The app must set the session variable during login:
  
  In your login API route, after Supabase auth succeeds:
  
  1. Get the authenticated user's email from Supabase
  2. Look up the Account in your database
  3. Set the app.current_account_id context variable:
     
     await prisma.$executeRaw`
       SET app.current_account_id = ${accountId}
     `
  
  This must be done for EVERY API request using a middleware or per-endpoint.
  
  Alternative: Store account_id in JWT custom claims and retrieve it that way.
  
  Without setting this context variable, all RLS checks will fail.
*/
