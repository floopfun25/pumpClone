/**
 * Initialize Global Configuration
 * Simple JS version without TypeScript dependencies
 */

const anchor = require("@coral-xyz/anchor");
const { PublicKey, SystemProgram } = require("@solana/web3.js");

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const programId = new PublicKey("Cxiw2xXiCCNywNS6qH1mPH81yaVkG8jhu7x6ma7oTK9M");

  // Load production IDL
  const idl = require("../target/idl/bonding_curve_production.json");
  const program = new anchor.Program(idl, programId.toString(), provider);

  console.log("\n🔧 Initializing Global Configuration");
  console.log("====================================");
  console.log("Program ID:", programId.toString());
  console.log("Authority:", provider.wallet.publicKey.toString());
  console.log("");

  // Derive global PDA
  const [globalPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("global")],
    programId
  );

  console.log("Global PDA:", globalPda.toString());
  console.log("");

  try {
    // Check if already initialized
    try {
      const globalAccount = await program.account.global.fetch(globalPda);
      console.log("⚠️  Global configuration already initialized!");
      console.log("");
      console.log("Current Configuration:");
      console.log("=====================");
      console.log("Authority:", globalAccount.authority.toString());
      console.log("Fee Recipient:", globalAccount.feeRecipient.toString());
      console.log("Fee Basis Points:", globalAccount.feeBasisPoints);
      console.log("");
      console.log("Virtual Token Reserves:", globalAccount.initialVirtualTokenReserves.toString());
      console.log("Virtual SOL Reserves:", globalAccount.initialVirtualSolReserves.toString());
      console.log("Real Token Reserves:", globalAccount.initialRealTokenReserves.toString());
      console.log("Token Total Supply:", globalAccount.tokenTotalSupply.toString());
      console.log("Creator Allocation:", globalAccount.creatorAllocation.toString());
      console.log("");
      return;
    } catch (e) {
      // Not initialized, continue
    }

    console.log("Initializing with pump.fun parameters...");
    console.log("  → 1% fee (100 basis points)");
    console.log("  → 1.073B virtual token reserves");
    console.log("  → 30 SOL virtual reserves");
    console.log("  → 793.1M real token reserves");
    console.log("  → 206.9M creator allocation");
    console.log("");

    const tx = await program.methods
      .initializeGlobal(100) // 1% fee
      .accounts({
        global: globalPda,
        authority: provider.wallet.publicKey,
        feeRecipient: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("✅ Global configuration initialized successfully!");
    console.log("Transaction signature:", tx);
    console.log("");

    // Fetch and display the initialized state
    const globalAccount = await program.account.global.fetch(globalPda);

    console.log("Initialized Configuration:");
    console.log("=========================");
    console.log("Authority:", globalAccount.authority.toString());
    console.log("Fee Recipient:", globalAccount.feeRecipient.toString());
    console.log("Fee Basis Points:", globalAccount.feeBasisPoints);
    console.log("");
    console.log("Virtual Token Reserves:", globalAccount.initialVirtualTokenReserves.toString());
    console.log("  → Used for price calculation");
    console.log("Virtual SOL Reserves:", globalAccount.initialVirtualSolReserves.toString());
    console.log("  → Used for price calculation");
    console.log("");
    console.log("Real Token Reserves:", globalAccount.initialRealTokenReserves.toString());
    console.log("  → Actual tokens available for trading");
    console.log("Token Total Supply:", globalAccount.tokenTotalSupply.toString());
    console.log("  → 1 billion total");
    console.log("Creator Allocation:", globalAccount.creatorAllocation.toString());
    console.log("  → Allocated to token creator");
    console.log("");

    console.log("🎉 Success! You can now create tokens with bonding curves.");
    console.log("");
    console.log("Next steps:");
    console.log("1. Run: node scripts/test-create-token.js");
    console.log("2. View on Solana Explorer:");
    console.log(`   https://explorer.solana.com/address/${globalPda.toString()}?cluster=devnet`);
    console.log("");

  } catch (error) {
    console.error("❌ Error initializing global configuration:");
    console.error(error);

    if (error.logs) {
      console.log("\nProgram logs:");
      error.logs.forEach((log) => console.log(log));
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
