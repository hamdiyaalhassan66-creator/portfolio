import { Suspense, useEffect, useMemo, useRef } from "react";
import type { ReactNode, RefObject } from "react";
import { Link } from "react-router-dom";
import { Canvas, useFrame } from "@react-three/fiber";
import { Box3, SRGBColorSpace, TextureLoader, Vector3 } from "three";
import type { Mesh, MeshStandardMaterial } from "three";
import { useNowPlaying } from "../hooks/useNowPlaying";
import type { NowPlaying } from "../hooks/useNowPlaying";
import type { Group } from "three";
import { Environment, Lightformer, useGLTF } from "@react-three/drei";
import type { LoreCategory, LoreItem } from "../data/lore";
import { VinylDisc } from "./DiscWheel";
import "./ThreadIndex.css";

type Props = {
  headRef: RefObject<HTMLDivElement | null>; // the page's one portrait, owned by Information
};

// what hangs on each thread; `item` is the lore item whose 3D model is shown (none yet = placeholder)
type Entry = { id: LoreCategory; label: string; item?: LoreItem; model?: string; front?: number; swing?: number; pitch?: number };

// each item: offset from the head's centre (fraction of width, fraction of height), size in px, depth (bigger = closer, leans more)
const SLOTS: [number, number, number, number][] = [
  [-0.3, 0.05, 340, 1.5],
  [-0.14, -0.28, 260, 0.45],
  [0.3, -0.08, 340, 1.2],
  [0.15, 0.27, 340, 1.2],
];
const ITEM_K = 0.025; // how hard a shoved item drifts back to its spot (higher = stiffer)
const ITEM_DAMP = 0.93; // shove decay (closer to 1 = floats longer)
const REACH = 0.75; // cursor reach, as a fraction of the item's size
const REPEL = 0.08; // how hard a fast cursor throws an item away from it
const FLICK = 0.06; // how much of the cursor's own speed an item picks up
const SPIN_KICK = 0.002; // how hard the cursor spins / tips an item
const SPIN_IDLE = 0.006; // radians/frame, slow turn when left alone
const SPIN_EASE = 0.02; // how fast a spin settles back to the idle turn
const TIP_K = 0.04; // how hard a tipped item rights itself
const TIP_DAMP = 0.92; // tip decay
const REST_K = 0.01; // how hard a spun model pulls back to its resting angle
const REST_DAMP = 0.9; // how fast that return settles (lower = snappier, higher = bouncier)
const DRIFT = 14; // px, how far an item bobs around its spot
const DRIFT_SPEED = 0.0007; // bob speed
const PARALLAX = 200; // px the field leans with the cursor (near items move most)
const LAND = 0.85; // fraction of the page scroll by which the head has landed in the middle
const REVEAL_AT = 0.6; // how far into the head's trip the first item starts popping out
const REVEAL_SPAN = 0.2; // how much of the trip each item takes to fully appear
const STAGGER = 0.05; // extra trip before each following item starts
// ----------------------------

const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b);
const DEMO = false; // true = fake play/idle cycle with no Spotify

// turns its children around their own centre (yaw = spin, pitch = tip), driven from the animation loop below
function Spinner({ rotRef, index, front = 0, swing, pitch = 0, children }: { rotRef: RefObject<number[]>; index: number; front?: number; swing?: number; pitch?: number; children: ReactNode }) {
  const g = useRef<Group>(null);
useFrame((state) => {
    if (!g.current) return;
    const yaw = rotRef.current[index * 2] ?? 0;
    g.current.rotation.y =
      swing === undefined ? yaw : front + yaw + Math.sin(state.clock.elapsedTime * 0.8) * swing;
    g.current.rotation.x = (rotRef.current[index * 2 + 1] ?? 0) + pitch;
  });
  return <group ref={g}>{children}</group>;
}

// loads any .glb, centres it and scales it to fit the same space as the discs
function GlbModel({ url, now, demo = false }: { url: string; now?: NowPlaying; demo?: boolean }) {
const { scene } = useGLTF(url);
const rig = useMemo(() => {
  const arm = scene.getObjectByName("tonearm");
  const vinyl = scene.getObjectByName("vinyl");
  if (!arm || !vinyl) return null;
  vinyl.visible = false;
  const label = scene.getObjectByName("label") as Mesh | undefined;
  return { arm, vinyl, label, ex: arm.userData as { outerAngle: number; innerAngle: number; playLift: number; travelLift: number } };
}, [scene]);
useEffect(() => {
  if (!rig?.label || !now?.cover) return;
  let dead = false;
  new TextureLoader().setCrossOrigin("anonymous").load(now.cover, (tex) => {
    if (dead) return;
    tex.flipY = false; // glTF texture convention
    tex.colorSpace = SRGBColorSpace;
    const mat = rig.label!.material as MeshStandardMaterial;
    mat.map = tex;
    mat.needsUpdate = true;
  });
  return () => {
    dead = true;
  };
}, [rig, now?.cover]);
const st = useRef({ disc: 0, arm: 0 });
useFrame(({ clock }, dt) => {
  if (!rig) return;
  const s = st.current;
  const k = Math.min(dt, 0.05);
  // demo: 7s playing, 7s idle, so you can see both states
  const t = clock.elapsedTime;
  const on = demo ? Math.floor(t / 7) % 2 === 0 : !!now?.playing;
  const prog = demo
    ? (t % 7) / 7
    : now?.duration
      ? clamp(((now.progress ?? 0) + (now.playing ? Date.now() - now.at : 0)) / now.duration, 0, 1)
      : 0;
  // the record appears and spins first, then the arm lands; on stop, the arm lifts first
  s.disc += ((on || s.arm > 0.02 ? 1 : 0) - s.disc) * Math.min(k * 3, 1);
  s.arm += ((on && s.disc > 0.9 ? 1 : 0) - s.arm) * Math.min(k * 1.6, 1);
  if (s.disc < 0.002) s.disc = 0;
  if (s.arm < 0.002) s.arm = 0;
  const e = s.arm * s.arm * (3 - 2 * s.arm);
  const { outerAngle, innerAngle, playLift, travelLift } = rig.ex;
  rig.arm.rotation.z = (outerAngle + (innerAngle - outerAngle) * prog) * e;
  rig.arm.position.z = playLift * e + travelLift * Math.sin(Math.PI * s.arm);
  rig.vinyl.visible = s.disc > 0;
  rig.vinyl.scale.setScalar(Math.max(s.disc, 0.001));
  rig.vinyl.rotation.z -= dt * 3.49 * s.disc; // about 33 rpm
});
  const fit = useMemo(() => {
    const box = new Box3().setFromObject(scene);
    const size = box.getSize(new Vector3());
    const c = box.getCenter(new Vector3());
    const k = 3.8 / Math.max(size.x, size.y, size.z);
    return { k, pos: [-c.x * k, -c.y * k, -c.z * k] as [number, number, number] };
  }, [scene]);
  return (
    <group scale={fit.k} position={fit.pos}>
      <primitive object={scene} />
    </group>
  );
}

export default function ThreadIndex({ headRef }: Props) {
  const rootRef = useRef<HTMLElement>(null);
const now = useNowPlaying();
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const rotRef = useRef<number[]>([]); // per item: yaw, pitch

  // spread the picks evenly through the list so sleeves and discs are mixed
  const picked = useMemo<Entry[]>(
    () => [
      { id: "music", label: "Music", model: "/models/cd_player_split.glb", front: 0.3, swing: 0.08, pitch: (70 * Math.PI) / 180 },
      { id: "films", label: "Films" },
      { id: "books", label: "Illustrated Books" },
      { id: "photos", label: "Photographs", model: "/models/camera.glb" },
    ],
    []
  );

useEffect(() => {
  const root = rootRef.current;
  const head = headRef.current;
  if (!root || !head) return;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const live = reduce ? 0 : 1;
  const count = picked.length;
  // per item: shove x, y, vx, vy, yaw, yaw speed, pitch, pitch speed
  const itm = picked.map(() => new Float32Array(8));

  let W = root.clientWidth;
  let H = root.clientHeight;
  const ro = new ResizeObserver(() => {
    W = root.clientWidth;
    H = root.clientHeight;
  });
  ro.observe(root);

  let cX = 0;
  let cY = 0;
  let pvx = 0;
  let pvy = 0;
  let inside = false;

  const onMove = (e: PointerEvent) => {
    if (e.pointerType === "touch") return;
    if (inside) {
      pvx = pvx * 0.4 + (e.clientX - cX) * 0.6;
      pvy = pvy * 0.4 + (e.clientY - cY) * 0.6;
    }
    cX = e.clientX;
    cY = e.clientY;
    inside = true;
  };
  const onLeave = () => {
    inside = false;
  };
  window.addEventListener("pointermove", onMove);
  document.documentElement.addEventListener("mouseleave", onLeave);

  let hx = 0;
  let hy = 0;
  let parx = 0;
  let pary = 0;
  let started = false;
  let last = performance.now();
  let raf = 0;

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const s = Math.min((now - last) / 16.67, 2);
    last = now;
    if (!W) return;

    // the head glides down the page and lands in the middle of this section
    const hh = head.offsetHeight;
    const hw = head.offsetWidth;
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const arrive = clamp(window.scrollY / maxScroll / LAND, 0, 1);
    const tx = arrive * (root.offsetLeft + W / 2 - hw / 2 - head.offsetLeft);
    const ty = arrive * (root.offsetTop + H / 2 - hh / 2 - head.offsetTop);
    const ease = started && !reduce ? Math.min(0.12 * s, 1) : 1;
    hx += (tx - hx) * ease;
    hy += (ty - hy) * ease;
    head.style.transform = `translate(${hx}px, ${hy}px)`;
    started = true;

    // cursor position inside this section, and how far the whole field leans because of it
    const rect = root.getBoundingClientRect();
    const mx = cX - rect.left;
    const my = cY - rect.top;
    parx += ((inside ? clamp(mx / W - 0.5, -0.5, 0.5) : 0) - parx) * 0.05 * s;
    pary += ((inside ? clamp(my / H - 0.5, -0.5, 0.5) : 0) - pary) * 0.05 * s;
    pvx *= 0.85;
    pvy *= 0.85;
    const speed = Math.hypot(pvx, pvy);

    for (let t = 0; t < count; t++) {
      const [fx, fy, sz, depth] = SLOTS[t];
      const m = itm[t];

      // each item pops out from behind the head as it lands
      const rt = clamp((arrive - REVEAL_AT - t * STAGGER) / REVEAL_SPAN, 0, 1);
      const rv = rt * rt * (3 - 2 * rt);

      // resting spot around the head, with a slow idle drift and the cursor lean
      const rx = W / 2 + fx * W + Math.sin(now * DRIFT_SPEED + t * 2.1) * DRIFT * live;
      const ry = H / 2 + fy * H + Math.cos(now * DRIFT_SPEED * 0.8 + t * 1.7) * DRIFT * live;
      const bx = W / 2 + (rx - W / 2) * rv - parx * PARALLAX * depth * live;
      const by = H / 2 + (ry - H / 2) * rv - pary * PARALLAX * depth * live;

      // a moving cursor shoves the item away and sets it spinning
      if (inside && live && rv > 0.9) {
        const dx = bx + m[0] - mx;
        const dy = by + m[1] - my;
        const d = Math.hypot(dx, dy) || 1;
        const reach = sz * REACH;
        if (d < reach) {
          const f = (1 - d / reach) ** 2;
          m[2] += (dx / d) * speed * REPEL * f + pvx * FLICK * f;
          m[3] += (dy / d) * speed * REPEL * f + pvy * FLICK * f;
          m[5] += pvx * SPIN_KICK * f;
          m[7] += pvy * SPIN_KICK * f;
        }
      }

      // weightless: a soft spring back to its spot, no gravity
      m[2] = (m[2] - ITEM_K * m[0] * s) * ITEM_DAMP;
      m[3] = (m[3] - ITEM_K * m[1] * s) * ITEM_DAMP;
      m[0] = clamp(m[0] + m[2] * s, -sz * 0.6, sz * 0.6);
      m[1] = clamp(m[1] + m[3] * s, -sz * 0.6, sz * 0.6);

      // 360 turn: slow idle spin, plus whatever spin the cursor gave it; tips settle back flat
      if (picked[t].swing !== undefined) {
  // spins freely under the cursor, then springs back to the nearest resting angle
  const home = Math.round(m[4] / (Math.PI * 2)) * Math.PI * 2;
  m[5] = (m[5] + (home - m[4]) * REST_K * s) * REST_DAMP;
} else {
  m[5] += (SPIN_IDLE * live * (t % 2 ? -1 : 1) - m[5]) * SPIN_EASE * s;
}
      m[5] = clamp(m[5], -0.3, 0.3);
      m[4] += m[5] * s;
      m[7] = (m[7] - TIP_K * m[6] * s) * TIP_DAMP;
      m[6] = clamp(m[6] + m[7] * s, -0.8, 0.8);
      rotRef.current[t * 2] = m[4];
      rotRef.current[t * 2 + 1] = m[6];

      const el = itemRefs.current[t];
      if (el) {
        el.style.left = `${bx + m[0] - sz / 2}px`;
        el.style.top = `${by + m[1] - sz / 2}px`;
        const far = clamp(1 - depth / 1.2, 0, 1); // 0 = closest, 1 = furthest
        el.style.opacity = String(rv * (1 - far * 0.45));
        el.style.filter = far > 0.01 ? `blur(${far * 3}px)` : "";
        el.style.zIndex = String(clamp(Math.round(depth * 2), 1, 3));
        el.style.setProperty("--grow", String((0.4 + 0.6 * rv) * (0.85 + 0.15 * (1 - far))));
        el.style.pointerEvents = rv > 0.9 ? "auto" : "none";
      }
    }
  };
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    window.removeEventListener("pointermove", onMove);
    document.documentElement.removeEventListener("mouseleave", onLeave);
  };
}, [picked, headRef]);

  return (
    <section className="threads" ref={rootRef} aria-label="An index of Dee's mind">
      <h2 className="threads__title">An Index Of Dee’s Mind Outside Of Design</h2>

      {picked.map((entry, i) => {
        const size = SLOTS[i][2];
        return (
          <Link
            key={entry.id}
            ref={(el) => {
              itemRefs.current[i] = el;
            }}
            className="thread-item"
            to="/lore"
            state={{ category: entry.id }}
            draggable={false}
            aria-label={`Open ${entry.label}`}
            style={{ width: size, height: size }}
          >
            {entry.item || entry.model ? (
              <Canvas
                className="thread-item__model"
                dpr={[1, 2]}
                gl={{ alpha: true, antialias: true }}
                camera={{ fov: 14, position: [0, 0, 21] }}
              >
                <ambientLight intensity={0.55} />
                <directionalLight position={[3, 4, 10]} intensity={0.35} />
                <Environment resolution={256}>
                  <Lightformer form="rect" intensity={0.4} position={[0, 0, 8]} scale={[12, 12, 1]} />
                  <Lightformer form="rect" intensity={4} position={[-6, 3, 6]} rotation-y={Math.PI / 4} scale={[3, 9, 1]} />
                  <Lightformer form="rect" intensity={4} position={[6, -3, 6]} rotation-y={-Math.PI / 4} scale={[3, 9, 1]} />
                </Environment>
                <Suspense fallback={null}>
                <Spinner rotRef={rotRef} index={i} front={entry.front} swing={entry.swing} pitch={entry.pitch}>
                {entry.item ? <VinylDisc item={entry.item} /> : <GlbModel url={entry.model!} now={now} demo={DEMO} />}
                </Spinner>
                </Suspense>
              </Canvas>
            ) : (
              <div className="thread-item__ph" />
            )}
          </Link>
        );
      })}
    </section>
  );
}
