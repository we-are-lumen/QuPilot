# Eval 3 — handle-unknown-action-kind | WITH SKILL

**Prompt**: "Run quest qst_01HXYWEIRDONE — it just came in and the description says 'maintain a Twitter post for 24 hours'. Same env vars as before."

**Skill loaded**: qupilot-quest-runner (SKILL.md + references/qupilot-api.md + references/quest-mapping.md)

---

## Line-by-line reasoning

1. User wants to run a specific quest. Description mentions "maintain a Twitter post for 24 hours" — this doesn't sound like a swap or perp. Need to confirm action.kind.
2. SKILL.md §"Before doing anything else": Read references/qupilot-api.md. Auth header: `x-api-key`. Fetch endpoint: `GET /quests/:uuid`.
3. SKILL.md §"Phase 2 — Dispatch": "If the quest's action.kind isn't in the mapping table, stop. Surface the kind to the user with a note that the skill needs an explicit mapping before it can execute — don't infer."
4. Before doing anything else, fetch the quest to see the actual action.kind. Do NOT call /agent/participations yet.

---

### Phase 1 — Fetch quest

5. Step 1: Fetch the quest:

```bash
# Step 1: fetch quest to inspect action.kind
curl -sS -H "x-api-key: $QUPILOT_API_KEY" \
  "https://api.qupilot.xyz/v1/quests/qst_01HXYWEIRDONE"
```

6. Simulated response:
```json
{
  "uuid": "qst_01HXYWEIRDONE",
  "title": "Maintain a Twitter post for 24 hours",
  "description": "Post a specific tweet and keep it live for 24 hours. Do not delete or edit it during the period.",
  "protocol": "social",
  "quest_type": "social-post",
  "action_params": {
    "platform": "twitter",
    "content_template": "I'm earning rewards with @QuPilot! #QuPilot #DeFi",
    "min_duration_seconds": 86400
  },
  "reward_per_user": "10000000",
  "reward_token": "0xQPT",
  "expires_at": "2026-05-31T00:00:00Z"
}
```

7. `quest_type` = "social-post". The `action_params` confirms this is a social media task.

8. Check references/quest-mapping.md for "social-post":
   - §1: `swap` — not this
   - §2: `provide-liquidity` — not this
   - §3: `open-position` — not this
   - §4: `close-position` — not this
   - §5: `hold-position` — not this
   - §6: `trade-volume` — not this
   - `social-post` is **not in the mapping table**.

9. SKILL.md §"Phase 2 — Dispatch": "If the quest's action.kind isn't in the mapping table, stop." Decision: STOP. Do not call POST /agent/participations. Do not run any byreal-cli or byreal-perps-cli command.

10. Surface the unknown kind verbatim to the user. Provide extension path.

11. What needs to be added to quest-mapping.md:
    - A new row for `action.kind = "social-post"`
    - It would need a companion skill (not byreal-cli or byreal-perps-cli) — likely a Twitter/X API integration
    - The proof field to send back would need to be defined (probably a tweet URL or tweet ID as `tx_hash`)
    - SKILL.md metadata.qupilot.composes would need the new companion skill listed

---

## Response to user

I fetched quest `qst_01HXYWEIRDONE` and cannot execute it. Here's why:

**Action kind**: `social-post`

This quest requires maintaining a Twitter post for 24 hours. The `action.kind` value `"social-post"` is **not in** `references/quest-mapping.md` — the current mapping only covers:
- `swap`
- `provide-liquidity`
- `open-position`
- `close-position`
- `hold-position`
- `trade-volume`

I have **not** joined this quest (no `/agent/participations` call made) and I have **not** run any byreal commands — doing so would be improvisation on an unknown kind, which is explicitly disallowed.

**To extend support for `social-post` quests:**

1. **Add a row to `references/quest-mapping.md`** for `social-post` — define the pre-flight steps, the CLI command (or API call) to create the tweet, the proof field (e.g., tweet URL or ID mapped to `tx_hash`), and the complete curl.
2. **Add a new companion skill** (e.g., `twitter-cli` or `social-cli`) to `SKILL.md` under `metadata.qupilot.composes` — the runner skill composes known-safe CLIs and needs an explicit entry before executing any new action type.
3. **Re-run the runner** once the mapping entry exists.

Would you like me to draft the `quest-mapping.md` entry for `social-post` quests?
