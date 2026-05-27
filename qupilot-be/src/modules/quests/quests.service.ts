import { supabase } from '../../config/supabase';
import { throw400, throw403, throw404, throw409 } from '../../lib/errors';
import { verifyCreateQuestTx } from '../../lib/solana/verify-create-quest';
import type { CreateQuestBody, ListPublicQuery, Protocol, QuestStepInput, StepType } from './quests.schema';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type QuestStepPublic = {
  uuid: string;
  order_index: number;
  step_type: StepType;
  action_params: Record<string, unknown>;
};

export type QuestPublic = {
  uuid: string;
  title: string;
  description: string;
  protocol: Protocol;
  steps: QuestStepPublic[];
  total_reward_pool: number | string;
  reward_per_user: number | string;
  total_reward_distributed: number | string;
  reward_token: string;
  tx_hash: string;
  quest_pool_pda: string | null;
  quest_id_onchain: string | null;
  expires_at: string;
  created_at: string;
};

export type QuestListItem = QuestPublic & { participation_count: number };

export type ProviderSummary = {
  uuid: string;
  display_name: string | null;
  logo_url: string | null;
};

export type PublicQuestListItem = QuestListItem & { provider: ProviderSummary | null };

export type QuestAnalytics = {
  total: number;
  success: number;
  failed: number;
  success_rate: number;
};

export type ProviderDepositHighlights = ProviderSummary & {
  total_deposit_reward_pool: string;
};

type ProviderRow = { id: number };

// Raw row shape returned from Supabase before we normalize quest_steps.
type QuestRawRow = Omit<QuestPublic, 'steps'> & {
  quest_steps?: Array<{
    uuid: string;
    order_index: number;
    step_type: StepType;
    action_params: Record<string, unknown>;
  }>;
};

const QUEST_BASE_COLS =
  'uuid, title, description, protocol, total_reward_pool, reward_per_user, total_reward_distributed, reward_token, tx_hash, quest_pool_pda, quest_id_onchain, expires_at, created_at';

// Used everywhere we want quest + its ordered steps. Postgrest nested-select.
const QUEST_PUBLIC_COLS = `${QUEST_BASE_COLS}, quest_steps(uuid, order_index, step_type, action_params)`;

const sortSteps = (rows?: QuestRawRow['quest_steps']): QuestStepPublic[] => {
  if (!rows || rows.length === 0) return [];
  return [...rows].sort((a, b) => a.order_index - b.order_index);
};

const normalizeQuest = <T extends QuestRawRow>(row: T): Omit<T, 'quest_steps'> & { steps: QuestStepPublic[] } => {
  const { quest_steps, ...rest } = row;
  return { ...rest, steps: sortSteps(quest_steps) };
};

const resolveProviderId = async (providerUuid: string): Promise<number> => {
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('uuid', providerUuid)
    .eq('role', 'user_provider')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw404('PROVIDER_NOT_FOUND', 'Provider not found');
  return (data as ProviderRow).id;
};

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export const create = async (providerUuid: string, providerWallet: string, body: CreateQuestBody): Promise<QuestPublic> => {
  const provider_id = await resolveProviderId(providerUuid);

  const verification = await verifyCreateQuestTx({
    txSignature: body.tx_hash,
    expected: {
      providerWallet,
      questUuid: body.quest_uuid,
      totalRewardPoolLamports: BigInt(body.total_reward_pool),
      rewardPerUserLamports: BigInt(body.reward_per_user),
      expiresAt: new Date(body.expires_at),
    },
  });

  if (!verification.ok) {
    if (verification.reason.startsWith('provider mismatch')) {
      throw403('DEPOSIT_TX_SIGNER_MISMATCH', verification.reason);
    }
    throw400('INVALID_DEPOSIT_TX', verification.reason);
  }

  const okVerification = verification as { ok: true; questPoolPda: string; questIdBytes: Buffer };
  const questIdOnchain = `\\x${okVerification.questIdBytes.toString('hex')}`;

  // Insert the quest parent row.
  const { data: inserted, error: insertErr } = await supabase
    .from('quests')
    .insert({
      uuid: body.quest_uuid,
      provider_id,
      title: body.title,
      description: body.description,
      protocol: body.protocol,
      total_reward_pool: body.total_reward_pool,
      reward_per_user: body.reward_per_user,
      reward_token: body.reward_token,
      tx_hash: body.tx_hash,
      quest_pool_pda: okVerification.questPoolPda,
      quest_id_onchain: questIdOnchain,
      expires_at: body.expires_at,
    })
    .select('id')
    .single();

  if (insertErr) {
    const err = insertErr as unknown as { code?: string; message?: string };
    if (err.code === '23505') {
      throw409('DUPLICATE_QUEST', err.message ?? 'Quest already exists');
    }
    throw insertErr;
  }
  const questId = (inserted as { id: number }).id;

  // Bulk-insert the steps in order.
  const stepRows = body.steps.map((s: QuestStepInput, idx: number) => ({
    quest_id: questId,
    order_index: idx,
    step_type: s.step_type,
    action_params: s.action_params,
  }));

  const { error: stepErr } = await supabase.from('quest_steps').insert(stepRows);
  if (stepErr) {
    // Best-effort cleanup so we don't leave an orphan parent. (ON DELETE
    // CASCADE on the children FK means deleting the parent removes any
    // partial inserts too.)
    await supabase.from('quests').delete().eq('id', questId);
    throw stepErr;
  }

  // Re-read with nested steps so the response matches the public shape.
  const { data: full, error: readErr } = await supabase
    .from('quests')
    .select(QUEST_PUBLIC_COLS)
    .eq('id', questId)
    .single();
  if (readErr) throw readErr;

  return normalizeQuest(full as unknown as QuestRawRow) as QuestPublic;
};

// ---------------------------------------------------------------------------
// Provider-scoped reads
// ---------------------------------------------------------------------------

export const listByProvider = async (providerUuid: string): Promise<QuestListItem[]> => {
  const provider_id = await resolveProviderId(providerUuid);

  const { data, error } = await supabase
    .from('quests')
    .select(`${QUEST_PUBLIC_COLS}, quest_participations(count)`)
    .eq('provider_id', provider_id)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const rows = (data ?? []) as Array<
    QuestRawRow & {
      quest_participations?: Array<{ count: number }>;
    }
  >;

  return rows.map((row) => ({
    ...normalizeQuest(row),
    participation_count: row.quest_participations?.[0]?.count ?? 0,
  }));
};

const countParticipations = async (
  quest_id: number,
  status?: 'inprogress' | 'success' | 'failed',
): Promise<number> => {
  let q = supabase.from('quest_participations').select('id', { count: 'exact', head: true }).eq('quest_id', quest_id);
  if (status) q = q.eq('status', status);
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
};

export const getDetailForProvider = async (
  providerUuid: string,
  questUuid: string,
): Promise<{ quest: QuestPublic; analytics: QuestAnalytics }> => {
  const provider_id = await resolveProviderId(providerUuid);

  const { data, error } = await supabase
    .from('quests')
    .select(`id, ${QUEST_PUBLIC_COLS}`)
    .eq('provider_id', provider_id)
    .eq('uuid', questUuid)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw404('QUEST_NOT_FOUND', 'Quest not found');

  const row = data as unknown as QuestRawRow & { id: number };

  const [total, success, failed] = await Promise.all([
    countParticipations(row.id),
    countParticipations(row.id, 'success'),
    countParticipations(row.id, 'failed'),
  ]);

  const analytics: QuestAnalytics = {
    total,
    success,
    failed,
    success_rate: total > 0 ? success / total : 0,
  };

  const { id: _id, ...rest } = row;
  return { quest: normalizeQuest(rest) as QuestPublic, analytics };
};

// ---------------------------------------------------------------------------
// Public reads
// ---------------------------------------------------------------------------

const nowIso = (): string => new Date().toISOString();

// `type` filter targets the first step (order_index = 0). For multi-step quests
// the "primary" action is conventionally step 0 — same UX intent as before the
// refactor.
const applyTypeFilter = <Q>(q: Q, type?: StepType): Q => {
  if (!type) return q;
  // @ts-expect-error: supabase chain types collapse to any here.
  return q.eq('quest_steps.order_index', 0).eq('quest_steps.step_type', type);
};

export const listPublic = async (query: ListPublicQuery): Promise<PublicQuestListItem[]> => {
  let q = supabase
    .from('quests')
    .select(`${QUEST_PUBLIC_COLS}, users(uuid, display_name, logo_url), quest_participations(count)`)
    .gt('expires_at', nowIso())
    .order('created_at', { ascending: false });

  if (query.protocol) q = q.eq('protocol', query.protocol);
  q = applyTypeFilter(q, query.type);

  const { data, error } = await q;
  if (error) throw error;

  const rows = (data ?? []) as Array<
    QuestRawRow & {
      users: ProviderSummary | ProviderSummary[] | null;
      quest_participations?: Array<{ count: number }>;
    }
  >;

  return rows.map((row) => ({
    ...normalizeQuest(row),
    provider: Array.isArray(row.users) ? row.users[0] ?? null : row.users,
    participation_count: row.quest_participations?.[0]?.count ?? 0,
  }));
};

export const listPublicByProvider = async (providerUuid: string): Promise<PublicQuestListItem[]> => {
  const provider_id = await resolveProviderId(providerUuid);

  const { data, error } = await supabase
    .from('quests')
    .select(`${QUEST_PUBLIC_COLS}, users(uuid, display_name, logo_url), quest_participations(count)`)
    .eq('provider_id', provider_id)
    .gt('expires_at', nowIso())
    .order('created_at', { ascending: false });

  if (error) throw error;

  const rows = (data ?? []) as Array<
    QuestRawRow & {
      users: ProviderSummary | ProviderSummary[] | null;
      quest_participations?: Array<{ count: number }>;
    }
  >;

  return rows.map((row) => ({
    ...normalizeQuest(row),
    provider: Array.isArray(row.users) ? row.users[0] ?? null : row.users,
    participation_count: row.quest_participations?.[0]?.count ?? 0,
  }));
};

export const getPublicDetail = async (questUuid: string): Promise<{ quest: PublicQuestListItem }> => {
  const { data, error } = await supabase
    .from('quests')
    .select(`${QUEST_PUBLIC_COLS}, users(uuid, display_name, logo_url), quest_participations(count)`)
    .eq('uuid', questUuid)
    .gt('expires_at', nowIso())
    .maybeSingle();

  if (error) throw error;
  if (!data) throw404('QUEST_NOT_FOUND', 'Quest not found');

  const row = data as unknown as QuestRawRow & {
    users: ProviderSummary | ProviderSummary[] | null;
    quest_participations?: Array<{ count: number }>;
  };

  const quest: PublicQuestListItem = {
    ...normalizeQuest(row),
    provider: Array.isArray(row.users) ? row.users[0] ?? null : row.users,
    participation_count: row.quest_participations?.[0]?.count ?? 0,
  };

  return { quest };
};

export const getPublicHighlights = async (): Promise<{
  top_quests: PublicQuestListItem[];
  top_providers: ProviderDepositHighlights[];
}> => {
  // 1) Top quests by biggest total reward pool (only active / not expired).
  const { data: questData, error: questErr } = await supabase
    .from('quests')
    .select(`${QUEST_PUBLIC_COLS}, users(uuid, display_name, logo_url), quest_participations(count)`)
    .gt('expires_at', nowIso())
    .order('total_reward_pool', { ascending: false })
    .limit(3);

  if (questErr) throw questErr;

  const questRows = (questData ?? []) as Array<
    QuestRawRow & {
      users: ProviderSummary | ProviderSummary[] | null;
      quest_participations?: Array<{ count: number }>;
    }
  >;

  const top_quests: PublicQuestListItem[] = questRows.map((row) => ({
    ...normalizeQuest(row),
    provider: Array.isArray(row.users) ? row.users[0] ?? null : row.users,
    participation_count: row.quest_participations?.[0]?.count ?? 0,
  }));

  // 2) Top providers by biggest TOTAL deposited reward pool.
  // Delegated to SQL function so DB directly returns sorted top 3.
  const { data: topProviderData, error: topProviderErr } = await supabase.rpc(
    'get_top_providers_by_deposit_reward_pool',
  );
  if (topProviderErr) {
    throw topProviderErr;
  }

  const top_providers = (topProviderData ?? []) as ProviderDepositHighlights[];

  return { top_quests, top_providers };
};
