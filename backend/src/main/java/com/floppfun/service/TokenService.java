package com.floppfun.service;

import com.floppfun.model.dto.TokenCreateRequest;
import com.floppfun.model.dto.TokenDTO;
import com.floppfun.model.entity.Token;
import com.floppfun.model.entity.User;
import com.floppfun.repository.TokenRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class TokenService {

    private final TokenRepository tokenRepository;
    private final UserService userService;
    private final IpfsService ipfsService;
    private final SolanaService solanaService;
    private final BondingCurveService bondingCurveService;

    /**
     * Create a new token
     */
    @Transactional
    public Token createToken(TokenCreateRequest request) throws IOException {
        log.info("Creating token: {} ({})", request.getName(), request.getSymbol());

        // Get or create user
        User creator = userService.getOrCreateUser(request.getWalletAddress());

        // Upload image and metadata to IPFS
        Map<String, String> ipfsData = ipfsService.uploadTokenAssets(
                request.getImage(),
                request.getName(),
                request.getSymbol(),
                request.getDescription()
        );

        String imageUrl = ipfsData.get("imageUrl");
        String metadataUri = ipfsData.get("metadataUri");

        // Create token on Solana blockchain
        String mintAddress = solanaService.createToken(
                request.getName(),
                request.getSymbol(),
                metadataUri,
                1000000000L, // 1 billion total supply
                9 // 9 decimals
        );

        // Save token to database
        Token token = Token.builder()
                .mintAddress(mintAddress)
                .name(request.getName())
                .symbol(request.getSymbol())
                .description(request.getDescription())
                .imageUrl(imageUrl)
                .metadataUri(metadataUri)
                .creator(creator)
                .totalSupply(1000000000L)
                .decimals(9)
                .currentPrice(bondingCurveService.calculateCurrentPrice(
                        bondingCurveService.getInitialSolReserves(),
                        bondingCurveService.getInitialTokenReserves()
                ))
                .virtualSolReserves(bondingCurveService.getInitialSolReserves())
                .virtualTokenReserves(bondingCurveService.getInitialTokenReserves())
                .website(request.getWebsite())
                .twitter(request.getTwitter())
                .telegram(request.getTelegram())
                .discord(request.getDiscord())
                .isNsfw(request.getIsNsfw() != null ? request.getIsNsfw() : false)
                .status(Token.TokenStatus.ACTIVE)
                .build();

        token = tokenRepository.save(token);

        // Update creator stats
        creator.setTokensCreated(creator.getTokensCreated() + 1);
        userService.getUserById(creator.getId()); // Save happens in transaction

        log.info("Token created successfully: {}", mintAddress);
        return token;
    }

    /**
     * Get token by mint address
     */
    public Optional<Token> getTokenByMintAddress(String mintAddress) {
        return tokenRepository.findByMintAddress(mintAddress);
    }

    /**
     * Get token by ID
     */
    public Optional<Token> getTokenById(Long id) {
        return tokenRepository.findById(id);
    }

    /**
     * Get all tokens (paginated)
     */
    public Page<Token> getAllTokens(Pageable pageable) {
        return tokenRepository.findByStatusOrderByCreatedAtDesc(Token.TokenStatus.ACTIVE, pageable);
    }

    /**
     * Get trending tokens
     */
    public Page<Token> getTrendingTokens(Pageable pageable) {
        return tokenRepository.findTrendingTokens(Token.TokenStatus.ACTIVE, pageable);
    }

    /**
     * Search tokens
     */
    public Page<Token> searchTokens(String query, Pageable pageable) {
        return tokenRepository.searchTokens(query, pageable);
    }

    /**
     * Update token statistics after trade
     */
    @Transactional
    public void updateTokenStats(Token token, Long solAmount, Long tokenAmount) {
        // Update price
        token.setCurrentPrice(bondingCurveService.calculateCurrentPrice(
                token.getVirtualSolReserves(),
                token.getVirtualTokenReserves()
        ));

        // Update market cap
        token.setMarketCap(bondingCurveService.calculateMarketCap(
                token.getTotalSupply(),
                token.getVirtualSolReserves(),
                token.getVirtualTokenReserves()
        ));

        // Update bonding curve progress
        token.setBondingCurveProgress(bondingCurveService.calculateProgress(
                token.getVirtualSolReserves()
        ));

        // Update last trade time
        token.setLastTradeAt(LocalDateTime.now());

        // Check graduation
        if (bondingCurveService.hasGraduated(token.getVirtualSolReserves()) &&
            token.getStatus() != Token.TokenStatus.GRADUATED) {
            token.setStatus(Token.TokenStatus.GRADUATED);
            token.setGraduatedAt(LocalDateTime.now());
            log.info("Token {} has graduated!", token.getSymbol());
        }

        tokenRepository.save(token);
    }

    /**
     * Convert entity to DTO
     */
    public TokenDTO toDTO(Token token) {
        return TokenDTO.builder()
                .id(token.getId())
                .mintAddress(token.getMintAddress())
                .name(token.getName())
                .symbol(token.getSymbol())
                .description(token.getDescription())
                .imageUrl(token.getImageUrl())
                .metadataUri(token.getMetadataUri())
                .creator(token.getCreator() != null ? userService.toDTO(token.getCreator()) : null)
                .totalSupply(token.getTotalSupply())
                .decimals(token.getDecimals())
                .currentPrice(token.getCurrentPrice())
                .marketCap(token.getMarketCap())
                .volume24h(token.getVolume24h())
                .holdersCount(token.getHoldersCount())
                .status(token.getStatus().name())
                .bondingCurveProgress(token.getBondingCurveProgress())
                .website(token.getWebsite())
                .twitter(token.getTwitter())
                .telegram(token.getTelegram())
                .discord(token.getDiscord())
                .isNsfw(token.getIsNsfw())
                .isFeatured(token.getIsFeatured())
                .createdAt(token.getCreatedAt())
                .lastTradeAt(token.getLastTradeAt())
                .build();
    }
}
