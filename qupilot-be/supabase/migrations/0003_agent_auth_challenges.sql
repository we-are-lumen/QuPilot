-- Migration 0003 — agent auth challenges (nonce-based)
--
-- Purpose:
-- Provide a replay-resistant registration flow for agents to obtain an API key.
-- The agent first requests a challenge (server-generated message + nonce),
-- signs it with their Solana wallet, then submits it to /auth/agent/register.

create table if not exists public.agent_auth_challenges (
  id            bigint generated always as identity primary key,
  wallet_address text not null,
  nonce         text not null,
  message       text not null,
  expires_at    timestamptz not null,
  used_at       timestamptz,
  created_at    timestamptz not null default now()
);

-- Light constraints to keep data sane
alter table public.agent_auth_challenges
  add constraint agent_auth_challenges_wallet_address_nonempty
  check (length(wallet_address) > 0) not valid;
alter table public.agent_auth_challenges
  validate constraint agent_auth_challenges_wallet_address_nonempty;

alter table public.agent_auth_challenges
  add constraint agent_auth_challenges_nonce_nonempty
  check (length(nonce) > 0) not valid;
alter table public.agent_auth_challenges
  validate constraint agent_auth_challenges_nonce_nonempty;

create index if not exists agent_auth_challenges_wallet_address_idx
  on public.agent_auth_challenges (wallet_address);

create index if not exists agent_auth_challenges_expires_at_idx
  on public.agent_auth_challenges (expires_at);

create unique index if not exists agent_auth_challenges_wallet_nonce_uidx
  on public.agent_auth_challenges (wallet_address, nonce);

alter table public.agent_auth_challenges enable row level security;

-- Backend uses Supabase service role key; grant explicit privileges for clarity.
grant delete on table public.agent_auth_challenges to service_role;
grant insert on table public.agent_auth_challenges to service_role;
grant references on table public.agent_auth_challenges to service_role;
grant select on table public.agent_auth_challenges to service_role;
grant trigger on table public.agent_auth_challenges to service_role;
grant truncate on table public.agent_auth_challenges to service_role;
grant update on table public.agent_auth_challenges to service_role;

