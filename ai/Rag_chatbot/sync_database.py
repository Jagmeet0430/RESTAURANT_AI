import os
import shutil

from dotenv import load_dotenv

from src.database_loader import load_menu_documents
from src.document_loader import load_knowledge_base_documents
from src.embeddings import get_embedding_model
from src.vector_store import create_vector_store, resolve_persist_directory

load_dotenv()


def rebuild_knowledge_base():
    """
    Rebuild the complete RAG knowledge base using:
    1. Static text documents
    2. Dynamic PostgreSQL menu data
    """
    chroma_path = resolve_persist_directory(
        os.getenv(
            "CHROMA_PATH",
            "vector_store/chroma",
        )
    )

    print("Loading static knowledge-base files...")
    static_documents = load_knowledge_base_documents()

    print("Loading menu data from PostgreSQL...")
    menu_documents = load_menu_documents()

    all_documents = static_documents + menu_documents

    print(f"Static documents: {len(static_documents)}")
    print(f"Database documents: {len(menu_documents)}")
    print(f"Total documents: {len(all_documents)}")

    if os.path.exists(chroma_path):
        print("Deleting old vector database...")
        shutil.rmtree(chroma_path)

    print("Creating embeddings...")
    embedding_model = get_embedding_model()

    print("Building new Chroma knowledge base...")
    create_vector_store(
        documents=all_documents,
        embedding_model=embedding_model,
        persist_directory=chroma_path,
    )

    print("Knowledge base rebuilt successfully.")


if __name__ == "__main__":
    rebuild_knowledge_base()
