# QuPilot BE — Execution Checklist

Step-by-step buat execute `quest-api-BE-requirements-v2.md`. Setiap step dipecah semodular mungkin biar tiap commit/PR kecil dan mudah di-review. Tandai `- [x]` setelah step selesai.

> **Keputusan teknis (sudah dikonfirmasi):**
> - Schema DB: SQL migration files di `supabase/migrations/`, dijalanin manual via Supabase SQL editor / CLI.
> - Verifikasi tx_hash: via Solana RPC (`getParsedTransaction`) dan divalidasi sesuai `step_type` (swap / clmm_open / clmm_close) dengan expected signer dari `quest_participations.agent_wallet_address`.
> - Claim reward: user claim langsung di website (user sign tx `claim_reward`), BE hanya sync status claim via tx signature.
> - API Key Agent: di-generate oleh **user (wallet)** dari dashboard via JWT user. **Satu key aktif per user** (regenerate me-revoke yang lama). Simpan **SHA-256 hash + 8-char prefix**, plaintext cuma muncul sekali saat generate. Endpoint agent resolve `user_id` dari key — body `user_uuid` dihapus.

> **Cara apply migrations manual:**
> 1. Buka Supabase Dashboard → SQL Editor.
> 2. Jalanin isi `supabase/migrations/0001_*.sql` sampai `0006_*.sql` berurutan.
> 3. Cek di Table Editor: `users`, `quests`, `quest_participations`, `agent_api_keys` muncul, dan tiap table menampilkan badge **"RLS enabled"** (`0006` mengaktifkan Row Level Security tanpa policy → hanya `service_role` yang bisa akses, anon/authenticated otomatis ditolak). Catatan: `user_providers` adalah legacy dan akan di-drop oleh `0009`.

---

## Phase 0 — Foundation

- [x] **0.1** Tambah folder structure: `src/config/`, `src/lib/`, `src/middlewares/`, `src/modules/`, `src/types/`, `supabase/migrations/` (`.gitkeep` boleh kalau masih kosong).
- [x] **0.2** `src/config/env.ts` — load + validate env pakai zod: `PORT`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `SOLANA_RPC_URL`, `QUPILOT_PROGRAM_ID`, `QUPILOT_ADMIN_KEYPAIR_BASE64|PATH`. Fail fast saat boot.
- [x] **0.3** `src/config/supabase.ts` — export single supabase client pakai service role key.
- [x] **0.4** `src/lib/errors.ts` — class `AppError(status, code, message)` + helper `throw404/409/403/401/400`.
- [x] **0.5** `src/middlewares/error-handler.ts` — central error middleware, format response konsisten `{ error: { code, message } }`.
- [x] **0.6** `src/middlewares/validate.ts` — generic zod validator untuk `body` / `query` / `params`.
- [x] **0.7** `src/types/express.d.ts` — augment `Request` dengan `auth?: { role, sub, ... }`.
- [x] **0.8** `src/app.ts` — extract express setup dari `src/index.ts`, pasang error handler di akhir. Update `.env.example` tambahin `QUPILOT_ADMIN_KEYPAIR_BASE64|PATH` + `SOLANA_RPC_URL`.

## Phase 1 — Database Schema (SQL migrations)

- [x] **1.1** `supabase/migrations/0001_user_providers.sql` — legacy table untuk provider (akan di-drop oleh `0009`).
- [x] **1.2** `supabase/migrations/0002_users.sql` — table users, unique `wallet_address` & `uuid`.
- [x] **1.3** `supabase/migrations/0003_quests.sql` — table quests (FK awal ke `user_providers(id)`, lalu dipindah ke `users(id)` oleh `0009`), index `(provider_id)`, `(expires_at)`, `(protocol)`.
- [x] **1.4** `supabase/migrations/0004_quest_participations.sql` — table participations, FK user/quest, **partial unique index** `(user_id, quest_id) WHERE status='inprogress'` untuk enforce "satu inprogress per kombinasi".
- [x] **1.5** `supabase/migrations/0005_agent_api_keys.sql` — table `agent_api_keys` (id, uuid, user_id FK, key_prefix, key_hash, label, created_at, last_used_at, revoked_at) + **partial unique index** `(user_id) WHERE revoked_at IS NULL` (enforce satu key aktif per user) + index `(key_prefix)` untuk lookup.
- [x] **1.6** `supabase/migrations/0006_enable_rls.sql` — `ENABLE ROW LEVEL SECURITY` di semua 5 table **tanpa policy**, plus `REVOKE ALL ... FROM anon, authenticated` + `ALTER DEFAULT PRIVILEGES` untuk table baru. Efek: hanya `service_role` (yang dipakai BE) yang punya akses; siapa pun yang coba lewat Supabase PostgREST publik / anon key dapat empty response.
- [x] **1.7** Apply semua migration di Supabase SQL editor; verifikasi ke-5 table ada **dan RLS aktif** (badge "RLS enabled" di Dashboard). _(manual — user execute di Supabase Dashboard)_
- [x] **1.8** `supabase/migrations/0009_merge_user_providers_into_users.sql` — merge role provider + user ke table `users`, FK `quests.provider_id` → `users.id`, drop table `user_providers`.
- [ ] **1.9** Apply `0009` di Supabase SQL editor; verifikasi:
  - Table `users` punya kolom `role`, `display_name`, `logo_url`
  - `quests.provider_id` FK ke `users(id)`
  - Table `user_providers` sudah tidak ada. _(manual)_
- [x] **1.10** `supabase/migrations/0010_quest_tx_hash.sql` — tambah kolom `quests.tx_hash` (required).
- [ ] **1.11** Apply `0010` di Supabase SQL editor; verifikasi `quests.tx_hash` ada & NOT NULL. _(manual)_

## Phase 2 — Auth Libraries

- [x] **2.1** `src/lib/password.ts` — `hashPassword`, `verifyPassword` pakai bcrypt (cost 10).
- [x] **2.2** `src/lib/jwt.ts` — `signProviderJwt({sub, wallet_address})`, `signUserJwt({sub, wallet_address})`, `verifyJwt()` return discriminated union by `role`.
- [x] **2.3** `src/lib/wallet-signature.ts` — `verifySolanaSignature(walletAddress, message, signatureBase58)` pakai ed25519 verify.
- [x] **2.4** `src/middlewares/auth-provider.ts` — extract Bearer, verify JWT, assert `role=user_provider`, set `req.auth`.
- [x] **2.5** `src/middlewares/auth-user.ts` — sama dengan 2.4 tapi `role=user`.
- [x] **2.6** `src/middlewares/auth-agent.ts` — ⚠️ **versi awal (static `AI_AGENT_API_KEY`) sudah ditulis tapi DEPRECATED** oleh perubahan desain. Akan di-rewrite di **9.x** jadi DB-lookup: ambil `x-api-key`, lookup `key_prefix`, constant-time compare SHA-256 hash, resolve `user_id`, set `req.auth = { role: 'agent', user_id, key_id }`, update `last_used_at`. Hapus juga `AI_AGENT_API_KEY` dari `env.ts` & `.env.example`.

## Phase 3 — Module: Auth User Provider (DEPRECATED)

- [x] **3.1** Endpoint password-based provider login/register dihapus; provider login sekarang satu pintu via `POST /auth/user/login` (connect wallet) dengan role `user_provider`.

## Phase 4 — Module: Auth User (Wallet) + Role Selection

- [x] **4.1** `src/modules/auth-user/auth-user.schema.ts` — zod `walletLoginBody { wallet_address(0x), signature(0x), message, role?, display_name?, logo_url? }`.
- [x] **4.2** `src/modules/auth-user/auth-user.service.ts` — verify signature (Solana) → jika wallet belum ada & role kosong return `{ registered:false }` → kalau role ada buat user → sign JWT by role.
- [x] **4.3** `src/modules/auth-user/auth-user.controller.ts` + routes — `POST /auth/user/login`.

## Phase 5 — Module: Providers (public listing)

- [x] **5.1** `src/modules/providers/providers.service.ts` — `listAll()` (field `spotlight` ada di response, default false).
- [x] **5.2** Controller + routes — `GET /providers` (public, no auth).

## Phase 6 — Module: Quests (Provider side)

- [x] **6.1** `src/modules/quests/quests.schema.ts` — zod `createQuestBody` dengan enum protocol, field wajib `tx_hash`, dan `steps[]` (tiap step punya `step_type` + `action_params`).
- [x] **6.2** `src/modules/quests/quests.service.ts` — `create(providerId, body)`, `listByProvider(providerId)` dengan participation count, `getDetailForProvider(providerId, questUuid)` dengan analytics (total/success/failed/success_rate).
- [x] **6.3** Controller + routes (provider-only): `POST /provider/quests`, `GET /provider/quests`, `GET /provider/quests/:uuid`. Mount dengan `authProvider`.
- [x] **6.4** Handler `PUT`/`PATCH /provider/quests/:uuid` → return **403** ("Quest is immutable") sesuai business rule.

## Phase 7 — Module: Quests (Public side)

- [x] **7.1** Extend `quests.service.ts`: `listPublic({ protocol?, type? })` filter `expires_at > now()`, join provider untuk nama+logo, plus participation count.
- [x] **7.2** `listPublicByProvider(providerUuid)` — sama tapi filter by provider uuid.
- [x] **7.3** `getPublicDetail(uuid)` — full detail termasuk `steps[]` (ordered) untuk AI agent.
- [x] **7.4** Controller + routes (no auth): `GET /quests`, `GET /providers/:uuid/quests`, `GET /quests/:uuid`.

## Phase 8 — Module: User Participations & Achievements

- [x] **8.1** `src/modules/participations/participations.service.ts` — `listByUser(userId)` return semua participations + quest detail.
- [x] **8.2** `getDetailForUser(userId, questUuid)` — participation + quest + flag `can_claim` (`status='success' && !reward_claimed`).
- [x] **8.3** Controller + routes (user-only): `GET /me/participations`, `GET /me/participations/:questUuid`.

## Phase 9 — Module: Agent API Key (user-managed)

User yang sudah login wallet bisa generate / revoke API key untuk dipakai AI Agent mereka. Satu user maksimal satu key aktif.

- [x] **9.1** `src/lib/api-key.ts` — `generatePlaintextKey()` (return string `qpk_<32-random-base58>`), `hashKey(plaintext)` (SHA-256 hex), `extractPrefix(plaintext)` (slice 8 char pertama), `verifyKey(plaintext, hash)` (constant-time compare via `crypto.timingSafeEqual` di Buffer hex).
- [x] **9.2** `src/modules/api-keys/api-keys.schema.ts` — zod `generateBody { label?: string }`.
- [x] **9.3** `src/modules/api-keys/api-keys.service.ts`:
  - `generateForUser(userId, label?)` — dalam satu transaksi (atau sequential update→insert): `UPDATE agent_api_keys SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL`, lalu generate plaintext baru → hash & prefix → insert row baru → return `{ plaintext, uuid, key_prefix, label, created_at }`.
  - `getActiveForUser(userId)` — return metadata key aktif (tanpa plaintext, tanpa hash) atau `null`.
  - `revokeForUser(userId)` — set `revoked_at=now()` di key aktif user (no-op kalau sudah tidak ada).
- [x] **9.4** Controller + routes (user-only via `authUser`):
  - `POST /me/api-key` — generate (response berisi **plaintext sekali**).
  - `GET /me/api-key` — status key aktif.
  - `DELETE /me/api-key` — revoke.

## Phase 10 — Module: Claim Reward (on-chain)

- [x] **10.1** On-chain claim (`claim_reward`) hanya bisa dilakukan oleh user (website). BE tidak mengirim tx claim.
- [x] **10.2** BE menyediakan endpoint sync claim via `RewardClaimed` event + `claim_tx_hash` untuk set `reward_claimed=true` dan bump `quests.total_reward_distributed`.

## Phase 11 — Module: AI Agent (join + complete)

- [x] **11.1** **Rewrite** `src/middlewares/auth-agent.ts`: ambil `x-api-key`, validasi format `qpk_*`, lookup `agent_api_keys` by `key_prefix` & `revoked_at IS NULL`, constant-time compare hash via `verifyKey` (lib/api-key), set `req.auth = { role: 'agent', user_id, key_id }`, update `last_used_at` async (fire-and-forget). Hapus `AI_AGENT_API_KEY` dari `env.ts` + `.env.example`.
- [x] **11.2** `src/modules/agent/agent.schema.ts` — `joinBody { quest_uuid }` (tanpa `user_uuid` — di-resolve dari key), `completeBody { steps: [{ step_uuid, tx_hash }] }`.
- [x] **11.3** `agent.service.ts` — `join(userId, questUuid)`: resolve quest by uuid (cek belum expired), insert participation status `inprogress` (partial unique handle race → 409 kalau sudah ada).
- [x] **11.4** `agent.service.ts` — `complete(userId, participationUuid, steps)`: update `quest_step_participations` per step + `tx_hash`, set participation `success` jika semua step sukses atau `failed` jika ada step gagal, lalu bump `quests.total_reward_distributed` saat `success`.
- [x] **11.5** Controller + routes (agent-only via `authAgent`): `POST /agent/participations` (join), `POST /agent/participations/:uuid/complete`.
- [x] **11.6** Tidak ada endpoint claim untuk agent. Agent hanya mengarahkan user untuk claim di website.

## Phase 14 — Reward Bigint (pool + per-user + distributed)

- [x] **14.1** Migration `supabase/migrations/0008_reward_amount_columns.sql` (drop leaderboard view dulu sebelum alter, lalu recreate):
  - `quests.reward_amount` → **rename** jadi `quests.reward_per_user` + ubah type ke `bigint` (immutable, per-user reward).
  - Tambah `quests.total_reward_pool bigint NOT NULL` — total reward tersedia (backfill `= reward_per_user` untuk row existing, lalu set NOT NULL).
  - Tambah `quests.total_reward_distributed bigint NOT NULL DEFAULT 0`.
  - Check constraints: `total_reward_pool >= 0`, `total_reward_pool >= reward_per_user`, `total_reward_distributed >= 0`, `total_reward_distributed <= total_reward_pool`.
  - `quest_participations`: **tidak ditambah** kolom reward — nominal claim direfer dari `quests.reward_per_user` (immutable).
  - Recreate `leaderboard` view: `total_reward = sum(q.reward_per_user) WHERE status=success AND reward_claimed=true`.
- [x] **14.2** `quests.schema.ts` — body terima `total_reward_pool` + `reward_per_user` (bigint, di-stringify), plus refine `total_reward_pool >= reward_per_user`. Hapus field `reward_amount`.
- [x] **14.3** `quests.service.ts` — `QUEST_PUBLIC_COLS` & type `QuestPublic` ganti `reward_amount` → `{ total_reward_pool, reward_per_user, total_reward_distributed }`. `create()` insert kedua field pool & per_user.
- [x] **14.4** `agent.service.complete` — saat status = `success`: load `{reward_per_user, total_reward_pool, total_reward_distributed}`, pre-check `new <= pool` (else 409 `REWARD_POOL_EXHAUSTED`), lalu bump `total_reward_distributed`. Tidak ada snapshot di participation.
- [x] **14.5** `participations.service.ts` — `ParticipationItem.quest` expose `{ total_reward_pool, reward_per_user, total_reward_distributed }` (tanpa `reward_amount` di level participation). `claimAllByUserId` source `quests.reward_per_user` langsung sebagai amount transfer.
- [ ] **14.6** Apply `0008` di Supabase SQL editor; verifikasi:
  - `quests.reward_per_user` exist (bigint), kolom `reward_amount` sudah TIDAK ada.
  - `quests.total_reward_pool` exist (bigint NOT NULL).
  - `quests.total_reward_distributed` exist (bigint NOT NULL DEFAULT 0).
  - `quest_participations` TIDAK punya kolom `reward_amount`.
  - View `leaderboard` ada & query `select * from leaderboard limit 1` jalan. _(manual)_

## Phase 12 — Module: Leaderboard

- [x] **12.1** `src/modules/leaderboard/leaderboard.service.ts` — join users + participations + quests, `total_reward` dari `status=success AND reward_claimed=true`, `success_rate = success/total`. `ORDER BY total_reward DESC, success_rate DESC LIMIT 100`.
- [x] **12.2** Controller + route public: `GET /leaderboard`.

## Phase 13 — Wiring & Smoke Test

- [x] **13.1** `src/app.ts` — semua router ter-mount, urutan middleware bener (helmet → cors → json → routes → error-handler).
- [x] **13.2** `npm run typecheck` lulus tanpa error.
- [ ] **13.3** Smoke flow manual (curl/Postman):
  - [ ] `POST /auth/user/login` (wallet + signature, tanpa role) → `{ registered:false }`
  - [ ] `POST /auth/user/login` (wallet + signature + role=user_provider + display_name/logo_url) → JWT provider
  - [ ] `POST /provider/quests` (Bearer provider) → 201 + quest uuid
  - [ ] `PATCH /provider/quests/:uuid` → **403**
  - [ ] `POST /auth/user/login` (wallet + signature + role=user) → JWT user
  - [ ] `POST /me/api-key` (Bearer user) → 201 + plaintext `qpk_*` (simpan; cuma muncul sekali)
  - [ ] `GET /me/api-key` → metadata key (prefix, label, created_at), tanpa plaintext
  - [ ] `GET /quests` (public) → quest muncul, ada nama+logo provider
  - [ ] `POST /agent/participations` (x-api-key) → 201 participation uuid (user di-resolve dari key)
  - [ ] Eksekusi tx manual → `POST /agent/participations/:uuid/complete` dengan body `steps:[{step_uuid, tx_hash}]` sampai semua step complete → status `success`
  - [ ] Pakai key user lain untuk complete participation user A → **403** (ownership check)
  - [ ] `POST /me/api-key` lagi → key lama otomatis revoked, key lama dipakai → **401**
  - [ ] `GET /me/participations` (Bearer user) → success + `can_claim=true`
  - [ ] `POST /me/claim` → on-chain transfer SOL terjadi, tx signature claim ada
  - [ ] `POST /agent/claim` (x-api-key) → reward yang belum di-claim ditransfer ke wallet user (bukan agent); call kedua kalinya `claimed=[]` (idempotent)
  - [ ] `GET /leaderboard` → user muncul dengan `total_reward` & `success_rate`
- [x] **13.4** (Opsional) Bikin `API.md` ringkas — daftar endpoint + contoh request.

## Phase 15 — Quest Steps (multi-step quests)

- [x] **15.1** Migration `supabase/migrations/0011_quest_steps.sql`:
  - Buat table `quest_steps` (order_index + step_type + action_params).
  - Buat table `quest_step_participations` (per-step status + tx_hash).
  - Backfill quest existing jadi 1 step (`step_type='swap'`, order_index=0) dari legacy `quests.action_params`.
  - Drop kolom legacy: `quests.quest_type`, `quests.action_params`, dan `quest_participations.tx_hash`.
- [ ] **15.2** Apply `0011` di Supabase SQL editor; verifikasi:
  - Table `quest_steps` & `quest_step_participations` ada + RLS enabled.
  - Table `quests` tidak punya `quest_type` & `action_params`.
  - Table `quest_participations` tidak punya `tx_hash`.
  - `select count(*) from quest_steps;` > 0 (minimal backfill 1 step per quest). _(manual)_

---

## Cara Tandai Progress

Pas execute step `X.Y`, ubah `- [ ] **X.Y** ...` → `- [x] **X.Y** ...` di file ini. Commit per phase (atau per step kalau mau granular) biar reviewer bisa cocokan diff dengan checkbox.
