CREATE SCHEMA IF NOT EXISTS app;

CREATE TABLE IF NOT EXISTS app.chapter_reporting_snapshots (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  chapter_id text NOT NULL REFERENCES app."Chapter"(id) ON DELETE CASCADE,
  report_month date NOT NULL,
  metrics jsonb NOT NULL,
  source_file_name text,
  imported_at timestamptz NOT NULL DEFAULT now(),
  imported_by_account_id text REFERENCES app."Account"(id) ON DELETE SET NULL,
  UNIQUE (chapter_id, report_month)
);

CREATE INDEX IF NOT EXISTS chapter_reporting_snapshots_report_month_idx
  ON app.chapter_reporting_snapshots (report_month);

CREATE INDEX IF NOT EXISTS chapter_reporting_snapshots_imported_by_account_idx
  ON app.chapter_reporting_snapshots (imported_by_account_id);
