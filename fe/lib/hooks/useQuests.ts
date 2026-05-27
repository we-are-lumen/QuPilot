import { useQuery } from '@tanstack/react-query';
import { getPublicQuests } from '../api/quests';
import type { IPublicQuestsResponse } from '../types/quests';

export const QUESTS_QUERY_KEY = ['quests', 'public'];

export function usePublicQuests(params?: { protocol?: string; type?: string }) {
  return useQuery<IPublicQuestsResponse>({
    queryKey: [...QUESTS_QUERY_KEY, params],
    queryFn: () => getPublicQuests(params),
  });
}
