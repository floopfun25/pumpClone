use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, MintTo, Burn};

declare_id!("Hg4PXsCRaVRjeYgx75GJioGqCQ6GiGWGGHTnpcTLE9CY");

#[program]
pub mod bonding_curve {
    use super::*;

    // Initialize a new bonding curve for a token
    pub fn initialize(
        ctx: Context<Initialize>,
        initial_virtual_token_reserves: u64,
        initial_virtual_sol_reserves: u64,
        bump: u8,
    ) -> Result<()> {
        let bonding_curve = &mut ctx.accounts.bonding_curve;
        
        // Anchor automatically handles the discriminator, don't set it manually
        bonding_curve.mint_address = ctx.accounts.mint.key();
        bonding_curve.creator = ctx.accounts.creator.key();
        bonding_curve.virtual_token_reserves = initial_virtual_token_reserves;
        bonding_curve.virtual_sol_reserves = initial_virtual_sol_reserves;
        bonding_curve.real_token_reserves = 0;
        bonding_curve.real_sol_reserves = 0;
        bonding_curve.token_total_supply = 0;
        bonding_curve.graduated = false;
        bonding_curve.created_at = Clock::get()?.unix_timestamp;
        bonding_curve.bump_seed = bump;

        msg!("Bonding curve initialized successfully");
        Ok(())
    }

    // Buy tokens from the bonding curve
    pub fn buy(
        ctx: Context<Buy>,
        sol_amount: u64,
        min_tokens_received: u64,
    ) -> Result<()> {
        // Verify bonding curve hasn't graduated
        require!(!ctx.accounts.bonding_curve.graduated, ErrorCode::AlreadyGraduated);

        // Calculate platform fee (1%)
        let platform_fee = sol_amount * PLATFORM_FEE_BPS as u64 / 10000;
        let trade_amount = sol_amount - platform_fee;

        // Calculate tokens to mint using bonding curve formula
        let tokens_to_mint = calculate_tokens_out(
            trade_amount,
            ctx.accounts.bonding_curve.virtual_sol_reserves,
            ctx.accounts.bonding_curve.virtual_token_reserves,
        )?;

        // Check slippage tolerance
        require!(tokens_to_mint >= min_tokens_received, ErrorCode::SlippageExceeded);

        // Transfer SOL from buyer to bonding curve vault
        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.buyer.key(),
            &ctx.accounts.vault.key(),
            trade_amount,
        );
        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                ctx.accounts.buyer.to_account_info(),
                ctx.accounts.vault.to_account_info(),
            ],
        )?;

        // Transfer platform fee
        if platform_fee > 0 {
            let fee_ix = anchor_lang::solana_program::system_instruction::transfer(
                &ctx.accounts.buyer.key(),
                &ctx.accounts.platform_fee.key(),
                platform_fee,
            );
            anchor_lang::solana_program::program::invoke(
                &fee_ix,
                &[
                    ctx.accounts.buyer.to_account_info(),
                    ctx.accounts.platform_fee.to_account_info(),
                ],
            )?;
        }

        // Mint tokens to buyer
        let mint_address = ctx.accounts.bonding_curve.mint_address;
        let bump_seed = ctx.accounts.bonding_curve.bump_seed;
        let mint_seeds = &[
            b"bonding_curve",
            mint_address.as_ref(),
            &[bump_seed],
        ];
        let signer = &[&mint_seeds[..]];

        let cpi_accounts = MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.buyer_token_account.to_account_info(),
            authority: ctx.accounts.bonding_curve.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);

        token::mint_to(cpi_ctx, tokens_to_mint)?;

        // Update bonding curve state
        let bonding_curve = &mut ctx.accounts.bonding_curve;
        bonding_curve.virtual_sol_reserves += trade_amount;
        bonding_curve.virtual_token_reserves -= tokens_to_mint;
        bonding_curve.real_sol_reserves += trade_amount;
        bonding_curve.token_total_supply += tokens_to_mint;

        // Check for graduation
        if bonding_curve.real_sol_reserves >= GRADUATION_THRESHOLD {
            bonding_curve.graduated = true;
            msg!("Token graduated to DEX!");
        }

        msg!("Buy transaction completed: {} tokens minted for {} SOL", tokens_to_mint, sol_amount);
        Ok(())
    }

    // Sell tokens to the bonding curve
    pub fn sell(
        ctx: Context<Sell>,
        token_amount: u64,
        min_sol_received: u64,
    ) -> Result<()> {
        let bonding_curve = &mut ctx.accounts.bonding_curve;
        
        // Verify bonding curve hasn't graduated
        require!(!bonding_curve.graduated, ErrorCode::AlreadyGraduated);

        // Calculate SOL to return using bonding curve formula
        let sol_out = calculate_sol_out(
            token_amount,
            bonding_curve.virtual_token_reserves,
            bonding_curve.virtual_sol_reserves,
        )?;

        // Calculate platform fee
        let platform_fee = sol_out * PLATFORM_FEE_BPS as u64 / 10000;
        let seller_receives = sol_out - platform_fee;

        // Check slippage tolerance
        require!(seller_receives >= min_sol_received, ErrorCode::SlippageExceeded);

        // Burn tokens from seller
        let cpi_accounts = Burn {
            mint: ctx.accounts.mint.to_account_info(),
            from: ctx.accounts.seller_token_account.to_account_info(),
            authority: ctx.accounts.seller.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

        token::burn(cpi_ctx, token_amount)?;

        // Transfer SOL from vault to seller
        let bonding_curve_key = bonding_curve.key();
        let vault_seeds = &[
            b"vault",
            bonding_curve_key.as_ref(),
            &[ctx.bumps.vault],
        ];
        let _signer = &[&vault_seeds[..]];

        **ctx.accounts.vault.to_account_info().try_borrow_mut_lamports()? -= seller_receives;
        **ctx.accounts.seller.to_account_info().try_borrow_mut_lamports()? += seller_receives;

        // Transfer platform fee
        if platform_fee > 0 {
            **ctx.accounts.vault.to_account_info().try_borrow_mut_lamports()? -= platform_fee;
            **ctx.accounts.platform_fee.to_account_info().try_borrow_mut_lamports()? += platform_fee;
        }

        // Update bonding curve state
        bonding_curve.virtual_token_reserves += token_amount;
        bonding_curve.virtual_sol_reserves -= sol_out;
        bonding_curve.real_sol_reserves -= sol_out;
        bonding_curve.token_total_supply -= token_amount;

        msg!("Sell transaction completed: {} tokens sold for {} SOL", token_amount, seller_receives);
        Ok(())
    }
}

// Account structures
#[derive(Accounts)]
#[instruction(initial_virtual_token_reserves: u64, initial_virtual_sol_reserves: u64, bump: u8)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    
    #[account(
        init,
        seeds = [b"bonding_curve", mint.key().as_ref()],
        bump,
        payer = creator,
        space = BondingCurve::LEN
    )]
    pub bonding_curve: Account<'info, BondingCurve>,
    
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    
    #[account(mut)]
    pub creator_token_account: Account<'info, TokenAccount>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Buy<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    
    #[account(mut)]
    pub bonding_curve: Account<'info, BondingCurve>,
    
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    
    #[account(mut)]
    pub buyer_token_account: Account<'info, TokenAccount>,
    
    /// CHECK: Platform fee account
    #[account(mut)]
    pub platform_fee: AccountInfo<'info>,
    
    #[account(
        mut,
        seeds = [b"vault", bonding_curve.key().as_ref()],
        bump
    )]
    pub vault: SystemAccount<'info>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Sell<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,
    
    #[account(mut)]
    pub bonding_curve: Account<'info, BondingCurve>,
    
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    
    #[account(mut)]
    pub seller_token_account: Account<'info, TokenAccount>,
    
    /// CHECK: Platform fee account
    #[account(mut)]
    pub platform_fee: AccountInfo<'info>,
    
    #[account(
        mut,
        seeds = [b"vault", bonding_curve.key().as_ref()],
        bump
    )]
    pub vault: SystemAccount<'info>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

// Bonding curve account state
#[account]
pub struct BondingCurve {
    pub mint_address: Pubkey,
    pub creator: Pubkey,
    pub virtual_token_reserves: u64,
    pub virtual_sol_reserves: u64,
    pub real_token_reserves: u64,
    pub real_sol_reserves: u64,
    pub token_total_supply: u64,
    pub graduated: bool,
    pub created_at: i64,
    pub bump_seed: u8,
}

impl BondingCurve {
    pub const LEN: usize = 8 + // Anchor discriminator (handled automatically)
        32 + // mint_address
        32 + // creator
        8 + // virtual_token_reserves
        8 + // virtual_sol_reserves
        8 + // real_token_reserves
        8 + // real_sol_reserves
        8 + // token_total_supply
        1 + // graduated
        8 + // created_at
        1; // bump_seed
}

// Constants
const PLATFORM_FEE_BPS: u16 = 100; // 1% platform fee
const GRADUATION_THRESHOLD: u64 = 69_000_000_000; // 69 SOL in lamports

// Calculate tokens out for given SOL input (constant product formula)
fn calculate_tokens_out(
    sol_in: u64,
    sol_reserves: u64,
    token_reserves: u64,
) -> Result<u64> {
    require!(sol_reserves > 0 && token_reserves > 0, ErrorCode::InvalidReserves);

    // Using constant product formula: (sol_reserves + sol_in) * (token_reserves - tokens_out) = k
    // Where k = sol_reserves * token_reserves
    let k = (sol_reserves as u128) * (token_reserves as u128);
    let new_sol_reserves = sol_reserves + sol_in;
    let new_token_reserves = k / (new_sol_reserves as u128);
    let tokens_out = token_reserves - (new_token_reserves as u64);

    Ok(tokens_out)
}

// Calculate SOL out for given token input (constant product formula)
fn calculate_sol_out(
    token_in: u64,
    token_reserves: u64,
    sol_reserves: u64,
) -> Result<u64> {
    require!(sol_reserves > 0 && token_reserves > 0, ErrorCode::InvalidReserves);

    // Using constant product formula: (token_reserves + token_in) * (sol_reserves - sol_out) = k
    let k = (sol_reserves as u128) * (token_reserves as u128);
    let new_token_reserves = token_reserves + token_in;
    let new_sol_reserves = k / (new_token_reserves as u128);
    let sol_out = sol_reserves - (new_sol_reserves as u64);

    Ok(sol_out)
}

// Error codes
#[error_code]
pub enum ErrorCode {
    #[msg("Already graduated")]
    AlreadyGraduated,
    #[msg("Slippage tolerance exceeded")]
    SlippageExceeded,
    #[msg("Invalid reserves")]
    InvalidReserves,
}