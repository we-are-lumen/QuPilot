import { apiClient } from './client';
import type {
  ISyncClaimResponse,
  IUserParticipationsResponse,
  IParticipationDetailResponse,
} from '@/lib/types/participations';

/**
 * GET /me/participations
 *
 * Fetches all quest participations for the currently authenticated user.
 */
export async function getUserParticipations(): Promise<IUserParticipationsResponse> {
  const response = await apiClient.get<IUserParticipationsResponse>('/me/participations');
  return response.data;
}

/**
 * GET /me/participations/:questUuid
 *
 * Fetches specific participation details by quest UUID.
 */
export async function getParticipationDetail(questUuid: string): Promise<IParticipationDetailResponse> {
  const response = await apiClient.get<IParticipationDetailResponse>(`/me/participations/${questUuid}`);
  return response.data;
}

/**
 * POST /me/participations/sync-claim
 *
 * Syncs a claim transaction hash on the backend after the user claims rewards on-chain.
 */
export async function syncClaimReward(
  participation_uuid: string,
  claim_tx_hash: string
): Promise<ISyncClaimResponse> {
  const response = await apiClient.post<ISyncClaimResponse>('/me/participations/sync-claim', {
    participation_uuid,
    claim_tx_hash,
  });
  return response.data;
}
