package org.sportscore.functions;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.List;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.sportscore.model.Match;
import org.sportscore.validator.MatchValidator;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microsoft.azure.functions.ExecutionContext;
import com.microsoft.azure.functions.annotation.Cardinality;
import com.microsoft.azure.functions.annotation.EventHubTrigger;
import com.microsoft.azure.functions.annotation.FunctionName;

public class EventHubToSignalRFunction {

    private static final ObjectMapper mapper = new ObjectMapper();
    private static final MatchValidator validator = new MatchValidator();
    private static final HttpClient http = HttpClient.newHttpClient();

    @FunctionName("SportScoreEventProcessor")
    public void run(
            // PLEASE review — throughput/reliability: Cardinality.ONE processes ONE event per
            // invocation, so every Match batch pays a full invocation + its own SignalR POST.
            // For a live-scores feed prefer Cardinality.MANY (receive an array) to amortise the call.
            // Also: a failing event is retried by the Event Hubs trigger with no dead-letter path,
            // so a single poison payload can stall the partition indefinitely.
            // EXAMPLE:
            //   @EventHubTrigger(... cardinality = Cardinality.MANY) String[] events
            //   // + host.json retry policy + a skip/dead-letter branch for permanently bad payloads.
            @EventHubTrigger(
                    name = "events",
                    eventHubName = "%EVENTHUB_NAME%",
                    connection = "EVENTHUB_CONNECTION_STRING",
                    consumerGroup = "$Default",
                    cardinality = Cardinality.ONE)
            String eventData,
            final ExecutionContext context) {

        try {
            List<Match> matches = mapper.readValue(eventData, new TypeReference<>() {});

            List<Match> validMatches = matches.stream()
                    .filter(validator::isValid)
                    .map(validator::transform)
                    .toList();

            if (validMatches.isEmpty()) {
                context.getLogger().info("No valid matches to broadcast.");
                return;
            }

            broadcastToSignalR(validMatches, context);

        } catch (Exception e) {
            context.getLogger().severe("Failed to process event: " + e.getMessage());
            for (StackTraceElement el : e.getStackTrace()) {
                context.getLogger().severe("  at " + el);
            }
        }
    }

    private void broadcastToSignalR(List<Match> matches, ExecutionContext context) throws Exception {
        // ============================================================================
        // PLEASE review — missing case: required config is never validated.
        // If SIGNALR_REST_ENDPOINT is unset, url becomes "null/api/v1/hubs/..."; if
        // SIGNALR_ACCESS_KEY is unset, generateJwt() throws NPE on key.getBytes(). Fail fast.
        // EXAMPLE:
        //   String endpoint = requireEnv("SIGNALR_REST_ENDPOINT");
        //   String key      = requireEnv("SIGNALR_ACCESS_KEY");
        //   // private static String requireEnv(String n){ var v = System.getenv(n);
        //   //   if (v == null || v.isBlank()) throw new IllegalStateException("Missing env " + n);
        //   //   return v; }
        // ============================================================================
        String signalREndpoint = System.getenv("SIGNALR_REST_ENDPOINT");
        String signalRKey      = System.getenv("SIGNALR_ACCESS_KEY");
        String url = signalREndpoint + "/api/v1/hubs/sportscoreHub";

        String body = mapper.writeValueAsString(new SignalRMessage("matchUpdate", matches));
        String token = generateJwt(url, signalRKey);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + token)
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();

        HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
        // PLEASE review — missing case: a non-2xx SignalR response is logged as if it succeeded.
        // A 401 (bad token) or 5xx silently drops the update with no retry or alert.
        // EXAMPLE:
        //   if (response.statusCode() / 100 != 2)
        //       throw new IOException("SignalR POST failed: " + response.statusCode() + " " + response.body());
        context.getLogger().info("SignalR broadcast status: " + response.statusCode());
    }

    // ============================================================================
    // PLEASE review — hand-rolled JWT, two concerns:
    // 1) The payload JSON is built by string concatenation, so a '"' or '\' in the
    //    audience URL yields invalid/injectable JSON. Serialize a real object instead.
    // 2) "300" is a magic number (token TTL) and there is no "iat". Name it.
    // Prefer a JWT/JSON library over manual crafting.
    // EXAMPLE:
    //   private static final long TOKEN_TTL_SECONDS = 300;
    //   long now = Instant.now().getEpochSecond();
    //   String payload = mapper.writeValueAsString(
    //           Map.of("aud", audience, "iat", now, "exp", now + TOKEN_TTL_SECONDS));
    //   // or com.auth0:java-jwt -> JWT.create().withAudience(audience).sign(Algorithm.HMAC256(key));
    // ============================================================================
    private String generateJwt(String audience, String key) throws Exception {
        long exp = Instant.now().getEpochSecond() + 300;
        String header = Base64.getUrlEncoder().withoutPadding()
                .encodeToString("{\"alg\":\"HS256\",\"typ\":\"JWT\"}".getBytes(StandardCharsets.UTF_8));
        String payload = Base64.getUrlEncoder().withoutPadding()
                .encodeToString(("{\"aud\":\"" + audience + "\",\"exp\":" + exp + "}").getBytes(StandardCharsets.UTF_8));
        String signingInput = header + "." + payload;
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        String signature = Base64.getUrlEncoder().withoutPadding()
                .encodeToString(mac.doFinal(signingInput.getBytes(StandardCharsets.UTF_8)));
        return signingInput + "." + signature;
    }

    public static class SignalRMessage {
        public String target;
        public Object arguments;

        public SignalRMessage(String target, Object arguments) {
            this.target = target;
            // PLEASE review — [subtle, keep as-is] SignalR's REST "arguments" is the array of
            // invocation args, so a single List<Match> arg is wrapped once: arguments = [matches].
            // The client handler matchUpdate(incoming: Match[]) then receives that list. Do NOT
            // "simplify" to `this.arguments = arguments` — that would call matchUpdate(m1, m2, ...).
            this.arguments = List.of(arguments);
        }
    }
}