-- Safety Tracker v1.4
-- Per-document-version delivery method
-- Allows each new document version to be Self-training or Instructor-led
-- without changing the historical delivery method of earlier versions.

begin;

alter table public.document_versions
add column if not exists delivery_method text;

-- Backfill existing versions with the document's current delivery method.
-- From v1.4 onward each new version stores its own method independently.
update public.document_versions v
set delivery_method=d.delivery_method
from public.documents d
where v.document_id=d.id
  and v.delivery_method is null;

-- Protect against invalid values while allowing null for legacy compatibility.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname='document_versions_delivery_method_check'
  ) then
    alter table public.document_versions
    add constraint document_versions_delivery_method_check
    check (delivery_method is null or delivery_method in ('SELF_TRAINING','INSTRUCTOR_LED'));
  end if;
end $$;

-- Update the database sign-off gate so it checks:
-- 1. assignee's personal instructor-led override
-- 2. assigned document version's delivery method
-- 3. document-level fallback for legacy records
create or replace function public.enforce_document_delivery_gate()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  m text;
  assigned_user uuid;
  last_signed timestamptz;
begin
  select coalesce(a.delivery_method_override,v.delivery_method,d.delivery_method),a.user_id
  into m,assigned_user
  from public.document_assignments a
  join public.document_versions v on v.id=a.document_version_id
  join public.documents d on d.id=v.document_id
  where a.id=new.assignment_id;

  if assigned_user is distinct from new.user_id then
    raise exception 'Sign-off user does not match assignment';
  end if;

  if m='INSTRUCTOR_LED' then
    select max(signed_at) into last_signed
    from public.document_signoffs
    where assignment_id=new.assignment_id;

    if not exists(
      select 1
      from public.document_delivery_confirmations c
      where c.assignment_id=new.assignment_id
        and c.user_id=new.user_id
        and coalesce(c.attendance_status,'ATTENDED')='ATTENDED'
        and c.confirmed_at>coalesce(last_signed,'1970-01-01'::timestamptz)
    ) then
      raise exception 'Instructor confirmation required before sign-off';
    end if;
  end if;

  return new;
end;
$$;

commit;

notify pgrst, 'reload schema';
