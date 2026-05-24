import { useQuery } from '@tanstack/react-query';
import { getLeaderboard } from '../api/leaderboard';
import type { ILeaderboardResponse } from '../types/leaderboard';

export const LEADERBOARD_QUERY_KEY = ['leaderboard'];

export function useLeaderboard(limit?: number) {
  return useQuery<ILeaderboardResponse>({
    queryKey: [...LEADERBOARD_QUERY_KEY, limit],
    queryFn: () => getLeaderboard(limit),
  });
}
