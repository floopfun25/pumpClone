package com.floppfun.entity;

import com.floppfun.model.entity.Token;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "token_prices", indexes = {
    @Index(name = "idx_token_timestamp", columnList = "token_id,timestamp DESC")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TokenPrice {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "token_id", nullable = false)
    private Token token;

    @Column(nullable = false, precision = 20, scale = 10)
    private BigDecimal price;

    @Column(precision = 20, scale = 2)
    private BigDecimal marketCap;

    @Column(precision = 20, scale = 2)
    private BigDecimal volume;

    @Column(nullable = false)
    private LocalDateTime timestamp;

    @PrePersist
    protected void onCreate() {
        if (timestamp == null) {
            timestamp = LocalDateTime.now();
        }
    }
}
