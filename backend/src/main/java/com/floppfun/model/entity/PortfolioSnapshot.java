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
@Table(name = "portfolio_snapshots",
    indexes = {
        @Index(name = "idx_portfolio_snapshots_user", columnList = "user_id"),
        @Index(name = "idx_portfolio_snapshots_created_at", columnList = "created_at")
    }
)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PortfolioSnapshot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "total_value", precision = 20, scale = 9, nullable = false)
    @Builder.Default
    private BigDecimal totalValue = BigDecimal.ZERO;

    @Column(name = "sol_balance", precision = 20, scale = 9)
    @Builder.Default
    private BigDecimal solBalance = BigDecimal.ZERO;

    @Column(name = "sol_value", precision = 20, scale = 9)
    @Builder.Default
    private BigDecimal solValue = BigDecimal.ZERO;

    @Column(name = "token_value", precision = 20, scale = 9)
    @Builder.Default
    private BigDecimal tokenValue = BigDecimal.ZERO;

    @Column(name = "token_count", nullable = false)
    @Builder.Default
    private Integer tokenCount = 0;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false, nullable = false)
    private LocalDateTime createdAt;
}
