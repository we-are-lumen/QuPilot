import * as anchor from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { createHash } from 'crypto';
import qupilotIdl from '../solana/idl/qupilot.json';
import { getSolanaConnection } from '../solana';
import { env } from '../../config/env';

export type VerifyCreateQuestInput = {
  txSignature: string;
  expected: {
    providerWallet: string;
    questUuid: string;
    totalRewardPoolLamports: bigint;
    rewardPerUserLamports: bigint;
    expiresAt: Date;
  };
};

export type VerifyCreateQuestResult =
  | { ok: true; questPoolPda: string; questIdBytes: Buffer }
  | { ok: false; reason: string };

const uuidToBytes32 = (uuid: string): Buffer => createHash('sha256').update(uuid).digest();

const getQuestCreatedEvent = (programId: PublicKey, coder: anchor.BorshCoder, logs: string[]) => {
  const parser = new anchor.EventParser(programId, coder);
  for (const ev of parser.parseLogs(logs)) {
    if (ev.name === 'QuestCreated' || ev.name === 'questCreated') return ev;
  }
  return null;
};

const toBytes = (v: unknown): Buffer | null => {
  if (!v) return null;
  if (Buffer.isBuffer(v)) return v;
  if (v instanceof Uint8Array) return Buffer.from(v);
  if (Array.isArray(v) && v.every((x) => typeof x === 'number')) return Buffer.from(v);
  return null;
};

const parseBigint = (v: unknown): bigint | null => {
  if (typeof v === 'bigint') return v;
  if (typeof v === 'number' && Number.isSafeInteger(v)) return BigInt(v);
  if (typeof v === 'string' && v.trim().length > 0) return BigInt(v);
  if (typeof v === 'object' && v !== null && 'toString' in v && typeof (v as { toString: unknown }).toString === 'function') {
    return BigInt((v as { toString: () => string }).toString());
  }
  return null;
};

export const verifyCreateQuestTx = async (input: VerifyCreateQuestInput): Promise<VerifyCreateQuestResult> => {
  const programId = new PublicKey(env.QUPILOT_PROGRAM_ID);
  const coder = new anchor.BorshCoder(qupilotIdl as unknown as anchor.Idl);

  const conn = getSolanaConnection();
  const delaysMs = [0, 1000, 2000, 4000];

  let tx: Awaited<ReturnType<typeof conn.getTransaction>> | null = null;
  for (const d of delaysMs) {
    if (d > 0) await new Promise((r) => setTimeout(r, d));
    tx = await conn.getTransaction(input.txSignature, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 });
    if (tx) break;
  }

  if (!tx || !tx.meta) return { ok: false, reason: 'tx not found' };
  if (tx.meta.err) return { ok: false, reason: 'tx failed on-chain' };

  const logs = tx.meta.logMessages ?? [];
  const created = getQuestCreatedEvent(programId, coder, logs);
  if (!created) return { ok: false, reason: 'QuestCreated event missing' };

  const data = created.data as Record<string, unknown>;

  const eventProvider = data.provider;
  const providerStr =
    typeof eventProvider === 'string'
      ? eventProvider
      : typeof eventProvider === 'object' && eventProvider !== null && 'toBase58' in eventProvider
        ? (eventProvider as { toBase58: () => string }).toBase58()
        : null;

  if (!providerStr) return { ok: false, reason: 'provider mismatch' };
  if (providerStr !== input.expected.providerWallet) return { ok: false, reason: 'provider mismatch' };

  const questIdBytes = uuidToBytes32(input.expected.questUuid);
  const eventQuestId = toBytes(data.questId ?? data.quest_id);
  if (!eventQuestId) return { ok: false, reason: 'quest_id mismatch' };
  if (!eventQuestId.equals(questIdBytes)) return { ok: false, reason: 'quest_id mismatch' };

  const totalRewardPool = parseBigint(data.totalRewardPool ?? data.total_reward_pool);
  const rewardPerUser = parseBigint(data.rewardPerUser ?? data.reward_per_user);
  const expiresAt = parseBigint(data.expiresAt ?? data.expires_at);

  if (totalRewardPool === null) return { ok: false, reason: 'total_reward_pool mismatch' };
  if (rewardPerUser === null) return { ok: false, reason: 'reward_per_user mismatch' };
  if (expiresAt === null) return { ok: false, reason: 'expires_at mismatch' };

  if (totalRewardPool !== input.expected.totalRewardPoolLamports) return { ok: false, reason: 'total_reward_pool mismatch' };
  if (rewardPerUser !== input.expected.rewardPerUserLamports) return { ok: false, reason: 'reward_per_user mismatch' };

  const expectedTs = BigInt(Math.floor(input.expected.expiresAt.getTime() / 1000));
  const diff = expiresAt > expectedTs ? expiresAt - expectedTs : expectedTs - expiresAt;
  if (diff > 1n) return { ok: false, reason: 'expires_at mismatch' };

  const providerPk = new PublicKey(input.expected.providerWallet);
  const [questPoolPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('quest'), providerPk.toBuffer(), questIdBytes],
    programId,
  );

  return { ok: true, questPoolPda: questPoolPda.toBase58(), questIdBytes };
};

