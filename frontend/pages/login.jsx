import { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import Navbar from "../components/Navbar";
import AmbientAbyss from "../components/AmbientAbyss";
import { login, saveAuth, getToken, getUser } from "../lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = getToken();
    const u = getUser();
    if (t && u) {
      router.replace(u.role === "admin" ? "/admin" : "/gallery");
    }
  }, [router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await login(email.trim(), password);
      saveAuth(data.token, data.user);
      router.push(data.user.role === "admin" ? "/admin" : "/gallery");
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Log in — SnapFind</title>
      </Head>
      <div className="min-h-screen bg-abyss text-ink">
        <AmbientAbyss />
        <Navbar />
        <main className="relative z-10 mx-auto flex max-w-md items-center justify-center px-4 py-20">
          <form
            onSubmit={handleSubmit}
            className="glass-deep w-full rounded-3xl p-8"
          >
            <p className="eyebrow">✦ &nbsp;Enter the abyss</p>
            <h1 className="font-display mt-3 text-2xl font-bold">Welcome back</h1>
            <p className="mt-1 text-sm text-inkdim">
              Log in to find your event photos.
            </p>

            {error && (
              <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
                {error}
              </div>
            )}

            <label className="mt-6 block text-sm font-medium text-inkdim">
              Email
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-abyss/60 px-4 py-2.5 text-ink outline-none transition focus:border-bio-cyan"
                placeholder="you@example.com"
              />
            </label>

            <label className="mt-4 block text-sm font-medium text-inkdim">
              Password
              <div className="relative mt-1">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-abyss/60 px-4 py-2.5 pr-12 text-ink outline-none transition focus:border-bio-cyan"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 px-4 text-sm font-medium text-inkdim transition hover:text-bio-cyan"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="btn-bio mt-6 w-full rounded-xl py-3 disabled:opacity-50"
            >
              {loading ? "Logging in…" : "Log in"}
            </button>

            <p className="mt-4 text-center text-sm text-inkdim">
              New here?{" "}
              <Link href="/signup" className="font-semibold text-bio-cyan hover:underline">
                Create an account
              </Link>
            </p>
          </form>
        </main>
      </div>
    </>
  );
}
