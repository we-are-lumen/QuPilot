use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct QuestPool {
    pub version: u8,
    pub provider: Pubkey,
    pub quest_id: [u8; 32],
    pub total_reward_pool: u64,
    pub reward_per_user: u64,
    pub claimed_amount: u64,
    pub created_at: i64,
    pub expires_at: i64,
    pub status: u8,
    pub bump: u8,
}

impl QuestPool {
    pub const STATUS_ACTIVE: u8 = 0;
    pub const STATUS_CLOSED: u8 = 1;
    pub const STATUS_REFUNDED: u8 = 2;

    pub const CURRENT_VERSION: u8 = 1;
}
