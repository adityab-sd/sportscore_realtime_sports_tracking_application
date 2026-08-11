package org.Spring.api;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Semaphore;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

@Component
public class EspnHttpClient {

    private static final Logger log = LoggerFactory.getLogger(EspnHttpClient.class);

    private static final String CACHE_PREFIX = "espn:";
    private static final Duration REF_TTL  = Duration.ofHours(6);
    private static final Duration LIVE_TTL = Duration.ofSeconds(30);

    // Manual retry config. NOT @Retryable — Spring Retry's recovery-handler
    // lookup breaks under concurrent invocation of the same proxied method
    // ("Cannot locate recovery method"), which is exactly what happens once
    // fetchAllMatches() calls get()/getFresh() concurrently across leagues.
    private static final int  MAX_ATTEMPTS  = 3;
    private static final long BASE_DELAY_MS = 500;

    private static final int MAX_CONCURRENT = 4;
    private final Semaphore concurrencyLimiter = new Semaphore(MAX_CONCURRENT);

    public static class EspnServerException extends RuntimeException {
        public final int status;
        public EspnServerException(int status, String url) {
            super("ESPN " + status + " for " + url);
            this.status = status;
        }
    }

    private final HttpClient          http;
    private final ObjectMapper        mapper;
    private final StringRedisTemplate redis;
    private final ExecutorService     executor;

    @Value("${espn.http.timeout:15}")
    private int timeout;

    public EspnHttpClient(HttpClient http, ObjectMapper mapper, StringRedisTemplate redis, ExecutorService executor) {
        this.http     = http;
        this.mapper   = mapper;
        this.redis    = redis;
        this.executor = executor;
    }

    /**
     * Single raw HTTP fetch, no retry, no cache. Callers that need retry/cache
     * wrap this themselves (see get()/getFresh() below).
     */
    private String fetchBodyOnce(String url) throws IOException, InterruptedException {
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofSeconds(timeout))
                .header("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                .header("Accept", "application/json, text/plain, */*")
                .header("Accept-Language", "en-US,en;q=0.9")
                .header("Origin", "https://www.espn.com")
                .header("Referer", "https://www.espn.com/")
                .GET().build();

        HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
        if (res.statusCode() >= 500) throw new EspnServerException(res.statusCode(), url);
        if (res.statusCode() != 200) {
            log.warn("ESPN {} for {}", res.statusCode(), url);
            return null;
        }
        return res.body();
    }

    /**
     * Manual retry loop around fetchBodyOnce() — 3 attempts, exponential backoff
     * (500ms → 1s → 2s). Retries on 5xx and IOException; 4xx returns null
     * immediately (no retry, matches original behavior). Shared by get() and
     * getFresh() — the only difference between them is Redis usage.
     */
    private String fetchBody(String url) throws IOException, InterruptedException {
        Exception lastFailure = null;

        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                return fetchBodyOnce(url);
            } catch (EspnServerException e) {
                lastFailure = e;
                log.warn("ESPN {} for {} (attempt {}/{})", e.status, url, attempt, MAX_ATTEMPTS);
                sleepBackoff(attempt);
            } catch (IOException e) {
                lastFailure = e;
                log.warn("IO failure for {} (attempt {}/{}): {}", url, attempt, MAX_ATTEMPTS, e.getMessage());
                sleepBackoff(attempt);
            }
        }

        log.error("ESPN request failed after {} attempts for {}", MAX_ATTEMPTS, url, lastFailure);
        return null;
    }

    private void sleepBackoff(int attempt) throws InterruptedException {
        long delay = BASE_DELAY_MS * (1L << (attempt - 1));
        Thread.sleep(delay);
    }

    /**
     * Cached fetch — used by user-facing service controllers and getMany()'s
     * $ref resolution. These repeat often enough (same athlete/team looked up
     * across many games; same endpoint hit by multiple users) that Redis
     * genuinely absorbs load. Redis GET/SET are wrapped so an outage/quota
     * error falls through to a live ESPN fetch instead of failing the request.
     */
    public JsonNode get(String url) throws IOException, InterruptedException {
        String cacheKey = CACHE_PREFIX + url;

        if (redis != null) {
            try {
                String cached = redis.opsForValue().get(cacheKey);
                if (cached != null) {
                    try {
                        return mapper.readTree(cached);
                    } catch (IOException ignored) { /* corrupt cache entry → refetch */ }
                }
            } catch (Exception e) {
                log.warn("Redis GET failed for {}, fetching from ESPN: {}", cacheKey, e.getMessage());
            }
        }

        String body = fetchBody(url);
        if (body == null) return mapper.createObjectNode();

        if (redis != null) {
            try {
                Duration ttl = (url.contains("/athletes/") || url.contains("/teams/")) ? REF_TTL : LIVE_TTL;
                redis.opsForValue().set(cacheKey, body, ttl);
            } catch (Exception e) {
                log.warn("Redis SET failed for {}: {}", cacheKey, e.getMessage());
            }
        }

        return mapper.readTree(body);
    }

    /**
     * Uncached fetch — for the background live-score poll loop specifically.
     *
     * Why bypass Redis here: the loop polls every 30s (LivePipelineRunner.POLL_MS)
     * and the live-score cache TTL is also 30s — so by the time a league's next
     * poll runs, its own previous cache entry has just expired. The GET almost
     * always misses, meaning every poll pays for a Redis GET *and* SET for a
     * cache that never actually gets hit by its own repeat calls. Across ~70+
     * leagues polled every 30s, that's on the order of 10M+ wasted Redis
     * commands/month — a real contributor to hitting Upstash's free-tier quota.
     * Going straight to ESPN here removes that waste with zero loss of benefit,
     * since nothing was actually being served from cache in this path anyway.
     */
    public JsonNode getFresh(String url) throws IOException, InterruptedException {
        String body = fetchBody(url);
        return body == null ? mapper.createObjectNode() : mapper.readTree(body);
    }

    /**
     * Batched fetch for $ref links. The Redis MGET is wrapped: if it fails,
     * every URL is simply treated as a cache miss and fetched from ESPN.
     */
    public Map<String, JsonNode> getMany(List<String> urls) throws InterruptedException {
        Map<String, JsonNode> results = new LinkedHashMap<>();
        if (urls == null || urls.isEmpty()) return results;

        List<String> misses = new ArrayList<>();

        List<String> cached = null;
        if (redis != null) {
            try {
                List<String> cacheKeys = urls.stream().map(u -> CACHE_PREFIX + u).toList();
                cached = redis.opsForValue().multiGet(cacheKeys);
            } catch (Exception e) {
                log.warn("Redis MGET failed, treating all as cache misses: {}", e.getMessage());
                cached = null;
            }
        }

        if (cached != null) {
            for (int i = 0; i < urls.size(); i++) {
                String val = cached.get(i);
                if (val != null) {
                    try {
                        results.put(urls.get(i), mapper.readTree(val));
                        continue;
                    } catch (IOException ignored) { /* fall through to miss */ }
                }
                misses.add(urls.get(i));
            }
        } else {
            misses.addAll(urls);
        }

        if (misses.isEmpty()) return results;

        List<CompletableFuture<Map.Entry<String, JsonNode>>> futures = misses.stream()
                .map(url -> CompletableFuture.supplyAsync(() -> {
                    try {
                        concurrencyLimiter.acquire();
                        JsonNode node = get(url); // retry + fail-open caching still apply here
                        return Map.entry(url, node);
                    } catch (IOException | InterruptedException e) {
                        Thread.currentThread().interrupt();
                        return Map.entry(url, (JsonNode) mapper.createObjectNode());
                    } finally {
                        concurrencyLimiter.release();
                    }
                }, executor))
                .toList();

        for (var f : futures) {
            var entry = f.join();
            results.put(entry.getKey(), entry.getValue());
        }

        return results;
    }
}