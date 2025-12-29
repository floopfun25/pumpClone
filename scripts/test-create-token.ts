/**
 * Test Token Creation
 *
 * Creates a test token with bonding curve to verify the program works.
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createInitializeMint2Instruction,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
} from "@solana/spl-token";
import { BondingCurve } from "../target/types/bonding_curve";

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.BondingCurve as Program<BondingCurve>;

  console.log("\n🪙 Creating Test Token");
  console.log("======================");
  console.log("Program ID:", program.programId.toString());
  console.log("Creator:", provider.wallet.publicKey.toString());
  console.log("");

  // Token metadata
  const name = "Test Pump Token";
  const symbol = "TEST";
  const uri = "https://example.com/test-token-metadata.json";

  // Create new mint
  const mintKeypair = Keypair.generate();
  const mint = mintKeypair.publicKey;

  console.log("Mint address:", mint.toString());
  console.log("");

  // Derive PDAs
  const [globalPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("global")],
    program.programId
  );

  const [bondingCurvePda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("bonding-curve"), mint.toBuffer()],
    program.programId
  );

  const [vaultPda] = PublicKey.findProgramAddressSync(
    [
      bondingCurvePda.toBuffer(),
      TOKEN_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const [creatorTokenAccount] = PublicKey.findProgramAddressSync(
    [
      provider.wallet.publicKey.toBuffer(),
      TOKEN_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  console.log("Bonding Curve PDA:", bondingCurvePda.toString());
  console.log("Vault PDA:", vaultPda.toString());
  console.log("Creator Token Account:", creatorTokenAccount.toString());
  console.log("");

  try {
    // Get rent for mint account
    const lamports = await getMinimumBalanceForRentExemptMint(provider.connection);

    // Create mint instruction
    const createMintIx = SystemProgram.createAccount({
      fromPubkey: provider.wallet.publicKey,
      newAccountPubkey: mint,
      space: MINT_SIZE,
      lamports,
      programId: TOKEN_PROGRAM_ID,
    });

    const initMintIx = createInitializeMint2Instruction(
      mint,
      6, // decimals
      provider.wallet.publicKey, // mint authority (will be transferred to bonding curve)
      null, // freeze authority
      TOKEN_PROGRAM_ID
    );

    console.log("Creating token with bonding curve...");

    const tx = await program.methods
      .create(name, symbol, uri)
      .accounts({
        global: globalPda,
        bondingCurve: bondingCurvePda,
        creator: provider.wallet.publicKey,
        mint: mint,
        vault: vaultPda,
        creatorTokenAccount: creatorTokenAccount,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .preInstructions([createMintIx, initMintIx])
      .signers([mintKeypair])
      .rpc();

    console.log("✅ Token created successfully!");
    console.log("Transaction signature:", tx);
    console.log("");

    // Fetch bonding curve state
    const bondingCurveAccount = await program.account.bondingCurve.fetch(bondingCurvePda);

    console.log("Bonding Curve State:");
    console.log("====================");
    console.log("Mint:", bondingCurveAccount.mint.toString());
    console.log("Creator:", bondingCurveAccount.creator.toString());
    console.log("");
    console.log("Virtual Token Reserves:", bondingCurveAccount.virtualTokenReserves.toString());
    console.log("Virtual SOL Reserves:", bondingCurveAccount.virtualSolReserves.toString());
    console.log("");
    console.log("Real Token Reserves:", bondingCurveAccount.realTokenReserves.toString());
    console.log("  → Available for trading: 793.1M tokens");
    console.log("Real SOL Reserves:", bondingCurveAccount.realSolReserves.toString());
    console.log("  → SOL collected so far: 0");
    console.log("");
    console.log("Total Supply:", bondingCurveAccount.tokenTotalSupply.toString());
    console.log("Complete:", bondingCurveAccount.complete);
    console.log("Migrated:", bondingCurveAccount.migrated);
    console.log("");

    console.log("🎉 Success!");
    console.log("");
    console.log("Next steps:");
    console.log(`1. Buy tokens: ts-node scripts/test-buy-tokens.ts ${mint.toString()}`);
    console.log("2. Check creator allocation in wallet");
    console.log("3. View on Solana Explorer:");
    console.log(`   https://explorer.solana.com/address/${mint.toString()}?cluster=devnet`);

  } catch (error: any) {
    console.error("❌ Error creating token:");
    console.error(error);

    if (error.logs) {
      console.log("\nProgram logs:");
      error.logs.forEach((log: string) => console.log(log));
    }

    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
