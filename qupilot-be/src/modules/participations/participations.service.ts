import { supabase } from '../../config/supabase';
import { throw404 } from '../../lib/errors';
import { transferSol } from '../../lib/solana';

export type ParticipationStatus = 'inprogress' | 'success' | 'failed';

export type ParticipationItem = {
  uuid: string;
  status: ParticipationStatus;
  reward_claimed: boolean;
  started_at: string;
  completed_at: string | null;
  quest: {
    uuid: string;
    title: string;
    description: string;
    protocol: string;
    total_reward_pool: number | string;
    reward_per_user: number | string;
    total_reward_distributed: number | string;
    reward_token: string;
    tx_hash: string;
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

export type ClaimResult = {
  claimed: Array<{ quest_uuid: string; tx_hash: string; amount: number | string; token: string }>;
  failed: Array<{ quest_uuid: string; reason: string }>;
};

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
  total_reward_pool: number | string;
  reward_per_user: number | string;
  total_reward_distributed: number | string;
  reward_token: string;
  tx_hash: string;
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
      'uuid, status, reward_claimed, started_at, completed_at, quests(uuid, title, description, protocol, total_reward_pool, reward_per_user, total_reward_distributed, reward_token, tx_hash, expires_at, created_at, users(uuid, display_name, logo_url))',
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
        quest: {
          uuid: q.uuid,
          title: q.title,
          description: q.description,
          protocol: q.protocol,
          total_reward_pool: q.total_reward_pool,
          reward_per_user: q.reward_per_user,
          total_reward_distributed: q.total_reward_distributed,
          reward_token: q.reward_token,
          tx_hash: q.tx_hash,
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
      'uuid, status, reward_claimed, started_at, completed_at, quests(uuid, title, description, protocol, total_reward_pool, reward_per_user, total_reward_distributed, reward_token, tx_hash, expires_at, created_at, users(uuid, display_name, logo_url))',
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
    quests: QuestEmbed | QuestEmbed[];
  };

  const q = toQuest(row.quests)!;

  const item: ParticipationItem = {
    uuid: row.uuid,
    status: row.status,
    reward_claimed: row.reward_claimed,
    started_at: row.started_at,
    completed_at: row.completed_at,
    quest: {
      uuid: q.uuid,
      title: q.title,
      description: q.description,
      protocol: q.protocol,
      total_reward_pool: q.total_reward_pool,
      reward_per_user: q.reward_per_user,
      total_reward_distributed: q.total_reward_distributed,
      reward_token: q.reward_token,
      tx_hash: q.tx_hash,
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

const toQuestReward = (
  quests:
    | { uuid: string; reward_per_user: number | string; reward_token: string }
    | { uuid: string; reward_per_user: number | string; reward_token: string }[]
    | null,
) => (Array.isArray(quests) ? quests[0] ?? null : quests);

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

export const claimAllByUserId = async (userId: number, walletAddress: string): Promise<ClaimResult> => {
  const { data, error } = await supabase
    .from('quest_participations')
    .select('uuid, quests(uuid, reward_per_user, reward_token)')
    .eq('user_id', userId)
    .eq('status', 'success')
    .eq('reward_claimed', false)
    .order('started_at', { ascending: true });

  if (error) throw error;

  const rows = (data ?? []) as unknown as Array<{
    uuid: string;
    quests:
      | { uuid: string; reward_per_user: number | string; reward_token: string }
      | { uuid: string; reward_per_user: number | string; reward_token: string }[]
      | null;
  }>;

  const claimed: ClaimResult['claimed'] = [];
  const failed: ClaimResult['failed'] = [];

  for (const row of rows) {
    const quest = toQuestReward(row.quests);
    if (!quest) {
      failed.push({ quest_uuid: 'unknown', reason: 'Quest not found' });
      continue;
    }
    // Reward amount comes from quests.reward_per_user — kolom ini immutable
    // setelah quest dibuat, jadi aman dipakai langsung tanpa snapshot.
    try {
      const tx_hash = await transferSol(walletAddress, quest.reward_per_user);
      const updated = await supabase
        .from('quest_participations')
        .update({ reward_claimed: true })
        .eq('uuid', row.uuid)
        .select('uuid')
        .maybeSingle();
      if (updated.error) throw updated.error;

      claimed.push({
        quest_uuid: quest.uuid,
        tx_hash,
        amount: quest.reward_per_user,
        token: quest.reward_token,
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Unknown error';
      failed.push({ quest_uuid: quest.uuid, reason });
    }
  }

  return { claimed, failed };
};

export const claimAll = async (userUuid: string, walletAddress: string): Promise<ClaimResult> => {
  const user_id = await resolveUserId(userUuid);
  return claimAllByUserId(user_id, walletAddress);
};
