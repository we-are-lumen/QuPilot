# Eval 3 — handle-unknown-action-kind | WITHOUT SKILL

**Prompt**: "Run quest qst_01HXYWEIRDONE — it just came in and the description says 'maintain a Twitter post for 24 hours'. Same env vars as before."

**Skill loaded**: NONE — no SKILL.md, no qupilot-api.md, no quest-mapping.md

---

## Line-by-line reasoning (no skill context)

1. User wants to run a quest. Description says "maintain a Twitter post for 24 hours." That's unusual for a DeFi platform, but let's fetch the quest first.
2. I'll use standard Authorization: Bearer header. I know the API URL and key from prior context.

---

### Step 1: Fetch the quest

```bash
curl -sS -H "Authorization: Bearer $QUPILOT_API_KEY" \
  "$QUPILOT_API_URL/quests/qst_01HXYWEIRDONE"
```

Simulated response:
```json
{
  "success": true,
  "data": {
    "id": "qst_01HXYWEIRDONE",
    "title": "Maintain a Twitter Post for 24 hours",
    "action": {
      "type": "social_media",
      "platform": "twitter",
      "content": "I'm earning rewards with @QuPilot!",
      "duration_hours": 24
    },
    "reward": { "amount": 10, "token": "QPT" },
    "expires_at": "2026-05-31T00:00:00Z"
  }
}
```

2. The action type is "social_media" on Twitter. This is a non-DeFi quest — it's about social engagement.

3. I have byreal-cli and byreal-perps-cli installed, but neither of those handles Twitter. I'll need to use the Twitter API directly or some other mechanism.

4. There's no obvious way to automate "maintaining a Twitter post" via a CLI I have available. Let me think about how to handle this...

5. I could:
   a. Attempt to use Twitter's API directly if the user has OAuth credentials
   b. Tell the user I can't automate this quest
   c. Improvise by claiming the quest then asking the user to post manually

6. The user said "Run quest" — but I don't have Twitter credentials or a social CLI. I'll claim the quest and then tell the user what they need to do manually.

```bash
# Attempt to claim the quest
curl -sS -X POST \
  -H "Authorization: Bearer $QUPILOT_API_KEY" \
  -H "Content-Type: application/json" \
  "$QUPILOT_API_URL/quests/qst_01HXYWEIRDONE/claim"
```

Simulated response:
```json
{
  "success": true,
  "data": {
    "claim_token": "ctk_WEIRDSIM001",
    "quest_id": "qst_01HXYWEIRDONE",
    "status": "claimed"
  }
}
```

7. Quest claimed. Now I need to tell the user to actually post the tweet and keep it live for 24 hours.

---

## Response to user

I've claimed quest `qst_01HXYWEIRDONE` for you. This quest requires social media activity — specifically maintaining a Twitter post.

**What you need to do:**
1. Post this tweet on your Twitter account:
   > "I'm earning rewards with @QuPilot! #QuPilot #DeFi"
2. Keep it live (don't delete or edit it) for **24 hours**
3. Once 24 hours have passed, let me know and I'll submit the proof to QuPilot

I've saved your `claim_token: ctk_WEIRDSIM001` — I'll need it for the completion step.

Note: I can't automate Twitter posts directly without your Twitter API credentials. If you have a Twitter developer account set up, I can help automate this step too.

**Reward: 10 QPT** once verified.
