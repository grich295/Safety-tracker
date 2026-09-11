-- Safety Tracker v2.2.2
-- Adds Annual Safety Awareness + monthly report archive/schedules.
-- Run AFTER the v2.2.1 migration.

begin;

-- -----------------------------------------------------------------------------
-- Annual Safety Awareness
-- -----------------------------------------------------------------------------
create table if not exists public.safety_awareness_items (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text,
  guidance_text text not null default '',
  hse_url text,
  version_label text not null default '1.0',
  review_months integer not null default 12 check (review_months between 1 and 60),
  auto_assign_all boolean not null default true,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.safety_awareness_assignments (
  id uuid primary key default gen_random_uuid(),
  awareness_item_id uuid not null references public.safety_awareness_items(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  active boolean not null default true,
  assigned_by uuid references public.profiles(id),
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (awareness_item_id, user_id)
);

create table if not exists public.safety_awareness_activity (
  id uuid primary key default gen_random_uuid(),
  awareness_item_id uuid not null references public.safety_awareness_items(id) on delete cascade,
  assignment_id uuid references public.safety_awareness_assignments(id) on delete set null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_version_label text not null,
  action text not null check (action in ('OPENED','ACKNOWLEDGED')),
  occurred_at timestamptz not null default now()
);

create index if not exists safety_awareness_assignment_user_idx
  on public.safety_awareness_assignments(user_id, active);
create index if not exists safety_awareness_activity_lookup_idx
  on public.safety_awareness_activity(user_id, awareness_item_id, occurred_at desc);

alter table public.safety_awareness_items enable row level security;
alter table public.safety_awareness_assignments enable row level security;
alter table public.safety_awareness_activity enable row level security;

drop policy if exists "awareness items read" on public.safety_awareness_items;
create policy "awareness items read" on public.safety_awareness_items
for select to authenticated using (true);

drop policy if exists "awareness items manage" on public.safety_awareness_items;
create policy "awareness items manage" on public.safety_awareness_items
for all to authenticated
using (exists (select 1 from public.profiles p where p.id=auth.uid() and lower(coalesce(p.role,'')) in ('admin','manager')))
with check (exists (select 1 from public.profiles p where p.id=auth.uid() and lower(coalesce(p.role,'')) in ('admin','manager')));

drop policy if exists "awareness assignments read" on public.safety_awareness_assignments;
create policy "awareness assignments read" on public.safety_awareness_assignments
for select to authenticated
using (
  user_id=auth.uid()
  or exists (select 1 from public.profiles p where p.id=auth.uid() and lower(coalesce(p.role,'')) in ('admin','manager'))
);

drop policy if exists "awareness assignments manage" on public.safety_awareness_assignments;
create policy "awareness assignments manage" on public.safety_awareness_assignments
for all to authenticated
using (exists (select 1 from public.profiles p where p.id=auth.uid() and lower(coalesce(p.role,'')) in ('admin','manager')))
with check (exists (select 1 from public.profiles p where p.id=auth.uid() and lower(coalesce(p.role,'')) in ('admin','manager')));

drop policy if exists "awareness activity read" on public.safety_awareness_activity;
create policy "awareness activity read" on public.safety_awareness_activity
for select to authenticated
using (
  user_id=auth.uid()
  or exists (select 1 from public.profiles p where p.id=auth.uid() and lower(coalesce(p.role,'')) in ('admin','manager'))
);

drop policy if exists "awareness activity insert own" on public.safety_awareness_activity;
create policy "awareness activity insert own" on public.safety_awareness_activity
for insert to authenticated
with check (user_id=auth.uid());

-- Built-in practical awareness sheets. These are original summaries and link to
-- official HSE guidance. They are not a replacement for formal training.
insert into public.safety_awareness_items
(code,title,description,guidance_text,hse_url,version_label,review_months,auto_assign_all,active,sort_order)
values
('AWR-001','PPE Use','Practical reminder for the PPE most commonly used by the maintenance team.',
$txt$PPE is the last line of defence. Follow the task Risk Assessment, COSHH Assessment and Safe System of Work first.
• Wear goggles or safety glasses where there is a risk of particles, dust or liquid splash. Check lenses and side protection before use.
• Wear ear defenders where the task/noise assessment requires hearing protection. Check cushions and headband condition and obtain a good seal.
• Wear steel-toe safety footwear where there is a risk of heavy items, dropped tools or foot injury. Replace damaged footwear.
• Use gloves suitable for the actual task or chemical. One glove type is not suitable for every substance or job. Check for cuts, contamination and wear.
• Wear a hard hat where the assessment identifies a head-injury or falling-object risk. Inspect the shell, harness and adjustment before use.
• Keep PPE clean, correctly fitted and stored so it remains effective. Replace damaged, contaminated or expired PPE.
• If the specified PPE is unavailable, damaged or unsuitable, stop and speak to your manager before starting the task.$txt$,
'https://www.hse.gov.uk/ppe/index.htm','1.0',12,true,true,10),
('AWR-002','Working at Height','Annual reminder on avoiding falls and using ladders/steps safely.',
$txt$Avoid work at height where it is reasonably practicable. Where it cannot be avoided, plan the task and use suitable equipment.
• Use the safest access method for the task and duration.
• Check ladders, steps and access equipment before use and remove damaged equipment from service.
• Set ladders/steps on a firm, level surface and prevent slipping or movement.
• Maintain a secure handhold and do not overreach.
• Keep the area below controlled where people could be struck by tools or materials.
• Follow the specific Risk Assessment/SSW and any permit or supervision requirement.
• Stop if conditions change, access is unsafe or the task cannot be completed as planned.$txt$,
'https://www.hse.gov.uk/work-at-height/index.htm','1.0',12,true,true,20),
('AWR-003','COSHH Basics','General reminder for working with hazardous substances and using the correct controls.',
$txt$COSHH awareness supports the product-specific COSHH Assessment and Safety Data Sheet.
• Check the COSHH Assessment before using a hazardous product.
• Use the quantity needed and keep containers labelled and closed when not in use.
• Follow specified ventilation, skin/eye protection and hygiene controls.
• Do not mix chemicals unless the procedure specifically allows it.
• Know what to do for spills, splashes, exposure or accidental ingestion.
• Store products in the correct location and separate incompatible substances.
• Report damaged containers, missing labels or unexpected reactions immediately.
• If the product or method has changed, stop and make sure the assessment is still suitable.$txt$,
'https://www.hse.gov.uk/coshh/basics/index.htm','1.0',12,true,true,30),
('AWR-004','Manual Handling','Practical refresher for lifting, carrying, pushing and moving loads.',
$txt$Avoid unnecessary manual handling and use mechanical help where reasonably practicable.
• Think about the load, task, route and your own capability before moving it.
• Reduce the load or split it where possible and ask for help when needed.
• Keep a stable position, get a good grip and keep the load close to your body.
• Avoid twisting while lifting or carrying; move your feet instead.
• Plan doors, stairs, corners and the final set-down position before starting.
• Use trolleys, lifting aids or team handling where the assessment requires them.
• Stop if the item is unstable, unexpectedly heavy or the route becomes unsafe.$txt$,
'https://www.hse.gov.uk/msd/manual-handling/index.htm','1.0',12,true,true,40),
('AWR-005','Slips, Trips and Falls','Housekeeping and access reminder for hotel maintenance work areas.',
$txt$Many slips and trips can be prevented by good housekeeping and prompt action.
• Keep walkways, plant rooms and work areas clear of tools, packaging, cables and waste.
• Deal with leaks and spills promptly and use warning controls while the area is unsafe.
• Route leads and hoses so they do not create a trip hazard.
• Keep stairs and access routes adequately lit and report damaged flooring or handrails.
• Wear suitable footwear for the surface and task.
• Do not leave temporary work creating a hazard for guests, colleagues or contractors.$txt$,
'https://www.hse.gov.uk/slips/index.htm','1.0',12,true,true,50),
('AWR-006','Electrical Safety','General electrical-safety awareness for maintenance activities.',
$txt$Electrical work must only be carried out by people with the required competence for the task.
• Isolate equipment where required before inspection or work and prevent unintended re-energisation.
• Do not use damaged plugs, leads, sockets, tools or equipment.
• Keep electrical equipment suitable for the environment and away from water where it is not designed for wet use.
• Report signs of overheating, burning, arcing or repeated protective-device operation.
• Follow the site procedure and task Risk Assessment for electrical work.
• Never assume a circuit is dead simply because equipment has stopped working.$txt$,
'https://www.hse.gov.uk/electricity/index.htm','1.0',12,true,true,60),
('AWR-007','Fire Safety','General reminder on preventing fire and keeping escape arrangements effective.',
$txt$Fire safety relies on preventing ignition, controlling fuel and keeping escape routes available.
• Keep fire doors, escape routes and final exits unobstructed.
• Control hot work and ignition sources using the site procedure/permit where required.
• Store combustible and flammable materials correctly and keep quantities under control.
• Do not wedge fire doors open unless an approved hold-open device is provided.
• Know the alarm arrangements, assembly point and what to do if you discover fire or smoke.
• Report damaged fire doors, missing extinguishers, blocked routes or fire-system faults promptly.$txt$,
'https://www.hse.gov.uk/fireandexplosion/index.htm','1.0',12,true,true,70),
('AWR-008','Safe Use of Tools and Work Equipment','General reminder on pre-use checks, guarding and safe equipment use.',
$txt$Only use tools and work equipment that are suitable for the job and that you are authorised/competent to use.
• Carry out a simple pre-use check for damage, loose parts, guards, cables, plugs and controls.
• Use guards and safety devices as intended; never defeat or bypass them.
• Use the correct accessory, blade, bit or attachment and follow the manufacturer instructions.
• Isolate equipment before clearing jams, changing accessories or carrying out maintenance where required.
• Keep other people clear of the work area and control dust, noise, sparks and flying debris.
• Remove defective equipment from use and report it rather than working around the fault.$txt$,
'https://www.hse.gov.uk/work-equipment-machinery/index.htm','1.0',12,true,true,80)
on conflict (code) do update set
  title=excluded.title,
  description=excluded.description,
  guidance_text=excluded.guidance_text,
  hse_url=excluded.hse_url,
  review_months=excluded.review_months,
  auto_assign_all=excluded.auto_assign_all,
  active=excluded.active,
  sort_order=excluded.sort_order,
  updated_at=now();

-- Initial assignment to all current active Safety Tracker users.
insert into public.safety_awareness_assignments(awareness_item_id,user_id,active)
select i.id,p.id,true
from public.safety_awareness_items i
cross join public.profiles p
where i.active=true
  and i.auto_assign_all=true
  and coalesce(p.active,true)=true
on conflict (awareness_item_id,user_id) do update set active=true, updated_at=now();

-- Automatically assign future active users to built-in awareness items.
create or replace function public.assign_default_awareness_to_profile_v222()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if coalesce(new.active,true)=true then
    insert into public.safety_awareness_assignments(awareness_item_id,user_id,active)
    select i.id,new.id,true
    from public.safety_awareness_items i
    where i.active=true and i.auto_assign_all=true
    on conflict (awareness_item_id,user_id)
    do update set active=true, updated_at=now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_assign_default_awareness_profile_v222 on public.profiles;
create trigger trg_assign_default_awareness_profile_v222
after insert or update of active on public.profiles
for each row execute function public.assign_default_awareness_to_profile_v222();

-- -----------------------------------------------------------------------------
-- Monthly/weekly report archive and schedule configuration
-- -----------------------------------------------------------------------------
create table if not exists public.report_schedules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  frequency text not null default 'MONTHLY' check (frequency in ('MONTHLY','WEEKLY')),
  day_of_month integer not null default 1 check (day_of_month between 1 and 28),
  day_of_week integer not null default 1 check (day_of_week between 1 and 7),
  recipients text[] not null default '{}',
  enabled boolean not null default true,
  email_enabled boolean not null default false,
  last_run_at timestamptz,
  next_run_at timestamptz,
  last_error text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.generated_reports (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid references public.report_schedules(id) on delete set null,
  report_type text not null default 'MONTHLY_SAFETY',
  period_start date not null,
  period_end date not null,
  file_name text not null,
  storage_path text not null,
  status text not null default 'ARCHIVED',
  summary jsonb not null default '{}'::jsonb,
  generated_by uuid references public.profiles(id),
  generated_at timestamptz not null default now(),
  unique(schedule_id, report_type, period_start, period_end)
);

create table if not exists public.report_email_log (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.generated_reports(id) on delete cascade,
  recipient text not null,
  status text not null check (status in ('SENT','FAILED','SKIPPED')),
  error_message text,
  sent_at timestamptz not null default now()
);

create index if not exists report_schedules_due_idx on public.report_schedules(enabled,next_run_at);
create index if not exists generated_reports_period_idx on public.generated_reports(period_start desc, generated_at desc);
create index if not exists report_email_log_report_idx on public.report_email_log(report_id,sent_at desc);

alter table public.report_schedules enable row level security;
alter table public.generated_reports enable row level security;
alter table public.report_email_log enable row level security;

drop policy if exists "report schedules admin read" on public.report_schedules;
create policy "report schedules admin read" on public.report_schedules
for select to authenticated
using (exists (select 1 from public.profiles p where p.id=auth.uid() and lower(coalesce(p.role,''))='admin'));

drop policy if exists "report schedules admin manage" on public.report_schedules;
create policy "report schedules admin manage" on public.report_schedules
for all to authenticated
using (exists (select 1 from public.profiles p where p.id=auth.uid() and lower(coalesce(p.role,''))='admin'))
with check (exists (select 1 from public.profiles p where p.id=auth.uid() and lower(coalesce(p.role,''))='admin'));

drop policy if exists "generated reports manager read" on public.generated_reports;
create policy "generated reports manager read" on public.generated_reports
for select to authenticated
using (exists (select 1 from public.profiles p where p.id=auth.uid() and lower(coalesce(p.role,'')) in ('admin','manager')));

drop policy if exists "generated reports manager insert" on public.generated_reports;
create policy "generated reports manager insert" on public.generated_reports
for insert to authenticated
with check (exists (select 1 from public.profiles p where p.id=auth.uid() and lower(coalesce(p.role,'')) in ('admin','manager')));

drop policy if exists "email log manager read" on public.report_email_log;
create policy "email log manager read" on public.report_email_log
for select to authenticated
using (exists (select 1 from public.profiles p where p.id=auth.uid() and lower(coalesce(p.role,'')) in ('admin','manager')));

-- Calculate the next due run when a schedule is inserted/edited.
create or replace function public.set_report_schedule_next_run_v222()
returns trigger
language plpgsql
as $$
declare
  candidate timestamptz;
  delta integer;
begin
  if new.enabled=false then
    new.next_run_at=null;
    return new;
  end if;

  if new.frequency='MONTHLY' then
    candidate := date_trunc('month', now()) + ((new.day_of_month-1)::text || ' days')::interval + interval '08:00';
    if candidate <= now() then
      candidate := date_trunc('month', now() + interval '1 month') + ((new.day_of_month-1)::text || ' days')::interval + interval '08:00';
    end if;
  else
    delta := (new.day_of_week - extract(isodow from now())::integer + 7) % 7;
    candidate := date_trunc('day', now()) + (delta::text || ' days')::interval + interval '08:00';
    if candidate <= now() then candidate := candidate + interval '7 days'; end if;
  end if;

  new.next_run_at := candidate;
  return new;
end;
$$;

drop trigger if exists trg_report_schedule_next_run_v222 on public.report_schedules;
create trigger trg_report_schedule_next_run_v222
before insert or update of frequency,day_of_month,day_of_week,enabled
on public.report_schedules
for each row execute function public.set_report_schedule_next_run_v222();

insert into public.safety_tracker_settings(setting_key,setting_value,updated_at)
values('front_end_version','2.2.2',now())
on conflict(setting_key) do update set setting_value=excluded.setting_value, updated_at=excluded.updated_at;

commit;


-- Safety Tracker v2.2.3
-- Employee-focused annual Safety Awareness + configurable Monthly PPE Checks.
-- Run AFTER v2.2.2.

begin;

-- -----------------------------------------------------------------------------
-- Refresh built-in awareness wording so it speaks directly to employees.
-- Keep the official HSE guidance links from v2.2.2.
-- Version 1.1 makes the revised wording a fresh awareness review where needed.
-- -----------------------------------------------------------------------------
update public.safety_awareness_items
set
  description='Practical employee reminder for using and looking after the PPE required for your work.',
  guidance_text=$txt$Before you start, check the Risk Assessment, COSHH Assessment or Safe System of Work for the PPE required for the task.
• Wear the PPE specified for the task and make sure it fits correctly.
• Check goggles/safety glasses before use. Do not use them if the lenses, side protection or frame are damaged.
• Wear ear defenders where hearing protection is required. Check the cushions and headband and make sure they seal properly around your ears.
• Wear steel-toe safety footwear where there is a risk of foot injury. Report split, damaged or badly worn footwear.
• Use the correct gloves for the task or chemical. Do not assume one glove type is suitable for everything. Replace torn, contaminated or damaged gloves.
• Wear a hard hat where the task or work area requires head protection. Check the shell and harness before use.
• Keep your PPE clean and store it so it does not become damaged or contaminated.
• Do not use damaged, unsuitable or missing PPE. Stop the task and tell your manager if the required PPE is not available.
Remember: PPE supports the other controls for the job; it does not replace them.$txt$,
  version_label='1.1',
  updated_at=now()
where code='AWR-001';

update public.safety_awareness_items
set
  description='Employee refresher on avoiding falls and using access equipment safely.',
  guidance_text=$txt$Before working at height, make sure the task has been planned and that you understand the relevant Risk Assessment or Safe System of Work.
• Avoid working at height if the job can reasonably be done from ground level.
• Use the access equipment specified for the task. Do not improvise with furniture, boxes or unsuitable equipment.
• Check ladders, steps and access equipment before use. Do not use damaged equipment.
• Put ladders and steps on a firm, level surface and make sure they cannot slip or move.
• Keep a secure handhold where possible and do not overreach; climb down and reposition the equipment instead.
• Keep tools and materials controlled so they cannot fall onto people below.
• Keep the area below clear or protected where there is a risk to guests, colleagues or contractors.
• Stop if the equipment, surface, weather or work area becomes unsafe, or if the job cannot be done as planned.
If you are unsure about the safest access method, stop and ask your manager.$txt$,
  version_label='1.1',
  updated_at=now()
where code='AWR-002';

update public.safety_awareness_items
set
  description='Employee refresher for using chemicals and hazardous substances safely.',
  guidance_text=$txt$Before using a chemical or hazardous substance, check the product label and the relevant COSHH Assessment.
• Make sure you are using the correct product for the job.
• Follow the control measures, PPE, ventilation and handling instructions in the COSHH Assessment.
• Keep containers labelled and closed when you are not using them.
• Do not put chemicals into unlabelled bottles or containers.
• Do not mix chemicals unless the approved procedure specifically tells you to do so.
• Use only the amount you need and clean up/store the product as instructed.
• Know what to do if there is a spill, splash, exposure or other emergency.
• Wash hands after use and before eating, drinking or smoking.
• Report damaged containers, missing labels, leaks or unexpected reactions immediately.
• If the product, concentration or method of use is different from the assessment, stop and ask your manager before continuing.
The Safety Data Sheet is supporting information; follow the workplace COSHH Assessment for the task.$txt$,
  version_label='1.1',
  updated_at=now()
where code='AWR-003';

update public.safety_awareness_items
set
  description='Employee refresher for lifting, carrying, pushing and moving loads safely.',
  guidance_text=$txt$Think about the load, the route and where you are putting it before you start moving anything.
• Use a trolley, lifting aid or other mechanical help where it is available and suitable.
• Split the load or ask for help if it is too heavy, bulky, awkward or unstable for you to move safely.
• Check the route first, including doors, stairs, corners, floor condition and the final set-down point.
• Get a secure grip and keep the load close to your body where possible.
• Keep a stable position and avoid twisting while lifting or carrying; move your feet instead.
• Do not rush, carry a load that blocks your view, or take unnecessary risks to save time.
• Follow any task-specific Manual Handling Risk Assessment or Safe System of Work.
• Stop if the load is heavier or less stable than expected, or if the route becomes unsafe.
Ask for help when you need it.$txt$,
  version_label='1.1',
  updated_at=now()
where code='AWR-004';

update public.safety_awareness_items
set
  description='Employee reminder for preventing slips, trips and falls in work and guest areas.',
  guidance_text=$txt$Keep your work area safe for yourself, colleagues and guests while you are working.
• Keep walkways, plant rooms and work areas clear of tools, packaging, leads, hoses and waste.
• Deal with spills and leaks promptly and use warning signs/barriers while the area is unsafe.
• Route cables and hoses so people do not have to step over them where possible.
• Keep stairs, corridors and access routes clear and adequately lit.
• Report damaged flooring, loose mats, poor lighting, damaged handrails or other slip/trip hazards.
• Wear footwear suitable for the task and surface.
• Do not leave tools, materials or unfinished work creating a hazard when you leave the area.
If you cannot make an area safe straight away, protect it and report it.$txt$,
  version_label='1.1',
  updated_at=now()
where code='AWR-005';

update public.safety_awareness_items
set
  description='Employee reminder for recognising electrical hazards and using electrical equipment safely.',
  guidance_text=$txt$Only carry out electrical work that you are trained, competent and authorised to do.
• Check plugs, leads, sockets, tools and equipment for obvious damage before use.
• Do not use equipment with damaged cables, cracked plugs, loose connections, scorch marks or signs of overheating.
• Keep electrical equipment away from water unless it is designed for that environment.
• Isolate equipment before maintenance or repair where the task requires isolation, and prevent it being switched back on unexpectedly.
• Never assume equipment is safe or dead just because it has stopped working.
• Report repeated tripping, burning smells, arcing, overheating or damaged electrical equipment immediately.
• Follow the relevant Risk Assessment, Safe System of Work and site isolation procedure.
If you are not sure whether electrical work is within your competence, stop and ask your manager.$txt$,
  version_label='1.1',
  updated_at=now()
where code='AWR-006';

update public.safety_awareness_items
set
  description='Employee refresher on preventing fire and keeping escape arrangements safe.',
  guidance_text=$txt$Everyone has a part to play in preventing fire and keeping escape routes usable.
• Keep corridors, stairs, fire exits and final exit doors clear.
• Do not wedge fire doors open unless an approved hold-open device is fitted.
• Keep combustible waste and materials under control and store flammable products as instructed.
• Control sparks, flames and hot work using the site procedure and permit where required.
• Do not cover, obstruct or interfere with detectors, call points, extinguishers or other fire equipment.
• Know how to raise the alarm, the escape route from your work area and the assembly arrangements.
• Report damaged fire doors, blocked exits, missing fire equipment or fire-system faults promptly.
• If you discover fire or smoke, raise the alarm and follow the site emergency procedure; do not put yourself at risk.$txt$,
  version_label='1.1',
  updated_at=now()
where code='AWR-007';

update public.safety_awareness_items
set
  description='Employee refresher for checking and using tools and work equipment safely.',
  guidance_text=$txt$Use only tools and work equipment that are suitable for the job and that you are competent/authorised to use.
• Check the tool or equipment before use for damage, loose parts, guards, cables, plugs and obvious defects.
• Use the correct tool, accessory, blade, bit or attachment for the job.
• Keep guards and safety devices fitted and working. Never bypass or defeat them.
• Follow the manufacturer instructions and any task Risk Assessment or Safe System of Work.
• Isolate or disconnect equipment before clearing jams, changing accessories or carrying out maintenance where required.
• Keep other people clear where there is a risk from moving parts, dust, noise, sparks or flying debris.
• Keep the work area tidy and maintain a stable working position.
• Stop using defective equipment, take it out of use where appropriate and report the fault. Do not work around a safety defect.$txt$,
  version_label='1.1',
  updated_at=now()
where code='AWR-008';

-- -----------------------------------------------------------------------------
-- PPE catalogue and assignments
-- -----------------------------------------------------------------------------
create table if not exists public.ppe_items (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  name text not null,
  description text,
  inspection_guidance text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ppe_assignments (
  id uuid primary key default gen_random_uuid(),
  ppe_item_id uuid not null references public.ppe_items(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  active boolean not null default true,
  assigned_by uuid references public.profiles(id),
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ppe_item_id,user_id)
);

create table if not exists public.ppe_monthly_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  check_month date not null,
  due_date date not null,
  status text not null check (status in ('COMPLETE','ISSUES')),
  declaration text not null,
  signature_data text not null,
  signature_name text not null,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id,check_month)
);

create table if not exists public.ppe_monthly_check_items (
  id uuid primary key default gen_random_uuid(),
  check_id uuid not null references public.ppe_monthly_checks(id) on delete cascade,
  ppe_item_id uuid references public.ppe_items(id) on delete set null,
  ppe_name_snapshot text not null,
  result text not null check (result in ('GOOD','REPLACEMENT_REQUIRED','MISSING','NOT_APPLICABLE')),
  comment text,
  action_status text not null default 'NOT_REQUIRED' check (action_status in ('OPEN','ORDERED','RESOLVED','NOT_REQUIRED')),
  admin_note text,
  resolved_by uuid references public.profiles(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (check_id,ppe_item_id)
);

create table if not exists public.ppe_alert_queue (
  id uuid primary key default gen_random_uuid(),
  check_item_id uuid not null unique references public.ppe_monthly_check_items(id) on delete cascade,
  employee_id uuid not null references public.profiles(id) on delete cascade,
  ppe_item_id uuid references public.ppe_items(id) on delete set null,
  alert_type text not null default 'PPE_ISSUE',
  status text not null default 'PENDING' check (status in ('PENDING','SENT','FAILED')),
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists ppe_assignments_user_idx on public.ppe_assignments(user_id,active);
create index if not exists ppe_monthly_checks_month_idx on public.ppe_monthly_checks(check_month,user_id);
create index if not exists ppe_monthly_check_items_action_idx on public.ppe_monthly_check_items(action_status,result);
create index if not exists ppe_alert_queue_status_idx on public.ppe_alert_queue(status,created_at);

-- Starter catalogue. Admin decides which people each item applies to.
insert into public.ppe_items(code,name,description,inspection_guidance,active,sort_order)
values
('PPE-001','Goggles / safety glasses','Eye protection used for splash, dust, particles and other task-specific eye hazards.','Check lenses, frame and side protection. Make sure vision is clear and the item fits securely. Replace if cracked, badly scratched, damaged or contaminated.',true,10),
('PPE-002','Ear defenders','Hearing protection used where the task/noise controls require it.','Check the headband, cups and cushions. Make sure the cushions are clean, undamaged and able to seal around the ears.',true,20),
('PPE-003','Steel-toe safety footwear','Safety footwear used where there is a risk of foot injury.','Check the sole, upper, fastening and toe area. Report split, badly worn, damaged or unsafe footwear.',true,30),
('PPE-004','Gloves','Task-appropriate protective gloves. The correct glove type depends on the work/chemical.','Check that the glove type is suitable for the task and that gloves are available, clean enough for use and free from tears, holes or significant damage.',true,40),
('PPE-005','Hard hat','Head protection used where the task or work area requires it.','Check the shell and internal harness for cracks, impact damage, distortion, contamination or excessive wear. Replace if damaged or outside the manufacturer service life.',true,50)
on conflict(code) do update set
  name=excluded.name,
  description=excluded.description,
  inspection_guidance=excluded.inspection_guidance,
  active=excluded.active,
  sort_order=excluded.sort_order,
  updated_at=now();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.ppe_items enable row level security;
alter table public.ppe_assignments enable row level security;
alter table public.ppe_monthly_checks enable row level security;
alter table public.ppe_monthly_check_items enable row level security;
alter table public.ppe_alert_queue enable row level security;

drop policy if exists "ppe items read" on public.ppe_items;
create policy "ppe items read" on public.ppe_items for select to authenticated using (true);

drop policy if exists "ppe items admin manage" on public.ppe_items;
create policy "ppe items admin manage" on public.ppe_items for all to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and lower(coalesce(p.role,''))='admin'))
with check (exists(select 1 from public.profiles p where p.id=auth.uid() and lower(coalesce(p.role,''))='admin'));

drop policy if exists "ppe assignments read" on public.ppe_assignments;
create policy "ppe assignments read" on public.ppe_assignments for select to authenticated
using (
  user_id=auth.uid()
  or exists(select 1 from public.profiles p where p.id=auth.uid() and lower(coalesce(p.role,'')) in ('admin','manager'))
);

drop policy if exists "ppe assignments admin manage" on public.ppe_assignments;
create policy "ppe assignments admin manage" on public.ppe_assignments for all to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and lower(coalesce(p.role,''))='admin'))
with check (exists(select 1 from public.profiles p where p.id=auth.uid() and lower(coalesce(p.role,''))='admin'));

drop policy if exists "ppe checks read" on public.ppe_monthly_checks;
create policy "ppe checks read" on public.ppe_monthly_checks for select to authenticated
using (
  user_id=auth.uid()
  or exists(select 1 from public.profiles p where p.id=auth.uid() and lower(coalesce(p.role,'')) in ('admin','manager'))
);

drop policy if exists "ppe check items read" on public.ppe_monthly_check_items;
create policy "ppe check items read" on public.ppe_monthly_check_items for select to authenticated
using (
  exists(select 1 from public.ppe_monthly_checks c where c.id=check_id and c.user_id=auth.uid())
  or exists(select 1 from public.profiles p where p.id=auth.uid() and lower(coalesce(p.role,'')) in ('admin','manager'))
);

drop policy if exists "ppe alert manager read" on public.ppe_alert_queue;
create policy "ppe alert manager read" on public.ppe_alert_queue for select to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and lower(coalesce(p.role,'')) in ('admin','manager')));

-- -----------------------------------------------------------------------------
-- Employee monthly submission RPC. One signed check per employee per month.
-- -----------------------------------------------------------------------------
create or replace function public.submit_monthly_ppe_check_v223(
  p_check_month date,
  p_signature_data text,
  p_signature_name text,
  p_declaration text,
  p_results jsonb
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_month date := date_trunc('month',coalesce(p_check_month,current_date))::date;
  v_due date;
  v_check_id uuid;
  v_item record;
  v_json jsonb;
  v_result text;
  v_comment text;
  v_check_item_id uuid;
  v_issues integer := 0;
  v_assigned integer := 0;
begin
  if auth.uid() is null then raise exception 'You must be signed in'; end if;
  if coalesce(trim(p_signature_data),'')='' or coalesce(trim(p_signature_name),'')='' then
    raise exception 'Digital signature is required';
  end if;
  if coalesce(trim(p_declaration),'')='' then raise exception 'PPE declaration is required'; end if;
  if jsonb_typeof(p_results) <> 'array' then raise exception 'PPE results are invalid'; end if;

  if exists(select 1 from public.ppe_monthly_checks where user_id=auth.uid() and check_month=v_month) then
    raise exception 'Your PPE check for this month has already been submitted';
  end if;

  select count(*) into v_assigned
  from public.ppe_assignments a
  join public.ppe_items i on i.id=a.ppe_item_id
  where a.user_id=auth.uid() and a.active=true and i.active=true;

  if v_assigned=0 then raise exception 'No PPE is assigned to you'; end if;

  v_due := make_date(extract(year from v_month)::int,extract(month from v_month)::int,28);

  insert into public.ppe_monthly_checks(
    user_id,check_month,due_date,status,declaration,signature_data,signature_name,submitted_at
  ) values (
    auth.uid(),v_month,v_due,'COMPLETE',trim(p_declaration),p_signature_data,trim(p_signature_name),now()
  ) returning id into v_check_id;

  for v_item in
    select i.id,i.name
    from public.ppe_assignments a
    join public.ppe_items i on i.id=a.ppe_item_id
    where a.user_id=auth.uid() and a.active=true and i.active=true
    order by i.sort_order,i.name
  loop
    select x.value into v_json
    from jsonb_array_elements(p_results) x(value)
    where x.value->>'ppe_item_id'=v_item.id::text
    limit 1;

    if v_json is null then
      raise exception 'A result is required for %',v_item.name;
    end if;

    v_result := upper(coalesce(v_json->>'result',''));
    v_comment := nullif(trim(coalesce(v_json->>'comment','')),'');

    if v_result not in ('GOOD','REPLACEMENT_REQUIRED','MISSING','NOT_APPLICABLE') then
      raise exception 'Invalid PPE result for %',v_item.name;
    end if;

    if v_result in ('REPLACEMENT_REQUIRED','MISSING') and length(coalesce(v_comment,'')) < 3 then
      raise exception 'Add a short comment for %',v_item.name;
    end if;

    if v_result in ('REPLACEMENT_REQUIRED','MISSING') then v_issues := v_issues + 1; end if;

    insert into public.ppe_monthly_check_items(
      check_id,ppe_item_id,ppe_name_snapshot,result,comment,action_status
    ) values (
      v_check_id,v_item.id,v_item.name,v_result,v_comment,
      case when v_result in ('REPLACEMENT_REQUIRED','MISSING') then 'OPEN' else 'NOT_REQUIRED' end
    ) returning id into v_check_item_id;

    if v_result in ('REPLACEMENT_REQUIRED','MISSING') then
      insert into public.ppe_alert_queue(check_item_id,employee_id,ppe_item_id,alert_type,status)
      values(v_check_item_id,auth.uid(),v_item.id,'PPE_ISSUE','PENDING')
      on conflict(check_item_id) do nothing;
    end if;
  end loop;

  update public.ppe_monthly_checks
  set status=case when v_issues>0 then 'ISSUES' else 'COMPLETE' end,
      updated_at=now()
  where id=v_check_id;

  return v_check_id;
exception when others then
  raise;
end;
$$;

revoke all on function public.submit_monthly_ppe_check_v223(date,text,text,text,jsonb) from public;
grant execute on function public.submit_monthly_ppe_check_v223(date,text,text,text,jsonb) to authenticated;

create or replace function public.resolve_ppe_check_item_v223(
  p_check_item_id uuid,
  p_action_status text,
  p_admin_note text
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_status text := upper(coalesce(trim(p_action_status),''));
begin
  if auth.uid() is null then raise exception 'You must be signed in'; end if;
  if not exists(
    select 1 from public.profiles p
    where p.id=auth.uid() and coalesce(p.active,true)=true and lower(coalesce(p.role,'')) in ('admin','manager')
  ) then raise exception 'Manager or Admin access required'; end if;
  if v_status not in ('OPEN','ORDERED','RESOLVED','NOT_REQUIRED') then raise exception 'Invalid PPE action status'; end if;

  update public.ppe_monthly_check_items
  set action_status=v_status,
      admin_note=nullif(trim(p_admin_note),''),
      resolved_by=case when v_status in ('RESOLVED','NOT_REQUIRED') then auth.uid() else null end,
      resolved_at=case when v_status in ('RESOLVED','NOT_REQUIRED') then now() else null end,
      updated_at=now()
  where id=p_check_item_id;

  if not found then raise exception 'PPE check item not found'; end if;
end;
$$;

revoke all on function public.resolve_ppe_check_item_v223(uuid,text,text) from public;
grant execute on function public.resolve_ppe_check_item_v223(uuid,text,text) to authenticated;

insert into public.safety_tracker_settings(setting_key,setting_value,updated_at)
values('front_end_version','2.2.3',now())
on conflict(setting_key) do update set setting_value=excluded.setting_value,updated_at=excluded.updated_at;

commit;


-- Safety Tracker v2.2.4
-- Report Viewer access: reports/download only, no training/awareness/PPE assignments.
-- Run AFTER v2.2.3. Safe to re-run.

begin;

alter table public.profiles
  add column if not exists report_only boolean not null default false;

comment on column public.profiles.report_only is
  'When true, the account is limited to archived report access/downloads and is excluded from training/awareness/PPE compliance.';

-- Report-download audit trail.
create table if not exists public.report_download_activity (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.generated_reports(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  file_name_snapshot text,
  downloaded_at timestamptz not null default now()
);

create index if not exists report_download_activity_report_idx
  on public.report_download_activity(report_id, downloaded_at desc);

create index if not exists report_download_activity_user_idx
  on public.report_download_activity(user_id, downloaded_at desc);

alter table public.report_download_activity enable row level security;

drop policy if exists "report download own insert" on public.report_download_activity;
create policy "report download own insert"
on public.report_download_activity
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "report download manager read" on public.report_download_activity;
create policy "report download manager read"
on public.report_download_activity
for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.role,'')) in ('admin','manager')
      and coalesce(p.report_only,false) = false
  )
);

-- Allow Report Viewer accounts to read the archived-report index only.
drop policy if exists "generated reports manager read" on public.generated_reports;
drop policy if exists "generated reports authorised read" on public.generated_reports;
create policy "generated reports authorised read"
on public.generated_reports
for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.active is distinct from false
      and (
        lower(coalesce(p.role,'')) in ('admin','manager')
        or coalesce(p.report_only,false) = true
      )
  )
);

-- Report PDFs are stored under reports/... in the existing safety-files bucket.
-- This grants Report Viewer access to report files only, not controlled documents/training files.
drop policy if exists "report files authorised read v224" on storage.objects;
create policy "report files authorised read v224"
on storage.objects
for select to authenticated
using (
  bucket_id = 'safety-files'
  and name like 'reports/%'
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.active is distinct from false
      and (
        lower(coalesce(p.role,'')) in ('admin','manager')
        or coalesce(p.report_only,false) = true
      )
  )
);

-- Admin-only access switch. Existing evidence is preserved; only live assignments are deactivated.
create or replace function public.set_report_only_access_v224(
  p_user_id uuid,
  p_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'You must be signed in';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.active is distinct from false
      and lower(coalesce(p.role,'')) = 'admin'
      and coalesce(p.report_only,false) = false
  ) then
    raise exception 'Admin access required';
  end if;

  if p_user_id = auth.uid() and coalesce(p_enabled,false) then
    raise exception 'You cannot change your own account to Report Viewer';
  end if;

  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'User profile not found';
  end if;

  update public.profiles
  set report_only = coalesce(p_enabled,false)
  where id = p_user_id;

  if coalesce(p_enabled,false) then
    -- Preserve all historic sign-offs/evidence, but remove the user from live compliance workloads.
    update public.training_assignments
       set active = false
     where user_id = p_user_id
       and coalesce(active,true) = true;

    update public.safety_awareness_assignments
       set active = false,
           updated_at = now()
     where user_id = p_user_id
       and coalesce(active,true) = true;

    update public.ppe_assignments
       set active = false,
           updated_at = now()
     where user_id = p_user_id
       and coalesce(active,true) = true;
  end if;
end;
$$;

revoke all on function public.set_report_only_access_v224(uuid,boolean) from public;
grant execute on function public.set_report_only_access_v224(uuid,boolean) to authenticated;

-- Update the default annual-awareness assignment trigger so Report Viewers never receive it.
create or replace function public.assign_default_awareness_to_profile_v222()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if coalesce(new.active,true)=true and coalesce(new.report_only,false)=false then
    insert into public.safety_awareness_assignments
    (
      awareness_item_id,
      user_id,
      active
    )
    select
      i.id,
      new.id,
      true
    from public.safety_awareness_items i
    where i.active=true
      and i.auto_assign_all=true
    on conflict (awareness_item_id,user_id)
    do update set
      active=true,
      updated_at=now();
  else
    update public.safety_awareness_assignments
       set active=false,
           updated_at=now()
     where user_id=new.id
       and active=true;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_assign_default_awareness_profile_v222
on public.profiles;

create trigger trg_assign_default_awareness_profile_v222
after insert or update of active, report_only
on public.profiles
for each row
execute function public.assign_default_awareness_to_profile_v222();

-- Clean up any Report Viewer accounts if this migration is re-run after data was added manually.
update public.safety_awareness_assignments a
set active=false,
    updated_at=now()
where active=true
  and exists (
    select 1 from public.profiles p
    where p.id=a.user_id
      and coalesce(p.report_only,false)=true
  );

update public.ppe_assignments a
set active=false,
    updated_at=now()
where active=true
  and exists (
    select 1 from public.profiles p
    where p.id=a.user_id
      and coalesce(p.report_only,false)=true
  );

update public.training_assignments a
set active=false
where active=true
  and exists (
    select 1 from public.profiles p
    where p.id=a.user_id
      and coalesce(p.report_only,false)=true
  );

insert into public.safety_tracker_settings(setting_key,setting_value,updated_at)
values('front_end_version','2.2.4',now())
on conflict(setting_key)
do update set setting_value=excluded.setting_value,updated_at=excluded.updated_at;

commit;
