use anchor_lang::prelude::*;

#[event]
pub struct QuestCreated {
    pub quest_pool: Pubkey,
    pub provider: Pubkey,
    pub verifier: Pubkey,
    pub quest_id: [u8; 32],
    pub total_reward_pool: u64,
    pub reward_per_user: u64,
    pub expires_at: i64,
    pub created_at: i64,
}

#[event]
pub struct QuestJoined {
    pub quest_pool: Pubkey,
    pub participation: Pubkey,
    pub user_wallet: Pubkey,
    pub agent_wallet: Pubkey,
    pub participation_uuid: [u8; 16],
    pub joined_at: i64,
}

#[event]
pub struct ParticipationCompleted {
    pub quest_pool: Pubkey,
    pub participation: Pubkey,
    pub user_wallet: Pubkey,
    pub reward_amount: u64,
    pub completed_at: i64,
}

#[event]
pub struct ParticipationFailed {
    pub quest_pool: Pubkey,
    pub participation: Pubkey,
    pub user_wallet: Pubkey,
    pub failed_at: i64,
}

#[event]
pub struct RewardClaimed {
    pub quest_pool: Pubkey,
    pub participation: Pubkey,
    pub user_wallet: Pubkey,
    pub amount: u64,
    pub claimed_at: i64,
}
