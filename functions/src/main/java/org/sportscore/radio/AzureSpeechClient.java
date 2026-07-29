package org.sportscore.radio;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

/**
 * Calls the Azure Cognitive Services Speech REST API (text-to-speech),
 * targeting the Neural TTS HD Flash voice family for low end-to-end latency.
 *
 * Plain POJO (no Spring) to match the style of the Azure Functions module
 * this lives alongside -- EventHubToSignalRFunction reads its own config
 * straight from System.getenv() rather than through a DI container, since
 * the Functions runtime doesn't manage these classes as Spring beans.
 *
 * Fails fast at construction if config looks wrong, same spirit as
 * EventHubProducer's connection-string check -- better to catch a missing
 * key here with a clear message than let the first real request 401 with a
 * cryptic Azure error.
 */
public class AzureSpeechClient {

    private final String key;
    private final String endpoint;
    private final HttpClient http;

    public AzureSpeechClient(String key, String region, String customEndpoint) {
        if (key == null || key.isBlank()) {
            throw new IllegalStateException(
                    "AZURE_SPEECH_KEY is not set. Radio Mode cannot synthesize audio without a " +
                            "Speech resource key.");
        }
        if ((customEndpoint == null || customEndpoint.isBlank())
                && (region == null || region.isBlank())) {
            throw new IllegalStateException(
                    "Neither AZURE_SPEECH_ENDPOINT nor AZURE_SPEECH_REGION is set. Radio Mode needs " +
                            "one of the two to know which Speech endpoint to call.");
        }

        this.key = key;
        this.endpoint = (customEndpoint != null && !customEndpoint.isBlank())
                ? customEndpoint
                : "https://" + region + ".tts.speech.microsoft.com/cognitiveservices/v1";
        this.http = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(3))
                .build();
    }

    /** Convenience factory that reads the three env vars directly, like the rest of this module does. */
    public static AzureSpeechClient fromEnv() {
        return new AzureSpeechClient(
                System.getenv("AZURE_SPEECH_KEY"),
                System.getenv("AZURE_SPEECH_REGION"),
                System.getenv("AZURE_SPEECH_ENDPOINT"));
    }

    public static class SynthesisResult {
        public final byte[] audio;
        public final long latencyMs;
        public final String contentType;

        public SynthesisResult(byte[] audio, long latencyMs, String contentType) {
            this.audio = audio;
            this.latencyMs = latencyMs;
            this.contentType = contentType;
        }
    }

    public SynthesisResult synthesize(String ssml) throws Exception {
        long start = System.currentTimeMillis();

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(endpoint))
                .timeout(Duration.ofSeconds(4))
                .header("Ocp-Apim-Subscription-Key", key)
                .header("Content-Type", "application/ssml+xml")
                // 24kHz mono is a reasonable quality/latency tradeoff for spoken commentary.
                .header("X-Microsoft-OutputFormat", "audio-24khz-48kbitrate-mono-mp3")
                .header("User-Agent", "SportScoreRadioMode")
                .POST(HttpRequest.BodyPublishers.ofString(ssml, StandardCharsets.UTF_8))
                .build();

        HttpResponse<byte[]> response = http.send(request, HttpResponse.BodyHandlers.ofByteArray());

        if (response.statusCode() / 100 != 2) {
            throw new java.io.IOException(
                    "Azure Speech synthesis failed: " + response.statusCode()
                            + " " + new String(response.body(), StandardCharsets.UTF_8));
        }

        long latencyMs = System.currentTimeMillis() - start;
        return new SynthesisResult(response.body(), latencyMs, "audio/mpeg");
    }
}
