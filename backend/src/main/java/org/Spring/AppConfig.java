package org.Spring;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Application-wide singleton beans.
 *
 * ObjectMapper is thread-safe and expensive to construct — one shared instance
 * is injected everywhere instead of each class calling {@code new ObjectMapper()}.
 *
 * HttpClient is also thread-safe and holds a connection pool — sharing one
 * instance avoids redundant pool creation across the ~10 fetcher/service classes.
 * No explicit .version() is set, so it defaults to HTTP/2 with automatic
 * fallback to HTTP/1.1 — gives real request multiplexing to ESPN's endpoint
 * without extra config.
 *
 * espnFetchExecutor is the single bounded pool for all concurrent outbound
 * ESPN calls — both AbstractEspnFetcher's per-league fan-out and
 * EspnHttpClient's per-$ref batch fan-out draw from this one pool, so
 * concurrency limits don't silently stack when multiple sport fetchers
 * (football/basketball/baseball/F1) poll in the same 30s window.
 */
@Configuration
public class AppConfig {

    @Bean
    public ObjectMapper objectMapper() {
        return new ObjectMapper().registerModule(new JavaTimeModule());
    }

    @Bean
    public HttpClient httpClient() {
        return HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    @Bean(destroyMethod = "shutdown")
    public ExecutorService espnFetchExecutor(
            @Value("${espn.fetch.pool-size:16}") int poolSize) {
        return Executors.newFixedThreadPool(poolSize);
    }
}