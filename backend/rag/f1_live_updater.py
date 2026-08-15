"""
f1_live_updater.py — Fetches live F1 data from ESPN every 60 seconds and
uploads it to Azure AI Search so RAG can answer live questions.

F1 is structurally different from football/basketball/baseball: it's not
team-vs-team, it's race weekends made of sessions (FP1/FP2/FP3/Qualifying/
Race), each session having a driver grid rather than two competitors. This
mirrors the parsing logic in backend/src/main/java/org/Spring/f1/api/
F1Service.java (the existing, working Java implementation).

Reuses the shared football-live-index (same workaround basketball/baseball
use) since Azure's free tier caps index count at 3. No league loop — F1 is
a single championship.

NOTE: per F1Service.java's own comments, ESPN's site standings endpoint for
DRIVER standings is unreliable and often returns empty. If fetch_standings()
prints 0 for drivers, that's expected; treat driver standings as a known gap.
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

SITE = "https://site.web.api.espn.com/apis/site/v2/sports/racing/f1"

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
            content = f"{name} ({circuit_name}, {city}, {country}) — {rep['label']} has FINISHED on {rep.get('date') or 'an unknown date'}. Top finishers: {top}."
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
    Finds whichever weekend's main 'Race' session most recently finished and
    builds a single synthetic summary doc with a FIXED id (upserted each cycle,
    never duplicated) explicitly containing 'latest'/'most recent'.
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
    """Inverted build_latest_race_summary(): finds the soonest upcoming
    (state == 'pre') race weekend by scanning each weekend's main 'Race'
    session specifically."""
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
def fetch_standings():
    return _get("https://site.web.api.espn.com/apis/v2/sports/racing/f1/standings")

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
    # ADDED: batch at <=500 for consistency with the other updaters (Azure Search
    # caps a single upload batch at 1000 docs). F1 rarely has that many, but this
    # keeps behaviour identical across all four sports.
    for _i in range(0, len(docs), 500):
        _chunk = docs[_i:_i + 500]
        try:
            search_client.upload_documents(documents=_chunk)
            print(f"  Uploaded {len(_chunk)} live documents")
        except Exception as e:
            print(f"  Upload error: {e}")


# ── PRUNING ────────────────────────────────────────────────
def prune_stale(sport, category, fresh_ids):
    """ADDED: F1 previously had NO pruning at all, so finished race weekends
    that aged out of the season query kept their old "LIVE right now" doc in the
    index forever and the RAG reported them as live. This deletes any doc of this
    sport+category that wasn't regenerated this cycle.

    Skips pruning when fresh_ids is empty (transient fetch failure), and
    paginates through all docs so nothing stale is missed past the first 1000.
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
    print("F1 live updater started! Fetching every 60 seconds...")
    while True:
        try:
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

            # ADDED: prune stale F1 live-match docs. GUARD: only prune when we got a
            # healthy set of weekend docs this cycle. fetch_season_events() normally
            # returns the WHOLE season, so fresh_ids contains every valid weekend and
            # pruning only removes genuinely orphaned docs. But if the season query
            # failed and we fell back to the nearest-weekend-only scoreboard, fresh_ids
            # would shrink to one weekend and pruning would wrongly delete the rest.
            # Requiring several weekend docs before pruning prevents a degraded fetch
            # from wiping the season; the missing docs get rebuilt next healthy cycle.
            if len(weekend_docs) >= 3:
                fresh_match_ids = {d["id"] for d in all_docs if d.get("category") == "live-match"}
                prune_stale("f1", "live-match", fresh_match_ids)
            else:
                print(f"  Skipping F1 prune this cycle (only {len(weekend_docs)} weekend docs — possible degraded fetch)")

            upload_to_search(all_docs)
            print(f"  Total: {len(all_docs)} documents uploaded. Next update in 60 seconds...")
        except Exception as _cycle_err:
            print(f"  Cycle error: {_cycle_err}")
        time.sleep(60)

if __name__ == "__main__":
    run()