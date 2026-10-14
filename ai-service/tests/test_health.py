from fastapi.testclient import TestClient


def test_health_endpoint_success(client: TestClient):
    """
    Verifies GET /health endpoint returns 200 OK, HEALTHY status,
    ready model state, and correct model metadata without claims of ML accuracy.
    """
    response = client.get("/health")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "HEALTHY"
    assert data["model_readiness"] == "READY"

    model_info = data["model_info"]
    assert model_info["name"] == "CrackVision-CV-Baseline"
    assert model_info["version"] == "0.1.0"
    assert model_info["model_type"] == "experimental_computer_vision_baseline"
    assert "method" in model_info and len(model_info["method"]) > 0

    assert isinstance(data["supported_formats"], list)
    assert ".png" in data["supported_formats"]
    assert ".jpg" in data["supported_formats"]
    assert ".jpeg" in data["supported_formats"]
    assert ".webp" in data["supported_formats"]
    assert "timestamp" in data and len(data["timestamp"]) > 0
