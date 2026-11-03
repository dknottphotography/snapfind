import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { getUser, clearAuth } from "../lib/api";

export default function Navbar() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    setUser(getUser());
    setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
  }, []);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("snapfind-theme", next);
    } catch (e) {}
    setTheme(next);
  };

  const handleLogout = () => {
    clearAuth();
    setUser(null);
    router.push("/");
  };

  return (
    <nav className="sticky inset-x-0 top-0 z-40 border-b border-white/10 bg-abyss/60 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="group flex items-center gap-2.5">
          <img src="/logo-mark.svg" alt="SnapFind logo" className="h-10 w-10" />
          <span className="font-display text-lg font-bold tracking-wide text-ink">
            Snap<span className="text-bio-teal">Find</span>
          </span>
        </Link>

        <div className="hidden items-center gap-7 text-sm text-inkdim sm:flex">
          <Link href="/" className="transition hover:text-bio-cyan">
            Home
          </Link>
          <Link href="/gallery" className="transition hover:text-bio-cyan">
            My Gallery
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
            title={theme === "light" ? "Dark theme" : "Light theme"}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-inkdim transition hover:text-bio-cyan"
          >
            {theme === "light" ? (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            ) : (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
              </svg>
            )}
          </button>
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
