# SnapFind — single-container deploy (website + API + face AI, one port).
# Built for Hugging Face Spaces (Docker SDK, free tier) or any Docker host.

# ---------- Stage 1: build the Next.js frontend as a static export ----------
FROM node:20-alpine AS web
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
# Empty => same-origin relative API calls (site + API share one public URL).
ARG NEXT_PUBLIC_API_URL=""
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
RUN npm run build

# ---------- Stage 2: Python backend serving API + built site ----------
FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1
WORKDIR /app

# OpenCV runtime libs (harmless if the headless build doesn't need them).
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./
RUN pip install -r requirements.txt
COPY backend/ ./backend/
COPY --from=web /app/frontend/out ./backend/frontend_out/

# Flask serves the exported site itself; BACKEND_URL/FRONTEND_URL left empty
# so public links/QR codes are derived from the incoming request host.
ENV SERVE_FRONTEND=1 \
    PORT=7860
EXPOSE 7860
CMD ["sh", "-c", "cd backend && gunicorn app:app --workers 1 --threads 4 --timeout 600 --bind 0.0.0.0:${PORT}"]
