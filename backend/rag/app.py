"""
app.py - Flask API for the SportScore Knowledge Assistant

Exposes a single endpoint:
  POST /ask   { "question": "..." }  ->  JSON response

Current behaviour (until Azure OpenAI quota is approved):
  - Runs the two-round search from search.py
  - If results are found, returns the retrieved corpus entries directly
    as a placeholder "answer" (raw retrieval, not yet GPT-generated)
  - If nothing is found, returns a fallback message

Once Azure OpenAI is unblocked, the TODO section below gets replaced
with an actual call to GPT-4o using the retrieved entries as context.
app.py — Flask API for the SportScore Knowledge Assistant
"""

from flask import Flask, request, jsonify
from search import search_corpus
from prompts import build_prompt
from openai import AzureOpenAI
from dotenv import load_dotenv
import os

load_dotenv()

app = Flask(__name__)

# ── Azure OpenAI client ───────────────────────────────────
# PLEASE review — missing case: none of these env vars are validated. If AZURE_OPENAI_KEY /
# ENDPOINT / DEPLOYMENT are unset the client builds with None and fails deep inside the first
# /ask request with an opaque error instead of failing fast at startup.
# EXAMPLE:
#   required = ["AZURE_OPENAI_KEY", "AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_DEPLOYMENT"]
#   missing = [v for v in required if not os.getenv(v)]
#   if missing: raise RuntimeError(f"Missing env vars: {', '.join(missing)}")
client = AzureOpenAI(
    api_key=os.getenv("AZURE_OPENAI_KEY"),
    api_version="2024-02-01",
    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT")
)
DEPLOYMENT = os.getenv("AZURE_OPENAI_DEPLOYMENT")

# ── LIVE DATA KEYWORDS ───────────────────────────────────
LIVE_DATA_KEYWORDS = {
    "score", "scores", "result", "results", "today", "yesterday",
    "tonight", "now", "live", "playing", "currently", "latest",
    "fixture", "fixtures", "standings", "table", "who won", "did they win",
    "match today", "game today", "kick off", "kickoff", "qualify", "qualified"
}

# ============================================================================
# PLEASE review — substring matching causes false positives (missing case):
# `keyword in q` matches inside other words, so "now" matches "k-now-n" (known) and
# "knowledge", "table" matches "comfortable", "score" matches "scoreless". Innocent
# knowledge questions get misrouted to the live-data layer and never answered.
# EXAMPLE — match whole words / phrases:
#   import re
#   tokens = set(re.findall(r"[a-z']+", question.lower()))
#   single = {"score","live","now","today",...}          # single-word triggers
#   phrases = {"who won","did they win","match today",...} # multi-word triggers
#   return bool(tokens & single) or any(p in question.lower() for p in phrases)
# ============================================================================
def is_live_data_question(question):
    q = question.lower()
    return any(keyword in q for keyword in LIVE_DATA_KEYWORDS)


# ── MAIN ENDPOINT ────────────────────────────────────────
@app.route("/ask", methods=["POST"])
def ask():
    data = request.get_json(silent=True) or {}
    question = data.get("question", "").strip()

    if not question:
        return jsonify({"error": "Missing 'question' field in request body"}), 400

    # Step 1: Route live data questions away
    if is_live_data_question(question):
        return jsonify({
            "question": question,
            "answer": "This question requires live match data. Please check the live scores section of SportScore.",
            "grounded": False,
            "routed_to": "live_data_layer"
        })

    # Step 2: Search corpus
    result = search_corpus(question)

    if not result["found"]:
        return jsonify({
            "question": question,
            "answer": "I don't have information about that in the sports knowledge base.",
            "grounded": False,
            "sources": []
        })

    # Step 3: Build prompt and call OpenAI
    context = "\n\n".join(r["content"] for r in result["results"])
    prompt = build_prompt(context, question)

    # ============================================================================
    # PLEASE review — missing error handling: this network call is unguarded, so any
    # rate-limit / quota / timeout / auth failure bubbles up as a 500 + stack trace to
    # the caller. Wrap it and degrade gracefully.
    # Also verify the token param: Azure OpenAI chat.completions expects `max_tokens`;
    # `max_completion_tokens` is only for newer o-series models and errors on gpt-4o.
    # EXAMPLE:
    #   try:
    #       response = client.chat.completions.create(model=DEPLOYMENT,
    #           messages=[{"role": "user", "content": prompt}], max_tokens=500)
    #   except Exception:
    #       app.logger.exception("OpenAI call failed")
    #       return jsonify({"error": "assistant temporarily unavailable"}), 502
    # ============================================================================
    response = client.chat.completions.create(
        model=DEPLOYMENT,
        messages=[{"role": "user", "content": prompt}],
        max_completion_tokens=500,
    )
    answer = response.choices[0].message.content.strip()

    return jsonify({
        "question": question,
        "answer": answer,
        "grounded": True,
        "round_used": result["round_used"],
        "sources": [
            {"title": r["title"], "category": r["category"]}
            for r in result["results"]
        ]
    })


# ── HEALTH CHECK ─────────────────────────────────────────
@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "sportscore-rag"})


if __name__ == "__main__":
    # PLEASE review — SECURITY: debug=True enables the Werkzeug interactive debugger, which
    # allows arbitrary code execution if the port is reachable. Never enable in production;
    # drive it from an env var (default False) and bind the host explicitly.
    # EXAMPLE:
    #   app.run(host="127.0.0.1", port=int(os.getenv("PORT", "5000")),
    #           debug=os.getenv("FLASK_DEBUG", "false").lower() == "true")
    app.run(debug=True, port=5000)