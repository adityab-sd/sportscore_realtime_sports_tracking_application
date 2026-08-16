#!/usr/bin/env python3
"""Multi-turn / follow-up test for the SportScore RAG assistant.

/ask is stateless: the frontend (askAssistant in lib/api/rag.ts) posts only
{"question": ...}, the Spring proxy forwards that one field, and Flask reads
only that field. The UI keeps ChatMessage[] for rendering, so the conversation
LOOKS continuous to the user while every turn is answered in isolation.

This measures the gap. Each case is a natural first question plus a follow-up
that only makes sense given the first answer ("when was that?"). The follow-up
passes if the answer contains the expected anchor term.

Run this BEFORE adding history support to get the baseline, then again after.

  python test_rag_multiturn.py
  python test_rag_multiturn.py --runs 3
  python test_rag_multiturn.py --send-history    # once /ask accepts history

Exit code is non-zero if any follow-up fails.
"""
import argparse
import json
import sys
import time
import urllib.error
import urllib.request

# (id, first question, follow-up, terms that should appear in the follow-up answer)
CASES = [
    ("f1-when",
     "Who won the last F1 race?",
     "When was it held?",
     ["2026-07-26", "july", "hungarian"]),
    ("fb-first",
     "What are the upcoming Premier League fixtures?",
     "Which of those is first?",
     ["coventry", "arsenal", "2026-08-21"]),
    ("bs-who",
     "What was the score in the most recent MLB game?",
     "Who won that one?",
     ["rangers", "royals", "dodgers", "angels"]),
    ("know-follow",
     "What is the offside rule in football?",
     "Can a player be offside from a throw-in?",
     ["throw-in", "throw in"]),
]


def ask(base, path, question, history, timeout, send_history):
    payload = {"question": question}
    if send_history and history:
        payload["history"] = history
    req = urllib.request.Request(
        base.rstrip("/") + path,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    t0 = time.time()
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode()), time.time() - t0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://127.0.0.1:5000")
    ap.add_argument("--gateway", action="store_true")
    ap.add_argument("--send-history", action="store_true",
                    help="include a history array in the request (needs /ask support)")
    ap.add_argument("--runs", type=int, default=1)
    ap.add_argument("--timeout", type=float, default=90.0)
    args = ap.parse_args()

    path = "/api/ask" if args.gateway else "/ask"
    print(f"Target: {args.base.rstrip('/')}{path}   send_history={args.send_history}")
    print("=" * 70)

    failures = 0
    total = 0
    for run in range(1, args.runs + 1):
        if args.runs > 1:
            print(f"\n########## run {run}/{args.runs} ##########")
        for cid, q1, q2, expect in CASES:
            try:
                a1, _ = ask(args.base, path, q1, None, args.timeout, args.send_history)
                history = [{"role": "user", "content": q1},
                           {"role": "assistant", "content": a1.get("answer", "")}]
                a2, dt = ask(args.base, path, q2, history, args.timeout, args.send_history)
            except Exception as e:  # noqa: BLE001
                print(f"[ERROR] {cid}: {e}")
                failures += 1
                total += 1
                continue

            ans2 = (a2.get("answer") or "").lower()
            hit = [t for t in expect if t in ans2]
            ok = bool(hit)
            total += 1
            if not ok:
                failures += 1

            print(f"\n[{'PASS' if ok else 'LOST-CONTEXT'}] {cid}  {dt:.2f}s "
                  f"source={a2.get('source_type')}")
            print(f"   Q1  : {q1}")
            print(f"   A1  : {' '.join((a1.get('answer') or '').split())[:120]}...")
            print(f"   Q2  : {q2}")
            print(f"   A2  : {' '.join((a2.get('answer') or '').split())[:200]}...")
            print(f"   want: any of {expect}   found: {hit or 'NONE'}")
            print("-" * 70)

    print(f"\nSUMMARY: {total - failures}/{total} follow-ups kept context "
          f"({failures} lost)")
    if failures:
        print("=> Follow-ups are answered without the previous turn. The question also "
              "reaches retrieval as-is, so pgvector/live search see 'When was it held?' "
              "with no subject — the wrong chunks come back before the model even runs.")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())