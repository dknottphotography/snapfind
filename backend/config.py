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

    # Max upload size per request (MB). Gallery videos need more headroom
    # than guest photos, so the default is 100 — override with MAX_UPLOAD_MB.
    MAX_CONTENT_LENGTH = int(os.environ.get("MAX_UPLOAD_MB", "100")) * 1024 * 1024

    # ---- Couple's gallery (Cloudinary, UNSIGNED upload preset) ----
    # The couple's photos/videos must live permanently — local disk on a
    # free host is wiped on restart. Uploads go to the CLIENT's Cloudinary
    # account via an unsigned preset: no API secret anywhere in code.
    # The client creates the preset (Settings -> Upload -> Add upload preset,
    # Signing mode: Unsigned) and sets these two env vars on the backend.
    CLOUDINARY_CLOUD_NAME = os.environ.get("CLOUDINARY_CLOUD_NAME", "")
    CLOUDINARY_UPLOAD_PRESET = os.environ.get("CLOUDINARY_UPLOAD_PRESET", "")
    CLOUDINARY_FOLDER = os.environ.get("CLOUDINARY_FOLDER", "snapfind")

    # How long a gallery passcode unlock lasts (hours).
    GALLERY_TOKEN_TTL_HOURS = int(os.environ.get("GALLERY_TOKEN_TTL_HOURS", "24"))

    # First admin account, auto-created on startup if it doesn't exist.
    ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@example.com")
    ADMIN_NAME = os.environ.get("ADMIN_NAME", "Admin")
    ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")
