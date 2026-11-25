import { lazy, Suspense, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import type { LoreItem } from "../data/lore";

const VinylDisc = lazy(() => import("./DiscWheel").then((m) => ({ default: m.VinylDisc })));

type Tier = "mobile" | "tablet" | "desktop";

const getTier = (): Tier => {
  if (typeof window === "undefined") return "desktop";
  const w = window.innerWidth;
  return w < 640 ? "mobile" : w < 1024 ? "tablet" : "desktop";
};

const TIER = {
  mobile: { dpr: [1, 1.5] as [number, number], z: 5.8, env: 128 },
  tablet: { dpr: [1, 1.75] as [number, number], z: 5.2, env: 192 },
  desktop: { dpr: [1, 2] as [number, number], z: 4.8, env: 256 },
};

function useTier() {
  const [tier, setTier] = useState<Tier>(getTier);
  useEffect(() => {
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setTier(getTier()));
    };
    window.addEventListener("resize", onResize, { passive: true });
    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(raf);
    };
  }, []);
  return tier;
}

export default function SleeveViewer({ item, ready }: { item: LoreItem; ready: boolean }) {
  const tier = useTier();
  const cfg = TIER[tier];

  return (
    <div className="drawer__model">
      {ready && (
      <Canvas
        frameloop="demand"
        flat
        dpr={cfg.dpr}
        gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
        camera={{ fov: 30, near: 0.1, far: 100, position: [0, 0, cfg.z] }}
      >
        <ambientLight intensity={0.55} />
        <directionalLight position={[3, 4, 10]} intensity={0.35} />
        <Suspense fallback={null}>
          <Environment resolution={cfg.env} frames={1}>
            <Lightformer form="rect" intensity={0.4} position={[0, 0, 8]} scale={[12, 12, 1]} />
            <Lightformer form="rect" intensity={4} position={[-6, 3, 6]} rotation-y={Math.PI / 4} scale={[3, 9, 1]} />
            <Lightformer form="rect" intensity={4} position={[6, -3, 6]} rotation-y={-Math.PI / 4} scale={[3, 9, 1]} />
            <Lightformer form="rect" intensity={2.5} position={[0, 8, 3]} rotation-x={Math.PI / 3} scale={[10, 2, 1]} />
          </Environment>
          <group>
            <VinylDisc item={item} />
          </group>
        </Suspense>
      </Canvas>
      )}
    </div>
  );
}