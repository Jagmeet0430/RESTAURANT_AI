from typing import List, Dict

from config.settings import CHUNK_SIZE, CHUNK_OVERLAP


class TextSplitter:
    def __init__(self, chunk_size: int = CHUNK_SIZE, chunk_overlap: int = CHUNK_OVERLAP):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def split_documents(self, documents: List[Dict]) -> List[Dict]:
        chunks = []

        for doc in documents:
            if hasattr(doc, "page_content"):
                text = doc.page_content
                metadata = dict(doc.metadata)
            else:
                text = doc["text"]
                metadata = doc["metadata"]

            start = 0
            chunk_id = 0

            while start < len(text):
                end = start + self.chunk_size
                chunk_text = text[start:end].strip()

                if chunk_text:
                    chunk_metadata = metadata.copy()
                    chunk_metadata["chunk_id"] = chunk_id

                    chunks.append({
                        "text": chunk_text,
                        "metadata": chunk_metadata
                    })

                start += self.chunk_size - self.chunk_overlap
                chunk_id += 1

        return chunks
