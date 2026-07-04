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
"""

from flask import Flask, request, jsonify
from search import search_corpus

app = Flask(__name__)


@app.route("/ask", methods=["POST"])
def ask():
    data = request.get_json(silent=True) or {}
    question = data.get("question", "").strip()

    if not question:
        return jsonify({
            "error": "Missing 'question' field in request body"
        }), 400

    result = search_corpus(question)

    if not result["found"]:
        return jsonify({
            "question": question,
            "answer": "I don't have information about that in the sports knowledge base.",
            "grounded": False,
            "sources": []
        })

    # ── TODO: Once Azure OpenAI quota is approved ──
    # Replace this placeholder block with a real call to GPT-4o:
    #
    #   context = "\n\n".join(r["content"] for r in result["results"])
    #   prompt = build_prompt(context, question)   # from prompts.py
    #   answer = call_openai(prompt)                # from openai_client.py
    #
    # For now, we return the top retrieved entry's content directly
    # so the API is testable end-to-end without the model connected.
    top_result = result["results"][0]

    return jsonify({
        "question": question,
        "answer": top_result["content"],
        "grounded": True,
        "round_used": result["round_used"],
        "sources": [
            {"title": r["title"], "category": r["category"]}
            for r in result["results"]
        ]
    })


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "sportscore-rag"})


if __name__ == "__main__":
    app.run(debug=True, port=5000)