"""
baseball_live_updater.py — Fetches live baseball data from ESPN every 60
seconds and uploads it to Azure AI Search so RAG can answer live questions.
Mirrors live_updater.py (football) / basketball_live_updater.py, pointed at
baseball's ESPN endpoints. Reuses the shared football-live-index (same
workaround basketball uses) since Azure's free tier caps index count at 3.
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
INDEX_NAME      = "football-live-index"  # shared — see module docstring

SITE_BASE      = "https://site.web.api.espn.com/apis/site/v2/sports/baseball"
STANDINGS_BASE = "https://site.web.api.espn.com/apis/v2/sports/baseball"

LEAGUES = {
    "mlb":             "MLB",
    "college-baseball": "NCAA Baseball",
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
            if len(_CACHE) > 500:
                for k in [k for k, v in _CACHE.items() if v[0] <= now]:
                    _CACHE.pop(k, None)
            return data
    except Exception as e:
        print(f"  Error fetching {url}: {e}")
    return None


# ── SCOREBOARD ────────────────────────────────────────────
def fetch_scoreboard(league_slug):
    today = datetime.utcnow()
    date_from = (today - timedelta(days=7)).strftime("%Y%m%d")
    date_to = (today + timedelta(days=45)).strftime("%Y%m%d")
    url = f"{SITE_BASE}/{league_slug}/scoreboard?dates={date_from}-{date_to}&limit=1000"
    return _get(url)


def parse_games(data, league_name):
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
            game_date = competition.get("date", "TBD")

            doc_id = f"live-baseball-match-{event.get('id', '')}"

            has_real_score = home.get("score") not in (None, "", "0") or away.get("score") not in (None, "", "0")

            if state == "in":
                inning_info = status_type.get("detail", "")
                content = f"{away_name} vs {home_name} is currently LIVE in {league_name} on {game_date} ({inning_info}). Current score: {away_name} {away_score} - {home_score} {home_name}."
            elif state == "post" and has_real_score:
                content = f"{away_name} vs {home_name} in {league_name} has FINISHED (played on {game_date}). Final score: {away_name} {away_score} - {home_score} {home_name}."
            elif state == "post" and not has_real_score:
                content = f"{away_name} vs {home_name} in {league_name} is marked as completed on {game_date}, but the final score is not available in this data."
            else:
                content = f"{away_name} vs {home_name} is scheduled (upcoming) in {league_name}. First pitch: {game_date}."

            docs.append({
                "id": doc_id,
                "sport": "baseball",
                "category": "live-match",
                "title": f"{away_name} vs {home_name} — {league_name}",
                "content": content,
                "source": "espn.com",
                "last_updated": datetime.utcnow().isoformat()
            })
        except Exception as e:
            print(f"  Error parsing game event: {e}")
    return docs


def build_live_now_summary(scoreboard_data, league_name, league_slug):
    """One doc that explicitly lists every game currently in progress."""
    if not scoreboard_data:
        return None
    live = []
    for event in scoreboard_data.get("events", []):
        try:
            competition = event.get("competitions", [{}])[0]
            status_type = competition.get("status", {}).get("type", {})
            if status_type.get("state") != "in":
                continue
            competitors = competition.get("competitors", [])
            home = next((c for c in competitors if c.get("homeAway") == "home"), {})
            away = next((c for c in competitors if c.get("homeAway") == "away"), {})
            live.append({
                "home": home.get("team", {}).get("displayName", "Unknown"),
                "away": away.get("team", {}).get("displayName", "Unknown"),
                "home_score": home.get("score", "0"),
                "away_score": away.get("score", "0"),
                "detail": status_type.get("detail", ""),
            })
        except Exception as e:
            print(f"  Error scanning game for live-now: {e}")
    if not live:
        return None
    lines = [f"{g['away']} {g['away_score']} - {g['home_score']} {g['home']} ({g['detail']})" for g in live]
    content = (
        f"There are {len(live)} {league_name} games LIVE and in progress right now:\n"
        + "\n".join(lines)
    )
    return {
        "id": f"live-baseball-live-now-{_safe_id(league_slug)}",
        "sport": "baseball",
        "category": "live-match",
        "title": f"{league_name} — Live Now (In Progress)",
        "content": content,
        "source": "espn.com",
        "last_updated": datetime.utcnow().isoformat()
    }


def build_latest_results_summary(scoreboard_data, league_name, league_slug):
    """Groups completed games from the most recent date into one doc."""
    if not scoreboard_data:
        return None
    completed = []
    for event in scoreboard_data.get("events", []):
        try:
            competition = event.get("competitions", [{}])[0]
            competitors = competition.get("competitors", [])
            status_type = competition.get("status", {}).get("type", {})
            state = status_type.get("state", "pre")
            if state != "post":
                continue
            home = next((c for c in competitors if c.get("homeAway") == "home"), {})
            away = next((c for c in competitors if c.get("homeAway") == "away"), {})
            home_score = home.get("score")
            away_score = away.get("score")
            if home_score in (None, "") or away_score in (None, ""):
                continue
            game_date = (competition.get("date") or "")[:10]
            completed.append({
                "date": game_date,
                "home": home.get("team", {}).get("displayName", "Unknown"),
                "away": away.get("team", {}).get("displayName", "Unknown"),
                "home_score": home_score,
                "away_score": away_score,
            })
        except Exception as e:
            print(f"  Error scanning game for latest results: {e}")
    if not completed:
        return None
    most_recent_date = max(g["date"] for g in completed)
    latest_games = [g for g in completed if g["date"] == most_recent_date]
    lines = [f"{g['away']} {g['away_score']}, {g['home']} {g['home_score']}" for g in latest_games]
    content = (
        f"The latest and most recent completed {league_name} results are from {most_recent_date}:\n"
        + "\n".join(lines)
    )
    return {
        "id": f"live-baseball-latest-results-{_safe_id(league_slug)}",
        "sport": "baseball",
        "category": "live-match",
        "title": f"{league_name} — Latest Results",
        "content": content,
        "source": "espn.com",
        "last_updated": datetime.utcnow().isoformat()
    }


def build_next_game_summary(scoreboard_data, league_name, league_slug):
    """Finds the soonest upcoming (state == 'pre') game(s)."""
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
            print(f"  Error scanning game for next game: {e}")
    if not upcoming:
        return None
    soonest_date = min(g["date"] for g in upcoming)
    next_games = [g for g in upcoming if g["date"] == soonest_date]
    lines = [f"{g['away']} at {g['home']}" for g in next_games]
    content = (
        f"The next upcoming {league_name} game(s) are scheduled for {soonest_date}:\n"
        + "\n".join(lines)
    )
    return {
        "id": f"live-baseball-next-game-{_safe_id(league_slug)}",
        "sport": "baseball",
        "category": "live-match",
        "title": f"{league_name} — Next Game",
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
                "rank": _stat(stats, "playoffSeed", "rank") or 0,
                "team": team.get("displayName", "Unknown"),
                "wins": _stat(stats, "wins") or 0,
                "losses": _stat(stats, "losses") or 0,
                "pct": _stat(stats, "winPercent") or 0,
                "gb": _stat(stats, "gamesBehind") or "-",
            })
    if not rows:
        return []
    rows.sort(key=lambda r: r["rank"] if r["rank"] else 999)
    top_rows = rows[:10]
    table_lines = [
        f"{r['rank']}. {r['team']} — {r['wins']}-{r['losses']} (GB: {r['gb']})"
        for r in top_rows
    ]
    content = f"Current {league_name} standings (top {len(top_rows)}):\n" + "\n".join(table_lines)
    return [{
        "id": f"live-baseball-standings-{_safe_id(league_slug)}",
        "sport": "baseball",
        "category": "live-standings",
        "title": f"{league_name} — Standings",
        "content": content,
        "source": "espn.com",
        "last_updated": datetime.utcnow().isoformat()
    }]


# ── LEADERS ─────────────────────────────────────────────────
def fetch_leaders(league_slug):
    year = datetime.utcnow().year
    url = (
        f"https://site.web.api.espn.com/apis/common/v3/sports/baseball/{league_slug}"
        f"/statistics/byathlete?category=batting&sort=batting.homeRuns:desc"
        f"&season={year}&seasontype=2&limit=10"
    )
    return _get(url)

def parse_leaders(data, league_name, league_slug):
    if not data:
        return []
    athletes = data.get("athletes", [])
    if not athletes:
        return []
    lines = []
    for i, entry in enumerate(athletes[:10]):
        athlete = entry.get("athlete", {})
        name = athlete.get("displayName", "Unknown")
        team = athlete.get("teamName", "")
        categories = entry.get("categories", [])
        batting = next((c for c in categories if c.get("name") == "batting"), None)
        if not batting:
            continue
        totals = batting.get("totals", [])
        home_runs = totals[7] if len(totals) > 7 else "?"  # index 7 = HR in ESPN's fixed column order
        lines.append(f"{i+1}. {name} ({team}) — {home_runs} HR")
    if not lines:
        return []
    content = f"Current {league_name} home run leaders:\n" + "\n".join(lines)
    return [{
        "id": f"live-baseball-leaders-{_safe_id(league_slug)}",
        "sport": "baseball",
        "category": "live-leaders",
        "title": f"{league_name} — Home Run Leaders",
        "content": content,
        "source": "espn.com",
        "last_updated": datetime.utcnow().isoformat()
    }]


# ── UPLOAD ─────────────────────────────────────────────────
def upload_to_search(docs):
    if not docs:
        return
    for _i in range(0, len(docs), 500):
        _chunk = docs[_i:_i + 500]
        try:
            search_client.upload_documents(documents=_chunk)
            print(f"  Uploaded {len(_chunk)} live documents")
        except Exception as _e:
            print(f"  Upload error: {_e}")


# -- EXTRA LIVE DATA via the SportScore backend REST API --------------
BACKEND_URL = os.getenv("BACKEND_URL", "https://sportscore-backend-ecaue6buc5bwf7at.northeurope-01.azurewebsites.net").rstrip("/")
MAJOR_LEAGUES = {"mlb": "MLB"}

def _safe_id(s):
    # ASCII-only: accented letters (á, é, ñ, ...) are NOT allowed in Azure
    # Search keys and would reject the whole upload batch, so map them to '-'.
    return ("".join(
        c if (c.isascii() and c.isalnum()) or c in "-_=" else "-"
        for c in str(s)
    )[:120]) or "x"

def fetch_backend(path):
    try:
        url = f"{BACKEND_URL}/api/baseball{path}"
        r = requests.get(url, headers={"User-Agent": "SportScore-Updater/1.0"}, timeout=15)
        return r.json() if r.status_code == 200 else None
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
            docs.append({
                "id": _safe_id(f"live-baseball-injury-{slug}-{it.get('athleteId') or name}"),
                "sport": "baseball", "category": "live-injury",
                "title": f"{name} injury - {team} ({league_name})",
                "content": f"Injury update ({league_name}): {name} ({team}) - status: {status}. {comment}".strip(),
                "source": "espn.com", "last_updated": datetime.utcnow().isoformat(),
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
            docs.append({
                "id": _safe_id(f"live-baseball-transaction-{slug}-{it.get('id') or desc[:40]}"),
                "sport": "baseball", "category": "live-transaction",
                "title": f"Transaction - {team} ({league_name})",
                "content": f"Transaction ({league_name}): {desc} - {team} ({date}).".strip(),
                "source": "espn.com", "last_updated": datetime.utcnow().isoformat(),
            })
        except Exception:
            continue
    return docs

def parse_news(items, league_name, slug):
    docs = []
    if not isinstance(items, list):
        return docs
    for it in items[:10]:
        try:
            headline = (it.get("headline") or "").strip()
            if not headline:
                continue
            desc = it.get("description") or ""
            published = it.get("published") or ""
            docs.append({
                "id": _safe_id(f"live-baseball-news-{slug}-{it.get('id') or headline[:40]}"),
                "sport": "baseball", "category": "live-news",
                "title": f"{headline} - {league_name}",
                "content": f"News ({league_name}): {headline}. {desc} (published {published})".strip(),
                "source": "espn.com", "last_updated": datetime.utcnow().isoformat(),
            })
        except Exception:
            continue
    return docs


def prune_stale(sport, category, fresh_ids):
    """Delete docs of this sport+category that are no longer current so 'live'
    data stays live and the index doesn't grow without bound. Skips pruning when
    we got no fresh data, to avoid wiping a category on a transient fetch failure.

    CHANGED: paginates through ALL existing docs instead of only the first 1000.
    The old top=1000 cap left stale docs beyond that window unpruned, which let
    old 'currently LIVE' match docs survive and made the RAG report finished
    games as live.
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
            if skip >= 100000:  # Azure Search hard-caps $skip at 100000
                break
        if stale:
            for _i in range(0, len(stale), 1000):
                search_client.delete_documents(documents=stale[_i:_i + 1000])
            print(f"  Pruned {len(stale)} stale {category} docs ({sport})")
    except Exception as e:
        print(f"  Prune error ({sport}/{category}): {e}")


# ── MAIN LOOP ──────────────────────────────────────────────
def run():
    print("Baseball live updater started! Fetching every 60 seconds...")
    while True:
        try:
            print(f"\n[{datetime.utcnow().strftime('%H:%M:%S')}] Fetching live baseball data...")
            all_docs = []
            for slug, name in LEAGUES.items():
                scoreboard_data = fetch_scoreboard(slug)
                if not scoreboard_data:
                    # CHANGED: actually skip this league on fetch failure. The old code
                    # computed an unused 'states' var and printed "skipping" but kept going,
                    # building summaries from empty data. Now it genuinely skips.
                    print(f"  WARNING: scoreboard fetch failed for {slug}, skipping this cycle")
                    continue
                game_docs = parse_games(scoreboard_data, name)
                all_docs.extend(game_docs)
                live_now_doc = build_live_now_summary(scoreboard_data, name, slug)
                if live_now_doc:
                    all_docs.append(live_now_doc)
                next_game_doc = build_next_game_summary(scoreboard_data, name, slug)
                if next_game_doc:
                    all_docs.append(next_game_doc)
                latest_results_doc = build_latest_results_summary(scoreboard_data, name, slug)
                if latest_results_doc:
                    all_docs.append(latest_results_doc)
                standings_data = fetch_standings(slug)
                standings_docs = parse_standings(standings_data, name, slug)
                all_docs.extend(standings_docs)
                leaders_data = fetch_leaders(slug)
                leaders_docs = parse_leaders(leaders_data, name, slug)
                all_docs.extend(leaders_docs)
                print(f"  {name}: {len(game_docs)} games, {1 if latest_results_doc else 0} latest-results summary, {len(standings_docs)} standings, {len(leaders_docs)} leaders")

            # injuries / transactions / news for MAJOR leagues only (via backend REST).
            for _slug, _name in MAJOR_LEAGUES.items():
                _inj = parse_injuries(fetch_backend(f"/{_slug}/injuries"), _name, _slug)
                _txn = parse_transactions(fetch_backend(f"/{_slug}/transactions?limit=25"), _name, _slug)
                _nws = parse_news(fetch_backend(f"/{_slug}/news?limit=15"), _name, _slug)
                all_docs.extend(_inj); all_docs.extend(_txn); all_docs.extend(_nws)
                if _inj or _txn or _nws:
                    print(f"  {_name} extras: {len(_inj)} injuries, {len(_txn)} transactions, {len(_nws)} news")

            # CHANGED: added "live-match" to the prune list. Same fix as football/basketball:
            # finished games aging out of ESPN's scoreboard window kept stale "currently LIVE"
            # docs, so the RAG reported them as live. Live games and the live-now / latest-results
            # / next-game summary docs are regenerated every cycle and stay in fresh_ids; only
            # stale docs are removed. Prune runs BEFORE upload — do not reorder.
            for _cat in ("live-match", "live-injury", "live-transaction", "live-news",):
                _fresh = {d["id"] for d in all_docs if d.get("category") == _cat}
                prune_stale("baseball", _cat, _fresh)

            upload_to_search(all_docs)
            print(f"  Total: {len(all_docs)} documents uploaded. Next update in 60 seconds...")
        except Exception as _cycle_err:
            print(f"  Cycle error: {_cycle_err}")
        time.sleep(60)  # gentler on ESPN/backend

if __name__ == "__main__":
    run()