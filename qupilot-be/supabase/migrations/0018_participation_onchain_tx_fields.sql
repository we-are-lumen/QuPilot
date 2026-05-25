alter table public.quest_participations
  add column if not exists participation_pda text,
  add column if not exists join_tx_hash text,
  add column if not exists complete_tx_hash text,
  add column if not exists claim_tx_hash text,
  add column if not exists requires_onchain_sync boolean not null default false;

create index if not exists quest_participations_participation_pda_idx
  on public.quest_participations (participation_pda);

create unique index if not exists quest_participations_join_tx_hash_uidx
  on public.quest_participations (join_tx_hash)
  where join_tx_hash is not null;

create unique index if not exists quest_participations_claim_tx_hash_uidx
  on public.quest_participations (claim_tx_hash)
  where claim_tx_hash is not null;

