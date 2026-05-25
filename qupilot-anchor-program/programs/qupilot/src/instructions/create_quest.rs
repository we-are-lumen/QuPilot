use anchor_lang::prelude::*;
use anchor_lang::system_program::{self, Transfer};

use crate::errors::QuestError;
use crate::events::QuestCreated;
use crate::state::QuestPool;

#[derive(Accounts)]
#[instruction(quest_id: [u8; 32])]
pub struct CreateQuest<'info> {
    #[account(mut)]
    pub provider: Signer<'info>,

    #[account(
        init,
        payer = provider,
        space = 8 + QuestPool::INIT_SPACE,
        seeds = [b"quest", provider.key().as_ref(), quest_id.as_ref()],
        bump
    )]
    pub quest_pool: Account<'info, QuestPool>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<CreateQuest>,
    quest_id: [u8; 32],
    verifier: Pubkey,
    total_reward_pool: u64,
    reward_per_user: u64,
    expires_at: i64,
) -> Result<()> {
    require!(total_reward_pool > 0, QuestError::InvalidTotalReward);
    require!(reward_per_user > 0, QuestError::InvalidRewardPerUser);
    require!(
        total_reward_pool >= reward_per_user,
        QuestError::RewardPoolTooSmall
    );

    let now = Clock::get()?.unix_timestamp;
    require!(expires_at > now, QuestError::ExpiresAtInPast);

    let cpi_ctx = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        Transfer {
            from: ctx.accounts.provider.to_account_info(),
            to: ctx.accounts.quest_pool.to_account_info(),
        },
    );
    system_program::transfer(cpi_ctx, total_reward_pool)?;

    let pool = &mut ctx.accounts.quest_pool;
    pool.version = QuestPool::CURRENT_VERSION;
    pool.provider = ctx.accounts.provider.key();
    pool.verifier = verifier;
    pool.quest_id = quest_id;
    pool.total_reward_pool = total_reward_pool;
    pool.reward_per_user = reward_per_user;
    pool.allocated_amount = 0;
    pool.claimed_amount = 0;
    pool.created_at = now;
    pool.expires_at = expires_at;
    pool.status = QuestPool::STATUS_ACTIVE;
    pool.bump = ctx.bumps.quest_pool;

    emit!(QuestCreated {
        quest_pool: pool.key(),
        provider: pool.provider,
        verifier,
        quest_id,
        total_reward_pool,
        reward_per_user,
        expires_at,
        created_at: now,
    });

    Ok(())
}
