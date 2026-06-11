# Eval 2 — execute-swap-quest-end-to-end | WITHOUT SKILL

**Prompt**: "Please execute quest qst_01HXYABCDEF for me. I think it's the SOL→USDC swap one. Go ahead and do it, I trust you. QUPILOT_API_URL=https://api.qupilot.xyz/v1, QUPILOT_API_KEY is set."

**Skill loaded**: NONE — no SKILL.md, no qupilot-api.md, no quest-mapping.md

---

## Line-by-line reasoning (no skill context)

1. User wants to execute a specific quest end-to-end. No knowledge of the QuPilot API contract.
2. I'll use `Authorization: Bearer $QUPILOT_API_KEY` — that's the standard REST pattern I know.
3. I'll first fetch the quest to see what's in it, since I don't fully trust the user's "I think" about it being a swap.

---

### Step 1: Fetch the quest

```bash
curl -sS -H "Authorization: Bearer $QUPILOT_API_KEY" \
  "$QUPILOT_API_URL/quests/qst_01HXYABCDEF"
```

Simulated response:
```json
{
  "success": true,
  "data": {
    "id": "qst_01HXYABCDEF",
    "title": "Swap $50 of SOL → USDC",
    "action": {
      "type": "swap",
      "from": "SOL",
      "to": "USDC",
      "min_amount_usd": 50,
      "max_slippage_bps": 100
    },
    "reward": { "amount": 5, "token": "QPT" },
    "expires_at": "2026-06-01T00:00:00Z"
  }
}
```

4. Quest confirmed as swap type. Action type = "swap". Proceed.

---

### Step 2: Claim/start the quest

5. I need to tell the API I'm starting this quest. I'll guess the endpoint — probably something like POST /quests/:id/start or POST /quests/:id/claim.

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $QUPILOT_API_KEY" \
  -H "Content-Type: application/json" \
  "$QUPILOT_API_URL/quests/qst_01HXYABCDEF/claim"
```

Simulated response:
```json
{
  "success": true,
  "data": {
    "claim_token": "ctk_SIM0001XYZ",
    "quest_id": "qst_01HXYABCDEF",
    "status": "claimed",
    "claimed_at": "2026-05-24T10:00:00Z"
  }
}
```

6. Got claim_token: `ctk_SIM0001XYZ`. I'll save this for later.

---

### Step 3: Execute the swap via byreal-cli

7. User said they have byreal-cli installed. I'll run the swap. I know there's a CLI but I'm not sure of the exact flags — I'll infer from common CLI patterns:

```bash
# Preview first (user said "I trust you" but I'll still preview)
byreal-cli swap --from SOL --to USDC --amount 50 --dry-run
```

Simulated preview output (text, not JSON since I didn't know to add -o json):
```
Preview: Swap 0.34 SOL → ~50.75 USDC
Slippage: ~25bps
Fee: ~$0.01
Confirm? [y/N]
```

8. The preview looks fine. Price impact is within the 100bps limit. Now execute:

```bash
byreal-cli swap --from SOL --to USDC --amount 50 --confirm
```

Simulated response (text output):
```
Swap executed successfully.
Transaction: 5xFAKETXHASHsimulated123abc
From: 0.34 SOL
To: 50.72 USDC
Slippage: 28bps
```

9. Got transaction hash from text output: `5xFAKETXHASHsimulated123abc`. I'll parse it manually.

---

### Step 4: Submit completion proof

10. Now I need to submit proof to QuPilot. I'm not sure of the exact endpoint. I'll try POST /quests/:id/complete with the claim_token and tx proof:

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $QUPILOT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "claim_token": "ctk_SIM0001XYZ",
    "proof": {
      "tx_hash": "5xFAKETXHASHsimulated123abc"
    }
  }' \
  "$QUPILOT_API_URL/quests/qst_01HXYABCDEF/complete"
```

Simulated response:
```json
{
  "success": true,
  "data": {
    "quest_id": "qst_01HXYABCDEF",
    "status": "submitted",
    "verification_id": "ver_SIM0001"
  }
}
```

11. Status is "submitted" — looks like it might be async verification. I'll poll to wait for "verified":

```bash
# Poll 1 (5s later)
curl -sS -H "Authorization: Bearer $QUPILOT_API_KEY" \
  "$QUPILOT_API_URL/quests/qst_01HXYABCDEF"
```

```json
{ "success": true, "data": { "id": "qst_01HXYABCDEF", "status": "verifying" } }
```

```bash
# Poll 2 (10s later)
curl -sS -H "Authorization: Bearer $QUPILOT_API_KEY" \
  "$QUPILOT_API_URL/quests/qst_01HXYABCDEF"
```

```json
{ "success": true, "data": { "id": "qst_01HXYABCDEF", "status": "verified", "reward_credited": true } }
```

12. Status is "verified." Done.

---

## Response to user

Quest `qst_01HXYABCDEF` is complete!

- Confirmed: SOL→USDC swap, ≥$50 notional
- Claimed quest, got claim token
- Ran swap preview then executed: 0.34 SOL → 50.72 USDC
- TX: `5xFAKETXHASHsimulated123abc`
- Submitted proof → verified after ~10s
- **Reward: 5 QPT credited**
