package com.floppfun.controller;

import com.floppfun.dto.CommentCreateRequest;
import com.floppfun.dto.CommentDTO;
import com.floppfun.model.entity.User;
import com.floppfun.repository.UserRepository;
import com.floppfun.service.CommentService;
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
@RequestMapping("/tokens/{tokenId}/comments")
@RequiredArgsConstructor
public class CommentController {

    private final CommentService commentService;
    private final UserRepository userRepository;

    /**
     * Get comments for a token
     */
    @GetMapping
    public ResponseEntity<Page<CommentDTO>> getComments(
            @PathVariable Long tokenId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            Authentication authentication) {

        Long currentUserId = getCurrentUserId(authentication);
        Pageable pageable = PageRequest.of(page, size);
        Page<CommentDTO> comments = commentService.getTokenComments(tokenId, currentUserId, pageable);

        return ResponseEntity.ok(comments);
    }

    /**
     * Create a new comment
     */
    @PostMapping
    public ResponseEntity<CommentDTO> createComment(
            @PathVariable Long tokenId,
            @Valid @RequestBody CommentCreateRequest request,
            Authentication authentication) {

        Long userId = getCurrentUserId(authentication);
        if (userId == null) {
            throw new RuntimeException("Authentication required");
        }

        CommentDTO comment = commentService.createComment(tokenId, userId, request);
        return ResponseEntity.ok(comment);
    }

    /**
     * Update a comment
     */
    @PutMapping("/{commentId}")
    public ResponseEntity<CommentDTO> updateComment(
            @PathVariable Long tokenId,
            @PathVariable Long commentId,
            @Valid @RequestBody CommentCreateRequest request,
            Authentication authentication) {

        Long userId = getCurrentUserId(authentication);
        if (userId == null) {
            throw new RuntimeException("Authentication required");
        }

        CommentDTO comment = commentService.updateComment(commentId, userId, request);
        return ResponseEntity.ok(comment);
    }

    /**
     * Delete a comment
     */
    @DeleteMapping("/{commentId}")
    public ResponseEntity<Void> deleteComment(
            @PathVariable Long tokenId,
            @PathVariable Long commentId,
            Authentication authentication) {

        Long userId = getCurrentUserId(authentication);
        if (userId == null) {
            throw new RuntimeException("Authentication required");
        }

        commentService.deleteComment(commentId, userId);
        return ResponseEntity.noContent().build();
    }

    /**
     * Like a comment
     */
    @PostMapping("/{commentId}/like")
    public ResponseEntity<Void> likeComment(
            @PathVariable Long tokenId,
            @PathVariable Long commentId,
            Authentication authentication) {

        Long userId = getCurrentUserId(authentication);
        if (userId == null) {
            throw new RuntimeException("Authentication required");
        }

        commentService.likeComment(commentId, userId);
        return ResponseEntity.ok().build();
    }

    /**
     * Unlike a comment
     */
    @DeleteMapping("/{commentId}/like")
    public ResponseEntity<Void> unlikeComment(
            @PathVariable Long tokenId,
            @PathVariable Long commentId,
            Authentication authentication) {

        Long userId = getCurrentUserId(authentication);
        if (userId == null) {
            throw new RuntimeException("Authentication required");
        }

        commentService.unlikeComment(commentId, userId);
        return ResponseEntity.ok().build();
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
