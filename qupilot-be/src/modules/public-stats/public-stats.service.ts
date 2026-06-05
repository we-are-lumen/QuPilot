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
  success_rate: PublicStatMetric & {
    ratio: number;
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
  total_reward_distributed: string | number;
};

const getTotalRewardDistributedLamports = async (): Promise<bigint> => {
  const { data, error } = await supabase.from('quests').select('total_reward_distributed');
  if (error) throw error;

  return ((data ?? []) as QuestRewardRow[]).reduce(
    (total, row) => total + BigInt(String(row.total_reward_distributed ?? 0)),
    0n,
  );
};

export const getPublicStats = async (): Promise<PublicStats> => {
  const [totalParticipations, successParticipations, totalRewardDistributedLamports] = await Promise.all([
    getParticipationCount(),
    getParticipationCount('success'),
    getTotalRewardDistributedLamports(),
  ]);

  const successRatio = totalParticipations > 0 ? successParticipations / totalParticipations : 0;
  const successPercent = successRatio * 100;

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
    success_rate: {
      label: 'Success Rate',
      value: Number(successPercent.toFixed(1)),
      ratio: Number(successRatio.toFixed(4)),
      display_value: `${successPercent.toFixed(1).replace(/\.0$/, '')}%`,
    },
  };
};
