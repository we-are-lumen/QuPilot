-- Migration 0019 — RPC for top providers by deposited reward pool
--
-- Return top 3 providers (users.role='user_provider') ordered by
-- sum(quests.total_reward_pool) descending.

create or replace function public.get_top_providers_by_deposit_reward_pool()
returns table (
  uuid uuid,
  display_name text,
  logo_url text,
  total_deposit_reward_pool text
)
language sql
stable
as $$
  select
    u.uuid,
    u.display_name,
    u.logo_url,
    coalesce(sum(q.total_reward_pool), 0)::text as total_deposit_reward_pool
  from public.users u
  left join public.quests q on q.provider_id = u.id
  where u.role = 'user_provider'
  group by u.id, u.uuid, u.display_name, u.logo_url
  order by coalesce(sum(q.total_reward_pool), 0) desc
  limit 3;
$$;
