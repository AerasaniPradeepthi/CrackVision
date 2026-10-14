import io
import pytest
import cv2
import numpy as np
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="session")
def client() -> TestClient:
    """FastAPI TestClient fixture."""
    return TestClient(app)


@pytest.fixture
def clean_wall_bytes() -> bytes:
    """
    Creates an in-memory PNG of an ordinary concrete surface with subtle noise
    and no crack-like anomalies.
    """
    np.random.seed(42)
    base = np.full((300, 300, 3), 160, dtype=np.uint8)
    noise = np.random.normal(0, 4, (300, 300, 3)).astype(np.int16)
    clean_surface = np.clip(base.astype(np.int16) + noise, 0, 255).astype(np.uint8)

    success, buffer = cv2.imencode(".png", clean_surface)
    assert success, "Failed to encode clean surface to PNG"
    return buffer.tobytes()


@pytest.fixture
def blank_image_bytes() -> bytes:
    """
    Creates an in-memory PNG of a flat, featureless image (low contrast, variance < 5).
    """
    blank = np.full((300, 300, 3), 200, dtype=np.uint8)
    success, buffer = cv2.imencode(".png", blank)
    assert success, "Failed to encode blank image to PNG"
    return buffer.tobytes()


@pytest.fixture
def synthetic_line_bytes() -> bytes:
    """
    Creates an in-memory PNG with a distinct dark linear feature drawn on a textured surface.
    Used for automated geometric line detection verification.
    """
    np.random.seed(42)
    base = np.full((300, 300, 3), 160, dtype=np.uint8)
    noise = np.random.normal(0, 4, (300, 300, 3)).astype(np.int16)
    surface = np.clip(base.astype(np.int16) + noise, 0, 255).astype(np.uint8)

    pts = np.array([[40, 50], [90, 110], [150, 140], [210, 220], [260, 270]], np.int32)
    cv2.polylines(surface, [pts], isClosed=False, color=(30, 30, 30), thickness=3)

    success, buffer = cv2.imencode(".png", surface)
    assert success, "Failed to encode synthetic line image to PNG"
    return buffer.tobytes()


@pytest.fixture
def border_frame_bytes() -> bytes:
    """
    Creates an in-memory PNG containing an outer border frame hugging the image canvas,
    designed to verify canvas-border artifact rejection.
    """
    img = np.full((400, 400, 3), 160, dtype=np.uint8)
    # Draw a 4-pixel dark border around the entire canvas perimeter
    cv2.rectangle(img, (0, 0), (399, 399), (20, 20, 20), thickness=4)

    success, buffer = cv2.imencode(".png", img)
    assert success, "Failed to encode border frame image to PNG"
    return buffer.tobytes()


@pytest.fixture
def corrupt_image_bytes() -> bytes:
    """Random invalid non-image byte content."""
    return b"CorruptBinaryPayloadNotAPngImageHeader\x00\x01\x02\x03\xff\xfe"


@pytest.fixture
def empty_file_bytes() -> bytes:
    """Zero-byte file content."""
    return b""
