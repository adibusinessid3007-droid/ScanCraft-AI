import cv2
import numpy as np


def decode_image(image_bytes):
    array = np.frombuffer(image_bytes, dtype=np.uint8)
    image = cv2.imdecode(array, cv2.IMREAD_COLOR)

    if image is None:
        raise ValueError("Unable to decode image. Please upload a valid JPG or PNG.")

    return image


def encode_image(image):
    success, encoded = cv2.imencode(".png", image)

    if not success:
        raise ValueError("Unable to create processed image.")

    return encoded.tobytes()


def natural_colour(image):
    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)

    clahe = cv2.createCLAHE(clipLimit=1.3, tileGridSize=(8, 8))
    improved = clahe.apply(l)
    improved = cv2.addWeighted(l, 0.55, improved, 0.45, 0)

    return cv2.cvtColor(
        cv2.merge((improved, a, b)),
        cv2.COLOR_LAB2BGR
    )


def enhanced_colour(image):
    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)

    clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
    improved = clahe.apply(l)

    result = cv2.cvtColor(
        cv2.merge((improved, a, b)),
        cv2.COLOR_LAB2BGR
    )

    blurred = cv2.GaussianBlur(result, (0, 0), 1.2)

    return cv2.addWeighted(result, 1.3, blurred, -0.3, 0)


def grayscale_image(image):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    return cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)


def black_white(image):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (3, 3), 0)

    result = cv2.adaptiveThreshold(
        gray,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        31,
        12
    )

    return cv2.cvtColor(result, cv2.COLOR_GRAY2BGR)


def process_image(image_bytes, mode="original"):
    image = decode_image(image_bytes)

    filters = {
        "original": lambda img: img.copy(),
        "natural": natural_colour,
        "enhanced": enhanced_colour,
        "grayscale": grayscale_image,
        "bw": black_white,
    }

    if mode not in filters:
        raise ValueError(f"Unknown filter: {mode}")

    result = filters[mode](image)

    return encode_image(result)