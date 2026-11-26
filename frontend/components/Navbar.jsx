import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { getUser, clearAuth } from "../lib/api";

// Dark premium navbar (Ve.ai family). Explicit rgba colours: the
// light-theme override in globals.css rewrites text-white / bg-white-* /
// border-white-* into faint dark tints, so those classes never appear here.
const PAPER = "#F5F2EC";
const MUTED = "#A8A29A";
const TEAL = "#0F766E";

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

  // Admins don't use the couple's gallery, so hide its link for them.
  // Guests and logged-out visitors still see it.
  const isAdmin = user?.role === "admin";

  return (
    <nav
      className="sticky inset-x-0 top-0 z-40 border-b border-[rgba(255,255,255,0.1)] bg-[rgba(10,12,16,0.8)] backdrop-blur-xl"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="group flex items-center gap-2.5">
          <img src="/logo-mark.svg" alt="Moments logo" className="h-10 w-10" />
          <span className="font-display text-lg font-bold tracking-wide" style={{ color: PAPER }}>
            Moments
          </span>
        </Link>

        <div className="hidden items-center gap-7 text-sm sm:flex" style={{ color: MUTED }}>
          <Link href="/" className="transition hover:text-[#F5F2EC]">
            Home
          </Link>
          {!isAdmin && (
            <Link href="/couple-gallery" className="transition hover:text-[#F5F2EC]">
              My Gallery
            </Link>
          )}
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <span className="max-w-[140px] truncate text-sm" style={{ color: MUTED }}>
                {user.name}
              </span>
              <button
                onClick={handleLogout}
                className="rounded-lg border border-[rgba(255,255,255,0.2)] px-4 py-1.5 text-sm font-medium transition hover:border-[rgba(255,255,255,0.45)]"
                style={{ color: PAPER }}
              >
                Logout
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-lg px-5 py-1.5 text-sm font-semibold transition hover:opacity-90"
              style={{ backgroundColor: TEAL, color: "#ffffff" }}
            >
              Login
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
