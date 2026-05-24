import { apiClient } from "./client";
import type { ILeaderboardResponse } from "@/lib/types/leaderboard";

export async function getLeaderboard(
  limit?: number,
): Promise<ILeaderboardResponse> {
  const params = limit ? { limit } : undefined;
  const response = await apiClient.get<ILeaderboardResponse>("/leaderboard", {
    params,
  });
  return response.data;
}
