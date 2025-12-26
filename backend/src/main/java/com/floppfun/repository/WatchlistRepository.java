package com.floppfun.repository;

import com.floppfun.entity.Watchlist;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface WatchlistRepository extends JpaRepository<Watchlist, Long> {

    /**
     * Find watchlist entry by user and token
     */
    Optional<Watchlist> findByUserIdAndTokenId(Long userId, Long tokenId);

    /**
     * Get all watchlist entries for a user
     */
    @Query("SELECT w FROM Watchlist w WHERE w.user.id = :userId " +
           "ORDER BY w.createdAt DESC")
    List<Watchlist> findByUserId(@Param("userId") Long userId);

    /**
     * Check if token is in user's watchlist
     */
    boolean existsByUserIdAndTokenId(Long userId, Long tokenId);

    /**
     * Delete watchlist entry by user and token
     */
    void deleteByUserIdAndTokenId(Long userId, Long tokenId);
}
