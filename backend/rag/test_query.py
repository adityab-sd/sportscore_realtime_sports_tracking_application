import os
from azure.search.documents import SearchClient
from azure.core.credentials import AzureKeyCredential
from dotenv import load_dotenv

load_dotenv()

SEARCH_ENDPOINT = os.getenv("AZURE_SEARCH_ENDPOINT")
SEARCH_API_KEY  = os.getenv("AZURE_SEARCH_KEY")
INDEX_NAME = "football-index"

client = SearchClient(
    endpoint=SEARCH_ENDPOINT,
    index_name=INDEX_NAME,
    credential=AzureKeyCredential(SEARCH_API_KEY)
)

results = client.search(search_text="offside rule", top=3)
for r in results:
    print("Title:", r["title"])
    print("Category:", r["category"])
    print("Preview:", r["content"][:100])
    print()