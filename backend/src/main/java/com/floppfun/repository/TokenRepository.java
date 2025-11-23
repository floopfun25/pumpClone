package com.floppfun.repository;

import com.floppfun.model.entity.Token;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface TokenRepository extends JpaRepository<Token, Long> {

    Optional<Token> findByMintAddress(String mintAddress);

    boolean existsByMintAddress(String mintAddress);

    Page<Token> findByStatusOrderByCreatedAtDesc(Token.TokenStatus status, Pageable pageable);

    @Query("SELECT t FROM Token t WHERE t.status = :status ORDER BY t.volume24h DESC")
    Page<Token> findTrendingTokens(@Param("status") Token.TokenStatus status, Pageable pageable);

    @Query("SELECT t FROM Token t WHERE t.status = :status ORDER BY t.createdAt DESC")
    Page<Token> findLatestTokens(@Param("status") Token.TokenStatus status, Pageable pageable);

    @Query("SELECT t FROM Token t WHERE t.creator.id = :creatorId ORDER BY t.createdAt DESC")
    Page<Token> findByCreatorId(@Param("creatorId") Long creatorId, Pageable pageable);

    @Query("SELECT t FROM Token t WHERE " +
           "LOWER(t.name) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(t.symbol) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(t.description) LIKE LOWER(CONCAT('%', :query, '%'))")
    Page<Token> searchTokens(@Param("query") String query, Pageable pageable);

    @Query("SELECT t FROM Token t WHERE t.lastTradeAt > :since ORDER BY t.volume24h DESC")
    List<Token> findActiveTokens(@Param("since") LocalDateTime since, Pageable pageable);

    @Query("SELECT t FROM Token t WHERE t.isFeatured = true AND t.status = 'ACTIVE' ORDER BY t.createdAt DESC")
    List<Token> findFeaturedTokens(Pageable pageable);
}
