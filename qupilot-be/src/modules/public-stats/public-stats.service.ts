import { supabase } from '../../config/supabase';

export type PublicStatMetric = {
  label: string;
  value: number;
  display_value: string;
};

export type PublicStats = {
  agents_deployed: PublicStatMetric;
  total_rewards_earned: PublicStatMetric & {
    currency: 'SOL';
  };
  total_rewards_pooled: PublicStatMetric & {
    currency: 'SOL';
  };
  slots_claimed: PublicStatMetric & {
    ratio: number;
    claimed: number;
    total_slots: number;
  };
};

const LAMPORTS_PER_SOL = 1_000_000_000n;

const formatCount = (value: number): string => new Intl.NumberFormat('id-ID').format(value);

const lamportsToSolNumber = (lamports: bigint): number => Number(lamports) / Number(LAMPORTS_PER_SOL);

const formatSol = (lamports: bigint): string => {
  if (lamports === 0n) return '0 SOL';

  const sol = lamportsToSolNumber(lamports);

  if (sol >= 1_000_000) return `${(sol / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M SOL`;
  if (sol >= 1_000) return `${(sol / 1_000).toFixed(2).replace(/\.?0+$/, '')}K SOL`;
  if (sol >= 1) return `${sol.toFixed(4).replace(/\.?0+$/, '')} SOL`;
  return `${sol.toFixed(9).replace(/\.?0+$/, '')} SOL`;
};

const getParticipationCount = async (status?: 'success' | 'failed' | 'inprogress'): Promise<number> => {
  let query = supabase.from('quest_participations').select('id', { count: 'exact', head: true });
  if (status) query = query.eq('status', status);

  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
};

type QuestRewardRow = {
  total_reward_distributed?: string | number;
  total_reward_pool?: string | number;
};

type ActiveQuestSlotsRow = {
  total_reward_pool: string | number;
  reward_per_user: string | number;
  quest_participations?: Array<{ count: number }>;
};

const getTotalRewardDistributedLamports = async (): Promise<bigint> => {
  const { data, error } = await supabase.from('quests').select('total_reward_distributed');
  if (error) throw error;

  return ((data ?? []) as QuestRewardRow[]).reduce(
    (total, row) => total + BigInt(String(row.total_reward_distributed ?? 0)),
    0n,
  );
};

const getTotalRewardPoolLamports = async (): Promise<bigint> => {
  const { data, error } = await supabase.from('quests').select('total_reward_pool');
  if (error) throw error;

  return ((data ?? []) as QuestRewardRow[]).reduce(
    (total, row) => total + BigInt(String(row.total_reward_pool ?? 0)),
    0n,
  );
};

const getActiveSlots = async (): Promise<{ claimed: number; total_slots: number; ratio: number }> => {
  const { data, error } = await supabase
    .from('quests')
    .select('total_reward_pool, reward_per_user, quest_participations(count)')
    .gt('expires_at', new Date().toISOString());

  if (error) throw error;

  const rows = (data ?? []) as ActiveQuestSlotsRow[];
  const totals = rows.reduce(
    (acc, row) => {
      const rewardPool = BigInt(String(row.total_reward_pool ?? 0));
      const rewardPerUser = BigInt(String(row.reward_per_user ?? 0));
      const questSlots = rewardPerUser > 0n ? Number(rewardPool / rewardPerUser) : 0;

      return {
        claimed: acc.claimed + (row.quest_participations?.[0]?.count ?? 0),
        total_slots: acc.total_slots + questSlots,
      };
    },
    { claimed: 0, total_slots: 0 },
  );

  return {
    ...totals,
    ratio: totals.total_slots > 0 ? Math.min(totals.claimed / totals.total_slots, 1) : 0,
  };
};

export const getPublicStats = async (): Promise<PublicStats> => {
  const [totalParticipations, totalRewardDistributedLamports, totalRewardPoolLamports, activeSlots] = await Promise.all([
    getParticipationCount(),
    getTotalRewardDistributedLamports(),
    getTotalRewardPoolLamports(),
    getActiveSlots(),
  ]);

  const slotsClaimedPercent = activeSlots.ratio * 100;

  return {
    agents_deployed: {
      label: 'Agents Deployed',
      value: totalParticipations,
      display_value: formatCount(totalParticipations),
    },
    total_rewards_earned: {
      label: 'Total Rewards Earned',
      value: lamportsToSolNumber(totalRewardDistributedLamports),
      display_value: formatSol(totalRewardDistributedLamports),
      currency: 'SOL',
    },
    total_rewards_pooled: {
      label: 'Total Rewards Pooled',
      value: lamportsToSolNumber(totalRewardPoolLamports),
      display_value: formatSol(totalRewardPoolLamports),
      currency: 'SOL',
    },
    slots_claimed: {
      label: 'Slots Claimed',
      value: Number(slotsClaimedPercent.toFixed(1)),
      ratio: Number(activeSlots.ratio.toFixed(4)),
      claimed: activeSlots.claimed,
      total_slots: activeSlots.total_slots,
      display_value: `${slotsClaimedPercent.toFixed(1).replace(/\.0$/, '')}%`,
    },
  };
};
