# CrackVision Deployment Guide (Vercel + Render)

This project is deployed as three services:

- **Frontend (Vercel):** React + Vite app in `frontend/`
- **Backend (Render):** Spring Boot container from the repository root `Dockerfile`
- **AI service (Render):** FastAPI + OpenCV container from `ai-service/Dockerfile`

The Vercel frontend uses relative `/api` and `/outputs` paths. Vercel rewrites proxy those paths to the Render services, so the browser stays on one origin and CORS is only needed for local/direct access.

## 1. Prepare cloud database

Create a MySQL database (for example Aiven Cloud MySQL) and note:

- host
- port
- database name
- username
- password

Use these values when configuring Render.

## 2. Deploy backend + AI service on Render

1. Push this repository to GitHub.
2. In Render, choose **New > Blueprint** and select this repository.
3. Render will read `render.yaml` and create:
   - `crackvision-backend`
   - `crackvision-ai`
4. Open the `crackvision-backend` service and fill in the `sync: false` values:
   - `CRACKVISION_DB_HOST`
   - `CRACKVISION_DB_NAME`
   - `CRACKVISION_DB_USER`
   - `CRACKVISION_DB_PASSWORD`
   - `CRACKVISION_DB_URL` (optional but recommended for Aiven; use the full JDBC URL with `ssl-mode=REQUIRED`)
   - `CRACKVISION_JWT_SECRET`
5. Generate a valid JWT secret:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

   The decoded secret must be at least 32 bytes.
6. Deploy. Backend health check: `https://crackvision-backend.onrender.com/api/health`
   AI health check: `https://crackvision-ai.onrender.com/health`
7. If your Render service names differ from `crackvision-backend` and `crackvision-ai`, update:
   - `CRACKVISION_AI_SERVICE_URL` in `render.yaml`
   - the destination URLs in `frontend/vercel.json`
   - `CRACKVISION_CORS_ALLOWED_ORIGINS` in `render.yaml`

## 3. Deploy frontend on Vercel

1. In Vercel, import the same GitHub repository.
2. Set the project **Root Directory** to `frontend`.
3. Vercel will detect `frontend/vercel.json` and use its build/output settings.
4. Deploy.
5. After Vercel assigns your production URL (for example `https://crackvision.vercel.app`), update Render's `CRACKVISION_CORS_ALLOWED_ORIGINS` to include that exact URL and redeploy the backend.

## 4. Post-deployment checks

- Open the Vercel URL and log in.
- Verify `/api` calls succeed.
- Upload an inspection photo and run AI analysis.
- Confirm the highlighted overlay image loads.
- Confirm authenticated image streaming works.

## Notes

- Render's free tier uses ephemeral disk, so uploaded images and AI outputs are reset when the service restarts or redeploys. For durable storage, add a Render Disk or move files to object storage.
- `CRACKVISION_DB_PORT` must be set to your MySQL provider's actual port (for Aiven this is usually not `3306`). You may instead provide `CRACKVISION_DB_URL`, which takes precedence and must include `ssl-mode=REQUIRED`.
- Local development still works with Vite proxy settings in `frontend/vite.config.js`.