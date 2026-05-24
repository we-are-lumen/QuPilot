import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),

  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 chars'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  SOLANA_RPC_URL: z.url().default('https://api.devnet.solana.com'),
  QUPILOT_PROGRAM_ID: z
    .string()
    .trim()
    .min(32)
    .max(64)
    .regex(/^[1-9A-HJ-NP-Za-km-z]+$/, 'QUPILOT_PROGRAM_ID must be a base58 Solana pubkey')
    .default('2auiCCwYy8pj6LpDnMomZRqKs49Gb5oRjtVkYDYRVmm3'),
  SOLANA_TREASURY_SECRET_KEY: z
    .string()
    .trim()
    .min(1, 'SOLANA_TREASURY_SECRET_KEY is required (base58 secret key)'),
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
