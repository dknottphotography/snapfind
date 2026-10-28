import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import Navbar from "../components/Navbar";
import AmbientAbyss from "../components/AmbientAbyss";
import {
  getGalleryPublic,
  unlockGallery,
  getGalleryMedia,
  getGalleryToken,
  saveGalleryToken,
  clearGalleryToken,
} from "../lib/api";

// Static-export friendly: the event slug comes from ?event=<slug>
// (the photographer's share link points here). Works the same in
// `next dev` and in the static export — no dynamic route needed.
//
// Flow: open your private link -> enter the passcode your photographer
// gave you -> your photos and videos. No account, no signup.
export default function CoupleGallery() {
  const router = useRouter();
  const [slug, setSlug] = useState(null);

  // Entry form (no ?event= in the URL yet)
  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState("");

  // Public info
  const [eventInfo, setEventInfo] = useState(null);
  const [infoLoading, setInfoLoading] = useState(false);
  const [infoError, setInfoError] = useState("");

  // Passcode
  const [passcode, setPasscode] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState("");

  // Media
  const [unlocked, setUnlocked] = useState(false);
  const [media, setMedia] = useState([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [error, setError] = useState("");

  const [viewer, setViewer] = useState(null);
  const [downloadingAll, setDownloadingAll] = useState(false);

  useEffect(() => {
    if (!router.isReady) return;
    const s = router.query.event;
    if (!s || typeof s !== "string") return;
    setSlug(s.toLowerCase());
  }, [router.isReady, router.query]);

  useEffect(() => {
    if (!slug) return;
    setInfoLoading(true);
    setInfoError("");
    setEventInfo(null);
    setUnlocked(false);
    setMedia([]);
    getGalleryPublic(slug)
      .then((d) => {
        setEventInfo(d.event);
        // Returning visit in this tab? Try the saved unlock token first.
        const saved = getGalleryToken(slug);
        if (saved) fetchMedia(saved, true);
      })
      .catch(() => setInfoError("Gallery not found. Check the link and try again."))
      .finally(() => setInfoLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const fetchMedia = async (token, silent) => {
    setMediaLoading(true);
    if (!silent) setError("");
    try {
      const data = await getGalleryMedia(slug, token);
      setMedia(data.media || []);
      setUnlocked(true);
      setUnlockError("");
    } catch (err) {
      // Saved token expired/invalid — fall back to the passcode form.
      clearGalleryToken(slug);
      setUnlocked(false);
      if (!silent) setError(err.message);
    } finally {
      setMediaLoading(false);
    }
  };

  const handleUnlock = async (e) => {
    e.preventDefault();
    if (!passcode.trim()) return;
    setUnlocking(true);
    setUnlockError("");
    try {
      const data = await unlockGallery(slug, passcode.trim());
      saveGalleryToken(slug, data.token);
      await fetchMedia(data.token);
    } catch (err) {
      setUnlockError(err.message);
    } finally {
      setUnlocking(false);
    }
  };

  const handleLock = () => {
    clearGalleryToken(slug);
    setUnlocked(false);
    setMedia([]);
    setPasscode("");
  };

  const extractSlug = (text) => {
    const t = (text || "").trim();
    if (!t) return null;
    try {
      const url = new URL(t);
      const s = url.searchParams.get("event");
      if (s) return s.toLowerCase();
    } catch {
      /* not a URL — maybe a raw code */
    }
    if (/^[a-z0-9-]{2,60}$/i.test(t)) return t.toLowerCase();
    return null;
  };

  const handleOpenGallery = (e) => {
    e.preventDefault();
    const s = extractSlug(codeInput);
    if (!s) {
      setCodeError("That doesn't look like a gallery link or event code.");
      return;
    }
    router.push(`/couple-gallery?event=${encodeURIComponent(s)}`);
  };

  const handleDownloadAll = async () => {
    if (!media.length || downloadingAll) return;
    setDownloadingAll(true);
    for (const item of media) {
      const a = document.createElement("a");
      a.href = item.download_url || item.url;
      a.download = item.filename || "";
      document.body.appendChild(a);
      a.click();
      a.remove();
      await new Promise((r) => setTimeout(r, 400));
    }
    setDownloadingAll(false);
  };

  const photos = media.filter((m) => m.media_type !== "video");
  const videos = media.filter((m) => m.media_type === "video");

  return (
    <>
      <Head>
        <title>
          {eventInfo ? `${eventInfo.name}: Couple's Gallery` : "Couple's Gallery: SnapFind"}
        </title>
      </Head>
      <div className="min-h-screen bg-abyss text-ink">
        <AmbientAbyss />
        <Navbar />

        <main className="relative z-10 mx-auto max-w-6xl px-4 py-8 sm:px-6">
          {/* ---- no link yet: entry form ---- */}
          {!slug && (
            <div className="mx-auto max-w-lg py-16 text-center">
              <h1 className="font-display mt-4 text-3xl font-bold">
                Your private gallery
              </h1>
              <p className="mt-3 text-inkdim">
                Your photographer sent you a private link. Paste it below,
                or type your event code, and enter the passcode to open your
                photos and videos.
              </p>
              <form onSubmit={handleOpenGallery} className="mt-6 flex gap-2">
                <input
                  value={codeInput}
                  onChange={(e) => {
                    setCodeInput(e.target.value);
                    setCodeError("");
                  }}
                  placeholder="Paste your gallery link or event code"
                  className="min-w-0 flex-1 rounded-xl border border-white/10 bg-abyss/60 px-4 py-3 text-sm text-ink outline-none transition focus:border-bio-cyan"
                />
                <button
                  type="submit"
                  disabled={!codeInput.trim()}
                  className="btn-bio shrink-0 rounded-xl px-5 py-3 text-sm disabled:opacity-50"
                >
                  Open gallery →
                </button>
              </form>
              {codeError && (
                <p className="mt-3 text-sm text-red-300">{codeError}</p>
              )}
            </div>
          )}

          {/* ---- link present, info loading / not found ---- */}
          {slug && infoLoading && (
            <p className="py-24 text-center text-sm text-inkdim">
              Loading your gallery…
            </p>
          )}
          {slug && infoError && (
            <div className="mx-auto max-w-lg py-16 text-center">
              <div className="glass-deep rounded-3xl p-10">
                <h1 className="font-display text-2xl font-bold">Gallery not found</h1>
                <p className="mt-3 text-inkdim">
                  This gallery link looks invalid. Ask your photographer for
                  a fresh link.
                </p>
                <Link href="/couple-gallery" className="btn-ghost mt-6 inline-block rounded-xl px-6 py-3 font-semibold">
                  Try another link
                </Link>
              </div>
            </div>
          )}

          {/* ---- locked: passcode form ---- */}
          {slug && eventInfo && !unlocked && !infoLoading && (
            <div className="mx-auto max-w-lg py-16 text-center">
              <h1 className="font-display mt-4 text-3xl font-bold">
                {eventInfo.name}
              </h1>
              <p className="mt-3 text-inkdim">
                {eventInfo.media_count > 0
                  ? `${eventInfo.media_count} photo${eventInfo.media_count === 1 ? "" : "s"} and video${eventInfo.media_count === 1 ? "" : "s"} are waiting for you.`
                  : "Your gallery is being prepared."}{" "}
                Enter the passcode your photographer gave you. Only you have
                it.
              </p>
              <form onSubmit={handleUnlock} className="mx-auto mt-8 max-w-sm">
                <input
                  type="password"
                  value={passcode}
                  onChange={(e) => {
                    setPasscode(e.target.value);
                    setUnlockError("");
                  }}
                  placeholder="Gallery passcode"
                  autoComplete="off"
                  className="w-full rounded-xl border border-white/10 bg-abyss/60 px-4 py-3 text-center text-lg tracking-[0.3em] text-ink outline-none transition focus:border-bio-cyan"
                />
                <button
                  type="submit"
                  disabled={unlocking || !passcode.trim()}
                  className="btn-bio mt-3 w-full rounded-xl px-6 py-3 disabled:opacity-50"
                >
                  {unlocking ? "Unlocking…" : "Unlock my gallery"}
                </button>
              </form>
              {unlockError && (
                <p className="mt-4 rounded-xl bg-red-500/10 px-4 py-2.5 text-sm text-red-300 ring-1 ring-red-500/30">
                  {unlockError}
                </p>
              )}
              <p className="mt-6 text-xs text-inkdim">
                No account needed. The passcode is the only key.
              </p>
            </div>
          )}

          {/* ---- unlocked: media grid ---- */}
          {slug && eventInfo && unlocked && (
            <>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h1 className="font-display mt-2 text-3xl font-bold">
                    {eventInfo.name}
                  </h1>
                  <p className="mt-1 text-sm text-inkdim">
                    {media.length} item{media.length === 1 ? "" : "s"}
                    {photos.length > 0 && ` · ${photos.length} photo${photos.length === 1 ? "" : "s"}`}
                    {videos.length > 0 && ` · ${videos.length} video${videos.length === 1 ? "" : "s"}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleDownloadAll}
                    disabled={downloadingAll || media.length === 0}
                    className="btn-bio rounded-xl px-5 py-2.5 text-sm disabled:opacity-50"
                  >
                    {downloadingAll ? "Downloading…" : "Download all"}
                  </button>
                  <button
                    onClick={handleLock}
                    className="rounded-xl border border-white/15 px-5 py-2.5 text-sm font-medium text-inkdim transition hover:border-white/30 hover:text-ink"
                  >
                    Lock gallery
                  </button>
                </div>
              </div>

              {error && (
                <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
                  {error}
                </div>
              )}

              {mediaLoading ? (
                <p className="py-16 text-center text-sm text-inkdim">
                  Loading your photos &amp; videos…
                </p>
              ) : media.length === 0 ? (
                <div className="glass mt-6 rounded-2xl p-10 text-center">
                  <p className="mt-3 text-sm text-inkdim">
                    Nothing here yet. Your photographer is still uploading.
                    Check back soon.
                  </p>
                </div>
              ) : (
                <>
                  {downloadingAll && (
                    <p className="mt-4 text-center text-xs text-inkdim">
                      Your browser may ask you to allow multiple downloads.
                      That is normal.
                    </p>
                  )}
                  <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {media.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setViewer(item)}
                        className="group relative overflow-hidden rounded-xl text-left ring-1 ring-white/10 transition hover:ring-bio-cyan/50"
                      >
                        {item.media_type === "video" ? (
                          <span className="relative block aspect-video w-full">
                            <video
                              src={item.url}
                              poster={item.display_url}
                              preload="metadata"
                              muted
                              playsInline
                              className="h-full w-full object-cover"
                            />
                            <span className="absolute inset-0 flex items-center justify-center">
                              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/70 text-lg text-white ring-1 ring-white/30">
                                ▶
                              </span>
                            </span>
                            <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-xs font-medium text-white">
                              Video
                            </span>
                          </span>
                        ) : (
                          <img
                            src={item.display_url || item.url}
                            alt={item.filename}
                            className="aspect-square w-full object-cover"
                            loading="lazy"
                          />
                        )}
                        <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-2 py-1 text-[11px] text-inkdim opacity-0 transition group-hover:opacity-100">
                          {item.filename}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </main>

        {/* ---- viewer: photo or video ---- */}
        {viewer && (
          <div
            className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm"
            onClick={() => setViewer(null)}
          >
            <div
              className="flex items-center justify-between px-4 py-3"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="max-w-[70%] truncate text-sm text-zinc-300">
                {viewer.filename}
              </p>
              <button
                onClick={() => setViewer(null)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-lg text-white transition hover:bg-white/20"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div
              className="flex flex-1 items-center justify-center overflow-hidden px-4"
              onClick={(e) => e.stopPropagation()}
            >
              {viewer.media_type === "video" ? (
                <video
                  src={viewer.url}
                  poster={viewer.display_url}
                  controls
                  autoPlay
                  playsInline
                  className="max-h-[85vh] max-w-full rounded-xl shadow-2xl"
                />
              ) : (
                <img
                  src={viewer.url}
                  alt={viewer.filename}
                  className="max-h-[85vh] max-w-full rounded-xl object-contain shadow-2xl"
                />
              )}
            </div>
            <div
              className="flex flex-wrap items-center justify-center gap-3 px-4 py-4"
              onClick={(e) => e.stopPropagation()}
            >
              <a
                href={viewer.download_url || viewer.url}
                download={viewer.filename || ""}
                className="btn-bio rounded-xl px-5 py-2 text-sm"
              >
                Download
              </a>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
