#!/usr/bin/env python3
"""Faithfulness test for the SportScore RAG assistant.

The grounding and injection suites check WHERE an answer came from. Neither
checks whether the answer is actually SUPPORTED by what was retrieved — which
is how the DRS case got through: retrieval correctly returned nothing about
DRS, and the model produced a confident explanation from its own parametric
knowledge anyway, contradicting the corpus (which says DRS was replaced for
2026). A fluent, plausible, unsupported answer is the worst failure mode here,
because nothing about it looks wrong.

This runs the real pipeline in-process (imports get_context_and_meta and
_generate_answer straight from app.py, so the chunks judged are exactly the
chunks that produced the answer), then asks the same deployment to grade the
answer against those chunks alone.

The judge never sees the question. It only sees chunks + answer, and is asked
whether every factual claim in the answer traces back to the chunks. Showing it
the question invites it to reward a "good answer" rather than a supported one.

Run:
  python test_rag_faithfulness.py              # one pass
  python test_rag_faithfulness.py --runs 3     # repeat (output is non-deterministic)
  python test_rag_faithfulness.py --show-context   # dump the chunks too

Exit code is non-zero if any question comes back UNSUPPORTED.
"""
import argparse
import json
import sys
import time

# Importing app.py runs its env-var check and builds the Azure client; that is
# the point — same config, same client, same code path as the running service.
from app import (  # noqa: E402
    DEPLOYMENT,
    _generate_answer,
    classify_question,
    client,
    fast_classify_question,
    get_context_and_meta,
)

# note: covers both indexes, plus the two cases already known to be shaky.
QUESTIONS = [
    ("fb-know",   "What is the offside rule in football?"),
    ("fb-hist",   "Who won the 2022 FIFA World Cup?"),
    ("bb-know",   "How many points is a free throw worth in basketball?"),
    ("bs-know",   "What is a designated hitter in baseball?"),
    ("f1-know",   "What is the Super Licence requirement in F1?"),
    ("bio",       "Who is Michael Jordan?"),
    ("fb-live",   "What are the upcoming Premier League fixtures?"),
    ("bs-live",   "What was the score in the most recent MLB game?"),
    ("f1-live",   "Who won the last F1 race?"),
    # Known corpus gaps — the interesting ones. Both SHOULD come back
    # NO_CLAIMS (an honest "not in the context") rather than a confident
    # answer. UNSUPPORTED here is the bug reproducing.
    ("f1-gap",    "What is DRS in Formula 1?"),
    ("standings", "Who is leading the Premier League right now?"),
]

JUDGE_SYSTEM = """You are grading whether an ANSWER is supported by the SOURCE CHUNKS it was generated from.

Judge ONLY on whether the answer's factual claims appear in the chunks. Do not judge whether the answer is true in the real world, well written, or helpful. An answer can be entirely correct and still fail this check if the chunks do not contain the information.

Verdicts:
- SUPPORTED: every factual claim traces to the chunks.
- PARTIAL: the main claims trace to the chunks, but some specific details (numbers, dates, names, conditions) do not.
- UNSUPPORTED: significant claims do not appear in the chunks at all.
- NO_CLAIMS: the answer makes no factual assertions — it declines, or says the information is not in the context. This is a correct outcome, not a failure.

Reply with ONLY a JSON object, no markdown fences:
{"verdict": "...", "unsupported_claims": ["..."], "reason": "one sentence"}"""


def judge(context, answer):
    prompt = (f"SOURCE CHUNKS:\n{context}\n\n"
              f"ANSWER:\n{answer}\n\n"
              "Grade the answer against the chunks. JSON only.")
    resp = client.chat.completions.create(
        model=DEPLOYMENT,
        messages=[{"role": "system", "content": JUDGE_SYSTEM},
                  {"role": "user", "content": prompt}],
        max_completion_tokens=800,
        reasoning_effort="minimal",
    )
    raw = (resp.choices[0].message.content or "").strip()
    raw = raw.replace("```json", "").replace("```", "").strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {"verdict": "JUDGE_ERROR", "unsupported_claims": [],
                "reason": f"judge did not return JSON: {raw[:120]}"}


def run_one(question, show_context=False):
    category = fast_classify_question(question) or classify_question(question)
    results, _round_used, source_type = get_context_and_meta(question, category)
    context = "\n\n".join(r["content"] for r in results)
    answer = _generate_answer(context, question,
                              is_live=(source_type == "live_data"))
    if show_context:
        print(f"\n--- chunks ({len(results)}) ---")
        for r in results:
            print(f"  [{r.get('category')}] {r.get('title')}")
            print(f"    {' '.join((r.get('content') or '').split())[:200]}...")
    verdict = judge(context, answer) if context.strip() else {
        "verdict": "NO_CONTEXT", "unsupported_claims": [],
        "reason": "retrieval returned nothing at all"}
    return source_type, answer, verdict


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--runs", type=int, default=1)
    ap.add_argument("--show-context", action="store_true")
    args = ap.parse_args()

    print(f"Deployment: {DEPLOYMENT} (judge and generator are the same model)")
    print("=" * 70)

    tally = {}
    bad = 0
    for run in range(1, args.runs + 1):
        if args.runs > 1:
            print(f"\n########## run {run}/{args.runs} ##########")
        for qid, question in QUESTIONS:
            t0 = time.time()
            try:
                source_type, answer, v = run_one(question, args.show_context)
            except Exception as e:  # noqa: BLE001
                source_type, answer = "?", ""
                v = {"verdict": "ERROR", "unsupported_claims": [], "reason": str(e)}
            dt = time.time() - t0

            verdict = v.get("verdict", "?")
            tally[(qid, verdict)] = tally.get((qid, verdict), 0) + 1
            if verdict in ("UNSUPPORTED", "ERROR", "JUDGE_ERROR"):
                bad += 1

            snippet = " ".join((answer or "").split())
            if len(snippet) > 200:
                snippet = snippet[:200] + "..."
            print(f"\n[{verdict}] {qid}  source={source_type}  {dt:.2f}s")
            print(f"   why : {v.get('reason')}")
            for c in (v.get("unsupported_claims") or []):
                print(f"   !!  : {c}")
            print(f"   Q   : {question}")
            print(f"   A   : {snippet}")
            print("-" * 70)

    print("\nTALLY (question -> verdict counts)")
    for (qid, verdict), n in sorted(tally.items()):
        print(f"  {n}x  {qid:10s} {verdict}")
    print("\nUNSUPPORTED/ERROR total:", bad)
    print("Note: PARTIAL is worth reading by eye — the judge is a heuristic too.")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())