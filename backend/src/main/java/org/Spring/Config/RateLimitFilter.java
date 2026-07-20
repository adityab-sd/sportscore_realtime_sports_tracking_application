package org.Spring.Config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Simple in-memory sliding-window rate limiter.
 * Protects the API from scraping and accidental traffic loops.
 */
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    // Tune these two values together: MAX_REQUESTS per WINDOW_MILLIS.
    private static final int MAX_REQUESTS = 60;       // requests allowed
    private static final long WINDOW_MILLIS = 60_000;  // per 1 minute

    private final ConcurrentHashMap<String, Bucket> buckets = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                     HttpServletResponse response,
                                     FilterChain filterChain) throws ServletException, IOException {

        String clientId = resolveClientId(request);
        Bucket bucket = buckets.computeIfAbsent(clientId, id -> new Bucket());

        if (bucket.tryConsume()) {
            filterChain.doFilter(request, response);
        } else {
            response.setStatus(429); // 429 Too Many Requests
            response.setContentType("application/json");
            response.getWriter().write(
                "{\"error\":\"rate_limit_exceeded\",\"message\":\"Too many requests. Please slow down and try again shortly.\"}"
            );
        }
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

    /** Fixed-window counter with automatic reset once the window elapses. */
    private static class Bucket {
        private final AtomicInteger count = new AtomicInteger(0);
        private volatile long windowStart = System.currentTimeMillis();

        synchronized boolean tryConsume() {
            long now = System.currentTimeMillis();
            if (now - windowStart > WINDOW_MILLIS) {
                windowStart = now;
                count.set(0);
            }
            return count.incrementAndGet() <= MAX_REQUESTS;
        }
    }
}