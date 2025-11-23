package com.floppfun.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Bonding Curve Service - Implements constant product AMM formula (x * y = k)
 * Similar to Uniswap/Raydium pricing model
 */
@Slf4j
@Service
public class BondingCurveService {

    @Value("${floppfun.bonding-curve.virtual-sol-reserves}")
    private Long virtualSolReserves;

    @Value("${floppfun.bonding-curve.virtual-token-reserves}")
    private Long virtualTokenReserves;

    @Value("${floppfun.bonding-curve.graduation-threshold}")
    private Long graduationThreshold;

    @Value("${floppfun.trading.platform-fee-bps}")
    private Integer platformFeeBps;

    /**
     * Calculate SOL cost to buy tokens
     * Formula: solCost = (solReserves * tokenAmount) / (tokenReserves - tokenAmount)
     */
    public Long calculateBuyPrice(Long currentSolReserves, Long currentTokenReserves, Long tokensToBuy) {
        if (tokensToBuy >= currentTokenReserves) {
            throw new IllegalArgumentException("Not enough tokens in reserves");
        }

        BigDecimal solReserves = BigDecimal.valueOf(currentSolReserves);
        BigDecimal tokenReserves = BigDecimal.valueOf(currentTokenReserves);
        BigDecimal tokensAmount = BigDecimal.valueOf(tokensToBuy);

        // k = x * y (constant product)
        BigDecimal k = solReserves.multiply(tokenReserves);

        // New token reserves after buy
        BigDecimal newTokenReserves = tokenReserves.subtract(tokensAmount);

        // New SOL reserves to maintain k
        BigDecimal newSolReserves = k.divide(newTokenReserves, 0, RoundingMode.UP);

        // SOL cost = difference in reserves
        Long solCost = newSolReserves.subtract(solReserves).longValue();

        log.debug("Buy calculation: {} tokens cost {} lamports", tokensToBuy, solCost);
        return solCost;
    }

    /**
     * Calculate SOL received from selling tokens
     * Formula: solReceived = (tokenAmount * solReserves) / (tokenReserves + tokenAmount)
     */
    public Long calculateSellPrice(Long currentSolReserves, Long currentTokenReserves, Long tokensToSell) {
        BigDecimal solReserves = BigDecimal.valueOf(currentSolReserves);
        BigDecimal tokenReserves = BigDecimal.valueOf(currentTokenReserves);
        BigDecimal tokensAmount = BigDecimal.valueOf(tokensToSell);

        // k = x * y
        BigDecimal k = solReserves.multiply(tokenReserves);

        // New token reserves after sell
        BigDecimal newTokenReserves = tokenReserves.add(tokensAmount);

        // New SOL reserves to maintain k
        BigDecimal newSolReserves = k.divide(newTokenReserves, 0, RoundingMode.DOWN);

        // SOL received = difference in reserves
        Long solReceived = solReserves.subtract(newSolReserves).longValue();

        log.debug("Sell calculation: {} tokens receive {} lamports", tokensToSell, solReceived);
        return solReceived;
    }

    /**
     * Calculate platform fee
     */
    public Long calculatePlatformFee(Long amount) {
        BigDecimal amountBd = BigDecimal.valueOf(amount);
        BigDecimal feeBps = BigDecimal.valueOf(platformFeeBps);
        BigDecimal fee = amountBd.multiply(feeBps).divide(BigDecimal.valueOf(10000), 0, RoundingMode.UP);
        return fee.longValue();
    }

    /**
     * Calculate current token price (SOL per token)
     */
    public BigDecimal calculateCurrentPrice(Long solReserves, Long tokenReserves) {
        if (tokenReserves == 0) {
            return BigDecimal.ZERO;
        }

        return BigDecimal.valueOf(solReserves)
                .divide(BigDecimal.valueOf(tokenReserves), 18, RoundingMode.HALF_UP);
    }

    /**
     * Calculate market cap (in SOL)
     */
    public BigDecimal calculateMarketCap(Long totalSupply, Long solReserves, Long tokenReserves) {
        BigDecimal price = calculateCurrentPrice(solReserves, tokenReserves);
        return price.multiply(BigDecimal.valueOf(totalSupply))
                .divide(BigDecimal.valueOf(1_000_000_000), 2, RoundingMode.HALF_UP); // Convert from lamports
    }

    /**
     * Check if token has graduated (reached threshold)
     */
    public boolean hasGraduated(Long currentSolReserves) {
        return currentSolReserves >= graduationThreshold;
    }

    /**
     * Calculate bonding curve progress (0-100%)
     */
    public BigDecimal calculateProgress(Long currentSolReserves) {
        if (graduationThreshold == 0) {
            return BigDecimal.ZERO;
        }

        BigDecimal progress = BigDecimal.valueOf(currentSolReserves)
                .divide(BigDecimal.valueOf(graduationThreshold), 4, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100));

        return progress.min(BigDecimal.valueOf(100));
    }

    /**
     * Validate slippage tolerance
     */
    public boolean isWithinSlippageTolerance(Long expectedAmount, Long actualAmount, BigDecimal slippageTolerance) {
        BigDecimal expected = BigDecimal.valueOf(expectedAmount);
        BigDecimal actual = BigDecimal.valueOf(actualAmount);
        BigDecimal tolerance = slippageTolerance.divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP);

        BigDecimal minAcceptable = expected.multiply(BigDecimal.ONE.subtract(tolerance));
        BigDecimal maxAcceptable = expected.multiply(BigDecimal.ONE.add(tolerance));

        return actual.compareTo(minAcceptable) >= 0 && actual.compareTo(maxAcceptable) <= 0;
    }

    /**
     * Get initial reserves for new token
     */
    public Long getInitialSolReserves() {
        return virtualSolReserves;
    }

    public Long getInitialTokenReserves() {
        return virtualTokenReserves;
    }
}
