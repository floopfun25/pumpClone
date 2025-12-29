package com.floppfun.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.floppfun.entity.TokenHolder;
import com.floppfun.model.entity.Token;
import com.floppfun.repository.TokenHolderRepository;
import com.floppfun.repository.TokenRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import okhttp3.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Service to track token holders by querying blockchain
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class HolderTrackingService {

    private final TokenRepository tokenRepository;
    private final TokenHolderRepository tokenHolderRepository;
    private final OkHttpClient httpClient = new OkHttpClient();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${floppfun.solana.rpc-url}")
    private String rpcUrl;

    private static final int DECIMALS = 6; // Token decimals

    /**
     * Update holder count for a single token
     */
    @Transactional
    public void updateHolderCount(Token token) {
        try {
            log.debug("Updating holder count for token {} ({})", token.getSymbol(), token.getMintAddress());

            // Fetch all token accounts for this mint
            List<TokenAccountInfo> accounts = fetchTokenAccounts(token.getMintAddress());

            // Filter accounts with non-zero balance
            int holderCount = 0;
            for (TokenAccountInfo account : accounts) {
                if (account.balance > 0) {
                    holderCount++;

                    // Update or create holder record
                    updateOrCreateHolder(token, account);
                }
            }

            // Update token holder count
            token.setHoldersCount(holderCount);
            tokenRepository.save(token);

            log.debug("Updated holder count for {}: {} holders", token.getSymbol(), holderCount);

        } catch (Exception e) {
            log.error("Failed to update holder count for {}: {}", token.getMintAddress(), e.getMessage(), e);
        }
    }

    /**
     * Update holder counts for all active tokens
     */
    @Transactional
    public void updateAllHolderCounts() {
        List<Token> activeTokens = tokenRepository.findByStatus(Token.TokenStatus.ACTIVE);
        log.info("Starting holder count update for {} active tokens", activeTokens.size());

        int successCount = 0;
        int failCount = 0;

        for (Token token : activeTokens) {
            try {
                updateHolderCount(token);
                successCount++;
            } catch (Exception e) {
                failCount++;
                log.error("Failed to update holder count for {}: {}", token.getMintAddress(), e.getMessage());
            }
        }

        log.info("Holder count update completed: {} successful, {} failed", successCount, failCount);
    }

    /**
     * Fetch all token accounts for a mint address from blockchain
     */
    private List<TokenAccountInfo> fetchTokenAccounts(String mintAddress) {
        try {
            // Build RPC request to get token accounts by mint
            String jsonRequest = String.format(
                    "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"getProgramAccounts\"," +
                    "\"params\":[\"%s\",{\"encoding\":\"jsonParsed\"," +
                    "\"filters\":[{\"dataSize\":165},{\"memcmp\":{\"offset\":0,\"bytes\":\"%s\"}}]}]}",
                    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", // SPL Token Program ID
                    mintAddress
            );

            RequestBody body = RequestBody.create(
                    jsonRequest,
                    MediaType.parse("application/json")
            );

            Request request = new Request.Builder()
                    .url(rpcUrl)
                    .post(body)
                    .build();

            try (Response response = httpClient.newCall(request).execute()) {
                if (!response.isSuccessful()) {
                    log.error("RPC request failed: {}", response.code());
                    return new ArrayList<>();
                }

                String responseBody = response.body().string();
                JsonNode root = objectMapper.readTree(responseBody);
                JsonNode result = root.get("result");

                if (result == null || !result.isArray()) {
                    log.warn("No token accounts found for mint: {}", mintAddress);
                    return new ArrayList<>();
                }

                // Parse token accounts
                List<TokenAccountInfo> accounts = new ArrayList<>();
                for (JsonNode accountNode : result) {
                    try {
                        String accountPubkey = accountNode.get("pubkey").asText();
                        JsonNode accountData = accountNode.get("account").get("data").get("parsed").get("info");

                        String owner = accountData.get("owner").asText();
                        String tokenAmount = accountData.get("tokenAmount").get("amount").asText();
                        long balance = Long.parseLong(tokenAmount);

                        accounts.add(new TokenAccountInfo(accountPubkey, owner, balance));
                    } catch (Exception e) {
                        log.warn("Failed to parse token account: {}", e.getMessage());
                    }
                }

                return accounts;
            }

        } catch (Exception e) {
            log.error("Failed to fetch token accounts: {}", e.getMessage(), e);
            return new ArrayList<>();
        }
    }

    /**
     * Update or create holder record
     */
    private void updateOrCreateHolder(Token token, TokenAccountInfo accountInfo) {
        TokenHolder holder = tokenHolderRepository
                .findByTokenIdAndWalletAddress(token.getId(), accountInfo.owner)
                .orElse(new TokenHolder());

        boolean isNewHolder = holder.getId() == null;

        holder.setToken(token);
        holder.setWalletAddress(accountInfo.owner);
        holder.setBalance(accountInfo.balance);

        // Calculate percentage of total supply
        if (token.getTotalSupply() != null && token.getTotalSupply() > 0) {
            try {
                // Normalize balance by dividing by 10^decimals since balance is stored WITH decimals
                // but totalSupply is stored WITHOUT decimals
                int decimals = token.getDecimals() != null ? token.getDecimals() : 6;
                BigDecimal normalizedBalance = new BigDecimal(accountInfo.balance)
                        .divide(BigDecimal.TEN.pow(decimals), 2, RoundingMode.HALF_UP);

                BigDecimal percentage = normalizedBalance
                        .multiply(BigDecimal.valueOf(100))
                        .divide(new BigDecimal(token.getTotalSupply()), 2, RoundingMode.HALF_UP);

                // Ensure percentage doesn't exceed 100.00 (database constraint is DECIMAL(5,2) = max 999.99)
                // but logically percentage should be 0-100
                if (percentage.compareTo(BigDecimal.valueOf(100)) > 0) {
                    log.warn("Calculated percentage {} exceeds 100% for token {} holder {}, capping at 100",
                            percentage, token.getMintAddress(), accountInfo.owner);
                    percentage = BigDecimal.valueOf(100);
                }

                holder.setPercentage(percentage);
            } catch (ArithmeticException e) {
                log.error("Failed to calculate percentage for token {} holder {}: balance={}, totalSupply={}",
                        token.getMintAddress(), accountInfo.owner, accountInfo.balance, token.getTotalSupply(), e);
                holder.setPercentage(BigDecimal.ZERO);
            }
        }

        if (isNewHolder) {
            holder.setFirstAcquiredAt(LocalDateTime.now());
        }
        holder.setLastUpdatedAt(LocalDateTime.now());

        tokenHolderRepository.save(holder);
    }

    /**
     * Data class for token account info
     */
    private static class TokenAccountInfo {
        String accountPubkey;
        String owner;
        long balance;

        TokenAccountInfo(String accountPubkey, String owner, long balance) {
            this.accountPubkey = accountPubkey;
            this.owner = owner;
            this.balance = balance;
        }
    }
}
