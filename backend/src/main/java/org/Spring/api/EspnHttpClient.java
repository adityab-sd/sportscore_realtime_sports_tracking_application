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
     * Manual retry loop (replaces @Retryable/@Recover — those had issues under
     * concurrent invocation of the same proxied method once fetchAllMatches()
     * started calling this concurrently). Redis reads/writes are individually
     * wrapped so a Redis outage/quota error degrades to a direct ESPN fetch
     * instead of failing the whole request.
     */
    public JsonNode get(String url) throws IOException, InterruptedException {
        String cacheKey = CACHE_PREFIX + url;

        if (redis != null) {
            try {
                String cached = redis.opsForValue().get(cacheKey);
                if (cached != null) {
                    try {
                        return mapper.readTree(cached);
                    } catch (IOException ignored) { /* fall through to ESPN */ }
                }
            } catch (Exception redisEx) {
                log.warn("Redis GET failed for {}, falling through to ESPN: {}", cacheKey, redisEx.getMessage());
            }
        }

        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofSeconds(timeout))
                .header("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                .header("Accept", "application/json, text/plain, */*")
                .header("Accept-Language", "en-US,en;q=0.9")
                .header("Origin", "https://www.espn.com")
                .header("Referer", "https://www.espn.com/")
                .GET().build();

        Exception lastFailure = null;

        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());

                if (res.statusCode() >= 500) {
                    lastFailure = new EspnServerException(res.statusCode(), url);
                    log.warn("ESPN {} for {} (attempt {}/{})", res.statusCode(), url, attempt, MAX_ATTEMPTS);
                    sleepBackoff(attempt);
                    continue;
                }
                if (res.statusCode() != 200) {
                    log.warn("ESPN {} for {}", res.statusCode(), url);
                    return mapper.createObjectNode();
                }

                JsonNode result = mapper.readTree(res.body());

                if (redis != null) {
                    try {
                        Duration ttl = (url.contains("/athletes/") || url.contains("/teams/")) ? REF_TTL : LIVE_TTL;
                        redis.opsForValue().set(cacheKey, res.body(), ttl);
                    } catch (Exception redisEx) {
                        log.warn("Redis SET failed for {}: {}", cacheKey, redisEx.getMessage());
                    }
                }

                return result;
            } catch (IOException e) {
                lastFailure = e;
                log.warn("IO failure for {} (attempt {}/{}): {}", url, attempt, MAX_ATTEMPTS, e.getMessage());
                sleepBackoff(attempt);
            }
        }

        log.error("ESPN request failed after {} attempts for {}", MAX_ATTEMPTS, url, lastFailure);
        return mapper.createObjectNode();
    }

    private void sleepBackoff(int attempt) throws InterruptedException {
        long delay = BASE_DELAY_MS * (1L << (attempt - 1));
        Thread.sleep(delay);
    }

    public Map<String, JsonNode> getMany(List<String> urls) throws InterruptedException {
        Map<String, JsonNode> results = new LinkedHashMap<>();
        if (urls == null || urls.isEmpty()) return results;

        List<String> misses = new ArrayList<>();

        if (redis != null) {
            try {
                List<String> cacheKeys = urls.stream().map(u -> CACHE_PREFIX + u).toList();
                List<String> cached = redis.opsForValue().multiGet(cacheKeys);
                for (int i = 0; i < urls.size(); i++) {
                    String val = (cached != null) ? cached.get(i) : null;
                    if (val != null) {
                        try {
                            results.put(urls.get(i), mapper.readTree(val));
                            continue;
                        } catch (IOException ignored) { /* fall through to miss */ }
                    }
                    misses.add(urls.get(i));
                }
            } catch (Exception redisEx) {
                log.warn("Redis multiGet failed, treating all as misses: {}", redisEx.getMessage());
                misses.addAll(urls);
            }
        } else {
            misses.addAll(urls);
        }

        if (misses.isEmpty()) return results;

        List<CompletableFuture<Map.Entry<String, JsonNode>>> futures = misses.stream()
                .map(url -> CompletableFuture.supplyAsync(() -> {
                    try {
                        concurrencyLimiter.acquire();
                        JsonNode node = get(url);
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