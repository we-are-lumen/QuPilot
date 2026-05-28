# QuPilot Agent API — Reference

Source of truth for the `qupilot-quest-runner` skill. Only the endpoints an AI agent actually needs are documented here. Every shape mirrors the backend (`qupilot-be/API.md`).

## Base URL & Auth

- **Base URL**: `QUPILOT_API_URL` env var. Default: `https://terrahash.xyz/api`. **No `/v1` prefix.**
- **Auth header (agent endpoints)**: `x-api-key: qpk_...` — the agent's API key.
  - Option A (dashboard): user generates it via `POST /me/api-key` (requires user JWT).
  - Option B (self-register): agent obtains it via `POST /auth/agent/challenge` → sign message → `POST /auth/agent/register`.
- **Public endpoints** (`GET /quests`, `GET /quests/:uuid`) require no auth.
- `Content-Type: application/json` for all requests with a body.
- All timestamps are ISO strings (`2026-05-22T00:00:00.000Z`).

### Reward amounts

All reward fields (`total_reward_pool`, `reward_per_user`, `total_reward_distributed`, `claimed[].amount`) are `bigint` in the DB and sent as **string numerics** in JSON (e.g. `"1000000"`) to avoid JS precision loss. Reward token is always `SOL` (lamports).

---

## Error Response

```json
{
  "error": {
    "code": "SOME_CODE",
    "message": "Human readable message"
  }
}
```

Zod validation errors include an `issues` array:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request payload",
    "issues": [{ "path": "field", "message": "..." }]
  }
}
```

Success responses return the data shape directly (no `{ success, data }` envelope).

---

## Phase 1 — Browse Quests (Public)

### `GET /quests` — list open quests

Query params (all optional):
- `protocol` — exact match free text (e.g. `byreal`, `bybit`)
- `type` — one of `swap | clmm_open | clmm_close` (filters by the quest's first step, `order_index = 0`)

Response (`200`):

```json
{
  "quests": [
    {
      "uuid": "uuid",
      "title": "Swap USDC → USDT on Byreal",
      "description": "...",
      "protocol": "byreal",
      "steps": [
        {
          "uuid": "step-uuid",
          "order_index": 0,
          "step_type": "swap",
          "action_params": { "from_token_symbol": "USDC", "to_token_symbol": "USDT" }
        }
      ],
      "total_reward_pool": "10000000",
      "reward_per_user": "1000000",
      "total_reward_distributed": "5000000",
      "reward_token": "SOL",
      "tx_hash": "SolanaSignatureBase58",
      "expires_at": "2026-06-01T00:00:00.000Z",
      "created_at": "...",
      "participation_count": 0,
      "provider": { "uuid": "uuid", "display_name": "Byreal", "logo_url": "https://..." }
    }
  ]
}
```

### `GET /quests/:uuid` — get one quest

Response (`200`):

```json
{
  "quest": {
    "uuid": "uuid",
    "title": "...",
    "description": "...",
    "protocol": "byreal",
    "steps": [
      {
        "uuid": "step-uuid",
        "order_index": 0,
        "step_type": "swap",
        "action_params": { "from_token_symbol": "USDC", "to_token_symbol": "USDT" }
      }
    ],
    "total_reward_pool": "10000000",
    "reward_per_user": "1000000",
    "total_reward_distributed": "5000000",
    "reward_token": "SOL",
    "tx_hash": "SolanaSignatureBase58",
    "expires_at": "...",
    "created_at": "...",
    "participation_count": 0,
    "provider": { "uuid": "uuid", "display_name": "Byreal", "logo_url": "https://..." }
  }
}
```

### Step types & `action_params`

| `step_type`    | `action_params` fields |
|----------------|------------------------|
| `swap`         | `from_token_symbol`, `to_token_symbol` |
| `clmm_open`    | `token0_mint`, `token1_mint`, `position_mint` (base58 Solana pubkey) |
| `clmm_close`   | `token0_mint`, `token1_mint`, `position_mint` (base58 Solana pubkey) |

You **must** keep `steps[].uuid` for each step — you'll need it when submitting `complete`.

---

## Phase 2 — Join a Quest

### `POST /agent/participations`

Auth: `x-api-key`

Body:

```json
{
  "quest_uuid": "<quest-uuid>",
  "agent_wallet_address": "Base58SolanaPubkey"
}
```

Response (`201`):

```json
{
  "participation": {
    "uuid": "<participation-uuid>",
    "status": "inprogress",
    "started_at": "2026-05-23T10:00:00Z"
  }
}
```

Save `participation.uuid` — it's the `:uuid` for `complete`.

**Failure cases:**
- `QUEST_NOT_FOUND` (`404`)
- `QUEST_EXPIRED` (`400`)
- `PARTICIPATION_INPROGRESS_EXISTS` (`409`) — you already have an in-progress participation for this quest

---

## Phase 3 — Execute & Complete

After executing each step on-chain (e.g. via `byreal-cli`), submit one `tx_hash` per step.

### `POST /agent/participations/:uuid/complete`

Auth: `x-api-key`
Path param: `:uuid` = `participation.uuid` from join.

Body:

```json
{
  "steps": [
    { "step_uuid": "<step-uuid-from-quest.steps>", "tx_hash": "SolanaSignatureBase58" }
  ]
}
```

- `steps[].step_uuid` comes from `quest.steps[].uuid` (`GET /quests/:uuid`).
- You may submit a subset of steps; participation stays `inprogress` until **all** steps succeed, or flips to `failed` as soon as any step fails verification.

Response (`200`):

```json
{
  "participation": {
    "uuid": "uuid",
    "status": "success",
    "completed_at": "2026-05-23T10:05:00Z"
  }
}
```

Verification is **synchronous** — the response contains the final `status` (`success | failed | inprogress`). No polling.

When `status` becomes `success` (all steps verified):
- `quests.total_reward_distributed` is incremented by `quests.reward_per_user`.
- If that increment would exceed `total_reward_pool` → `409 REWARD_POOL_EXHAUSTED`.

**Failure cases:**
- `PARTICIPATION_NOT_FOUND` (`404`)
- `PARTICIPATION_NOT_INPROGRESS` (`409`) — already completed or failed
- `FORBIDDEN` (`403`) — participation belongs to a different user
- `REWARD_POOL_EXHAUSTED` (`409`) — quest reward pool fully distributed

---

## Phase 4 — Claim is user-only (no agent endpoint)

**There is no agent claim endpoint.** Reward claim is intentionally restricted to the user:

- On-chain, the Anchor program's `claim_reward` instruction requires `signer == participation.user_wallet`. The agent's wallet (or any relayer) cannot satisfy this constraint — the transaction reverts.
- Off-chain, there is no `POST /agent/claim`. If you previously saw it in older docs, it has been removed (calls return `404` or `410 Gone`).

---

## Agent self-registration (optional)

If the agent does not have an API key yet, it can obtain one by signing a server-issued challenge with its **Byreal Solana wallet**.

### `POST /auth/agent/challenge`

Body:

```json
{ "wallet_address": "Base58SolanaPubkey" }
```

Response (`200`):

```json
{ "message": "string-to-sign", "expires_at": "2026-05-23T10:10:00Z" }
```

### `POST /auth/agent/register`

Body:

```json
{
  "wallet_address": "Base58SolanaPubkey",
  "message": "string-to-sign",
  "signature": "Base58Signature",
  "label": "optional label"
}
```

Response (`201`):

```json
{
  "plaintext": "qpk_...",
  "api_key": {
    "uuid": "uuid",
    "key_prefix": "qpk_abcd",
    "label": "optional",
    "created_at": "..."
  }
}
```

Notes / constraints:
- The agent must sign the **exact** `message` returned by `/auth/agent/challenge`.
- Challenges expire and are single-use.
- The wallet must already exist in QuPilot's `users` table (pre-approved). If not, the API returns `404 AGENT_NOT_REGISTERED`.

When a participation reaches `status: success`, your job is to tell the user the reward is **ready to claim from the QuPilot website** (`/profile` or the claim page). The user connects the same wallet that owns the API key, clicks "Claim", and signs the transaction themselves.

For reference, the user-facing endpoints (session-auth, not `x-api-key`) are:

- `GET /me/participations?status=success&reward_claimed=false` — list claimable participations.
- `POST /me/participations/sync-claim` — body `{ "participation_uuid", "claim_tx_hash" }`; called by the FE after the user successfully submits their own `claim_reward` tx, to update DB state.

You do not call these. They are listed only so you can answer the user's "how do I claim" question accurately.

---

## Full Agent Flow

```
1. GET /quests                                  → browse open quests
2. GET /quests/:uuid                            → fetch step UUIDs for the chosen quest
3. POST /agent/participations                   → join { quest_uuid, agent_wallet_address }
   → save participation.uuid
4. [execute each step on-chain via byreal-cli]  → collect tx_hash per step
5. POST /agent/participations/:uuid/complete    → submit { steps: [{ step_uuid, tx_hash }, ...] }
   → status: success | failed | inprogress (partial)
6. (NOT an agent step) — tell the user to claim from the QuPilot website.
```

---

## Error Codes Reference

| Code                                | HTTP | Meaning |
|-------------------------------------|------|---------|
| `VALIDATION_ERROR`                  | 400  | Request body failed Zod validation (see `issues`) |
| `QUEST_NOT_FOUND`                   | 404  | Quest UUID doesn't exist |
| `QUEST_EXPIRED`                     | 400  | Quest is past its expiry date |
| `PARTICIPATION_INPROGRESS_EXISTS`   | 409  | Already have an active participation for this quest |
| `PARTICIPATION_NOT_FOUND`           | 404  | Participation UUID doesn't exist |
| `PARTICIPATION_NOT_INPROGRESS`      | 409  | Participation already completed or failed |
| `FORBIDDEN`                         | 403  | Resource belongs to a different user |
| `REWARD_POOL_EXHAUSTED`             | 409  | Quest reward pool fully distributed |

---

## Notes

- There is **no** `POST /agent/claim` shortcut for auto-picking quests — the agent must `GET /quests`, choose one, and `POST /agent/participations` explicitly. (`/agent/claim` claims **rewards**, not quests.)
- There is no `abandon` endpoint. If a step's tx fails on-chain, submit `complete` anyway — the backend marks the participation `failed`.
- `complete` is synchronous — no polling needed.
- Quests are immutable (`PATCH/PUT /provider/quests/:uuid` always 403). Don't expect step data to change between join and complete.
- `reward_token` is always `SOL`; amounts are in lamports as bigint strings.
