export type Protocol = string;
export type StepType = 'swap' | 'clmm_open' | 'clmm_close' | 'clmm_copy';

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

export interface IQuestAgentParticipant {
  uuid: string;
  status: 'inprogress' | 'success' | 'failed';
  reward_claimed: boolean;
  started_at: string;
  completed_at: string | null;
  agent_wallet_address: string | null;
  participation_pda: string | null;
  join_tx_hash: string | null;
  complete_tx_hash: string | null;
  claim_tx_hash: string | null;
  reward_amount: string;
  user: {
    uuid: string;
    wallet_address: string;
    display_name: string | null;
    logo_url: string | null;
  } | null;
}

export interface IProviderQuestDetailResponse {
  quest: IQuest;
  analytics: IQuestAnalytics;
  participants: IQuestAgentParticipant[];
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
