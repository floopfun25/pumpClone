package com.floppfun.controller;

import com.floppfun.model.dto.UserDTO;
import com.floppfun.model.entity.User;
import com.floppfun.security.JwtTokenProvider;
import com.floppfun.service.SolanaService;
import com.floppfun.service.UserService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final JwtTokenProvider jwtTokenProvider;
    private final SolanaService solanaService;
    private final UserService userService;

    /**
     * Login with wallet signature
     */
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        log.info("Login attempt for wallet: {}", request.getWalletAddress());

        // Verify wallet signature
        boolean isValid = solanaService.verifyWalletSignature(
                request.getWalletAddress(),
                request.getMessage(),
                request.getSignature()
        );

        if (!isValid) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid wallet signature"));
        }

        // Get or create user
        User user = userService.getOrCreateUser(request.getWalletAddress());

        // Generate JWT token
        String token = jwtTokenProvider.generateToken(request.getWalletAddress());

        // Return response
        Map<String, Object> response = new HashMap<>();
        response.put("token", token);
        response.put("user", userService.toDTO(user));

        return ResponseEntity.ok(response);
    }

    /**
     * Verify JWT token
     */
    @PostMapping("/verify")
    public ResponseEntity<?> verify(@RequestHeader("Authorization") String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid authorization header"));
        }

        String token = authHeader.substring(7);
        boolean isValid = jwtTokenProvider.validateToken(token);

        if (!isValid) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid or expired token"));
        }

        String walletAddress = jwtTokenProvider.getWalletAddressFromToken(token);
        User user = userService.getUserByWallet(walletAddress)
                .orElseThrow(() -> new RuntimeException("User not found"));

        return ResponseEntity.ok(Map.of(
                "valid", true,
                "user", userService.toDTO(user)
        ));
    }

    @Data
    static class LoginRequest {
        private String walletAddress;
        private String message;
        private String signature;
    }
}
