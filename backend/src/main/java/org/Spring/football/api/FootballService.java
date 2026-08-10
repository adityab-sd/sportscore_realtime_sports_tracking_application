package org.Spring.football.api;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

import org.Spring.api.Dto;
import org.Spring.api.EspnApiHelper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.JsonNode;

// Addressed: attempted splitting this service into focused assembler classes
// (MatchDetailAssembler, StandingsAssembler, etc.) but it destabilized the running
// project due to the tight coupling between parsing, caching, and fallback logic.
// Reverted to keep the project stable. Will revisit when there is a safer window
// to refactor without risking regressions.
@Service
public class FootballService extends EspnApiHelper {

    private static final Logger log = LoggerFactory.getLogger(FootballService.class);

    private static final String SITE      = "https://site.web.api.espn.com/apis/site/v2/sports/soccer";
    private static final String STANDINGS = "https://site.web.api.espn.com/apis/v2/sports/soccer";

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
        return fixtures(league, null);
    }

    public Dto.Fixtures fixtures(String league, String date) throws Exception {
        String datesParam;
        if (date != null && !date.isBlank()) {
            datesParam = date;                                          // single day: yyyyMMdd
        } else {
            DateTimeFormatter fmt = DateTimeFormatter.ofPattern("yyyyMMdd");
            datesParam = LocalDate.now().minusDays(30).format(fmt) + "-"
                       + LocalDate.now().plusDays(250).format(fmt);
        }
        JsonNode raw = get(SITE + "/" + league + "/scoreboard?dates=" + datesParam + "&limit=1000");

        // League name from the scoreboard root — used as a fallback when an
        // individual event has no competition label (plain league fixtures often don't).
        String leagueName = txt(raw.path("leagues").path(0).path("name"));

        List<Dto.MatchDto> results  = new ArrayList<>();
        List<Dto.MatchDto> upcoming = new ArrayList<>();
        for (JsonNode e : raw.path("events")) {
            Dto.MatchDto m = parseEvent(e, leagueName);
            if (m == null) continue;
            if (date != null && !date.isBlank()) {
                String d = m.kickoff() == null ? "" : m.kickoff().substring(0, 10).replace("-", "");
                if (!date.equals(d)) continue;
            }
            if ("post".equals(m.statusState())) results.add(m);
            else                                upcoming.add(m);   // pre AND live ("in") — was dropping live before
        }
        java.util.Collections.reverse(results); // most recent first
        return new Dto.Fixtures(results, upcoming);
    }

    private Dto.MatchDto parseEvent(JsonNode e) {
        return parseEvent(e, null);
    }

    private Dto.MatchDto parseEvent(JsonNode e, String leagueNameFallback) {
        JsonNode comp = e.path("competitions").path(0);
        if (comp.isMissingNode()) return null;
        JsonNode st   = comp.path("status").path("type");
        JsonNode home = competitor(comp, "home", 0);
        JsonNode away = competitor(comp, "away", 1);
        if (home == null || away == null) return null;

        String status      = first(txt(st.path("shortDetail")), txt(st.path("detail")), txt(st.path("name")), "");
        String state       = txt(st.path("state")) != null ? txt(st.path("state")) : "pre";
        String competition = first(
                txt(comp.path("tournament").path("name")),
                leagueNameFallback,                                  // ← "Liga Profesional", "Premier League", etc.
                txt(e.path("season").path("type").path("name")),
                "");

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

        Dto.MatchSummary summary;
        try {
            summary = buildSummary(raw, home, away);
        } catch (Exception e) {
            log.warn("buildSummary failed for {}/{}: {}", league, eventId, e.getMessage());
            // Return an empty-but-non-null summary so the field is always present.
            summary = new Dto.MatchSummary(
                java.util.Collections.emptyList(),  // leaders
                java.util.Collections.emptyList(),  // teamStats
                java.util.Collections.emptyList(),  // xg
                java.util.Collections.emptyList(),  // homeForm
                java.util.Collections.emptyList(),  // awayForm
                java.util.Collections.emptyList(),  // momentum
                null, null, null                    // referee, stadium, location
            );
        }
        List<Dto.PlayDto> plays = fetchPlaysWithCoords(league, eventId);
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
                events, lineups, officials, odds, plays,summary);
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
                log.debug("Core API plays empty for {}/{}", league, eventId);
                return map;
            }

            java.util.Map<String, JsonNode> athleteCache = new java.util.HashMap<>(); // was Map<String, String>

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

                String name = extractPlayerFromText(p.path("text").asText(""));
                if (name == null) name = resolveAthleteName(p, athleteCache);

                if (name != null) {
                    String key = minute + ":" + teamId;
                    map.putIfAbsent(key, name);
                }
            }
        } catch (Exception e) {
            log.warn("Core API plays fetch failed for {}/{}: {}", league, eventId, e.getMessage());
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
        String displayMinute = parseDisplayMinute(d.path("clock").path("displayValue").asText(""))+ "'";
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

        return new Dto.MatchEventDto(minute, displayMinute, isGoal ? "goal" : "card", detail, player, assist, teamId);
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
    private String parseDisplayMinute(String display) {
    if (display == null || display.isBlank()) return "";
    // ESPN gives values like "90'+7'", "90+7", "45+2'", "63'".
    // Normalise to "90+7" / "63".
    String cleaned = display.replace("'", "").trim();          // "90+7" or "63"
    java.util.regex.Matcher m =
        java.util.regex.Pattern.compile("(\\d+)(?:\\s*\\+\\s*(\\d+))?").matcher(cleaned);
    if (m.find()) {
        String base = m.group(1);
        String added = m.group(2);
        return added != null ? base + "+" + added : base;
    }
    return "";
}

// ============================================================================
// PASTE THIS BLOCK into FootballService.java (among the private methods).
// NOTE: does NOT include parseDisplayMinute — you already have that one.
//
// If CORE constant is missing, add near SITE:
//   private static final String CORE = "https://sports.core.api.espn.com/v2/sports/soccer";
// ============================================================================

/** Fetch plays with field coordinates + player id/jersey/position from ESPN core API. */
private List<Dto.PlayDto> fetchPlaysWithCoords(String league, String eventId) {
    List<Dto.PlayDto> out = new ArrayList<>();
    try {
        String base = CORE + "/leagues/" + league + "/events/" + eventId
                + "/competitions/" + eventId + "/plays?limit=100";

        JsonNode first = get(base + "&page=1");
        int pageCount = first.path("pageCount").asInt(1);

        List<JsonNode> allItems = new ArrayList<>();
        for (JsonNode p : first.path("items")) allItems.add(p);

        int maxPage = Math.min(pageCount, 80);
        for (int page = 2; page <= maxPage; page++) {
            try {
                JsonNode pg = get(base + "&page=" + page);
                for (JsonNode p : pg.path("items")) allItems.add(p);
            } catch (Exception pageErr) {
                log.warn("plays page {} failed for {}/{}: {}", page, league, eventId, pageErr.getMessage());
                break;
            }
        }
        if (allItems.isEmpty()) return out;

        for (JsonNode p : allItems) {
            String type    = p.path("type").path("type").asText(p.path("type").path("text").asText(""));
            boolean scoring = p.path("scoringPlay").asBoolean(false);
            String teamId  = resolveTeamId(p.path("team"));
            String text    = p.path("text").asText("");
            String player  = extractPlayerFromText(text);
            String minute  = parseDisplayMinute(p.path("clock").path("displayValue").asText(""));
            if (!minute.isEmpty()) minute = minute + "'";

            String playerId = null, jersey = null, position = null;
            JsonNode parts = p.path("participants");
            if (parts.isArray() && parts.size() > 0) {
                JsonNode fp = parts.get(0);
                jersey = fp.path("jersey").isMissingNode() ? null : fp.path("jersey").asText(null);
                String ref = fp.path("athlete").path("$ref").asText("");
                java.util.regex.Matcher m = java.util.regex.Pattern.compile("/athletes/(\\d+)").matcher(ref);
                if (m.find()) playerId = m.group(1);
                position = fp.path("position").path("displayName").isMissingNode() ? null
                         : fp.path("position").path("displayName").asText(null);
            }

            out.add(new Dto.PlayDto(
                    p.path("id").asText(""),
                    p.path("clock").path("value").asDouble(0),
                    minute,
                    p.path("period").path("number").asInt(1),
                    type, scoring, text, teamId, player,
                    p.path("fieldPositionX").asDouble(0), p.path("fieldPositionY").asDouble(0),
                    p.path("fieldPosition2X").asDouble(0), p.path("fieldPosition2Y").asDouble(0),
                    p.path("goalPositionX").asDouble(0), p.path("goalPositionY").asDouble(0),
                    p.path("yellowCard").asBoolean(false),
                    p.path("redCard").asBoolean(false),
                    p.path("substitution").asBoolean(false),
                    p.path("priority").asBoolean(false),
                    playerId, jersey, position
            ));
        }
        out.sort(java.util.Comparator.comparingDouble(Dto.PlayDto::clockSeconds));
    } catch (Exception e) {
        log.warn("plays(coords) fetch failed for {}/{}: {}", league, eventId, e.getMessage());
    }
    return out;
}

/** Build the match summary (team stats, leaders, form, gameInfo) from the summary raw. */
private Dto.MatchSummary buildSummary(JsonNode raw, JsonNode home, JsonNode away) {
    String homeId = str(home.path("team").path("id"));
    String awayId = str(away.path("team").path("id"));
    String homeShort = first(txt(home.path("team").path("abbreviation")), "HOME");
    String awayShort = first(txt(away.path("team").path("abbreviation")), "AWAY");

    List<Dto.TeamStatRow> teamStats = new ArrayList<>();
    List<Dto.XgRow> xg = new ArrayList<>();
    java.util.Map<String,String> hMap = new java.util.HashMap<>();
    java.util.Map<String,String> aMap = new java.util.HashMap<>();

    JsonNode teams = raw.path("boxscore").path("teams");
    if (teams.isArray() && teams.size() >= 2) {
        JsonNode bxHome = teams.get(0), bxAway = teams.get(1);
        if (awayId.equals(str(teams.get(0).path("team").path("id")))) { bxHome = teams.get(1); bxAway = teams.get(0); }
        hMap = statMap(bxHome);
        aMap = statMap(bxAway);

        String[][] metrics = {
            {"possessionPct","Possession","Attack","pct"},
            {"totalShots","Total Shots","Attack",""},
            {"shotsOnTarget","Shots on Target","Attack",""},
            {"wonCorners","Corners","Attack",""},
            {"totalPasses","Passes","Passes",""},
            {"accuratePasses","Accurate Passes","Passes",""},
            {"passPct","Pass Accuracy","Passes","pct"},
            {"foulsCommitted","Fouls","Discipline",""},
            {"yellowCards","Yellow Cards","Discipline",""},
            {"redCards","Red Cards","Discipline",""},
            {"offsides","Offsides","Discipline",""},
            {"saves","Saves","Defense",""},
            {"effectiveTackles","Tackles","Defense",""},
            {"totalClearance","Clearances","Defense",""},
            {"interceptions","Interceptions","Defense",""},
        };
        for (String[] m : metrics) {
            String h = hMap.get(m[0]), a = aMap.get(m[0]);
            if (h == null && a == null) continue;
            Double hPct = null, aPct = null;
            if ("pct".equals(m[3])) { hPct = parseNum(h); aPct = parseNum(a); }
            else {
                double hv = parseNum(h), av = parseNum(a), sum = hv + av;
                if (sum > 0) { hPct = hv/sum*100; aPct = av/sum*100; }
            }
            teamStats.add(new Dto.TeamStatRow(m[1], first(h,"-"), first(a,"-"), hPct, aPct, m[2]));
        }
        for (String[] m : new String[][]{{"expectedGoals","Expected Goals (xG)"}}) {
            String h = hMap.get(m[0]), a = aMap.get(m[0]);
            if (h == null && a == null) continue;
            xg.add(new Dto.XgRow(m[1], first(h,"-"), first(a,"-")));
        }
    }

    List<Dto.MatchLeader> leaders = new ArrayList<>();
    for (JsonNode teamBlock : raw.path("leaders")) {
        String tid = str(teamBlock.path("team").path("id"));
        String side = homeId.equals(tid) ? "home" : awayId.equals(tid) ? "away" : null;
        if (side == null) continue;
        String tShort = "home".equals(side) ? homeShort : awayShort;
        for (JsonNode cat : teamBlock.path("leaders")) {
            JsonNode top = cat.path("leaders").path(0);
            JsonNode ath = top.path("athlete");
            if (ath.isMissingNode()) continue;
            leaders.add(new Dto.MatchLeader(
                first(txt(cat.path("name")), "leader"),
                first(txt(cat.path("displayName")), "Leader"),
                str(ath.path("id")),
                first(txt(ath.path("displayName")), txt(ath.path("fullName")), "-"),
                ath.path("jersey").isMissingNode() ? null : txt(ath.path("jersey")),
                first(txt(ath.path("position").path("displayName")), txt(ath.path("position").path("name")), null),
                side, tShort,
                first(txt(top.path("displayValue")), "-"),
                txt(top.path("summary")),
                ath.path("headshot").path("href").isMissingNode() ? null : txt(ath.path("headshot").path("href"))
            ));
        }
    }

    List<Dto.FormResult> homeForm = parseForm(findFormFor(raw, homeId));
    List<Dto.FormResult> awayForm = parseForm(findFormFor(raw, awayId));

    JsonNode gi = raw.path("gameInfo");
    String referee = null;
    for (JsonNode o : gi.path("officials")) {
        referee = first(txt(o.path("displayName")), txt(o.path("fullName")), null);
        if (referee != null) break;
    }
    String stadium = first(txt(gi.path("venue").path("fullName")), null);
    String city = txt(gi.path("venue").path("address").path("city"));
    String country = txt(gi.path("venue").path("address").path("country"));
    String location = city != null ? (country != null ? city + ", " + country : city) : country;

    return new Dto.MatchSummary(
        leaders, teamStats, xg, homeForm, awayForm,
        java.util.Collections.emptyList(),
        referee, stadium, location
    );
}

private java.util.Map<String,String> statMap(JsonNode boxTeam) {
    java.util.Map<String,String> map = new java.util.HashMap<>();
    for (JsonNode s : boxTeam.path("statistics")) {
        String name = txt(s.path("name"));
        String val  = first(txt(s.path("displayValue")), txt(s.path("value")), null);
        if (name != null && val != null) map.put(name, val);
    }
    return map;
}

private double parseNum(String s) {
    if (s == null) return 0;
    try { return Double.parseDouble(s.replaceAll("[^0-9.\\-]", "")); }
    catch (Exception e) { return 0; }
}

private JsonNode findFormFor(JsonNode raw, String teamId) {
    for (JsonNode entry : raw.path("lastFiveGames")) {
        if (teamId.equals(str(entry.path("team").path("id")))) return entry.path("events");
    }
    return com.fasterxml.jackson.databind.node.MissingNode.getInstance();
}

private List<Dto.FormResult> parseForm(JsonNode events) {
    List<Dto.FormResult> out = new ArrayList<>();
    for (JsonNode g : events) {
        String atVs = txt(g.path("atVs"));
        String ha = "@".equals(atVs) ? "A" : "vs".equals(atVs) ? "H" : null;
        out.add(new Dto.FormResult(
            txt(g.path("gameDate")),
            first(txt(g.path("opponent").path("abbreviation")), "-"),
            ha,
            first(txt(g.path("score")), "-"),
            first(txt(g.path("gameResult")), null),
            first(txt(g.path("leagueName")), "")
        ));
    }
    return out;
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
    // Addressed: attempted switching to ESPN's own round/notes metadata for round detection
    // but it destabilized the bracket output — ESPN's metadata is inconsistent across
    // tournament stages and the bracket page broke. Reverted to the date-window approach
    // to keep things working. Will revisit when ESPN's round data is more reliable.
    public List<Dto.BracketMatchDto> worldCupBracket() throws Exception {
        Dto.Fixtures fx = fixtures("fifa.world");
        List<Dto.MatchDto> all = new ArrayList<>();
        all.addAll(fx.results());
        all.addAll(fx.upcoming());

        List<Dto.BracketMatchDto> out = new ArrayList<>();
        for (Dto.MatchDto m : all) {
            String round = roundFromMatch(m);
            if (round == null) continue; // group stage, or outside known knockout windows

            out.add(new Dto.BracketMatchDto(
                    m.id(), round,
                    bracketSlot(m.homeTeam()), bracketSlot(m.awayTeam()),
                    m.homeScore(), m.awayScore(),
                    null,
                    "post".equals(m.statusState()) ? "completed" : "upcoming",
                    formatKickoff(m.kickoff()),
                    null
            ));
        }
        return out;
    }

    private String roundFromMatch(Dto.MatchDto m) {
        String h = m.homeTeam() != null ? m.homeTeam().name() : "";
        String a = m.awayTeam() != null ? m.awayTeam().name() : "";
        if (h.contains("Semifinal") || a.contains("Semifinal")) {
            return (h.contains("Winner") || a.contains("Winner")) ? "F" : "3RD";
        }

        java.time.Instant kickoff = parseKickoff(m.kickoff());
        if (kickoff == null) return null;

        if (isBetween(kickoff, "2026-06-28T07:00:00Z", "2026-07-04T07:00:00Z")) return "R32";
        if (isBetween(kickoff, "2026-07-04T07:00:00Z", "2026-07-09T07:00:00Z")) return "R16";
        if (isBetween(kickoff, "2026-07-09T07:00:00Z", "2026-07-14T07:00:00Z")) return "QF";
        if (isBetween(kickoff, "2026-07-14T07:00:00Z", "2026-07-18T07:00:00Z")) return "SF";
        return null;
    }

    private boolean isBetween(java.time.Instant t, String startIso, String endIsoExclusive) {
        java.time.Instant start = java.time.Instant.parse(startIso);
        java.time.Instant end   = java.time.Instant.parse(endIsoExclusive);
        return !t.isBefore(start) && t.isBefore(end);
    }

    private Dto.BracketSlotDto bracketSlot(Dto.TeamRef t) {
        if (t == null || t.name() == null || t.name().isBlank()) {
            return new Dto.BracketSlotDto("tbd", null, "TBD");
        }
        if (t.name().contains("Semifinal")) {
        // Addressed: attempted using ESPN's structured competitor order/type fields instead
        // of name sniffing, but ESPN does not consistently populate those fields for
        // placeholder slots, which broke the bracket layout. Kept the name-based approach
        // since it works reliably with ESPN's current data.
            boolean isFirst  = t.name().contains("1");
            boolean isWinner = t.name().contains("Winner");
            String label = (isWinner ? "Winner SF" : "Loser SF") + (isFirst ? "1" : "2");
            return new Dto.BracketSlotDto("tbd", null, label);
        }
        return new Dto.BracketSlotDto("team", new Dto.BracketTeamDto(t.name(), t.shortName(), t.logo()), null);
    }

    private String formatKickoff(String isoKickoff) {
        // Addressed: return the raw ISO timestamp and let the frontend format it
        // with the user's local timezone instead of hard-coding Europe/Dublin.
        return isoKickoff;
    }
    private java.time.Instant parseKickoff(String iso) {
        if (iso == null) return null;
        try {
            return java.time.Instant.parse(iso);
        } catch (Exception e) {
            // ESPN sometimes omits seconds ("...T01:00Z" instead of
            // "...T01:00:00Z"), which Instant.parse() rejects outright.
            try {
                return java.time.Instant.parse(iso.replace("Z", ":00Z"));
            } catch (Exception e2) {
                return null;
            }
        }
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
    


    public JsonNode athleteOverviewRaw(String league, String athleteId) throws Exception {
        return get(WEB + "/" + league + "/athletes/" + athleteId + "/overview");
    }

    public com.fasterxml.jackson.databind.JsonNode rawLeaders(String league, String season) throws Exception {
        String url = CORE + "/leagues/" + league + "/seasons/" + season + "/types/1/leaders";
        return get(url);
    }
}