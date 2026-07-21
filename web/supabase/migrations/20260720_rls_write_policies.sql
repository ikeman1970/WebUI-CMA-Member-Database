-- ============================================================================
-- MIGRATION: RLS Write Policy Hardening
-- Date: 2026-07-20
-- Purpose: Add explicit UPDATE/DELETE/INSERT policies for all protected tables
--          This makes security intent clear and prevents accidental permission escalation
-- ============================================================================

-- ============================================================================
-- PERSON TABLE - Write Policies
-- ============================================================================

-- Only chapter admins can insert/update persons in their chapter
DROP POLICY IF EXISTS person_chapter_admin_insert ON app."Person";
CREATE POLICY person_chapter_admin_insert
  ON app."Person"
  FOR INSERT
  WITH CHECK (
    "chapter_id" IS NOT NULL
    AND app.is_chapter_admin(CAST("chapter_id" AS text))
  );

DROP POLICY IF EXISTS person_chapter_admin_update ON app."Person";
CREATE POLICY person_chapter_admin_update
  ON app."Person"
  FOR UPDATE
  USING (
    "chapter_id" IS NOT NULL
    AND app.is_chapter_admin(CAST("chapter_id" AS text))
  )
  WITH CHECK (
    "chapter_id" IS NOT NULL
    AND app.is_chapter_admin(CAST("chapter_id" AS text))
  );

-- Only superuser can delete persons
DROP POLICY IF EXISTS person_superuser_delete ON app."Person";
CREATE POLICY person_superuser_delete
  ON app."Person"
  FOR DELETE
  USING (app.is_superuser());

-- ============================================================================
-- ACCOUNT TABLE - Write Policies
-- ============================================================================

-- Users can update their own account
DROP POLICY IF EXISTS account_own_update ON app."Account";
CREATE POLICY account_own_update
  ON app."Account"
  FOR UPDATE
  USING (app.is_own_account(id))
  WITH CHECK (
    app.is_own_account(id)
    AND role = (SELECT role FROM app."Account" WHERE id = app.current_account_id())
  );

-- Only superuser can insert/update accounts
DROP POLICY IF EXISTS account_superuser_insert ON app."Account";
CREATE POLICY account_superuser_insert
  ON app."Account"
  FOR INSERT
  WITH CHECK (app.is_superuser());

DROP POLICY IF EXISTS account_superuser_update ON app."Account";
CREATE POLICY account_superuser_update
  ON app."Account"
  FOR UPDATE
  USING (app.is_superuser())
  WITH CHECK (app.is_superuser());

-- Only superuser can delete accounts
DROP POLICY IF EXISTS account_superuser_delete ON app."Account";
CREATE POLICY account_superuser_delete
  ON app."Account"
  FOR DELETE
  USING (app.is_superuser());

-- ============================================================================
-- SESSION TABLE - Write Policies
-- ============================================================================

-- Users can create sessions for themselves
DROP POLICY IF EXISTS session_own_insert ON app."Session";
CREATE POLICY session_own_insert
  ON app."Session"
  FOR INSERT
  WITH CHECK (app.is_own_account("accountId"));

-- Users can delete their own sessions
DROP POLICY IF EXISTS session_own_delete ON app."Session";
CREATE POLICY session_own_delete
  ON app."Session"
  FOR DELETE
  USING (app.is_own_account("accountId"));

-- Only superuser can update sessions
DROP POLICY IF EXISTS session_superuser_update ON app."Session";
CREATE POLICY session_superuser_update
  ON app."Session"
  FOR UPDATE
  USING (app.is_superuser())
  WITH CHECK (app.is_superuser());

-- ============================================================================
-- CHAPTER TABLE - Write Policies
-- ============================================================================

-- Only superuser can modify chapters
DROP POLICY IF EXISTS chapter_superuser_insert ON app."Chapter";
CREATE POLICY chapter_superuser_insert
  ON app."Chapter"
  FOR INSERT
  WITH CHECK (app.is_superuser());

DROP POLICY IF EXISTS chapter_superuser_update ON app."Chapter";
CREATE POLICY chapter_superuser_update
  ON app."Chapter"
  FOR UPDATE
  USING (app.is_superuser())
  WITH CHECK (app.is_superuser());

DROP POLICY IF EXISTS chapter_superuser_delete ON app."Chapter";
CREATE POLICY chapter_superuser_delete
  ON app."Chapter"
  FOR DELETE
  USING (app.is_superuser());

-- ============================================================================
-- OFFICERASSIGNMENT TABLE - Write Policies
-- ============================================================================

-- Chapter admins can assign officers in their chapter
DROP POLICY IF EXISTS officerassignment_chapter_admin_insert ON app."OfficerAssignment";
CREATE POLICY officerassignment_chapter_admin_insert
  ON app."OfficerAssignment"
  FOR INSERT
  WITH CHECK (
    "chapter_id" IS NOT NULL
    AND app.is_chapter_admin(CAST("chapter_id" AS text))
  );

DROP POLICY IF EXISTS officerassignment_chapter_admin_update ON app."OfficerAssignment";
CREATE POLICY officerassignment_chapter_admin_update
  ON app."OfficerAssignment"
  FOR UPDATE
  USING (
    "chapter_id" IS NOT NULL
    AND app.is_chapter_admin(CAST("chapter_id" AS text))
  )
  WITH CHECK (
    "chapter_id" IS NOT NULL
    AND app.is_chapter_admin(CAST("chapter_id" AS text))
  );

DROP POLICY IF EXISTS officerassignment_superuser_delete ON app."OfficerAssignment";
CREATE POLICY officerassignment_superuser_delete
  ON app."OfficerAssignment"
  FOR DELETE
  USING (app.is_superuser());

-- ============================================================================
-- MOTORCYCLE TABLE - Write Policies
-- ============================================================================

-- Owners can update their own motorcycles
DROP POLICY IF EXISTS motorcycle_owner_update ON app."Motorcycle";
CREATE POLICY motorcycle_owner_update
  ON app."Motorcycle"
  FOR UPDATE
  USING (
    "owner_id" IN (
      SELECT "person_id" FROM app."Account" WHERE id = app.current_account_id()
    )
  )
  WITH CHECK (
    "owner_id" IN (
      SELECT "person_id" FROM app."Account" WHERE id = app.current_account_id()
    )
  );

-- Chapter admins can update motorcycles of their members
DROP POLICY IF EXISTS motorcycle_chapter_admin_update ON app."Motorcycle";
CREATE POLICY motorcycle_chapter_admin_update
  ON app."Motorcycle"
  FOR UPDATE
  USING (
    "owner_id" IN (
      SELECT p.id FROM app."Person" p
      WHERE p."chapter_id" IS NOT NULL
        AND app.is_chapter_admin(CAST(p."chapter_id" AS text))
    )
  )
  WITH CHECK (
    "owner_id" IN (
      SELECT p.id FROM app."Person" p
      WHERE p."chapter_id" IS NOT NULL
        AND app.is_chapter_admin(CAST(p."chapter_id" AS text))
    )
  );

-- Only superuser can delete motorcycles
DROP POLICY IF EXISTS motorcycle_superuser_delete ON app."Motorcycle";
CREATE POLICY motorcycle_superuser_delete
  ON app."Motorcycle"
  FOR DELETE
  USING (app.is_superuser());

-- ============================================================================
-- ROLE_PERMISSION TABLE - Write Policies
-- ============================================================================

-- Only superuser and board can modify permissions
DROP POLICY IF EXISTS rolepermission_board_insert ON app."role_permission";
CREATE POLICY rolepermission_board_insert
  ON app."role_permission"
  FOR INSERT
  WITH CHECK (app.is_board_member());

DROP POLICY IF EXISTS rolepermission_board_update ON app."role_permission";
CREATE POLICY rolepermission_board_update
  ON app."role_permission"
  FOR UPDATE
  USING (app.is_board_member())
  WITH CHECK (app.is_board_member());

DROP POLICY IF EXISTS rolepermission_superuser_delete ON app."role_permission";
CREATE POLICY rolepermission_superuser_delete
  ON app."role_permission"
  FOR DELETE
  USING (app.is_superuser());

-- ============================================================================
-- ROLENOTE TABLE - Write Policies
-- ============================================================================

-- Chapter admins/officers can create role notes in their chapter
DROP POLICY IF EXISTS rolenote_chapter_admin_insert ON app."RoleNote";
CREATE POLICY rolenote_chapter_admin_insert
  ON app."RoleNote"
  FOR INSERT
  WITH CHECK (
    "chapter_id" IS NOT NULL
    AND (
      app.is_chapter_admin(CAST("chapter_id" AS text))
      OR app.is_chapter_officer(CAST("chapter_id" AS text))
    )
  );

DROP POLICY IF EXISTS rolenote_chapter_admin_update ON app."RoleNote";
CREATE POLICY rolenote_chapter_admin_update
  ON app."RoleNote"
  FOR UPDATE
  USING (
    "chapter_id" IS NOT NULL
    AND (
      app.is_chapter_admin(CAST("chapter_id" AS text))
      OR app.is_chapter_officer(CAST("chapter_id" AS text))
    )
  )
  WITH CHECK (
    "chapter_id" IS NOT NULL
    AND (
      app.is_chapter_admin(CAST("chapter_id" AS text))
      OR app.is_chapter_officer(CAST("chapter_id" AS text))
    )
  );

-- ============================================================================
-- EMERGENCYCONTACT TABLE - Write Policies
-- ============================================================================

-- Users can update their own emergency contacts
DROP POLICY IF EXISTS emergencycontact_own_update ON app."EmergencyContact";
CREATE POLICY emergencycontact_own_update
  ON app."EmergencyContact"
  FOR UPDATE
  USING (
    "person_id" IN (
      SELECT "person_id" FROM app."Account" WHERE id = app.current_account_id()
    )
  )
  WITH CHECK (
    "person_id" IN (
      SELECT "person_id" FROM app."Account" WHERE id = app.current_account_id()
    )
  );

-- Chapter admins can manage emergency contacts of their members
DROP POLICY IF EXISTS emergencycontact_chapter_admin_insert ON app."EmergencyContact";
CREATE POLICY emergencycontact_chapter_admin_insert
  ON app."EmergencyContact"
  FOR INSERT
  WITH CHECK (
    "person_id" IN (
      SELECT p.id FROM app."Person" p
      WHERE p."chapter_id" IS NOT NULL
        AND app.is_chapter_admin(CAST(p."chapter_id" AS text))
    )
  );

DROP POLICY IF EXISTS emergencycontact_chapter_admin_update ON app."EmergencyContact";
CREATE POLICY emergencycontact_chapter_admin_update
  ON app."EmergencyContact"
  FOR UPDATE
  USING (
    "person_id" IN (
      SELECT p.id FROM app."Person" p
      WHERE p."chapter_id" IS NOT NULL
        AND app.is_chapter_admin(CAST(p."chapter_id" AS text))
    )
  )
  WITH CHECK (
    "person_id" IN (
      SELECT p.id FROM app."Person" p
      WHERE p."chapter_id" IS NOT NULL
        AND app.is_chapter_admin(CAST(p."chapter_id" AS text))
    )
  );

-- ============================================================================
-- CHAPTER_EVENTS TABLE - Write Policies
-- ============================================================================

-- Chapter admins can create/update events
DROP POLICY IF EXISTS chapterevent_chapter_admin_insert ON app."chapter_events";
CREATE POLICY chapterevent_chapter_admin_insert
  ON app."chapter_events"
  FOR INSERT
  WITH CHECK (app.is_chapter_admin(CAST("chapter_id" AS text)));

DROP POLICY IF EXISTS chapterevent_chapter_admin_update ON app."chapter_events";
CREATE POLICY chapterevent_chapter_admin_update
  ON app."chapter_events"
  FOR UPDATE
  USING (app.is_chapter_admin(CAST("chapter_id" AS text)))
  WITH CHECK (app.is_chapter_admin(CAST("chapter_id" AS text)));

-- ============================================================================
-- CHAPTER_EVENT_ATTENDEES TABLE - Write Policies
-- ============================================================================

-- Chapter admins/officers can manage event attendees
DROP POLICY IF EXISTS chaptereventattendee_chapter_admin_insert ON app."chapter_event_attendees";
CREATE POLICY chaptereventattendee_chapter_admin_insert
  ON app."chapter_event_attendees"
  FOR INSERT
  WITH CHECK (
    "event_id" IN (
      SELECT id FROM app."chapter_events"
      WHERE app.is_chapter_admin(CAST("chapter_id" AS text))
         OR app.is_chapter_officer(CAST("chapter_id" AS text))
    )
  );

-- ============================================================================
-- ACCOUNT_INVITE_TOKENS TABLE - Write Policies
-- ============================================================================

-- Users can only read/manage their own invite tokens
DROP POLICY IF EXISTS accountinvitetoken_own_update ON app."account_invite_tokens";
CREATE POLICY accountinvitetoken_own_update
  ON app."account_invite_tokens"
  FOR UPDATE
  USING (
    "account_id" = app.current_account_id()
    OR app.is_superuser()
  )
  WITH CHECK (
    "account_id" = app.current_account_id()
    OR app.is_superuser()
  );

DROP POLICY IF EXISTS accountinvitetoken_own_delete ON app."account_invite_tokens";
CREATE POLICY accountinvitetoken_own_delete
  ON app."account_invite_tokens"
  FOR DELETE
  USING (
    "account_id" = app.current_account_id()
    OR app.is_superuser()
  );

-- ============================================================================
-- ORGUNIT TABLE - Write Policies
-- ============================================================================

-- Only superuser can modify org units
DROP POLICY IF EXISTS orgunit_superuser_insert ON app."OrgUnit";
CREATE POLICY orgunit_superuser_insert
  ON app."OrgUnit"
  FOR INSERT
  WITH CHECK (app.is_superuser());

DROP POLICY IF EXISTS orgunit_superuser_update ON app."OrgUnit";
CREATE POLICY orgunit_superuser_update
  ON app."OrgUnit"
  FOR UPDATE
  USING (app.is_superuser())
  WITH CHECK (app.is_superuser());

DROP POLICY IF EXISTS orgunit_superuser_delete ON app."OrgUnit";
CREATE POLICY orgunit_superuser_delete
  ON app."OrgUnit"
  FOR DELETE
  USING (app.is_superuser());

-- ============================================================================
-- APPSETTING TABLE - Write Policies
-- ============================================================================

-- Only superuser can modify app settings
DROP POLICY IF EXISTS appsetting_superuser_write ON app."AppSetting";
CREATE POLICY appsetting_superuser_write
  ON app."AppSetting"
  FOR ALL
  USING (app.is_superuser());

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- This migration adds explicit write policies for all protected tables.
-- It makes the security model clear and prevents accidental privilege escalation.
-- All policies follow the principle of least privilege:
-- - Users can only modify their own data unless they have higher privileges
-- - Admins can only modify data in their scope
-- - Superusers have full access
-- ============================================================================
