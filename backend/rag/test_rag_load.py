#!/usr/bin/env python3
"""Bounded load test for the SportScore RAG endpoint.

Deliberately NOT a Locust run. backend/loadtest/locustfile.py covers the Java
REST endpoints, which are cached ESPN reads — cheap and open-endedly testable.
/ask is different: every request costs an embedding, a pgvector query, an Azure
Search query and one or two Azure OpenAI completions. An open-ended flood would
run up spend and hit the Azure quota ceiling by accident.

So this fires an EXACT number of requests (users x requests-per-user), prints
the budget before starting, and reports what actually matters under load:

  * p50 / p95 / p99 latency, not just the mean — the mean hides the tail
  * error and timeout rate (the Spring proxy read-timeout is 60s)
  * HTTP 429s, which is Azure OpenAI quota or RateLimitFilter pushing back
  * a latency split by source_type, since knowledge_base and live_data take
    different paths, and a question the fast classifier misses costs an extra
    model round-trip before retrieval even starts

Run (start small — 20 requests is enough to see the shape):
  python test_rag_load.py --users 4 --requests 5
  python test_rag_load.py --users 10 --requests 5 --gateway --base http://127.0.0.1:8081
"""
import argparse
import json
import statistics
import sys
import threading
import time
import urllib.error
import urllib.request
from collections import Counter
from concurrent.futures import ThreadPoolExecutor

# Mixed workload: knowledge questions hit pgvector, live questions hit Azure
# Search, and the last two are phrased to miss the fast classifier so they pay
# for the LLM classification round-trip too.
QUESTIONS = [
    "What is the offside rule in football?",
    "How many points is a free throw worth in basketball?",
    "What are the upcoming Premier League fixtures?",
    "What was the score in the most recent MLB game?",
    "Who won the last F1 race?",
    "What is a designated hitter in baseball?",
    "Tell me about the current state of the Premier League",
    "Anything interesting happening in baseball at the moment?",
]

_print_lock = threading.Lock()


def one_request(base, path, question, timeout):
    payload = json.dumps({"question": question}).encode()
    req = urllib.request.Request(
        base.rstrip("/") + path, data=payload,
        headers={"Content-Type": "application/json"}, method="POST")
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = json.loads(resp.read().decode())
        return {"ok": True, "dt": time.time() - t0, "status": 200,
                "source_type": body.get("source_type"),
                "grounded": body.get("grounded")}
    except urllib.error.HTTPError as e:
        return {"ok": False, "dt": time.time() - t0, "status": e.code,
                "source_type": None, "error": f"HTTP {e.code}"}
    except Exception as e:  # noqa: BLE001 - timeouts and connection resets both land here
        return {"ok": False, "dt": time.time() - t0, "status": 0,
                "source_type": None, "error": type(e).__name__}


def pct(values, p):
    if not values:
        return 0.0
    s = sorted(values)
    k = max(0, min(len(s) - 1, int(round((p / 100.0) * (len(s) - 1)))))
    return s[k]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--users", type=int, default=4, help="concurrent workers")
    ap.add_argument("--requests", type=int, default=5, help="requests per worker")
    ap.add_argument("--base", default="http://127.0.0.1:5000")
    ap.add_argument("--gateway", action="store_true", help="hit /api/ask on the Spring proxy")
    ap.add_argument("--timeout", type=float, default=90.0)
    ap.add_argument("--yes", action="store_true", help="skip the budget confirmation")
    args = ap.parse_args()

    path = "/api/ask" if args.gateway else "/ask"
    total = args.users * args.requests
    print(f"Target      : {args.base.rstrip('/')}{path}")
    print(f"Concurrency : {args.users} workers x {args.requests} requests = {total} total")
    print("Each request costs Azure OpenAI tokens. Keep this small.")
    if not args.yes:
        try:
            if input(f"Fire {total} requests? [y/N] ").strip().lower() not in ("y", "yes"):
                print("aborted")
                return 0
        except (EOFError, KeyboardInterrupt):
            print("\naborted")
            return 0

    # Warm up: the first request loads the embedding model and opens the PG
    # connection, so including it would skew the p50 badly.
    print("\nwarming up...")
    warm = one_request(args.base, path, QUESTIONS[0], args.timeout)
    print(f"  warmup: {warm['dt']:.2f}s ok={warm['ok']}")
    if not warm["ok"]:
        print(f"  warmup FAILED ({warm.get('error')}) — is the service running?")
        return 2

    results = []
    counter = {"n": 0}

    def worker(wid):
        out = []
        for i in range(args.requests):
            q = QUESTIONS[(wid * args.requests + i) % len(QUESTIONS)]
            r = one_request(args.base, path, q, args.timeout)
            out.append(r)
            with _print_lock:
                counter["n"] += 1
                print(f"  [{counter['n']:3d}/{total}] {r['dt']:6.2f}s "
                      f"{'ok ' if r['ok'] else 'ERR'} {r.get('source_type') or r.get('error','')}")
        return out

    print(f"\nfiring {total} requests across {args.users} workers...\n")
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=args.users) as ex:
        for chunk in ex.map(worker, range(args.users)):
            results.extend(chunk)
    wall = time.time() - t0

    ok = [r for r in results if r["ok"]]
    bad = [r for r in results if not r["ok"]]
    lat = [r["dt"] for r in ok]

    print("\n" + "=" * 62)
    print(f"REQUESTS   {len(results)} in {wall:.1f}s  =>  {len(results) / wall:.2f} req/s")
    print(f"SUCCESS    {len(ok)}/{len(results)} ({100 * len(ok) / max(len(results), 1):.0f}%)")
    if lat:
        print(f"LATENCY    p50 {pct(lat, 50):.2f}s | p95 {pct(lat, 95):.2f}s | "
              f"p99 {pct(lat, 99):.2f}s | max {max(lat):.2f}s | mean {statistics.mean(lat):.2f}s")
    if bad:
        print(f"ERRORS     {dict(Counter(r.get('error') for r in bad))}")
        n429 = sum(1 for r in bad if r["status"] == 429)
        if n429:
            print(f"  {n429} x HTTP 429 — Azure OpenAI quota or RateLimitFilter throttling. "
                  f"This is the ceiling; note the concurrency it appeared at.")
        n_timeout = sum(1 for r in bad if r["status"] == 0)
        if n_timeout:
            print(f"  {n_timeout} x timeout/connection error — note the Spring proxy "
                  f"read timeout is 60s, shorter than this script's {args.timeout:.0f}s.")

    by_src = {}
    for r in ok:
        by_src.setdefault(r.get("source_type") or "?", []).append(r["dt"])
    if by_src:
        print("\nBY SOURCE TYPE")
        for src, v in sorted(by_src.items()):
            print(f"  {src:16s} n={len(v):3d}  p50 {pct(v, 50):.2f}s  p95 {pct(v, 95):.2f}s")

    print("\nSingle-user baseline was roughly 1-4s. Compare p95 against that: a large")
    print("gap means requests are queueing, not that any one request got slower.")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())