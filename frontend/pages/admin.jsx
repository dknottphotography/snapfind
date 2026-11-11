import { useEffect, useRef, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import Navbar from "../components/Navbar";
import UploadDropzone from "../components/UploadDropzone";
import PhotoEditor from "../components/PhotoEditor";
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
  listGalleries,
  createGallery,
  deleteGallery,
  setGalleryPasscode,
  listGalleryMedia,
  deleteGalleryMedia,
  galleryQrUrl,
  uploadGalleryMediaProgress,
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

  const [tab, setTab] = useState("photos"); // photos | gallery | users
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);

  // ---- couple's gallery ----
  const [galleryMedia, setGalleryMedia] = useState([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [galleryProgress, setGalleryProgress] = useState(null);
  const [galleryNote, setGalleryNote] = useState("");
  const [passcodeInput, setPasscodeInput] = useState("");
  const [passcodeSaving, setPasscodeSaving] = useState(false);
  const [passcodeNote, setPasscodeNote] = useState("");
  const [galleryCopied, setGalleryCopied] = useState(false);
  const [galleryFolder, setGalleryFolder] = useState("General");
  const [galleryFolderCustom, setGalleryFolderCustom] = useState("");
  const [galleryFolderFilter, setGalleryFolderFilter] = useState("All");
  const galleryCancelRef = useRef(false);
  const galleryXhrRef = useRef(null);
  // Standalone galleries (separate from events): own list + own selection.
  const [galleries, setGalleries] = useState([]);
  const [selectedGalleryId, setSelectedGalleryId] = useState(null);
  const [newGalleryName, setNewGalleryName] = useState("");
  const [galleryCreating, setGalleryCreating] = useState(false);

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
  const selectedGallery =
    galleries.find((g) => g.id === selectedGalleryId) || null;

  // Gallery folders: chosen at upload time, used to organise the grid.
  const GALLERY_FOLDERS = [
    "General",
    "Pre-Wedding",
    "Engagement",
    "Haldi",
    "Mehndi",
    "Sangeet",
    "Wedding",
    "Reception",
    "Custom…",
  ];
  const effectiveGalleryFolder = () =>
    galleryFolder === "General"
      ? ""
      : galleryFolder === "Custom…"
        ? galleryFolderCustom.trim()
        : galleryFolder;
  const galleryFoldersPresent = [
    ...new Set(galleryMedia.map((m) => m.folder || "General")),
  ];
  const activeFolderFilter =
    galleryFolderFilter === "All" ||
    galleryFoldersPresent.includes(galleryFolderFilter)
      ? galleryFolderFilter
      : "All";
  const visibleGalleryMedia =
    activeFolderFilter === "All"
      ? galleryMedia
      : galleryMedia.filter(
          (m) => (m.folder || "General") === activeFolderFilter
        );

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

  // ---- couple's galleries (standalone, not events) ----
  const loadGalleries = async () => {
    try {
      const data = await listGalleries();
      const list = data.galleries || [];
      setGalleries(list);
      if (list.length > 0) {
        setSelectedGalleryId((prev) =>
          prev && list.some((g) => g.id === prev) ? prev : list[0].id
        );
      } else {
        setSelectedGalleryId(null);
      }
      return list;
    } catch (err) {
      setError(err.message);
      return [];
    }
  };

  useEffect(() => {
    if (tab === "gallery") loadGalleries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const refreshGallery = async (galleryId) => {
    setGalleryLoading(true);
    try {
      const data = await listGalleryMedia(galleryId);
      setGalleryMedia(data.media || []);
      setGalleries((prev) =>
        prev.map((g) =>
          g.id === galleryId
            ? {
                ...g,
                media_count: data.media?.length ?? g.media_count,
                has_passcode: data.has_passcode ?? g.has_passcode,
                gallery_url: data.gallery_url ?? g.gallery_url,
              }
            : g
        )
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setGalleryLoading(false);
    }
  };

  useEffect(() => {
    if (tab === "gallery" && selectedGalleryId) refreshGallery(selectedGalleryId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, selectedGalleryId]);

  const handleCreateGallery = async (e) => {
    e.preventDefault();
    if (!newGalleryName.trim() || galleryCreating) return;
    setGalleryCreating(true);
    setError("");
    try {
      const data = await createGallery(newGalleryName.trim());
      const g = data.gallery;
      setGalleries((prev) => [g, ...prev]);
      setSelectedGalleryId(g.id);
      setNewGalleryName("");
      setGalleryMedia([]);
      setPasscodeNote("");
    } catch (err) {
      setError(err.message);
    } finally {
      setGalleryCreating(false);
    }
  };

  const handleDeleteGallery = async () => {
    if (!selectedGallery) return;
    if (
      !window.confirm(
        `Delete the gallery "${selectedGallery.name}"? Its link and QR will stop working.`
      )
    )
      return;
    setError("");
    try {
      await deleteGallery(selectedGallery.id);
      const rest = galleries.filter((g) => g.id !== selectedGallery.id);
      setGalleries(rest);
      setSelectedGalleryId(rest.length > 0 ? rest[0].id : null);
      setGalleryMedia([]);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSavePasscode = async (e) => {
    e.preventDefault();
    if (!selectedGalleryId) return;
    setPasscodeSaving(true);
    setPasscodeNote("");
    setError("");
    try {
      const data = await setGalleryPasscode(selectedGalleryId, passcodeInput.trim());
      setGalleries((prev) =>
        prev.map((g) =>
          g.id === selectedGalleryId
            ? { ...g, has_passcode: data.has_passcode, gallery_url: data.gallery_url }
            : g
        )
      );
      setPasscodeInput("");
      setPasscodeNote(
        data.has_passcode
          ? "Passcode saved — send it to the couple in a separate message from the link."
          : "Passcode removed — the gallery stays locked until a new one is set."
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setPasscodeSaving(false);
    }
  };

  const copyGalleryLink = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      setGalleryCopied(true);
      setTimeout(() => setGalleryCopied(false), 2000);
    } catch {
      setError("Could not copy to clipboard");
    }
  };

  const cancelGalleryUpload = () => {
    galleryCancelRef.current = true;
    try {
      galleryXhrRef.current?.abort();
    } catch {
      /* ignore */
    }
  };

  const handleGalleryFiles = async (files) => {
    if (!selectedGalleryId || !files.length || galleryUploading) return;
    galleryCancelRef.current = false;
    galleryXhrRef.current = null;
    setGalleryUploading(true);
    setGalleryNote("");
    setGalleryProgress({ done: 0, total: files.length, fileName: "Preparing…", loaded: 0, fileTotal: 1 });
    setError("");
    const targetFolder = effectiveGalleryFolder();
    try {
      const data = await uploadGalleryMediaProgress(
        selectedGalleryId,
        files,
        (p) => setGalleryProgress({ ...p }),
        {
          isCancelled: () => galleryCancelRef.current,
          onXhr: (xhr) => {
            galleryXhrRef.current = xhr;
          },
        },
        targetFolder
      );
      setGalleryMedia((prev) => [...(data.media || []), ...prev]);
      setGalleries((prev) =>
        prev.map((g) =>
          g.id === selectedGalleryId
            ? { ...g, media_count: data.gallery_media_count ?? g.media_count }
            : g
        )
      );
      const errs = data.errors || [];
      const savedCount = data.media?.length || 0;
      setGalleryNote(
        data.cancelled
          ? `Upload stopped — ${savedCount} of ${files.length} saved.`
          : errs.length
            ? `Saved ${savedCount} of ${files.length}. ${errs[0]}`
            : `Uploaded ${savedCount} file${savedCount === 1 ? "" : "s"} to Cloudinary${targetFolder ? ` in the ${targetFolder} folder` : ""}.`
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setGalleryUploading(false);
      setGalleryProgress(null);
      galleryXhrRef.current = null;
    }
  };

  const handleDeleteGalleryItem = async (item) => {
    if (!window.confirm(`Delete "${item.filename}" from the couple's gallery?`)) return;
    setError("");
    try {
      await deleteGalleryMedia(item.id);
      setGalleryMedia((prev) => prev.filter((m) => m.id !== item.id));
      setGalleries((prev) =>
        prev.map((g) =>
          g.id === selectedGalleryId
            ? { ...g, media_count: Math.max(0, (g.media_count || 1) - 1) }
            : g
        )
      );
    } catch (err) {
      setError(err.message);
    }
  };

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
        <div className="mx-auto max-w-xl px-4 py-24 text-center text-ink">
          <h1 className="text-2xl font-bold tracking-tight">Admins only</h1>
          <p className="mt-2 text-inkdim">
            This studio panel is for photographer accounts. Your guest gallery
            is waiting for you instead.
          </p>
          <button
            onClick={() => router.push("/gallery")}
            className="btn-teal mt-6 px-6 py-2.5 text-sm"
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
      <div className="min-h-screen bg-[#EDF2EE] text-ink">
        <Navbar />

        <main className="relative z-10 mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[32px] font-bold tracking-tight">Photographer Studio</h1>
              <p className="mt-1.5 text-sm text-inkdim">
                Signed in as {me?.name}. Create events, upload photos and share QR codes.
              </p>
            </div>
          </div>

          <div className="mt-8 flex gap-7 border-b border-[#17122e]/10">
            {[
              { id: "photos", label: "Photos & events" },
              { id: "gallery", label: "Couple's galleries" },
              { id: "users", label: "Users" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`-mb-px border-b-2 px-0.5 pb-3 text-sm transition ${
                  tab === t.id
                    ? "border-[#0D9488] font-semibold text-ink"
                    : "border-transparent font-medium text-inkdim hover:text-ink"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">
              {error}
            </div>
          )}

          {tab === "photos" && (
          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            {/* ------- LEFT COLUMN ------- */}
            <div className="space-y-6">
              {/* New event */}
              <div className="panel p-6">
                <h2 className="font-semibold">New event</h2>
                <form onSubmit={handleCreateEvent} className="mt-3 flex gap-2">
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Ananya's Wedding"
                    className="field min-w-0 flex-1 px-3.5 py-2.5 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={creating || !newName.trim()}
                    className="btn-teal px-4 py-2.5 text-sm"
                  >
                    {creating ? "…" : "Create"}
                  </button>
                </form>

                {lastCreated && (
                  <div className="panel-inset mt-4 p-4">
                    <p className="text-sm font-semibold text-emerald-700">
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
                      className="btn-outline mt-2 w-full py-2 text-sm"
                    >
                      {copied ? <span className="inline-flex items-center gap-1.5"><IconCheck size={14} /> Copied!</span> : <span className="inline-flex items-center gap-1.5"><IconCopy size={14} /> Copy join link</span>}
                    </button>
                  </div>
                )}
              </div>

              {/* Events list */}
              <div className="panel p-6">
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
                        className={`flex cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 ring-1 transition ${
                          ev.id === selectedId
                            ? "bg-[#0e7490]/[0.07] ring-[#0e7490]/30"
                            : "ring-transparent hover:bg-[#faf7f0] hover:ring-[#17122e]/10"
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
                          className="ml-2 rounded-md px-2 py-1 text-inkdim transition hover:bg-red-50 hover:text-red-700"
                          title="Delete event"
                        >
                          <IconTrash size={15} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* ------- RIGHT COLUMN: photos ------- */}
            <div className="lg:col-span-2">
              <div className="panel p-6">
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
                          className="text-xs font-medium text-[#0e7490] hover:underline"
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
                          <div className="panel-inset mt-4 p-4">
                              <div className="flex items-baseline justify-between gap-2">
                              <p className="text-sm font-semibold text-ink">
                                {p.done} of {p.total} photos uploaded
                              </p>
                              <p className="text-sm font-bold text-[#0e7490]">{pct}%</p>
                            </div>
                            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#17122e]/10">
                              <div
                                className="h-full rounded-full bg-[#0e7490] transition-[width] duration-300 ease-out"
                                style={{ width: `${pct}%` }}
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
                                className="btn-danger px-5 py-2 text-sm"
                              >
                                Cancel upload
                              </button>
                            </div>
                          </div>
                        );
                      })()}
                      {!uploading && cancelledNote && (
                        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-center text-sm text-amber-800">
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
                              className="group relative overflow-hidden rounded-lg ring-1 ring-[#17122e]/10"
                            >
                              <img
                                src={resolveUrl(p.url)}
                                alt={p.filename}
                                className="aspect-square w-full object-cover"
                                loading="lazy"
                              />
                              <span className="absolute left-2 top-2 rounded-md bg-black/70 px-2 py-0.5 text-xs font-medium text-white">
                                {p.faces_detected ?? 0} faces
                              </span>
                              <button
                                onClick={() => handleDeletePhoto(p.id, p.filename)}
                                className="absolute right-2 top-2 rounded-md bg-black/70 px-2 py-1 text-xs font-medium text-white opacity-0 transition hover:bg-red-800 group-hover:opacity-100"
                                title="Delete photo"
                              >
                                Delete
                              </button>
                              <button
                                onClick={() => setEditingPhoto(p)}
                                className="absolute right-2 top-10 rounded-md bg-black/70 px-2 py-1 text-xs font-medium text-white opacity-0 transition hover:bg-black/90 group-hover:opacity-100"
                                title="Edit photo (rotate / flip)"
                              >
                                Edit
                              </button>
                              <p className="truncate bg-[#17122e]/85 px-2 py-1 text-[11px] text-white/75">
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

          {tab === "gallery" && (
          <div className="mt-8 grid items-start gap-8 lg:grid-cols-[250px_1fr]">
            {/* ------- LEFT RAIL: gallery list + create ------- */}
            <div>
              <p className="text-[13px] font-semibold text-ink">Your galleries</p>
              <div className="mt-3 space-y-1">
                {galleries.length === 0 && (
                  <p className="text-sm leading-relaxed text-inkdim">
                    No galleries yet. Create the first one below — all it
                    needs is the couple&apos;s name.
                  </p>
                )}
                {galleries.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => {
                      setSelectedGalleryId(g.id);
                      setGalleryFolderFilter("All");
                    }}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                      g.id === selectedGalleryId
                        ? "border-l-[3px] border-[#0D9488] bg-white font-semibold text-ink shadow-[0_1px_2px_rgba(23,18,46,0.07)]"
                        : "border-l-[3px] border-transparent text-inkdim hover:bg-white/70 hover:text-ink"
                    }`}
                  >
                    <span className="min-w-0 truncate">{g.name}</span>
                    <span className="shrink-0 text-xs font-normal text-inkdim">
                      {g.media_count ?? 0} file{(g.media_count ?? 0) === 1 ? "" : "s"}
                    </span>
                  </button>
                ))}
              </div>
              <form onSubmit={handleCreateGallery} className="mt-4 flex gap-2">
                <input
                  value={newGalleryName}
                  onChange={(e) => setNewGalleryName(e.target.value)}
                  placeholder="Ananya & Rohan"
                  className="field min-w-0 flex-1 px-3 py-2.5 text-sm"
                />
                <button
                  type="submit"
                  disabled={galleryCreating || !newGalleryName.trim()}
                  className="btn-teal shrink-0 px-4 py-2.5 text-sm"
                >
                  {galleryCreating ? "…" : "Create"}
                </button>
              </form>
              <p className="mt-3 text-xs leading-relaxed text-inkdim">
                A private, passcode-protected gallery for the couple — kept
                fully separate from your events. Files are stored permanently
                on Cloudinary.
              </p>
            </div>

            {/* ------- RIGHT: ticket card + media + danger ------- */}
            <div className="min-w-0">
              {!selectedGallery && (
                <div className="panel p-8 text-center">
                  <p className="text-sm text-inkdim">
                    {galleries.length === 0
                      ? "Create a gallery to get its share link and QR code."
                      : "Select a gallery from the list to manage its link, passcode and photos."}
                  </p>
                </div>
              )}

              {selectedGallery && (
                <>
                  {/* ticket card */}
                  <div className="flex flex-col overflow-visible rounded-2xl bg-[#0B3B34] shadow-[0_2px_10px_rgba(11,59,52,0.25)] sm:flex-row">
                    <div className="min-w-0 flex-1 p-6 sm:p-7">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                        <h2 className="text-[26px] font-bold leading-tight text-[#F5FAF7]">
                          {selectedGallery.name}
                        </h2>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                        {selectedGallery.has_passcode ? (
                          <span className="rounded-full bg-[rgba(255,255,255,0.14)] px-2.5 py-0.5 text-xs font-semibold text-[#A9E5CB]">
                            Passcode set
                          </span>
                        ) : (
                          <span className="rounded-full bg-[rgba(251,191,36,0.18)] px-2.5 py-0.5 text-xs font-semibold text-[#FCD34D]">
                            No passcode yet
                          </span>
                        )}
                        <span className="text-[13px] text-[rgba(255,255,255,0.6)]">
                          {galleryMedia.length} file{galleryMedia.length === 1 ? "" : "s"} on Cloudinary
                        </span>
                      </div>

                      {selectedGallery.gallery_url && (
                        <>
                          <p className="mt-6 text-[13px] font-medium text-[rgba(255,255,255,0.6)]">
                            Gallery link
                          </p>
                          <div className="mt-1.5 flex gap-2">
                            <p className="min-w-0 flex-1 truncate rounded-lg bg-[rgba(0,0,0,0.3)] px-3.5 py-2.5 text-sm text-[#EAF4EF]">
                              {selectedGallery.gallery_url}
                            </p>
                            <button
                              onClick={() => copyGalleryLink(selectedGallery.gallery_url)}
                              className="shrink-0 rounded-lg border border-[rgba(255,255,255,0.3)] px-4 py-2.5 text-sm font-medium text-[#F5FAF7] transition hover:border-[rgba(255,255,255,0.55)]"
                            >
                              {galleryCopied ? "Copied" : "Copy"}
                            </button>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2.5">
                            <a
                              href={`https://wa.me/?text=${encodeURIComponent(`Hi! Your private photo gallery is ready: ${selectedGallery.gallery_url}`)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-lg bg-[#C4EBDA] px-4 py-2.5 text-sm font-semibold text-[#0B3B34] transition hover:bg-[#AEE2CC]"
                            >
                              Send on WhatsApp
                            </a>
                            <a
                              href={selectedGallery.gallery_url}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-lg border border-[rgba(255,255,255,0.3)] px-4 py-2.5 text-sm font-medium text-[#F5FAF7] transition hover:border-[rgba(255,255,255,0.55)]"
                            >
                              Preview as couple
                            </a>
                          </div>
                        </>
                      )}

                      <form onSubmit={handleSavePasscode} className="mt-6">
                        <label
                          htmlFor="gallery-passcode"
                          className="text-[13px] font-medium text-[rgba(255,255,255,0.65)]"
                        >
                          Passcode (changing it signs the couple out immediately)
                        </label>
                        <div className="mt-1.5 flex gap-2">
                          <input
                            id="gallery-passcode"
                            value={passcodeInput}
                            onChange={(e) => setPasscodeInput(e.target.value)}
                            placeholder="Enter a new passcode"
                            autoComplete="off"
                            className="min-w-0 flex-1 rounded-lg border border-[rgba(255,255,255,0.25)] bg-transparent px-3.5 py-2.5 text-sm text-[#F5FAF7] outline-none transition placeholder:text-[rgba(255,255,255,0.4)] focus:border-[rgba(255,255,255,0.55)]"
                          />
                          <button
                            type="submit"
                            disabled={passcodeSaving || !passcodeInput.trim()}
                            className="shrink-0 rounded-lg bg-[#C4EBDA] px-4 py-2.5 text-sm font-semibold text-[#0B3B34] transition hover:bg-[#AEE2CC] disabled:opacity-50"
                          >
                            {passcodeSaving ? "…" : "Change"}
                          </button>
                        </div>
                        {passcodeNote ? (
                          <p className="mt-2 text-[13px] text-[#9ADBBE]">{passcodeNote}</p>
                        ) : (
                          <p className="mt-2 text-[13px] text-[rgba(255,255,255,0.55)]">
                            {selectedGallery.has_passcode
                              ? "Current passcode: ••••. Send it in a different message from the link."
                              : "No passcode yet — the gallery stays locked until you set one."}
                          </p>
                        )}
                      </form>
                    </div>

                    {/* QR stub */}
                    <div className="relative flex flex-col items-center border-t border-dashed border-[rgba(255,255,255,0.25)] px-6 py-6 sm:w-[248px] sm:shrink-0 sm:border-l sm:border-t-0 sm:py-7">
                      <span className="absolute -top-3 left-1/2 hidden h-6 w-6 -translate-x-1/2 rounded-full bg-[#EDF2EE] sm:block" />
                      <span className="absolute -bottom-3 left-1/2 hidden h-6 w-6 -translate-x-1/2 rounded-full bg-[#EDF2EE] sm:block" />
                      <span className="absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-[#EDF2EE] sm:hidden" />
                      <span className="absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-[#EDF2EE] sm:hidden" />
                      {selectedGallery.gallery_url ? (
                        <>
                          <img
                            src={galleryQrUrl(selectedGallery.slug)}
                            alt={`QR code for ${selectedGallery.name} gallery`}
                            className="h-40 w-40 rounded-xl bg-white p-2"
                            loading="lazy"
                          />
                          <a
                            href={galleryQrUrl(selectedGallery.slug)}
                            download={`${selectedGallery.slug}-gallery-qr.png`}
                            className="mt-4 rounded-lg border border-[rgba(255,255,255,0.3)] px-4 py-2 text-sm font-medium text-[#F5FAF7] transition hover:border-[rgba(255,255,255,0.55)]"
                          >
                            Download QR
                          </a>
                          <p className="mt-3 text-center text-[13px] leading-relaxed text-[rgba(255,255,255,0.6)]">
                            Couples can scan this instead of opening the link.
                          </p>
                        </>
                      ) : (
                        <p className="text-center text-[13px] text-[rgba(255,255,255,0.6)]">
                          Set a passcode to activate the link and QR code.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* photos & videos */}
                  <div className="mt-10">
                    <div className="flex items-baseline justify-between gap-3">
                      <h2 className="text-xl font-bold tracking-tight text-ink">
                        Photos &amp; videos
                      </h2>
                      <span className="text-sm text-inkdim">
                        {galleryMedia.length} item{galleryMedia.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="mt-4">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <label
                          htmlFor="gallery-folder-select"
                          className="text-sm font-medium text-ink"
                        >
                          Upload into folder
                        </label>
                        <select
                          id="gallery-folder-select"
                          value={galleryFolder}
                          onChange={(e) => setGalleryFolder(e.target.value)}
                          className="field px-3 py-2 text-sm"
                        >
                          {GALLERY_FOLDERS.map((f) => (
                            <option key={f} value={f}>
                              {f}
                            </option>
                          ))}
                        </select>
                        {galleryFolder === "Custom…" && (
                          <input
                            value={galleryFolderCustom}
                            onChange={(e) =>
                              setGalleryFolderCustom(e.target.value)
                            }
                            placeholder="Folder name, e.g. Bride Entry"
                            className="field px-3 py-2 text-sm"
                          />
                        )}
                      </div>
                      <UploadDropzone
                        onFiles={handleGalleryFiles}
                        accept="image/*,video/*"
                        label={galleryUploading ? "Uploading…" : "Drop files here or click to browse"}
                        hint="PNG, JPG, WEBP, GIF, or MP4, MOV, WEBM, M4V. Keep each video under 100 MB."
                      />
                      {galleryUploading && galleryProgress && (() => {
                        const p = galleryProgress;
                        const frac = p.total > 0 ? (p.done + (p.fileTotal > 0 ? p.loaded / p.fileTotal : 0)) / p.total : 0;
                        const pct = Math.min(100, Math.round(frac * 100));
                        return (
                          <div className="panel-inset mt-4 p-4">
                            <div className="flex items-baseline justify-between gap-2">
                              <p className="text-sm font-semibold text-ink">
                                {p.done} of {p.total} files uploaded
                              </p>
                              <p className="text-sm font-bold text-[#0F766E]">{pct}%</p>
                            </div>
                            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#17122e]/10">
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
                                onClick={cancelGalleryUpload}
                                className="btn-danger px-5 py-2 text-sm"
                              >
                                Cancel upload
                              </button>
                            </div>
                          </div>
                        );
                      })()}
                      {!galleryUploading && galleryNote && (
                        <p className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-center text-sm text-emerald-800">
                          {galleryNote}
                        </p>
                      )}
                    </div>

                    {galleryMedia.length > 1 && (
                      <div className="mt-5 flex flex-wrap gap-2">
                        {["All", ...galleryFoldersPresent].map((f) => (
                          <button
                            key={f}
                            type="button"
                            onClick={() => setGalleryFolderFilter(f)}
                            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                              activeFolderFilter === f
                                ? "bg-[#0B3B34] text-white"
                                : "bg-white text-ink ring-1 ring-[#17122e]/15 hover:bg-[#F5F1E8]"
                            }`}
                          >
                            {f} (
                            {f === "All"
                              ? galleryMedia.length
                              : galleryMedia.filter(
                                  (m) => (m.folder || "General") === f
                                ).length}
                            )
                          </button>
                        ))}
                      </div>
                    )}

                    {galleryLoading ? (
                      <p className="py-10 text-center text-sm text-inkdim">Loading…</p>
                    ) : galleryMedia.length === 0 ? (
                      <p className="py-10 text-center text-sm text-inkdim">
                        Nothing here yet — drop the couple&apos;s photos and videos above.
                      </p>
                    ) : (
                      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {visibleGalleryMedia.map((m) => (
                          <div
                            key={m.id}
                            className="group relative overflow-hidden rounded-xl ring-1 ring-[#17122e]/10"
                          >
                            {m.media_type === "video" ? (
                              <video
                                src={m.url}
                                poster={m.display_url}
                                preload="metadata"
                                muted
                                playsInline
                                className="aspect-video w-full object-cover"
                              />
                            ) : (
                              <img
                                src={m.display_url || m.url}
                                alt={m.filename}
                                className="aspect-square w-full object-cover"
                                loading="lazy"
                              />
                            )}
                            <span className="absolute left-2 top-2 rounded-md bg-black/70 px-2 py-0.5 text-xs font-medium text-white">
                              {m.media_type === "video" ? "Video" : "Photo"}
                            </span>
                            <button
                              onClick={() => handleDeleteGalleryItem(m)}
                              className="absolute right-2 top-2 rounded-md bg-black/70 px-2 py-1 text-xs font-medium text-white opacity-0 transition hover:bg-red-800 group-hover:opacity-100"
                              title="Delete from gallery"
                            >
                              Delete
                            </button>
                            <p className="truncate bg-[#17122e]/85 px-2 py-1 text-[11px] text-white/75">
                              {m.filename}
                              {m.folder ? ` · ${m.folder}` : ""}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* danger zone */}
                  <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-[#17122e]/10 pt-6">
                    <div className="min-w-0 max-w-xl">
                      <h2 className="font-semibold text-ink">Delete this gallery</h2>
                      <p className="mt-1 text-sm leading-relaxed text-inkdim">
                        Removes the gallery, passcode and media list. The link
                        and QR stop working. Your SnapFind events are not
                        affected.
                      </p>
                    </div>
                    <button
                      onClick={handleDeleteGallery}
                      className="shrink-0 rounded-lg border border-[rgba(185,28,28,0.35)] bg-white px-5 py-2.5 text-sm font-semibold text-[#B91C1C] transition hover:bg-[#FEF2F2]"
                    >
                      Delete gallery
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
          )}

          {tab === "users" && (
            <div className="panel mt-6 p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">User access control</h2>
                <button
                  onClick={refreshUsers}
                  className="btn-outline inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
                >
                  <IconRefresh size={13} /> Refresh
                </button>
              </div>
              <p className="mt-1 text-sm text-inkdim">
                {me?.is_owner ? (
                  <>
                    As the main admin you can promote guests to{" "}
                    <span className="font-medium text-[#0e7490]">admin</span>, remove admin
                    access, or grant/revoke sign-in access. Your own account
                    can&apos;t be changed by anyone.
                  </>
                ) : (
                  <>
                    You can promote guests to{" "}
                    <span className="font-medium text-[#0e7490]">admin</span> so they can
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
                          <tr key={u.id} className="border-t border-[#17122e]/[0.07]">
                            <td className="py-3 pr-4">
                              <p className="font-medium text-ink">
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
                              <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                                <span className={`h-1.5 w-1.5 rounded-full ${u.role === "admin" ? "bg-[#0e7490]" : "bg-[#17122e]/30"}`} />
                                {u.is_owner ? "Owner" : u.role === "admin" ? "Admin" : "Guest"}
                              </span>
                            </td>
                            <td className="py-3 pr-4">
                              <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                                <span className={`h-1.5 w-1.5 rounded-full ${u.is_active ? "bg-emerald-600" : "bg-red-600"}`} />
                                {u.is_active ? "Active" : "Disabled"}
                              </span>
                            </td>
                            <td className="py-3 text-right">
                              {u.id !== me?.id && !u.is_owner ? (
                                <div className="flex justify-end gap-2">
                                  {u.role !== "admin" ? (
                                    <button
                                      onClick={() => handleToggleRole(u)}
                                      className="rounded-md border border-[#0e7490]/40 px-3 py-1 text-xs font-medium text-[#0e7490] transition hover:bg-[#0e7490]/5"
                                    >
                                      Make admin
                                    </button>
                                  ) : (
                                    me?.is_owner && (
                                      <button
                                        onClick={() => handleToggleRole(u)}
                                        className="btn-outline px-3 py-1 text-xs"
                                      >
                                        Remove admin
                                      </button>
                                    )
                                  )}
                                  {me?.is_owner && (
                                    <button
                                      onClick={() => handleToggleActive(u)}
                                      className={`rounded-md border px-3 py-1 text-xs font-medium transition ${
                                        u.is_active
                                          ? "border-red-300 text-red-700 hover:bg-red-50"
                                          : "border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                                      }`}
                                    >
                                      {u.is_active ? "Revoke access" : "Grant access"}
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-inkdim">—</span>
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
