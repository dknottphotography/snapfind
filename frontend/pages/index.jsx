import Head from "next/head";
import Link from "next/link";
import dynamic from "next/dynamic";
import Navbar from "../components/Navbar";

const Hero3D = dynamic(() => import("../components/Hero3D"), { ssr: false });

const STEPS = [
  {
    n: "1",
    title: "Photographer uploads event photos",
    desc: "The photographer uploads all event pictures to the studio panel. They are stored on your own server — no cloud needed.",
  },
  {
    n: "2",
    title: "Share the QR code",
    desc: "Each event gets a unique QR code. Guests scan it with their phone to join the event in seconds.",
  },
  {
    n: "3",
    title: "Guests check in with a selfie",
    desc: "After a quick signup, each guest uploads one selfie as their Face ID for the event.",
  },
  {
    n: "4",
    title: "AI delivers their personal gallery",
    desc: "DeepFace (RetinaFace + ArcFace) scans every photo on your server and shows each guest only the pictures they're in.",
  },
];

const FEATURES = [
  {
    icon: "💯",
    title: "Free & open-source",
    desc: "No Cloudinary, no AWS, no paid APIs. Just Next.js, Flask, SQLite and your own server.",
  },
  {
    icon: "🧠",
    title: "On-device face AI",
    desc: "DeepFace with RetinaFace detection and ArcFace embeddings matched by cosine similarity — running locally on CPU.",
  },
  {
    icon: "🔒",
    title: "Private by design",
    desc: "Photos live on your server's file system. Guests only ever see their own matches.",
  },
  {
    icon: "📱",
    title: "QR check-in",
    desc: "One scan takes a guest from the venue to their personal gallery. No app install required.",
  },
];

export default function Home() {
  return (
    <>
      <Head>
        <title>SnapFind — AI Photo Finder for Events</title>
        <meta
          name="description"
          content="SnapFind is a free, open-source AI photo finder for events. Guests scan a QR code, upload a selfie, and instantly get their photos."
        />
      </Head>

      <div className="min-h-screen bg-zinc-950 text-white">
        <Navbar />

        {/* ---------- HERO ---------- */}
        <header className="mx-auto grid max-w-7xl items-center gap-8 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-2 lg:pt-20">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
              ⚡ 100% Free &amp; Open Source
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl">
              Every guest finds{" "}
              <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                their photos.
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-zinc-400">
              Photographers upload event pictures. Guests scan a QR code,
              check in with a selfie, and our on-device AI instantly builds
              their personal gallery. No paid APIs. No cloud storage. Just
              yours.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/admin"
                className="rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-7 py-3 font-semibold text-white shadow-lg shadow-fuchsia-500/20 transition hover:opacity-90"
              >
                I&apos;m a Photographer
              </Link>
              <Link
                href="/gallery"
                className="rounded-2xl border border-white/20 px-7 py-3 font-semibold text-zinc-200 transition hover:border-white/40 hover:text-white"
              >
                Find My Photos
              </Link>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm text-zinc-500">
              <span>✅ Free forever</span>
              <span>🧠 On-device AI</span>
              <span>📷 QR sharing</span>
            </div>
          </div>

          <div className="h-[420px] sm:h-[520px]">
            <Hero3D />
          </div>
        </header>

        {/* ---------- HOW IT WORKS ---------- */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <h2 className="text-center text-3xl font-bold">How it works</h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-zinc-400">
            From upload to personal gallery in four simple steps.
          </p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <div
                key={s.n}
                className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/10"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-lg font-bold">
                  {s.n}
                </div>
                <h3 className="mt-4 font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-zinc-400">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------- FEATURES ---------- */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <h2 className="text-center text-3xl font-bold">
            Built for photographers, free for everyone
          </h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/10 transition hover:ring-fuchsia-500/40"
              >
                <div className="text-3xl">{f.icon}</div>
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-zinc-400">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------- FOOTER ---------- */}
        <footer className="border-t border-white/10 py-8">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 text-sm text-zinc-500 sm:flex-row sm:px-6">
            <span>
              <span className="bg-gradient-to-r from-violet-300 to-fuchsia-300 bg-clip-text font-bold text-transparent">
                SnapFind
              </span>{" "}
              — AI photo finder for events
            </span>
            <span>100% free &amp; open-source. Your photos stay on your server.</span>
          </div>
        </footer>
      </div>
    </>
  );
}
