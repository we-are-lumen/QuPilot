-- Drop legacy users (EVM addresses, etc.) that don't match base58.
-- FKs in quest_participations / agent_api_keys / quests.provider_id all use
-- ON DELETE CASCADE, so dependent rows are removed along with the parent.
delete from public.users
where wallet_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,64}$';

alter table public.users
  drop constraint if exists users_wallet_address_is_base58;

alter table public.users
  add constraint users_wallet_address_is_base58
  check (wallet_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,64}$');

update public.quests
set reward_token = 'SOL'
where reward_token is distinct from 'SOL';

alter table public.quests
  drop constraint if exists quests_reward_token_is_sol;

alter table public.quests
  add constraint quests_reward_token_is_sol check (reward_token = 'SOL');

update public.quests
set tx_hash = repeat('1', 64)
where tx_hash = '0x0';

alter table public.quests
  drop constraint if exists quests_tx_hash_is_base58;

alter table public.quests
  add constraint quests_tx_hash_is_base58
  check (tx_hash ~ '^[1-9A-HJ-NP-Za-km-z]{64,128}$');
