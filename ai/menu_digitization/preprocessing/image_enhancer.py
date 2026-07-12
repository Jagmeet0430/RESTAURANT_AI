import cv2
import numpy as np


def resize_image(image, max_width=1600):
    height, width = image.shape[:2]

    if width <= max_width:
        return image

    scale = max_width / width
    new_height = int(height * scale)

    return cv2.resize(
        image,
        (max_width, new_height),
        interpolation=cv2.INTER_AREA
    )


def convert_to_grayscale(image):
    return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)


def denoise_image(gray_image):
    return cv2.fastNlMeansDenoising(
        gray_image,
        None,
        h=15,
        templateWindowSize=7,
        searchWindowSize=21
    )


def sharpen_image(gray_image):
    kernel = np.array([
        [0, -1, 0],
        [-1, 5, -1],
        [0, -1, 0]
    ])

    return cv2.filter2D(gray_image, -1, kernel)


def threshold_image(gray_image):
    return cv2.adaptiveThreshold(
        gray_image,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        31,
        11
    )


def deskew_image(image):
    try:
        gray = image

        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

        inverted = cv2.bitwise_not(gray)
        coords = np.column_stack(np.where(inverted > 0))

        if len(coords) == 0:
            return image

        angle = cv2.minAreaRect(coords)[-1]

        if angle < -45:
            angle = -(90 + angle)
        else:
            angle = -angle

        if abs(angle) > 15:
            return image

        height, width = image.shape[:2]
        center = (width // 2, height // 2)

        rotation_matrix = cv2.getRotationMatrix2D(center, angle, 1.0)

        return cv2.warpAffine(
            image,
            rotation_matrix,
            (width, height),
            flags=cv2.INTER_CUBIC,
            borderMode=cv2.BORDER_REPLICATE
        )

    except Exception:
        return image
