"""
search.py — RAG retrieval logic for SportScore Knowledge Assistant

Implements the two-round search strategy:
  Round 1 — exact search using the user's full question
  Round 2 — broader search using extracted key words (fallback)

If both rounds return nothing, a "not found" flag is returned.
"""

import os
import re
from azure.search.documents import SearchClient
from azure.core.credentials import AzureKeyCredential
from azure.core.exceptions import AzureError
from dotenv import load_dotenv

load_dotenv()

SEARCH_ENDPOINT = os.getenv("AZURE_SEARCH_ENDPOINT")
SEARCH_API_KEY  = os.getenv("AZURE_SEARCH_KEY")
INDEX_NAME      = "football-index"

STOPWORDS = {
    "what", "is", "the", "a", "an", "how", "does", "do", "in", "of",
    "to", "for", "and", "are", "was", "were", "explain", "tell", "me",
    "about", "can", "you", "please", "i", "want", "know", "on", "with"
}


def _get_client():
    return SearchClient(
        endpoint=SEARCH_ENDPOINT,
        index_name=INDEX_NAME,
        credential=AzureKeyCredential(SEARCH_API_KEY)
    )


def _extract_keywords(question):
    """
    Strips filler words, returns just the meaningful terms.
    Used for Round 2 broad search.

    Example:
      "What is gegenpressing?" -> "gegenpressing"
      "How does the offside rule work?" -> "offside rule work"
    """
    words = re.findall(r"[a-zA-Z0-9\-]+", question.lower())
    keywords = [w for w in words if w not in STOPWORDS]
    return " ".join(keywords) if keywords else question


def search_corpus(question, top=3):
    """
    Runs the two-round search strategy against the football-index.

    Returns:
      {
        "found": True/False,
        "round_used": 1 or 2 or None,
        "results": [...],
        "error": None or error message string
      }
    """
    try:
        client = _get_client()

        # ── ROUND 1: exact search with the full question ──
        round1_results = list(client.search(search_text=question, top=top))
        if round1_results:
            return {
                "found": True,
                "round_used": 1,
                "results": [_format_result(r) for r in round1_results],
                "error": None
            }

        # ── ROUND 2: broader search using extracted key words ──
        keywords = _extract_keywords(question)
        round2_results = list(client.search(search_text=keywords, top=top))
        if round2_results:
            return {
                "found": True,
                "round_used": 2,
                "results": [_format_result(r) for r in round2_results],
                "error": None
            }

        # ── Nothing found in either round ──
        return {
            "found": False,
            "round_used": None,
            "results": [],
            "error": None
        }

    except AzureError as e:
        # Azure Search is unreachable or credentials are wrong
        return {
            "found": False,
            "round_used": None,
            "results": [],
            "error": f"Search service unavailable: {str(e)}"
        }
    except Exception as e:
        # Any other unexpected error
        return {
            "found": False,
            "round_used": None,
            "results": [],
            "error": f"Unexpected error: {str(e)}"
        }


def _format_result(r):
    return {
        "id":       r["id"],
        "title":    r["title"],
        "category": r["category"],
        "content":  r["content"],
        "source":   r.get("source", "")
    }


# ── Quick test when running directly ──
if __name__ == "__main__":
    test_questions = [
        "What is gegenpressing?",
        "Tell me about the 4-3-3 formation",
        "yellow card rules",
        "asdkjqwoieuqwoiueqwoiue",
    ]

    for q in test_questions:
        print(f"\n{'='*60}")
        print(f"Question: {q}")
        result = search_corpus(q)
        if result["error"]:
            print(f"  ERROR: {result['error']}")
        else:
            print(f"Found: {result['found']}  |  Round used: {result['round_used']}")
            for r in result["results"]:
                print(f"  - [{r['category']}] {r['title']}")