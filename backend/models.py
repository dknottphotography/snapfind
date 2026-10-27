"""SQLAlchemy models — SQLite, zero paid services."""
import json
from datetime import datetime

from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(160), unique=True, nullable=False, index=True)
    phone = db.Column(db.String(30), nullable=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default="guest")  # admin | guest
    is_active = db.Column(db.Boolean, nullable=False, default=True)

    # Guest "Face ID": path relative to static/ + ArcFace embedding as JSON.
    selfie_path = db.Column(db.String(255), nullable=True)
    selfie_embedding = db.Column(db.Text, nullable=True)  # JSON list[float]

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    def set_password(self, password: str) -> None:
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "phone": self.phone,
            "role": self.role,
            "is_active": bool(self.is_active),
            "has_selfie": bool(self.selfie_embedding),
            "selfie_url": f"/static/{self.selfie_path}" if self.selfie_path else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Event(db.Model):
    __tablename__ = "events"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    slug = db.Column(db.String(64), unique=True, nullable=False, index=True)
    admin_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    # Couple's gallery passcode — werkzeug hash only, never the plaintext.
    # NULL = no passcode set yet; the gallery stays locked until one is set.
    passcode_hash = db.Column(db.String(255), nullable=True)

    photos = db.relationship(
        "Photo", backref="event", cascade="all, delete-orphan", lazy="dynamic"
    )

    def set_passcode(self, passcode: str) -> None:
        self.passcode_hash = generate_password_hash(passcode)

    def clear_passcode(self) -> None:
        self.passcode_hash = None

    def check_passcode(self, passcode: str) -> bool:
        if not self.passcode_hash or not passcode:
            return False
        return check_password_hash(self.passcode_hash, passcode)

    @property
    def has_passcode(self) -> bool:
        return bool(self.passcode_hash)


class Photo(db.Model):
    __tablename__ = "photos"

    id = db.Column(db.Integer, primary_key=True)
    event_id = db.Column(db.Integer, db.ForeignKey("events.id"), nullable=False, index=True)
    filename = db.Column(db.String(255), nullable=False)
    # Path relative to static/, e.g. "uploads/wedding-a1b2c3/ab12cd.jpg".
    # Local (guest-match) photos only — Cloudinary gallery media leave this
    # empty and are served from cloudinary_url instead.
    rel_path = db.Column(db.String(500), nullable=False, default="")
    # JSON: list of ArcFace embedding vectors (one per detected face)
    face_embeddings = db.Column(db.Text, nullable=False, default="[]")
    faces_detected = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    # ---- Couple's gallery (Cloudinary) ----
    # 'photo' | 'video'. Gallery media live on Cloudinary (permanent);
    # local guest-match photos stay media_type='photo' with rel_path set.
    media_type = db.Column(db.String(10), nullable=False, default="photo")
    cloudinary_url = db.Column(db.String(500), nullable=True)
    cloudinary_public_id = db.Column(db.String(255), nullable=True)

    @property
    def is_gallery_media(self) -> bool:
        """True when this row is a Cloudinary gallery item, not a local photo."""
        return bool(self.cloudinary_url)

    def embedding_list(self):
        try:
            return json.loads(self.face_embeddings or "[]")
        except Exception:
            return []
