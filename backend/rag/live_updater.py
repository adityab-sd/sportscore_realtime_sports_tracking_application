"""
live_updater.py — Fetches live football data from ESPN every 30 seconds
and uploads it to Azure AI Search so RAG can answer live questions.

Pulls three kinds of data per league, directly from ESPN's public API:
  1. Scoreboard — current/upcoming matches
  2. Standings  — league table (rank, points, wins/losses)
  3. Leaders    — top scorers
"""

import os
import time
import requests
from datetime import datetime
from azure.search.documents import SearchClient
from azure.core.credentials import AzureKeyCredential
from dotenv import load_dotenv

load_dotenv()

SEARCH_ENDPOINT = os.getenv("AZURE_SEARCH_ENDPOINT")
SEARCH_API_KEY  = os.getenv("AZURE_SEARCH_KEY")
INDEX_NAME      = "football-live-index"

SITE_BASE      = "https://site.api.espn.com/apis/site/v2/sports/soccer"
STANDINGS_BASE = "https://site.api.espn.com/apis/v2/sports/soccer"

LEAGUES = {
    "fifa.world":        "World Cup 2026",
    "fifa.friendly":     "International Friendly",
    "uefa.champions":    "Champions League",
    "uefa.europa":       "Europa League",
    "uefa.europa.conf":  "Conference League",
    "eng.1":             "Premier League",
    "eng.2":             "Championship",
    "esp.1":             "La Liga",
    "ita.1":             "Serie A",
    "ger.1":             "Bundesliga",
    "fra.1":             "Ligue 1",
    "usa.1":             "MLS",
    "bra.1":             "Brazil Serie A",
    "ned.1":             "Eredivisie",
    "por.1":             "Primeira Liga",
    "mex.1":             "Liga MX",
    "arg.1":             "Argentina Primera",
    "jpn.1":             "J-League",
    "aus.1":             "A-League",
}

credential = AzureKeyCredential(SEARCH_API_KEY)
search_client = SearchClient(
    endpoint=SEARCH_ENDPOINT,
    index_name=INDEX_NAME,
    credential=credential
)


def _safe_id(text):
    """Azure Search document keys can't contain periods (or other special
    chars) — league slugs like 'fifa.world' or 'uefa.champions' need
    sanitizing before being used as part of a document id."""
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
    from datetime import timedelta
    today = datetime.utcnow()
    date_from = (today - timedelta(days=21)).strftime("%Y%m%d")
    date_to = (today + timedelta(days=21)).strftime("%Y%m%d")
    url = f"{SITE_BASE}/{league_slug}/scoreboard?dates={date_from}-{date_to}&limit=200"
    return _get(url)


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

            if state == "in":
                content = f"{home_name} vs {away_name} is currently LIVE in the {league_name}. Current score: {home_name} {home_score} - {away_score} {away_name}."
            elif state == "post":
                content = f"{home_name} vs {away_name} in the {league_name} has FINISHED (played on {kickoff}). Final score: {home_name} {home_score} - {away_score} {away_name}."
            else:  # "pre" — not yet played
                content = f"{home_name} vs {away_name} is scheduled (upcoming) in the {league_name}. Kickoff: {kickoff}."

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
    return _get(f"{SITE_BASE}/{league_slug}/leaders")


def parse_leaders(data, league_name, league_slug):
    if not data:
        return []
    categories = data.get("categories", [])
    if not categories:
        return []

    goal_cat = None
    for cat in categories:
        name = (cat.get("displayName") or cat.get("name") or "").lower()
        if "goal" in name or "scor" in name:
            goal_cat = cat
            break
    if goal_cat is None:
        goal_cat = categories[0]

    leaders = goal_cat.get("leaders", [])
    if not leaders:
        return []

    lines = []
    for i, leader in enumerate(leaders[:10]):
        athlete_name = leader.get("athlete", {}).get("displayName", "Unknown")
        team_name = leader.get("team", {}).get("displayName", "")
        value = leader.get("displayValue", leader.get("value", ""))
        lines.append(f"{i+1}. {athlete_name} ({team_name}) — {value}")

    if not lines:
        return []

    category_label = goal_cat.get("displayName", goal_cat.get("name", "Leaders"))
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
    try:
        search_client.upload_documents(documents=docs)
        print(f"  Uploaded {len(docs)} live documents")
    except Exception as e:
        print(f"  Upload error: {e}")


# ── MAIN LOOP ──────────────────────────────────────────────
def run():
    print("Live updater started! Fetching every 30 seconds...")
    while True:
        print(f"\n[{datetime.utcnow().strftime('%H:%M:%S')}] Fetching live data...")
        all_docs = []

        for slug, name in LEAGUES.items():
            scoreboard_data = fetch_scoreboard(slug)
            match_docs = parse_matches(scoreboard_data, name)
            all_docs.extend(match_docs)

            standings_data = fetch_standings(slug)
            standings_docs = parse_standings(standings_data, name, slug)
            all_docs.extend(standings_docs)

            leaders_data = fetch_leaders(slug)
            leaders_docs = parse_leaders(leaders_data, name, slug)
            all_docs.extend(leaders_docs)

            print(f"  {name}: {len(match_docs)} matches, {len(standings_docs)} standings, {len(leaders_docs)} leaders")

        upload_to_search(all_docs)
        print(f"  Total: {len(all_docs)} documents uploaded. Next update in 30 seconds...")
        time.sleep(30)


if __name__ == "__main__":
    run()