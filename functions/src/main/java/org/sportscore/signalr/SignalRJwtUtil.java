package org.sportscore.signalr;

import java.time.Instant;
import java.util.Base64;
import java.util.Map;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Shared helper for generating the short-lived JWT Azure SignalR Service's
 * REST API expects on server -> service calls. Pulled out as its own class so
 * both {@code EventHubToSignalRFunction} and the new Radio Mode function can
 * use one hardened implementation instead of each hand-rolling their own.
 *
 * Two fixes vs. the original inline version:
 *  1. Claims are serialized with Jackson, not string concatenation, so a
 *     '"' or '\' in the audience URL can't produce invalid/injected JSON.
 *  2. The token TTL is a named constant, and "iat" is included alongside
 *     "exp" so token freshness can be checked at that end too.
 */
public final class SignalRJwtUtil {

    private static final long TOKEN_TTL_SECONDS = 300;
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private SignalRJwtUtil() {
        // utility class
    }

    public static String generate(String audience, String accessKey) throws Exception {
        long now = Instant.now().getEpochSecond();

        String header = encode(
                MAPPER.writeValueAsString(Map.of("alg", "HS256", "typ", "JWT")));
        String payload = encode(
                MAPPER.writeValueAsString(Map.of(
                        "aud", audience,
                        "iat", now,
                        "exp", now + TOKEN_TTL_SECONDS)));

        String signingInput = header + "." + payload;

        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(accessKey.getBytes(java.nio.charset.StandardCharsets.UTF_8), "HmacSHA256"));
        String signature = Base64.getUrlEncoder().withoutPadding()
                .encodeToString(mac.doFinal(signingInput.getBytes(java.nio.charset.StandardCharsets.UTF_8)));

        return signingInput + "." + signature;
    }

    private static String encode(String json) {
        return Base64.getUrlEncoder().withoutPadding()
                .encodeToString(json.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }
}
