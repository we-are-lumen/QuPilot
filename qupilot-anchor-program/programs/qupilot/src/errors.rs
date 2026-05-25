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
    #[msg("quest pool is not active")]
    QuestNotActive,
    #[msg("quest has expired")]
    QuestExpired,
    #[msg("reward pool capacity exhausted")]
    RewardPoolExhausted,
    #[msg("invalid participation status for this operation")]
    InvalidParticipationStatus,
    #[msg("reward amount on participation doesn't match quest pool")]
    RewardAmountMismatch,
    #[msg("participation is not in claimable state")]
    NotClaimable,
    #[msg("insufficient pool lamports after transfer")]
    InsufficientPoolLamports,
}
