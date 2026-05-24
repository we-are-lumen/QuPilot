import { z } from 'zod';

export const joinBodySchema = z.object({
  quest_uuid: z.string().uuid(),
});

export type JoinBody = z.infer<typeof joinBodySchema>;

export const completeBodySchema = z.object({
  steps: z
    .array(
      z.object({
        step_uuid: z.string().uuid(),
        tx_hash: z.string().trim().regex(/^0x[a-fA-F0-9]+$/, 'tx_hash must be hex (0x...)'),
      }),
    )
    .min(1, 'steps must have at least 1 item'),
});

export type CompleteBody = z.infer<typeof completeBodySchema>;

export const participationUuidParamsSchema = z.object({
  uuid: z.string().uuid(),
});

export type ParticipationUuidParams = z.infer<typeof participationUuidParamsSchema>;
