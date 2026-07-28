package org.Spring.Config;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

/**
 * Tracks simple, non-sensitive counters for security events - used to
 * show real, live protection stats on the public Security & Privacy page.
 *
 * These counters are intentionally separate from the rate limiter and
 * lockout logic itself, so adding this cannot affect how those systems
 * behave - it only observes and counts, never blocks or permits anything.
 */
@Component
public class SecurityStatsService {

    private static final String BLOCKED_REQUESTS_KEY = "stats:blocked_requests";
    private static final String LOCKED_ACCOUNTS_KEY = "stats:locked_accounts";

    private final StringRedisTemplate redisTemplate;

    public SecurityStatsService(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    public void incrementBlockedRequests() {
        redisTemplate.opsForValue().increment(BLOCKED_REQUESTS_KEY);
    }

    public void incrementLockedAccounts() {
        redisTemplate.opsForValue().increment(LOCKED_ACCOUNTS_KEY);
    }

    public long getBlockedRequests() {
        String value = redisTemplate.opsForValue().get(BLOCKED_REQUESTS_KEY);
        return value != null ? Long.parseLong(value) : 0;
    }

    public long getLockedAccounts() {
        String value = redisTemplate.opsForValue().get(LOCKED_ACCOUNTS_KEY);
        return value != null ? Long.parseLong(value) : 0;
    }
}