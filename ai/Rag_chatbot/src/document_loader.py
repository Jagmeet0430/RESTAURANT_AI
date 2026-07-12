from pathlib import Path
from typing import List, Dict

from config.settings import KNOWLEDGE_BASE_DIR
from langchain_core.documents import Document


class DocumentLoader:
    def __init__(self, knowledge_base_dir: Path = KNOWLEDGE_BASE_DIR):
        self.knowledge_base_dir = knowledge_base_dir

    def load_txt_files(self) -> List[Dict]:
        documents = []

        if not self.knowledge_base_dir.exists():
            raise FileNotFoundError(f"Knowledge base folder not found: {self.knowledge_base_dir}")

        for file_path in self.knowledge_base_dir.glob("*.txt"):
            text = file_path.read_text(encoding="utf-8").strip()

            if text:
                documents.append({
                    "text": text,
                    "metadata": {
                        "source": file_path.name,
                        "type": "knowledge_base"
                    }
                })

        return documents


def load_knowledge_base_documents() -> List[Document]:
    documents = []

    if not KNOWLEDGE_BASE_DIR.exists():
        raise FileNotFoundError(f"Knowledge base folder not found: {KNOWLEDGE_BASE_DIR}")

    for file_path in KNOWLEDGE_BASE_DIR.glob("*.txt"):
        text = file_path.read_text(encoding="utf-8").strip()

        if text:
            documents.append(
                Document(
                    page_content=text,
                    metadata={
                        "source": file_path.name,
                        "document_type": "knowledge_base",
                        "audience": "customer",
                    },
                )
            )

    return documents
