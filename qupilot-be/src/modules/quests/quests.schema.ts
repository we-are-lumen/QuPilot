import { z } from 'zod';

export const protocolSchema = z.enum(['byreal', 'bybit', 'sui']);
export type Protocol = z.infer<typeof protocolSchema>;

export const stepTypeSchema = z.enum(['swap', 'clmm_open', 'clmm_close']);
export type StepType = z.infer<typeof stepTypeSchema>;

// bigint base units — stored as bigint in DB, accept string or integer in body.
const bigintAmount = z
  .coerce.bigint()
  .nonnegative()
  .transform((v) => v.toString());

const evmAddress = z.string().trim().regex(/^0x[a-fA-F0-9]{40}$/, 'must be a 0x-prefixed EVM address');

const swapParams = z.object({
  router: evmAddress.optional(),
  token_in: evmAddress,
  token_out: evmAddress,
  amount_in: z.string().trim().min(1),
  min_amount_out: z.string().trim().min(1).optional(),
  max_slippage_bps: z.number().int().min(0).max(10_000).optional(),
});

const clmmOpenParams = z.object({
  pool: evmAddress,
  token0: evmAddress,
  token1: evmAddress,
  amount0_desired: z.string().trim().min(1),
  amount1_desired: z.string().trim().min(1),
  tick_lower: z.number().int(),
  tick_upper: z.number().int(),
  max_slippage_bps: z.number().int().min(0).max(10_000).optional(),
});

const clmmCloseParams = z.object({
  pool: evmAddress,
  position_id: z.string().trim().min(1).optional(),
});

const stepSchema = z.discriminatedUnion('step_type', [
  z.object({ step_type: z.literal('swap'), action_params: swapParams }),
  z.object({ step_type: z.literal('clmm_open'), action_params: clmmOpenParams }),
  z.object({ step_type: z.literal('clmm_close'), action_params: clmmCloseParams }),
]);

export type QuestStepInput = z.infer<typeof stepSchema>;

// ---------------------------------------------------------------------------
// Create quest
// ---------------------------------------------------------------------------

export const createQuestBodySchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(5000),
    protocol: protocolSchema,
    // Steps the agent must execute, in order. At least one step required.
    // Each step is validated against its step_type's params shape.
    steps: z.array(stepSchema).min(1, 'quest must have at least one step'),
    total_reward_pool: bigintAmount,
    reward_per_user: bigintAmount,
    reward_token: z.string().trim().regex(/^0x[a-fA-F0-9]{40}$/, 'reward_token must be a 0x-prefixed ERC20 address'),
    tx_hash: z.string().trim().regex(/^0x[a-fA-F0-9]+$/, 'tx_hash must be hex (0x...)'),
    expires_at: z
      .string()
      .trim()
      .min(1)
      .refine((v) => !Number.isNaN(Date.parse(v)), 'expires_at must be a valid datetime string')
      .refine((v) => Date.parse(v) > Date.now(), 'expires_at must be in the future'),
  })
  .refine(
    (b) => BigInt(b.total_reward_pool) >= BigInt(b.reward_per_user),
    {
      message: 'total_reward_pool must be >= reward_per_user',
      path: ['total_reward_pool'],
    },
  );

export type CreateQuestBody = z.infer<typeof createQuestBodySchema>;

export const questUuidParamsSchema = z.object({
  uuid: z.uuid(),
});

export type QuestUuidParams = z.infer<typeof questUuidParamsSchema>;

// Public listing filter — protocol stays as-is; `type` now filters quests
// whose FIRST step matches the given step_type (most common UX: "give me
// all swap quests").
export const listPublicQuerySchema = z.object({
  protocol: protocolSchema.optional(),
  type: stepTypeSchema.optional(),
});

export type ListPublicQuery = z.infer<typeof listPublicQuerySchema>;
