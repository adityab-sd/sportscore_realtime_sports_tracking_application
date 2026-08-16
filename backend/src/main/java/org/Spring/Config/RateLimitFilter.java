package org.Spring.Config;

import java.io.IOException;
import java.time.Duration;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(RateLimitFilter.class);

    // 300 requests per minute per IP. A single page load fires several API calls
    // (scoreboard + standings + news + ...), so 60/min tripped during normal
    // browsing. 300 leaves room for real users while still stopping abusive floods.
    private static final int MAX_REQUESTS = 300;

    // /api/ask gets its own, much tighter budget. Every RAG request costs an
    // embedding, a pgvector query, an Azure Search query and 1-2 GPT calls, so
    // it is orders of magnitude more expensive than the cached REST reads the
    // 300/min figure was sized for. Sharing that budget would let a single IP
    // trigger ~300 model calls a minute. This is the cost cap from the PR
    // comment: the scope guard stops the bot ANSWERING off-topic questions, but
    // it still pays for a model call to refuse each one, so a topic guard alone
    // does not stop billing abuse.
    private static final int MAX_ASK_REQUESTS = 20;

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

        // Separate Redis key per bucket, so normal browsing can never exhaust the
        // assistant's allowance (and vice versa) — the two budgets are independent.
        boolean isAsk = request.getRequestURI().startsWith("/api/ask");
        String key = isAsk ? "ratelimit:ask:" + clientId : "ratelimit:" + clientId;
        int limit = isAsk ? MAX_ASK_REQUESTS : MAX_REQUESTS;

        try {
            Long count = redisTemplate.opsForValue().increment(key);

            if (count != null && count == 1L) {
                redisTemplate.expire(key, WINDOW);
            }

            if (count != null && count > limit) {
                statsService.incrementBlockedRequests();
                log.warn("Rate limit exceeded for {} on {} ({}/{} in window)",
                        clientId, isAsk ? "/api/ask" : "general", count, limit);
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
            //
            // This applies to /api/ask too, which is a deliberate trade-off: failing
            // closed would break the assistant entirely on a Redis blip, and the
            // max_completion_tokens cap in _generate_answer remains as a backstop
            // on per-request cost.
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