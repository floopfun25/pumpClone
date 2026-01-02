package com.floppfun.filter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.concurrent.TimeUnit;

/**
 * Rate Limiting Filter using Redis
 * Implements token bucket algorithm with Upstash Redis compatibility
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(value = "floppfun.rate-limit.enabled", havingValue = "true", matchIfMissing = true)
public class RateLimitingFilter extends OncePerRequestFilter {

    private final RedisTemplate<String, String> redisTemplate;

    @Value("${floppfun.rate-limit.general.requests:100}")
    private int generalRequestsLimit;

    @Value("${floppfun.rate-limit.general.duration:60}")
    private int generalDuration;

    @Value("${floppfun.rate-limit.auth.requests:10}")
    private int authRequestsLimit;

    @Value("${floppfun.rate-limit.auth.duration:60}")
    private int authDuration;

    @Value("${floppfun.rate-limit.token-create.requests:5}")
    private int tokenCreateRequestsLimit;

    @Value("${floppfun.rate-limit.token-create.duration:300}")
    private int tokenCreateDuration;

    @Value("${floppfun.rate-limit.trade.requests:30}")
    private int tradeRequestsLimit;

    @Value("${floppfun.rate-limit.trade.duration:60}")
    private int tradeDuration;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String clientIp = getClientIP(request);
        String requestPath = request.getRequestURI();

        // Determine rate limit based on endpoint
        RateLimitConfig config = getRateLimitConfig(requestPath);

        // Check rate limit
        if (!checkRateLimit(clientIp, requestPath, config)) {
            log.warn("Rate limit exceeded for IP: {} on path: {}", clientIp, requestPath);
            response.setStatus(429); // Too Many Requests
            response.setContentType("application/json");
            response.getWriter().write(
                String.format("{\"error\":\"Rate limit exceeded. Try again in %d seconds.\"}", config.duration)
            );
            return;
        }

        filterChain.doFilter(request, response);
    }

    /**
     * Check if request is within rate limit using Redis
     */
    private boolean checkRateLimit(String clientIp, String path, RateLimitConfig config) {
        try {
            String key = "rate_limit:" + sanitizeKey(path) + ":" + clientIp;

            // Get current count
            String currentCountStr = redisTemplate.opsForValue().get(key);
            int currentCount = currentCountStr != null ? Integer.parseInt(currentCountStr) : 0;

            if (currentCount >= config.maxRequests) {
                return false;
            }

            // Increment counter
            Long newCount = redisTemplate.opsForValue().increment(key);

            // Set expiry on first request
            if (newCount != null && newCount == 1) {
                redisTemplate.expire(key, config.duration, TimeUnit.SECONDS);
            }

            return true;

        } catch (Exception e) {
            log.error("Error checking rate limit for IP {}: {}", clientIp, e.getMessage());
            // Fail open - allow request if Redis is down
            return true;
        }
    }

    /**
     * Get rate limit configuration based on request path
     */
    private RateLimitConfig getRateLimitConfig(String path) {
        if (path.contains("/auth/")) {
            return new RateLimitConfig(authRequestsLimit, authDuration);
        } else if (path.contains("/tokens") && path.endsWith("/create")) {
            return new RateLimitConfig(tokenCreateRequestsLimit, tokenCreateDuration);
        } else if (path.contains("/trade/") || path.contains("/buy") || path.contains("/sell")) {
            return new RateLimitConfig(tradeRequestsLimit, tradeDuration);
        } else {
            return new RateLimitConfig(generalRequestsLimit, generalDuration);
        }
    }

    /**
     * Get client IP address, considering proxies
     */
    private String getClientIP(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
            return xForwardedFor.split(",")[0].trim();
        }

        String xRealIp = request.getHeader("X-Real-IP");
        if (xRealIp != null && !xRealIp.isEmpty()) {
            return xRealIp;
        }

        return request.getRemoteAddr();
    }

    /**
     * Sanitize path for use in Redis key
     */
    private String sanitizeKey(String path) {
        return path.replaceAll("[^a-zA-Z0-9/_-]", "_");
    }

    /**
     * Rate limit configuration holder
     */
    private static class RateLimitConfig {
        final int maxRequests;
        final int duration;

        RateLimitConfig(int maxRequests, int duration) {
            this.maxRequests = maxRequests;
            this.duration = duration;
        }
    }
}
