import { supabase } from '../../config/supabase';
import { AppError, throw404 } from '../../lib/errors';
import { verifySolanaClmmCloseTx, verifySolanaClmmOpenTx, verifySolanaSwapTxBasic } from '../../lib/solana';
import {
  claimAllByUserId,
  resolveUserWalletById,
  type ClaimResult,
} from '../participations/participations.service';

type QuestRow = { id: number; expires_at: string };

const nowIso = (): string => new Date().toISOString();

const resolveQuestId = async (questUuid: string): Promise<QuestRow> => {
  const { data, error } = await supabase.from('quests').select('id, expires_at').eq('uuid', questUuid).maybeSingle();
  if (error) throw error;
  if (!data) throw404('QUEST_NOT_FOUND', 'Quest not found');
  return data as QuestRow;
};

export const join = async (
  userId: number,
  questUuid: string,
  agentWalletAddress: string,
): Promise<{ uuid: string; status: 'inprogress'; started_at: string }> => {
  const quest = await resolveQuestId(questUuid);
  if (Date.parse(quest.expires_at) <= Date.now()) {
    throw new AppError(400, 'QUEST_EXPIRED', 'Quest has expired');
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

  const { id: _id, ...resp } = participation;
  return resp;
};

type ParticipationRow = {
  id: number;
  uuid: string;
  user_id: number;
  quest_id: number;
  status: 'inprogress' | 'success' | 'failed';
  agent_wallet_address: string | null;
};

type QuestRewardRow = {
  id: number;
  reward_per_user: number | string;
  total_reward_pool: number | string;
  total_reward_distributed: number | string;
};

type CompleteStepInput = { step_uuid: string; tx_hash: string };

const toBigIntSafe = (v: number | string): bigint => {
  if (typeof v === 'number') return BigInt(Math.trunc(v));
  return BigInt(v);
};

type StepType = 'swap' | 'clmm_open' | 'clmm_close';

type StepRow = {
  id: number;
  status: 'inprogress' | 'success' | 'failed';
  quest_steps?: { step_type?: StepType; action_params?: unknown } | null;
};

const resolveParticipationForComplete = async (participationUuid: string): Promise<ParticipationRow> => {
  const { data, error } = await supabase
    .from('quest_participations')
    .select('id, uuid, user_id, quest_id, status, agent_wallet_address')
    .eq('uuid', participationUuid)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw404('PARTICIPATION_NOT_FOUND', 'Participation not found');
  return data as unknown as ParticipationRow;
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

const resolveStepRow = async (participationId: number, stepUuid: string): Promise<StepRow> => {
  const stepRow = await supabase
    .from('quest_step_participations')
    .select('id, status, step_id, quest_steps(uuid, step_type, action_params)')
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

const verifyStepTx = async (
  stepType: StepType | undefined,
  actionParams: Record<string, unknown>,
  txHash: string,
  expectedSigner: string,
): Promise<boolean> => {
  if (stepType === 'swap') {
    const from = requireStringField(actionParams, 'from_token_symbol');
    const to = requireStringField(actionParams, 'to_token_symbol');
    const res = await verifySolanaSwapTxBasic({
      signature: txHash,
      expectedSigner,
      fromTokenSymbol: from,
      toTokenSymbol: to,
    });
    return res.ok;
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
    return res.ok;
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
    return res.ok;
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

const bumpRewardDistributed = async (questId: number): Promise<void> => {
  const questRes = await supabase
    .from('quests')
    .select('id, reward_per_user, total_reward_pool, total_reward_distributed')
    .eq('id', questId)
    .maybeSingle();
  if (questRes.error) throw questRes.error;
  if (!questRes.data) throw404('QUEST_NOT_FOUND', 'Quest not found');
  const quest = questRes.data as unknown as QuestRewardRow;

  const perUser = toBigIntSafe(quest.reward_per_user);
  const pool = toBigIntSafe(quest.total_reward_pool);
  const distributed = toBigIntSafe(quest.total_reward_distributed);
  const newDistributed = distributed + perUser;

  if (newDistributed > pool) {
    throw new AppError(409, 'REWARD_POOL_EXHAUSTED', 'Quest reward pool has been exhausted');
  }

  const bumpRes = await supabase
    .from('quests')
    .update({ total_reward_distributed: newDistributed.toString() })
    .eq('id', quest.id);
  if (bumpRes.error) throw bumpRes.error;
};

const finalizeParticipation = async (
  rowId: number,
  status: 'success' | 'failed',
  completedAt: string,
): Promise<{ uuid: string; status: 'success' | 'failed'; completed_at: string }> => {
  const updatedPart = await supabase
    .from('quest_participations')
    .update({ status, completed_at: completedAt })
    .eq('id', rowId)
    .select('uuid, status, completed_at')
    .single();
  if (updatedPart.error) throw updatedPart.error;
  return updatedPart.data as unknown as { uuid: string; status: 'success' | 'failed'; completed_at: string };
};

export const complete = async (
  userId: number,
  participationUuid: string,
  steps: CompleteStepInput[],
): Promise<{
  uuid: string;
  status: 'inprogress' | 'success' | 'failed';
  completed_at: string | null;
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
    const ok = await verifyStepTx(stepType, actionParams, s.tx_hash, expectedSigner);
    await updateStepParticipation(base.id, ok ? 'success' : 'failed', s.tx_hash);
  }

  const finalStatus = await computeFinalStatus(row.id);
  if (finalStatus === 'inprogress') {
    return { uuid: row.uuid, status: 'inprogress', completed_at: null };
  }

  const completed_at = nowIso();
  if (finalStatus === 'success') {
    await bumpRewardDistributed(row.quest_id);
  }

  const out = await finalizeParticipation(row.id, finalStatus, completed_at);
  return { uuid: out.uuid, status: out.status, completed_at: out.completed_at };
};

export const claim = async (userId: number): Promise<ClaimResult> => {
  const wallet = await resolveUserWalletById(userId);
  return claimAllByUserId(userId, wallet);
};
