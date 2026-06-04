# Quest Step → byreal CLI Mapping

Use this table when dispatching the steps of a joined quest. Each row shows a quest `steps[]` entry (matched on `step_type`) and the byreal CLI command(s) that satisfy it. Always run the CLI with `-o json` so the output stays parseable, and capture the Solana tx signature (base58) listed under "proof" to pair with the step's `uuid` when calling `POST /agent/participations/:participation-uuid/complete`.

If a step's `step_type` isn't covered here, **stop and surface the type to the user** rather than guessing. Extending coverage is a deliberate update to this file, not an inference.

## Preview vs execute (penting)

Untuk setiap step, agent harus melakukan:
1) **Pre-flight / preview** (quote / dry-run / simulate) memakai jalur yang disediakan oleh `byreal-cli` skill yang terpasang, lalu
2) **Execute** hanya setelah preview OK dan guardrail amount/allowance terpenuhi.

Jangan menebak flag yang tidak kamu yakin didukung oleh versi `byreal-cli` yang terpasang. Kalau butuh flag/command yang tidak ada di mapping ini, consult skill `byreal-cli` / dokumentasinya terlebih dahulu; jika masih ambigu, **stop**.

The currently supported `step_type` values (per `references/qupilot-api.md`) are:

- `swap`
- `clmm_open`
- `clmm_close`
- `clmm_copy`

All three execute on Byreal via `byreal-cli`. There is no perp/Hyperliquid step type in the QuPilot API today — if you see one, treat it as unmapped and stop.

---

## 1. `swap` — execute a token swap on Byreal

**Quest step payload (excerpt from `GET /quests/:uuid`):**

```json
{
  "uuid": "<step-uuid>",
  "order_index": 0,
  "step_type": "swap",
  "action_params": {
    "from_token": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "to_token": "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"
  }
}
```

**Pre-flight:**

1. `byreal-cli wallet balance -o json` — confirm the input token balance covers the trade plus SOL gas headroom.
2. Run the byreal-cli **preview/quote/dry-run** path for swaps (as defined by your installed `byreal-cli` skill) and inspect the quote, slippage, and notional.
3. If the quest step does not specify an amount (or implies "any amount"), enforce QuPilot allowance rules (see `SKILL.md`) and ask the user to confirm a concrete amount.
3. If the estimated notional ≥ $1000, preview the trade and have the user confirm before submitting (hard constraint #5 in `SKILL.md`).

**Execute:**

```bash
byreal-cli swap execute \
  --input-mint <from_token> \
  --output-mint <to_token> \
  --amount <calc> \
  --confirm \
  -o json
```

**Proof to send back:** the Solana transaction signature (base58) from the CLI output (often logged as `Transaction sent: <txid>` / `Transaction confirmed: <txid>`, and may also be present in JSON output when `-o json` is used). Pair it with the step's `uuid` as `{ "step_uuid": "<step-uuid>", "tx_hash": "<base58-sig>" }`.

---

## 2. `clmm_open` — open a Byreal CLMM position

**Quest step payload (excerpt):**

```json
{
  "uuid": "<step-uuid>",
  "order_index": 0,
  "step_type": "clmm_open",
  "action_params": {
    "token0_mint": "So11111111111111111111111111111111111111112",
    "token1_mint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "position_mint": "<base58-position-mint>"
  }
}
```

`position_mint` is the NFT mint that will represent the CLMM position on-chain; the backend uses it during verification to confirm the position belongs to `QUPILOT_AGENT_WALLET`.

**Pre-flight:**

1. `byreal-cli pool show --token0 <token0_mint> --token1 <token1_mint> -o json` — confirm the pool exists and inspect the current tick.
2. `byreal-cli wallet balance -o json` — confirm balances for both sides (or that Auto Swap can cover the gap).
3. Preview/simulate the open using the path the installed `byreal-cli` skill prescribes before committing (do not guess flags).

**Execute:**

```bash
byreal-cli position open \
  --token0 <token0_mint> \
  --token1 <token1_mint> \
  --position-mint <position_mint> \
  -o json
```

**Proof to send back:** the Solana transaction signature (base58) from the CLI output (often logged as `Transaction sent: <txid>` / `Transaction confirmed: <txid>`, and may also be present in JSON output when `-o json` is used). Pair it with the step's `uuid` as `{ "step_uuid": "<step-uuid>", "tx_hash": "<base58-sig>" }`.

---

## 3. `clmm_close` — close a Byreal CLMM position

**Quest step payload (excerpt):**

```json
{
  "uuid": "<step-uuid>",
  "order_index": 1,
  "step_type": "clmm_close",
  "action_params": {
    "token0_mint": "So11111111111111111111111111111111111111112",
    "token1_mint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "position_mint": "<base58-position-mint>"
  }
}
```

In multi-step quests the `position_mint` will usually match the `position_mint` of an earlier `clmm_open` step. Don't assume — read it from `action_params` and verify the position exists in the wallet before signing.

**Pre-flight:**

1. `byreal-cli position list -o json` — confirm a position with the given `position_mint` exists in `QUPILOT_AGENT_WALLET`.
2. Preview/simulate the close so the user can see expected token returns before signing (use the installed `byreal-cli` skill path; do not guess flags).

**Execute:**

```bash
byreal-cli position close \
  --position-mint <position_mint> \
  -o json
```

**Proof to send back:** the Solana transaction signature (base58) from the CLI output (often logged as `Transaction sent: <txid>` / `Transaction confirmed: <txid>`, and may also be present in JSON output when `-o json` is used). Pair it with the step's `uuid` as `{ "step_uuid": "<step-uuid>", "tx_hash": "<base58-sig>" }`.

---

## 4. `clmm_copy` — copy a top farmer's CLMM position

**Quest step payload (excerpt):**

```json
{
  "uuid": "<step-uuid>",
  "order_index": 0,
  "step_type": "clmm_copy",
  "action_params": {
    "source_position": "<base58-position-address>",
    "token0_mint": "<base58-mint>",
    "token1_mint": "<base58-mint>",
    "amount_usd": 100
  }
}
```

**Pre-flight:**

1. Treat `amount_usd` as a spending instruction. Enforce any user allowance/policy (see `SKILL.md`) before executing.
2. Preview/simulate the copy using the path the installed `byreal-cli` skill prescribes (do not guess flags). If preview isn't available, stop.

**Execute:**

```bash
byreal-cli positions copy \
  --position <source_position> \
  --amount-usd <amount_usd> \
  --confirm \
  -o json
```

**Proof to send back:** the Solana transaction signature (base58) from the CLI output (often logged as `Transaction sent: <txid>` / `Transaction confirmed: <txid>`, and may also be present in JSON output when `-o json` is used). Pair it with the step's `uuid` as `{ "step_uuid": "<step-uuid>", "tx_hash": "<base58-sig>" }`.

---

## Submitting proof to `complete`

After each step's tx is signed and confirmed, collect `{ step_uuid, tx_hash }` pairs and submit them together (or in batches) to the participation's `complete` endpoint. Verification is **synchronous** — `participation.status` in the response is the final state for the steps you submitted (`success | failed | inprogress`). No polling.

```bash
curl -sS -X POST -H "x-api-key: $QUPILOT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
        "steps": [
          { "step_uuid": "<step-uuid-1>", "tx_hash": "<base58-sig-1>" },
          { "step_uuid": "<step-uuid-2>", "tx_hash": "<base58-sig-2>" }
        ]
      }' \
  "$QUPILOT_API_URL/agent/participations/<participation-uuid>/complete"
```

Participation stays `inprogress` until every step is verified, and flips to `failed` as soon as any submitted step fails verification.

---

## A note on partial fills and rejected orders

Every `byreal-cli` command returns `{ success: false, error: { code, message } }` on rejection. Treat rejection as a hard stop for that quest attempt:

1. Submit `complete` with whatever `{ step_uuid, tx_hash }` pairs you did finish. The backend's verification will mark the participation `failed` if any submitted step (or any missing step at expiry) doesn't verify; there is **no** `abandon` endpoint.
2. Report the byreal error message verbatim to the user — don't paraphrase.
3. Do not silently retry — quest-execution loops are exactly where runaway agents lose money. The `byreal-cli` skill already retries its own RPC-level transients; if its final answer is failure, that's the answer.
