create table if not exists public.quest_steps (
  id           bigint generated always as identity primary key,
  uuid         uuid not null unique default gen_random_uuid(),
  quest_id     bigint not null references public.quests (id) on delete cascade,
  order_index  integer not null check (order_index >= 0),
  step_type    text not null check (step_type in ('swap', 'clmm_open', 'clmm_close')),
  action_params jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  unique (quest_id, order_index)
);

create index if not exists quest_steps_uuid_idx on public.quest_steps (uuid);
create index if not exists quest_steps_quest_id_idx on public.quest_steps (quest_id);
create index if not exists quest_steps_quest_id_order_idx on public.quest_steps (quest_id, order_index);

alter table public.quest_steps
  alter column action_params set default '{}'::jsonb;

alter table public.quest_steps
  drop constraint if exists quest_steps_action_params_is_object;

alter table public.quest_steps
  add constraint quest_steps_action_params_is_object check (jsonb_typeof(action_params) = 'object');

create table if not exists public.quest_step_participations (
  id               bigint generated always as identity primary key,
  uuid             uuid not null unique default gen_random_uuid(),
  participation_id bigint not null references public.quest_participations (id) on delete cascade,
  step_id          bigint not null references public.quest_steps (id) on delete cascade,
  status           text not null check (status in ('inprogress', 'success', 'failed')),
  tx_hash          text,
  started_at       timestamptz not null default now(),
  completed_at     timestamptz,
  unique (participation_id, step_id)
);

create index if not exists quest_step_participations_uuid_idx on public.quest_step_participations (uuid);
create index if not exists quest_step_participations_participation_id_idx on public.quest_step_participations (participation_id);
create index if not exists quest_step_participations_step_id_idx on public.quest_step_participations (step_id);
create index if not exists quest_step_participations_status_idx on public.quest_step_participations (status);

insert into public.quest_steps (quest_id, order_index, step_type, action_params)
select
  q.id,
  0,
  'swap',
  case
    when q.action_params is null then '{}'::jsonb
    when jsonb_typeof(q.action_params) = 'array' then coalesce(q.action_params -> 0, '{}'::jsonb)
    when jsonb_typeof(q.action_params) = 'object' then q.action_params
    else '{}'::jsonb
  end
from public.quests q
where not exists (
  select 1 from public.quest_steps s where s.quest_id = q.id
);

insert into public.quest_step_participations (participation_id, step_id, status, tx_hash, started_at, completed_at)
select
  p.id,
  s.id,
  p.status,
  p.tx_hash,
  p.started_at,
  p.completed_at
from public.quest_participations p
join public.quest_steps s on s.quest_id = p.quest_id
where not exists (
  select 1
  from public.quest_step_participations sp
  where sp.participation_id = p.id and sp.step_id = s.id
);

update public.quest_steps
set action_params =
  case
    when action_params is null then '{}'::jsonb
    when jsonb_typeof(action_params) = 'array' then coalesce(action_params -> 0, '{}'::jsonb)
    when jsonb_typeof(action_params) = 'object' then action_params
    else '{}'::jsonb
  end
where action_params is null
   or jsonb_typeof(action_params) <> 'object';

alter table public.quests drop column if exists quest_type;
alter table public.quests drop column if exists action_params;
drop index if exists public.quests_quest_type_idx;

alter table public.quest_participations drop column if exists tx_hash;
