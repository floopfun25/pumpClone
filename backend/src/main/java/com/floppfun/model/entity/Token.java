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
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "tokens", indexes = {
    @Index(name = "idx_mint_address", columnList = "mint_address", unique = true),
    @Index(name = "idx_status", columnList = "status"),
    @Index(name = "idx_created_at", columnList = "created_at")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Token {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "mint_address", nullable = false, unique = true, length = 44)
    private String mintAddress;

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    @Column(name = "symbol", nullable = false, length = 10)
    private String symbol;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "image_url")
    private String imageUrl;

    @Column(name = "metadata_uri")
    private String metadataUri;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "creator_id")
    private User creator;

    @Column(name = "total_supply")
    @Builder.Default
    private Long totalSupply = 1000000000L;

    @Column(name = "decimals")
    @Builder.Default
    private Integer decimals = 9;

    @Column(name = "dev_share_percentage", precision = 5, scale = 2)
    @Builder.Default
    private BigDecimal devSharePercentage = BigDecimal.ZERO;

    @Column(name = "dev_tokens_amount")
    @Builder.Default
    private Long devTokensAmount = 0L;

    @Column(name = "lock_duration_days")
    private Integer lockDurationDays;

    @Column(name = "locked_tokens_amount")
    @Builder.Default
    private Long lockedTokensAmount = 0L;

    @Column(name = "current_price", precision = 20, scale = 9)
    @Builder.Default
    private BigDecimal currentPrice = BigDecimal.ZERO;

    @Column(name = "market_cap", precision = 20, scale = 2)
    @Builder.Default
    private BigDecimal marketCap = BigDecimal.ZERO;

    @Column(name = "volume_24h", precision = 20, scale = 9)
    @Builder.Default
    private BigDecimal volume24h = BigDecimal.ZERO;

    @Column(name = "holders_count")
    @Builder.Default
    private Integer holdersCount = 0;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 20)
    @Builder.Default
    private TokenStatus status = TokenStatus.ACTIVE;

    @Column(name = "graduation_threshold")
    @Builder.Default
    private Long graduationThreshold = 69000000000L;

    @Column(name = "graduated_at")
    private LocalDateTime graduatedAt;

    @Column(name = "website")
    private String website;

    @Column(name = "twitter", length = 100)
    private String twitter;

    @Column(name = "telegram", length = 100)
    private String telegram;

    @Column(name = "discord", length = 100)
    private String discord;

    @Column(name = "last_trade_at")
    private LocalDateTime lastTradeAt;

    @Column(name = "bonding_curve_progress", precision = 5, scale = 2)
    @Builder.Default
    private BigDecimal bondingCurveProgress = BigDecimal.ZERO;

    @Column(name = "virtual_sol_reserves")
    @Builder.Default
    private Long virtualSolReserves = 30000000000L;

    @Column(name = "virtual_token_reserves")
    @Builder.Default
    private Long virtualTokenReserves = 1073000000000000L;

    @Column(name = "real_token_reserves")
    @Builder.Default
    private Long realTokenReserves = 793100000000000L;

    @Column(name = "is_nsfw")
    @Builder.Default
    private Boolean isNsfw = false;

    @Column(name = "is_featured")
    @Builder.Default
    private Boolean isFeatured = false;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    // Relationships
    @OneToMany(mappedBy = "token", cascade = CascadeType.ALL)
    @Builder.Default
    private Set<Transaction> transactions = new HashSet<>();

    @OneToMany(mappedBy = "token", cascade = CascadeType.ALL)
    @Builder.Default
    private Set<UserHolding> holdings = new HashSet<>();

    @OneToMany(mappedBy = "token", cascade = CascadeType.ALL)
    @Builder.Default
    private Set<TokenComment> comments = new HashSet<>();

    public enum TokenStatus {
        ACTIVE,
        GRADUATED,
        INACTIVE
    }
}
