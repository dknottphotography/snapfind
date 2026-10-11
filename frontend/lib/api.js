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
 * Upload photos one at a time with live progress.
 * onProgress({ done, total, fileName, loaded, fileTotal }) is called
 * repeatedly: byte-level progress within each file, plus file counts.
 * Resolves with { photos: [...all uploaded], photo_count }.
 * Sequential (not parallel) to stay gentle on the backend's memory.
 */
export function uploadEventPhotosProgress(eventId, files, onProgress) {
  const list = [...files];
  const allPhotos = [];
  let photoCount = 0;
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
    const uploadOne = (idx) => {
      if (idx >= list.length) {
        resolve({ photos: allPhotos, photo_count: photoCount });
        return;
      }
      const file = list[idx];
      const fd = new FormData();
      fd.append("files", file);
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_URL}/api/admin/events/${eventId}/photos`);
      const token = getToken();
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.upload.onprogress = (e) =>
        report(file, e.loaded, e.lengthComputable ? e.total : file.size);
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

export function uploadSelfie(file) {
  const fd = new FormData();
  fd.append("selfie", file);
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
