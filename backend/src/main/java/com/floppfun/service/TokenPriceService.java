package com.floppfun.service;

import com.floppfun.dto.PricePointDTO;
import com.floppfun.model.entity.Token;
import com.floppfun.entity.TokenPrice;
import com.floppfun.repository.TokenPriceRepository;
import com.floppfun.repository.TokenRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class TokenPriceService {

    private final TokenPriceRepository tokenPriceRepository;
    private final TokenRepository tokenRepository;

    /**
     * Get price history for a token based on timeframe
     */
    @Transactional(readOnly = true)
    public List<PricePointDTO> getPriceHistory(Long tokenId, String timeframe) {
        LocalDateTime startTime = calculateStartTime(timeframe);

        List<TokenPrice> prices = tokenPriceRepository.findPriceHistory(tokenId, startTime);

        return prices.stream()
            .map(p -> new PricePointDTO(
                p.getTimestamp(),
                p.getPrice(),
                p.getMarketCap(),
                p.getVolume()
            ))
            .collect(Collectors.toList());
    }

    /**
     * Record a new price point
     */
    @Transactional
    public void recordPrice(Long tokenId, BigDecimal price, BigDecimal marketCap, BigDecimal volume) {
        Token token = tokenRepository.findById(tokenId)
            .orElseThrow(() -> new RuntimeException("Token not found"));

        TokenPrice tokenPrice = new TokenPrice();
        tokenPrice.setToken(token);
        tokenPrice.setPrice(price);
        tokenPrice.setMarketCap(marketCap);
        tokenPrice.setVolume(volume);
        tokenPrice.setTimestamp(LocalDateTime.now());

        tokenPriceRepository.save(tokenPrice);
        log.debug("Recorded price {} for token {}", price, tokenId);
    }

    /**
     * Calculate 24h price change percentage
     */
    @Transactional(readOnly = true)
    public BigDecimal calculate24hPriceChange(Long tokenId) {
        LocalDateTime dayAgo = LocalDateTime.now().minusHours(24);
        List<TokenPrice> prices = tokenPriceRepository.findPriceHistory(tokenId, dayAgo);

        if (prices.isEmpty()) {
            return BigDecimal.ZERO;
        }

        BigDecimal oldPrice = prices.get(0).getPrice();
        BigDecimal currentPrice = prices.get(prices.size() - 1).getPrice();

        if (oldPrice.compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.ZERO;
        }

        // Calculate percentage change: ((current - old) / old) * 100
        return currentPrice.subtract(oldPrice)
            .divide(oldPrice, 4, java.math.RoundingMode.HALF_UP)
            .multiply(new BigDecimal("100"));
    }

    /**
     * Calculate 24h volume
     */
    @Transactional(readOnly = true)
    public BigDecimal calculate24hVolume(Long tokenId) {
        LocalDateTime dayAgo = LocalDateTime.now().minusHours(24);
        List<TokenPrice> prices = tokenPriceRepository.findPriceHistory(tokenId, dayAgo);

        return prices.stream()
            .map(TokenPrice::getVolume)
            .filter(v -> v != null)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /**
     * Clean up old price records (keep only last 30 days)
     */
    @Transactional
    public void cleanupOldPrices() {
        LocalDateTime cutoff = LocalDateTime.now().minusDays(30);
        tokenPriceRepository.deleteByTimestampBefore(cutoff);
        log.info("Cleaned up price records older than {}", cutoff);
    }

    private LocalDateTime calculateStartTime(String timeframe) {
        LocalDateTime now = LocalDateTime.now();

        return switch (timeframe.toLowerCase()) {
            case "5m" -> now.minusMinutes(5);
            case "1h" -> now.minusHours(1);
            case "24h" -> now.minusHours(24);
            case "7d" -> now.minusDays(7);
            case "30d" -> now.minusDays(30);
            default -> now.minusHours(24); // Default to 24h
        };
    }
}
