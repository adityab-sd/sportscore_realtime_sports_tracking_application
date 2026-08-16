#!/usr/bin/env python3
"""Grounding + classifier-routing smoke test for the SportScore RAG assistant.

This is the SportScore-specific version of rag_smoketest.py. It does NOT use
Azure OpenAI "On Your Data" (`data_sources`), because SportScore does its own
retrieval: pgvector over `sports_corpus` for the knowledge base, plus Azure AI
Search `football-live-index` for live data, stitched together in
get_context_and_meta(). So the only meaningful test target is the service's own
HTTP surface.

It sends POST {"question": ...} to the Flask RAG service (/ask) or, with
--gateway, to the Spring Boot proxy (/api/ask), and checks:
  * that an answer came back at all
  * WHICH index served it (source_type), i.e. did the classifier route correctly
  * that sources[] is non-empty (the closest thing to a citation the API returns)

Note: the API's `grounded` field is hardcoded True in app.py, so it is ignored
here. `source_type` + `sources` are the real grounding signal.

Run:
  python test_rag_grounding.py                                # full suite
  python test_rag_grounding.py "What is the offside rule?"    # one-shot
  python test_rag_grounding.py -i                             # interactive
  python test_rag_grounding.py --base http://127.0.0.1:8081 --gateway

Exit code is non-zero if any suite case FAILs (usable in CI).
"""
import argparse
import json
import sys
import time
import urllib.error
import urllib.request

# (id, question, expected_source_type)
# expected_source_type is what the classifier + fallback chain SHOULD land on.
SUITE = [
    ("fb-know",  "What is the offside rule in football?",            "knowledge_base"),
    ("fb-live",  "What are the upcoming Premier League fixtures?",   "live_data"),
    ("fb-hist",  "Who won the 2022 FIFA World Cup?",                 "knowledge_base"),
    ("bb-know",  "How many points is a free throw worth in basketball?", "knowledge_base"),
    ("bb-live",  "What are the upcoming matches in basketball?",     "live_data"),
    ("bs-know",  "What is a designated hitter in baseball?",         "knowledge_base"),
    ("bs-live",  "What was the score in the most recent MLB game?",  "live_data"),
    ("f1-know",  "What is the Super Licence requirement in F1?",     "knowledge_base"),
    ("f1-live",  "Who won the last F1 race?",                        "live_data"),
    ("bio",      "Who is Michael Jordan?",                           "knowledge_base"),
    ("standings", "Who is leading the Premier League right now?",    "live_data"),
]


def ask(base, path, question, timeout):
    payload = json.dumps({"question": question}).encode()
    req = urllib.request.Request(
        base.rstrip("/") + path,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    t0 = time.time()
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        body = json.loads(resp.read().decode())
    return body, time.time() - t0


def show(body, dt, verbose=True):
    answer = (body.get("answer") or "").strip()
    src_type = body.get("source_type")
    sources = body.get("sources") or []
    if verbose:
        print(f"\nANSWER:\n{answer}\n")
    print(f"source_type={src_type}  round_used={body.get('round_used')}  sources={len(sources)}  {dt:.2f}s")
    for s in sources:
        print(f"   - [{s.get('category')}] {s.get('title')}")
    if not sources:
        print("   (no sources -> retrieval returned nothing usable; check pgvector "
              "threshold, the live index, or whether the corpus was ingested)")


def judge(body, expected):
    answer = (body.get("answer") or "").strip()
    src_type = body.get("source_type")
    sources = body.get("sources") or []

    if not answer:
        return "FAIL", "empty answer"
    if "temporarily unavailable" in answer.lower():
        return "FAIL", "model call failed inside _generate_answer (check Azure logs)"
    if src_type == "fallback":
        return "FAIL", "hit search_fallback_anything() — neither index matched"
    if not sources:
        return "FAIL", "answered with no sources"
    if expected and src_type != expected:
        return "ROUTE", f"answered from {src_type}, expected {expected} — classifier misroute"
    return "PASS", f"grounded in {src_type}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("question", nargs="*", help="one-shot question (omit to run the suite)")
    ap.add_argument("--base", default="http://127.0.0.1:5000",
                    help="service base URL (default Flask http://127.0.0.1:5000)")
    ap.add_argument("--gateway", action="store_true",
                    help="hit the Spring proxy /api/ask instead of Flask /ask")
    ap.add_argument("--timeout", type=float, default=90.0)
    ap.add_argument("-i", "--interactive", action="store_true")
    args = ap.parse_args()

    path = "/api/ask" if args.gateway else "/ask"
    print(f"Target: {args.base.rstrip('/')}{path}")
    print("-" * 70)

    one_shot = " ".join(args.question).strip()
    if one_shot:
        body, dt = ask(args.base, path, one_shot, args.timeout)
        show(body, dt)
        return 0

    if args.interactive:
        print("Ask a question (or 'exit').")
        while True:
            try:
                q = input("you> ").strip()
            except (EOFError, KeyboardInterrupt):
                print()
                return 0
            if not q:
                continue
            if q.lower() in ("exit", "quit", ":q"):
                return 0
            try:
                body, dt = ask(args.base, path, q, args.timeout)
                show(body, dt)
            except Exception as e:  # noqa: BLE001
                print(f"[error] {e}")
            print("-" * 70)

    results = []
    for tid, question, expected in SUITE:
        try:
            body, dt = ask(args.base, path, question, args.timeout)
            status, why = judge(body, expected)
        except urllib.error.HTTPError as e:
            body, dt = {"answer": ""}, 0.0
            status, why = "ERROR", f"HTTP {e.code}: {e.read().decode()[:120]}"
        except Exception as e:  # noqa: BLE001
            body, dt = {"answer": ""}, 0.0
            status, why = "ERROR", str(e)

        results.append(status)
        snippet = " ".join((body.get("answer") or "").split())
        if len(snippet) > 220:
            snippet = snippet[:220] + "..."
        print(f"[{status}] {tid}  expect={expected}  got={body.get('source_type')}  {dt:.2f}s")
        print(f"   why : {why}")
        print(f"   Q   : {question}")
        print(f"   A   : {snippet}")
        print("-" * 70)

    fails = results.count("FAIL") + results.count("ERROR")
    routes = results.count("ROUTE")
    print(f"SUMMARY: {results.count('PASS')} PASS | {routes} ROUTE | {fails} FAIL/ERROR "
          f"(of {len(results)})")
    if routes:
        print("=> ROUTE means the answer was grounded but came from the wrong index. "
              "Fix in fast_classify_question(): add the missing word to LIVE_SIGNALS/"
              "KNOWLEDGE_SIGNALS, or let it return None so the LLM classifier decides.")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())