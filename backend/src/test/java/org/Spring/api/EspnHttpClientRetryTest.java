package org.Spring.api;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.http.HttpClient;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.retry.annotation.EnableRetry;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;

/**
 * Integration test for EspnHttpClient's @Retryable behaviour.
 *
 * This has to run inside a (tiny) Spring context: @Retryable only works because
 * Spring wraps the bean in a proxy, and that wrapping is exactly the thing the
 * bug fix depended on. TestConfig below is a minimal context with @EnableRetry
 * plus the three beans EspnHttpClient needs — no full app, no env vars, no Azure.
 *
 * ESPN is faked with a local MockWebServer, so we control the HTTP status codes.
 * Backoff is 500ms -> 1s -> 2s, so these tests take a couple of seconds — normal.
 */
@SpringJUnitConfig(EspnHttpClientRetryTest.TestConfig.class)
@TestPropertySource(properties = "espn.http.timeout=15")
class EspnHttpClientRetryTest {

    @Configuration
    @EnableRetry
    static class TestConfig {
        @Bean HttpClient httpClient() { return HttpClient.newHttpClient(); }
        @Bean ObjectMapper objectMapper() { return new ObjectMapper(); }
        @Bean EspnHttpClient espnHttpClient(HttpClient http, ObjectMapper mapper) {
            return new EspnHttpClient(http, mapper);
        }
    }

    @Autowired EspnHttpClient client;

    private MockWebServer server;

    @BeforeEach
    void startServer() throws Exception {
        server = new MockWebServer();
        server.start();
    }

    @AfterEach
    void stopServer() throws Exception {
        server.shutdown();
    }

    @Test
    @DisplayName("retries on 5xx and succeeds once ESPN recovers")
    void retriesOn5xxThenSucceeds() throws Exception {
        server.enqueue(new MockResponse().setResponseCode(500));
        server.enqueue(new MockResponse().setResponseCode(500));
        server.enqueue(new MockResponse().setResponseCode(200).setBody("{\"ok\":true}"));

        JsonNode result = client.get(server.url("/scoreboard").toString());

        assertThat(result.path("ok").asBoolean()).isTrue();
        assertThat(server.getRequestCount()).isEqualTo(3);   // 2 failures + 1 success
    }

    @Test
    @DisplayName("does NOT retry on 4xx — returns an empty node immediately")
    void noRetryOn4xx() throws Exception {
        server.enqueue(new MockResponse().setResponseCode(404));

        JsonNode result = client.get(server.url("/scoreboard").toString());

        assertThat(result.isEmpty()).isTrue();
        assertThat(server.getRequestCount()).isEqualTo(1);   // no retry attempts
    }

    @Test
    @DisplayName("after exhausting retries on persistent 5xx, degrades to an empty node")
    void recoversAfterExhaustingRetries() throws Exception {
        server.enqueue(new MockResponse().setResponseCode(500));
        server.enqueue(new MockResponse().setResponseCode(500));
        server.enqueue(new MockResponse().setResponseCode(500));

        JsonNode result = client.get(server.url("/scoreboard").toString());

        assertThat(result.isEmpty()).isTrue();               // @Recover fallback
        assertThat(server.getRequestCount()).isEqualTo(3);   // maxAttempts = 3
    }
}