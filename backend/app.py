"""SnapFind backend — Flask + SQLAlchemy + DeepFace, 100% free & open-source.

Run:
    pip install -r requirements.txt
    python app.py            # -> http://localhost:5000

First run downloads the ArcFace + RetinaFace weights (free, one-time).
"""
import json
import os
import re
import shutil
import uuid
from datetime import datetime, timedelta
from functools import wraps

import jwt
import numpy as np
import qrcode
from flask import Flask, request, jsonify, send_from_directory, abort
from flask_cors import CORS
from werkzeug.utils import secure_filename

import face_engine
from config import Config, BASE_DIR
from models import db, User, Event, Photo

app = Flask(__name__)
app.config.from_object(Config)
CORS(app, resources={r"/api/*": {"origins": "*"}, r"/static/*": {"origins": "*"}})
db.init_app(app)

for _d in (app.config["UPLOAD_FOLDER"], app.config["QRCODE_FOLDER"], app.config["SELFIE_FOLDER"]):
    os.makedirs(_d, exist_ok=True)

ALLOWED_EXTS = {"png", "jpg", "jpeg", "webp"}


# ---------------------------------------------------------------- auth helpers
def _allowed_file(name: str) -> bool:
    return "." in name and name.rsplit(".", 1)[1].lower() in ALLOWED_EXTS


def make_token(user: User) -> str:
    payload = {
        "sub": str(user.id),
        "role": user.role,
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(days=7),
    }
    return jwt.encode(payload, app.config["JWT_SECRET"], algorithm="HS256")


def get_current_user():
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    try:
        data = jwt.decode(auth[7:], app.config["JWT_SECRET"], algorithms=["HS256"])
        return User.query.get(int(data["sub"]))
    except Exception:
        return None


def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({"error": "Authentication required"}), 401
        if not user.is_active:
            return jsonify({"error": "This account has been disabled."}), 401
        request.current_user = user
        return fn(*args, **kwargs)
    return wrapper


def admin_required(fn):
    @wraps(fn)
    @login_required
    def wrapper(*args, **kwargs):
        if request.current_user.role != "admin":
            return jsonify({"error": "Admin only"}), 403
        return fn(*args, **kwargs)
    return wrapper


# ---------------------------------------------------------------- payloads
def _public_base() -> str:
    """Absolute base URL for links/QR codes.

    Uses BACKEND_URL when configured; otherwise derives it from the
    incoming request (single-container deploys where site + API share
    one public origin).
    """
    if app.config["BACKEND_URL"]:
        return app.config["BACKEND_URL"]
    return request.host_url.rstrip("/")


def _frontend_base() -> str:
    fe = app.config["FRONTEND_URL"]
    return fe if fe else _public_base()


def event_payload(event: Event) -> dict:
    fe = _frontend_base()
    be = _public_base()
    return {
        "id": event.id,
        "name": event.name,
        "slug": event.slug,
        "join_url": f"{fe}/join?event={event.slug}",
        "qr_url": f"{be}/static/qrcodes/{event.slug}.png",
        "photo_count": event.photos.count(),
        "created_at": event.created_at.isoformat() if event.created_at else None,
    }


def photo_payload(photo: Photo, distance=None) -> dict:
    be = _public_base()
    payload = {
        "id": photo.id,
        "event_id": photo.event_id,
        "filename": photo.filename,
        "url": f"{be}/static/{photo.rel_path}",
        "faces_detected": photo.faces_detected,
        "created_at": photo.created_at.isoformat() if photo.created_at else None,
    }
    if distance is not None:
        payload["distance"] = round(distance, 4)
        payload["score"] = round(max(0.0, 1.0 - distance) * 100, 1)
    return payload


def make_slug(name: str) -> str:
    """Event code = sanitized event name (no random suffix).
    'Maya Wedding' -> 'maya-wedding'. Duplicates get -2, -3, etc.
    """
    base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:40] or "event"
    slug = base
    counter = 2
    while Event.query.filter_by(slug=slug).first():
        slug = f"{base}-{counter}"
        counter += 1
    return slug


def build_qr_code(event: Event) -> None:
    """Generate the shareable QR code PNG for an event (saved locally)."""
    join_url = f"{_frontend_base()}/join?event={event.slug}"
    img = qrcode.make(join_url, box_size=10, border=2)
    img.save(os.path.join(app.config["QRCODE_FOLDER"], f"{event.slug}.png"))


def match_distance(user: User, photo: Photo):
    """Euclidean distance between the guest's selfie and the best face in a photo."""
    if not user.selfie_embedding:
        return None
    try:
        query = np.array(json.loads(user.selfie_embedding), dtype=np.float32)
        candidates = [np.array(e, dtype=np.float32) for e in photo.embedding_list()]
    except Exception:
        return None
    return face_engine.best_distance(query, candidates)


# ---------------------------------------------------------------- public
@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "face_ai": face_engine.ai_status()})


@app.get("/api/events/<slug>")
def public_event(slug):
    event = Event.query.filter_by(slug=slug.strip().lower()).first()
    if not event:
        return jsonify({"error": "Event not found"}), 404
    return jsonify({"event": {
        "id": event.id, "name": event.name, "slug": event.slug,
        "photo_count": event.photos.count(),
    }})


# ---------------------------------------------------------------- auth
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PHONE_RE = re.compile(r"^[+\d][\d\s\-()]{6,18}$")


@app.post("/api/auth/signup")
def signup():
    data = request.get_json(force=True, silent=True) or {}
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    phone = (data.get("phone") or "").strip()
    password = data.get("password") or ""
    if not name:
        return jsonify({"error": "Please enter your name."}), 400
    if not EMAIL_RE.match(email):
        return jsonify({"error": "Please enter a valid email address."}), 400
    if not PHONE_RE.match(phone):
        return jsonify({"error": "Please enter a valid phone number."}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters."}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "An account with this email already exists."}), 409
    user = User(name=name, email=email, phone=phone, role="guest")
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    return jsonify({"token": make_token(user), "user": user.to_dict()}), 201


@app.post("/api/auth/login")
def login():
    data = request.get_json(force=True, silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return jsonify({"error": "Invalid email or password."}), 401
    if not user.is_active:
        return jsonify({"error": "This account has been disabled. Contact the administrator."}), 403
    return jsonify({"token": make_token(user), "user": user.to_dict()})


@app.get("/api/auth/me")
@login_required
def me():
    return jsonify({"user": request.current_user.to_dict()})


# ---------------------------------------------------------------- admin: events
@app.post("/api/admin/events")
@admin_required
def create_event():
    data = request.get_json(force=True, silent=True) or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Event name is required."}), 400
    event = Event(name=name, slug=make_slug(name), admin_id=request.current_user.id)
    db.session.add(event)
    db.session.commit()
    build_qr_code(event)
    return jsonify({"event": event_payload(event)}), 201


@app.get("/api/admin/events")
@admin_required
def list_events():
    events = (Event.query
              .filter_by(admin_id=request.current_user.id)
              .order_by(Event.created_at.desc()).all())
    return jsonify({"events": [event_payload(e) for e in events]})


@app.delete("/api/admin/events/<int:event_id>")
@admin_required
def delete_event(event_id):
    event = Event.query.get_or_404(event_id)
    if event.admin_id != request.current_user.id:
        return jsonify({"error": "Not your event."}), 403
    # Remove photo files from disk (best effort), DB rows cascade.
    event_dir = os.path.join(app.config["UPLOAD_FOLDER"], event.slug)
    qr_path = os.path.join(app.config["QRCODE_FOLDER"], f"{event.slug}.png")
    db.session.delete(event)
    db.session.commit()
    shutil.rmtree(event_dir, ignore_errors=True)
    try:
        os.remove(qr_path)
    except OSError:
        pass
    return jsonify({"ok": True})


# ---------------------------------------------------------------- admin: photos
@app.post("/api/admin/events/<int:event_id>/photos")
@admin_required
def upload_event_photos(event_id):
    event = Event.query.get_or_404(event_id)
    if event.admin_id != request.current_user.id:
        return jsonify({"error": "Not your event."}), 403

    files = request.files.getlist("files") or list(request.files.values())
    files = [f for f in files if f and f.filename and _allowed_file(f.filename)]
    if not files:
        return jsonify({"error": "No valid image files received (png/jpg/jpeg/webp)."}), 400

    dest_dir = os.path.join(app.config["UPLOAD_FOLDER"], event.slug)
    os.makedirs(dest_dir, exist_ok=True)

    # Face descriptors are computed in the photographer's browser (face-api.js)
    # and sent as a JSON array aligned with the files order:
    # descriptors[i] = list of 128-dim vectors for files[i].
    try:
        raw_descriptors = json.loads(request.form.get("descriptors", "[]"))
    except Exception:
        raw_descriptors = []

    saved = []
    for idx, f in enumerate(files):
        ext = secure_filename(f.filename).rsplit(".", 1)[1].lower()
        filename = f"{uuid.uuid4().hex}.{ext}"
        abs_path = os.path.join(dest_dir, filename)
        f.save(abs_path)

        # Client-computed descriptors (validated server-side).
        embeddings = face_engine.sanitize_descriptors(
            raw_descriptors[idx] if idx < len(raw_descriptors) else []
        )

        photo = Photo(
            event_id=event.id,
            filename=filename,
            rel_path=f"uploads/{event.slug}/{filename}",
            face_embeddings=json.dumps(embeddings),
            faces_detected=len(embeddings),
        )
        db.session.add(photo)
        db.session.flush()
        saved.append(photo)
    db.session.commit()

    return jsonify({
        "photos": [photo_payload(p) for p in saved],
        "photo_count": event.photos.count(),
        "face_ai": face_engine.ai_status(),
    }), 201


@app.get("/api/admin/events/<int:event_id>/photos")
@admin_required
def list_event_photos(event_id):
    event = Event.query.get_or_404(event_id)
    if event.admin_id != request.current_user.id:
        return jsonify({"error": "Not your event."}), 403
    photos = event.photos.order_by(Photo.created_at.desc()).all()
    return jsonify({"photos": [photo_payload(p) for p in photos]})


@app.delete("/api/admin/photos/<int:photo_id>")
@admin_required
def delete_photo_admin(photo_id):
    photo = Photo.query.get_or_404(photo_id)
    if photo.event.admin_id != request.current_user.id:
        return jsonify({"error": "Not your event."}), 403
    _delete_photo_files(photo)
    db.session.delete(photo)
    db.session.commit()
    return jsonify({"ok": True})


def _delete_photo_files(photo: Photo) -> None:
    try:
        os.remove(os.path.join(app.config["STATIC_DIR"], photo.rel_path))
    except OSError:
        pass


@app.put("/api/admin/photos/<int:photo_id>")
@admin_required
def edit_photo_admin(photo_id):
    """Replace a photo's image (e.g. after client-side rotate/flip/crop)
    and re-run face detection on it. The public URL stays the same."""
    photo = Photo.query.get_or_404(photo_id)
    if photo.event.admin_id != request.current_user.id:
        return jsonify({"error": "Not your event."}), 403
    f = request.files.get("file") or next(iter(request.files.values()), None)
    if not f or not f.filename or not _allowed_file(f.filename):
        return jsonify({"error": "No valid image file received (png/jpg/jpeg/webp)."}), 400
    abs_path = os.path.join(app.config["STATIC_DIR"], photo.rel_path)
    f.save(abs_path)  # overwrite in place
    try:
        raw = json.loads(request.form.get("descriptors", "[]"))
    except Exception:
        raw = []
    embeddings = face_engine.sanitize_descriptors(raw)
    photo.face_embeddings = json.dumps(embeddings)
    photo.faces_detected = len(embeddings)
    db.session.commit()
    return jsonify({"photo": photo_payload(photo)})


# ---------------------------------------------------------------- admin: user access control
@app.get("/api/admin/users")
@admin_required
def list_users():
    users = User.query.order_by(User.created_at.desc()).all()
    return jsonify({"users": [u.to_dict() for u in users]})


@app.patch("/api/admin/users/<int:user_id>")
@admin_required
def update_user(user_id):
    """Grant/revoke access (is_active) and promote/demote (role) a user.
    Admins can promote trusted photographers to admin so they can upload
    event photos from their own accounts."""
    me = request.current_user
    user = User.query.get_or_404(user_id)
    if user.id == me.id:
        return jsonify({"error": "You cannot change your own account."}), 400
    data = request.get_json(force=True, silent=True) or {}
    changed = False
    if "is_active" in data:
        user.is_active = bool(data["is_active"])
        changed = True
    if "role" in data:
        role = str(data["role"]).strip().lower()
        if role not in ("admin", "guest"):
            return jsonify({"error": "Role must be 'admin' or 'guest'."}), 400
        if user.role == "admin" and role != "admin":
            remaining = User.query.filter(
                User.role == "admin", User.id != user.id
            ).count()
            if remaining == 0:
                return jsonify({"error": "You cannot demote the last admin."}), 400
        user.role = role
        changed = True
    if not changed:
        return jsonify({"error": "Nothing to update. Send {is_active} and/or {role}."}), 400
    db.session.commit()
    return jsonify({"user": user.to_dict()})


# ---------------------------------------------------------------- guest: selfie + matches
@app.post("/api/guest/selfie")
@login_required
def upload_selfie():
    user = request.current_user
    f = request.files.get("selfie") or next(iter(request.files.values()), None)
    if not f or not f.filename or not _allowed_file(f.filename):
        return jsonify({"error": "Please upload a selfie image (png/jpg/jpeg/webp)."}), 400

    ext = secure_filename(f.filename).rsplit(".", 1)[1].lower()
    filename = f"user_{user.id}_{uuid.uuid4().hex[:8]}.{ext}"
    abs_path = os.path.join(app.config["SELFIE_FOLDER"], filename)

    # Remove previous selfie file (best effort).
    if user.selfie_path:
        try:
            os.remove(os.path.join(app.config["STATIC_DIR"], user.selfie_path))
        except OSError:
            pass

    f.save(abs_path)

    # Face descriptor is computed in the guest's browser (face-api.js),
    # sent as a single 128-dim JSON array in the "descriptor" form field.
    try:
        raw = json.loads(request.form.get("descriptor", "null"))
    except Exception:
        raw = None
    cleaned = face_engine.sanitize_descriptors([raw], max_faces=1)
    embedding = cleaned[0] if cleaned else None
    if embedding is None:
        os.remove(abs_path)
        return jsonify({"error": "No face detected in that selfie. Try a clearer, front-facing photo."}), 422

    user.selfie_path = f"selfies/{filename}"
    user.selfie_embedding = json.dumps(embedding)
    db.session.commit()
    return jsonify({
        "selfie_url": f"{_public_base()}/static/{user.selfie_path}",
        "faces_detected": 1,
        "user": user.to_dict(),
    })


@app.get("/api/guest/matches")
@login_required
def guest_matches():
    user = request.current_user
    slug = (request.args.get("event") or "").strip().lower()
    if not slug:
        return jsonify({"error": "Pass ?event=<event-slug>."}), 400
    event = Event.query.filter_by(slug=slug).first()
    if not event:
        return jsonify({"error": "Event not found."}), 404
    if not user.selfie_embedding:
        return jsonify({"error": "Upload your selfie first.", "needs_selfie": True}), 400

    threshold = app.config["FACE_MATCH_THRESHOLD"]
    matches = []
    for photo in event.photos.order_by(Photo.created_at.desc()).all():
        d = match_distance(user, photo)
        if d is not None and d <= threshold:
            matches.append(photo_payload(photo, distance=d))
    matches.sort(key=lambda m: m["distance"])
    return jsonify({"matches": matches, "count": len(matches), "event": event.name})


@app.get("/api/guest/download/<int:photo_id>")
@login_required
def download_photo(photo_id):
    photo = Photo.query.get_or_404(photo_id)
    d = match_distance(request.current_user, photo)
    if d is None or d > app.config["FACE_MATCH_THRESHOLD"]:
        return jsonify({"error": "This photo is not in your matches."}), 403
    directory = os.path.join(app.config["STATIC_DIR"], os.path.dirname(photo.rel_path))
    return send_from_directory(directory, os.path.basename(photo.rel_path), as_attachment=True)


@app.delete("/api/guest/photos/<int:photo_id>")
@login_required
def delete_photo_guest(photo_id):
    """A guest can delete a photo they were matched in (their face, their call)."""
    photo = Photo.query.get_or_404(photo_id)
    d = match_distance(request.current_user, photo)
    if d is None or d > app.config["FACE_MATCH_THRESHOLD"]:
        return jsonify({"error": "This photo is not in your matches."}), 403
    _delete_photo_files(photo)
    db.session.delete(photo)
    db.session.commit()
    return jsonify({"ok": True})


# ---------------------------------------------------------------- serve built frontend (single-container deploy)
# When SERVE_FRONTEND=1 and the Next.js static export is present at
# FRONTEND_DIR, Flask serves the website itself — one container, one port,
# one public link. API routes (/api/*) and /static/* always win over this
# catch-all.
SERVE_FRONTEND = os.environ.get("SERVE_FRONTEND", "0") == "1"
FRONTEND_DIR = os.path.join(BASE_DIR, os.environ.get("FRONTEND_DIR", "frontend_out"))

if SERVE_FRONTEND and os.path.isdir(FRONTEND_DIR):
    @app.get("/", defaults={"path": ""})
    @app.get("/<path:path>")
    def serve_frontend(path):
        if path.startswith("api/") or path.startswith("static/"):
            abort(404)
        if path:
            full = os.path.join(FRONTEND_DIR, path)
            if os.path.isfile(full):
                return send_from_directory(FRONTEND_DIR, path)
            if not os.path.splitext(path)[1]:  # /login -> login.html
                candidate = path + ".html"
                if os.path.isfile(os.path.join(FRONTEND_DIR, candidate)):
                    return send_from_directory(FRONTEND_DIR, candidate)
        return send_from_directory(FRONTEND_DIR, "index.html")


# ---------------------------------------------------------------- startup
with app.app_context():
    db.create_all()
    # Lightweight migrations for DBs created before these columns existed.
    try:
        from sqlalchemy import text as _sa_text
        for _ddl in (
            "ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT 1",
            "ALTER TABLE users ADD COLUMN phone VARCHAR(30)",
        ):
            try:
                db.session.execute(_sa_text(_ddl))
                db.session.commit()
            except Exception:
                db.session.rollback()
    except Exception:
        pass
    if not User.query.filter_by(email=app.config["ADMIN_EMAIL"]).first():
        admin = User(name=app.config["ADMIN_NAME"],
                     email=app.config["ADMIN_EMAIL"], role="admin")
        admin.set_password(app.config["ADMIN_PASSWORD"])
        db.session.add(admin)
        db.session.commit()
        print(f"[snapfind] Admin created -> {app.config['ADMIN_EMAIL']}")


if __name__ == "__main__":
    print("[snapfind] Face AI:", face_engine.ai_status())
    app.run(host="0.0.0.0", port=5000, debug=True)
