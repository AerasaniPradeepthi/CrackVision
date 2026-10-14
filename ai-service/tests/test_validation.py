import cv2
import numpy as np
from fastapi.testclient import TestClient


def test_upload_unsupported_extension(client: TestClient):
    """Verifies that non-whitelisted file extensions return HTTP 415."""
    response = client.post(
        "/analyze",
        files={"file": ("notes.txt", b"some text content", "text/plain")},
    )
    assert response.status_code == 415
    assert "Unsupported file format" in response.json()["detail"]


def test_upload_unsupported_mime_type(client: TestClient, clean_wall_bytes: bytes):
    """Verifies that invalid MIME types return HTTP 415."""
    response = client.post(
        "/analyze",
        files={"file": ("image.png", clean_wall_bytes, "application/octet-stream")},
    )
    assert response.status_code == 415
    assert "Unsupported MIME type" in response.json()["detail"]


def test_upload_empty_file(client: TestClient, empty_file_bytes: bytes):
    """Verifies that 0-byte file uploads return HTTP 400."""
    response = client.post(
        "/analyze",
        files={"file": ("empty.png", empty_file_bytes, "image/png")},
    )
    assert response.status_code == 400
    assert "empty" in response.json()["detail"].lower()


def test_upload_corrupt_image_bytes(client: TestClient, corrupt_image_bytes: bytes):
    """Verifies that corrupt bytes with valid image extension return HTTP 400."""
    response = client.post(
        "/analyze",
        files={"file": ("corrupt.png", corrupt_image_bytes, "image/png")},
    )
    assert response.status_code == 400
    assert "could not be decoded" in response.json()["detail"].lower()


def test_upload_too_small_image(client: TestClient):
    """Verifies that an image smaller than 32x32 pixels returns HTTP 400."""
    tiny_img = np.zeros((16, 16, 3), dtype=np.uint8)
    _, buffer = cv2.imencode(".png", tiny_img)
    response = client.post(
        "/analyze",
        files={"file": ("tiny.png", buffer.tobytes(), "image/png")},
    )
    assert response.status_code == 400
    assert "too small" in response.json()["detail"].lower()


def test_path_traversal_prevention(client: TestClient):
    """
    Verifies that path traversal attempts on /outputs/{filename} return HTTP 400
    and that the utility function explicitly rejects relative traversal paths.
    """
    import pytest
    from fastapi import HTTPException
    from app.utils.image_utils import get_safe_output_path

    # API call with parent directory traversal indicator
    response = client.get("/outputs/file..png")
    assert response.status_code == 400
    assert "path traversal" in response.json()["detail"].lower()

    # Direct validation checks for UNIX and Windows traversal paths
    with pytest.raises(HTTPException) as exc_info_unix:
        get_safe_output_path("../../app/config.py")
    assert exc_info_unix.value.status_code == 400

    with pytest.raises(HTTPException) as exc_info_win:
        get_safe_output_path("..\\..\\app\\config.py")
    assert exc_info_win.value.status_code == 400


def test_nonexistent_output_file(client: TestClient):
    """Verifies that requesting a nonexistent file in outputs returns HTTP 404."""
    response = client.get("/outputs/highlighted_nonexistent_000000000000.png")
    assert response.status_code == 404
