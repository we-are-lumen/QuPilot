import { apiClient } from './client';
import type { IPublicStatsResponse } from '@/lib/types/stats';

/**
 * GET /public/stats
 *
 * Fetches public landing-page platform stats.
 */
export async function getPublicStats(): Promise<IPublicStatsResponse> {
  const response = await apiClient.get<IPublicStatsResponse>('/public/stats');
  return response.data;
}
