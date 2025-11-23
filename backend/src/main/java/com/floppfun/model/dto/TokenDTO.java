package com.floppfun.model.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TokenDTO {
    private Long id;
    private String mintAddress;
    private String name;
    private String symbol;
    private String description;
    private String imageUrl;
    private String metadataUri;
    private UserDTO creator;
    private Long totalSupply;
    private Integer decimals;
    private BigDecimal currentPrice;
    private BigDecimal marketCap;
    private BigDecimal volume24h;
    private Integer holdersCount;
    private String status;
    private BigDecimal bondingCurveProgress;
    private String website;
    private String twitter;
    private String telegram;
    private String discord;
    private Boolean isNsfw;
    private Boolean isFeatured;
    private LocalDateTime createdAt;
    private LocalDateTime lastTradeAt;
}
