-- Chapter status lifecycle migration
-- Run in Supabase SQL editor.

create schema if not exists app;

create table if not exists app.chapter_status_transitions (
  id text primary key default gen_random_uuid()::text,
  chapter_id text not null references app."Chapter"(id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_at timestamptz not null default now(),
  changed_by_account_id text references app."Account"(id) on delete set null,
  reason text,
  constraint chapter_status_to_status_allowed check (lower(to_status) in ('active', 'inactive', 'dissolved')),
  constraint chapter_status_from_status_allowed check (from_status is null or lower(from_status) in ('active', 'inactive', 'dissolved'))
);

create index if not exists idx_chapter_status_transitions_chapter_changed_at
  on app.chapter_status_transitions (chapter_id, changed_at desc);

create index if not exists idx_chapter_status_transitions_changed_by
  on app.chapter_status_transitions (changed_by_account_id);

-- Normalize existing chapter statuses into lifecycle values.
update app."Chapter"
set status = case
  when status is null or btrim(status) = '' then 'active'
  when lower(status) in ('active', 'inactive', 'dissolved') then lower(status)
  when lower(status) in ('removed', 'former', 'closed') then 'dissolved'
  else 'active'
end;

-- Optional backfill: add initial transition row if chapter has no history yet.
insert into app.chapter_status_transitions (chapter_id, from_status, to_status, changed_at, reason)
select c.id, null, lower(c.status), now(), 'initial-backfill'
from app."Chapter" c
where c.status is not null
  and not exists (
    select 1
    from app.chapter_status_transitions t
    where t.chapter_id = c.id
  );
