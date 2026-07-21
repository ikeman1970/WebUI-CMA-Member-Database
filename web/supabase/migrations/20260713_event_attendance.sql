CREATE SCHEMA IF NOT EXISTS app;

CREATE TABLE IF NOT EXISTS app.chapter_events (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  chapter_id text NOT NULL REFERENCES app."Chapter"(id) ON DELETE CASCADE,
  title text NOT NULL,
  event_date timestamptz NOT NULL,
  event_type text NOT NULL DEFAULT 'fellowship',
  entry_mode text NOT NULL DEFAULT 'pre',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_account_id text REFERENCES app."Account"(id) ON DELETE SET NULL,
  CONSTRAINT chapter_events_event_type_allowed CHECK (lower(event_type) IN ('secular', 'outreach', 'fellowship')),
  CONSTRAINT chapter_events_entry_mode_allowed CHECK (lower(entry_mode) IN ('pre', 'post'))
);

CREATE INDEX IF NOT EXISTS chapter_events_chapter_event_date_idx
  ON app.chapter_events (chapter_id, event_date DESC);

CREATE INDEX IF NOT EXISTS chapter_events_created_by_account_idx
  ON app.chapter_events (created_by_account_id);

CREATE TABLE IF NOT EXISTS app.chapter_event_attendees (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  event_id text NOT NULL REFERENCES app.chapter_events(id) ON DELETE CASCADE,
  attendee_type text NOT NULL,
  person_id text REFERENCES app."Person"(id) ON DELETE SET NULL,
  attendee_name text,
  attendee_cma_number text,
  credited_person_id text REFERENCES app."Person"(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chapter_event_attendees_type_allowed CHECK (lower(attendee_type) IN (
    'chapter_member',
    'guest',
    'chapter_member_other_chapter',
    'state_leadership_same_state',
    'state_leadership_other_state',
    'region_leadership_same_region',
    'region_leadership_other_region',
    'national'
  ))
);

CREATE INDEX IF NOT EXISTS chapter_event_attendees_event_idx
  ON app.chapter_event_attendees (event_id);

CREATE INDEX IF NOT EXISTS chapter_event_attendees_person_idx
  ON app.chapter_event_attendees (person_id);

CREATE INDEX IF NOT EXISTS chapter_event_attendees_credited_person_idx
  ON app.chapter_event_attendees (credited_person_id);

CREATE TABLE IF NOT EXISTS app.chapter_event_follow_ups (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  event_id text NOT NULL REFERENCES app.chapter_events(id) ON DELETE CASCADE,
  attendee_id text REFERENCES app.chapter_event_attendees(id) ON DELETE SET NULL,
  person_id text REFERENCES app."Person"(id) ON DELETE SET NULL,
  follow_up_scope text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS chapter_event_follow_ups_event_idx
  ON app.chapter_event_follow_ups (event_id);

CREATE INDEX IF NOT EXISTS chapter_event_follow_ups_scope_created_at_idx
  ON app.chapter_event_follow_ups (follow_up_scope, created_at DESC);
