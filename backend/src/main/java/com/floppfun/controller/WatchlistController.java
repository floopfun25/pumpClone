package com.floppfun.controller;

import com.floppfun.model.dto.TokenDTO;
import com.floppfun.service.WatchlistService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/watchlist")
@RequiredArgsConstructor
public class WatchlistController {

    private final WatchlistService watchlistService;

    /**
     * Get user's watchlist
     */
    @GetMapping
    public ResponseEntity<List<TokenDTO>> getWatchlist(Authentication authentication) {
        Long userId = getCurrentUserId(authentication);
        if (userId == null) {
            throw new RuntimeException("Authentication required");
        }

        List<TokenDTO> watchlist = watchlistService.getWatchlist(userId);
        return ResponseEntity.ok(watchlist);
    }

    /**
     * Add token to watchlist
     */
    @PostMapping("/tokens/{tokenId}")
    public ResponseEntity<Void> addToWatchlist(
            @PathVariable Long tokenId,
            Authentication authentication) {

        Long userId = getCurrentUserId(authentication);
        if (userId == null) {
            throw new RuntimeException("Authentication required");
        }

        watchlistService.addToWatchlist(userId, tokenId);
        return ResponseEntity.ok().build();
    }

    /**
     * Remove token from watchlist
     */
    @DeleteMapping("/tokens/{tokenId}")
    public ResponseEntity<Void> removeFromWatchlist(
            @PathVariable Long tokenId,
            Authentication authentication) {

        Long userId = getCurrentUserId(authentication);
        if (userId == null) {
            throw new RuntimeException("Authentication required");
        }

        watchlistService.removeFromWatchlist(userId, tokenId);
        return ResponseEntity.noContent().build();
    }

    /**
     * Check if token is in watchlist
     */
    @GetMapping("/tokens/{tokenId}/check")
    public ResponseEntity<WatchlistCheckDTO> checkWatchlist(
            @PathVariable Long tokenId,
            Authentication authentication) {

        Long userId = getCurrentUserId(authentication);
        if (userId == null) {
            return ResponseEntity.ok(new WatchlistCheckDTO(false));
        }

        boolean isInWatchlist = watchlistService.isInWatchlist(userId, tokenId);
        return ResponseEntity.ok(new WatchlistCheckDTO(isInWatchlist));
    }

    /**
     * Get current user ID from authentication
     */
    private Long getCurrentUserId(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return null;
        }

        try {
            return Long.parseLong(authentication.getName());
        } catch (NumberFormatException e) {
            log.warn("Failed to parse user ID from authentication: {}", authentication.getName());
            return null;
        }
    }

    /**
     * DTO for watchlist check response
     */
    @lombok.Data
    @lombok.AllArgsConstructor
    public static class WatchlistCheckDTO {
        private Boolean isInWatchlist;
    }
}
