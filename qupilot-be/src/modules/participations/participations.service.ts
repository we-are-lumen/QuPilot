import * as anchor from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { supabase } from '../../config/supabase';
import { env } from '../../config/env';
import { AppError, throw404 } from '../../lib/errors';
import { getSolanaConnection } from '../../lib/solana';
import qupilotIdl from '../../lib/solana/idl/qupilot.json';
import { deriveParticipationPda } from '../../lib/solana/pda';

export type ParticipationStatus = 'inprogress' | 'success' | 'failed';

export type ParticipationItem = {
  uuid: string;
  status: ParticipationStatus;
  reward_claimed: boolean;
  started_at: string;
  completed_at: string | null;
  participation_pda: string | null;
  quest_pool_pda: string | null;
  join_tx_hash: string | null;
  complete_tx_hash: string | null;
  claim_tx_hash: string | null;
  reward_amount: number | string;
  quest: {
    uuid: string;
    title: string;
    description: string;
    protocol: string;
    steps: Array<{
      uuid: string;
      order_index: number;
      step_type: string;
      action_params: Record<string, unknown>;
    }>;
    total_reward_pool: number | string;
    reward_per_user: number | string;
    total_reward_distributed: number | string;
    reward_token: string;
    tx_hash: string;
    quest_pool_pda: string | null;
    expires_at: string;
    created_at: string;
    provider: {
      uuid: string;
      display_name: string | null;
      logo_url: string | null;
    } | null;
  };
};

export type ParticipationDetail = ParticipationItem & { can_claim: boolean };

export type SyncClaimResult = { ok: true };

type UserRow = { id: number };

const resolveUserId = async (userUuid: string): Promise<number> => {
  const { data, error } = await supabase.from('users').select('id').eq('uuid', userUuid).maybeSingle();
  if (error) throw error;
  if (!data) throw404('USER_NOT_FOUND', 'User not found');
  return (data as UserRow).id;
};

const toProvider = (
  users:
    | { uuid: string; display_name: string | null; logo_url: string | null }
    | { uuid: string; display_name: string | null; logo_url: string | null }[]
    | null,
) => (Array.isArray(users) ? users[0] ?? null : users);

type QuestEmbed = {
  uuid: string;
  title: string;
  description: string;
  protocol: string;
  quest_steps:
    | { uuid: string; order_index: number; step_type: string; action_params: unknown }[]
    | null;
  total_reward_pool: number | string;
  reward_per_user: number | string;
  total_reward_distributed: number | string;
  reward_token: string;
  tx_hash: string;
  quest_pool_pda: string | null;
  expires_at: string;
  created_at: string;
  users:
    | { uuid: string; display_name: string | null; logo_url: string | null }
    | { uuid: string; display_name: string | null; logo_url: string | null }[]
    | null;
};

const toQuest = (quests: QuestEmbed | QuestEmbed[] | null): QuestEmbed | null =>
  Array.isArray(quests) ? quests[0] ?? null : quests;

export const listByUser = async (userUuid: string): Promise<ParticipationItem[]> => {
  const user_id = await resolveUserId(userUuid);

  const { data, error } = await supabase
    .from('quest_participations')
    .select(
      'uuid, status, reward_claimed, started_at, completed_at, participation_pda, join_tx_hash, complete_tx_hash, claim_tx_hash, quests(uuid, title, description, protocol, quest_steps(uuid, order_index, step_type, action_params), total_reward_pool, reward_per_user, total_reward_distributed, reward_token, tx_hash, quest_pool_pda, expires_at, created_at, users(uuid, display_name, logo_url))',
    )
    .eq('user_id', user_id)
    .order('started_at', { ascending: false });

  if (error) throw error;

  const rows = (data ?? []) as unknown as Array<{
    uuid: string;
    status: ParticipationStatus;
    reward_claimed: boolean;
    started_at: string;
    completed_at: string | null;
    participation_pda: string | null;
    join_tx_hash: string | null;
    complete_tx_hash: string | null;
    claim_tx_hash: string | null;
    quests: QuestEmbed | QuestEmbed[] | null;
  }>;

  return rows
    .map((r) => ({ ...r, quests: toQuest(r.quests) }))
    .filter((r) => r.quests !== null)
    .map((r) => {
      const q = toQuest(r.quests)!;
      return {
        uuid: r.uuid,
        status: r.status,
        reward_claimed: r.reward_claimed,
        started_at: r.started_at,
        completed_at: r.completed_at,
        participation_pda: r.participation_pda,
        quest_pool_pda: q.quest_pool_pda,
        join_tx_hash: r.join_tx_hash,
        complete_tx_hash: r.complete_tx_hash,
        claim_tx_hash: r.claim_tx_hash,
        reward_amount: q.reward_per_user,
        quest: {
          uuid: q.uuid,
          title: q.title,
          description: q.description,
          protocol: q.protocol,
          steps: (q.quest_steps ?? [])
            .slice()
            .sort((a, b) => a.order_index - b.order_index)
            .map((s) => ({
              uuid: s.uuid,
              order_index: s.order_index,
              step_type: s.step_type,
              action_params: (s.action_params ?? {}) as Record<string, unknown>,
            })),
          total_reward_pool: q.total_reward_pool,
          reward_per_user: q.reward_per_user,
          total_reward_distributed: q.total_reward_distributed,
          reward_token: q.reward_token,
          tx_hash: q.tx_hash,
          quest_pool_pda: q.quest_pool_pda,
          expires_at: q.expires_at,
          created_at: q.created_at,
          provider: toProvider(q.users),
        },
      };
    });
};

export const getDetailForUser = async (userUuid: string, questUuid: string): Promise<ParticipationDetail> => {
  const user_id = await resolveUserId(userUuid);

  const { data, error } = await supabase
    .from('quest_participations')
    .select(
      'uuid, status, reward_claimed, started_at, completed_at, participation_pda, join_tx_hash, complete_tx_hash, claim_tx_hash, quests(uuid, title, description, protocol, quest_steps(uuid, order_index, step_type, action_params), total_reward_pool, reward_per_user, total_reward_distributed, reward_token, tx_hash, quest_pool_pda, expires_at, created_at, users(uuid, display_name, logo_url))',
    )
    .eq('user_id', user_id)
    .eq('quests.uuid', questUuid)
    .order('started_at', { ascending: false })
    .maybeSingle();

  if (error) throw error;
  const base = data as unknown as { quests?: unknown };
  const maybeQuest = toQuest((base.quests ?? null) as QuestEmbed | QuestEmbed[] | null);
  if (!data || !maybeQuest) throw404('PARTICIPATION_NOT_FOUND', 'Participation not found');

  const row = data as unknown as {
    uuid: string;
    status: ParticipationStatus;
    reward_claimed: boolean;
    started_at: string;
    completed_at: string | null;
    participation_pda: string | null;
    join_tx_hash: string | null;
    complete_tx_hash: string | null;
    claim_tx_hash: string | null;
    quests: QuestEmbed | QuestEmbed[];
  };

  const q = toQuest(row.quests)!;

  const item: ParticipationItem = {
    uuid: row.uuid,
    status: row.status,
    reward_claimed: row.reward_claimed,
    started_at: row.started_at,
    completed_at: row.completed_at,
    participation_pda: row.participation_pda,
    quest_pool_pda: q.quest_pool_pda,
    join_tx_hash: row.join_tx_hash,
    complete_tx_hash: row.complete_tx_hash,
    claim_tx_hash: row.claim_tx_hash,
    reward_amount: q.reward_per_user,
    quest: {
      uuid: q.uuid,
      title: q.title,
      description: q.description,
      protocol: q.protocol,
      steps: (q.quest_steps ?? [])
        .slice()
        .sort((a, b) => a.order_index - b.order_index)
        .map((s) => ({
          uuid: s.uuid,
          order_index: s.order_index,
          step_type: s.step_type,
          action_params: (s.action_params ?? {}) as Record<string, unknown>,
        })),
      total_reward_pool: q.total_reward_pool,
      reward_per_user: q.reward_per_user,
      total_reward_distributed: q.total_reward_distributed,
      reward_token: q.reward_token,
      tx_hash: q.tx_hash,
      quest_pool_pda: q.quest_pool_pda,
      expires_at: q.expires_at,
      created_at: q.created_at,
      provider: toProvider(q.users),
    },
  };

  return {
    ...item,
    can_claim: item.status === 'success' && !item.reward_claimed,
  };
};

export const resolveUserWalletById = async (userId: number): Promise<string> => {
  const { data, error } = await supabase
    .from('users')
    .select('wallet_address')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw404('USER_NOT_FOUND', 'User not found');
  return (data as { wallet_address: string }).wallet_address;
};

const getRewardClaimedEvent = (programId: PublicKey, coder: anchor.BorshCoder, logs: string[]) => {
  const parser = new anchor.EventParser(programId, coder);
  for (const ev of parser.parseLogs(logs)) {
    if (ev.name === 'RewardClaimed' || ev.name === 'rewardClaimed') return ev;
  }
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

const parsePubkey = (v: unknown): string | null => {
  if (!v) return null;
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && v !== null && 'toBase58' in v) {
    return (v as { toBase58: () => string }).toBase58();
  }
  return null;
};

export const syncClaimByUserId = async (
  userUuid: string,
  walletAddress: string,
  body: { participation_uuid: string; claim_tx_hash: string },
): Promise<SyncClaimResult> => {
  const user_id = await resolveUserId(userUuid);

  const participationRes = await supabase
    .from('quest_participations')
    .select('id, uuid, status, reward_claimed, participation_pda, quests(id, quest_pool_pda, reward_per_user, total_reward_pool, total_reward_distributed)')
    .eq('user_id', user_id)
    .eq('uuid', body.participation_uuid)
    .maybeSingle();

  if (participationRes.error) throw participationRes.error;
  if (!participationRes.data) throw404('PARTICIPATION_NOT_FOUND', 'Participation not found');

  const row = participationRes.data as unknown as {
    id: number;
    uuid: string;
    status: ParticipationStatus;
    reward_claimed: boolean;
    participation_pda: string | null;
    quests:
      | {
          id: number;
          quest_pool_pda: string | null;
          reward_per_user: number | string;
          total_reward_pool: number | string;
          total_reward_distributed: number | string;
        }
      | {
          id: number;
          quest_pool_pda: string | null;
          reward_per_user: number | string;
          total_reward_pool: number | string;
          total_reward_distributed: number | string;
        }[]
      | null;
  };

  const quest = Array.isArray(row.quests) ? row.quests[0] ?? null : row.quests;
  if (!quest) {
    throw new AppError(404, 'QUEST_NOT_FOUND', 'Quest not found');
  }
  if (!quest.quest_pool_pda) throw new AppError(500, 'QUEST_POOL_NOT_INITIALIZED', 'Quest has no on-chain reward pool');

  if (row.reward_claimed) {
    return { ok: true };
  }
  if (row.status !== 'success') {
    throw new AppError(409, 'NOT_CLAIMABLE', 'Reward is not yet claimable');
  }

  const conn = getSolanaConnection();
  const delaysMs = [0, 1000, 2000, 4000];

  let tx: Awaited<ReturnType<typeof conn.getTransaction>> | null = null;
  for (const d of delaysMs) {
    if (d > 0) await new Promise((r) => setTimeout(r, d));
    tx = await conn.getTransaction(body.claim_tx_hash, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 });
    if (tx) break;
  }

  if (!tx || !tx.meta) throw new AppError(404, 'TX_NOT_FOUND', 'Transaction not found');
  if (tx.meta.err) throw new AppError(400, 'TX_FAILED', 'Transaction failed on-chain');

  const programId = new PublicKey(env.QUPILOT_PROGRAM_ID);
  const coder = new anchor.BorshCoder(qupilotIdl as unknown as anchor.Idl);
  const logs = tx.meta.logMessages ?? [];
  const ev = getRewardClaimedEvent(programId, coder, logs);
  if (!ev) throw new AppError(400, 'REWARD_CLAIM_EVENT_MISSING', 'RewardClaimed event missing');

  const data = ev.data as Record<string, unknown>;

  const eventQuestPool = parsePubkey(data.questPool ?? data.quest_pool);
  const eventParticipation = parsePubkey(data.participation);
  const eventUserWallet = parsePubkey(data.userWallet ?? data.user_wallet);
  const eventAmount = parseBigint(data.amount);

  const questPoolPda = new PublicKey(quest.quest_pool_pda);
  const expectedParticipationPda =
    row.participation_pda ??
    deriveParticipationPda(programId, questPoolPda, new PublicKey(walletAddress))[0].toBase58();

  if (!eventQuestPool || eventQuestPool !== questPoolPda.toBase58()) {
    throw new AppError(400, 'QUEST_POOL_MISMATCH', 'RewardClaimed quest_pool mismatch');
  }
  if (!eventParticipation || eventParticipation !== expectedParticipationPda) {
    throw new AppError(400, 'PARTICIPATION_PDA_MISMATCH', 'RewardClaimed participation mismatch');
  }
  if (!eventUserWallet || eventUserWallet !== walletAddress) {
    throw new AppError(400, 'WALLET_MISMATCH', 'RewardClaimed user_wallet mismatch');
  }

  const expectedAmount = BigInt(String(quest.reward_per_user));
  if (eventAmount === null || eventAmount !== expectedAmount) {
    throw new AppError(400, 'AMOUNT_MISMATCH', 'RewardClaimed amount mismatch');
  }

  const upd = await supabase
    .from('quest_participations')
    .update({
      reward_claimed: true,
      claim_tx_hash: body.claim_tx_hash,
      requires_onchain_sync: false,
      participation_pda: expectedParticipationPda,
    })
    .eq('id', row.id);
  if (upd.error) throw upd.error;

  return { ok: true };
};
