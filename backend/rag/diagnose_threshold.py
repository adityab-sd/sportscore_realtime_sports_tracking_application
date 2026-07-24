"""
diagnose_threshold.py — Prints the ACTUAL cosine distance between test
questions and their closest matches in sports_corpus, so we can pick a
real threshold instead of guessing again.

Usage:
    cd backend/rag
    python3 diagnose_threshold.py
"""

import psycopg2
from pgvector.psycopg2 import register_vector
from sentence_transformers import SentenceTransformer

PG_CONFIG = {
    "host": "localhost", "port": 5432, "dbname": "sportsscore",
    "user": "postgres", "password": "postgres",
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