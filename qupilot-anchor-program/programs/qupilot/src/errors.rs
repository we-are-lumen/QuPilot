use anchor_lang::prelude::*;

#[error_code]
pub enum QuestError {
    #[msg("total_reward_pool must be greater than zero")]
    InvalidTotalReward,
    #[msg("reward_per_user must be greater than zero")]
    InvalidRewardPerUser,
    #[msg("total_reward_pool must be >= reward_per_user")]
    RewardPoolTooSmall,
    #[msg("expires_at must be in the future")]
    ExpiresAtInPast,
}
