package com.floppfun.repository;

import com.floppfun.entity.TokenPrice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface TokenPriceRepository extends JpaRepository<TokenPrice, Long> {

    /**
     * Get price history for a token within a time range
     */
    @Query("SELECT tp FROM TokenPrice tp WHERE tp.token.id = :tokenId " +
           "AND tp.timestamp >= :startTime ORDER BY tp.timestamp ASC")
    List<TokenPrice> findPriceHistory(
        @Param("tokenId") Long tokenId,
        @Param("startTime") LocalDateTime startTime
    );

    /**
     * Get latest price for a token
     */
    @Query("SELECT tp FROM TokenPrice tp WHERE tp.token.id = :tokenId " +
           "ORDER BY tp.timestamp DESC LIMIT 1")
    TokenPrice findLatestPrice(@Param("tokenId") Long tokenId);

    /**
     * Delete old price records (for cleanup)
     */
    void deleteByTimestampBefore(LocalDateTime cutoffTime);
}
