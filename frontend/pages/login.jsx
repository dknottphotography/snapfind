import { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { login, saveAuth, getToken, getUser } from "../lib/api";

// Login in the Ve.ai-style dark premium look (same family as the
// rebuilt couple gallery): split screen — form on the left, brand
// panel with a rotating serif headline on the right. Explicit rgba
// colours throughout: the light-theme override in globals.css rewrites
// text-white / bg-white-* / border-white-* into faint dark tints, so
// those classes must never appear on this dark page.
const serif = { fontFamily: "'Instrument Serif', Georgia, 'Times New Roman', serif" };
const INK = "#17171A";
const SURFACE = "#1E1E21";
const TEAL = "#0F766E";
const PAPER = "#F5F2EC";
const MUTED = "#A8A29A";

const HERO_LINES = [
  "Every couple gets a private gallery.",
  "A 4-digit PIN is the key to the gallery.",
  "Private by design — yours only.",
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [heroLine, setHeroLine] = useState(0);

  useEffect(() => {
    const t = setInterval(
      () => setHeroLine((i) => (i + 1) % HERO_LINES.length),
      4500
    );
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = getToken();
    const u = getUser();
    if (t && u) {
      router.replace(u.role === "admin" ? "/admin" : "/couple-gallery");
    }
  }, [router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await login(email.trim(), password);
      saveAuth(data.token, data.user);
      router.push(data.user.role === "admin" ? "/admin" : "/couple-gallery");
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Log in to SnapFind</title>
        <meta name="theme-color" content="#17171A" />
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap"
          rel="stylesheet"
        />
      </Head>
      <div
        className="flex min-h-[100dvh] flex-col sm:flex-row"
        style={{ backgroundColor: INK, color: PAPER }}
      >
        {/* ---- form panel ---- */}
        <div className="flex flex-1 flex-col px-6 py-6 sm:max-w-[480px] sm:shrink-0 sm:px-10 sm:py-8">
          <Link href="/" className="flex items-center gap-2.5 self-start">
            <img src="/logo-mark.svg" alt="SnapFind logo" className="h-10 w-10" />
            <span className="font-display text-lg font-bold tracking-wide" style={{ color: PAPER }}>
              Snap<span style={{ color: "#2DD4BF" }}>Find</span>
            </span>
          </Link>

          <form
            onSubmit={handleSubmit}
            className="flex flex-1 flex-col justify-center py-10"
          >
            <h1 style={serif} className="text-4xl font-normal sm:text-[42px]">
              Welcome back
            </h1>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: MUTED }}>
              Log in to your photographer studio.
            </p>

            {error && (
              <div className="mt-5 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
                {error}
              </div>
            )}

            <label className="mt-7 block text-sm font-medium" style={{ color: MUTED }}>
              Email
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-[rgba(255,255,255,0.2)] bg-[rgba(255,255,255,0.06)] px-4 py-3 text-sm outline-none transition placeholder:text-[rgba(255,255,255,0.4)] focus:border-[rgba(255,255,255,0.55)]"
                style={{ color: PAPER }}
                placeholder="you@example.com"
              />
            </label>

            <label className="mt-4 block text-sm font-medium" style={{ color: MUTED }}>
              Password
              <div className="relative mt-1.5">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-[rgba(255,255,255,0.2)] bg-[rgba(255,255,255,0.06)] px-4 py-3 pr-16 text-sm outline-none transition placeholder:text-[rgba(255,255,255,0.4)] focus:border-[rgba(255,255,255,0.55)]"
                  style={{ color: PAPER }}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 px-4 text-sm font-medium transition hover:text-[#F5F2EC]"
                  style={{ color: MUTED }}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="mt-7 w-full rounded-xl px-6 py-3.5 text-sm font-semibold tracking-[0.08em] transition hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: TEAL, color: "#ffffff" }}
            >
              {loading ? "Logging in…" : "Log in"}
            </button>

            <p className="mt-5 text-center text-sm" style={{ color: MUTED }}>
              New here?{" "}
              <Link href="/signup" className="font-semibold" style={{ color: "#2DD4BF" }}>
                Create an account
              </Link>
            </p>
          </form>
        </div>

        {/* ---- brand panel ---- */}
        <div
          className="relative flex h-64 shrink-0 flex-col justify-end overflow-hidden px-6 pb-8 sm:h-auto sm:flex-1 sm:px-10 sm:pb-12"
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
            SnapFind · For photographers &amp; couples
          </p>
          <h2
            style={serif}
            className="relative mt-3 max-w-md text-3xl font-normal leading-snug sm:text-4xl"
          >
            {HERO_LINES[heroLine]}
          </h2>
          <p className="relative mt-3 max-w-md text-sm leading-relaxed text-white/60">
            Private galleries by PIN, permanent Cloudinary storage,
            folders and watermarking — no app, no accounts for the couple.
          </p>
          <div className="relative mt-6 flex gap-2" aria-hidden="true">
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
    </>
  );
}
