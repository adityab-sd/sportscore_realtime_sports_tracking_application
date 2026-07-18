import json
import os
from azure.search.documents import SearchClient
from azure.search.documents.indexes import SearchIndexClient
from azure.search.documents.indexes.models import (
    SearchIndex,
    SearchField,
    SearchFieldDataType,
    SimpleField,
    SearchableField,
)
from azure.core.credentials import AzureKeyCredential
from dotenv import load_dotenv

load_dotenv()

# ── CONFIG ──────────────────────────────────────────────
SEARCH_ENDPOINT = os.getenv("AZURE_SEARCH_ENDPOINT")
SEARCH_API_KEY  = os.getenv("AZURE_SEARCH_KEY")
INDEX_NAME      = "football-index"
CORPUS_FILE     = "corpus/football_corpus.json"

# PLEASE review — SEARCH_ENDPOINT/SEARCH_API_KEY are not validated; if unset this fails later
# with an opaque error. Fail fast. EXAMPLE:
#   if not SEARCH_ENDPOINT or not SEARCH_API_KEY: sys.exit("Missing AZURE_SEARCH_* env vars")
credential = AzureKeyCredential(SEARCH_API_KEY)

# ── STEP 1: CREATE INDEX ─────────────────────────────────
print("Creating index...")

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

index = SearchIndex(name=INDEX_NAME, fields=fields)

result = index_client.create_or_update_index(index)
print(f" Index '{result.name}' created successfully")

# ── STEP 2: UPLOAD CORPUS ───────────────────────────────
print("Uploading corpus...")

# PLEASE review — fragile path + no error handling: CORPUS_FILE is relative to the current
# working directory, so this only works when run from backend/rag/. Resolve it relative to
# this file, and handle a missing/malformed corpus with a clear message.
# EXAMPLE:
#   path = os.path.join(os.path.dirname(__file__), "corpus", "football_corpus.json")
#   try:
#       with open(path, encoding="utf-8") as f: documents = json.load(f)
#   except (FileNotFoundError, json.JSONDecodeError) as e: sys.exit(f"Corpus load failed: {e}")
with open(CORPUS_FILE, "r", encoding="utf-8") as f:
    documents = json.load(f)

# Clean documents - remove fields not in index schema
# and make sure id has no special characters
clean_docs = []
for doc in documents:
    clean_doc = {
        "id":           str(doc.get("id", "")).replace("/", "-").replace(".", "-"),
        "sport":        doc.get("sport", ""),
        "category":     doc.get("category", ""),
        "title":        doc.get("title", ""),
        "content":      doc.get("content", ""),
        "source":       doc.get("source", ""),
        "last_updated": doc.get("last_updated", ""),
    }
    clean_docs.append(clean_doc)

search_client = SearchClient(
    endpoint=SEARCH_ENDPOINT,
    index_name=INDEX_NAME,
    credential=credential
)

# Upload in batches of 50
batch_size = 50
for i in range(0, len(clean_docs), batch_size):
    batch = clean_docs[i:i+batch_size]
    result = search_client.upload_documents(documents=batch)
    # PLEASE review — missing case: upload_documents returns a per-document result list, but
    # success is assumed and never checked. Partial failures (throttling, bad key) are silently
    # lost, so the index ends up incomplete while the script prints "uploaded".
    # EXAMPLE:
    #   failed = [x.key for x in result if not x.succeeded]
    #   if failed: print(f"  WARNING: {len(failed)} docs failed: {failed}")
    print(f" Uploaded batch {i//batch_size + 1} - {len(batch)} documents")

print(f"\n Done! {len(clean_docs)} documents uploaded to '{INDEX_NAME}'")

# ── STEP 3: TEST QUERY ──────────────────────────────────
print("\nRunning test query: 'offside rule'...")

results = search_client.search(search_text="offside rule", top=3)

for r in results:
    print(f"\n  Title: {r['title']}")
    print(f"  Category: {r['category']}")
    print(f"  Content preview: {r['content'][:100]}...")