from pathlib import Path
from fastapi.testclient import TestClient


def test_analyze_clean_wall(client: TestClient, clean_wall_bytes: bytes):
    """
    Verifies that an ordinary textured concrete surface without cracks
    yields crack_detected=False, NORMAL category, 0.0% crack area, and null confidence.
    """
    response = client.post(
        "/analyze",
        files={"file": ("clean_wall.png", clean_wall_bytes, "image/png")},
    )
    assert response.status_code == 200
    data = response.json()

    assert data["status"] == "SUCCESS"
    assert data["crack_detected"] is False
    assert data["screening_category"] == "NORMAL"
    assert data["confidence"] is None
    assert data["regions_count"] == 0
    assert data["regions"] == []
    assert data["crack_area_percentage"] == 0.0
    assert data["highlighted_image_url"] is None
    assert data["original_filename"] == "clean_wall.png"
    assert "disclaimer" in data and len(data["disclaimer"]) > 0


def test_analyze_blank_image(client: TestClient, blank_image_bytes: bytes):
    """
    Verifies that a low-contrast, featureless image is flagged as REVIEW_REQUIRED
    with status LOW_CONTRAST_IMAGE and no false detections.
    """
    response = client.post(
        "/analyze",
        files={"file": ("blank.png", blank_image_bytes, "image/png")},
    )
    assert response.status_code == 200
    data = response.json()

    assert data["status"] == "LOW_CONTRAST_IMAGE"
    assert data["crack_detected"] is False
    assert data["screening_category"] == "REVIEW_REQUIRED"
    assert data["confidence"] is None
    assert data["regions_count"] == 0
    assert data["crack_area_percentage"] == 0.0
    assert data["highlighted_image_url"] is None


def test_analyze_synthetic_line_feature(client: TestClient, synthetic_line_bytes: bytes):
    """
    Verifies that an image with a dark linear candidate feature is detected,
    produces a strictly controlled small number of coherent candidate paths (not over-segmented),
    a non-fabricated null confidence, and a generated highlighted image URL.
    """
    response = client.post(
        "/analyze",
        files={"file": ("test_feature.png", synthetic_line_bytes, "image/png")},
    )
    assert response.status_code == 200
    data = response.json()

    assert data["status"] == "SUCCESS"
    assert data["crack_detected"] is True
    # Coherent merging must keep candidate count tightly controlled
    assert 1 <= data["regions_count"] <= 3
    assert len(data["regions"]) == data["regions_count"]

    # Verify candidate region properties
    region = data["regions"][0]
    assert region["x"] >= 0
    assert region["y"] >= 0
    assert region["width"] > 0
    assert region["height"] > 0
    assert region["area_px"] > 0
    assert region["perimeter_px"] > 0

    # Ensure area percentage is strictly bounded
    assert 0.0 < data["crack_area_percentage"] <= 100.0

    # Model honesty: confidence MUST be None for heuristic baseline
    assert data["confidence"] is None

    # Highlighted image URL must be provided and well-formed
    assert data["highlighted_image_url"] is not None
    assert data["highlighted_image_url"].startswith("/outputs/highlighted_")

    # Verify downloading the highlighted image
    output_res = client.get(data["highlighted_image_url"])
    assert output_res.status_code == 200
    assert output_res.headers["content-type"] == "image/png"
    assert len(output_res.content) > 0


def test_rough_concrete_texture_suppression(client: TestClient):
    """
    Verifies that coarse concrete surface roughness / texture noise
    is suppressed and does not produce overwhelming false positives.
    """
    import cv2
    import numpy as np

    np.random.seed(99)
    rough = np.full((350, 350, 3), 150, dtype=np.uint8)
    rough_noise = np.random.normal(0, 8, (350, 350, 3)).astype(np.int16)
    rough_surface = np.clip(rough.astype(np.int16) + rough_noise, 0, 255).astype(np.uint8)

    _, buf = cv2.imencode(".png", rough_surface)
    response = client.post(
        "/analyze",
        files={"file": ("rough_texture.png", buf.tobytes(), "image/png")},
    )
    assert response.status_code == 200
    data = response.json()

    # Grain must not trigger false crack paths
    assert data["crack_detected"] is False
    assert data["screening_category"] == "NORMAL"
    assert data["regions_count"] == 0
    assert data["crack_area_percentage"] == 0.0


def test_canvas_border_artifact_rejection(client: TestClient, border_frame_bytes: bytes):
    """
    Verifies that dark borders along image canvas boundaries are rejected as artifacts
    rather than being counted as full-image cracks.
    """
    response = client.post(
        "/analyze",
        files={"file": ("border_frame.png", border_frame_bytes, "image/png")},
    )
    assert response.status_code == 200
    data = response.json()

    # The crack area percentage must NOT be ~90%+
    assert data["crack_area_percentage"] < 50.0

    # None of the accepted regions should span virtually the whole canvas
    width = data["image_dimensions"]["width"]
    height = data["image_dimensions"]["height"]
    for reg in data["regions"]:
        assert not (reg["width"] >= 0.95 * width and reg["height"] >= 0.95 * height)


def test_real_crack_image_analysis_if_present(client: TestClient):
    """
    Verifies analysis against the real concrete crack image on disk if available.
    Ensures candidate regions count is controlled (<= 25, not 833),
    crack_area_percentage is realistically bounded (< 3.0%, not 18.16% or 96.7%),
    and no region spans the full canvas.
    """
    image_path = Path(r"C:\Users\Dell\Downloads\crack.png")
    if not image_path.exists():
        return

    with open(image_path, "rb") as f:
        response = client.post(
            "/analyze",
            files={"file": ("crack.png", f, "image/png")},
        )

    assert response.status_code == 200
    data = response.json()

    assert data["crack_detected"] is True
    assert data["confidence"] is None

    # Over-segmentation guard: candidate paths must be controlled (<= 25, not 833)
    assert 1 <= data["regions_count"] <= 25

    # Area must be realistically bounded for a hairline crack (< 3.0%, not 18% or 96%)
    assert 0.1 < data["crack_area_percentage"] < 3.0

    # Ensure no accepted region covers the full image frame (1448 x 1086)
    for reg in data["regions"]:
        assert not (reg["width"] >= 1300 and reg["height"] >= 1000)


def test_api_key_authentication(client: TestClient, monkeypatch, clean_wall_bytes: bytes):
    """
    Verifies that when CRACKVISION_AI_SERVICE_API_KEY is configured:
    - Missing/invalid key yields 403 Forbidden
    - Valid key via X-API-Key yields 200 OK
    - Valid key via Authorization: Bearer yields 200 OK
    """
    import app.main as main_module
    monkeypatch.setattr(main_module, "AI_SERVICE_API_KEY", "secret-test-key-123")

    # 1. Missing key -> 403
    res_no_key = client.post(
        "/analyze",
        files={"file": ("clean_wall.png", clean_wall_bytes, "image/png")},
    )
    assert res_no_key.status_code == 403
    assert "Invalid or missing AI Service API Key" in res_no_key.json()["detail"]

    # 2. Invalid key -> 403
    res_bad_key = client.post(
        "/analyze",
        files={"file": ("clean_wall.png", clean_wall_bytes, "image/png")},
        headers={"X-API-Key": "wrong-key"},
    )
    assert res_bad_key.status_code == 403

    # 3. Valid key via X-API-Key -> 200
    res_x_api_key = client.post(
        "/analyze",
        files={"file": ("clean_wall.png", clean_wall_bytes, "image/png")},
        headers={"X-API-Key": "secret-test-key-123"},
    )
    assert res_x_api_key.status_code == 200

    # 4. Valid key via Bearer token -> 200
    res_bearer = client.post(
        "/analyze",
        files={"file": ("clean_wall.png", clean_wall_bytes, "image/png")},
        headers={"Authorization": "Bearer secret-test-key-123"},
    )
    assert res_bearer.status_code == 200

