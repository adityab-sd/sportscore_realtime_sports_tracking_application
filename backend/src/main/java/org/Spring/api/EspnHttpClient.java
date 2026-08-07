package org.Spring.api;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

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

    @Value("${espn.http.timeout:15}")
    private int timeout;

    public EspnHttpClient(HttpClient http, ObjectMapper mapper, StringRedisTemplate redis) {
        this.http   = http;
        this.mapper = mapper;
        this.redis  = redis;
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