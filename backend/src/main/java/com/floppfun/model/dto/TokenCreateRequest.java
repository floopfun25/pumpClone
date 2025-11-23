package com.floppfun.model.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.web.multipart.MultipartFile;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TokenCreateRequest {

    @NotBlank(message = "Token name is required")
    @Size(min = 1, max = 100, message = "Name must be between 1 and 100 characters")
    private String name;

    @NotBlank(message = "Token symbol is required")
    @Size(min = 1, max = 10, message = "Symbol must be between 1 and 10 characters")
    private String symbol;

    @Size(max = 500, message = "Description must not exceed 500 characters")
    private String description;

    @NotNull(message = "Image is required")
    private MultipartFile image;

    @NotBlank(message = "Wallet address is required")
    private String walletAddress;

    @NotBlank(message = "Wallet signature is required")
    private String signature;

    private String website;
    private String twitter;
    private String telegram;
    private String discord;

    private Boolean isNsfw;
}
