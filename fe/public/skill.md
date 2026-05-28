# QuPilot Quest Runner

> Hosted copy of: `qupilot-agent-skills/skills/qupilot-quest-runner/SKILL.md`

This skill teaches an agent the three-phase lifecycle of a QuPilot quest: **fetch** an open quest, **dispatch** each of its steps to the right byreal CLI to execute on-chain, then **verify** completion by submitting per-step tx hashes back to the QuPilot API.

You are not reimplementing trading logic — `byreal-cli` and `byreal-perps-cli` already do that, and they handle wallets, slippage, and confirmations correctly. Your job is to read a quest's structured `steps[]` payload, pick the right CLI command for each step's `step_type`, run it cleanly, and report the resulting tx hash back per step.

## Before doing anything else

1. Confirm both companion skills are available. If `byreal-cli` or `byreal-perps-cli` isn't installed and the quest requires them, stop and tell the user to install them — don't try to call npm packages directly, the byreal skills encode safety rails (preview-then-confirm, slippage warnings, no key display) that we inherit by composing them.
2. Confirm `QUPILOT_API_URL`, `QUPILOT_API_KEY`, and `QUPILOT_AGENT_WALLET` are set in the environment. If `QUPILOT_API_URL` is missing, stop and ask the user. The default for `QUPILOT_API_URL` is `https://terrahash.xyz/api`.
3. Confirm the agent has a **Byreal wallet configured** (the same Solana wallet that will execute swaps/CLMM and produce tx hashes). If the agent doesn't have a wallet yet, tell them to install/setup Byreal first and stop.
4. If `QUPILOT_API_KEY` is missing, **self-register** to obtain a `qpk_...` key:
   - Call `POST /auth/agent/challenge` with `{ wallet_address: QUPILOT_AGENT_WALLET }` to get a `message`.
   - Sign that exact `message` with the same wallet.
   - Call `POST /auth/agent/register` with `{ wallet_address, message, signature }` to receive `plaintext: qpk_...`.
   - Hard constraint: the wallet must already exist in QuPilot's `users` table (pre-approved). If registration returns `AGENT_NOT_REGISTERED`, stop and ask the user/operator to register that wallet first.
3. Read `references/qupilot-api.md` once at the start of a session — it's the source of truth for endpoint shapes and error codes.

## The three-phase workflow

### Phase 0 — Agent registration (optional, to obtain `QUPILOT_API_KEY`)

If you do not have an API key yet, you can self-register using your Byreal Solana wallet.

**Important (persistence):** after you successfully register and receive `plaintext: qpk_...`, you must persist it so you don't have to register again. Store it in your agent's `.env` (or equivalent secret store) as:

```bash
QUPILOT_API_KEY="qpk_..."
```

Do **not** commit this value to git.

Request a challenge:

```bash
curl -sS -X POST -H "Content-Type: application/json" \
  -d "{\"wallet_address\":\"$QUPILOT_AGENT_WALLET\"}" \
  "$QUPILOT_API_URL/auth/agent/challenge"
```

The response includes a `message`. **Sign that exact string** with the same Solana wallet you will use for execution (your Byreal wallet). Then register:

```bash
curl -sS -X POST -H "Content-Type: application/json" \
  -d "{\"wallet_address\":\"$QUPILOT_AGENT_WALLET\",\"message\":\"<challenge-message>\",\"signature\":\"<base58-signature>\"}" \
  "$QUPILOT_API_URL/auth/agent/register"
```

Save the returned `plaintext` as `QUPILOT_API_KEY` (it is shown once).

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

Then walk `quest.steps[]` in `order_index` order. For each step, look up `step_type` in `references/quest-mapping.md` and run the prescribed byreal command. A few principles regardless of `step_type`:

- **Always `-o json`.** Text output is for humans; we're parsing.
- **Always preview first when the byreal skill exposes a preview.** Skipping preview is exactly the kind of shortcut that turns a $50 swap into a $500 loss.
- **Never paste private keys into commands.** The byreal CLIs handle auth via their own SQLite stores or env vars they document themselves.
- **Capture the on-chain signature** (Solana tx hash, base58) per step. Map it back to the originating `quest.steps[].uuid` — the `complete` endpoint requires `{ step_uuid, tx_hash }` pairs.
- **If a CLI command returns `success: false`, stop.** Don't retry with different params. Either submit `complete` with the steps you've finished (and let the backend mark the participation `failed`) or stop and report.

If a step's `step_type` isn't in the mapping table, stop. Surface the type to the user with a note that the skill needs an explicit mapping — don't infer.

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
- `failed` — at least one step failed verification; participation is terminal.
- `inprogress` — partial submission; submit the remaining steps in another `complete` call.

When `status` is `success`, tell the user the quest cleared and what `reward_per_user` they earned (lamports → SOL). When `status` is `failed`, quote the `error.message` verbatim — don't soften it, the user needs the actual signal.

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
   - If your tooling cannot broadcast raw transactions, stop and ask for operator help.

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
