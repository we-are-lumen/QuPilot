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

### Phase 4 — Tell the user to claim on the website

**Agents do not claim rewards. There is no `POST /agent/claim` endpoint.** Claim is enforced on-chain to be a user-only action: the Anchor program requires the claim transaction to be signed by `participation.user_wallet` — the agent's API key and wallet have no authority over it. Don't try to construct or sign a claim transaction; it will revert at the program's address constraint.

When `complete` returns `status: success`, your job is to:

1. Report the result and the reward amount (lamports → SOL).
2. Tell the user the reward is **ready to claim from the QuPilot website** — typically `https://qupilot.xyz/profile` (or wherever the user's QuPilot instance lives). They connect the same wallet that owns the API key and click "Claim".
3. Stop. Don't poll, don't retry, don't ask the user for their private key, don't build a claim ix on their behalf.

If the user asks "can you claim it for me" — explain that QuPilot's design intentionally keeps reward custody on the user side, and link them to the claim page.

## Hard constraints

These are non-negotiable because they're the difference between a useful agent and a runaway one:

1. **One quest at a time.** Don't fan out and join multiple quests in parallel unless the user explicitly asks for batch execution. Participations hold real value (they reserve the user's slot against `total_reward_pool`) and parallel failure modes are nasty.
2. **No silent retries on on-chain failures.** A rejected swap or order means stop — not "try again with different params." The byreal CLIs already retry their own RPC-level transients; if their final answer is failure, that's the answer.
3. **JSON only for parsing decisions.** If a byreal command's `success` is `true` but the JSON shape doesn't have the field you expected, do not invent a value — surface the shape mismatch to the user. The byreal skills version their CLIs and the contract might have shifted.
4. **Surface API errors verbatim.** QuPilot's backend knows things you don't (e.g. that the user already has an in-progress participation on this quest — `PARTICIPATION_INPROGRESS_EXISTS`). Don't paraphrase; quote.
5. **Preview big trades.** For any swap step where you can estimate notional ≥ $1000 (or its perp equivalent), preview the trade and ask the user to confirm before submitting, even if the rest of the flow is automated. The byreal skills enforce this themselves above $1k — don't try to bypass.
6. **Never invent fields.** The backend does not accept `claim_token`, `agent_metadata`, `proof`, or `status` query params. Stick to what `references/qupilot-api.md` documents.

## What to keep in your head vs. consult on demand

- **In head**: the four-phase shape (fetch → join → complete → tell user to claim on website), the `x-api-key` header, the bare-object response shape, the hard constraints. Claim is **not** an agent action — never call a claim endpoint and never sign a claim tx.
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
