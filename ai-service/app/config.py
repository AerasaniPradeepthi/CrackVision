from pathlib import Path

# Base directories
BASE_DIR = Path(__file__).resolve().parent.parent
OUTPUTS_DIR = BASE_DIR / "outputs"
OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)

# Service configuration
SERVICE_NAME = "CrackVision AI Service"
SERVICE_VERSION = "0.1.0"
HOST = "0.0.0.0"
PORT = 8000

# File validation constraints
MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_MIME_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp"
}

# Image dimension constraints
MIN_DIMENSION_PX = 32
MAX_DIMENSION_PX = 8192

# Baseline Model metadata
MODEL_NAME = "CrackVision-CV-Baseline"
MODEL_VERSION = "0.1.0"
MODEL_TYPE = "experimental_computer_vision_baseline"
MODEL_METHOD = (
    "Grayscale conversion, bilateral noise filtering, CLAHE contrast enhancement, "
    "Black Hat morphological transformation, Canny edge detection, and contour elongation analysis"
)

DISCLAIMER_TEXT = (
    "Automated visual screening aid only. This experimental computer-vision baseline "
    "does not provide a structural safety assessment or structural engineering certification. "
    "All detections must be reviewed and verified on-site by a qualified structural engineer."
)
