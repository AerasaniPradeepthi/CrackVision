import cv2
import numpy as np
from typing import List, Tuple, Optional

from app.config import (
    MODEL_NAME,
    MODEL_VERSION,
    MODEL_TYPE,
    MODEL_METHOD,
)
from app.schemas import RegionCoordinate, ScreeningCategory, ModelInfo
from app.detector.base import BaseCrackDetector, DetectionResult


class OpenCVBaselineDetector(BaseCrackDetector):
    """
    Experimental baseline for detecting preliminary crack-like features in structural images
    using classical computer vision techniques (filtering, morphology, edge detection).

    NOTE: This is NOT a trained machine learning or deep learning model.
    No confidence score is fabricated; confidence is explicitly set to None.
    This detector provides a visual screening baseline that can be replaced
    by a trained deep learning model (e.g. YOLOv8, UNet) implementing BaseCrackDetector.
    """

    def __init__(
        self,
        min_perimeter_px: float = 65.0,
        min_elongation_ratio: float = 1.8,
        min_dimension_px: int = 30,
        max_gap_merge_px: int = 30,
        max_merged_span_px: int = 350,
    ):
        self.min_perimeter_px = min_perimeter_px
        self.min_elongation_ratio = min_elongation_ratio
        self.min_dimension_px = min_dimension_px
        self.max_gap_merge_px = max_gap_merge_px
        self.max_merged_span_px = max_merged_span_px

    def get_model_info(self) -> ModelInfo:
        return ModelInfo(
            name=MODEL_NAME,
            version=MODEL_VERSION,
            model_type=MODEL_TYPE,
            method=MODEL_METHOD,
        )

    def is_ready(self) -> bool:
        """Classical CV baseline requires no weights to load and is always ready."""
        return True

    def detect(self, image: np.ndarray) -> DetectionResult:
        """
        Processes an input BGR image and extracts localized, line-like candidate features.
        Rejects full-canvas contours, image-border artifacts, and isolated texture grain.
        Merges proximate segments into coherent candidate paths.
        """
        if image is None or image.size == 0:
            raise ValueError("Input image array is empty or None")

        height, width = image.shape[:2]
        channels = image.shape[2] if len(image.shape) > 2 else 1
        total_pixels = height * width

        # 1. Check for degenerate or unreadable images (e.g., pure flat color)
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if channels > 1 else image
        variance = float(np.var(gray))

        if variance < 5.0:
            return DetectionResult(
                crack_detected=False,
                screening_category=ScreeningCategory.REVIEW_REQUIRED,
                confidence=None,
                regions=[],
                crack_area_percentage=0.0,
                highlighted_image=None,
                dimensions=(width, height, channels),
                model_info=self.get_model_info(),
                status="LOW_CONTRAST_IMAGE",
            )

        # 2. Bilateral filter: smooths concrete texture while preserving sharp edges
        filtered = cv2.bilateralFilter(gray, d=9, sigmaColor=75, sigmaSpace=75)

        # 3. CLAHE (Contrast Limited Adaptive Histogram Equalization)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(filtered)

        # 4. Morphological Black Hat transform: isolates dark narrow features against background
        kernel_size = max(11, min(25, int(min(height, width) * 0.02)))
        if kernel_size % 2 == 0:
            kernel_size += 1
        morph_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (kernel_size, kernel_size))
        blackhat = cv2.morphologyEx(enhanced, cv2.MORPH_BLACKHAT, morph_kernel)

        # If peak dark contrast is negligible, no crack features exist on the surface
        if blackhat.max() < 25:
            return DetectionResult(
                crack_detected=False,
                screening_category=ScreeningCategory.NORMAL,
                confidence=None,
                regions=[],
                crack_area_percentage=0.0,
                highlighted_image=None,
                dimensions=(width, height, channels),
                model_info=self.get_model_info(),
                status="SUCCESS",
            )

        # 5. Statistical noise-aware thresholding:
        # Surface roughness follows the bulk Black Hat distribution. Fissures stand out significantly.
        mean_val = float(np.mean(blackhat))
        std_val = float(np.std(blackhat))
        thresh_val = max(35.0, mean_val + 1.8 * std_val)
        _, binary = cv2.threshold(blackhat, thresh_val, 255, cv2.THRESH_BINARY)

        # 6. Morphological closing to bridge small gaps along candidate line paths
        close_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        closed = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, close_kernel)

        # 7. Contour extraction
        contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        # 8. Contour filtering for localized line-like geometry and border-artifact rejection
        raw_regions: List[RegionCoordinate] = []
        valid_contours = []
        mask = np.zeros((height, width), dtype=np.uint8)
        max_crack_length = 0.0

        for cnt in contours:
            x, y, w, h = cv2.boundingRect(cnt)
            perimeter = float(cv2.arcLength(cnt, closed=False))
            area = float(cv2.contourArea(cnt))

            # Reject canvas-spanning contours (the full image frame or nearly the full image)
            if w >= 0.98 * width and h >= 0.98 * height:
                continue
            if area > 0.25 * total_pixels:
                continue

            # Reject border-glued artifacts spanning most of the edge
            is_border_glued = (x <= 1 or y <= 1 or (x + w) >= width - 1 or (y + h) >= height - 1)
            if is_border_glued and (w >= 0.85 * width or h >= 0.85 * height):
                continue

            max_dim = max(w, h)
            min_dim = max(1, min(w, h))
            aspect_ratio = float(max_dim / min_dim)

            # Scale filter: reject small isolated texture specks
            if max_dim < self.min_dimension_px or perimeter < self.min_perimeter_px:
                continue

            # Line-like candidate verification:
            # Cracks are elongated lines or low-circularity narrow tracks
            circularity = (4.0 * np.pi * area) / (perimeter * perimeter) if perimeter > 0 else 1.0
            is_line_like = (aspect_ratio >= self.min_elongation_ratio) or (
                circularity <= 0.30 and perimeter >= 1.8 * max_dim
            )
            if not is_line_like:
                continue

            raw_regions.append(
                RegionCoordinate(
                    x=int(x),
                    y=int(y),
                    width=int(w),
                    height=int(h),
                    area_px=round(area, 2),
                    perimeter_px=round(perimeter, 2),
                    aspect_ratio=round(aspect_ratio, 2),
                )
            )
            valid_contours.append(cnt)
            cv2.drawContours(mask, [cnt], -1, 255, thickness=cv2.FILLED)
            if perimeter > max_crack_length:
                max_crack_length = perimeter

        # 9. Coherent Path Merging: Group proximate segments along the trajectory into coherent paths
        coherent_regions = self._merge_coherent_paths(raw_regions)

        crack_detected = len(coherent_regions) > 0
        crack_pixels = int(np.count_nonzero(mask))
        crack_area_percentage = round((crack_pixels / total_pixels) * 100, 4)
        crack_area_percentage = max(0.0, min(100.0, crack_area_percentage))

        # 10. Screening Category Determination
        if not crack_detected:
            screening_category = ScreeningCategory.NORMAL
        else:
            if crack_area_percentage < 0.20 and max_crack_length < 150:
                screening_category = ScreeningCategory.MINOR
            elif crack_area_percentage < 1.0 and max_crack_length < 400:
                screening_category = ScreeningCategory.MODERATE
            else:
                screening_category = ScreeningCategory.SEVERE

        # 11. Restrained, readable visualization
        highlighted_image = None
        if crack_detected:
            highlighted_image = self._render_highlighted_image(image, mask, coherent_regions)

        return DetectionResult(
            crack_detected=crack_detected,
            screening_category=screening_category,
            confidence=None,  # Handcrafted baseline: no fake ML confidence
            regions=coherent_regions,
            crack_area_percentage=crack_area_percentage,
            highlighted_image=highlighted_image,
            dimensions=(width, height, channels),
            model_info=self.get_model_info(),
            status="SUCCESS",
        )

    def _merge_coherent_paths(
        self,
        raw_regions: List[RegionCoordinate],
    ) -> List[RegionCoordinate]:
        """
        Merges proximate crack-like segments along the same trajectory into coherent
        candidate paths, while guarding against merging into full-canvas bounding boxes.
        """
        if len(raw_regions) <= 1:
            return raw_regions

        merged = [r.model_copy() for r in raw_regions]
        changed = True

        while changed:
            changed = False
            n = len(merged)
            merge_candidate = None

            for i in range(n):
                for j in range(i + 1, n):
                    r1, r2 = merged[i], merged[j]
                    dx = max(0, max(r1.x, r2.x) - min(r1.x + r1.width, r2.x + r2.width))
                    dy = max(0, max(r1.y, r2.y) - min(r1.y + r1.height, r2.y + r2.height))

                    if dx <= self.max_gap_merge_px and dy <= self.max_gap_merge_px:
                        min_x = min(r1.x, r2.x)
                        min_y = min(r1.y, r2.y)
                        max_x = max(r1.x + r1.width, r2.x + r2.width)
                        max_y = max(r1.y + r1.height, r2.y + r2.height)
                        comb_w = max_x - min_x
                        comb_h = max_y - min_y

                        # Guard: Only merge if combined bounding span does not blow up
                        if max(comb_w, comb_h) <= self.max_merged_span_px:
                            comb_aspect = float(max(comb_w, comb_h) / max(1, min(comb_w, comb_h)))
                            new_region = RegionCoordinate(
                                x=min_x,
                                y=min_y,
                                width=comb_w,
                                height=comb_h,
                                area_px=round(r1.area_px + r2.area_px, 2),
                                perimeter_px=round(r1.perimeter_px + r2.perimeter_px, 2),
                                aspect_ratio=round(comb_aspect, 2),
                            )
                            merge_candidate = (i, j, new_region)
                            break
                if merge_candidate:
                    break

            if merge_candidate:
                i, j, new_region = merge_candidate
                merged.pop(j)
                merged.pop(i)
                merged.append(new_region)
                changed = True

        merged.sort(key=lambda r: r.area_px, reverse=True)
        return merged

    def _render_highlighted_image(
        self,
        original_bgr: np.ndarray,
        crack_mask: np.ndarray,
        regions: List[RegionCoordinate],
    ) -> np.ndarray:
        """
        Draws restrained, readable visual screening annotations:
        - Accurately highlights detected crack pixels in vibrant crimson without washing out concrete
        - Draws thin, subtle bounding boxes for candidate paths
        - Restricts text labels to top prominent paths to avoid cluttering the view
        """
        output = original_bgr.copy()

        # 1. Crack path highlight: alpha blend only onto the detected crack pixels
        alpha = 0.65
        crack_indices = (crack_mask > 0)
        highlight_color = np.array([0, 0, 230], dtype=np.uint8)  # Crimson Red
        output[crack_indices] = (
            (1.0 - alpha) * original_bgr[crack_indices].astype(np.float32)
            + alpha * highlight_color.astype(np.float32)
        ).astype(np.uint8)

        # 2. Subtle bounding boxes: thin border (1px) in amber/orange
        max_boxes = min(15, len(regions))
        for idx in range(max_boxes):
            region = regions[idx]
            x, y, w, h = region.x, region.y, region.width, region.height
            cv2.rectangle(output, (x, y), (x + w, y + h), (0, 150, 255), thickness=1)

        # 3. Restrained labels: only for top 3 major paths
        label_limit = min(3, len(regions))
        for idx in range(label_limit):
            region = regions[idx]
            x, y = region.x, region.y
            label = f"Path #{idx + 1}"
            label_y = max(14, y - 4)
            cv2.putText(
                output,
                label,
                (x, label_y),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.4,
                (0, 150, 255),
                thickness=1,
                lineType=cv2.LINE_AA,
            )

        return output
