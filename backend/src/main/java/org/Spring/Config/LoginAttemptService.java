package org.Spring.Config;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;


@Component
public class LoginAttemptService {

    private static final int MAX_ATTEMPTS = 5;
    private static final Duration LOCKOUT_WINDOW = Duration.ofMinutes(5);

    private final StringRedisTemplate redisTemplate;
    private final SecurityStatsService statsService;

    public LoginAttemptService(StringRedisTemplate redisTemplate, SecurityStatsService statsService) {
        this.redisTemplate = redisTemplate;
        this.statsService = statsService;
    }

    private String key(String username) {
        return "login-attempts:" + username;
    }

    /** Call after a failed login. Increments the counter and starts/refreshes the lockout window. */
    public void loginFailed(String username) {
        String k = key(username);
        Long attempts = redisTemplate.opsForValue().increment(k);
        if (attempts != null && attempts == 1L) {
            redisTemplate.expire(k, LOCKOUT_WINDOW);
        }
        // Count this as a genuine new lockout event only at the exact moment
        // the account crosses the threshold - not on every attempt after.
        if (attempts != null && attempts == MAX_ATTEMPTS) {
            statsService.incrementLockedAccounts();
        }
    }

    /** Call after a successful login. Clears any failure history for this username. */
    public void loginSucceeded(String username) {
        redisTemplate.delete(key(username));
    }

    /** True if this username has exceeded the allowed failed attempts within the window. */
    public boolean isBlocked(String username) {
        String value = redisTemplate.opsForValue().get(key(username));
        if (value == null) return false;
        return Long.parseLong(value) >= MAX_ATTEMPTS;
    }
}