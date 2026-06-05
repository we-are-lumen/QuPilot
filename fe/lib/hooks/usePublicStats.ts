import { useQuery } from '@tanstack/react-query';
import { getPublicStats } from '../api/stats';
import type { IPublicStatsResponse } from '../types/stats';

export const PUBLIC_STATS_QUERY_KEY = ['stats', 'public'];

export function usePublicStats() {
  return useQuery<IPublicStatsResponse>({
    queryKey: PUBLIC_STATS_QUERY_KEY,
    queryFn: getPublicStats,
  });
}
