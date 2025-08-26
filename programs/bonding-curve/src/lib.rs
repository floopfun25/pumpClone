use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program::invoke,
    program::invoke_signed,
    program_error::ProgramError,
    pubkey::Pubkey,
    rent::Rent,
    sysvar::Sysvar,
    system_instruction,
    program_pack::{Pack, Sealed},
    clock::Clock,
};
use borsh::{BorshDeserialize, BorshSerialize};

// Program entrypoint
entrypoint!(process_instruction);

// Instruction types
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub enum BondingCurveInstruction {
    /// Initialize a new bonding curve for a token
    /// Accounts:
    /// 0. [writable, signer] Creator account
    /// 1. [writable] Bonding curve account (PDA)
    /// 2. [writable] Token mint account
    /// 3. [writable] Creator token account
    /// 4. [] System program
    /// 5. [] Token program
    /// 6. [] Rent sysvar
    Initialize {
        initial_virtual_token_reserves: u64,
        initial_virtual_sol_reserves: u64,
        bump: u8,
    },
    
    /// Buy tokens from the bonding curve
    /// Accounts:
    /// 0. [writable, signer] Buyer account
    /// 1. [writable] Bonding curve account
    /// 2. [writable] Token mint account
    /// 3. [writable] Buyer token account
    /// 4. [writable] Platform fee account
    /// 5. [writable] Bonding curve vault (PDA)
    /// 6. [] Token program
    /// 7. [] System program
    Buy {
        sol_amount: u64,
        min_tokens_received: u64,
    },
    
    /// Sell tokens to the bonding curve
    /// Accounts:
    /// 0. [writable, signer] Seller account
    /// 1. [writable] Bonding curve account
    /// 2. [writable] Token mint account
    /// 3. [writable] Seller token account
    /// 4. [writable] Platform fee account
    /// 5. [writable] Bonding curve vault (PDA)
    /// 6. [] Token program
    /// 7. [] System program
    Sell {
        token_amount: u64,
        min_sol_received: u64,
    },
}

// Bonding curve account state
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct BondingCurve {
    pub discriminator: [u8; 8],
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

impl Sealed for BondingCurve {}

impl Pack for BondingCurve {
    const LEN: usize = 8 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 1 + 8 + 1;
    
    fn unpack_from_slice(src: &[u8]) -> Result<Self, ProgramError> {
        BondingCurve::try_from_slice(src).map_err(|_| ProgramError::InvalidAccountData)
    }
    
    fn pack_into_slice(&self, dst: &mut [u8]) {
        let data = self.try_to_vec().unwrap();
        dst[..data.len()].copy_from_slice(&data);
    }
}

// Constants
const DISCRIMINATOR: [u8; 8] = [1, 2, 3, 4, 5, 6, 7, 8];
const PLATFORM_FEE_BPS: u16 = 100; // 1% platform fee
const GRADUATION_THRESHOLD: u64 = 69_000_000_000; // 69 SOL in lamports

// Program main entry point
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let instruction = BondingCurveInstruction::try_from_slice(instruction_data)
        .map_err(|_| ProgramError::InvalidInstructionData)?;

    match instruction {
        BondingCurveInstruction::Initialize {
            initial_virtual_token_reserves,
            initial_virtual_sol_reserves,
            bump,
        } => {
            msg!("Instruction: Initialize Bonding Curve");
            initialize_bonding_curve(
                program_id,
                accounts,
                initial_virtual_token_reserves,
                initial_virtual_sol_reserves,
                bump,
            )
        }
        BondingCurveInstruction::Buy {
            sol_amount,
            min_tokens_received,
        } => {
            msg!("Instruction: Buy Tokens");
            buy_tokens(program_id, accounts, sol_amount, min_tokens_received)
        }
        BondingCurveInstruction::Sell {
            token_amount,
            min_sol_received,
        } => {
            msg!("Instruction: Sell Tokens");
            sell_tokens(program_id, accounts, token_amount, min_sol_received)
        }
    }
}

/// Initialize bonding curve for a new token
fn initialize_bonding_curve(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    initial_virtual_token_reserves: u64,
    initial_virtual_sol_reserves: u64,
    bump: u8,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let creator_account = next_account_info(account_info_iter)?;
    let bonding_curve_account = next_account_info(account_info_iter)?;
    let mint_account = next_account_info(account_info_iter)?;
    let creator_token_account = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;
    let rent_account = next_account_info(account_info_iter)?;

    // Verify creator is signer
    if !creator_account.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Verify bonding curve PDA
    let (bonding_curve_pda, bump_seed) = Pubkey::find_program_address(
        &[b"bonding_curve", mint_account.key.as_ref()],
        program_id,
    );
    if bonding_curve_pda != *bonding_curve_account.key {
        return Err(ProgramError::InvalidAccountData);
    }

    // Get current timestamp
    let clock = Clock::get()?;

    // Initialize bonding curve account
    let rent = Rent::get()?;
    let space = BondingCurve::LEN;
    let lamports = rent.minimum_balance(space);

    invoke_signed(
        &system_instruction::create_account(
            creator_account.key,
            bonding_curve_account.key,
            lamports,
            space as u64,
            program_id,
        ),
        &[creator_account.clone(), bonding_curve_account.clone()],
        &[&[b"bonding_curve", mint_account.key.as_ref(), &[bump_seed]]],
    )?;

    // Initialize bonding curve state
    let bonding_curve = BondingCurve {
        discriminator: DISCRIMINATOR,
        mint_address: *mint_account.key,
        creator: *creator_account.key,
        virtual_token_reserves: initial_virtual_token_reserves,
        virtual_sol_reserves: initial_virtual_sol_reserves,
        real_token_reserves: 0,
        real_sol_reserves: 0,
        token_total_supply: 0,
        graduated: false,
        created_at: clock.unix_timestamp,
        bump_seed: bump_seed,
    };

    bonding_curve.pack_into_slice(&mut bonding_curve_account.try_borrow_mut_data()?);

    msg!("Bonding curve initialized successfully");
    Ok(())
}

/// Buy tokens using bonding curve
fn buy_tokens(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    sol_amount: u64,
    min_tokens_received: u64,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let buyer_account = next_account_info(account_info_iter)?;
    let bonding_curve_account = next_account_info(account_info_iter)?;
    let mint_account = next_account_info(account_info_iter)?;
    let buyer_token_account = next_account_info(account_info_iter)?;
    let platform_fee_account = next_account_info(account_info_iter)?;
    let bonding_curve_vault = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;

    // Verify buyer is signer
    if !buyer_account.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Load bonding curve state
    let mut bonding_curve = BondingCurve::unpack_from_slice(&bonding_curve_account.try_borrow_data()?)?;

    // Verify bonding curve hasn't graduated
    if bonding_curve.graduated {
        return Err(ProgramError::Custom(1)); // Already graduated
    }

    // Calculate platform fee (1%)
    let platform_fee = sol_amount * PLATFORM_FEE_BPS as u64 / 10000;
    let trade_amount = sol_amount - platform_fee;

    // Calculate tokens to mint using bonding curve formula
    let tokens_to_mint = calculate_tokens_out(
        trade_amount,
        bonding_curve.virtual_sol_reserves,
        bonding_curve.virtual_token_reserves,
    )?;

    // Check slippage tolerance
    if tokens_to_mint < min_tokens_received {
        return Err(ProgramError::Custom(2)); // Slippage tolerance exceeded
    }

    // Transfer SOL from buyer to bonding curve vault
    invoke(
        &system_instruction::transfer(buyer_account.key, bonding_curve_vault.key, trade_amount),
        &[buyer_account.clone(), bonding_curve_vault.clone()],
    )?;

    // Transfer platform fee
    if platform_fee > 0 {
        invoke(
            &system_instruction::transfer(buyer_account.key, platform_fee_account.key, platform_fee),
            &[buyer_account.clone(), platform_fee_account.clone()],
        )?;
    }

    // Mint tokens to buyer (simplified - in full implementation, use SPL token mint instruction)
    // This would require proper token program integration

    // Update bonding curve state
    bonding_curve.virtual_sol_reserves += trade_amount;
    bonding_curve.virtual_token_reserves -= tokens_to_mint;
    bonding_curve.real_sol_reserves += trade_amount;
    bonding_curve.token_total_supply += tokens_to_mint;

    // Check for graduation
    if bonding_curve.real_sol_reserves >= GRADUATION_THRESHOLD {
        bonding_curve.graduated = true;
        msg!("Token graduated to DEX!");
    }

    // Save updated state
    bonding_curve.pack_into_slice(&mut bonding_curve_account.try_borrow_mut_data()?);

    msg!("Buy transaction completed: {} tokens minted for {} SOL", tokens_to_mint, sol_amount);
    Ok(())
}

/// Sell tokens using bonding curve
fn sell_tokens(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    token_amount: u64,
    min_sol_received: u64,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let seller_account = next_account_info(account_info_iter)?;
    let bonding_curve_account = next_account_info(account_info_iter)?;
    let mint_account = next_account_info(account_info_iter)?;
    let seller_token_account = next_account_info(account_info_iter)?;
    let platform_fee_account = next_account_info(account_info_iter)?;
    let bonding_curve_vault = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;

    // Verify seller is signer
    if !seller_account.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Load bonding curve state
    let mut bonding_curve = BondingCurve::unpack_from_slice(&bonding_curve_account.try_borrow_data()?)?;

    // Verify bonding curve hasn't graduated
    if bonding_curve.graduated {
        return Err(ProgramError::Custom(1)); // Already graduated
    }

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
    if seller_receives < min_sol_received {
        return Err(ProgramError::Custom(2)); // Slippage tolerance exceeded
    }

    // Burn tokens from seller (simplified - in full implementation, use SPL token burn instruction)
    // This would require proper token program integration

    // Transfer SOL from vault to seller
    invoke_signed(
        &system_instruction::transfer(bonding_curve_vault.key, seller_account.key, seller_receives),
        &[bonding_curve_vault.clone(), seller_account.clone()],
        &[&[b"vault", bonding_curve_account.key.as_ref(), &[bonding_curve.bump_seed]]],
    )?;

    // Transfer platform fee
    if platform_fee > 0 {
        invoke_signed(
            &system_instruction::transfer(bonding_curve_vault.key, platform_fee_account.key, platform_fee),
            &[bonding_curve_vault.clone(), platform_fee_account.clone()],
            &[&[b"vault", bonding_curve_account.key.as_ref(), &[bonding_curve.bump_seed]]],
        )?;
    }

    // Update bonding curve state
    bonding_curve.virtual_token_reserves += token_amount;
    bonding_curve.virtual_sol_reserves -= sol_out;
    bonding_curve.real_sol_reserves -= sol_out;
    bonding_curve.token_total_supply -= token_amount;

    // Save updated state
    bonding_curve.pack_into_slice(&mut bonding_curve_account.try_borrow_mut_data()?);

    msg!("Sell transaction completed: {} tokens sold for {} SOL", token_amount, seller_receives);
    Ok(())
}

/// Calculate tokens out for given SOL input (constant product formula)
fn calculate_tokens_out(
    sol_in: u64,
    sol_reserves: u64,
    token_reserves: u64,
) -> Result<u64, ProgramError> {
    if sol_reserves == 0 || token_reserves == 0 {
        return Err(ProgramError::Custom(3)); // Invalid reserves
    }

    // Using constant product formula: (sol_reserves + sol_in) * (token_reserves - tokens_out) = k
    // Where k = sol_reserves * token_reserves
    let k = (sol_reserves as u128) * (token_reserves as u128);
    let new_sol_reserves = sol_reserves + sol_in;
    let new_token_reserves = k / (new_sol_reserves as u128);
    let tokens_out = token_reserves - (new_token_reserves as u64);

    Ok(tokens_out)
}

/// Calculate SOL out for given token input (constant product formula)
fn calculate_sol_out(
    token_in: u64,
    token_reserves: u64,
    sol_reserves: u64,
) -> Result<u64, ProgramError> {
    if sol_reserves == 0 || token_reserves == 0 {
        return Err(ProgramError::Custom(3)); // Invalid reserves
    }

    // Using constant product formula: (token_reserves + token_in) * (sol_reserves - sol_out) = k
    let k = (sol_reserves as u128) * (token_reserves as u128);
    let new_token_reserves = token_reserves + token_in;
    let new_sol_reserves = k / (new_token_reserves as u128);
    let sol_out = sol_reserves - (new_sol_reserves as u64);

    Ok(sol_out)
}