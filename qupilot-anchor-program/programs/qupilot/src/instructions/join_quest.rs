use anchor_lang::prelude::*;

use crate::errors::QuestError;
use crate::events::QuestJoined;
use crate::state::{Participation, QuestPool};

#[derive(Accounts)]
#[instruction(participation_uuid: [u8; 16], user_wallet: Pubkey, agent_wallet: Pubkey)]
pub struct JoinQuest<'info> {
    #[account(mut, address = quest_pool.verifier)]
    pub verifier: Signer<'info>,

    #[account(mut)]
    pub quest_pool: Account<'info, QuestPool>,

    #[account(
        init,
        payer = verifier,
        space = 8 + Participation::INIT_SPACE,
        seeds = [b"participation", quest_pool.key().as_ref(), user_wallet.as_ref()],
        bump
    )]
    pub participation: Account<'info, Participation>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<JoinQuest>,
    participation_uuid: [u8; 16],
    user_wallet: Pubkey,
    agent_wallet: Pubkey,
) -> Result<()> {
    let pool = &mut ctx.accounts.quest_pool;
    require!(pool.status == QuestPool::STATUS_ACTIVE, QuestError::QuestNotActive);

    let now = Clock::get()?.unix_timestamp;
    require!(now < pool.expires_at, QuestError::QuestExpired);

    let new_allocated = pool
        .allocated_amount
        .checked_add(pool.reward_per_user)
        .ok_or(QuestError::RewardPoolExhausted)?;
    require!(
        new_allocated <= pool.total_reward_pool,
        QuestError::RewardPoolExhausted
    );
    pool.allocated_amount = new_allocated;

    let p = &mut ctx.accounts.participation;
    p.version = Participation::CURRENT_VERSION;
    p.quest_pool = pool.key();
    p.user_wallet = user_wallet;
    p.agent_wallet = agent_wallet;
    p.participation_uuid = participation_uuid;
    p.status = Participation::STATUS_JOINED;
    p.reward_amount = pool.reward_per_user;
    p.joined_at = now;
    p.completed_at = 0;
    p.claimed_at = 0;
    p.bump = ctx.bumps.participation;

    emit!(QuestJoined {
        quest_pool: pool.key(),
        participation: p.key(),
        user_wallet,
        agent_wallet,
        participation_uuid,
        joined_at: now,
    });

    Ok(())
}
