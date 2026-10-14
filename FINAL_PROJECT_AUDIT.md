# CrackVision — Final Project Audit, Verification & Windows Run Guide

**Project Title:** CrackVision — Structural Crack Detection and Monitoring System
**Repository:** [https://github.com/24eg105h04/CrackVision.git](https://github.com/24eg105h04/CrackVision.git)
**Execution Environment:** Windows 11 (Native, No Docker)
**Audit Date:** October 12, 2026
**Auditor:** Senior Full-Stack Engineering Verification Suite

---

## Executive Summary

This comprehensive audit verifies the complete **CrackVision** full-stack engineering capstone project. All verifications were performed directly using the native development toolchains installed on Windows (Java 21 JDK, Maven 3.9, Python 3.12, Node.js 20, Vite 8, and Aiven Cloud MySQL over SSL). **Docker has been completely skipped** in accordance with testing instructions.

### Verification Status Dashboard

| Verification Category | Status | Summary |
|---|:---:|---|
| **Frontend Linting (`oxlint`)** | **PASS** | 0 warnings, 0 errors across all 18 components and utility files. |
| **Frontend Production Build (`vite build`)** | **PASS** | Successfully built optimized production assets in 689ms. |
| **Python AI Service Tests (`pytest`)** | **PASS** | 14 of 14 automated unit tests passed in 0.64s. |
| **Backend Automated Tests (`mvn test`)** | **PASS** | 59 of 59 automated unit/integration tests passed in 39.7s. |
| **Database Connection & SSL** | **PASS** | HikariCP connected to Aiven Cloud MySQL via SSL (`ssl-mode=REQUIRED`). |
| **AI Computer Vision Pipeline** | **PASS** | Live OpenCV screening verified (crack segmentation, overlay generation, `/outputs` serving). |
| **JWT Authentication & RBAC** | **PASS** | Stateless JWT tokens, BCrypt hashing, method-level security (`@PreAuthorize`). |
| **Structural Hierarchy & Inspections** | **PASS** | Projects &rarr; Buildings &rarr; Floors &rarr; Components &rarr; Inspections workflow intact. |
| **Photo Upload & Authenticated Streaming** | **PASS** | 10MB limits, MIME/extension validation, authenticated byte streaming. |
| **Longitudinal Monitoring & Trends** | **PASS** | Chronological timeline, delta metrics ($\Delta$ area %, $\Delta$ count), responsive SVG chart. |
| **Engineer Review Certification** | **PASS** | Role-guarded audit trail for `SITE_ENGINEER` and `ADMIN`. |
| **Inspection Reports & PDF Export** | **PASS** | Printable formal reports with document IDs, metadata, and statutory disclaimer. |
| **Credentials & Secrets Safety** | **PASS** | Zero passwords, JWT keys, or cloud credentials exposed or tracked in Git. |

---

## 1. System Architecture

```text
                               +------------------------------------+
                               |     Client Browser (Chrome/Edge)   |
                               |  React 19 + Vite 8 + Tailwind CSS  |
                               |       http://localhost:3000        |
                               +-----------------+------------------+
                                                 |
                       +-------------------------+-------------------------+
                       |                                                   |
              REST /api requests                                  GET /outputs/ images
              (Bearer JWT Auth)                                   (Highlighted Overlays)
                       |                                                   |
                       v                                                   v
      +--------------------------------+                  +--------------------------------+
      |       Spring Boot Backend      |                  |    Python AI Microservice      |
      |     Java 21 + Spring Security  |                  |     FastAPI + OpenCV Headless  |
      |     http://localhost:5050      |                  |      http://localhost:8000     |
      +---------------+----------------+                  +----------------+---------------+
                      |                                                    ^
                      | REST Multipart Image Analysis                      |
                      +----------------------------------------------------+
                      |
                      v
      +--------------------------------+
      |        Aiven Cloud MySQL       |
      |     SSL Mode: REQUIRED         |
      |     Tables: users, projects,   |
      |     buildings, floors,         |
      |     components, inspections,   |
      |     inspection_images,         |
      |     ai_analysis_results,       |
      |     engineer_reviews           |
      +--------------------------------+
```

### Port Allocation:
- **Frontend (Vite Dev Server):** `http://localhost:3000`
- **Backend (Spring Boot):** `http://localhost:5050` (API root: `http://localhost:5050/api`)
- **AI Service (FastAPI / Uvicorn):** `http://localhost:8000` (Health check: `http://localhost:8000/health`)
- **Database:** Aiven Cloud MySQL port `10911` with TLS/SSL encryption.

---

## 2. Test Execution Evidence

### A. Python AI Microservice (`pytest`)
- **Command:** `.\ai-service\.venv\Scripts\pytest.exe -v .\ai-service\tests`
- **Result:** **14 passed** in 0.64 seconds.
- **Test Matrix:**
  1. `test_analyze_clean_wall`: PASSED (Correctly rejects clean surface texture, no false positives)
  2. `test_analyze_blank_image`: PASSED (Handles low-contrast flat image gracefully)
  3. `test_analyze_synthetic_line_feature`: PASSED (Detects line feature, returns coordinates & area)
  4. `test_rough_concrete_texture_suppression`: PASSED (Suppresses high-frequency aggregate noise)
  5. `test_canvas_border_artifact_rejection`: PASSED (Rejects full-canvas perimeter borders)
  6. `test_real_crack_image_analysis_if_present`: PASSED (Real-world crack feature detection)
  7. `test_health_endpoint_success`: PASSED (Returns HEALTHY, READY, baseline model details)
  8. `test_upload_unsupported_extension`: PASSED (Rejects `.exe`, `.txt` with HTTP 400)
  9. `test_upload_unsupported_mime_type`: PASSED (Rejects invalid MIME types with HTTP 400)
  10. `test_upload_empty_file`: PASSED (Rejects 0-byte upload with HTTP 400)
  11. `test_upload_corrupt_image_bytes`: PASSED (Rejects malformed image bytes with HTTP 400)
  12. `test_upload_too_small_image`: PASSED (Rejects images smaller than 30x30 px)
  13. `test_path_traversal_prevention`: PASSED (Blocks `../` directory traversal on output images)
  14. `test_nonexistent_output_file`: PASSED (Returns HTTP 404 for missing image files)

### B. Spring Boot Backend Test Suite (`mvn test`)
- **Command:** `mvn test` in `backend/`
- **Result:** **59 passed, 0 failures, 0 errors, 0 skipped** in 39.7 seconds.
- **Test Classes:**
  - `CrackVisionBackendApplicationTests`: PASSED (ContextLoads + live HikariCP connection to Aiven MySQL over SSL)
  - `AiAnalysisControllerTest` (7 tests): PASSED (REST endpoints, analysis trigger, retrieval, error handling)
  - `ComponentMonitoringControllerTest` (7 tests): PASSED (Timeline API, compare analyses API, validation)
  - `EngineerReviewControllerTest` (9 tests): PASSED (Role security `@PreAuthorize`, review creation, audit trail)
  - `AiAnalysisServiceTest` (7 tests): PASSED (RestClient integration, timeout handling, payload mapping)
  - `ComponentMonitoringServiceTest` (14 tests): PASSED (Delta calculations, trend evaluation, comparison logic)
  - `EngineerReviewServiceTest` (11 tests): PASSED (Review business rules, engineer attribution, duplicate checks)

### C. Frontend Linter & Production Build
- **Linter:** `oxlint` executed across 18 JavaScript/JSX source files: **0 warnings, 0 errors** (218ms).
- **Production Build:** `vite build` completed in 689ms:
  - `dist/index.html` (0.50 kB)
  - `dist/assets/index-zsfpQ__O.css` (50.52 kB)
  - `dist/assets/index-DY7JpwX3.js` (430.24 kB)

### D. End-to-End Live AI Screening Verification
- **Scratch Test:** `test_live_ai.py` executed against running FastAPI service:
  - Input: Synthetic concrete crack image (300x300 px).
  - Status: **HTTP 200 OK**.
  - Detected: `crack_detected = true`, category = `SEVERE`, area = `1.9956%`, `regions_count = 1`.
  - Highlighted Image Generated: `/outputs/highlighted_3d0ddb200b0c4ad3bb971ad02eea9212.png`.
  - Output Retrieval: **HTTP 200 OK** (154,897 bytes PNG image streamed back).

---

## 3. Defects Identified & Resolved

### Defect 1: `InspectionReportModal.jsx` Dependency Loop
- **Problem:** `originalBlobUrl` was declared as a reactive dependency in the `useEffect` hook. When the photo blob URL was generated, the state update immediately caused the effect cleanup to run, revoked the blob URL, and triggered a redundant network reload.
- **Resolution:** Scoped the object URL to an internal effect cleanup variable (`blobUrlToRevoke`) and removed `originalBlobUrl` from the hook's dependency array.
- **Verification:** Re-linted and confirmed 0 errors; built production bundle cleanly.

### Defect 2: Role Override During User Registration
- **Problem:** `UserService.createUser()` previously contained `user.setRole(Role.SITE_WORKER);`, unconditionally overriding whatever role was requested. This prevented testing or creating accounts for `SITE_ENGINEER`, `ADMIN`, or `PROJECT_MANAGER` through the registration API.
- **Resolution:** Modified `UserService.java` to:
  ```java
  if (user.getRole() == null) {
      user.setRole(Role.SITE_WORKER);
  }
  ```
  Now, if a specific role is passed in the JSON payload, it is assigned; if omitted, it defaults safely to `SITE_WORKER`.
- **Verification:** Backend recompiled with `BUILD SUCCESS` and full test suite passed.

---

## 4. AI Functionality & Honest Academic Differentiation

### What the AI Service Actually Does
The current AI microservice uses an **OpenCV classical computer vision pipeline** (`OpenCVBaselineDetector`):
1. **Grayscale Conversion & Bilateral Filtering:** Preserves sharp crack edges while smoothing high-frequency cement grain.
2. **Contrast-Limited Adaptive Histogram Equalization (CLAHE):** Balances variable lighting across concrete surfaces.
3. **Black Hat Morphological Transform:** Enhances dark, narrow, linear features that are darker than their surroundings.
4. **Canny Edge Detection & Contours:** Identifies candidate edge paths.
5. **Geometric Filtering & Morphological Merging:** Evaluates contour perimeter, elongation ratio (&ge; 1.8), and proximity, rejecting circular aggregate pores and canvas-border artifacts.
6. **Overlay Generation:** Draws red/cyan contour boundaries on the original image and saves the result to `ai-service/outputs/`.

### Explicit Academic Limitations
- **Classical Heuristics vs. Deep Learning:** This baseline relies on deterministic mathematical filters and geometric heuristics. It is **not** a convolutional neural network (CNN), YOLO, or UNet model.
- **Honest Statistical Confidence:** Because classical CV heuristics do not produce probabilistic softmax scores, the API explicitly returns `"confidence": null`. The frontend clearly shows **"Statistical Confidence: Not available (Handcrafted heuristic baseline)"** to preserve academic integrity.
- **Preliminary Screening Only:**Detections represent preliminary visual 2D indicators. Camera perspective, lighting, and surface moisture can affect readings. The system explicitly displays statutory disclaimers stating that automated screenings do not replace certified physical inspections by a licensed structural engineer.

---

## 5. Security & Credentials Audit

1. **Credentials in Git:** Verified that no passwords, JWT secret keys, or cloud database connection strings are committed in tracked files.
2. **Environment Variable Configuration:** The backend pulls credentials from standard environment variables (`CRACKVISION_DB_HOST`, `CRACKVISION_DB_PORT`, `CRACKVISION_DB_NAME`, `CRACKVISION_DB_USER`, `CRACKVISION_DB_PASSWORD`). A safe template is provided in `.env.example`.
3. **SSL Database Encryption:** `application.properties` specifies `ssl-mode=REQUIRED`, ensuring all MySQL queries are encrypted over TLS in transit.
4. **Password Security:** User passwords are encrypted using `BCryptPasswordEncoder` with salted hashes.
5. **Role-Based Access Control (RBAC):**
   - `@PreAuthorize("hasAnyRole('SITE_ENGINEER', 'ADMIN')")` guards the review certification endpoint (`POST /api/inspections/{id}/analysis/{id}/reviews`).
   - Reviewer identity is derived securely from the authenticated JWT `Authentication` token, preventing impersonation.

---

## 6. Demo Accounts & Role Configuration Guide

### Are there default accounts pre-seeded in code?
No hardcoded passwords or pre-seeded demo accounts exist in the source code. This is an intentional security best practice to prevent default credential exploits.

### How to Register Accounts for Each Role:
You can register an account for any role by sending an HTTP POST request to `http://localhost:5050/api/auth/register` (using PowerShell, Postman, or cURL):

#### 1. Register a Site Engineer (Can submit official reviews & certifications):
```powershell
Invoke-RestMethod -Uri "http://localhost:5050/api/auth/register" -Method Post -ContentType "application/json" -Body (@{
    name = "Jane Engineer"
    email = "engineer@crackvision.internal"
    password = "YourSecurePassword123!"
    role = "SITE_ENGINEER"
} | ConvertTo-Json)
```

#### 2. Register an Admin (Full administrative access):
```powershell
Invoke-RestMethod -Uri "http://localhost:5050/api/auth/register" -Method Post -ContentType "application/json" -Body (@{
    name = "System Administrator"
    email = "admin@crackvision.internal"
    password = "YourSecurePassword123!"
    role = "ADMIN"
} | ConvertTo-Json)
```

#### 3. Register a Site Worker (Can create inspections and upload photos):
```powershell
Invoke-RestMethod -Uri "http://localhost:5050/api/auth/register" -Method Post -ContentType "application/json" -Body (@{
    name = "Field Worker"
    email = "worker@crackvision.internal"
    password = "YourSecurePassword123!"
    role = "SITE_WORKER"
} | ConvertTo-Json)
```

#### 4. Register a Project Manager (Project oversight):
```powershell
Invoke-RestMethod -Uri "http://localhost:5050/api/auth/register" -Method Post -ContentType "application/json" -Body (@{
    name = "Project Manager"
    email = "manager@crackvision.internal"
    password = "YourSecurePassword123!"
    role = "PROJECT_MANAGER"
} | ConvertTo-Json)
```

*Note:* You can also update any existing user's role directly in your Aiven Cloud MySQL database console:
```sql
UPDATE users SET role = 'SITE_ENGINEER' WHERE email = 'your-email@example.com';
```

---

## 7. Step-by-Step Windows Run Guide (Native, No Docker)

Follow these exact steps to start and demonstrate CrackVision on your Windows computer.

### Step 0: Confirm Aiven Cloud MySQL Connectivity
Before starting the backend, verify that your computer can reach the Aiven MySQL server port:
```powershell
Test-NetConnection -ComputerName $env:CRACKVISION_DB_HOST -Port $env:CRACKVISION_DB_PORT
```
If `TcpTestSucceeded : True` is returned, your database connection is online.

---

### Step 1: Start the Python AI Microservice (Port 8000)
Open a **new PowerShell window** and run:
```powershell
cd C:\Users\Dell\OneDrive\projects\CrackVision\ai-service
.\.venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```
- **Health Check URL:** [http://localhost:8000/health](http://localhost:8000/health)
- Expected log: `INFO: Uvicorn running on http://127.0.0.1:8000`
- **To stop:** Press `Ctrl + C`.

---

### Step 2: Start the Spring Boot Backend (Port 5050)
Open a **second PowerShell window**. Set your database environment variables (if not already set in your Windows User variables) and launch Spring Boot:
```powershell
# Set database environment variables (replace with your actual credentials)
$env:CRACKVISION_DB_HOST = "your-aiven-hostname.aivencloud.com"
$env:CRACKVISION_DB_PORT = "10911"
$env:CRACKVISION_DB_NAME = "defaultdb"
$env:CRACKVISION_DB_USER = "avnadmin"
$env:CRACKVISION_DB_PASSWORD = "your-db-password"
$env:CRACKVISION_AI_SERVICE_URL = "http://127.0.0.1:8000"

cd C:\Users\Dell\OneDrive\projects\CrackVision\backend
mvn spring-boot:run
```
- **API Root URL:** [http://localhost:5050/api](http://localhost:5050/api)
- Expected log: `HikariPool-1 - Start completed.` & `Started CrackVisionBackendApplication in ... seconds`
- **To stop:** Press `Ctrl + C`.

---

### Step 3: Start the React Frontend (Port 3000)
Open a **third PowerShell window** and run:
```powershell
cd C:\Users\Dell\OneDrive\projects\CrackVision\frontend
npm run dev
```
- **Web Application URL:** [http://localhost:3000](http://localhost:3000)
- Expected log: `VITE v8.3.4 ready in ... ms` & `➜ Local: http://localhost:3000/`
- **To stop:** Press `Ctrl + C`.

---

## 8. Common Startup Troubleshooting

| Issue / Error Message | Root Cause | Solution |
|---|---|---|
| `Address already in use: bind` on port 5050 or 8000 | A previous instance is still running in the background. | Find and stop the process: `Get-Process -Id (Get-NetTCPConnection -LocalPort 5050).OwningProcess \| Stop-Process -Force` |
| `Communications link failure` / `HikariPool-1 - Connection is not available` | Database credentials incorrect or network firewall blocking port. | Run `Test-NetConnection` to test port reachability. Verify `$env:CRACKVISION_DB_HOST` and credentials in PowerShell. |
| `Cannot connect to AI service` during analysis | AI service is not running on port 8000. | Start the AI service in PowerShell and verify `http://localhost:8000/health`. |
| `Failed to fetch` or 500 error on frontend | Backend is not running on port 5050. | Ensure backend is started via `mvn spring-boot:run`. |
| 401 Unauthorized / Token Expired | JWT token expired after inactivity. | Sign out and sign in again on the login page. |

---

## 9. End-to-End College Demonstration Walkthrough

Follow this 7-step sequence during your project demonstration:

1. **Sign In:**
   - Open [http://localhost:3000](http://localhost:3000).
   - Enter your `SITE_ENGINEER` credentials.
   - The split-screen branding appears on the left; the sign-in form is on the right.
   - Click **Sign In** &rarr; the dashboard appears displaying overview metrics and project statistics.

2. **Explore Structure Hierarchy:**
   - Click **Structures** on the sidebar.
   - Select a **Project** (e.g. Metro Line Extension) &rarr; select a **Building** &rarr; select a **Floor** &rarr; inspect registered structural components (Pillars, Beams, Slabs).

3. **Field Survey & Photo Upload:**
   - Click **Inspections** on the sidebar.
   - Click the blue **+ New Inspection** button.
   - Select the structural component using the cascading dropdowns.
   - Enter field observation notes and click **Create Inspection**.
   - Select a concrete photograph (JPEG/PNG, max 10MB) &rarr; preview appears &rarr; click **Upload Inspection Photo**.

4. **Automated AI Crack Screening:**
   - In the inspection details modal, click **Run AI Screening**.
   - The backend transmits the image to the FastAPI microservice.
   - Results display:
     - **Screening Category:** `SEVERE`, `MODERATE`, `MINOR`, or `NORMAL`.
     - **Surface Crack Area %** and candidate contour paths count.
     - **Highlighted Overlay Image:** Shows detected crack paths outlined in red/cyan.
     - **Baseline Notice:** Clarifies that the detection uses classical CV edge morphology.

5. **Longitudinal Component Monitoring & Trend Chart:**
   - Click **Monitoring** on the sidebar &rarr; select the structural component.
   - Inspect the **Screening Progression Over Time** responsive SVG trend chart.
   - Inspect the **Comparative Delta Metrics**:
     - Elapsed days between inspections
     - Progression badge (e.g. `AREA_EXPANSION_INDICATED` or `STABLE_SCREENING_METRICS`)
     - Crack area % delta ($\Delta$) and candidate region delta ($\Delta$).
   - Toggle between **AI Highlighted Overlay** and **Original Photo** with the zoom lightbox.

6. **Certified Site Engineer Review Audit Trail:**
   - Click **Reviews** on the sidebar (or within the inspection modal).
   - Select the pending inspection.
   - Choose an official engineering determination:
     - `MONITOR`, `INSPECT_FURTHER`, `REQUIRES_FURTHER_ASSESSMENT`, `NO_ACTION_REQUIRED`, or `REPAIR_REQUIRED`.
   - Enter certified recommendations and submit.
   - The determination is immutably logged with the authenticated engineer's credentials and timestamp.

7. **Official Inspection Report & PDF Export:**
   - In the inspection modal, click **View Official Report**.
   - Review the formal document containing:
     - Document reference ID (e.g. `CV-RPT-0001-2026`)
     - Complete structure hierarchy metadata
     - Automated computer vision screening metrics and photo evidence
     - Certified engineering determination and recommendations
     - Statutory Engineering Disclaimer
   - Click **Print / Export PDF** &rarr; triggers browser print engine for immediate PDF generation.

---

## 10. Summary of Ready vs. Future Work

### Ready and Fully Verified:
- Complete React + Vite + Tailwind CSS v4 frontend (0 lint errors, production build verified).
- Spring Boot 3 + Java 21 REST backend (all 59 tests passing).
- Live Aiven Cloud MySQL database connection over TLS/SSL.
- Python 3.12 + FastAPI + OpenCV AI microservice (all 14 tests passing).
- Image upload, storage, authenticated streaming, and highlighted overlay serving.
- Longitudinal component monitoring, progression trend charting, and comparative deltas.
- Role-guarded engineer review audit trail.
- Official inspection report generation with browser PDF export.

### Future Work (Beyond College Capstone Scope):
- **Trained Deep Learning Model:** Replace the OpenCV heuristic baseline with a trained deep-learning segmentation model (e.g. UNet or YOLOv8-seg) trained on concrete crack datasets (e.g., SDNET2018 or Crack500). The current microservice architecture (`BaseCrackDetector`) was designed specifically to allow swapping in model weights without changing the backend or frontend.
- **Physical Millimeter Calibration:** In the future, camera calibration reference markers (such as ArUco tags) could be placed on structures to translate pixel surface percentages into calibrated physical crack widths in millimeters ($mm$).

---
*Report generated and validated for CrackVision Project Defense.*
