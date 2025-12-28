package com.floppfun.model.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TradeRequest {

    @NotBlank(message = "Token mint address is required")
    private String mintAddress;

    @NotNull(message = "Amount is required")
    @Min(value = 1, message = "Amount must be greater than 0")
    private Long amount;

    @NotNull(message = "SOL amount is required")
    private Long solAmount; // FIXED: Actual SOL amount from transaction

    @NotBlank(message = "Wallet address is required")
    private String walletAddress;

    private BigDecimal slippageTolerance; // Optional, default 1%

    @NotBlank(message = "Transaction signature is required")
    private String signature; // FIXED: On-chain transaction signature (not wallet signature)
}
