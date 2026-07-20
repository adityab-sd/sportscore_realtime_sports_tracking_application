package org.Spring;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.net.http.HttpClient;
import java.time.Duration;

/**
 * Application-wide singleton beans.
 *
 * ObjectMapper is thread-safe and expensive to construct — one shared instance
 * is injected everywhere instead of each class calling {@code new ObjectMapper()}.
 *
 * HttpClient is also thread-safe and holds a connection pool — sharing one
 * instance avoids redundant pool creation across the ~10 fetcher/service classes.
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
}
