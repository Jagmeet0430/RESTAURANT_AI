import logging
from typing import Dict

from config.settings import LOG_FILE
from src.retriever import Retriever
from src.rag_chain import RAGChain
from src.vector_store import VectorStore


class ChatbotService:
    def __init__(self):
        self._setup_logger()
        self.retriever = Retriever()
        self.rag_chain = RAGChain()
        self.vector_store = VectorStore()

    def _setup_logger(self):
        LOG_FILE.parent.mkdir(parents=True, exist_ok=True)

        logging.basicConfig(
            filename=LOG_FILE,
            level=logging.INFO,
            format="%(asctime)s - %(levelname)s - %(message)s"
        )

    def chat(self, question: str) -> Dict:
        logging.info(f"User question: {question}")

        if self.vector_store.count() == 0:
            return {
                "answer": "Knowledge base is empty. Please run: python ingest.py",
                "sources": []
            }

        retrieved_docs = self.retriever.retrieve(question)
        response = self.rag_chain.generate_answer(question, retrieved_docs)

        logging.info(f"Bot answer: {response['answer']}")

        return response