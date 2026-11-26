import Head from "next/head";
import Link from "next/link";
import Navbar from "../components/Navbar";

// Moments — private galleries for couples. Dark premium landing
// (Ve.ai family). No animation libraries, no 3D scene: plain sections
// on the dark tokens. Explicit rgba colours throughout: the light-theme
// override in globals.css rewrites text-white / bg-white-* /
// border-white-* into faint dark tints, so those classes must never
// appear on this dark page.
const serif = { fontFamily: "'Instrument Serif', Georgia, 'Times New Roman', serif" };
const INK = "#0a0c10";
const PANEL = "#12151b";
const TEAL = "#0F766E";
const TEAL_BRIGHT = "#2DD4BF";
const GREEN = "#30a46c";
const PAPER = "#F5F2EC";
const MUTED = "#A8A29A";

const STEPS = [
  {
    n: "01",
    title: "Photographer creates the gallery",
    desc: "All it needs is the couple's name — Ananya & Rohan, and the gallery exists. Photos and videos go in, organised into folders like Haldi, Wedding and Reception.",
  },
  {
    n: "02",
    title: "Set a 4-digit PIN",
    desc: "One PIN protects the whole gallery. Change it any time — the couple is signed out immediately. Send the PIN in a separate message from the link.",
  },
  {
    n: "03",
    title: "Share the link or QR",
    desc: "Every gallery gets its own private link and a QR code. Send it on WhatsApp or print the QR — the couple scans it and they're at the door.",
  },
  {
    n: "04",
    title: "Couple opens, enters PIN, downloads",
    desc: "No account, no app, no signup. The couple opens the link, types the 4-digit PIN, and views or downloads their photos and videos — originals included.",
  },
];

const FEATURES = [
  {
    icon: "◈",
    title: "Private by PIN",
    desc: "Nothing about a gallery is visible before the right 4-digit PIN. No browsing, no guessing, no accounts for the couple.",
  },
  {
    icon: "⬢",
    title: "Permanent Cloudinary storage",
    desc: "Photos and videos live on Cloudinary, not on a server disk that gets wiped on restart. The gallery stays up as long as you need it.",
  },
  {
    icon: "▤",
    title: "Folders for every ceremony",
    desc: "Pre-Wedding, Haldi, Mehndi, Sangeet, Wedding, Reception — or a custom folder of your own. The couple browses albums, not one endless grid.",
  },
  {
    icon: "✦",
    title: "Watermarked delivery",
    desc: "Every photo is delivered with your studio watermark, bottom-left. The clean original is never exposed — downloads stay yours.",
  },
];

export default function Home() {
  return (
    <>
      <Head>
        <title>Moments: Private galleries for couples</title>
        <meta
          name="description"
          content="Moments Private Galleries: photographers create a private gallery from the couple's name, set a 4-digit PIN, and share the link or QR. The couple opens it, enters the PIN, and downloads their photos — no app, no account."
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap"
          rel="stylesheet"
        />
      </Head>

      <div className="min-h-screen" style={{ backgroundColor: INK, color: PAPER }}>
        <Navbar />

        {/* ---------------- HERO ---------------- */}
        <section className="mx-auto max-w-6xl px-4 pb-20 pt-20 text-center sm:px-6 sm:pt-28">
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.3em]"
            style={{ color: TEAL_BRIGHT }}
          >
            Moments · Private Galleries
          </p>
          <h1
            style={serif}
            className="mx-auto mt-5 max-w-3xl text-5xl font-normal leading-[1.08] sm:text-7xl"
          >
            Every couple gets a{" "}
            <span style={{ color: TEAL_BRIGHT }}>private gallery.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed sm:text-lg" style={{ color: MUTED }}>
            The photographer creates a gallery from the couple&apos;s name,
            sets a 4-digit PIN, and shares a link. The couple opens it,
            enters the PIN, and downloads their moments — no app, no account,
            no endless scrolling.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/couple-gallery"
              className="rounded-xl px-8 py-4 text-base font-semibold transition hover:opacity-90"
              style={{ backgroundColor: TEAL, color: "#ffffff" }}
            >
              Open my gallery →
            </Link>
            <Link
              href="/login"
              className="rounded-xl border border-[rgba(255,255,255,0.2)] px-8 py-4 text-base font-semibold transition hover:border-[rgba(255,255,255,0.45)]"
              style={{ color: PAPER }}
            >
              Photographer login
            </Link>
          </div>
        </section>

        {/* ---------------- HOW IT WORKS ---------------- */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.3em]"
            style={{ color: TEAL_BRIGHT }}
          >
            How it works
          </p>
          <h2 style={serif} className="mt-3 max-w-2xl text-3xl font-normal leading-tight sm:text-5xl">
            From shoot to the couple&apos;s hands in four steps.
          </h2>
          <div className="mt-12 grid gap-5 sm:grid-cols-2">
            {STEPS.map((s) => (
              <div
                key={s.n}
                className="rounded-2xl border border-[rgba(255,255,255,0.1)] p-7"
                style={{ backgroundColor: PANEL }}
              >
                <p className="text-sm font-semibold" style={{ color: TEAL_BRIGHT }}>
                  Step {s.n}
                </p>
                <h3 style={serif} className="mt-3 text-2xl font-normal leading-snug">
                  {s.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed" style={{ color: MUTED }}>
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------------- FEATURES ---------------- */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.3em]"
            style={{ color: TEAL_BRIGHT }}
          >
            Why private galleries
          </p>
          <h2 style={serif} className="mt-3 max-w-2xl text-3xl font-normal leading-tight sm:text-5xl">
            Built for photographers, simple for couples.
          </h2>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-[rgba(255,255,255,0.1)] p-7"
                style={{ backgroundColor: PANEL }}
              >
                <div className="text-3xl" style={{ color: TEAL_BRIGHT }}>
                  {f.icon}
                </div>
                <h3 style={serif} className="mt-5 text-xl font-normal leading-snug">
                  {f.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed" style={{ color: MUTED }}>
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------------- FINALE ---------------- */}
        <section className="mx-auto max-w-6xl px-4 pb-24 pt-16 text-center sm:px-6">
          <h2 style={serif} className="mx-auto max-w-3xl text-4xl font-normal leading-tight sm:text-6xl">
            Your photos, <span style={{ color: TEAL_BRIGHT }}>beautifully kept.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed" style={{ color: MUTED }}>
            Got a gallery link from your photographer? Open it and enter
            your PIN. Shooting a wedding? Log in and create your first
            gallery.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/couple-gallery"
              className="rounded-xl px-8 py-4 text-base font-semibold transition hover:opacity-90"
              style={{ backgroundColor: TEAL, color: "#ffffff" }}
            >
              Open my gallery →
            </Link>
            <Link
              href="/signup"
              className="rounded-xl border border-[rgba(255,255,255,0.2)] px-8 py-4 text-base font-semibold transition hover:border-[rgba(255,255,255,0.45)]"
              style={{ color: PAPER }}
            >
              Create account
            </Link>
          </div>
        </section>

        <footer className="border-t border-[rgba(255,255,255,0.1)] py-6">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 text-xs sm:flex-row sm:px-6" style={{ color: MUTED }}>
            <span className="flex items-center gap-2 font-display font-bold" style={{ color: PAPER }}>
              <img src="/logo-mark.svg" alt="" className="h-6 w-6" />
              Moments
            </span>
            <span>Private galleries. Your photos stay yours.</span>
          </div>
        </footer>
      </div>
    </>
  );
}
