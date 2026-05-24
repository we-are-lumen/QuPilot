alter table public.quest_participations
  add column if not exists agent_wallet_address text;

alter table public.quest_participations
  drop constraint if exists quest_participations_agent_wallet_address_nonempty;
alter table public.quest_participations
  add constraint quest_participations_agent_wallet_address_nonempty
  check (agent_wallet_address is null or length(agent_wallet_address) > 0);
