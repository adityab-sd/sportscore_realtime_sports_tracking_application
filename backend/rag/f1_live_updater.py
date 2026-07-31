"""
f1_live_updater.py — Fetches live F1 data from ESPN every 30 seconds and
uploads it to Azure AI Search so RAG can answer live questions.

F1 is structurally different from football/basketball/baseball: it's not
team-vs-team, it's race weekends made of sessions (FP1/FP2/FP3/Qualifying/
Race), each session having a driver grid rather than two competitors. This
mirrors the parsing logic in backend/src/main/java/org/Spring/f1/api/
F1Service.java (the existing, working Java implementation) rather than
reusing the team-sport template — verified against real ESPN response shapes
rather than guessed.

Reuses the shared football-live-index (same workaround basketball/baseball
use) since Azure's free tier caps index count at 3. No league loop — F1 is
a single championship, unlike basketball's nba/wnba or baseball's mlb/
college-baseball.

NOTE: per F1Service.java's own comments, ESPN's site standings endpoint for
DRIVER standings is unreliable and often returns empty. Constructor
standings are more reliable but live on a different endpoint (the core
API), which needs a $ref chain to follow — not implemented here to keep
this script simple. If fetch_standings() below prints 0 for drivers, that's
expected; treat driver standings as a known gap rather than a bug to chase
immediately.
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
INDEX_NAME      = "football-live-index"  # shared — see module docstring

SITE = "https://site.api.espn.com/apis/site/v2/sports/racing/f1"

credential = AzureKeyCredential(SEARCH_API_KEY)
search_client = SearchClient(
    endpoint=SEARCH_ENDPOINT,
    index_name=INDEX_NAME,
    credential=credential
)


def _get(url):
    try:
        response = requests.get(url, headers={"User-Agent": "SportScore/1.0"}, timeout=10)
        if response.status_code == 200:
            return response.json()
    except Exception as e:
        print(f"  Error fetching {url}: {e}")
    return None


def _txt(node, *path):
    for key in path:
        if node is None:
            return None
        node = node.get(key) if isinstance(node, dict) else None
    return node


# ── SEASON EVENTS (all weekends, not just the nearest one) ────────────
def fetch_season_events():
    year = datetime.utcnow().year
    date_range = f"{year}0101-{year}1231"
    data = _get(f"{SITE}/scoreboard?dates={date_range}&limit=100")
    events = (data or {}).get("events", [])
    if events:
        return events
    # fall back to the plain scoreboard (nearest weekend only) if the
    # season-wide query comes back empty
    data = _get(f"{SITE}/scoreboard")
    return (data or {}).get("events", [])


# ── WEEKEND / SESSION PARSING ────────────────────────────────────────
def _pick_representative_session(sessions):
    """Mirrors CoreF1Adapter.java: prefer an in-progress session, else the
    next upcoming one, else the most recently completed one."""
    in_progress = [s for s in sessions if s.get("state") == "in"]
    if in_progress:
        return in_progress[0]
    upcoming = [s for s in sessions if s.get("state") == "pre"]
    if upcoming:
        return sorted(upcoming, key=lambda s: s.get("date") or "")[0]
    completed = [s for s in sessions if s.get("state") == "post"]
    if completed:
        return sorted(completed, key=lambda s: s.get("date") or "")[-1]
    return None


def parse_weekend(event):
    try:
        event_id = event.get("id", "")
        name = event.get("name") or event.get("shortName") or "Grand Prix"

        competitions = event.get("competitions", [])
        circuit_node = event.get("circuit") or (competitions[0].get("circuit") if competitions else {}) or {}
        circuit_name = circuit_node.get("fullName", "")
        address = circuit_node.get("address", {}) or {}
        city = address.get("city", "")
        country = address.get("country", "")

        sessions = []
        for comp in competitions:
            status_type = comp.get("status", {}).get("type", {})
            state = status_type.get("state", "pre")
            type_node = comp.get("type") or {}
            label = type_node.get("abbreviation") or type_node.get("text") or comp.get("name") or ""
            detail = status_type.get("shortDetail") or status_type.get("detail") or ""

            competitors = comp.get("competitors", [])
            competitors.sort(key=lambda c: c.get("order", 999))
            grid = []
            for c in competitors[:5]:  # top 5 is plenty for a summary
                athlete = c.get("athlete", {}) or {}
                driver_name = athlete.get("fullName") or athlete.get("displayName") or c.get("displayName") or "-"
                grid.append(driver_name)

            sessions.append({
                "state": state,
                "label": label,
                "detail": detail,
                "date": comp.get("date"),
                "grid": grid,
            })

        rep = _pick_representative_session(sessions)

        if rep is None:
            content = f"{name} at {circuit_name}, {city}, {country} — no session data available."
        elif rep["state"] == "in":
            top = ", ".join(rep["grid"][:3]) if rep["grid"] else "no live grid data"
            content = f"{name} ({circuit_name}, {city}, {country}) — {rep['label']} is LIVE right now on {rep.get('date', 'an unknown date')} ({rep['detail']}). Current top positions: {top}."
        elif rep["state"] == "post":
            top = ", ".join(rep["grid"][:3]) if rep["grid"] else "no result data"
            content = f"{name} ({circuit_name}, {city}, {country}) — {rep['label']} has FINISHED. Top finishers: {top}."
        else:
            content = f"{name} ({circuit_name}, {city}, {country}) — {rep['label']} is upcoming, scheduled for {rep.get('date', 'TBD')}."

        return {
            "id": f"live-f1-weekend-{event_id}",
            "sport": "f1",
            "category": "live-match",
            "title": f"{name} — {circuit_name}",
            "content": content,
            "source": "espn.com",
            "last_updated": datetime.utcnow().isoformat()
        }
    except Exception as e:
        print(f"  Error parsing weekend: {e}")
        return None

def build_latest_race_summary(events):
    """
    Scans every weekend's parsed sessions and finds whichever one's main
    'Race' session most recently finished, then builds a single synthetic
    summary doc with a FIXED id (so it's upserted/overwritten each cycle,
    never duplicated) explicitly containing the words 'latest' and 'most
    recent' — words no other live doc naturally contains — so vague
    queries like 'what is the latest F1 race result' have something to
    match against. See search_live_corpus()'s relevance-matching logic in
    search.py for why this was needed: LIVE_NOISE_WORDS strips 'result',
    and generic queries otherwise share no vocabulary with the
    circuit/driver-name-heavy content in the regular per-weekend docs.
    """
    most_recent = None  # (date_str, event, session_dict)

    for event in events:
        try:
            competitions = event.get("competitions", [])
            for comp in competitions:
                status_type = comp.get("status", {}).get("type", {})
                state = status_type.get("state", "pre")
                type_node = comp.get("type") or {}
                label = (type_node.get("abbreviation") or type_node.get("text") or comp.get("name") or "").lower()

                if state != "post" or label != "race":
                    continue

                date_str = comp.get("date") or ""
                if most_recent is None or date_str > most_recent[0]:
                    most_recent = (date_str, event, comp)
        except Exception as e:
            print(f"  Error scanning event for latest race: {e}")

    if most_recent is None:
        return None

    date_str, event, comp = most_recent
    name = event.get("name") or event.get("shortName") or "Grand Prix"
    circuit_node = event.get("circuit") or (event.get("competitions", [{}])[0].get("circuit")) or {}
    circuit_name = circuit_node.get("fullName", "")
    address = circuit_node.get("address", {}) or {}
    city = address.get("city", "")
    country = address.get("country", "")

    competitors = comp.get("competitors", [])
    competitors.sort(key=lambda c: c.get("order", 999))
    finishers = []
    for c in competitors[:3]:
        athlete = c.get("athlete", {}) or {}
        driver_name = athlete.get("fullName") or athlete.get("displayName") or c.get("displayName") or "-"
        finishers.append(driver_name)

    finishers_text = ", ".join(finishers) if finishers else "no result data available"
    content = (
        f"The latest and most recent completed F1 race is the {name} at {circuit_name}, "
        f"{city}, {country}, held on {date_str}. Top finishers: {finishers_text}."
    )

    return {
        "id": "live-f1-latest-race",  # fixed id — always overwritten, never duplicated
        "sport": "f1",
        "category": "live-match",
        "title": "F1 — Latest Race Result",
        "content": content,
        "source": "espn.com",
        "last_updated": datetime.utcnow().isoformat()
    }

def build_next_race_summary(events):
    """Mirrors build_latest_race_summary() but inverted: finds the
    soonest upcoming (state == 'pre') race weekend instead of the most
    recently completed one, by scanning each weekend's main 'Race'
    session specifically (not just any pre-state session, which would
    incorrectly match FP1/Qualifying of a weekend already underway)."""
    soonest = None  # (date_str, event, session_dict)

    for event in events:
        try:
            competitions = event.get("competitions", [])
            for comp in competitions:
                status_type = comp.get("status", {}).get("type", {})
                state = status_type.get("state", "pre")
                type_node = comp.get("type") or {}
                label = (type_node.get("abbreviation") or type_node.get("text") or "").lower()

                if state != "pre" or label != "race":
                    continue

                date_str = comp.get("date") or ""
                if not date_str:
                    continue
                if soonest is None or date_str < soonest[0]:
                    soonest = (date_str, event, comp)
        except Exception as e:
            print(f"  Error scanning event for next race: {e}")

    if soonest is None:
        return None

    date_str, event, comp = soonest
    name = event.get("name") or event.get("shortName") or "Grand Prix"
    circuit_node = event.get("circuit") or (event.get("competitions", [{}])[0].get("circuit")) or {}
    circuit_name = circuit_node.get("fullName", "")
    address = circuit_node.get("address", {}) or {}
    city = address.get("city", "")
    country = address.get("country", "")

    content = (
        f"The next upcoming F1 race is the {name} at {circuit_name}, "
        f"{city}, {country}, scheduled for {date_str}."
    )

    return {
        "id": "live-f1-next-race",  # fixed id — overwritten each cycle, never duplicated
        "sport": "f1",
        "category": "live-match",
        "title": "F1 — Next Race",
        "content": content,
        "source": "espn.com",
        "last_updated": datetime.utcnow().isoformat()
    }

# ── STANDINGS ──────────────────────────────────────────────
# See module docstring — driver standings via this endpoint are known to be
# unreliable per F1Service.java's own comments. Constructor standings are
# not available at all from this simple endpoint (they need the core API's
# $ref chain, not implemented here). Test this and treat empty/thin results
# as expected rather than a bug, at least initially.
def fetch_standings():
    return _get("https://site.api.espn.com/apis/v2/sports/racing/f1/standings")


def parse_standings(data):
    if not data:
        return []

    groups = data.get("standings") or data.get("children") or []
    driver_lines = []

    for group in groups:
        group_name = (group.get("name") or group.get("displayName") or "").lower()
        if "constructor" in group_name or "team" in group_name or "manufacturer" in group_name:
            continue  # not reliably available here — see docstring

        entries = (group.get("standings") or {}).get("entries") or group.get("entries") or []
        for i, entry in enumerate(entries[:10]):
            athlete = entry.get("athlete", {}) or {}
            name = athlete.get("fullName") or athlete.get("displayName") or "Unknown"
            stats = entry.get("stats", [])
            points = next((s.get("value") for s in stats if s.get("name") in ("points", "championshipPts")), None)
            driver_lines.append(f"{i+1}. {name} — {points if points is not None else '?'} pts")

    if not driver_lines:
        return []

    content = "Current F1 Drivers' World Championship standings:\n" + "\n".join(driver_lines)

    return [{
        "id": "live-f1-standings-drivers",
        "sport": "f1",
        "category": "live-standings",
        "title": "F1 — Drivers' Championship Standings",
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
    print("F1 live updater started! Fetching every 30 seconds...")
    while True:
        print(f"\n[{datetime.utcnow().strftime('%H:%M:%S')}] Fetching live F1 data...")
        all_docs = []

        events = fetch_season_events()
        weekend_docs = [d for d in (parse_weekend(e) for e in events) if d is not None]
        all_docs.extend(weekend_docs)

        latest_race_doc = build_latest_race_summary(events)
        if latest_race_doc:
            all_docs.append(latest_race_doc)

        next_race_doc = build_next_race_summary(events)
        if next_race_doc:
            all_docs.append(next_race_doc)

        standings_data = fetch_standings()
        standings_docs = parse_standings(standings_data)
        all_docs.extend(standings_docs)

        print(f"  F1: {len(weekend_docs)} race weekends, {1 if latest_race_doc else 0} latest-race summary, {len(standings_docs)} standings docs")

        upload_to_search(all_docs)
        print(f"  Total: {len(all_docs)} documents uploaded. Next update in 30 seconds...")
        time.sleep(30)


if __name__ == "__main__":
    run()