package org.Spring.Config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;


@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private static final int MAX_REQUESTS = 60;       // requests allowed
    private static final Duration WINDOW = Duration.ofSeconds(60); // per 1 minute

    private final StringRedisTemplate redisTemplate;

    @Autowired
    public RateLimitFilter(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                     HttpServletResponse response,
                                     FilterChain filterChain) throws ServletException, IOException {

        String clientId = resolveClientId(request);
        String key = "ratelimit:" + clientId;

        // Atomically increment the counter for this client.
        Long count = redisTemplate.opsForValue().increment(key);

        if (count != null && count == 1L) {
            // First request in this window for this client - start the clock.
            redisTemplate.expire(key, WINDOW);
        }

        if (count != null && count > MAX_REQUESTS) {
            response.setStatus(429); // 429 Too Many Requests
            response.setContentType("application/json");
            response.getWriter().write(
                "{\"error\":\"rate_limit_exceeded\",\"message\":\"Too many requests. Please slow down and try again shortly.\"}"
            );
            return;
        }

        filterChain.doFilter(request, response);
    }

    /**
     * Identifies the caller. Falls back through common proxy headers first,
     * since in production this filter usually sits behind a reverse proxy
     * or Azure Application Gateway which sets X-Forwarded-For.
     */
    private String resolveClientId(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}