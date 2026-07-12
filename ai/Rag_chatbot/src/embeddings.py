from typing import List
from sentence_transformers import SentenceTransformer

from config.settings import EMBEDDING_MODEL_NAME


class EmbeddingModel:
    def __init__(self, model_name: str = EMBEDDING_MODEL_NAME):
        try:
            self.model = SentenceTransformer(
                model_name,
                local_files_only=True,
            )
        except Exception as exc:
            raise RuntimeError(
                "Embedding model is not available in the local Hugging Face cache. "
                f"Download/cache it once, then restart the RAG server. Model: {model_name}"
            ) from exc

    def embed_texts(self, texts: List[str]) -> List[List[float]]:
        embeddings = self.model.encode(
            texts,
            convert_to_numpy=True,
            normalize_embeddings=True
        )
        return embeddings.tolist()

    def embed_query(self, query: str) -> List[float]:
        embedding = self.model.encode(
            query,
            convert_to_numpy=True,
            normalize_embeddings=True
        )
        return embedding.tolist()

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        return self.embed_texts(texts)


def get_embedding_model() -> EmbeddingModel:
    return EmbeddingModel()
