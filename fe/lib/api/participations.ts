import { apiClient } from './client';
import type { IUserParticipationsResponse, IClaimResponse } from '@/lib/types/participations';

export async function getUserParticipations(): Promise<IUserParticipationsResponse> {
  const response = await apiClient.get<IUserParticipationsResponse>('/me/participations');
  return response.data;
}

export async function claimRewards(): Promise<IClaimResponse> {
  const response = await apiClient.post<IClaimResponse>('/me/claim');
  return response.data;
}
