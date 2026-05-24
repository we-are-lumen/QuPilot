import type { IPublicQuest, IQuestStep, StepType } from "@/lib/types/quests";

/**
 * Builds the copy-paste prompt shown on the user-facing quest detail page.
 *
 * The wording is deliberately aligned with the trigger phrases declared in
 * `qupilot-agent-skills/skills/qupilot-quest-runner/SKILL.md` so that any
 * agent which has that skill installed (Claude Code, etc.) will reliably
 * route the request to `qupilot-quest-runner` rather than improvising:
 *
 *   - mentions "QuPilot", "quest runner", "on-chain quest"
 *   - asks the agent to "fetch", "join", "execute", and "submit completion"
 *   - lists the exact API endpoints / env vars the skill is documented against
 *   - never invents fields not in `references/qupilot-api.md`
 *   - embeds the canonical step_type + action_params shape so the skill can
 *     match against `references/quest-mapping.md` without re-reading the API
 *
 * Keep this in sync with:
 *   qupilot-agent-skills/skills/qupilot-quest-runner/SKILL.md
 *   qupilot-agent-skills/skills/qupilot-quest-runner/references/qupilot-api.md
 *   qupilot-agent-skills/skills/qupilot-quest-runner/references/quest-mapping.md
 */

interface IBuildAgentPromptArgs {
  quest: Pick<
    IPublicQuest,
    | "uuid"
    | "title"
    | "protocol"
    | "description"
    | "steps"
    | "reward_per_user"
    | "reward_token"
    | "expires_at"
  > & {
    provider?: { display_name?: string | null } | null;
  };
}

function describeStep(step: IQuestStep): string {
  const params = JSON.stringify(step.action_params ?? {}, null, 2)
    .split("\n")
    .map((line) => `     ${line}`)
    .join("\n");

  return [
    `  ${step.order_index + 1}. step_uuid: ${step.uuid}`,
    `     step_type: ${step.step_type}`,
    `     action_params:`,
    params,
  ].join("\n");
}

export function buildAgentPrompt({ quest }: IBuildAgentPromptArgs): string {
  const providerName = quest.provider?.display_name ?? "the listed provider";
  const expiresAt = quest.expires_at
    ? new Date(quest.expires_at).toISOString()
    : "unknown";
  const claimUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/profile`
      : "https://terrahash.xyz/profile";

  const stepsBlock =
    quest.steps && quest.steps.length > 0
      ? quest.steps
          .slice()
          .sort((a, b) => a.order_index - b.order_index)
          .map(describeStep)
          .join("\n\n")
      : "  (no steps were returned for this quest — re-fetch and stop if still empty)";

  return `Use the qupilot-quest-runner skill to complete this QuPilot quest.

# Quest
title: ${quest.title}
quest_uuid: ${quest.uuid}
protocol: ${quest.protocol}
provider: ${providerName}
reward_per_user: ${quest.reward_per_user} ${quest.reward_token} (lamports)
expires_at: ${expiresAt}

# Steps
${stepsBlock}

# Required env
QUPILOT_API_URL (default: https://terrahash.xyz/api)
QUPILOT_API_KEY (qpk_... from POST /me/api-key)
QUPILOT_AGENT_WALLET (base58 pubkey that signs tx)

If any env is missing, stop and ask me.

# Workflow
1) GET $QUPILOT_API_URL/quests/${quest.uuid}
2) POST $QUPILOT_API_URL/agent/participations (x-api-key: $QUPILOT_API_KEY) body: {"quest_uuid":"${quest.uuid}","agent_wallet_address":"$QUPILOT_AGENT_WALLET"}
3) Execute steps in order_index order (per skill mappings), collect tx signatures
4) POST $QUPILOT_API_URL/agent/participations/<participation.uuid>/complete body: {"steps":[{"step_uuid":"...","tx_hash":"<base58-sig>"}]}

Report participation.status at the end.

# Claim
Agents do not claim rewards.
When participation.status is success, tell me the reward is claimable and send me this URL: ${claimUrl}
Do not attempt to construct or sign a claim transaction.`;
}
