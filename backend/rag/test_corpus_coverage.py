#!/usr/bin/env python3
"""Knowledge-corpus coverage test for SportScore.

Finds GAPS in the pgvector knowledge base — questions a user would reasonably
ask where the corpus has nothing above VECTOR_DISTANCE_THRESHOLD (0.5). This is
the DRS problem generalised: retrieval correctly returns nothing, the assistant
correctly says "not in my sources", and the user sees a hole.

Queries pgvector directly (no Azure OpenAI calls), so it is fast, free and
deterministic — run it as often as you like while filling gaps.

Verdicts:
  COVERED   best distance <= 0.5, corpus answers this
  NEAR      0.5 < best <= 0.62 — content is related but below threshold. Either
            the entry needs the question's vocabulary, or the threshold is tight
  GAP       best > 0.62 — nothing relevant exists; write a corpus entry

Run:
  python test_corpus_coverage.py
  python test_corpus_coverage.py --sport f1
  python test_corpus_coverage.py --gaps-only
"""
import argparse
import sys

sys.path.insert(0, ".")

from search import (  # noqa: E402
    VECTOR_DISTANCE_THRESHOLD,
    _get_embedding_model,
    _get_pg_connection,
)

NEAR_MARGIN = 0.62

# Questions a mentor, examiner or ordinary user would plausibly ask.
QUESTIONS = {
    "football": [
        "What is the offside rule in football?",
        "What is VAR and when is it used?",
        "How does the Premier League promotion and relegation work?",
        "What is a false nine in football?",
        "How does extra time and penalties work in a knockout match?",
        "What is Financial Fair Play?",
        "How many substitutions are allowed in a football match?",
        "What is the difference between a yellow and red card?",
    ],
    "basketball": [
        "How many points is a free throw worth in basketball?",
        "What is the shot clock in the NBA?",
        "What is a pick and roll?",
        "How does the NBA draft lottery work?",
        "What is goaltending?",
        "How does the NBA play-in tournament work?",
        "What is a triple double?",
    ],
    "baseball": [
        "What is a designated hitter in baseball?",
        "How does the MLB postseason work?",
        "What is an ERA in baseball?",
        "What is the infield fly rule?",
        "How does a pitch clock work?",
        "What is a save in baseball?",
        "What is WAR in baseball statistics?",
    ],
    "f1": [
        "What is DRS in Formula 1?",
        "What is the Super Licence requirement in F1?",
        "How does F1 qualifying work?",
        "How are F1 championship points awarded?",
        "What are the F1 tyre compounds?",
        "What is a sprint race in Formula 1?",
        "What is parc ferme in F1?",
        "How does the F1 cost cap work?",
    ],
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sport", choices=sorted(QUESTIONS), help="limit to one sport")
    ap.add_argument("--gaps-only", action="store_true", help="only print NEAR and GAP")
    args = ap.parse_args()

    model = _get_embedding_model()
    conn = _get_pg_connection()

    sports = [args.sport] if args.sport else list(QUESTIONS)
    tally = {}

    with conn.cursor() as cur:
        for sport in sports:
            print(f"\n{'=' * 68}\n{sport.upper()}\n{'=' * 68}")
            for q in QUESTIONS[sport]:
                emb = model.encode(q)
                cur.execute(
                    """SELECT title, category, embedding <=> %s AS d
                       FROM sports_corpus ORDER BY embedding <=> %s LIMIT 3""",
                    (emb, emb),
                )
                rows = cur.fetchall()
                best = rows[0][2] if rows else 9.9

                if best <= VECTOR_DISTANCE_THRESHOLD:
                    verdict = "COVERED"
                elif best <= NEAR_MARGIN:
                    verdict = "NEAR"
                else:
                    verdict = "GAP"
                tally[(sport, verdict)] = tally.get((sport, verdict), 0) + 1

                if args.gaps_only and verdict == "COVERED":
                    continue
                print(f"\n[{verdict}] d={best:.4f}  {q}")
                for title, cat, d in rows:
                    mark = "*" if d <= VECTOR_DISTANCE_THRESHOLD else " "
                    print(f"   {mark} {d:.4f}  [{cat}] {title}")

    conn.close()

    print(f"\n{'=' * 68}\nTALLY")
    for sport in sports:
        parts = [f"{tally.get((sport, v), 0)} {v}" for v in ("COVERED", "NEAR", "GAP")]
        print(f"  {sport:11s} " + " | ".join(parts))
    gaps = sum(v for (s, verdict), v in tally.items() if verdict == "GAP")
    near = sum(v for (s, verdict), v in tally.items() if verdict == "NEAR")
    print(f"\n  {gaps} GAP (write a corpus entry) | {near} NEAR (fix vocabulary or threshold)")
    return 0


if __name__ == "__main__":
    sys.exit(main())