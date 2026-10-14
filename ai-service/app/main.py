from datetime import datetime, timezone
from fastapi import FastAPI, File, UploadFile, status
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

from app.config import (
    SERVICE_NAME,
    SERVICE_VERSION,
    ALLOWED_EXTENSIONS,
    DISCLAIMER_TEXT,
)
from app.detector import OpenCVBaselineDetector
from app.schemas import (
    HealthResponse,
    AnalysisResponse,
    ImageDimensions,
)
from app.utils.image_utils import (
    validate_image_upload,
    read_and_decode_image,
    save_highlighted_image,
    get_safe_output_path,
)

# Initialize FastAPI application
app = FastAPI(
    title=SERVICE_NAME,
    version=SERVICE_VERSION,
    description="CrackVision preliminary visual crack detection microservice (Phase 1).",
)

# Enable CORS for local integration testing with frontend & backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize active detector instance (cleanly swappable with future trained ML detector)
detector = OpenCVBaselineDetector()


@app.get(
    "/health",
    response_model=HealthResponse,
    summary="Service Health and Model Status",
    description="Returns the status of the computer-vision service and active detector readiness.",
)
async def health_check():
    model_ready = detector.is_ready()
    return HealthResponse(
        status="HEALTHY" if model_ready else "DEGRADED",
        model_readiness="READY" if model_ready else "NOT_READY",
        model_info=detector.get_model_info(),
        supported_formats=sorted(list(ALLOWED_EXTENSIONS)),
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


@app.post(
    "/analyze",
    response_model=AnalysisResponse,
    status_code=status.HTTP_200_OK,
    summary="Analyze Structural Image for Cracks",
    description="Accepts an image upload and performs automated preliminary visual crack screening.",
)
async def analyze_image(file: UploadFile = File(...)):
    # 1. Validate file extension and MIME type
    clean_filename = validate_image_upload(file)

    # 2. Read contents, validate constraints, and decode image
    image_bgr, _ = await read_and_decode_image(file)

    # 3. Execute detection pipeline
    result = detector.detect(image_bgr)

    # 4. Save highlighted output if crack regions were detected
    highlighted_image_url = None
    if result.highlighted_image is not None and result.crack_detected:
        highlighted_image_url = save_highlighted_image(result.highlighted_image)

    # 5. Build structured response conforming to the analysis contract
    width, height, channels = result.dimensions
    return AnalysisResponse(
        status=result.status,
        crack_detected=result.crack_detected,
        screening_category=result.screening_category,
        confidence=result.confidence,
        regions_count=len(result.regions),
        regions=result.regions,
        crack_area_percentage=result.crack_area_percentage,
        highlighted_image_url=highlighted_image_url,
        original_filename=clean_filename,
        image_dimensions=ImageDimensions(
            width=width,
            height=height,
            channels=channels,
        ),
        model_info=result.model_info,
        disclaimer=DISCLAIMER_TEXT,
        processed_at=datetime.now(timezone.utc).isoformat(),
    )


@app.get(
    "/outputs/{filename}",
    summary="Retrieve Generated Highlighted Image",
    description="Returns the highlighted image generated during analysis with path traversal protection.",
)
async def get_highlighted_image(filename: str):
    safe_path = get_safe_output_path(filename)
    return FileResponse(
        path=str(safe_path),
        media_type="image/png",
        filename=filename,
    )
