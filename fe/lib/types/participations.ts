import type { IPublicQuest } from './quests';

export interface IParticipation {
  uuid: string;
  status: 'inprogress' | 'success' | 'failed';
  reward_claimed: boolean;
  started_at: string;
  completed_at: string | null;
  quest: IPublicQuest;
}

export interface IUserParticipationsResponse {
  participations: IParticipation[];
}

export interface IClaimedReward {
  quest_uuid: string;
  tx_hash: string;
  amount: string;
  token: string;
}

export interface IFailedClaim {
  quest_uuid: string;
  reason: string;
}

export interface IClaimResponse {
  claimed: IClaimedReward[];
  failed: IFailedClaim[];
}
