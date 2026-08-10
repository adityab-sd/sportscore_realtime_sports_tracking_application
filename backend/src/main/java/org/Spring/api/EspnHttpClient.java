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
import org.springframework.retry.annotation.Backoff;
import org.springframework.retry.annotation.Recover;
import org.springframework.retry.annotation.Retryable;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

@Component
public class EspnHttpClient {

    private static final Logger log = LoggerFactory.getLogger(EspnHttpClient.class);

    private static final String CACHE_PREFIX = "espn:";
    private static final Duration REF_TTL  = Duration.ofHours(6);
    private static final Duration LIVE_TTL = Duration.ofSeconds(30);

    // Cap on how many ESPN requests fire at once for a single getMany() batch.
    // Keep conservative — we got 403'd before for looking bursty. Independent
    // of the shared executor's total pool size (espn.fetch.pool-size) — this
    // just bounds how many of THIS client's own tasks run concurrently.
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

    @Retryable(
            retryFor    = { EspnServerException.class, IOException.class },
            maxAttempts = 3,
            backoff     = @Backoff(delay = 500, multiplier = 2)
    )
    public JsonNode get(String url) throws IOException, InterruptedException {
        String cacheKey = CACHE_PREFIX + url;

        if (redis != null) {
            String cached = redis.opsForValue().get(cacheKey);
            if (cached != null) {
                try {
                    return mapper.readTree(cached);
                } catch (IOException ignored) { /* fall through */ }
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

        try {
            HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (res.statusCode() >= 500) throw new EspnServerException(res.statusCode(), url);
            if (res.statusCode() != 200) {
                log.warn("ESPN {} for {}", res.statusCode(), url);
                return mapper.createObjectNode();
            }

            JsonNode result = mapper.readTree(res.body());

            if (redis != null) {
                Duration ttl = (url.contains("/athletes/") || url.contains("/teams/")) ? REF_TTL : LIVE_TTL;
                redis.opsForValue().set(cacheKey, res.body(), ttl);
            }

            return result;
        }
        catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw e;
        }
    }

    /**
     * Batched fetch for a set of URLs (typically $ref links collected from a
     * whole payload before any HTTP call is made). Not currently called by the
     * football adapter (its player data is inline, no $ref to resolve) — kept
     * here for baseball/basketball adapters if their payloads do dereference
     * athlete/team refs.
     *
     * Step 1: one Redis MGET for all URLs — cache hits resolve with zero ESPN calls.
     * Step 2: remaining misses are fetched with bounded concurrency (MAX_CONCURRENT
     * in flight at once) on the shared espnFetchExecutor pool, instead of
     * sequentially and instead of the JVM-wide ForkJoinPool.commonPool().
     */
    public Map<String, JsonNode> getMany(List<String> urls) throws InterruptedException {
        Map<String, JsonNode> results = new LinkedHashMap<>();
        if (urls == null || urls.isEmpty()) return results;

        List<String> misses = new ArrayList<>();

        if (redis != null) {
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
        } else {
            misses.addAll(urls);
        }

        if (misses.isEmpty()) return results;

        List<CompletableFuture<Map.Entry<String, JsonNode>>> futures = misses.stream()
                .map(url -> CompletableFuture.supplyAsync(() -> {
                    try {
                        concurrencyLimiter.acquire();
                        JsonNode node = get(url); // retry + per-entry caching still apply here
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

    @Recover
    public JsonNode recover(EspnServerException ex, String url) {
        log.error("ESPN server error after retries for {}", url, ex);
        return mapper.createObjectNode();
    }

    @Recover
    public JsonNode recover(IOException ex, String url) {
        log.error("IO failure after retries for {}", url, ex);
        return mapper.createObjectNode();
    }
}