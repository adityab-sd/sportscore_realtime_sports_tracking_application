package org.Spring.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.retry.annotation.Backoff;
import org.springframework.retry.annotation.Recover;
import org.springframework.retry.annotation.Retryable;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/**
 * Performs HTTP requests to the ESPN API.
 *
 * Extracted into its own Spring bean so @Retryable is applied through
 * Spring AOP proxies. Calling a @Retryable method via `this` bypasses
 * the proxy and disables retry behavior.
 */
@Component
public class EspnHttpClient {

    private static final Logger log =
            LoggerFactory.getLogger(EspnHttpClient.class);

    /** Thrown on 5xx — triggers retry. 4xx is returned as an empty node (no retry). */
    public static class EspnServerException extends RuntimeException {
        public final int status;
        public EspnServerException(int status, String url) {
            super("ESPN " + status + " for " + url);
            this.status = status;
        }
    }

    private final HttpClient   http;
    private final ObjectMapper mapper;
    @Value("${espn.http.timeout:15}")
    private int timeout;

    public EspnHttpClient(HttpClient http, ObjectMapper mapper) {
        this.http   = http;
        this.mapper = mapper;
    }

    /**
     * Fetches {@code url} with up to 3 attempts and exponential backoff
     * (500 ms → 1 s → 2 s). Retries on 5xx and I/O failures.
     * 4xx responses return an empty node immediately (no retry).
     */
    @Retryable(
        retryFor    = { EspnServerException.class, IOException.class },
        maxAttempts = 3,
        backoff     = @Backoff(delay = 500, multiplier = 2)
    )
    public JsonNode get(String url) throws IOException, InterruptedException {
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofSeconds(timeout))
                .header("User-Agent", "SportScore/1.0")
                .GET().build();

        try {
            HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (res.statusCode() >= 500) throw new EspnServerException(res.statusCode(), url);
            if (res.statusCode() != 200) return mapper.createObjectNode();
            return mapper.readTree(res.body());
        }
        catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw e;
        }
    }

    /** Called after all retry attempts are exhausted — degrades gracefully. */
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
