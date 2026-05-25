use anchor_lang::prelude::*;

use crate::errors::QuestError;
use crate::events::RewardClaimed;
use crate::state::{Participation, QuestPool};

#[derive(Accounts)]
pub struct ClaimReward<'info> {
    #[account(mut, address = participation.user_wallet)]
    pub claimer: Signer<'info>,

    #[account(mut)]
    pub quest_pool: Account<'info, QuestPool>,

    #[account(
        mut,
        has_one = quest_pool,
        seeds = [b"participation", quest_pool.key().as_ref(), claimer.key().as_ref()],
        bump = participation.bump
    )]
    pub participation: Account<'info, Participation>,
}

pub fn handler(ctx: Context<ClaimReward>) -> Result<()> {
    let pool = &mut ctx.accounts.quest_pool;
    let claimer = &mut ctx.accounts.claimer;
    let p = &mut ctx.accounts.participation;

    require!(
        p.status == Participation::STATUS_SUCCESS,
        QuestError::NotClaimable
    );

    let reward = p.reward_amount;
    let rent = Rent::get()?;
    let rent_min = rent.minimum_balance(8 + QuestPool::INIT_SPACE);
    let pool_lamports = pool.to_account_info().lamports();
    let needed = rent_min.saturating_add(reward as u64);
    require!(pool_lamports >= needed, QuestError::InsufficientPoolLamports);

    **pool.to_account_info().try_borrow_mut_lamports()? = pool_lamports
        .checked_sub(reward)
        .ok_or(QuestError::InsufficientPoolLamports)?;
    **claimer.to_account_info().try_borrow_mut_lamports()? = claimer
        .to_account_info()
        .lamports()
        .checked_add(reward)
        .ok_or(QuestError::InsufficientPoolLamports)?;

    let now = Clock::get()?.unix_timestamp;
    p.status = Participation::STATUS_CLAIMED;
    p.claimed_at = now;

    pool.claimed_amount = pool
        .claimed_amount
        .checked_add(reward)
        .ok_or(QuestError::InsufficientPoolLamports)?;

    emit!(RewardClaimed {
        quest_pool: pool.key(),
        participation: p.key(),
        user_wallet: p.user_wallet,
        amount: reward,
        claimed_at: now,
    });

    Ok(())
}
