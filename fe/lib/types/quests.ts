export type Protocol = string;
export type StepType = 'swap' | 'clmm_open' | 'clmm_close';

export interface IQuestStep {
  uuid: string;
  order_index: number;
  step_type: StepType;
  action_params: Record<string, any>;
}

export interface IQuest {
  uuid: string;
  title: string;
  description: string;
  protocol: Protocol;
  steps: IQuestStep[];
  total_reward_pool: string;
  reward_per_user: string;
  total_reward_distributed: string;
  reward_token: string;
  tx_hash: string;
  quest_pool_pda?: string | null;
  quest_id_onchain?: string | null;
  expires_at: string;
  created_at: string;
  participation_count: number;
}

export interface IProviderQuestsResponse {
  quests: IQuest[];
}

export interface ICreateQuestStep {
  step_type: StepType;
  action_params: Record<string, any>;
}

export interface ICreateQuestPayload {
  quest_uuid: string;
  title: string;
  description: string;
  protocol: Protocol;
  steps: ICreateQuestStep[];
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

export interface IPublicQuest extends IQuest {
  provider: {
    uuid: string;
    display_name: string;
    logo_url: string | null;
  };
}

export interface IPublicQuestsResponse {
  quests: IPublicQuest[];
}

export interface IPublicQuestDetailResponse {
  quest: IPublicQuest;
}

export interface ITopProvider {
  uuid: string;
  display_name: string;
  logo_url: string | null;
  total_deposit_reward_pool: string;
}

export interface IPublicHighlightsResponse {
  top_quests: IPublicQuest[];
  top_providers: ITopProvider[];
}


