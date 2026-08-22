"""
search.py — RAG retrieval logic for SportScore Knowledge Assistant

Implements the two-round search strategy across football and basketball indices.
  Round 1 — exact search using the user's full question
  Round 2 — broader search using extracted key words (fallback)

NOTE ON search_corpus(): this function now queries the PostgreSQL/pgvector
`sports_corpus` table using semantic vector similarity, replacing the old
Azure AI Search knowledge-base lookup. Since vector embeddings already
understand paraphrases/synonyms in a single pass, there's no more
"round 2 keyword-broadened fallback" for this function specifically —
a match either clears the similarity threshold or it doesn't. This is a
NEW capability: your original search.py/Azure AI Search setup never used
vector embeddings before.

Also includes search_live_corpus() for live match data questions,
which searches the shared football-live-index (holds both football and
basketball live documents — Azure's free tier caps index count at 3,
so both sports' live data share one index, distinguished by the "sport"
field on each document). This function is UNCHANGED — still Azure-based,
since live match data comes from Hemanathan's ESPN pipeline, not this
migration.

If both rounds return nothing, a "not found" flag is returned.
"""

import os

# Must be set BEFORE sentence_transformers/huggingface_hub is imported,
# so it takes effect for every model load and suppresses the
# "unauthenticated requests to the HF Hub" warning noise.
os.environ["HF_HUB_VERBOSITY"] = "error"

import re
import time
from azure.search.documents import SearchClient
from azure.core.credentials import AzureKeyCredential
from dotenv import load_dotenv
from datetime import datetime, timedelta

import psycopg2
from pgvector.psycopg2 import register_vector
from sentence_transformers import SentenceTransformer

load_dotenv()

SEARCH_ENDPOINT = os.getenv("AZURE_SEARCH_ENDPOINT")
SEARCH_API_KEY  = os.getenv("AZURE_SEARCH_KEY")

if not SEARCH_ENDPOINT or not SEARCH_API_KEY:
    raise RuntimeError("Missing AZURE_SEARCH_ENDPOINT or AZURE_SEARCH_KEY environment variables")

INDICES = ["football-index", "basketball-index"]  # still referenced by search_fallback_anything() — see note there
LIVE_INDEX = "football-live-index"

# ── Postgres/pgvector config for the knowledge-base corpus (NEW) ──
# No hardcoded fallback defaults on ANY field, including host/port/dbname —
# every value must come from a real environment variable. This matches the
# same fail-loudly pattern already used above for AZURE_SEARCH_ENDPOINT/KEY,
# rather than silently falling back to a hardcoded credential-shaped string.
_required_pg_vars = ["POSTGRES_HOST", "POSTGRES_PORT", "POSTGRES_DB", "POSTGRES_USER", "POSTGRES_PASSWORD"]
_missing_pg_vars = [v for v in _required_pg_vars if not os.getenv(v)]
if _missing_pg_vars:
    raise RuntimeError(f"Missing required Postgres environment variables: {', '.join(_missing_pg_vars)}")

PG_CONFIG = {
    "host": os.getenv("POSTGRES_HOST"),
    "port": int(os.getenv("POSTGRES_PORT")),
    "dbname": os.getenv("POSTGRES_DB"),
    "user": os.getenv("POSTGRES_USER"),
    "password": os.getenv("POSTGRES_PASSWORD"),
}
EMBEDDING_MODEL_NAME = "all-MiniLM-L6-v2"

# Cosine DISTANCE threshold (0 = identical, higher = less similar) for
# accepting a vector match as "found". THIS IS A STARTING POINT, NOT A
# TUNED VALUE — same lesson as the fuzzy-search fix in search_live_corpus:
# verify empirically against your own test questions and adjust if you
# see false positives (unrelated matches slipping through) or false
# negatives (real matches getting rejected). Don't trust this blindly.
VECTOR_DISTANCE_THRESHOLD = 0.5

_embedding_model = None
_pg_pool = None

# In-process TTL cache for the full live snapshot. The live index is fetched
# with a single "*" query and ranked in Python; without this, EVERY live
# question re-pulled up to 5000 docs from Azure. Cache it briefly so repeated
# questions (many users, same match) share one fetch. Per-process (each gunicorn
# worker keeps its own) — it only ever reduces Azure load, never affects results.
_LIVE_CACHE_TTL_SECONDS = 45
_live_snapshot_cache = {"ts": 0.0, "docs": None}

BASKETBALL_KEYWORDS = {
    "basketball", "nba", "dribble", "three point", "three-point", "free throw", "rebound", "slam dunk", "pick and roll", "layup", 
    "jump shot", "shot clock", "foul out", "wnba", "fiba", "hoop", "backboard", "rim", "paint", "point guard", "shooting guard",
    "hawks", "celtics", "nets", "hornets", "bulls", "cavaliers", "cavs", "mavericks", "mavs", "nuggets", "pistons", "warriors", 
    "rockets", "pacers", "clippers", "lakers", "grizzlies", "heat", "bucks", "timberwolves", "pelicans", "knicks", "thunder", 
    "magic", "76ers", "sixers", "suns", "trail blazers", "blazers", "kings", "spurs", "raptors", "jazz", "wizards"
}

FOOTBALL_KEYWORDS = {
    "football", "soccer", "offside", "premier league", "uefa", "fifa", "formation", "penalty", "yellow card", "red card", 
    "free kick", "corner kick", "throw-in", "goal kick", "var", "handball", "striker", "midfielder", "defender", 
    "goalkeeper", "winger", "hat-trick", "clean sheet", "relegation", "champions league", "world cup", "arsenal", 
    "aston villa", "bournemouth", "brentford", "brighton", "burnley", "chelsea", "crystal palace", "everton",
    "fulham", "leeds", "liverpool", "manchester city", "manchester united", "newcastle", "nottingham forest", "sunderland",
    "tottenham", "west ham", "wolverhampton", "real madrid", "barcelona", "bayern munich", "juventus", "psg", "paris saint-germain"
}

BASEBALL_KEYWORDS = {
    "baseball", "mlb", "home run", "grand slam", "strikeout", "shortstop", "bullpen", "inning", "innings", "world series", 
    "designated hitter", "pitcher", "pitching", "catcher", "outfielder", "infielder", "bunt", "stolen base", "balk", "dugout",
    "batter", "at bat", "wbc", "npb", "milb", "cy young", "world baseball classic", "diamondbacks", "braves", "orioles", "red sox", 
    "cubs", "white sox", "reds", "guardians", "rockies", "tigers", "astros", "royals", "angels", "dodgers", "marlins", "brewers", "twins",
    "mets", "yankees", "athletics", "phillies", "pirates", "padres", "giants", "mariners", "cardinals", "rays", "rangers", "blue jays", "nationals"
}
F1_KEYWORDS = {
    "f1", "formula 1", "formula one", "grand prix", "pole position", "qualifying", "pit stop", "pit lane", "drs", "safety car", 
    "constructors", "paddock", "podium", "chequered flag", "checkered flag", "undercut", "overcut", "power unit", 
    "parc ferme", "parc fermé", "sprint race", "fastest lap", "red flag", "sector", "cadillac f1", "mclaren", "ferrari f1", 
    "mercedes f1", "red bull racing", "aston martin f1"
}

# Filler words stripped out when building the Round 2 broad query
STOPWORDS = {
    "what", "is", "the", "a", "an", "how", "does", "do", "in", "of", "to", "for", "and", "are", "was", "were", "explain", "tell", "me",
    "about", "can", "you", "please", "i", "want", "know", "on", "with"
}

# Words that show up in almost every live-match question/document and
# provide little real signal on their own. Excluding these from relevance
# scoring in search_live_corpus stops coincidental single-word overlaps
# (e.g. "golden" in "Golden Boot" matching "Golden State Valkyries") from
# being treated as a real match.
LIVE_NOISE_WORDS = {
    "score", "scores","scored", "match", "matches", "game", "games", "next", "happening",
    "playing", "play", "played", "today", "won", "win", "wins", "result", "results", "who", "when"
}


from functools import lru_cache

@lru_cache(maxsize=None)
def _get_client(index_name):
    return SearchClient(
        endpoint=SEARCH_ENDPOINT,
        index_name=index_name,
        credential=AzureKeyCredential(SEARCH_API_KEY)
    )


def _get_embedding_model():
    """Loads the sentence-transformers model once and reuses it — loading
    it per-request would be slow (model load takes a couple seconds)."""
    global _embedding_model
    if _embedding_model is None:
        _embedding_model = SentenceTransformer(EMBEDDING_MODEL_NAME)
    return _embedding_model


def _get_pg_pool():
    """A small thread-safe connection pool. The previous single global
    connection was shared across all requests, which is UNSAFE if gunicorn
    runs threaded workers — concurrent /ask calls would race on one socket.
    A pool hands each request its own connection and returns it afterwards."""
    global _pg_pool
    if _pg_pool is None:
        from psycopg2 import pool as _pgpool
        _pg_pool = _pgpool.ThreadedConnectionPool(1, 8, **PG_CONFIG)
    return _pg_pool


def _pg_checkout():
    """Get a connection from the pool with the pgvector type registered."""
    conn = _get_pg_pool().getconn()
    register_vector(conn)  # ensures the 'vector' type caster on this connection
    return conn


def _pg_return(conn):
    try:
        _get_pg_pool().putconn(conn)
    except Exception:
        pass


def _extract_keywords(question):
    words = re.findall(r"[a-zA-Z0-9\-]+", question.lower())
    keywords = [w for w in words if w not in STOPWORDS]
    return " ".join(keywords) if keywords else question


def _detect_sport(question):
    # CHANGED: was first-match-wins over UNORDERED sets, so a question touching
    # two sports (or a colliding token) could pick a sport non-deterministically.
    # Now count keyword hits per sport and pick the max, with a fixed priority
    # tie-break — deterministic regardless of set iteration order.
    q_lower = question.lower()
    tokens = set(re.findall(r"[a-z0-9\-]+", q_lower))  # include digits so "f1" is a token

    def _count(keywords):
        n = 0
        for kw in keywords:
            if " " in kw:
                if kw in q_lower:
                    n += 1
            elif kw in tokens:
                n += 1
        return n

    counts = {
        "football": _count(FOOTBALL_KEYWORDS),
        "basketball": _count(BASKETBALL_KEYWORDS),
        "baseball": _count(BASEBALL_KEYWORDS),
        "f1": _count(F1_KEYWORDS),
    }
    top_score = max(counts.values())
    if top_score == 0:
        return None
    for s in ("football", "basketball", "baseball", "f1"):  # fixed tie-break order
        if counts[s] == top_score:
            return s
    return None


def _make_fuzzy_query(search_text):
    """Turns a plain query into a Lucene fuzzy query, so close spelling
    variants and typos (e.g. "traveling" vs "travelling", "basektball"
    vs "basketball") still match without needing a maintained list of
    spelling variants. Skips wildcard queries ("*") unchanged."""
    if search_text.strip() == "*":
        return search_text
    words = search_text.split()
    return " ".join(f"{w}~1" for w in words if w)


def _search_index(index_name, search_text, top=3):
    client = _get_client(index_name)
    try:
        fuzzy_query = _make_fuzzy_query(search_text)
        return list(client.search(
            search_text=fuzzy_query,
            query_type="full",
            top=top
        ))
    except Exception:
        return []


def _search_all_indices(search_text, sport=None, top=3):
    """Search across relevant indices and return results, merged by relevance score.
    NOTE: still used by search_fallback_anything() as the absolute last resort —
    NOT used by search_corpus() anymore, which now queries Postgres instead."""
    all_results = []
    for index_name in INDICES:
        if sport == "basketball" and index_name != "basketball-index":
            continue
        if sport == "football" and index_name != "football-index":
            continue
        results = _search_index(index_name, search_text, top=top)
        all_results.extend(results)

    all_results.sort(key=lambda r: r.get("@search.score", 0), reverse=True)

    if sport is None and all_results:
        top_sport = all_results[0].get("sport")
        if top_sport:
            all_results = [r for r in all_results if r.get("sport") == top_sport]

    return all_results


def search_corpus(question, top=3):
    """
    Vector similarity search over the `sports_corpus` PostgreSQL/pgvector
    table — replaces the old Azure AI Search knowledge-base lookup.

    A minimum-relevance threshold (VECTOR_DISTANCE_THRESHOLD) is enforced:
    the closest match must clear it, or this returns "not found" rather
    than surfacing a distantly-related document just because it was the
    least-bad option in the top-k — the same false-positive pattern we
    fixed in search_live_corpus (e.g. "Golden Boot" vs "Golden State").
    """
    sport = _detect_sport(question)
    model = _get_embedding_model()
    query_embedding = model.encode(question)

    conn = _pg_checkout()
    try:
        with conn.cursor() as cur:
            if sport:
                cur.execute("""
                    SELECT id, title, content, category, sport, metadata,
                           embedding <=> %s AS distance
                    FROM sports_corpus
                    WHERE sport = %s
                    ORDER BY embedding <=> %s
                    LIMIT %s;
                """, (query_embedding, sport, query_embedding, top))
            else:
                cur.execute("""
                    SELECT id, title, content, category, sport, metadata,
                           embedding <=> %s AS distance
                    FROM sports_corpus
                    ORDER BY embedding <=> %s
                    LIMIT %s;
                """, (query_embedding, query_embedding, top))
            rows = cur.fetchall()
    finally:
        _pg_return(conn)

    relevant_rows = [r for r in rows if r[6] <= VECTOR_DISTANCE_THRESHOLD]

    if not relevant_rows:
        return {"found": False, "round_used": None, "results": []}

    results = []
    for row in relevant_rows:
        _id, title, content, category, row_sport, metadata, distance = row
        results.append({
            "id": _id,
            "title": title,
            "category": category,
            "content": content,
            "source": (metadata or {}).get("source", "") or "",
        })

    return {
        "found": True,
        "round_used": 1,  # semantic search is single-pass — no round 2 needed
        "results": results,
    }


def _extract_match_date(content):
    """Pulls the ISO date (YYYY-MM-DD) out of a live match content string
    like '...played on 2026-07-19T19:00Z...' or '...Kickoff: 2026-06-22T17:00Z.'
    so finished matches can be sorted by actual match date, not upload time."""
    match = re.search(r"(\d{4}-\d{2}-\d{2})T", content)
    return match.group(1) if match else ""


def _get_all_live_docs():
    """Fetch the full live snapshot, cached briefly in-process to avoid
    re-pulling up to 5000 docs from Azure on every single live question."""
    now = time.time()
    cached = _live_snapshot_cache["docs"]
    if cached is not None and (now - _live_snapshot_cache["ts"]) < _LIVE_CACHE_TTL_SECONDS:
        return cached
    docs = _search_index(LIVE_INDEX, "*", top=5000)
    if docs:
        _live_snapshot_cache["docs"] = docs
        _live_snapshot_cache["ts"] = now
        return docs
    # keep last good snapshot on a transient empty fetch
    return cached if cached is not None else []


def _match_state(content):
    """Classify a live doc as 'in' (live), 'post' (finished), 'pre'
    (scheduled) or 'unknown', from the wording all four updaters emit:
      live  -> 'currently LIVE' / 'is LIVE right now' / 'LIVE and in progress' / 'in progress'
      post  -> 'has FINISHED' / 'Final score' / 'Top finishers' / 'Latest results' / 'recently completed'
      pre   -> 'scheduled (upcoming)' / 'is upcoming' / 'next upcoming' / 'Kick-off:' / 'Tip-off:' / 'First pitch:'
    This is what lets a 'score/now' question surface live matches first and
    push far-future fixtures to the bottom."""
    c = content.lower()
    if ("currently live" in c or "live right now" in c or "live and in progress" in c
            or "in progress" in c or "live now" in c):
        return "in"
    if ("has finished" in c or "final score" in c or "top finishers" in c
            or "latest results" in c or "recently completed" in c or "most recently" in c):
        return "post"
    if ("scheduled (upcoming)" in c or "is upcoming" in c or "next upcoming" in c
            or "scheduled for" in c or "kick-off:" in c or "tip-off:" in c
            or "first pitch:" in c):
        return "pre"
    return "unknown"


def search_live_corpus(question, top=6):
    """
    Ranks the live snapshot by (1) relevance to the question, (2) the match
    STATE relative to what's being asked, then (3) date.

    Fix for "what is the score..." returning fixtures weeks away: a
    present-tense / score / now question now surfaces in-progress matches
    first, then the most-recently finished, and pushes far-future scheduled
    fixtures to the bottom — instead of the old date-descending default that
    put the furthest-future fixture on top.
    """
    all_results = _get_all_live_docs()
    if not all_results:
        return {"found": False, "round_used": None, "results": []}

    q_words = set(re.findall(r"[a-z']+", question.lower())) - STOPWORDS
    significant_words = q_words - LIVE_NOISE_WORDS

    _q = question.lower()
    _named_league = None
    for _lg in ("premier league", "la liga", "serie a", "bundesliga", "ligue 1",
                "j-league", "j league", "argentina primera", "argentine primera",
                "liga mx", "champions league", "europa league", "conference league",
                "eredivisie", "primeira liga", "brazil serie a", "a-league", "mls",
                "wnba", "nba", "mlb", "world cup"):
        if _lg in _q:
            _named_league = _lg
            break

    def relevance(r):
        text = (r.get("title", "") + " " + r.get("content", "")).lower()
        text_words = set(re.findall(r"[a-z']+", text))
        base = len(significant_words & text_words)
        if _named_league and _named_league in text:
            base += 5
        return base

    detected_sport = _detect_sport(question)
    if detected_sport:
        all_results = [r for r in all_results if r.get("sport") == detected_sport]

    # Category intent. Three distinct buckets so one never bleeds into another:
    #   - standings/table/rank questions   -> ONLY standings docs
    #   - news/injury/transfer questions   -> ONLY those docs
    #   - live/next/score/fixture/result   -> ONLY match docs (this is the fix:
    #     standings docs were leaking into match answers, so "is there a live
    #     match / when's the next match" got answered with league tables).
    _wants_standings = any(w in _q for w in (
        "standing", "standings", "table", "rank", "ranking", "position",
        "points", "leading", "leader", "top of"))
    _wants_other = any(w in _q for w in (
        "news", "injury", "injuries", "transfer", "transaction", "signing", "headline"))
    _wants_match_events = any(w in _q for w in (
        "live", "next", "upcoming", "fixture", "fixtures", "schedule", "scheduled",
        "score", "scores", "result", "results", "kickoff", "playing", "match",
        "matches", "game", "games", "race", "races", "when is", "who scored",
        "scorer", "won", "happening"))

    if _wants_standings and not _wants_match_events:
        _only = [r for r in all_results if (r.get("category") or "") == "live-standings"]
        if _only:
            all_results = _only
    elif _wants_other and not _wants_match_events and not _wants_standings:
        _cat_map = {
            "news": "live-news", "headline": "live-news",
            "injury": "live-injury", "injuries": "live-injury",
            "transfer": "live-transaction", "transaction": "live-transaction", "signing": "live-transaction",
        }
        _want_cats = {_cat_map[w] for w in _cat_map if w in _q}
        if _want_cats:
            _only = [r for r in all_results if (r.get("category") or "") in _want_cats]
            if _only:
                all_results = _only
    elif _wants_match_events and not _wants_standings and not _wants_other:
        # STRICT: match docs only (includes the "Next Match", "Live Now" and
        # "Latest Results" summary docs, all of which are category live-match).
        # If this empties the set, we intentionally let it — the caller then
        # returns a clean "no live/upcoming matches" answer instead of standings.
        all_results = [r for r in all_results if (r.get("category") or "") == "live-match"]

    # Temporal intent.
    _recent = any(w in _q for w in ("latest", "recent", "result", "results", "yesterday",
                                    "finished", "most recent", "final score", "who won",
                                    "last match", "last game", "last race"))
    _upcoming = any(w in _q for w in ("upcoming", "next", "fixture", "fixtures", "schedule",
                                      "scheduled", "coming up", "this week", "kickoff",
                                      "tip-off", "first pitch"))
    if _upcoming and not _recent:
        intent = "upcoming"
    elif _recent and not _upcoming:
        intent = "recent"
    elif _upcoming and _recent:
        intent = "upcoming"
    else:
        intent = "live_now"  # score / live / now / currently / default

    _today_int = int(datetime.utcnow().strftime("%Y%m%d"))

    def _di(d):
        return int(d.replace("-", "")) if d else 0

    def sort_key(item):
        rel, date_str, r = item
        st = _match_state(r.get("content", ""))
        di = _di(date_str)
        if intent == "upcoming":
            pri = {"pre": 0, "in": 1, "post": 2}.get(st, 3)
            future = di >= _today_int and di > 0
            return (-rel, pri, 0 if future else 1, di if future else -di)
        if intent == "recent":
            pri = {"post": 0, "in": 0, "pre": 1}.get(st, 1)
            return (-rel, pri, -di)
        # live_now
        pri = {"in": 0, "post": 1, "pre": 2}.get(st, 3)
        if st == "post":
            tie = -di          # most recently finished first
        elif st == "pre":
            tie = di           # soonest upcoming first
        else:
            tie = 0
        return (-rel, pri, tie)

    scored = [(relevance(r), _extract_match_date(r.get("content", "")), r) for r in all_results]
    scored.sort(key=sort_key)

    # Relevance threshold — reject coincidental single-word overlaps.
    min_relevance = min(len(significant_words), 2) if significant_words else 0
    _sport_name_words = {"basketball", "baseball", "football", "soccer", "f1", "formula",
                         "nba", "wnba", "mlb", "nfl", "race", "races"}
    if detected_sport and significant_words and significant_words.issubset(_sport_name_words):
        min_relevance = 0

    thresholded = [s for s in scored if min_relevance > 0 and s[0] >= min_relevance]

    if not thresholded:
        if detected_sport and scored:
            thresholded = scored[:top]
        elif intent == "live_now" and scored:
            # Bare "what's the score / anything live" with no sport named:
            # show current live/finished matches across sports, not nothing.
            thresholded = scored[:top]
        else:
            return {"found": False, "round_used": None, "results": []}

    top_results = [r for _, _, r in thresholded[:top]]

    if not detected_sport and top_results:
        top_sport = top_results[0].get("sport")
        if top_sport:
            top_results = [r for r in top_results if r.get("sport") == top_sport]

    return {"found": True, "round_used": 1, "results": [_format_result(r) for r in top_results]}


_DATE_RE = re.compile(r"(\d{4}-\d{2}-\d{2})")


def _extract_doc_date(doc):
    """Pulls the first ISO date (YYYY-MM-DD) found in a live doc's title
    or content. Every live-match doc across all 4 updaters already embeds
    a real date in its text — this reads that directly, avoiding the need
    for a separate structured date field or Azure schema change."""
    text = (doc.get("title", "") + " " + doc.get("content", ""))
    m = _DATE_RE.search(text)
    return m.group(1) if m else None


def detect_date_range(question):
    """Returns (date_from, date_to) as 'YYYY-MM-DD' strings if the question
    is asking about a specific date-relative window (today/tomorrow/
    yesterday/this week), else None. Keyword-overlap search can't reliably
    answer these — 'today' isn't a vocabulary match, it's a date
    comparison, so this bypasses scoring entirely for this category."""
    q_lower = question.lower()
    today = datetime.utcnow().date()

    if re.search(r"\bnow\b", q_lower) or re.search(r"\blive\b", q_lower) or any(p in q_lower for p in ("today", "tonight", "right now", "currently", "at the moment")):
        d = today.isoformat()
        return (d, d)
    if re.search(r"\btomorrow\b", q_lower):
        d = (today + timedelta(days=1)).isoformat()
        return (d, d)
    if re.search(r"\byesterday\b", q_lower):
        d = (today - timedelta(days=1)).isoformat()
        return (d, d)
    if "this week" in q_lower:
        start = today - timedelta(days=today.weekday())
        end = start + timedelta(days=6)
        return (start.isoformat(), end.isoformat())
    return None


def search_live_by_date(question, date_from, date_to):
    """Date-filtered live search — bypasses keyword-overlap scoring
    entirely, since date-relative questions need a real date comparison,
    not word matching."""
    detected_sport = _detect_sport(question)
    all_results = _get_all_live_docs()
    if detected_sport:
        all_results = [r for r in all_results if r.get("sport") == detected_sport]

    matches = []
    for r in all_results:
        doc_date = _extract_doc_date(r)
        if doc_date and date_from <= doc_date <= date_to:
            matches.append(r)

    if not matches:
        return {"found": False, "round_used": None, "results": []}

    matches.sort(key=lambda r: _extract_doc_date(r) or "")
    return {"found": True, "round_used": "date-filter", "results": [_format_result(r) for r in matches[:10]]}

def _format_result(r):
    return {
        "id": r.get("id", ""),
        "title": r.get("title", ""),
        "category": r.get("category", ""),
        "content": r.get("content", ""),
        "source": r.get("source", "")
    }


def search_fallback_anything(top=3):
    """
    Absolute last resort — grabs a handful of knowledge documents so the
    assistant always has *something* to reason over instead of returning
    zero context.

    CHANGED: now pulls from the Postgres `sports_corpus` (the live source of
    truth for all four sports) instead of the OLD, stale Azure knowledge
    indices (football-index/basketball-index), which were duplicates missing
    baseball/F1 entirely. If Postgres is unreachable, falls back to a small
    grab from the live index so we still return context.
    """
    try:
        conn = _pg_checkout()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, title, content, category, sport, metadata "
                    "FROM sports_corpus LIMIT %s;", (top,))
                rows = cur.fetchall()
        finally:
            _pg_return(conn)
        results = [{
            "id": r[0], "title": r[1], "category": r[3],
            "content": r[2], "source": (r[5] or {}).get("source", "") or "",
        } for r in rows]
        if results:
            return {"found": True, "round_used": "fallback", "results": results}
    except Exception:
        pass

    # Postgres unreachable — last-ditch grab from the live index.
    try:
        live = _get_all_live_docs()[:top]
    except Exception:
        live = []
    return {
        "found": bool(live),
        "round_used": "fallback",
        "results": [_format_result(r) for r in live],
    }


# ── Quick test when running directly ──
if __name__ == "__main__":
    test_questions = [
        "What is gegenpressing?",
        "What is a three point shot in basketball?",
        "How does the offside rule work?",
        "What is the pick and roll?",
        "asdkjqwoieuqwoiueqwoiue",
    ]

    for q in test_questions:
        print(f"\n{'='*60}")
        print(f"Question: {q}")
        result = search_corpus(q)
        print(f"Found: {result['found']}  |  Round used: {result['round_used']}")
        for r in result["results"]:
            print(f"  - [{r['category']}] {r['title']}")

    print(f"\n{'='*60}")
    print("Testing live index...")
    live_result = search_live_corpus("Arsenal score")
    print(f"Found: {live_result['found']}  |  Round used: {live_result['round_used']}")
    for r in live_result["results"]:
        print(f"  - [{r['category']}] {r['title']}")