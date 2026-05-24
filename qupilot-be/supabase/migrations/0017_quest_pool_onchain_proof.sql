alter table public.quests
  add column if not exists quest_pool_pda text;

alter table public.quests
  add column if not exists quest_id_onchain bytea;

create unique index if not exists quests_tx_hash_uniq
  on public.quests (tx_hash)
  where tx_hash <> repeat('1', 64);

create unique index if not exists quests_quest_pool_pda_uniq
  on public.quests (quest_pool_pda)
  where quest_pool_pda is not null;

