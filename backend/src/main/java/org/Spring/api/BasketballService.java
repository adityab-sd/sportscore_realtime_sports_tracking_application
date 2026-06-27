package org.Spring.api;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Owns all ESPN basketball reference-data parsing. Single place that knows
 * ESPN's raw shapes; downstream sees only clean DTOs. Mirrors FootballService.
 *
 * Standings use the /apis/v2/ path (the /apis/site/v2/ path is a stub).
 */
@Service
public class BasketballService {

    private static final String SITE      = "https://site.api.espn.com/apis/site/v2/sports/basketball";
    private static final String STANDINGS = "https://site.api.espn.com/apis/v2/sports/basketball";

    private final HttpClient   http   = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    private final ObjectMapper mapper = new ObjectMapper();

    // ---------------- scoreboard / fixtures ----------------

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
        // ^^^ CHANGED: was minusDays(10) — extended to 21 to match FootballService
        //     so fixtures show a full 3-week window of results
        String to   = LocalDate.now().plusDays(21).format(fmt);
        // ^^^ CHANGED: was plusDays(10) — extended to 21 to match FootballService
        JsonNode raw = get(SITE + "/" + league + "/scoreboard?dates=" + from + "-" + to + "&limit=100");

        List<BasketballDto.GameDto> results  = new ArrayList<>();
        List<BasketballDto.GameDto> upcoming = new ArrayList<>();
        for (JsonNode e : raw.path("events")) {
            BasketballDto.GameDto g = parseEvent(e);
            if (g == null) continue;
            if ("post".equals(g.statusState()))     results.add(g);
            else if ("pre".equals(g.statusState())) upcoming.add(g);
        }
        java.util.Collections.reverse(results); // most recent first
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
        Integer period      = statusNode.path("period").canConvertToInt()
                              ? statusNode.path("period").asInt() : null;
        String  clock       = txt(statusNode.path("displayClock"));
        String  competition = first(txt(comp.path("league").path("name")),
                                    txt(e.path("league").path("name")), "Basketball");

        return new BasketballDto.GameDto(
                str(e.path("id")), status, state, txt(e.path("date")), competition,
                teamRef(home.path("team")), teamRef(away.path("team")),
                num(home.path("score")), num(away.path("score")),
                period, clock);
    }

    // ---------------- standings ----------------

    public List<BasketballDto.StandingRow> standings(String league) throws Exception {
        JsonNode raw = get(STANDINGS + "/" + league + "/standings");
        List<BasketballDto.StandingRow> out = new ArrayList<>();
        collectStandings(raw, out);
        if (out.isEmpty()) {
            for (JsonNode child : raw.path("children")) collectStandings(child, out);
        }
        for (int i = 0; i < out.size(); i++) {
            if (out.get(i).rank() == 0) {
                BasketballDto.StandingRow r = out.get(i);
                out.set(i, new BasketballDto.StandingRow(
                        i + 1, r.teamId(), r.team(), r.shortName(),
                        r.logo(), r.wins(), r.losses(), r.winPct(), r.gamesBehind(),
                        r.streak(), r.homeRecord(), r.awayRecord(), r.conference()));
            }
        }
        return out;
    }

    private void collectStandings(JsonNode node, List<BasketballDto.StandingRow> out) {
        JsonNode entries = node.path("standings").path("entries");
        if (!entries.isArray() || entries.isEmpty()) entries = node.path("entries");
        String conference = txt(node.path("name"));
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

    // ---------------- news ----------------

    public List<Dto.NewsItem> news(String league, int limit) throws Exception {
        JsonNode raw = get(SITE + "/" + league + "/news?limit=" + limit);
        List<Dto.NewsItem> out = new ArrayList<>();
        int i = 0;
        for (JsonNode a : raw.path("articles")) {
            String headline = first(txt(a.path("headline")), "Untitled");
            String desc     = txt(a.path("description")) != null ? txt(a.path("description")) : "";
            out.add(new Dto.NewsItem(
                    str(a.has("id") ? a.path("id") : null, String.valueOf(i)),
                    headline, desc,
                    txt(a.path("published")) != null ? txt(a.path("published")) : "",
                    bestImage(a.path("images")), newsCategory(a.path("categories")),
                    txt(a.path("links").path("web").path("href"))));
            i++;
        }
        return out;
    }

    private String newsCategory(JsonNode cats) {
        for (JsonNode c : cats) {
            if ("team".equals(c.path("type").asText()) && txt(c.path("description")) != null)
                return txt(c.path("description"));
        }
        for (JsonNode c : cats) {
            String d = txt(c.path("description"));
            if (d != null && !d.equalsIgnoreCase("Basketball") && !d.equalsIgnoreCase("Sports"))
                return d;
        }
        return "Basketball";
    }

    // ---------------- team / roster ----------------

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

    // ---------------- leaders ----------------

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

    // ---------------- match detail ----------------

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
                statusNode.path("period").canConvertToInt()
                        ? statusNode.path("period").asInt() : null,
                txt(statusNode.path("displayClock")),
                lines);
    }

    // ---------------- shared helpers ----------------

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
        return (s.path("value").isMissingNode() || s.path("value").isNull())
                ? 0 : (int) s.path("value").asDouble();
    }

    private double statDouble(JsonNode stats, String... names) {
        JsonNode s = stat(stats, names);
        return (s.path("value").isMissingNode() || s.path("value").isNull())
                ? 0.0 : s.path("value").asDouble();
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
        return (n == null || n.isMissingNode() || n.isNull() || n.asText().isBlank())
                ? null : (int) n.asDouble();
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