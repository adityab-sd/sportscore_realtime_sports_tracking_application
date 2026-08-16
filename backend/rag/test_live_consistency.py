#!/usr/bin/env python3
"""Live-index consistency checker for SportScore.

Checks INVARIANTS — things that must be true no matter what ESPN returns, so a
failure always means a bug in the pipeline, never a false alarm from upstream.
Deliberately does NOT re-fetch ESPN: the updaters already got their data from
there, so comparing would mostly test ESPN against itself, add a network
dependency, and go red whenever upstream legitimately revises a scoreline.

Checks:
  1. FRESHNESS  — summary docs updated recently (catches a wedged updater; an
                  F1 doc sat 7 hours stale while `ps` showed the process alive)
  2. TEMPORAL   — "Next" docs point to the future, "Latest/Result" to the past
  3. STATE      — a match marked FINISHED does not have a future date, and a
                  scheduled match does not have a past one
  4. CROSS-DOC  — the race/game named in a summary exists as its own match doc
                  (the MLB summary and the per-game docs once disagreed about
                  which game was most recent, mid-conversation)
  5. DUPLICATES — same title under different ids means the model can receive
                  two versions of the same match in one context

Pure index reads: fast, free, no external calls. Exit code is non-zero if any
check FAILs, so it can run on a schedule as a pipeline health probe.

Run:
  python test_live_consistency.py
  python test_live_consistency.py --max-age-min 10
  python test_live_consistency.py --sport f1
"""
import argparse
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

sys.path.insert(0, ".")

from search import LIVE_INDEX, _get_client  # noqa: E402

ISO = re.compile(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?Z?")
NEWSY = ("live-news", "live-injury", "live-transaction")


def parse_iso(s):
    if not s:
        return None
    s = s.strip().rstrip("Z")
    for fmt in ("%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M"):
        try:
            return datetime.strptime(s, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None


def first_date_in(text):
    m = ISO.search(text or "")
    return parse_iso(m.group(0)) if m else None


class Report:
    def __init__(self):
        self.rows = []

    def add(self, status, check, detail):
        self.rows.append((status, check, detail))
        print(f"[{status:4s}] {check:12s} {detail}")

    def failures(self):
        return sum(1 for s, _, _ in self.rows if s == "FAIL")

    def warns(self):
        return sum(1 for s, _, _ in self.rows if s == "WARN")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--max-age-min", type=float, default=15.0,
                    help="summary docs older than this are stale (default 15)")
    ap.add_argument("--sport", help="limit to one sport")
    args = ap.parse_args()

    client = _get_client(LIVE_INDEX)
    docs = list(client.search(search_text="*", top=5000))
    if args.sport:
        docs = [d for d in docs if d.get("sport") == args.sport]

    now = datetime.now(timezone.utc)
    r = Report()
    print(f"Live index: {len(docs)} docs | now={now.isoformat(timespec='seconds')}")
    print("=" * 78)

    # ---- 1. FRESHNESS -----------------------------------------------------
    print("\n-- 1. freshness of summary docs --")
    summaries = [d for d in docs if any(
        k in str(d.get("title")) for k in ("Latest", "Next", "Live Now", "Standings"))]
    if not summaries:
        r.add("WARN", "freshness", "no summary docs found at all")
    for d in sorted(summaries, key=lambda x: str(x.get("title"))):
        ts = parse_iso(d.get("last_updated"))
        title = str(d.get("title"))[:52]
        if ts is None:
            r.add("WARN", "freshness", f"{title}: no last_updated")
            continue
        age = (now - ts).total_seconds() / 60
        if age > args.max_age_min:
            r.add("FAIL", "freshness", f"{title}: {age:.0f} min stale — updater wedged?")
        else:
            r.add("OK", "freshness", f"{title}: {age:.1f} min")

    # ---- 2. TEMPORAL ------------------------------------------------------
    print("\n-- 2. temporal direction of summary docs --")
    for d in summaries:
        title = str(d.get("title"))
        when = first_date_in(d.get("content"))
        if when is None:
            continue
        short = title[:52]
        if "Next" in title and when < now:
            r.add("FAIL", "temporal", f"{short}: points to the PAST ({when.date()})")
        elif ("Latest" in title or "Result" in title) and when > now:
            r.add("FAIL", "temporal", f"{short}: points to the FUTURE ({when.date()})")
        else:
            r.add("OK", "temporal", f"{short}: {when.date()}")

    # ---- 3. STATE vs DATE -------------------------------------------------
    print("\n-- 3. match state vs date --")
    bad_state = 0
    checked = 0
    for d in docs:
        if (d.get("category") or "") in NEWSY:
            continue
        content = d.get("content") or ""
        when = first_date_in(content)
        if when is None:
            continue
        low = content.lower()
        checked += 1
        if "finished" in low and when > now + timedelta(hours=6):
            bad_state += 1
            if bad_state <= 5:
                r.add("FAIL", "state", f"FINISHED but dated {when.date()}: "
                                       f"{str(d.get('title'))[:44]}")
        elif "scheduled" in low and when < now - timedelta(hours=12):
            bad_state += 1
            if bad_state <= 5:
                r.add("FAIL", "state", f"SCHEDULED but dated {when.date()}: "
                                       f"{str(d.get('title'))[:44]}")
    if bad_state == 0:
        r.add("OK", "state", f"{checked} dated match docs, no state/date contradictions")
    elif bad_state > 5:
        r.add("FAIL", "state", f"...and {bad_state - 5} more")

    # ---- 4. CROSS-DOC AGREEMENT ------------------------------------------
    print("\n-- 4. summary agrees with per-match docs --")
    match_titles = [str(d.get("title")) for d in docs
                    if (d.get("category") or "") not in NEWSY]
    for d in summaries:
        title = str(d.get("title"))
        if "Latest" not in title and "Next" not in title:
            continue
        content = d.get("content") or ""
        # summary content names the event; look for a match doc sharing a
        # distinctive chunk of that name
        names = re.findall(r"(?:the |is the )([A-Z][\w'&.\- ]{8,60}?)(?: at | on |,|\.)",
                           content)
        if not names:
            continue
        named = names[0].strip()
        hit = any(named[:22].lower() in t.lower() for t in match_titles)
        short = title[:40]
        if hit:
            r.add("OK", "cross-doc", f"{short}: '{named[:38]}' has a match doc")
        else:
            r.add("WARN", "cross-doc",
                  f"{short}: '{named[:38]}' has NO matching per-match doc")

    # ---- 5. DUPLICATES ----------------------------------------------------
    print("\n-- 5. duplicate documents --")
    by_title = defaultdict(list)
    for d in docs:
        by_title[str(d.get("title"))].append(d)
    dupes = {t: v for t, v in by_title.items() if len(v) > 1}
    if not dupes:
        r.add("OK", "duplicates", "no duplicate titles")
    else:
        total_extra = sum(len(v) - 1 for v in dupes.values())
        r.add("WARN", "duplicates",
              f"{len(dupes)} titles duplicated, {total_extra} redundant docs "
              f"({100 * total_extra / max(len(docs), 1):.0f}% of index)")
        conflicting = 0
        for t, v in dupes.items():
            if len({(x.get("content") or "")[:200] for x in v}) > 1:
                conflicting += 1
        if conflicting:
            r.add("FAIL", "duplicates",
                  f"{conflicting} duplicated titles have DIFFERING content — the "
                  f"model can be given two versions of the same match")
        by_sport = Counter(v[0].get("sport") for v in dupes.values())
        print(f"       duplicated titles by sport: {dict(by_sport)}")
        for t, v in list(dupes.items())[:3]:
            print(f"       {len(v)}x '{str(t)[:56]}'")
            for x in v[:3]:
                print(f"          id={x.get('id')}")

    print("\n" + "=" * 78)
    print(f"SUMMARY: {len(r.rows)} checks | {r.failures()} FAIL | {r.warns()} WARN")
    return 1 if r.failures() else 0


if __name__ == "__main__":
    sys.exit(main())