import { apiClient } from './client';
import type { ISyncClaimResponse, IUserParticipationsResponse } from '@/lib/types/participations';

export async function getUserParticipations(): Promise<IUserParticipationsResponse> {
  const response = await apiClient.get<IUserParticipationsResponse>('/me/participations');
  return response.data;
}

export async function syncClaimReward(participation_uuid: string, claim_tx_hash: string): Promise<ISyncClaimResponse> {
  const response = await apiClient.post<ISyncClaimResponse>('/me/participations/sync-claim', {
    participation_uuid,
    claim_tx_hash,
  });
  return response.data;
}
