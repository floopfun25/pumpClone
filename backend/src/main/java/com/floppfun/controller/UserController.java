package com.floppfun.controller;

import com.floppfun.model.dto.UserDTO;
import com.floppfun.model.entity.User;
import com.floppfun.model.entity.UserHolding;
import com.floppfun.repository.UserHoldingRepository;
import com.floppfun.service.UserService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;
    private final UserHoldingRepository userHoldingRepository;

    /**
     * Get user profile by ID
     */
    @GetMapping("/{id}")
    public ResponseEntity<UserDTO> getUserById(@PathVariable Long id) {
        User user = userService.getUserById(id)
                .orElseThrow(() -> new RuntimeException("User not found"));

        return ResponseEntity.ok(userService.toDTO(user));
    }

    /**
     * Get user profile by wallet address
     */
    @GetMapping("/wallet/{walletAddress}")
    public ResponseEntity<UserDTO> getUserByWallet(@PathVariable String walletAddress) {
        return userService.getUserByWallet(walletAddress)
                .map(user -> ResponseEntity.ok(userService.toDTO(user)))
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Get current user profile
     */
    @GetMapping("/profile")
    public ResponseEntity<UserDTO> getCurrentUser(Authentication authentication) {
        String walletAddress = authentication.getName();
        User user = userService.getUserByWallet(walletAddress)
                .orElseThrow(() -> new RuntimeException("User not found"));

        return ResponseEntity.ok(userService.toDTO(user));
    }

    /**
     * Update user profile
     */
    @PutMapping("/profile")
    public ResponseEntity<UserDTO> updateProfile(
            @RequestBody UpdateProfileRequest request,
            Authentication authentication) {

        String walletAddress = authentication.getName();
        User user = userService.updateProfile(
                walletAddress,
                request.getUsername(),
                request.getBio(),
                request.getAvatarUrl(),
                request.getTwitterHandle(),
                request.getTelegramHandle()
        );

        return ResponseEntity.ok(userService.toDTO(user));
    }

    /**
     * Get user holdings
     */
    @GetMapping("/{id}/holdings")
    public ResponseEntity<List<Map<String, Object>>> getUserHoldings(@PathVariable Long id) {
        List<UserHolding> holdings = userHoldingRepository.findActiveHoldingsByUserId(id);

        List<Map<String, Object>> response = holdings.stream()
                .map(holding -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("tokenId", holding.getToken().getId());
                    map.put("tokenName", holding.getToken().getName());
                    map.put("tokenSymbol", holding.getToken().getSymbol());
                    map.put("mintAddress", holding.getToken().getMintAddress());
                    map.put("imageUrl", holding.getToken().getImageUrl());
                    map.put("amount", holding.getAmount());
                    map.put("averagePrice", holding.getAveragePrice());
                    map.put("currentPrice", holding.getToken().getCurrentPrice());
                    map.put("updatedAt", holding.getUpdatedAt());
                    return map;
                })
                .collect(Collectors.toList());

        return ResponseEntity.ok(response);
    }

    @Data
    static class UpdateProfileRequest {
        private String username;
        private String bio;
        private String avatarUrl;
        private String twitterHandle;
        private String telegramHandle;
    }
}
