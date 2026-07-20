"""
build_index.py — Shared script to create an Azure AI Search index and
upload a sport's corpus. Replaces the separate create_football_index.py /
create_basketball_index.py scripts to avoid duplicated logic drifting
out of sync over time.

Usage:
    python3 build_index.py football
    python3 build_index.py basketball
"""

import json
import os
import sys
from azure.search.documents import SearchClient
from azure.search.documents.indexes import SearchIndexClient
from azure.search.documents.indexes.models import (
    SearchIndex,
    SearchFieldDataType,
    SimpleField,
    SearchableField,
)
from azure.core.credentials import AzureKeyCredential
from dotenv import load_dotenv

load_dotenv()

SEARCH_ENDPOINT = os.getenv("AZURE_SEARCH_ENDPOINT")
SEARCH_API_KEY  = os.getenv("AZURE_SEARCH_KEY")

if not SEARCH_ENDPOINT or not SEARCH_API_KEY:
    sys.exit("Missing AZURE_SEARCH_ENDPOINT or AZURE_SEARCH_KEY environment variables")

SPORT_CONFIG = {
    "football": {
        "index_name": "football-index",
        "corpus_file": "corpus/football_corpus.json",
        "test_query": "offside rule",
    },
    "basketball": {
        "index_name": "basketball-index",
        "corpus_file": "corpus/basketball_corpus.json",
        "test_query": "three point shot",
    },
}


def build(sport):
    if sport not in SPORT_CONFIG:
        sys.exit(f"Unknown sport '{sport}'. Choose from: {list(SPORT_CONFIG.keys())}")

    config = SPORT_CONFIG[sport]
    index_name = config["index_name"]

    # Resolve corpus path relative to this file, not the current working directory
    corpus_path = os.path.join(os.path.dirname(__file__), config["corpus_file"])

    credential = AzureKeyCredential(SEARCH_API_KEY)

    # ── STEP 1: CREATE INDEX ─────────────────────────────
    print(f"Creating index '{index_name}'...")
    index_client = SearchIndexClient(endpoint=SEARCH_ENDPOINT, credential=credential)

    fields = [
        SimpleField(name="id",           type=SearchFieldDataType.String, key=True),
        SimpleField(name="sport",        type=SearchFieldDataType.String,  filterable=True),
        SimpleField(name="category",     type=SearchFieldDataType.String,  filterable=True),
        SearchableField(name="title",    type=SearchFieldDataType.String),
        SearchableField(name="content",  type=SearchFieldDataType.String),
        SimpleField(name="source",       type=SearchFieldDataType.String),
        SimpleField(name="last_updated", type=SearchFieldDataType.String),
    ]

    index = SearchIndex(name=index_name, fields=fields)
    result = index_client.create_or_update_index(index)
    print(f"  Index '{result.name}' created successfully")

    # ── STEP 2: UPLOAD CORPUS ────────────────────────────
    print("Uploading corpus...")
    try:
        with open(corpus_path, "r", encoding="utf-8") as f:
            documents = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        sys.exit(f"Corpus load failed: {e}")

    clean_docs = []
    for doc in documents:
        clean_docs.append({
            "id":           str(doc.get("id", "")).replace("/", "-").replace(".", "-"),
            "sport":        doc.get("sport", ""),
            "category":     doc.get("category", ""),
            "title":        doc.get("title", ""),
            "content":      doc.get("content", ""),
            "source":       doc.get("source", ""),
            "last_updated": doc.get("last_updated", ""),
        })

    search_client = SearchClient(
        endpoint=SEARCH_ENDPOINT,
        index_name=index_name,
        credential=credential
    )

    batch_size = 50
    for i in range(0, len(clean_docs), batch_size):
        batch = clean_docs[i:i+batch_size]
        result = search_client.upload_documents(documents=batch)
        failed = [r.key for r in result if not r.succeeded]
        if failed:
            print(f"  WARNING: {len(failed)} documents failed in batch {i//batch_size + 1}: {failed}")
        print(f"  Uploaded batch {i//batch_size + 1} — {len(batch)} documents")

    print(f"\n Done! {len(clean_docs)} documents uploaded to '{index_name}'")

    # ── STEP 3: TEST QUERY ───────────────────────────────
    print(f"\nRunning test query: '{config['test_query']}'...")
    results = search_client.search(search_text=config["test_query"], top=3)
    for r in results:
        print(f"\n  Title: {r['title']}")
        print(f"  Category: {r['category']}")
        print(f"  Content preview: {r['content'][:100]}...")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("Usage: python3 build_index.py <football|basketball>")
    build(sys.argv[1])