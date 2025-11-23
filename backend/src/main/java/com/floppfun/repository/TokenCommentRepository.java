package com.floppfun.repository;

import com.floppfun.model.entity.TokenComment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TokenCommentRepository extends JpaRepository<TokenComment, Long> {

    Page<TokenComment> findByTokenIdOrderByCreatedAtDesc(Long tokenId, Pageable pageable);

    Page<TokenComment> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);

    @Query("SELECT COUNT(c) FROM TokenComment c WHERE c.token.id = :tokenId")
    Long countByTokenId(@Param("tokenId") Long tokenId);

    @Query("SELECT c FROM TokenComment c WHERE c.token.id = :tokenId ORDER BY c.createdAt DESC")
    List<TokenComment> findRecentCommentsByTokenId(@Param("tokenId") Long tokenId, Pageable pageable);
}
