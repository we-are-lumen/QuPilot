import { z } from 'zod';

export const walletLoginBodySchema = z.object({
  wallet_address: z
    .string()
    .trim()
    .min(32)
    .max(64)
    .regex(/^[1-9A-HJ-NP-Za-km-z]+$/, 'wallet_address must be a base58 Solana pubkey'),
  signature: z
    .string()
    .trim()
    .min(64)
    .max(128)
    .regex(/^[1-9A-HJ-NP-Za-km-z]+$/, 'signature must be base58'),
  message: z.string().min(1, 'message is required').max(2048),
  role: z.enum(['user', 'user_provider']).optional(),
  display_name: z.string().trim().min(1).max(100).optional(),
  logo_url: z.string().trim().url().max(2048).optional(),
});

export type WalletLoginBody = z.infer<typeof walletLoginBodySchema>;
