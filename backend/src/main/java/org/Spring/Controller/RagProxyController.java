package org.Spring.Controller;

import java.time.Duration;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;

import jakarta.annotation.PostConstruct;

/**
 * Proxies POST /api/ask from the frontend to the Python Flask RAG service.
 * RAG base URL comes from RAG_SERVICE_URL (default localhost for local dev).
 * The Flask JSON body is forwarded unchanged.
 */
@RestController
public class RagProxyController {

    private static final Logger log = LoggerFactory.getLogger(RagProxyController.class);

    // RAG service base URL (no /ask; appended below). Set RAG_SERVICE_URL in prod.
    @Value("${RAG_SERVICE_URL:http://127.0.0.1:5000}")
    private String ragServiceUrl;

    // CHANGED: RestTemplate now has explicit timeouts. RAG answers can take 15-25s
    // (Azure OpenAI generation is slow), so we allow up to 60s to read; 10s to connect.
    private final RestTemplate restTemplate;

    public RagProxyController() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout((int) Duration.ofSeconds(10).toMillis());
        factory.setReadTimeout((int) Duration.ofSeconds(60).toMillis());
        this.restTemplate = new RestTemplate(factory);
    }

    // ADDED: log the resolved RAG URL once at startup, so the logs prove which address
    // the proxy is actually using (catches stale deploys / unset env vars instantly).
    @PostConstruct
    void logConfig() {
        log.info("[RagProxy] RAG_SERVICE_URL resolved to: {}", ragServiceUrl);
    }

    @PostMapping(
        value = "/api/ask",
        consumes = MediaType.APPLICATION_JSON_VALUE,
        produces = MediaType.APPLICATION_JSON_VALUE
    )
    public ResponseEntity<String> ask(@RequestBody String requestBody) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<String> entity = new HttpEntity<>(requestBody, headers);

        String flaskUrl = ragServiceUrl.replaceAll("/+$", "") + "/ask";

        try {
            ResponseEntity<String> flaskResponse =
                    restTemplate.postForEntity(flaskUrl, entity, String.class);
            return ResponseEntity
                    .status(flaskResponse.getStatusCode())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(flaskResponse.getBody());
        } catch (HttpStatusCodeException e) {
            // Flask returned a non-2xx — forward its exact status and body.
            return ResponseEntity
                    .status(e.getStatusCode())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(e.getResponseBodyAsString());
        } catch (Exception e) {
            // CHANGED: log the real reason + tag the body with "proxy-v2" so we can tell
            // at a glance whether THIS version is the one running.
            log.error("[RagProxy] Could not reach RAG at {} : {}", flaskUrl, e.toString());
            return ResponseEntity
                    .status(HttpStatus.BAD_GATEWAY)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body("{\"error\": \"Could not reach the RAG service.\", \"detail\": \"proxy-v2\"}");
        }
    }
}