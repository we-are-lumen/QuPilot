import { apiClient } from './client';
import type { IProviderQuestsResponse, ICreateQuestPayload, IQuest, IProviderQuestDetailResponse } from '@/lib/types/quests';

/**
 * GET /provider/quests
 * 
 * Fetches the quests owned/hosted by the currently authenticated provider.
 * Requires Provider JWT in headers (handled by client interceptor).
 */
export async function getProviderQuests(): Promise<IProviderQuestsResponse> {
  const response = await apiClient.get<IProviderQuestsResponse>('/provider/quests');
  return response.data;
}

/**
 * POST /provider/quests
 * 
 * Creates a new quest under the authenticated provider.
 */
export async function createQuest(payload: ICreateQuestPayload): Promise<{ quest: IQuest }> {
  const response = await apiClient.post<{ quest: IQuest }>('/provider/quests', payload);
  return response.data;
}

/**
 * GET /provider/quests/:uuid
 * 
 * Fetches specific quest details and analytics for the authenticated provider.
 */
export async function getProviderQuestDetail(uuid: string): Promise<IProviderQuestDetailResponse> {
  const response = await apiClient.get<IProviderQuestDetailResponse>(`/provider/quests/${uuid}`);
  return response.data;
}


