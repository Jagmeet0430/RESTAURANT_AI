from typing import List, Dict

from config.settings import TOP_K
from src.embeddings import EmbeddingModel
from src.vector_store import VectorStore


class Retriever:
    def __init__(self):
        self.embedding_model = EmbeddingModel()
        self.vector_store = VectorStore()

    def retrieve(self, question: str, top_k: int = TOP_K) -> List[Dict]:
        query_embedding = self.embedding_model.embed_query(question)
        return self.vector_store.search(query_embedding, top_k)