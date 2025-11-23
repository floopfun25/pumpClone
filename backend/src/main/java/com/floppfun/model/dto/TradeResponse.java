package com.floppfun.model.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TradeResponse {
    private String transactionSignature;
    private String tokenMintAddress;
    private Long solAmount;
    private Long tokenAmount;
    private BigDecimal pricePerToken;
    private BigDecimal newTokenPrice;
    private BigDecimal platformFee;
    private String status;
    private String message;
}
