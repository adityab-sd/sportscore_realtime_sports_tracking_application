package org.Spring.api;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;
import java.util.regex.Pattern;

import org.springframework.retry.annotation.Backoff;
import org.springframework.retry.annotation.Recover;
import org.springframework.retry.annotation.Retryable;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Shared ESPN API helpers for all sport services.
 * Eliminates duplication between FootballService, BasketballService, etc.
 */
public abstract class EspnApiHelper {

    protected final HttpClient   http   = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    protected final ObjectMapper mapper = new ObjectMapper();

    private static final Pattern TEAM_ID_FROM_REF = Pattern.compile("/teams/(\\d+)");

    /** Thrown when ESPN returns a 5xx status — triggers retry. */
    static class EspnServerException extends RuntimeException {
        final int status;
        EspnServerException(int status, String url) {
            super("ESPN " + status + " for " + url);
            this.status = status;
        }
    }

    // ── HTTP ─────────────────────────────────────────────────────────────────

    /**
     * Fetches a URL with up to 3 attempts and exponential backoff (500 ms → 1 s → 2 s).
     * Retries on 5xx responses and I/O / timeout failures.
     * 4xx responses are returned as an empty node immediately (no retry).
     */
    @Retryable(
        retryFor  = { EspnServerException.class, IOException.class },
        maxAttempts = 3,
        backoff   = @Backoff(delay = 500, multiplier = 2)
    )
    protected JsonNode get(String url) throws Exception {
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(url)).timeout(Duration.ofSeconds(15))
                .header("User-Agent", "SportScore/1.0").GET().build();
        HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
        if (res.statusCode() >= 500) throw new EspnServerException(res.statusCode(), url);
        if (res.statusCode() != 200)  return mapper.createObjectNode();
        return mapper.readTree(res.body());
    }

    /** Called after all retry attempts are exhausted — returns an empty node so callers degrade gracefully. */
    @Recover
    protected JsonNode getRecover(Exception ex, String url) {
        System.err.println("[EspnApiHelper] All retries exhausted for " + url + " — " + ex.getMessage());
        return mapper.createObjectNode();
    }

    // ── Node helpers ─────────────────────────────────────────────────────────

    protected String txt(JsonNode n) {
        return (n == null || n.isMissingNode() || n.isNull()) ? null : n.asText();
    }

    protected Integer num(JsonNode n) {
        return (n == null || n.isMissingNode() || n.isNull() || n.asText().isBlank())
                ? null : (int) n.asDouble();
    }

    protected String str(JsonNode n)                  { return str(n, ""); }
    protected String str(JsonNode n, String fallback) {
        String s = txt(n); return s != null ? s : fallback;
    }

    protected String first(String... vals) {
        for (String v : vals) if (v != null) return v;
        return null;
    }

    // ── ESPN structure helpers ────────────────────────────────────────────────

    protected JsonNode competitor(JsonNode comp, String side, int fallbackIdx) {
        JsonNode comps = comp.path("competitors");
        for (JsonNode c : comps) {
            if (side.equals(c.path("homeAway").asText())) return c;
        }
        return comps.has(fallbackIdx) ? comps.get(fallbackIdx) : null;
    }

    protected Dto.TeamRef teamRef(JsonNode t) {
        String logo = first(txt(t.path("logo")), txt(t.path("logos").path(0).path("href")), null);
        return new Dto.TeamRef(
                str(t.path("id")),
                first(txt(t.path("displayName")), txt(t.path("name")), "-"),
                first(txt(t.path("abbreviation")), txt(t.path("shortDisplayName")), ""),
                logo);
    }

    protected String bestImage(JsonNode images) {
        String best = null; int bestW = -1;
        for (JsonNode img : images) {
            int    w   = img.path("width").asInt(0);
            String src = first(txt(img.path("href")), txt(img.path("url")), txt(img.path("src")), null);
            if (src != null && src.startsWith("http") && w > bestW) { best = src; bestW = w; }
        }
        return best;
    }

    // ── Player / team resolution ──────────────────────────────────────────────

    protected String resolveTeamId(JsonNode teamNode) {
        if (teamNode.isMissingNode() || teamNode.isNull()) return null;
        String inline = txt(teamNode.path("id"));
        if (inline != null) return inline;
        String ref = txt(teamNode.path("$ref"));
        if (ref == null) return null;
        java.util.regex.Matcher m = TEAM_ID_FROM_REF.matcher(ref);
        return m.find() ? m.group(1) : null;
    }

    protected String resolveAthleteName(JsonNode play, Map<String, String> cache) {
        JsonNode parts = play.path("participants");
        if (parts.isArray() && parts.size() > 0) {
            for (JsonNode part : parts) {
                String name = athleteName(part.path("athlete"), cache);
                if (name != null) return name;
            }
        }
        JsonNode inv = play.path("athletesInvolved");
        if (inv.isArray() && inv.size() > 0) {
            for (JsonNode a : inv) {
                String name = athleteName(a, cache);
                if (name != null) return name;
            }
        }
        return null;
    }

    protected String athleteName(JsonNode ath, Map<String, String> cache) {
        if (ath.isMissingNode() || ath.isNull()) return null;
        String inline = first(txt(ath.path("displayName")), txt(ath.path("fullName")), txt(ath.path("shortName")));
        if (inline != null) return inline;
        String ref = txt(ath.path("$ref"));
        if (ref == null) return null;
        if (cache.containsKey(ref)) return cache.get(ref);
        try {
            JsonNode athlete = get(ref.replaceFirst("^http://", "https://"));
            String name = first(txt(athlete.path("displayName")), txt(athlete.path("fullName")), txt(athlete.path("shortName")));
            cache.put(ref, name);
            return name;
        } catch (Exception e) {
            cache.put(ref, null);
            return null;
        }
    }
}
