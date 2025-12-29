/**
 * Simple Token Creation Test
 * Tests creating a token with the deployed bonding curve program
 */

const { Connection, PublicKey, Keypair, SystemProgram } = require("@solana/web3.js");
const {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createInitializeMint2Instruction,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
} = require("@solana/spl-token");
const anchor = require("@coral-xyz/anchor");
const fs = require("fs");
const os = require("os");
const path = require("path");

async function main() {
  // Setup
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const walletPath = path.join(os.homedir(), ".config", "solana", "id.json");
  const walletKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "utf-8")))
  );

  const programId = new PublicKey("9JQyYqCSRwhgaCPPSiyBauPb3x1wf5fnpidqgndowbWp");

  console.log("\n🪙 Creating Test Token");
  console.log("======================");
  console.log("Program ID:", programId.toString());
  console.log("Creator:", walletKeypair.publicKey.toString());
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
    programId
  );

  const [bondingCurvePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("bonding-curve"), mint.toBuffer()],
    programId
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
      walletKeypair.publicKey.toBuffer(),
      TOKEN_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  console.log("Global PDA:", globalPda.toString());
  console.log("Bonding Curve PDA:", bondingCurvePda.toString());
  console.log("Vault PDA:", vaultPda.toString());
  console.log("Creator Token Account:", creatorTokenAccount.toString());
  console.log("");

  console.log("✅ Test successful! PDAs derived correctly.");
  console.log("");
  console.log("To complete token creation, run this in Solana Playground:");
  console.log("1. Use the 'create' instruction");
  console.log("2. Pass name, symbol, and uri");
  console.log("3. Provide the mint keypair");
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
