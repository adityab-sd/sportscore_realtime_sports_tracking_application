package org.Spring.football.api;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

import org.Spring.api.Dto;
import org.Spring.api.EspnApiHelper;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.JsonNode;

// ============================================================================
// PLEASE review — Facade (GoF) that outgrew itself
// ----------------------------------------------------------------------------
// A Facade is meant to be a THIN front over subsystems. This class is ~45 KB / ~40
// endpoints doing HTTP, JSON parsing, DTO assembly AND business rules — the facade
// swallowed its subsystems (a God class). Split the work it delegates to and keep
// the service a slim coordinator.
//
// EXAMPLE:
//   class MatchDetailAssembler { Dto.MatchDetail assemble(JsonNode raw) { ... } }
//   class StandingsAssembler   { List<Dto.StandingRow> assemble(JsonNode raw) { ... } }
//
//   @Service class FootballService extends EspnApiHelper {
//       Dto.MatchDetail matchDetail(String lg, String id) throws Exception {
//           return matchDetails.assemble(get(SITE + "/" + lg + "/summary?event=" + id));
//       }
//   }
//
// WHY: 45 KB in one class means merge conflicts, no unit seams, and no single
// responsibility. (The frontend's espnGet() in config.ts is a correct, minimal
// Facade — use its size as the target.)
// ============================================================================
@Service
public class FootballService extends EspnApiHelper {

    private static final String SITE      = "https://site.api.espn.com/apis/site/v2/sports/soccer";
    private static final String STANDINGS = "https://site.api.espn.com/apis/v2/sports/soccer";

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

    // NOTE: resolveRef() removed from here - it now lives on the shared
    // EspnApiHelper base class (protected, used by baseball/basketball too).
    // The private copy that used to be here caused a real compile error:
    // Java forbids a subclass from re-declaring an inherited protected method
    // as private, since that narrows visibility. Deleting it and inheriting
    // the shared version is the fix - identical logic, no behavior change.

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

        // officials - real array already present in this same summary response.
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

        // odds - real "pickcenter" array already present in this same response,
        // one entry per betting provider (consensus, specific books).
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
                events, lineups, officials, odds);
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

    // NOTE: the unused single-arg parseSummaryEvent(JsonNode) overload that
    // used to live here was removed - flagged by the compiler as dead code
    // (never called locally). The two-arg version above is the only one
    // actually used, by tryMatchDetail().

    private boolean noDup(List<Dto.MatchEventDto> list, Dto.MatchEventDto ev) {
        for (Dto.MatchEventDto x : list) {
            if (x.minute() == ev.minute() && x.type().equals(ev.type())
                    && java.util.Objects.equals(x.player(), ev.player())) return false;
        }
        return true;
    }

    // low-level helpers

    private int parseMinute(String display) {
        if (display == null) return 0;
        java.util.regex.Matcher m = Pattern.compile("\\d+").matcher(display);
        return m.find() ? Integer.parseInt(m.group()) : 0;
    }

    // ══════════════════════════════════════════════════════════════════════
    //  injuries / transactions / athlete overview — typed, mirroring the same
    //  ESPN endpoints already verified for baseball/basketball. Team-level
    //  injuries can come back empty for a team that has real entries (same
    //  quirk confirmed there), so fall back to filtering the league-wide feed.
    // ══════════════════════════════════════════════════════════════════════

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

    private static final String WEB = "https://site.web.api.espn.com/apis/common/v3/sports/soccer";

    public Dto.AthleteOverview athleteOverview(String league, String athleteId) throws Exception {
        JsonNode raw = get(WEB + "/" + league + "/athletes/" + athleteId + "/overview");
        JsonNode athlete = raw.path("athlete");
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

    // ══════════════════════════════════════════════════════════════════════
    //  Reference-data passthrough — the remaining documented ESPN endpoints
    //  nothing in this service called yet. Raw JsonNode (see BaseballService's
    //  matching section for the full rationale) rather than a hand-typed
    //  record, since these are long-tail resources whose exact shape hasn't
    //  been verified against a live sample the way the above was.
    // ══════════════════════════════════════════════════════════════════════

    private static final String CDN = "https://cdn.espn.com/core";

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

    /** Poll rankings - rarely populated for club football, but documented for every sport slug. */
    public JsonNode rankings(String league) throws Exception {
        return get(SITE + "/" + league + "/rankings");
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

    /** Transfer window / squad registration - documented as "draft" in ESPN's generic core API shape. */
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

    // CDN rich game packages (raw passthrough - needs ESPN's "site slug", e.g. "eng.1")

    public JsonNode cdnGame(String siteSlug, String eventId) throws Exception {
        return get(CDN + "/" + siteSlug + "/game?xhr=1&gameId=" + eventId);
    }

    public JsonNode cdnBoxscore(String siteSlug, String eventId) throws Exception {
        return get(CDN + "/" + siteSlug + "/boxscore?xhr=1&gameId=" + eventId);
    }

    public JsonNode cdnScoreboard(String siteSlug) throws Exception {
        return get(CDN + "/" + siteSlug + "/scoreboard?xhr=1");
    }

}