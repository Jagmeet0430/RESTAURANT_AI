from src.document_loader import DocumentLoader
from src.database_loader import DatabaseLoader
from src.text_splitter import TextSplitter
from src.embeddings import EmbeddingModel
from src.vector_store import VectorStore


def main():
    print("Starting RestaurantAI RAG ingestion...")

    document_loader = DocumentLoader()
    database_loader = DatabaseLoader()
    text_splitter = TextSplitter()
    embedding_model = EmbeddingModel()
    vector_store = VectorStore()

    kb_documents = document_loader.load_txt_files()
    db_documents = database_loader.load_menu_documents()

    all_documents = kb_documents + db_documents

    print(f"Knowledge base documents: {len(kb_documents)}")
    print(f"Database documents: {len(db_documents)}")
    print(f"Total documents: {len(all_documents)}")

    chunks = text_splitter.split_documents(all_documents)

    print(f"Total chunks created: {len(chunks)}")

    texts = [chunk["text"] for chunk in chunks]
    embeddings = embedding_model.embed_texts(texts)

    vector_store.reset_collection()
    vector_store.add_documents(chunks, embeddings)

    print("RAG ingestion completed successfully.")
    print(f"Total vectors stored: {vector_store.count()}")


if __name__ == "__main__":
    main()