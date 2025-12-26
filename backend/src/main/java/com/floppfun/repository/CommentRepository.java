package com.floppfun.repository;

import com.floppfun.entity.Comment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CommentRepository extends JpaRepository<Comment, Long> {

    /**
     * Get comments for a token (paginated)
     */
    @Query("SELECT c FROM Comment c WHERE c.token.id = :tokenId " +
           "ORDER BY c.createdAt DESC")
    Page<Comment> findByTokenId(@Param("tokenId") Long tokenId, Pageable pageable);

    /**
     * Get comments by user (paginated)
     */
    @Query("SELECT c FROM Comment c WHERE c.user.id = :userId " +
           "ORDER BY c.createdAt DESC")
    Page<Comment> findByUserId(@Param("userId") Long userId, Pageable pageable);

    /**
     * Count comments for a token
     */
    Long countByTokenId(Long tokenId);

    /**
     * Get latest comments for a token (limited)
     */
    @Query("SELECT c FROM Comment c WHERE c.token.id = :tokenId " +
           "ORDER BY c.createdAt DESC LIMIT :limit")
    List<Comment> findLatestByTokenId(@Param("tokenId") Long tokenId, @Param("limit") int limit);
}
