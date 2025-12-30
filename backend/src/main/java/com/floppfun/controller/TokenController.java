package com.floppfun.controller;

import com.floppfun.dto.PricePointDTO;
import com.floppfun.dto.TokenHolderDTO;
import com.floppfun.model.dto.PriceHistoryDTO;
import com.floppfun.model.dto.TokenCreateRequest;
import com.floppfun.model.dto.TokenDTO;
import com.floppfun.model.entity.Token;
import com.floppfun.service.TokenService;
import com.floppfun.service.TokenPriceService;
import com.floppfun.service.PriceHistoryService;
import com.floppfun.service.TokenHolderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/tokens")
@RequiredArgsConstructor
public class TokenController {

    private final TokenService tokenService;
    private final TokenPriceService tokenPriceService;
    private final PriceHistoryService priceHistoryService;
    private final TokenHolderService tokenHolderService;

    /**
     * Get all tokens (paginated)
     */
    @GetMapping
    public ResponseEntity<Page<TokenDTO>> getAllTokens(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        Pageable pageable = PageRequest.of(page, size);
        Page<TokenDTO> tokens = tokenService.getAllTokens(pageable)
                .map(tokenService::toDTO);

        return ResponseEntity.ok(tokens);
    }

    /**
     * Get token by ID
     */
    @GetMapping("/{id}")
    public ResponseEntity<TokenDTO> getTokenById(@PathVariable Long id) {
        return tokenService.getTokenById(id)
                .map(token -> ResponseEntity.ok(tokenService.toDTO(token)))
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Get token by mint address
     */
    @GetMapping("/mint/{mintAddress}")
    public ResponseEntity<TokenDTO> getTokenByMintAddress(@PathVariable String mintAddress) {
        return tokenService.getTokenByMintAddress(mintAddress)
                .map(token -> ResponseEntity.ok(tokenService.toDTO(token)))
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Get trending tokens
     */
    @GetMapping("/trending")
    public ResponseEntity<Page<TokenDTO>> getTrendingTokens(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        Pageable pageable = PageRequest.of(page, size);
        Page<TokenDTO> tokens = tokenService.getTrendingTokens(pageable)
                .map(tokenService::toDTO);

        return ResponseEntity.ok(tokens);
    }

    /**
     * Search tokens
     */
    @GetMapping("/search")
    public ResponseEntity<Page<TokenDTO>> searchTokens(
            @RequestParam String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        Pageable pageable = PageRequest.of(page, size);
        Page<TokenDTO> tokens = tokenService.searchTokens(q, pageable)
                .map(tokenService::toDTO);

        return ResponseEntity.ok(tokens);
    }

    /**
     * Get tokens by creator ID
     */
    @GetMapping("/creator/{creatorId}")
    public ResponseEntity<Page<TokenDTO>> getTokensByCreator(
            @PathVariable Long creatorId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        Pageable pageable = PageRequest.of(page, size);
        Page<TokenDTO> tokens = tokenService.getTokensByCreatorId(creatorId, pageable)
                .map(tokenService::toDTO);

        return ResponseEntity.ok(tokens);
    }

    /**
     * Create a new token
     */
    @PostMapping("/create")
    public ResponseEntity<TokenDTO> createToken(
            @Valid @ModelAttribute TokenCreateRequest request,
            Authentication authentication) {

        try {
            // Get wallet address from authenticated user
            String walletAddress = authentication.getName();
            log.info("Creating token for wallet: {}", walletAddress);

            Token token = tokenService.createToken(request, walletAddress);
            return ResponseEntity.ok(tokenService.toDTO(token));
        } catch (Exception e) {
            log.error("Error creating token", e);
            throw new RuntimeException("Failed to create token: " + e.getMessage());
        }
    }

    /**
     * Get price history for a token (OHLCV candlestick data)
     * Timeframe options: 1m, 5m, 15m, 30m, 1h, 4h, 24h, 7d, 30d
     */
    @GetMapping("/{id}/price-history")
    public ResponseEntity<List<PriceHistoryDTO>> getPriceHistory(
            @PathVariable Long id,
            @RequestParam(defaultValue = "24h") String timeframe) {

        Token token = tokenService.getTokenById(id)
                .orElseThrow(() -> new RuntimeException("Token not found"));

        List<PriceHistoryDTO> priceHistory = priceHistoryService.getPriceHistory(token, timeframe);
        return ResponseEntity.ok(priceHistory);
    }

    /**
     * Get 24h statistics for a token
     */
    @GetMapping("/{id}/stats")
    public ResponseEntity<TokenStatsDTO> getTokenStats(@PathVariable Long id) {
        TokenStatsDTO stats = new TokenStatsDTO();
        stats.setPriceChange24h(tokenPriceService.calculate24hPriceChange(id));
        stats.setVolume24h(tokenPriceService.calculate24hVolume(id));
        return ResponseEntity.ok(stats);
    }

    /**
     * Get top holders for a token
     */
    @GetMapping("/{id}/holders")
    public ResponseEntity<List<TokenHolderDTO>> getTopHolders(
            @PathVariable Long id,
            @RequestParam(defaultValue = "20") int limit) {

        List<TokenHolderDTO> holders = tokenHolderService.getTopHolders(id, limit);
        return ResponseEntity.ok(holders);
    }

    /**
     * Get number of holders for a token
     */
    @GetMapping("/{id}/holders/count")
    public ResponseEntity<HoldersCountDTO> getHoldersCount(@PathVariable Long id) {
        Long count = tokenHolderService.getHoldersCount(id);
        return ResponseEntity.ok(new HoldersCountDTO(count));
    }

    /**
     * Record price point after a trade (called by frontend after blockchain transaction)
     */
    @PostMapping("/{id}/record-trade")
    public ResponseEntity<Void> recordTradePrice(
            @PathVariable Long id,
            @RequestBody TradePriceRequest request) {

        Token token = tokenService.getTokenById(id)
                .orElseThrow(() -> new RuntimeException("Token not found"));

        priceHistoryService.recordPricePoint(
                token,
                request.getPrice(),
                request.getVolume(),
                request.getMarketCap(),
                request.getTradeType()
        );

        log.info("Recorded price point for token {}: price={}, type={}",
                id, request.getPrice(), request.getTradeType());

        return ResponseEntity.ok().build();
    }

    /**
     * DTO for token statistics
     */
    @lombok.Data
    public static class TokenStatsDTO {
        private java.math.BigDecimal priceChange24h;
        private java.math.BigDecimal volume24h;
    }

    /**
     * DTO for holders count
     */
    @lombok.Data
    @lombok.AllArgsConstructor
    public static class HoldersCountDTO {
        private Long count;
    }

    /**
     * DTO for recording trade price
     */
    @lombok.Data
    public static class TradePriceRequest {
        private java.math.BigDecimal price;
        private java.math.BigDecimal volume;
        private java.math.BigDecimal marketCap;
        private String tradeType; // "BUY" or "SELL"
    }
}
