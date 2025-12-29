use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, MintTo, Transfer, SetAuthority};
use anchor_spl::associated_token::AssociatedToken;

// Migration module for DEX integration
pub mod migration;

declare_id!("Cxiw2xXiCCNywNS6qH1mPH81yaVkG8jhu7x6ma7oTK9M");

/// Production Pump.fun Clone - Bonding Curve Program
///
/// Architecture:
/// - Buy-only bonding curve (no sells until DEX migration)
/// - 793.1M tokens in curve, 206.9M to creator
/// - Auto-migration to DEX when all tokens sold
/// - Constant product formula with virtual reserves
#[program]
pub mod bonding_curve {
    use super::*;

    /// Initialize global configuration (one-time, admin only)
    /// Must be called before any token creation
    pub fn initialize_global(
        ctx: Context<InitializeGlobal>,
        fee_basis_points: u16,
    ) -> Result<()> {
        let global = &mut ctx.accounts.global;

        global.authority = ctx.accounts.authority.key();
        global.fee_recipient = ctx.accounts.fee_recipient.key();
        global.migration_authority = ctx.accounts.migration_authority.key();

        // Pump.fun standard parameters (with 6 decimals)
        global.initial_virtual_token_reserves = 1_073_000_000_000_000; // 1.073B tokens
        global.initial_virtual_sol_reserves = 30_000_000_000;          // 30 SOL
        global.initial_real_token_reserves = 793_100_000_000_000;      // 793.1M tokens
        global.token_total_supply = 1_000_000_000_000_000;             // 1B tokens
        global.creator_allocation = 206_900_000_000_000;               // 206.9M tokens

        global.fee_basis_points = fee_basis_points; // Typically 100 (1%)
        global.paused = false;
        global.bump = ctx.bumps.global;

        msg!("Global config initialized with pump.fun parameters");
        Ok(())
    }

    /// Create new token with bonding curve
    /// Mints total supply, allocates to creator and curve
    pub fn create(
        ctx: Context<Create>,
        name: String,
        symbol: String,
        uri: String,
    ) -> Result<()> {
        let global = &ctx.accounts.global;

        // Security: Check not paused
        require!(!global.paused, ErrorCode::ProgramPaused);

        // Validate metadata
        require!(name.len() <= 32, ErrorCode::NameTooLong);
        require!(symbol.len() <= 10, ErrorCode::SymbolTooLong);
        require!(uri.len() <= 200, ErrorCode::UriTooLong);

        let mint = &ctx.accounts.mint;
        let bonding_curve = &mut ctx.accounts.bonding_curve;
        let creator = &ctx.accounts.creator;

        // Transfer mint authority to bonding curve PDA for controlled minting
        let cpi_accounts = SetAuthority {
            current_authority: creator.to_account_info(),
            account_or_mint: mint.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);
        token::set_authority(
            cpi_ctx,
            anchor_spl::token::spl_token::instruction::AuthorityType::MintTokens,
            Some(bonding_curve.key()),
        )?;

        // Derive PDA signer seeds
        let mint_key = mint.key();
        let seeds = &[
            b"bonding-curve",
            mint_key.as_ref(),
            &[ctx.bumps.bonding_curve],
        ];
        let signer = &[&seeds[..]];

        // Mint creator allocation directly to creator
        if global.creator_allocation > 0 {
            let mint_creator_cpi = MintTo {
                mint: mint.to_account_info(),
                to: ctx.accounts.creator_token_account.to_account_info(),
                authority: bonding_curve.to_account_info(),
            };
            let mint_creator_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                mint_creator_cpi,
                signer,
            );
            token::mint_to(mint_creator_ctx, global.creator_allocation)?;
        }

        // Mint bonding curve tokens to vault
        let mint_vault_cpi = MintTo {
            mint: mint.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
            authority: bonding_curve.to_account_info(),
        };
        let mint_vault_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            mint_vault_cpi,
            signer,
        );
        token::mint_to(mint_vault_ctx, global.initial_real_token_reserves)?;

        // Initialize bonding curve state
        bonding_curve.mint = mint.key();
        bonding_curve.creator = creator.key();
        bonding_curve.virtual_token_reserves = global.initial_virtual_token_reserves;
        bonding_curve.virtual_sol_reserves = global.initial_virtual_sol_reserves;
        bonding_curve.real_token_reserves = global.initial_real_token_reserves;
        bonding_curve.real_sol_reserves = 0;
        bonding_curve.token_total_supply = global.token_total_supply;
        bonding_curve.complete = false;
        bonding_curve.migrated = false;
        bonding_curve.created_at = Clock::get()?.unix_timestamp;
        bonding_curve.bump = ctx.bumps.bonding_curve;

        msg!("Token created: {} ({})", name, symbol);
        msg!("Creator allocation: {}, Bonding curve: {}",
            global.creator_allocation,
            global.initial_real_token_reserves
        );

        Ok(())
    }

    /// Buy tokens from bonding curve
    /// Uses constant product formula: x * y = k
    /// Buy-only: no sells allowed until DEX migration
    pub fn buy(
        ctx: Context<Buy>,
        token_amount: u64,     // Exact tokens to receive
        max_sol_cost: u64,     // Maximum SOL willing to spend (slippage protection)
    ) -> Result<()> {
        let global = &ctx.accounts.global;
        let bonding_curve = &mut ctx.accounts.bonding_curve;

        // Security checks
        require!(!global.paused, ErrorCode::ProgramPaused);
        require!(!bonding_curve.complete, ErrorCode::BondingCurveComplete);
        require!(!bonding_curve.migrated, ErrorCode::AlreadyMigrated);
        require!(token_amount > 0, ErrorCode::InvalidAmount);
        require!(token_amount <= bonding_curve.real_token_reserves, ErrorCode::InsufficientLiquidity);

        // Calculate SOL cost using constant product formula
        // Formula: new_sol_reserves = k / new_token_reserves
        // Where k = virtual_sol_reserves * virtual_token_reserves
        let sol_cost = calculate_buy_price(
            bonding_curve.virtual_sol_reserves,
            bonding_curve.virtual_token_reserves,
            token_amount,
        )?;

        // Calculate platform fee BEFORE reserve updates
        let platform_fee = sol_cost
            .checked_mul(global.fee_basis_points as u64)
            .ok_or(ErrorCode::Overflow)?
            .checked_div(10_000)
            .ok_or(ErrorCode::Overflow)?;

        let total_cost = sol_cost
            .checked_add(platform_fee)
            .ok_or(ErrorCode::Overflow)?;

        // Slippage protection
        require!(total_cost <= max_sol_cost, ErrorCode::SlippageExceeded);

        // STATE UPDATE FIRST (reentrancy protection pattern)
        // Update virtual reserves for pricing
        bonding_curve.virtual_sol_reserves = bonding_curve.virtual_sol_reserves
            .checked_add(sol_cost)
            .ok_or(ErrorCode::Overflow)?;

        bonding_curve.virtual_token_reserves = bonding_curve.virtual_token_reserves
            .checked_sub(token_amount)
            .ok_or(ErrorCode::Underflow)?;

        // Update real reserves (actual balances)
        bonding_curve.real_sol_reserves = bonding_curve.real_sol_reserves
            .checked_add(sol_cost)
            .ok_or(ErrorCode::Overflow)?;

        bonding_curve.real_token_reserves = bonding_curve.real_token_reserves
            .checked_sub(token_amount)
            .ok_or(ErrorCode::Underflow)?;

        // Check if bonding curve is complete (all tokens sold)
        if bonding_curve.real_token_reserves == 0 {
            bonding_curve.complete = true;
            msg!("Bonding curve complete! Ready for DEX migration.");
        }

        // THEN make external calls (transfers)
        // Transfer SOL from buyer to bonding curve PDA
        let transfer_sol_ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.buyer.key(),
            &bonding_curve.key(),
            sol_cost,
        );
        anchor_lang::solana_program::program::invoke(
            &transfer_sol_ix,
            &[
                ctx.accounts.buyer.to_account_info(),
                bonding_curve.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        // Transfer platform fee to fee recipient
        if platform_fee > 0 {
            let transfer_fee_ix = anchor_lang::solana_program::system_instruction::transfer(
                &ctx.accounts.buyer.key(),
                &ctx.accounts.fee_recipient.key(),
                platform_fee,
            );
            anchor_lang::solana_program::program::invoke(
                &transfer_fee_ix,
                &[
                    ctx.accounts.buyer.to_account_info(),
                    ctx.accounts.fee_recipient.to_account_info(),
                    ctx.accounts.system_program.to_account_info(),
                ],
            )?;
        }

        // Transfer tokens from vault to buyer
        let mint_key = bonding_curve.mint;
        let seeds = &[
            b"bonding-curve",
            mint_key.as_ref(),
            &[bonding_curve.bump],
        ];
        let signer = &[&seeds[..]];

        let transfer_tokens_cpi = Transfer {
            from: ctx.accounts.vault.to_account_info(),
            to: ctx.accounts.buyer_token_account.to_account_info(),
            authority: bonding_curve.to_account_info(),
        };
        let transfer_tokens_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            transfer_tokens_cpi,
            signer,
        );
        token::transfer(transfer_tokens_ctx, token_amount)?;

        msg!("Buy completed: {} tokens for {} lamports (+ {} fee)",
            token_amount, sol_cost, platform_fee);

        Ok(())
    }

    /// Sell tokens back to bonding curve
    /// Uses constant product formula: x * y = k
    pub fn sell(
        ctx: Context<Sell>,
        token_amount: u64,      // Exact tokens to sell
        min_sol_received: u64,  // Minimum SOL expected (slippage protection)
    ) -> Result<()> {
        let global = &ctx.accounts.global;
        let bonding_curve = &mut ctx.accounts.bonding_curve;

        // Security checks
        require!(!global.paused, ErrorCode::ProgramPaused);
        require!(!bonding_curve.complete, ErrorCode::BondingCurveComplete);
        require!(!bonding_curve.migrated, ErrorCode::AlreadyMigrated);
        require!(token_amount > 0, ErrorCode::InvalidAmount);

        // Calculate SOL to receive using constant product formula
        // Formula: sol_out = (virtual_sol * tokens_in) / (virtual_tokens + tokens_in)
        let sol_received = calculate_sell_price(
            bonding_curve.virtual_sol_reserves,
            bonding_curve.virtual_token_reserves,
            token_amount,
        )?;

        // Calculate platform fee
        let platform_fee = sol_received
            .checked_mul(global.fee_basis_points as u64)
            .ok_or(ErrorCode::Overflow)?
            .checked_div(10_000)
            .ok_or(ErrorCode::Overflow)?;

        let net_sol_received = sol_received
            .checked_sub(platform_fee)
            .ok_or(ErrorCode::Underflow)?;

        // Slippage protection
        require!(net_sol_received >= min_sol_received, ErrorCode::SlippageExceeded);

        // Check bonding curve has enough SOL
        require!(
            bonding_curve.real_sol_reserves >= sol_received,
            ErrorCode::InsufficientLiquidity
        );

        // STATE UPDATE FIRST (reentrancy protection)
        // Update virtual reserves for pricing
        bonding_curve.virtual_token_reserves = bonding_curve.virtual_token_reserves
            .checked_add(token_amount)
            .ok_or(ErrorCode::Overflow)?;

        bonding_curve.virtual_sol_reserves = bonding_curve.virtual_sol_reserves
            .checked_sub(sol_received)
            .ok_or(ErrorCode::Underflow)?;

        // Update real reserves
        bonding_curve.real_token_reserves = bonding_curve.real_token_reserves
            .checked_add(token_amount)
            .ok_or(ErrorCode::Overflow)?;

        bonding_curve.real_sol_reserves = bonding_curve.real_sol_reserves
            .checked_sub(sol_received)
            .ok_or(ErrorCode::Underflow)?;

        // THEN make external calls
        // Transfer tokens from seller to vault
        let transfer_tokens_cpi = Transfer {
            from: ctx.accounts.seller_token_account.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
            authority: ctx.accounts.seller.to_account_info(),
        };
        let transfer_tokens_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            transfer_tokens_cpi,
        );
        token::transfer(transfer_tokens_ctx, token_amount)?;

        // Transfer SOL from bonding curve PDA to seller
        let mint_key = bonding_curve.mint;
        let seeds = &[
            b"bonding-curve",
            mint_key.as_ref(),
            &[bonding_curve.bump],
        ];
        let signer = &[&seeds[..]];

        **bonding_curve.to_account_info().try_borrow_mut_lamports()? -= net_sol_received;
        **ctx.accounts.seller.to_account_info().try_borrow_mut_lamports()? += net_sol_received;

        // Transfer platform fee to fee recipient
        if platform_fee > 0 {
            **bonding_curve.to_account_info().try_borrow_mut_lamports()? -= platform_fee;
            **ctx.accounts.fee_recipient.to_account_info().try_borrow_mut_lamports()? += platform_fee;
        }

        msg!("Sell completed: {} tokens for {} lamports (- {} fee)",
            token_amount, net_sol_received, platform_fee);

        Ok(())
    }

    /// Migrate bonding curve to DEX (Meteora DAMM)
    /// Permissionless when complete == true
    /// Creates CLMM pool with all collected liquidity
    pub fn migrate(ctx: Context<migration::MigrateToDEX>) -> Result<()> {
        migration::execute_migration(ctx)
    }

    /// Admin: Update global parameters
    #[access_control(is_authority(&ctx.accounts.global, &ctx.accounts.authority))]
    pub fn update_global(
        ctx: Context<UpdateGlobal>,
        new_fee_basis_points: Option<u16>,
        new_fee_recipient: Option<Pubkey>,
    ) -> Result<()> {
        let global = &mut ctx.accounts.global;

        if let Some(fee) = new_fee_basis_points {
            require!(fee <= 1000, ErrorCode::FeeTooHigh); // Max 10%
            global.fee_basis_points = fee;
            msg!("Fee updated to {} bps", fee);
        }

        if let Some(recipient) = new_fee_recipient {
            global.fee_recipient = recipient;
            msg!("Fee recipient updated");
        }

        Ok(())
    }

    /// Admin: Emergency pause/unpause
    #[access_control(is_authority(&ctx.accounts.global, &ctx.accounts.authority))]
    pub fn set_pause(ctx: Context<SetPause>, paused: bool) -> Result<()> {
        let global = &mut ctx.accounts.global;
        global.paused = paused;
        msg!("Program paused: {}", paused);
        Ok(())
    }
}

// ============================================================================
// Account Structures
// ============================================================================

#[derive(Accounts)]
pub struct InitializeGlobal<'info> {
    #[account(
        init,
        seeds = [b"global"],
        bump,
        payer = authority,
        space = Global::LEN
    )]
    pub global: Account<'info, Global>,

    #[account(mut)]
    pub authority: Signer<'info>,

    /// CHECK: Fee recipient can be any account
    pub fee_recipient: AccountInfo<'info>,

    /// CHECK: Migration authority can be any account
    pub migration_authority: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Create<'info> {
    #[account(seeds = [b"global"], bump = global.bump)]
    pub global: Account<'info, Global>,

    #[account(
        init,
        seeds = [b"bonding-curve", mint.key().as_ref()],
        bump,
        payer = creator,
        space = BondingCurve::LEN
    )]
    pub bonding_curve: Account<'info, BondingCurve>,

    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(mut)]
    pub mint: Account<'info, Mint>,

    /// Token vault to hold bonding curve reserves
    #[account(
        init,
        payer = creator,
        associated_token::mint = mint,
        associated_token::authority = bonding_curve,
    )]
    pub vault: Account<'info, TokenAccount>,

    /// Creator's token account for allocation
    #[account(
        init_if_needed,
        payer = creator,
        associated_token::mint = mint,
        associated_token::authority = creator,
    )]
    pub creator_token_account: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Buy<'info> {
    #[account(seeds = [b"global"], bump = global.bump)]
    pub global: Account<'info, Global>,

    #[account(
        mut,
        seeds = [b"bonding-curve", bonding_curve.mint.as_ref()],
        bump = bonding_curve.bump,
    )]
    pub bonding_curve: Account<'info, BondingCurve>,

    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(mut)]
    pub mint: Account<'info, Mint>,

    /// Buyer's token account
    #[account(
        init_if_needed,
        payer = buyer,
        associated_token::mint = mint,
        associated_token::authority = buyer,
    )]
    pub buyer_token_account: Account<'info, TokenAccount>,

    /// Token vault
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = bonding_curve,
    )]
    pub vault: Account<'info, TokenAccount>,

    /// CHECK: Fee recipient from global config
    #[account(mut, address = global.fee_recipient)]
    pub fee_recipient: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Sell<'info> {
    #[account(seeds = [b"global"], bump = global.bump)]
    pub global: Account<'info, Global>,

    #[account(
        mut,
        seeds = [b"bonding-curve", bonding_curve.mint.as_ref()],
        bump = bonding_curve.bump,
    )]
    pub bonding_curve: Account<'info, BondingCurve>,

    #[account(mut)]
    pub seller: Signer<'info>,

    #[account(mut)]
    pub mint: Account<'info, Mint>,

    /// Seller's token account
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = seller,
    )]
    pub seller_token_account: Account<'info, TokenAccount>,

    /// Token vault
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = bonding_curve,
    )]
    pub vault: Account<'info, TokenAccount>,

    /// CHECK: Fee recipient from global config
    #[account(mut, address = global.fee_recipient)]
    pub fee_recipient: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

// Migrate accounts moved to migration.rs module

#[derive(Accounts)]
pub struct UpdateGlobal<'info> {
    #[account(mut, seeds = [b"global"], bump = global.bump)]
    pub global: Account<'info, Global>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct SetPause<'info> {
    #[account(mut, seeds = [b"global"], bump = global.bump)]
    pub global: Account<'info, Global>,

    pub authority: Signer<'info>,
}

// ============================================================================
// State Accounts
// ============================================================================

#[account]
pub struct Global {
    pub authority: Pubkey,                      // 32
    pub fee_recipient: Pubkey,                  // 32
    pub migration_authority: Pubkey,            // 32
    pub initial_virtual_token_reserves: u64,    // 8
    pub initial_virtual_sol_reserves: u64,      // 8
    pub initial_real_token_reserves: u64,       // 8
    pub token_total_supply: u64,                // 8
    pub creator_allocation: u64,                // 8
    pub fee_basis_points: u16,                  // 2
    pub paused: bool,                           // 1
    pub bump: u8,                               // 1
}

impl Global {
    pub const LEN: usize = 8 + // discriminator
        32 + 32 + 32 +         // pubkeys
        8 + 8 + 8 + 8 + 8 +    // u64s
        2 +                     // u16
        1 + 1;                  // bools and bump
}

#[account]
pub struct BondingCurve {
    pub mint: Pubkey,                    // 32
    pub creator: Pubkey,                 // 32
    pub virtual_token_reserves: u64,     // 8
    pub virtual_sol_reserves: u64,       // 8
    pub real_token_reserves: u64,        // 8
    pub real_sol_reserves: u64,          // 8
    pub token_total_supply: u64,         // 8
    pub complete: bool,                  // 1
    pub migrated: bool,                  // 1
    pub created_at: i64,                 // 8
    pub bump: u8,                        // 1
}

impl BondingCurve {
    pub const LEN: usize = 8 + // discriminator
        32 + 32 +              // pubkeys
        8 + 8 + 8 + 8 + 8 +    // u64s
        1 + 1 +                // bools
        8 +                    // i64
        1;                     // bump
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Calculate SOL cost to buy exact token amount
/// Formula: new_sol = k / (token_reserves - token_amount)
///          cost = new_sol - current_sol
fn calculate_buy_price(
    virtual_sol_reserves: u64,
    virtual_token_reserves: u64,
    token_amount: u64,
) -> Result<u64> {
    require!(
        virtual_sol_reserves > 0 && virtual_token_reserves > 0,
        ErrorCode::InvalidReserves
    );
    require!(
        token_amount < virtual_token_reserves,
        ErrorCode::InsufficientLiquidity
    );

    // Use u128 for intermediate calculations to prevent overflow
    let k = (virtual_sol_reserves as u128)
        .checked_mul(virtual_token_reserves as u128)
        .ok_or(ErrorCode::Overflow)?;

    let new_token_reserves = (virtual_token_reserves as u128)
        .checked_sub(token_amount as u128)
        .ok_or(ErrorCode::Underflow)?;

    let new_sol_reserves = k
        .checked_div(new_token_reserves)
        .ok_or(ErrorCode::DivisionByZero)?;

    let sol_cost = new_sol_reserves
        .checked_sub(virtual_sol_reserves as u128)
        .ok_or(ErrorCode::Underflow)?;

    // Ensure result fits in u64
    u64::try_from(sol_cost).map_err(|_| ErrorCode::Overflow.into())
}

/// Calculate SOL received for selling exact token amount
/// Formula: sol_out = (virtual_sol * token_amount) / (virtual_tokens + token_amount)
fn calculate_sell_price(
    virtual_sol_reserves: u64,
    virtual_token_reserves: u64,
    token_amount: u64,
) -> Result<u64> {
    require!(
        virtual_sol_reserves > 0 && virtual_token_reserves > 0,
        ErrorCode::InvalidReserves
    );

    // Use u128 for intermediate calculations to prevent overflow
    let numerator = (virtual_sol_reserves as u128)
        .checked_mul(token_amount as u128)
        .ok_or(ErrorCode::Overflow)?;

    let denominator = (virtual_token_reserves as u128)
        .checked_add(token_amount as u128)
        .ok_or(ErrorCode::Overflow)?;

    let sol_out = numerator
        .checked_div(denominator)
        .ok_or(ErrorCode::DivisionByZero)?;

    // Ensure result fits in u64
    u64::try_from(sol_out).map_err(|_| ErrorCode::Overflow.into())
}

// ============================================================================
// Access Control
// ============================================================================

fn is_authority(global: &Global, signer: &Signer) -> Result<()> {
    require!(
        global.authority == signer.key(),
        ErrorCode::Unauthorized
    );
    Ok(())
}

// ============================================================================
// Error Codes
// ============================================================================

#[error_code]
pub enum ErrorCode {
    #[msg("Program is paused")]
    ProgramPaused,

    #[msg("Bonding curve is complete, no more tokens available")]
    BondingCurveComplete,

    #[msg("Already migrated to DEX")]
    AlreadyMigrated,

    #[msg("Not complete, cannot migrate yet")]
    NotComplete,

    #[msg("Invalid amount")]
    InvalidAmount,

    #[msg("Insufficient liquidity")]
    InsufficientLiquidity,

    #[msg("Slippage tolerance exceeded")]
    SlippageExceeded,

    #[msg("Invalid reserves")]
    InvalidReserves,

    #[msg("Arithmetic overflow")]
    Overflow,

    #[msg("Arithmetic underflow")]
    Underflow,

    #[msg("Division by zero")]
    DivisionByZero,

    #[msg("Unauthorized")]
    Unauthorized,

    #[msg("Fee too high (max 10%)")]
    FeeTooHigh,

    #[msg("Name too long (max 32 chars)")]
    NameTooLong,

    #[msg("Symbol too long (max 10 chars)")]
    SymbolTooLong,

    #[msg("URI too long (max 200 chars)")]
    UriTooLong,
}
