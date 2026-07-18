"""
search.py - RAG retrieval logic for SportScore Knowledge Assistant

Implements the two-round search strategy across football and basketball indices.
  Round 1 — exact search using the user's full question
  Round 2 — broader search using extracted key words (fallback)
This module implements the two-round search strategy:
  Round 1 - exact search using the user's full question
  Round 2 - broader search using extracted key words (fallback)

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

INDICES = ["football-index", "basketball-index"]

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


# PLEASE review — two concerns:
# 1) SEARCH_ENDPOINT/SEARCH_API_KEY are never validated; if unset, AzureKeyCredential(None)
#    fails later with an opaque error instead of a clear startup check.
# 2) A brand-new SearchClient is built on EVERY query (per index, per round). Clients are
#    reusable and thread-safe — build once and cache to avoid per-request setup cost.
# EXAMPLE:
#   from functools import lru_cache
#   @lru_cache(maxsize=None)
#   def _get_client(index_name): return SearchClient(SEARCH_ENDPOINT, index_name, _cred)
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


# PLEASE review — substring matching: `kw in q_lower` can match inside unrelated words
# (e.g. "rim" in "trim"/"primary", "paint" in "repaint"), misclassifying the sport and
# restricting the search to the wrong index. Prefer whole-word/phrase matching.
# EXAMPLE:
#   tokens = set(re.findall(r"[a-z\-]+", q_lower))
#   if tokens & BASKETBALL_SINGLE or any(p in q_lower for p in BASKETBALL_PHRASES): return "basketball"
def _detect_sport(question):
    q_lower = question.lower()
    if any(kw in q_lower for kw in BASKETBALL_KEYWORDS):
        return "basketball"
    if any(kw in q_lower for kw in FOOTBALL_KEYWORDS):
        return "football"
    return None


def _search_index(index_name, search_text, top=3):
    client = _get_client(index_name)
    return list(client.search(search_text=search_text, top=top))


# ============================================================================
# PLEASE review — relevance bug when no sport is detected: results from each index are
# concatenated in INDICES order and later sliced [:top] (in search_corpus) WITHOUT merging
# by score. A highly-relevant basketball hit can be dropped in favour of weaker football
# hits simply because football-index is listed first. Merge by @search.score before truncating.
# EXAMPLE:
#   merged = sorted(all_results, key=lambda r: r.get("@search.score", 0), reverse=True)
#   return merged[:top]
# ============================================================================
def _search_all_indices(search_text, sport=None, top=3):
    """Search across relevant indices and return results."""
    all_results = []
    for index_name in INDICES:
        # If sport detected, only search the relevant index
        if sport == "basketball" and index_name != "basketball-index":
            continue
        if sport == "football" and index_name != "football-index":
            continue
        results = _search_index(index_name, search_text, top=top)
        all_results.extend(results)
    return all_results


def search_corpus(question, top=3):
    """
    Runs the two-round search strategy across football and basketball indices.

    Returns:
      {
        "found": True/False,
        "round_used": 1 or 2 or None,
        "results": [ {id, title, category, content, source}, ... ]
      }
    """
    sport = _detect_sport(question)

    # ── ROUND 1: exact search with the full question ──
    round1_results = _search_all_indices(question, sport=sport, top=top)
    if round1_results:
        return {
            "found": True,
            "round_used": 1,
            "results": [_format_result(r) for r in round1_results[:top]]
        }

    # ── ROUND 2: broader search using extracted key words ──
    keywords = _extract_keywords(question)
    round2_results = _search_all_indices(keywords, sport=sport, top=top)
    if round2_results:
        return {
            "found": True,
            "round_used": 2,
            "results": [_format_result(r) for r in round2_results[:top]]
        }

    # ── Nothing found in either round ──
    return {
        "found": False,
        "round_used": None,
        "results": []
    }


# PLEASE review — inconsistent access: id/title/category/content use r["..."] (KeyError if a
# document is missing the field) while source uses .get(). One malformed doc crashes the whole
# request. Use .get() with defaults uniformly.
# EXAMPLE:
#   return {"id": r.get("id",""), "title": r.get("title",""), "category": r.get("category",""),
#           "content": r.get("content",""), "source": r.get("source","")}
def _format_result(r):
    return {
        "id": r["id"],
        "title": r["title"],
        "category": r["category"],
        "content": r["content"],
        "source": r.get("source", "")
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