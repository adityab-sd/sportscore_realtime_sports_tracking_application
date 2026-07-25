package org.Spring.f1.api;

import java.util.ArrayList;
import java.util.List;

import org.Spring.api.Dto;
import org.Spring.api.EspnApiHelper;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.JsonNode;

// Owns all ESPN Formula 1 reference-data parsing. Race-oriented: the scoreboard
// returns GP weekends with sessions and driver grids; the calendar drives the
// season schedule; standings come from the standings endpoints (site for drivers,
// core API for constructors). Same helper conventions as the other services.
// ============================================================================
// PLEASE review — Singleton + Proxy (GoF) missing for ESPN I/O
// ----------------------------------------------------------------------------
// F1Service repeats the per-class HttpClient/ObjectMapper anti-pattern instead
// of using shared beans, and its private get() has no retry/backoff proxy. This
// diverges from EspnApiHelper and makes transient ESPN 5xx/timeouts fail once.
//
// WHY: one shared HTTP/JSON infrastructure avoids duplicate connection pools and retry gaps.
// UPDATE:
// Now extends EspnApiHelper (same as Basketball/Football/Baseball) instead of building its
// own HttpClient/ObjectMapper. get()/txt()/num()/str()/first()/bestImage() below all come
// from the base class, and get() delegates to the injected EspnHttpClient bean, so
// @Retryable actually crosses the Spring proxy boundary and F1's ESPN calls get the same
// retry/backoff as every other sport (previously they had none).
// ============================================================================
@Service
public class F1Service extends EspnApiHelper {

    private static final String SITE = "https://site.api.espn.com/apis/site/v2/sports/racing/f1";
    private static final String CORE = "https://sports.core.api.espn.com/v2/sports/racing/leagues/f1";

    // manufacturerId -> team name. Names don't change mid-season, so cache one lookup each.
    private final java.util.Map<String, String> manufacturerNameCache = new java.util.concurrent.ConcurrentHashMap<>();

    // driverId -> team name, resolved from each driver's individual profile (vehicles[0].team).
    // Not available on the scoreboard's competitor nodes, so this is a separate lookup, cached
    // the same way as manufacturerNameCache.
    private final java.util.Map<String, String> driverTeamCache = new java.util.concurrent.ConcurrentHashMap<>();

    // scoreboard (weekends + sessions + grids)

    public List<F1Dto.RaceWeekend> scoreboard() throws Exception {
        JsonNode raw = get(SITE + "/scoreboard");
        List<F1Dto.RaceWeekend> out = new ArrayList<>();
        for (JsonNode e : raw.path("events")) {
            F1Dto.RaceWeekend w = parseWeekend(e);
            if (w != null) out.add(w);
        }
        return out;
    }

    public F1Dto.RaceWeekend results(String eventId) throws Exception {
        for (JsonNode e : seasonEvents()) {
            if (eventId.equals(str(e.path("id")))) return parseWeekend(e);
        }
        JsonNode summary = get(SITE + "/summary?event=" + eventId);
        JsonNode header  = summary.path("header");
        if (!header.isMissingNode() && !header.path("competitions").isMissingNode()) {
            return parseWeekend(header);
        }
        return null;
    }

    // The single /scoreboard only returns the nearest weekend, so query a season-wide
    // date range to get every weekend with full circuit + session data.
    private JsonNode seasonEvents() throws Exception {
        int year = java.time.LocalDate.now().getYear();
        String range = year + "0101-" + year + "1231";
        JsonNode raw = get(SITE + "/scoreboard?dates=" + range + "&limit=100");
        JsonNode events = raw.path("events");
        if (events.isArray() && events.size() > 0) return events;
        return get(SITE + "/scoreboard").path("events");
    }

    private F1Dto.RaceWeekend parseWeekend(JsonNode e) {
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
            F1Dto.SessionDto sd = parseSession(s);
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

    private F1Dto.SessionDto parseSession(JsonNode s) {
        JsonNode st = s.path("status").path("type");
        String type  = first(txt(s.path("type").path("abbreviation")), txt(s.path("type").path("text")), "");
        String label = first(txt(s.path("type").path("text")), txt(s.path("name")), type);
        String state = txt(st.path("state")) != null ? txt(st.path("state")) : "pre";
        String detail = first(txt(st.path("shortDetail")), txt(st.path("detail")), null);

        List<JsonNode> comps = new ArrayList<>();
        for (JsonNode c : s.path("competitors")) comps.add(c);
        comps.sort((a, b) -> Integer.compare(a.path("order").asInt(999), b.path("order").asInt(999)));

        List<F1Dto.DriverResult> grid = new ArrayList<>();
        int pos = 1;
        for (JsonNode c : comps) {
            JsonNode ath = c.path("athlete");
            int position = c.path("order").canConvertToInt() ? c.path("order").asInt() : pos;
            grid.add(new F1Dto.DriverResult(
                    position,
                    str(ath.has("id") ? ath.path("id") : c.path("id")),
                    first(txt(ath.path("fullName")), txt(ath.path("displayName")), txt(c.path("displayName")), "-"),
                    first(txt(ath.path("flag").path("alt")), txt(c.path("flag").path("alt")), null),
                    first(txt(ath.path("flag").path("href")), txt(c.path("flag").path("href")), null),
                    c.path("winner").asBoolean(false)));
            pos++;
        }
        return new F1Dto.SessionDto(str(s.path("id")), type, label, txt(s.path("date")), state, detail, grid);
    }

    // schedule (season calendar)

    public List<F1Dto.ScheduleEntry> schedule() throws Exception {
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
    // Drivers: try the site standings endpoint; if empty (ESPN's F1 site standings
    // are unreliable), compute points from race results. Constructors: the site
    // endpoint rarely carries them, so read the core API constructor standings
    // (points/wins/rank inline per entry; team name behind a manufacturer $ref we cache).

    public F1Dto.Standings standings() throws Exception {
        JsonNode raw = get(SITE + "/standings");
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

        if (drivers.isEmpty()) {
            drivers = computeDriverStandingsFromResults();
        }
        if (constructors.isEmpty()) {
            constructors = fetchConstructorStandingsFromCore();
        }

        return new F1Dto.Standings(drivers, constructors);
    }

    // Constructor standings from the core API. /standings is a chain of $ref links:
    // top -> season standings -> groups (Driver, constructor). Follow to the
    // constructor group, read inline stats per entry, resolve each team name via its
    // manufacturer $ref (cached). Defensive: any failure returns empty so drivers still render.
    private List<F1Dto.ConstructorStanding> fetchConstructorStandingsFromCore() {
        List<F1Dto.ConstructorStanding> out = new ArrayList<>();
        try {
            int year = java.time.LocalDate.now().getYear();
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
                double points = statDouble(stats, "points");
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
        // PLEASE review — observability: System.err is not structured, correlated, or level-controlled by Spring logging. EXAMPLE: private static final Logger log = LoggerFactory.getLogger(F1Service.class); log.warn("F1 constructor standings unavailable", ex);
            System.err.println("[f1 standings] constructor fetch failed: " + ex.getMessage());
        }
        return out;
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
            System.err.println("[f1 standings] manufacturer name lookup failed: " + ex.getMessage());
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
            System.err.println("[f1 standings] $ref follow failed: " + ex.getMessage());
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
            int year = java.time.LocalDate.now().getYear();
            JsonNode a = get(CORE + "/seasons/" + year + "/athletes/" + driverId);
            JsonNode vehicle = a.path("vehicles").path(0);
            team = first(txt(vehicle.path("team")), txt(vehicle.path("manufacturer")), null);
        } catch (Exception ex) {
            System.err.println("[f1 standings] driver team lookup failed for " + driverId + ": " + ex.getMessage());
        }
        if (team != null) driverTeamCache.put(driverId, team);
        return team;
    }

    private static final int[] POINTS = {25, 18, 15, 12, 10, 8, 6, 4, 2, 1};

    // Sum championship points across every completed Race/Sprint session this season.
    private List<F1Dto.DriverStanding> computeDriverStandingsFromResults() {
        java.util.Map<String, double[]> pts = new java.util.HashMap<>();
        java.util.Map<String, String[]> meta = new java.util.HashMap<>();
        try {
            for (JsonNode e : seasonEvents()) {
                for (JsonNode s : e.path("competitions")) {
                    String type = first(txt(s.path("type").path("abbreviation")), txt(s.path("type").path("text")), "");
                    boolean isRace  = type.toLowerCase().contains("race");
                    boolean isSprint = type.toLowerCase().contains("sprint");
                    boolean done = "post".equals(s.path("status").path("type").path("state").asText(""));
                    if ((!isRace && !isSprint) || !done) continue;

                    List<JsonNode> grid = new ArrayList<>();
                    for (JsonNode c : s.path("competitors")) grid.add(c);
                    grid.sort((a, b) -> Integer.compare(a.path("order").asInt(999), b.path("order").asInt(999)));

                    for (int i = 0; i < grid.size() && i < POINTS.length; i++) {
                        JsonNode c   = grid.get(i);
                        JsonNode ath = c.path("athlete");
                        String id = first(txt(ath.path("id")), txt(c.path("id")), null);
                        if (id == null) continue;
                        double award = isSprint ? Math.max(0, 8 - i) : POINTS[i];
                        double[] cur = pts.computeIfAbsent(id, k -> new double[2]);
                        cur[0] += award;
                        if (i == 0 && isRace) cur[1] += 1;
                        meta.putIfAbsent(id, new String[]{
                                first(txt(ath.path("fullName")), txt(ath.path("displayName")), "-"),
                                txt(ath.path("flag").path("href"))});
                    }
                }
            }
        } catch (Exception ex) {
            System.err.println("[f1 standings] compute-from-results failed: " + ex.getMessage());
        }

    // ============================================================================
    // PLEASE review — N+1 HTTP calls in a loop
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

    // ============================================================================
    // PLEASE review — Pagination bounds / URL encoding
    // ----------------------------------------------------------------------------
    // Raw passthrough methods accept page/limit/date fragments directly from REST
    // controllers. Negative or huge limits can amplify ESPN calls, and dates are
    // concatenated without URL encoding.
    //
    // EXAMPLE:
    //   int safeLimit = Math.min(Math.max(limit, 1), 100);
    //   URI uri = UriComponentsBuilder.fromHttpUrl(base).queryParam("limit", safeLimit).build().toUri();
    //
    // WHY: Adapters to upstream APIs should enforce bounds before making blocking I/O.
    // UPDATE:
    // page/limit are now clamped centrally in EspnApiHelper.getPaged() (see that class),
    // so every call below is bounded without repeating the clamp in each method.
    // ============================================================================

    public JsonNode teams(int page, int limit) throws Exception {
        return getPaged(CORE + "/teams", page, limit);
    }

    /** Every driver in the Core API (large - paginated). */
    public JsonNode drivers(int page, int limit, boolean activeOnly) throws Exception {
        return getPaged(CORE + "/athletes?active=" + activeOnly, page, limit);
    }

    public JsonNode driverProfile(String driverId) throws Exception {
        int year = java.time.LocalDate.now().getYear();
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

    // ADDED — constructors (Ferrari, Red Bull, etc.) for a given season. This was
    // the one genuinely missing season-scoped resource every other sport already has.
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