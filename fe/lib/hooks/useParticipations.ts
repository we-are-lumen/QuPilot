import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUserParticipations, claimRewards } from '../api/participations';
import type { IUserParticipationsResponse, IClaimResponse } from '../types/participations';

export const PARTICIPATIONS_QUERY_KEY = ['participations'];

export function useUserParticipations() {
  return useQuery<IUserParticipationsResponse>({
    queryKey: PARTICIPATIONS_QUERY_KEY,
    queryFn: getUserParticipations,
  });
}

export function useClaimRewards() {
  const queryClient = useQueryClient();

  return useMutation<IClaimResponse, Error>({
    mutationFn: claimRewards,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PARTICIPATIONS_QUERY_KEY });
      // Might want to invalidate leaderboard here too, as claiming affects it
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    },
  });
}
