import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Stars, Float } from "@react-three/drei";
import * as THREE from "three";

/** Procedurally generate a "photo" texture: gradient + face silhouette. */
function makeCardTexture(hue) {
  const c = document.createElement("canvas");
  c.width = 220;
  c.height = 280;
  const ctx = c.getContext("2d");

  const g = ctx.createLinearGradient(0, 0, 220, 280);
  g.addColorStop(0, `hsl(${hue}, 70%, 55%)`);
  g.addColorStop(1, `hsl(${(hue + 60) % 360}, 70%, 32%)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 220, 280);

  // soft face silhouette: head circle + shoulders
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.beginPath();
  ctx.arc(110, 118, 44, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(110, 244, 72, Math.PI, 0);
  ctx.fill();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function PhotoCard({ position, rotation, texture }) {
  return (
    <group position={position} rotation={rotation}>
      {/* white card backing */}
      <mesh>
        <planeGeometry args={[2.2, 2.8]} />
        <meshStandardMaterial color="#f4f4f5" roughness={0.6} />
      </mesh>
      {/* the "photo" */}
      <mesh position={[0, 0.05, 0.02]}>
        <planeGeometry args={[1.9, 2.35]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
    </group>
  );
}

function CardField() {
  const group = useRef();

  const textures = useMemo(() => {
    if (typeof document === "undefined") return [];
    return Array.from({ length: 10 }, (_, i) =>
      makeCardTexture((i * 47 + 200) % 360)
    );
  }, []);

  const cards = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => {
        const angle = (i / 10) * Math.PI * 2;
        const r = 4.5 + (i % 3) * 0.8;
        return {
          position: [
            Math.cos(angle) * r,
            (i % 2 === 0 ? 1 : -1) * (0.5 + (i % 4) * 0.6),
            Math.sin(angle) * r,
          ],
          rotation: [0, -angle + Math.PI / 2, i % 2 === 0 ? 0.06 : -0.06],
        };
      }),
    []
  );

  useFrame((state, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.08;
  });

  return (
    <group ref={group}>
      {cards.map((c, i) => (
        <Float key={i} speed={1.5} rotationIntensity={0.4} floatIntensity={0.8}>
          <PhotoCard
            position={c.position}
            rotation={c.rotation}
            texture={textures[i]}
          />
        </Float>
      ))}
    </group>
  );
}

export default function Hero3D() {
  return (
    <Canvas
      camera={{ position: [0, 0, 10], fov: 55 }}
      gl={{ alpha: true, antialias: true }}
      dpr={[1, 2]}
    >
      <ambientLight intensity={0.6} />
      <pointLight position={[8, 6, 6]} intensity={60} color="#a78bfa" />
      <pointLight position={[-8, -4, 4]} intensity={40} color="#f472b6" />
      <Stars radius={60} depth={40} count={2500} factor={3} fade speed={0.6} />
      <mesh position={[0, 0, -8]} rotation={[0.4, 0.3, 0]}>
        <torusKnotGeometry args={[3.2, 0.5, 100, 16]} />
        <meshBasicMaterial
          color="#7c3aed"
          wireframe
          transparent
          opacity={0.12}
        />
      </mesh>
      <CardField />
    </Canvas>
  );
}
