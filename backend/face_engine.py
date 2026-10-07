"""Face AI engine — 100% free & open-source, runs locally on CPU.

Pipeline (exactly as specified):
    * Face detection : RetinaFace   (detector_backend="retinaface")
    * Embeddings     : ArcFace      (model_name="ArcFace")
    * Similarity     : cosine distance (lower = more similar)

DeepFace is imported lazily so the Flask app boots even before the
models are downloaded or deepface is installed. The very first embedding
call downloads the ArcFace + RetinaFace weights (~a few hundred MB) into
~/.deepface — a one-time, free download. No API keys, no cloud.
"""
import numpy as np

_DeepFace = None
_DeepFace_error = None


def _get_deepface():
    global _DeepFace, _DeepFace_error
    if _DeepFace is None and _DeepFace_error is None:
        try:
            from deepface import DeepFace
            _DeepFace = DeepFace
        except Exception as exc:  # deepface not installed (yet)
            _DeepFace_error = exc
    return _DeepFace


def ai_available() -> bool:
    return _get_deepface() is not None


def ai_status() -> dict:
    ok = ai_available()
    return {"available": ok, "error": None if ok else str(_DeepFace_error)}


def _represent(image_path):
    """Detect faces and embed them.

    Returns a list of {"embedding": np.ndarray, "area": float}.
    """
    DeepFace = _get_deepface()
    if DeepFace is None:
        return []
    try:
        results = DeepFace.represent(
            img_path=image_path,
            model_name="ArcFace",
            detector_backend="retinaface",
            enforce_detection=False,  # fall back to whole image if no face found
            align=True,
        )
    except Exception:
        return []
    out = []
    for r in results or []:
        emb = r.get("embedding")
        if not emb:
            continue
        fa = r.get("facial_area") or {}
        try:
            area = float(fa.get("w", 0)) * float(fa.get("h", 0))
        except Exception:
            area = 0.0
        out.append({"embedding": np.asarray(emb, dtype=np.float32), "area": area})
    return out


def extract_embeddings(image_path):
    """All face embeddings found in an event photo (for indexing)."""
    return [r["embedding"] for r in _represent(image_path)]


def extract_selfie_embedding(image_path):
    """Single embedding for a guest selfie — picks the largest detected face."""
    faces = _represent(image_path)
    if not faces:
        return None
    faces.sort(key=lambda f: f["area"], reverse=True)
    return faces[0]["embedding"]


def cosine_distance(a, b) -> float:
    a = np.asarray(a, dtype=np.float32)
    b = np.asarray(b, dtype=np.float32)
    denom = (np.linalg.norm(a) * np.linalg.norm(b)) + 1e-10
    return float(1.0 - np.dot(a, b) / denom)


def best_distance(query_emb, candidate_embs):
    """Smallest cosine distance between the selfie and any face in a photo."""
    if query_emb is None or not candidate_embs:
        return None
    return min(cosine_distance(query_emb, c) for c in candidate_embs)
