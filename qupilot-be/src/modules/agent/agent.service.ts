import { supabase } from '../../config/supabase';
import { AppError, throw404 } from '../../lib/errors';
import {
  verifySolanaClmmCloseTx,
  verifySolanaClmmCopyTxBasic,
  verifySolanaClmmOpenTx,
  verifySolanaSwapTxBasic,
} from '../../lib/solana';
import { PublicKey } from '@solana/web3.js';
import { resolveUserWalletById, syncClaimByUserId } from '../participations/participations.service';
import {
  buildJoinQuestTx,
  buildMarkParticipationCompleteTx,
  buildMarkParticipationFailedTx,
  buildClaimRewardTx,
  sendAdminTx,
} from '../../lib/solana/tx-builder';
import { parseAnchorErrorCode } from '../../lib/solana/anchor-error';
import type { SyncClaimBody } from './agent.schema';

type QuestRow = { id: number; expires_at: string; quest_pool_pda: string | null };
type QuestRewardRow = { reward_per_user: string | number; total_reward_pool: string | number; total_reward_distributed: string | number };

const nowIso = (): string => new Date().toISOString();

const resolveQuestId = async (questUuid: string): Promise<QuestRow> => {
  const { data, error } = await supabase
    .from('quests')
    .select('id, expires_at, quest_pool_pda')
    .eq('uuid', questUuid)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw404('QUEST_NOT_FOUND', 'Quest not found');
  return data as QuestRow;
};

export const join = async (
  userId: number,
  questUuid: string,
  agentWalletAddress: string,
): Promise<{
  uuid: string;
  status: 'inprogress';
  started_at: string;
  quest_pool_pda: string;
  participation_pda: string;
  join_tx_hash: string;
}> => {
  const quest = await resolveQuestId(questUuid);
  if (Date.parse(quest.expires_at) <= Date.now()) {
    throw new AppError(400, 'QUEST_EXPIRED', 'Quest has expired');
  }
  if (!quest.quest_pool_pda) {
    throw new AppError(409, 'QUEST_POOL_NOT_INITIALIZED', 'Quest has no on-chain reward pool');
  }

  // Pre-check to return a precise error code.
  // Race-condition safety is provided by the partial unique indexes in DB
  // (see migrations 0004 + 0012), which raise SQLSTATE 23505 on conflict.
  const existing = await supabase
    .from('quest_participations')
    .select('status')
    .eq('user_id', userId)
    .eq('quest_id', quest.id)
    .in('status', ['inprogress', 'success']);

  if (existing.error) throw existing.error;
  if (existing.data && existing.data.length > 0) {
    const statuses = new Set(existing.data.map((r) => (r as { status: string }).status));
    if (statuses.has('success')) {
      throw new AppError(409, 'PARTICIPATION_ALREADY_COMPLETED', 'Quest already completed by this user');
    }
    throw new AppError(409, 'PARTICIPATION_INPROGRESS_EXISTS', 'Participation already in progress for this quest');
  }

  const inserted = await supabase
    .from('quest_participations')
    .insert({
      user_id: userId,
      quest_id: quest.id,
      status: 'inprogress',
      agent_wallet_address: agentWalletAddress,
    })
    .select('id, uuid, status, started_at')
    .single();

  if (inserted.error) {
    // Fallback: a concurrent insert won the race between pre-check and insert.
    // We can't tell inprogress vs success from the error alone, so re-query.
    if (inserted.error.code === '23505') {
      const recheck = await supabase
        .from('quest_participations')
        .select('status')
        .eq('user_id', userId)
        .eq('quest_id', quest.id)
        .in('status', ['inprogress', 'success']);
      const hasSuccess = (recheck.data ?? []).some(
        (r) => (r as { status: string }).status === 'success',
      );
      if (hasSuccess) {
        throw new AppError(409, 'PARTICIPATION_ALREADY_COMPLETED', 'Quest already completed by this user');
      }
      throw new AppError(409, 'PARTICIPATION_INPROGRESS_EXISTS', 'Participation already in progress for this quest');
    }
    throw inserted.error;
  }

  const participation = inserted.data as { id: number; uuid: string; status: 'inprogress'; started_at: string };

  const stepsRes = await supabase
    .from('quest_steps')
    .select('id')
    .eq('quest_id', quest.id)
    .order('order_index', { ascending: true });
  if (stepsRes.error) throw stepsRes.error;

  const stepIds = (stepsRes.data ?? []) as Array<{ id: number }>;
  if (stepIds.length === 0) {
    throw new AppError(500, 'QUEST_STEPS_MISSING', 'Quest has no steps');
  }

  const stepPartRows = stepIds.map((s) => ({
    participation_id: participation.id,
    step_id: s.id,
    status: 'inprogress' as const,
  }));

  const stepPartRes = await supabase.from('quest_step_participations').insert(stepPartRows);
  if (stepPartRes.error) throw stepPartRes.error;

  const userWallet = await resolveUserWalletById(userId);
  const questPoolPda = new PublicKey(quest.quest_pool_pda);
  const userWalletPk = new PublicKey(userWallet);
  const agentWalletPk = new PublicKey(agentWalletAddress);

  try {
    const { tx, participationPda } = await buildJoinQuestTx({
      questPoolPda,
      userWallet: userWalletPk,
      agentWallet: agentWalletPk,
      participationUuid: participation.uuid,
    });
    const sig = await sendAdminTx(tx);

    const updated = await supabase
      .from('quest_participations')
      .update({
        join_tx_hash: sig,
        participation_pda: participationPda.toBase58(),
        requires_onchain_sync: false,
      })
      .eq('id', participation.id)
      .select('uuid, status, started_at, join_tx_hash, participation_pda')
      .single();
    if (updated.error) throw updated.error;

    return {
      uuid: updated.data.uuid,
      status: 'inprogress',
      started_at: updated.data.started_at,
      quest_pool_pda: quest.quest_pool_pda,
      participation_pda: updated.data.participation_pda,
      join_tx_hash: updated.data.join_tx_hash,
    };
  } catch (err) {
    await supabase.from('quest_participations').delete().eq('id', participation.id);

    const code = parseAnchorErrorCode(err);
    if (code === 'RewardPoolExhausted') {
      throw new AppError(409, 'REWARD_POOL_EXHAUSTED', 'Reward pool exhausted — all slots taken');
    }
    if (code === 'QuestNotActive') {
      throw new AppError(409, 'QUEST_NOT_ACTIVE', 'Quest is not active');
    }
    if (code === 'QuestExpired') {
      throw new AppError(400, 'QUEST_EXPIRED', 'Quest has expired');
    }
    throw err;
  }
};

type ParticipationRow = {
  id: number;
  uuid: string;
  user_id: number;
  quest_id: number;
  status: 'inprogress' | 'success' | 'failed';
  agent_wallet_address: string | null;
  participation_pda: string | null;
  quest_pool_pda: string | null;
};

type CompleteStepInput = { step_uuid: string; tx_hash: string };

type StepType = 'swap' | 'clmm_open' | 'clmm_close' | 'clmm_copy';

type StepRow = {
  id: number;
  status: 'inprogress' | 'success' | 'failed';
  quest_steps?: { step_type?: StepType; action_params?: unknown } | null;
};

const resolveParticipationForComplete = async (participationUuid: string): Promise<ParticipationRow> => {
  const { data, error } = await supabase
    .from('quest_participations')
    .select('id, uuid, user_id, quest_id, status, agent_wallet_address, participation_pda, quests(quest_pool_pda)')
    .eq('uuid', participationUuid)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw404('PARTICIPATION_NOT_FOUND', 'Participation not found');
  const raw = data as unknown as {
    id: number;
    uuid: string;
    user_id: number;
    quest_id: number;
    status: 'inprogress' | 'success' | 'failed';
    agent_wallet_address: string | null;
    participation_pda: string | null;
    quests:
      | { quest_pool_pda: string | null }
      | { quest_pool_pda: string | null }[]
      | null;
  };
  const q = Array.isArray(raw.quests) ? raw.quests[0] ?? null : raw.quests;
  return {
    id: raw.id,
    uuid: raw.uuid,
    user_id: raw.user_id,
    quest_id: raw.quest_id,
    status: raw.status,
    agent_wallet_address: raw.agent_wallet_address,
    participation_pda: raw.participation_pda,
    quest_pool_pda: q?.quest_pool_pda ?? null,
  };
};

const getExpectedSigner = (row: ParticipationRow, userId: number): string => {
  if (row.user_id !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'Participation does not belong to this user');
  }
  if (row.status !== 'inprogress') {
    throw new AppError(409, 'PARTICIPATION_NOT_INPROGRESS', 'Participation is not in progress');
  }
  const expectedSigner = row.agent_wallet_address;
  if (!expectedSigner) {
    throw new AppError(400, 'AGENT_WALLET_MISSING', 'agent_wallet_address is required for verification');
  }
  return expectedSigner;
};

type UserIdentityRow = { uuid: string; wallet_address: string };

const resolveUserIdentityById = async (userId: number): Promise<UserIdentityRow> => {
  const { data, error } = await supabase
    .from('users')
    .select('uuid, wallet_address')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw404('USER_NOT_FOUND', 'User not found');
  return data as unknown as UserIdentityRow;
};

export const getMyStats = async (userId: number): Promise<{
  total_participations: number;
  total_success: number;
  total_failed: number;
  total_inprogress: number;
  total_reward_earned: string;
  total_reward_claimed: string;
  total_reward_unclaimed: string;
}> => {
  const count = async (status?: 'success' | 'failed' | 'inprogress'): Promise<number> => {
    let q = supabase
      .from('quest_participations')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);
    if (status) q = q.eq('status', status);
    const res = await q;
    if (res.error) throw res.error;
    return res.count ?? 0;
  };

  const [total_participations, total_success, total_failed, total_inprogress] = await Promise.all([
    count(),
    count('success'),
    count('failed'),
    count('inprogress'),
  ]);

  // Sum rewards for successful participations by joining quests.reward_per_user.
  const successRows = await supabase
    .from('quest_participations')
    .select('reward_claimed, quests(reward_per_user)')
    .eq('user_id', userId)
    .eq('status', 'success');
  if (successRows.error) throw successRows.error;

  const rows = (successRows.data ?? []) as unknown as Array<{
    reward_claimed: boolean;
    quests: { reward_per_user: number | string } | { reward_per_user: number | string }[] | null;
  }>;

  let earned = 0n;
  let claimed = 0n;
  for (const r of rows) {
    const quest = Array.isArray(r.quests) ? r.quests[0] ?? null : r.quests;
    if (!quest) continue;
    const v = BigInt(String(quest.reward_per_user));
    earned += v;
    if (r.reward_claimed) claimed += v;
  }

  return {
    total_participations,
    total_success,
    total_failed,
    total_inprogress,
    total_reward_earned: earned.toString(),
    total_reward_claimed: claimed.toString(),
    total_reward_unclaimed: (earned - claimed).toString(),
  };
};

export const buildClaimTx = async (
  userId: number,
  participationUuid: string,
): Promise<{
  tx_base64: string;
  blockhash: string;
  last_valid_block_height: number;
  quest_pool_pda: string;
  participation_pda: string;
}> => {
  const identity = await resolveUserIdentityById(userId);

  const participationRes = await supabase
    .from('quest_participations')
    .select('uuid, status, reward_claimed, participation_pda, quests(quest_pool_pda)')
    .eq('user_id', userId)
    .eq('uuid', participationUuid)
    .maybeSingle();
  if (participationRes.error) throw participationRes.error;
  if (!participationRes.data) throw404('PARTICIPATION_NOT_FOUND', 'Participation not found');

  const row = participationRes.data as unknown as {
    uuid: string;
    status: 'inprogress' | 'success' | 'failed';
    reward_claimed: boolean;
    participation_pda: string | null;
    quests: { quest_pool_pda: string | null } | { quest_pool_pda: string | null }[] | null;
  };
  const q = Array.isArray(row.quests) ? row.quests[0] ?? null : row.quests;
  if (!q || !q.quest_pool_pda) {
    throw new AppError(409, 'QUEST_POOL_NOT_INITIALIZED', 'Quest has no on-chain reward pool');
  }
  if (row.status !== 'success') throw new AppError(409, 'NOT_CLAIMABLE', 'Reward is not yet claimable');
  if (row.reward_claimed) throw new AppError(409, 'ALREADY_CLAIMED', 'Reward already claimed');

  const questPoolPda = new PublicKey(q.quest_pool_pda);
  const claimer = new PublicKey(identity.wallet_address);

  const built = await buildClaimRewardTx({ questPoolPda, claimer });
  const txBase64 = built.tx
    .serialize({ requireAllSignatures: false, verifySignatures: false })
    .toString('base64');

  return {
    tx_base64: txBase64,
    blockhash: built.blockhash,
    last_valid_block_height: built.lastValidBlockHeight,
    quest_pool_pda: q.quest_pool_pda,
    participation_pda: row.participation_pda ?? built.participationPda.toBase58(),
  };
};

export const syncClaim = async (userId: number, body: SyncClaimBody): Promise<{ ok: true }> => {
  const identity = await resolveUserIdentityById(userId);
  const out = await syncClaimByUserId(identity.uuid, identity.wallet_address, body);
  if (!out.ok) throw new AppError(500, 'SYNC_FAILED', 'Failed to sync claim');
  return { ok: true };
};

const resolveStepRow = async (participationId: number, stepUuid: string): Promise<StepRow> => {
  const stepRow = await supabase
    .from('quest_step_participations')
    // IMPORTANT: use an inner join so that filtering on quest_steps.uuid is applied correctly.
    // Without `!inner`, PostgREST may ignore the embedded filter and return multiple rows,
    // causing `maybeSingle()` to throw PGRST116.
    .select('id, status, step_id, quest_steps!inner(uuid, step_type, action_params)')
    .eq('participation_id', participationId)
    .eq('quest_steps.uuid', stepUuid)
    .maybeSingle();

  if (stepRow.error) throw stepRow.error;
  if (!stepRow.data) throw404('STEP_NOT_FOUND', 'Quest step not found');
  return stepRow.data as unknown as StepRow;
};

const requireStringField = (obj: Record<string, unknown>, key: string): string => {
  const v = obj[key];
  if (typeof v !== 'string' || !v.trim()) {
    throw new AppError(400, 'STEP_ACTION_PARAMS_INVALID', `Missing or invalid ${key}`);
  }
  return v;
};

const optionalStringField = (obj: Record<string, unknown>, key: string): string | undefined => {
  const v = obj[key];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'string' || !v.trim()) {
    throw new AppError(400, 'STEP_ACTION_PARAMS_INVALID', `Missing or invalid ${key}`);
  }
  return v;
};

const verifyStepTx = async (
  stepType: StepType | undefined,
  actionParams: Record<string, unknown>,
  txHash: string,
  expectedSigner: string,
): Promise<{ ok: true } | { ok: false; reason: string }> => {
  if (stepType === 'swap') {
    // Prefer mint-based swap verification (deterministic). Fallback to symbol-based.
    const fromToken = optionalStringField(actionParams, 'from_token');
    const toToken = optionalStringField(actionParams, 'to_token');
    const fromMint = optionalStringField(actionParams, 'from_mint');
    const toMint = optionalStringField(actionParams, 'to_mint');
    const fromSym = optionalStringField(actionParams, 'from_token_symbol');
    const toSym = optionalStringField(actionParams, 'to_token_symbol');

    const preferredFromMint = fromToken ?? fromMint;
    const preferredToMint = toToken ?? toMint;

    const res = await verifySolanaSwapTxBasic({
      signature: txHash,
      expectedSigner,
      fromMint: preferredFromMint,
      toMint: preferredToMint,
      fromTokenSymbol: preferredFromMint ? undefined : fromSym,
      toTokenSymbol: preferredToMint ? undefined : toSym,
    });
    return res.ok ? { ok: true } : { ok: false, reason: res.reason };
  }

  if (stepType === 'clmm_open') {
    const token0Mint = requireStringField(actionParams, 'token0_mint');
    const token1Mint = requireStringField(actionParams, 'token1_mint');
    const positionMint = requireStringField(actionParams, 'position_mint');
    const res = await verifySolanaClmmOpenTx({
      signature: txHash,
      expectedSigner,
      token0Mint,
      token1Mint,
      positionMint,
    });
    return res.ok ? { ok: true } : { ok: false, reason: res.reason };
  }

  if (stepType === 'clmm_close') {
    const token0Mint = requireStringField(actionParams, 'token0_mint');
    const token1Mint = requireStringField(actionParams, 'token1_mint');
    const positionMint = requireStringField(actionParams, 'position_mint');
    const res = await verifySolanaClmmCloseTx({
      signature: txHash,
      expectedSigner,
      token0Mint,
      token1Mint,
      positionMint,
    });
    return res.ok ? { ok: true } : { ok: false, reason: res.reason };
  }

  if (stepType === 'clmm_copy') {
    const token0Mint = requireStringField(actionParams, 'token0_mint');
    const token1Mint = requireStringField(actionParams, 'token1_mint');
    const res = await verifySolanaClmmCopyTxBasic({
      signature: txHash,
      expectedSigner,
      token0Mint,
      token1Mint,
    });
    return res.ok ? { ok: true } : { ok: false, reason: res.reason };
  }

  throw new AppError(500, 'STEP_TYPE_UNKNOWN', 'Quest step type is missing or invalid');
};

const updateStepParticipation = async (rowId: number, status: 'success' | 'failed', txHash: string): Promise<void> => {
  const completed_at = nowIso();
  const updated = await supabase
    .from('quest_step_participations')
    .update({ status, tx_hash: txHash, completed_at })
    .eq('id', rowId)
    .select('id')
    .single();
  if (updated.error) throw updated.error;
};

const computeFinalStatus = async (
  participationId: number,
): Promise<'inprogress' | 'success' | 'failed'> => {
  const statusRes = await supabase
    .from('quest_step_participations')
    .select('status')
    .eq('participation_id', participationId);
  if (statusRes.error) throw statusRes.error;

  const statuses = (statusRes.data ?? []) as Array<{ status: 'inprogress' | 'success' | 'failed' }>;
  const anyFailed = statuses.some((r) => r.status === 'failed');
  const allSuccess = statuses.length > 0 && statuses.every((r) => r.status === 'success');

  if (anyFailed) return 'failed';
  if (allSuccess) return 'success';
  return 'inprogress';
};

export const complete = async (
  userId: number,
  participationUuid: string,
  steps: CompleteStepInput[],
): Promise<{
  uuid: string;
  status: 'inprogress' | 'success' | 'failed';
  completed_at: string | null;
  quest_pool_pda?: string;
  participation_pda?: string;
  complete_tx_hash?: string | null;
}> => {
  const row = await resolveParticipationForComplete(participationUuid);
  const expectedSigner = getExpectedSigner(row, userId);

  for (const s of steps) {
    const base = await resolveStepRow(row.id, s.step_uuid);
    if (base.status !== 'inprogress') {
      throw new AppError(409, 'STEP_ALREADY_COMPLETED', 'Step already completed');
    }

    const stepType = base.quest_steps?.step_type;
    const actionParams = (base.quest_steps?.action_params ?? {}) as Record<string, unknown>;
    const v = await verifyStepTx(stepType, actionParams, s.tx_hash, expectedSigner);
    if (!v.ok) {
      // Important: do NOT mark the step or participation as failed on verification failure.
      // This allows the agent to retry (e.g., wrong tx hash, RPC flake, wrong token mint).
      throw new AppError(422, 'STEP_VERIFICATION_FAILED', `Step verification failed: ${v.reason}`);
    }
    await updateStepParticipation(base.id, 'success', s.tx_hash);
  }

  const finalStatus = await computeFinalStatus(row.id);
  if (finalStatus === 'inprogress') {
    return { uuid: row.uuid, status: 'inprogress', completed_at: null };
  }

  if (!row.quest_pool_pda) {
    throw new AppError(500, 'QUEST_POOL_NOT_INITIALIZED', 'Quest has no on-chain reward pool');
  }

  // Align with API.md: total_reward_distributed is bumped when a participation becomes `success`
  // (i.e., when the agent completes the quest successfully), not at claim time.
  if (finalStatus === 'success') {
    const questRes = await supabase
      .from('quests')
      .select('reward_per_user, total_reward_pool, total_reward_distributed')
      .eq('id', row.quest_id)
      .maybeSingle();
    if (questRes.error) throw questRes.error;
    if (!questRes.data) throw404('QUEST_NOT_FOUND', 'Quest not found');

    const q = questRes.data as unknown as QuestRewardRow;
    const rewardPerUser = BigInt(String(q.reward_per_user));
    const pool = BigInt(String(q.total_reward_pool));
    const distributed = BigInt(String(q.total_reward_distributed));
    const newDistributed = distributed + rewardPerUser;

    if (newDistributed > pool) {
      // Defensive: on-chain `join_quest` should prevent this via allocated_amount checks,
      // but we keep the check to match documented behavior.
      throw new AppError(409, 'REWARD_POOL_EXHAUSTED', 'Reward pool exhausted — all slots taken');
    }
  }

  const questPoolPda = new PublicKey(row.quest_pool_pda);
  const participationPda = row.participation_pda ? new PublicKey(row.participation_pda) : null;
  if (!participationPda) {
    throw new AppError(500, 'PARTICIPATION_PDA_MISSING', 'Participation missing on-chain PDA reference');
  }

  const completed_at = nowIso();
  const delaysMs = [0, 1000, 2000];

  const sendWithRetry = async (): Promise<string | null> => {
    for (const d of delaysMs) {
      if (d > 0) await new Promise((r) => setTimeout(r, d));
      try {
        if (finalStatus === 'success') {
          const tx = await buildMarkParticipationCompleteTx({ questPoolPda, participationPda });
          return await sendAdminTx(tx);
        }
        const tx = await buildMarkParticipationFailedTx({ questPoolPda, participationPda });
        return await sendAdminTx(tx);
      } catch {
      }
    }
    return null;
  };

  const completeTxHash = await sendWithRetry();

  const updatedPart = await supabase
    .from('quest_participations')
    .update({
      status: finalStatus,
      completed_at,
      complete_tx_hash: completeTxHash,
      requires_onchain_sync: completeTxHash === null,
    })
    .eq('id', row.id)
    .select('uuid, status, completed_at, complete_tx_hash, participation_pda')
    .single();
  if (updatedPart.error) throw updatedPart.error;

  if (finalStatus === 'success') {
    // Best-effort bump. If it fails, we surface error so it can be fixed (data consistency).
    const questRes = await supabase
      .from('quests')
      .select('reward_per_user, total_reward_pool, total_reward_distributed')
      .eq('id', row.quest_id)
      .maybeSingle();
    if (questRes.error) throw questRes.error;
    if (!questRes.data) throw404('QUEST_NOT_FOUND', 'Quest not found');

    const q = questRes.data as unknown as QuestRewardRow;
    const rewardPerUser = BigInt(String(q.reward_per_user));
    const pool = BigInt(String(q.total_reward_pool));
    const distributed = BigInt(String(q.total_reward_distributed));
    const newDistributed = distributed + rewardPerUser;

    if (newDistributed > pool) {
      throw new AppError(409, 'REWARD_POOL_EXHAUSTED', 'Reward pool exhausted — all slots taken');
    }

    const bump = await supabase
      .from('quests')
      .update({ total_reward_distributed: newDistributed.toString() })
      .eq('id', row.quest_id);
    if (bump.error) throw bump.error;
  }

  return {
    uuid: updatedPart.data.uuid,
    status: updatedPart.data.status,
    completed_at: updatedPart.data.completed_at,
    quest_pool_pda: row.quest_pool_pda,
    participation_pda: updatedPart.data.participation_pda ?? participationPda.toBase58(),
    complete_tx_hash: updatedPart.data.complete_tx_hash,
  };
};
