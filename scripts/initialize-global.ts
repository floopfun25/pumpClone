/**
 * Initialize Global Configuration for Bonding Curve Program
 *
 * This script must be run ONCE before any token creation.
 * It sets up the global singleton PDA with pump.fun parameters.
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { BondingCurve } from "../target/types/bonding_curve";

async function main() {
  // Setup provider (uses Anchor.toml configuration)
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.BondingCurve as Program<BondingCurve>;

  // === CONFIGURATION (UPDATE THESE) ===
  const authority = provider.wallet.publicKey;

  // TODO: Replace with your actual fee collection wallet
  const feeRecipient = new PublicKey("J3X42Cu4XAFHjbLYVjDCYXwigegrZkyfDZUtTMxedqkZ");

  // Migration authority (can trigger migrations if needed)
  const migrationAuthority = authority; // Same as authority for now

  // Platform fee: 100 basis points = 1%
  const feeBasisPoints = 100;

  console.log("\n🚀 Initializing Global Configuration");
  console.log("=====================================");
  console.log("Program ID:", program.programId.toString());
  console.log("Authority:", authority.toString());
  console.log("Fee Recipient:", feeRecipient.toString());
  console.log("Migration Authority:", migrationAuthority.toString());
  console.log("Fee:", feeBasisPoints, "bps (", feeBasisPoints / 100, "%)");
  console.log("");

  // Derive global PDA
  const [globalPda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("global")],
    program.programId
  );

  console.log("Global PDA:", globalPda.toString());
  console.log("Bump:", bump);
  console.log("");

  // Check if already initialized
  try {
    const existingGlobal = await program.account.global.fetch(globalPda);
    console.log("⚠️  Global configuration already exists!");
    console.log("");
    console.log("Existing configuration:");
    console.log("- Authority:", existingGlobal.authority.toString());
    console.log("- Fee Recipient:", existingGlobal.feeRecipient.toString());
    console.log("- Fee (bps):", existingGlobal.feeBasisPoints);
    console.log("- Paused:", existingGlobal.paused);
    console.log("");
    console.log("Use update_global instruction to modify configuration.");
    return;
  } catch (e) {
    // Global doesn't exist, proceed with initialization
    console.log("✓ Global not initialized yet, proceeding...");
    console.log("");
  }

  try {
    console.log("Sending transaction...");

    const tx = await program.methods
      .initializeGlobal(feeBasisPoints)
      .accounts({
        global: globalPda,
        authority: authority,
        feeRecipient: feeRecipient,
        migrationAuthority: migrationAuthority,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log("✅ Global configuration initialized!");
    console.log("Transaction signature:", tx);
    console.log("");

    // Fetch and display configuration
    const globalAccount = await program.account.global.fetch(globalPda);

    console.log("Pump.fun Parameters:");
    console.log("====================");
    console.log("Virtual Token Reserves:", globalAccount.initialVirtualTokenReserves.toString());
    console.log("  → Human: 1.073B tokens");
    console.log("");
    console.log("Virtual SOL Reserves:", globalAccount.initialVirtualSolReserves.toString());
    console.log("  → Human: 30 SOL");
    console.log("");
    console.log("Real Token Reserves:", globalAccount.initialRealTokenReserves.toString());
    console.log("  → Human: 793.1M tokens (for bonding curve)");
    console.log("");
    console.log("Creator Allocation:", globalAccount.creatorAllocation.toString());
    console.log("  → Human: 206.9M tokens");
    console.log("");
    console.log("Token Total Supply:", globalAccount.tokenTotalSupply.toString());
    console.log("  → Human: 1B tokens");
    console.log("");
    console.log("Fee (bps):", globalAccount.feeBasisPoints);
    console.log("  → Human:", globalAccount.feeBasisPoints / 100, "%");
    console.log("");
    console.log("Paused:", globalAccount.paused);
    console.log("");

    console.log("🎉 Setup complete! You can now create tokens.");
    console.log("");
    console.log("Next steps:");
    console.log("1. Run `ts-node scripts/test-create-token.ts` to test token creation");
    console.log("2. Integrate with your frontend");
    console.log("3. Deploy frontend and backend");

  } catch (error: any) {
    console.error("❌ Error initializing global configuration:");
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
