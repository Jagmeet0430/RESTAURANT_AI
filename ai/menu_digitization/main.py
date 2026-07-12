from config.paths import (
    create_required_dirs,
    INPUT_IMAGES_DIR,
    OUTPUT_TEXT_DIR,
    OUTPUT_JSON_DIR,
    OUTPUT_CSV_DIR,
)

from preprocessing.preprocess_pipeline import preprocess_image
from ocr.ocr_engine import OCREngine
from menu_parser.layout_parser import parse_layout_items
from menu_parser.correction import correct_menu_items
from app_utils.file_writer import save_json, save_csv


def main():
    print("Menu Digitization AI - Phase 6 Started")

    create_required_dirs()

    image_path = INPUT_IMAGES_DIR / "menu1.jpg"

    if not image_path.exists():
        print("Please add a menu image here:")
        print(image_path)
        return

    preprocess_result = preprocess_image(image_path)
    processed_image_path = preprocess_result["processed_path"]

    print("Image preprocessing completed successfully.")
    print("Processed image:", processed_image_path)

    print("Loading PaddleOCR...")
    ocr_engine = OCREngine(lang="en")

    print("Extracting OCR layout with coordinates...")
    layout_items = ocr_engine.extract_layout(processed_image_path)

    print("Total OCR boxes detected:", len(layout_items))

    OUTPUT_TEXT_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_JSON_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_CSV_DIR.mkdir(parents=True, exist_ok=True)

    text_output_path = OUTPUT_TEXT_DIR / f"{image_path.stem}_layout.txt"
    raw_layout_json_path = OUTPUT_JSON_DIR / f"{image_path.stem}_ocr_layout.json"

    with open(text_output_path, "w", encoding="utf-8") as file:
        for item in layout_items:
            file.write(
                f"{item['text']} | x={item['x_center']:.2f} | y={item['y_center']:.2f}\n"
            )

    save_json(layout_items, raw_layout_json_path)

    print("OCR layout text saved at:", text_output_path)
    print("OCR layout JSON saved at:", raw_layout_json_path)

    print("Parsing layout-aware menu data...")
    menu_items = parse_layout_items(layout_items)

    print("Applying OCR correction system...")
    final_menu_items = correct_menu_items(menu_items)

    final_json_path = OUTPUT_JSON_DIR / f"{image_path.stem}_final.json"
    final_csv_path = OUTPUT_CSV_DIR / f"{image_path.stem}_final.csv"

    save_json(final_menu_items, final_json_path)
    save_csv(final_menu_items, final_csv_path)

    print("\nFinal Corrected Menu Items")
    print("-" * 70)

    for item in final_menu_items:
        name = item.get("name", "")
        original_name = item.get("original_name", "")
        category = item.get("category", "Uncategorized")
        price = item.get("price", "")
        column = item.get("column", "-")

        if original_name and original_name != name:
            print(
                f"{name} | {category} | Rs.{price} | Col {column} | OCR: {original_name}"
            )
        else:
            print(
                f"{name} | {category} | Rs.{price} | Col {column}"
            )

    print("-" * 70)
    print("Total final items:", len(final_menu_items))
    print("Final JSON saved at:", final_json_path)
    print("Final CSV saved at:", final_csv_path)


if __name__ == "__main__":
    main()
