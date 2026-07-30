"""
basketball_live_updater.py — Fetches live basketball data from ESPN every 30
seconds and uploads it to Azure AI Search so RAG can answer live questions.

Mirrors live_updater.py (football), pointed at basketball's ESPN endpoints.
Note: basketball's "leaders" data comes from the /statistics endpoint,
not /leaders like football uses.
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

SITE_BASE      = "https://site.api.espn.com/apis/site/v2/sports/basketball"
STANDINGS_BASE = "https://site.api.espn.com/apis/v2/sports/basketball"

LEAGUES = {
    "nba":                       "NBA",
    "nba-summer":                "NBA Summer League",
    "wnba":                      "WNBA",
    "mens-college-basketball":   "NCAA Men's Basketball",
    "womens-college-basketball": "NCAA Women's Basketball",
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


def parse_matches(data, league_name):
    docs = []
    if not data:
        return docs
    for event in data.get("events", []):
        try:
            competition = event.get("competitions", [{}])[0]
            competitors = competition.get("competitors", [])
            status_type = competition.get("status", {}).get("type", {})
            state = status_type.get("state", "pre")

            home = next((c for c in competitors if c.get("homeAway") == "home"), {})
            away = next((c for c in competitors if c.get("homeAway") == "away"), {})

            home_name = home.get("team", {}).get("displayName", "Unknown")
            away_name = away.get("team", {}).get("displayName", "Unknown")
            home_score = home.get("score", "0")
            away_score = away.get("score", "0")
            kickoff = competition.get("date", "TBD")

            doc_id = f"live-basketball-match-{event.get('id', '')}"

            has_real_score = home.get("score") not in (None, "", "0") or away.get("score") not in (None, "", "0")

            if state == "in":
                content = f"{home_name} vs {away_name} is currently LIVE in the {league_name}. Current score: {home_name} {home_score} - {away_score} {away_name}."
            elif state == "post" and has_real_score:
                content = f"{home_name} vs {away_name} in the {league_name} has FINISHED (played on {kickoff}). Final score: {home_name} {home_score} - {away_score} {away_name}."
            elif state == "post" and not has_real_score:
                # ESPN marked this as finished but didn't supply real score
                # data — likely a postponed/cancelled game or a data gap.
                # Don't assert a fabricated-looking 0-0 result.
                content = f"{home_name} vs {away_name} in the {league_name} is marked as completed on {kickoff}, but the final score is not available in this data."
            else:
                content = f"{home_name} vs {away_name} is scheduled (upcoming) in the {league_name}. Tip-off: {kickoff}."

            docs.append({
                "id": doc_id,
                "sport": "basketball",
                "category": "live-match",
                "title": f"{home_name} vs {away_name} — {league_name}",
                "content": content,
                "source": "espn.com",
                "last_updated": datetime.utcnow().isoformat()
            })
        except Exception as e:
            print(f"  Error parsing match event: {e}")
    return docs

def build_latest_results_summary(scoreboard_data, league_name, league_slug):
    """Same fix as baseball's build_latest_results_summary() and F1's
    build_latest_race_summary() — groups completed games from the most
    recent date into one doc with 'latest'/'most recent' explicitly
    written in, so vague queries have something to match against."""
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
        "id": f"live-basketball-latest-results-{_safe_id(league_slug)}",
        "sport": "basketball",
        "category": "live-match",
        "title": f"{league_name} — Latest Results",
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
                "rank": _stat(stats, "rank", "playoffSeed") or 0,
                "team": team.get("displayName", "Unknown"),
                "wins": _stat(stats, "wins") or 0,
                "losses": _stat(stats, "losses") or 0,
                "winpct": _stat(stats, "winPercent", "winpercent") or 0,
            })

    if not rows:
        return []

    rows.sort(key=lambda r: r["rank"] if r["rank"] else 999)
    top_rows = rows[:15]

    table_lines = [
        f"{r['rank']}. {r['team']} — {r['wins']}-{r['losses']} (Win%: {r['winpct']})"
        for r in top_rows
    ]
    content = f"Current {league_name} standings (top {len(top_rows)}):\n" + "\n".join(table_lines)

    return [{
        "id": f"live-basketball-standings-{_safe_id(league_slug)}",
        "sport": "basketball",
        "category": "live-standings",
        "title": f"{league_name} — Standings",
        "content": content,
        "source": "espn.com",
        "last_updated": datetime.utcnow().isoformat()
    }]


# ── LEADERS (TOP SCORERS) — note: /statistics endpoint, not /leaders ───────
def fetch_leaders(league_slug):
    year = datetime.utcnow().year
    url = (
        f"https://site.web.api.espn.com/apis/common/v3/sports/basketball/{league_slug}"
        f"/statistics/byathlete?isqualified=true&sort=offensive.avgPoints:desc"
        f"&season={year}&limit=10"
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
        # Find whichever category holds points-per-game — name may vary
        # (e.g. "offensive", "general") so scan for the right one rather
        # than assume "batting"-style fixed naming like baseball has.
        offensive = next((c for c in categories if "offensive" in (c.get("name") or "").lower()), None)
        if not offensive:
            offensive = categories[0] if categories else None
        if not offensive:
            continue
        totals = offensive.get("totals", [])
        # NOTE: unverified index — print(totals) on first real run to find
        # which position holds points-per-game, then adjust this index.
        ppg = totals[0] if totals else "?"
        lines.append(f"{i+1}. {name} ({team}) — {ppg} PPG")

    if not lines:
        return []

    content = f"Current {league_name} scoring leaders:\n" + "\n".join(lines)

    return [{
        "id": f"live-basketball-leaders-{_safe_id(league_slug)}",
        "sport": "basketball",
        "category": "live-leaders",
        "title": f"{league_name} — Scoring Leaders",
        "content": content,
        "source": "espn.com",
        "last_updated": datetime.utcnow().isoformat()
    }]

# ── UPLOAD ─────────────────────────────────────────────────
def upload_to_search(docs):
    if not docs:
        return
    try:
        result = search_client.upload_documents(documents=docs)
        failed = [r.key for r in result if not r.succeeded]
        if failed:
            print(f"  WARNING: {len(failed)} documents failed: {failed}")
        print(f"  Uploaded {len(docs)} live documents")
    except Exception as e:
        print(f"  Upload error: {e}")


# ── MAIN LOOP ──────────────────────────────────────────────
def run():
    print("Basketball live updater started! Fetching every 30 seconds...")
    while True:
        print(f"\n[{datetime.utcnow().strftime('%H:%M:%S')}] Fetching live basketball data...")
        all_docs = []

        for slug, name in LEAGUES.items():
            scoreboard_data = fetch_scoreboard(slug)
            match_docs = parse_matches(scoreboard_data, name)
            all_docs.extend(match_docs)

            latest_results_doc = build_latest_results_summary(scoreboard_data, name, slug)
            if latest_results_doc:
                all_docs.append(latest_results_doc)

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