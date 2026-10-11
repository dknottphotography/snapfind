"""Central configuration for the SnapFind Flask backend.

Everything is tunable through environment variables — no paid services,
no cloud keys. Copy `.env.example` to `.env` and adjust.
"""
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-change-me")
    JWT_SECRET = os.environ.get("JWT_SECRET", "dev-jwt-change-me")

    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL", f"sqlite:///{os.path.join(BASE_DIR, 'samaro.db')}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # ---- Local file storage (the whole point: no Cloudinary / S3) ----
    STATIC_DIR = os.path.join(BASE_DIR, "static")
    UPLOAD_FOLDER = os.path.join(STATIC_DIR, "uploads")   # event photos
    QRCODE_FOLDER = os.path.join(STATIC_DIR, "qrcodes")   # per-event QR codes
    SELFIE_FOLDER = os.path.join(STATIC_DIR, "selfies")   # guest "Face ID" selfies

    FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000").rstrip("/")
    BACKEND_URL = os.environ.get("BACKEND_URL", "").rstrip("/")

    # Euclidean DISTANCE threshold for face-api.js descriptors (lower = stricter).
    # face-api.js convention is ~0.6; 0.5 is a good balance for event photos.
    FACE_MATCH_THRESHOLD = float(os.environ.get("FACE_MATCH_THRESHOLD", "0.50"))

    # Max upload size per request (MB).
    MAX_CONTENT_LENGTH = int(os.environ.get("MAX_UPLOAD_MB", "32")) * 1024 * 1024

    # First admin account, auto-created on startup if it doesn't exist.
    ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@example.com")
    ADMIN_NAME = os.environ.get("ADMIN_NAME", "Admin")
    ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")
