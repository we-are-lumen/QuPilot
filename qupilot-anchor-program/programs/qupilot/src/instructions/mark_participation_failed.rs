use anchor_lang::prelude::*;

use crate::errors::QuestError;
use crate::events::ParticipationFailed;
use crate::state::{Participation, QuestPool};

#[derive(Accounts)]
pub struct MarkParticipationFailed<'info> {
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

pub fn handler(ctx: Context<MarkParticipationFailed>) -> Result<()> {
    let pool = &mut ctx.accounts.quest_pool;
    let p = &mut ctx.accounts.participation;

    require!(
        p.status == Participation::STATUS_JOINED,
        QuestError::InvalidParticipationStatus
    );

    let now = Clock::get()?.unix_timestamp;
    p.status = Participation::STATUS_FAILED;
    p.completed_at = now;

    pool.allocated_amount = pool
        .allocated_amount
        .checked_sub(p.reward_amount)
        .ok_or(QuestError::RewardPoolExhausted)?;

    emit!(ParticipationFailed {
        quest_pool: pool.key(),
        participation: p.key(),
        user_wallet: p.user_wallet,
        failed_at: now,
    });

    Ok(())
}
