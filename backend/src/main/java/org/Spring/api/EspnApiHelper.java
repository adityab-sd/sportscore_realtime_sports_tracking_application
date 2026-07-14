package org.Spring.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.Map;
import java.util.regex.Pattern;

/**
 * Shared ESPN API helpers for all sport services.
 *
 * <p>HTTP calls are delegated to the injected {@link EspnHttpClient} bean so
 * that {@code @Retryable} crosses the Spring proxy boundary and actually fires.
 * {@link ObjectMapper} is the single application-wide bean from {@code AppConfig}
 * — thread-safe and shared rather than re-constructed per class.
 */
public abstract class EspnApiHelper {

    /**
     * Injected by Spring into every concrete subclass (@Service / @Component).
     * Field injection is used here because the abstract base has no constructor
     * that subclasses are required to call with these collaborators.
     */
    @Autowired protected EspnHttpClient espnHttp;
    @Autowired protected ObjectMapper   mapper;

    private static final Pattern TEAM_ID_FROM_REF = Pattern.compile("/teams/(\\d+)");

    // ── HTTP delegation ───────────────────────────────────────────────────────

    /** Delegates to {@link EspnHttpClient#get} — retry/backoff fires correctly. */
    protected JsonNode get(String url) throws Exception {
        return espnHttp.get(url);
    }

    protected JsonNode getPaged(String baseUrl, int page, int limit) throws Exception {
        String sep = baseUrl.contains("?") ? "&" : "?";
        return get(baseUrl + sep + "page=" + page + "&limit=" + limit);
    }

    // ── Node helpers ──────────────────────────────────────────────────────────

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
            // Calls through espnHttp — crosses the proxy, retry fires correctly.
            JsonNode athlete = espnHttp.get(ref.replaceFirst("^http://", "https://"));
            String name = first(txt(athlete.path("displayName")), txt(athlete.path("fullName")), txt(athlete.path("shortName")));
            cache.put(ref, name);
            return name;
        } catch (Exception e) {
            cache.put(ref, null);
            return null;
        }
    }

    protected JsonNode resolveRef(JsonNode node, Map<String, JsonNode> cache) {
        if (node == null || node.isMissingNode() || node.isNull()) return null;
        if (node.has("displayName") || node.has("fullName")) return node;
        String ref = txt(node.path("$ref"));
        if (ref == null) return null;
        if (cache.containsKey(ref)) return cache.get(ref);
        try {
            JsonNode resolved = espnHttp.get(ref.replaceFirst("^http://", "https://"));
            cache.put(ref, resolved);
            return resolved;
        } catch (Exception e) {
            cache.put(ref, null);
            return null;
        }
    }
}
