package com.floppfun.model.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Price History DTO for API responses
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PriceHistoryDTO {
    private BigDecimal price;
    private BigDecimal volume;
    private BigDecimal marketCap;
    private Instant timestamp;
    private String tradeType;

    // OHLCV fields (for aggregated candlestick data)
    private BigDecimal open;
    private BigDecimal high;
    private BigDecimal low;
    private BigDecimal close;
}
