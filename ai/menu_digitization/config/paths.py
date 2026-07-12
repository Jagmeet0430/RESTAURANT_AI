from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]

INPUT_DIR = BASE_DIR / "input"
INPUT_IMAGES_DIR = INPUT_DIR / "images"
INPUT_WATCH_DIR = INPUT_DIR / "watch"
INPUT_PROCESSING_DIR = INPUT_DIR / "processing"
INPUT_PROCESSED_DIR = INPUT_DIR / "processed"
INPUT_FAILED_DIR = INPUT_DIR / "failed"

OUTPUT_DIR = BASE_DIR / "output"
OUTPUT_TEXT_DIR = OUTPUT_DIR / "text"
OUTPUT_JSON_DIR = OUTPUT_DIR / "json"
OUTPUT_CSV_DIR = OUTPUT_DIR / "csv"

LOGS_DIR = BASE_DIR / "logs"


def create_required_dirs():
    folders = [
        INPUT_IMAGES_DIR,
        INPUT_WATCH_DIR,
        INPUT_PROCESSING_DIR,
        INPUT_PROCESSED_DIR,
        INPUT_FAILED_DIR,
        OUTPUT_TEXT_DIR,
        OUTPUT_JSON_DIR,
        OUTPUT_CSV_DIR,
        LOGS_DIR,
    ]

    for folder in folders:
        folder.mkdir(parents=True, exist_ok=True)
