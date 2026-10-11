"""Face matching engine — lightweight, no ML models on the server.

Face detection + descriptor extraction happen in the browser (face-api.js).
The server only stores descriptors and compares them with numpy:
pure math, no TensorFlow, fits comfortably in 512MB RAM.

Descriptor format: 128-dim float vectors (face-api.js faceRecognitionNet).
Distance metric: Euclidean distance (face-api.js standard). Lower = more similar.
Typical match threshold: 0.45 - 0.60.
"""

import numpy as np

DESCRIPTOR_DIM = 128


def ai_status() -> dict:
    return {"available": True, "error": None, "mode": "browser-descriptors"}


def ai_available() -> bool:
    return True


def euclidean_distance(a, b) -> float:
    a = np.asarray(a, dtype=np.float32).ravel()
    b = np.asarray(b, dtype=np.float32).ravel()
    if a.shape != b.shape:
        raise ValueError(f"descriptor dim mismatch: {a.shape} vs {b.shape}")
    return float(np.linalg.norm(a - b))


def best_distance(query_emb, candidate_embs):
    """Smallest Euclidean distance between the selfie and any face in a photo."""
    if query_emb is None or not candidate_embs:
        return None
    try:
        return min(euclidean_distance(query_emb, c) for c in candidate_embs)
    except Exception:
        return None


def sanitize_descriptors(raw, max_faces=20):
    """Validate client-supplied descriptors: list of 128-dim float lists."""
    if not isinstance(raw, list):
        return []
    out = []
    for d in raw[:max_faces]:
        try:
            arr = np.asarray(d, dtype=np.float32).ravel()
            if arr.shape == (DESCRIPTOR_DIM,) and np.all(np.isfinite(arr)):
                out.append(arr.tolist())
        except Exception:
            continue
    return out


# Backwards-compat alias (old ArcFace/cosine API).
cosine_distance = euclidean_distance
