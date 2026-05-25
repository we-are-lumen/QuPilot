import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUserParticipations, syncClaimReward } from '../api/participations';
import type { ISyncClaimResponse, IUserParticipationsResponse } from '../types/participations';

export const PARTICIPATIONS_QUERY_KEY = ['participations'];

export function useUserParticipations() {
  return useQuery<IUserParticipationsResponse>({
    queryKey: PARTICIPATIONS_QUERY_KEY,
    queryFn: getUserParticipations,
  });
}

export function useSyncClaimReward() {
  const queryClient = useQueryClient();

  return useMutation<ISyncClaimResponse, Error, { participation_uuid: string; claim_tx_hash: string }>({
    mutationFn: async (input) => syncClaimReward(input.participation_uuid, input.claim_tx_hash),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PARTICIPATIONS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    },
  });
}
