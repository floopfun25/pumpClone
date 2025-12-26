package com.floppfun.entity;

import com.floppfun.model.entity.Token;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "token_holders",
    indexes = {
        @Index(name = "idx_token_balance", columnList = "token_id,balance DESC"),
        @Index(name = "idx_wallet_tokens", columnList = "wallet_address")
    },
    uniqueConstraints = {
        @UniqueConstraint(name = "unique_token_holder", columnNames = {"token_id", "wallet_address"})
    }
)
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TokenHolder {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "token_id", nullable = false)
    private Token token;

    @Column(nullable = false, length = 44)
    private String walletAddress;

    @Column(nullable = false)
    private Long balance;

    @Column(precision = 5, scale = 2)
    private BigDecimal percentage;

    @Column(name = "first_acquired_at")
    private LocalDateTime firstAcquiredAt;

    @Column(name = "last_updated_at", nullable = false)
    private LocalDateTime lastUpdatedAt;

    @PrePersist
    @PreUpdate
    protected void onUpdate() {
        lastUpdatedAt = LocalDateTime.now();
        if (firstAcquiredAt == null) {
            firstAcquiredAt = LocalDateTime.now();
        }
    }
}
