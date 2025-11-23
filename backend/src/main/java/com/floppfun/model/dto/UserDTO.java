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
public class UserDTO {
    private Long id;
    private String walletAddress;
    private String username;
    private String avatarUrl;
    private String bio;
    private String twitterHandle;
    private String telegramHandle;
    private Boolean isVerified;
    private BigDecimal totalVolumeTraded;
    private Integer tokensCreated;
    private Integer reputationScore;
    private LocalDateTime createdAt;
}
