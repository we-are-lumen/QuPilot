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
        total_reward_pool: u64,
        reward_per_user: u64,
        expires_at: i64,
    ) -> Result<()> {
        instructions::create_quest::handler(
            ctx,
            quest_id,
            total_reward_pool,
            reward_per_user,
            expires_at,
        )
    }
}
