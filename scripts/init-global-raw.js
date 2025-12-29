/**
 * Initialize Global Configuration - Raw Transaction Version
 * Works without needing the IDL or Anchor build
 */

const {
  Connection,
  PublicKey,
  Keypair,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} = require("@solana/web3.js");
const fs = require("fs");
const os = require("os");
const path = require("path");

// Instruction discriminators (first 8 bytes of instruction data)
// These are computed from the instruction name using Anchor's discriminator derivation
const INITIALIZE_GLOBAL_DISCRIMINATOR = Buffer.from([
  0x2f, 0xe1, 0x0f, 0x70, 0x56, 0x33, 0xbe, 0xe7, // sha256("global:initialize_global")[0..8]
]);

async function main() {
  // Setup connection
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");

  // Load wallet
  const walletPath = path.join(os.homedir(), ".config", "solana", "id.json");
  const walletKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "utf-8")))
  );

  const programId = new PublicKey("Cxiw2xXiCCNywNS6qH1mPH81yaVkG8jhu7x6ma7oTK9M");

  console.log("\n🔧 Initializing Global Configuration");
  console.log("====================================");
  console.log("Program ID:", programId.toString());
  console.log("Authority:", walletKeypair.publicKey.toString());
  console.log("");

  // Derive global PDA
  const [globalPda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("global")],
    programId
  );

  console.log("Global PDA:", globalPda.toString());
  console.log("Bump:", bump);
  console.log("");

  // Check if already initialized
  try {
    const accountInfo = await connection.getAccountInfo(globalPda);
    if (accountInfo && accountInfo.data.length > 0) {
      console.log("⚠️  Global configuration already initialized!");
      console.log("Account data length:", accountInfo.data.length);
      console.log("");
      console.log("View on Solana Explorer:");
      console.log(`https://explorer.solana.com/address/${globalPda.toString()}?cluster=devnet`);
      console.log("");
      return;
    }
  } catch (e) {
    // Not initialized, continue
  }

  console.log("Creating initialization transaction...");
  console.log("");

  // Fee basis points: 100 (1%)
  const feeBasisPoints = 100;
  const feeBasisPointsBuffer = Buffer.alloc(2);
  feeBasisPointsBuffer.writeUInt16LE(feeBasisPoints);

  // Build instruction data
  const instructionData = Buffer.concat([
    INITIALIZE_GLOBAL_DISCRIMINATOR,
    feeBasisPointsBuffer,
  ]);

  // Build instruction
  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: globalPda, isSigner: false, isWritable: true },
      { pubkey: walletKeypair.publicKey, isSigner: true, isWritable: true },
      { pubkey: walletKeypair.publicKey, isSigner: false, isWritable: false }, // fee_recipient
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId,
    data: instructionData,
  });

  // Create and send transaction
  const transaction = new Transaction().add(instruction);

  console.log("Sending transaction...");
  console.log("  → Fee: 1% (100 basis points)");
  console.log("  → Parameters: pump.fun standard");
  console.log("");

  try {
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [walletKeypair],
      {
        commitment: "confirmed",
        preflightCommitment: "confirmed",
      }
    );

    console.log("✅ Global configuration initialized successfully!");
    console.log("Transaction signature:", signature);
    console.log("");
    console.log("View transaction:");
    console.log(`https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    console.log("");
    console.log("View global account:");
    console.log(`https://explorer.solana.com/address/${globalPda.toString()}?cluster=devnet`);
    console.log("");

    console.log("🎉 Success! You can now create tokens with bonding curves.");
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
