-- Safety Tracker v1.3
-- Assignee escalation to instructor-led + digital signatures + default training due date
-- Run once on the existing Safety Tracker Supabase project.

begin;

alter table public.training_sessions
add column if not exists default_due_date date;

alter table public.training_assignments
add column if not exists delivery_method_override text;

alter table public.training_assignments
add column if not exists delivery_method_changed_at timestamptz;

alter table public.training_assignments
add column if not exists delivery_method_changed_by uuid references public.profiles(id);

alter table public.training_assignments
add column if not exists delivery_method_reason text;

alter table public.document_assignments
add column if not exists delivery_method_override text;

alter table public.document_assignments
add column if not exists delivery_method_changed_at timestamptz;

alter table public.document_assignments
add column if not exists delivery_method_changed_by uuid references public.profiles(id);

alter table public.document_assignments
add column if not exists delivery_method_reason text;

alter table public.training_signoffs
add column if not exists signature_data text;

alter table public.training_signoffs
add column if not exists signature_name text;

alter table public.document_signoffs
add column if not exists signature_data text;

alter table public.document_signoffs
add column if not exists signature_name text;

create or replace function public.request_training_instructor_led(
  p_assignment_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  assigned_user uuid;
  active_assignment boolean;
begin
  select user_id,active into assigned_user,active_assignment
  from public.training_assignments
  where id=p_assignment_id;

  if assigned_user is null then
    raise exception 'Training assignment not found';
  end if;

  if assigned_user<>auth.uid() then
    raise exception 'You can only change your own training assignment';
  end if;

  if active_assignment is not true then
    raise exception 'Training assignment is not active';
  end if;

  update public.training_assignments
  set delivery_method_override='INSTRUCTOR_LED',
      delivery_method_changed_at=now(),
      delivery_method_changed_by=auth.uid(),
      delivery_method_reason=nullif(trim(p_reason),'')
  where id=p_assignment_id;
end;
$$;

create or replace function public.request_document_instructor_led(
  p_assignment_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  assigned_user uuid;
  active_assignment boolean;
begin
  select user_id,active into assigned_user,active_assignment
  from public.document_assignments
  where id=p_assignment_id;

  if assigned_user is null then
    raise exception 'Document assignment not found';
  end if;

  if assigned_user<>auth.uid() then
    raise exception 'You can only change your own document assignment';
  end if;

  if active_assignment is not true then
    raise exception 'Document assignment is not active';
  end if;

  update public.document_assignments
  set delivery_method_override='INSTRUCTOR_LED',
      delivery_method_changed_at=now(),
      delivery_method_changed_by=auth.uid(),
      delivery_method_reason=nullif(trim(p_reason),'')
  where id=p_assignment_id;
end;
$$;

grant execute on function public.request_training_instructor_led(uuid,text) to authenticated;
grant execute on function public.request_document_instructor_led(uuid,text) to authenticated;

create or replace function public.enforce_training_delivery_gate()
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
  select coalesce(a.delivery_method_override,t.delivery_method),a.user_id
  into m,assigned_user
  from public.training_assignments a
  join public.training_sessions t on t.id=a.training_session_id
  where a.id=new.training_assignment_id;

  if assigned_user is distinct from new.user_id then
    raise exception 'Sign-off user does not match assignment';
  end if;

  if m='INSTRUCTOR_LED' then
    select max(signed_at) into last_signed
    from public.training_signoffs
    where training_assignment_id=new.training_assignment_id;

    if not exists(
      select 1
      from public.training_delivery_confirmations c
      where c.assignment_id=new.training_assignment_id
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
  select coalesce(a.delivery_method_override,d.delivery_method),a.user_id
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
