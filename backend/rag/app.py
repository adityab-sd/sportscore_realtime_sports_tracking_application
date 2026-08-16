"""
app.py — Flask API for the SportScore RAG assistant
"""

from flask import Flask, request, jsonify
from search import search_corpus, search_live_corpus, search_fallback_anything, detect_date_range, search_live_by_date
from prompts import build_prompt
from openai import AzureOpenAI
from dotenv import load_dotenv
import os
import re
import time
from datetime import datetime
from live_summary import summarise_live_match

load_dotenv()

required_vars = ["AZURE_OPENAI_KEY", "AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_DEPLOYMENT",
                  "AZURE_SEARCH_ENDPOINT", "AZURE_SEARCH_KEY"]
missing = [v for v in required_vars if not os.getenv(v)]
if missing:
    raise RuntimeError(f"Missing required environment variables: {', '.join(missing)}")

app = Flask(__name__)

@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "POST, GET, OPTIONS"
    return response

client = AzureOpenAI(
    api_key=os.getenv("AZURE_OPENAI_KEY"),
    api_version="2024-02-01",
    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT")
)
DEPLOYMENT = os.getenv("AZURE_OPENAI_DEPLOYMENT")

CURRENT_YEAR = datetime.now().year  # used by fast_classify_question's year heuristic

# Words that reliably signal a definition/rules/bio question (always "knowledge"),
# vs. words that reliably signal a current/right-now question (always "live").
KNOWLEDGE_STARTERS = ("what is", "what's", "what are", "how does", "how do", "explain", "define", "who is", "who was", "how many",
                      "how is", "how are")

KNOWLEDGE_SIGNALS = ("all-time", "all time", "record", "history of", "who holds", "most decorated", "biggest", "greatest of all",
                     "the most", "won the most", "has won the most")

LIVE_SIGNALS = ("today", "tonight", "this week", "right now", "currently", "live score", "at the moment", "this season", "latest", 
                "last race", "last game", "last match", "most recent", "standings", "current standing", "next", "now", "play next",
                 "playing next", "playing", "live", 
                 # ADDED: fixture/match/upcoming words so "upcoming matches in basketball",
                 # "fixtures", "who scored", "next game", etc. route to the LIVE index (not the
                 # knowledge corpus). This was the bug: "upcoming" wasn't here, so basketball/
                 # baseball fixture questions were misrouted to Postgres and returned format info.
                 "upcoming", "fixture", "fixtures", "schedule", "scheduled", "match", "matches","game", "games", "race", "races", 
                 "scorer", "kickoff", "leading", "top scorer", "who scored", "score")

def fast_classify_question(question):
    """
    Rule-based pre-classifier that skips the classify_question() LLM call
    (~1.6-1.7s per the timing logs) for questions with an obvious, high-
    confidence answer. Returns "live", "knowledge", or None if genuinely
    ambiguous — callers must fall back to the LLM classifier when None is
    returned, rather than guessing.

    This does NOT replace classify_question()'s nuanced logic (e.g. "who
    won the 2022 World Cup" vs "who won the World Cup 2026") — it only
    shortcuts the clearly-obvious cases, so the carefully-tuned LLM
    behavior is preserved for anything ambiguous.

    Tested against 12 representative questions before shipping (see chat
    history) — LIVE_SIGNALS is checked FIRST, before KNOWLEDGE_STARTERS,
    because an explicit "today"/"right now" is the strongest possible
    signal and must win even when the question also happens to start with
    a knowledge-style phrase like "what is" or "who is" (e.g. "what is
    the live score for today's match?" must be "live", not "knowledge").
    """
    q_lower = question.lower().strip()

    if any(signal in q_lower for signal in LIVE_SIGNALS):
        return "live"

    if any(q_lower.startswith(starter) for starter in KNOWLEDGE_STARTERS):
        # "who is X" is normally a bio question (knowledge) — EXCEPT "who
        # is leading/the leader in X", which is a live standings question,
        # not a biography. That specific pattern must fall through to the
        # LLM classifier below (which already handles it correctly via its
        # "Who is leading the Premier League right now?" -> live example),
        # rather than being short-circuited here.
        is_who_is_leading = q_lower.startswith(("who is", "who's", "who are")) and any(
            w in q_lower for w in ("leading", "leader", "top of", "first place")
        )
        if is_who_is_leading:
            return "live"
        return "knowledge"

    if any(signal in q_lower for signal in KNOWLEDGE_SIGNALS):
        return "knowledge"

    # A year clearly in the past (2 + years ago) with no "live" wording
    # is very likely a settled historical result, e.g. "who won the 2022
    # World Cup" — recent/current years (this year or last year) are left
    # ambiguous on purpose and fall through to the LLM, since "who won the
    # World Cup 2026" needs the nuanced live-vs-settled judgment call.
    years_mentioned = [int(y) for y in re.findall(r"\b(?:19|20)\d{2}\b", q_lower)]
    if years_mentioned and not any(signal in q_lower for signal in LIVE_SIGNALS):
        most_recent_year_mentioned = max(years_mentioned)
        if most_recent_year_mentioned <= CURRENT_YEAR - 2:
            return "knowledge"

    return None  # ambiguous — let the LLM decide


def classify_question(question):
    classification_prompt = f"""Classify the following sports question into exactly one category.

Reply with ONLY one word: "live" or "knowledge"

- "live" = questions about the outcome, score, or status of a SPECIFIC recent/current match, fixture, or ongoing competition — including "who won X" (a specific recent game), "what was the score of X", standings RIGHT NOW, upcoming fixtures, recent transfers. This is for things that change week to week and need current data.
- "knowledge" = questions about rules, formations, strategies, definitions, player/team biographical info, or ALL-TIME/HISTORICAL records and milestones — even if phrased as "who won X". This includes: "who has won the most X (ever/all-time)", "who holds the record for X", "who is the all-time leading Y", player profiles ("who is X"), team history, and named historical tournament results (e.g. "who won the 2022 World Cup" — a specific past, settled event, not a live/current one).

The key distinction for "who won/has won" phrasing: if the question is asking about an ALL-TIME record, a named historical year/tournament, or general career achievement, it's "knowledge" — that's where player bios, team profiles, and record-holder data now live. Only classify as "live" if the question is genuinely about a current or very recent result, standings, or fixture that needs up-to-the-minute data.

Examples:
"Who won the World Cup 2026?" -> live (a specific, recent tournament — treat as needing current/live data)
"Who has won the most Champions League titles?" -> knowledge (all-time record, not a live score)
"Who holds the NBA all-time scoring record?" -> knowledge (all-time record)
"Who is Michael Jordan?" -> knowledge (player biography)
"What is the format of the World Cup?" -> knowledge
"What is offside?" -> knowledge
"Did Portugal win their last match?" -> live (a specific recent game result)
"Who is leading the Premier League right now?" -> live (current standings)
"Who won the 2022 FIFA World Cup?" -> knowledge (named historical event, settled record)

Question: {question}

Category:"""

    try:
        response = client.chat.completions.create(
            model=DEPLOYMENT,
            messages=[{"role": "user", "content": classification_prompt}],
            max_completion_tokens=150,
            reasoning_effort="minimal"
        )
        answer = response.choices[0].message.content.strip().lower()
        return "live" if "live" in answer else "knowledge"
    except Exception:
        app.logger.exception("Classification call failed or was blocked by content filter")
        return "knowledge"

def _generate_answer(context, question, is_live=True):
    """Shared helper: builds the prompt and calls gpt-5-mini."""
    prompt = build_prompt(context, question, is_live=is_live)
    try:
        response = client.chat.completions.create(
            model=DEPLOYMENT,
            messages=[{"role": "user", "content": prompt}],
            max_completion_tokens=1500,  
            reasoning_effort="minimal"
            # every real answer seen in testing has been well under this
        )
        return response.choices[0].message.content.strip()
    except Exception:
        app.logger.exception("OpenAI call failed")
        return "Sorry, the assistant is temporarily unavailable. Please try again shortly."


def _relevant_sources(results, answer):
    """Keep only sources whose team names appear in the answer text."""
    answer_lower = answer.lower()
    filtered = []
    for r in results:
        title = r["title"]
        match_part = title.split("—")[0]
        words = [w.strip(".,") for w in match_part.split() if len(w.strip(".,")) > 3]
        if any(word.lower() in answer_lower for word in words):
            filtered.append(r)
    if not filtered and results:
        filtered = [results[0]]
    return [{"title": r["title"], "category": r["category"]} for r in filtered]


def get_context_and_meta(question, category):
    """
    Chained fallback so the assistant almost never comes up empty:
      1. Try the classified index first (live or knowledge)
      2. If nothing found, try the OTHER index
      3. If still nothing, grab whatever is available from any index
         (absolute last resort — should rarely trigger)

    ADDITIONAL CHECK: if classified as "knowledge" but the question
    mentions a recent year (this year or last year), ALSO check the live
    index FIRST — since Postgres/pgvector's similarity search can grab a
    topically-related but wrong-year historical entry (e.g. matching
    "who won the World Cup 2026?" to the "2022 FIFA World Cup" record,
    since both mention "World Cup") with no signal telling it the year
    is wrong. If the live index has a genuinely relevant match, it's
    preferred over the knowledge-base result.

    KNOWN LIMITATION: this only helps when a year is explicitly
    mentioned in the question. A phrasing like "what was the score
    between Spain and Argentina?" (no year) doesn't trigger this check.
    """
    years_mentioned = [int(y) for y in re.findall(r"\b(?:19|20)\d{2}\b", question.lower())]
    mentions_recent_year = any(y >= CURRENT_YEAR - 1 for y in years_mentioned)


    if category == "live":
        date_range = detect_date_range(question)
        if date_range:
            primary = search_live_by_date(question, date_range[0], date_range[1])
        else:
            primary = search_live_corpus(question)
        if primary["found"]:
            return primary["results"], primary["round_used"], "live_data"
        secondary = search_corpus(question)
        if secondary["found"]:
            return secondary["results"], secondary["round_used"], "knowledge_base"
    else:
        if mentions_recent_year:
            live_check = search_live_corpus(question)
            if live_check["found"]:
                return live_check["results"], live_check["round_used"], "live_data"

        primary = search_corpus(question)
        if primary["found"]:
            return primary["results"], primary["round_used"], "knowledge_base"
        secondary = search_live_corpus(question)
        if secondary["found"]:
            return secondary["results"], secondary["round_used"], "live_data"

    fallback = search_fallback_anything()
    return fallback["results"], fallback["round_used"], "fallback"

# ── MAIN ENDPOINT ────────────────────────────────────────
@app.route("/ask", methods=["POST"])
def ask():
    t0 = time.time()
    data = request.get_json(silent=True) or {}
    question = data.get("question", "").strip()

    if not question:
        return jsonify({"error": "Missing 'question' field in request body"}), 400

    # Optional conversation history: [{"role": "user"|"assistant", "content": ...}]
    # Follow-ups like "when was it held?" carry no content words, so retrieval
    # drops to fallback or matches something unrelated. Prepending the previous
    # USER turn to the RETRIEVAL query only (never to the model prompt) recovers
    # the right chunks with no extra model call.
    history = data.get("history") or []
    prev_user = ""
    for turn in reversed(history):
        if isinstance(turn, dict) and turn.get("role") == "user":
            prev_user = (turn.get("content") or "").strip()[:300]
            break
    retrieval_query = f"{prev_user} {question}".strip() if prev_user else question

    category = fast_classify_question(retrieval_query)
    if category is None:
        category = classify_question(retrieval_query)  # LLM fallback for ambiguous cases
        classify_source = "llm"
    else:
        classify_source = "fast-path"
    t1 = time.time()
    print(f"[TIMING] classify ({classify_source}): {t1 - t0:.2f}s -> '{category}'")

    results, round_used, source_type = get_context_and_meta(retrieval_query, category)
    t2 = time.time()
    print(f"[TIMING] get_context_and_meta ({source_type}): {t2 - t1:.2f}s")

    # An answer is only "grounded" if a real index served it AND that index
    # returned rows. source_type == "fallback" means search_fallback_anything()
    # ran because neither the knowledge corpus nor the live index matched, so
    # whatever the model says next is not supported by retrieval.
    grounded = bool(results) and source_type != "fallback"

    context = "\n\n".join(r["content"] for r in results)
    answer = _generate_answer(context, question, is_live=(source_type == "live_data"))
    t3 = time.time()
    print(f"[TIMING] _generate_answer: {t3 - t2:.2f}s")
    print(f"[TIMING] TOTAL: {t3 - t0:.2f}s")

    return jsonify({
        "question": question,
        "answer": answer,
        "grounded": grounded,
        "round_used": round_used,
        "source_type": source_type,
        "sources": _relevant_sources(results, answer)
    })


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "sportscore-rag"})

@app.route("/live-summary", methods=["POST"])
def live_summary():
    data = request.get_json(silent=True) or {}
    query = (data.get("match") or data.get("question") or "").strip()
    if not query:
        return jsonify({"error": "Missing 'match' field in request body"}), 400
    return jsonify(summarise_live_match(query))

if __name__ == "__main__":
    debug_mode = os.getenv("FLASK_DEBUG", "false").lower() == "true"
    app.run(host="127.0.0.1", port=int(os.getenv("PORT", "5000")), debug=debug_mode, use_reloader=False)