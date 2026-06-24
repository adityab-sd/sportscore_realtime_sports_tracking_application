"""
app.py — Flask API for the SportScore Knowledge Assistant

Endpoints:
  POST /ask    { "question": "..." }  ->  JSON response
  GET  /health -> service status

Flow:
  1. Check if question is a live data question → route away
  2. Run two-round search against Azure AI Search
  3. If search error → return service error message
  4. If found → return retrieved content (placeholder until OpenAI connected)
  5. If not found → return fallback message
"""

from flask import Flask, request, jsonify
from search import search_corpus

app = Flask(__name__)

# ── LIVE DATA KEYWORDS ───────────────────────────────────
LIVE_DATA_KEYWORDS = {
    "score", "scores", "result", "results", "today", "yesterday",
    "tonight", "now", "live", "playing", "currently", "latest",
    "fixture", "fixtures", "standings", "table", "who won", "did they win",
    "match today", "game today", "kick off", "kickoff", "qualify", "qualified"
}


def is_live_data_question(question):
    q = question.lower()
    return any(keyword in q for keyword in LIVE_DATA_KEYWORDS)


# ── MAIN ENDPOINT ────────────────────────────────────────
@app.route("/ask", methods=["POST"])
def ask():
    data = request.get_json(silent=True) or {}
    question = data.get("question", "").strip()

    if not question:
        return jsonify({
            "error": "Missing 'question' field in request body"
        }), 400

    # ── STEP 1: Route live data questions away ──
    if is_live_data_question(question):
        return jsonify({
            "question":   question,
            "answer":     "This question requires live match data. Please check the live scores section of SportScore.",
            "grounded":   False,
            "routed_to":  "live_data_layer"
        })

    # ── STEP 2: Run two-round search ──
    result = search_corpus(question)

    # ── STEP 3: Handle search service error ──
    if result["error"]:
        return jsonify({
            "question": question,
            "answer":   "The knowledge service is temporarily unavailable. Please try again shortly.",
            "grounded": False,
            "error":    result["error"]
        }), 503

    # ── STEP 4: Nothing found after both rounds ──
    if not result["found"]:
        return jsonify({
            "question": question,
            "answer":   "I don't have information about that in the sports knowledge base.",
            "grounded": False,
            "sources":  []
        })

    # ── STEP 5: Return answer ──
    # TODO: Once Azure OpenAI quota is approved, replace this block with:
    #
    #   context = "\n\n".join(r["content"] for r in result["results"])
    #   prompt = build_prompt(context, question)   # from prompts.py
    #   answer = call_openai(prompt)               # from openai_client.py
    #
    top_result = result["results"][0]

    return jsonify({
        "question":   question,
        "answer":     top_result["content"],
        "grounded":   True,
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
    app.run(debug=True, port=5000)