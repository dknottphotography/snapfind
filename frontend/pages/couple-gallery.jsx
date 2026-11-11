import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import {
  getGalleryPublic,
  unlockGallery,
  getGalleryMedia,
  getGalleryToken,
  saveGalleryToken,
  clearGalleryToken,
} from "../lib/api";

// STANDALONE PAGE — separate from the SnapFind website.
// This page deliberately shares nothing visual with SnapFind:
// no SnapFind navbar, no SnapFind branding, no links back to SnapFind,
// and a different (light, editorial) design. Couples reach it only
// through the private link their photographer sends them.
//
// Static-export friendly: the gallery slug comes from ?gallery=<slug>
// (the photographer's generated link or QR). ?event= is accepted only as
// a legacy fallback; galleries are standalone and are not SnapFind events.
// Flow: open private link -> enter passcode -> photos and videos.
// No account, no signup.

const serif = { fontFamily: "'Cormorant Garamond', Georgia, 'Times New Roman', serif" };

function GalleryHeader({ onLock, unlocked }) {
  return (
    <header className="border-b border-[#E7DFD2] bg-[#FAF7F1]">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <div>
          <p style={serif} className="text-2xl font-semibold leading-none text-[#211D18]">
            Private Gallery
          </p>
          <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.22em] text-[#8A7D68]">
            For the bride and groom only
          </p>
        </div>
        {unlocked && (
          <button
            onClick={onLock}
            className="rounded-md border border-[#D8CFBE] px-4 py-2 text-sm font-medium text-[#4A4238] transition hover:border-[#211D18] hover:text-[#211D18]"
          >
            Lock gallery
          </button>
        )}
      </div>
    </header>
  );
}

function GalleryFooter() {
  return (
    <footer className="border-t border-[#E7DFD2] py-8">
      <p className="px-4 text-center text-xs leading-relaxed text-[#8A7D68]">
        This is a private gallery, shared only with the couple by their
        photographer. Please keep your passcode to yourselves.
      </p>
    </footer>
  );
}

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
  const [folderFilter, setFolderFilter] = useState("All");
  const [mediaLoading, setMediaLoading] = useState(false);
  const [error, setError] = useState("");

  const [viewer, setViewer] = useState(null);
  const [downloadingAll, setDownloadingAll] = useState(false);

  useEffect(() => {
    if (!router.isReady) return;
    const s = router.query.gallery || router.query.event;
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
        setEventInfo(d.gallery || d.event);
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
    setViewer(null);
  };

  const extractSlug = (text) => {
    const t = (text || "").trim();
    if (!t) return null;
    try {
      const url = new URL(t);
      const s = url.searchParams.get("gallery") || url.searchParams.get("event");
      if (s) return s.toLowerCase();
    } catch {
      /* not a URL, maybe a raw code */
    }
    if (/^[a-z0-9-]{2,60}$/i.test(t)) return t.toLowerCase();
    return null;
  };

  const handleOpenGallery = (e) => {
    e.preventDefault();
    const s = extractSlug(codeInput);
    if (!s) {
      setCodeError("That does not look like a gallery link or event code.");
      return;
    }
    router.push(`/couple-gallery?gallery=${encodeURIComponent(s)}`);
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

  // Folders (Haldi, Wedding, ...) organise the grid when the
  // photographer used them at upload time.
  const folderBuckets = [
    ...new Set(media.map((m) => m.folder || "General")),
  ];
  const showFolderChips = media.some((m) => m.folder);
  const activeFolder =
    folderFilter === "All" || folderBuckets.includes(folderFilter)
      ? folderFilter
      : "All";
  const visibleMedia =
    activeFolder === "All"
      ? media
      : media.filter((m) => (m.folder || "General") === activeFolder);

  return (
    <>
      <Head>
        <title>
          {eventInfo ? `${eventInfo.name} — Private Gallery` : "Private Gallery"}
        </title>
        <meta name="robots" content="noindex, nofollow" />
        <link rel="icon" type="image/svg+xml" href="/gallery-favicon.svg" />
        <meta
          name="description"
          content="A private photo and video gallery for the bride and groom. Open it with the passcode from your photographer."
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&display=swap"
          rel="stylesheet"
        />
      </Head>

      <div className="flex min-h-screen flex-col bg-[#FAF7F1] text-[#211D18]">
        <GalleryHeader onLock={handleLock} unlocked={unlocked} />

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
          {/* ---- no link yet: entry form ---- */}
          {!slug && (
            <div className="mx-auto max-w-lg py-14 text-center">
              <h1 style={serif} className="text-4xl font-semibold sm:text-5xl">
                Your private gallery
              </h1>
              <p className="mt-4 leading-relaxed text-[#5C5347]">
                Your photographer sent you a private link. Paste it below,
                or type your event code, then enter the passcode to open
                your photos and videos.
              </p>
              <form onSubmit={handleOpenGallery} className="mt-8 flex gap-2">
                <input
                  value={codeInput}
                  onChange={(e) => {
                    setCodeInput(e.target.value);
                    setCodeError("");
                  }}
                  placeholder="Paste your gallery link or event code"
                  className="min-w-0 flex-1 rounded-md border border-[#D8CFBE] bg-white px-4 py-3 text-sm text-[#211D18] outline-none transition placeholder:text-[#A3967F] focus:border-[#211D18]"
                />
                <button
                  type="submit"
                  disabled={!codeInput.trim()}
                  className="shrink-0 rounded-md bg-[#211D18] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#3A342C] disabled:opacity-40"
                >
                  Open gallery
                </button>
              </form>
              {codeError && (
                <p className="mt-3 text-sm text-[#B3261E]">{codeError}</p>
              )}
            </div>
          )}

          {/* ---- link present, info loading / not found ---- */}
          {slug && infoLoading && (
            <p className="py-24 text-center text-sm text-[#5C5347]">
              Loading your gallery…
            </p>
          )}
          {slug && infoError && (
            <div className="mx-auto max-w-lg py-14 text-center">
              <div className="rounded-lg border border-[#E7DFD2] bg-white p-10">
                <h1 style={serif} className="text-3xl font-semibold">Gallery not found</h1>
                <p className="mt-3 leading-relaxed text-[#5C5347]">
                  This gallery link looks invalid. Ask your photographer for
                  a fresh link.
                </p>
                <button
                  onClick={() => router.push("/couple-gallery")}
                  className="mt-6 rounded-md border border-[#211D18] px-6 py-3 text-sm font-semibold text-[#211D18] transition hover:bg-[#211D18] hover:text-white"
                >
                  Try another link
                </button>
              </div>
            </div>
          )}

          {/* ---- locked: passcode form ---- */}
          {slug && eventInfo && !unlocked && !infoLoading && (
            <div className="mx-auto max-w-lg py-14 text-center">
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#8A7D68]">
                Private gallery
              </p>
              <h1 style={serif} className="mt-3 text-4xl font-semibold sm:text-5xl">
                {eventInfo.name}
              </h1>
              <p className="mt-4 leading-relaxed text-[#5C5347]">
                {eventInfo.media_count > 0
                  ? `${eventInfo.media_count} photo${eventInfo.media_count === 1 ? "" : "s"} and video${eventInfo.media_count === 1 ? "" : "s"} are waiting for you.`
                  : "Your gallery is being prepared."}{" "}
                Enter the passcode your photographer gave you. Only you have it.
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
                  className="w-full rounded-md border border-[#D8CFBE] bg-white px-4 py-3 text-center text-lg tracking-[0.3em] text-[#211D18] outline-none transition placeholder:text-base placeholder:tracking-normal placeholder:text-[#A3967F] focus:border-[#211D18]"
                />
                <button
                  type="submit"
                  disabled={unlocking || !passcode.trim()}
                  className="mt-3 w-full rounded-md bg-[#211D18] px-6 py-3 font-semibold text-white transition hover:bg-[#3A342C] disabled:opacity-40"
                >
                  {unlocking ? "Unlocking…" : "Unlock my gallery"}
                </button>
              </form>
              {unlockError && (
                <p className="mt-4 rounded-md border border-[#E3B7B3] bg-[#FDF0EF] px-4 py-2.5 text-sm text-[#B3261E]">
                  {unlockError}
                </p>
              )}
              <p className="mt-6 text-xs text-[#8A7D68]">
                No account needed. The passcode is the only key.
              </p>
            </div>
          )}

          {/* ---- unlocked: media grid ---- */}
          {slug && eventInfo && unlocked && (
            <>
              <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#E7DFD2] pb-6">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#8A7D68]">
                    Private gallery
                  </p>
                  <h1 style={serif} className="mt-2 text-4xl font-semibold">
                    {eventInfo.name}
                  </h1>
                  <p className="mt-2 text-sm text-[#5C5347]">
                    {media.length} item{media.length === 1 ? "" : "s"}
                    {photos.length > 0 && ` · ${photos.length} photo${photos.length === 1 ? "" : "s"}`}
                    {videos.length > 0 && ` · ${videos.length} video${videos.length === 1 ? "" : "s"}`}
                  </p>
                </div>
                <button
                  onClick={handleDownloadAll}
                  disabled={downloadingAll || media.length === 0}
                  className="rounded-md bg-[#211D18] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#3A342C] disabled:opacity-40"
                >
                  {downloadingAll ? "Downloading…" : "Download all"}
                </button>
              </div>

              {error && (
                <div className="mt-4 rounded-md border border-[#E3B7B3] bg-[#FDF0EF] px-4 py-2.5 text-sm text-[#B3261E]">
                  {error}
                </div>
              )}

              {mediaLoading ? (
                <p className="py-16 text-center text-sm text-[#5C5347]">
                  Loading your photos and videos…
                </p>
              ) : media.length === 0 ? (
                <div className="mt-6 rounded-lg border border-[#E7DFD2] bg-white p-10 text-center">
                  <p className="text-sm text-[#5C5347]">
                    Nothing here yet. Your photographer is still uploading.
                    Check back soon.
                  </p>
                </div>
              ) : (
                <>
                  {downloadingAll && (
                    <p className="mt-4 text-center text-xs text-[#8A7D68]">
                      Your browser may ask you to allow multiple downloads.
                      That is normal.
                    </p>
                  )}
                  {showFolderChips && (
                    <div className="mt-6 flex flex-wrap gap-2">
                      {["All", ...folderBuckets].map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setFolderFilter(f)}
                          className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                            activeFolder === f
                              ? "bg-[#211D18] text-white"
                              : "bg-white text-[#5C5347] ring-1 ring-[#E7DFD2] hover:ring-[#211D18]"
                          }`}
                        >
                          {f} (
                          {f === "All"
                            ? media.length
                            : media.filter(
                                (m) => (m.folder || "General") === f
                              ).length}
                          )
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {visibleMedia.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setViewer(item)}
                        className="group relative overflow-hidden rounded-md text-left ring-1 ring-[#E7DFD2] transition hover:ring-[#211D18]"
                      >
                        {item.media_type === "video" ? (
                          <span className="relative block aspect-video w-full bg-[#211D18]">
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
                            <span className="absolute left-2 top-2 rounded-sm bg-black/70 px-2 py-0.5 text-xs font-medium text-white">
                              Video
                            </span>
                          </span>
                        ) : (
                          <img
                            src={item.display_url || item.url}
                            alt={item.filename}
                            className="aspect-square w-full bg-white object-cover"
                            loading="lazy"
                          />
                        )}
                        <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-2 py-1 text-[11px] text-white opacity-0 transition group-hover:opacity-100">
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

        <GalleryFooter />

        {/* ---- viewer: photo or video ---- */}
        {viewer && (
          <div
            className="fixed inset-0 z-50 flex flex-col bg-black/95"
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
                  className="max-h-[85vh] max-w-full rounded-md shadow-2xl"
                />
              ) : (
                <img
                  src={viewer.url}
                  alt={viewer.filename}
                  className="max-h-[85vh] max-w-full rounded-md object-contain shadow-2xl"
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
                className="rounded-md bg-white px-5 py-2 text-sm font-semibold text-[#211D18] transition hover:bg-zinc-200"
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
