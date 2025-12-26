package com.floppfun.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TokenHolderDTO {
    private Long id;
    private String walletAddress;
    private Long balance;
    private BigDecimal percentage;
    private LocalDateTime firstAcquiredAt;
    private LocalDateTime lastUpdatedAt;
}
