package com.floppfun.model.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "transactions", indexes = {
    @Index(name = "idx_signature", columnList = "signature", unique = true),
    @Index(name = "idx_token_id", columnList = "token_id"),
    @Index(name = "idx_user_id", columnList = "user_id"),
    @Index(name = "idx_created_at", columnList = "created_at")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Transaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "signature", nullable = false, unique = true, length = 88)
    private String signature;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "token_id", nullable = false)
    private Token token;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(name = "transaction_type", nullable = false, length = 10)
    private TransactionType transactionType;

    @Column(name = "sol_amount", nullable = false)
    private Long solAmount;

    @Column(name = "token_amount", nullable = false)
    private Long tokenAmount;

    @Column(name = "price_per_token", precision = 20, scale = 9)
    private BigDecimal pricePerToken;

    @Column(name = "bonding_curve_price", precision = 20, scale = 9)
    private BigDecimal bondingCurvePrice;

    @Column(name = "slippage_percentage", precision = 5, scale = 2)
    private BigDecimal slippagePercentage;

    @Column(name = "platform_fee")
    @Builder.Default
    private Long platformFee = 0L;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 20)
    @Builder.Default
    private TransactionStatus status = TransactionStatus.CONFIRMED;

    @Column(name = "block_time")
    private LocalDateTime blockTime;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    public enum TransactionType {
        BUY,
        SELL,
        CREATE
    }

    public enum TransactionStatus {
        PENDING,
        CONFIRMED,
        FAILED
    }
}
