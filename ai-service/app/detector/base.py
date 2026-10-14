from abc import ABC, abstractmethod
from typing import Tuple, List, Optional
import numpy as np

from app.schemas import RegionCoordinate, ScreeningCategory, ModelInfo


class DetectionResult:
    """Encapsulates the internal output from any crack detection pipeline."""

    def __init__(
        self,
        crack_detected: bool,
        screening_category: ScreeningCategory,
        confidence: Optional[float],
        regions: List[RegionCoordinate],
        crack_area_percentage: float,
        highlighted_image: Optional[np.ndarray],
        dimensions: Tuple[int, int, int],  # (width, height, channels)
        model_info: ModelInfo,
        status: str = "SUCCESS"
    ):
        self.crack_detected = crack_detected
        self.screening_category = screening_category
        self.confidence = confidence
        self.regions = regions
        self.crack_area_percentage = crack_area_percentage
        self.highlighted_image = highlighted_image
        self.dimensions = dimensions
        self.model_info = model_info
        self.status = status


class BaseCrackDetector(ABC):
    """
    Abstract interface for crack detection pipelines.
    Allows easy swapping between the handcrafted OpenCV baseline and future
    trained deep learning models (YOLO, UNet, PyTorch, ONNX).
    """

    @abstractmethod
    def get_model_info(self) -> ModelInfo:
        """Returns metadata about the active detection pipeline."""
        pass

    @abstractmethod
    def is_ready(self) -> bool:
        """Checks if the detector/model is initialized and ready to process requests."""
        pass

    @abstractmethod
    def detect(self, image: np.ndarray) -> DetectionResult:
        """
        Analyzes a BGR image array and returns a structured DetectionResult.

        Args:
            image: np.ndarray in BGR color format

        Returns:
            DetectionResult containing regions, metrics, and highlighted visual array
        """
        pass
