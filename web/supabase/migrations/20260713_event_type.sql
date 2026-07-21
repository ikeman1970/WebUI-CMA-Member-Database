ALTER TABLE app.chapter_events
  ADD COLUMN IF NOT EXISTS event_type text NOT NULL DEFAULT 'fellowship';

ALTER TABLE app.chapter_events
  DROP CONSTRAINT IF EXISTS chapter_events_event_type_allowed;

ALTER TABLE app.chapter_events
  ADD CONSTRAINT chapter_events_event_type_allowed CHECK (lower(event_type) IN ('secular', 'outreach', 'fellowship'));
