package org.Spring.football.api;

import org.Spring.api.Dto;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Owns all ESPN reference-data parsing. This is the single place that knows
 * ESPN's raw shapes; everything downstream sees only clean DTOs.
 * Parsing logic ported from the frontend's espn.ts so output is identical.
 */
@Service
public class FootballService {

    private static final String SITE      = "https://site.api.espn.com/apis/site/v2/sports/soccer";
    private static final String STANDINGS = "https://site.api.espn.com/apis/v2/sports/soccer";

    private final HttpClient   http   = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    private final ObjectMapper mapper = new ObjectMapper();

    // scoreboard / fixtures

    public List<Dto.MatchDto> scoreboard(String league) throws Exception {
        JsonNode raw = get(SITE + "/" + league + "/scoreboard");
        List<Dto.MatchDto> out = new ArrayList<>();
        for (JsonNode e : raw.path("events")) {
            Dto.MatchDto m = parseEvent(e);
            if (m != null) out.add(m);
        }
        return out;
    }

    public Dto.Fixtures fixtures(String league) throws Exception {
        DateTimeFormatter fmt  = DateTimeFormatter.ofPattern("yyyyMMdd");
        String from = LocalDate.now().minusDays(21).format(fmt);
        String to   = LocalDate.now().plusDays(21).format(fmt);
        JsonNode raw = get(SITE + "/" + league + "/scoreboard?dates=" + from + "-" + to + "&limit=100");

        List<Dto.MatchDto> results  = new ArrayList<>();
        List<Dto.MatchDto> upcoming = new ArrayList<>();
        for (JsonNode e : raw.path("events")) {
            Dto.MatchDto m = parseEvent(e);
            if (m == null) continue;
            if ("post".equals(m.statusState()))      results.add(m);
            else if ("pre".equals(m.statusState()))  upcoming.add(m);
        }
        java.util.Collections.reverse(results); // most recent first
        return new Dto.Fixtures(results, upcoming);
    }

    private Dto.MatchDto parseEvent(JsonNode e) {
        JsonNode comp = e.path("competitions").path(0);
        if (comp.isMissingNode()) return null;
        JsonNode st   = comp.path("status").path("type");
        JsonNode home = competitor(comp, "home", 0);
        JsonNode away = competitor(comp, "away", 1);
        if (home == null || away == null) return null;

        String status      = first(txt(st.path("shortDetail")), txt(st.path("detail")), txt(st.path("name")), "");
        String state       = txt(st.path("state")) != null ? txt(st.path("state")) : "pre";
        String competition = first(
                txt(e.path("season").path("type").path("name")),
                txt(comp.path("tournament").path("name")), "");

        // Knockout round label (Round of 16, Quarterfinal, Semifinal, Final, Group Stage...).
        // ESPN puts this in competitions[0].notes[0].headline for tournament fixtures;
        // league fixtures (Premier League etc.) simply won't have a notes array.
        String round = txt(comp.path("notes").path(0).path("headline"));

        return new Dto.MatchDto(
                str(e.path("id")), status, state, txt(e.path("date")), competition,
                teamRef(home.path("team")), teamRef(away.path("team")),
                num(home.path("score")), num(away.path("score")), round);
    }

    private JsonNode competitor(JsonNode comp, String side, int fallbackIdx) {
        JsonNode comps = comp.path("competitors");
        for (JsonNode c : comps) {
            if (side.equals(c.path("homeAway").asText())) return c;
        }
        return comps.has(fallbackIdx) ? comps.get(fallbackIdx) : null;
    }

    private Dto.TeamRef teamRef(JsonNode t) {
        String logo = first(txt(t.path("logo")), txt(t.path("logos").path(0).path("href")), null);
        return new Dto.TeamRef(
                str(t.path("id")),
                first(txt(t.path("displayName")), txt(t.path("name")), "-"),
                first(txt(t.path("abbreviation")), txt(t.path("shortDisplayName")), ""),
                logo);
    }

    // standings

    public List<Dto.StandingRow> standings(String league) throws Exception {
        JsonNode raw = get(STANDINGS + "/" + league + "/standings");
        List<Dto.StandingRow> out = new ArrayList<>();

        JsonNode children = raw.path("children");
        if (children.isArray() && children.size() > 0) {
            // Multi-group competitions (World Cup, UCL group stage) have many children.
            // Single-table leagues (Premier League, La Liga) have exactly one child.
            for (JsonNode child : children) {
                String groupName = first(
                        txt(child.path("name")),
                        txt(child.path("displayName")),
                        txt(child.path("abbreviation")),
                        null);
                // For single-child responses we want group=null so the frontend renders one
                // continuous table (no group header) — same behavior as before.
                String groupForRow = children.size() > 1 ? groupName : null;
                appendEntries(child.path("standings").path("entries"), groupForRow, out);
            }
        }
        // Fallbacks for responses that omit `children`
        if (out.isEmpty()) appendEntries(raw.path("standings").path("entries"), null, out);
        if (out.isEmpty()) appendEntries(raw.path("entries"), null, out);

        return out;
    }

    private void appendEntries(JsonNode entries, String group, List<Dto.StandingRow> out) {
        if (entries.isMissingNode() || !entries.isArray()) return;
        int i = 0;
        for (JsonNode e : entries) {
            i++;
            JsonNode stats = e.path("stats");
            JsonNode t     = e.path("team");
            int gf   = stat(stats, "pointsFor",          "goalsFor");
            int ga   = stat(stats, "pointsAgainst",      "goalsAgainst");
            int gd   = stat(stats, "pointDifferential",  "goalDifferential");
            String note = e.path("note").path("color").isMissingNode() ? null
                    : txt(e.path("note").path("description"));
            int rank = stat(stats, "rank");
            out.add(new Dto.StandingRow(
                    rank != 0 ? rank : i,
                    str(t.path("id")),
                    first(txt(t.path("displayName")), txt(t.path("name")), "-"),
                    txt(t.path("abbreviation")) != null ? txt(t.path("abbreviation")) : "",
                    first(txt(t.path("logos").path(0).path("href")), txt(t.path("logo")), null),
                    stat(stats, "gamesPlayed"),
                    stat(stats, "wins"),
                    stat(stats, "ties", "draws"),
                    stat(stats, "losses"),
                    gf, ga, gd != 0 ? gd : gf - ga,
                    stat(stats, "points"), note, group));
        }
    }

    private int stat(JsonNode stats, String... names) {
        for (String n : names) {
            for (JsonNode s : stats) {
                if (n.equals(s.path("name").asText()) || n.equals(s.path("abbreviation").asText())) {
                    if (!s.path("value").isMissingNode() && !s.path("value").isNull())
                        return (int) s.path("value").asDouble();
                }
            }
        }
        return 0;
    }

    // news

    private static final Pattern TRANSFER = Pattern.compile(
            "\\b(sign(ed|ing|s)?|transfer(red|ring|s)?|join(ed|ing|s)?|deal|move(d|s)?|loan(ed|ing)?|fee|" +
            "bid(ding)?|want(ed|s)?|target(ed|ing|s)?|buy(ing)?|sold|sell(ing)?|agree(d|s|ment)?|swap|" +
            "release(d)?|contract|renew(al|ed|ing|s)?|exit(s|ed|ing)?|depart(ed|ure|ing|s)?|arrive(d|s)?|" +
            "unveil(ed|s)?|confirm(ed|s)?|scout(ed|ing|s)?|approach(ed|es|ing)?|negotiate(d|s|ing)?|" +
            "pursue(d|s|ing)?|reject(ed|s|ion)?|offer(ed|s|ing)?|window|deadline|permanent|" +
            "activat(e|ed|ion)?|option|clause|replac(e|ed|ing|ement)?|successor|appointment|" +
            "manag(er|ement|orial)?|sack(ed|ing)?|resign(ed|ation|ing)?|hire(d|s)?|appoint(ed|ment|ing)?)\\b",
            Pattern.CASE_INSENSITIVE);
    private static final java.util.Set<String> GENERIC =
            java.util.Set.of("Soccer", "Football", "Sports", "Sport");

    public List<Dto.NewsItem> news(String league, int limit) throws Exception {
        JsonNode raw = get(SITE + "/" + league + "/news?limit=" + limit);
        List<Dto.NewsItem> out = new ArrayList<>();
        int i = 0;
        for (JsonNode a : raw.path("articles")) {
            String headline = first(txt(a.path("headline")), "Untitled");
            String desc     = txt(a.path("description")) != null ? txt(a.path("description")) : "";
            String category = TRANSFER.matcher(headline + " " + desc).find()
                    ? "Transfer" : newsCategory(a.path("categories"));
            out.add(new Dto.NewsItem(
                    str(a.has("id") ? a.path("id") : null, String.valueOf(i)),
                    headline, desc,
                    txt(a.path("published")) != null ? txt(a.path("published")) : "",
                    bestImage(a.path("images")), category,
                    txt(a.path("links").path("web").path("href"))));
            i++;
        }
        return out;
    }

    private String newsCategory(JsonNode cats) {
        String league = null, team = null, other = null;
        for (JsonNode c : cats) {
            String d    = txt(c.path("description"));
            if (d == null) continue;
            String type = c.path("type").asText();
            if ("league".equals(type) && !GENERIC.contains(d) && league == null) league = d;
            else if ("team".equals(type) && team == null)                         team   = d;
            else if (!GENERIC.contains(d) && other == null)                       other  = d;
        }
        if (league != null) return league;
        if (team   != null) return team;
        if (other  != null) return other;
        return "Football";
    }

    private String bestImage(JsonNode images) {
        String best = null; int bestW = -1;
        for (JsonNode img : images) {
            int    w   = img.path("width").asInt(0);
            String src = first(txt(img.path("href")), txt(img.path("url")), txt(img.path("src")), null);
            if (src != null && src.startsWith("http") && w > bestW) { best = src; bestW = w; }
        }
        return best;
    }

    // team / roster

    public Dto.TeamDetail team(String league, String teamId) throws Exception {
        JsonNode raw = get(SITE + "/" + league + "/teams/" + teamId);
        JsonNode t   = raw.path("team").isMissingNode() ? raw : raw.path("team");
        if (txt(t.path("displayName")) == null && txt(t.path("name")) == null) return null;
        String color = txt(t.path("color"));
        return new Dto.TeamDetail(
                str(t.has("id") ? t.path("id") : null, teamId),
                first(txt(t.path("displayName")), txt(t.path("name")), "-"),
                first(txt(t.path("abbreviation")), txt(t.path("shortDisplayName")), ""),
                first(txt(t.path("logos").path(0).path("href")), txt(t.path("logo")), null),
                color != null ? "#" + color : null,
                txt(t.path("venue").path("fullName")),
                txt(t.path("record").path("items").path(0).path("summary")));
    }

    public List<Dto.Player> roster(String league, String teamId) throws Exception {
        JsonNode raw      = get(SITE + "/" + league + "/teams/" + teamId + "/roster");
        JsonNode athletes = raw.path("athletes");
        List<JsonNode> list = new ArrayList<>();
        if (athletes.isArray() && athletes.size() > 0 && athletes.get(0).has("items")) {
            for (JsonNode g : athletes) for (JsonNode p : g.path("items")) list.add(p);
        } else {
            for (JsonNode p : athletes) list.add(p);
        }
        List<Dto.Player> out = new ArrayList<>();
        int i = 0;
        for (JsonNode p : list) {
            out.add(new Dto.Player(
                    str(p.has("id") ? p.path("id") : null, String.valueOf(i)),
                    first(txt(p.path("displayName")), txt(p.path("fullName")), "-"),
                    txt(p.path("jersey")),
                    first(txt(p.path("position").path("abbreviation")), txt(p.path("position").path("name")), null),
                    p.path("age").isMissingNode() || p.path("age").isNull() ? null : p.path("age").asInt(),
                    first(txt(p.path("citizenship")), txt(p.path("birthPlace").path("country")), null),
                    txt(p.path("headshot").path("href"))));
            i++;
        }
        return out;
    }

    // leaders

    public List<Dto.Leader> leaders(String league) throws Exception {
        List<Dto.Leader> siteResult = leadersFromSiteApi(league);
        if (!siteResult.isEmpty()) return siteResult;
        // Site API leaders is unreliable for soccer (per ESPN's public API docs) — fall
        // back to the Core API, which needs a season segment to return real data.
        List<Dto.Leader> coreResult = leadersFromCoreApi(league);
        if (!coreResult.isEmpty()) return coreResult;
        // Both official leaders endpoints can come back genuinely empty early in a season
        // (zero matches played = zero goals to rank). As a last resort, compute leaders
        // ourselves from the goal events of recently finished matches in this league.
        return leadersFromRecentMatches(league);
    }

    /** Cache of resolved current-season years per league, since this rarely changes. */
    private final java.util.Map<String, Integer> seasonYearCache = new java.util.concurrent.ConcurrentHashMap<>();

    /** Resolve the current season year for a league from the scoreboard (always present). */
    private int currentSeasonYear(String league) {
        return seasonYearCache.computeIfAbsent(league, lg -> {
            try {
                JsonNode raw = get(SITE + "/" + lg + "/scoreboard");
                int year = raw.path("season").path("year").asInt(0);
                if (year > 0) return year;
            } catch (Exception ignored) { }
            return java.time.LocalDate.now().getYear();
        });
    }

    /**
     * Last-resort top scorers: tallies goals from each finished match's own event data
     * (the same data already shown on the match detail page). Works from matchday 1 —
     * unlike the official leaders endpoints, which can be empty until ESPN's stats
     * pipeline catches up. Caps the match scan to keep this fast.
     */
    private List<Dto.Leader> leadersFromRecentMatches(String league) {
        java.util.Map<String, int[]> goalsByPlayer = new java.util.LinkedHashMap<>(); // name -> [count]
        java.util.Map<String, String> teamByPlayer  = new java.util.HashMap<>();
        try {
            Dto.Fixtures fx = fixtures(league);
            List<Dto.MatchDto> finished = fx.results();
            int scanned = 0;
            for (Dto.MatchDto m : finished) {
                if (scanned >= 15) break; // recent matches only, keep this cheap
                scanned++;
                try {
                    Dto.MatchDetail detail = matchDetail(league, m.id());
                    if (detail == null) continue;
                    for (Dto.MatchEventDto ev : detail.events()) {
                        if (!"goal".equals(ev.type()) || ev.player() == null) continue;
                        String teamName = ev.teamId().equals(detail.homeTeam().id())
                                ? detail.homeTeam().shortName() : detail.awayTeam().shortName();
                        goalsByPlayer.computeIfAbsent(ev.player(), k -> new int[]{0})[0]++;
                        teamByPlayer.putIfAbsent(ev.player(), teamName);
                    }
                } catch (Exception inner) {
                    // skip matches that fail to parse, don't let one bad match kill the whole list
                }
            }
        } catch (Exception e) {
            return List.of();
        }

        List<java.util.Map.Entry<String, int[]>> sorted = new ArrayList<>(goalsByPlayer.entrySet());
        sorted.sort((a, b) -> b.getValue()[0] - a.getValue()[0]);

        List<Dto.Leader> out = new ArrayList<>();
        int rank = 1;
        for (var entry : sorted) {
            if (rank > 10) break;
            int goals = entry.getValue()[0];
            if (goals <= 0) continue;
            out.add(new Dto.Leader(
                    rank, "Goals", entry.getKey(), teamByPlayer.getOrDefault(entry.getKey(), ""),
                    null, null, goals, String.valueOf(goals)));
            rank++;
        }
        return out;
    }

    private List<Dto.Leader> leadersFromSiteApi(String league) {
        try {
            JsonNode raw  = get(SITE + "/" + league + "/leaders");
            JsonNode cats = raw.path("categories");
            JsonNode cat  = null;
            for (JsonNode c : cats) {
                if (c.path("name").asText("").matches("(?i).*(goal|scor).*")) { cat = c; break; }
            }
            if (cat == null && cats.isArray() && cats.size() > 0) cat = cats.get(0);
            if (cat == null) return List.of();

            List<Dto.Leader> out = new ArrayList<>();
            String catName = first(txt(cat.path("displayName")), txt(cat.path("name")), "Leaders");
            int i = 0;
            for (JsonNode l : cat.path("leaders")) {
                out.add(new Dto.Leader(
                        i + 1, catName,
                        first(txt(l.path("athlete").path("displayName")), "-"),
                        first(txt(l.path("team").path("abbreviation")), txt(l.path("team").path("displayName")), ""),
                        txt(l.path("team").path("logos").path(0).path("href")),
                        txt(l.path("athlete").path("headshot").path("href")),
                        l.path("value").asDouble(0),
                        first(txt(l.path("displayValue")), txt(l.path("value")), "")));
                i++;
            }
            return out;
        } catch (Exception e) {
            return List.of();
        }
    }

    /**
     * Core API leaders endpoint requires a season segment — the no-season form
     * (`/leagues/{league}/leaders`) returns a 400 "getLeadersAllTime not supported for
     * soccer" error. We resolve the current season year dynamically (it changes every
     * July/August) and call `/leagues/{league}/seasons/{year}/leaders` instead.
     */
    private List<Dto.Leader> leadersFromCoreApi(String league) {
        List<Dto.Leader> out = new ArrayList<>();
        try {
            int season = currentSeasonYear(league);
            JsonNode raw  = get(CORE + "/leagues/" + league + "/seasons/" + season + "/leaders");
            JsonNode cats = raw.path("categories");
            JsonNode cat  = null;
            for (JsonNode c : cats) {
                if (c.path("name").asText("").matches("(?i).*(goal|scor).*")) { cat = c; break; }
            }
            if (cat == null && cats.isArray() && cats.size() > 0) cat = cats.get(0);
            if (cat == null) return out;

            String catName = first(txt(cat.path("displayName")), txt(cat.path("name")), "Goals");
            java.util.Map<String, JsonNode> athleteCache = new java.util.HashMap<>();
            java.util.Map<String, JsonNode> teamCache    = new java.util.HashMap<>();

            int i = 0;
            for (JsonNode l : cat.path("leaders")) {
                if (i >= 10) break; // top 10 is plenty for a sidebar widget
                JsonNode athleteRef = l.path("athlete");
                JsonNode athlete = resolveRef(athleteRef, athleteCache);
                if (athlete == null) continue;

                JsonNode teamRefNode = l.path("team");
                JsonNode team = resolveRef(teamRefNode, teamCache);

                out.add(new Dto.Leader(
                        i + 1, catName,
                        first(txt(athlete.path("displayName")), txt(athlete.path("fullName")), "-"),
                        team != null ? first(txt(team.path("abbreviation")), txt(team.path("displayName")), "") : "",
                        team != null ? txt(team.path("logos").path(0).path("href")) : null,
                        txt(athlete.path("headshot").path("href")),
                        l.path("value").asDouble(0),
                        first(txt(l.path("displayValue")), String.valueOf(l.path("value").asInt(0)))));
                i++;
            }
        } catch (Exception e) {
            // Common and expected early in a season: ESPN simply has no leader data yet
            // (zero matches played means zero goals to rank). Not worth logging as an error.
        }
        return out;
    }

    /** Resolve a Core API hypermedia object: either inline data or a {"$ref": url} pointer. */
    private JsonNode resolveRef(JsonNode node, java.util.Map<String, JsonNode> cache) {
        if (node == null || node.isMissingNode() || node.isNull()) return null;
        if (node.has("displayName") || node.has("fullName")) return node; // already inline
        String ref = txt(node.path("$ref"));
        if (ref == null) return null;
        if (cache.containsKey(ref)) return cache.get(ref);
        try {
            JsonNode resolved = get(ref.replaceFirst("^http://", "https://"));
            cache.put(ref, resolved);
            return resolved;
        } catch (Exception e) {
            cache.put(ref, null);
            return null;
        }
    }

    // match detail

    /**
     * Slugs to try when the requested league fails to return a valid match.
     * ESPN event IDs are globally unique, so the same event=N works under any
     * league slug — but ESPN does reject requests where the slug is completely
     * wrong (returns empty header). We try the most common slugs as fallbacks.
     */
    private static final java.util.List<String> SLUG_FALLBACKS = java.util.List.of(
            "uefa.europa", "uefa.champions", "uefa.europa.conf",
            "fifa.world", "fifa.friendly",
            "eng.1", "eng.2", "esp.1", "ita.1", "ger.1", "fra.1",
            "usa.1", "ned.1", "por.1", "mex.1", "arg.1", "jpn.1", "aus.1", "bra.1"
    );

    public Dto.MatchDetail matchDetail(String league, String eventId) throws Exception {
        // Try the requested league first, then fall back to other slugs.
        // This handles the case where the frontend URL has the wrong league slug
        // (e.g. a Europa League match linked with league=eng.1 because the
        // slugFromCompetition reverse-map was incomplete).
        Dto.MatchDetail result = tryMatchDetail(league, eventId);
        if (result != null) return result;

        for (String slug : SLUG_FALLBACKS) {
            if (slug.equals(league)) continue; // already tried
            result = tryMatchDetail(slug, eventId);
            if (result != null) return result;
        }
        return null;
    }

    private static final String CORE = "https://sports.core.api.espn.com/v2/sports/soccer";

    /** Regex: capture player name appearing as "Player Name (Team Name)" in a play's text. */
    private static final Pattern PLAYER_FROM_TEXT = Pattern.compile(
            "([A-ZÀ-Þ][\\p{L}'’\\.\\-]+(?:\\s+[A-ZÀ-Þ][\\p{L}'’\\.\\-]+){0,4})\\s*\\(",
            Pattern.UNICODE_CHARACTER_CLASS);

    private Dto.MatchDetail tryMatchDetail(String league, String eventId) throws Exception {
        JsonNode raw    = get(SITE + "/" + league + "/summary?event=" + eventId);
        JsonNode header = raw.path("header");

        JsonNode headerComp = header.path("competitions").path(0);
        JsonNode st         = headerComp.path("status").path("type");
        JsonNode home       = competitor(headerComp, "home", 0);
        JsonNode away       = competitor(headerComp, "away", 1);
        if (home == null || away == null) return null;

        // Fetch player names from Core API plays endpoint (the site summary's details[]
        // never includes athletesInvolved for soccer).
        java.util.Map<String, String> playerByKey = fetchPlayersFromCoreApi(league, eventId);

        JsonNode topComp      = raw.path("competitions").path(0);
        JsonNode detailSource = !topComp.isMissingNode() ? topComp : headerComp;

        List<Dto.MatchEventDto> events = new ArrayList<>();
        for (JsonNode d : detailSource.path("details")) {
            Dto.MatchEventDto ev = parseSummaryEvent(d, playerByKey);
            if (ev != null && noDup(events, ev)) events.add(ev);
        }
        for (String key : new String[]{"keyEvents", "plays", "scoringPlays"}) {
            for (JsonNode d : raw.path(key)) {
                Dto.MatchEventDto ev = parseSummaryEvent(d, playerByKey);
                if (ev != null && noDup(events, ev)) events.add(ev);
            }
        }

        events.sort(java.util.Comparator.comparingInt(Dto.MatchEventDto::minute));

        List<Dto.TeamLineup> lineups = parseLineups(raw);

        JsonNode gi = raw.path("gameInfo");
        return new Dto.MatchDetail(
                str(headerComp.has("id") ? headerComp.path("id") : null, eventId),
                first(txt(st.path("shortDetail")), txt(st.path("detail")), ""),
                txt(st.path("state")) != null ? txt(st.path("state")) : "post",
                txt(headerComp.path("date")),
                txt(header.path("league").path("name")),
                txt(gi.path("venue").path("fullName")),
                gi.path("attendance").isMissingNode() || gi.path("attendance").isNull()
                        ? null : gi.path("attendance").asInt(),
                teamRef(home.path("team")), teamRef(away.path("team")),
                num(home.path("score")), num(away.path("score")),
                events, lineups);
    }

    /**
     * Parses ESPN's `rosters[]` array from the summary endpoint into starters + bench
     * per team. Returns an empty list if ESPN hasn't published lineups yet (common for
     * fixtures more than ~1 hour before kickoff).
     */
    private List<Dto.TeamLineup> parseLineups(JsonNode raw) {
        List<Dto.TeamLineup> out = new ArrayList<>();
        JsonNode rosters = raw.path("rosters");
        if (!rosters.isArray() || rosters.size() == 0) return out;

        for (JsonNode r : rosters) {
            String teamId = str(r.path("team").path("id"));
            if (teamId == null) continue;
            String formation = txt(r.path("formation"));

            List<Dto.LineupPlayer> starters = new ArrayList<>();
            List<Dto.LineupPlayer> bench    = new ArrayList<>();

            for (JsonNode entry : r.path("roster")) {
                JsonNode athlete = entry.path("athlete");
                String name = first(txt(athlete.path("displayName")), txt(athlete.path("fullName")), null);
                if (name == null) continue;
                boolean starter = entry.path("starter").asBoolean(false);
                Dto.LineupPlayer lp = new Dto.LineupPlayer(
                        str(athlete.has("id") ? athlete.path("id") : null, name),
                        name,
                        txt(entry.path("jersey")),
                        first(txt(entry.path("position").path("abbreviation")),
                              txt(athlete.path("position").path("abbreviation")), null),
                        starter, teamId);
                (starter ? starters : bench).add(lp);
            }
            if (!starters.isEmpty() || !bench.isEmpty()) {
                out.add(new Dto.TeamLineup(teamId, formation, starters, bench));
            }
        }
        return out;
    }

    /**
     * Build a "minute:teamId" → player name map from the Core API plays endpoint.
     * Strategy per play: regex the player from the play's `text` field first (cheapest
     * and most reliable — text looks like "Ollie Watkins (Aston Villa) right footed shot"),
     * then fall back to resolving athlete $ref URLs.
     */
    private java.util.Map<String, String> fetchPlayersFromCoreApi(String league, String eventId) {
        java.util.Map<String, String> map = new java.util.HashMap<>();
        try {
            String url = CORE + "/leagues/" + league + "/events/" + eventId
                    + "/competitions/" + eventId + "/plays?limit=300";
            JsonNode plays = get(url);
            JsonNode items = plays.path("items");
            if (!items.isArray() || items.size() == 0) {
                System.err.println("[matchDetail] Core API plays empty for " + league + "/" + eventId);
                return map;
            }

            java.util.Map<String, String> athleteCache = new java.util.HashMap<>();

            for (JsonNode p : items) {
                String typeText = p.path("type").path("text").asText("").toLowerCase();
                boolean isGoal  = p.path("scoringPlay").asBoolean(false) || typeText.contains("goal");
                boolean isCard  = p.path("yellowCard").asBoolean(false)
                                  || p.path("redCard").asBoolean(false)
                                  || typeText.contains("card");
                if (!isGoal && !isCard) continue;

                int    minute = parseMinute(p.path("clock").path("displayValue").asText(""));
                String teamId = resolveTeamId(p.path("team"));
                if (teamId == null) continue;

                // 1. Try regex extraction from the play's text field.
                String name = extractPlayerFromText(p.path("text").asText(""));

                // 2. Try inline displayName / $ref resolution.
                if (name == null) name = resolveAthleteName(p, athleteCache);

                if (name != null) {
                    String key = minute + ":" + teamId;
                    map.putIfAbsent(key, name);
                }
            }
        } catch (Exception e) {
            System.err.println("[matchDetail] Core API plays fetch failed: " + e.getMessage());
        }
        return map;
    }

    /** Pull a player name like "Ollie Watkins" from text like "Ollie Watkins (Aston Villa) ...". */
    private String extractPlayerFromText(String text) {
        if (text == null || text.isBlank()) return null;
        // Skip the "Goal!" / "GOAL!" prefix some entries have
        String t = text.replaceFirst("(?i)^\\s*goal!?\\s*[^.]*\\.\\s*", "");
        java.util.regex.Matcher m = PLAYER_FROM_TEXT.matcher(t);
        if (m.find()) {
            String candidate = m.group(1).trim();
            // Sanity: real player names are 4-60 chars and have at least one space (first + last)
            if (candidate.length() >= 4 && candidate.length() <= 60 && candidate.contains(" ")) {
                return candidate;
            }
        }
        return null;
    }

    /** Team in Core API is usually a $ref. Pull team id from the URL or inline. */
    private String resolveTeamId(JsonNode teamNode) {
        if (teamNode.isMissingNode() || teamNode.isNull()) return null;
        String inline = txt(teamNode.path("id"));
        if (inline != null) return inline;
        String ref = txt(teamNode.path("$ref"));
        if (ref == null) return null;
        java.util.regex.Matcher m = Pattern.compile("/teams/(\\d+)").matcher(ref);
        return m.find() ? m.group(1) : null;
    }

    /** Get athlete displayName from a play, resolving $ref if necessary. */
    private String resolveAthleteName(JsonNode play, java.util.Map<String, String> cache) {
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

    private String athleteName(JsonNode ath, java.util.Map<String, String> cache) {
        if (ath.isMissingNode() || ath.isNull()) return null;
        String inline = first(txt(ath.path("displayName")),
                              txt(ath.path("fullName")),
                              txt(ath.path("shortName")));
        if (inline != null) return inline;
        String ref = txt(ath.path("$ref"));
        if (ref == null) return null;
        if (cache.containsKey(ref)) return cache.get(ref);
        try {
            String url = ref.replaceFirst("^http://", "https://");
            JsonNode athlete = get(url);
            String name = first(txt(athlete.path("displayName")),
                                txt(athlete.path("fullName")),
                                txt(athlete.path("shortName")));
            cache.put(ref, name);
            return name;
        } catch (Exception e) {
            cache.put(ref, null);
            return null;
        }
    }

    private Dto.MatchEventDto parseSummaryEvent(JsonNode d, java.util.Map<String, String> playerByKey) {
        String typeText = d.path("type").path("text").asText("").toLowerCase();
        boolean isGoal  = d.path("scoringPlay").asBoolean(false) || typeText.contains("goal");
        boolean isCard  = d.path("redCard").asBoolean(false) || d.path("yellowCard").asBoolean(false)
                          || typeText.contains("card");
        if (!isGoal && !isCard) return null;

        String detail = isGoal ? d.path("type").path("text").asText("Goal")
                : d.path("redCard").asBoolean(false)    ? "Red Card"
                : d.path("yellowCard").asBoolean(false) ? "Yellow Card"
                : d.path("type").path("text").asText("Card");

        int    minute = parseMinute(d.path("clock").path("displayValue").asText(""));
        String teamId = str(d.path("team").path("id"));

        // Resolve player name with a chain of fallbacks:
        //  1. inline athletesInvolved (populated in scoreboard details, not summary)
        //  2. extract from this event's own `text` field
        //  3. lookup in Core API plays map (keyed by minute:teamId)
        //  4. lookup with ±1 minute tolerance (Core API and summary minutes can differ by 1)
        JsonNode ath = d.path("athletesInvolved");
        String player = null;
        String assist = null;

        if (ath.isArray() && ath.size() > 0) {
            player = txt(ath.path(0).path("displayName"));
            if (ath.size() > 1) assist = txt(ath.path(1).path("displayName"));
        }
        if (player == null) {
            player = extractPlayerFromText(d.path("text").asText(""));
        }
        if (player == null && teamId != null && !teamId.isEmpty()) {
            player = playerByKey.get(minute + ":" + teamId);
            if (player == null) player = playerByKey.get((minute - 1) + ":" + teamId);
            if (player == null) player = playerByKey.get((minute + 1) + ":" + teamId);
        }

        return new Dto.MatchEventDto(minute, isGoal ? "goal" : "card", detail, player, assist, teamId);
    }

    private Dto.MatchEventDto parseSummaryEvent(JsonNode d) {
        return parseSummaryEvent(d, java.util.Map.of());
    }

    private boolean noDup(List<Dto.MatchEventDto> list, Dto.MatchEventDto ev) {
        for (Dto.MatchEventDto x : list) {
            if (x.minute() == ev.minute() && x.type().equals(ev.type())
                    && java.util.Objects.equals(x.player(), ev.player())) return false;
        }
        return true;
    }

    // low-level helpers

    private JsonNode get(String url) throws Exception {
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(url)).timeout(Duration.ofSeconds(15))
                .header("User-Agent", "SportScore/1.0").GET().build();
        HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
        if (res.statusCode() != 200) return mapper.createObjectNode();
        return mapper.readTree(res.body());
    }

    private int parseMinute(String display) {
        if (display == null) return 0;
        java.util.regex.Matcher m = Pattern.compile("\\d+").matcher(display);
        return m.find() ? Integer.parseInt(m.group()) : 0;
    }

    private String txt(JsonNode n) {
        return (n == null || n.isMissingNode() || n.isNull()) ? null : n.asText();
    }

    private Integer num(JsonNode n) {
        return (n == null || n.isMissingNode() || n.isNull() || n.asText().isBlank())
                ? null : (int) n.asDouble();
    }

    private String str(JsonNode n)               { return str(n, ""); }
    private String str(JsonNode n, String fallback) {
        String s = txt(n); return s != null ? s : fallback;
    }

    private String first(String... vals) {
        for (String v : vals) if (v != null) return v;
        return null;
    }
}