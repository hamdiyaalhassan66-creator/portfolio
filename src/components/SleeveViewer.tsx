import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import type { LoreItem } from "../data/lore";
import { VinylDisc } from "./DiscWheel";

export default function SleeveViewer({ item, ready }: { item: LoreItem; ready: boolean }) {
  return (
    <div className="drawer__model">
      {ready && (
      <Canvas
        frameloop="demand"
        flat
        dpr={[1, 2]}
        gl={{ alpha: true, antialias: true }}
        camera={{ fov: 30, near: 0.1, far: 100, position: [0, 0, 4.8] }}
      >
        <ambientLight intensity={0.55} />
        <directionalLight position={[3, 4, 10]} intensity={0.35} />
        <Suspense fallback={null}>
          <Environment resolution={256}>
            <Lightformer form="rect" intensity={0.4} position={[0, 0, 8]} scale={[12, 12, 1]} />
            <Lightformer form="rect" intensity={4} position={[-6, 3, 6]} rotation-y={Math.PI / 4} scale={[3, 9, 1]} />
            <Lightformer form="rect" intensity={4} position={[6, -3, 6]} rotation-y={-Math.PI / 4} scale={[3, 9, 1]} />
            <Lightformer form="rect" intensity={2.5} position={[0, 8, 3]} rotation-x={Math.PI / 3} scale={[10, 2, 1]} />
          </Environment>
          <group rotation={[0.28, -0.32, 0.2, "YXZ"]}>
            <VinylDisc item={item} />
          </group>
        </Suspense>
      </Canvas>
      )}
    </div>
  );
}