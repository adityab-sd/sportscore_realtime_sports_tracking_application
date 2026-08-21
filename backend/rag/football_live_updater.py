"""
live_updater.py — Fetches live football data from ESPN every 60 seconds
and uploads it to Azure AI Search so RAG can answer live questions.

Pulls three kinds of data per league, directly from ESPN's public API:
  1. Scoreboard — current/upcoming matches
  2. Standings  — league table (rank, points, wins/losses)
  3. Leaders    — top scorers

Plus injuries / transactions / news for the major leagues via the SportScore
backend REST API.
"""

import os
import time
import requests
from datetime import datetime, timedelta
from azure.search.documents import SearchClient
from azure.core.credentials import AzureKeyCredential
from dotenv import load_dotenv

load_dotenv()

SEARCH_ENDPOINT = os.getenv("AZURE_SEARCH_ENDPOINT")
SEARCH_API_KEY  = os.getenv("AZURE_SEARCH_KEY")
INDEX_NAME      = "football-live-index"

SITE_BASE      = "https://site.web.api.espn.com/apis/site/v2/sports/soccer"
STANDINGS_BASE = "https://site.web.api.espn.com/apis/v2/sports/soccer"

LEAGUES = {
    "fifa.world":        "World Cup 2026",
    "uefa.champions":    "Champions League",
    "eng.1":             "Premier League",
    "esp.1":             "La Liga",
    "ita.1":             "Serie A",
    "ger.1":             "Bundesliga",
    "fra.1":             "Ligue 1",
    "usa.1":             "MLS",
    "bra.1":             "Brazil Serie A",
    "arg.1":             "Argentina Primera",
    "club.friendly":     "Club Friendly"
}

credential = AzureKeyCredential(SEARCH_API_KEY)
search_client = SearchClient(
    endpoint=SEARCH_ENDPOINT,
    index_name=INDEX_NAME,
    credential=credential
)


# -- simple in-process cache: {url: (expiry_epoch, data)} --
_CACHE = {}

def _ttl_for(url):
    # Reference data (athletes/teams/rosters) is near-static -> cache 6h.
    # Standings / leaders / news / stats barely change -> cache 10 min.
    # Everything else (scoreboards) stays effectively uncached so live-ish
    # data stays fresh.
    if "athletes" in url or "/teams/" in url or "roster" in url:
        return 6 * 3600
    if "standings" in url or "leaders" in url or "news" in url or "statistics" in url:
        return 600
    return 20

def _get(url):
    now = time.time()
    hit = _CACHE.get(url)
    if hit and hit[0] > now:
        return hit[1]
    try:
        response = requests.get(url, headers={"User-Agent": "SportScore/1.0"}, timeout=10)
        if response.status_code == 200:
            data = response.json()
            _CACHE[url] = (now + _ttl_for(url), data)
            # light cleanup so day-changing scoreboard URLs don't pile up
            if len(_CACHE) > 500:
                for k in [k for k, v in _CACHE.items() if v[0] <= now]:
                    _CACHE.pop(k, None)
            return data
    except Exception as e:
        print(f"  Error fetching {url}: {e}")
    return None


# ── EXTRA LIVE DATA via the SportScore backend REST API ──────────────
# Reuse the backend's already-tested endpoints for injuries/transactions/news
# (they're public/permitAll) instead of re-parsing ESPN. Bounded to the major
# leagues below so we don't overload the backend every cycle.
BACKEND_URL = os.getenv(
    "BACKEND_URL",
    "https://sportscore-backend-ecaue6buc5bwf7at.northeurope-01.azurewebsites.net"
).rstrip("/")

MAJOR_LEAGUES = {
    "eng.1": "Premier League",
    "esp.1": "La Liga",
    "ita.1": "Serie A",
    "ger.1": "Bundesliga",
    "fra.1": "Ligue 1",
    "usa.1": "MLS",
    "arg.1": "Argentina Primera",
    "club.friendly": "Club Friendly"
}


def _safe_id(s):
    """Azure Search doc keys allow only letters/digits/dash/underscore/equals.
    Convert anything else (dots in league slugs, spaces, punctuation) to '-'."""
    return ("".join(c if (c.isalnum() or c in "-_=") else "-" for c in str(s))[:120]) or "x"


def fetch_backend(path):
    """GET a backend football endpoint (e.g. '/eng.1/injuries'). Returns parsed
    JSON or None. Fully defensive — never raises."""
    try:
        url = f"{BACKEND_URL}/api/football{path}"
        r = requests.get(url, headers={"User-Agent": "SportScore-Updater/1.0"}, timeout=15)
        if r.status_code != 200:
            return None
        return r.json()
    except Exception as e:
        print(f"  backend fetch failed for {path}: {e}")
        return None


def parse_injuries(items, league_name, slug):
    docs = []
    if not isinstance(items, list):
        return docs
    for it in items:
        try:
            name = (it.get("athleteName") or "").strip()
            if not name:
                continue
            team = it.get("team") or ""
            status = it.get("status") or "Unknown"
            comment = it.get("comment") or ""
            content = f"Injury update ({league_name}): {name} ({team}) — status: {status}. {comment}".strip()
            docs.append({
                "id": _safe_id(f"live-football-injury-{slug}-{it.get('athleteId') or name}"),
                "sport": "football", "category": "live-injury",
                "title": f"{name} injury — {team} ({league_name})",
                "content": content, "source": "espn.com",
                "last_updated": datetime.utcnow().isoformat(),
            })
        except Exception:
            continue
    return docs


def parse_transactions(items, league_name, slug):
    docs = []
    if not isinstance(items, list):
        return docs
    for it in items:
        try:
            desc = (it.get("description") or "").strip()
            if not desc:
                continue
            team = it.get("team") or ""
            date = it.get("date") or ""
            content = f"Transaction ({league_name}): {desc} — {team} ({date}).".strip()
            docs.append({
                "id": _safe_id(f"live-football-transaction-{slug}-{it.get('id') or desc[:40]}"),
                "sport": "football", "category": "live-transaction",
                "title": f"Transaction — {team} ({league_name})",
                "content": content, "source": "espn.com",
                "last_updated": datetime.utcnow().isoformat(),
            })
        except Exception:
            continue
    return docs


def parse_news(items, league_name, slug):
    docs = []
    if not isinstance(items, list):
        return docs
    for it in items[:10]:  # only the 10 most recent per league (keeps the index lean)
        try:
            headline = (it.get("headline") or "").strip()
            if not headline:
                continue
            desc = it.get("description") or ""
            published = it.get("published") or ""
            content = f"News ({league_name}): {headline}. {desc} (published {published})".strip()
            docs.append({
                "id": _safe_id(f"live-football-news-{slug}-{it.get('id') or headline[:40]}"),
                "sport": "football", "category": "live-news",
                "title": f"{headline} — {league_name}",
                "content": content, "source": "espn.com",
                "last_updated": datetime.utcnow().isoformat(),
            })
        except Exception:
            continue
    return docs


# ── SCOREBOARD ───────────────────────────────────────────
def fetch_scoreboard(league_slug):
    today = datetime.utcnow()
    date_from = (today - timedelta(days=30)).strftime("%Y%m%d")  # 30 days back so "last month" questions work
    date_to = (today + timedelta(days=45)).strftime("%Y%m%d")
    url = f"{SITE_BASE}/{league_slug}/scoreboard?dates={date_from}-{date_to}&limit=1000"
    return _get(url)


def extract_match_events(competition):
    """
    Pull goal scorers + cards out of the scoreboard event's 'details' array
    (already present in the data we fetch — NO extra API call). Returns a short
    human-readable string, or "" if no event data is available. Fully defensive:
    any shape mismatch just yields "" instead of crashing the updater.
    """
    try:
        details = competition.get("details") or []
        if not details:
            return ""
        # map team id -> name so we can say WHICH team a goal/card belongs to.
        team_names = {}
        for c in (competition.get("competitors") or []):
            tid = str((c.get("team") or {}).get("id") or "")
            tname = (c.get("team") or {}).get("displayName") or (c.get("team") or {}).get("shortDisplayName") or ""
            if tid:
                team_names[tid] = tname
        goals, cards = [], []
        for d in details:
            try:
                type_text = ((d.get("type") or {}).get("text") or "").lower()
                players = d.get("athletesInvolved") or []
                who = (players[0].get("displayName") if players else "") or ""
                clock = ((d.get("clock") or {}).get("displayValue") or "").strip()
                when = f" {clock}" if clock else ""
                tid = str((d.get("team") or {}).get("id") or "")
                team = team_names.get(tid, "")
                team_str = f" ({team})" if team else ""
                if not who:
                    continue
                if d.get("scoringPlay") or "goal" in type_text:
                    goals.append(f"{who}{team_str}{when}")
                elif "yellow card" in type_text:
                    cards.append(f"{who}{team_str}{when} (yellow)")
                elif "red card" in type_text:
                    cards.append(f"{who}{team_str}{when} (red)")
            except Exception:
                continue
        parts = []
        if goals:
            parts.append("Goals: " + ", ".join(goals) + ".")
        if cards:
            parts.append("Cards: " + ", ".join(cards) + ".")
        return (" " + " ".join(parts)) if parts else ""
    except Exception:
        return ""


def parse_matches(data, league_name):
    docs = []
    if not data:
        return docs
    for event in data.get("events", []):
        try:
            competition = event.get("competitions", [{}])[0]
            competitors = competition.get("competitors", [])
            status_type = competition.get("status", {}).get("type", {})
            state = status_type.get("state", "pre")  # "pre", "in", or "post"

            home = next((c for c in competitors if c.get("homeAway") == "home"), {})
            away = next((c for c in competitors if c.get("homeAway") == "away"), {})

            home_name = home.get("team", {}).get("displayName", "Unknown")
            away_name = away.get("team", {}).get("displayName", "Unknown")
            home_score = home.get("score", "0")
            away_score = away.get("score", "0")
            kickoff = competition.get("date", "TBD")

            doc_id = f"live-football-match-{event.get('id', '')}"

            has_real_score = home.get("score") not in (None, "", "0") or away.get("score") not in (None, "", "0")

            if state == "in":
                content = f"{home_name} vs {away_name} is currently LIVE in the {league_name} on {kickoff}. Current score: {home_name} {home_score} - {away_score} {away_name}."
            elif state == "post" and has_real_score:
                content = f"{home_name} vs {away_name} in the {league_name} has FINISHED (played on {kickoff}). Final score: {home_name} {home_score} - {away_score} {away_name}."
            elif state == "post" and not has_real_score:
                content = f"{home_name} vs {away_name} in the {league_name} is marked as completed on {kickoff}, but the final score is not available in this data."
            else:
                content = f"{home_name} vs {away_name} is scheduled (upcoming) in the {league_name}. Kick-off: {kickoff}."

            # for live/finished matches, append goal scorers + cards. Uses the
            # scoreboard 'details' already fetched (no extra API call); safely
            # no-ops if that data isn't present for this match/league.
            if state in ("in", "post"):
                content += extract_match_events(competition)

            docs.append({
                "id": doc_id,
                "sport": "football",
                "category": "live-match",
                "title": f"{home_name} vs {away_name} — {league_name}",
                "content": content,
                "source": "espn.com",
                "last_updated": datetime.utcnow().isoformat()
            })
        except Exception as e:
            print(f"  Error parsing match event: {e}")
    return docs


def build_next_match_summary(scoreboard_data, league_name, league_slug):
    """Finds the soonest upcoming (state == 'pre') match. Groups all matches
    sharing that soonest date together."""
    if not scoreboard_data:
        return None

    upcoming = []
    for event in scoreboard_data.get("events", []):
        try:
            competition = event.get("competitions", [{}])[0]
            competitors = competition.get("competitors", [])
            status_type = competition.get("status", {}).get("type", {})
            state = status_type.get("state", "pre")
            if state != "pre":
                continue

            home = next((c for c in competitors if c.get("homeAway") == "home"), {})
            away = next((c for c in competitors if c.get("homeAway") == "away"), {})
            game_date = competition.get("date") or ""
            if not game_date:
                continue

            upcoming.append({
                "date": game_date,
                "home": home.get("team", {}).get("displayName", "Unknown"),
                "away": away.get("team", {}).get("displayName", "Unknown"),
            })
        except Exception as e:
            print(f"  Error scanning event for next match: {e}")

    if not upcoming:
        return None

    soonest_date = min(g["date"] for g in upcoming)
    next_matches = [g for g in upcoming if g["date"] == soonest_date]

    lines = [f"{g['away']} vs {g['home']}" for g in next_matches]
    content = (
        f"The next upcoming {league_name} match(es) are scheduled for {soonest_date}:\n"
        + "\n".join(lines)
    )

    return {
        "id": f"live-football-next-match-{_safe_id(league_slug)}",
        "sport": "football",
        "category": "live-match",
        "title": f"{league_name} — Next Match",
        "content": content,
        "source": "espn.com",
        "last_updated": datetime.utcnow().isoformat()
    }


# ── STANDINGS ──────────────────────────────────────────────
def fetch_standings(league_slug):
    return _get(f"{STANDINGS_BASE}/{league_slug}/standings")


def _stat(stats_list, *names):
    for name in names:
        for s in stats_list:
            if s.get("name") == name or s.get("abbreviation") == name:
                val = s.get("value")
                if val is not None:
                    return val
    return None


def parse_standings(data, league_name, league_slug):
    if not data:
        return []
    rows = []
    children = data.get("children", [])
    entry_lists = []
    if children:
        for child in children:
            entry_lists.append(child.get("standings", {}).get("entries", []))
    else:
        entry_lists.append(data.get("standings", {}).get("entries", []))

    for entries in entry_lists:
        for entry in entries:
            stats = entry.get("stats", [])
            team = entry.get("team", {})
            rows.append({
                "rank": _stat(stats, "rank") or 0,
                "team": team.get("displayName", "Unknown"),
                "points": _stat(stats, "points") or 0,
                "played": _stat(stats, "gamesPlayed") or 0,
                "wins": _stat(stats, "wins") or 0,
                "losses": _stat(stats, "losses") or 0,
            })

    if not rows:
        return []

    rows.sort(key=lambda r: r["rank"] if r["rank"] else 999)
    top_rows = rows[:10]

    table_lines = [
        f"{r['rank']}. {r['team']} — {r['points']} pts (Played: {r['played']}, W: {r['wins']}, L: {r['losses']})"
        for r in top_rows
    ]
    content = f"Current {league_name} standings (top {len(top_rows)}):\n" + "\n".join(table_lines)

    return [{
        "id": f"live-football-standings-{_safe_id(league_slug)}",
        "sport": "football",
        "category": "live-standings",
        "title": f"{league_name} — League Standings",
        "content": content,
        "source": "espn.com",
        "last_updated": datetime.utcnow().isoformat()
    }]


# ── LEADERS (TOP SCORERS) ──────────────────────────────────
def fetch_leaders(league_slug):
    year = datetime.utcnow().year
    return _get(f"https://sports.core.api.espn.com/v2/sports/soccer/leagues/{league_slug}/seasons/{year}/types/2/leaders")


def _resolve_name(ref_url):
    if not ref_url:
        return "Unknown"
    data = _get(ref_url)
    if not data:
        return "Unknown"
    return data.get("displayName") or data.get("shortName") or data.get("name") or "Unknown"


def parse_leaders(data, league_name, league_slug):
    if not data:
        return []
    categories = data.get("categories", [])
    if not categories:
        return []

    goal_cat = None
    for cat in categories:
        name = (cat.get("displayName") or cat.get("name") or "").lower()
        if "goal" in name:
            goal_cat = cat
            break
    if goal_cat is None:
        goal_cat = categories[0]

    leaders = goal_cat.get("leaders", [])
    if not leaders:
        return []

    lines = []
    for i, leader in enumerate(leaders[:5]):
        athlete_ref = leader.get("athlete", {}).get("$ref")
        team_ref = leader.get("team", {}).get("$ref")
        athlete_name = _resolve_name(athlete_ref)
        team_name = _resolve_name(team_ref)
        value = leader.get("displayValue", "")
        lines.append(f"{i+1}. {athlete_name} ({team_name}) — {value}")

    if not lines:
        return []

    category_label = goal_cat.get("displayName", "Leaders")
    content = f"Current {league_name} {category_label} leaders:\n" + "\n".join(lines)

    return [{
        "id": f"live-football-leaders-{_safe_id(league_slug)}",
        "sport": "football",
        "category": "live-leaders",
        "title": f"{league_name} — Top Scorers",
        "content": content,
        "source": "espn.com",
        "last_updated": datetime.utcnow().isoformat()
    }]


# ── UPLOAD ─────────────────────────────────────────────────
def upload_to_search(docs):
    if not docs:
        return
    # batch at <=500 (Azure Search caps a single upload batch at 1000 docs).
    for _i in range(0, len(docs), 500):
        _chunk = docs[_i:_i + 500]
        try:
            search_client.upload_documents(documents=_chunk)
            print(f"  Uploaded {len(_chunk)} live documents")
        except Exception as _e:
            print(f"  Upload error: {_e}")


# ── PRUNING ────────────────────────────────────────────────
def prune_stale(sport, category, fresh_ids):
    """Delete docs of this sport+category that are no longer current (injuries
    that resolved, news/transactions that rolled off, and — as of this fix —
    finished matches that aged out of ESPN's scoreboard window) so 'live' data
    stays live and the index doesn't grow without bound. Skips pruning when we
    got no fresh data, to avoid wiping a category on a transient fetch failure.

    CHANGED: now paginates through ALL existing docs instead of only the first
    1000. The old top=1000 cap meant that once a category exceeded 1000 docs,
    stale docs beyond that window were never seen and never pruned — which let
    old 'currently LIVE' match docs survive indefinitely and made the RAG report
    finished matches as live. Paging in 1000-doc batches removes that ceiling.
    """
    if not fresh_ids:
        return
    try:
        stale = []
        skip = 0
        PAGE = 1000
        while True:
            batch = list(search_client.search(
                search_text="*",
                filter=f"sport eq '{sport}' and category eq '{category}'",
                select=["id"], top=PAGE, skip=skip))
            if not batch:
                break
            stale.extend({"id": r["id"]} for r in batch if r["id"] not in fresh_ids)
            if len(batch) < PAGE:
                break
            skip += PAGE
            # Azure Search hard-caps $skip at 100000; stop well before that.
            if skip >= 100000:
                break
        if stale:
            # delete in batches of 1000 (Azure Search per-request cap)
            for _i in range(0, len(stale), 1000):
                search_client.delete_documents(documents=stale[_i:_i + 1000])
            print(f"  Pruned {len(stale)} stale {category} docs ({sport})")
    except Exception as e:
        print(f"  Prune error ({sport}/{category}): {e}")


# ── MAIN LOOP ──────────────────────────────────────────────
def run():
    print("Live updater started! Fetching every 60 seconds...")
    while True:
        try:
            print(f"\n[{datetime.utcnow().strftime('%H:%M:%S')}] Fetching live data...")
            all_docs = []

            for slug, name in LEAGUES.items():
                scoreboard_data = fetch_scoreboard(slug)
                match_docs = parse_matches(scoreboard_data, name)
                all_docs.extend(match_docs)

                next_match_doc = build_next_match_summary(scoreboard_data, name, slug)
                if next_match_doc:
                    all_docs.append(next_match_doc)

                standings_data = fetch_standings(slug)
                standings_docs = parse_standings(standings_data, name, slug)
                all_docs.extend(standings_docs)

                leaders_data = fetch_leaders(slug)
                leaders_docs = parse_leaders(leaders_data, name, slug)
                all_docs.extend(leaders_docs)

                print(f"  {name}: {len(match_docs)} matches, {len(standings_docs)} standings, {len(leaders_docs)} leaders")

            # injuries / transactions / news for the MAJOR leagues only (via the
            # backend REST API). Bounded set + defensive parsing so it can't
            # overload the backend or crash the loop.
            for slug, name in MAJOR_LEAGUES.items():
                inj = parse_injuries(fetch_backend(f"/{slug}/injuries"), name, slug)
                txn = parse_transactions(fetch_backend(f"/{slug}/transactions?limit=25"), name, slug)
                nws = parse_news(fetch_backend(f"/{slug}/news?limit=15"), name, slug)
                all_docs.extend(inj)
                all_docs.extend(txn)
                all_docs.extend(nws)
                if inj or txn or nws:
                    print(f"  {name} extras: {len(inj)} injuries, {len(txn)} transactions, {len(nws)} news")

            # CHANGED: added "live-match" to the prune list. Previously only injuries/
            # transactions/news were pruned, so finished matches that aged out of ESPN's
            # scoreboard window kept their old "currently LIVE" doc in the index forever,
            # and the RAG reported them as live (confirmed: Wolves vs Blackburn showed FT
            # on the backend but the assistant still called it live). Pruning any
            # live-match doc NOT regenerated this cycle deletes those stale docs. Every
            # doc we WANT to keep (live matches, recently-finished still in the fetch
            # window, and the per-league "next match" summaries) is regenerated every
            # cycle and so is in all_docs / fresh_ids — only genuinely stale docs get
            # removed. NOTE: prune runs BEFORE upload; fresh docs are written right after,
            # so nothing current is lost. Do not reorder these two calls.
            for _cat in ("live-match", "live-injury", "live-transaction", "live-news",):
                _fresh = {d["id"] for d in all_docs if d.get("category") == _cat}
                prune_stale("football", _cat, _fresh)

            upload_to_search(all_docs)
            print(f"  Total: {len(all_docs)} documents uploaded. Next update in 60 seconds...")
        except Exception as _cycle_err:
            print(f"  Cycle error: {_cycle_err}")
        time.sleep(60)


if __name__ == "__main__":
    run()