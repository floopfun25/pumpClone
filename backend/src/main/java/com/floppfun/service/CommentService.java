package com.floppfun.service;

import com.floppfun.dto.CommentCreateRequest;
import com.floppfun.dto.CommentDTO;
import com.floppfun.entity.Comment;
import com.floppfun.entity.CommentLike;
import com.floppfun.model.entity.Token;
import com.floppfun.model.entity.User;
import com.floppfun.repository.CommentLikeRepository;
import com.floppfun.repository.CommentRepository;
import com.floppfun.repository.TokenRepository;
import com.floppfun.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class CommentService {

    private final CommentRepository commentRepository;
    private final CommentLikeRepository commentLikeRepository;
    private final TokenRepository tokenRepository;
    private final UserRepository userRepository;

    /**
     * Get comments for a token
     */
    @Transactional(readOnly = true)
    public Page<CommentDTO> getTokenComments(Long tokenId, Long currentUserId, Pageable pageable) {
        Page<Comment> comments = commentRepository.findByTokenId(tokenId, pageable);

        return comments.map(comment -> toDTO(comment, currentUserId));
    }

    /**
     * Create a new comment
     */
    @Transactional
    public CommentDTO createComment(Long tokenId, Long userId, CommentCreateRequest request) {
        Token token = tokenRepository.findById(tokenId)
            .orElseThrow(() -> new RuntimeException("Token not found"));

        User user = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("User not found"));

        Comment comment = new Comment();
        comment.setToken(token);
        comment.setUser(user);
        comment.setContent(request.getContent());
        comment.setLikesCount(0);

        Comment savedComment = commentRepository.save(comment);
        log.info("Comment created: id={}, tokenId={}, userId={}", savedComment.getId(), tokenId, userId);

        return toDTO(savedComment, userId);
    }

    /**
     * Update a comment
     */
    @Transactional
    public CommentDTO updateComment(Long commentId, Long userId, CommentCreateRequest request) {
        Comment comment = commentRepository.findById(commentId)
            .orElseThrow(() -> new RuntimeException("Comment not found"));

        // Verify user owns the comment
        if (!comment.getUser().getId().equals(userId)) {
            throw new RuntimeException("Not authorized to update this comment");
        }

        comment.setContent(request.getContent());
        Comment updatedComment = commentRepository.save(comment);

        log.info("Comment updated: id={}", commentId);
        return toDTO(updatedComment, userId);
    }

    /**
     * Delete a comment
     */
    @Transactional
    public void deleteComment(Long commentId, Long userId) {
        Comment comment = commentRepository.findById(commentId)
            .orElseThrow(() -> new RuntimeException("Comment not found"));

        // Verify user owns the comment
        if (!comment.getUser().getId().equals(userId)) {
            throw new RuntimeException("Not authorized to delete this comment");
        }

        commentRepository.delete(comment);
        log.info("Comment deleted: id={}", commentId);
    }

    /**
     * Like a comment
     */
    @Transactional
    public void likeComment(Long commentId, Long userId) {
        Comment comment = commentRepository.findById(commentId)
            .orElseThrow(() -> new RuntimeException("Comment not found"));

        User user = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("User not found"));

        // Check if already liked
        if (commentLikeRepository.findByCommentIdAndUserId(commentId, userId).isPresent()) {
            throw new RuntimeException("Already liked this comment");
        }

        CommentLike like = new CommentLike();
        like.setComment(comment);
        like.setUser(user);
        commentLikeRepository.save(like);

        // Update likes count
        comment.setLikesCount(comment.getLikesCount() + 1);
        commentRepository.save(comment);

        log.info("Comment liked: commentId={}, userId={}", commentId, userId);
    }

    /**
     * Unlike a comment
     */
    @Transactional
    public void unlikeComment(Long commentId, Long userId) {
        Comment comment = commentRepository.findById(commentId)
            .orElseThrow(() -> new RuntimeException("Comment not found"));

        CommentLike like = commentLikeRepository.findByCommentIdAndUserId(commentId, userId)
            .orElseThrow(() -> new RuntimeException("Comment not liked yet"));

        commentLikeRepository.delete(like);

        // Update likes count
        comment.setLikesCount(Math.max(0, comment.getLikesCount() - 1));
        commentRepository.save(comment);

        log.info("Comment unliked: commentId={}, userId={}", commentId, userId);
    }

    /**
     * Convert entity to DTO
     */
    private CommentDTO toDTO(Comment comment, Long currentUserId) {
        boolean isLiked = false;
        if (currentUserId != null) {
            isLiked = commentLikeRepository.findByCommentIdAndUserId(comment.getId(), currentUserId).isPresent();
        }

        return new CommentDTO(
            comment.getId(),
            comment.getToken().getId(),
            comment.getUser().getId(),
            comment.getUser().getWalletAddress(),
            comment.getUser().getUsername(),
            comment.getContent(),
            comment.getLikesCount(),
            isLiked,
            comment.getCreatedAt(),
            comment.getUpdatedAt()
        );
    }
}
