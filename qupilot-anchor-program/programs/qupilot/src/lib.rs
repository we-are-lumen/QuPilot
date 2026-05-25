use anchor_lang::prelude::*;

pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("2auiCCwYy8pj6LpDnMomZRqKs49Gb5oRjtVkYDYRVmm3");

#[program]
pub mod qupilot {
    use super::*;

    pub fn create_quest(
        ctx: Context<CreateQuest>,
        quest_id: [u8; 32],
        verifier: Pubkey,
        total_reward_pool: u64,
        reward_per_user: u64,
        expires_at: i64,
    ) -> Result<()> {
        instructions::create_quest::handler(
            ctx,
            quest_id,
            verifier,
            total_reward_pool,
            reward_per_user,
            expires_at,
        )
    }

    pub fn join_quest(
        ctx: Context<JoinQuest>,
        participation_uuid: [u8; 16],
        user_wallet: Pubkey,
        agent_wallet: Pubkey,
    ) -> Result<()> {
        instructions::join_quest::handler(ctx, participation_uuid, user_wallet, agent_wallet)
    }

    pub fn mark_participation_complete(ctx: Context<MarkParticipationComplete>) -> Result<()> {
        instructions::mark_participation_complete::handler(ctx)
    }

    pub fn mark_participation_failed(ctx: Context<MarkParticipationFailed>) -> Result<()> {
        instructions::mark_participation_failed::handler(ctx)
    }

    pub fn claim_reward(ctx: Context<ClaimReward>) -> Result<()> {
        instructions::claim_reward::handler(ctx)
    }
}
