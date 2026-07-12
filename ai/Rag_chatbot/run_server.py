from pathlib import Path
import sys

import uvicorn


BASE_DIR = Path(__file__).resolve().parent
LOG_DIR = BASE_DIR / "logs"
LOG_DIR.mkdir(exist_ok=True)

sys.stdout = (LOG_DIR / "rag_server.out.log").open(
    "a",
    buffering=1,
    encoding="utf-8",
)
sys.stderr = (LOG_DIR / "rag_server.err.log").open(
    "a",
    buffering=1,
    encoding="utf-8",
)


if __name__ == "__main__":
    uvicorn.run(
        "app:app",
        host="127.0.0.1",
        port=8001,
        log_level="info",
    )
