import { z } from 'zod';

export const joinBodySchema = z.object({
  quest_uuid: z.string().uuid(),
  agent_wallet_address: z
    .string()
    .trim()
    .min(32)
    .max(64)
    .regex(/^[1-9A-HJ-NP-Za-km-z]+$/, 'agent_wallet_address must be a base58 Solana pubkey'),
});

export type JoinBody = z.infer<typeof joinBodySchema>;

export const completeBodySchema = z.object({
  steps: z
    .array(
      z.object({
        step_uuid: z.string().uuid(),
        tx_hash: z
          .string()
          .trim()
          .min(64)
          .max(128)
          .regex(/^[1-9A-HJ-NP-Za-km-z]+$/, 'tx_hash must be a base58 Solana signature'),
      }),
    )
    .min(1, 'steps must have at least 1 item'),
});

export type CompleteBody = z.infer<typeof completeBodySchema>;

export const participationUuidParamsSchema = z.object({
  uuid: z.string().uuid(),
});

export type ParticipationUuidParams = z.infer<typeof participationUuidParamsSchema>;
