# QuPilot Backend API (ringkas untuk FE)

## Konvensi

- Base URL: `{API_URL}` (contoh: `http://localhost:3000`)
- Content-Type: `application/json`
- Semua timestamp: ISO string (`2026-05-22T00:00:00.000Z`)
- **Reward amount:** semua nilai reward (`quests.total_reward_pool`, `quests.reward_per_user`, `quests.total_reward_distributed`, `claimed[].amount`, `leaderboard.total_reward`) di-store sebagai `bigint` di DB dan dikirim sebagai **string numeric** di JSON response (mis. `"1000000"`) untuk menghindari precision loss di JavaScript. FE pakai `BigInt(...)` atau library decimal kalau perlu hitung. Saat create quest, body boleh kirim string atau number — server akan coerce ke bigint. Note: `quest_participations` **tidak** punya kolom reward — nominal claim direfer ke `quests.reward_per_user` yang immutable.

## Error Response

```json
{
  "error": {
    "code": "SOME_CODE",
    "message": "Human readable message"
  }
}
```

Validation error (Zod):

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request payload",
    "issues": [
      { "path": "field", "message": "..." }
    ]
  }
}
```

## Auth

### Wallet JWT (role: user / user_provider)

Header:

```
Authorization: Bearer <jwt>
```

### Agent (API Key)

Header:

```
x-api-key: qpk_...
```

## Health

### GET /health

Response:

```json
{ "ok": true }
```

## Auth — Wallet (User / Provider)

### POST /auth/user/login

Body:

```json
{
  "wallet_address": "SolanaPubkeyBase58",
  "signature": "SolanaSignatureBase58",
  "message": "string yang ditandatangani wallet",
  "role": "user | user_provider (opsional)",
  "display_name": "wajib kalau role=user_provider (opsional)",
  "logo_url": "opsional"
}
```

First-time login (wallet belum terdaftar) — 200 Response:

```json
{ "registered": false }
```

Registered login — 200/201 Response:

```json
{
  "registered": true,
  "token": "jwt",
  "user": {
    "uuid": "uuid",
    "wallet_address": "SolanaPubkeyBase58",
    "role": "user | user_provider",
    "display_name": "string | null",
    "logo_url": "string | null",
    "created_at": "..."
  }
}
```

- Jika request mengirim `role` tapi berbeda dengan role yang sudah tersimpan untuk wallet tsb → 409 `ROLE_MISMATCH`.

## Providers (Public)

### GET /providers

200 Response:

```json
{
  "providers": [
    {
      "uuid": "uuid",
      "display_name": "Byreal",
      "logo_url": "https://...",
      "created_at": "...",
      "spotlight": false
    }
  ]
}
```

## Quests — Provider

Protocol: free text (contoh: `byreal`, `bybit`, `sui`)  
Step type enum: `swap | clmm_open | clmm_close`

### POST /provider/quests

Auth: Wallet JWT dengan role=user_provider

Body:

```json
{
  "quest_uuid": "uuid-v4-generated-by-client",
  "title": "Swap on Byreal",
  "description": "Lakukan swap ...",
  "protocol": "byreal",
  "steps": [
    {
      "step_type": "swap",
      "action_params": {
        "from_token_symbol": "USDC",
        "to_token_symbol": "USDT"
      }
    }
  ],
  "total_reward_pool": "10000000",
  "reward_per_user": "1000000",
  "reward_token": "SOL",
  "tx_hash": "SolanaSignatureBase58",
  "expires_at": "2026-06-01T00:00:00.000Z"
}
```

- `quest_uuid`: UUID v4 yang dibuat di client sebelum deposit. Dipakai untuk derive `quest_id` on-chain (sha256 UUID → 32 bytes).
- `steps`: urutan step yang harus dieksekusi agent. Minimal 1 item. Bentuk `action_params` divalidasi berdasarkan `step_type`.
  - `swap`: `from_token_symbol`, `to_token_symbol`
  - `clmm_open` / `clmm_close`: `token0_mint`, `token1_mint`, `position_mint` (base58 Solana pubkey)
- `total_reward_pool`: total reward (bigint) yang tersedia untuk quest ini — batas atas akumulasi distribusi.
- `reward_per_user`: reward (bigint) yang diterima setiap user yang berhasil men-complete quest.
- `reward_token`: selalu `SOL` (reward dibayar dalam lamports).
- `tx_hash`: signature transaksi deposit `create_quest` (Anchor) yang dibuat provider (required). Server akan verifikasi ke Solana RPC dan parse event `QuestCreated`.
- Validasi: `total_reward_pool >= reward_per_user` (kalau lebih kecil, 400 VALIDATION_ERROR).
- Kedua nilai diterima sebagai string atau integer; server reject nilai negatif / non-integer.

201 Response:

```json
{
  "quest": {
    "uuid": "uuid",
    "title": "...",
    "description": "...",
    "protocol": "byreal",
    "steps": [{ "uuid": "uuid", "order_index": 0, "step_type": "swap", "action_params": { "from_token_symbol": "USDC", "to_token_symbol": "USDT" } }],
    "total_reward_pool": "10000000",
    "reward_per_user": "1000000",
    "total_reward_distributed": "0",
    "reward_token": "SOL",
    "tx_hash": "SolanaSignatureBase58",
    "quest_pool_pda": "Base58SolanaPubkey",
    "quest_id_onchain": "\\x<hex32bytes>",
    "expires_at": "...",
    "created_at": "..."
  }
}
```

### GET /provider/quests

Auth: Wallet JWT dengan role=user_provider

200 Response:

```json
{
  "quests": [
    {
      "uuid": "uuid",
      "title": "...",
      "description": "...",
      "protocol": "byreal",
      "steps": [{ "uuid": "uuid", "order_index": 0, "step_type": "swap", "action_params": { "from_token_symbol": "USDC", "to_token_symbol": "USDT" } }],
      "total_reward_pool": "10000000",
      "reward_per_user": "1000000",
      "total_reward_distributed": "5000000",
      "reward_token": "SOL",
      "tx_hash": "SolanaSignatureBase58",
      "expires_at": "...",
      "created_at": "...",
      "participation_count": 0
    }
  ]
}
```

`total_reward_distributed` = akumulasi reward (bigint) yang sudah diberikan ke participation `status=success` untuk quest ini. Di-increment di server saat `POST /agent/participations/:uuid/complete` berhasil verify tx.

### GET /provider/quests/:uuid

Auth: Wallet JWT dengan role=user_provider

200 Response:

```json
{
  "quest": {
    "uuid": "uuid",
    "title": "...",
    "description": "...",
    "protocol": "byreal",
    "steps": [{ "uuid": "uuid", "order_index": 0, "step_type": "swap", "action_params": { "from_token_symbol": "USDC", "to_token_symbol": "USDT" } }],
    "total_reward_pool": "10000000",
    "reward_per_user": "1000000",
    "total_reward_distributed": "5000000",
    "reward_token": "SOL",
    "tx_hash": "SolanaSignatureBase58",
    "expires_at": "...",
    "created_at": "..."
  },
  "analytics": { "total": 0, "success": 0, "failed": 0, "success_rate": 0 }
}
```

### PATCH /provider/quests/:uuid

Auth: Wallet JWT dengan role=user_provider  
Selalu 403 (immutable).

### PUT /provider/quests/:uuid

Auth: Wallet JWT dengan role=user_provider  
Selalu 403 (immutable).

## Quests — Public

### GET /quests

Query:

- `protocol` (optional): free text (exact match)
- `type` (optional): `swap | clmm_open | clmm_close` (filter berdasarkan first step / `order_index = 0`)

200 Response:

```json
{
  "quests": [
    {
      "uuid": "uuid",
      "title": "...",
      "description": "...",
      "protocol": "byreal",
      "steps": [{ "uuid": "uuid", "order_index": 0, "step_type": "swap", "action_params": { "from_token_symbol": "USDC", "to_token_symbol": "USDT" } }],
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
  ]
}
```

### GET /providers/:uuid/quests

Public. Response sama seperti `GET /quests`.

### GET /quests/:uuid

Public.

200 Response:

```json
{
  "quest": {
    "uuid": "uuid",
    "title": "...",
    "description": "...",
    "protocol": "byreal",
    "steps": [{ "uuid": "uuid", "order_index": 0, "step_type": "swap", "action_params": { "from_token_symbol": "USDC", "to_token_symbol": "USDT" } }],
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

### GET /public/highlights

Public. Untuk homepage/landing: ambil **3 quest dengan total reward pool terbesar** dan **3 provider dengan total deposit reward pool terbesar**.

200 Response:

```json
{
  "top_quests": [
    {
      "uuid": "uuid",
      "title": "...",
      "description": "...",
      "protocol": "byreal",
      "steps": [{ "uuid": "uuid", "order_index": 0, "step_type": "swap", "action_params": { "from_token_symbol": "USDC", "to_token_symbol": "USDT" } }],
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
  ],
  "top_providers": [
    {
      "uuid": "uuid",
      "display_name": "Byreal",
      "logo_url": "https://...",
      "total_deposit_reward_pool": "25000000"
    }
  ]
}
```

- `top_quests`: hanya quest yang belum expired.
- `total_deposit_reward_pool`: provider diambil dari `users` dengan `role=user_provider`, lalu di-sum dari semua `quests.total_reward_pool` yang dibuat provider tsb (bigint sebagai string).

## Participations — User

### GET /me/participations

Auth: User JWT

200 Response:

```json
{
  "participations": [
    {
      "uuid": "uuid",
      "status": "inprogress",
      "reward_claimed": false,
      "started_at": "...",
      "completed_at": null,
      "quest": {
        "uuid": "uuid",
        "title": "...",
        "description": "...",
        "protocol": "byreal",
        "total_reward_pool": "10000000",
        "reward_per_user": "1000000",
        "total_reward_distributed": "5000000",
        "reward_token": "SOL",
        "tx_hash": "SolanaSignatureBase58",
        "expires_at": "...",
        "created_at": "...",
        "provider": { "uuid": "uuid", "display_name": "Byreal", "logo_url": "https://..." }
      }
    }
  ]
}
```

Nominal reward yang akan diterima user (kalau claim) di-refer dari `quest.reward_per_user`. `quest_participations` sengaja tidak punya kolom reward sendiri karena `quests.reward_per_user` immutable setelah quest dibuat.

### GET /me/participations/:questUuid

Auth: User JWT

200 Response:

```json
{
  "participation": {
    "uuid": "uuid",
    "status": "success",
    "reward_claimed": false,
    "started_at": "...",
    "completed_at": "...",
    "can_claim": true,
    "quest": {
      "uuid": "uuid",
      "title": "...",
      "description": "...",
      "protocol": "byreal",
      "total_reward_pool": "10000000",
      "reward_per_user": "1000000",
      "total_reward_distributed": "5000000",
      "reward_token": "SOL",
      "tx_hash": "SolanaSignatureBase58",
      "expires_at": "...",
      "created_at": "...",
      "provider": { "uuid": "uuid", "display_name": "Byreal", "logo_url": "https://..." }
    }
  }
}
```

### POST /me/participations/sync-claim

Auth: User JWT

Body:

```json
{ "participation_uuid": "uuid", "claim_tx_hash": "SolanaSignatureBase58" }
```

200 Response:

```json
{ "ok": true }
```

## API Key — User (untuk Agent)

### POST /me/api-key

Auth: User JWT

Body:

```json
{ "label": "trading-bot" }
```

201 Response (plaintext hanya muncul sekali):

```json
{
  "plaintext": "qpk_....",
  "api_key": { "uuid": "uuid", "key_prefix": "qpk_abcd", "label": "trading-bot", "created_at": "..." }
}
```

### GET /me/api-key

Auth: User JWT

200 Response:

```json
{
  "api_key": {
    "uuid": "uuid",
    "key_prefix": "qpk_abcd",
    "label": "trading-bot",
    "created_at": "...",
    "last_used_at": "..."
  }
}
```

Jika tidak ada key aktif:

```json
{ "api_key": null }
```

### DELETE /me/api-key

Auth: User JWT

200 Response:

```json
{ "revoked": true }
```

## Agent

### POST /agent/participations

Auth: `x-api-key`

Body:

```json
{ "quest_uuid": "quest_uuid", "agent_wallet_address": "Base58SolanaPubkey" }
```

201 Response:

```json
{
  "participation": {
    "uuid": "uuid",
    "status": "inprogress",
    "started_at": "...",
    "quest_pool_pda": "Base58Pda",
    "participation_pda": "Base58Pda",
    "join_tx_hash": "SolanaSignatureBase58"
  }
}
```

### POST /agent/participations/:uuid/complete

Auth: `x-api-key`

Body:

```json
{
  "steps": [
    { "step_uuid": "uuid", "tx_hash": "SolanaSignatureBase58" }
  ]
}
```

200 Response:

```json
{
  "participation": {
    "uuid": "uuid",
    "status": "success",
    "completed_at": "...",
    "quest_pool_pda": "Base58Pda",
    "participation_pda": "Base58Pda",
    "complete_tx_hash": "SolanaSignatureBase58"
  }
}
```

Catatan:
- `steps[].step_uuid` diambil dari `quest.steps[].uuid` (lihat `GET /quests/:uuid`).
- Request boleh mengirim sebagian step; response bisa tetap `status=inprogress` sampai semua step berhasil / ada step yang gagal.

Claim reward adalah user-only dan dilakukan lewat website (user connect wallet dan sign tx `claim_reward`). Tidak ada endpoint `POST /agent/claim`.

## Leaderboard (Public)

### GET /leaderboard

Query:

- `limit` (optional, max 100)

200 Response:

```json
{
  "entries": [
    { "user_uuid": "uuid", "wallet_address": "SolanaPubkeyBase58", "total_reward": "10000000", "success_rate": 0.8 }
  ]
}
```

`total_reward` di-sum dari `quests.reward_per_user` untuk participation `status=success AND reward_claimed=true`. Bigint sebagai string.

## Contoh Curl Singkat

Wallet login:

```bash
curl -sS '{API_URL}/auth/user/login' \
  -H 'content-type: application/json' \
  -d '{"wallet_address":"...","signature":"...","message":"..."}'
```

User generate API key:

```bash
curl -sS '{API_URL}/me/api-key' \
  -H 'content-type: application/json' \
  -H 'authorization: Bearer <user_jwt>' \
  -d '{"label":"agent-1"}'
```
