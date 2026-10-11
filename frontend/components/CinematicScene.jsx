import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { scrollRig } from "../lib/scrollRig";

/* ------------------------------------------------------------------ */
/*  Procedural "memory shard" textures — abstract luminous photographs  */
/* ------------------------------------------------------------------ */

function makeShardTexture(seed) {
  const W = 512;
  const H = 640;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const x = c.getContext("2d");

  // deep base
  const base = x.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, "#0b0620");
  base.addColorStop(0.55, "#060313");
  base.addColorStop(1, "#030110");
  x.fillStyle = base;
  x.fillRect(0, 0, W, H);

  // pseudo-random from seed
  let s = seed * 9973 + 11;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };

  const palette = [
    ["103,232,249", "45,212,191"], // bio cyan/teal
    ["232,121,249", "167,139,250"], // uv magenta/violet
    ["251,191,36", "232,121,249"], // ember + magenta
  ];
  const [c1, c2] = palette[seed % palette.length];

  // ambient blobs
  for (let i = 0; i < 5; i++) {
    const bx = rnd() * W;
    const by = rnd() * H;
    const br = 90 + rnd() * 200;
    const g = x.createRadialGradient(bx, by, 0, bx, by, br);
    const col = i % 2 === 0 ? c1 : c2;
    g.addColorStop(0, `rgba(${col},${0.34 + rnd() * 0.2})`);
    g.addColorStop(1, `rgba(${col},0)`);
    x.fillStyle = g;
    x.fillRect(0, 0, W, H);
  }

  // the "face" — a soft luminous presence in the dark
  const fx = W * (0.32 + rnd() * 0.36);
  const fy = H * (0.3 + rnd() * 0.28);
  const fg = x.createRadialGradient(fx, fy, 0, fx, fy, 130);
  fg.addColorStop(0, "rgba(255,250,240,0.85)");
  fg.addColorStop(0.35, "rgba(255,240,225,0.32)");
  fg.addColorStop(1, "rgba(255,240,225,0)");
  x.fillStyle = fg;
  x.beginPath();
  x.ellipse(fx, fy, 95, 125, 0, 0, Math.PI * 2);
  x.fill();

  // faint secondary silhouettes
  for (let i = 0; i < 2; i++) {
    const sx = rnd() * W;
    const sy = H * (0.45 + rnd() * 0.35);
    const sg = x.createRadialGradient(sx, sy, 0, sx, sy, 80);
    sg.addColorStop(0, "rgba(220,210,255,0.28)");
    sg.addColorStop(1, "rgba(220,210,255,0)");
    x.fillStyle = sg;
    x.beginPath();
    x.ellipse(sx, sy, 60, 84, 0, 0, Math.PI * 2);
    x.fill();
  }

  // scanlines
  x.fillStyle = "rgba(0,0,0,0.16)";
  for (let yy = 0; yy < H; yy += 5) x.fillRect(0, yy, W, 1);

  // vignette
  const v = x.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.75);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(2,0,12,0.72)");
  x.fillStyle = v;
  x.fillRect(0, 0, W, H);

  // luminous frame
  x.strokeStyle = `rgba(${c1},0.5)`;
  x.lineWidth = 3;
  x.strokeRect(10, 10, W - 20, H - 20);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/* ------------------------------------------------------------------ */
/*  Particle nebula                                                    */
/* ------------------------------------------------------------------ */

function Nebula({ count }) {
  const ref = useRef();
  const { positions, colors } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const palette = [
      new THREE.Color("#67e8f9"),
      new THREE.Color("#e879f9"),
      new THREE.Color("#2dd4bf"),
      new THREE.Color("#fbbf24"),
      new THREE.Color("#a78bfa"),
    ];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 46;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 30;
      positions[i * 3 + 2] = 10 - Math.random() * 90;
      const col = palette[(Math.random() * palette.length) | 0];
      const dim = 0.35 + Math.random() * 0.65;
      colors[i * 3] = col.r * dim;
      colors[i * 3 + 1] = col.g * dim;
      colors[i * 3 + 2] = col.b * dim;
    }
    return { positions, colors };
  }, [count]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    ref.current.rotation.y = t * 0.012;
    ref.current.position.y = Math.sin(t * 0.12) * 0.6;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.09}
        vertexColors
        transparent
        opacity={0.85}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}

/* ------------------------------------------------------------------ */
/*  Floating memory shards along the flight path                       */
/* ------------------------------------------------------------------ */

const SHARD_COUNT = 16;

function Shards() {
  const group = useRef();
  const shards = useMemo(() => {
    const isMobile =
      typeof window !== "undefined" && window.innerWidth < 768;
    const n = isMobile ? 10 : SHARD_COUNT;
    const arr = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1); // 0 → 1 along the path
      const z = 4 - t * 78;
      const x = Math.sin(t * Math.PI * 2.4) * 5.2;
      const y = Math.cos(t * Math.PI * 1.7) * 2.6 + (Math.random() - 0.5) * 1.4;
      arr.push({
        position: [x, y, z],
        rotation: [(Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.9, (Math.random() - 0.5) * 0.25],
        scale: 0.85 + Math.random() * 0.7,
        speed: 0.5 + Math.random() * 0.8,
        phase: Math.random() * Math.PI * 2,
        seed: i + 1,
      });
    }
    return arr;
  }, []);

  const textures = useMemo(() => shards.map((s) => makeShardTexture(s.seed)), [shards]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    group.current.children.forEach((mesh, i) => {
      const s = shards[i];
      mesh.position.y = s.position[1] + Math.sin(t * s.speed + s.phase) * 0.35;
      mesh.rotation.z = s.rotation[2] + Math.sin(t * 0.32 + s.phase) * 0.06;
      mesh.rotation.y = s.rotation[1] + Math.sin(t * 0.22 + s.phase * 1.7) * 0.12;
    });
    // whole field slowly breathes with scroll
    group.current.rotation.y = scrollRig.progress * 0.35;
  });

  return (
    <group ref={group}>
      {shards.map((s, i) => (
        <mesh key={i} position={s.position} rotation={s.rotation} scale={s.scale}>
          <planeGeometry args={[3, 3.75]} />
          <meshStandardMaterial
            map={textures[i]}
            emissive="#ffffff"
            emissiveMap={textures[i]}
            emissiveIntensity={0.55}
            roughness={0.35}
            metalness={0.1}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Scroll-driven cinematic camera                                     */
/* ------------------------------------------------------------------ */

const WAYPOINTS = [
  { pos: [0, 0.6, 9], look: [0, 0, -6] },
  { pos: [2.2, -0.4, -8], look: [-0.6, 0.4, -22] },
  { pos: [-2.4, 1.0, -26], look: [0.8, -0.4, -40] },
  { pos: [1.6, -1.0, -44], look: [-0.8, 0.6, -58] },
  { pos: [0, 0.2, -60], look: [0, 0, -76] },
];

function smooth(t) {
  return t * t * (3 - 2 * t);
}

function CameraRig() {
  const lookTarget = useMemo(() => new THREE.Vector3(), []);
  const camPos = useMemo(() => new THREE.Vector3(), []);
  const lookPos = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, delta) => {
    const p = Math.min(1, Math.max(0, scrollRig.progress));
    const segs = WAYPOINTS.length - 1;
    const ft = p * segs;
    const i = Math.min(segs - 1, Math.floor(ft));
    const t = smooth(ft - i);
    const a = WAYPOINTS[i];
    const b = WAYPOINTS[i + 1];

    camPos.set(
      a.pos[0] + (b.pos[0] - a.pos[0]) * t,
      a.pos[1] + (b.pos[1] - a.pos[1]) * t,
      a.pos[2] + (b.pos[2] - a.pos[2]) * t
    );
    lookPos.set(
      a.look[0] + (b.look[0] - a.look[0]) * t,
      a.look[1] + (b.look[1] - a.look[1]) * t,
      a.look[2] + (b.look[2] - a.look[2]) * t
    );

    // idle float + mouse parallax
    const time = state.clock.elapsedTime;
    camPos.x += Math.sin(time * 0.4) * 0.18 + scrollRig.mouseX * 0.7;
    camPos.y += Math.cos(time * 0.32) * 0.14 + scrollRig.mouseY * 0.45;

    // critically-damped-ish follow
    const k = 1 - Math.exp(-delta * 4.5);
    state.camera.position.lerp(camPos, k);
    lookTarget.lerp(lookPos, k);
    state.camera.lookAt(lookTarget);
  });
  return null;
}

/* ------------------------------------------------------------------ */
/*  The fixed cinematic canvas                                         */
/* ------------------------------------------------------------------ */

export default function CinematicScene() {
  const isMobile =
    typeof window !== "undefined" && window.innerWidth < 768;
  return (
    <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
      <Canvas
        dpr={[1, isMobile ? 1.25 : 1.75]}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        camera={{ fov: 58, near: 0.1, far: 160, position: [0, 0.6, 9] }}
      >
        <color attach="background" args={["#040110"]} />
        <fog attach="fog" args={["#040110", 12, 78]} />
        <ambientLight intensity={0.55} />
        <pointLight position={[8, 6, -6]} intensity={90} color="#22d3ee" distance={40} />
        <pointLight position={[-9, -4, -30]} intensity={110} color="#e879f9" distance={46} />
        <pointLight position={[4, 8, -52]} intensity={70} color="#2dd4bf" distance={40} />
        <directionalLight position={[0, 10, 6]} intensity={0.5} color="#a78bfa" />
        <Nebula count={isMobile ? 800 : 1900} />
        <Shards />
        <CameraRig />
      </Canvas>
      {/* cinematic vignette + grade */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 90% 70% at 50% 42%, transparent 55%, rgba(2,0,10,0.55) 100%)",
        }}
      />
    </div>
  );
}
