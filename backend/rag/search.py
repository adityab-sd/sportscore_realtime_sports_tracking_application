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
from azure.search.documents import SearchClient
from azure.core.credentials import AzureKeyCredential
from dotenv import load_dotenv

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
PG_CONFIG = {
    "host": os.getenv("POSTGRES_HOST", "localhost"),
    "port": int(os.getenv("POSTGRES_PORT", "5432")),
    "dbname": os.getenv("POSTGRES_DB", "sportsscore"),
    "user": os.getenv("POSTGRES_USER", "postgres"),
    "password": os.getenv("POSTGRES_PASSWORD", "postgres"),
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
_pg_connection = None

BASKETBALL_KEYWORDS = {
    "basketball", "nba", "dribble", "three point", "three-point", "free throw", "rebound", "slam dunk", "pick and roll", "layup",
    "jump shot", "shot clock", "foul out", "wnba", "fiba", "hoop", "backboard", "rim", "paint", "point guard", "shooting guard"
}

FOOTBALL_KEYWORDS = {
    "football", "soccer", "offside", "premier league", "uefa", "fifa", "formation", "penalty", "yellow card", "red card", "free kick",
    "corner kick", "throw in", "goalkeeper", "striker", "midfielder", "bundesliga", "la liga", "serie a", "champions league", "world cup"
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
    "score", "scores", "match", "matches", "game", "games", "next", "happening",
    "playing", "today", "won", "win", "wins", "result", "results", "who", "when"
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


def _get_pg_connection():
    """Reuses a single Postgres connection across requests, reconnecting
    if it's ever closed (e.g. after a long idle period)."""
    global _pg_connection
    if _pg_connection is None or _pg_connection.closed:
        _pg_connection = psycopg2.connect(**PG_CONFIG)
        register_vector(_pg_connection)
    return _pg_connection


def _extract_keywords(question):
    words = re.findall(r"[a-zA-Z0-9\-]+", question.lower())
    keywords = [w for w in words if w not in STOPWORDS]
    return " ".join(keywords) if keywords else question


def _detect_sport(question):
    q_lower = question.lower()
    tokens = set(re.findall(r"[a-z\-]+", q_lower))

    for kw in BASKETBALL_KEYWORDS:
        if " " in kw:
            if kw in q_lower:
                return "basketball"
        elif kw in tokens:
            return "basketball"

    for kw in FOOTBALL_KEYWORDS:
        if " " in kw:
            if kw in q_lower:
                return "football"
        elif kw in tokens:
            return "football"

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

    conn = _get_pg_connection()
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


def search_live_corpus(question, top=6):
    """
    Fetches ALL current documents from the shared live index (football +
    basketball) and ranks them locally by relevance + recency, instead of
    relying on Azure's keyword-based relevance search.

    UNCHANGED by this migration — live match data stays on Azure/ESPN.

    Relevance is scored only on "significant" words — the question's
    words minus stopwords AND minus LIVE_NOISE_WORDS (generic sports terms
    like "score", "match", "won" that appear in almost every document).
    A minimum relevance threshold is enforced so a single coincidental
    word overlap (e.g. "golden" in "Golden Boot" vs "Golden State
    Valkyries") is not treated as a real match.
    """
    all_results = _search_index(LIVE_INDEX, "*", top=1000)
    if not all_results:
        return {"found": False, "round_used": None, "results": []}

    q_words = set(re.findall(r"[a-z']+", question.lower())) - STOPWORDS
    significant_words = q_words - LIVE_NOISE_WORDS

    def relevance(r):
        text = (r.get("title", "") + " " + r.get("content", "")).lower()
        text_words = set(re.findall(r"[a-z']+", text))
        return len(significant_words & text_words)

    detected_sport = _detect_sport(question)
    if detected_sport:
        all_results = [r for r in all_results if r.get("sport") == detected_sport]

    scored = [
        (relevance(r), _extract_match_date(r.get("content", "")), r)
        for r in all_results
    ]
    scored.sort(key=lambda x: (x[0], x[1]), reverse=True)

    min_relevance = min(len(significant_words), 2) if significant_words else 0
    scored = [s for s in scored if min_relevance > 0 and s[0] >= min_relevance]

    if not scored:
        return {"found": False, "round_used": None, "results": []}

    top_results = [r for _, _, r in scored[:top]]

    if not detected_sport and top_results:
        top_sport = top_results[0].get("sport")
        if top_sport:
            top_results = [r for r in top_results if r.get("sport") == top_sport]

    return {
        "found": True,
        "round_used": 1,
        "results": [_format_result(r) for r in top_results]
    }


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
    Absolute last resort — grabs a handful of documents from ANY index
    (both Azure knowledge bases + the live index) so the assistant always
    has something to reason over, instead of returning zero context.

    NOTE: this still queries the OLD Azure knowledge indices
    (football-index/basketball-index), which are now stale duplicates of
    what's in Postgres, since only search_corpus() was migrated per your
    request. Worth deciding later whether to point this at Postgres too
    for full consistency — flagging rather than silently changing it.
    """
    all_results = []
    for index_name in INDICES + [LIVE_INDEX]:
        try:
            results = _search_index(index_name, "*", top=top)
            all_results.extend(results)
        except Exception:
            continue
    return {
        "found": bool(all_results),
        "round_used": "fallback",
        "results": [_format_result(r) for r in all_results[:top]]
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