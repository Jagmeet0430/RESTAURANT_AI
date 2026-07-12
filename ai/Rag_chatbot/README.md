# RestaurantAI RAG Chatbot

This module provides a Retrieval-Augmented Generation chatbot for RestaurantAI.

## Features

- FastAPI chatbot API
- ChromaDB vector database
- SentenceTransformer embeddings
- Knowledge base ingestion
- Optional PostgreSQL menu ingestion
- Restaurant FAQ support
- Admin guide support
- Menu policy support

## Folder Structure

```text
rag_chatbot/
├── app.py
├── ingest.py
├── requirements.txt
├── README.md
├── config/
├── knowledge_base/
├── src/
├── vector_store/
├── logs/
└── tests/