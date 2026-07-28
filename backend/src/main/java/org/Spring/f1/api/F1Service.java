package org.Spring.f1.api;

import java.util.ArrayList;
import java.util.List;

import org.Spring.api.Dto;
import org.Spring.api.EspnApiHelper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.JsonNode;

// Owns all ESPN Formula 1 reference-data parsing. Race-oriented: the scoreboard
// returns GP weekends with sessions and driver grids; the calendar drives the
// season schedule; standings come from the standings endpoints (site for drivers,
// core API for constructors). Same helper conventions as the other services.
// ============================================================================
// Now extends EspnApiHelper (same as Basketball/Football/Baseball) instead of building its
// own HttpClient/ObjectMapper. get()/txt()/num()/str()/first()/bestImage() below all come
// from the base class, and get() delegates to the injected EspnHttpClient bean, so
// @Retryable actually crosses the Spring proxy boundary and F1's ESPN calls get the same
// retry/backoff as every other sport (previously they had none).
// ============================================================================
@Service
public class F1Service extends EspnApiHelper {

    private static final Logger log = LoggerFactory.getLogger(F1Service.class);

    private static final String SITE = "https://site.api.espn.com/apis/site/v2/sports/racing/f1";
    // Standings live on the /apis/v2/ domain, NOT /apis/site/v2/. The site/v2 standings
    // resource returns only a stub ({"fullViewLink": {...}}) with no entries, which is why
    // driver standings previously fell through to the race-only compute fallback (no sprint
    // points). This base is used solely for the standings call below.
    private static final String SITE_V2 = "https://site.api.espn.com/apis/v2/sports/racing/f1";
    private static final String CORE = "https://sports.core.api.espn.com/v2/sports/racing/leagues/f1";

    // manufacturerId -> team name. Names don't change mid-season, so cache one lookup each.
    private final java.util.Map<String, String> manufacturerNameCache = new java.util.concurrent.ConcurrentHashMap<>();

    // driverId -> team name, resolved from each driver's individual profile (vehicles[0].team).
    // Not available on the scoreboard's competitor nodes, so this is a separate lookup, cached
    // the same way as manufacturerNameCache.
    private final java.util.Map<String, String> driverTeamCache = new java.util.concurrent.ConcurrentHashMap<>();

    // athleteId -> {fullName, flagHref, team}, resolved from the season athlete profile.
    // Used when driver standings come from the core API (entries only carry an athlete
    // $ref, not a display name). Cached the same way as the other lookups above.
    private final java.util.Map<String, String[]> athleteInfoCache = new java.util.concurrent.ConcurrentHashMap<>();

    // Last correct standings served. Championship points only ever increase across a season,
    // so we never replace this with a lower-total (stale) or empty (failed) fetch — this stops
    // the UI flipping between the correct core number and the race-only fallback.
    private volatile F1Dto.Standings lastGoodStandings;

    // The season requested by the current call. When null we use the live/current year.
    // ThreadLocal keeps this correct under Spring's shared singleton service across requests.
    private final ThreadLocal<Integer> reqYear = new ThreadLocal<>();

    private int year() {
        Integer y = reqYear.get();
        return (y != null) ? y : java.time.LocalDate.now().getYear();
    }

    // scoreboard (weekends + sessions + grids)

    public List<F1Dto.RaceWeekend> scoreboard() throws Exception { return scoreboard(null); }

    public List<F1Dto.RaceWeekend> scoreboard(Integer requestedYear) throws Exception {
        reqYear.set(requestedYear);
        try {
        int cur = java.time.LocalDate.now().getYear();
        // Live scoreboard for the current season; a past season has no "current" weekend,
        // so return the whole season's events instead.
        JsonNode events = (requestedYear != null && requestedYear != cur)
                ? seasonEvents()
                : get(SITE + "/scoreboard").path("events");
        List<F1Dto.RaceWeekend> out = new ArrayList<>();
        for (JsonNode e : events) {
            F1Dto.RaceWeekend w = parseWeekend(e);
            if (w != null) out.add(w);
        }
        return out;
        } finally {
            reqYear.remove();
        }
    }

    public F1Dto.RaceWeekend results(String eventId) throws Exception { return results(eventId, null); }

    public F1Dto.RaceWeekend results(String eventId, Integer requestedYear) throws Exception {
        reqYear.set(requestedYear);
        try {
        F1Dto.RaceWeekend fromEvents = null;
        for (JsonNode e : seasonEvents()) {
            if (eventId.equals(str(e.path("id")))) { fromEvents = parseWeekend(e, true); break; }
        }
        if (fromEvents != null && hasGrid(fromEvents)) return fromEvents;   // back to plain hasGrid

        JsonNode summary = get(SITE + "/summary?event=" + eventId);
        JsonNode header  = summary.path("header");
        if (!header.isMissingNode() && !header.path("competitions").isMissingNode()) {
            F1Dto.RaceWeekend fromSummary = parseWeekend(header, true);
            if (fromSummary != null && hasGrid(fromSummary)) return fromSummary;
        }
        return fromEvents;  // best effort (may have empty grids if ESPN has none)
        } finally {
            reqYear.remove();
        }
    }

    private boolean hasGrid(F1Dto.RaceWeekend w) {
        if (w == null) return false;
        for (F1Dto.SessionDto s : w.sessions()) {
            if (s.grid() != null && !s.grid().isEmpty()) return true;
        }
        return false;
    }
    private boolean hasStats(F1Dto.RaceWeekend w) {
        if (w == null) return false;
        for (F1Dto.SessionDto s : w.sessions())
            if (s.grid() != null)
                for (F1Dto.DriverResult d : s.grid())
                    if (d.points() != null || d.laps() != null || d.timeOrStatus() != null) return true;
        return false;
    }
    // Summary per-competitor stats are usually strings under displayValue (the standings
    // tree uses numeric value); read either, and return null when the stat is absent so the
    // UI shows "—" rather than a misleading 0.
    private String statText(JsonNode stats, String... names) {
        JsonNode s = stat(stats, names);
        String dv = txt(s.path("displayValue"));
        if (dv != null) return dv;
        return (s.path("value").isMissingNode() || s.path("value").isNull()) ? null : s.path("value").asText();
    }

    private Integer statBoxedInt(JsonNode stats, String... names) {
        JsonNode s = stat(stats, names);
        if (!s.path("value").isMissingNode() && !s.path("value").isNull())
            return (int) s.path("value").asDouble();
        String dv = txt(s.path("displayValue"));
        if (dv != null) {
            String digits = dv.replaceAll("[^0-9-]", "");
            if (!digits.isEmpty() && !"-".equals(digits)) {
                try { return Integer.parseInt(digits); } catch (NumberFormatException ignore) {}
            }
        }
        return null;
    }

    // The single /scoreboard only returns the nearest weekend, so query a season-wide
    // date range to get every weekend with full circuit + session data.
    private JsonNode seasonEvents() throws Exception {
        int year = year();
        String range = year + "0101-" + year + "1231";
        JsonNode raw = get(SITE + "/scoreboard?dates=" + range + "&limit=100");
        JsonNode events = raw.path("events");
        if (events.isArray() && events.size() > 0) return events;
        // Only fall back to the live scoreboard for the CURRENT season. For a past season an
        // empty range means ESPN has no site-API data for it — returning the current weekend
        // here is what mislabelled 2026 data as 2023/2024. Return the empty result instead.
        if (year == java.time.LocalDate.now().getYear()) {
            return get(SITE + "/scoreboard").path("events");
        }
        return events;
    }
    private F1Dto.RaceWeekend parseWeekend(JsonNode e) { return parseWeekend(e, false); }
    private F1Dto.RaceWeekend parseWeekend(JsonNode e, boolean enrich) {
        String id   = str(e.path("id"));
        String name = first(txt(e.path("name")), txt(e.path("shortName")), "Grand Prix");
        JsonNode circuitNode = e.path("circuit").isMissingNode()
                ? e.path("competitions").path(0).path("circuit")
                : e.path("circuit");
        String circuit = txt(circuitNode.path("fullName"));
        String city    = txt(circuitNode.path("address").path("city"));
        String country = txt(circuitNode.path("address").path("country"));
        String state   = txt(e.path("status").path("type").path("state"));
        if (state == null) state = "pre";

        List<F1Dto.SessionDto> sessions = new ArrayList<>();
        String startDate = null, endDate = null;
        for (JsonNode s : e.path("competitions")) {
            F1Dto.SessionDto sd = parseSession(s, id, enrich);
            if (sd != null) {
                sessions.add(sd);
                if (sd.date() != null) {
                    if (startDate == null || sd.date().compareTo(startDate) < 0) startDate = sd.date();
                    if (endDate == null   || sd.date().compareTo(endDate)   > 0) endDate   = sd.date();
                }
            }
        }
        if (startDate == null) startDate = txt(e.path("date"));

        return new F1Dto.RaceWeekend(id, name, circuit, city, country,
                startDate, endDate, state, sessions);
    }

private F1Dto.SessionDto parseSession(JsonNode s, String eventId, boolean enrich) {
        JsonNode st = s.path("status").path("type");
        String type  = first(txt(s.path("type").path("abbreviation")), txt(s.path("type").path("text")), "");
        String label = first(txt(s.path("type").path("text")), txt(s.path("name")), type);
        String state = txt(st.path("state")) != null ? txt(st.path("state")) : "pre";
        String detail = first(txt(st.path("shortDetail")), txt(st.path("detail")), null);

        List<JsonNode> comps = new ArrayList<>();
        for (JsonNode c : s.path("competitors")) comps.add(c);
        comps.sort((a, b) -> Integer.compare(a.path("order").asInt(999), b.path("order").asInt(999)));

        // laps / points / finish-time come from the CORE API — the site payload's
        // competitor statistics are always empty. Only fetch for a completed
        // Race/Sprint, and only on the single-event results() call (enrich=true),
        // never for the season-wide scoreboard/schedule.
        String sessionId = str(s.path("id"));
        String tl = (type == null) ? "" : type.toLowerCase();
        boolean raceOrSprint = tl.contains("race") || tl.equals("sprint") || tl.equals("spr");
        java.util.Map<String, StatLine> stats =
                (enrich && raceOrSprint) ? competitionStats(eventId, sessionId, "post".equals(state))
                                         : java.util.Map.of();

        List<F1Dto.DriverResult> grid = new ArrayList<>();
        int pos = 1;
        for (JsonNode c : comps) {
            JsonNode ath = c.path("athlete");
            int position = c.path("order").canConvertToInt() ? c.path("order").asInt() : pos;
            String driverId = str(ath.has("id") ? ath.path("id") : c.path("id"));
            StatLine sl = stats.get(driverId);
            grid.add(new F1Dto.DriverResult(
                    position,
                    driverId,
                    first(txt(ath.path("fullName")), txt(ath.path("displayName")), txt(c.path("displayName")), "-"),
                    first(txt(ath.path("flag").path("alt")), txt(c.path("flag").path("alt")), null),
                    first(txt(ath.path("flag").path("href")), txt(c.path("flag").path("href")), null),
                    c.path("winner").asBoolean(false),
                    sl != null ? sl.laps() : null,
                    sl != null ? sl.timeOrStatus() : null,
                    sl != null ? sl.points() : null,
                    sl != null && sl.retired()));
            pos++;
        }
        return new F1Dto.SessionDto(sessionId, type, label, txt(s.path("date")), state, detail, grid);
    }
    // schedule (season calendar)

    public List<F1Dto.ScheduleEntry> schedule() throws Exception { return schedule(null); }

    public List<F1Dto.ScheduleEntry> schedule(Integer requestedYear) throws Exception {
        reqYear.set(requestedYear);
        try {
        List<F1Dto.ScheduleEntry> out = new ArrayList<>();

        for (JsonNode e : seasonEvents()) {
            F1Dto.RaceWeekend w = parseWeekend(e);
            if (w == null) continue;
            out.add(new F1Dto.ScheduleEntry(
                    w.id(), w.name(), w.circuit(), w.city(), w.country(),
                    w.startDate(), w.endDate(), w.statusState()));
        }
        if (!out.isEmpty()) return out;

        JsonNode calendar = get(SITE + "/scoreboard").path("leagues").path(0).path("calendar");
        for (JsonNode c : calendar) {
            JsonNode ev  = c.path("event");
            String start = first(txt(c.path("startDate")), txt(ev.path("date")), null);
            String end   = txt(c.path("endDate"));
            out.add(new F1Dto.ScheduleEntry(
                    first(str(ev.path("id")), idFromRef(txt(c.path("$ref"))), str(c.path("value"))),
                    first(txt(c.path("label")), txt(ev.path("name")), "Grand Prix"),
                    txt(ev.path("circuit").path("fullName")),
                    txt(ev.path("circuit").path("address").path("city")),
                    txt(ev.path("circuit").path("address").path("country")),
                    start, end,
                    weekendState(start, end)));
        }
        return out;
        } finally {
            reqYear.remove();
        }
    }

    private String idFromRef(String ref) {
        if (ref == null) return null;
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("/events/(\\d+)").matcher(ref);
        return m.find() ? m.group(1) : null;
    }

    private String weekendState(String start, String end) {
        try {
            String now = java.time.OffsetDateTime.now().toString();
            if (end != null && end.compareTo(now) < 0)   return "post";
            if (start != null && start.compareTo(now) > 0) return "pre";
            return "in";
        } catch (Exception ex) {
            return "pre";
        }
    }

    // standings (drivers + constructors)
    //
    // Drivers: read the /apis/v2/ standings tree (the /apis/site/v2/ one is a stub); if empty,
    // compute points from race results as a last resort. Constructors: the site endpoint rarely
    // carries them, so read the core API constructor standings (points/wins/rank inline per
    // entry; team name behind a manufacturer $ref we cache).

    public F1Dto.Standings standings() throws Exception { return standings(null); }

    public F1Dto.Standings standings(Integer requestedYear) throws Exception {
        reqYear.set(requestedYear);
        try {
        // Past seasons: ESPN's core standings tree returns the CURRENT F1 table regardless of the
        // season in the URL, so it can't be trusted for history. Race results ARE year-specific,
        // so compute the historical table from this season's own results (empty when ESPN has no
        // race data for that year — honest, never the current season mislabelled).
        if (requestedYear != null && requestedYear != java.time.LocalDate.now().getYear()) {
            return new F1Dto.Standings(computeDriverStandingsFromResults(), new ArrayList<>());
        }

        // /apis/site/v2/.../standings returns only a {"fullViewLink"} stub with no entries.
        // The full standings tree (official championship points, sprints included) is on
        // the /apis/v2/ domain — see SITE_V2.
        JsonNode raw = get(SITE_V2 + "/standings");
        List<F1Dto.DriverStanding> drivers = new ArrayList<>();
        List<F1Dto.ConstructorStanding> constructors = new ArrayList<>();

        List<JsonNode> groups = new ArrayList<>();
        if (raw.path("standings").isArray()) raw.path("standings").forEach(groups::add);
        if (raw.path("children").isArray())  raw.path("children").forEach(groups::add);

        for (JsonNode group : groups) {
            String groupName = first(txt(group.path("name")), txt(group.path("displayName")), "").toLowerCase();
            boolean isConstructor = groupName.contains("constructor") || groupName.contains("team")
                    || groupName.contains("manufacturer");
            JsonNode entries = group.path("standings").path("entries");
            if (!entries.isArray() || entries.isEmpty()) entries = group.path("entries");
            int rank = 1;
            for (JsonNode e : entries) {
                JsonNode stats = e.path("stats");
                if (isConstructor) {
                    JsonNode t = e.path("team").isMissingNode() ? e.path("manufacturer") : e.path("team");
                    constructors.add(new F1Dto.ConstructorStanding(
                            rank++,
                            str(t.path("id")),
                            first(txt(t.path("displayName")), txt(t.path("name")), "-"),
                            first(txt(t.path("logos").path(0).path("href")), txt(t.path("logo")), null),
                            statDouble(stats, "points", "championshipPts"),
                            statInt(stats, "wins")));
                } else {
                    JsonNode a = e.path("athlete").isMissingNode() ? e.path("competitor").path("athlete") : e.path("athlete");
                    drivers.add(new F1Dto.DriverStanding(
                            rank++,
                            str(a.path("id")),
                            first(txt(a.path("fullName")), txt(a.path("displayName")), "-"),
                            first(txt(a.path("flag").path("href")), null),
                            first(txt(e.path("team").path("displayName")), txt(a.path("team").path("displayName")), null),
                            statDouble(stats, "points", "championshipPts"),
                            statInt(stats, "wins")));
                }
            }
        }

        // ESPN serves no F1 driver standings via the site API (racing site API only has
        // scoreboard + news). Read them from the core standings tree — the SAME source the
        // constructors use, whose points already include sprints and are correct.
        if (drivers.isEmpty()) {
            drivers = fetchDriverStandingsFromCore();
        }
        if (constructors.isEmpty()) {
            constructors = fetchConstructorStandingsFromCore();
        }

        // Only accept a fetch that (a) has drivers and (b) doesn't regress the points total.
        // Season points are monotonic, so a lower total means ESPN handed us a stale snapshot;
        // an empty list means the call failed. In both cases we serve the last good result
        // rather than the race-only compute (which under-counts by omitting sprint points) —
        // that swap is exactly what made the standings flip between 204 and 183 on refresh.
        if (!drivers.isEmpty()) {
            F1Dto.Standings fresh = new F1Dto.Standings(drivers, constructors);
            // Explicit historical seasons are static — return directly, no monotonic cache.
            if (reqYear.get() != null) {
                return fresh;
            }
            if (lastGoodStandings == null
                    || totalDriverPoints(fresh) >= totalDriverPoints(lastGoodStandings)) {
                lastGoodStandings = fresh;
            }
            return lastGoodStandings;
        }
        if (reqYear.get() == null && lastGoodStandings != null) {
            return lastGoodStandings;
        }

        // Cold start / empty historical fetch: compute race + sprint points from results.
        drivers = computeDriverStandingsFromResults();
        return new F1Dto.Standings(drivers, constructors);
        } finally {
            reqYear.remove();
        }
    }

    // Constructor standings from the core API. /standings is a chain of $ref links:
    // top -> season standings -> groups (Driver, constructor). Follow to the
    // constructor group, read inline stats per entry, resolve each team name via its
    // manufacturer $ref (cached). Defensive: any failure returns empty so drivers still render.
    private List<F1Dto.ConstructorStanding> fetchConstructorStandingsFromCore() {
        List<F1Dto.ConstructorStanding> out = new ArrayList<>();
        try {
            int year = year();
            JsonNode top = get(CORE + "/seasons/" + year + "/types/2/standings");
            JsonNode seasonStandings = followRef(top);
            if (seasonStandings == null) return out;

            JsonNode constructorGroup = null;
            for (JsonNode item : seasonStandings.path("items")) {
                String name = first(txt(item.path("name")), txt(item.path("displayName")), "").toLowerCase();
                if (name.contains("constructor") || name.contains("manufacturer") || name.contains("team")) {
                    constructorGroup = followRef(item);
                    break;
                }
            }
            if (constructorGroup == null) return out;

            for (JsonNode entry : constructorGroup.path("standings")) {
                JsonNode stats = entry.path("records").path(0).path("stats");
                double points = statDouble(stats, "points", "championshipPts");
                int    wins   = statInt(stats, "wins");
                int    rank   = statInt(stats, "rank");

                String manRef = txt(entry.path("manufacturer").path("$ref"));
                String teamId = idFromManufacturerRef(manRef);
                String team   = resolveManufacturerName(manRef, teamId);

                out.add(new F1Dto.ConstructorStanding(
                        rank > 0 ? rank : out.size() + 1,
                        teamId,
                        team,
                        null,
                        points,
                        wins));
            }
            out.sort((x, y) -> Integer.compare(x.rank(), y.rank()));
        } catch (Exception ex) {
            log.warn("Constructor standings unavailable", ex);
        }
        return out;
    }

    // Driver standings from the core API — the same season standings tree as
    // fetchConstructorStandingsFromCore(), just the sibling "Drivers" group. Entries
    // carry an athlete $ref plus inline records[0].stats (points/wins/rank). Points here
    // are the official championship total, so sprint points ARE included (unlike the
    // race-only computeDriverStandingsFromResults fallback). Defensive: any failure
    // returns empty so the caller can fall through.
    private List<F1Dto.DriverStanding> fetchDriverStandingsFromCore() {
        List<F1Dto.DriverStanding> out = new ArrayList<>();
        try {
            int year = year();
            JsonNode top = get(CORE + "/seasons/" + year + "/types/2/standings");
            JsonNode seasonStandings = followRef(top);
            if (seasonStandings == null) { log.info("Core standings: no season standings found"); return out; }

            // Mirror fetchConstructorStandingsFromCore: the tree has sibling groups.
            // Pick the drivers' group by name (anything that isn't constructors), then
            // confirm it carries athlete entries. Log the group names either way.
            java.util.List<String> groupNames = new ArrayList<>();
            JsonNode driverGroup = null;
            for (JsonNode item : seasonStandings.path("items")) {
                JsonNode g = followRef(item);
                if (g == null) continue;
                String name = first(txt(g.path("name")), txt(g.path("displayName")), txt(item.path("name")), "").toLowerCase();
                groupNames.add(name.isEmpty() ? "(unnamed)" : name);
                boolean isConstructor = name.contains("constructor") || name.contains("manufacturer") || name.contains("team");
                JsonNode firstEntry = g.path("standings").path(0);
                boolean hasAthlete = !firstEntry.path("athlete").isMissingNode();
                if ((!isConstructor && g.path("standings").isArray() && !g.path("standings").isEmpty()) || (hasAthlete && driverGroup == null)) {
                    if (hasAthlete || name.contains("driver")) driverGroup = g;
                }
            }
            log.info("Core standings groups: {} | driverGroup found: {}", groupNames, driverGroup != null);
            if (driverGroup == null) return out;

            for (JsonNode entry : driverGroup.path("standings")) {
                JsonNode stats = entry.path("records").path(0).path("stats");
                double points = statDouble(stats, "points", "championshipPts");
                int    wins   = statInt(stats, "wins");
                int    rank   = statInt(stats, "rank");

                JsonNode athNode = entry.path("athlete");
                String athId = first(txt(athNode.path("id")), idFromAthleteRef(txt(athNode.path("$ref"))), null);
                String[] info = resolveAthleteInfo(athId);   // {name, flagHref, team}

                out.add(new F1Dto.DriverStanding(
                        rank > 0 ? rank : out.size() + 1,
                        athId,
                        info[0],
                        info[1],
                        info[2],
                        points,
                        wins));
            }
            out.sort((x, y) -> Integer.compare(x.rank(), y.rank()));
            log.info("Core drivers parsed: {}{}", out.size(),
                    out.isEmpty() ? "" : " (top: " + out.get(0).driver() + " " + out.get(0).points() + " pts)");
        } catch (Exception ex) {
            log.warn("Driver core fetch failed", ex);
        }
        return out;
    }

    private String idFromAthleteRef(String ref) {
        if (ref == null) return null;
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("/athletes/(\\d+)").matcher(ref);
        return m.find() ? m.group(1) : null;
    }

    // Resolves an athlete's display name, flag, and team from their season profile
    // (one cached HTTP call each). vehicles[0].team is the same field resolveDriverTeam()
    // reads, so the team name matches what the scoreboard-based path produces.
    private String[] resolveAthleteInfo(String athId) {
        if (athId == null) return new String[]{"-", null, null};
        String[] cached = athleteInfoCache.get(athId);
        if (cached != null) return cached;
        String[] info = {"-", null, null};
        try {
            int year = year();
            JsonNode a = get(CORE + "/seasons/" + year + "/athletes/" + athId);
            JsonNode vehicle = a.path("vehicles").path(0);
            info = new String[]{
                    first(txt(a.path("fullName")), txt(a.path("displayName")), txt(a.path("shortName")), "-"),
                    first(txt(a.path("flag").path("href")), null),
                    first(txt(vehicle.path("team")), txt(vehicle.path("manufacturer")), null)
            };
        } catch (Exception ex) {
            log.warn("Athlete info lookup failed for {}", athId, ex);
        }
        athleteInfoCache.put(athId, info);
        return info;
    }

    private String resolveManufacturerName(String ref, String id) {
        if (ref == null) return "-";
        String key = id != null ? id : ref;
        String cached = manufacturerNameCache.get(key);
        if (cached != null) return cached;
        String name = "-";
        try {
            JsonNode m = get(ref);
            name = first(txt(m.path("displayName")), txt(m.path("name")),
                         txt(m.path("shortDisplayName")), txt(m.path("abbreviation")), "-");
        } catch (Exception ex) {
            log.warn("Manufacturer name lookup failed", ex);
        }
        manufacturerNameCache.put(key, name);
        return name;
    }

    private String idFromManufacturerRef(String ref) {
        if (ref == null) return null;
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("/manufacturers/(\\d+)").matcher(ref);
        return m.find() ? m.group(1) : null;
    }

    // If node is/contains a "$ref", fetch that URL; otherwise return node as-is.
    private JsonNode followRef(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) return null;
        String ref = txt(node.path("$ref"));
        if (ref == null) return node;
        try {
            return get(ref);
        } catch (Exception ex) {
            log.warn("$ref follow failed", ex);
            return null;
        }
    }

    // Resolves a driver's current team via their individual core-API profile
    // (vehicles[0].team). Not present on the scoreboard's competitor nodes, so
    // this is a separate, cached lookup — one HTTP call per driver, ever.
    private String resolveDriverTeam(String driverId) {
        if (driverId == null) return null;
        String cached = driverTeamCache.get(driverId);
        if (cached != null) return cached;
        String team = null;
        try {
            int year = year();
            JsonNode a = get(CORE + "/seasons/" + year + "/athletes/" + driverId);
            JsonNode vehicle = a.path("vehicles").path(0);
            team = first(txt(vehicle.path("team")), txt(vehicle.path("manufacturer")), null);
        } catch (Exception ex) {
            log.warn("Driver team lookup failed for {}", driverId, ex);
        }
        if (team != null) driverTeamCache.put(driverId, team);
        return team;
    }

    private static final int[] POINTS = {25, 18, 15, 12, 10, 8, 6, 4, 2, 1};
    // 2026 sprint points: P1..P8 = 8..1 (P9+ score nothing).
    private static final int[] SPRINT_POINTS = {8, 7, 6, 5, 4, 3, 2, 1};

    // Sum championship points across every completed Race/Sprint session this season.
    private List<F1Dto.DriverStanding> computeDriverStandingsFromResults() {
        java.util.Map<String, double[]> pts = new java.util.HashMap<>();
        java.util.Map<String, String[]> meta = new java.util.HashMap<>();
        // Diagnostic: every distinct completed session "typeId:abbreviation" we encounter.
        // If sprints still don't count, this log reveals the exact sprint label to match.
        java.util.Set<String> scoredTypes = new java.util.LinkedHashSet<>();
        java.util.Set<String> skippedTypes = new java.util.LinkedHashSet<>();
        try {
            for (JsonNode e : seasonEvents()) {
                for (JsonNode s : e.path("competitions")) {
                    JsonNode typeNode = s.path("type");
                    String abbr = first(txt(typeNode.path("abbreviation")), txt(typeNode.path("text")), "");
                    String typeId = txt(typeNode.path("id"));
                    String lower = abbr.toLowerCase();

                    // The Grand Prix race is type id "3" (abbreviation "Race"). The Sprint is a
                    // separate scoring session; match it by name but exclude sprint qualifying.
                    boolean isRace   = "3".equals(typeId) || lower.equals("race");
                    boolean isSprint = (lower.contains("sprint") || lower.equals("sr") || lower.equals("spr"))
                            && !lower.contains("qual") && !lower.equals("sq");
                    boolean done = "post".equals(s.path("status").path("type").path("state").asText(""));
                    if (!done) continue;
                    if (!isRace && !isSprint) { skippedTypes.add(typeId + ":" + abbr); continue; }
                    scoredTypes.add(typeId + ":" + abbr + (isSprint ? " (sprint)" : " (race)"));

                    List<JsonNode> grid = new ArrayList<>();
                    for (JsonNode c : s.path("competitors")) grid.add(c);
                    grid.sort((a, b) -> Integer.compare(a.path("order").asInt(999), b.path("order").asInt(999)));

                    int[] table = isSprint ? SPRINT_POINTS : POINTS;
                    for (int i = 0; i < grid.size() && i < table.length; i++) {
                        JsonNode c   = grid.get(i);
                        JsonNode ath = c.path("athlete");
                        String id = first(txt(ath.path("id")), txt(c.path("id")), null);
                        if (id == null) continue;
                        double[] cur = pts.computeIfAbsent(id, k -> new double[2]);
                        cur[0] += table[i];
                        if (i == 0 && isRace) cur[1] += 1;   // race wins only
                        meta.putIfAbsent(id, new String[]{
                                first(txt(ath.path("fullName")), txt(ath.path("displayName")), "-"),
                                txt(ath.path("flag").path("href"))});
                    }
                }
            }
            log.info("Scored sessions: {} | skipped: {}", scoredTypes, skippedTypes);
        } catch (Exception ex) {
            log.warn("Compute-from-results failed", ex);
        }

    // ============================================================================
    // TODO — N+1 HTTP calls in a loop
    // ----------------------------------------------------------------------------
    // Computing fallback driver standings resolves each driver's team by calling
    // resolveDriverTeam() inside the stream. On a cold cache that is one blocking
    // HTTP request per driver during a single REST request.
    //
    // EXAMPLE:
    //   Map<String, String> teams = resolveDriverTeamsInBatch(driverIds);
    //   out.add(new DriverStanding(rank, id, name, flag, teams.get(id), points, wins));
    //
    // WHY: Bulk/prefetch keeps request latency bounded and avoids upstream rate limits.
    // ============================================================================

        List<F1Dto.DriverStanding> out = new ArrayList<>();
        pts.entrySet().stream()
           .sorted((x, y) -> Double.compare(y.getValue()[0], x.getValue()[0]))
           .forEach(en -> {
               String[] m = meta.getOrDefault(en.getKey(), new String[]{"-", null});
               out.add(new F1Dto.DriverStanding(
                       out.size() + 1, en.getKey(), m[0], m[1], resolveDriverTeam(en.getKey()),
                       en.getValue()[0], (int) en.getValue()[1]));
           });
        return out;
    }

    // news

    private static final java.util.regex.Pattern MOVE = java.util.regex.Pattern.compile(
            "\\b(sign(ed|ing|s)?|deal|contract|extension|join(ed|ing|s)?|seat|" +
            "switch(ed|es)?|move(d|s)?|replace(d|s)?|promot(e|ed|ion)|" +
            "rumou?r(ed|s)?|talks|negotiat(e|ed|ion|ing))\\b",
            java.util.regex.Pattern.CASE_INSENSITIVE);
    private static final java.util.Set<String> GENERIC =
            java.util.Set.of("Formula 1", "F1", "Racing", "Sports", "Sport");

    public List<Dto.NewsItem> news(int limit) throws Exception {
        JsonNode raw = get(SITE + "/news?limit=" + limit);
        List<Dto.NewsItem> out = new ArrayList<>();
        int i = 0;
        for (JsonNode a : raw.path("articles")) {
            String headline = first(txt(a.path("headline")), "Untitled");
            String desc     = txt(a.path("description")) != null ? txt(a.path("description")) : "";
            String category = MOVE.matcher(headline + " " + desc).find()
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
    // ── Per-competitor race/sprint stats from the CORE API ──────────────────
    // Site scoreboard/summary return empty competitor statistics, so laps/points/
    // finish-time live only in the core API behind one $ref per driver. Fetch the
    // competitors list (1 call) + each driver's statistics ($ref), merge, and cache
    // per competition — but only once the session is FINAL and non-empty, so an
    // in-progress or failed fetch is never pinned.
    private record StatLine(Integer laps, Integer points, String timeOrStatus, boolean retired) {}

    private final java.util.Map<String, java.util.Map<String, StatLine>> compStatsCache =
            new java.util.concurrent.ConcurrentHashMap<>();

private java.util.Map<String, StatLine> competitionStats(String eventId, String sessionId, boolean isFinal) {
        String key = year() + ":" + eventId + ":" + sessionId;
        java.util.Map<String, StatLine> cached = compStatsCache.get(key);
        if (cached != null) return cached;
        try {
            JsonNode items = get(CORE + "/events/" + eventId + "/competitions/" + sessionId + "/competitors").path("items");
            if (!items.isArray() || items.isEmpty()) return java.util.Map.of();

            record Raw(String id, int order, boolean winner, Integer laps, Integer points,
                       double totalMs, String totalDisplay) {}
            java.util.List<Raw> raws = new java.util.ArrayList<>();
            for (JsonNode c : items) {
                String ref = txt(c.path("statistics").path("$ref"));
                Integer laps = null, points = null; double totalMs = 0; String totalDisplay = null;
                if (ref != null) {
                    JsonNode st = firstStats(get(ref.replaceFirst("^http://", "https://")));
                    laps   = statNum(st, "lapsCompleted");
                    points = statNum(st, "championshipPts", "points");
                    JsonNode tt = stat(st, "totalTime");
                    totalMs = tt.path("value").asDouble(0);
                    totalDisplay = txt(tt.path("displayValue"));
                }
                raws.add(new Raw(str(c.path("id")), c.path("order").asInt(0),
                                 c.path("winner").asBoolean(false), laps, points, totalMs, totalDisplay));
            }

            Raw win = raws.stream().filter(r -> r.winner() || r.order() == 1).findFirst().orElse(null);
            double winMs    = (win != null) ? win.totalMs() : 0;
            int    winnerLaps = (win != null && win.laps() != null) ? win.laps() : 0;

            java.util.Map<String, StatLine> out = new java.util.HashMap<>();
            for (Raw r : raws) {
                int laps = (r.laps() != null) ? r.laps() : 0;
                boolean leadLap = winnerLaps > 0 && laps == winnerLaps;
                // F1 "90% rule": completing >=90% of the leader's laps = classified
                // finisher (gap or "+N lap"), even if lapped. Below that = retired (DNF).
                boolean classified = winnerLaps > 0 && laps >= Math.ceil(0.9 * winnerLaps);

                String t; boolean retired = false;
                if (r.winner() || r.order() == 1) {
                    t = r.totalDisplay();                          // winner: total race time
                } else if (!classified) {
                    t = "DNF"; retired = true;                     // retired / not classified
                } else if (!leadLap) {
                    int d = winnerLaps - laps;                     // lapped but classified
                    t = "+" + d + " lap" + (d > 1 ? "s" : "");
                } else if (r.totalMs() > 0 && winMs > 0) {
                    t = "+" + fmtGap(r.totalMs() - winMs);         // same-lap gap
                } else {
                    t = null;
                }
                out.put(r.id(), new StatLine(r.laps(), r.points(), t, retired));
            }
            if (isFinal && !out.isEmpty()) compStatsCache.put(key, out);
            return out;
        } catch (Exception ex) {
            return java.util.Map.of();
        }
    }

    private JsonNode firstStats(JsonNode root) {
        JsonNode cats = root.path("splits").path("categories");
        for (JsonNode cat : cats)
            if ("general".equalsIgnoreCase(txt(cat.path("name")))) return cat.path("stats");
        return cats.path(0).path("stats");
    }

    private Integer statNum(JsonNode stats, String... names) {   // nullable, unlike statInt
        JsonNode s = stat(stats, names);
        if (s.path("value").isMissingNode() || s.path("value").isNull()) return null;
        return (int) Math.round(s.path("value").asDouble());
    }

    private String fmtGap(double ms) {
        double sec = ms / 1000.0;
        if (sec < 60) return String.format("%.3f", sec);
        long m = (long) (sec / 60);
        return m + ":" + String.format("%06.3f", sec - m * 60);
    }
    private String newsCategory(JsonNode cats) {
        String team = null, other = null;
        for (JsonNode c : cats) {
            String d = txt(c.path("description"));
            if (d == null || GENERIC.contains(d)) continue;
            String type = c.path("type").asText();
            if ("team".equals(type) && team == null) team = d;
            else if (other == null)                  other = d;
        }
        if (team  != null) return team;
        if (other != null) return other;
        return "Formula 1";
    }

    // reference-data passthrough (raw ESPN JSON - no bespoke DTO yet; these are
    // long-tail resources whose exact shape hasn't been verified against a live
    // sample, unlike scoreboard/standings/news above)

    public JsonNode teams(int page, int limit) throws Exception {
        return getPaged(CORE + "/teams", page, limit);
    }

    /** Every driver in the Core API (large - paginated). */
    public JsonNode drivers(int page, int limit, boolean activeOnly) throws Exception {
        return getPaged(CORE + "/athletes?active=" + activeOnly, page, limit);
    }

    public JsonNode driverProfile(String driverId) throws Exception {
        int year = year();
        return get(CORE + "/seasons/" + year + "/athletes/" + driverId);
    }

    public JsonNode circuits(int page, int limit) throws Exception {
        return getPaged(CORE + "/circuits", page, limit);
    }

    public JsonNode venues(int page, int limit) throws Exception {
        return getPaged(CORE + "/venues", page, limit);
    }

    public JsonNode providers() throws Exception {
        return get(CORE + "/providers");
    }

    public JsonNode calendar(String dates) throws Exception {
        String url = CORE + "/calendar";
        if (dates != null && !dates.isBlank()) url += "?dates=" + dates;
        return get(url);
    }

    public JsonNode seasons(int page, int limit) throws Exception {
        return getPaged(CORE + "/seasons", page, limit);
    }

    public JsonNode athleteNews(String athleteId, int limit) throws Exception {
        return get(SITE + "/athletes/" + athleteId + "/news?limit=" + limit);
    }

    // ADDED — constructors (Ferrari, Red Bull, etc.) for a given season. 
    public JsonNode manufacturers(String season, int page, int limit) throws Exception {
        return getPaged(CORE + "/seasons/" + season + "/manufacturers", page, limit);
    }

    // ADDED — current season, mirroring every other sport's currentSeason().
    public JsonNode currentSeason() throws Exception {
        return get(CORE + "/season");
    }

    // ADDED — league-wide media. Previously only per-athlete news existed
    // (athleteNews() above), with no general F1 media feed.
    public JsonNode media() throws Exception {
        return get(CORE + "/media");
    }

    // ADDED — event/session-level passthrough. In this codebase's F1 model a race
    // weekend is an "event" and each session (practice/qualifying/race) is a
    // "competition" within it — same id pattern already used by resolveDriverTeam()
    // and results() above, just exposed as raw Core API passthrough like the other
    // long-tail resources in this section.

    public JsonNode eventDetail(String eventId) throws Exception {
        return get(CORE + "/events/" + eventId);
    }

    public JsonNode competitionDetail(String eventId, String competitionId) throws Exception {
        return get(CORE + "/events/" + eventId + "/competitions/" + competitionId);
    }

    public JsonNode broadcasts(String eventId, String competitionId) throws Exception {
        return get(CORE + "/events/" + eventId + "/competitions/" + competitionId + "/broadcasts");
    }

    public JsonNode competitionOdds(String eventId, String competitionId, int page, int limit) throws Exception {
        return getPaged(CORE + "/events/" + eventId + "/competitions/" + competitionId + "/odds", page, limit);
    }

    public JsonNode officials(String eventId, String competitionId) throws Exception {
        return get(CORE + "/events/" + eventId + "/competitions/" + competitionId + "/officials");
    }

    // getPaged(baseUrl, page, limit) is inherited from EspnApiHelper - it now also
    // clamps page/limit to sane bounds (see EspnApiHelper), so every sport benefits.

    // shared helpers

    private double totalDriverPoints(F1Dto.Standings s) {
        double total = 0;
        if (s != null) for (F1Dto.DriverStanding d : s.drivers()) total += d.points();
        return total;
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

    // get()/txt()/num()/str()/first()/bestImage() are inherited from EspnApiHelper —
    // same signatures this class used to define locally, now backed by the shared,
    // retryable EspnHttpClient bean instead of a private HttpClient/ObjectMapper.
}