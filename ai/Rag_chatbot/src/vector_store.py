import os
from typing import List, Dict
import chromadb
from langchain_chroma import Chroma

from config.settings import VECTOR_STORE_DIR, COLLECTION_NAME


def resolve_persist_directory(persist_directory=None):
    path = persist_directory or os.getenv(
        "CHROMA_PATH",
        str(VECTOR_STORE_DIR),
    )
    resolved_path = path if isinstance(path, os.PathLike) else str(path)

    if not os.path.isabs(resolved_path):
        resolved_path = str(VECTOR_STORE_DIR.parent.parent / resolved_path)

    return resolved_path


def get_collection_name():
    return os.getenv(
        "COLLECTION_NAME",
        COLLECTION_NAME,
    )


def create_vector_store(
    documents,
    embedding_model,
    persist_directory=None,
):
    persist_directory = resolve_persist_directory(persist_directory)
    collection_name = get_collection_name()

    vector_store = Chroma.from_documents(
        documents=documents,
        embedding=embedding_model,
        collection_name=collection_name,
        persist_directory=persist_directory,
    )

    return vector_store


def load_vector_store(embedding_model):
    persist_directory = resolve_persist_directory()
    collection_name = get_collection_name()

    return Chroma(
        collection_name=collection_name,
        embedding_function=embedding_model,
        persist_directory=persist_directory,
    )


class VectorStore:
    def __init__(self):
        VECTOR_STORE_DIR.mkdir(parents=True, exist_ok=True)

        self.client = chromadb.PersistentClient(path=str(VECTOR_STORE_DIR))
        self.collection = self.client.get_or_create_collection(name=get_collection_name())

    def reset_collection(self):
        try:
            self.client.delete_collection(name=get_collection_name())
        except Exception:
            pass

        self.collection = self.client.get_or_create_collection(name=get_collection_name())

    def add_documents(self, chunks: List[Dict], embeddings: List[List[float]]):
        if not chunks:
            return

        ids = [f"doc_{i}" for i in range(len(chunks))]
        documents = [chunk["text"] for chunk in chunks]
        metadatas = [chunk["metadata"] for chunk in chunks]

        self.collection.add(
            ids=ids,
            documents=documents,
            metadatas=metadatas,
            embeddings=embeddings
        )

    def search(self, query_embedding: List[float], top_k: int):
        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k
        )

        documents = results.get("documents", [[]])[0]
        metadatas = results.get("metadatas", [[]])[0]
        distances = results.get("distances", [[]])[0]

        response = []

        for doc, meta, distance in zip(documents, metadatas, distances):
            response.append({
                "text": doc,
                "metadata": meta,
                "distance": distance
            })

        return response

    def count(self) -> int:
        return self.collection.count()
