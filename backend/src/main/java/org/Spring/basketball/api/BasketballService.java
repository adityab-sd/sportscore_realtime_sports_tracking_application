package org.Spring.basketball.api;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

import org.Spring.api.Dto;
import org.Spring.api.EspnApiHelper;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.JsonNode;

// ============================================================================
// PLEASE review — Proxy (GoF) retry still bypassed from this subclass
// ----------------------------------------------------------------------------
// This service extends EspnApiHelper, whose get() is @Retryable. Calls such as
// scoreboard() -> get(...) compile, but they do not cross a Spring proxy boundary;
// the AOP retry/backoff documented in EspnApiHelper will not fire here either.
//
// EXAMPLE:
//   @Service
//   class BasketballService {
//       private final EspnHttpClient http;
//       List<?> scoreboard(String league) throws Exception {
//           JsonNode raw = http.get(SITE + "/" + league + "/scoreboard");
//           ...
//       }
//   }
//
// WHY: AOP annotations need an injected collaborator/proxy, not inherited self-calls.
// ============================================================================
@Service
public class BasketballService extends EspnApiHelper {

    private static final String SITE      = "https://site.api.espn.com/apis/site/v2/sports/basketball";
    private static final String STANDINGS = "https://site.api.espn.com/apis/v2/sports/basketball";
    private static final String CORE      = "https://sports.core.api.espn.com/v2/sports/basketball";
    private static final String WEB       = "https://site.web.api.espn.com/apis/common/v3/sports/basketball";

    /** Cache of resolved current-season years per league, since this rarely changes. */
    private final java.util.Map<String, Integer> seasonYearCache = new java.util.concurrent.ConcurrentHashMap<>();

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
        java.time.format.DateTimeFormatter fmt = java.time.format.DateTimeFormatter.ofPattern("yyyyMMdd");
        String from = java.time.LocalDate.now().minusDays(21).format(fmt);
        String to   = java.time.LocalDate.now().plusDays(21).format(fmt);
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

    // standings - recursive, level=3 gives real conferences/divisions.
    // Confirmed live: NBA nests Conference -> Division (isConference true/false).

    public List<BasketballDto.StandingRow> standings(String league) throws Exception {
        return standings(league, 3);
    }

    public List<BasketballDto.StandingRow> standings(String league, int level) throws Exception {
        JsonNode raw = get(STANDINGS + "/" + league + "/standings?level=" + level);
        List<BasketballDto.StandingRow> out = new ArrayList<>();
        walkStandingsTree(raw, null, out);

        if (out.isEmpty()) {
            appendEntries(raw.path("standings").path("entries"), null, out);
            appendEntries(raw.path("entries"), null, out);
        }

        for (int i = 0; i < out.size(); i++) {
            if (out.get(i).rank() == 0) {
                BasketballDto.StandingRow r = out.get(i);
                out.set(i, new BasketballDto.StandingRow(
                        i + 1, r.teamId(), r.team(), r.shortName(), r.logo(),
                        r.wins(), r.losses(), r.winPct(), r.gamesBehind(), r.divisionGamesBehind(),
                        r.streak(), r.homeRecord(), r.awayRecord(), r.conference()));
            }
        }
        return out;
    }

    private void walkStandingsTree(JsonNode node, String parentName, List<BasketballDto.StandingRow> out) {
        JsonNode entries = node.path("standings").path("entries");
        if (entries.isArray() && entries.size() > 0) {
            String label = first(txt(node.path("name")), txt(node.path("displayName")), parentName);
            appendEntries(entries, label, out);
            return;
        }
        JsonNode children = node.path("children");
        if (children.isArray()) {
            for (JsonNode child : children) {
                walkStandingsTree(child, first(txt(node.path("name")), parentName), out);
            }
        }
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
                    statDouble(stats, "divisionGamesBehind", "divisiongamesbehind"),
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

    // injuries - now falls back to filtering leagueInjuries() by team name,
    // same fix and same root cause as BaseballService (ESPN's per-team
    // sub-resource can return {} even for a team with real active injuries).

    public List<Dto.Injury> injuries(String league, String teamId) throws Exception {
        JsonNode raw = get(SITE + "/" + league + "/teams/" + teamId + "/injuries");
        List<Dto.Injury> direct = parseInjuries(raw, null);
        if (!direct.isEmpty()) return direct;

        Dto.TeamDetail teamInfo = team(league, teamId);
        if (teamInfo == null) return List.of();
        return leagueInjuries(league).stream()
                .filter(i -> teamInfo.name().equalsIgnoreCase(i.team()))
                .toList();
    }

    public List<Dto.Injury> leagueInjuries(String league) throws Exception {
        JsonNode raw = get(SITE + "/" + league + "/injuries");
        List<Dto.Injury> out = new ArrayList<>();
        for (JsonNode teamBlock : raw.path("injuries")) {
            String teamName = first(txt(teamBlock.path("team").path("displayName")),
                                    txt(teamBlock.path("displayName")), null);
            out.addAll(parseInjuries(teamBlock, teamName));
        }
        if (out.isEmpty()) out.addAll(parseInjuries(raw, null));
        return out;
    }

    private List<Dto.Injury> parseInjuries(JsonNode raw, String teamNameOverride) {
        List<Dto.Injury> out = new ArrayList<>();
        JsonNode list = raw.path("injuries");
        if (!list.isArray() || list.size() == 0) list = raw.path("items");
        for (JsonNode item : list) {
            JsonNode athlete = item.path("athlete");
            String athleteId   = str(athlete.path("id"), null);
            String athleteName = first(txt(athlete.path("displayName")), txt(athlete.path("fullName")), null);
            if (athleteName == null) continue;
            out.add(new Dto.Injury(
                    athleteId, athleteName,
                    first(teamNameOverride, txt(item.path("team").path("displayName")), null),
                    first(txt(item.path("status")), txt(item.path("type").path("description")), "Unknown"),
                    txt(item.path("longComment")) != null ? txt(item.path("longComment")) : txt(item.path("shortComment")),
                    txt(item.path("date"))));
        }
        return out;
    }

    // transactions

    public List<Dto.Transaction> transactions(String league, int limit) throws Exception {
        JsonNode raw = get(SITE + "/" + league + "/transactions?limit=" + limit);
        List<Dto.Transaction> out = new ArrayList<>();
        for (JsonNode t : raw.path("transactions")) {
            out.add(new Dto.Transaction(
                    str(t.has("id") ? t.path("id") : null, ""),
                    txt(t.path("date")),
                    first(txt(t.path("team").path("displayName")), txt(t.path("team").path("name")), null),
                    first(txt(t.path("description")), txt(t.path("text")), "")));
        }
        return out;
    }

    // athlete overview

    public Dto.AthleteOverview athleteOverview(String league, String athleteId) throws Exception {
        JsonNode raw = get(WEB + "/" + league + "/athletes/" + athleteId + "/overview");
        JsonNode athlete = raw.path("athlete");
    // PLEASE review — Null Object: returning null from a service forces controllers to serialize 200/null or NPE later. EXAMPLE: return Optional.empty(); or throw new ResponseStatusException(HttpStatus.NOT_FOUND, "athlete not found");
        if (athlete.isMissingNode() || athlete.isNull()) return null;

        List<Dto.StatLine> stats = new ArrayList<>();
        for (JsonNode cat : raw.path("statistics").path("splits").path("categories")) {
            for (JsonNode s : cat.path("stats")) {
                String label = first(txt(s.path("displayName")), txt(s.path("name")), null);
                String val   = first(txt(s.path("displayValue")), txt(s.path("value")), null);
                if (label != null && val != null) stats.add(new Dto.StatLine(label, val));
            }
        }

        return new Dto.AthleteOverview(
                str(athlete.path("id")),
                first(txt(athlete.path("displayName")), txt(athlete.path("fullName")), "-"),
                first(txt(athlete.path("position").path("displayName")), txt(athlete.path("position").path("abbreviation")), null),
                first(txt(athlete.path("team").path("displayName")), null),
                txt(athlete.path("headshot").path("href")),
                txt(athlete.path("jersey")),
                athlete.path("age").isMissingNode() || athlete.path("age").isNull() ? null : athlete.path("age").asInt(),
                first(txt(athlete.path("citizenship")), txt(athlete.path("birthPlace").path("country")), null),
                stats);
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

    // leaders - now a 2-tier fallback (site API -> Core API) instead of a
    // single unprotected site-API call.

    public List<Dto.Leader> leaders(String league) throws Exception {
        List<Dto.Leader> siteResult = leadersFromSiteApi(league);
        if (!siteResult.isEmpty()) return siteResult;
        return leadersFromCoreApi(league);
    }

    private List<Dto.Leader> leadersFromSiteApi(String league) {
        try {
            JsonNode raw  = get(SITE + "/" + league + "/statistics");
            JsonNode cats = raw.path("categories");
            if (!cats.isArray() || cats.isEmpty()) cats = raw.path("leaders").path("categories");
            JsonNode cat = null;
            for (JsonNode c : cats) {
                if (c.path("name").asText("").matches("(?i).*(point|scor|pts).*")) { cat = c; break; }
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
        // PLEASE review — observability: catching Exception and returning an empty leader list hides upstream/data-shape failures from operations. EXAMPLE: catch (Exception ex) { log.warn("ESPN leaders unavailable for {}", league, ex); return List.of(); }
            return List.of();
        }
    }

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

    private List<Dto.Leader> leadersFromCoreApi(String league) {
        List<Dto.Leader> out = new ArrayList<>();
        try {
            int season = currentSeasonYear(league);
            JsonNode raw  = get(CORE + "/leagues/" + league + "/seasons/" + season + "/types/2/leaders");
            JsonNode cats = raw.path("categories");
            JsonNode cat  = null;
            for (JsonNode c : cats) {
                if (c.path("name").asText("").matches("(?i).*(point|scor|pts).*")) { cat = c; break; }
            }
            if (cat == null && cats.isArray() && cats.size() > 0) cat = cats.get(0);
            if (cat == null) return out;

            String catName = first(txt(cat.path("displayName")), txt(cat.path("name")), "Leaders");
            java.util.Map<String, JsonNode> athleteCache = new java.util.HashMap<>();
            java.util.Map<String, JsonNode> teamCache    = new java.util.HashMap<>();

            int i = 0;
            for (JsonNode l : cat.path("leaders")) {
                if (i >= 10) break;
                JsonNode athlete = resolveRef(l.path("athlete"), athleteCache);
                if (athlete == null) continue;
                JsonNode team = resolveRef(l.path("team"), teamCache);

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
            // Common early/off-season: no leader data yet to rank.
        }
        return out;
    }

    // match detail (with player-attributed events, officials, odds)

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

        java.util.Map<String, String> playerByKey = fetchPlayersFromCoreApi(league, eventId);
        List<Dto.MatchEventDto> events = new ArrayList<>();
        for (String key : new String[]{"scoringPlays", "plays"}) {
            for (JsonNode d : raw.path(key)) {
                Dto.MatchEventDto ev = parseScoringPlay(d, playerByKey);
                if (ev != null && noDup(events, ev)) events.add(ev);
            }
        }

        // NEW: officials
        List<Dto.Official> officials = new ArrayList<>();
        int order = 1;
        for (JsonNode o : raw.path("gameInfo").path("officials")) {
            String name = first(txt(o.path("fullName")), txt(o.path("displayName")), null);
            if (name == null) continue;
            officials.add(new Dto.Official(
                    name,
                    first(txt(o.path("position").path("displayName")), txt(o.path("position").path("name")), "Official"),
                    o.path("order").canConvertToInt() ? o.path("order").asInt() : order));
            order++;
        }

        // NEW: odds - real, confirmed via ScrapeCreators sample showing spread
        // + team favorite/underdog for an actual NBA game summary payload.
        List<Dto.OddsPick> odds = new ArrayList<>();
        for (JsonNode p : raw.path("pickcenter")) {
            String provider = first(txt(p.path("provider").path("name")), "consensus");
            Double spread   = p.path("spread").isMissingNode() || p.path("spread").isNull() ? null : p.path("spread").asDouble();
            Double ou       = p.path("overUnder").isMissingNode() || p.path("overUnder").isNull() ? null : p.path("overUnder").asDouble();
            String favTeam  = p.path("homeTeamOdds").path("favorite").asBoolean(false)
                    ? str(home.path("team").path("id"))
                    : p.path("awayTeamOdds").path("favorite").asBoolean(false)
                    ? str(away.path("team").path("id"))
                    : null;
            odds.add(new Dto.OddsPick(provider, txt(p.path("details")), spread, ou, favTeam));
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
                lines, events, officials, odds);
    }

    private Dto.MatchEventDto parseScoringPlay(JsonNode d, java.util.Map<String, String> playerByKey) {
        if (!d.path("scoringPlay").asBoolean(false)) return null;

        int    quarter = d.path("period").path("number").canConvertToInt()
                       ? d.path("period").path("number").asInt() : 0;
        String clock   = txt(d.path("clock").path("displayValue"));
        String teamId  = first(str(d.path("team").path("id")), resolveTeamId(d.path("team")), "");
        String text    = first(txt(d.path("text")), txt(d.path("type").path("text")), "Score");
        String detail  = (clock != null ? "Q" + quarter + " " + clock + " - " : "") + text;
        if (detail.length() > 140) detail = detail.substring(0, 137) + "...";

        String player = resolveAthleteName(d, new java.util.HashMap<>());
        if (player == null) player = extractPlayerFromText(text);
        if (player == null && teamId != null && !teamId.isEmpty()) {
            player = playerByKey.get(quarter + ":" + teamId + ":" + (clock != null ? clock : ""));
        }

        return new Dto.MatchEventDto(quarter, "score", detail, player, null, teamId);
    }

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
                int q = p.path("period").path("number").canConvertToInt()
                        ? p.path("period").path("number").asInt() : 0;
                String clock  = txt(p.path("clock").path("displayValue"));
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

    private static final Pattern PLAYER_FROM_TEXT = Pattern.compile(
            "([A-ZÀ-Þ][\\p{L}''\\.\\-]+(?:\\s+[A-ZÀ-Þ][\\p{L}''\\.\\-]+){0,3})\\s+(?:makes|misses)",
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

    private boolean noDup(List<Dto.MatchEventDto> list, Dto.MatchEventDto ev) {
        for (Dto.MatchEventDto x : list) {
            if (x.minute() == ev.minute() && java.util.Objects.equals(x.detail(), ev.detail())) return false;
        }
        return true;
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

    // ══════════════════════════════════════════════════════════════════════
    //  Reference-data passthrough — the remaining ESPN endpoints that were
    //  documented but never called anywhere in this service. Raw JsonNode
    //  (see BaseballService's matching section for the full rationale) rather
    //  than a hand-typed record, since these are long-tail resources whose
    //  exact shape hasn't been verified against a live sample yet.
    // ══════════════════════════════════════════════════════════════════════

    private static final String CDN     = "https://cdn.espn.com/core";
    private static final String TOURNEY = "https://sports.core.api.espn.com/v2/tournament";

    // ============================================================================
    // PLEASE review — Pagination bounds / URL encoding
    // ----------------------------------------------------------------------------
    // Raw passthrough methods accept page/limit/query fragments directly from REST
    // controllers. Negative or huge limits can amplify ESPN calls, and category/sort
    // values are concatenated without URL encoding.
    //
    // EXAMPLE:
    //   int safeLimit = Math.min(Math.max(limit, 1), 100);
    //   URI uri = UriComponentsBuilder.fromHttpUrl(base).queryParam("limit", safeLimit).build().toUri();
    //
    // WHY: Adapters to upstream APIs should enforce bounds before making blocking I/O.
    // ============================================================================

    public JsonNode teams(String league, int page, int limit) throws Exception {
        return getPaged(SITE + "/" + league + "/teams", page, limit);
    }

    public JsonNode teamSchedule(String league, String teamId) throws Exception {
        return get(SITE + "/" + league + "/teams/" + teamId + "/schedule");
    }

    public JsonNode teamRecord(String league, String teamId) throws Exception {
        return get(SITE + "/" + league + "/teams/" + teamId + "/record");
    }

    public JsonNode teamDepthChart(String league, String teamId) throws Exception {
        return get(SITE + "/" + league + "/teams/" + teamId + "/depth-charts");
    }

    public JsonNode statistics(String league) throws Exception {
        return get(SITE + "/" + league + "/statistics");
    }

    public JsonNode groups(String league) throws Exception {
        return get(SITE + "/" + league + "/groups");
    }

    /** Poll rankings - populated for the college leagues. */
    public JsonNode rankings(String league) throws Exception {
        return get(SITE + "/" + league + "/rankings");
    }

    /** Draft board - site API resource, NBA only per ESPN's own docs. */
    public JsonNode siteDraft(String league) throws Exception {
        return get(SITE + "/" + league + "/draft");
    }

    public JsonNode athleteNews(String league, String athleteId, int limit) throws Exception {
        return get(SITE + "/" + league + "/athletes/" + athleteId + "/news?limit=" + limit);
    }

    public JsonNode athletes(String league, int page, int limit, boolean activeOnly) throws Exception {
        return getPaged(CORE + "/leagues/" + league + "/athletes?active=" + activeOnly, page, limit);
    }

    public JsonNode athleteStats(String league, String athleteId) throws Exception {
        return get(WEB + "/" + league + "/athletes/" + athleteId + "/stats");
    }

    public JsonNode athleteGamelog(String league, String athleteId) throws Exception {
        return get(WEB + "/" + league + "/athletes/" + athleteId + "/gamelog");
    }

    public JsonNode athleteSplits(String league, String athleteId) throws Exception {
        return get(WEB + "/" + league + "/athletes/" + athleteId + "/splits");
    }

    public JsonNode statsByAthlete(String league, String category, String season, String seasontype, String sort) throws Exception {
        StringBuilder url = new StringBuilder(WEB + "/" + league + "/statistics/byathlete?");
        if (category   != null) url.append("category=").append(category).append("&");
        if (sort       != null) url.append("sort=").append(sort).append("&");
        if (season     != null) url.append("season=").append(season).append("&");
        if (seasontype != null) url.append("seasontype=").append(seasontype);
        return get(url.toString());
    }

    public JsonNode draft(String league, String season, int page, int limit) throws Exception {
        return getPaged(CORE + "/leagues/" + league + "/seasons/" + season + "/draft", page, limit);
    }

    public JsonNode freeAgents(String league, String season, int page, int limit) throws Exception {
        return getPaged(CORE + "/leagues/" + league + "/seasons/" + season + "/freeagents", page, limit);
    }

    public JsonNode venues(String league, int page, int limit) throws Exception {
        return getPaged(CORE + "/leagues/" + league + "/venues", page, limit);
    }

    public JsonNode franchises(String league, int page, int limit) throws Exception {
        return getPaged(CORE + "/leagues/" + league + "/franchises", page, limit);
    }

    public JsonNode positions(String league, int page, int limit) throws Exception {
        return getPaged(CORE + "/leagues/" + league + "/positions", page, limit);
    }

    public JsonNode providers(String league) throws Exception {
        return get(CORE + "/leagues/" + league + "/providers");
    }

    public JsonNode countries(String league, int page, int limit) throws Exception {
        return getPaged(CORE + "/leagues/" + league + "/countries", page, limit);
    }

    public JsonNode recruiting(String league, int page, int limit) throws Exception {
        return getPaged(CORE + "/leagues/" + league + "/recruiting", page, limit);
    }

    public JsonNode tournaments(String league, boolean majorsOnly) throws Exception {
        return get(CORE + "/leagues/" + league + "/tournaments?majorsOnly=" + majorsOnly);
    }

    public JsonNode calendar(String league, String dates) throws Exception {
        String url = CORE + "/leagues/" + league + "/calendar";
        if (dates != null && !dates.isBlank()) url += "?dates=" + dates;
        return get(url);
    }

    public JsonNode seasons(String league, int page, int limit) throws Exception {
        return getPaged(CORE + "/leagues/" + league + "/seasons", page, limit);
    }

    public JsonNode currentSeason(String league) throws Exception {
        return get(CORE + "/leagues/" + league + "/season");
    }

    public JsonNode cdnGame(String siteSlug, String eventId) throws Exception {
        return get(CDN + "/" + siteSlug + "/game?xhr=1&gameId=" + eventId);
    }

    public JsonNode cdnBoxscore(String siteSlug, String eventId) throws Exception {
        return get(CDN + "/" + siteSlug + "/boxscore?xhr=1&gameId=" + eventId);
    }

    public JsonNode cdnPlayByPlay(String siteSlug, String eventId) throws Exception {
        return get(CDN + "/" + siteSlug + "/playbyplay?xhr=1&gameId=" + eventId);
    }

    public JsonNode cdnScoreboard(String siteSlug) throws Exception {
        return get(CDN + "/" + siteSlug + "/scoreboard?xhr=1");
    }

    // basketball-only specialised endpoints: bracketology + power index (BPI)

    /** Live NCAA tournament bracket projections. tournamentId: 22 = Men's, 23 = Women's. */
    public JsonNode bracketology(String tournamentId, String year) throws Exception {
        return get(TOURNEY + "/" + tournamentId + "/seasons/" + year + "/bracketology");
    }

    public JsonNode bracketologySnapshot(String tournamentId, String year, String iteration) throws Exception {
        return get(TOURNEY + "/" + tournamentId + "/seasons/" + year + "/bracketology/" + iteration);
    }

    /** BPI ratings - mens-college-basketball only. */
    public JsonNode powerIndex(String year, int page, int limit) throws Exception {
        return getPaged(CORE + "/leagues/mens-college-basketball/seasons/" + year + "/powerindex", page, limit);
    }

    public JsonNode powerIndexLeaders(String year) throws Exception {
        return get(CORE + "/leagues/mens-college-basketball/seasons/" + year + "/powerindex/leaders");
    }

    public JsonNode powerIndexTeam(String year, String teamId) throws Exception {
        return get(CORE + "/leagues/mens-college-basketball/seasons/" + year + "/powerindex/" + teamId);
    }
}