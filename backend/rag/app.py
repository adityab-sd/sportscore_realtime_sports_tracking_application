"""
app.py — Flask API for the SportScore Knowledge Assistant
"""

from flask import Flask, request, jsonify
from search import search_corpus, search_live_corpus, search_fallback_anything
from prompts import build_prompt
from openai import AzureOpenAI
from dotenv import load_dotenv
import os

load_dotenv()

required_vars = ["AZURE_OPENAI_KEY", "AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_DEPLOYMENT",
                  "AZURE_SEARCH_ENDPOINT", "AZURE_SEARCH_KEY"]
missing = [v for v in required_vars if not os.getenv(v)]
if missing:
    raise RuntimeError(f"Missing required environment variables: {', '.join(missing)}")

app = Flask(__name__)

client = AzureOpenAI(
    api_key=os.getenv("AZURE_OPENAI_KEY"),
    api_version="2024-02-01",
    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT")
)
DEPLOYMENT = os.getenv("AZURE_OPENAI_DEPLOYMENT")


def classify_question(question):
    classification_prompt = f"""Classify the following sports question into exactly one category.

Reply with ONLY one word: "live" or "knowledge"

- "live" = ANY question asking about the outcome, result, score, or status of a specific match or tournament — including "who won X", "what was the score of X", "did X win", standings, fixtures, qualifiers, rankings, recent news, transfers. If the question asks about a real event, match, or competition result (even a past one, even a named tournament like "the World Cup 2026" or "the Premier League"), it is "live", NOT "knowledge".
- "knowledge" = ONLY questions about rules, formations, strategies, definitions, or how something works in general — with no reference to a specific match, team result, or tournament outcome.

Examples:
"Who won the World Cup 2026?" -> live
"What is the format of the World Cup?" -> knowledge
"What is offside?" -> knowledge
"Did Portugal win their last match?" -> live

Question: {question}

Category:"""

    try:
        response = client.chat.completions.create(
            model=DEPLOYMENT,
            messages=[{"role": "user", "content": classification_prompt}],
            max_completion_tokens=150
        )
        answer = response.choices[0].message.content.strip().lower()
        return "live" if "live" in answer else "knowledge"
    except Exception:
        app.logger.exception("Classification call failed or was blocked by content filter")
        return "knowledge"  


def _generate_answer(context, question):
    """Shared helper: builds the prompt and calls gpt-5-mini."""
    prompt = build_prompt(context, question)
    try:
        response = client.chat.completions.create(
            model=DEPLOYMENT,
            messages=[{"role": "user", "content": prompt}],
            max_completion_tokens=1500,
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
    """
    if category == "live":
        primary = search_live_corpus(question)
        if primary["found"]:
            return primary["results"], primary["round_used"], "live_data"
        secondary = search_corpus(question)
        if secondary["found"]:
            return secondary["results"], secondary["round_used"], "knowledge_base"
    else:
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
    data = request.get_json(silent=True) or {}
    question = data.get("question", "").strip()

    if not question:
        return jsonify({"error": "Missing 'question' field in request body"}), 400

    category = classify_question(question)
    results, round_used, source_type = get_context_and_meta(question, category)

    context = "\n\n".join(r["content"] for r in results)
    answer = _generate_answer(context, question)

    return jsonify({
        "question": question,
        "answer": answer,
        "grounded": True,
        "round_used": round_used,
        "source_type": source_type,
        "sources": _relevant_sources(results, answer)
    })


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "sportscore-rag"})


if __name__ == "__main__":
    debug_mode = os.getenv("FLASK_DEBUG", "false").lower() == "true"
    app.run(host="127.0.0.1", port=int(os.getenv("PORT", "5000")), debug=debug_mode)