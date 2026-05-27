drop extension if exists "pg_net";


  create table "public"."agent_api_keys" (
    "id" bigint generated always as identity not null,
    "uuid" uuid not null default gen_random_uuid(),
    "user_id" bigint not null,
    "key_prefix" text not null,
    "key_hash" text not null,
    "label" text,
    "created_at" timestamp with time zone not null default now(),
    "last_used_at" timestamp with time zone,
    "revoked_at" timestamp with time zone
      );


alter table "public"."agent_api_keys" enable row level security;


  create table "public"."quest_participations" (
    "id" bigint generated always as identity not null,
    "uuid" uuid not null default gen_random_uuid(),
    "user_id" bigint not null,
    "quest_id" bigint not null,
    "status" text not null,
    "reward_claimed" boolean not null default false,
    "started_at" timestamp with time zone not null default now(),
    "completed_at" timestamp with time zone,
    "agent_wallet_address" text,
    "participation_pda" text,
    "join_tx_hash" text,
    "complete_tx_hash" text,
    "claim_tx_hash" text,
    "requires_onchain_sync" boolean not null default false
      );


alter table "public"."quest_participations" enable row level security;


  create table "public"."quest_step_participations" (
    "id" bigint generated always as identity not null,
    "uuid" uuid not null default gen_random_uuid(),
    "participation_id" bigint not null,
    "step_id" bigint not null,
    "status" text not null,
    "tx_hash" text,
    "started_at" timestamp with time zone not null default now(),
    "completed_at" timestamp with time zone
      );



  create table "public"."quest_steps" (
    "id" bigint generated always as identity not null,
    "uuid" uuid not null default gen_random_uuid(),
    "quest_id" bigint not null,
    "order_index" integer not null,
    "step_type" text not null,
    "action_params" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now()
      );



  create table "public"."quests" (
    "id" bigint generated always as identity not null,
    "uuid" uuid not null default gen_random_uuid(),
    "provider_id" bigint not null,
    "title" text not null,
    "description" text not null,
    "protocol" text not null,
    "reward_per_user" bigint not null,
    "reward_token" text not null,
    "expires_at" timestamp with time zone not null,
    "created_at" timestamp with time zone not null default now(),
    "total_reward_pool" bigint not null,
    "total_reward_distributed" bigint not null default 0,
    "tx_hash" text not null,
    "quest_pool_pda" text,
    "quest_id_onchain" bytea
      );


alter table "public"."quests" enable row level security;


  create table "public"."user_providers" (
    "id" bigint generated always as identity not null,
    "uuid" uuid not null default gen_random_uuid(),
    "username" text not null,
    "password_hash" text not null,
    "display_name" text not null,
    "logo_url" text,
    "created_at" timestamp with time zone not null default now()
      );



  create table "public"."users" (
    "id" bigint generated always as identity not null,
    "uuid" uuid not null default gen_random_uuid(),
    "wallet_address" text not null,
    "created_at" timestamp with time zone not null default now(),
    "role" text not null default 'user'::text,
    "display_name" text,
    "logo_url" text
      );


alter table "public"."users" enable row level security;

CREATE INDEX agent_api_keys_key_prefix_idx ON public.agent_api_keys USING btree (key_prefix);

CREATE UNIQUE INDEX agent_api_keys_one_active_per_user_uidx ON public.agent_api_keys USING btree (user_id) WHERE (revoked_at IS NULL);

CREATE UNIQUE INDEX agent_api_keys_pkey ON public.agent_api_keys USING btree (id);

CREATE INDEX agent_api_keys_user_id_idx ON public.agent_api_keys USING btree (user_id);

CREATE INDEX agent_api_keys_uuid_idx ON public.agent_api_keys USING btree (uuid);

CREATE UNIQUE INDEX agent_api_keys_uuid_key ON public.agent_api_keys USING btree (uuid);

CREATE UNIQUE INDEX quest_participations_claim_tx_hash_uidx ON public.quest_participations USING btree (claim_tx_hash) WHERE (claim_tx_hash IS NOT NULL);

CREATE UNIQUE INDEX quest_participations_join_tx_hash_uidx ON public.quest_participations USING btree (join_tx_hash) WHERE (join_tx_hash IS NOT NULL);

CREATE UNIQUE INDEX quest_participations_one_inprogress_uidx ON public.quest_participations USING btree (user_id, quest_id) WHERE (status = 'inprogress'::text);

CREATE UNIQUE INDEX quest_participations_one_success_uidx ON public.quest_participations USING btree (user_id, quest_id) WHERE (status = 'success'::text);

CREATE INDEX quest_participations_participation_pda_idx ON public.quest_participations USING btree (participation_pda);

CREATE UNIQUE INDEX quest_participations_pkey ON public.quest_participations USING btree (id);

CREATE INDEX quest_participations_quest_id_idx ON public.quest_participations USING btree (quest_id);

CREATE INDEX quest_participations_status_idx ON public.quest_participations USING btree (status);

CREATE INDEX quest_participations_user_id_idx ON public.quest_participations USING btree (user_id);

CREATE INDEX quest_participations_uuid_idx ON public.quest_participations USING btree (uuid);

CREATE UNIQUE INDEX quest_participations_uuid_key ON public.quest_participations USING btree (uuid);

CREATE INDEX quest_step_participations_participation_id_idx ON public.quest_step_participations USING btree (participation_id);

CREATE UNIQUE INDEX quest_step_participations_participation_id_step_id_key ON public.quest_step_participations USING btree (participation_id, step_id);

CREATE UNIQUE INDEX quest_step_participations_pkey ON public.quest_step_participations USING btree (id);

CREATE INDEX quest_step_participations_status_idx ON public.quest_step_participations USING btree (status);

CREATE INDEX quest_step_participations_step_id_idx ON public.quest_step_participations USING btree (step_id);

CREATE INDEX quest_step_participations_uuid_idx ON public.quest_step_participations USING btree (uuid);

CREATE UNIQUE INDEX quest_step_participations_uuid_key ON public.quest_step_participations USING btree (uuid);

CREATE UNIQUE INDEX quest_steps_pkey ON public.quest_steps USING btree (id);

CREATE INDEX quest_steps_quest_id_idx ON public.quest_steps USING btree (quest_id);

CREATE INDEX quest_steps_quest_id_order_idx ON public.quest_steps USING btree (quest_id, order_index);

CREATE UNIQUE INDEX quest_steps_quest_id_order_index_key ON public.quest_steps USING btree (quest_id, order_index);

CREATE INDEX quest_steps_uuid_idx ON public.quest_steps USING btree (uuid);

CREATE UNIQUE INDEX quest_steps_uuid_key ON public.quest_steps USING btree (uuid);

CREATE INDEX quests_expires_at_idx ON public.quests USING btree (expires_at);

CREATE UNIQUE INDEX quests_pkey ON public.quests USING btree (id);

CREATE INDEX quests_protocol_idx ON public.quests USING btree (protocol);

CREATE INDEX quests_provider_id_idx ON public.quests USING btree (provider_id);

CREATE UNIQUE INDEX quests_quest_pool_pda_uniq ON public.quests USING btree (quest_pool_pda) WHERE (quest_pool_pda IS NOT NULL);

CREATE UNIQUE INDEX quests_tx_hash_uniq ON public.quests USING btree (tx_hash) WHERE (tx_hash <> repeat('1'::text, 64));

CREATE INDEX quests_uuid_idx ON public.quests USING btree (uuid);

CREATE UNIQUE INDEX quests_uuid_key ON public.quests USING btree (uuid);

CREATE UNIQUE INDEX user_providers_pkey ON public.user_providers USING btree (id);

CREATE UNIQUE INDEX user_providers_username_key ON public.user_providers USING btree (username);

CREATE INDEX user_providers_uuid_idx ON public.user_providers USING btree (uuid);

CREATE UNIQUE INDEX user_providers_uuid_key ON public.user_providers USING btree (uuid);

CREATE UNIQUE INDEX users_pkey ON public.users USING btree (id);

CREATE INDEX users_uuid_idx ON public.users USING btree (uuid);

CREATE UNIQUE INDEX users_uuid_key ON public.users USING btree (uuid);

CREATE UNIQUE INDEX users_wallet_address_key ON public.users USING btree (wallet_address);

alter table "public"."agent_api_keys" add constraint "agent_api_keys_pkey" PRIMARY KEY using index "agent_api_keys_pkey";

alter table "public"."quest_participations" add constraint "quest_participations_pkey" PRIMARY KEY using index "quest_participations_pkey";

alter table "public"."quest_step_participations" add constraint "quest_step_participations_pkey" PRIMARY KEY using index "quest_step_participations_pkey";

alter table "public"."quest_steps" add constraint "quest_steps_pkey" PRIMARY KEY using index "quest_steps_pkey";

alter table "public"."quests" add constraint "quests_pkey" PRIMARY KEY using index "quests_pkey";

alter table "public"."user_providers" add constraint "user_providers_pkey" PRIMARY KEY using index "user_providers_pkey";

alter table "public"."users" add constraint "users_pkey" PRIMARY KEY using index "users_pkey";

alter table "public"."agent_api_keys" add constraint "agent_api_keys_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE not valid;

alter table "public"."agent_api_keys" validate constraint "agent_api_keys_user_id_fkey";

alter table "public"."agent_api_keys" add constraint "agent_api_keys_uuid_key" UNIQUE using index "agent_api_keys_uuid_key";

alter table "public"."quest_participations" add constraint "quest_participations_agent_wallet_address_nonempty" CHECK (((agent_wallet_address IS NULL) OR (length(agent_wallet_address) > 0))) not valid;

alter table "public"."quest_participations" validate constraint "quest_participations_agent_wallet_address_nonempty";

alter table "public"."quest_participations" add constraint "quest_participations_quest_id_fkey" FOREIGN KEY (quest_id) REFERENCES public.quests(id) ON DELETE CASCADE not valid;

alter table "public"."quest_participations" validate constraint "quest_participations_quest_id_fkey";

alter table "public"."quest_participations" add constraint "quest_participations_status_check" CHECK ((status = ANY (ARRAY['inprogress'::text, 'success'::text, 'failed'::text]))) not valid;

alter table "public"."quest_participations" validate constraint "quest_participations_status_check";

alter table "public"."quest_participations" add constraint "quest_participations_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE not valid;

alter table "public"."quest_participations" validate constraint "quest_participations_user_id_fkey";

alter table "public"."quest_participations" add constraint "quest_participations_uuid_key" UNIQUE using index "quest_participations_uuid_key";

alter table "public"."quest_step_participations" add constraint "quest_step_participations_participation_id_fkey" FOREIGN KEY (participation_id) REFERENCES public.quest_participations(id) ON DELETE CASCADE not valid;

alter table "public"."quest_step_participations" validate constraint "quest_step_participations_participation_id_fkey";

alter table "public"."quest_step_participations" add constraint "quest_step_participations_participation_id_step_id_key" UNIQUE using index "quest_step_participations_participation_id_step_id_key";

alter table "public"."quest_step_participations" add constraint "quest_step_participations_status_check" CHECK ((status = ANY (ARRAY['inprogress'::text, 'success'::text, 'failed'::text]))) not valid;

alter table "public"."quest_step_participations" validate constraint "quest_step_participations_status_check";

alter table "public"."quest_step_participations" add constraint "quest_step_participations_step_id_fkey" FOREIGN KEY (step_id) REFERENCES public.quest_steps(id) ON DELETE CASCADE not valid;

alter table "public"."quest_step_participations" validate constraint "quest_step_participations_step_id_fkey";

alter table "public"."quest_step_participations" add constraint "quest_step_participations_uuid_key" UNIQUE using index "quest_step_participations_uuid_key";

alter table "public"."quest_steps" add constraint "quest_steps_action_params_is_object" CHECK ((jsonb_typeof(action_params) = 'object'::text)) not valid;

alter table "public"."quest_steps" validate constraint "quest_steps_action_params_is_object";

alter table "public"."quest_steps" add constraint "quest_steps_order_index_check" CHECK ((order_index >= 0)) not valid;

alter table "public"."quest_steps" validate constraint "quest_steps_order_index_check";

alter table "public"."quest_steps" add constraint "quest_steps_quest_id_fkey" FOREIGN KEY (quest_id) REFERENCES public.quests(id) ON DELETE CASCADE not valid;

alter table "public"."quest_steps" validate constraint "quest_steps_quest_id_fkey";

alter table "public"."quest_steps" add constraint "quest_steps_quest_id_order_index_key" UNIQUE using index "quest_steps_quest_id_order_index_key";

alter table "public"."quest_steps" add constraint "quest_steps_step_type_check" CHECK ((step_type = ANY (ARRAY['swap'::text, 'clmm_open'::text, 'clmm_close'::text]))) not valid;

alter table "public"."quest_steps" validate constraint "quest_steps_step_type_check";

alter table "public"."quest_steps" add constraint "quest_steps_uuid_key" UNIQUE using index "quest_steps_uuid_key";

alter table "public"."quests" add constraint "quests_distributed_lte_pool" CHECK ((total_reward_distributed <= total_reward_pool)) not valid;

alter table "public"."quests" validate constraint "quests_distributed_lte_pool";

alter table "public"."quests" add constraint "quests_pool_gte_per_user" CHECK ((total_reward_pool >= reward_per_user)) not valid;

alter table "public"."quests" validate constraint "quests_pool_gte_per_user";

alter table "public"."quests" add constraint "quests_provider_id_fkey" FOREIGN KEY (provider_id) REFERENCES public.users(id) ON DELETE CASCADE not valid;

alter table "public"."quests" validate constraint "quests_provider_id_fkey";

alter table "public"."quests" add constraint "quests_reward_amount_check" CHECK (((reward_per_user)::numeric >= (0)::numeric)) not valid;

alter table "public"."quests" validate constraint "quests_reward_amount_check";

alter table "public"."quests" add constraint "quests_reward_token_is_sol" CHECK ((reward_token = 'SOL'::text)) not valid;

alter table "public"."quests" validate constraint "quests_reward_token_is_sol";

alter table "public"."quests" add constraint "quests_total_reward_distributed_nonneg" CHECK ((total_reward_distributed >= 0)) not valid;

alter table "public"."quests" validate constraint "quests_total_reward_distributed_nonneg";

alter table "public"."quests" add constraint "quests_total_reward_pool_nonneg" CHECK ((total_reward_pool >= 0)) not valid;

alter table "public"."quests" validate constraint "quests_total_reward_pool_nonneg";

alter table "public"."quests" add constraint "quests_tx_hash_is_base58" CHECK ((tx_hash ~ '^[1-9A-HJ-NP-Za-km-z]{64,128}$'::text)) not valid;

alter table "public"."quests" validate constraint "quests_tx_hash_is_base58";

alter table "public"."quests" add constraint "quests_tx_hash_nonempty" CHECK ((length(tx_hash) > 0)) not valid;

alter table "public"."quests" validate constraint "quests_tx_hash_nonempty";

alter table "public"."quests" add constraint "quests_uuid_key" UNIQUE using index "quests_uuid_key";

alter table "public"."user_providers" add constraint "user_providers_username_key" UNIQUE using index "user_providers_username_key";

alter table "public"."user_providers" add constraint "user_providers_uuid_key" UNIQUE using index "user_providers_uuid_key";

alter table "public"."users" add constraint "users_role_check" CHECK ((role = ANY (ARRAY['user'::text, 'user_provider'::text]))) not valid;

alter table "public"."users" validate constraint "users_role_check";

alter table "public"."users" add constraint "users_uuid_key" UNIQUE using index "users_uuid_key";

alter table "public"."users" add constraint "users_wallet_address_is_base58" CHECK ((wallet_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,64}$'::text)) not valid;

alter table "public"."users" validate constraint "users_wallet_address_is_base58";

alter table "public"."users" add constraint "users_wallet_address_key" UNIQUE using index "users_wallet_address_key";

create or replace view "public"."leaderboard" as  SELECT u.uuid AS user_uuid,
    u.wallet_address,
    COALESCE(sum(
        CASE
            WHEN ((qp.status = 'success'::text) AND (qp.reward_claimed = true)) THEN q.reward_per_user
            ELSE (0)::bigint
        END), (0)::numeric) AS total_reward,
        CASE
            WHEN (count(qp.id) = 0) THEN (0)::double precision
            ELSE ((sum(
            CASE
                WHEN (qp.status = 'success'::text) THEN 1
                ELSE 0
            END))::double precision / (count(qp.id))::double precision)
        END AS success_rate
   FROM ((public.users u
     JOIN public.quest_participations qp ON ((qp.user_id = u.id)))
     JOIN public.quests q ON ((q.id = qp.quest_id)))
  GROUP BY u.uuid, u.wallet_address;


grant delete on table "public"."agent_api_keys" to "service_role";

grant insert on table "public"."agent_api_keys" to "service_role";

grant references on table "public"."agent_api_keys" to "service_role";

grant select on table "public"."agent_api_keys" to "service_role";

grant trigger on table "public"."agent_api_keys" to "service_role";

grant truncate on table "public"."agent_api_keys" to "service_role";

grant update on table "public"."agent_api_keys" to "service_role";

grant delete on table "public"."quest_participations" to "service_role";

grant insert on table "public"."quest_participations" to "service_role";

grant references on table "public"."quest_participations" to "service_role";

grant select on table "public"."quest_participations" to "service_role";

grant trigger on table "public"."quest_participations" to "service_role";

grant truncate on table "public"."quest_participations" to "service_role";

grant update on table "public"."quest_participations" to "service_role";

grant delete on table "public"."quest_step_participations" to "service_role";

grant insert on table "public"."quest_step_participations" to "service_role";

grant references on table "public"."quest_step_participations" to "service_role";

grant select on table "public"."quest_step_participations" to "service_role";

grant trigger on table "public"."quest_step_participations" to "service_role";

grant truncate on table "public"."quest_step_participations" to "service_role";

grant update on table "public"."quest_step_participations" to "service_role";

grant delete on table "public"."quest_steps" to "service_role";

grant insert on table "public"."quest_steps" to "service_role";

grant references on table "public"."quest_steps" to "service_role";

grant select on table "public"."quest_steps" to "service_role";

grant trigger on table "public"."quest_steps" to "service_role";

grant truncate on table "public"."quest_steps" to "service_role";

grant update on table "public"."quest_steps" to "service_role";

grant delete on table "public"."quests" to "service_role";

grant insert on table "public"."quests" to "service_role";

grant references on table "public"."quests" to "service_role";

grant select on table "public"."quests" to "service_role";

grant trigger on table "public"."quests" to "service_role";

grant truncate on table "public"."quests" to "service_role";

grant update on table "public"."quests" to "service_role";

grant delete on table "public"."user_providers" to "service_role";

grant insert on table "public"."user_providers" to "service_role";

grant references on table "public"."user_providers" to "service_role";

grant select on table "public"."user_providers" to "service_role";

grant trigger on table "public"."user_providers" to "service_role";

grant truncate on table "public"."user_providers" to "service_role";

grant update on table "public"."user_providers" to "service_role";

grant delete on table "public"."users" to "service_role";

grant insert on table "public"."users" to "service_role";

grant references on table "public"."users" to "service_role";

grant select on table "public"."users" to "service_role";

grant trigger on table "public"."users" to "service_role";

grant truncate on table "public"."users" to "service_role";

grant update on table "public"."users" to "service_role";


