package org.Spring.api;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Shared ESPN API helpers for all sport services.
 *
 * <p>HTTP calls are delegated to the injected {@link EspnHttpClient} bean so
 * that {@code @Retryable} crosses the Spring proxy boundary and actually fires.
 * {@link ObjectMapper} is the single application-wide bean from {@code AppConfig}
 * — thread-safe and shared rather than re-constructed per class.
 *
 * <p><b>Ref resolution</b> is now a two-pass process to avoid N sequential
 * blocking HTTP calls while iterating plays/competitors:
 *   1. {@link # collectRefs(JsonNode)} walks a payload and gathers every
 *      unresolved {@code $ref} URL without fetching anything.
 *   2. {@link #resolveAllRefs(Set)} resolves the whole set in one batched
 *      call via {@link EspnHttpClient#getMany}, which checks Redis in bulk
 *      and fetches only genuine misses with bounded concurrency.
 * Callers then pass the resulting {@code Map<String, JsonNode>} into
 * {@link #athleteName} / {@link #resolveRef}, which are now pure lookups —
 * no HTTP call happens inside the per-play loop anymore.
 */
public abstract class EspnApiHelper {

    @Autowired protected EspnHttpClient espnHttp;
    @Autowired protected ObjectMapper   mapper;

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

    protected JsonNode get(String url) throws Exception {
        return espnHttp.get(url);
    }

    protected JsonNode getPaged(String baseUrl, int page, int limit) throws Exception {
        int safePage  = Math.max(page, 1);
        int safeLimit = Math.max(1, Math.min(limit, 100));
        String sep = baseUrl.contains("?") ? "&" : "?";
        return get(baseUrl + sep + "page=" + safePage + "&limit=" + safeLimit);
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

    private String normalizeRef(String ref) {
        return ref == null ? null : ref.replaceFirst("^http://", "https://");
    }

    // ── Pass 1: collect refs without fetching ───────────────────────────────

    /**
     * Walks a single play node and collects every unresolved athlete $ref
     * (from participants and athletesInvolved) into the given set. Call this
     * once per play across a whole payload BEFORE resolving anything, so all
     * refs for a game (or a whole league poll) can be fetched in one batch.
     */
    protected void collectAthleteRefs(JsonNode play, Set<String> refs) {
        for (JsonNode part : play.path("participants")) {
            String ref = txt(part.path("athlete").path("$ref"));
            if (ref != null) refs.add(normalizeRef(ref));
        }
        for (JsonNode a : play.path("athletesInvolved")) {
            String ref = txt(a.path("$ref"));
            if (ref != null) refs.add(normalizeRef(ref));
        }
    }

    /**
     * Collects a $ref from any generic node (team, venue, etc.) that would
     * otherwise be resolved via {@link #resolveRef}.
     */
    protected void collectRef(JsonNode node, Set<String> refs) {
        if (node == null || node.isMissingNode() || node.isNull()) return;
        if (node.has("displayName") || node.has("fullName")) return; // already inline
        String ref = txt(node.path("$ref"));
        if (ref != null) refs.add(normalizeRef(ref));
    }

    /** Convenience: start a fresh collection set. */
    protected Set<String> newRefSet() {
        return new LinkedHashSet<>();
    }

    // ── Pass 2: resolve the whole batch in one call ─────────────────────────

    /**
     * Resolves every URL in refs in one batched call — bulk Redis check, then
     * bounded-concurrency fetch for actual misses. Returns a map keyed by the
     * normalized (https) URL, ready to pass into athleteName()/resolveRef().
     */
    protected Map<String, JsonNode> resolveAllRefs(Set<String> refs) throws Exception {
        if (refs.isEmpty()) return Map.of();
        List<String> urls = new ArrayList<>(refs);
        return espnHttp.getMany(urls);
    }
    // EspnApiHelper.java — revert to fetch-on-miss

    protected String athleteName(JsonNode ath, Map<String, JsonNode> cache) {
        if (ath.isMissingNode() || ath.isNull()) return null;
        String inline = first(txt(ath.path("displayName")), txt(ath.path("fullName")), txt(ath.path("shortName")));
        if (inline != null) return inline;
        String ref = txt(ath.path("$ref"));
        if (ref == null) return null;
        String normalized = ref.replaceFirst("^http://", "https://");
        if (cache.containsKey(normalized)) {
            JsonNode cached = cache.get(normalized);
            return cached == null ? null : first(txt(cached.path("displayName")), txt(cached.path("fullName")), txt(cached.path("shortName")));
        }
        try {
            JsonNode athlete = espnHttp.get(normalized);
            cache.put(normalized, athlete);
            return first(txt(athlete.path("displayName")), txt(athlete.path("fullName")), txt(athlete.path("shortName")));
        } catch (Exception e) {
            cache.put(normalized, null);
            return null;
        }
    }

    protected String resolveAthleteName(JsonNode play, Map<String, JsonNode> cache) {
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

    protected JsonNode resolveRef(JsonNode node, Map<String, JsonNode> cache) {
        if (node == null || node.isMissingNode() || node.isNull()) return null;
        if (node.has("displayName") || node.has("fullName")) return node;
        String ref = txt(node.path("$ref"));
        if (ref == null) return null;
        String normalized = ref.replaceFirst("^http://", "https://");
        if (cache.containsKey(normalized)) return cache.get(normalized);
        try {
            JsonNode resolved = espnHttp.get(normalized);
            cache.put(normalized, resolved);
            return resolved;
        } catch (Exception e) {
            cache.put(normalized, null);
            return null;
        }
    }
}