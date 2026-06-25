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

    private static final String SITE = "https://site.api.espn.com/apis/site/v2/sports/soccer";
    private static final String STANDINGS = "https://site.web.api.espn.com/apis/v2/sports/soccer";

    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    private final ObjectMapper mapper = new ObjectMapper();

    // ---------------- scoreboard / fixtures ----------------

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
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("yyyyMMdd");
        String from = LocalDate.now().minusDays(21).format(fmt);
        String to = LocalDate.now().plusDays(21).format(fmt);
        JsonNode raw = get(SITE + "/" + league + "/scoreboard?dates=" + from + "-" + to + "&limit=100");

        List<Dto.MatchDto> results = new ArrayList<>();
        List<Dto.MatchDto> upcoming = new ArrayList<>();
        for (JsonNode e : raw.path("events")) {
            Dto.MatchDto m = parseEvent(e);
            if (m == null) continue;
            if ("post".equals(m.statusState())) results.add(m);
            else if ("pre".equals(m.statusState())) upcoming.add(m);
        }
        java.util.Collections.reverse(results); // most recent first
        return new Dto.Fixtures(results, upcoming);
    }

    private Dto.MatchDto parseEvent(JsonNode e) {
        JsonNode comp = e.path("competitions").path(0);
        if (comp.isMissingNode()) return null;
        JsonNode st = comp.path("status").path("type");
        JsonNode home = competitor(comp, "home", 0);
        JsonNode away = competitor(comp, "away", 1);
        if (home == null || away == null) return null;

        String status = first(txt(st.path("shortDetail")), txt(st.path("detail")), txt(st.path("name")), "");
        String state = txt(st.path("state")) != null ? txt(st.path("state")) : "pre";
        String competition = first(txt(e.path("season").path("type").path("name")),
                txt(comp.path("tournament").path("name")), "");
        return new Dto.MatchDto(
                str(e.path("id")), status, state, txt(e.path("date")), competition,
                teamRef(home.path("team")), teamRef(away.path("team")),
                num(home.path("score")), num(away.path("score")));
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

    // ---------------- standings ----------------

    public List<Dto.StandingRow> standings(String league) throws Exception {
        JsonNode raw = get(STANDINGS + "/" + league + "/standings");
        JsonNode entries = raw.path("children").path(0).path("standings").path("entries");
        if (entries.isMissingNode() || !entries.isArray() || entries.isEmpty())
            entries = raw.path("standings").path("entries");
        if (entries.isMissingNode() || !entries.isArray() || entries.isEmpty())
            entries = raw.path("entries");

        List<Dto.StandingRow> out = new ArrayList<>();
        int i = 0;
        for (JsonNode e : entries) {
            i++;
            JsonNode stats = e.path("stats");
            JsonNode t = e.path("team");
            int gf = stat(stats, "pointsFor", "goalsFor");
            int ga = stat(stats, "pointsAgainst", "goalsAgainst");
            int gd = stat(stats, "pointDifferential", "goalDifferential");
            String note = e.path("note").path("color").isMissingNode() ? null
                    : txt(e.path("note").path("description"));
            int rank = stat(stats, "rank");
            out.add(new Dto.StandingRow(
                    rank != 0 ? rank : i,
                    str(t.path("id")),
                    first(txt(t.path("displayName")), txt(t.path("name")), "-"),
                    txt(t.path("abbreviation")) != null ? txt(t.path("abbreviation")) : "",
                    first(txt(t.path("logos").path(0).path("href")), txt(t.path("logo")), null),
                    stat(stats, "gamesPlayed"), stat(stats, "wins"),
                    stat(stats, "ties", "draws"), stat(stats, "losses"),
                    gf, ga, gd != 0 ? gd : gf - ga, stat(stats, "points"), note));
        }
        return out;
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

    // ---------------- news ----------------

    private static final Pattern TRANSFER = Pattern.compile(
            "\\b(sign(ed|ing|s)?|transfer(red|ring|s)?|join(ed|ing|s)?|deal|move(d|s)?|loan(ed|ing)?|fee|" +
            "bid(ding)?|want(ed|s)?|target(ed|ing|s)?|buy(ing)?|sold|sell(ing)?|agree(d|s|ment)?|swap|" +
            "release(d)?|contract|renew(al|ed|ing|s)?|exit(s|ed|ing)?|depart(ed|ure|ing|s)?|arrive(d|s)?|" +
            "unveil(ed|s)?|confirm(ed|s)?|scout(ed|ing|s)?|approach(ed|es|ing)?|negotiate(d|s|ing)?|" +
            "pursue(d|s|ing)?|reject(ed|s|ion)?|offer(ed|s|ing)?|window|deadline|permanent|" +
            "activat(e|ed|ion)?|option|clause|replac(e|ed|ing|ement)?|successor|appointment|" +
            "manag(er|ement|orial)?|sack(ed|ing)?|resign(ed|ation|ing)?|hire(d|s)?|appoint(ed|ment|ing)?)\\b",
            Pattern.CASE_INSENSITIVE);
    private static final java.util.Set<String> GENERIC = java.util.Set.of("Soccer", "Football", "Sports", "Sport");

    public List<Dto.NewsItem> news(String league, int limit) throws Exception {
        JsonNode raw = get(SITE + "/" + league + "/news?limit=" + limit);
        List<Dto.NewsItem> out = new ArrayList<>();
        int i = 0;
        for (JsonNode a : raw.path("articles")) {
            String headline = first(txt(a.path("headline")), "Untitled");
            String desc = txt(a.path("description")) != null ? txt(a.path("description")) : "";
            String category;
            if (TRANSFER.matcher(headline + " " + desc).find()) {
                category = "Transfer";
            } else {
                category = newsCategory(a.path("categories"));
            }
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
            else if ("team".equals(type) && team == null) team = d;
            else if (!GENERIC.contains(d) && other == null) other = d;
        }
        if (league != null) return league;
        if (team != null) return team;
        if (other != null) return other;
        return "Football";
    }

    private String bestImage(JsonNode images) {
        String best = null;
        int bestW = -1;
        for (JsonNode img : images) {
            int w = img.path("width").asInt(0);
            String src = first(txt(img.path("href")), txt(img.path("url")), txt(img.path("src")), null);
            if (src != null && src.startsWith("http") && w > bestW) { best = src; bestW = w; }
        }
        return best;
    }

    // ---------------- team / roster ----------------

    public Dto.TeamDetail team(String league, String teamId) throws Exception {
        JsonNode raw = get(SITE + "/" + league + "/teams/" + teamId);
        JsonNode t = raw.path("team").isMissingNode() ? raw : raw.path("team");
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
        JsonNode raw = get(SITE + "/" + league + "/teams/" + teamId + "/roster");
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
        JsonNode raw = get(SITE + "/" + league + "/leaders");
        JsonNode cats = raw.path("categories");
        JsonNode cat = null;
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
    }

    // ---------------- match detail ----------------

    public Dto.MatchDetail matchDetail(String league, String eventId) throws Exception {
        JsonNode raw = get(SITE + "/" + league + "/summary?event=" + eventId);
        JsonNode header = raw.path("header");
        JsonNode comp = header.path("competitions").path(0);
        JsonNode st = comp.path("status").path("type");
        JsonNode home = competitor(comp, "home", 0);
        JsonNode away = competitor(comp, "away", 1);
        if (home == null || away == null) return null;

        List<Dto.MatchEventDto> events = new ArrayList<>();
        // source 1: comp.details (same shape CoreSportsAdapter uses - reliable)
        for (JsonNode d : comp.path("details")) {
            Dto.MatchEventDto ev = parseSummaryEvent(d);
            if (ev != null && noDup(events, ev)) events.add(ev);
        }
        // source 2: keyEvents / scoringPlays
        for (String key : new String[]{"keyEvents", "plays", "scoringPlays"}) {
            for (JsonNode d : raw.path(key)) {
                Dto.MatchEventDto ev = parseSummaryEvent(d);
                if (ev != null && noDup(events, ev)) events.add(ev);
            }
        }

        JsonNode gi = raw.path("gameInfo");
        return new Dto.MatchDetail(
                str(comp.has("id") ? comp.path("id") : null, eventId),
                first(txt(st.path("shortDetail")), txt(st.path("detail")), ""),
                txt(st.path("state")) != null ? txt(st.path("state")) : "post",
                txt(comp.path("date")),
                txt(header.path("league").path("name")),
                txt(gi.path("venue").path("fullName")),
                gi.path("attendance").isMissingNode() || gi.path("attendance").isNull() ? null : gi.path("attendance").asInt(),
                teamRef(home.path("team")), teamRef(away.path("team")),
                num(home.path("score")), num(away.path("score")),
                events);
    }

    private Dto.MatchEventDto parseSummaryEvent(JsonNode d) {
        String typeText = d.path("type").path("text").asText("").toLowerCase();
        boolean isGoal = d.path("scoringPlay").asBoolean(false) || typeText.contains("goal");
        boolean isCard = d.path("redCard").asBoolean(false) || d.path("yellowCard").asBoolean(false) || typeText.contains("card");
        if (!isGoal && !isCard) return null;
        String detail = isGoal ? d.path("type").path("text").asText("Goal")
                : d.path("redCard").asBoolean(false) ? "Red Card"
                : d.path("yellowCard").asBoolean(false) ? "Yellow Card"
                : d.path("type").path("text").asText("Card");
        JsonNode ath = d.path("athletesInvolved");
        return new Dto.MatchEventDto(
                parseMinute(d.path("clock").path("displayValue").asText("")),
                isGoal ? "goal" : "card", detail,
                ath.isArray() && ath.size() > 0 ? txt(ath.path(0).path("displayName")) : null,
                ath.isArray() && ath.size() > 1 ? txt(ath.path(1).path("displayName")) : null,
                str(d.path("team").path("id")));
    }

    private boolean noDup(List<Dto.MatchEventDto> list, Dto.MatchEventDto ev) {
        for (Dto.MatchEventDto x : list) {
            if (x.minute() == ev.minute() && x.type().equals(ev.type())
                    && java.util.Objects.equals(x.player(), ev.player())) return false;
        }
        return true;
    }

    // ---------------- low-level helpers ----------------

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
        return (n == null || n.isMissingNode() || n.isNull() || n.asText().isBlank()) ? null : (int) n.asDouble();
    }

    private String str(JsonNode n) { return str(n, ""); }

    private String str(JsonNode n, String fallback) {
        String s = txt(n);
        return s != null ? s : fallback;
    }

    private String first(String... vals) {
        for (String v : vals) if (v != null) return v;
        return null;
    }
}
