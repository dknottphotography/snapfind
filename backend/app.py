"""SnapFind backend — Flask + SQLAlchemy, 100% free & open-source.

Private galleries for couples: the photographer creates a gallery from
the couple's name, sets a 4-digit PIN, and shares the link or QR.
Media lives permanently on Cloudinary (unsigned upload preset).

Run:
    pip install -r requirements.txt
    python app.py            # -> http://localhost:5000
"""
import io
import os
import re
from datetime import datetime, timedelta
from functools import wraps

import jwt
import qrcode
from flask import Flask, request, jsonify, send_from_directory, send_file, abort
from flask_cors import CORS
from werkzeug.utils import secure_filename

import gallery_cloudinary
from gallery_cloudinary import GalleryStorageError
from config import Config, BASE_DIR
from models import db, User, CoupleGallery, GalleryMedia

app = Flask(__name__)
app.config.from_object(Config)
CORS(app, resources={r"/api/*": {"origins": "*"}, r"/static/*": {"origins": "*"}})
db.init_app(app)

for _d in (app.config["UPLOAD_FOLDER"], app.config["QRCODE_FOLDER"], app.config["SELFIE_FOLDER"]):
    os.makedirs(_d, exist_ok=True)

# Point the Cloudinary SDK at the client's cloud (unsigned preset — no secret).
gallery_cloudinary.init(
    app.config["CLOUDINARY_CLOUD_NAME"], app.config["CLOUDINARY_UPLOAD_PRESET"]
)

# ---------------------------------------------------------------- auth helpers
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


def is_owner(user) -> bool:
    """The main admin: the seeded ADMIN_EMAIL account. Untouchable by anyone."""
    return (user.email or "").strip().lower() == (
        app.config.get("ADMIN_EMAIL") or ""
    ).strip().lower()


# ------------------------------------------------- couple's gallery tokens
def make_gallery_token(gallery: CoupleGallery) -> str:
    """Short-lived JWT scoped to ONE standalone couple's gallery."""
    payload = {
        "type": "gallery",
        "gallery": gallery.slug,
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow()
        + timedelta(hours=app.config["GALLERY_TOKEN_TTL_HOURS"]),
    }
    return jwt.encode(payload, app.config["JWT_SECRET"], algorithm="HS256")


def get_gallery_slug():
    """Slug a gallery JWT was issued for, or None (missing/invalid/expired)."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    try:
        data = jwt.decode(auth[7:], app.config["JWT_SECRET"], algorithms=["HS256"])
    except Exception:
        return None
    if data.get("type") != "gallery":
        return None
    return data.get("gallery")


def gallery_token_required(fn):
    """Request must carry a gallery JWT issued for the <slug> in the URL."""
    @wraps(fn)
    def wrapper(slug, *args, **kwargs):
        token_slug = get_gallery_slug()
        if not token_slug or token_slug != slug.strip().lower():
            return jsonify({"error": "This gallery needs its passcode."}), 401
        return fn(slug, *args, **kwargs)
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


def _gallery_url(gallery: CoupleGallery) -> str:
    """Shareable link the photographer sends the couple.

    Standalone galleries only — the link carries the gallery's own slug,
    never a SnapFind event slug.
    """
    return f"{_frontend_base()}/couple-gallery?gallery={gallery.slug}"


def _gallery_media_count(gallery: CoupleGallery) -> int:
    return gallery.media.count()


def gallery_payload(gallery: CoupleGallery) -> dict:
    be = _public_base()
    return {
        "id": gallery.id,
        "name": gallery.name,
        "slug": gallery.slug,
        "gallery_url": _gallery_url(gallery),
        "qr_url": f"{be}/api/gallery/{gallery.slug}/qr.png",
        "has_passcode": gallery.has_passcode,
        "media_count": _gallery_media_count(gallery),
        "created_at": gallery.created_at.isoformat() if gallery.created_at else None,
    }


def _ensure_wm_variant(obj) -> str:
    """Return the watermark colour for a Cloudinary-backed photo row.

    New uploads store the variant at upload time. Older rows have NULL:
    compute it once from the stored image, persist it, and reuse it from
    then on. If the computation fails (network, decode), serve the white
    logo for this request without persisting, and retry next time.
    """
    if getattr(obj, "wm_variant", None):
        return obj.wm_variant
    if not getattr(obj, "cloudinary_public_id", None):
        return "white"
    try:
        variant = gallery_cloudinary.variant_for_public_id(obj.cloudinary_public_id)
        obj.wm_variant = variant
        db.session.commit()
        return variant
    except Exception:
        db.session.rollback()
        return "white"


def gallery_media_payload(item: GalleryMedia) -> dict:
    url = item.cloudinary_url
    if gallery_cloudinary._cloud_name():
        media_type = item.media_type or "photo"
        if media_type == "photo":
            # Photos are delivered watermarked (DKNOTT logo, bottom-left);
            # the clean original URL is never exposed.
            variant = _ensure_wm_variant(item)
            url = gallery_cloudinary.full_url(item.cloudinary_public_id, variant)
            display_url = gallery_cloudinary.display_url(
                item.cloudinary_public_id, media_type, variant
            )
            download_url = gallery_cloudinary.download_url(
                item.cloudinary_public_id, media_type, variant
            )
        else:
            display_url = gallery_cloudinary.display_url(
                item.cloudinary_public_id, media_type
            )
            download_url = gallery_cloudinary.download_url(
                item.cloudinary_public_id, media_type
            )
    else:
        display_url = download_url = url
    return {
        "id": item.id,
        "gallery_id": item.gallery_id,
        "filename": item.filename,
        "url": url,
        "display_url": display_url,
        "download_url": download_url,
        "media_type": item.media_type or "photo",
        "folder": item.folder or "",
        "created_at": item.created_at.isoformat() if item.created_at else None,
    }


def _cloudinary_ready() -> bool:
    return gallery_cloudinary.configured(
        app.config["CLOUDINARY_CLOUD_NAME"], app.config["CLOUDINARY_UPLOAD_PRESET"]
    )


def make_gallery_slug(name: str) -> str:
    """Gallery code = sanitized gallery name, deduped within galleries only.

    Galleries have their own slug namespace, separate from event slugs.
    """
    base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:40] or "gallery"
    slug = base
    counter = 2
    while CoupleGallery.query.filter_by(slug=slug).first():
        slug = f"{base}-{counter}"
        counter += 1
    return slug


# ---------------------------------------------------------------- public
@app.get("/api/health")
def health():
    return jsonify({"status": "ok"})


# ------------------------------------------------- couple's gallery (public, passcode-only)
# Standalone galleries, NOT SnapFind events. No login, no signup: the
# couple opens their private link and enters the passcode the photographer
# gave them. Nothing about the gallery's contents is revealed before a
# correct passcode.
@app.get("/api/gallery/<slug>")
def gallery_public(slug):
    """Public info only: gallery name, media count and a hero cover photo.

    The cover is the watermarked display copy of the first photo, so the
    landing screen can show the couple's cover before any PIN is entered.
    No full URLs, no passcode hint.
    """
    gallery = CoupleGallery.query.filter_by(slug=slug.strip().lower()).first()
    if not gallery:
        return jsonify({"error": "Gallery not found"}), 404
    cover = (
        gallery.media.filter_by(media_type="photo")
        .order_by(GalleryMedia.created_at.asc()).first()
        or gallery.media.order_by(GalleryMedia.created_at.asc()).first()
    )
    cover_url = None
    if cover:
        try:
            cover_url = gallery_media_payload(cover).get("display_url")
        except Exception:
            cover_url = None
    return jsonify({"gallery": {
        "name": gallery.name,
        "slug": gallery.slug,
        "media_count": _gallery_media_count(gallery),
        "cover_url": cover_url,
    }})


@app.post("/api/gallery/<slug>/unlock")
def gallery_unlock(slug):
    gallery = CoupleGallery.query.filter_by(slug=slug.strip().lower()).first()
    if not gallery:
        return jsonify({"error": "Gallery not found"}), 404
    data = request.get_json(force=True, silent=True) or {}
    passcode = (data.get("passcode") or "").strip()
    if not gallery.check_passcode(passcode):
        # Deliberately vague: no hint whether a passcode exists at all.
        return jsonify({"error": "Wrong passcode — ask your photographer for the gallery passcode."}), 401
    return jsonify({
        "token": make_gallery_token(gallery),
        "expires_in_hours": app.config["GALLERY_TOKEN_TTL_HOURS"],
        "gallery": {"name": gallery.name, "slug": gallery.slug},
    })


@app.get("/api/gallery/<slug>/qr.png")
def gallery_qr(slug):
    """QR code PNG for a gallery's share link.

    Generated on the fly (no file on disk). The QR encodes only the
    gallery URL — the passcode is still required to open the gallery,
    so this image is safe to share exactly like the link itself.
    """
    gallery = CoupleGallery.query.filter_by(slug=slug.strip().lower()).first()
    if not gallery:
        return jsonify({"error": "Gallery not found"}), 404
    img = qrcode.make(_gallery_url(gallery), box_size=10, border=2)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return send_file(buf, mimetype="image/png", download_name=f"{gallery.slug}-gallery-qr.png")


@app.get("/api/gallery/<slug>/media")
@gallery_token_required
def gallery_media(slug):
    gallery = CoupleGallery.query.filter_by(slug=slug.strip().lower()).first()
    if not gallery:
        return jsonify({"error": "Gallery not found"}), 404
    items = gallery.media.order_by(GalleryMedia.created_at.desc()).all()
    return jsonify({"media": [gallery_media_payload(p) for p in items], "gallery": gallery.name})


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
    u = request.current_user.to_dict()
    u["is_owner"] = is_owner(request.current_user)
    return jsonify({"user": u})


# ------------------------------------------------- admin: couple's galleries (standalone)
# A gallery is created from the couple's name alone. It is NOT a SnapFind
# event: no event is created or linked, and its link/QR carry only the
# gallery slug. The photographer adds photos/videos, sets a passcode, and
# shares the generated link or QR with that couple.
def _own_gallery_or_404(gallery_id):
    gallery = CoupleGallery.query.get_or_404(gallery_id)
    if gallery.admin_id != request.current_user.id:
        return None
    return gallery


@app.get("/api/admin/galleries")
@admin_required
def list_galleries():
    galleries = (CoupleGallery.query
                 .filter_by(admin_id=request.current_user.id)
                 .order_by(CoupleGallery.created_at.desc()).all())
    return jsonify({"galleries": [gallery_payload(g) for g in galleries]})


@app.post("/api/admin/galleries")
@admin_required
def create_gallery():
    data = request.get_json(force=True, silent=True) or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Please enter the couple's name."}), 400
    gallery = CoupleGallery(
        name=name,
        slug=make_gallery_slug(name),
        admin_id=request.current_user.id,
    )
    db.session.add(gallery)
    db.session.commit()
    return jsonify({"gallery": gallery_payload(gallery)}), 201


@app.delete("/api/admin/galleries/<int:gallery_id>")
@admin_required
def delete_gallery(gallery_id):
    gallery = _own_gallery_or_404(gallery_id)
    if gallery is None:
        return jsonify({"error": "Not your gallery."}), 403
    for item in gallery.media.all():
        _delete_gallery_media_files(item)
    db.session.delete(gallery)
    db.session.commit()
    return jsonify({"ok": True})


@app.put("/api/admin/galleries/<int:gallery_id>/passcode")
@admin_required
def set_gallery_passcode(gallery_id):
    """Set or change a gallery's passcode — a 4-digit PIN (2026-11-12).

    The couple types it on a numeric keypad, so it must be exactly 4
    digits. Send {"passcode": ""} to remove the passcode — the gallery
    then stays locked until a new one is set. Stored only as a hash.
    """
    gallery = _own_gallery_or_404(gallery_id)
    if gallery is None:
        return jsonify({"error": "Not your gallery."}), 403
    data = request.get_json(force=True, silent=True) or {}
    passcode = (data.get("passcode") or "").strip()
    if not passcode:
        gallery.clear_passcode()
        db.session.commit()
        return jsonify({"has_passcode": False, "gallery_url": _gallery_url(gallery)})
    if not re.fullmatch(r"\d{4}", passcode):
        return jsonify({"error": "The PIN must be exactly 4 digits."}), 400
    gallery.set_passcode(passcode)
    db.session.commit()
    return jsonify({"has_passcode": True, "gallery_url": _gallery_url(gallery)})


@app.post("/api/admin/galleries/<int:gallery_id>/media")
@admin_required
def upload_gallery_media(gallery_id):
    """Upload photos/videos for a couple's gallery -> Cloudinary.

    No Cloudinary config = 503 with a clear error. Gallery media is never
    stored on local disk: permanence is the whole point of the gallery.
    """
    gallery = _own_gallery_or_404(gallery_id)
    if gallery is None:
        return jsonify({"error": "Not your gallery."}), 403
    cloud_name = app.config["CLOUDINARY_CLOUD_NAME"]
    preset = app.config["CLOUDINARY_UPLOAD_PRESET"]
    if not gallery_cloudinary.configured(cloud_name, preset):
        return jsonify({"error": (
            "Cloudinary is not configured on this backend. Set "
            "CLOUDINARY_CLOUD_NAME and CLOUDINARY_UPLOAD_PRESET (unsigned "
            "upload preset from the client's Cloudinary account) and restart."
        )}), 503

    files = request.files.getlist("files") or list(request.files.values())
    files = [f for f in files if f and f.filename]
    if not files:
        return jsonify({"error": "No files received."}), 400

    # Optional folder for this batch ('Haldi', 'Wedding', ...), chosen in
    # the admin panel. Stored on each item and mirrored as a Cloudinary
    # subfolder so the media library stays organised the same way.
    folder_name = (request.form.get("folder") or "").strip()[:80]
    folder = f"{app.config['CLOUDINARY_FOLDER']}/galleries/{gallery.slug}"
    if folder_name:
        sub = re.sub(r"[^a-z0-9]+", "-", folder_name.lower()).strip("-")[:40]
        if sub:
            folder = f"{folder}/{sub}"
    saved, errors = [], []
    for f in files:
        ext = secure_filename(f.filename).rsplit(".", 1)[-1].lower() \
            if "." in f.filename else ""
        if ext in gallery_cloudinary.IMAGE_EXTS:
            media_type = "photo"
        elif ext in gallery_cloudinary.VIDEO_EXTS:
            media_type = "video"
        else:
            errors.append(
                f"{f.filename}: unsupported file type "
                "(photos: png/jpg/jpeg/webp/gif; videos: mp4/mov/webm/m4v)."
            )
            continue
        wm_variant = None
        if media_type == "photo":
            # Watermark colour from the photo's own bottom-left corner.
            f.stream.seek(0)
            wm_variant = gallery_cloudinary.corner_variant(f.stream.read())
            f.stream.seek(0)
        try:
            up = gallery_cloudinary.upload_media(f, media_type, folder, preset)
        except GalleryStorageError as exc:
            errors.append(f"{f.filename}: {exc}")
            continue
        item = GalleryMedia(
            gallery_id=gallery.id,
            filename=secure_filename(f.filename),
            media_type=media_type,
            cloudinary_url=up["url"],
            cloudinary_public_id=up["public_id"],
            wm_variant=wm_variant,
            folder=folder_name,
        )
        db.session.add(item)
        db.session.flush()
        saved.append(item)
    db.session.commit()
    status = 201 if saved else 400
    return jsonify({
        "media": [gallery_media_payload(p) for p in saved],
        "gallery_media_count": _gallery_media_count(gallery),
        "errors": errors,
    }), status


@app.get("/api/admin/galleries/<int:gallery_id>/media")
@admin_required
def list_gallery_media(gallery_id):
    gallery = _own_gallery_or_404(gallery_id)
    if gallery is None:
        return jsonify({"error": "Not your gallery."}), 403
    items = gallery.media.order_by(GalleryMedia.created_at.desc()).all()
    return jsonify({
        "media": [gallery_media_payload(p) for p in items],
        "gallery_url": _gallery_url(gallery),
        "has_passcode": gallery.has_passcode,
    })


@app.delete("/api/admin/gallery-media/<int:media_id>")
@admin_required
def delete_gallery_media(media_id):
    item = GalleryMedia.query.get_or_404(media_id)
    if item.gallery.admin_id != request.current_user.id:
        return jsonify({"error": "Not your gallery."}), 403
    _delete_gallery_media_files(item)
    db.session.delete(item)
    db.session.commit()
    return jsonify({"ok": True})


def _delete_gallery_media_files(item: GalleryMedia) -> None:
    # Destroy the remote asset (best effort — destroy needs an API secret,
    # which unsigned-preset setups don't have, so a deleted gallery item
    # may linger in the Cloudinary media library even though it is gone
    # from the gallery immediately).
    if item.cloudinary_public_id:
        gallery_cloudinary.delete_media(
            item.cloudinary_public_id, item.media_type or "photo"
        )


# ---------------------------------------------------------------- admin: user access control
@app.get("/api/admin/users")
@admin_required
def list_users():
    users = User.query.order_by(User.created_at.desc()).all()
    out = []
    for u in users:
        d = u.to_dict()
        d["is_owner"] = is_owner(u)
        out.append(d)
    return jsonify({"users": out})


@app.patch("/api/admin/users/<int:user_id>")
@admin_required
def update_user(user_id):
    """User management with an owner hierarchy.

    - The main admin (owner, ADMIN_EMAIL) cannot be changed by anyone.
    - Only the owner can grant/revoke access (is_active) or demote admins.
    - Promoted admins can only promote guests to admin — nothing else.
    """
    me = request.current_user
    user = User.query.get_or_404(user_id)
    if user.id == me.id:
        return jsonify({"error": "You cannot change your own account."}), 400
    if is_owner(user):
        return jsonify({"error": "The main admin account cannot be changed."}), 403
    data = request.get_json(force=True, silent=True) or {}
    me_is_owner = is_owner(me)
    changed = False

    if "is_active" in data:
        if not me_is_owner:
            return jsonify({"error": "Only the main admin can grant or revoke access."}), 403
        user.is_active = bool(data["is_active"])
        changed = True

    if "role" in data:
        role = str(data["role"]).strip().lower()
        if role not in ("admin", "guest"):
            return jsonify({"error": "Role must be 'admin' or 'guest'."}), 400
        if role != user.role:
            if role == "admin":
                if user.role != "guest":
                    return jsonify({"error": "Only guests can be promoted."}), 400
                # owner or promoted admin may promote a guest
            else:
                if not me_is_owner:
                    return jsonify({"error": "Only the main admin can remove admin access."}), 403
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
    d = user.to_dict()
    d["is_owner"] = is_owner(user)
    return jsonify({"user": d})


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
            # Watermark (2026-11-10): per-item logo colour for the
            # DKNOTT watermark overlay on delivered copies.
            "ALTER TABLE gallery_media ADD COLUMN wm_variant VARCHAR(10)",
            # Gallery folders (2026-11-11): optional per-item folder
            # ('Haldi', 'Wedding', ...) chosen at upload time.
            "ALTER TABLE gallery_media ADD COLUMN folder VARCHAR(80)",
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
    app.run(host="0.0.0.0", port=5000, debug=True)
