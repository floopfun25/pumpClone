use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program::invoke,
    program_error::ProgramError,
    pubkey::Pubkey,
    rent::Rent,
    sysvar::Sysvar,
    system_instruction,
    program_pack::{Pack, Sealed},
};
use borsh::{BorshDeserialize, BorshSerialize};
use std::mem;

// Program entrypoint
entrypoint!(process_instruction);

// Instruction types
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub enum BondingCurveInstruction {
    /// Initialize a new bonding curve
    /// Accounts:
    /// 0. [writable, signer] Creator account
    /// 1. [writable] Bonding curve account
    /// 2. [] Token mint account
    /// 3. [] System program
    Initialize {
        initial_virtual_token_reserves: u64,
        initial_virtual_sol_reserves: u64,
    },
    
    /// Buy tokens from the bonding curve
    /// Accounts:
    /// 0. [writable, signer] Buyer account
    /// 1. [writable] Bonding curve account
    /// 2. [writable] Token mint account
    /// 3. [writable] Buyer token account
    /// 4. [writable] Platform fee account
    /// 5. [] Token program
    /// 6. [] System program
    Buy {
        sol_amount: u64,
        min_tokens_received: u64,
        max_slippage_bps: u16,
    },
    
    /// Sell tokens to the bonding curve
    /// Accounts:
    /// 0. [writable, signer] Seller account
    /// 1. [writable] Bonding curve account
    /// 2. [] Token mint account
    /// 3. [writable] Seller token account
    /// 4. [writable] Platform fee account
    /// 5. [] Token program
    /// 6. [] System program
    Sell {
        token_amount: u64,
        min_sol_received: u64,
        max_slippage_bps: u16,
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
const DISCRIMINATOR: [u8; 8] = [1, 2, 3, 4, 5, 6, 7, 8]; // Bonding curve discriminator
const PLATFORM_FEE_BPS: u16 = 100; // 1% platform fee
const GRADUATION_THRESHOLD: u64 = 69_000_000_000; // 69 SOL in lamports

// Main program instruction processor
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
        } => process_initialize(
            program_id,
            accounts,
            initial_virtual_token_reserves,
            initial_virtual_sol_reserves,
        ),
        BondingCurveInstruction::Buy {
            sol_amount,
            min_tokens_received,
            max_slippage_bps,
        } => process_buy(
            program_id,
            accounts,
            sol_amount,
            min_tokens_received,
            max_slippage_bps,
        ),
        BondingCurveInstruction::Sell {
            token_amount,
            min_sol_received,
            max_slippage_bps,
        } => process_sell(
            program_id,
            accounts,
            token_amount,
            min_sol_received,
            max_slippage_bps,
        ),
    }
}

// Initialize bonding curve
fn process_initialize(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    initial_virtual_token_reserves: u64,
    initial_virtual_sol_reserves: u64,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let creator_info = next_account_info(account_info_iter)?;
    let bonding_curve_info = next_account_info(account_info_iter)?;
    let mint_info = next_account_info(account_info_iter)?;
    let system_program_info = next_account_info(account_info_iter)?;

    // Verify creator is signer
    if !creator_info.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Create bonding curve account
    let rent = Rent::get()?;
    let required_lamports = rent.minimum_balance(BondingCurve::LEN);

    // Derive PDA for bonding curve
    let (bonding_curve_pda, bump_seed) = Pubkey::find_program_address(
        &[b"bonding-curve", mint_info.key.as_ref()],
        program_id,
    );

    if bonding_curve_pda != *bonding_curve_info.key {
        return Err(ProgramError::InvalidSeeds);
    }

    // Create bonding curve account
    invoke(
        &system_instruction::create_account(
            creator_info.key,
            bonding_curve_info.key,
            required_lamports,
            BondingCurve::LEN as u64,
            program_id,
        ),
        &[
            creator_info.clone(),
            bonding_curve_info.clone(),
            system_program_info.clone(),
        ],
    )?;

    // Initialize bonding curve data
    let bonding_curve = BondingCurve {
        discriminator: DISCRIMINATOR,
        mint_address: *mint_info.key,
        creator: *creator_info.key,
        virtual_token_reserves: initial_virtual_token_reserves,
        virtual_sol_reserves: initial_virtual_sol_reserves,
        real_token_reserves: initial_virtual_token_reserves,
        real_sol_reserves: 0,
        token_total_supply: 1_000_000_000_000_000_000, // 1B tokens with 9 decimals
        graduated: false,
        created_at: solana_program::clock::Clock::get()?.unix_timestamp,
        bump_seed,
    };

    bonding_curve.pack_into_slice(&mut bonding_curve_info.data.borrow_mut());

    msg!("Bonding curve initialized for mint: {}", mint_info.key);
    Ok(())
}

// Buy tokens
fn process_buy(
    _program_id: &Pubkey,
    accounts: &[AccountInfo],
    sol_amount: u64,
    min_tokens_received: u64,
    _max_slippage_bps: u16,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let buyer_info = next_account_info(account_info_iter)?;
    let bonding_curve_info = next_account_info(account_info_iter)?;
    let _mint_info = next_account_info(account_info_iter)?;
    let _buyer_token_info = next_account_info(account_info_iter)?;
    let platform_fee_info = next_account_info(account_info_iter)?;

    // Verify buyer is signer
    if !buyer_info.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Load bonding curve
    let mut bonding_curve = BondingCurve::unpack_from_slice(&bonding_curve_info.data.borrow())?;

    // Check if graduated
    if bonding_curve.graduated {
        return Err(ProgramError::Custom(1)); // Custom error: Already graduated
    }

    // Calculate tokens to receive using constant product formula
    let k = bonding_curve.virtual_sol_reserves * bonding_curve.virtual_token_reserves;
    let new_sol_reserves = bonding_curve.virtual_sol_reserves + sol_amount;
    let new_token_reserves = k / new_sol_reserves;
    let tokens_out = bonding_curve.virtual_token_reserves - new_token_reserves;

    // Check slippage
    if tokens_out < min_tokens_received {
        return Err(ProgramError::Custom(2)); // Custom error: Slippage too high
    }

    // Calculate platform fee
    let platform_fee = (sol_amount * PLATFORM_FEE_BPS as u64) / 10_000;
    let sol_after_fee = sol_amount - platform_fee;

    // Transfer SOL from buyer to platform fee account
    invoke(
        &system_instruction::transfer(buyer_info.key, platform_fee_info.key, platform_fee),
        &[buyer_info.clone(), platform_fee_info.clone()],
    )?;

    // Update bonding curve state
    bonding_curve.virtual_sol_reserves = new_sol_reserves;
    bonding_curve.virtual_token_reserves = new_token_reserves;
    bonding_curve.real_sol_reserves += sol_after_fee;

    // Check graduation
    if bonding_curve.real_sol_reserves >= GRADUATION_THRESHOLD {
        bonding_curve.graduated = true;
        msg!("Token graduated! Creating DEX liquidity...");
    }

    bonding_curve.pack_into_slice(&mut bonding_curve_info.data.borrow_mut());

    msg!("Buy completed: {} SOL for {} tokens", sol_amount, tokens_out);
    Ok(())
}

// Sell tokens
fn process_sell(
    _program_id: &Pubkey,
    accounts: &[AccountInfo],
    token_amount: u64,
    min_sol_received: u64,
    _max_slippage_bps: u16,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let seller_info = next_account_info(account_info_iter)?;
    let bonding_curve_info = next_account_info(account_info_iter)?;
    let _mint_info = next_account_info(account_info_iter)?;
    let _seller_token_info = next_account_info(account_info_iter)?;
    let platform_fee_info = next_account_info(account_info_iter)?;

    // Verify seller is signer
    if !seller_info.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Load bonding curve
    let mut bonding_curve = BondingCurve::unpack_from_slice(&bonding_curve_info.data.borrow())?;

    // Check if graduated
    if bonding_curve.graduated {
        return Err(ProgramError::Custom(1)); // Custom error: Already graduated
    }

    // Calculate SOL to receive using constant product formula
    let k = bonding_curve.virtual_sol_reserves * bonding_curve.virtual_token_reserves;
    let new_token_reserves = bonding_curve.virtual_token_reserves + token_amount;
    let new_sol_reserves = k / new_token_reserves;
    let sol_out = bonding_curve.virtual_sol_reserves - new_sol_reserves;

    // Check slippage
    if sol_out < min_sol_received {
        return Err(ProgramError::Custom(2)); // Custom error: Slippage too high
    }

    // Calculate platform fee
    let platform_fee = (sol_out * PLATFORM_FEE_BPS as u64) / 10_000;
    let sol_after_fee = sol_out - platform_fee;

    // Transfer SOL to platform fee account
    invoke(
        &system_instruction::transfer(seller_info.key, platform_fee_info.key, platform_fee),
        &[seller_info.clone(), platform_fee_info.clone()],
    )?;

    // Update bonding curve state
    bonding_curve.virtual_sol_reserves = new_sol_reserves;
    bonding_curve.virtual_token_reserves = new_token_reserves;
    bonding_curve.real_sol_reserves -= sol_after_fee;

    bonding_curve.pack_into_slice(&mut bonding_curve_info.data.borrow_mut());

    msg!("Sell completed: {} tokens for {} SOL", token_amount, sol_out);
    Ok(())
} 