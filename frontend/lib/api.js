// Central API client for the SnapFind Flask backend.
// Backend base URL: NEXT_PUBLIC_API_URL (default http://localhost:5000)

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
