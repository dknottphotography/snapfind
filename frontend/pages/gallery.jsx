import { useEffect, useRef, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import Navbar from "../components/Navbar";
import Lightbox from "../components/Lightbox";
import AmbientAbyss from "../components/AmbientAbyss";
import {
  getToken,
  clearAuth,
  fetchMe,
  getEventPublic,
  getMatches,
  uploadSelfie,
  deleteGuestPhoto,
  downloadPhotoBlob,
  resolveUrl,
} from "../lib/api";

export default function GalleryPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  // ---- STEP 1: event ----
  const [eventSlug, setEventSlug] = useState("");
  const [eventValid, setEventValid] = useState(null); // event object once verified
  const [validatingEvent, setValidatingEvent] = useState(false);
  const [eventError, setEventError] = useState("");

  // ---- STEP 2: selfie ----
  const [uploadingSelfie, setUploadingSelfie] = useState(false);
  const [selfieStatus, setSelfieStatus] = useState("");
  const [showRetake, setShowRetake] = useState(false);

  // ---- STEP 3: matches ----
  const [matches, setMatches] = useState([]);
  const [searched, setSearched] = useState(false);
  const [searchedSlug, setSearchedSlug] = useState("");
  const [loading, setLoading] = useState(false);

  const [lightboxPhoto, setLightboxPhoto] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  // ---- in-page selfie camera ----
  const [showCamera, setShowCamera] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // ---- QR scanner ----
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [qrError, setQrError] = useState("");
  const qrScannerRef = useRef(null);

  const stopCamera = () => {
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    } catch {
      /* ignore */
    }
    streamRef.current = null;
  };

  const openCamera = async () => {
    setCameraError("");
    setShowCamera(true);
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err) {
      console.error("Camera failed:", err);
      setCameraError(
        "Couldn't access your camera. Check the browser permission, or upload a photo from your gallery instead."
      );
    }
  };

  const closeCamera = () => {
    stopCamera();
    setShowCamera(false);
    setCameraError("");
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        closeCamera();
        if (blob) {
          handleSelfieUpload(
            new File([blob], "selfie.jpg", { type: "image/jpeg" })
          );
        }
      },
      "image/jpeg",
      0.92
    );
  };

  useEffect(() => () => stopCamera(), []);

  // ---- STEP 1: verify the event exists before anything else ----
  const validateEvent = async (slug, afterUser) => {
    const s = (slug || "").trim().toLowerCase();
    if (!s) return;
    setValidatingEvent(true);
    setEventError("");
    setError("");
    try {
      const data = await getEventPublic(s);
      setEventValid(data.event);
      try {
        localStorage.setItem("eventSlug", s);
      } catch {
        /* ignore */
      }
      // If the user already has a Face ID, jump straight to their photos.
      const me = afterUser || user;
      if (me?.has_selfie) {
        await fetchMatches(s);
      }
    } catch (err) {
      setEventValid(null);
      setEventError("Event not found — check the code and try again.");
    } finally {
      setValidatingEvent(false);
    }
  };

  const handleFindEvent = (e) => {
    e.preventDefault();
    validateEvent(eventSlug);
  };

  // ---- QR scanning ----
  const extractSlug = (text) => {
    const t = (text || "").trim();
    if (!t) return null;
    try {
      const url = new URL(t);
      const s = url.searchParams.get("event");
      if (s) return s;
    } catch {
      /* not a URL — maybe a raw slug */
    }
    if (/^[a-z0-9-]{2,60}$/i.test(t)) return t.toLowerCase();
    return null;
  };

  const stopQrScan = async () => {
    try {
      await qrScannerRef.current?.stop();
    } catch {
      /* ignore */
    }
    try {
      qrScannerRef.current?.clear();
    } catch {
      /* ignore */
    }
    qrScannerRef.current = null;
    setShowQrScanner(false);
  };

  const startQrScan = async () => {
    setQrError("");
    setShowQrScanner(true);
    // Wait a tick for the reader div to mount.
    setTimeout(async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        const scanner = new Html5Qrcode("qr-reader");
        qrScannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            const slug = extractSlug(decodedText);
            if (slug) {
              setEventSlug(slug);
              stopQrScan();
              validateEvent(slug);
            }
          },
          () => {
            /* per-frame decode misses are normal — ignore */
          }
        );
      } catch (err) {
        console.error("QR scanner failed:", err);
        setQrError(
          "Couldn't start the camera. Check the browser permission, or type the event code instead."
        );
      }
    }, 150);
  };

  useEffect(() => () => stopQrScan(), []);

  // ---- STEP 3: matches ----
  const fetchMatches = async (slug) => {
    if (!slug.trim()) return;
    setLoading(true);
    setError("");
    setSearched(true);
    setSearchedSlug(slug.trim());
    try {
      const data = await getMatches(slug.trim());
      setMatches(data.matches || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    if (eventValid) fetchMatches(eventValid.slug);
  };

  // ---- auth guard + restore last event ----
  useEffect(() => {
    const t = getToken();
    if (!t) {
      router.replace("/login");
      return;
    }
    let savedSlug = "";
    try {
      savedSlug = localStorage.getItem("eventSlug") || "";
    } catch {
      /* ignore */
    }
    if (savedSlug) setEventSlug(savedSlug);
    fetchMe()
      .then((data) => {
        setUser(data.user);
        try {
          localStorage.setItem("user", JSON.stringify(data.user));
        } catch {
          /* ignore */
        }
        if (savedSlug) {
          validateEvent(savedSlug, data.user);
        }
        setAuthChecked(true);
      })
      .catch(() => {
        clearAuth();
        router.replace("/login");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelfieUpload = async (file) => {
    if (!file || uploadingSelfie) return;
    setUploadingSelfie(true);
    setError("");
    try {
      const { loadFaceModels, getSelfieDescriptor } = await import(
        "../lib/faceai"
      );
      setSelfieStatus("Loading face AI…");
      await loadFaceModels();
      setSelfieStatus("Scanning your selfie…");
      const descriptor = await getSelfieDescriptor(file);
      if (!descriptor) {
        throw new Error(
          "No face detected in that selfie. Try a clearer, front-facing photo."
        );
      }
      setSelfieStatus("Finding your photos…");
      const data = await uploadSelfie(file, descriptor);
      const updated = data.user || user;
      setUser({ ...user, ...updated, has_selfie: true });
      try {
        localStorage.setItem(
          "user",
          JSON.stringify({ ...user, ...updated, has_selfie: true })
        );
      } catch {
        /* ignore */
      }
      if (eventValid) await fetchMatches(eventValid.slug);
      setShowRetake(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingSelfie(false);
      setSelfieStatus("");
    }
  };

  const handleDownload = async (photo) => {
    setDownloading(true);
    try {
      const blob = await downloadPhotoBlob(photo.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = photo.filename || `snapfind-${photo.id}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloading(false);
    }
  };

  const handleDelete = async (photo) => {
    setDeleting(true);
    try {
      await deleteGuestPhoto(photo.id);
      setMatches((prev) => prev.filter((m) => m.id !== photo.id));
      setLightboxPhoto(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-inkdim">
        Loading…
      </div>
    );
  }

  const resultsCurrent =
    searched && searchedSlug && eventValid && eventValid.slug === searchedSlug;

  return (
    <>
      <Head>
        <title>My Gallery — SnapFind</title>
      </Head>
      <div className="min-h-screen bg-abyss text-ink">
        <AmbientAbyss />
        <Navbar />

        <main className="relative z-10 mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <h1 className="font-display text-3xl font-bold">My Gallery <span className="text-bio-cyan">✦</span></h1>
          <p className="mt-1 text-sm text-inkdim">
            Hi {user?.name} — find the photos you&apos;re in with your Face ID.
          </p>

          {error && (
            <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* ---- STEP 1: find the event ---- */}
          <div className="mt-6 glass rounded-2xl p-6">
            <h2 className="font-display text-lg font-semibold">
              <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-bio-teal to-uv-magenta text-xs font-bold">
                1
              </span>
              Find your event
            </h2>
            <form onSubmit={handleFindEvent} className="mt-3 flex gap-2">
              <input
                value={eventSlug}
                onChange={(e) => {
                  setEventSlug(e.target.value);
                  setEventValid(null);
                  setEventError("");
                }}
                placeholder="e.g. ananyas-wedding"
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-abyss/60 px-4 py-2.5 text-sm text-ink outline-none transition focus:border-bio-cyan"
              />
              <button
                type="button"
                onClick={startQrScan}
                className="shrink-0 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-white/20"
                title="Scan the event QR code"
              >
                📷 Scan QR
              </button>
              <button
                type="submit"
                disabled={validatingEvent || !eventSlug.trim()}
                className="shrink-0 rounded-xl btn-bio rounded-xl px-5 py-2.5 text-sm disabled:opacity-50"
              >
                {validatingEvent ? "Checking…" : "Find event"}
              </button>
            </form>
            {eventError && (
              <p className="mt-2 text-sm text-red-300">{eventError}</p>
            )}
            {eventValid && (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-emerald-500/10 px-4 py-2.5 ring-1 ring-emerald-500/20">
                <p className="text-sm text-emerald-300">
                  ✅ <span className="font-semibold">{eventValid.name}</span>
                  <span className="text-emerald-400/70">
                    {" "}
                    · {eventValid.photo_count} photos
                  </span>
                </p>
                <button
                  onClick={handleRefresh}
                  disabled={loading}
                  className="shrink-0 text-xs text-inkdim underline hover:text-ink disabled:opacity-50"
                >
                  ⟳ Refresh results
                </button>
              </div>
            )}
          </div>

          {/* ---- STEP 2: selfie check-in (only after the event is found) ---- */}
          {eventValid &&
            (user && user.has_selfie && !showRetake ? (
              <div className="mt-4 flex items-center gap-4 rounded-2xl bg-emerald-500/10 p-4 ring-1 ring-emerald-500/20">
                {user.selfie_url && (
                  <img
                    src={resolveUrl(user.selfie_url)}
                    alt="Your Face ID"
                    className="h-14 w-14 rounded-full object-cover ring-2 ring-emerald-500/40"
                  />
                )}
                <div className="flex-1">
                  <p className="text-sm font-semibold text-emerald-300">
                    ✅ Face ID verified
                  </p>
                  <p className="text-xs text-inkdim">
                    Your face is registered — AI matching is active for every
                    event you join. Not finding yourself? Try a clearer selfie.
                  </p>
                </div>
                <button
                  onClick={() => setShowRetake(true)}
                  className="shrink-0 rounded-xl bg-white/10 px-4 py-2 text-xs font-medium text-ink hover:bg-white/15"
                >
                  Retake
                </button>
              </div>
            ) : (
              user &&
              (!user.has_selfie || showRetake) && (
                <div className="mt-4 glass rounded-2xl p-6">
                  <h2 className="font-display text-lg font-semibold">
                    <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-bio-teal to-uv-magenta text-xs font-bold">
                      2
                    </span>
                    Check in with a selfie 🤳
                  </h2>
                  <p className="mt-1 text-sm text-inkdim">
                    Upload one clear, front-facing selfie. Our AI uses it as
                    your Face ID to find your photos.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={openCamera}
                      disabled={uploadingSelfie}
                      className="rounded-xl btn-bio rounded-xl px-5 py-2 text-sm disabled:opacity-50"
                    >
                      📸 Take selfie
                    </button>
                    <input
                      type="file"
                      accept="image/*"
                      disabled={uploadingSelfie}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleSelfieUpload(f);
                        e.target.value = "";
                      }}
                      className="text-sm text-inkdim file:mr-3 file:rounded-xl file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-white/20 disabled:opacity-50"
                    />
                  </div>
                  {uploadingSelfie && (
                    <p className="mt-3 text-sm font-medium text-fuchsia-300">
                      {selfieStatus || "Scanning face…"} 🧠
                    </p>
                  )}
                  {showRetake && (
                    <button
                      onClick={() => {
                        setShowRetake(false);
                      }}
                      className="mt-3 text-xs text-inkdim underline hover:text-inkdim"
                    >
                      Cancel retake
                    </button>
                  )}
                </div>
              )
            ))}

          {/* ---- STEP 3: matches (only after event + selfie) ---- */}
          {eventValid && user?.has_selfie && (
            <div className="mt-4 glass rounded-2xl p-6">
              <h2 className="font-display text-lg font-semibold">
                <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-bio-teal to-uv-magenta text-xs font-bold">
                  3
                </span>
                Your matched photos
                {resultsCurrent && matches.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-inkdim">
                    {matches.length} found
                  </span>
                )}
              </h2>

              {loading ? (
                <p className="py-10 text-center text-sm text-inkdim">
                  Scanning photos for your face… 🧠
                </p>
              ) : !resultsCurrent ? (
                <p className="py-10 text-center text-sm text-inkdim">
                  Searching your photos… 🔍
                </p>
              ) : matches.length === 0 ? (
                <div className="py-10 text-center">
                  <div className="text-4xl">🕵️</div>
                  <p className="mt-3 text-sm text-inkdim">
                    No matches yet — try a clearer, front-facing selfie.
                  </p>
                </div>
              ) : (
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {matches.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setLightboxPhoto(m)}
                      className="group relative overflow-hidden rounded-xl text-left ring-1 ring-white/10 transition hover:ring-fuchsia-500/50"
                    >
                      <img
                        src={resolveUrl(m.url)}
                        alt={m.filename}
                        className="aspect-square w-full object-cover"
                        loading="lazy"
                      />
                      <span className="absolute left-2 top-2 rounded-full bg-emerald-500/90 px-2 py-0.5 text-xs font-semibold text-white">
                        {Math.round(m.score ?? 0)}% match
                      </span>
                      <span className="absolute inset-x-0 bottom-0 bg-black/60 px-2 py-1 text-[11px] text-inkdim opacity-0 transition group-hover:opacity-100">
                        Click to view ⤢
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>

        <Lightbox
          photo={lightboxPhoto}
          onClose={() => setLightboxPhoto(null)}
          onDownload={handleDownload}
          onDelete={handleDelete}
          deleting={deleting || downloading}
        />

        {/* ---- In-page selfie camera ---- */}
        {showCamera && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
            <div className="glass-deep w-full max-w-md overflow-hidden rounded-2xl">
              <div className="flex items-center justify-between px-4 py-3">
                <h3 className="font-semibold text-white">Take your selfie</h3>
                <button
                  onClick={closeCamera}
                  className="rounded-lg bg-white/10 px-3 py-1 text-sm text-inkdim hover:bg-white/20"
                >
                  ✕ Close
                </button>
              </div>
              {cameraError ? (
                <div className="px-4 pb-5">
                  <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300 ring-1 ring-red-500/30">
                    {cameraError}
                  </p>
                </div>
              ) : (
                <>
                  <div className="relative bg-black">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="h-80 w-full -scale-x-100 object-cover"
                    />
                  </div>
                  <div className="flex items-center justify-center gap-3 px-4 py-4">
                    <button
                      onClick={capturePhoto}
                      className="rounded-full btn-bio rounded-full px-8 py-3 font-semibold"
                    >
                      📷 Capture
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ---- QR scanner ---- */}
        {showQrScanner && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
            <div className="glass-deep w-full max-w-md overflow-hidden rounded-2xl">
              <div className="flex items-center justify-between px-4 py-3">
                <h3 className="font-semibold text-white">Scan event QR</h3>
                <button
                  onClick={stopQrScan}
                  className="rounded-lg bg-white/10 px-3 py-1 text-sm text-inkdim hover:bg-white/20"
                >
                  ✕ Close
                </button>
              </div>
              <div className="px-4 pb-5">
                {qrError ? (
                  <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300 ring-1 ring-red-500/30">
                    {qrError}
                  </p>
                ) : (
                  <>
                    <div
                      id="qr-reader"
                      className="overflow-hidden rounded-xl"
                    />
                    <p className="mt-3 text-center text-xs text-inkdim">
                      Point your camera at the event QR code
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
