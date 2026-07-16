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
    app.run(debug=True, port=5000)