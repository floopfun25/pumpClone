package com.floppfun.model.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Price History Entity
 * Stores individual price points for generating OHLCV candlestick charts
 */
@Entity
@Table(name = "price_history", indexes = {
        @Index(name = "idx_token_timestamp", columnList = "token_id, timestamp"),
        @Index(name = "idx_timestamp", columnList = "timestamp")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PriceHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "token_id", nullable = false)
    private Token token;

    @Column(nullable = false, precision = 30, scale = 18)
    private BigDecimal price;

    @Column(nullable = false, precision = 30, scale = 18)
    private BigDecimal volume;

    @Column(nullable = false, precision = 30, scale = 18)
    private BigDecimal marketCap;

    @Column(nullable = false)
    private Instant timestamp;

    @Column(length = 10)
    private String tradeType; // "BUY" or "SELL"

    public PriceHistory(Token token, BigDecimal price, BigDecimal volume, BigDecimal marketCap, Instant timestamp, String tradeType) {
        this.token = token;
        this.price = price;
        this.volume = volume;
        this.marketCap = marketCap;
        this.timestamp = timestamp;
        this.tradeType = tradeType;
    }
}
