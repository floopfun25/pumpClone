package com.floppfun.service;

import com.floppfun.entity.Watchlist;
import com.floppfun.model.dto.TokenDTO;
import com.floppfun.model.entity.Token;
import com.floppfun.model.entity.User;
import com.floppfun.repository.TokenRepository;
import com.floppfun.repository.UserRepository;
import com.floppfun.repository.WatchlistRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class WatchlistService {

    private final WatchlistRepository watchlistRepository;
    private final TokenRepository tokenRepository;
    private final UserRepository userRepository;
    private final TokenService tokenService;

    /**
     * Add token to watchlist
     */
    @Transactional
    public void addToWatchlist(Long userId, Long tokenId) {
        // Check if already in watchlist
        if (watchlistRepository.existsByUserIdAndTokenId(userId, tokenId)) {
            throw new RuntimeException("Token already in watchlist");
        }

        User user = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("User not found"));

        Token token = tokenRepository.findById(tokenId)
            .orElseThrow(() -> new RuntimeException("Token not found"));

        Watchlist watchlist = new Watchlist();
        watchlist.setUser(user);
        watchlist.setToken(token);

        watchlistRepository.save(watchlist);
        log.info("Token {} added to watchlist for user {}", tokenId, userId);
    }

    /**
     * Remove token from watchlist
     */
    @Transactional
    public void removeFromWatchlist(Long userId, Long tokenId) {
        if (!watchlistRepository.existsByUserIdAndTokenId(userId, tokenId)) {
            throw new RuntimeException("Token not in watchlist");
        }

        watchlistRepository.deleteByUserIdAndTokenId(userId, tokenId);
        log.info("Token {} removed from watchlist for user {}", tokenId, userId);
    }

    /**
     * Check if token is in watchlist
     */
    @Transactional(readOnly = true)
    public boolean isInWatchlist(Long userId, Long tokenId) {
        return watchlistRepository.existsByUserIdAndTokenId(userId, tokenId);
    }

    /**
     * Get user's watchlist
     */
    @Transactional(readOnly = true)
    public List<TokenDTO> getWatchlist(Long userId) {
        List<Watchlist> watchlist = watchlistRepository.findByUserId(userId);

        return watchlist.stream()
            .map(w -> tokenService.toDTO(w.getToken()))
            .collect(Collectors.toList());
    }
}
