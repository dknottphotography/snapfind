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
    <nav className="sticky inset-x-0 top-0 z-40 border-b border-white/10 bg-abyss/60 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="font-display flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-bio-teal to-uv-magenta text-base font-extrabold text-abyss shadow-[0_0_20px_rgba(45,212,191,0.45)] transition group-hover:shadow-[0_0_28px_rgba(232,121,249,0.6)]">
            S
          </span>
          <span className="font-display text-lg font-bold tracking-wide text-ink">
            SnapFind <span className="text-bio-cyan">✦</span>
          </span>
        </Link>

        <div className="hidden items-center gap-7 text-sm text-inkdim sm:flex">
          <Link href="/" className="transition hover:text-bio-cyan">
            Home
          </Link>
          <Link href="/gallery" className="transition hover:text-bio-cyan">
            My Gallery
          </Link>
          <Link href="/couple-gallery" className="transition hover:text-bio-cyan">
            Couple&apos;s Gallery
          </Link>
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <span className="max-w-[140px] truncate text-sm text-inkdim">
                {user.name}
              </span>
              <button
                onClick={handleLogout}
                className="btn-ghost rounded-xl px-4 py-1.5 text-sm font-medium"
              >
                Logout
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="btn-bio rounded-xl px-5 py-1.5 text-sm"
            >
              Login
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
