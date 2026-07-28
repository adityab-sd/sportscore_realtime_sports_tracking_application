package org.Spring.Config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;

@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(RateLimitFilter.class);

    private static final int MAX_REQUESTS = 60;
    private static final Duration WINDOW = Duration.ofSeconds(60);

    private final StringRedisTemplate redisTemplate;
    private final SecurityStatsService statsService;

    @Autowired
    public RateLimitFilter(StringRedisTemplate redisTemplate, SecurityStatsService statsService) {
        this.redisTemplate = redisTemplate;
        this.statsService = statsService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        String clientId = resolveClientId(request);
        String key = "ratelimit:" + clientId;

        try {
            Long count = redisTemplate.opsForValue().increment(key);

            if (count != null && count == 1L) {
                redisTemplate.expire(key, WINDOW);
            }

            if (count != null && count > MAX_REQUESTS) {
                statsService.incrementBlockedRequests();
                response.setStatus(429);
                response.setHeader("Retry-After", "60");
                response.setContentType("application/json");
                response.getWriter().write(
                        "{\"error\":\"rate_limit_exceeded\",\"message\":\"Too many requests. Please slow down and try again shortly.\"}"
                );
                return;
            }
        } catch (Exception e) {
            // Redis unreachable (or any other rate-limit infra failure): fail OPEN.
            // A rate limiter being briefly unavailable should degrade to "no rate
            // limiting" rather than taking down every request in the app -- this is
            // exactly what was happening before this try/catch existed.
            log.error("Rate limit check failed, allowing request through: {}", e.getMessage());
        }

        filterChain.doFilter(request, response);
    }

    private String resolveClientId(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}