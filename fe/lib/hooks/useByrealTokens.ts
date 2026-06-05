import { useQuery } from "@tanstack/react-query";
import { getByrealTokens } from "@/lib/api/byreal";
import type { IByrealTokensResponse } from "@/lib/types/byreal";

export const BYREAL_TOKENS_QUERY_KEY = ["byreal", "tokens"];

export function useByrealTokens() {
  return useQuery<IByrealTokensResponse>({
    queryKey: BYREAL_TOKENS_QUERY_KEY,
    queryFn: () => getByrealTokens({ pageSize: 100 }),
    staleTime: 5 * 60 * 1000,
  });
}
