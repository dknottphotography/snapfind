import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { getUser, clearAuth } from "../lib/api";

export default function Navbar() {
  const router = useRouter();
  const [user, setUser] = useState(null);

  useEffect(() => {
    setUser(getUser());
  }, []);

  const handleLogout = () => {
    clearAuth();
    setUser(null);
    router.push("/");
  };

  return (
    <nav className="sticky top-0 z-40 border-b border-white/10 bg-zinc-950/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-lg font-bold">
            S
          </span>
          <span className="bg-gradient-to-r from-violet-300 to-fuchsia-300 bg-clip-text text-xl font-extrabold text-transparent">
            SnapFind
          </span>
        </Link>

        <div className="hidden items-center gap-6 text-sm text-zinc-400 sm:flex">
          <Link href="/" className="transition hover:text-white">
            Home
          </Link>
          <Link href="/admin" className="transition hover:text-white">
            Photographer
          </Link>
          <Link href="/gallery" className="transition hover:text-white">
            My Gallery
          </Link>
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <span className="max-w-[140px] truncate text-sm text-zinc-300">
                {user.name}
              </span>
              <button
                onClick={handleLogout}
                className="rounded-xl border border-white/15 px-4 py-1.5 text-sm text-zinc-300 transition hover:border-white/30 hover:text-white"
              >
                Logout
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-1.5 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Login
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
