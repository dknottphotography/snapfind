import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Head from "next/head";
import Navbar from "../components/Navbar";
import { getEventPublic } from "../lib/api";

// Static-export friendly: the event slug comes from ?event=<slug>
// (QR codes point here). Works the same in `next dev` and in the export.
export default function Join() {
  const router = useRouter();
  const [slug, setSlug] = useState(null);
  const [event, setEvent] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!router.isReady) return;
    const s = router.query.event;
    if (!s || typeof s !== "string") {
      setNotFound(true);
      return;
    }
    setSlug(s);
    try {
      localStorage.setItem("eventSlug", s);
    } catch {}
    getEventPublic(s)
      .then((d) => setEvent(d.event))
      .catch(() => setNotFound(true));
  }, [router.isReady, router.query]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <Head>
        <title>Join event — SnapFind</title>
      </Head>
      <Navbar />
      <main className="mx-auto flex max-w-lg flex-col items-center px-6 py-24 text-center">
        {notFound ? (
          <div className="rounded-2xl bg-white/5 p-10 ring-1 ring-white/10">
            <h1 className="text-2xl font-bold">Event not found</h1>
            <p className="mt-3 text-zinc-400">
              This invite link looks invalid or expired. Ask your photographer
              for a fresh QR code.
            </p>
            <Link
              href="/"
              className="mt-6 inline-block rounded-xl bg-white/10 px-6 py-3 font-semibold hover:bg-white/15"
            >
              Back home
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl bg-white/5 p-10 ring-1 ring-white/10">
            <p className="text-sm font-semibold uppercase tracking-widest text-fuchsia-400">
              You&apos;re invited
            </p>
            <h1 className="mt-3 text-3xl font-bold">
              {event ? event.name : "Loading your event…"}
            </h1>
            <p className="mt-3 text-zinc-400">
              Create a free account, check in with a selfie, and our AI will
              find every photo you appear in.
            </p>
            <div className="mt-8 flex flex-col gap-3">
              <Link
                href="/signup"
                className="rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-6 py-3 font-semibold text-white hover:opacity-90"
              >
                Create account
              </Link>
              <Link
                href="/login"
                className="rounded-xl bg-white/10 px-6 py-3 font-semibold hover:bg-white/15"
              >
                I already have an account — log in
              </Link>
            </div>
            {slug && (
              <p className="mt-6 text-xs text-zinc-500">Event code: {slug}</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
