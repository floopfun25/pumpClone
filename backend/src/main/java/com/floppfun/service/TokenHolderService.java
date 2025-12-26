package com.floppfun.service;

import com.floppfun.dto.TokenHolderDTO;
import com.floppfun.entity.TokenHolder;
import com.floppfun.model.entity.Token;
import com.floppfun.repository.TokenHolderRepository;
import com.floppfun.repository.TokenRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class TokenHolderService {

    private final TokenHolderRepository tokenHolderRepository;
    private final TokenRepository tokenRepository;

    /**
     * Get top holders for a token
     */
    @Transactional(readOnly = true)
    public List<TokenHolderDTO> getTopHolders(Long tokenId, int limit) {
        List<TokenHolder> holders = tokenHolderRepository.findTopHolders(
            tokenId,
            PageRequest.of(0, limit)
        );

        return holders.stream()
            .map(this::toDTO)
            .collect(Collectors.toList());
    }

    /**
     * Get total number of holders for a token
     */
    @Transactional(readOnly = true)
    public Long getHoldersCount(Long tokenId) {
        return tokenHolderRepository.countHolders(tokenId);
    }

    /**
     * Update or create holder record
     */
    @Transactional
    public void updateHolder(Long tokenId, String walletAddress, Long balance) {
        Token token = tokenRepository.findById(tokenId)
            .orElseThrow(() -> new RuntimeException("Token not found"));

        TokenHolder holder = tokenHolderRepository
            .findByTokenIdAndWalletAddress(tokenId, walletAddress)
            .orElse(new TokenHolder());

        holder.setToken(token);
        holder.setWalletAddress(walletAddress);
        holder.setBalance(balance);

        // Calculate percentage (this should be calculated based on total supply)
        // For now, we'll set it to null and calculate it when querying
        holder.setPercentage(null);

        tokenHolderRepository.save(holder);
        log.debug("Updated holder {} for token {} with balance {}",
            walletAddress, tokenId, balance);

        // Update token holders count
        Long holdersCount = getHoldersCount(tokenId);
        token.setHoldersCount(holdersCount.intValue());
        tokenRepository.save(token);
    }

    /**
     * Get all tokens held by a wallet
     */
    @Transactional(readOnly = true)
    public List<TokenHolderDTO> getWalletHoldings(String walletAddress) {
        List<TokenHolder> holdings = tokenHolderRepository.findByWalletAddress(walletAddress);

        return holdings.stream()
            .map(this::toDTO)
            .collect(Collectors.toList());
    }

    /**
     * Convert entity to DTO
     */
    private TokenHolderDTO toDTO(TokenHolder holder) {
        return new TokenHolderDTO(
            holder.getId(),
            holder.getWalletAddress(),
            holder.getBalance(),
            holder.getPercentage(),
            holder.getFirstAcquiredAt(),
            holder.getLastUpdatedAt()
        );
    }
}
