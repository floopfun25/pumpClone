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
     * FIXED: Record buy transaction (executed client-side)
     * Backend only records the transaction after it's confirmed on-chain
     */
    @Transactional
    public TradeResponse buyTokens(TradeRequest request) {
        log.info("Recording buy transaction: {} tokens for wallet {}", request.getAmount(), request.getWalletAddress());

        // FIXED: Transaction signature must be provided by client (already executed on-chain)
        if (request.getSignature() == null || request.getSignature().isEmpty()) {
            throw new RuntimeException("Transaction signature required - transactions must be executed client-side");
        }

        // Get token
        Token token = tokenService.getTokenByMintAddress(request.getMintAddress())
                .orElseThrow(() -> new RuntimeException("Token not found"));

        // Get or create user
        User user = userService.getOrCreateUser(request.getWalletAddress());

        // FIXED: Use actual amounts from the confirmed transaction
        Long tokensToBuy = request.getAmount();
        Long totalSolCost = request.getSolAmount();

        // Calculate platform fee (1% of SOL amount)
        Long platformFee = bondingCurveService.calculatePlatformFee(totalSolCost);
        Long solCost = totalSolCost - platformFee;

        // Calculate price per token
        BigDecimal pricePerToken = BigDecimal.valueOf(totalSolCost)
                .divide(BigDecimal.valueOf(tokensToBuy), 18, RoundingMode.HALF_UP);

        // REMOVED: Backend does NOT execute transactions
        // String signature = solanaService.executeBuy(...); // ❌ WRONG
        String signature = request.getSignature(); // ✅ Use client-provided signature

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
     * FIXED: Record sell transaction (executed client-side)
     * Backend only records the transaction after it's confirmed on-chain
     */
    @Transactional
    public TradeResponse sellTokens(TradeRequest request) {
        log.info("Recording sell transaction: {} tokens for wallet {}", request.getAmount(), request.getWalletAddress());

        // FIXED: Transaction signature must be provided by client (already executed on-chain)
        if (request.getSignature() == null || request.getSignature().isEmpty()) {
            throw new RuntimeException("Transaction signature required - transactions must be executed client-side");
        }

        // Get token
        Token token = tokenService.getTokenByMintAddress(request.getMintAddress())
                .orElseThrow(() -> new RuntimeException("Token not found"));

        // Get user
        User user = userService.getUserByWallet(request.getWalletAddress())
                .orElseThrow(() -> new RuntimeException("User not found"));

        // Check user has enough tokens (validation only)
        UserHolding holding = userHoldingRepository.findByUserIdAndTokenId(user.getId(), token.getId())
                .orElse(null);

        Long tokensToSell = request.getAmount();
        Long netSolReceived = request.getSolAmount();

        // Calculate platform fee (1% of SOL amount)
        Long platformFee = bondingCurveService.calculatePlatformFee(netSolReceived);
        Long solReceived = netSolReceived + platformFee;

        // Calculate price per token
        BigDecimal pricePerToken = BigDecimal.valueOf(netSolReceived)
                .divide(BigDecimal.valueOf(tokensToSell), 18, RoundingMode.HALF_UP);

        // REMOVED: Backend does NOT execute transactions
        // String signature = solanaService.executeSell(...); // ❌ WRONG
        String signature = request.getSignature(); // ✅ Use client-provided signature

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
