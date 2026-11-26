// Central API client for the Moments Flask backend.
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

// ---------- couple's gallery (passcode-only, no account) ----------

// Gallery unlock tokens live in sessionStorage (per gallery slug) —
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

// Public info only: gallery name + media count. No media URLs, no passcode hint.
export const getGalleryPublic = (slug) =>
  api(`/api/gallery/${encodeURIComponent(slug)}`);

// Verify the passcode -> { token, expires_in_hours, gallery }.
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

// ---------- admin: couple's galleries ----------

export const listGalleries = () => api("/api/admin/galleries");

export const createGallery = (name) =>
  api("/api/admin/galleries", { method: "POST", body: { name } });

export const deleteGallery = (galleryId) =>
  api(`/api/admin/galleries/${galleryId}`, { method: "DELETE" });

export const setGalleryPasscode = (galleryId, passcode) =>
  api(`/api/admin/galleries/${galleryId}/passcode`, {
    method: "PUT",
    body: { passcode },
  });

export const listGalleryMedia = (galleryId) =>
  api(`/api/admin/galleries/${galleryId}/media`);

export const deleteGalleryMedia = (mediaId) =>
  api(`/api/admin/gallery-media/${mediaId}`, { method: "DELETE" });

// Absolute URL of a gallery's QR code image (encodes the share link).
export const galleryQrUrl = (slug) =>
  `${API_URL}/api/gallery/${encodeURIComponent(slug)}/qr.png`;

/**
 * Upload gallery photos/videos (Cloudinary) one at a time with progress.
 * Resolves with { media, gallery_media_count, errors }.
 */
export function uploadGalleryMediaProgress(galleryId, files, onProgress, hooks, folder) {
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
      if (folder) fd.append("folder", folder);
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_URL}/api/admin/galleries/${galleryId}/media`);
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

export const listUsers = () => api("/api/admin/users");

export const updateUser = (id, data) =>
  api(`/api/admin/users/${id}`, { method: "PATCH", body: data });
