"""
search.py — RAG retrieval logic for SportScore Knowledge Assistant

Implements the two-round search strategy across football and basketball indices.
  Round 1 — exact search using the user's full question
  Round 2 — broader search using extracted key words (fallback)

Also includes search_live_corpus() for live match data questions,
which searches the shared football-live-index (holds both football and
basketball live documents — Azure's free tier caps index count at 3,
so both sports' live data share one index, distinguished by the "sport"
field on each document).

If both rounds return nothing, a "not found" flag is returned.
"""

import os
import re
from azure.search.documents import SearchClient
from azure.core.credentials import AzureKeyCredential
from dotenv import load_dotenv

load_dotenv()

SEARCH_ENDPOINT = os.getenv("AZURE_SEARCH_ENDPOINT")
SEARCH_API_KEY  = os.getenv("AZURE_SEARCH_KEY")

if not SEARCH_ENDPOINT or not SEARCH_API_KEY:
    raise RuntimeError("Missing AZURE_SEARCH_ENDPOINT or AZURE_SEARCH_KEY environment variables")

INDICES = ["football-index", "basketball-index"]
LIVE_INDEX = "football-live-index"

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


from functools import lru_cache

@lru_cache(maxsize=None)
def _get_client(index_name):
    return SearchClient(
        endpoint=SEARCH_ENDPOINT,
        index_name=index_name,
        credential=AzureKeyCredential(SEARCH_API_KEY)
    )


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
    """Search across relevant indices and return results, merged by relevance score."""
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
    Runs the two-round search strategy across football and basketball
    KNOWLEDGE indices (rules, formations, strategies, competitions).
    """
    sport = _detect_sport(question)

    round1_results = _search_all_indices(question, sport=sport, top=top)
    if round1_results:
        return {
            "found": True,
            "round_used": 1,
            "results": [_format_result(r) for r in round1_results[:top]]
        }

    keywords = _extract_keywords(question)
    round2_results = _search_all_indices(keywords, sport=sport, top=top)
    if round2_results:
        return {
            "found": True,
            "round_used": 2,
            "results": [_format_result(r) for r in round2_results[:top]]
        }

    return {
        "found": False,
        "round_used": None,
        "results": []
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

    Since both sports' live data share one index, results are filtered by
    sport when the question clearly implies one (e.g. "Lakers" implies
    basketball), and by the top-scoring result's sport when it's ambiguous
    (e.g. "who's playing today?") — otherwise a generic question could
    return a mix of football and basketball matches in one answer.
    """
    all_results = _search_index(LIVE_INDEX, "*", top=1000)
    if not all_results:
        return {"found": False, "round_used": None, "results": []}

    q_words = set(re.findall(r"[a-z']+", question.lower())) - STOPWORDS

    def relevance(r):
        text = (r.get("title", "") + " " + r.get("content", "")).lower()
        text_words = set(re.findall(r"[a-z']+", text))
        return len(q_words & text_words)

    detected_sport = _detect_sport(question)
    if detected_sport:
        # Question clearly implies a sport — only consider that sport's
        # documents, so e.g. asking about basketball never surfaces
        # football matches just because they scored similarly.
        all_results = [r for r in all_results if r.get("sport") == detected_sport]

    scored = [
        (relevance(r), _extract_match_date(r.get("content", "")), r)
        for r in all_results
    ]
    scored.sort(key=lambda x: (x[0], x[1]), reverse=True)

    top_results = [r for _, _, r in scored[:top]]

    if not detected_sport and top_results:
        # No sport was explicitly detected (e.g. "who's playing today?")
        # — infer it from the best-scoring result and drop the other
        # sport's results, rather than mixing football and basketball
        # matches in a single answer.
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
    (both knowledge bases + the live index) so the assistant always has
    something to reason over, instead of returning zero context.
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