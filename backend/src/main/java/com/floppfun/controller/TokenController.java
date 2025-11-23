package com.floppfun.controller;

import com.floppfun.model.dto.TokenCreateRequest;
import com.floppfun.model.dto.TokenDTO;
import com.floppfun.model.entity.Token;
import com.floppfun.service.TokenService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/tokens")
@RequiredArgsConstructor
public class TokenController {

    private final TokenService tokenService;

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
}
