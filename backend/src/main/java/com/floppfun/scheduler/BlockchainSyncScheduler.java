package com.floppfun.scheduler;

import com.floppfun.service.BlockchainSyncService;
import com.floppfun.service.HolderTrackingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Scheduler to periodically sync database with blockchain state
 *
 * Enable/disable with property: floppfun.blockchain.sync.enabled=true/false
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
    value = "floppfun.blockchain.sync.enabled",
    havingValue = "true",
    matchIfMissing = true // Enabled by default
)
public class BlockchainSyncScheduler {

    private final BlockchainSyncService blockchainSyncService;
    private final HolderTrackingService holderTrackingService;

    /**
     * Sync all active tokens every 30 seconds
     *
     * This ensures database stays in sync with on-chain state:
     * - Current price
     * - Virtual reserves
     * - Real reserves
     * - Bonding curve progress
     * - Graduation status
     */
    @Scheduled(fixedDelayString = "${floppfun.blockchain.sync.interval:30000}")
    public void syncBlockchainState() {
        log.debug("Starting scheduled blockchain sync...");

        try {
            blockchainSyncService.syncAllTokens();
            log.debug("Scheduled blockchain sync completed successfully");
        } catch (Exception e) {
            log.error("Scheduled blockchain sync failed: {}", e.getMessage(), e);
        }
    }

    /**
     * Update holder counts every 2 minutes
     *
     * This is more expensive than price sync, so we run it less frequently.
     * Queries all token accounts from blockchain to:
     * - Count total holders
     * - Update holder balances
     * - Track holder percentages
     */
    @Scheduled(fixedDelayString = "${floppfun.blockchain.holder-tracking.interval:120000}")
    public void updateHolderCounts() {
        log.debug("Starting scheduled holder count update...");

        try {
            holderTrackingService.updateAllHolderCounts();
            log.debug("Scheduled holder count update completed successfully");
        } catch (Exception e) {
            log.error("Scheduled holder count update failed: {}", e.getMessage(), e);
        }
    }
}
