package com.floppfun.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PortfolioSnapshotRequest {
    private BigDecimal totalValue;
    private BigDecimal solBalance;
    private BigDecimal solValue;
    private BigDecimal tokenValue;
    private Integer tokenCount;
}
