export type Protocol = 'byreal' | 'bybit' | 'sui';
export type QuestType = 'swap' | 'lp' | 'stake';

export interface IQuest {
  uuid: string;
  title: string;
  description: string;
  protocol: Protocol;
  quest_type: QuestType;
  action_params: Array<Record<string, any>>;
  total_reward_pool: string;
  reward_per_user: string;
  total_reward_distributed: string;
  reward_token: string;
  tx_hash?: string;
  expires_at: string;
  created_at: string;
  participation_count: number;
}

export interface IProviderQuestsResponse {
  quests: IQuest[];
}

export interface ICreateQuestPayload {
  title: string;
  description: string;
  protocol: Protocol;
  quest_type: QuestType;
  action_params: Array<Record<string, any>>;
  total_reward_pool: string;
  reward_per_user: string;
  reward_token: string;
  tx_hash: string;
  expires_at: string;
}

export interface IQuestAnalytics {
  total: number;
  success: number;
  failed: number;
  success_rate: number;
}

export interface IProviderQuestDetailResponse {
  quest: IQuest;
  analytics: IQuestAnalytics;
}


