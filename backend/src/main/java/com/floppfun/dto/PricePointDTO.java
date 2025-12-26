package com.floppfun.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PricePointDTO {
    private LocalDateTime timestamp;
    private BigDecimal price;
    private BigDecimal marketCap;
    private BigDecimal volume;
}
