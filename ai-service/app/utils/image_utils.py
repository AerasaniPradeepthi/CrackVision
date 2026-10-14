import os
import uuid
from pathlib import Path
from typing import Tuple
import cv2
import numpy as np
from fastapi import HTTPException, UploadFile, status

from app.config import (
    ALLOWED_EXTENSIONS,
    ALLOWED_MIME_TYPES,
    MAX_UPLOAD_SIZE_BYTES,
    MIN_DIMENSION_PX,
    MAX_DIMENSION_PX,
    OUTPUTS_DIR,
)


def validate_image_upload(file: UploadFile) -> str:
    """
    Validates uploaded file filename extension and MIME type.
    Returns cleaned filename.
    """
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file must have a valid filename."
        )

    # Secure filename extraction (strip path components)
    clean_filename = Path(file.filename).name
    ext = Path(clean_filename).suffix.lower()

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file format '{ext}'. Allowed formats: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    # Validate content-type if provided
    if file.content_type and file.content_type.lower() not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported MIME type '{file.content_type}'. Allowed types: {', '.join(sorted(ALLOWED_MIME_TYPES))}"
        )

    return clean_filename


async def read_and_decode_image(file: UploadFile) -> Tuple[np.ndarray, bytes]:
    """
    Reads image bytes, enforces file size constraints, and decodes with OpenCV.
    Returns decoded BGR numpy array and raw bytes.
    """
    contents = await file.read()

    if len(contents) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty (0 bytes)."
        )

    if len(contents) > MAX_UPLOAD_SIZE_BYTES:
        max_mb = MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds the maximum allowed limit of {max_mb} MB."
        )

    # Decode using OpenCV
    np_buf = np.frombuffer(contents, dtype=np.uint8)
    image = cv2.imdecode(np_buf, cv2.IMREAD_COLOR)

    if image is None or image.size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file could not be decoded as a valid image. The image may be corrupted or malformed."
        )

    height, width = image.shape[:2]
    if width < MIN_DIMENSION_PX or height < MIN_DIMENSION_PX:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Image dimensions ({width}x{height}) are too small. Minimum required: {MIN_DIMENSION_PX}x{MIN_DIMENSION_PX} pixels."
        )

    if width > MAX_DIMENSION_PX or height > MAX_DIMENSION_PX:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Image dimensions ({width}x{height}) exceed maximum allowed dimension of {MAX_DIMENSION_PX} pixels."
        )

    return image, contents


def save_highlighted_image(highlighted_bgr: np.ndarray) -> str:
    """
    Saves highlighted image to the controlled outputs directory using a UUID filename.
    Returns the relative URL endpoint (e.g., /outputs/highlighted_xyz.png).
    """
    OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
    generated_filename = f"highlighted_{uuid.uuid4().hex}.png"
    target_path = OUTPUTS_DIR / generated_filename

    # Save as PNG
    success = cv2.imwrite(str(target_path), highlighted_bgr)
    if not success:
        raise RuntimeError("Failed to encode and save highlighted image.")

    return f"/outputs/{generated_filename}"


def get_safe_output_path(filename: str) -> Path:
    """
    Validates that the requested output filename exists inside OUTPUTS_DIR
    and prevents any path traversal attempts.
    """
    # Prevent traversal
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid filename: path traversal is not permitted."
        )

    target_path = (OUTPUTS_DIR / filename).resolve()
    base_dir = OUTPUTS_DIR.resolve()

    if not str(target_path).startswith(str(base_dir)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Access denied: path traversal attempt detected."
        )

    if not target_path.exists() or not target_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Highlighted image file not found."
        )

    return target_path
