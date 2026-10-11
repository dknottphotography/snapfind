import { useEffect, useRef, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import Navbar from "../components/Navbar";
import UploadDropzone from "../components/UploadDropzone";
import PhotoEditor from "../components/PhotoEditor";
import AmbientAbyss from "../components/AmbientAbyss";
import { IconCamera, IconImage, IconUsers, IconCheck, IconCopy, IconUpload, IconX, IconTrash, IconDownload, IconRefresh } from "../components/icons";
import {
  getToken,
  clearAuth,
  fetchMe,
  createEvent,
  listEvents,
  deleteEvent,
  uploadEventPhotosProgress,
  compressImage,
  listEventPhotos,
  deletePhotoAdmin,
  editPhotoAdmin,
  listUsers,
  updateUser,
  resolveUrl,
} from "../lib/api";

export default function AdminPage() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [notAdmin, setNotAdmin] = useState(false);

  const [events, setEvents] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [lastCreated, setLastCreated] = useState(null);

  const [photos, setPhotos] = useState([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null); // {done,total,fileName,loaded,fileTotal}
  const [cancelledNote, setCancelledNote] = useState("");
  const cancelRef = useRef(false);
  const xhrRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const [tab, setTab] = useState("photos"); // photos | users
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);

  const [editingPhoto, setEditingPhoto] = useState(null);
  const [editSaving, setEditSaving] = useState(false);

  // ---- auth guard ----
  useEffect(() => {
    const t = getToken();
    if (!t) {
      router.replace("/login");
      return;
    }
    fetchMe()
      .then((data) => {
        if (data.user.role !== "admin") {
          setNotAdmin(true);
        } else {
          setMe(data.user);
          return listEvents();
        }
        setAuthChecked(true);
      })
      .then((data) => {
        if (data && data.events) {
          setEvents(data.events);
          if (data.events.length > 0) setSelectedId(data.events[0].id);
        }
        setAuthChecked(true);
      })
      .catch(() => {
        clearAuth();
        router.replace("/login");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedEvent = events.find((e) => e.id === selectedId) || null;

  const refreshPhotos = async (eventId) => {
    setPhotosLoading(true);
    try {
      const data = await listEventPhotos(eventId);
      setPhotos(data.photos || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setPhotosLoading(false);
    }
  };

  useEffect(() => {
    if (selectedId) refreshPhotos(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // ---- handlers ----
  const handleCreateEvent = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setError("");
    try {
      const data = await createEvent(newName.trim());
      const ev = data.event;
      setEvents((prev) => [ev, ...prev]);
      setSelectedId(ev.id);
      setLastCreated(ev);
      setNewName("");
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteEvent = async (id, name) => {
    if (!window.confirm(`Delete event "${name}" and all its photos?`)) return;
    setError("");
    try {
      await deleteEvent(id);
      setEvents((prev) => prev.filter((e) => e.id !== id));
      if (selectedId === id) {
        const rest = events.filter((e) => e.id !== id);
        setSelectedId(rest.length ? rest[0].id : null);
      }
      if (lastCreated && lastCreated.id === id) setLastCreated(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const cancelUpload = () => {
    cancelRef.current = true;
    try {
      xhrRef.current?.abort();
    } catch {
      /* ignore */
    }
  };

  const handleFiles = async (files) => {
    if (!selectedId || !files.length || uploading) return;
    cancelRef.current = false;
    xhrRef.current = null;
    setUploading(true);
    setCancelledNote("");
    setUploadProgress({ done: 0, total: files.length, fileName: "Preparing photos…", loaded: 0, fileTotal: 1, preparing: true });
    setError("");
    const checkCancelled = () => {
      if (cancelRef.current) throw new Error("__CANCELLED__");
    };
    try {
      // Shrink photos in-browser first: 10-20x smaller uploads,
      // much faster on slow connections. No quality loss for face matching.
      const compressed = [];
      for (const f of files) {
        checkCancelled();
        compressed.push(await compressImage(f));
      }
      // Face AI runs on-device: detect faces + compute descriptors per photo.
      const { loadFaceModels, getFaceDescriptors } = await import("../lib/faceai");
      checkCancelled();
      await loadFaceModels((msg) =>
        setUploadProgress({ done: 0, total: compressed.length, fileName: msg, loaded: 0, fileTotal: 1, preparing: true })
      );
      const descriptors = [];
      for (let i = 0; i < compressed.length; i++) {
        checkCancelled();
        setUploadProgress({
          done: 0, total: compressed.length,
          fileName: `Scanning faces… ${i + 1}/${compressed.length}`,
          loaded: i, fileTotal: compressed.length, preparing: true,
        });
        descriptors.push(await getFaceDescriptors(compressed[i]));
      }
      checkCancelled();
      setUploadProgress({ done: 0, total: compressed.length, fileName: "", loaded: 0, fileTotal: 1 });
      const data = await uploadEventPhotosProgress(
        selectedId,
        compressed,
        (p) => setUploadProgress({ ...p }),
        descriptors,
        {
          isCancelled: () => cancelRef.current,
          onXhr: (xhr) => { xhrRef.current = xhr; },
        }
      );
      setPhotos((prev) => [...(data.photos || []), ...prev]);
      setEvents((prev) =>
        prev.map((e) =>
          e.id === selectedId ? { ...e, photo_count: data.photo_count ?? e.photo_count } : e
        )
      );
      if (data.cancelled) {
        const saved = data.photos?.length || 0;
        setCancelledNote(
          saved > 0
            ? `Upload stopped — ${saved} of ${files.length} photos were saved.`
            : "Upload stopped before any photo was sent."
        );
      }
    } catch (err) {
      if (err.message === "__CANCELLED__") {
        setCancelledNote("Upload stopped.");
      } else {
        setError(err.message);
      }
    } finally {
      setUploading(false);
      setUploadProgress(null);
      xhrRef.current = null;
    }
  };

  const handleDeletePhoto = async (photoId, filename) => {
    if (!window.confirm(`Delete "${filename}"?`)) return;
    setError("");
    try {
      await deletePhotoAdmin(photoId);
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
      setEvents((prev) =>
        prev.map((e) =>
          e.id === selectedId
            ? { ...e, photo_count: Math.max(0, (e.photo_count || 1) - 1) }
            : e
        )
      );
    } catch (err) {
      setError(err.message);
    }
  };

  // ---- user access control ----
  const refreshUsers = async () => {
    setUsersLoading(true);
    try {
      const data = await listUsers();
      setUsers(data.users || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    if (tab === "users" && authChecked && !notAdmin) refreshUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, authChecked]);

  const handleToggleActive = async (u) => {
    setError("");
    try {
      const data = await updateUser(u.id, { is_active: !u.is_active });
      setUsers((prev) => prev.map((x) => (x.id === u.id ? data.user : x)));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleToggleRole = async (u) => {
    const toAdmin = u.role !== "admin";
    if (
      !window.confirm(
        toAdmin
          ? `Make ${u.name} (${u.email}) an admin? They'll be able to upload event photos and manage users.`
          : `Remove admin access from ${u.name} (${u.email})? They'll become a regular guest.`
      )
    )
      return;
    setError("");
    try {
      const data = await updateUser(u.id, { role: toAdmin ? "admin" : "guest" });
      setUsers((prev) => prev.map((x) => (x.id === u.id ? data.user : x)));
    } catch (err) {
      setError(err.message);
    }
  };

  // ---- photo editing ----
  const handleSaveEdit = async (file) => {
    if (!editingPhoto) return;
    setEditSaving(true);
    setError("");
    try {
      const data = await editPhotoAdmin(editingPhoto.id, file);
      setPhotos((prev) =>
        prev.map((p) => (p.id === editingPhoto.id ? data.photo : p))
      );
      setEditingPhoto(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setEditSaving(false);
    }
  };

  const copyJoinLink = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy to clipboard");
    }
  };

  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-abyss text-inkdim">
        Loading…
      </div>
    );
  }

  if (notAdmin) {
    return (
      <>
        <Navbar />
        <div className="mx-auto max-w-xl px-4 py-24 text-center text-white">
          <div className="text-5xl">🚫</div>
          <h1 className="mt-4 text-2xl font-bold">Admins only</h1>
          <p className="mt-2 text-inkdim">
            This studio panel is for photographer accounts. Your guest gallery
            is waiting for you instead.
          </p>
          <button
            onClick={() => router.push("/gallery")}
            className="mt-6 btn-bio rounded-xl px-6 py-2.5"
          >
            Go to My Gallery
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Photographer Studio — SnapFind</title>
      </Head>
      <div className="min-h-screen bg-abyss text-ink">
        <AmbientAbyss />
        <Navbar />

        <main className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-3xl font-bold">Photographer Studio</h1>
              <p className="mt-1 text-sm text-inkdim">
                Signed in as {me?.name} — create events, upload photos, share QR codes.
              </p>
            </div>
          </div>

          <div className="mt-6 flex gap-2">
            {[
              { id: "photos", label: "Photos & Events", icon: <IconImage size={15} /> },
              { id: "users", label: "Users", icon: <IconUsers size={15} /> },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
                  tab === t.id
                    ? "btn-bio"
                    : "glass text-inkdim hover:text-ink"
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
              {error}
            </div>
          )}

          {tab === "photos" && (
          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            {/* ------- LEFT COLUMN ------- */}
            <div className="space-y-6">
              {/* New event */}
              <div className="glass rounded-2xl p-6">
                <h2 className="font-semibold">New event</h2>
                <form onSubmit={handleCreateEvent} className="mt-3 flex gap-2">
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Ananya's Wedding"
                    className="min-w-0 flex-1 rounded-xl border border-white/10 bg-abyss/60 px-4 py-2.5 text-sm text-ink outline-none transition focus:border-bio-cyan"
                  />
                  <button
                    type="submit"
                    disabled={creating || !newName.trim()}
                    className="btn-bio rounded-xl px-4 py-2.5 text-sm disabled:opacity-50"
                  >
                    {creating ? "…" : "Create"}
                  </button>
                </form>

                {lastCreated && (
                  <div className="mt-4 glass rounded-xl p-4">
                    <p className="text-sm font-semibold text-emerald-300">
                      <span className="inline-flex items-center gap-2"><IconCheck size={16} /> Event created!</span>
                    </p>
                    <div className="mt-3 flex justify-center">
                      <img
                        src={resolveUrl(lastCreated.qr_url)}
                        alt="Event QR code"
                        className="h-44 w-44 rounded-xl bg-white p-2"
                      />
                    </div>
                    <p className="mt-3 truncate text-center text-xs text-inkdim">
                      {lastCreated.join_url}
                    </p>
                    <button
                      onClick={() => copyJoinLink(lastCreated.join_url)}
                      className="mt-2 w-full rounded-xl border border-white/15 py-2 text-sm font-medium text-ink transition hover:border-white/30"
                    >
                      {copied ? <span className="inline-flex items-center gap-1.5"><IconCheck size={14} /> Copied!</span> : <span className="inline-flex items-center gap-1.5"><IconCopy size={14} /> Copy join link</span>}
                    </button>
                  </div>
                )}
              </div>

              {/* Events list */}
              <div className="glass rounded-2xl p-6">
                <h2 className="font-semibold">Your events</h2>
                {events.length === 0 ? (
                  <p className="mt-3 text-sm text-inkdim">
                    No events yet. Create your first one above.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {events.map((ev) => (
                      <li
                        key={ev.id}
                        onClick={() => setSelectedId(ev.id)}
                        className={`flex cursor-pointer items-center justify-between rounded-xl px-3 py-2.5 ring-1 transition ${
                          ev.id === selectedId
                            ? "bg-bio-teal/15 ring-bio-teal/40"
                            : "glass hover:border-bio-cyan/40"
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{ev.name}</p>
                          <p className="text-xs text-inkdim">
                            {ev.photo_count ?? 0} photos
                            {ev.created_at &&
                              ` · ${new Date(ev.created_at).toLocaleDateString()}`}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteEvent(ev.id, ev.name);
                          }}
                          className="ml-2 rounded-lg px-2 py-1 text-sm text-inkdim transition hover:bg-red-500/15 hover:text-red-400"
                          title="Delete event"
                        >
                          🗑
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* ------- RIGHT COLUMN: photos ------- */}
            <div className="lg:col-span-2">
              <div className="glass rounded-2xl p-6">
                {!selectedEvent ? (
                  <p className="py-16 text-center text-sm text-inkdim">
                    Select or create an event to upload photos.
                  </p>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="font-semibold">
                        {selectedEvent.name}
                        <span className="ml-2 text-sm font-normal text-inkdim">
                          {photos.length} photo{photos.length === 1 ? "" : "s"}
                        </span>
                      </h2>
                      {selectedEvent.qr_url && (
                        <a
                          href={resolveUrl(selectedEvent.qr_url)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-medium text-bio-cyan hover:underline"
                        >
                          Open QR code ↗
                        </a>
                      )}
                    </div>

                    <div className="mt-4">
                      <UploadDropzone
                        onFiles={handleFiles}
                        label={
                          uploading
                            ? "Uploading…"
                            : "Drop event photos here or click to browse"
                        }
                      />
                      {uploading && (
                        <p className="mt-2 text-center text-sm text-inkdim">
                          Uploading and scanning faces… this can take a while on CPU.
                        </p>
                      )}
                      {uploading && uploadProgress && (() => {
                        const p = uploadProgress;
                        const frac = p.total > 0 ? (p.done + (p.fileTotal > 0 ? p.loaded / p.fileTotal : 0)) / p.total : 0;
                        const pct = Math.min(100, Math.round(frac * 100));
                        return (
                          <div className="mt-4 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                            <style>{`@keyframes snapfind-stripes { from { background-position: 0 0; } to { background-position: 40px 0; } }`}</style>
                            <div className="flex items-baseline justify-between gap-2">
                              <p className="text-sm font-semibold text-ink">
                                {p.done} of {p.total} photos uploaded
                              </p>
                              <p className="text-sm font-bold text-bio-cyan">{pct}%</p>
                            </div>
                            <div className="mt-3 h-5 overflow-hidden rounded-full bg-white/10">
                              <div
                                className="h-full rounded-full transition-[width] duration-300 ease-out"
                                style={{
                                  width: `${pct}%`,
                                  backgroundImage:
                                    "linear-gradient(45deg, rgba(255,255,255,.25) 25%, transparent 25%, transparent 50%, rgba(255,255,255,.25) 50%, rgba(255,255,255,.25) 75%, transparent 75%)",
                                  backgroundColor: "#2dd4bf",
                                  backgroundSize: "40px 40px",
                                  animation: "snapfind-stripes 0.8s linear infinite",
                                }}
                              />
                            </div>
                            {p.fileName && (
                              <p className="mt-2 truncate text-center text-xs text-inkdim">
                                Uploading: {p.fileName}
                              </p>
                            )}
                            <div className="mt-3 flex justify-center">
                              <button
                                type="button"
                                onClick={cancelUpload}
                                className="rounded-xl bg-red-500/15 px-5 py-2 text-sm font-semibold text-red-300 ring-1 ring-red-500/40 transition hover:bg-red-500/25"
                              >
                                ✕ Cancel upload
                              </button>
                            </div>
                          </div>
                        );
                      })()}
                      {!uploading && cancelledNote && (
                        <p className="mt-2 rounded-xl bg-amber-500/10 px-4 py-2.5 text-center text-sm text-amber-300 ring-1 ring-amber-500/30">
                          {cancelledNote}
                        </p>
                      )}
                    </div>

                    <div className="mt-6">
                      {photosLoading ? (
                        <p className="py-8 text-center text-sm text-inkdim">
                          Loading photos…
                        </p>
                      ) : photos.length === 0 ? (
                        <p className="py-8 text-center text-sm text-inkdim">
                          No photos yet — upload some above.
                        </p>
                      ) : (
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                          {photos.map((p) => (
                            <div
                              key={p.id}
                              className="group relative overflow-hidden rounded-xl ring-1 ring-white/10"
                            >
                              <img
                                src={resolveUrl(p.url)}
                                alt={p.filename}
                                className="aspect-square w-full object-cover"
                                loading="lazy"
                              />
                              <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-xs font-medium text-white">
                                {p.faces_detected ?? 0} faces
                              </span>
                              <button
                                onClick={() => handleDeletePhoto(p.id, p.filename)}
                                className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-xs text-red-300 opacity-0 transition group-hover:opacity-100"
                                title="Delete photo"
                              >
                                🗑
                              </button>
                              <button
                                onClick={() => setEditingPhoto(p)}
                                className="absolute right-2 top-9 rounded-full bg-black/70 px-2 py-0.5 text-xs text-ink opacity-0 transition group-hover:opacity-100"
                                title="Edit photo (rotate / flip)"
                              >
                                ✏️
                              </button>
                              <p className="truncate bg-black/60 px-2 py-1 text-[11px] text-inkdim">
                                {p.filename}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          )}

          {tab === "users" && (
            <div className="mt-6 glass rounded-2xl p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">User access control</h2>
                <button
                  onClick={refreshUsers}
                  className="rounded-xl bg-white/10 px-3 py-1.5 text-xs font-medium text-inkdim hover:bg-white/15"
                >
                  ↻ Refresh
                </button>
              </div>
              <p className="mt-1 text-sm text-inkdim">
                {me?.is_owner ? (
                  <>
                    As the main admin you can promote guests to{" "}
                    <span className="text-bio-cyan">admin</span>, remove admin
                    access, or grant/revoke sign-in access. Your own account
                    can&apos;t be changed by anyone.
                  </>
                ) : (
                  <>
                    You can promote guests to{" "}
                    <span className="text-bio-cyan">admin</span> so they can
                    upload from their own accounts. Only the main admin can
                    remove access or revoke accounts.
                  </>
                )}
              </p>
              <div className="mt-4">
                {usersLoading ? (
                  <p className="py-8 text-center text-sm text-inkdim">
                    Loading users…
                  </p>
                ) : users.length === 0 ? (
                  <p className="py-8 text-center text-sm text-inkdim">
                    No users yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="text-xs uppercase tracking-wide text-inkdim">
                          <th className="pb-2 pr-4 font-medium">User</th>
                          <th className="pb-2 pr-4 font-medium">Role</th>
                          <th className="pb-2 pr-4 font-medium">Status</th>
                          <th className="pb-2 text-right font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((u) => (
                          <tr key={u.id} className="border-t border-white/5">
                            <td className="py-3 pr-4">
                              <p className="font-medium text-white">
                                {u.name}{" "}
                                {u.id === me?.id && (
                                  <span className="text-xs font-normal text-inkdim">
                                    (you)
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-inkdim">{u.email}</p>
                            </td>
                            <td className="py-3 pr-4">
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                  u.role === "admin"
                                    ? "bg-bio-teal/15 text-bio-cyan"
                                    : "bg-white/10 text-inkdim"
                                }`}
                              >
                                {u.is_owner ? "owner" : u.role}
                              </span>
                            </td>
                            <td className="py-3 pr-4">
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                  u.is_active
                                    ? "bg-emerald-500/15 text-emerald-300"
                                    : "bg-red-500/15 text-red-300"
                                }`}
                              >
                                {u.is_active ? "Active" : "Disabled"}
                              </span>
                            </td>
                            <td className="py-3 text-right">
                              {u.id !== me?.id && !u.is_owner ? (
                                <div className="flex justify-end gap-2">
                                  {u.role !== "admin" ? (
                                    <button
                                      onClick={() => handleToggleRole(u)}
                                      className="rounded-lg bg-uv-magenta/10 px-3 py-1 text-xs font-medium text-uv-magenta hover:bg-uv-magenta/20"
                                    >
                                      Make admin
                                    </button>
                                  ) : (
                                    me?.is_owner && (
                                      <button
                                        onClick={() => handleToggleRole(u)}
                                        className="rounded-lg bg-bio-teal/10 px-3 py-1 text-xs font-medium text-bio-cyan hover:bg-bio-teal/20"
                                      >
                                        Remove admin
                                      </button>
                                    )
                                  )}
                                  {me?.is_owner && (
                                    <button
                                      onClick={() => handleToggleActive(u)}
                                      className={`rounded-lg px-3 py-1 text-xs font-medium ${
                                        u.is_active
                                          ? "bg-red-500/10 text-red-300 hover:bg-red-500/20"
                                          : "bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                                      }`}
                                    >
                                      {u.is_active ? "Revoke access" : "Grant access"}
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-zinc-600">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>

        {editingPhoto && (
          <PhotoEditor
            photo={editingPhoto}
            onClose={() => setEditingPhoto(null)}
            onSave={handleSaveEdit}
            saving={editSaving}
          />
        )}
      </div>
    </>
  );
}
