import { useEffect } from "react";
import Head from "next/head";
import Link from "next/link";
import dynamic from "next/dynamic";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { motion } from "framer-motion";
import Navbar from "../components/Navbar";
import { scrollRig } from "../lib/scrollRig";

const CinematicScene = dynamic(() => import("../components/CinematicScene"), {
  ssr: false,
});

gsap.registerPlugin(ScrollTrigger);

const STEPS = [
  {
    n: "01",
    side: "left",
    title: "The photographer uploads",
    desc: "Thousands of event photos flow into the studio. Faces are detected right in the browser, so the server never breaks a sweat, and the free tier never blinks.",
  },
  {
    n: "02",
    side: "right",
    title: "One QR to join",
    desc: "Every event gets a living QR code. Guests point their camera, and they're inside. No app to install, no account maze.",
  },
  {
    n: "03",
    side: "left",
    title: "A selfie becomes the key",
    desc: "One front-camera selfie registers your Face ID. The camera opens right inside the page. Private, instant, yours.",
  },
  {
    n: "04",
    side: "right",
    title: "Your gallery finds you",
    desc: "The AI compares your Face ID against every face in every photo, group shots included, and assembles only the moments you're in.",
  },
];

const FEATURES = [
  {
    icon: "✦",
    title: "Free forever",
    desc: "Free forever, with no paid APIs, no cloud bills, and no cards. Just open technology on the free tier.",
  },
  {
    icon: "◉",
    title: "On-device AI",
    desc: "Face detection runs in the browser itself, fast, private, and infinitely scalable.",
  },
  {
    icon: "⬢",
    title: "Private by design",
    desc: "Guests see only their own matches. Nobody browses anyone else's moments.",
  },
  {
    icon: "⟡",
    title: "Zero install",
    desc: "QR in, gallery out. It lives entirely in the browser you already have.",
  },
];

function StepPanel({ step }) {
  const align = step.side === "left" ? "lg:mr-auto lg:ml-0" : "lg:ml-auto lg:mr-0";
  return (
    <section className="relative z-10 flex min-h-screen items-center px-4 sm:px-8">
      <div className={`reveal glass-deep w-full max-w-md rounded-3xl p-8 sm:p-10 ${align}`}>
        <p className="eyebrow">Step {step.n}</p>
        <h2 className="font-display mt-4 text-2xl font-bold leading-snug sm:text-3xl">
          {step.title}
        </h2>
        <p className="mt-4 leading-relaxed text-inkdim">{step.desc}</p>
      </div>
    </section>
  );
}

export default function Home() {
  useEffect(() => {
    scrollRig.progress = 0;

    const tween = gsap.to(scrollRig, {
      progress: 1,
      ease: "none",
      scrollTrigger: {
        trigger: "#cinematic-scroll",
        start: "top top",
        end: "bottom bottom",
        scrub: 1.2,
      },
    });

    const onMove = (e) => {
      scrollRig.mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      scrollRig.mouseY = -((e.clientY / window.innerHeight - 0.5) * 2);
    };
    window.addEventListener("mousemove", onMove);

    const reveals = gsap.utils.toArray(".reveal").map((el) =>
      gsap.fromTo(
        el,
        { y: 70, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 1,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 85%" },
        }
      )
    );

    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
      reveals.forEach((r) => {
        r.scrollTrigger?.kill();
        r.kill();
      });
      window.removeEventListener("mousemove", onMove);
      ScrollTrigger.getAll().forEach((st) => st.kill());
    };
  }, []);

  return (
    <>
      <Head>
        <title>SnapFind: Every guest finds their photos</title>
        <meta
          name="description"
          content="SnapFind is a free AI photo finder for events. Guests scan a QR code, check in with a selfie, and instantly receive the photos they're in."
        />
      </Head>

      <CinematicScene />
      <Navbar />

      <div id="cinematic-scroll" className="relative z-10">
        {/* ---------------- HERO ---------------- */}
        <section className="flex min-h-screen flex-col items-center justify-center px-4 text-center sm:px-8">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-5xl"
          >
            <h1 className="font-display mt-6 text-4xl font-extrabold leading-[1.05] sm:text-6xl lg:text-7xl">
              Every guest finds
              <br />
              <span className="text-bio-cyan">their photos.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-inkdim">
              Photographers upload the event. Guests scan a code, show their
              face, and the abyss gives back only their moments, group shots
              included, with no cloud, no fees, and no app.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/gallery"
                className="btn-bio rounded-2xl px-8 py-4 text-base"
              >
                Find my photos →
              </Link>
              <Link
                href="/couple-gallery"
                className="btn-ghost rounded-2xl px-8 py-4 text-base font-semibold"
              >
                Bride &amp; Groom Gallery
              </Link>
            </div>
          </motion.div>

          <motion.div
            className="absolute bottom-8 flex flex-col items-center gap-2 text-inkdim"
            animate={{ y: [0, 10, 0] }}
            transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
          >
            <span className="text-xs tracking-[0.3em] uppercase">Scroll to dive</span>
            <span className="text-xl">↓</span>
          </motion.div>
        </section>

        {/* ---------------- STEPS ---------------- */}
        {STEPS.map((s) => (
          <StepPanel key={s.n} step={s} />
        ))}

        {/* ---------------- FEATURES ---------------- */}
        <section className="relative z-10 px-4 py-28 sm:px-8">
          <div className="mx-auto max-w-6xl">
            <h2 className="font-display reveal mx-auto mt-4 max-w-3xl text-center text-3xl font-bold leading-tight sm:text-5xl">
              Built for photographers,
              <br />
              <span className="text-stroke">free for everyone.</span>
            </h2>
            <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((f, i) => (
                <motion.div
                  key={f.title}
                  className="reveal glass group rounded-3xl p-7"
                  whileHover={{ y: -8, transition: { duration: 0.25 } }}
                >
                  <div className="text-3xl text-bio-cyan">
                    {f.icon}
                  </div>
                  <h3 className="font-display mt-5 text-base font-semibold">
                    {f.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-inkdim">
                    {f.desc}
                  </p>
                  <div className="mt-5 h-px w-full bg-gradient-to-r from-bio-teal/60 via-uv-magenta/60 to-transparent opacity-0 transition group-hover:opacity-100" />
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- FINALE ---------------- */}
        <section className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 text-center sm:px-8">
          <motion.div
            className="reveal max-w-4xl"
            initial={{ opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.9 }}
          >
            <h2 className="font-display mt-6 text-4xl font-extrabold leading-tight sm:text-6xl">
              Step into the <span className="text-bio-cyan">abyss.</span>
              <br />
              Leave with your memories.
            </h2>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/gallery"
                className="btn-bio rounded-2xl px-8 py-4 text-base"
              >
                Find my photos →
              </Link>
              <Link
                href="/signup"
                className="btn-ghost rounded-2xl px-8 py-4 text-base font-semibold"
              >
                Create account
              </Link>
              <Link
                href="/couple-gallery"
                className="btn-ghost rounded-2xl px-8 py-4 text-base font-semibold"
              >
                Bride &amp; Groom Gallery
              </Link>
            </div>
          </motion.div>

          <footer className="absolute inset-x-0 bottom-0 border-t border-white/10 py-6">
            <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 text-xs text-inkdim sm:flex-row sm:px-8">
              <span className="font-display font-bold text-ink">
                SnapFind <span className="text-bio-cyan">✦</span>
              </span>
              <span>Free &amp; open-source. Your photos stay yours.</span>
            </div>
          </footer>
        </section>
      </div>
    </>
  );
}
