from pathlib import Path
import cv2

from config.paths import INPUT_PROCESSED_DIR
from preprocessing.image_loader import load_image
from preprocessing.image_enhancer import (
    resize_image,
    convert_to_grayscale,
    denoise_image,
    sharpen_image,
    threshold_image,
    deskew_image,
)


def preprocess_image(image_path, save_output=True):
    image_path = Path(image_path)

    original_image = load_image(image_path)

    resized = resize_image(original_image)
    gray = convert_to_grayscale(resized)
    denoised = denoise_image(gray)
    sharpened = sharpen_image(denoised)
    thresholded = threshold_image(sharpened)
    final_image = deskew_image(thresholded)

    output_path = None

    if save_output:
        INPUT_PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

        output_filename = f"{image_path.stem}_processed.png"
        output_path = INPUT_PROCESSED_DIR / output_filename

        cv2.imwrite(str(output_path), final_image)

    return {
        "original_path": str(image_path),
        "processed_path": str(output_path) if output_path else None,
        "image": final_image,
        "shape": final_image.shape,
    }
