import { supabase } from '../../config/supabase';
import { AppError, throw404 } from '../../lib/errors';
import { verifyTxBasic } from '../../lib/evm';
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

export const complete = async (
  userId: number,
  participationUuid: string,
  steps: CompleteStepInput[],
): Promise<{
  uuid: string;
  status: 'inprogress' | 'success' | 'failed';
  completed_at: string | null;
}> => {
  const { data, error } = await supabase
    .from('quest_participations')
    .select('id, uuid, user_id, quest_id, status')
    .eq('uuid', participationUuid)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw404('PARTICIPATION_NOT_FOUND', 'Participation not found');

  const row = data as unknown as ParticipationRow;
  if (row.user_id !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'Participation does not belong to this user');
  }
  if (row.status !== 'inprogress') {
    throw new AppError(409, 'PARTICIPATION_NOT_INPROGRESS', 'Participation is not in progress');
  }

  const userWallet = await resolveUserWalletById(userId);

  for (const s of steps) {
    const stepRow = await supabase
      .from('quest_step_participations')
      .select('id, status, step_id, quest_steps(uuid)')
      .eq('participation_id', row.id)
      .eq('quest_steps.uuid', s.step_uuid)
      .maybeSingle();

    if (stepRow.error) throw stepRow.error;
    if (!stepRow.data) throw404('STEP_NOT_FOUND', 'Quest step not found');

    const base = stepRow.data as unknown as {
      id: number;
      status: 'inprogress' | 'success' | 'failed';
    };
    if (base.status !== 'inprogress') {
      throw new AppError(409, 'STEP_ALREADY_COMPLETED', 'Step already completed');
    }

    const ok = await verifyTxBasic(s.tx_hash, userWallet);
    const status: 'success' | 'failed' = ok ? 'success' : 'failed';
    const completed_at = nowIso();

    const updated = await supabase
      .from('quest_step_participations')
      .update({ status, tx_hash: s.tx_hash, completed_at })
      .eq('id', base.id)
      .select('id')
      .single();
    if (updated.error) throw updated.error;
  }

  const statusRes = await supabase
    .from('quest_step_participations')
    .select('status')
    .eq('participation_id', row.id);
  if (statusRes.error) throw statusRes.error;

  const statuses = (statusRes.data ?? []) as Array<{ status: 'inprogress' | 'success' | 'failed' }>;
  const anyFailed = statuses.some((r) => r.status === 'failed');
  const allSuccess = statuses.length > 0 && statuses.every((r) => r.status === 'success');

  let finalStatus: ParticipationRow['status'] = 'inprogress';
  if (anyFailed) finalStatus = 'failed';
  else if (allSuccess) finalStatus = 'success';

  if (finalStatus === 'inprogress') {
    return { uuid: row.uuid, status: 'inprogress', completed_at: null };
  }

  const completed_at = nowIso();

  if (finalStatus === 'success') {
    const questRes = await supabase
      .from('quests')
      .select('id, reward_per_user, total_reward_pool, total_reward_distributed')
      .eq('id', row.quest_id)
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
  }

  const updatedPart = await supabase
    .from('quest_participations')
    .update({ status: finalStatus, completed_at })
    .eq('id', row.id)
    .select('uuid, status, completed_at')
    .single();
  if (updatedPart.error) throw updatedPart.error;

  const out = updatedPart.data as unknown as { uuid: string; status: ParticipationRow['status']; completed_at: string };
  return { uuid: out.uuid, status: out.status, completed_at: out.completed_at };
};

export const claim = async (userId: number): Promise<ClaimResult> => {
  const wallet = await resolveUserWalletById(userId);
  return claimAllByUserId(userId, wallet);
};
