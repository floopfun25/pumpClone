package com.floppfun.model.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "user_holdings",
    uniqueConstraints = {
        @UniqueConstraint(columnNames = {"user_id", "token_id"})
    },
    indexes = {
        @Index(name = "idx_user_holdings_user", columnList = "user_id"),
        @Index(name = "idx_user_holdings_token", columnList = "token_id")
    }
)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserHolding {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "token_id", nullable = false)
    private Token token;

    @Column(name = "amount", nullable = false)
    @Builder.Default
    private Long amount = 0L;

    @Column(name = "average_price", precision = 20, scale = 9)
    @Builder.Default
    private BigDecimal averagePrice = BigDecimal.ZERO;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
