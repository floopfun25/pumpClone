package com.floppfun.service;

import com.floppfun.model.dto.TradeRequest;
import com.floppfun.model.dto.TradeResponse;
import com.floppfun.model.entity.Token;
import com.floppfun.model.entity.Transaction;
import com.floppfun.model.entity.User;
import com.floppfun.model.entity.UserHolding;
import com.floppfun.repository.TransactionRepository;
import com.floppfun.repository.UserHoldingRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;

@Slf4j
@Service
@RequiredArgsConstructor
public class TradingService {

    private final TokenService tokenService;
    private final UserService userService;
    private final BondingCurveService bondingCurveService;
    private final SolanaService solanaService;
    private final WebSocketService webSocketService;
    private final TransactionRepository transactionRepository;
    private final UserHoldingRepository userHoldingRepository;

    /**
     * Process a buy transaction
     */
    @Transactional
    public TradeResponse buyTokens(TradeRequest request) {
        log.info("Processing buy: {} tokens for wallet {}", request.getAmount(), request.getWalletAddress());

        // Get token
        Token token = tokenService.getTokenByMintAddress(request.getMintAddress())
                .orElseThrow(() -> new RuntimeException("Token not found"));

        // Get or create user
        User user = userService.getOrCreateUser(request.getWalletAddress());

        // Calculate buy price
        Long tokensToBuy = request.getAmount();
        Long solCost = bondingCurveService.calculateBuyPrice(
                token.getVirtualSolReserves(),
                token.getVirtualTokenReserves(),
                tokensToBuy
        );

        // Calculate platform fee
        Long platformFee = bondingCurveService.calculatePlatformFee(solCost);
        Long totalSolCost = solCost + platformFee;

        // Calculate price per token
        BigDecimal pricePerToken = BigDecimal.valueOf(totalSolCost)
                .divide(BigDecimal.valueOf(tokensToBuy), 18, RoundingMode.HALF_UP);

        // Slippage check
        BigDecimal slippageTolerance = request.getSlippageTolerance() != null ?
                request.getSlippageTolerance() : BigDecimal.ONE;

        // Execute buy on Solana
        String signature = solanaService.executeBuy(
                token.getMintAddress(),
                user.getWalletAddress(),
                totalSolCost,
                tokensToBuy
        );

        // Update token reserves
        token.setVirtualSolReserves(token.getVirtualSolReserves() + solCost);
        token.setVirtualTokenReserves(token.getVirtualTokenReserves() - tokensToBuy);

        // Update token statistics
        tokenService.updateTokenStats(token, solCost, tokensToBuy);

        // Create transaction record
        Transaction transaction = Transaction.builder()
                .signature(signature)
                .token(token)
                .user(user)
                .transactionType(Transaction.TransactionType.BUY)
                .solAmount(totalSolCost)
                .tokenAmount(tokensToBuy)
                .pricePerToken(pricePerToken)
                .platformFee(platformFee)
                .status(Transaction.TransactionStatus.CONFIRMED)
                .blockTime(LocalDateTime.now())
                .build();

        transactionRepository.save(transaction);

        // Update or create user holding
        updateUserHolding(user, token, tokensToBuy, pricePerToken, true);

        // Update user stats
        user.setTotalVolumeTraded(user.getTotalVolumeTraded().add(BigDecimal.valueOf(totalSolCost)));

        // Broadcast real-time update
        webSocketService.broadcastPriceUpdate(token.getId(), token.getCurrentPrice(),
                token.getMarketCap(), token.getVolume24h());
        webSocketService.broadcastTrade(token.getSymbol(), "BUY", tokensToBuy, pricePerToken);

        log.info("Buy completed: {} tokens for {} SOL (fee: {})", tokensToBuy, solCost, platformFee);

        return TradeResponse.builder()
                .transactionSignature(signature)
                .tokenMintAddress(token.getMintAddress())
                .solAmount(totalSolCost)
                .tokenAmount(tokensToBuy)
                .pricePerToken(pricePerToken)
                .newTokenPrice(token.getCurrentPrice())
                .platformFee(BigDecimal.valueOf(platformFee))
                .status("SUCCESS")
                .message("Buy transaction completed successfully")
                .build();
    }

    /**
     * Process a sell transaction
     */
    @Transactional
    public TradeResponse sellTokens(TradeRequest request) {
        log.info("Processing sell: {} tokens for wallet {}", request.getAmount(), request.getWalletAddress());

        // Get token
        Token token = tokenService.getTokenByMintAddress(request.getMintAddress())
                .orElseThrow(() -> new RuntimeException("Token not found"));

        // Get user
        User user = userService.getUserByWallet(request.getWalletAddress())
                .orElseThrow(() -> new RuntimeException("User not found"));

        // Check user has enough tokens
        UserHolding holding = userHoldingRepository.findByUserIdAndTokenId(user.getId(), token.getId())
                .orElseThrow(() -> new RuntimeException("No tokens to sell"));

        Long tokensToSell = request.getAmount();
        if (holding.getAmount() < tokensToSell) {
            throw new RuntimeException("Insufficient token balance");
        }

        // Calculate sell price
        Long solReceived = bondingCurveService.calculateSellPrice(
                token.getVirtualSolReserves(),
                token.getVirtualTokenReserves(),
                tokensToSell
        );

        // Calculate platform fee
        Long platformFee = bondingCurveService.calculatePlatformFee(solReceived);
        Long netSolReceived = solReceived - platformFee;

        // Calculate price per token
        BigDecimal pricePerToken = BigDecimal.valueOf(netSolReceived)
                .divide(BigDecimal.valueOf(tokensToSell), 18, RoundingMode.HALF_UP);

        // Execute sell on Solana
        String signature = solanaService.executeSell(
                token.getMintAddress(),
                user.getWalletAddress(),
                tokensToSell,
                netSolReceived
        );

        // Update token reserves
        token.setVirtualSolReserves(token.getVirtualSolReserves() - solReceived);
        token.setVirtualTokenReserves(token.getVirtualTokenReserves() + tokensToSell);

        // Update token statistics
        tokenService.updateTokenStats(token, solReceived, tokensToSell);

        // Create transaction record
        Transaction transaction = Transaction.builder()
                .signature(signature)
                .token(token)
                .user(user)
                .transactionType(Transaction.TransactionType.SELL)
                .solAmount(netSolReceived)
                .tokenAmount(tokensToSell)
                .pricePerToken(pricePerToken)
                .platformFee(platformFee)
                .status(Transaction.TransactionStatus.CONFIRMED)
                .blockTime(LocalDateTime.now())
                .build();

        transactionRepository.save(transaction);

        // Update user holding
        updateUserHolding(user, token, tokensToSell, pricePerToken, false);

        // Update user stats
        user.setTotalVolumeTraded(user.getTotalVolumeTraded().add(BigDecimal.valueOf(netSolReceived)));

        // Broadcast real-time update
        webSocketService.broadcastPriceUpdate(token.getId(), token.getCurrentPrice(),
                token.getMarketCap(), token.getVolume24h());
        webSocketService.broadcastTrade(token.getSymbol(), "SELL", tokensToSell, pricePerToken);

        log.info("Sell completed: {} tokens for {} SOL (fee: {})", tokensToSell, netSolReceived, platformFee);

        return TradeResponse.builder()
                .transactionSignature(signature)
                .tokenMintAddress(token.getMintAddress())
                .solAmount(netSolReceived)
                .tokenAmount(tokensToSell)
                .pricePerToken(pricePerToken)
                .newTokenPrice(token.getCurrentPrice())
                .platformFee(BigDecimal.valueOf(platformFee))
                .status("SUCCESS")
                .message("Sell transaction completed successfully")
                .build();
    }

    /**
     * Update or create user holding
     */
    private void updateUserHolding(User user, Token token, Long tokenAmount, BigDecimal pricePerToken, boolean isBuy) {
        UserHolding holding = userHoldingRepository.findByUserIdAndTokenId(user.getId(), token.getId())
                .orElse(UserHolding.builder()
                        .user(user)
                        .token(token)
                        .amount(0L)
                        .averagePrice(BigDecimal.ZERO)
                        .build());

        if (isBuy) {
            // Calculate new average price
            BigDecimal totalValue = holding.getAveragePrice()
                    .multiply(BigDecimal.valueOf(holding.getAmount()))
                    .add(pricePerToken.multiply(BigDecimal.valueOf(tokenAmount)));

            Long newAmount = holding.getAmount() + tokenAmount;

            BigDecimal newAvgPrice = newAmount > 0 ?
                    totalValue.divide(BigDecimal.valueOf(newAmount), 18, RoundingMode.HALF_UP) :
                    BigDecimal.ZERO;

            holding.setAmount(newAmount);
            holding.setAveragePrice(newAvgPrice);
        } else {
            // Reduce holding on sell
            holding.setAmount(holding.getAmount() - tokenAmount);
        }

        userHoldingRepository.save(holding);

        // Update token holder count
        Long holderCount = userHoldingRepository.countHoldersByTokenId(token.getId());
        token.setHoldersCount(holderCount.intValue());
    }
}
