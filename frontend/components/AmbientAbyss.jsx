// Lightweight ambient background for app pages —
// bioluminescent orbs drifting in the abyss. Pure CSS, zero WebGL,
// so the functional pages stay fast.
export default function AmbientAbyss() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <div
        className="abyss-orb left-[-10%] top-[-15%] h-[55vmax] w-[55vmax]"
        style={{ background: "radial-gradient(circle, rgba(45,212,191,0.14) 0%, transparent 70%)" }}
      />
      <div
        className="abyss-orb right-[-12%] top-[30%] h-[60vmax] w-[60vmax]"
        style={{
          background: "radial-gradient(circle, rgba(232,121,249,0.12) 0%, transparent 70%)",
          animationDelay: "-5s",
        }}
      />
      <div
        className="abyss-orb bottom-[-20%] left-[25%] h-[50vmax] w-[50vmax]"
        style={{
          background: "radial-gradient(circle, rgba(103,232,249,0.1) 0%, transparent 70%)",
          animationDelay: "-9s",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 90% 70% at 50% 40%, transparent 60%, rgba(2,0,10,0.5) 100%)",
        }}
      />
    </div>
  );
}
