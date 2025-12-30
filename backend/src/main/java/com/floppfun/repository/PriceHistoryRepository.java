package com.floppfun.repository;

import com.floppfun.model.entity.PriceHistory;
import com.floppfun.model.entity.Token;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface PriceHistoryRepository extends JpaRepository<PriceHistory, Long> {

    /**
     * Find price history for a token within a time range
     */
    List<PriceHistory> findByTokenAndTimestampBetweenOrderByTimestampAsc(
            Token token,
            Instant startTime,
            Instant endTime
    );

    /**
     * Find price history for a token after a certain time
     */
    List<PriceHistory> findByTokenAndTimestampAfterOrderByTimestampAsc(
            Token token,
            Instant startTime
    );

    /**
     * Delete old price history data (for cleanup/maintenance)
     */
    void deleteByTimestampBefore(Instant cutoffTime);

    /**
     * Count price points for a token
     */
    long countByToken(Token token);
}
