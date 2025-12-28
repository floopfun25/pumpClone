package com.floppfun.controller;

import com.floppfun.dto.Portfolio24hChangeDTO;
import com.floppfun.dto.PortfolioSnapshotRequest;
import com.floppfun.model.entity.User;
import com.floppfun.repository.UserRepository;
import com.floppfun.service.PortfolioSnapshotService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;

@Slf4j
@RestController
@RequestMapping("/portfolio")
@RequiredArgsConstructor
public class PortfolioController {

    private final PortfolioSnapshotService portfolioSnapshotService;
    private final UserRepository userRepository;

    /**
     * Store a portfolio snapshot (requires authentication)
     */
    @PostMapping("/snapshot")
    public ResponseEntity<Void> storeSnapshot(
            @RequestBody PortfolioSnapshotRequest request,
            Authentication authentication) {

        Long userId = getCurrentUserId(authentication);
        if (userId == null) {
            return ResponseEntity.status(401).build();
        }

        portfolioSnapshotService.storeSnapshot(userId, request);
        return ResponseEntity.ok().build();
    }

    /**
     * Get 24h portfolio change (requires authentication)
     */
    @GetMapping("/24h-change")
    public ResponseEntity<Portfolio24hChangeDTO> get24hChange(
            @RequestParam BigDecimal currentValue,
            Authentication authentication) {

        Long userId = getCurrentUserId(authentication);
        if (userId == null) {
            return ResponseEntity.status(401).build();
        }

        Portfolio24hChangeDTO change = portfolioSnapshotService.get24hChange(userId, currentValue);
        return ResponseEntity.ok(change);
    }

    /**
     * Get current user ID from authentication
     * Authentication contains wallet address, so we need to look up the user ID
     */
    private Long getCurrentUserId(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return null;
        }

        // Authentication.getName() returns the wallet address (from JWT token)
        String walletAddress = authentication.getName();

        // Look up user by wallet address
        return userRepository.findByWalletAddress(walletAddress)
                .map(User::getId)
                .orElse(null);
    }
}
