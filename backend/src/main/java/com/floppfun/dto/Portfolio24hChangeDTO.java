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
public class Portfolio24hChangeDTO {
    private BigDecimal valueChange;
    private BigDecimal percentChange;
    private BigDecimal currentValue;
    private BigDecimal previousValue;
}
