package org.sportscore.functions;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microsoft.azure.functions.*;
import com.microsoft.azure.functions.annotation.*;
import org.sportscore.model.Match;
import org.sportscore.validator.MatchValidator;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.List;

public class EventHubToSignalRFunction {

    private static final ObjectMapper   mapper    = new ObjectMapper();
    private static final MatchValidator validator = new MatchValidator();
    private static final HttpClient     http      = HttpClient.newHttpClient();

    @FunctionName("SportScoreEventProcessor")
    public void run(
            @EventHubTrigger(
                    name          = "events",
                    eventHubName  = "%EVENTHUB_NAME%",
                    connection    = "EVENTHUB_CONNECTION_STRING",
                    consumerGroup = "$Default",
                    cardinality   = Cardinality.ONE)
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
        String endpoint = System.getenv("SIGNALR_REST_ENDPOINT");
        String key      = System.getenv("SIGNALR_ACCESS_KEY");
        String url      = endpoint + "/api/v1/hubs/sportscoreHub";

        String body  = mapper.writeValueAsString(new SignalRMessage("matchUpdate", matches));
        String token = generateJwt(url, key);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + token)
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();

        HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
        context.getLogger().info("SignalR broadcast status: " + response.statusCode());
    }

    private String generateJwt(String audience, String key) throws Exception {
        long exp = Instant.now().getEpochSecond() + 300;
        String header  = b64("{\"alg\":\"HS256\",\"typ\":\"JWT\"}");
        String payload = b64("{\"aud\":\"" + audience + "\",\"exp\":" + exp + "}");
        String input   = header + "." + payload;
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        String sig = Base64.getUrlEncoder().withoutPadding()
                .encodeToString(mac.doFinal(input.getBytes(StandardCharsets.UTF_8)));
        return input + "." + sig;
    }

    private String b64(String s) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(s.getBytes(StandardCharsets.UTF_8));
    }

    public static class SignalRMessage {
        public String target;
        public Object arguments;
        public SignalRMessage(String target, Object arguments) {
            this.target    = target;
            this.arguments = List.of(arguments);
        }
    }
}
