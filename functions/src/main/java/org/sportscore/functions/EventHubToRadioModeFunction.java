package org.sportscore.functions;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;

import org.sportscore.model.Match;
import org.sportscore.model.MatchEvent;
import org.sportscore.radio.AzureSpeechClient;
import org.sportscore.radio.CommentaryService;
import org.sportscore.radio.RadioModeAudioMessage;
import org.sportscore.signalr.SignalRJwtUtil;
import org.sportscore.validator.MatchValidator;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microsoft.azure.functions.ExecutionContext;
import com.microsoft.azure.functions.annotation.Cardinality;
import com.microsoft.azure.functions.annotation.EventHubTrigger;
import com.microsoft.azure.functions.annotation.FunctionName;

/**
 * Radio Mode's own Event Hub consumer. Deliberately a SEPARATE function from
 * EventHubToSignalRFunction, on its own consumer group ("radio-mode"), so a
 * slow TTS call here can never back up the plain score/dashboard feed and
 * vice versa -- this is the "partitioned consumer groups" point from the
 * pitch (section 1).
 *
 * Cardinality.MANY here (vs. the ONE on EventHubToSignalRFunction) so a
 * batch of events shares one SignalR broadcast call instead of paying a
 * full round trip per event -- the same throughput point flagged as a
 * review comment on the sibling function, applied here from the start.
 *
 * Poison-message handling: each match in the batch is processed
 * independently and a failure (bad payload, TTS error) is logged and
 * skipped rather than thrown, so one bad event can't stall the whole
 * partition the way the sibling function's current retry behavior can.
 *
 * Sport is NOT filtered here -- every sport currently flows through this
 * function and gets a RadioModeAudioMessage with its Match.sport() stamped
 * on it. Filtering by section (Football page vs Basketball page) happens
 * client-side in RadioBar.tsx. This keeps this function simple and avoids
 * needing to know which sports the frontend currently cares about; if TTS
 * cost/volume ever becomes a concern, an early sport-based skip could be
 * added here too, but there's no evidence yet that's needed.
 */
public class EventHubToRadioModeFunction {

    private static final String RADIO_MODE_VOICE = "en-US-AvaMultilingualNeural";
    private static final String SIGNALR_TARGET = "radioModeEvent";

    private static final ObjectMapper mapper = new ObjectMapper();
    private static final MatchValidator validator = new MatchValidator();
    private static final CommentaryService commentaryService = new CommentaryService();
    private static final HttpClient http = HttpClient.newHttpClient();

    // Lazily built so a missing AZURE_SPEECH_KEY fails the first invocation
    // with a clear message instead of failing class-load for the whole app.
    private static AzureSpeechClient speechClient;

    @FunctionName("SportScoreRadioModeProcessor")
    public void run(
            @EventHubTrigger(
                    name = "events",
                    eventHubName = "%EVENTHUB_NAME%",
                    connection = "EVENTHUB_CONNECTION_STRING",
                    consumerGroup = "radio-mode",
                    cardinality = Cardinality.MANY)
            String[] rawEvents,
            final ExecutionContext context) {

        AzureSpeechClient speech = getSpeechClient(context);
        if (speech == null) {
            // getSpeechClient already logged why; nothing more we can do this invocation.
            return;
        }

        List<RadioModeAudioMessage> audioMessages = new ArrayList<>();

        for (String eventData : rawEvents) {
            try {
                List<Match> matches = mapper.readValue(eventData, new TypeReference<>() {});

                for (Match match : matches) {
                    if (!validator.isValid(match)) {
                        continue;
                    }
                    Match validated = validator.transform(match);

                    // NOTE: assumes validated.events() carries only the new event(s)
                    // since the last message for this match, not the full history --
                    // otherwise every update would re-announce old events. Worth
                    // confirming with whoever owns the producer/ingestion side.
                    List<MatchEvent> matchEvents = validated.events();
                    if (matchEvents == null) {
                        continue;
                    }

                    for (MatchEvent event : matchEvents) {
                        try {
                            String text = commentaryService.toCommentaryText(validated, event);
                            String ssml = commentaryService.toSSML(text, event.type(), RADIO_MODE_VOICE);

                            AzureSpeechClient.SynthesisResult synthesis = speech.synthesize(ssml);

                            audioMessages.add(new RadioModeAudioMessage(
                                    validated.id(),
                                    validated.sport(),
                                    event.type(),
                                    event.minute(),
                                    text,
                                    Base64.getEncoder().encodeToString(synthesis.audio),
                                    synthesis.contentType,
                                    synthesis.latencyMs));
                        } catch (Exception e) {
                            // Skip this one event, keep the rest of the match's events
                            // (and the rest of the batch) moving.
                            context.getLogger().warning(
                                    "[radio-mode] skipping event for match " + validated.id()
                                            + " due to error: " + e.getMessage());
                        }
                    }
                }
            } catch (Exception e) {
                // Skip this one payload, keep the batch moving -- a single malformed
                // or TTS-failing event should not stall the whole partition.
                context.getLogger().warning(
                        "[radio-mode] skipping event due to error: " + e.getMessage());
            }
        }

        if (audioMessages.isEmpty()) {
            context.getLogger().info("[radio-mode] no audio events to broadcast this invocation.");
            return;
        }

        try {
            broadcastToSignalR(audioMessages, context);
        } catch (Exception e) {
            context.getLogger().severe("[radio-mode] SignalR broadcast failed: " + e.getMessage());
            for (StackTraceElement el : e.getStackTrace()) {
                context.getLogger().severe("  at " + el);
            }
        }
    }

    private static synchronized AzureSpeechClient getSpeechClient(ExecutionContext context) {
        if (speechClient == null) {
            try {
                speechClient = AzureSpeechClient.fromEnv();
            } catch (IllegalStateException e) {
                context.getLogger().severe("[radio-mode] cannot start: " + e.getMessage());
                return null;
            }
        }
        return speechClient;
    }

    private void broadcastToSignalR(List<RadioModeAudioMessage> messages, ExecutionContext context) throws Exception {
        String signalREndpoint = requireEnv("SIGNALR_REST_ENDPOINT");
        String signalRKey = requireEnv("SIGNALR_ACCESS_KEY");
        String url = signalREndpoint + "/api/v1/hubs/radioModeHub";

        String body = mapper.writeValueAsString(new SignalRMessage(SIGNALR_TARGET, messages));
        String token = SignalRJwtUtil.generate(url, signalRKey);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + token)
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();

        HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() / 100 != 2) {
            throw new IOException(
                    "SignalR POST failed: " + response.statusCode() + " " + response.body());
        }

        context.getLogger().info(
                "[radio-mode] broadcast " + messages.size() + " audio event(s), status "
                        + response.statusCode());
    }

    private static String requireEnv(String name) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) {
            throw new IllegalStateException("Missing required env var: " + name);
        }
        return value;
    }

    public static class SignalRMessage {
        public String target;
        public Object arguments;

        public SignalRMessage(String target, Object arguments) {
            this.target = target;
            // Same convention as EventHubToSignalRFunction: SignalR's REST
            // "arguments" is the array of invocation args, so the list of
            // audio messages is wrapped once here, and the client hub method
            // (e.g. radioModeEvent(events: RadioModeAudioMessage[])) receives
            // it as a single array argument.
            this.arguments = List.of(arguments);
        }
    }
}