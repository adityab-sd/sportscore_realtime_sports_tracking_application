#!/usr/bin/env python3
"""Live match "what's significant so far" blurb generator.

Separate from /ask on purpose. /ask answers a question someone typed; this
produces a short line the UI can show beside a live match with no question
asked. Different trigger, different output, and keeping it separate means the
grounding / injection / faithfulness suites for /ask stay valid untouched.

Generated ON DEMAND, not in the updaters: the updaters cycle every 30s across
hundreds of matches, so generating there would mean thousands of model calls an
hour for blurbs nobody reads.

NOTE ON SCOPE: the live docs contain scoreline + period only (no play-by-play
or commentary). So a blurb can say "tied 2-2 heading to extra innings" but
cannot say "after escaping a bases-loaded jam in the 8th". Richer blurbs would
need the updaters to store per-play detail first.

Usage from app.py:
    from live_summary import summarise_live_match
    result = summarise_live_match(question_or_match_name)
"""
import hashlib
import os
import re

from openai import AzureOpenAI

from search import LIVE_INDEX, _get_client

DEPLOYMENT = os.getenv("AZURE_OPENAI_DEPLOYMENT")

_client = AzureOpenAI(
    api_key=os.getenv("AZURE_OPENAI_KEY"),
    api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2024-12-01-preview"),
    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
)

# Cache keyed on a hash of the doc's CONTENT, so it invalidates automatically
# the moment the score or period changes — no TTL to tune, and ten people
# viewing the same match cost one model call.
_cache = {}
_CACHE_MAX = 200

BLURB_PROMPT = """You write one short line about a live sports match for a scoreboard app.

Given the match state below, say what is SIGNIFICANT about it right now — is it close, a blowout, level late, an upset in progress, into extra time? Lead with what a fan would care about.

Rules:
- ONE sentence, under 25 words.
- Use ONLY the state given. Do not invent plays, players, statistics, or events.
- If the state is unremarkable (early, level, nothing notable), say so plainly rather than inventing drama.
- No preamble, no "here's a summary", just the line.

MATCH STATE:
{state}

LINE:"""


def _find_live_doc(query):
    """Find the live match doc best matching the query.

    Filters server-side to in-progress docs rather than pulling the whole
    index, then scores on word overlap with the query.
    """
    client = _get_client(LIVE_INDEX)
    docs = list(client.search(search_text=query or "*", top=40))
    q_words = set(re.findall(r"[a-z0-9']+", (query or "").lower()))

    best, best_score = None, -1
    for d in docs:
        content = str(d.get("content") or "")
        if "currently live" not in content.lower() and "in progress" not in content.lower():
            continue
        text = (str(d.get("title") or "") + " " + content).lower()
        score = len(q_words & set(re.findall(r"[a-z0-9']+", text)))
        if score > best_score:
            best, best_score = d, score
    return best


def summarise_live_match(query):
    """Return {'found', 'match', 'state', 'blurb', 'cached'} for a live match."""
    doc = _find_live_doc(query)
    if not doc:
        return {"found": False, "match": None, "state": None,
                "blurb": None, "cached": False}

    state = " ".join(str(doc.get("content") or "").split())
    title = str(doc.get("title") or "")
    key = hashlib.sha256(state.encode()).hexdigest()

    if key in _cache:
        return {"found": True, "match": title, "state": state,
                "blurb": _cache[key], "cached": True}

    try:
        resp = _client.chat.completions.create(
            model=DEPLOYMENT,
            messages=[{"role": "user", "content": BLURB_PROMPT.format(state=state)}],
            max_completion_tokens=300,
            reasoning_effort="minimal",
        )
        blurb = (resp.choices[0].message.content or "").strip()
    except Exception:  # noqa: BLE001
        return {"found": True, "match": title, "state": state,
                "blurb": None, "cached": False,
                "error": "summary temporarily unavailable"}

    if len(_cache) >= _CACHE_MAX:
        _cache.clear()  # crude but bounded; entries are cheap to regenerate
    _cache[key] = blurb

    return {"found": True, "match": title, "state": state,
            "blurb": blurb, "cached": False}


if __name__ == "__main__":
    import sys
    q = " ".join(sys.argv[1:]) or "live MLB game"
    r = summarise_live_match(q)
    if not r["found"]:
        print(f"no live match found for: {q}")
    else:
        print(f"MATCH : {r['match']}")
        print(f"STATE : {r['state'][:160]}")
        print(f"BLURB : {r['blurb']}   (cached={r['cached']})")