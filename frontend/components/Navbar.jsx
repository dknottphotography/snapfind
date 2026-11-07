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
          {user ? (
            <>
              <span className="max-w-[140px] truncate text-sm text-inkdim">
                {user.name}
              </span>
              <button
                onClick={handleLogout}
                className="btn-outline px-4 py-1.5 text-sm"
              >
                Logout
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="btn-solid px-5 py-1.5 text-sm"
            >
              Login
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
