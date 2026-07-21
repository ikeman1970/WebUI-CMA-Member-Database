-- ============================================================================
-- MEMBER ELIGIBILITY TRACKING
-- ============================================================================
-- Configurable eligibility tracking for member status, voting, and officer elections
-- Features can be enabled/disabled at chapter level

-- ============================================================================
-- CONFIGURATION TABLES
-- ============================================================================

-- Global and chapter-level configuration for eligibility tracking
CREATE TABLE IF NOT EXISTS app."EligibilityConfig" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  chapter_id TEXT REFERENCES app."Chapter"(id) ON DELETE CASCADE,
  
  -- Feature flags (per chapter)
  track_meeting_attendance BOOLEAN DEFAULT true,
  track_back_patch_status BOOLEAN DEFAULT true,
  track_donations BOOLEAN DEFAULT true,
  track_member_training BOOLEAN DEFAULT false, -- Assumed complete if Nationals grants membership
  
  -- Configurable thresholds
  meetings_required_per_period INT DEFAULT 3,
  meeting_tracking_period_months INT DEFAULT 6,
  back_patch_required_months INT DEFAULT 6,
  minimum_age_for_voting INT DEFAULT 18,
  minimum_age_for_nomination INT DEFAULT 18,
  minimum_chapter_membership_months INT DEFAULT 6,
  
  -- Donation tracking config
  track_rfs_donations BOOLEAN DEFAULT true,
  track_goodies_purchases BOOLEAN DEFAULT true,
  track_national_donations BOOLEAN DEFAULT true,
  minimum_donation_amount DECIMAL(10, 2) DEFAULT 20.00,
  
  -- If NULL, applies globally. If chapter_id is set, applies to that chapter only
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(chapter_id)
);

-- Donation cycle configuration (e.g., RFS: June 1 - May 30)
CREATE TABLE IF NOT EXISTS app."DonationCycle" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  cycle_name TEXT NOT NULL, -- 'RFS', 'General', etc.
  cycle_type TEXT DEFAULT 'annual', -- 'annual', 'quarterly', 'monthly'
  start_month INT NOT NULL, -- 1-12
  start_day INT DEFAULT 1, -- 1-31
  end_month INT NOT NULL,
  end_day INT DEFAULT 1 (or last day if NULL),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(cycle_name, cycle_type)
);

-- ============================================================================
-- ATTENDANCE TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS app."ChapterMeeting" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  chapter_id TEXT NOT NULL REFERENCES app."Chapter"(id) ON DELETE CASCADE,
  meeting_date DATE NOT NULL,
  meeting_title TEXT,
  meeting_type TEXT DEFAULT 'regular', -- 'regular', 'special', 'rally', 'training'
  notes TEXT,
  recorded_by TEXT REFERENCES app."Account"(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(chapter_id, meeting_date)
);

CREATE TABLE IF NOT EXISTS app."ChapterMeetingAttendance" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  meeting_id TEXT NOT NULL REFERENCES app."ChapterMeeting"(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL REFERENCES app."Person"(id) ON DELETE CASCADE,
  attended BOOLEAN DEFAULT true,
  notes TEXT,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(meeting_id, person_id)
);

-- ============================================================================
-- BACK PATCH TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS app."MemberBackPatchStatus" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  person_id TEXT NOT NULL REFERENCES app."Person"(id) ON DELETE CASCADE,
  chapter_id TEXT NOT NULL REFERENCES app."Chapter"(id) ON DELETE CASCADE,
  patch_type TEXT NOT NULL, -- 'CMA', 'Christian_other', 'secular', 'none'
  start_date DATE NOT NULL,
  end_date DATE,
  notes TEXT,
  recorded_by TEXT REFERENCES app."Account"(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(person_id, chapter_id, start_date)
);

-- ============================================================================
-- DONATIONS & PURCHASES
-- ============================================================================

CREATE TABLE IF NOT EXISTS app."MemberContribution" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  person_id TEXT NOT NULL REFERENCES app."Person"(id) ON DELETE CASCADE,
  chapter_id TEXT REFERENCES app."Chapter"(id) ON DELETE SET NULL, -- NULL if national-level
  contribution_type TEXT NOT NULL, -- 'rfs_donation', 'goodies_purchase', 'national_donation', 'other'
  donation_cycle_id TEXT REFERENCES app."DonationCycle"(id) ON DELETE SET NULL,
  amount DECIMAL(10, 2) NOT NULL,
  contribution_date DATE NOT NULL,
  description TEXT,
  recorded_by TEXT REFERENCES app."Account"(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(person_id, contribution_type, contribution_date, amount)
);

-- ============================================================================
-- MEMBER TRAINING (Optional tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS app."MemberTrainingCompletion" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  person_id TEXT NOT NULL REFERENCES app."Person"(id) ON DELETE CASCADE,
  training_type TEXT NOT NULL, -- 'basic_member', 'officer', 'advanced'
  completion_date DATE NOT NULL,
  completion_source TEXT DEFAULT 'chapter', -- 'nationals', 'chapter', 'online'
  notes TEXT,
  recorded_by TEXT REFERENCES app."Account"(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(person_id, training_type, completion_date)
);

-- ============================================================================
-- ELIGIBILITY STATUS CACHE (For performance)
-- ============================================================================
-- Denormalized view of eligibility status updated periodically

CREATE TABLE IF NOT EXISTS app."MemberEligibilityStatus" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  person_id TEXT NOT NULL REFERENCES app."Person"(id) ON DELETE CASCADE,
  chapter_id TEXT NOT NULL REFERENCES app."Chapter"(id) ON DELETE CASCADE,
  
  -- National membership
  is_national_member BOOLEAN DEFAULT false,
  national_member_until DATE,
  
  -- Chapter eligibility
  is_eligible_to_vote BOOLEAN DEFAULT false,
  is_eligible_to_nominate BOOLEAN DEFAULT false,
  is_eligible_to_hold_office BOOLEAN DEFAULT false,
  
  -- Eligibility details
  meets_age_requirement BOOLEAN DEFAULT false,
  meets_membership_duration BOOLEAN DEFAULT false,
  meets_attendance_requirement BOOLEAN DEFAULT false,
  meets_patch_requirement BOOLEAN DEFAULT false,
  
  -- Specific deficiencies (for UI warnings)
  warning_low_attendance BOOLEAN DEFAULT false,
  warning_patch_status BOOLEAN DEFAULT false,
  warning_age_ineligible BOOLEAN DEFAULT false,
  warning_membership_too_recent BOOLEAN DEFAULT false,
  
  -- Last updated
  last_calculated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(person_id, chapter_id)
);

-- ============================================================================
-- ENABLE RLS ON ELIGIBILITY TABLES
-- ============================================================================

ALTER TABLE app."EligibilityConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."DonationCycle" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."ChapterMeeting" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."ChapterMeetingAttendance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."MemberBackPatchStatus" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."MemberContribution" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."MemberTrainingCompletion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."MemberEligibilityStatus" ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES FOR ELIGIBILITY TABLES
-- ============================================================================

-- ELIGIBILITY CONFIG - Admins and chapter officers can manage
DROP POLICY IF EXISTS eligibilityconfig_superuser ON app."EligibilityConfig";
CREATE POLICY eligibilityconfig_superuser
  ON app."EligibilityConfig"
  FOR ALL
  USING (app.is_superuser());

DROP POLICY IF EXISTS eligibilityconfig_chapter_admin ON app."EligibilityConfig";
CREATE POLICY eligibilityconfig_chapter_admin
  ON app."EligibilityConfig"
  FOR SELECT
  USING (
    chapter_id IS NULL
    OR app.is_chapter_admin(CAST(chapter_id AS text))
  );

DROP POLICY IF EXISTS eligibilityconfig_chapter_admin_update ON app."EligibilityConfig";
CREATE POLICY eligibilityconfig_chapter_admin_update
  ON app."EligibilityConfig"
  FOR UPDATE
  USING (app.is_chapter_admin(CAST(chapter_id AS text)));

-- DONATION CYCLE - Read-only for all
DROP POLICY IF EXISTS donationcycle_superuser ON app."DonationCycle";
CREATE POLICY donationcycle_superuser
  ON app."DonationCycle"
  FOR ALL
  USING (app.is_superuser());

DROP POLICY IF EXISTS donationcycle_read_all ON app."DonationCycle";
CREATE POLICY donationcycle_read_all
  ON app."DonationCycle"
  FOR SELECT
  USING (true);

-- CHAPTER MEETING - Officers and attendees can view
DROP POLICY IF EXISTS chaptermeeting_superuser ON app."ChapterMeeting";
CREATE POLICY chaptermeeting_superuser
  ON app."ChapterMeeting"
  FOR ALL
  USING (app.is_superuser());

DROP POLICY IF EXISTS chaptermeeting_chapter_admin ON app."ChapterMeeting";
CREATE POLICY chaptermeeting_chapter_admin
  ON app."ChapterMeeting"
  FOR ALL
  USING (app.is_chapter_admin(CAST(chapter_id AS text)));

DROP POLICY IF EXISTS chaptermeeting_chapter_officer ON app."ChapterMeeting";
CREATE POLICY chaptermeeting_chapter_officer
  ON app."ChapterMeeting"
  FOR SELECT
  USING (app.is_chapter_officer(CAST(chapter_id AS text)));

-- MEETING ATTENDANCE - Officers and own records
DROP POLICY IF EXISTS meetingattendance_superuser ON app."ChapterMeetingAttendance";
CREATE POLICY meetingattendance_superuser
  ON app."ChapterMeetingAttendance"
  FOR ALL
  USING (app.is_superuser());

DROP POLICY IF EXISTS meetingattendance_chapter_admin ON app."ChapterMeetingAttendance";
CREATE POLICY meetingattendance_chapter_admin
  ON app."ChapterMeetingAttendance"
  FOR ALL
  USING (
    meeting_id IN (
      SELECT id FROM app."ChapterMeeting" cm
      WHERE app.is_chapter_admin(CAST(cm.chapter_id AS text))
    )
  );

DROP POLICY IF EXISTS meetingattendance_own_record ON app."ChapterMeetingAttendance";
CREATE POLICY meetingattendance_own_record
  ON app."ChapterMeetingAttendance"
  FOR SELECT
  USING (
    person_id IN (
      SELECT "person_id" FROM app."Account" WHERE id = app.current_account_id()
    )
  );

-- BACK PATCH STATUS - Officers and own records
DROP POLICY IF EXISTS backpatchstatus_superuser ON app."MemberBackPatchStatus";
CREATE POLICY backpatchstatus_superuser
  ON app."MemberBackPatchStatus"
  FOR ALL
  USING (app.is_superuser());

DROP POLICY IF EXISTS backpatchstatus_chapter_admin ON app."MemberBackPatchStatus";
CREATE POLICY backpatchstatus_chapter_admin
  ON app."MemberBackPatchStatus"
  FOR ALL
  USING (app.is_chapter_admin(CAST(chapter_id AS text)));

DROP POLICY IF EXISTS backpatchstatus_own_record ON app."MemberBackPatchStatus";
CREATE POLICY backpatchstatus_own_record
  ON app."MemberBackPatchStatus"
  FOR SELECT
  USING (
    person_id IN (
      SELECT "person_id" FROM app."Account" WHERE id = app.current_account_id()
    )
  );

-- MEMBER CONTRIBUTION - Officers, own records, and RFS lead
DROP POLICY IF EXISTS contribution_superuser ON app."MemberContribution";
CREATE POLICY contribution_superuser
  ON app."MemberContribution"
  FOR ALL
  USING (app.is_superuser());

DROP POLICY IF EXISTS contribution_chapter_admin ON app."MemberContribution";
CREATE POLICY contribution_chapter_admin
  ON app."MemberContribution"
  FOR ALL
  USING (
    chapter_id IS NULL
    OR app.is_chapter_admin(CAST(chapter_id AS text))
  );

DROP POLICY IF EXISTS contribution_own_record ON app."MemberContribution";
CREATE POLICY contribution_own_record
  ON app."MemberContribution"
  FOR SELECT
  USING (
    person_id IN (
      SELECT "person_id" FROM app."Account" WHERE id = app.current_account_id()
    )
  );

-- MEMBER TRAINING - Officers and own records
DROP POLICY IF EXISTS training_superuser ON app."MemberTrainingCompletion";
CREATE POLICY training_superuser
  ON app."MemberTrainingCompletion"
  FOR ALL
  USING (app.is_superuser());

DROP POLICY IF EXISTS training_chapter_admin ON app."MemberTrainingCompletion";
CREATE POLICY training_chapter_admin
  ON app."MemberTrainingCompletion"
  FOR SELECT
  USING (
    person_id IN (
      SELECT p.id FROM app."Person" p
      WHERE p.chapter_id IS NOT NULL
        AND app.is_chapter_admin(CAST(p.chapter_id AS text))
    )
  );

DROP POLICY IF EXISTS training_own_record ON app."MemberTrainingCompletion";
CREATE POLICY training_own_record
  ON app."MemberTrainingCompletion"
  FOR SELECT
  USING (
    person_id IN (
      SELECT "person_id" FROM app."Account" WHERE id = app.current_account_id()
    )
  );

-- ELIGIBILITY STATUS - Officers and own record
DROP POLICY IF EXISTS eligibilitystatus_superuser ON app."MemberEligibilityStatus";
CREATE POLICY eligibilitystatus_superuser
  ON app."MemberEligibilityStatus"
  FOR ALL
  USING (app.is_superuser());

DROP POLICY IF EXISTS eligibilitystatus_chapter_admin ON app."MemberEligibilityStatus";
CREATE POLICY eligibilitystatus_chapter_admin
  ON app."MemberEligibilityStatus"
  FOR SELECT
  USING (app.is_chapter_admin(CAST(chapter_id AS text)));

DROP POLICY IF EXISTS eligibilitystatus_own_record ON app."MemberEligibilityStatus";
CREATE POLICY eligibilitystatus_own_record
  ON app."MemberEligibilityStatus"
  FOR SELECT
  USING (
    person_id IN (
      SELECT "person_id" FROM app."Account" WHERE id = app.current_account_id()
    )
  );

-- ============================================================================
-- HELPER FUNCTION: Get eligibility config for chapter
-- ============================================================================

CREATE OR REPLACE FUNCTION app.get_eligibility_config(p_chapter_id text)
RETURNS TABLE (
  track_meeting_attendance BOOLEAN,
  track_back_patch_status BOOLEAN,
  track_donations BOOLEAN,
  meetings_required_per_period INT,
  meeting_tracking_period_months INT,
  back_patch_required_months INT,
  minimum_age_for_voting INT,
  minimum_chapter_membership_months INT
) AS $$
  SELECT
    COALESCE(ec.track_meeting_attendance, true),
    COALESCE(ec.track_back_patch_status, true),
    COALESCE(ec.track_donations, true),
    COALESCE(ec.meetings_required_per_period, 3),
    COALESCE(ec.meeting_tracking_period_months, 6),
    COALESCE(ec.back_patch_required_months, 6),
    COALESCE(ec.minimum_age_for_voting, 18),
    COALESCE(ec.minimum_chapter_membership_months, 6)
  FROM app."EligibilityConfig" ec
  WHERE ec.chapter_id = p_chapter_id
$$ LANGUAGE SQL STABLE;

-- ============================================================================
-- HELPER FUNCTION: Check if member meets attendance requirement
-- ============================================================================

CREATE OR REPLACE FUNCTION app.meets_attendance_requirement(
  p_person_id text,
  p_chapter_id text,
  p_meeting_window_start DATE,
  p_meeting_window_end DATE,
  p_meetings_required INT
)
RETURNS BOOLEAN AS $$
  SELECT COUNT(*) >= p_meetings_required
  FROM app."ChapterMeetingAttendance" cma
  JOIN app."ChapterMeeting" cm ON cma.meeting_id = cm.id
  WHERE cma.person_id = p_person_id
    AND cm.chapter_id = p_chapter_id
    AND cm.meeting_date >= p_meeting_window_start
    AND cm.meeting_date <= p_meeting_window_end
    AND cma.attended = true
$$ LANGUAGE SQL STABLE;

-- ============================================================================
-- HELPER FUNCTION: Check if member has CMA patch required duration
-- ============================================================================

CREATE OR REPLACE FUNCTION app.has_cma_patch_duration(
  p_person_id text,
  p_chapter_id text,
  p_required_months INT
)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM app."MemberBackPatchStatus" mbps
    WHERE mbps.person_id = p_person_id
      AND mbps.chapter_id = p_chapter_id
      AND mbps.patch_type = 'CMA'
      AND mbps.start_date <= (NOW()::DATE - (p_required_months || ' months')::INTERVAL)::DATE
      AND (mbps.end_date IS NULL OR mbps.end_date > NOW()::DATE)
  )
$$ LANGUAGE SQL STABLE;

-- ============================================================================
-- HELPER FUNCTION: Get current back patch type
-- ============================================================================

CREATE OR REPLACE FUNCTION app.get_current_back_patch(
  p_person_id text,
  p_chapter_id text
)
RETURNS TEXT AS $$
  SELECT patch_type
  FROM app."MemberBackPatchStatus" mbps
  WHERE mbps.person_id = p_person_id
    AND mbps.chapter_id = p_chapter_id
    AND mbps.end_date IS NULL
    OR mbps.end_date > NOW()::DATE
  ORDER BY start_date DESC
  LIMIT 1
$$ LANGUAGE SQL STABLE;
