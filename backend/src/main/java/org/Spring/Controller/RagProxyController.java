package org.Spring.Controller;

import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;

/**
 * Proxies POST /api/ask requests from the Next.js frontend through to the
 * Python Flask RAG microservice running on localhost:5000.
 *
 * The Flask response body (answer / grounded / source_type / sources /
 * round_used) is forwarded UNCHANGED as raw JSON, rather than being
 * deserialized into a Java DTO — round_used can be either an int (1) or
 * a string ("fallback") depending on the case, which doesn't map cleanly
 * onto a single strongly-typed field. Passing the raw body through avoids
 * that mismatch entirely and means this proxy never drifts out of sync
 * with Flask's response shape.
 *
 * IMPORTANT: /api/ask must be added to SecurityConfig's permitAll list,
 * or every request here gets a 401 (see SecurityConfig.java — the
 * default rule is .anyRequest().authenticated()).
 *
 * CORS is NOT configured here on purpose — this app already has a
 * global CORS policy via SecurityConfig's corsConfigurationSource()
 * bean (defaults to http://localhost:3000), which covers this
 * controller automatically. Adding a separate @CrossOrigin here would
 * risk conflicting with that single source of truth.
 */
@RestController
public class RagProxyController {

    private static final String FLASK_RAG_URL = "http://127.0.0.1:5000/ask";

    private final RestTemplate restTemplate = new RestTemplate();

    @PostMapping(
        value = "/api/ask",
        consumes = MediaType.APPLICATION_JSON_VALUE,
        produces = MediaType.APPLICATION_JSON_VALUE
    )
    public ResponseEntity<String> ask(@RequestBody String requestBody) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<String> entity = new HttpEntity<>(requestBody, headers);

        try {
            ResponseEntity<String> flaskResponse =
                    restTemplate.postForEntity(FLASK_RAG_URL, entity, String.class);
            return ResponseEntity
                    .status(flaskResponse.getStatusCode())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(flaskResponse.getBody());
        } catch (HttpStatusCodeException e) {
            // Flask returned a non-2xx response (e.g. 400 for a missing
            // "question" field) — forward its exact status and body
            // rather than masking it as a generic 500.
            return ResponseEntity
                    .status(e.getStatusCode())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(e.getResponseBodyAsString());
        } catch (Exception e) {
            // Flask is unreachable entirely (not running, wrong port, etc.)
            return ResponseEntity
                    .status(HttpStatus.BAD_GATEWAY)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body("{\"error\": \"Could not reach the RAG service. Is Flask running on port 5000?\"}");
        }
    }
}