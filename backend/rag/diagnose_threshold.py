"""
diagnose_threshold.py — Prints the ACTUAL cosine distance between test
questions and their closest matches in sports_corpus, so we can pick a
real threshold instead of guessing again.

Usage:
    cd backend/rag
    python3 diagnose_threshold.py
"""

import os

from dotenv import load_dotenv
import psycopg2
from pgvector.psycopg2 import register_vector
from sentence_transformers import SentenceTransformer

load_dotenv()

# No hardcoded fallback defaults — every value must come from a real
# environment variable, same fail-loudly pattern used in search.py and
# ingest_corpus_to_postgres.py.
_required_pg_vars = ["POSTGRES_HOST", "POSTGRES_PORT", "POSTGRES_DB", "POSTGRES_USER", "POSTGRES_PASSWORD"]
_missing_pg_vars = [v for v in _required_pg_vars if not os.getenv(v)]
if _missing_pg_vars:
    raise RuntimeError(f"Missing required Postgres environment variables: {', '.join(_missing_pg_vars)}")

PG_CONFIG = {
    "host": os.getenv("POSTGRES_HOST"),
    "port": int(os.getenv("POSTGRES_PORT")),
    "dbname": os.getenv("POSTGRES_DB"),
    "user": os.getenv("POSTGRES_USER"),
    "password": os.getenv("POSTGRES_PASSWORD"),
}

TEST_QUESTIONS = [
    "what is a pick and roll?",
    "how does offside work?",
    "who won the golden boot?",
]

model = SentenceTransformer("all-MiniLM-L6-v2")
conn = psycopg2.connect(**PG_CONFIG)
register_vector(conn)

for question in TEST_QUESTIONS:
    print(f"\n{'='*60}")
    print(f"Question: {question}")
    embedding = model.encode(question)

    with conn.cursor() as cur:
        cur.execute("""
            SELECT title, category, embedding <=> %s AS distance
            FROM sports_corpus
            ORDER BY embedding <=> %s
            LIMIT 5;
        """, (embedding, embedding))
        for title, category, distance in cur.fetchall():
            print(f"  distance={distance:.4f}  [{category}] {title}")

conn.close()