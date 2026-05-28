import { z } from 'zod';

const solanaPubkey = z
  .string()
  .trim()
  .min(32)
  .max(64)
  .regex(/^[1-9A-HJ-NP-Za-km-z]+$/, 'wallet_address must be a base58 Solana pubkey');

const solanaSignature = z
  .string()
  .trim()
  .min(64)
  .max(128)
  .regex(/^[1-9A-HJ-NP-Za-km-z]+$/, 'signature must be base58');

export const challengeBodySchema = z.object({
  wallet_address: solanaPubkey,
});

export type ChallengeBody = z.infer<typeof challengeBodySchema>;

export const registerBodySchema = z.object({
  wallet_address: solanaPubkey,
  signature: solanaSignature,
  message: z.string().min(1, 'message is required').max(4096),
  label: z.string().trim().min(1).max(100).optional(),
});

export type RegisterBody = z.infer<typeof registerBodySchema>;

