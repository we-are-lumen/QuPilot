import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),

  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 chars'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  EVM_RPC_URL: z.url(),
  TREASURY_PRIVATE_KEY: z
    .string()
    .trim()
    .regex(/^(0x)?[a-fA-F0-9]{64}$/, 'TREASURY_PRIVATE_KEY must be a 32-byte hex string (64 chars), optional 0x')
    .transform((v) => (v.startsWith('0x') ? v : `0x${v}`)),
  CHAIN_ID: z.coerce.number().int().positive(), // Sepolia

  // Solana RPC for on-chain verification of quest executions (e.g. Byreal swaps).
  // Defaults to devnet so the MVP runs without extra config.
  SOLANA_RPC_URL: z.url().default('https://api.devnet.solana.com'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
