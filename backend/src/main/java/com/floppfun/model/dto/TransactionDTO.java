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
public class TransactionDTO {
    private Long id;
    private String signature;
    private Long tokenId;
    private String tokenSymbol;
    private String tokenName;
    private Long userId;
    private String userWalletAddress;
    private String transactionType;
    private Long solAmount;
    private Long tokenAmount;
    private BigDecimal pricePerToken;
    private BigDecimal platformFee;
    private String status;
    private LocalDateTime blockTime;
    private LocalDateTime createdAt;
}
