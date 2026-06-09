import { z } from 'zod';

export const protocolSchema = z.string().trim().min(1).max(50);
export type Protocol = z.infer<typeof protocolSchema>;

export const stepTypeSchema = z.enum(['swap', 'clmm_open', 'clmm_close', 'clmm_copy']);
export type StepType = z.infer<typeof stepTypeSchema>;

// bigint base units — stored as bigint in DB, accept string or integer in body.
const bigintAmount = z
  .coerce.bigint()
  .nonnegative()
  .transform((v) => v.toString());

const solanaPubkey = z
  .string()
  .trim()
  .min(32)
  .max(64)
  .regex(/^[1-9A-HJ-NP-Za-km-z]+$/, 'must be a base58 Solana pubkey');

const swapParams = z
  .object({
    // New (recommended): deterministic token identity via mint addresses.
    // For SOL, use the wrapped SOL mint: So11111111111111111111111111111111111111112
    from_token: solanaPubkey,
    to_token: solanaPubkey,
    from_logo_uri: z.string().trim(),
    to_logo_uri: z.string().trim(),

    // Backward-compat: earlier mint naming
    from_mint: solanaPubkey.optional(),
    to_mint: solanaPubkey.optional(),

    // Backward-compat: symbol-based swaps. Kept so existing quests don't break.
    from_token_symbol: z.string().trim().min(1).max(16),
    to_token_symbol: z.string().trim().min(1).max(16),
  })
  .superRefine((v, ctx) => {
    const hasTokens = Boolean(v.from_token) || Boolean(v.to_token);
    const hasMints = Boolean(v.from_mint) || Boolean(v.to_mint);
    const hasSymbols = Boolean(v.from_token_symbol) || Boolean(v.to_token_symbol);

    if (hasTokens) {
      if (!v.from_token || !v.to_token) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'swap action_params must include both from_token and to_token',
          path: ['from_token'],
        });
      }
      return;
    }

    if (hasMints) {
      if (!v.from_mint || !v.to_mint) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'swap action_params must include both from_mint and to_mint',
          path: ['from_mint'],
        });
      }
      return;
    }

    if (hasSymbols) {
      if (!v.from_token_symbol || !v.to_token_symbol) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'swap action_params must include both from_token_symbol and to_token_symbol',
          path: ['from_token_symbol'],
        });
      }
      return;
    }

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        'swap action_params must include either (from_token,to_token) or (from_mint,to_mint) or (from_token_symbol,to_token_symbol)',
      path: [],
    });
  });

const clmmOpenParams = z.object({
  pool: solanaPubkey,
  token0_mint: solanaPubkey,
  token0_symbol: z.string().trim().min(1).max(16),
  token0_logo_uri: z.string().trim(),
  token1_mint: solanaPubkey,
  token1_symbol: z.string().trim().min(1).max(16),
  token1_logo_uri: z.string().trim(),
  position_mint: solanaPubkey,
  tick_lower: z.number().int(),
  tick_upper: z.number().int(),
});

const clmmCloseParams = z.object({
  pool: solanaPubkey,
  token0_mint: solanaPubkey,
  token0_symbol: z.string().trim().min(1).max(16),
  token0_logo_uri: z.string().trim(),
  token1_mint: solanaPubkey,
  token1_symbol: z.string().trim().min(1).max(16),
  token1_logo_uri: z.string().trim(),
  position_mint: solanaPubkey,
});

const clmmCopyParams = z.object({
  // Source CLMM position address to copy (from a top farmer / strategy position).
  source_position: solanaPubkey,
  token0_mint: solanaPubkey,
  token1_mint: solanaPubkey,
  // Notional guidance for the copy. The agent uses this to pick size via byreal-cli.
  // Stored as number for now; backend verification focuses on tx success + signer + token outflow.
  amount_usd: z.coerce.number().positive(),
});

const stepSchema = z.discriminatedUnion('step_type', [
  z.object({ step_type: z.literal('swap'), action_params: swapParams }),
  z.object({ step_type: z.literal('clmm_open'), action_params: clmmOpenParams }),
  z.object({ step_type: z.literal('clmm_close'), action_params: clmmCloseParams }),
  z.object({ step_type: z.literal('clmm_copy'), action_params: clmmCopyParams }),
]);

export type QuestStepInput = z.infer<typeof stepSchema>;

// ---------------------------------------------------------------------------
// Create quest
// ---------------------------------------------------------------------------

export const createQuestBodySchema = z
  .object({
    quest_uuid: z.uuid(),
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(5000),
    protocol: protocolSchema,
    // Steps the agent must execute, in order. At least one step required.
    // Each step is validated against its step_type's params shape.
    steps: z.array(stepSchema).min(1, 'quest must have at least one step'),
    total_reward_pool: bigintAmount,
    reward_per_user: bigintAmount,
    reward_token: z.literal('SOL'),
    tx_hash: z
      .string()
      .trim()
      .min(64)
      .max(128)
      .regex(/^[1-9A-HJ-NP-Za-km-z]+$/, 'tx_hash must be a base58 Solana signature'),
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
