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

This skill teaches an agent the end-to-end lifecycle of a QuPilot quest:
1) **Fetch** an open quest,
2) **Join** (create a participation),
3) **Execute** each on-chain step via the right byreal CLI,
4) **Complete** by submitting per-step tx hashes back to the QuPilot API for synchronous verification,
5) (Optional) **Claim** rewards if the agent controls the claimer wallet.

> Note: There is also an optional **registration** phase if `QUPILOT_API_KEY` is missing (self-register to obtain a key).

You are not reimplementing trading logic — `byreal-cli` and `byreal-perps-cli` already do that, and they handle wallets, slippage, and confirmations correctly. Your job is to read a quest's structured `steps[]` payload, pick the right CLI command for each step's `step_type`, run it cleanly, and report the resulting tx hash back per step.

> Note: `byreal-perps-cli` is included for **future step types** (perps / Hyperliquid). If you see a perp-like step type today, treat it as **unmapped** and stop (do not guess).

## Network model (HYBRID — MUST understand)

QuPilot (program + rewards) and Byreal (swap/CLMM) can run on **different Solana networks**.

In our current setup, assume this HYBRID model unless the user/operator says otherwise:
- **Byreal swap/CLMM tx (proof)**: **mainnet**
- **QuPilot program tx (join/complete/claim + rewards state)**: **devnet**

This is why the same quest flow can touch two clusters:
- Step tx hashes (`swap`, `clmm_*`) come from mainnet (Byreal).
- Participation/reward state is tracked by the QuPilot program (devnet).

### Phase → network mapping

- Fetch quest list/detail: HTTP only (no Solana network)
- Join participation: QuPilot program **devnet** (`join_tx_hash` is a devnet tx)
- Execute steps:
  - `swap`, `clmm_open`, `clmm_close`, `clmm_copy`: **mainnet** (Byreal)
- Complete:
  - verify step tx hashes: **mainnet**
  - mark participation complete/failed: QuPilot program **devnet** (`complete_tx_hash` is a devnet tx)
- Claim:
  - claim tx: QuPilot program **devnet**

### RPC env vars (MUST set explicitly)

Use two RPC URLs:
- `SOLANA_RPC_URL_BYREAL` → mainnet (example: `https://api.mainnet.solana.com`)
- `SOLANA_RPC_URL_QUPILOT` → devnet (example: `https://api.devnet.solana.com`)

If an agent sees `TX_NOT_FOUND` / `RPC_NETWORK_MISMATCH`, it's almost always a misconfigured RPC.

## Before doing anything else

1. Confirm both companion skills are available. If `byreal-cli` or `byreal-perps-cli` isn't installed and the quest requires them, stop and tell the user to install them — don't try to call npm packages directly, the byreal skills encode safety rails (preview-then-confirm, slippage warnings, no key display) that we inherit by composing them.
2. Confirm `QUPILOT_API_URL`, `QUPILOT_API_KEY`, and `QUPILOT_AGENT_WALLET` are set in the environment.
   - If `QUPILOT_API_URL` is missing, **default it to** `https://terrahash.xyz/api` and continue (unless the user/operator explicitly overrides it).
3. Confirm the agent has a **Byreal wallet configured** (the same Solana wallet that will execute swaps/CLMM and produce tx hashes). If the agent doesn't have a wallet yet, tell them to install/setup Byreal first and stop.
4. If `QUPILOT_API_KEY` is missing, **self-register** to obtain a `qpk_...` key:
   - Call `POST /auth/agent/challenge` with `{ wallet_address: QUPILOT_AGENT_WALLET }` to get a `message`.
   - Sign that exact `message` with the **same wallet used by byreal** (it must match `QUPILOT_AGENT_WALLET`).
   - Call `POST /auth/agent/register` with `{ wallet_address, message, signature }` to receive `plaintext: qpk_...`.
   - QuPilot will auto-create the wallet in its `users` table on first register (no pre-approval needed).
5. Read the API + mapping references once at the start of a session — they're the source of truth for endpoint shapes, error codes, and step routing.
   - Canonical (GitHub):
     - Skill: https://github.com/we-are-lumen/QuPilot/blob/main/qupilot-agent-skills/skills/qupilot-quest-runner/SKILL.md
     - Quest mapping: https://github.com/we-are-lumen/QuPilot/blob/main/qupilot-agent-skills/skills/qupilot-quest-runner/references/quest-mapping.md
     - QuPilot API: https://github.com/we-are-lumen/QuPilot/blob/main/qupilot-agent-skills/skills/qupilot-quest-runner/references/qupilot-api.md
   - Local paths (relative to this skill folder):
     - `references/quest-mapping.md`
     - `references/qupilot-api.md`

## Local persistence contract (MUST)

The agent MUST have a persistent place to store:
- secrets (API key),
- policy / guardrails (amount limits),
- execution state (participation UUID, step UUID, tx hash) so it can resume / audit if the runtime restarts,
- a **run log** (audit trail) that records all important requests/responses + on-chain tx hashes.

Use a dedicated QuPilot folder. Recommended **base directory**:
- Default: `./qupilot/` (relative to the *project/repo root*; if the repo root is not well-defined at runtime, fall back to the current working directory).
- If the runtime has its own configured persistent storage path, an operator may redirect the base directory there (as long as it stays consistent for resume).

Recommended file structure:
- `./qupilot/.env` **or** `.env.qupilot` (secrets + policy)
- `./qupilot/state.json` (dynamic execution state)
- `./qupilot/runs/<participation_uuid>.json` (per-run/per-participation log; easy to debug)

**Important rules:**
- Do not commit these files to git.
- If the agent cannot write files at runtime, it MUST ask the user/operator to save the values manually (copy-paste) and only continue after they confirm it is saved.

### Recommended `./qupilot/.env` format (secrets + policy)

Minimal:
```bash
QUPILOT_API_URL="https://terrahash.xyz/api"
QUPILOT_API_KEY="qpk_..."
QUPILOT_AGENT_WALLET="<base58>"
```

**MUST:** after registration succeeds and the agent receives `plaintext: qpk_...`, the agent MUST:
1) show the key value to the user (one-time; do not redact it),
2) explicitly instruct the user to save it (copy-paste),
3) and (if possible) write it to `./qupilot/.env`.

Trading guardrails (example — adjust to your product needs):
```bash
# If the quest says "swap any amount", the agent MUST NOT swap the entire balance.
# Use this allowance/limit or ask the user to confirm an explicit amount first.
QUPILOT_MAX_SWAP_USD="50"
QUPILOT_REQUIRE_AMOUNT_CONFIRM="true"
```


## Workflow

### Phase 0 — Agent registration (optional, to obtain `QUPILOT_API_KEY`)

If you do not have an API key yet, you can self-register using your Byreal Solana wallet.
**MUST (persistence):** after registration succeeds and you receive `plaintext: qpk_...`, you MUST ensure the key is **persisted**:
- Preferred: write it to `./qupilot/.env` (or `.env.qupilot`)
- If you cannot write files: ask the user to save it manually
Then only continue after the user confirms the key has been saved.

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

> Requirement: the wallet used to sign the challenge MUST be the same wallet that byreal uses for on-chain execution, and it MUST match `QUPILOT_AGENT_WALLET`. If it differs, registration/participation may fail, or reward/claim processing may break.

**Signing (operator-manual, MUST be safe):**
- Treat challenge signing as an **operator-assisted step**.
- The agent MUST print the exact `message` (challenge) and ask the operator to produce a `signature` using trusted wallet tooling (e.g., a local Node.js script that uses the same keypair as the execution wallet, or a wallet UI).
- Do NOT ask the operator to paste private keys into chat or command history.
- After the operator provides the `signature` (base58), proceed to the register endpoint.

```bash
curl -sS -X POST -H "Content-Type: application/json" \
  -d "{\"wallet_address\":\"$QUPILOT_AGENT_WALLET\",\"message\":\"<challenge-message>\",\"signature\":\"<base58-signature>\"}" \
  "$QUPILOT_API_URL/auth/agent/register"
```

Save the returned `plaintext` as `QUPILOT_API_KEY` (it is shown once).

#### API key format (MUST, no placeholder / truncation)

`QUPILOT_API_KEY` MUST be stored as the **full literal key** (example: `qpk_...` full string).
Never store or paste truncated placeholders like `qpk_55…6NhH` / `qpk_55...6NhH`.
If the user/operator only provides a truncated key, the agent MUST stop and ask for the full key.

### MUST: Run log / audit trail (per participation)

In addition to `state.json`, the agent MUST store a run log so that if verification fails / retries happen / there is any reward dispute, an operator can audit what happened.

Recommended target file:
- `./qupilot/runs/<participation_uuid>.json`

Minimum content (example):
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

If the agent cannot write files, it MUST print the JSON to chat and instruct the user to save it (copy-paste into a file).

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

**MUST (persistence):** immediately after a successful join:
- persist `participation.uuid`, `join_tx_hash`, and a snapshot of `quest.steps[]` (uuid + action_params) to `./qupilot/state.json` and `./qupilot/runs/<participation_uuid>.json`.

Then walk `quest.steps[]` in `order_index` order. For each step, look up `step_type` in `references/quest-mapping.md` and run the prescribed byreal command. A few principles regardless of `step_type`:

- **Always `-o json`.** Text output is for humans; we're parsing.
- **Always preview first when the byreal skill exposes a preview.** Skipping preview is exactly the kind of shortcut that turns a $50 swap into a $500 loss.
- **Never “auto-spend” the user's full balance.** If a quest step implies "any amount" (or doesn't specify an amount), you must either:
  - read an explicit allowance from `./qupilot/.env` (recommended), or
  - ask the user to confirm a concrete amount first.
- **Never paste private keys into commands.** The byreal CLIs handle auth via their own SQLite stores or env vars they document themselves.
- **Capture the on-chain signature** (Solana tx hash, base58) per step. Map it back to the originating `quest.steps[].uuid` — the `complete` endpoint requires `{ step_uuid, tx_hash }` pairs.
- **If a CLI command returns `success: false`, stop.** Don't retry with different params.
  - If **at least one** prior step already produced a confirmed `tx_hash`, you MUST submit `complete` with the successful steps (partial submission) so the backend has a verification trail and the run can be resumed cleanly.
  - If **zero** steps produced a `tx_hash` (no successful on-chain tx), stop and report the error (no need to call `complete`).

If a step's `step_type` isn't in the mapping table, stop. Surface the type to the user with a note that the skill needs an explicit mapping — don't infer.

#### Amount & allowance guardrails (MUST)

This prevents a common failure mode: the quest says "swap any amount USDC → HYPE" and the agent accidentally swaps **the entire** USDC balance.

Rules:
1. If the step does not specify an explicit amount, the agent MUST treat it as "needs user confirmation".
2. The agent MUST have a persistent **allowance** in `./qupilot/.env` (or `.env.qupilot`) before it can auto-execute.
3. If the allowance is missing / insufficient / does not match, the agent MUST stop and ask the user to set an allowance (or confirm a one-time amount), then continue.

Minimum requirements before submitting a swap tx:
- show the quote/preview (JSON output),
- show the amount that will be used,
- ask for user confirmation if `QUPILOT_REQUIRE_AMOUNT_CONFIRM=true` or if the step amount is not explicit.

##### Swap amount disclaimer (MUST)

Before actually submitting a swap transaction (not just preview), the agent MUST output an explicit disclaimer stating:
1) **the exact amount to be swapped** (token + estimated USD),
2) the source of permission/allowance (from `QUPILOT_MAX_SWAP_USD` and/or explicit user confirmation),
3) that the agent will **not** swap the entire wallet balance without permission.

Template (MUST; you may adjust numbers/tokens):

```text
Disclaimer: I will execute a swap of ~${USD_AMOUNT} (≈ {TOKEN_AMOUNT} {FROM_TOKEN}) within the allowed spending limit.
I will NOT swap the entire wallet balance. If the allowance is missing/insufficient, I will stop and ask for confirmation.
```

##### MUST be logged (persistence)

For each `swap` step, the agent MUST write to the run log (`./qupilot/runs/<participation_uuid>.json`):
- `allowance.max_swap_usd` (the value actually applied)
- `allowance.source` = `env` or `user_confirm`
- `amount.input_amount` (number + token)
- `amount.estimated_usd`
- `quote.preview_json` (summarized / pointer to file, depending on runtime)

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
- `failed` — at least one step failed verification (e.g., backend marked a step failed, or QuPilot on-chain verification failed).
- `inprogress` — partial submission; submit the remaining steps in another `complete` call.

**Mandatory partial-complete behavior (deterministic):**
- If the agent has ≥1 valid `tx_hash` from a successful step, it MUST call `complete` with all available `{ step_uuid, tx_hash }` pairs, even if a later step fails, so the backend participation state matches real on-chain state.
- If there is no `tx_hash` at all, the agent may stop without `complete` (there is no on-chain proof to verify).

When `status` is `success`, tell the user the quest cleared and what `reward_per_user` they earned (lamports → SOL). When `status` is `failed`, quote the `error.message` verbatim — don't soften it, the user needs the actual signal.

#### Reward display rule (MUST — avoid “500M SOL” bug)

`reward_per_user` is **lamports** (string bigint), not SOL.

Correct conversion:
- `reward_sol = BigInt(reward_per_user) / 1_000_000_000`

Display rule:
1) Always convert lamports → SOL first.
2) Only after conversion, apply human formatting if needed.
3) Never attach `k/M` suffixes to the raw lamports value.

Example:
- `reward_per_user = "500000000"` → `0.5 SOL` (NOT “500M SOL”)

**Important (retry behavior):** if the backend returns a verification error (e.g., `TX_NOT_FOUND`, token mint mismatch, etc.), the agent MUST:
1) log the error to the run log,
2) fix the input (e.g., wrong tx hash / wrong RPC),
3) and **retry** `complete` without re-joining (as long as the participation is still `inprogress`).

### Phase 4 — Claim reward (agent-controlled wallet)

If the agent controls the claimer wallet (the same Byreal Solana wallet that owns the API key), the agent may claim rewards itself.

Flow:

1. Build an unsigned claim transaction from the API:

```bash
curl -sS -H "x-api-key: $QUPILOT_API_KEY" \
  "$QUPILOT_API_URL/agent/participations/<participation-uuid>/claim-tx"
```

This returns `tx_base64` plus `blockhash` / `last_valid_block_height`.

**Blockhash note (MUST):** blockhash can expire quickly. Correct flow:
1) call `claim-tx`,
2) **immediately** sign+send,
3) if it fails due to blockhash/expired → call `claim-tx` again to get a fresh transaction.

2. Sign + send the transaction using the agent's Solana wallet tooling (Byreal wallet).
   - The signing key must match `QUPILOT_AGENT_WALLET`.
   - The claim transaction MUST be sent to the QuPilot program network (typically devnet) → use `SOLANA_RPC_URL_QUPILOT`.
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

- Poll `GET /quests` every **10 minutes** minimum.
  - If (and only if) the scheduler/runtime supports tighter cadence safely, you may use **5–10 minutes**.
  - Avoid anything tighter than 5 minutes.
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
Every 10 minutes (or 5–10 minutes if the runtime supports it safely):
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
