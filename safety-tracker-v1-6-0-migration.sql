-- Safety Tracker v1.6.0 - Bulk Import + signed reviews + SDS reference-only
-- Run once in the Safety Tracker Supabase SQL Editor.

begin;

create table if not exists public.document_reviews (
  id uuid primary key default gen_random_uuid(),
  document_version_id uuid not null references public.document_versions(id) on delete restrict,
  reviewer_id uuid not null references public.profiles(id) on delete restrict,
  reviewed_at timestamptz not null default now(),
  outcome text not null,
  review_note text,
  next_review_date date,
  signature_data text not null,
  signature_name text not null,
  statement_snapshot text not null,
  title_snapshot text not null,
  reference_snapshot text,
  version_snapshot text not null,
  created_at timestamptz not null default now(),
  constraint document_reviews_outcome_check
    check (outcome in ('NO_CHANGE','NEW_VERSION_REQUIRED','OTHER_ACTION'))
);

create index if not exists document_reviews_version_idx
  on public.document_reviews(document_version_id);

create index if not exists document_reviews_reviewer_idx
  on public.document_reviews(reviewer_id);

create index if not exists document_reviews_reviewed_at_idx
  on public.document_reviews(reviewed_at desc);

alter table public.document_reviews enable row level security;

drop policy if exists document_reviews_read on public.document_reviews;
create policy document_reviews_read
on public.document_reviews
for select
to authenticated
using (true);

-- Reviews are deliberately immutable in normal app use.
-- They are created only through the signed RPC below.
drop policy if exists document_reviews_insert on public.document_reviews;
drop policy if exists document_reviews_update on public.document_reviews;
drop policy if exists document_reviews_delete on public.document_reviews;

create or replace function public.record_document_review(
  p_document_version_id uuid,
  p_outcome text,
  p_review_note text,
  p_next_review_date date,
  p_signature_data text,
  p_signature_name text
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_version public.document_versions%rowtype;
  v_document public.documents%rowtype;
  v_review_id uuid;
  v_statement text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in';
  end if;

  if not public.is_manager_or_admin() then
    raise exception 'Manager or Admin access required';
  end if;

  if p_outcome not in ('NO_CHANGE','NEW_VERSION_REQUIRED','OTHER_ACTION') then
    raise exception 'Invalid review outcome';
  end if;

  if coalesce(trim(p_signature_data),'')='' or coalesce(trim(p_signature_name),'')='' then
    raise exception 'Digital signature is required';
  end if;

  if p_outcome='NO_CHANGE' then
    if p_next_review_date is null then
      raise exception 'Next review date is required when no change is needed';
    end if;
    if p_next_review_date <= current_date then
      raise exception 'Next review date must be in the future';
    end if;
  end if;

  if p_outcome='OTHER_ACTION' and coalesce(trim(p_review_note),'')='' then
    raise exception 'Add a review note explaining the required action';
  end if;

  select *
    into v_version
  from public.document_versions
  where id=p_document_version_id;

  if not found then
    raise exception 'Document version not found';
  end if;

  select *
    into v_document
  from public.documents
  where id=v_version.document_id;

  if not found then
    raise exception 'Document not found';
  end if;

  if v_document.doc_type='SDS' then
    raise exception 'SDS/MSDS is reference-only and does not require a signed document review';
  end if;

  v_statement :=
    'I confirm I have reviewed this document version and that the recorded review outcome is accurate.';

  insert into public.document_reviews(
    document_version_id,
    reviewer_id,
    reviewed_at,
    outcome,
    review_note,
    next_review_date,
    signature_data,
    signature_name,
    statement_snapshot,
    title_snapshot,
    reference_snapshot,
    version_snapshot,
    created_at
  )
  values(
    v_version.id,
    auth.uid(),
    now(),
    p_outcome,
    nullif(trim(p_review_note),''),
    p_next_review_date,
    p_signature_data,
    trim(p_signature_name),
    v_statement,
    v_document.title,
    v_document.reference,
    v_version.version_label,
    now()
  )
  returning id into v_review_id;

  if p_outcome='NO_CHANGE' then
    update public.document_versions
    set review_date=p_next_review_date
    where id=v_version.id;

    update public.documents
    set review_required=false,
        review_reason=null,
        review_flagged_at=null,
        review_flagged_by_document_id=null
    where id=v_document.id;
  elsif p_outcome='NEW_VERSION_REQUIRED' then
    update public.documents
    set review_required=true,
        review_reason='Signed review completed - new document version required',
        review_flagged_at=now(),
        review_flagged_by_document_id=null
    where id=v_document.id;
  else
    update public.documents
    set review_required=true,
        review_reason='Signed review completed - further action required' ||
          case when coalesce(trim(p_review_note),'')<>'' then ': ' || trim(p_review_note) else '' end,
        review_flagged_at=now(),
        review_flagged_by_document_id=null
    where id=v_document.id;
  end if;

  return v_review_id;
end;
$$;

revoke all on function public.record_document_review(uuid,text,text,date,text,text) from public;
grant execute on function public.record_document_review(uuid,text,text,date,text,text) to authenticated;


-- SDS/MSDS is reference-only. Preserve any historic sign-offs, but stop active/new assignments.
update public.document_assignments a
set active=false
from public.document_versions v, public.documents d
where a.document_version_id=v.id
  and v.document_id=d.id
  and d.doc_type='SDS'
  and a.active=true;

create or replace function public.prevent_sds_assignment()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_type text;
begin
  select d.doc_type into v_type
  from public.document_versions v
  join public.documents d on d.id=v.document_id
  where v.id=new.document_version_id;

  if v_type='SDS' and coalesce(new.active,true)=true then
    raise exception 'SDS/MSDS is reference-only and cannot be assigned for sign-off';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_sds_assignment_trigger on public.document_assignments;
create trigger prevent_sds_assignment_trigger
before insert or update of document_version_id, active
on public.document_assignments
for each row execute function public.prevent_sds_assignment();

commit;

notify pgrst, 'reload schema';
