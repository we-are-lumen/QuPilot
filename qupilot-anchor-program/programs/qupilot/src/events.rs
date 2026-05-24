use anchor_lang::prelude::*;

#[event]
pub struct QuestCreated {
    pub quest_pool: Pubkey,
    pub provider: Pubkey,
    pub quest_id: [u8; 32],
    pub total_reward_pool: u64,
    pub reward_per_user: u64,
    pub expires_at: i64,
    pub created_at: i64,
}
