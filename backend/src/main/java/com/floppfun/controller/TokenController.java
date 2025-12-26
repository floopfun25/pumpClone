package com.floppfun.controller;

import com.floppfun.dto.PricePointDTO;
import com.floppfun.dto.TokenHolderDTO;
import com.floppfun.model.dto.TokenCreateRequest;
import com.floppfun.model.dto.TokenDTO;
import com.floppfun.model.entity.Token;
import com.floppfun.service.TokenService;
import com.floppfun.service.TokenPriceService;
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
        Token token = tokenService.getTokenById(id)
                .orElseThrow(() -> new RuntimeException("Token not found"));

        return ResponseEntity.ok(tokenService.toDTO(token));
    }

    /**
     * Get token by mint address
     */
    @GetMapping("/mint/{mintAddress}")
    public ResponseEntity<TokenDTO> getTokenByMintAddress(@PathVariable String mintAddress) {
        Token token = tokenService.getTokenByMintAddress(mintAddress)
                .orElseThrow(() -> new RuntimeException("Token not found"));

        return ResponseEntity.ok(tokenService.toDTO(token));
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
     * Create a new token
     */
    @PostMapping("/create")
    public ResponseEntity<TokenDTO> createToken(
            @Valid @ModelAttribute TokenCreateRequest request,
            Authentication authentication) {

        try {
            Token token = tokenService.createToken(request);
            return ResponseEntity.ok(tokenService.toDTO(token));
        } catch (Exception e) {
            log.error("Error creating token", e);
            throw new RuntimeException("Failed to create token: " + e.getMessage());
        }
    }

    /**
     * Get price history for a token
     * Timeframe options: 5m, 1h, 24h, 7d, 30d
     */
    @GetMapping("/{id}/price-history")
    public ResponseEntity<List<PricePointDTO>> getPriceHistory(
            @PathVariable Long id,
            @RequestParam(defaultValue = "24h") String timeframe) {

        List<PricePointDTO> priceHistory = tokenPriceService.getPriceHistory(id, timeframe);
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
}
