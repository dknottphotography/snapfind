"""Couple's gallery — permanent photo/video storage on Cloudinary.

The couple's photos and videos must stay forever. Local disk on a free host
is wiped on restart, so gallery uploads go to the CLIENT's Cloudinary
account via an UNSIGNED upload preset:

  * No API key / API secret anywhere in code or env.
  * The client creates the preset (Settings -> Upload -> Add upload preset,
    Signing mode: Unsigned) and sets CLOUDINARY_CLOUD_NAME +
    CLOUDINARY_UPLOAD_PRESET on the backend.
  * Photos upload as image resources, videos as video resources.

If Cloudinary is not configured, uploads are rejected with a clear error —
gallery media is never silently stored on local disk (permanence is the
whole point of the gallery).
"""
import cloudinary
import cloudinary.uploader
import cloudinary.utils

IMAGE_EXTS = {"png", "jpg", "jpeg", "webp", "gif"}
VIDEO_EXTS = {"mp4", "mov", "webm", "m4v"}

# Max single-file size for gallery uploads (MB). Cloudinary's free plan
# caps uploads well above this; the request is also bounded by
# MAX_CONTENT_LENGTH in config.
MAX_GALLERY_FILE_MB = 100


class GalleryStorageError(Exception):
    """Raised when a gallery upload/delete cannot be completed."""


def _cloud_name() -> str:
    return (cloudinary.config().cloud_name or "").strip()


def configured(cloud_name: str = "", upload_preset: str = "") -> bool:
    """True when the unsigned-preset upload path is usable."""
    return bool((cloud_name or "").strip() and (upload_preset or "").strip())


def init(cloud_name: str, upload_preset: str) -> None:
    """Point the SDK at the client's cloud (no secret — unsigned uploads)."""
    cloudinary.config(cloud_name=(cloud_name or "").strip())


def upload_media(file_storage, media_type: str, folder: str,
                 upload_preset: str) -> dict:
    """Upload one photo/video to Cloudinary via the unsigned preset.

    `file_storage` is a Flask/Werkzeug FileStorage. Returns
    {"url": secure_url, "public_id": public_id}.
    Raises GalleryStorageError with a human-readable message on failure.
    """
    resource_type = "video" if media_type == "video" else "image"
    try:
        # unsigned_upload: no api_key / api_secret needed — the preset alone
        # authorizes the upload. (Plain uploader.upload() is the SIGNED
        # path and raises "Must supply api_key".)
        result = cloudinary.uploader.unsigned_upload(
            file_storage,
            upload_preset,
            resource_type=resource_type,
            folder=folder or None,
        )
    except Exception as exc:  # Cloudinary API errors, network errors, ...
        msg = str(exc)
        raise GalleryStorageError(
            "Cloudinary upload failed: " + (msg or "unknown error")
            + ". Check the upload preset in the client's Cloudinary account."
        ) from exc
    url = result.get("secure_url")
    public_id = result.get("public_id")
    if not url or not public_id:
        raise GalleryStorageError(
            "Cloudinary upload failed: unexpected response from Cloudinary."
        )
    return {"url": url, "public_id": public_id}


def delete_media(public_id: str, media_type: str) -> bool:
    """Best-effort delete of one Cloudinary asset. Returns True on success."""
    if not public_id:
        return False
    try:
        result = cloudinary.uploader.destroy(
            public_id,
            resource_type="video" if media_type == "video" else "image",
            invalidate=True,
        )
        return result.get("result") in ("ok", "not found")
    except Exception:
        return False


def display_url(public_id: str, media_type: str) -> str:
    """Grid-friendly URL: a resized image, or the video's first-frame poster."""
    if media_type == "video":
        url, _ = cloudinary.utils.cloudinary_url(
            public_id, resource_type="video", format="jpg", secure=True,
        )
        return url
    url, _ = cloudinary.utils.cloudinary_url(
        public_id, resource_type="image", secure=True,
        transformation=[{"width": 900, "height": 900, "crop": "limit"}],
    )
    return url


def download_url(public_id: str, media_type: str) -> str:
    """URL that forces a download (fl_attachment) instead of opening inline."""
    url, _ = cloudinary.utils.cloudinary_url(
        public_id,
        resource_type="video" if media_type == "video" else "image",
        flags="attachment",
        secure=True,
    )
    return url
