import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Head from "next/head";
import Navbar from "../components/Navbar";
import AmbientAbyss from "../components/AmbientAbyss";
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
    <div className="min-h-screen bg-abyss text-ink">
      <AmbientAbyss />
      <Head>
        <title>Join event: SnapFind</title>
      </Head>
      <Navbar />
      <main className="relative z-10 mx-auto flex max-w-lg flex-col items-center px-6 py-24 text-center">
        {notFound ? (
          <div className="glass-deep rounded-3xl p-10">
            <h1 className="font-display text-2xl font-bold">Event not found</h1>
            <p className="mt-3 text-inkdim">
              This invite link looks invalid or expired. Ask your photographer
              for a fresh QR code.
            </p>
            <Link
              href="/"
              className="btn-ghost mt-6 inline-block rounded-xl px-6 py-3 font-semibold"
            >
              Back home
            </Link>
          </div>
        ) : (
          <div className="glass-deep rounded-3xl p-10">
            <h1 className="font-display mt-3 text-3xl font-bold">
              {event ? event.name : "Loading your event…"}
            </h1>
            <p className="mt-3 text-inkdim">
              Create a free account, check in with a selfie, and our AI will
              find every photo you appear in.
            </p>
            <div className="mt-8 flex flex-col gap-3">
              <Link
                href="/signup"
                className="btn-bio rounded-xl px-6 py-3"
              >
                Create account
              </Link>
              <Link
                href="/login"
                className="btn-ghost rounded-xl px-6 py-3 font-semibold"
              >
                I already have an account. Log in
              </Link>
            </div>
            {slug && (
              <p className="mt-6 text-xs text-inkdim">Event code: <span className="text-bio-cyan">{slug}</span></p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
