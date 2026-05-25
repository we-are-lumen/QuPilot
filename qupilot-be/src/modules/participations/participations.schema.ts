import { z } from 'zod';

export const participationQuestUuidParamsSchema = z.object({
  questUuid: z.string().uuid(),
});

export type ParticipationQuestUuidParams = z.infer<typeof participationQuestUuidParamsSchema>;

export const syncClaimBodySchema = z.object({
  participation_uuid: z.string().uuid(),
  claim_tx_hash: z.string().trim().min(32),
});

export type SyncClaimBody = z.infer<typeof syncClaimBodySchema>;
