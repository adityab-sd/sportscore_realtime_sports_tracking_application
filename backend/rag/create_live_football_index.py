"""
create_live_index.py — Creates the football-live-index in Azure AI Search
Run this ONCE before starting live_updater.py
"""

import os
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
INDEX_NAME      = "football-live-index"

credential = AzureKeyCredential(SEARCH_API_KEY)
index_client = SearchIndexClient(endpoint=SEARCH_ENDPOINT, credential=credential)

fields = [
    SimpleField(name="id",           type=SearchFieldDataType.String, key=True),
    SimpleField(name="sport",        type=SearchFieldDataType.String, filterable=True),
    SimpleField(name="category",     type=SearchFieldDataType.String, filterable=True),
    SearchableField(name="title",    type=SearchFieldDataType.String),
    SearchableField(name="content",  type=SearchFieldDataType.String),
    SimpleField(name="source",       type=SearchFieldDataType.String),
    SimpleField(name="last_updated", type=SearchFieldDataType.String),
]

index = SearchIndex(name=INDEX_NAME, fields=fields)
result = index_client.create_or_update_index(index)
print(f"Index '{result.name}' created successfully!")