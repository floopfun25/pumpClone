/**
 * Transfer mint authority for existing token to bonding curve PDA
 * Copy and paste this code into browser console on token detail page
 * Make sure your wallet is connected first
 */

(async function transferMintAuthority() {
  try {
    console.log("🔧 Transferring mint authority for token HGibjAgJG7HSrPLjrMdporoFt9rJ9MMna7o2u9KLWc8b...");
    
    // Check if we're in browser
    if (typeof window === 'undefined') {
      throw new Error("This script must be run in browser console");
    }

    // Import Solana modules (they should be available from your app)
    const solanaWeb3 = window.solanaWeb3 || await import("https://unpkg.com/@solana/web3.js@1.78.0/lib/index.browser.esm.js");
    const splToken = window.splToken || await import("https://unpkg.com/@solana/spl-token@0.3.8/lib/index.esm.js");
    
    const { PublicKey, Transaction, Connection } = solanaWeb3;
    const { createSetAuthorityInstruction, AuthorityType } = splToken;
    
    // Token and program details
    const mintAddress = new PublicKey("HGibjAgJG7HSrPLjrMdporoFt9rJ9MMna7o2u9KLWc8b");
    const BONDING_CURVE_PROGRAM_ID = new PublicKey("Hg4PXsCRaVRjeYgx75GJioGqCQ6GiGWGGHTnpcTLE9CY");
    
    // Get bonding curve PDA
    const [bondingCurvePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("bonding_curve"), mintAddress.toBuffer()],
      BONDING_CURVE_PROGRAM_ID,
    );
    
    console.log("🎯 Bonding curve PDA:", bondingCurvePDA.toBase58());
    
    // Get wallet
    const wallet = window.solana || window.phantom?.solana;
    if (!wallet?.isConnected) {
      throw new Error("Wallet not connected. Please connect your wallet first.");
    }
    
    console.log("👛 Current wallet:", wallet.publicKey.toBase58());
    
    // Create transaction
    const transaction = new Transaction();
    transaction.add(
      createSetAuthorityInstruction(
        mintAddress,
        wallet.publicKey, // Current authority (your wallet)
        AuthorityType.MintTokens,
        bondingCurvePDA, // New authority (bonding curve)
      )
    );
    
    // Setup connection
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");
    
    // Prepare transaction
    transaction.feePayer = wallet.publicKey;
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    // Sign and send
    console.log("🔐 Signing transaction...");
    const signedTransaction = await wallet.signTransaction(transaction);
    
    console.log("📤 Sending transaction...");
    const signature = await connection.sendRawTransaction(signedTransaction.serialize());
    
    console.log("⏳ Confirming transaction...");
    await connection.confirmTransaction(signature, "confirmed");
    
    console.log("✅ Mint authority transferred successfully!");
    console.log("📝 Signature:", signature);
    console.log("🎯 New mint authority:", bondingCurvePDA.toBase58());
    console.log("💡 You can now try buying tokens!");
    
    return {
      signature,
      bondingCurvePDA: bondingCurvePDA.toBase58(),
      mintAddress: mintAddress.toBase58()
    };
    
  } catch (error) {
    console.error("❌ Failed to transfer mint authority:", error);
    throw error;
  }
})();