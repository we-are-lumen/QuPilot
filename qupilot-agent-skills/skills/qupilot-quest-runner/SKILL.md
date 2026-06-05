---
name: qupilot-quest-runner
description: "Fetch, dispatch, and verify on-chain quests from the QuPilot API by composing the byreal-cli (Solana CLMM/swap) and byreal-perps-cli (Hyperliquid perpetuals) skills. Use whenever the user mentions QuPilot, quests, quest runner, on-chain tasks, quest rewards, agent missions, Byreal quests, RealClaw quests, or asks an agent to complete an on-chain task for them — even if they don't explicitly name QuPilot. Also use when the user wants to list, join, execute, or submit completion proof for any on-chain quest tied to swaps, liquidity, or perp trading on Byreal/Hyperliquid."
metadata:
  qupilot:
    homepage: https://github.com/byreal-git/byreal-agent-skills
    composes:
      - byreal-cli
      - byreal-perps-cli
    env:
      - QUPILOT_API_URL
      - QUPILOT_API_KEY
      - QUPILOT_AGENT_WALLET
---

# QuPilot Quest Runner

This skill teaches an agent the three-phase lifecycle of a QuPilot quest: **fetch** an open quest, **dispatch** each of its steps to the right byreal CLI to execute on-chain, then **verify** completion by submitting per-step tx hashes back to the QuPilot API.

You are not reimplementing trading logic — `byreal-cli` and `byreal-perps-cli` already do that, and they handle wallets, slippage, and confirmations correctly. Your job is to read a quest's structured `steps[]` payload, pick the right CLI command for each step's `step_type`, run it cleanly, and report the resulting tx hash back per step.

> Note: `byreal-perps-cli` is included for **future step types** (perps / Hyperliquid). If you see a perp-like step type today, treat it as **unmapped** and stop (do not guess).

## Before doing anything else

1. Confirm both companion skills are available. If `byreal-cli` or `byreal-perps-cli` isn't installed and the quest requires them, stop and tell the user to install them — don't try to call npm packages directly, the byreal skills encode safety rails (preview-then-confirm, slippage warnings, no key display) that we inherit by composing them.
2. Confirm `QUPILOT_API_URL`, `QUPILOT_API_KEY`, and `QUPILOT_AGENT_WALLET` are set in the environment. If `QUPILOT_API_URL` is missing, stop and ask the user. The default for `QUPILOT_API_URL` is `https://terrahash.xyz/api`.
3. Confirm the agent has a **Byreal wallet configured** (the same Solana wallet that will execute swaps/CLMM and produce tx hashes). If the agent doesn't have a wallet yet, tell them to install/setup Byreal first and stop.
4. If `QUPILOT_API_KEY` is missing, **self-register** to obtain a `qpk_...` key:
   - Call `POST /auth/agent/challenge` with `{ wallet_address: QUPILOT_AGENT_WALLET }` to get a `message`.
   - Sign that exact `message` with the **same wallet used by byreal** (it must match `QUPILOT_AGENT_WALLET`).
   - Call `POST /auth/agent/register` with `{ wallet_address, message, signature }` to receive `plaintext: qpk_...`.
   - QuPilot will auto-create the wallet in its `users` table on first register (no pre-approval needed).
5. Read `references/qupilot-api.md` once at the start of a session — it's the source of truth for endpoint shapes and error codes.

## Local persistence contract (wajib)

Agent harus punya tempat **persist** untuk:
- secrets (API key),
- policy/guardrails (batas amount),
- state eksekusi (participation UUID, step UUID, tx hash) supaya bisa resume / audit kalau agent “lupa” atau runtime restart.
- **run log** (audit trail) yang mencatat semua request/response penting + tx hash on-chain.

Gunakan folder khusus QuPilot, misalnya:
- `./qupilot/.env` **atau** `.env.qupilot` (khusus secrets + policy)
- `./qupilot/state.json` (khusus state dinamis eksekusi quest)
- `./qupilot/runs/<participation_uuid>.json` (log per run/participation, mudah di-debug)

**Aturan penting:**
- Jangan commit file-file ini ke git.
- Kalau agent tidak bisa menulis file di runtime, agent wajib minta user/operator untuk menyimpan nilai-nilai ini secara manual (copy-paste), lalu lanjut setelah terset.

### Format rekomendasi `./qupilot/.env` (secrets + policy)

Minimal:
```bash
QUPILOT_API_URL="https://terrahash.xyz/api"
QUPILOT_API_KEY="qpk_..."
QUPILOT_AGENT_WALLET="<base58>"
```

**WAJIB:** setelah registrasi berhasil dan agent menerima `plaintext: qpk_...`, agent harus:
1) menampilkan nilai key itu ke user (sekali, jangan disensor),
2) secara eksplisit menyuruh user untuk menyimpannya (copy-paste),
3) dan (kalau bisa) menuliskannya ke `./qupilot/.env`.

Guardrail trading (contoh — sesuaikan dengan kebutuhan produk):
```bash
# Kalau quest bilang "swap any amount", agent TIDAK BOLEH swap seluruh balance.
# Wajib pakai allowance/limit ini atau tanya user dulu.
QUPILOT_MAX_SWAP_USD="50"
QUPILOT_REQUIRE_AMOUNT_CONFIRM="true"
```


## The three-phase workflow

### Phase 0 — Agent registration (optional, to obtain `QUPILOT_API_KEY`)

If you do not have an API key yet, you can self-register using your Byreal Solana wallet.
**WAJIB (persistence):** setelah registrasi sukses dan menerima `plaintext: qpk_...`, agent harus memastikan key itu **tersimpan**:
- Prefer: tulis ke `./qupilot/.env` (atau `.env.qupilot`)
- Kalau tidak bisa menulis file: agent wajib minta user untuk menyimpan key tersebut secara manual
Dan setelah itu agent harus lanjut hanya setelah user mengonfirmasi key sudah disimpan.

```bash
QUPILOT_API_KEY="qpk_..."
```


Request a challenge:

```bash
curl -sS -X POST -H "Content-Type: application/json" \
  -d "{\"wallet_address\":\"$QUPILOT_AGENT_WALLET\"}" \
  "$QUPILOT_API_URL/auth/agent/challenge"
```

The response includes a `message`. **Sign that exact string** with the same Solana wallet you will use for execution (your Byreal wallet). Then register:

> Requirement: wallet untuk sign challenge **harus sama** dengan wallet yang byreal gunakan untuk eksekusi on-chain, dan harus match `QUPILOT_AGENT_WALLET`. Kalau beda, registrasi/participation bisa gagal atau reward/claim tidak bisa diproses.

```bash
curl -sS -X POST -H "Content-Type: application/json" \
  -d "{\"wallet_address\":\"$QUPILOT_AGENT_WALLET\",\"message\":\"<challenge-message>\",\"signature\":\"<base58-signature>\"}" \
  "$QUPILOT_API_URL/auth/agent/register"
```

Save the returned `plaintext` as `QUPILOT_API_KEY` (it is shown once).

### Wajib: Run log / audit trail (per participation)

Selain `state.json`, agent **wajib** menyimpan log run supaya kalau verifikasi gagal / ada retry / ada dispute reward, operator bisa audit.

Target file rekomendasi:
- `./qupilot/runs/<participation_uuid>.json`

Minimal isi file (contoh):
```json
{
  "participation_uuid": "....",
  "quest_uuid": "....",
  "agent_wallet": "....",
  "started_at": "ISO",
  "phases": {
    "join": { "ok": true, "join_tx_hash": "..." },
    "steps": [
      {
        "step_uuid": "...",
        "step_type": "swap",
        "action_params": { "from_token": "...", "to_token": "..." },
        "tx_hash": "...",
        "verified": true
      }
    ],
    "complete": { "ok": true, "status": "success", "complete_tx_hash": "..." }
  }
}
```

Kalau agent tidak bisa menulis file, agent wajib print JSON di chat dan menyuruh user menyimpannya (copy-paste ke file).

### Phase 1 — Fetch

List open quests. `GET /quests` is **public** (no auth) and accepts optional `protocol` and `type` filters; do not pass `status` (it isn't a real param):

```bash
curl -sS "$QUPILOT_API_URL/quests?protocol=byreal"
```

The response is a bare `{ "quests": [...] }` object — there is no `{success, data}` envelope. On a non-2xx, the body is `{ "error": { "code", "message" } }`; surface `error.message` to the user verbatim and stop.

To inspect a single quest (you'll need this before joining, to capture each `steps[].uuid`):

```bash
curl -sS "$QUPILOT_API_URL/quests/<quest-uuid>"
```

When presenting the quest list to the user, show:
- `uuid`, `title`, `protocol`, `provider.display_name`
- `reward_per_user` and `reward_token` (always `SOL`, value is a lamports bigint string — divide by 1e9 for display)
- A one-line summary derived from each step's `step_type` + `action_params` (e.g. "swap USDC → USDT")
- `expires_at` rendered as a human-readable countdown
- `participation_count` if useful for popularity

If the user asks "which one should I do," weigh by **reward ÷ estimated execution cost** rather than reward alone — a small reward isn't worth a quest that costs more in slippage and fees than it pays. Be honest about uncertainty; it's better to flag a quest as "needs preview" than to silently rank it high.

### Phase 2 — Join

Once the user picks a quest, **join** it (this is the agent equivalent of "claim"):

```bash
curl -sS -X POST -H "x-api-key: $QUPILOT_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"quest_uuid\":\"<quest-uuid>\",\"agent_wallet_address\":\"$QUPILOT_AGENT_WALLET\"}" \
  "$QUPILOT_API_URL/agent/participations"
```

Save the returned `participation.uuid` — you'll need it for `complete`. There is **no** `claim_token` and there is **no** `abandon` endpoint; if execution fails, just stop and surface the error, or submit `complete` with whatever steps you did finish (the backend will mark the participation `failed` if any step's verification fails).

**WAJIB (persistence):** segera setelah join sukses:
- simpan `participation.uuid`, `join_tx_hash`, dan snapshot `quest.steps[]` (uuid + action_params) ke `./qupilot/state.json` dan `./qupilot/runs/<participation_uuid>.json`.

Then walk `quest.steps[]` in `order_index` order. For each step, look up `step_type` in `references/quest-mapping.md` and run the prescribed byreal command. A few principles regardless of `step_type`:

- **Always `-o json`.** Text output is for humans; we're parsing.
- **Always preview first when the byreal skill exposes a preview.** Skipping preview is exactly the kind of shortcut that turns a $50 swap into a $500 loss.
- **Never “auto-spend” the user's full balance.** If a quest step implies "any amount" (or doesn't specify an amount), you must either:
  - read an explicit allowance from `./qupilot/.env` (recommended), or
  - ask the user to confirm a concrete amount first.
- **Never paste private keys into commands.** The byreal CLIs handle auth via their own SQLite stores or env vars they document themselves.
- **Capture the on-chain signature** (Solana tx hash, base58) per step. Map it back to the originating `quest.steps[].uuid` — the `complete` endpoint requires `{ step_uuid, tx_hash }` pairs.
- **If a CLI command returns `success: false`, stop.** Don't retry with different params. Either submit `complete` with the steps you've finished (and let the backend mark the participation `failed`) or stop and report.

If a step's `step_type` isn't in the mapping table, stop. Surface the type to the user with a note that the skill needs an explicit mapping — don't infer.

#### Amount & allowance guardrails (wajib)

Ini untuk mencegah kasus: quest bilang "swap any amount USDC → HYPE", lalu agent malah swap **semua** USDC.

Rules:
1. Jika step tidak punya amount eksplisit, agent wajib treat itu sebagai "needs user confirmation".
2. Agent harus punya **allowance** yang persistent di `./qupilot/.env` (atau `.env.qupilot`) sebelum bisa auto-execute.
3. Jika allowance tidak ada / tidak cocok, agent wajib stop dan minta user set allowance (atau confirm amount sekali), lalu baru lanjut.

Minimal yang harus agent lakukan sebelum submit transaksi:
- tampilkan quote/preview (output JSON),
- tampilkan amount yang akan dipakai,
- minta konfirmasi user jika `QUPILOT_REQUIRE_AMOUNT_CONFIRM=true` atau step amount tidak eksplisit.

##### Swap amount disclaimer (wajib)

Sebelum benar-benar submit transaksi swap (bukan preview), agent **wajib** mengeluarkan disclaimer eksplisit yang menyatakan:
1) **berapa amount yang akan diswap** (dalam token + estimasi USD),
2) sumber izin/allowance-nya (dari `QUPILOT_MAX_SWAP_USD` / atau dari konfirmasi user),
3) bahwa agent **tidak** akan swap seluruh balance tanpa izin.

Template (wajib, boleh disesuaikan angka/token):

```text
Disclaimer: Saya akan melakukan swap sebesar ~${USD_AMOUNT} (≈ {TOKEN_AMOUNT} {FROM_TOKEN}) sesuai allowance yang diizinkan.
Saya TIDAK akan swap seluruh balance wallet. Jika allowance tidak ada/kurang, saya akan berhenti dan minta konfirmasi.
```

##### Wajib dicatat (persistence)

Untuk setiap step `swap`, agent **wajib** mencatat ke run log (`./qupilot/runs/<participation_uuid>.json`):
- `allowance.max_swap_usd` (nilai yang dipakai)
- `allowance.source` = `env` atau `user_confirm`
- `amount.input_amount` (angka + token)
- `amount.estimated_usd`
- `quote.preview_json` (ringkas / pointer ke file, sesuai kemampuan runtime)

### Phase 3 — Complete (synchronous verification)

Submit one `{ step_uuid, tx_hash }` pair per step you executed. Verification is **synchronous** — the response contains the final `status` immediately, no polling needed:

```bash
curl -sS -X POST -H "x-api-key: $QUPILOT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"steps":[{"step_uuid":"<step-uuid>","tx_hash":"<base58-sig>"}]}' \
  "$QUPILOT_API_URL/agent/participations/<participation-uuid>/complete"
```

Possible `participation.status` values in the response:
- `success` — all steps verified, reward will be distributable.
- `failed` — participation gagal (mis. ada step yang memang sudah ditandai failed oleh backend / atau gagal di proses onchain QuPilot).
- `inprogress` — partial submission; submit the remaining steps in another `complete` call.

When `status` is `success`, tell the user the quest cleared and what `reward_per_user` they earned (lamports → SOL). When `status` is `failed`, quote the `error.message` verbatim — don't soften it, the user needs the actual signal.

**Catatan penting (retry behavior):** jika backend mengembalikan error verifikasi (mis. `TX_NOT_FOUND`, mismatch token mint, dsb), agent harus:
1) mencatat error tersebut ke run log,
2) memperbaiki input (mis. tx hash salah / RPC beda),
3) dan **retry** `complete` tanpa harus join ulang (selama participation masih `inprogress`).

### Phase 4 — Claim reward (agent-controlled wallet)

If the agent controls the claimer wallet (the same Byreal Solana wallet that owns the API key), the agent may claim rewards itself.

Flow:

1. Build an unsigned claim transaction from the API:

```bash
curl -sS -H "x-api-key: $QUPILOT_API_KEY" \
  "$QUPILOT_API_URL/agent/participations/<participation-uuid>/claim-tx"
```

This returns `tx_base64` plus `blockhash` / `last_valid_block_height`.

2. Sign + send the transaction using the agent's Solana wallet tooling (Byreal wallet).
   - The signing key must match `QUPILOT_AGENT_WALLET`.
   - If your tooling cannot sign+broadcast a base64 transaction safely, stop and ask for operator help (do not improvise raw key handling).
   - If there is a supported byreal-cli path to sign/send this tx, use it; otherwise, require a human operator to broadcast.

3. After the tx confirms, sync the claim back to QuPilot so the DB marks it claimed:

```bash
curl -sS -X POST -H "x-api-key: $QUPILOT_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"participation_uuid\":\"<participation-uuid>\",\"claim_tx_hash\":\"<base58-sig>\"}" \
  "$QUPILOT_API_URL/agent/participations/sync-claim"
```

4. Optionally show agent totals (success count + total earned/claimed/unclaimed lamports):

```bash
curl -sS -H "x-api-key: $QUPILOT_API_KEY" "$QUPILOT_API_URL/agent/me/stats"
```

## Hard constraints

These are non-negotiable because they're the difference between a useful agent and a runaway one:

1. **One quest at a time.** Don't fan out and join multiple quests in parallel unless the user explicitly asks for batch execution. Participations hold real value (they reserve the user's slot against `total_reward_pool`) and parallel failure modes are nasty.
2. **No silent retries on on-chain failures.** A rejected swap or order means stop — not "try again with different params." The byreal CLIs already retry their own RPC-level transients; if their final answer is failure, that's the answer.
3. **JSON only for parsing decisions.** If a byreal command's `success` is `true` but the JSON shape doesn't have the field you expected, do not invent a value — surface the shape mismatch to the user. The byreal skills version their CLIs and the contract might have shifted.
4. **Surface API errors verbatim.** QuPilot's backend knows things you don't (e.g. that the user already has an in-progress participation on this quest — `PARTICIPATION_INPROGRESS_EXISTS`). Don't paraphrase; quote.
5. **Preview big trades.** For any swap step where you can estimate notional ≥ $1000 (or its perp equivalent), preview the trade and ask the user to confirm before submitting, even if the rest of the flow is automated. The byreal skills enforce this themselves above $1k — don't try to bypass.
6. **Never invent fields.** The backend does not accept `claim_token`, `agent_metadata`, `proof`, or `status` query params. Stick to what `references/qupilot-api.md` documents.

## Output / UX conventions (important)

When you present QuPilot content back to the user, the output should be readable in both a UI chat and a plain terminal.

1. **Always structure the response**:
   - `Summary` (1–3 lines)
   - `Key details` (bullets)
   - `Next actions` (numbered)
2. **If you show many items, use a table** (Markdown table is preferred).
3. **If you're in a plain terminal**, keep tables aligned and short:
   - Fixed-width columns
   - Truncate long UUIDs like `123e...9abc`
   - Put full UUIDs in a “Details” section below.
4. **When showing JSON**, always wrap in fenced code blocks and include only the fields that matter for the decision. Avoid dumping huge payloads.

Example (terminal-friendly table):

```text
UUID         Title                     Reward     Expires
123e...9abc  Swap USDC→USDT (Byreal)   0.01 SOL   3h 12m
456a...1def  Open CLMM position        0.02 SOL   1d 04h
```

## Scheduler / Dispatcher mode (OpenClaw / Hermes)

If your agent runtime supports scheduling (e.g. OpenClaw/Hermes), you may run QuPilot in “autopilot” mode. In this mode, the agent periodically fetches open quests, picks the best candidate, then executes it end-to-end.

### Recommended cadence

- Poll `GET /quests` every **5–10 minutes** (avoid tighter loops).
- Use backoff on failure: 10s → 30s → 60s → 5m.

### Safety rules (must follow)

1. **One quest at a time per agent wallet.**
2. **Never re-join the same quest repeatedly.**
   - If join returns `PARTICIPATION_INPROGRESS_EXISTS` or `PARTICIPATION_ALREADY_COMPLETED`, mark the quest as “skip for this wallet” for a cooldown window (e.g. 1–6 hours).
3. **No silent retries for trades.** If a byreal command fails (`success=false`), stop that run.
4. **Do not claim if you cannot sign.** Only claim if the agent controls the wallet matching `QUPILOT_AGENT_WALLET`.

### Selection heuristic (simple)

Pick the quest with the highest **reward_per_user / estimated_cost**, ignoring anything that:
- expires too soon (e.g. < 10 minutes),
- requires an unsupported `step_type`,
- uses tokens you can’t handle safely.

### Pseudocode loop

```text
Every 5-10 minutes:
  - Ensure Byreal wallet exists and env vars are set
  - Ensure ./qupilot/.env (or .env.qupilot) exists for secrets + policy
  - If QUPILOT_API_KEY missing: challenge -> sign -> register -> persist to ./qupilot/.env
  - quests = GET /quests
  - candidates = filter quests by protocol/type + expiry + not in cooldown
  - pick best candidate
  - participation = POST /agent/participations
  - for each step:
      load allowance/policy -> preview -> confirm amount (if needed) -> execute via byreal-cli -> capture tx_hash
      persist step progress to ./qupilot/state.json
  - POST /agent/participations/:uuid/complete
  - if success and claim enabled:
      GET /agent/participations/:uuid/claim-tx
      sign+broadcast
      POST /agent/participations/sync-claim
  - GET /agent/me/stats (optional) and print summary table
```

### Example scheduler output (terminal-friendly)

```text
Run      Picked Quest     Result    Earned    Claimed   Notes
18:00    123e...9abc      success   0.01 SOL  yes       swap USDC→USDT
18:10    9f00...bada      skipped   -         -         expires <10m
18:20    456a...1def      failed    -         -         byreal-cli: INSUFFICIENT_BALANCE
```

## What to keep in your head vs. consult on demand

- **In head**: the four-phase shape (fetch → join → complete → claim/sync claim), the `x-api-key` header, the bare-object response shape, the hard constraints, and the scheduler safety rules above.
- **Consult `references/qupilot-api.md`** when you need exact endpoint paths, body shapes, or error codes.
- **Consult `references/quest-mapping.md`** every time you dispatch a step — even when you "remember" the mapping. The byreal CLIs change flags occasionally and the file is the canonical source.

## Examples

**Example 1 — list and pick:**
> User: "What's on my QuPilot queue?"
>
> Agent: calls `GET /quests`, renders a table of `title / protocol / reward_per_user / expires_at`, summarizes each quest's `steps[]`, recommends one by reward÷estimated-cost.

**Example 2 — register then execute end-to-end:**
> User: "Do quest <uuid> for me."
>
> Agent: if `QUPILOT_API_KEY` is missing, run Phase 0 (challenge → sign → register) to obtain it. Then: `GET /quests/<uuid>` to capture `steps[].uuid`, `POST /agent/participations` with `{ quest_uuid, agent_wallet_address }`, walks each step through the mapping → runs the byreal command with `-o json` → captures the Solana signature, then `POST /agent/participations/<participation-uuid>/complete` with all `{ step_uuid, tx_hash }` pairs, reports the final `status` and reward.

**Example 3 — graceful failure:**
> User: "Do quest <uuid> for me."
>
> Agent: joins it, runs `byreal-cli swap execute`, sees `{success: false, error: {code: "INSUFFICIENT_BALANCE"}}`, stops, tells the user: "Your wallet doesn't hold enough SOL for this swap. Top up and rerun — the participation is left `inprogress` and there's no abandon endpoint, but it will time out at `expires_at`."

**Example 4 — partial completion then resume:**
> Quest has 2 steps. Step 1 succeeds on-chain; step 2 errors out before broadcast.
>
> Agent: submits `complete` with just step 1's `{ step_uuid, tx_hash }`. Response is `status: inprogress`. Agent reports state and asks the user whether to retry step 2 or abandon (let it expire).

## Why this skill exists (not just what)

QuPilot's value is that *any* AI agent can clear on-chain tasks for a user. That promise only holds if the dispatch layer is boring, deterministic, and refuses to improvise on safety-critical paths. This skill is intentionally narrow: it's a router from quest step descriptions to known-good CLI commands, with explicit per-step verification. When in doubt, prefer "stop and ask" over "try and see" — the on-chain blast radius makes silent failures genuinely costly.
