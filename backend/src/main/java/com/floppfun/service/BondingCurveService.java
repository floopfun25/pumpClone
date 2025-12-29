package com.floppfun.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Production Bonding Curve Service - Pump.fun Clone
 *
 * Architecture:
 * - Constant product AMM formula (x * y = k)
 * - Virtual reserves for pricing, real reserves for tracking
 * - Completion when real_token_reserves == 0 (not SOL threshold)
 * - Buy-only curve (no sells until DEX migration)
 */
@Slf4j
@Service
public class BondingCurveService {

    // Pump.fun standard parameters (with 6 decimals)
    private static final Long INITIAL_VIRTUAL_TOKEN_RESERVES = 1_073_000_000_000_000L; // 1.073B tokens
    private static final Long INITIAL_VIRTUAL_SOL_RESERVES = 30_000_000_000L;          // 30 SOL
    private static final Long INITIAL_REAL_TOKEN_RESERVES = 793_100_000_000_000L;      // 793.1M tokens
    private static final Long TOKEN_TOTAL_SUPPLY = 1_000_000_000_000_000L;             // 1B tokens
    private static final Long CREATOR_ALLOCATION = 206_900_000_000_000L;               // 206.9M tokens

    @Value("${floppfun.trading.platform-fee-bps:100}")
    private Integer platformFeeBps; // Default 100 = 1%

    /**
     * Calculate SOL cost to buy exact token amount
     * Uses pump.fun's constant product formula with virtual reserves
     *
     * Formula: k = virtual_sol_reserves * virtual_token_reserves
     *          new_token_reserves = virtual_token_reserves - token_amount
     *          new_sol_reserves = k / new_token_reserves
     *          sol_cost = new_sol_reserves - virtual_sol_reserves
     */
    public Long calculateBuyPrice(
            Long currentVirtualSolReserves,
            Long currentVirtualTokenReserves,
            Long tokensToBuy
    ) {
        if (tokensToBuy >= currentVirtualTokenReserves) {
            throw new IllegalArgumentException("Token amount exceeds available reserves");
        }
        if (tokensToBuy <= 0) {
            throw new IllegalArgumentException("Token amount must be positive");
        }

        BigDecimal solReserves = BigDecimal.valueOf(currentVirtualSolReserves);
        BigDecimal tokenReserves = BigDecimal.valueOf(currentVirtualTokenReserves);
        BigDecimal tokensAmount = BigDecimal.valueOf(tokensToBuy);

        // k = virtual_sol_reserves * virtual_token_reserves (constant product)
        BigDecimal k = solReserves.multiply(tokenReserves);

        // New token reserves after buy
        BigDecimal newTokenReserves = tokenReserves.subtract(tokensAmount);

        // New SOL reserves to maintain k
        BigDecimal newSolReserves = k.divide(newTokenReserves, 0, RoundingMode.UP);

        // SOL cost = difference in reserves
        Long solCost = newSolReserves.subtract(solReserves).longValue();

        log.debug("Buy calculation: {} tokens cost {} lamports (virtual reserves: {} SOL, {} tokens)",
                tokensToBuy, solCost, currentVirtualSolReserves, currentVirtualTokenReserves);

        return solCost;
    }

    /**
     * Calculate total cost including platform fee
     */
    public Long calculateTotalCost(Long solCost) {
        Long platformFee = calculatePlatformFee(solCost);
        return solCost + platformFee;
    }

    /**
     * Calculate platform fee (typically 1%)
     */
    public Long calculatePlatformFee(Long amount) {
        BigDecimal amountBd = BigDecimal.valueOf(amount);
        BigDecimal feeBps = BigDecimal.valueOf(platformFeeBps);
        BigDecimal fee = amountBd.multiply(feeBps).divide(BigDecimal.valueOf(10000), 0, RoundingMode.UP);
        return fee.longValue();
    }

    /**
     * Calculate current token price (SOL per token)
     * Based on virtual reserves
     */
    public BigDecimal calculateCurrentPrice(Long virtualSolReserves, Long virtualTokenReserves) {
        if (virtualTokenReserves == 0) {
            return BigDecimal.ZERO;
        }

        return BigDecimal.valueOf(virtualSolReserves)
                .divide(BigDecimal.valueOf(virtualTokenReserves), 18, RoundingMode.HALF_UP);
    }

    /**
     * Calculate market cap using pump.fun formula
     * market_cap = (virtual_sol_reserves / virtual_token_reserves) * token_total_supply
     */
    public BigDecimal calculateMarketCap(Long virtualSolReserves, Long virtualTokenReserves) {
        BigDecimal price = calculateCurrentPrice(virtualSolReserves, virtualTokenReserves);
        return price.multiply(BigDecimal.valueOf(TOKEN_TOTAL_SUPPLY))
                .divide(BigDecimal.valueOf(1_000_000_000), 2, RoundingMode.HALF_UP); // Convert from lamports
    }

    /**
     * Check if bonding curve is complete (all tokens sold)
     * Pump.fun uses: real_token_reserves == 0, NOT sol threshold
     */
    public boolean isComplete(Long realTokenReserves) {
        return realTokenReserves == 0;
    }

    /**
     * Calculate bonding curve progress (0-100%)
     * Based on tokens sold from real reserves
     */
    public BigDecimal calculateProgress(Long currentRealTokenReserves) {
        if (INITIAL_REAL_TOKEN_RESERVES == 0) {
            return BigDecimal.ZERO;
        }

        Long tokensSold = INITIAL_REAL_TOKEN_RESERVES - currentRealTokenReserves;
        BigDecimal progress = BigDecimal.valueOf(tokensSold)
                .divide(BigDecimal.valueOf(INITIAL_REAL_TOKEN_RESERVES), 4, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100));

        return progress.min(BigDecimal.valueOf(100));
    }

    /**
     * Validate slippage tolerance
     */
    public boolean isWithinSlippageTolerance(
            Long expectedAmount,
            Long actualAmount,
            BigDecimal slippageTolerance
    ) {
        BigDecimal expected = BigDecimal.valueOf(expectedAmount);
        BigDecimal actual = BigDecimal.valueOf(actualAmount);
        BigDecimal tolerance = slippageTolerance.divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP);

        BigDecimal minAcceptable = expected.multiply(BigDecimal.ONE.subtract(tolerance));
        BigDecimal maxAcceptable = expected.multiply(BigDecimal.ONE.add(tolerance));

        return actual.compareTo(minAcceptable) >= 0 && actual.compareTo(maxAcceptable) <= 0;
    }

    /**
     * Get pump.fun standard initial parameters
     */
    public Long getInitialVirtualSolReserves() {
        return INITIAL_VIRTUAL_SOL_RESERVES;
    }

    public Long getInitialVirtualTokenReserves() {
        return INITIAL_VIRTUAL_TOKEN_RESERVES;
    }

    public Long getInitialRealTokenReserves() {
        return INITIAL_REAL_TOKEN_RESERVES;
    }

    public Long getTokenTotalSupply() {
        return TOKEN_TOTAL_SUPPLY;
    }

    public Long getCreatorAllocation() {
        return CREATOR_ALLOCATION;
    }

    /**
     * Calculate tokens receivable for given SOL amount (before fees)
     * Used for UI price quotes
     */
    public Long calculateTokensOut(
            Long solAmount,
            Long currentVirtualSolReserves,
            Long currentVirtualTokenReserves
    ) {
        if (solAmount <= 0) {
            throw new IllegalArgumentException("SOL amount must be positive");
        }

        BigDecimal solReserves = BigDecimal.valueOf(currentVirtualSolReserves);
        BigDecimal tokenReserves = BigDecimal.valueOf(currentVirtualTokenReserves);
        BigDecimal solIn = BigDecimal.valueOf(solAmount);

        // k = virtual_sol_reserves * virtual_token_reserves
        BigDecimal k = solReserves.multiply(tokenReserves);

        // New SOL reserves after adding input
        BigDecimal newSolReserves = solReserves.add(solIn);

        // New token reserves to maintain k
        BigDecimal newTokenReserves = k.divide(newSolReserves, 0, RoundingMode.DOWN);

        // Tokens out = difference in reserves
        Long tokensOut = tokenReserves.subtract(newTokenReserves).longValue();

        log.debug("Tokens out calculation: {} lamports buys {} tokens (virtual reserves: {} SOL, {} tokens)",
                solAmount, tokensOut, currentVirtualSolReserves, currentVirtualTokenReserves);

        return tokensOut;
    }

    /**
     * Estimate SOL collected at completion (when all 793.1M tokens sold)
     * This is typically around 85 SOL for pump.fun curve
     */
    public Long estimateCompletionSol() {
        // Calculate SOL cost to buy all real token reserves
        return calculateBuyPrice(
                INITIAL_VIRTUAL_SOL_RESERVES,
                INITIAL_VIRTUAL_TOKEN_RESERVES,
                INITIAL_REAL_TOKEN_RESERVES
        );
    }
}
