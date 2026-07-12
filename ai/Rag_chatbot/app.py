from fastapi import FastAPI
from pydantic import BaseModel

from src.embeddings import get_embedding_model
from src.rag_chain import RAGChain
from src.vector_store import get_collection_name, load_vector_store, resolve_persist_directory

app = FastAPI(
    title="RestaurantAI RAG Chatbot",
    version="1.0.0",
)


class ChatRequest(BaseModel):
    question: str


rag_chain = RAGChain()


@app.get("/")
def home():
    return {
        "message": "RestaurantAI RAG Chatbot is running",
        "docs": "/docs",
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
    }


@app.get("/debug/vector-store")
def debug_vector_store():
    vector_store = load_vector_store(get_embedding_model())

    return {
        "vector_count": vector_store._collection.count(),
        "collection_name": vector_store._collection.name,
        "configured_collection_name": get_collection_name(),
        "persist_directory": resolve_persist_directory(),
    }


@app.post("/chat")
def chat(request: ChatRequest):
    vector_store = load_vector_store(get_embedding_model())

    vector_count = vector_store._collection.count()

    if vector_count == 0:
        return {
            "answer": (
                "No vectors were found in the configured Chroma collection. "
                "Run sync_database.py or check CHROMA_PATH and COLLECTION_NAME."
            ),
            "sources": [],
            "vector_count": vector_count,
            "collection_name": vector_store._collection.name,
            "persist_directory": resolve_persist_directory(),
        }

    documents = vector_store.similarity_search(
        request.question,
        k=10,
    )

    if not documents:
        return {
            "answer": "No relevant information was found.",
            "sources": [],
            "vector_count": vector_count,
        }

    retrieved_docs = [
        {
            "text": document.page_content,
            "metadata": document.metadata,
        }
        for document in documents
    ]

    result = rag_chain.generate_answer(
        request.question,
        retrieved_docs,
    )

    sources = [
        {
            "source": document.metadata.get("source"),
            "document_type": document.metadata.get("document_type"),
            "item_name": document.metadata.get("item_name"),
        }
        for document in documents
    ]

    return {
        "answer": result["answer"],
        "sources": sources,
        "vector_count": vector_count,
        "collection_name": vector_store._collection.name,
    }
