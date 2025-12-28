package com.floppfun.service;

import com.floppfun.dto.Portfolio24hChangeDTO;
import com.floppfun.dto.PortfolioSnapshotRequest;
import com.floppfun.model.entity.PortfolioSnapshot;
import com.floppfun.model.entity.User;
import com.floppfun.repository.PortfolioSnapshotRepository;
import com.floppfun.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;

@Slf4j
@Service
@RequiredArgsConstructor
public class PortfolioSnapshotService {

    private final PortfolioSnapshotRepository portfolioSnapshotRepository;
    private final UserRepository userRepository;

    /**
     * Store a portfolio snapshot for a user
     */
    @Transactional
    public void storeSnapshot(Long userId, PortfolioSnapshotRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        PortfolioSnapshot snapshot = PortfolioSnapshot.builder()
                .user(user)
                .totalValue(request.getTotalValue())
                .solBalance(request.getSolBalance())
                .solValue(request.getSolValue())
                .tokenValue(request.getTokenValue())
                .tokenCount(request.getTokenCount())
                .build();

        portfolioSnapshotRepository.save(snapshot);

        log.debug("Stored portfolio snapshot for user {}: ${}", userId, request.getTotalValue());
    }

    /**
     * Get 24h portfolio change for a user
     */
    @Transactional(readOnly = true)
    public Portfolio24hChangeDTO get24hChange(Long userId, BigDecimal currentValue) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        // Find snapshot from 24 hours ago (with some tolerance)
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime targetTime = now.minusHours(24);
        LocalDateTime startWindow = targetTime.minusHours(1); // 23-25 hours ago
        LocalDateTime endWindow = targetTime.plusHours(1);

        var snapshot24hAgo = portfolioSnapshotRepository.findSnapshot24hAgo(user, startWindow, endWindow);

        if (snapshot24hAgo.isEmpty()) {
            // No snapshot from 24h ago, return zero change
            log.debug("No 24h snapshot found for user {}", userId);
            return Portfolio24hChangeDTO.builder()
                    .valueChange(BigDecimal.ZERO)
                    .percentChange(BigDecimal.ZERO)
                    .currentValue(currentValue)
                    .previousValue(BigDecimal.ZERO)
                    .build();
        }

        BigDecimal previousValue = snapshot24hAgo.get().getTotalValue();
        BigDecimal valueChange = currentValue.subtract(previousValue);

        BigDecimal percentChange = BigDecimal.ZERO;
        if (previousValue.compareTo(BigDecimal.ZERO) > 0) {
            percentChange = valueChange
                    .divide(previousValue, 10, RoundingMode.HALF_UP)
                    .multiply(BigDecimal.valueOf(100));
        }

        log.debug("24h change for user {}: ${} ({} %)", userId, valueChange, percentChange);

        return Portfolio24hChangeDTO.builder()
                .valueChange(valueChange)
                .percentChange(percentChange)
                .currentValue(currentValue)
                .previousValue(previousValue)
                .build();
    }
}
