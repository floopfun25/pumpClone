package com.floppfun.service;

import com.floppfun.model.dto.PriceHistoryDTO;
import com.floppfun.model.entity.PriceHistory;
import com.floppfun.model.entity.Token;
import com.floppfun.repository.PriceHistoryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class PriceHistoryService {

    private final PriceHistoryRepository priceHistoryRepository;

    /**
     * Record a price point when a trade occurs
     */
    @Transactional
    public void recordPricePoint(Token token, BigDecimal price, BigDecimal volume, BigDecimal marketCap, String tradeType) {
        PriceHistory priceHistory = new PriceHistory(
                token,
                price,
                volume,
                marketCap,
                Instant.now(),
                tradeType
        );
        priceHistoryRepository.save(priceHistory);
        log.info("Recorded price history for token {} at price {}", token.getId(), price);
    }

    /**
     * Get price history aggregated into OHLCV candlesticks for different timeframes
     */
    public List<PriceHistoryDTO> getPriceHistory(Token token, String timeframe) {
        Instant endTime = Instant.now();
        Instant startTime = calculateStartTime(endTime, timeframe);

        // Fetch raw price points from database
        List<PriceHistory> pricePoints = priceHistoryRepository
                .findByTokenAndTimestampBetweenOrderByTimestampAsc(token, startTime, endTime);

        if (pricePoints.isEmpty()) {
            log.warn("No price history found for token {}, timeframe {}", token.getId(), timeframe);
            return Collections.emptyList();
        }

        // Aggregate into OHLCV candles based on timeframe
        return aggregateToOHLCV(pricePoints, timeframe);
    }

    /**
     * Calculate start time based on timeframe
     */
    private Instant calculateStartTime(Instant endTime, String timeframe) {
        return switch (timeframe) {
            case "1m" -> endTime.minus(120, ChronoUnit.MINUTES);  // 2 hours
            case "5m" -> endTime.minus(12, ChronoUnit.HOURS);     // 12 hours
            case "15m" -> endTime.minus(1, ChronoUnit.DAYS);      // 24 hours
            case "30m" -> endTime.minus(2, ChronoUnit.DAYS);      // 48 hours
            case "1h" -> endTime.minus(3, ChronoUnit.DAYS);       // 3 days
            case "4h" -> endTime.minus(15, ChronoUnit.DAYS);      // 15 days
            case "24h", "1d" -> endTime.minus(30, ChronoUnit.DAYS); // 30 days
            case "7d", "1w" -> endTime.minus(210, ChronoUnit.DAYS); // 30 weeks
            case "30d", "1M" -> endTime.minus(720, ChronoUnit.DAYS); // 24 months
            default -> endTime.minus(1, ChronoUnit.DAYS);         // Default to 24 hours
        };
    }

    /**
     * Get interval duration for a timeframe
     */
    private Duration getIntervalDuration(String timeframe) {
        return switch (timeframe) {
            case "1m" -> Duration.ofMinutes(1);
            case "5m" -> Duration.ofMinutes(5);
            case "15m" -> Duration.ofMinutes(15);
            case "30m" -> Duration.ofMinutes(30);
            case "1h" -> Duration.ofHours(1);
            case "4h" -> Duration.ofHours(4);
            case "24h", "1d" -> Duration.ofDays(1);
            case "7d", "1w" -> Duration.ofDays(7);
            case "30d", "1M" -> Duration.ofDays(30);
            default -> Duration.ofHours(1);
        };
    }

    /**
     * Aggregate price points into OHLCV candlesticks
     */
    private List<PriceHistoryDTO> aggregateToOHLCV(List<PriceHistory> pricePoints, String timeframe) {
        Duration intervalDuration = getIntervalDuration(timeframe);
        long intervalMillis = intervalDuration.toMillis();

        // Group price points by interval
        Map<Long, List<PriceHistory>> groupedByInterval = pricePoints.stream()
                .collect(Collectors.groupingBy(
                        (PriceHistory point) -> (point.getTimestamp().toEpochMilli() / intervalMillis) * intervalMillis
                ));

        // Convert each group to an OHLCV candle
        return groupedByInterval.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(entry -> {
                    Long intervalStart = entry.getKey();
                    List<PriceHistory> points = entry.getValue();

                    // Sort by timestamp to ensure correct OHLC
                    points.sort(Comparator.comparing(PriceHistory::getTimestamp));

                    BigDecimal open = points.get(0).getPrice();
                    BigDecimal close = points.get(points.size() - 1).getPrice();
                    BigDecimal high = points.stream()
                            .map(PriceHistory::getPrice)
                            .max(BigDecimal::compareTo)
                            .orElse(open);
                    BigDecimal low = points.stream()
                            .map(PriceHistory::getPrice)
                            .min(BigDecimal::compareTo)
                            .orElse(open);
                    BigDecimal totalVolume = points.stream()
                            .map(PriceHistory::getVolume)
                            .reduce(BigDecimal.ZERO, BigDecimal::add);

                    // Use the last market cap in the interval
                    BigDecimal marketCap = points.get(points.size() - 1).getMarketCap();

                    PriceHistoryDTO dto = new PriceHistoryDTO();
                    dto.setTimestamp(Instant.ofEpochMilli(intervalStart));
                    dto.setOpen(open);
                    dto.setHigh(high);
                    dto.setLow(low);
                    dto.setClose(close);
                    dto.setVolume(totalVolume);
                    dto.setMarketCap(marketCap);
                    dto.setPrice(close); // Set current price to close price

                    return dto;
                })
                .collect(Collectors.toList());
    }

    /**
     * Clean up old price history data (optional maintenance task)
     */
    @Transactional
    public void cleanupOldData(int daysToKeep) {
        Instant cutoffTime = Instant.now().minus(daysToKeep, ChronoUnit.DAYS);
        priceHistoryRepository.deleteByTimestampBefore(cutoffTime);
        log.info("Cleaned up price history data older than {} days", daysToKeep);
    }
}
