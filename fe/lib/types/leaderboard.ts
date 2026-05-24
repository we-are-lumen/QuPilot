export interface ILeaderboardEntry {
  user_uuid: string;
  wallet_address: string;
  total_reward: string;
  success_rate: number;
}

export interface ILeaderboardResponse {
  entries: ILeaderboardEntry[];
}
