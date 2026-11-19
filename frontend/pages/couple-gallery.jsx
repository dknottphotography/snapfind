import { useEffect, useMemo, useRef, useState } from "react";
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
// Dark, premium couple's gallery in the style of the photographer's
// reference experience (Pic-Time-style): split-screen entry / PIN
// (brand panel + rotating photo hero) -> 4 separate PIN boxes ->
// album cards with the cover on top and the name below -> photo grid
// -> viewer with Original / Optimized download choices.
// No SnapFind branding, no links back to SnapFind.
// Flow: open private link -> ENTER -> PIN -> albums.
// No account, no signup.

const serif = { fontFamily: "'Cormorant Garamond', Georgia, 'Times New Roman', serif" };
const INK = "#17171A";
const SURFACE = "#1E1E21";
const TEAL = "#0F766E";
const FAV_KEY = (slug) => `snapfind:favs:${slug}`;

// Rotating headlines on the entry / PIN hero panels.
const HERO_LINES = [
  "Your moments, beautifully kept.",
  "Every frame, yours to keep.",
  "A private gallery, made for two.",
];

function countLabel(n, singular = "Photo", plural = "Photos") {
  return `${n} ${n === 1 ? singular : plural}`;
}

// Four separate PIN boxes (reference-style OTP entry): typing fills
// left to right, Backspace moves back, pasting 4 digits fills all.
function PinBoxes({ value, onChange, disabled }) {
  const refs = useRef([]);
  const digits = [0, 1, 2, 3].map((i) => value[i] || "");
  const setAt = (i, d) => {
    const next = (value + "    ").slice(0, 4).split("");
    next[i] = d;
    onChange(next.join("").replace(/ /g, "").slice(0, 4));
  };
  return (
    <div className="flex gap-3">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          value={d}
          disabled={disabled}
          inputMode="numeric"
          autoComplete="one-time-code"
          aria-label={`PIN digit ${i + 1}`}
          maxLength={1}
          onChange={(e) => {
            const ch = e.target.value.replace(/\D/g, "").slice(-1);
            if (!ch) return;
            setAt(i, ch);
            if (i < 3) refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace") {
              e.preventDefault();
              if (digits[i]) {
                setAt(i, "");
              } else if (i > 0) {
                refs.current[i - 1]?.focus();
                setAt(i - 1, "");
              }
            } else if (e.key === "ArrowLeft" && i > 0) {
              refs.current[i - 1]?.focus();
            } else if (e.key === "ArrowRight" && i < 3) {
              refs.current[i + 1]?.focus();
            }
          }}
          onPaste={(e) => {
            e.preventDefault();
            const text = (e.clipboardData.getData("text") || "")
              .replace(/\D/g, "")
              .slice(0, 4);
            if (text) onChange(text);
            refs.current[Math.min(text.length, 3)]?.focus();
          }}
          onFocus={(e) => e.target.select()}
          // Explicit rgba colours, NOT border-white/*/bg-white/*: the
          // light-theme override in globals.css turns those into faint
          // dark tints, which made the boxes invisible on this dark page
          // and the typed digit dark-on-dark.
          className={`h-14 w-12 rounded-xl border text-center text-2xl font-semibold text-[#F5F2EC] outline-none transition focus:border-[rgba(255,255,255,0.6)] disabled:opacity-40 sm:h-16 sm:w-14 ${
            d
              ? "border-[rgba(255,255,255,0.45)] bg-[rgba(255,255,255,0.12)]"
              : "border-[rgba(255,255,255,0.25)] bg-[rgba(255,255,255,0.06)]"
          }`}
        />
      ))}
    </div>
  );
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

  // Rotating headline on the entry / PIN hero panels.
  const [heroLine, setHeroLine] = useState(0);
  useEffect(() => {
    if (view !== "pin" && slug) return;
    const t = setInterval(
      () => setHeroLine((i) => (i + 1) % HERO_LINES.length),
      4500
    );
    return () => clearInterval(t);
  }, [view, slug]);

  // Physical keyboard support on the PIN screen when no box is focused
  // (the boxes handle their own keys once focused).
  useEffect(() => {
    if (view !== "pin") return;
    const onKey = (e) => {
      const tag = e.target && e.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
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

        {/* ---- no link yet: split-screen entry ---- */}
        {!slug && !infoLoading && (
          <div className="flex min-h-[100dvh] flex-col sm:flex-row">
            {/* visual panel */}
            <div
              className="relative flex h-60 shrink-0 flex-col justify-end overflow-hidden px-6 pb-8 sm:h-auto sm:flex-1 sm:px-10 sm:pb-12"
              style={{
                background:
                  "radial-gradient(110% 90% at 20% 0%, #1E3A34 0%, #17171A 55%, #101012 100%)",
              }}
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full opacity-25 blur-3xl"
                style={{ background: TEAL }}
              />
              <p className="relative text-[11px] font-semibold uppercase tracking-[0.3em] text-white/50">
                DKNOTT Photography
              </p>
              <h2
                style={serif}
                className="relative mt-3 max-w-md text-3xl font-semibold leading-snug sm:text-4xl"
              >
                {HERO_LINES[heroLine]}
              </h2>
              <div className="relative mt-5 flex gap-2" aria-hidden="true">
                {HERO_LINES.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Show headline ${i + 1}`}
                    onClick={() => setHeroLine(i)}
                    className={`h-1.5 rounded-full transition-all ${
                      i === heroLine ? "w-7 bg-white" : "w-1.5 bg-white/30"
                    }`}
                  />
                ))}
              </div>
            </div>
            {/* form panel */}
            <div className="flex flex-1 flex-col justify-center px-6 py-12 sm:max-w-[480px] sm:shrink-0 sm:px-10">
              <p style={serif} className="text-4xl font-semibold sm:text-[42px]">
                Your private gallery
              </p>
              <p className="mt-3 leading-relaxed text-[#A8A29A]">
                Your photographer sent you a private link. Paste it below,
                or type your event code, then enter the PIN to open your
                photos and videos.
              </p>
              <ul className="mt-6 space-y-2.5 text-sm text-white/75">
                {[
                  "Only your moments — face-matched to you",
                  "Download originals in one tap",
                  "Private by PIN. No account, no signup.",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2.5">
                    <span aria-hidden="true" className="mt-0.5 text-[#2DD4BF]">✓</span>
                    {t}
                  </li>
                ))}
              </ul>
              <form onSubmit={handleOpenGallery} className="mt-8 w-full">
                <input
                  value={codeInput}
                  onChange={(e) => {
                    setCodeInput(e.target.value);
                    setCodeError("");
                  }}
                  placeholder="Paste your gallery link or event code"
                  className="w-full rounded-xl border border-[rgba(255,255,255,0.25)] bg-[rgba(255,255,255,0.06)] px-4 py-3.5 text-sm text-[#F5F2EC] outline-none transition placeholder:text-[#A8A29A] focus:border-[rgba(255,255,255,0.6)]"
                />
                <button
                  type="submit"
                  disabled={!codeInput.trim()}
                  className="mt-3 w-full rounded-xl px-6 py-3.5 text-sm font-semibold tracking-[0.12em] transition hover:opacity-90 disabled:opacity-40"
                  style={{ backgroundColor: TEAL, color: "#ffffff" }}
                >
                  ENTER
                </button>
              </form>
              {codeError && (
                <p className="mt-3 text-sm text-[#F87171]">{codeError}</p>
              )}
            </div>
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
              <p className="mt-3">
                <span className="inline-block rounded-full bg-black/50 px-3 py-1 text-xs font-medium text-white/90">
                  {countLabel(mediaCount)}
                </span>
              </p>
              <button
                onClick={() => setView("pin")}
                className="mt-6 w-36 rounded-full px-6 py-3 text-sm font-semibold tracking-[0.15em] transition hover:opacity-90"
                style={{ backgroundColor: TEAL, color: "#ffffff" }}
              >
                ENTER
              </button>
            </div>
          </div>
        )}

        {/* ---- PIN: split-screen, separate boxes ---- */}
        {slug && eventInfo && !unlocked && view === "pin" && !infoLoading && (
          <div className="flex min-h-[100dvh] flex-col sm:flex-row">
            {/* form panel */}
            <div className="flex flex-1 flex-col px-6 py-5 sm:max-w-[480px] sm:shrink-0 sm:px-10 sm:py-6">
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

              <div className="flex flex-1 flex-col justify-center py-10">
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/50">
                  DKNOTT Photography
                </p>
                <h1
                  style={serif}
                  className="mt-3 text-3xl font-semibold uppercase leading-tight tracking-wide sm:text-4xl"
                >
                  {eventInfo.name}
                </h1>
                <p className="mt-2 text-sm text-white/60">
                  {countLabel(mediaCount)} · Private gallery
                </p>

                <p className="mt-8 text-[12px] font-semibold uppercase tracking-[0.25em] text-white/70">
                  Enter your 4-digit PIN
                </p>
                <div className="mt-4">
                  <PinBoxes
                    value={pin}
                    disabled={unlocking}
                    onChange={(v) => {
                      setPin(v);
                      setUnlockError("");
                    }}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => attemptUnlock(pin)}
                  disabled={unlocking || pin.length !== 4}
                  className="mt-7 w-full rounded-xl px-6 py-3.5 text-sm font-semibold tracking-[0.12em] transition hover:opacity-90 disabled:opacity-40 sm:max-w-[320px]"
                  style={{ backgroundColor: TEAL, color: "#ffffff" }}
                >
                  {unlocking ? "CHECKING…" : "CONTINUE"}
                </button>

                {unlockError && (
                  <p className="mt-4 text-sm text-[#FCA5A5]">
                    Wrong PIN — ask your photographer for the gallery PIN.
                  </p>
                )}
                <p className="mt-8 max-w-[320px] text-[11px] leading-relaxed text-white/45">
                  By continuing further you consent to our Terms and
                  Conditions and Privacy Policy.
                </p>
              </div>
            </div>

            {/* photo hero panel */}
            <div className="relative flex h-64 shrink-0 flex-col justify-end overflow-hidden sm:h-auto sm:flex-1">
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
                      "radial-gradient(110% 90% at 20% 0%, #1E3A34 0%, #17171A 55%, #101012 100%)",
                  }}
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/20" />
              <div className="relative px-6 pb-8 sm:px-10 sm:pb-12">
                <h2
                  style={serif}
                  className="max-w-md text-3xl font-semibold leading-snug sm:text-4xl"
                >
                  {HERO_LINES[heroLine]}
                </h2>
                <div className="mt-5 flex gap-2" aria-hidden="true">
                  {HERO_LINES.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      aria-label={`Show headline ${i + 1}`}
                      onClick={() => setHeroLine(i)}
                      className={`h-1.5 rounded-full transition-all ${
                        i === heroLine ? "w-7 bg-white" : "w-1.5 bg-white/30"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---- unlocked: albums / videos / favourites / more ---- */}
        {slug && eventInfo && unlocked && !infoLoading && (
          <div className="mx-auto flex min-h-[100dvh] w-full max-w-3xl flex-col pb-24">
            <header className="relative border-b border-white/10 px-4 pb-4 pt-6 text-center">
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
                        className="block w-full overflow-hidden rounded-2xl border border-white/10 text-left transition hover:border-white/25"
                        style={{ backgroundColor: SURFACE }}
                      >
                        {coverUrl && (
                          <img
                            src={coverUrl}
                            alt={name}
                            className="aspect-[16/10] w-full object-cover"
                            loading="lazy"
                          />
                        )}
                        <div className="flex items-center justify-between gap-3 px-4 py-3.5">
                          <div className="min-w-0">
                            <p className="truncate text-base font-bold uppercase tracking-wide">
                              {name}
                            </p>
                            <p className="mt-0.5 text-xs text-white/50">
                              {countLabel(
                                items.length,
                                hasVideo ? "Item" : "Photo",
                                hasVideo ? "Items" : "Photos"
                              )}
                            </p>
                          </div>
                          <span
                            aria-hidden="true"
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm text-white/80"
                          >
                            ›
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
                ].map(([key, label, icon]) => {
                  const active =
                    view === key || (key === "albums" && view === "folder");
                  return (
                  <button
                    key={key}
                    onClick={() => {
                      setOpenFolder(null);
                      setView(key);
                    }}
                    className="flex justify-center py-2"
                  >
                    <span
                      className={`flex flex-col items-center gap-0.5 rounded-full px-4 py-1.5 text-[11px] font-medium transition ${
                        active ? "bg-white/10 text-white" : "text-white/45"
                      }`}
                    >
                      <span className="text-lg leading-none">{icon}</span>
                      {label}
                    </span>
                  </button>
                  );
                })}
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
                  className="w-full rounded-t-2xl border-t border-white/10 p-5 pb-8"
                  style={{ backgroundColor: SURFACE }}
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
                    className="mt-2.5 w-full rounded-full border border-white/25 px-6 py-3.5 text-sm font-semibold text-[#F5F2EC] transition hover:border-white/60"
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
        <div className="grid grid-cols-3 gap-2">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => onOpen(item, items)}
              className="group relative overflow-hidden rounded-xl bg-white/5 transition hover:ring-1 hover:ring-white/30"
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
