/**
 * Quick script to fix mint authority for existing token
 * Run this in browser console on the token detail page
 */

async function fixMintAuthority() {
  try {
    console.log("🔧 Fixing mint authority for token 4KtMwGeLLzvp8VT28Mg6W8imjAuRnQ9WbYwDrTut3GUG...");
    
    // Import required modules
    const { PublicKey, Transaction } = await import("@solana/web3.js");
    const { createSetAuthorityInstruction, AuthorityType } = await import("@solana/spl-token");
    
    // Token and program details
    const mintAddress = new PublicKey("4KtMwGeLLzvp8VT28Mg6W8imjAuRnQ9WbYwDrTut3GUG");
    const BONDING_CURVE_PROGRAM_ID = new PublicKey("Hg4PXsCRaVRjeYgx75GJioGqCQ6GiGWGGHTnpcTLE9CY");
    
    // Get bonding curve PDA
    const [bondingCurvePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("bonding_curve"), mintAddress.toBuffer()],
      BONDING_CURVE_PROGRAM_ID,
    );
    
    console.log("🎯 Bonding curve PDA:", bondingCurvePDA.toBase58());
    
    // Get wallet service (assume it's available globally)
    const walletService = window.walletService || await import("./src/services/wallet").then(m => m.getWalletService());
    
    if (!walletService?.connected || !walletService?.publicKey) {
      throw new Error("Wallet not connected");
    }
    
    console.log("👛 Current wallet:", walletService.publicKey.toBase58());
    
    // Create transaction to transfer mint authority
    const transaction = new Transaction();
    transaction.add(
      createSetAuthorityInstruction(
        mintAddress,
        walletService.publicKey, // Current authority (your wallet)
        AuthorityType.MintTokens,
        bondingCurvePDA, // New authority (bonding curve)
      )
    );
    
    // Sign and send transaction
    const { Connection } = await import("@solana/web3.js");
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");
    
    transaction.feePayer = walletService.publicKey;
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    
    const signedTransaction = await walletService.signTransaction(transaction);
    const signature = await connection.sendRawTransaction(signedTransaction.serialize());
    await connection.confirmTransaction(signature);
    
    console.log("✅ Mint authority transferred successfully!");
    console.log("📝 Signature:", signature);
    console.log("🎯 New mint authority:", bondingCurvePDA.toBase58());
    console.log("💡 You can now try buying tokens again!");
    
    return signature;
    
  } catch (error) {
    console.error("❌ Failed to transfer mint authority:", error);
    throw error;
  }
}

// Run the function
fixMintAuthority();