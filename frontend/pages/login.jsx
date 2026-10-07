import { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import Navbar from "../components/Navbar";
import { login, saveAuth, getToken, getUser } from "../lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      <div className="min-h-screen bg-zinc-950 text-white">
        <Navbar />
        <main className="mx-auto flex max-w-md items-center justify-center px-4 py-20">
          <form
            onSubmit={handleSubmit}
            className="w-full rounded-2xl bg-white/5 p-8 ring-1 ring-white/10"
          >
            <h1 className="text-2xl font-bold">Welcome back 👋</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Log in to find your event photos.
            </p>

            {error && (
              <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
                {error}
              </div>
            )}

            <label className="mt-6 block text-sm font-medium text-zinc-300">
              Email
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-zinc-900 px-4 py-2.5 text-white outline-none transition focus:border-fuchsia-500"
                placeholder="you@example.com"
              />
            </label>

            <label className="mt-4 block text-sm font-medium text-zinc-300">
              Password
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-zinc-900 px-4 py-2.5 text-white outline-none transition focus:border-fuchsia-500"
                placeholder="••••••••"
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              className="mt-6 w-full rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Logging in…" : "Log in"}
            </button>

            <p className="mt-4 text-center text-sm text-zinc-400">
              New here?{" "}
              <Link href="/signup" className="font-semibold text-fuchsia-300 hover:underline">
                Create an account
              </Link>
            </p>
          </form>
        </main>
      </div>
    </>
  );
}
