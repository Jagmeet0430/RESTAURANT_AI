import os
from pathlib import Path

os.environ["FLAGS_use_mkldnn"] = "0"
os.environ["FLAGS_use_onednn"] = "0"
os.environ["FLAGS_enable_pir_api"] = "0"

from paddleocr import PaddleOCR


class OCREngine:
    def __init__(self, lang="en"):
        try:
            self.ocr = PaddleOCR(
                use_angle_cls=False,
                lang=lang,
                enable_mkldnn=False,
            )
        except TypeError:
            self.ocr = PaddleOCR(
                use_angle_cls=False,
                lang=lang,
            )

    def extract_text(self, image_path):
        layout_items = self.extract_layout(image_path)
        return [item["text"] for item in layout_items]

    def extract_layout(self, image_path):
        image_path = Path(image_path)
        if not image_path.exists():
            raise FileNotFoundError(f"OCR image not found: {image_path}")
        result = self.ocr.ocr(str(image_path), cls=False)
        layout_items = []
        if not result:
            return layout_items
        for page in result:
            if page is None:
                continue
            for line in page:
                try:
                    box = line[0]
                    text = str(line[1][0]).strip()
                    score = float(line[1][1])
                    if not text or score < 0.40:
                        continue
                    x_values = [point[0] for point in box]
                    y_values = [point[1] for point in box]
                    x_min = min(x_values)
                    x_max = max(x_values)
                    y_min = min(y_values)
                    y_max = max(y_values)
                    layout_items.append({
                        "text": text,
                        "score": score,
                        "box": box,
                        "x_min": x_min,
                        "x_max": x_max,
                        "y_min": y_min,
                        "y_max": y_max,
                        "x_center": (x_min + x_max) / 2,
                        "y_center": (y_min + y_max) / 2,
                    })
                except Exception:
                    continue
        return layout_items
