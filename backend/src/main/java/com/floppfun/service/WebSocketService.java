package com.floppfun.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;

/**
 * WebSocket Service - Broadcasts real-time updates to connected clients
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WebSocketService {

    private final SimpMessagingTemplate messagingTemplate;

    /**
     * Broadcast token price update
     */
    public void broadcastPriceUpdate(Long tokenId, BigDecimal newPrice, BigDecimal marketCap, BigDecimal volume24h) {
        Map<String, Object> update = new HashMap<>();
        update.put("tokenId", tokenId);
        update.put("price", newPrice);
        update.put("marketCap", marketCap);
        update.put("volume24h", volume24h);
        update.put("timestamp", System.currentTimeMillis());

        String destination = "/topic/price/" + tokenId;
        messagingTemplate.convertAndSend(destination, update);

        log.debug("Broadcasted price update for token {}: {}", tokenId, newPrice);
    }

    /**
     * Broadcast new trade
     */
    public void broadcastTrade(String tokenSymbol, String tradeType, Long tokenAmount, BigDecimal price) {
        Map<String, Object> trade = new HashMap<>();
        trade.put("tokenSymbol", tokenSymbol);
        trade.put("type", tradeType);
        trade.put("amount", tokenAmount);
        trade.put("price", price);
        trade.put("timestamp", System.currentTimeMillis());

        messagingTemplate.convertAndSend("/topic/trades", trade);

        log.debug("Broadcasted {} trade for {}", tradeType, tokenSymbol);
    }

    /**
     * Broadcast token graduation
     */
    public void broadcastGraduation(Long tokenId, String tokenName, String tokenSymbol) {
        Map<String, Object> graduation = new HashMap<>();
        graduation.put("tokenId", tokenId);
        graduation.put("name", tokenName);
        graduation.put("symbol", tokenSymbol);
        graduation.put("timestamp", System.currentTimeMillis());

        messagingTemplate.convertAndSend("/topic/graduations", graduation);

        log.info("Broadcasted graduation for token: {}", tokenSymbol);
    }

    /**
     * Broadcast new token creation
     */
    public void broadcastNewToken(Long tokenId, String name, String symbol, String imageUrl) {
        Map<String, Object> newToken = new HashMap<>();
        newToken.put("tokenId", tokenId);
        newToken.put("name", name);
        newToken.put("symbol", symbol);
        newToken.put("imageUrl", imageUrl);
        newToken.put("timestamp", System.currentTimeMillis());

        messagingTemplate.convertAndSend("/topic/new-tokens", newToken);

        log.info("Broadcasted new token: {}", symbol);
    }
}
