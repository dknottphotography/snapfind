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

    photos = db.relationship(
        "Photo", backref="event", cascade="all, delete-orphan", lazy="dynamic"
    )


class Photo(db.Model):
    __tablename__ = "photos"

    id = db.Column(db.Integer, primary_key=True)
    event_id = db.Column(db.Integer, db.ForeignKey("events.id"), nullable=False, index=True)
    filename = db.Column(db.String(255), nullable=False)
    # Path relative to static/, e.g. "uploads/wedding-a1b2c3/ab12cd.jpg".
    rel_path = db.Column(db.String(500), nullable=False, default="")
    # JSON: list of ArcFace embedding vectors (one per detected face)
    face_embeddings = db.Column(db.Text, nullable=False, default="[]")
    faces_detected = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    def embedding_list(self):
        try:
            return json.loads(self.face_embeddings or "[]")
        except Exception:
            return []


class CoupleGallery(db.Model):
    """A standalone private gallery for one couple.

    Deliberately NOT linked to Event: a SnapFind event is the guest
    selfie-matching flow, while a couple's gallery is created on its own,
    has its own name/slug/passcode, and its media never touch the events
    or photos tables.
    """

    __tablename__ = "couple_galleries"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    slug = db.Column(db.String(64), unique=True, nullable=False, index=True)
    admin_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    # Passcode — werkzeug hash only, never the plaintext.
    # NULL = no passcode set yet; the gallery stays locked until one is set.
    passcode_hash = db.Column(db.String(255), nullable=True)

    media = db.relationship(
        "GalleryMedia", backref="gallery", cascade="all, delete-orphan", lazy="dynamic"
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


class GalleryMedia(db.Model):
    """One photo/video inside a CoupleGallery, stored on Cloudinary."""

    __tablename__ = "gallery_media"

    id = db.Column(db.Integer, primary_key=True)
    gallery_id = db.Column(
        db.Integer, db.ForeignKey("couple_galleries.id"), nullable=False, index=True
    )
    filename = db.Column(db.String(255), nullable=False)
    # 'photo' | 'video'
    media_type = db.Column(db.String(10), nullable=False, default="photo")
    cloudinary_url = db.Column(db.String(500), nullable=False)
    cloudinary_public_id = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
