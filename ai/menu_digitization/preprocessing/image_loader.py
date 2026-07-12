from pathlib import Path
import cv2

VALID_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


def validate_image_path(image_path):
    image_path = Path(image_path)

    if not image_path.exists():
        raise FileNotFoundError(f"Image not found: {image_path}")

    if image_path.suffix.lower() not in VALID_IMAGE_EXTENSIONS:
        raise ValueError(
            f"Invalid image format: {image_path.suffix}. "
            f"Allowed formats: {VALID_IMAGE_EXTENSIONS}"
        )

    return image_path


def load_image(image_path):
    image_path = validate_image_path(image_path)

    image = cv2.imread(str(image_path))

    if image is None:
        raise ValueError(f"Unable to read image: {image_path}")

    return image
