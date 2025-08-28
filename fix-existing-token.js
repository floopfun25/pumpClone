/**
 * Transfer mint authority for the newly created token
 * Run this in browser console on token detail page
 */

async function transferMintAuthority() {
  try {
    console.log("🔧 Transferring mint authority for token HGibjAgJG7HSrPLjrMdporoFt9rJ9MMna7o2u9KLWc8b...");
    
    // Import required modules
    const { PublicKey, Transaction, Connection } = require("@solana/web3.js");
    const { createSetAuthorityInstruction, AuthorityType } = require("@solana/spl-token");
    
    // Token and program details
    const mintAddress = new PublicKey("HGibjAgJG7HSrPLjrMdporoFt9rJ9MMna7o2u9KLWc8b");
    const BONDING_CURVE_PROGRAM_ID = new PublicKey("Hg4PXsCRaVRjeYgx75GJioGqCQ6GiGWGGHTnpcTLE9CY");
    
    // Get bonding curve PDA
    const [bondingCurvePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("bonding_curve"), mintAddress.toBuffer()],
      BONDING_CURVE_PROGRAM_ID,
    );
    
    console.log("🎯 Bonding curve PDA:", bondingCurvePDA.toBase58());
    
    // This script needs to be run in browser console with connected wallet
    if (typeof window === 'undefined') {
      throw new Error("This script must be run in browser console on token detail page with wallet connected");
    }
    
    // Get wallet from global window
    const wallet = window.solana;
    if (!wallet?.isConnected) {
      throw new Error("Wallet not connected");
    }
    
    console.log("👛 Current wallet:", wallet.publicKey.toBase58());
    
    // Create transaction to transfer mint authority
    const transaction = new Transaction();
    transaction.add(
      createSetAuthorityInstruction(
        mintAddress,
        wallet.publicKey, // Current authority (your wallet)
        AuthorityType.MintTokens,
        bondingCurvePDA, // New authority (bonding curve)
      )
    );
    
    // Sign and send transaction
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");
    
    transaction.feePayer = wallet.publicKey;
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    
    const signedTransaction = await wallet.signTransaction(transaction);
    const signature = await connection.sendRawTransaction(signedTransaction.serialize());
    await connection.confirmTransaction(signature);
    
    console.log("✅ Mint authority transferred successfully!");
    console.log("📝 Signature:", signature);
    console.log("🎯 New mint authority:", bondingCurvePDA.toBase58());
    console.log("💡 You can now try buying tokens!");
    
    return signature;
    
  } catch (error) {
    console.error("❌ Failed to transfer mint authority:", error);
    throw error;
  }
}

// Run the function
transferMintAuthority();