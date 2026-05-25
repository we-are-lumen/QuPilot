import type { IPublicQuest } from './quests';

export interface IParticipation {
  uuid: string;
  status: 'inprogress' | 'success' | 'failed';
  reward_claimed: boolean;
  started_at: string;
  completed_at: string | null;
  participation_pda: string | null;
  quest_pool_pda: string | null;
  join_tx_hash: string | null;
  complete_tx_hash: string | null;
  claim_tx_hash: string | null;
  reward_amount: string;
  quest: IPublicQuest;
}

export interface IUserParticipationsResponse {
  participations: IParticipation[];
}

export interface ISyncClaimResponse {
  ok: true;
}
