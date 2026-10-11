import { useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import Navbar from "../components/Navbar";
import Lightbox from "../components/Lightbox";
import {
  getToken,
  clearAuth,
  fetchMe,
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

  const [eventSlug, setEventSlug] = useState("");
  const [matches, setMatches] = useState([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  const [selfieFile, setSelfieFile] = useState(null);
  const [uploadingSelfie, setUploadingSelfie] = useState(false);
  const [selfieStatus, setSelfieStatus] = useState("");
  const [showRetake, setShowRetake] = useState(false);

  const [lightboxPhoto, setLightboxPhoto] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  // ---- auth guard + restore event slug ----
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
        if (savedSlug && data.user.has_selfie) {
          fetchMatches(savedSlug);
        }
        setAuthChecked(true);
      })
      .catch(() => {
        clearAuth();
        router.replace("/login");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchMatches = async (slug) => {
    if (!slug.trim()) return;
    setLoading(true);
    setError("");
    setSearched(true);
    try {
      const data = await getMatches(slug.trim());
      setMatches(data.matches || []);
      try {
        localStorage.setItem("eventSlug", slug.trim());
      } catch {
        /* ignore */
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFind = (e) => {
    e.preventDefault();
    fetchMatches(eventSlug);
  };

  const handleSelfieUpload = async () => {
    if (!selfieFile) return;
    setUploadingSelfie(true);
    setError("");
    try {
      // Face AI runs on-device: compute the selfie descriptor in-browser.
      const { loadFaceModels, getSelfieDescriptor } = await import("../lib/faceai");
      setSelfieStatus("Loading face AI…");
      await loadFaceModels();
      setSelfieStatus("Scanning your selfie…");
      const descriptor = await getSelfieDescriptor(selfieFile);
      if (!descriptor) {
        throw new Error("No face detected in that selfie. Try a clearer, front-facing photo.");
      }
      setSelfieStatus("Finding your photos…");
      const data = await uploadSelfie(selfieFile, descriptor);
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
      if (eventSlug.trim()) await fetchMatches(eventSlug.trim());
      setShowRetake(false);
      setSelfieFile(null);
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
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400">
        Loading…
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>My Gallery — SnapFind</title>
      </Head>
      <div className="min-h-screen bg-zinc-950 text-white">
        <Navbar />

        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <h1 className="text-3xl font-bold">My Gallery 🖼️</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Hi {user?.name} — find the photos you&apos;re in with your Face ID.
          </p>

          {error && (
            <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* ---- STEP 1: event code ---- */}
          <div className="mt-6 rounded-2xl bg-white/5 p-6 ring-1 ring-white/10">
            <h2 className="font-semibold">
              <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 text-xs font-bold">
                1
              </span>
              Enter the event code
            </h2>
            <form onSubmit={handleFind} className="mt-3 flex gap-2">
              <input
                value={eventSlug}
                onChange={(e) => setEventSlug(e.target.value)}
                placeholder="e.g. ananyas-wedding"
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-zinc-900 px-4 py-2.5 text-sm outline-none transition focus:border-fuchsia-500"
              />
              <button
                type="submit"
                disabled={loading || !eventSlug.trim()}
                className="rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-2.5 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "Searching…" : "Find my photos"}
              </button>
            </form>
            <button
              onClick={() => fetchMatches(eventSlug)}
              disabled={loading || !eventSlug.trim()}
              className="mt-2 text-xs text-zinc-500 underline hover:text-zinc-300 disabled:opacity-50"
            >
              ⟳ Refresh results
            </button>
          </div>

          {/* ---- STEP 2: selfie check-in ---- */}
          {user && user.has_selfie && !showRetake ? (
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
                <p className="text-xs text-zinc-400">
                  Your face is registered — AI matching is active for every
                  event you join. Not finding yourself? Try a clearer selfie.
                </p>
              </div>
              <button
                onClick={() => setShowRetake(true)}
                className="shrink-0 rounded-xl bg-white/10 px-4 py-2 text-xs font-medium text-zinc-200 hover:bg-white/15"
              >
                Retake
              </button>
            </div>
          ) : (
            user && (!user.has_selfie || showRetake) && (
            <div className="mt-4 rounded-2xl bg-white/5 p-6 ring-1 ring-white/10">
              <h2 className="font-semibold">
                <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 text-xs font-bold">
                  2
                </span>
                Check in with a selfie 🤳
              </h2>
              <p className="mt-1 text-sm text-zinc-400">
                Upload one clear, front-facing selfie. Our AI uses it as your
                Face ID to find your photos.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {/* Direct camera capture — opens the front camera on mobile */}
                <input
                  id="selfie-camera-input"
                  type="file"
                  accept="image/*"
                  capture="user"
                  className="hidden"
                  onChange={(e) => setSelfieFile(e.target.files?.[0] || null)}
                />
                <label
                  htmlFor="selfie-camera-input"
                  className="cursor-pointer rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                >
                  📸 Take selfie
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setSelfieFile(e.target.files?.[0] || null)}
                  className="text-sm text-zinc-400 file:mr-3 file:rounded-xl file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-white/20"
                />
                <button
                  onClick={handleSelfieUpload}
                  disabled={!selfieFile || uploadingSelfie}
                  className="rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-2 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50"
                >
                  {uploadingSelfie ? (selfieStatus || "Scanning face…") : "Upload selfie"}
                </button>
              </div>
              {showRetake && (
                <button
                  onClick={() => {
                    setShowRetake(false);
                    setSelfieFile(null);
                  }}
                  className="mt-3 text-xs text-zinc-500 underline hover:text-zinc-300"
                >
                  Cancel retake
                </button>
              )}
            </div>
            )
          )}

          {/* ---- STEP 3: matches ---- */}
          <div className="mt-4 rounded-2xl bg-white/5 p-6 ring-1 ring-white/10">
            <h2 className="font-semibold">
              <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 text-xs font-bold">
                3
              </span>
              Your matched photos
              {searched && matches.length > 0 && (
                <span className="ml-2 text-sm font-normal text-zinc-500">
                  {matches.length} found
                </span>
              )}
            </h2>

            {loading ? (
              <p className="py-10 text-center text-sm text-zinc-500">
                Scanning photos for your face… 🧠
              </p>
            ) : !searched ? (
              <p className="py-10 text-center text-sm text-zinc-500">
                Enter an event code above to start searching. 🔍
              </p>
            ) : matches.length === 0 ? (
              <div className="py-10 text-center">
                <div className="text-4xl">🕵️</div>
                <p className="mt-3 text-sm text-zinc-400">
                  No matches yet — try a clearer, front-facing selfie, or check
                  that the event code is right.
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
                    <span className="absolute inset-x-0 bottom-0 bg-black/60 px-2 py-1 text-[11px] text-zinc-300 opacity-0 transition group-hover:opacity-100">
                      Click to view ⤢
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </main>

        <Lightbox
          photo={lightboxPhoto}
          onClose={() => setLightboxPhoto(null)}
          onDownload={handleDownload}
          onDelete={handleDelete}
          deleting={deleting || downloading}
        />
      </div>
    </>
  );
}
