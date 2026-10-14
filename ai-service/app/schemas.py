from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field


class ScreeningCategory(str, Enum):
    NORMAL = "NORMAL"
    MINOR = "MINOR"
    MODERATE = "MODERATE"
    SEVERE = "SEVERE"
    REVIEW_REQUIRED = "REVIEW_REQUIRED"


class RegionCoordinate(BaseModel):
    x: int = Field(..., description="Top-left X coordinate of detected bounding box")
    y: int = Field(..., description="Top-left Y coordinate of detected bounding box")
    width: int = Field(..., description="Width of bounding box in pixels")
    height: int = Field(..., description="Height of bounding box in pixels")
    area_px: float = Field(..., description="Contour area in pixels")
    perimeter_px: float = Field(..., description="Contour arc length/perimeter in pixels")
    aspect_ratio: float = Field(..., description="Ratio of max dimension to min dimension")


class ImageDimensions(BaseModel):
    width: int = Field(..., description="Image width in pixels")
    height: int = Field(..., description="Image height in pixels")
    channels: int = Field(..., description="Number of color channels")


class ModelInfo(BaseModel):
    name: str = Field(..., description="Name of the model or detection pipeline")
    version: str = Field(..., description="Version of the model or algorithm")
    model_type: str = Field(..., description="Algorithm type (e.g. experimental_computer_vision_baseline)")
    method: str = Field(..., description="Brief description of the image-processing / detection methodology")


class AnalysisResponse(BaseModel):
    status: str = Field(..., description="Processing status (SUCCESS, REVIEW_REQUIRED, etc.)")
    crack_detected: bool = Field(..., description="Whether potential crack-like regions were detected")
    screening_category: ScreeningCategory = Field(
        ...,
        description="Preliminary screening category: NORMAL, MINOR, MODERATE, SEVERE, or REVIEW_REQUIRED"
    )
    confidence: Optional[float] = Field(
        None,
        description="Statistical confidence score (None/null for handcrafted baseline; only provided by trained validated models)"
    )
    regions_count: int = Field(..., description="Number of crack-like candidate regions found")
    regions: List[RegionCoordinate] = Field(default_factory=list, description="Coordinates of detected crack regions")
    crack_area_percentage: float = Field(..., description="Percentage of total image pixels classified as crack-like")
    highlighted_image_url: Optional[str] = Field(
        None,
        description="Relative endpoint URL to retrieve the highlighted output image (null if no cracks detected)"
    )
    original_filename: str = Field(..., description="Original filename of uploaded image")
    image_dimensions: ImageDimensions = Field(..., description="Dimensions of the analyzed image")
    model_info: ModelInfo = Field(..., description="Metadata describing the model / algorithm used")
    disclaimer: str = Field(
        ...,
        description="Notice that this output is an automated visual screening aid, not a structural safety assessment"
    )
    processed_at: str = Field(..., description="ISO 8601 timestamp of analysis completion")


class HealthResponse(BaseModel):
    status: str = Field(..., description="Service health status (e.g. HEALTHY)")
    model_readiness: str = Field(..., description="Readiness status of detection model/pipeline")
    model_info: ModelInfo = Field(..., description="Information on the active detection pipeline")
    supported_formats: List[str] = Field(..., description="List of supported image file extensions")
    timestamp: str = Field(..., description="Current server ISO 8601 timestamp")
