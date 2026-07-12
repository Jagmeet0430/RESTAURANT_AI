from pathlib import Path
import os
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = BASE_DIR / ".env"

load_dotenv(dotenv_path=ENV_PATH, override=True)

KNOWLEDGE_BASE_DIR = BASE_DIR / "knowledge_base"
VECTOR_STORE_DIR = Path(os.getenv("CHROMA_PATH", "vector_store/chroma"))
if not VECTOR_STORE_DIR.is_absolute():
    VECTOR_STORE_DIR = BASE_DIR / VECTOR_STORE_DIR
LOG_FILE = BASE_DIR / "logs" / "chatbot.log"

COLLECTION_NAME = os.getenv("COLLECTION_NAME", "restaurant_knowledge")

EMBEDDING_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"

CHUNK_SIZE = 700
CHUNK_OVERLAP = 120

TOP_K = 2

DATABASE_URL = os.getenv("DATABASE_URL", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
GEMINI_API_URL = os.getenv(
    "GEMINI_API_URL",
    f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
)

APP_NAME = "RestaurantAI RAG Chatbot"
APP_VERSION = "1.0.0"
