"""
baseball_live_updater.py — Fetches live baseball data from ESPN every 30
seconds and uploads it to Azure AI Search so RAG can answer live questions.

Mirrors live_updater.py (football) / basketball_live_updater.py, pointed at
baseball's ESPN endpoints. Reuses the shared football-live-index (same
workaround basketball uses) since Azure's free tier caps index count at 3.

NOTE: baseball's stat-leaders endpoint structure is different from
football's /leaders and basketball's /statistics — this uses a best-effort
attempt at /leaders first. Test this against real output and adjust if
leader data comes back empty (see docstring note in basketball_live_updater.py
for the same lesson learned there).
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

SITE_BASE      = "https://site.api.espn.com/apis/site/v2/sports/baseball"
STANDINGS_BASE = "https://site.api.espn.com/apis/v2/sports/baseball"

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


def _safe_id(text):
    return text.replace(".", "-")


def _get(url):
    try:
        response = requests.get(url, headers={"User-Agent": "SportScore/1.0"}, timeout=10)
        if response.status_code == 200:
            return response.json()
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

def build_latest_results_summary(scoreboard_data, league_name, league_slug):
    """Groups every completed (state == 'post') game from the most
    recent date that has finished games into ONE synthetic summary doc,
    with 'latest'/'most recent' explicitly in the content — so vague
    queries have something reliable to match against."""
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
    """Mirrors football's build_next_match_summary() — finds the soonest
    upcoming (state == 'pre') game instead of the most recently completed
    one. Groups all games sharing that soonest date together, same
    reasoning as build_latest_results_summary()."""
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
# NEEDS EMPIRICAL VERIFICATION — baseball's leaders data may not live at
# the same /leaders path football uses. Run this, check the printed
# counts, and if leader_docs is always 0, swap fetch_leaders() to hit
# https://site.web.api.espn.com/apis/common/v3/sports/baseball/mlb/statistics/byathlete?category=batting&sort=batting.homeRuns:desc
# instead, and adjust parse_leaders() to match that response shape.
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
    try:
        search_client.upload_documents(documents=docs)
        print(f"  Uploaded {len(docs)} live documents")
    except Exception as e:
        print(f"  Upload error: {e}")


# ── MAIN LOOP ──────────────────────────────────────────────
def run():
    print("Baseball live updater started! Fetching every 30 seconds...")
    while True:
        print(f"\n[{datetime.utcnow().strftime('%H:%M:%S')}] Fetching live baseball data...")
        all_docs = []

        for slug, name in LEAGUES.items():
            scoreboard_data = fetch_scoreboard(slug)
            game_docs = parse_games(scoreboard_data, name)
            all_docs.extend(game_docs)

            if slug == "mlb":
                states = [e.get("competitions", [{}])[0].get("status", {}).get("type", {}).get("state") for e in scoreboard_data.get("events", [])]
                from collections import Counter

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

        upload_to_search(all_docs)
        print(f"  Total: {len(all_docs)} documents uploaded. Next update in 30 seconds...")
        time.sleep(30)


if __name__ == "__main__":
    run()