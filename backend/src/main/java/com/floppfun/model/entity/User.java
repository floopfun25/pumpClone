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
@Table(name = "users", indexes = {
    @Index(name = "idx_wallet_address", columnList = "wallet_address", unique = true)
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "wallet_address", nullable = false, unique = true, length = 44)
    private String walletAddress;

    @Column(name = "username", length = 50)
    private String username;

    @Column(name = "avatar_url")
    private String avatarUrl;

    @Column(name = "bio", columnDefinition = "TEXT")
    private String bio;

    @Column(name = "twitter_handle", length = 50)
    private String twitterHandle;

    @Column(name = "telegram_handle", length = 50)
    private String telegramHandle;

    @Column(name = "is_verified")
    @Builder.Default
    private Boolean isVerified = false;

    @Column(name = "total_volume_traded", precision = 20, scale = 9)
    @Builder.Default
    private BigDecimal totalVolumeTraded = BigDecimal.ZERO;

    @Column(name = "tokens_created")
    @Builder.Default
    private Integer tokensCreated = 0;

    @Column(name = "reputation_score")
    @Builder.Default
    private Integer reputationScore = 0;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    // Relationships
    @OneToMany(mappedBy = "creator", cascade = CascadeType.ALL)
    @Builder.Default
    private Set<Token> createdTokens = new HashSet<>();

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL)
    @Builder.Default
    private Set<Transaction> transactions = new HashSet<>();

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL)
    @Builder.Default
    private Set<UserHolding> holdings = new HashSet<>();
}
