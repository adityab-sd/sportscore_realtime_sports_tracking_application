package org.Spring.basketball.api;

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
 * Owns all ESPN basketball reference-data parsing. Brought to FootballService
 * parity:
 *   - multi-group standings via children iteration (conference grouping)
 *   - football-grade news categorisation (league/team priority, generic filter,
 *     trade/signing detection)
 *   - match detail carries a player-attributed `events` list (scoring plays)
 *     alongside the per-quarter line scores, resolved with the same fallback
 *     chain football uses (inline athlete -> text regex -> Core API plays).
 *
 * Standings use the /apis/v2/ path (the /apis/site/v2/ path is a stub).
 */
@Service
public class BasketballService {

    private static final String SITE      = "https://site.api.espn.com/apis/site/v2/sports/basketball";
    private static final String STANDINGS = "https://site.api.espn.com/apis/v2/sports/basketball";
    private static final String CORE      = "https://sports.core.api.espn.com/v2/sports/basketball";

    private final HttpClient   http   = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    private final ObjectMapper mapper = new ObjectMapper();

    // scoreboard / fixtures

    public List<BasketballDto.GameDto> scoreboard(String league) throws Exception {
        JsonNode raw = get(SITE + "/" + league + "/scoreboard");
        List<BasketballDto.GameDto> out = new ArrayList<>();
        for (JsonNode e : raw.path("events")) {
            BasketballDto.GameDto g = parseEvent(e);
            if (g != null) out.add(g);
        }
        return out;
    }

    public BasketballDto.Fixtures fixtures(String league) throws Exception {
        DateTimeFormatter fmt  = DateTimeFormatter.ofPattern("yyyyMMdd");
        String from = LocalDate.now().minusDays(21).format(fmt);
        String to   = LocalDate.now().plusDays(21).format(fmt);
        JsonNode raw = get(SITE + "/" + league + "/scoreboard?dates=" + from + "-" + to + "&limit=100");

        List<BasketballDto.GameDto> results  = new ArrayList<>();
        List<BasketballDto.GameDto> upcoming = new ArrayList<>();
        for (JsonNode e : raw.path("events")) {
            BasketballDto.GameDto g = parseEvent(e);
            if (g == null) continue;
            if ("post".equals(g.statusState()))     results.add(g);
            else if ("pre".equals(g.statusState())) upcoming.add(g);
        }
        java.util.Collections.reverse(results);
        return new BasketballDto.Fixtures(results, upcoming);
    }

    private BasketballDto.GameDto parseEvent(JsonNode e) {
        JsonNode comp = e.path("competitions").path(0);
        if (comp.isMissingNode()) return null;
        JsonNode statusNode = comp.path("status");
        JsonNode st         = statusNode.path("type");
        JsonNode home       = competitor(comp, "home", 0);
        JsonNode away       = competitor(comp, "away", 1);
        if (home == null || away == null) return null;

        String  status      = first(txt(st.path("shortDetail")), txt(st.path("detail")), txt(st.path("name")), "");
        String  state       = txt(st.path("state")) != null ? txt(st.path("state")) : "pre";
        Integer period      = statusNode.path("period").canConvertToInt() ? statusNode.path("period").asInt() : null;
        String  clock       = txt(statusNode.path("displayClock"));
        String  competition = first(txt(comp.path("league").path("name")),
                                    txt(e.path("league").path("name")), "Basketball");

        return new BasketballDto.GameDto(
                str(e.path("id")), status, state, txt(e.path("date")), competition,
                teamRef(home.path("team")), teamRef(away.path("team")),
                num(home.path("score")), num(away.path("score")),
                period, clock);
    }

    // standings (multi-group, mirrors football)

    public List<BasketballDto.StandingRow> standings(String league) throws Exception {
        JsonNode raw = get(STANDINGS + "/" + league + "/standings");
        List<BasketballDto.StandingRow> out = new ArrayList<>();

        JsonNode children = raw.path("children");
        if (children.isArray() && children.size() > 0) {
            for (JsonNode child : children) {
                String conf = first(txt(child.path("name")), txt(child.path("displayName")),
                                    txt(child.path("abbreviation")), null);
                String confForRow = children.size() > 1 ? conf : null;
                appendEntries(child.path("standings").path("entries"), confForRow, out);
            }
        }
        if (out.isEmpty()) appendEntries(raw.path("standings").path("entries"), null, out);
        if (out.isEmpty()) appendEntries(raw.path("entries"), null, out);

        for (int i = 0; i < out.size(); i++) {
            if (out.get(i).rank() == 0) {
                BasketballDto.StandingRow r = out.get(i);
                out.set(i, new BasketballDto.StandingRow(
                        i + 1, r.teamId(), r.team(), r.shortName(), r.logo(),
                        r.wins(), r.losses(), r.winPct(), r.gamesBehind(),
                        r.streak(), r.homeRecord(), r.awayRecord(), r.conference()));
            }
        }
        return out;
    }

    private void appendEntries(JsonNode entries, String conference, List<BasketballDto.StandingRow> out) {
        if (entries.isMissingNode() || !entries.isArray()) return;
        for (JsonNode e : entries) {
            JsonNode stats = e.path("stats");
            JsonNode t     = e.path("team");
            out.add(new BasketballDto.StandingRow(
                    statInt(stats, "rank", "playoffSeed"),
                    str(t.path("id")),
                    first(txt(t.path("displayName")), txt(t.path("name")), "-"),
                    first(txt(t.path("abbreviation")), txt(t.path("shortDisplayName")), ""),
                    first(txt(t.path("logos").path(0).path("href")), txt(t.path("logo")), null),
                    statInt(stats, "wins"), statInt(stats, "losses"),
                    statDouble(stats, "winPercent", "winpercent"),
                    statDouble(stats, "gamesBehind", "gamesbehind"),
                    statStr(stats, "streak"),
                    statStr(stats, "home"), statStr(stats, "road", "away"),
                    conference));
        }
    }

    // news (football-grade)

    private static final Pattern TRADE = Pattern.compile(
            "\\b(trade(d|s)?|sign(ed|ing|s)?|deal|acquire(d|s)?|waiver(s)?|release(d)?|" +
            "buyout|free\\s*agent|contract|extension|draft(ed|s)?|injur(y|ed|ies)|" +
            "out\\s*(for|indefinitely)|return(s|ed|ing)?)\\b",
            Pattern.CASE_INSENSITIVE);
    private static final java.util.Set<String> GENERIC =
            java.util.Set.of("Basketball", "NBA", "WNBA", "Sports", "Sport");

    public List<Dto.NewsItem> news(String league, int limit) throws Exception {
        JsonNode raw = get(SITE + "/" + league + "/news?limit=" + limit);
        List<Dto.NewsItem> out = new ArrayList<>();
        int i = 0;
        for (JsonNode a : raw.path("articles")) {
            String headline = first(txt(a.path("headline")), "Untitled");
            String desc     = txt(a.path("description")) != null ? txt(a.path("description")) : "";
            String category = TRADE.matcher(headline + " " + desc).find()
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
            String d = txt(c.path("description"));
            if (d == null) continue;
            String type = c.path("type").asText();
            if ("league".equals(type) && !GENERIC.contains(d) && league == null) league = d;
            else if ("team".equals(type) && team == null)                         team   = d;
            else if (!GENERIC.contains(d) && other == null)                       other  = d;
        }
        if (league != null) return league;
        if (team   != null) return team;
        if (other  != null) return other;
        return "Basketball";
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
        JsonNode raw  = get(SITE + "/" + league + "/statistics");
        JsonNode cats = raw.path("categories");
        if (!cats.isArray() || cats.isEmpty()) cats = raw.path("leaders").path("categories");
        List<Dto.Leader> out = new ArrayList<>();
        JsonNode cat = null;
        for (JsonNode c : cats) {
            if (c.path("name").asText("").matches("(?i).*(point|scor|pts).*")) { cat = c; break; }
        }
        if (cat == null && cats.isArray() && cats.size() > 0) cat = cats.get(0);
        if (cat == null) return out;
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
    }

    // match detail (with player-attributed events)

    public BasketballDto.GameDetail matchDetail(String league, String eventId) throws Exception {
        JsonNode raw        = get(SITE + "/" + league + "/summary?event=" + eventId);
        JsonNode header     = raw.path("header");
        JsonNode comp       = header.path("competitions").path(0);
        JsonNode statusNode = comp.path("status");
        JsonNode st         = statusNode.path("type");
        JsonNode home       = competitor(comp, "home", 0);
        JsonNode away       = competitor(comp, "away", 1);
        if (home == null || away == null) return null;

        List<BasketballDto.LineScore> lines = new ArrayList<>();
        for (JsonNode c : comp.path("competitors")) {
            List<Integer> periods = new ArrayList<>();
            int total = 0;
            for (JsonNode ls : c.path("linescores")) {
                int v = (int) ls.path("displayValue").asDouble(ls.path("value").asDouble(0));
                periods.add(v);
                total += v;
            }
            lines.add(new BasketballDto.LineScore(str(c.path("team").path("id")), periods, total));
        }

        // Player-attributed scoring events (the football-goal parallel).
        java.util.Map<String, String> playerByKey = fetchPlayersFromCoreApi(league, eventId);
        List<Dto.MatchEventDto> events = new ArrayList<>();
        for (String key : new String[]{"scoringPlays", "plays"}) {
            for (JsonNode d : raw.path(key)) {
                Dto.MatchEventDto ev = parseScoringPlay(d, playerByKey);
                if (ev != null && noDup(events, ev)) events.add(ev);
            }
        }

        JsonNode gi = raw.path("gameInfo");
        return new BasketballDto.GameDetail(
                str(comp.has("id") ? comp.path("id") : null, eventId),
                first(txt(st.path("shortDetail")), txt(st.path("detail")), ""),
                txt(st.path("state")) != null ? txt(st.path("state")) : "post",
                txt(comp.path("date")),
                first(txt(header.path("league").path("name")), "Basketball"),
                txt(gi.path("venue").path("fullName")),
                gi.path("attendance").isMissingNode() || gi.path("attendance").isNull()
                        ? null : gi.path("attendance").asInt(),
                teamRef(home.path("team")), teamRef(away.path("team")),
                num(home.path("score")), num(away.path("score")),
                statusNode.path("period").canConvertToInt() ? statusNode.path("period").asInt() : null,
                txt(statusNode.path("displayClock")),
                lines, events);
    }

    /** A scoring play -> MatchEventDto (minute = quarter, detail carries clock + text, player = scorer). */
    private Dto.MatchEventDto parseScoringPlay(JsonNode d, java.util.Map<String, String> playerByKey) {
        if (!d.path("scoringPlay").asBoolean(false)) return null;

        int    quarter  = d.path("period").path("number").canConvertToInt()
                        ? d.path("period").path("number").asInt() : 0;
        String clock    = txt(d.path("clock").path("displayValue"));
        String teamId   = first(str(d.path("team").path("id")), resolveTeamId(d.path("team")), "");
        String text     = first(txt(d.path("text")), txt(d.path("type").path("text")), "Score");
        String detail   = (clock != null ? "Q" + quarter + " " + clock + " - " : "") + text;
        if (detail.length() > 140) detail = detail.substring(0, 137) + "...";

        String player = resolveAthleteName(d, new java.util.HashMap<>());
        if (player == null) player = extractPlayerFromText(text);
        if (player == null && teamId != null && !teamId.isEmpty()) {
            player = playerByKey.get(quarter + ":" + teamId + ":" + (clock != null ? clock : ""));
        }

        return new Dto.MatchEventDto(quarter, "score", detail, player, null, teamId);
    }

    /** "quarter:teamId:clock" -> player name, from the Core API plays endpoint. */
    private java.util.Map<String, String> fetchPlayersFromCoreApi(String league, String eventId) {
        java.util.Map<String, String> map = new java.util.HashMap<>();
        try {
            String url = CORE + "/leagues/" + league + "/events/" + eventId
                    + "/competitions/" + eventId + "/plays?limit=400";
            JsonNode plays = get(url);
            JsonNode items = plays.path("items");
            if (!items.isArray() || items.size() == 0) return map;

            java.util.Map<String, String> athleteCache = new java.util.HashMap<>();
            for (JsonNode p : items) {
                if (!p.path("scoringPlay").asBoolean(false)) continue;
                int q = p.path("period").path("number").canConvertToInt() ? p.path("period").path("number").asInt() : 0;
                String clock = txt(p.path("clock").path("displayValue"));
                String teamId = resolveTeamId(p.path("team"));
                if (teamId == null) continue;
                String name = resolveAthleteName(p, athleteCache);
                if (name == null) name = extractPlayerFromText(p.path("text").asText(""));
                if (name != null) map.putIfAbsent(q + ":" + teamId + ":" + (clock != null ? clock : ""), name);
            }
        } catch (Exception e) {
            System.err.println("[basketball matchDetail] Core API plays failed: " + e.getMessage());
        }
        return map;
    }

    // player-resolution helpers (ported from FootballService)

    private static final Pattern PLAYER_FROM_TEXT = Pattern.compile(
            "([A-ZÀ-Þ][\\p{L}'’\\.\\-]+(?:\\s+[A-ZÀ-Þ][\\p{L}'’\\.\\-]+){0,3})\\s+(?:makes|misses)",
            Pattern.UNICODE_CHARACTER_CLASS);

    private String extractPlayerFromText(String text) {
        if (text == null || text.isBlank()) return null;
        java.util.regex.Matcher m = PLAYER_FROM_TEXT.matcher(text);
        if (m.find()) {
            String candidate = m.group(1).trim();
            if (candidate.length() >= 4 && candidate.length() <= 60 && candidate.contains(" ")) return candidate;
        }
        return null;
    }

    private String resolveTeamId(JsonNode teamNode) {
        if (teamNode.isMissingNode() || teamNode.isNull()) return null;
        String inline = txt(teamNode.path("id"));
        if (inline != null) return inline;
        String ref = txt(teamNode.path("$ref"));
        if (ref == null) return null;
        java.util.regex.Matcher m = Pattern.compile("/teams/(\\d+)").matcher(ref);
        return m.find() ? m.group(1) : null;
    }

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

    private boolean noDup(List<Dto.MatchEventDto> list, Dto.MatchEventDto ev) {
        for (Dto.MatchEventDto x : list) {
            if (x.minute() == ev.minute() && java.util.Objects.equals(x.detail(), ev.detail())) return false;
        }
        return true;
    }

    // shared helpers

    private JsonNode competitor(JsonNode comp, String side, int fallbackIdx) {
        JsonNode comps = comp.path("competitors");
        for (JsonNode c : comps) if (side.equals(c.path("homeAway").asText())) return c;
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

    private JsonNode stat(JsonNode stats, String... names) {
        for (String n : names) {
            for (JsonNode s : stats) {
                if (n.equals(s.path("name").asText()) || n.equals(s.path("abbreviation").asText())) return s;
            }
        }
        return mapper.missingNode();
    }

    private int statInt(JsonNode stats, String... names) {
        JsonNode s = stat(stats, names);
        return (s.path("value").isMissingNode() || s.path("value").isNull()) ? 0 : (int) s.path("value").asDouble();
    }

    private double statDouble(JsonNode stats, String... names) {
        JsonNode s = stat(stats, names);
        return (s.path("value").isMissingNode() || s.path("value").isNull()) ? 0.0 : s.path("value").asDouble();
    }

    private String statStr(JsonNode stats, String... names) {
        JsonNode s = stat(stats, names);
        return first(txt(s.path("displayValue")), txt(s.path("summary")), null);
    }

    private String bestImage(JsonNode images) {
        String best = null; int bestW = -1;
        for (JsonNode img : images) {
            int    w   = img.path("width").asInt(0);
            String src = first(txt(img.path("href")), txt(img.path("url")), null);
            if (src != null && src.startsWith("http") && w > bestW) { best = src; bestW = w; }
        }
        return best;
    }

    private JsonNode get(String url) throws Exception {
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(url)).timeout(Duration.ofSeconds(15))
                .header("User-Agent", "SportScore/1.0").GET().build();
        HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
        if (res.statusCode() != 200) return mapper.createObjectNode();
        return mapper.readTree(res.body());
    }

    private String txt(JsonNode n) {
        return (n == null || n.isMissingNode() || n.isNull()) ? null : n.asText();
    }

    private Integer num(JsonNode n) {
        return (n == null || n.isMissingNode() || n.isNull() || n.asText().isBlank()) ? null : (int) n.asDouble();
    }

    private String str(JsonNode n)                { return str(n, ""); }
    private String str(JsonNode n, String fallback) {
        String s = txt(n); return s != null ? s : fallback;
    }

    private String first(String... vals) {
        for (String v : vals) if (v != null) return v;
        return null;
    }
}