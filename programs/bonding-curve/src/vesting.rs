use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

/**
 * Token Vesting Module
 *
 * Allows token creators to lock tokens with a linear vesting schedule.
 * Locked tokens are held in a vesting account and released over time.
 */

/// Initialize a vesting schedule for creator tokens
pub fn initialize_vesting(
    ctx: Context<InitializeVesting>,
    total_amount: u64,
    start_time: i64,
    end_time: i64,
    cliff_time: i64,
) -> Result<()> {
    require!(end_time > start_time, VestingError::InvalidTimeRange);
    require!(cliff_time >= start_time && cliff_time <= end_time, VestingError::InvalidCliffTime);
    require!(total_amount > 0, VestingError::InvalidAmount);

    let vesting_schedule = &mut ctx.accounts.vesting_schedule;
    vesting_schedule.beneficiary = ctx.accounts.beneficiary.key();
    vesting_schedule.mint = ctx.accounts.mint.key();
    vesting_schedule.total_amount = total_amount;
    vesting_schedule.released_amount = 0;
    vesting_schedule.start_time = start_time;
    vesting_schedule.end_time = end_time;
    vesting_schedule.cliff_time = cliff_time;
    vesting_schedule.bump = ctx.bumps.vesting_schedule;

    msg!("Vesting schedule initialized: {} tokens over {} seconds",
        total_amount,
        end_time - start_time
    );

    Ok(())
}

/// Claim vested tokens
pub fn claim_vested_tokens(ctx: Context<ClaimVestedTokens>) -> Result<()> {
    let vesting_schedule = &mut ctx.accounts.vesting_schedule;
    let current_time = Clock::get()?.unix_timestamp;

    // Check cliff period
    require!(current_time >= vesting_schedule.cliff_time, VestingError::CliffNotReached);

    // Calculate vested amount
    let vested_amount = calculate_vested_amount(vesting_schedule, current_time);
    let claimable_amount = vested_amount.saturating_sub(vesting_schedule.released_amount);

    require!(claimable_amount > 0, VestingError::NoTokensVested);

    // Transfer tokens from vesting vault to beneficiary
    let mint_key = vesting_schedule.mint.key();
    let seeds = &[
        b"vesting",
        mint_key.as_ref(),
        vesting_schedule.beneficiary.as_ref(),
        &[vesting_schedule.bump],
    ];
    let signer = &[&seeds[..]];

    let cpi_accounts = Transfer {
        from: ctx.accounts.vesting_vault.to_account_info(),
        to: ctx.accounts.beneficiary_token_account.to_account_info(),
        authority: vesting_schedule.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);

    token::transfer(cpi_ctx, claimable_amount)?;

    // Update released amount
    vesting_schedule.released_amount += claimable_amount;

    msg!("Claimed {} vested tokens. Total released: {}/{}",
        claimable_amount,
        vesting_schedule.released_amount,
        vesting_schedule.total_amount
    );

    Ok(())
}

/// Calculate vested amount based on linear vesting schedule
fn calculate_vested_amount(schedule: &VestingSchedule, current_time: i64) -> u64 {
    if current_time < schedule.cliff_time {
        return 0;
    }

    if current_time >= schedule.end_time {
        return schedule.total_amount;
    }

    // Linear vesting: vested = total * (time_elapsed / total_duration)
    let time_elapsed = current_time - schedule.start_time;
    let total_duration = schedule.end_time - schedule.start_time;

    let vested = (schedule.total_amount as u128)
        .checked_mul(time_elapsed as u128)
        .unwrap()
        .checked_div(total_duration as u128)
        .unwrap() as u64;

    vested
}

// Account structures

#[derive(Accounts)]
#[instruction(total_amount: u64, start_time: i64, end_time: i64, cliff_time: i64)]
pub struct InitializeVesting<'info> {
    #[account(mut)]
    pub beneficiary: Signer<'info>,

    #[account(
        init,
        seeds = [b"vesting", mint.key().as_ref(), beneficiary.key().as_ref()],
        bump,
        payer = beneficiary,
        space = VestingSchedule::LEN
    )]
    pub vesting_schedule: Account<'info, VestingSchedule>,

    pub mint: Account<'info, anchor_spl::token::Mint>,

    /// Vault to hold locked tokens
    #[account(
        init,
        payer = beneficiary,
        token::mint = mint,
        token::authority = vesting_schedule,
    )]
    pub vesting_vault: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct ClaimVestedTokens<'info> {
    #[account(mut)]
    pub beneficiary: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vesting", vesting_schedule.mint.as_ref(), beneficiary.key().as_ref()],
        bump = vesting_schedule.bump,
        has_one = beneficiary
    )]
    pub vesting_schedule: Account<'info, VestingSchedule>,

    #[account(
        mut,
        token::mint = vesting_schedule.mint,
        token::authority = vesting_schedule,
    )]
    pub vesting_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = vesting_schedule.mint,
        token::authority = beneficiary,
    )]
    pub beneficiary_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

/// Vesting schedule account state
#[account]
pub struct VestingSchedule {
    pub beneficiary: Pubkey,
    pub mint: Pubkey,
    pub total_amount: u64,
    pub released_amount: u64,
    pub start_time: i64,
    pub end_time: i64,
    pub cliff_time: i64,
    pub bump: u8,
}

impl VestingSchedule {
    pub const LEN: usize = 8 + // Anchor discriminator
        32 + // beneficiary
        32 + // mint
        8 +  // total_amount
        8 +  // released_amount
        8 +  // start_time
        8 +  // end_time
        8 +  // cliff_time
        1;   // bump
}

// Error codes
#[error_code]
pub enum VestingError {
    #[msg("Invalid time range: end time must be after start time")]
    InvalidTimeRange,
    #[msg("Invalid cliff time: must be between start and end time")]
    InvalidCliffTime,
    #[msg("Invalid amount: must be greater than 0")]
    InvalidAmount,
    #[msg("Cliff period not reached yet")]
    CliffNotReached,
    #[msg("No tokens vested yet")]
    NoTokensVested,
}
