use anchor_lang::prelude::*;

use crate::errors::QuestError;
use crate::events::ParticipationCompleted;
use crate::state::{Participation, QuestPool};

#[derive(Accounts)]
pub struct MarkParticipationComplete<'info> {
    #[account(address = quest_pool.verifier)]
    pub verifier: Signer<'info>,

    #[account(mut)]
    pub quest_pool: Account<'info, QuestPool>,

    #[account(
        mut,
        has_one = quest_pool,
        seeds = [b"participation", quest_pool.key().as_ref(), participation.user_wallet.as_ref()],
        bump = participation.bump
    )]
    pub participation: Account<'info, Participation>,
}

pub fn handler(ctx: Context<MarkParticipationComplete>) -> Result<()> {
    let pool = &ctx.accounts.quest_pool;
    let p = &mut ctx.accounts.participation;

    require!(
        p.status == Participation::STATUS_JOINED,
        QuestError::InvalidParticipationStatus
    );
    require!(
        p.reward_amount == pool.reward_per_user,
        QuestError::RewardAmountMismatch
    );

    let now = Clock::get()?.unix_timestamp;
    p.status = Participation::STATUS_SUCCESS;
    p.completed_at = now;

    emit!(ParticipationCompleted {
        quest_pool: pool.key(),
        participation: p.key(),
        user_wallet: p.user_wallet,
        reward_amount: p.reward_amount,
        completed_at: now,
    });

    Ok(())
}
