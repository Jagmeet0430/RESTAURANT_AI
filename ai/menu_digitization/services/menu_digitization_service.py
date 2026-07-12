import shutil
from pathlib import Path

from config.paths import (
    INPUT_IMAGES_DIR,
    OUTPUT_TEXT_DIR,
    OUTPUT_JSON_DIR,
    OUTPUT_CSV_DIR,
    create_required_dirs,
)

from config.settings import (
    ALLOWED_IMAGE_EXTENSIONS,
    MAX_UPLOAD_SIZE_BYTES,
    OCR_LANGUAGE,
)

from preprocessing.preprocess_pipeline import preprocess_image
from ocr.ocr_engine import OCREngine
from menu_parser.layout_parser import parse_layout_items
from menu_parser.correction import correct_menu_items
from app_utils.file_writer import save_json, save_csv
from app_utils.logger import get_logger
from database.insert_menu import insert_menu_items


logger = get_logger(__name__)


def sanitize_filename(filename):
    filename = Path(filename).name
    filename = filename.replace(" ", "_")
    return filename


def validate_upload_file(upload_file):
    filename = sanitize_filename(upload_file.filename)
    extension = Path(filename).suffix.lower()

    if extension not in ALLOWED_IMAGE_EXTENSIONS:
        raise ValueError(
            f"Invalid image format: {extension}. "
            f"Allowed formats: {sorted(ALLOWED_IMAGE_EXTENSIONS)}"
        )

    upload_file.file.seek(0, 2)
    file_size = upload_file.file.tell()
    upload_file.file.seek(0)

    if file_size > MAX_UPLOAD_SIZE_BYTES:
        raise ValueError("Uploaded file is too large.")

    if file_size == 0:
        raise ValueError("Uploaded file is empty.")

    return filename


def save_uploaded_image(upload_file):
    create_required_dirs()

    filename = validate_upload_file(upload_file)
    destination_path = INPUT_IMAGES_DIR / filename

    with open(destination_path, "wb") as buffer:
        shutil.copyfileobj(upload_file.file, buffer)

    logger.info("Uploaded image saved: %s", destination_path)

    return destination_path


def process_menu_image(image_path, save_to_database=True):
    image_path = Path(image_path)

    if not image_path.exists():
        raise FileNotFoundError(f"Image not found: {image_path}")

    logger.info("Menu digitization started for image: %s", image_path)

    create_required_dirs()

    preprocess_result = preprocess_image(image_path)
    processed_image_path = preprocess_result["processed_path"]

    logger.info("Image preprocessing completed: %s", processed_image_path)

    ocr_engine = OCREngine(lang=OCR_LANGUAGE)
    layout_items = ocr_engine.extract_layout(processed_image_path)

    logger.info("OCR boxes detected: %s", len(layout_items))

    OUTPUT_TEXT_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_JSON_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_CSV_DIR.mkdir(parents=True, exist_ok=True)

    layout_text_path = OUTPUT_TEXT_DIR / f"{image_path.stem}_layout.txt"

    with open(layout_text_path, "w", encoding="utf-8") as file:
        for item in layout_items:
            file.write(
                f"{item['text']} | x={item['x_center']:.2f} | y={item['y_center']:.2f}\n"
            )

    raw_layout_json_path = OUTPUT_JSON_DIR / f"{image_path.stem}_ocr_layout.json"
    save_json(layout_items, raw_layout_json_path)

    parsed_items = parse_layout_items(layout_items)
    final_items = correct_menu_items(parsed_items)

    final_json_path = OUTPUT_JSON_DIR / f"{image_path.stem}_final.json"
    final_csv_path = OUTPUT_CSV_DIR / f"{image_path.stem}_final.csv"

    save_json(final_items, final_json_path)
    save_csv(final_items, final_csv_path)

    db_saved = False

    if save_to_database:
        insert_menu_items(final_json_path)
        db_saved = True

    logger.info(
        "Menu digitization completed. Items=%s DB Saved=%s",
        len(final_items),
        db_saved
    )

    return {
        "image_name": image_path.name,
        "original_image_path": str(image_path),
        "processed_image_path": str(processed_image_path),
        "ocr_boxes_detected": len(layout_items),
        "items_count": len(final_items),
        "text_output": str(layout_text_path),
        "raw_layout_json": str(raw_layout_json_path),
        "final_json": str(final_json_path),
        "final_csv": str(final_csv_path),
        "database_saved": db_saved,
        "items": final_items,
    }
