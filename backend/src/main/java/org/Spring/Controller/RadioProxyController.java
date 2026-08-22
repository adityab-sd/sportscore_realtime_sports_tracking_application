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
 * Proxies POST /api/radio from the frontend to the Python Flask RAG service's
 * /radio endpoint, mirroring RagProxyController exactly (same RAG_SERVICE_URL,
 * same forward-body-unchanged approach) so radio stays consistent with how
 * /api/ask already routes through the Java gateway rather than the browser
 * hitting Python directly.
 *
 * The RAG /radio endpoint summarises match data (that the frontend already
 * fetched) into spoken copy and synthesises audio — it never calls ESPN, so
 * this path adds zero ESPN load. The response body can carry base64 audio, so
 * the read timeout is generous (summarize + TTS can take a few seconds).
 */
@RestController
public class RadioProxyController {

    private static final Logger log = LoggerFactory.getLogger(RadioProxyController.class);

    // Same base URL as RagProxyController — one RAG service, two endpoints.
    @Value("${RAG_SERVICE_URL:http://127.0.0.1:5000}")
    private String ragServiceUrl;

    private final RestTemplate restTemplate;

    public RadioProxyController() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout((int) Duration.ofSeconds(10).toMillis());
        factory.setReadTimeout((int) Duration.ofSeconds(60).toMillis());
        this.restTemplate = new RestTemplate(factory);
    }

    @PostConstruct
    void logConfig() {
        log.info("[RadioProxy] RAG_SERVICE_URL resolved to: {}", ragServiceUrl);
    }

    @PostMapping(
        value = "/api/radio",
        consumes = MediaType.APPLICATION_JSON_VALUE,
        produces = MediaType.APPLICATION_JSON_VALUE
    )
    public ResponseEntity<String> radio(@RequestBody String requestBody) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<String> entity = new HttpEntity<>(requestBody, headers);

        String flaskUrl = ragServiceUrl.replaceAll("/+$", "") + "/radio";

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
            log.error("[RadioProxy] Could not reach RAG at {} : {}", flaskUrl, e.toString());
            return ResponseEntity
                    .status(HttpStatus.BAD_GATEWAY)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body("{\"error\": \"Could not reach the radio service.\"}");
        }
    }
}