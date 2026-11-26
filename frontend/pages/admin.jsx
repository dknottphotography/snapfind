import { useEffect, useRef, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import Navbar from "../components/Navbar";
import UploadDropzone from "../components/UploadDropzone";
import { IconRefresh } from "../components/icons";
import {
  getToken,
  clearAuth,
  fetchMe,
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
} from "../lib/api";

// Photographer Studio — Ve.ai-style dark premium (same family as the
// rebuilt couple gallery and login). Explicit rgba colours throughout:
// the light-theme override in globals.css rewrites text-white /
// bg-white-* / border-white-* into faint dark tints, so those classes
// must never appear on this dark page.
const serif = { fontFamily: "'Instrument Serif', Georgia, 'Times New Roman', serif" };
const INK = "#0a0c10";
const PANEL = "#12151b";
const TEAL = "#0F766E";
const TEAL_BRIGHT = "#2DD4BF";
const GREEN = "#30a46c";
const PAPER = "#F5F2EC";
const MUTED = "#A8A29A";

// Shared dark styling (Tailwind arbitrary rgba values — never
// text-white / bg-white-* / border-white-*).
const fieldCls =
  "rounded-lg border border-[rgba(255,255,255,0.2)] bg-[rgba(255,255,255,0.06)] px-3.5 py-2.5 text-sm outline-none transition placeholder:text-[rgba(255,255,255,0.4)] focus:border-[rgba(255,255,255,0.55)]";
const btnTealCls =
  "rounded-lg px-4 py-2.5 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50";
const btnOutlineCls =
  "rounded-lg border border-[rgba(255,255,255,0.2)] px-4 py-2.5 text-sm font-medium transition hover:border-[rgba(255,255,255,0.45)]";
const panelStyle = { backgroundColor: PANEL, border: "1px solid rgba(255,255,255,0.1)" };

// Custom folder menu replacing the native <select>: a styled button +
// popover list in the site's own look, with keyboard support and
// close-on-outside-click. "Custom…" stays the last item, separated
// by a divider, and still reveals the custom-name input.
function FolderMenu({ value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const [focusIdx, setFocusIdx] = useState(0);
  const wrapRef = useRef(null);
  const buttonRef = useRef(null);
  const itemRefs = useRef([]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open ]);

  const openMenu = (idx) => {
    setFocusIdx(idx ?? options.indexOf(value));
    setOpen(true);
  };
  const choose = (opt) => {
    onChange(opt);
    setOpen(false);
    buttonRef.current?.focus();
  };
  const onButtonKeyDown = (e) => {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openMenu(e.key === "ArrowDown" ? 0 : undefined);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      openMenu(options.length - 1);
    }
  };
  const onItemKeyDown = (e, idx) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = (idx + 1) % options.length;
      setFocusIdx(next);
      itemRefs.current[next]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = (idx - 1 + options.length) % options.length;
      setFocusIdx(prev);
      itemRefs.current[prev]?.focus();
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(options[idx]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        ref={buttonRef}
        id="gallery-folder-menu-button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onButtonKeyDown}
        className="flex min-w-[11rem] items-center justify-between gap-3 rounded-lg border border-[rgba(255,255,255,0.2)] bg-[rgba(255,255,255,0.06)] px-3 py-2 text-sm"
        style={{ color: PAPER }}
      >
        <span className="font-medium">{value}</span>
        <span
          aria-hidden="true"
          className={`text-xs transition-transform ${open ? "rotate-180" : ""}`}
          style={{ color: MUTED }}
        >
          ▾
        </span>
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label="Upload into folder"
          className="absolute left-0 z-30 mt-1 max-h-72 w-full min-w-[11rem] overflow-auto rounded-xl border border-[rgba(255,255,255,0.12)] py-1 shadow-xl"
          style={{ backgroundColor: PANEL }}
        >
          {options.map((opt, idx) => (
            <li
              key={opt}
              role="presentation"
              className={opt === "Custom…" ? "border-t border-[rgba(255,255,255,0.1)]" : ""}
            >
              <button
                type="button"
                role="option"
                aria-selected={opt === value}
                ref={(el) => (itemRefs.current[idx] = el)}
                onClick={() => choose(opt)}
                onKeyDown={(e) => onItemKeyDown(e, idx)}
                onMouseEnter={() => setFocusIdx(idx)}
                className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition ${
                  opt === value ? "font-semibold" : ""
                }`}
                style={{
                  color: opt === value ? TEAL_BRIGHT : PAPER,
                  backgroundColor:
                    focusIdx === idx ? "rgba(255,255,255,0.06)" : "transparent",
                }}
              >
                <span>{opt}</span>
                {opt === value && <span aria-hidden="true">✓</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [notAdmin, setNotAdmin] = useState(false);

  const [error, setError] = useState("");

  const [tab, setTab] = useState("gallery"); // gallery | users
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
  // Standalone galleries: own list + own selection.
  const [galleries, setGalleries] = useState([]);
  const [selectedGalleryId, setSelectedGalleryId] = useState(null);
  const [newGalleryName, setNewGalleryName] = useState("");
  const [galleryCreating, setGalleryCreating] = useState(false);

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
        }
        setAuthChecked(true);
      })
      .catch(() => {
        clearAuth();
        router.replace("/login");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // ---- couple's galleries ----
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
    if (!/^\d{4}$/.test(passcodeInput.trim())) {
      setError("The PIN must be exactly 4 digits.");
      return;
    }
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
          ? "PIN saved — send it to the couple in a separate message from the link."
          : "PIN removed — the gallery stays locked until a new one is set."
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
          ? `Make ${u.name} (${u.email}) an admin? They'll be able to manage galleries and users.`
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

  if (!authChecked) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ backgroundColor: INK, color: MUTED }}
      >
        Loading…
      </div>
    );
  }

  if (notAdmin) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: INK, color: PAPER }}>
        <Navbar />
        <div className="mx-auto max-w-xl px-4 py-24 text-center">
          <h1 style={serif} className="text-4xl font-normal">Admins only</h1>
          <p className="mt-3 text-sm leading-relaxed" style={{ color: MUTED }}>
            This studio panel is for photographer accounts. The couple&apos;s
            gallery is waiting for you instead.
          </p>
          <button
            onClick={() => router.push("/couple-gallery")}
            className={btnTealCls + " mt-6 px-6 py-2.5"}
            style={{ backgroundColor: TEAL, color: "#ffffff" }}
          >
            Go to the couple&apos;s gallery
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Photographer Studio — Moments</title>
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap"
          rel="stylesheet"
        />
      </Head>
      <div className="min-h-screen" style={{ backgroundColor: INK, color: PAPER }}>
        <Navbar />

        <main className="relative z-10 mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 style={serif} className="text-4xl font-normal leading-tight">
                Photographer Studio
              </h1>
              <p className="mt-1.5 text-sm" style={{ color: MUTED }}>
                Signed in as {me?.name}. Create private galleries, set PINs and share links.
              </p>
            </div>
          </div>

          <div className="mt-8 flex gap-7 border-b border-[rgba(255,255,255,0.1)]">
            {[
              { id: "gallery", label: "Couple's galleries" },
              { id: "users", label: "Users" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`-mb-px border-b-2 px-0.5 pb-3 text-sm transition ${
                  tab === t.id ? "font-semibold" : "font-medium"
                }`}
                style={{
                  borderColor: tab === t.id ? TEAL : "transparent",
                  color: tab === t.id ? PAPER : MUTED,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
              {error}
            </div>
          )}

          {tab === "gallery" && (
          <div className="mt-8 grid items-start gap-8 lg:grid-cols-[250px_1fr]">
            {/* ------- LEFT RAIL: gallery list + create ------- */}
            <div>
              <p className="text-[13px] font-semibold" style={{ color: PAPER }}>Your galleries</p>
              <div className="mt-3 space-y-1">
                {galleries.length === 0 && (
                  <p className="text-sm leading-relaxed" style={{ color: MUTED }}>
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
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition"
                    style={{
                      borderLeft: `3px solid ${g.id === selectedGalleryId ? TEAL : "transparent"}`,
                      backgroundColor:
                        g.id === selectedGalleryId ? "rgba(255,255,255,0.06)" : "transparent",
                      color: g.id === selectedGalleryId ? PAPER : MUTED,
                      fontWeight: g.id === selectedGalleryId ? 600 : 400,
                    }}
                  >
                    <span className="min-w-0 truncate">{g.name}</span>
                    <span className="shrink-0 text-xs font-normal" style={{ color: MUTED }}>
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
                  className={`${fieldCls} min-w-0 flex-1 px-3 py-2.5`}
                  style={{ color: PAPER }}
                />
                <button
                  type="submit"
                  disabled={galleryCreating || !newGalleryName.trim()}
                  className={`${btnTealCls} shrink-0 px-4 py-2.5`}
                  style={{ backgroundColor: TEAL, color: "#ffffff" }}
                >
                  {galleryCreating ? "…" : "Create"}
                </button>
              </form>
              <p className="mt-3 text-xs leading-relaxed" style={{ color: MUTED }}>
                A private, passcode-protected gallery for the couple.
                Files are stored permanently on Cloudinary.
              </p>
            </div>

            {/* ------- RIGHT: ticket card + media + danger ------- */}
            <div className="min-w-0">
              {!selectedGallery && (
                <div className="rounded-2xl p-8 text-center" style={panelStyle}>
                  <p className="text-sm" style={{ color: MUTED }}>
                    {galleries.length === 0
                      ? "Create a gallery to get its share link and QR code."
                      : "Select a gallery from the list to manage its link, passcode and photos."}
                  </p>
                </div>
              )}

              {selectedGallery && (
                <>
                  {/* ticket card — dark premium: deep panel, paper text,
                      teal accents, same ticket shape (notches + dashed stub) */}
                  <div
                    className="flex flex-col overflow-visible rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.4)] sm:flex-row"
                    style={panelStyle}
                  >
                    <div className="min-w-0 flex-1 p-6 sm:p-7">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                        <h2 style={serif} className="text-[28px] font-normal leading-tight">
                          {selectedGallery.name}
                        </h2>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                        {selectedGallery.has_passcode ? (
                          <span
                            className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                            style={{ backgroundColor: "rgba(48,164,108,0.15)", color: "#4ade80" }}
                          >
                            PIN set
                          </span>
                        ) : (
                          <span
                            className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                            style={{ backgroundColor: "rgba(245,158,11,0.15)", color: "#fbbf24" }}
                          >
                            No PIN yet
                          </span>
                        )}
                        <span className="text-[13px]" style={{ color: MUTED }}>
                          {galleryMedia.length} file{galleryMedia.length === 1 ? "" : "s"} on Cloudinary
                        </span>
                      </div>

                      {selectedGallery.gallery_url && (
                        <>
                          <p className="mt-6 text-[13px] font-medium" style={{ color: MUTED }}>
                            Gallery link
                          </p>
                          <div className="mt-1.5 flex gap-2">
                            <p className="min-w-0 flex-1 truncate rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] px-3.5 py-2.5 text-sm" style={{ color: PAPER }}>
                              {selectedGallery.gallery_url}
                            </p>
                            <button
                              onClick={() => copyGalleryLink(selectedGallery.gallery_url)}
                              className={`${btnOutlineCls} shrink-0 px-4 py-2.5`}
                              style={{ color: PAPER }}
                            >
                              {galleryCopied ? "Copied" : "Copy"}
                            </button>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2.5">
                            <a
                              href={`https://wa.me/?text=${encodeURIComponent(`Hi! Your private photo gallery is ready: ${selectedGallery.gallery_url}`)}`}
                              target="_blank"
                              rel="noreferrer"
                              className={`${btnTealCls} px-4 py-2.5`}
                              style={{ backgroundColor: TEAL, color: "#ffffff" }}
                            >
                              Send on WhatsApp
                            </a>
                            <a
                              href={selectedGallery.gallery_url}
                              target="_blank"
                              rel="noreferrer"
                              className={`${btnOutlineCls} px-4 py-2.5`}
                              style={{ color: PAPER }}
                            >
                              Preview as couple
                            </a>
                          </div>
                        </>
                      )}

                      <form onSubmit={handleSavePasscode} className="mt-6">
                        <label
                          htmlFor="gallery-passcode"
                          className="text-[13px] font-medium"
                          style={{ color: MUTED }}
                        >
                          Gallery PIN — 4 digits (changing it signs the couple
                          out immediately)
                        </label>
                        <div className="mt-1.5 flex gap-2">
                          <input
                            id="gallery-passcode"
                            value={passcodeInput}
                            onChange={(e) =>
                              setPasscodeInput(
                                e.target.value.replace(/\D/g, "").slice(0, 4)
                              )
                            }
                            placeholder="4-digit PIN, e.g. 2580"
                            inputMode="numeric"
                            maxLength={4}
                            autoComplete="off"
                            className={`${fieldCls} min-w-0 flex-1 tracking-[0.3em]`}
                            style={{ color: PAPER }}
                          />
                          <button
                            type="submit"
                            disabled={passcodeSaving || !passcodeInput.trim()}
                            className={`${btnTealCls} shrink-0 px-4 py-2.5`}
                            style={{ backgroundColor: TEAL, color: "#ffffff" }}
                          >
                            {passcodeSaving ? "…" : "Change"}
                          </button>
                        </div>
                        {passcodeNote ? (
                          <p className="mt-2 text-[13px]" style={{ color: TEAL_BRIGHT }}>{passcodeNote}</p>
                        ) : (
                          <p className="mt-2 text-[13px]" style={{ color: MUTED }}>
                            {selectedGallery.has_passcode
                              ? "Current PIN: ••••. Send it in a different message from the link."
                              : "No PIN yet — the gallery stays locked until you set one."}
                          </p>
                        )}
                      </form>
                    </div>

                    {/* QR stub */}
                    <div className="relative flex flex-col items-center border-t border-dashed border-[rgba(255,255,255,0.15)] px-6 py-6 sm:w-[248px] sm:shrink-0 sm:border-l sm:border-t-0 sm:py-7">
                      <span className="absolute -top-3 left-1/2 hidden h-6 w-6 -translate-x-1/2 rounded-full sm:block" style={{ backgroundColor: INK }} />
                      <span className="absolute -bottom-3 left-1/2 hidden h-6 w-6 -translate-x-1/2 rounded-full sm:block" style={{ backgroundColor: INK }} />
                      <span className="absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full sm:hidden" style={{ backgroundColor: INK }} />
                      <span className="absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full sm:hidden" style={{ backgroundColor: INK }} />
                      {selectedGallery.gallery_url ? (
                        <>
                          <img
                            src={galleryQrUrl(selectedGallery.slug)}
                            alt={`QR code for ${selectedGallery.name} gallery`}
                            className="h-40 w-40 rounded-xl border border-[rgba(255,255,255,0.1)] p-2"
                            style={{ backgroundColor: "#ffffff" }}
                            loading="lazy"
                          />
                          <a
                            href={galleryQrUrl(selectedGallery.slug)}
                            download={`${selectedGallery.slug}-gallery-qr.png`}
                            className={`${btnOutlineCls} mt-4 px-4 py-2`}
                            style={{ color: PAPER }}
                          >
                            Download QR
                          </a>
                          <p className="mt-3 text-center text-[13px] leading-relaxed" style={{ color: MUTED }}>
                            Couples can scan this instead of opening the link.
                          </p>
                        </>
                      ) : (
                        <p className="text-center text-[13px]" style={{ color: MUTED }}>
                          Set a passcode to activate the link and QR code.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* photos & videos */}
                  <div className="mt-10">
                    <div className="flex items-baseline justify-between gap-3">
                      <h2 style={serif} className="text-2xl font-normal tracking-tight">
                        Photos &amp; videos
                      </h2>
                      <span className="text-sm" style={{ color: MUTED }}>
                        {galleryMedia.length} item{galleryMedia.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="mt-4">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <label
                          htmlFor="gallery-folder-menu-button"
                          className="text-sm font-medium"
                          style={{ color: PAPER }}
                        >
                          Upload into folder
                        </label>
                        <FolderMenu
                          value={galleryFolder}
                          options={GALLERY_FOLDERS}
                          onChange={setGalleryFolder}
                        />
                        {galleryFolder === "Custom…" && (
                          <input
                            value={galleryFolderCustom}
                            onChange={(e) =>
                              setGalleryFolderCustom(e.target.value)
                            }
                            placeholder="Folder name, e.g. Bride Entry"
                            className={`${fieldCls} px-3 py-2`}
                            style={{ color: PAPER }}
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
                          <div className="mt-4 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-4">
                            <div className="flex items-baseline justify-between gap-2">
                              <p className="text-sm font-semibold" style={{ color: PAPER }}>
                                {p.done} of {p.total} files uploaded
                              </p>
                              <p className="text-sm font-bold" style={{ color: TEAL_BRIGHT }}>{pct}%</p>
                            </div>
                            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[rgba(255,255,255,0.1)]">
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
                              <p className="mt-2 truncate text-center text-xs" style={{ color: MUTED }}>
                                Uploading: {p.fileName}
                              </p>
                            )}
                            <div className="mt-3 flex justify-center">
                              <button
                                type="button"
                                onClick={cancelGalleryUpload}
                                className="rounded-lg border border-[rgba(185,28,28,0.5)] bg-[rgba(185,28,28,0.12)] px-5 py-2 text-sm font-semibold text-[#f87171] transition hover:bg-[rgba(185,28,28,0.2)]"
                              >
                                Cancel upload
                              </button>
                            </div>
                          </div>
                        );
                      })()}
                      {!galleryUploading && galleryNote && (
                        <p className="mt-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-center text-sm text-emerald-300">
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
                            className="rounded-full px-3.5 py-1.5 text-xs font-semibold transition"
                            style={
                              activeFolderFilter === f
                                ? { backgroundColor: TEAL, color: "#ffffff" }
                                : {
                                    backgroundColor: "rgba(255,255,255,0.06)",
                                    color: PAPER,
                                    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.15)",
                                  }
                            }
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
                      <p className="py-10 text-center text-sm" style={{ color: MUTED }}>Loading…</p>
                    ) : galleryMedia.length === 0 ? (
                      <p className="py-10 text-center text-sm" style={{ color: MUTED }}>
                        Nothing here yet — drop the couple&apos;s photos and videos above.
                      </p>
                    ) : (
                      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {visibleGalleryMedia.map((m) => (
                          <div
                            key={m.id}
                            className="group relative overflow-hidden rounded-xl ring-1 ring-[rgba(255,255,255,0.1)]"
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
                              className="absolute right-2 top-2 rounded-md bg-black/70 px-2 py-1 text-xs font-medium text-white opacity-0 transition hover:bg-red-800 group-hover:opacity-100 max-sm:opacity-100 focus-visible:opacity-100"
                              title="Delete from gallery"
                            >
                              Delete
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* danger zone */}
                  <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-[rgba(255,255,255,0.1)] pt-6">
                    <div className="min-w-0 max-w-xl">
                      <h2 className="font-semibold" style={{ color: PAPER }}>Delete this gallery</h2>
                      <p className="mt-1 text-sm leading-relaxed" style={{ color: MUTED }}>
                        Removes the gallery, passcode and media list. The link
                        and QR stop working.
                      </p>
                    </div>
                    <button
                      onClick={handleDeleteGallery}
                      className="shrink-0 rounded-lg border border-[rgba(185,28,28,0.5)] bg-[rgba(185,28,28,0.12)] px-5 py-2.5 text-sm font-semibold text-[#f87171] transition hover:bg-[rgba(185,28,28,0.2)]"
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
            <div className="mt-6 rounded-2xl p-6" style={panelStyle}>
              <div className="flex items-center justify-between">
                <h2 className="font-semibold" style={{ color: PAPER }}>User access control</h2>
                <button
                  onClick={refreshUsers}
                  className={`${btnOutlineCls} inline-flex items-center gap-1.5 px-3 py-1.5 text-xs`}
                  style={{ color: PAPER }}
                >
                  <IconRefresh size={13} /> Refresh
                </button>
              </div>
              <p className="mt-1 text-sm" style={{ color: MUTED }}>
                {me?.is_owner ? (
                  <>
                    As the main admin you can promote guests to{" "}
                    <span className="font-medium" style={{ color: TEAL_BRIGHT }}>admin</span>, remove admin
                    access, or grant/revoke sign-in access. Your own account
                    can&apos;t be changed by anyone.
                  </>
                ) : (
                  <>
                    You can promote guests to{" "}
                    <span className="font-medium" style={{ color: TEAL_BRIGHT }}>admin</span> so they can
                    manage galleries from their own accounts. Only the main admin can
                    remove access or revoke accounts.
                  </>
                )}
              </p>
              <div className="mt-4">
                {usersLoading ? (
                  <p className="py-8 text-center text-sm" style={{ color: MUTED }}>
                    Loading users…
                  </p>
                ) : users.length === 0 ? (
                  <p className="py-8 text-center text-sm" style={{ color: MUTED }}>
                    No users yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="text-xs uppercase tracking-wide" style={{ color: MUTED }}>
                          <th className="pb-2 pr-4 font-medium">User</th>
                          <th className="pb-2 pr-4 font-medium">Role</th>
                          <th className="pb-2 pr-4 font-medium">Status</th>
                          <th className="pb-2 text-right font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((u) => (
                          <tr key={u.id} className="border-t border-[rgba(255,255,255,0.08)]">
                            <td className="py-3 pr-4">
                              <p className="font-medium" style={{ color: PAPER }}>
                                {u.name}{" "}
                                {u.id === me?.id && (
                                  <span className="text-xs font-normal" style={{ color: MUTED }}>
                                    (you)
                                  </span>
                                )}
                              </p>
                              <p className="text-xs" style={{ color: MUTED }}>{u.email}</p>
                            </td>
                            <td className="py-3 pr-4">
                              <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: PAPER }}>
                                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: u.role === "admin" ? TEAL_BRIGHT : "rgba(255,255,255,0.3)" }} />
                                {u.is_owner ? "Owner" : u.role === "admin" ? "Admin" : "Guest"}
                              </span>
                            </td>
                            <td className="py-3 pr-4">
                              <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: PAPER }}>
                                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: u.is_active ? "#22c55e" : "#ef4444" }} />
                                {u.is_active ? "Active" : "Disabled"}
                              </span>
                            </td>
                            <td className="py-3 text-right">
                              {u.id !== me?.id && !u.is_owner ? (
                                <div className="flex justify-end gap-2">
                                  {u.role !== "admin" ? (
                                    <button
                                      onClick={() => handleToggleRole(u)}
                                      className="rounded-md border border-[rgba(45,212,191,0.4)] px-3 py-1 text-xs font-medium text-[#2DD4BF] transition hover:bg-[rgba(45,212,191,0.08)]"
                                    >
                                      Make admin
                                    </button>
                                  ) : (
                                    me?.is_owner && (
                                      <button
                                        onClick={() => handleToggleRole(u)}
                                        className={`${btnOutlineCls} px-3 py-1 text-xs`}
                                        style={{ color: PAPER }}
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
                                          ? "border-[rgba(239,68,68,0.4)] text-[#f87171] hover:bg-[rgba(239,68,68,0.1)]"
                                          : "border-[rgba(74,222,128,0.4)] text-[#4ade80] hover:bg-[rgba(74,222,128,0.1)]"
                                      }`}
                                    >
                                      {u.is_active ? "Revoke access" : "Grant access"}
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs" style={{ color: MUTED }}>—</span>
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
      </div>
    </>
  );
}
