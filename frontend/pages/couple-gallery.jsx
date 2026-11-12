import { useEffect, useMemo, useState } from "react";
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
// Dark, cinematic couple's gallery in the style of the studio's
// reference experience (dknottphotography.ve.ai): full-bleed hero
// cover -> 4-digit PIN keypad -> folder cards (Engagement, Haldi,
// Wedding, ...) -> photo grid -> viewer with Original / Optimized
// download choices. No SnapFind branding, no links back to SnapFind.
// Flow: open private link -> ENTER -> PIN -> albums.
// No account, no signup.

const serif = { fontFamily: "'Cormorant Garamond', Georgia, 'Times New Roman', serif" };
const INK = "#17171A";
const CARD = "#232327";
const MUTED = "#A8A29A";
const FAV_KEY = (slug) => `snapfind:favs:${slug}`;

function countLabel(n, singular = "Photo", plural = "Photos") {
  return `${n} ${n === 1 ? singular : plural}`;
}

export default function CoupleGallery() {
  const router = useRouter();
  const [slug, setSlug] = useState(null);

  // Entry form (no ?gallery= in the URL yet)
  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState("");

  // Public info
  const [eventInfo, setEventInfo] = useState(null);
  const [infoLoading, setInfoLoading] = useState(false);
  const [infoError, setInfoError] = useState("");

  // Screens: hero | pin | albums | folder | videos | favs | more
  const [view, setView] = useState("hero");
  const [openFolder, setOpenFolder] = useState(null);

  // PIN
  const [pin, setPin] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState("");

  // Media
  const [unlocked, setUnlocked] = useState(false);
  const [media, setMedia] = useState([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [error, setError] = useState("");

  const [viewer, setViewer] = useState(null); // {item, list}
  const [sheet, setSheet] = useState(null); // null | "download"
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [copied, setCopied] = useState(false);

  // Favourites live on this device only.
  const [favs, setFavs] = useState([]);
  useEffect(() => {
    if (!slug) return;
    try {
      setFavs(JSON.parse(localStorage.getItem(FAV_KEY(slug)) || "[]"));
    } catch {
      setFavs([]);
    }
  }, [slug]);
  const toggleFav = (id) => {
    setFavs((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id];
      try {
        localStorage.setItem(FAV_KEY(slug), JSON.stringify(next));
      } catch {
        /* private mode — favourites just won't persist */
      }
      return next;
    });
  };

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
    setView("hero");
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
      setView("albums");
    } catch (err) {
      clearGalleryToken(slug);
      setUnlocked(false);
      setView("hero");
      if (!silent) setError(err.message);
    } finally {
      setMediaLoading(false);
    }
  };

  const attemptUnlock = async (code) => {
    if (unlocking || code.length !== 4) return;
    setUnlocking(true);
    setUnlockError("");
    try {
      const data = await unlockGallery(slug, code);
      saveGalleryToken(slug, data.token);
      setPin("");
      await fetchMedia(data.token);
    } catch (err) {
      setUnlockError(err.message);
      setPin("");
    } finally {
      setUnlocking(false);
    }
  };

  // 4th digit typed -> unlock right away.
  useEffect(() => {
    if (view === "pin" && pin.length === 4) attemptUnlock(pin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, view]);

  // Physical keyboard support on the PIN screen.
  useEffect(() => {
    if (view !== "pin") return;
    const onKey = (e) => {
      if (/^[0-9]$/.test(e.key)) {
        setPin((p) => (p.length < 4 ? p + e.key : p));
        setUnlockError("");
      } else if (e.key === "Backspace") {
        setPin((p) => p.slice(0, -1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view]);

  const handleLock = () => {
    clearGalleryToken(slug);
    setUnlocked(false);
    setMedia([]);
    setPin("");
    setViewer(null);
    setSheet(null);
    setOpenFolder(null);
    setView("hero");
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

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — nothing to show */
    }
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

  const downloadItem = (item, original) => {
    const a = document.createElement("a");
    a.href = original
      ? item.download_url || item.url
      : item.display_url || item.url;
    a.download = item.filename || "";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setSheet(null);
  };

  const photos = media.filter((m) => m.media_type !== "video");
  const videos = media.filter((m) => m.media_type === "video");
  const favItems = media.filter((m) => favs.includes(m.id));

  // Folders, in the order their first photo was uploaded (oldest first);
  // uncategorised photos form an "All Photos" card at the end.
  const folders = useMemo(() => {
    const map = new Map();
    for (const m of [...media].reverse()) {
      const f = (m.folder || "").trim() || "All Photos";
      if (!map.has(f)) map.set(f, []);
      map.get(f).push(m);
    }
    const entries = [...map.entries()];
    const named = entries
      .filter(([n]) => n !== "All Photos")
      .sort((a, b) => new Date(a[1][0].created_at) - new Date(b[1][0].created_at));
    const general = entries.filter(([n]) => n === "All Photos");
    return [...named, ...general];
  }, [media]);

  const folderCover = (items) => {
    const photo = items.find((m) => m.media_type !== "video");
    const item = photo || items[0];
    return item ? item.display_url || item.url : null;
  };

  const cover = eventInfo?.cover_url || null;
  const mediaCount = eventInfo?.media_count ?? media.length;

  const openViewer = (item, list) => setViewer({ item, list });
  const viewerIndex = viewer
    ? viewer.list.findIndex((m) => m.id === viewer.item.id)
    : -1;
  const stepViewer = (dir) => {
    if (!viewer || viewer.list.length < 2) return;
    const next =
      (viewerIndex + dir + viewer.list.length) % viewer.list.length;
    setViewer({ item: viewer.list[next], list: viewer.list });
  };

  const keypadPress = (key) => {
    if (unlocking) return;
    if (key === "back") {
      setPin((p) => p.slice(0, -1));
    } else if (pin.length < 4) {
      setPin((p) => p + key);
      setUnlockError("");
    }
  };

  return (
    <>
      <Head>
        <title>
          {eventInfo ? `${eventInfo.name} — Private Gallery` : "Private Gallery"}
        </title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="theme-color" content="#17171A" />
        <link rel="icon" type="image/svg+xml" href="/gallery-favicon.svg" />
        <meta
          name="description"
          content="A private photo and video gallery for the bride and groom. Open it with the PIN from your photographer."
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&display=swap"
          rel="stylesheet"
        />
      </Head>

      <div
        className="min-h-[100dvh] text-[#F5F2EC]"
        style={{ backgroundColor: INK }}
      >
        {/* ---- loading (never a blank screen) ---- */}
        {slug && infoLoading && (
          <div className="flex min-h-[100dvh] flex-col items-center justify-center px-6 text-center">
            <p style={serif} className="text-3xl font-semibold">
              Private Gallery
            </p>
            <p className="mt-4 text-sm tracking-[0.2em] text-[#A8A29A]">
              LOADING YOUR GALLERY
            </p>
            <div className="mt-6 flex gap-2" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-2 w-2 animate-pulse rounded-full bg-white/60"
                  style={{ animationDelay: `${i * 0.2}s` }}
                />
              ))}
            </div>
          </div>
        )}

        {/* ---- no link yet: entry form ---- */}
        {!slug && !infoLoading && (
          <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center px-6 py-14 text-center">
            <p style={serif} className="text-4xl font-semibold sm:text-5xl">
              Your private gallery
            </p>
            <p className="mt-4 leading-relaxed text-[#A8A29A]">
              Your photographer sent you a private link. Paste it below,
              or type your event code, then enter the PIN to open your
              photos and videos.
            </p>
            <form onSubmit={handleOpenGallery} className="mt-8 w-full">
              <input
                value={codeInput}
                onChange={(e) => {
                  setCodeInput(e.target.value);
                  setCodeError("");
                }}
                placeholder="Paste your gallery link or event code"
                className="w-full rounded-full border border-white/15 bg-white/5 px-5 py-3.5 text-center text-sm text-[#F5F2EC] outline-none transition placeholder:text-[#A8A29A] focus:border-white/40"
              />
              <button
                type="submit"
                disabled={!codeInput.trim()}
                style={{ color: "#17171A" }}
                className="mt-3 w-full rounded-full bg-white px-6 py-3.5 text-sm font-semibold tracking-wide transition hover:bg-zinc-200 disabled:opacity-40"
              >
                ENTER
              </button>
            </form>
            {codeError && (
              <p className="mt-3 text-sm text-[#F87171]">{codeError}</p>
            )}
          </div>
        )}

        {/* ---- gallery not found ---- */}
        {slug && infoError && !infoLoading && (
          <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center px-6 py-14 text-center">
            <p style={serif} className="text-4xl font-semibold">
              Gallery not found
            </p>
            <p className="mt-4 leading-relaxed text-[#A8A29A]">
              This gallery link looks invalid. Ask your photographer for a
              fresh link.
            </p>
            <button
              onClick={() => router.push("/couple-gallery")}
              className="mt-8 rounded-full border border-white/25 px-6 py-3 text-sm font-semibold text-[#F5F2EC] transition hover:border-white/60"
            >
              Try another link
            </button>
          </div>
        )}

        {/* ---- hero: cover + ENTER ---- */}
        {slug && eventInfo && !unlocked && view === "hero" && !infoLoading && (
          <div className="relative min-h-[100dvh]">
            {cover ? (
              <img
                src={cover}
                alt={eventInfo.name}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "radial-gradient(120% 90% at 50% 10%, #2A2A2E 0%, #17171A 60%)",
                }}
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/30" />
            <div className="relative flex min-h-[100dvh] flex-col justify-end px-6 pb-12">
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/60">
                Private Gallery
              </p>
              <h1
                style={serif}
                className="mt-2 text-4xl font-semibold uppercase leading-tight tracking-wide sm:text-5xl"
              >
                {eventInfo.name}
              </h1>
              <p className="mt-2 text-sm text-white/70">
                {countLabel(mediaCount)}
              </p>
              <button
                onClick={() => setView("pin")}
                style={{ color: "#17171A" }}
                className="mt-6 w-36 rounded-full bg-white px-6 py-3 text-sm font-semibold tracking-[0.15em] transition hover:bg-zinc-200"
              >
                ENTER
              </button>
            </div>
          </div>
        )}

        {/* ---- PIN keypad ---- */}
        {slug && eventInfo && !unlocked && view === "pin" && !infoLoading && (
          <div className="relative min-h-[100dvh] overflow-hidden">
            {cover && (
              <img
                src={cover}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-2xl"
              />
            )}
            <div className="absolute inset-0 bg-black/60" />
            <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-sm flex-col px-6 pb-10 pt-5">
              <button
                onClick={() => {
                  setView("hero");
                  setPin("");
                  setUnlockError("");
                }}
                className="self-start rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white/80 transition hover:bg-white/20"
              >
                ← Back
              </button>

              <div className="flex flex-1 flex-col items-center justify-center">
                <p className="text-[12px] font-semibold uppercase tracking-[0.3em] text-white/70">
                  Enter PIN code
                </p>
                <div className="mt-6 flex gap-4" aria-hidden="true">
                  {[0, 1, 2, 3].map((i) => (
                    <span
                      key={i}
                      className={`h-4 w-4 rounded-full border-2 transition ${
                        pin.length > i
                          ? "border-white bg-white"
                          : "border-white/50 bg-transparent"
                      }`}
                    />
                  ))}
                </div>

                <div className="mt-10 grid w-full max-w-[280px] grid-cols-3 gap-x-4 gap-y-5">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => keypadPress(d)}
                      className="flex h-16 w-16 items-center justify-center justify-self-center rounded-full bg-white/10 text-2xl font-medium text-white transition active:bg-white/25"
                    >
                      {d}
                    </button>
                  ))}
                  <span />
                  <button
                    type="button"
                    onClick={() => keypadPress("0")}
                    className="flex h-16 w-16 items-center justify-center justify-self-center rounded-full bg-white/10 text-2xl font-medium text-white transition active:bg-white/25"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={() => keypadPress("back")}
                    aria-label="Delete"
                    className="flex h-16 w-16 items-center justify-center justify-self-center rounded-full bg-white/10 text-xl text-white transition active:bg-white/25"
                  >
                    ⌫
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => attemptUnlock(pin)}
                  disabled={unlocking || pin.length !== 4}
                  style={{ color: "#17171A" }}
                  className="mt-10 w-full max-w-[280px] rounded-full bg-white px-6 py-3.5 text-sm font-semibold tracking-[0.15em] transition hover:bg-zinc-200 disabled:opacity-40"
                >
                  {unlocking ? "CHECKING…" : "CONTINUE"}
                </button>

                {unlockError && (
                  <p className="mt-4 text-center text-sm text-[#FCA5A5]">
                    Wrong PIN — ask your photographer for the gallery PIN.
                  </p>
                )}
                <p className="mt-8 max-w-[280px] text-center text-[11px] leading-relaxed text-white/45">
                  By continuing further you consent to our Terms and
                  Conditions and Privacy Policy.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ---- unlocked: albums / videos / favourites / more ---- */}
        {slug && eventInfo && unlocked && !infoLoading && (
          <div className="mx-auto flex min-h-[100dvh] w-full max-w-3xl flex-col pb-24">
            <header className="relative px-4 pb-2 pt-6 text-center">
              <h1
                style={serif}
                className="text-2xl font-semibold uppercase tracking-wide"
              >
                {eventInfo.name}
              </h1>
              <p className="mt-1 text-xs text-white/50">
                by DKNOTT Photography
              </p>
              <button
                onClick={copyLink}
                aria-label="Copy gallery link"
                className="absolute right-4 top-6 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-lg text-white transition hover:bg-white/20"
              >
                {copied ? "✓" : "↗"}
              </button>
            </header>

            {error && (
              <p className="mx-4 mt-3 rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm text-[#FCA5A5]">
                {error}
              </p>
            )}

            {/* albums */}
            {view === "albums" && (
              <main className="mt-4 space-y-4 px-4">
                {mediaLoading ? (
                  <p className="py-16 text-center text-sm text-[#A8A29A]">
                    Loading your photos and videos…
                  </p>
                ) : folders.length === 0 ? (
                  <div className="rounded-2xl bg-white/5 p-10 text-center">
                    <p className="text-sm text-[#A8A29A]">
                      Nothing here yet. Your photographer is still uploading.
                      Check back soon.
                    </p>
                  </div>
                ) : (
                  folders.map(([name, items]) => {
                    const coverUrl = folderCover(items);
                    const hasVideo = items.some(
                      (m) => m.media_type === "video"
                    );
                    return (
                      <button
                        key={name}
                        onClick={() => {
                          setOpenFolder(name);
                          setView("folder");
                        }}
                        className="relative block w-full overflow-hidden rounded-2xl text-left"
                        style={{ backgroundColor: CARD }}
                      >
                        {coverUrl && (
                          <img
                            src={coverUrl}
                            alt={name}
                            className="aspect-[16/10] w-full object-cover"
                            loading="lazy"
                          />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />
                        <div className="absolute bottom-0 left-0 p-4">
                          <p className="text-lg font-bold uppercase tracking-wide">
                            {name}
                          </p>
                          <span className="mt-1.5 inline-block rounded-full bg-black/50 px-2.5 py-0.5 text-xs font-medium text-white/90">
                            {countLabel(
                              items.length,
                              hasVideo ? "Item" : "Photo",
                              hasVideo ? "Items" : "Photos"
                            )}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </main>
            )}

            {/* one folder's grid */}
            {view === "folder" && openFolder && (
              <FolderGrid
                title={openFolder}
                items={
                  folders.find(([n]) => n === openFolder)?.[1] || []
                }
                onBack={() => {
                  setOpenFolder(null);
                  setView("albums");
                }}
                onOpen={(item, list) => openViewer(item, list)}
              />
            )}

            {/* videos only */}
            {view === "videos" && (
              <FolderGrid
                title="Videos"
                items={videos}
                onBack={() => setView("albums")}
                onOpen={(item, list) => openViewer(item, list)}
                emptyText="No videos in this gallery yet."
              />
            )}

            {/* favourites */}
            {view === "favs" && (
              <FolderGrid
                title="Favourites"
                items={favItems}
                onBack={() => setView("albums")}
                onOpen={(item, list) => openViewer(item, list)}
                emptyText="Tap the heart on any photo to keep it here."
              />
            )}

            {/* more */}
            {view === "more" && (
              <main className="mt-6 space-y-3 px-4">
                <button
                  onClick={handleDownloadAll}
                  disabled={downloadingAll || media.length === 0}
                  style={{ color: "#17171A" }}
                  className="w-full rounded-full bg-white px-6 py-3.5 text-sm font-semibold tracking-wide transition hover:bg-zinc-200 disabled:opacity-40"
                >
                  {downloadingAll ? "Downloading…" : "Download all photos"}
                </button>
                <button
                  onClick={handleLock}
                  className="w-full rounded-full border border-white/25 px-6 py-3.5 text-sm font-semibold text-[#F5F2EC] transition hover:border-white/60"
                >
                  Lock gallery
                </button>
                <p className="pt-4 text-center text-xs leading-relaxed text-[#A8A29A]">
                  This is a private gallery, shared only with the couple by
                  their photographer. Please keep your PIN to yourselves.
                </p>
              </main>
            )}

            {/* bottom tabs */}
            <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#17171A]/95 backdrop-blur">
              <div className="mx-auto grid max-w-3xl grid-cols-4">
                {[
                  ["albums", "Albums", "▦"],
                  ["videos", "Videos", "▶"],
                  ["favs", "Favourites", "♡"],
                  ["more", "More", "⋯"],
                ].map(([key, label, icon]) => (
                  <button
                    key={key}
                    onClick={() => {
                      setOpenFolder(null);
                      setView(key);
                    }}
                    className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition ${
                      view === key || (key === "albums" && view === "folder")
                        ? "text-white"
                        : "text-white/45"
                    }`}
                  >
                    <span className="text-lg leading-none">{icon}</span>
                    {label}
                  </button>
                ))}
              </div>
            </nav>
          </div>
        )}

        {/* ---- viewer ---- */}
        {viewer && (
          <div className="fixed inset-0 z-50 flex flex-col bg-black">
            <div className="flex items-center justify-between px-4 py-3">
              <button
                onClick={() => {
                  setViewer(null);
                  setSheet(null);
                }}
                aria-label="Close"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xl text-white transition hover:bg-white/20"
              >
                ✕
              </button>
              <p className="max-w-[55%] truncate text-sm text-zinc-300">
                {viewer.item.filename}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleFav(viewer.item.id)}
                  aria-label="Favourite"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xl text-white transition hover:bg-white/20"
                >
                  {favs.includes(viewer.item.id) ? "♥" : "♡"}
                </button>
                <button
                  onClick={() => setSheet("download")}
                  aria-label="Download options"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xl text-white transition hover:bg-white/20"
                >
                  ↓
                </button>
              </div>
            </div>

            <div className="relative flex flex-1 items-center justify-center overflow-hidden px-2">
              {viewer.list.length > 1 && (
                <>
                  <button
                    onClick={() => stepViewer(-1)}
                    aria-label="Previous"
                    className="absolute left-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-xl text-white transition hover:bg-black/80"
                  >
                    ‹
                  </button>
                  <button
                    onClick={() => stepViewer(1)}
                    aria-label="Next"
                    className="absolute right-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-xl text-white transition hover:bg-black/80"
                  >
                    ›
                  </button>
                </>
              )}
              {viewer.item.media_type === "video" ? (
                <video
                  key={viewer.item.id}
                  src={viewer.item.url}
                  poster={viewer.item.display_url}
                  controls
                  autoPlay
                  playsInline
                  className="max-h-full max-w-full rounded-md object-contain"
                />
              ) : (
                <img
                  key={viewer.item.id}
                  src={viewer.item.url}
                  alt={viewer.item.filename}
                  className="max-h-full max-w-full rounded-md object-contain"
                />
              )}
            </div>

            {sheet === "download" && (
              <div
                className="absolute inset-0 z-10 flex items-end bg-black/60"
                onClick={() => setSheet(null)}
              >
                <div
                  className="w-full rounded-t-2xl p-5 pb-8"
                  style={{ backgroundColor: CARD }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="text-center text-sm font-semibold text-white/80">
                    Download
                  </p>
                  <button
                    onClick={() => downloadItem(viewer.item, true)}
                    className="mt-4 w-full rounded-full bg-white px-6 py-3.5 text-sm font-semibold transition hover:bg-zinc-200"
                    style={{ color: "#17171A" }}
                  >
                    Download Original
                  </button>
                  <button
                    onClick={() => downloadItem(viewer.item, false)}
                    className="mt-2.5 w-full rounded-full border border-white/25 px-6 py-3.5 text-sm font-semibold text-white transition hover:border-white/60"
                  >
                    Download Optimized
                  </button>
                  <button
                    onClick={() => setSheet(null)}
                    className="mt-2.5 w-full rounded-full bg-white/10 px-6 py-3 text-sm font-medium text-white/80 transition hover:bg-white/20"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function FolderGrid({ title, items, onBack, onOpen, emptyText }) {
  return (
    <main className="mt-2 px-3">
      <div className="flex items-center gap-3 px-1 pb-3 pt-2">
        <button
          onClick={onBack}
          aria-label="Back to albums"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-lg text-white transition hover:bg-white/20"
        >
          ←
        </button>
        <h2 className="text-lg font-bold uppercase tracking-wide">{title}</h2>
        <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-white/80">
          {countLabel(items.length, "Item", "Items")}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="py-16 text-center text-sm text-[#A8A29A]">
          {emptyText || "Nothing here yet."}
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-1">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => onOpen(item, items)}
              className="group relative overflow-hidden rounded-md bg-white/5"
            >
              {item.media_type === "video" ? (
                <span className="relative block aspect-square w-full">
                  <video
                    src={item.url}
                    poster={item.display_url}
                    preload="metadata"
                    muted
                    playsInline
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-sm text-white">
                      ▶
                    </span>
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
            </button>
          ))}
        </div>
      )}
    </main>
  );
}
