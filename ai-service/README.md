# CrackVision — Computer Vision Service (Phase 1)

Preliminary visual crack detection microservice for the CrackVision Structural Crack Detection and Monitoring System.

---

## 1. Overview & Architecture

The **ai-service** is a standalone, lightweight Python microservice providing automated visual screening of structural concrete images. It is decoupled from the Spring Boot backend (`backend/` on port `5050`) and runs on port `8000`.

### Key Capabilities
* **Preliminary Visual Screening:** Detects candidate linear/crack-like surface anomalies using classical computer-vision algorithms.
* **Canvas Artifact Rejection:** Explicitly rejects full-canvas borders, image frames, and boundary artifacts to prevent full-image false positives.
* **Bounded Area Measurement:** Computes `crack_area_percentage` using a binary pixel mask of accepted regions, ensuring values are strictly between `0.0%` and `100.0%`.
* **Model Honesty:** Operates as a transparent heuristic baseline. The `confidence` score is explicitly returned as `null` (never fabricated).
* **Safe Visualization Delivery:** Outputs annotated images with path-traversal-protected retrieval via `/outputs/{filename}`.
* **Swappable Detector Design:** Implements `BaseCrackDetector` interface, allowing future deep-learning models (e.g. YOLOv8, UNet, PyTorch, ONNX) to be plugged in without changing API contracts or routes.

---

## 2. Technology Stack

* **Language:** Python 3.12+
* **Web Framework:** FastAPI (Asynchronous REST API, OpenAPI docs at `/docs`)
* **ASGI Server:** Uvicorn
* **Image Processing:** OpenCV (`opencv-python-headless`), NumPy
* **Data Validation:** Pydantic v2
* **Testing:** Pytest, HTTPX / Starlette TestClient

---

## 3. Directory Structure

```
ai-service/
├── .venv/                      # Dedicated Python virtual environment
├── app/
│   ├── detector/
│   │   ├── __init__.py
│   │   ├── base.py             # BaseCrackDetector abstract base class & DetectionResult
│   │   └── opencv_baseline.py  # Tuned classical CV baseline with artifact rejection
│   ├── utils/
│   │   ├── __init__.py
│   │   └── image_utils.py      # Upload validation, decoding, safe output paths
│   ├── __init__.py
│   ├── config.py               # Limits, allowed MIME types, model metadata, disclaimer
│   ├── main.py                 # FastAPI application and route endpoints
│   └── schemas.py              # Pydantic response and request models
├── outputs/                    # Controlled storage for highlighted result images
├── tests/
│   ├── __init__.py
│   ├── conftest.py             # Reusable image fixtures & TestClient setup
│   ├── test_analyze.py         # Analysis endpoint & contour rejection tests
│   ├── test_health.py          # Service health & readiness tests
│   └── test_validation.py      # Input validation & path traversal guard tests
├── .gitignore
├── README.md
└── requirements.txt
```

---

## 4. Setup & Installation (Windows PowerShell)

All commands should be executed from the project root (`C:\Users\Dell\OneDrive\projects\CrackVision`):

### 1. Create Virtual Environment (if not already created)
```powershell
python -m venv ai-service\.venv
```

### 2. Activate Virtual Environment
```powershell
.\ai-service\.venv\Scripts\Activate.ps1
```

### 3. Install Dependencies
```powershell
& ".\ai-service\.venv\Scripts\pip.exe" install -r .\ai-service\requirements.txt
```

---

## 5. Starting the Service

Start the Uvicorn server on `127.0.0.1:8000`:

```powershell
.\ai-service\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir .\ai-service --host 127.0.0.1 --port 8000 --reload
```

* **Base URL:** `http://127.0.0.1:8000`
* **Interactive OpenAPI Swagger Docs:** `http://127.0.0.1:8000/docs`

---

## 6. Running Automated Tests

Run the complete test suite with verbose output:

```powershell
.\ai-service\.venv\Scripts\pytest.exe -v .\ai-service\tests
```

All 14 automated tests cover:
* Service health and readiness verification (`GET /health`)
* Ordinary clean concrete surface screening (`NORMAL`, `0.0%` area)
* Low-contrast / flat image handling (`REVIEW_REQUIRED`, `LOW_CONTRAST_IMAGE`)
* Coarse concrete texture noise suppression (ensuring surface grain does not trigger false positives)
* Synthetic line-like feature detection with tightly controlled candidate path counts
* Canvas-spanning border artifact rejection (prevents full-frame false bounding boxes)
* Real crack image analysis (if `C:\Users\Dell\Downloads\crack.png` is present)
* Unsupported extension and MIME type rejection (`HTTP 415`)
* Empty file (0 bytes) and corrupt image payload rejection (`HTTP 400`)
* Sub-minimum image dimension rejection (`< 32x32px` -> `HTTP 400`)
* Path traversal attack prevention (`/outputs/..` -> `HTTP 400`)

---

## 7. API Endpoints & Usage Examples

### `GET /health`
Returns microservice status, active detector readiness, supported formats, and metadata.

#### PowerShell Request:
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8000/health" -Method Get | ConvertTo-Json -Depth 4
```

#### Sample Response:
```json
{
  "status": "HEALTHY",
  "model_readiness": "READY",
  "model_info": {
    "name": "CrackVision-CV-Baseline",
    "version": "0.1.0",
    "model_type": "experimental_computer_vision_baseline",
    "method": "Grayscale conversion, bilateral noise filtering, CLAHE contrast enhancement, Black Hat morphological transformation, Canny edge detection, and contour elongation analysis"
  },
  "supported_formats": [
    ".jpeg",
    ".jpg",
    ".png",
    ".webp"
  ],
  "timestamp": "2026-10-11T16:30:00.000000+00:00"
}
```

---

### `POST /analyze`
Accepts a multipart file upload (`file`) and returns structured visual screening results.

#### Upload Constraints:
* **Allowed Extensions:** `.jpg`, `.jpeg`, `.png`, `.webp`
* **Max File Size:** 10 MB
* **Resolution Bounds:** $32 \times 32$ pixels to $8192 \times 8192$ pixels

#### PowerShell Upload Example (using `curl.exe`):
```powershell
curl.exe -X POST "http://127.0.0.1:8000/analyze" -F "file=@C:\Users\Dell\Downloads\crack.png"
```

#### PowerShell Upload Example (using `Invoke-RestMethod`):
```powershell
$filePath = "C:\Users\Dell\Downloads\crack.png"
$form = @{
    file = Get-Item -Path $filePath
}
$response = Invoke-RestMethod -Uri "http://127.0.0.1:8000/analyze" -Method Post -Form $form
$response | ConvertTo-Json -Depth 4
```

#### Sample Response:
```json
{
  "status": "SUCCESS",
  "crack_detected": true,
  "screening_category": "SEVERE",
  "confidence": null,
  "regions_count": 17,
  "regions": [
    {
      "x": 0,
      "y": 82,
      "width": 245,
      "height": 227,
      "area_px": 2718.5,
      "perimeter_px": 1408.46,
      "aspect_ratio": 1.08
    },
    {
      "x": 630,
      "y": 571,
      "width": 153,
      "height": 188,
      "area_px": 1118.5,
      "perimeter_px": 743.57,
      "aspect_ratio": 1.23
    }
  ],
  "crack_area_percentage": 0.6101,
  "highlighted_image_url": "/outputs/highlighted_e1f43fe659344152863f4294e175d238.png",
  "original_filename": "crack.png",
  "image_dimensions": {
    "width": 1448,
    "height": 1086,
    "channels": 3
  },
  "model_info": {
    "name": "CrackVision-CV-Baseline",
    "version": "0.1.0",
    "model_type": "experimental_computer_vision_baseline",
    "method": "Grayscale conversion, bilateral noise filtering, CLAHE contrast enhancement, Black Hat morphological transformation, Canny edge detection, and contour elongation analysis"
  },
  "disclaimer": "Automated visual screening aid only. This experimental computer-vision baseline does not provide a structural safety assessment or structural engineering certification. All detections must be reviewed and verified on-site by a qualified structural engineer.",
  "processed_at": "2026-10-11T16:30:00.000000+00:00"
}
```

---

### `GET /outputs/{filename}`
Retrieves the highlighted output image generated during analysis.
* Protected against directory traversal (`..`, slashes, subdirectories).
* Only files directly created in `outputs/` are retrievable.

#### Example:
```powershell
Invoke-WebRequest -Uri "http://127.0.0.1:8000/outputs/highlighted_3e129672bb1a45b98fa0be6fdbf09e69.png" -OutFile "downloaded_result.png"
```

---

## 8. Model Honesty & Baseline Limitations

1. **Experimental Heuristic Only:**
   This implementation is a classical computer-vision baseline employing morphological filtering (Black Hat transform), adaptive thresholding (Otsu), and contour elongation analysis. It is **not** a machine-learning or deep-learning model trained on structural inspection datasets.
2. **Confidence is Explicitly Null:**
   In compliance with model honesty principles, the `confidence` field is set strictly to `null`. The heuristic does not fabricate statistical confidence percentages or arbitrary accuracy numbers.
3. **Screening Categories:**
   * `NORMAL`: No linear candidate features detected.
   * `MINOR`: Localized, narrow candidate features with low overall coverage ($< 0.20\%$).
   * `MODERATE`: Notable candidate features ($< 1.00\%$ area).
   * `SEVERE`: Extensive surface crack candidate distribution ($\ge 1.00\%$ area or long continuous tracks).
   * `REVIEW_REQUIRED`: Low-contrast or featureless image where automated screening is inconclusive.
4. **Structural Engineering Disclaimer:**
   This service is an automated visual screening aid. It does **not** provide structural safety certification or structural engineering risk assessments. All findings must be physically verified by a licensed structural engineer.
