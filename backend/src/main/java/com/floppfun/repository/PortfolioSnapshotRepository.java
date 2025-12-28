package com.floppfun.repository;

import com.floppfun.model.entity.PortfolioSnapshot;
import com.floppfun.model.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Optional;

@Repository
public interface PortfolioSnapshotRepository extends JpaRepository<PortfolioSnapshot, Long> {

    /**
     * Find the most recent snapshot for a user
     */
    Optional<PortfolioSnapshot> findFirstByUserOrderByCreatedAtDesc(User user);

    /**
     * Find snapshot from approximately 24 hours ago
     */
    @Query("SELECT ps FROM PortfolioSnapshot ps WHERE ps.user = :user " +
           "AND ps.createdAt >= :startTime AND ps.createdAt <= :endTime " +
           "ORDER BY ps.createdAt DESC")
    Optional<PortfolioSnapshot> findSnapshot24hAgo(
        @Param("user") User user,
        @Param("startTime") LocalDateTime startTime,
        @Param("endTime") LocalDateTime endTime
    );

    /**
     * Delete old snapshots (older than 30 days) to save space
     */
    void deleteByCreatedAtBefore(LocalDateTime cutoffDate);
}
