import { Connection, PublicKey, Transaction, SystemProgram } from "@solana/web3.js";
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { BorshCoder, Program } from "@coral-xyz/anchor";
import { getWalletService } from "./wallet";
import { config } from "@/config";
import { bondingCurveProgram } from "./bondingCurveProgram";

/**
 * Vesting Service - Handles token lock/vesting functionality
 */
export class VestingService {
  private connection: Connection;
  private walletService = getWalletService();
  private programId: PublicKey;

  constructor() {
    this.connection = new Connection(config.solana.rpcUrl, "confirmed");
    this.programId = new PublicKey(config.programs.bondingCurve);
  }

  /**
   * Initialize a vesting schedule for creator tokens
   *
   * @param mintAddress - Token mint address
   * @param totalAmount - Total tokens to vest (in base units)
   * @param durationDays - Vesting duration in days
   * @param cliffDays - Cliff period in days (tokens unlock after this)
   */
  async initializeVesting(
    mintAddress: PublicKey,
    totalAmount: bigint,
    durationDays: number,
    cliffDays: number = 0
  ): Promise<string> {
    if (!this.walletService.connected || !this.walletService.publicKey) {
      throw new Error("Wallet not connected");
    }

    const beneficiary = this.walletService.publicKey;
    const mint = new PublicKey(mintAddress);

    // Calculate time parameters
    const now = Math.floor(Date.now() / 1000);
    const startTime = now;
    const endTime = now + durationDays * 24 * 60 * 60;
    const cliffTime = now + cliffDays * 24 * 60 * 60;

    console.log(`🔒 Initializing vesting schedule:`);
    console.log(`  - Total amount: ${totalAmount}`);
    console.log(`  - Duration: ${durationDays} days`);
    console.log(`  - Cliff: ${cliffDays} days`);

    try {
      // Derive vesting schedule PDA
      const [vestingSchedulePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vesting"), mint.toBuffer(), beneficiary.toBuffer()],
        this.programId
      );

      // Derive vesting vault address
      const vestingVault = await getAssociatedTokenAddress(
        mint,
        vestingSchedulePda,
        true // allowOwnerOffCurve
      );

      // Build instruction data
      const instructionData = this.encodeInitializeVestingInstruction(
        totalAmount,
        BigInt(startTime),
        BigInt(endTime),
        BigInt(cliffTime)
      );

      // Create transaction
      const transaction = new Transaction();

      // Add initialize vesting instruction
      transaction.add({
        keys: [
          { pubkey: beneficiary, isSigner: true, isWritable: true },
          { pubkey: vestingSchedulePda, isSigner: false, isWritable: true },
          { pubkey: mint, isSigner: false, isWritable: false },
          { pubkey: vestingVault, isSigner: false, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
          {
            pubkey: new PublicKey("SysvarRent111111111111111111111111111111111"),
            isSigner: false,
            isWritable: false,
          },
        ],
        programId: this.programId,
        data: instructionData,
      });

      // Send transaction
      transaction.feePayer = beneficiary;
      transaction.recentBlockhash = (
        await this.connection.getLatestBlockhash()
      ).blockhash;

      const signedTransaction = await this.walletService.signTransaction(transaction);
      const signature = await this.connection.sendRawTransaction(
        signedTransaction.serialize()
      );
      await this.connection.confirmTransaction(signature, "confirmed");

      console.log("✅ Vesting schedule initialized:", signature);
      return signature;
    } catch (error) {
      console.error("❌ Failed to initialize vesting:", error);
      throw error;
    }
  }

  /**
   * Claim vested tokens
   *
   * @param mintAddress - Token mint address
   */
  async claimVestedTokens(mintAddress: PublicKey): Promise<{
    signature: string;
    claimedAmount: bigint;
  }> {
    if (!this.walletService.connected || !this.walletService.publicKey) {
      throw new Error("Wallet not connected");
    }

    const beneficiary = this.walletService.publicKey;
    const mint = new PublicKey(mintAddress);

    console.log(`💰 Claiming vested tokens for ${mintAddress.toBase58()}`);

    try {
      // Derive vesting schedule PDA
      const [vestingSchedulePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vesting"), mint.toBuffer(), beneficiary.toBuffer()],
        this.programId
      );

      // Get vesting vault and beneficiary token account
      const vestingVault = await getAssociatedTokenAddress(
        mint,
        vestingSchedulePda,
        true
      );
      const beneficiaryTokenAccount = await getAssociatedTokenAddress(
        mint,
        beneficiary
      );

      // Get vesting state to calculate claimable amount
      const vestingState = await this.getVestingSchedule(mintAddress);
      if (!vestingState) {
        throw new Error("Vesting schedule not found");
      }

      const claimableAmount = this.calculateClaimableAmount(vestingState);
      if (claimableAmount === 0n) {
        throw new Error("No tokens available to claim yet");
      }

      // Build instruction data
      const instructionData = this.encodeClaimVestedTokensInstruction();

      // Create transaction
      const transaction = new Transaction();
      transaction.add({
        keys: [
          { pubkey: beneficiary, isSigner: true, isWritable: true },
          { pubkey: vestingSchedulePda, isSigner: false, isWritable: true },
          { pubkey: vestingVault, isSigner: false, isWritable: true },
          {
            pubkey: beneficiaryTokenAccount,
            isSigner: false,
            isWritable: true,
          },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        programId: this.programId,
        data: instructionData,
      });

      // Send transaction
      transaction.feePayer = beneficiary;
      transaction.recentBlockhash = (
        await this.connection.getLatestBlockhash()
      ).blockhash;

      const signedTransaction = await this.walletService.signTransaction(transaction);
      const signature = await this.connection.sendRawTransaction(
        signedTransaction.serialize()
      );
      await this.connection.confirmTransaction(signature, "confirmed");

      console.log(`✅ Claimed ${claimableAmount} vested tokens:`, signature);

      return {
        signature,
        claimedAmount: claimableAmount,
      };
    } catch (error) {
      console.error("❌ Failed to claim vested tokens:", error);
      throw error;
    }
  }

  /**
   * Get vesting schedule state
   */
  async getVestingSchedule(mintAddress: PublicKey): Promise<VestingSchedule | null> {
    if (!this.walletService.publicKey) {
      return null;
    }

    const beneficiary = this.walletService.publicKey;
    const mint = new PublicKey(mintAddress);

    const [vestingSchedulePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vesting"), mint.toBuffer(), beneficiary.toBuffer()],
      this.programId
    );

    try {
      const accountInfo = await this.connection.getAccountInfo(vestingSchedulePda);
      if (!accountInfo) {
        return null;
      }

      return this.parseVestingSchedule(accountInfo.data);
    } catch (error) {
      console.error("Failed to fetch vesting schedule:", error);
      return null;
    }
  }

  /**
   * Parse vesting schedule account data
   */
  private parseVestingSchedule(data: Buffer): VestingSchedule {
    // Skip discriminator (8 bytes)
    let offset = 8;

    // Read beneficiary (32 bytes)
    const beneficiary = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;

    // Read mint (32 bytes)
    const mint = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;

    // Read amounts and times (all u64/i64, 8 bytes each)
    const totalAmount = data.readBigUInt64LE(offset);
    offset += 8;
    const releasedAmount = data.readBigUInt64LE(offset);
    offset += 8;
    const startTime = data.readBigInt64LE(offset);
    offset += 8;
    const endTime = data.readBigInt64LE(offset);
    offset += 8;
    const cliffTime = data.readBigInt64LE(offset);

    return {
      beneficiary,
      mint,
      totalAmount,
      releasedAmount,
      startTime,
      endTime,
      cliffTime,
    };
  }

  /**
   * Calculate claimable amount based on current time
   */
  private calculateClaimableAmount(schedule: VestingSchedule): bigint {
    const now = BigInt(Math.floor(Date.now() / 1000));

    // Before cliff, nothing is claimable
    if (now < schedule.cliffTime) {
      return 0n;
    }

    // After end time, all tokens are vested
    if (now >= schedule.endTime) {
      return schedule.totalAmount - schedule.releasedAmount;
    }

    // Linear vesting between start and end
    const timeElapsed = now - schedule.startTime;
    const totalDuration = schedule.endTime - schedule.startTime;

    const vestedAmount =
      (schedule.totalAmount * timeElapsed) / totalDuration;

    const claimableAmount = vestedAmount - schedule.releasedAmount;

    return claimableAmount > 0n ? claimableAmount : 0n;
  }

  /**
   * Encode initialize vesting instruction
   */
  private encodeInitializeVestingInstruction(
    totalAmount: bigint,
    startTime: bigint,
    endTime: bigint,
    cliffTime: bigint
  ): Buffer {
    // Instruction discriminator for initialize_vesting
    // This is derived from the first 8 bytes of SHA256("global:initialize_vesting")
    const discriminator = Buffer.from([0x9a, 0x3c, 0x7e, 0x8f, 0x5d, 0x2a, 0x1b, 0x4c]);

    const data = Buffer.alloc(8 + 8 + 8 + 8 + 8);
    data.set(discriminator, 0);

    // Write total_amount (u64)
    data.writeBigUInt64LE(totalAmount, 8);
    // Write start_time (i64)
    data.writeBigInt64LE(startTime, 16);
    // Write end_time (i64)
    data.writeBigInt64LE(endTime, 24);
    // Write cliff_time (i64)
    data.writeBigInt64LE(cliffTime, 32);

    return data;
  }

  /**
   * Encode claim vested tokens instruction
   */
  private encodeClaimVestedTokensInstruction(): Buffer {
    // Instruction discriminator for claim_vested_tokens
    const discriminator = Buffer.from([0x15, 0xa6, 0x7c, 0x9f, 0x3e, 0xd2, 0x8b, 0x1a]);
    return discriminator;
  }
}

export interface VestingSchedule {
  beneficiary: PublicKey;
  mint: PublicKey;
  totalAmount: bigint;
  releasedAmount: bigint;
  startTime: bigint;
  endTime: bigint;
  cliffTime: bigint;
}

// Export singleton instance
export const vestingService = new VestingService();
