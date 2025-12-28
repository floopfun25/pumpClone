package com.floppfun.service;

import com.floppfun.model.entity.Token;
import com.floppfun.repository.TokenRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import okhttp3.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.math.RoundingMode;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.Base64;
import java.util.List;

/**
 * Service to sync database with on-chain bonding curve state
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BlockchainSyncService {

    private final TokenRepository tokenRepository;
    private final OkHttpClient httpClient = new OkHttpClient();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${floppfun.solana.rpc-url}")
    private String rpcUrl;

    @Value("${floppfun.solana.program-id}")
    private String bondingCurveProgramId;

    private static final long LAMPORTS_PER_SOL = 1_000_000_000L;
    private static final int DECIMALS = 6; // Token decimals (pump.fun standard)

    /**
     * Sync a single token with on-chain state
     */
    @Transactional
    public void syncToken(Token token) {
        try {
            log.debug("Syncing token {} ({})", token.getSymbol(), token.getMintAddress());

            // Get bonding curve account PDA
            String bondingCurvePda = deriveBondingCurvePda(token.getMintAddress());

            // Fetch account data from blockchain
            BondingCurveState state = fetchBondingCurveState(bondingCurvePda);

            if (state == null) {
                log.warn("Bonding curve account not found for token {}", token.getMintAddress());
                return;
            }

            // Update token with on-chain state
            updateTokenFromBlockchain(token, state);

            log.debug("Successfully synced token {} - Price: {}, Market Cap: {}, SOL Reserves: {}",
                    token.getSymbol(),
                    token.getCurrentPrice(),
                    token.getMarketCap(),
                    state.realSolReserves);

        } catch (Exception e) {
            log.error("Failed to sync token {}: {}", token.getMintAddress(), e.getMessage(), e);
        }
    }

    /**
     * Sync all active tokens
     */
    @Transactional
    public void syncAllTokens() {
        List<Token> activeTokens = tokenRepository.findByStatus(Token.TokenStatus.ACTIVE);
        log.info("Starting blockchain sync for {} active tokens", activeTokens.size());

        int successCount = 0;
        int failCount = 0;

        for (Token token : activeTokens) {
            try {
                syncToken(token);
                successCount++;
            } catch (Exception e) {
                failCount++;
                log.error("Failed to sync token {}: {}", token.getMintAddress(), e.getMessage());
            }
        }

        log.info("Blockchain sync completed: {} successful, {} failed", successCount, failCount);
    }

    /**
     * Fetch bonding curve state from blockchain
     */
    private BondingCurveState fetchBondingCurveState(String bondingCurvePda) {
        try {
            // Build RPC request
            String jsonRequest = String.format(
                    "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"getAccountInfo\",\"params\":[\"%s\",{\"encoding\":\"base64\"}]}",
                    bondingCurvePda
            );

            RequestBody body = RequestBody.create(
                    jsonRequest,
                    MediaType.parse("application/json")
            );

            Request request = new Request.Builder()
                    .url(rpcUrl)
                    .post(body)
                    .build();

            // Execute request
            try (Response response = httpClient.newCall(request).execute()) {
                if (!response.isSuccessful()) {
                    log.error("RPC request failed: {}", response.code());
                    return null;
                }

                String responseBody = response.body().string();
                JsonNode root = objectMapper.readTree(responseBody);
                JsonNode result = root.get("result");

                if (result == null || result.get("value").isNull()) {
                    log.warn("Account not found: {}", bondingCurvePda);
                    return null;
                }

                // Decode account data
                String base64Data = result.get("value").get("data").get(0).asText();
                byte[] accountData = Base64.getDecoder().decode(base64Data);

                // Parse bonding curve state
                return parseBondingCurveAccount(accountData);
            }

        } catch (Exception e) {
            log.error("Failed to fetch bonding curve state: {}", e.getMessage(), e);
            return null;
        }
    }

    /**
     * Parse bonding curve account data
     *
     * Struct layout (matching Rust program):
     * [0-7]   = Anchor discriminator (8 bytes)
     * [8-39]  = mint_address: Pubkey (32 bytes)
     * [40-71] = creator: Pubkey (32 bytes)
     * [72-79] = virtual_token_reserves: u64 (8 bytes)
     * [80-87] = virtual_sol_reserves: u64 (8 bytes)
     * [88-95] = real_token_reserves: u64 (8 bytes)
     * [96-103] = real_sol_reserves: u64 (8 bytes)
     * [104-111] = token_total_supply: u64 (8 bytes)
     * [112] = graduated: bool (1 byte)
     */
    private BondingCurveState parseBondingCurveAccount(byte[] data) {
        if (data.length < 113) {
            log.error("Invalid account data length: {}", data.length);
            return null;
        }

        ByteBuffer buffer = ByteBuffer.wrap(data).order(ByteOrder.LITTLE_ENDIAN);

        BondingCurveState state = new BondingCurveState();

        // Skip discriminator (8 bytes) and mint address (32 bytes) and creator (32 bytes)
        buffer.position(72);

        state.virtualTokenReserves = buffer.getLong();
        state.virtualSolReserves = buffer.getLong();
        state.realTokenReserves = buffer.getLong();
        state.realSolReserves = buffer.getLong();
        state.tokenTotalSupply = buffer.getLong();
        state.graduated = buffer.get() != 0;

        return state;
    }

    /**
     * Update token entity with blockchain state
     */
    private void updateTokenFromBlockchain(Token token, BondingCurveState state) {
        // Update reserves
        token.setVirtualSolReserves(state.virtualSolReserves);
        token.setVirtualTokenReserves(state.virtualTokenReserves);

        // Calculate current price (SOL per token)
        // Price = virtualSolReserves / virtualTokenReserves
        BigDecimal solReservesDecimal = new BigDecimal(state.virtualSolReserves)
                .divide(BigDecimal.valueOf(LAMPORTS_PER_SOL), 9, RoundingMode.HALF_UP);
        BigDecimal tokenReservesDecimal = new BigDecimal(state.virtualTokenReserves)
                .divide(BigDecimal.TEN.pow(DECIMALS), 9, RoundingMode.HALF_UP);

        BigDecimal price = BigDecimal.ZERO;
        if (tokenReservesDecimal.compareTo(BigDecimal.ZERO) > 0) {
            price = solReservesDecimal.divide(tokenReservesDecimal, 9, RoundingMode.HALF_UP);
        }
        token.setCurrentPrice(price);

        // Calculate market cap (total supply * current price)
        BigDecimal totalSupplyDecimal = new BigDecimal(token.getTotalSupply())
                .divide(BigDecimal.TEN.pow(DECIMALS), 2, RoundingMode.HALF_UP);
        BigDecimal marketCap = totalSupplyDecimal.multiply(price);
        token.setMarketCap(marketCap);

        // Calculate bonding curve progress (real SOL / graduation threshold)
        // Graduation threshold is 69 SOL = 69,000,000,000 lamports
        BigDecimal progress = new BigDecimal(state.realSolReserves)
                .multiply(BigDecimal.valueOf(100))
                .divide(new BigDecimal(token.getGraduationThreshold()), 2, RoundingMode.HALF_UP);
        token.setBondingCurveProgress(progress);

        // Update graduation status
        if (state.graduated && token.getStatus() == Token.TokenStatus.ACTIVE) {
            token.setStatus(Token.TokenStatus.GRADUATED);
            if (token.getGraduatedAt() == null) {
                token.setGraduatedAt(java.time.LocalDateTime.now());
            }
        }

        // Save updated token
        tokenRepository.save(token);
    }

    /**
     * Derive bonding curve PDA (Program Derived Address)
     * PDA = findProgramAddress([b"bonding_curve", mint_pubkey], program_id)
     */
    private String deriveBondingCurvePda(String mintAddress) {
        try {
            org.p2p.solanaj.core.PublicKey mintPubkey = new org.p2p.solanaj.core.PublicKey(mintAddress);
            org.p2p.solanaj.core.PublicKey programId = new org.p2p.solanaj.core.PublicKey(bondingCurveProgramId);

            // Find PDA with seeds: ["bonding_curve", mint_pubkey]
            org.p2p.solanaj.programs.ProgramDerivedAddress pda =
                org.p2p.solanaj.core.PublicKey.findProgramAddress(
                    java.util.List.of(
                        "bonding_curve".getBytes(java.nio.charset.StandardCharsets.UTF_8),
                        mintPubkey.toByteArray()
                    ),
                    programId
                );

            String pdaAddress = pda.getAddress().toBase58();
            log.debug("Derived bonding curve PDA for {}: {}", mintAddress, pdaAddress);
            return pdaAddress;

        } catch (Exception e) {
            log.error("Failed to derive PDA for mint {}: {}", mintAddress, e.getMessage());
            // Fallback to mint address (will fail, but at least we'll see the error)
            return mintAddress;
        }
    }

    /**
     * Data class for bonding curve state
     */
    private static class BondingCurveState {
        long virtualTokenReserves;
        long virtualSolReserves;
        long realTokenReserves;
        long realSolReserves;
        long tokenTotalSupply;
        boolean graduated;
    }
}
