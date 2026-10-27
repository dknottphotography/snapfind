// Central API client for the SnapFind Flask backend.
// Backend base URL: NEXT_PUBLIC_API_URL (production: Render backend;
// empty => same-origin relative URLs for the single-container deploy).

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
// When NEXT_PUBLIC_API_URL is empty, all calls are same-origin relative URLs
// (used when the Flask backend serves the built site from one container).

/** Resolve a backend-provided path into a fully-qualified URL for <img> tags. */
export function resolveUrl(u) {
  if (!u) return "";
  if (u.startsWith("http://") || u.startsWith("https://") || u.startsWith("blob:")) return u;
  return `${API_URL}${u.startsWith("/") ? "" : "/"}${u}`;
}

// ---------- auth storage ----------

export function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export function getUser() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveAuth(token, user) {
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

export function authHeaders() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

// ---------- core request helper ----------

async function api(path, { method = "GET", body, formData } = {}) {
  const headers = { ...authHeaders() };
  let payload;
  if (formData) {
    payload = formData; // browser sets multipart boundary automatically
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: payload,
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    const msg =
      (data && (data.message || data.error)) || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

// ---------- auth ----------

export const signup = (name, email, password, phone) =>
  api("/api/auth/signup", {
    method: "POST",
    body: { name, email, password, phone },
  });

export const login = (email, password) =>
  api("/api/auth/login", { method: "POST", body: { email, password } });

export const fetchMe = () => api("/api/auth/me");

// ---------- public ----------

export const getEventPublic = (slug) =>
  api(`/api/events/${encodeURIComponent(slug)}`);

// ---------- couple's gallery (passcode-only, no account) ----------

// Gallery unlock tokens live in sessionStorage (per event slug) —
// closing the tab forgets the passcode.
export function getGalleryToken(slug) {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(`gallery-token:${slug}`);
  } catch {
    return null;
  }
}

export function saveGalleryToken(slug, token) {
  try {
    sessionStorage.setItem(`gallery-token:${slug}`, token);
  } catch {
    /* ignore */
  }
}

export function clearGalleryToken(slug) {
  try {
    sessionStorage.removeItem(`gallery-token:${slug}`);
  } catch {
    /* ignore */
  }
}

// Public info only: event name + media count. No media URLs, no passcode hint.
export const getGalleryPublic = (slug) =>
  api(`/api/gallery/${encodeURIComponent(slug)}`);

// Verify the passcode -> { token, expires_in_hours, event }.
export const unlockGallery = (slug, passcode) =>
  api(`/api/gallery/${encodeURIComponent(slug)}/unlock`, {
    method: "POST",
    body: { passcode },
  });

// Media list — needs the gallery token (NOT the user login token).
export async function getGalleryMedia(slug, token) {
  const res = await fetch(
    `${API_URL}/api/gallery/${encodeURIComponent(slug)}/media`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    throw new Error(
      (data && (data.message || data.error)) || `Request failed (${res.status})`
    );
  }
  return data;
}

// ---------- admin: couple's gallery ----------

export const setGalleryPasscode = (eventId, passcode) =>
  api(`/api/admin/events/${eventId}/passcode`, {
    method: "PUT",
    body: { passcode },
  });

export const listGalleryMedia = (eventId) =>
  api(`/api/admin/events/${eventId}/gallery`);

/**
 * Upload gallery photos/videos (Cloudinary) one at a time with progress.
 * Mirrors uploadEventPhotosProgress but without face descriptors.
 * Resolves with { media, gallery_media_count, errors }.
 */
export function uploadGalleryMediaProgress(eventId, files, onProgress, hooks) {
  const list = [...files];
  const allMedia = [];
  let mediaCount = 0;
  const errors = [];
  return new Promise((resolve, reject) => {
    let done = 0;
    const report = (file, loaded, fileTotal) =>
      onProgress &&
      onProgress({
        done,
        total: list.length,
        fileName: file ? file.name : "",
        loaded,
        fileTotal,
      });
    const finishCancelled = () =>
      resolve({
        media: allMedia,
        gallery_media_count: mediaCount,
        errors,
        cancelled: true,
      });
    const uploadOne = (idx) => {
      if (hooks && hooks.isCancelled && hooks.isCancelled()) {
        finishCancelled();
        return;
      }
      if (idx >= list.length) {
        resolve({ media: allMedia, gallery_media_count: mediaCount, errors });
        return;
      }
      const file = list[idx];
      const fd = new FormData();
      fd.append("files", file);
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_URL}/api/admin/events/${eventId}/gallery`);
      const token = getToken();
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      if (hooks && hooks.onXhr) hooks.onXhr(xhr);
      xhr.upload.onprogress = (e) =>
        report(file, e.loaded, e.lengthComputable ? e.total : file.size);
      xhr.onabort = () => finishCancelled();
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            allMedia.push(...(data.media || []));
            mediaCount = data.gallery_media_count ?? mediaCount;
            errors.push(...(data.errors || []));
          } catch {
            /* keep going on parse hiccups */
          }
          done += 1;
          report(file, file.size, file.size);
          uploadOne(idx + 1);
        } else {
          let msg = `Upload failed (HTTP ${xhr.status})`;
          try {
            msg = JSON.parse(xhr.responseText).error || msg;
          } catch {
            /* use default */
          }
          reject(new Error(msg));
        }
      };
      xhr.onerror = () => reject(new Error("Upload failed — check your connection."));
      xhr.ontimeout = () => reject(new Error("Upload timed out — try fewer files at once."));
      report(file, 0, file.size);
      xhr.send(fd);
    };
    uploadOne(0);
  });
}

// ---------- admin ----------

export const createEvent = (name) =>
  api("/api/admin/events", { method: "POST", body: { name } });

export const listEvents = () => api("/api/admin/events");

export const deleteEvent = (id) =>
  api(`/api/admin/events/${id}`, { method: "DELETE" });

export const listEventPhotos = (eventId) =>
  api(`/api/admin/events/${eventId}/photos`);

export const deletePhotoAdmin = (photoId) =>
  api(`/api/admin/photos/${photoId}`, { method: "DELETE" });

export function editPhotoAdmin(photoId, file) {
  const fd = new FormData();
  fd.append("file", file, "edited.jpg");
  return api(`/api/admin/photos/${photoId}`, { method: "PUT", formData: fd });
}

export const listUsers = () => api("/api/admin/users");

export const updateUser = (id, data) =>
  api(`/api/admin/users/${id}`, { method: "PATCH", body: data });

export function uploadEventPhotos(eventId, files) {
  const fd = new FormData();
  [...files].forEach((f) => fd.append("files", f));
  return api(`/api/admin/events/${eventId}/photos`, {
    method: "POST",
    formData: fd,
  });
}

/**
 * Shrink an image in the browser before upload (canvas resize).
 * Face recognition only needs ~112px face crops, so 1280px is plenty.
 * Returns the original file if it's not an image or already small.
 */
export function compressImage(file, maxDim = 1280, quality = 0.82) {
  return new Promise((resolve) => {
    if (!file.type.startsWith("image/") || file.size < 400 * 1024) {
      resolve(file);
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      if (scale >= 1) {
        resolve(file);
        return;
      }
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (blob && blob.size < file.size) {
            resolve(new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }));
          } else {
            resolve(file);
          }
        },
        "image/jpeg",
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

/**
 * Upload photos one at a time with live progress.
 * onProgress({ done, total, fileName, loaded, fileTotal }) is called
 * repeatedly: byte-level progress within each file, plus file counts.
 * `descriptors` (optional): array aligned with files; descriptors[i] is the
 *   list of 128-dim face vectors computed in-browser for files[i].
 * Resolves with { photos: [...all uploaded], photo_count }.
 * Sequential (not parallel) to stay gentle on the backend's memory.
 */
export function uploadEventPhotosProgress(eventId, files, onProgress, descriptors, hooks) {
  const list = [...files];
  const allPhotos = [];
  let photoCount = 0;
  // hooks: { isCancelled: () => bool, onXhr: (xhr) => void }
  // On cancel we resolve (not reject) with the photos saved so far.
  return new Promise((resolve, reject) => {
    let done = 0;
    const report = (file, loaded, fileTotal) =>
      onProgress &&
      onProgress({
        done,
        total: list.length,
        fileName: file ? file.name : "",
        loaded,
        fileTotal,
      });
    const finishCancelled = () =>
      resolve({ photos: allPhotos, photo_count: photoCount, cancelled: true });
    const uploadOne = (idx) => {
      if (hooks && hooks.isCancelled && hooks.isCancelled()) {
        finishCancelled();
        return;
      }
      if (idx >= list.length) {
        resolve({ photos: allPhotos, photo_count: photoCount });
        return;
      }
      const file = list[idx];
      const fd = new FormData();
      fd.append("files", file);
      // Client-computed face descriptors (face-api.js), aligned per file.
      if (descriptors && descriptors[idx]) {
        fd.append("descriptors", JSON.stringify([descriptors[idx]]));
      }
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_URL}/api/admin/events/${eventId}/photos`);
      const token = getToken();
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      if (hooks && hooks.onXhr) hooks.onXhr(xhr);
      xhr.upload.onprogress = (e) =>
        report(file, e.loaded, e.lengthComputable ? e.total : file.size);
      xhr.onabort = () => finishCancelled();
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            allPhotos.push(...(data.photos || []));
            photoCount = data.photo_count ?? photoCount;
          } catch {
            /* keep going on parse hiccups */
          }
          done += 1;
          report(file, file.size, file.size);
          uploadOne(idx + 1);
        } else {
          let msg = `Upload failed (HTTP ${xhr.status})`;
          try {
            msg = JSON.parse(xhr.responseText).error || msg;
          } catch {
            /* use default */
          }
          reject(new Error(msg));
        }
      };
      xhr.onerror = () => reject(new Error("Upload failed — check your connection."));
      xhr.ontimeout = () => reject(new Error("Upload timed out — try fewer photos at once."));
      report(file, 0, file.size);
      xhr.send(fd);
    };
    uploadOne(0);
  });
}

// ---------- guest ----------

export function uploadSelfie(file, descriptor) {
  const fd = new FormData();
  fd.append("selfie", file);
  if (descriptor) {
    fd.append("descriptor", JSON.stringify(descriptor));
  }
  return api("/api/guest/selfie", { method: "POST", formData: fd });
}

export const getMatches = (slug) =>
  api(`/api/guest/matches?event=${encodeURIComponent(slug)}`);

export const deleteGuestPhoto = (photoId) =>
  api(`/api/guest/photos/${photoId}`, { method: "DELETE" });

export async function downloadPhotoBlob(photoId) {
  const res = await fetch(`${API_URL}/api/guest/download/${photoId}`, {
    headers: { ...authHeaders() },
  });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  return await res.blob();
}
