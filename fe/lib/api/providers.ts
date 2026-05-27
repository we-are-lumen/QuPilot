import { apiClient } from './client';
import type { IProvidersResponse } from '@/lib/types/providers';
import type { IPublicQuestsResponse } from '@/lib/types/quests';

/**
 * GET /providers
 *
 * Fetches the public list of providers.
 */
export async function getProviders(): Promise<IProvidersResponse> {
  const response = await apiClient.get<IProvidersResponse>('/providers');
  return response.data;
}

/**
 * GET /providers/:uuid/quests
 *
 * Fetches quests belonging to a specific provider.
 */
export async function getProviderQuests(uuid: string): Promise<IPublicQuestsResponse> {
  const response = await apiClient.get<IPublicQuestsResponse>(`/providers/${uuid}/quests`);
  return response.data;
}
