-- Safety Tracker v1.8.0 architecture lock
-- Documents are controlled source files only. All active learning/sign-off assignments live in Training.
-- Run AFTER the v1.7.1 migration.

begin;

-- Old document assignments remain as historical evidence, but can no longer be active.
update public.document_assignments set active=false where coalesce(active,true)=true;

-- New-version handling must never try to create direct document assignments.
update public.documents set resign_on_new_version=false where coalesce(resign_on_new_version,true)=true;

-- One current version per controlled document.
create unique index if not exists document_versions_one_current_per_document
  on public.document_versions(document_id)
  where status='CURRENT';

-- Controlled references should identify one active record. Blank refs remain allowed for SDS/other files.
create unique index if not exists documents_unique_active_reference
  on public.documents((upper(trim(reference))))
  where status <> 'ARCHIVED' and reference is not null and trim(reference) <> '';

-- Prevent the legacy app from re-activating or creating document assignments.
create or replace function public.block_active_document_assignments_v180()
returns trigger
language plpgsql
security invoker
as $$
begin
  if coalesce(new.active,true)=true then
    raise exception 'Safety Tracker v1.8: document assignments are disabled. Assign the linked Training record instead.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_block_active_document_assignments_v180 on public.document_assignments;
create trigger trg_block_active_document_assignments_v180
before insert or update of active on public.document_assignments
for each row execute function public.block_active_document_assignments_v180();

-- Mark the architectural version in a small settings table without depending on an existing settings schema.
create table if not exists public.safety_tracker_settings (
  setting_key text primary key,
  setting_value text not null,
  updated_at timestamptz not null default now()
);
insert into public.safety_tracker_settings(setting_key,setting_value,updated_at)
values ('architecture_version','1.8.0',now())
on conflict (setting_key) do update set setting_value=excluded.setting_value,updated_at=excluded.updated_at;

alter table public.safety_tracker_settings enable row level security;
drop policy if exists "safety_tracker_settings_read" on public.safety_tracker_settings;
create policy "safety_tracker_settings_read" on public.safety_tracker_settings
for select to authenticated using (true);

commit;
