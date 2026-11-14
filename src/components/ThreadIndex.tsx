import { Fragment, Suspense, useEffect, useMemo, useRef } from "react";
import type { ReactNode, RefObject } from "react";
import { Link } from "react-router-dom";
import { Canvas, createPortal, useFrame } from "@react-three/fiber";
import { Environment, Lightformer, Text, useGLTF } from "@react-three/drei";
import { Box3, Raycaster, SRGBColorSpace, TextureLoader, Vector3 } from "three";
import type { Mesh, MeshStandardMaterial } from "three";
import { useNowPlaying } from "../hooks/useNowPlaying";
import type { NowPlaying } from "../hooks/useNowPlaying";
import type { Group } from "three";
import type { LoreItem } from "../data/lore";
import { VinylDisc } from "./DiscWheel";
import "./ThreadIndex.css";
import wordmark from "../assets/dee-space-wordmark.svg"; // the same file the nav uses; match the import path in Header.tsx

type Props = {
  headRef: RefObject<HTMLDivElement | null>; // the page's one portrait, owned by Information
};

// what hangs on each thread; `item` is the lore item whose 3D model is shown (none yet = placeholder)
type Entry = { id: string; label: string; item?: LoreItem; model?: string; front?: number; swing?: number; pitch?: number; roll?: number; decor?: boolean; over?: boolean; tag?: string };

// each item: offset from the head's centre (fraction of width, fraction of height), size in px, depth (bigger = closer, leans more)
const SLOTS: [number, number, number, number][] = [
  [-0.24, 0.29, 360, 1.5], // cd player / turntable, front (moved right and down)
  [-0.12, -0.16, 230, 0.7], // vhs, back (moved down)
  [0.364, 0.253, 350, 1.4], // books, front (bottom-right)
  [0.06, 0.37, 470, 1.5], // camera, front (bigger)
  [0.1, -0.19, 195, 0.6], // headphones, furthest back
  [0.34, -0.10, 300, 0.95], // dumbbell, middle (moved down and right)
  [-0.31, -0.05, 260, 1.0], // game, middle (moved down, a bit smaller)
];
const SIZE = 0.75; // scales every model together, keeping their relative sizes (1 = the old size)
const REF_W = 1920; // the screen size the model sizes were tuned at; sizes are unchanged at exactly this size
const REF_H = 1080;
const SCALE_MIN = 0.45; // never smaller than this fraction of the tuned size
const SCALE_MAX = 1.3; // never bigger than this
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
const LAND_AT = 0.9; // the models start once the head's trip is this far along (1 = fully landed)
const REVEAL_AT = 0.02; // the first model starts coming out straight away
const STAGGER = 0.05; // each following model waits a little longer
const REVEAL_SPEED = 0.1; // how fast each one comes out (higher = faster)
const ARRIVE_EASE = 0.08; // how fast the reveal clock runs (higher = models come out sooner)
const TRIP_EASE = 0.12; // how closely the head follows the scroll (higher = tighter, lower = floatier)
const HEAD_END = 0.7; // size of the portrait once it has landed (1 = no shrink)
// ----------------------------

const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b);

const DEMO = false; // true = fake play/idle cycle with no Spotify
// where the song is engraved, in the body's own space. x/y are fractions of the body's size from its centre
const ENGRAVE = { x: 0.33, y: -0.34, rot: 0, size: 0.031 }; // size = text height as a fraction of body width

// turns its children around their own centre (yaw = spin, pitch = tip), driven from the animation loop below
function Spinner({ rotRef, index, front = 0, swing, pitch = 0, roll = 0, children }: { rotRef: RefObject<number[]>; index: number; front?: number; swing?: number; pitch?: number; roll?: number; children: ReactNode }) {
  const g = useRef<Group>(null);
useFrame((state) => {
    if (!g.current) return;
    const yaw = rotRef.current[index * 2] ?? 0;
    g.current.rotation.y =
      front + yaw + (swing === undefined ? 0 : Math.sin(state.clock.elapsedTime * 0.8) * swing);
    g.current.rotation.x = (rotRef.current[index * 2 + 1] ?? 0) + pitch;
  });
  return (
    <group rotation={[0, 0, roll]}>
      <group ref={g}>{children}</group>
    </group>
  );
}

// song details engraved into the turntable body; fades in with the record
function Engraving({ box, body, now, st }: { box: Box3; body: Mesh; now?: NowPlaying; st: RefObject<{ disc: number; arm: number }> }) {
  const a = useRef<any>(null);
  const b = useRef<any>(null);
  const c2 = useRef<any>(null);
  const size = box.getSize(new Vector3());
  const c = box.getCenter(new Vector3());
  const fs = size.x * ENGRAVE.size;
  // shoot a ray down at the text's spot to find where the body's surface really is
  const surfaceZ = useMemo(() => {
    body.updateWorldMatrix(true, false);
    const x = c.x + ENGRAVE.x * size.x;
    const y = c.y + ENGRAVE.y * size.y;
    const from = new Vector3(x, y, box.max.z + size.z).applyMatrix4(body.matrixWorld);
    const dir = new Vector3(0, 0, -1).transformDirection(body.matrixWorld);
    const hit = new Raycaster(from, dir).intersectObject(body, false)[0];
    return hit ? body.worldToLocal(hit.point.clone()).z : box.max.z;
  }, [body, box]); // eslint-disable-line react-hooks/exhaustive-deps
  const cut = (s = "", n = 17) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
  useFrame(() => {
    const o = st.current.disc;
    for (const r of [a, b, c2]) {
      if (!r.current) continue;
      r.current.fillOpacity = o;
      r.current.strokeOpacity = o;
      r.current.outlineOpacity = o * 0.6;
      r.current.sync();
    }
  });
  const shared = {
    anchorX: "center" as const,
    anchorY: "middle" as const,
    color: "#26292e",
    strokeColor: "#26292e",
    depthOffset: -1,
    strokeWidth: fs * 0.035,
    letterSpacing: 0,
    outlineColor: "#ffffff",
    outlineWidth: fs * 0.02,
    outlineOffsetY: -fs * 0.07,
  };
  return (
    <group position={[c.x + ENGRAVE.x * size.x, c.y + ENGRAVE.y * size.y, surfaceZ + size.x * 0.0004]} rotation={[0, 0, ENGRAVE.rot]}>
      <Text ref={c2} fontSize={fs * 0.6} position={[0, fs * 1.9, 0]} {...shared} letterSpacing={0.04}>
        Now playing
      </Text>
      <Text ref={a} fontSize={fs * 0.75} position={[0, fs * 0.5, 0]} {...shared}>
        {cut(now?.title)}
      </Text>
      <Text ref={b} fontSize={fs * 0.6} position={[0, -fs * 0.4, 0]} {...shared}>
        {cut(now?.artist)}
      </Text>
    </group>
  );
}

// loads any .glb, centres it and scales it to fit the same space as the discs
function GlbModel({ url, now, demo = false }: { url: string; now?: NowPlaying; demo?: boolean }) {
const { scene } = useGLTF(url);
const rig = useMemo(() => {
  const arm = scene.getObjectByName("tonearm");
  const vinyl = scene.getObjectByName("vinyl");
  if (!arm || !vinyl) return null;
  scene.getObjectByName("cover")?.removeFromParent(); // leftover from my last edit
  const label = scene.getObjectByName("label") as Mesh | undefined;
  if (label) {
    // grow the label until it is as wide as the whole record
    scene.updateMatrixWorld(true);
    const lw = new Box3().setFromObject(label).getSize(new Vector3());
    const vw = new Box3().setFromObject(vinyl).getSize(new Vector3());
    const ratio = Math.max(vw.x, vw.y, vw.z) / Math.max(lw.x, lw.y, lw.z);
    const g = label.geometry.clone();
    g.computeBoundingBox();
    const sz = g.boundingBox!.getSize(new Vector3());
    const c = g.boundingBox!.getCenter(new Vector3());
    const thin = sz.x <= sz.y && sz.x <= sz.z ? "x" : sz.y <= sz.z ? "y" : "z"; // keep the flat axis flat
    g.translate(-c.x, -c.y, -c.z);
    g.scale(thin === "x" ? 1 : ratio, thin === "y" ? 1 : ratio, thin === "z" ? 1 : ratio);
    g.translate(c.x, c.y, c.z);
    label.geometry = g;
  }
  vinyl.visible = false;
  const body = scene.getObjectByName("body") as Mesh | undefined;
  let box: Box3 | null = null;
  if (body?.geometry) {
    body.geometry.computeBoundingBox();
    box = body.geometry.boundingBox;
  }
  return { arm, vinyl, label, body, box, ex: arm.userData as { outerAngle: number; innerAngle: number; playLift: number; travelLift: number } };
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
  s.disc += ((on || s.arm > 0.02 ? 1 : 0) - s.disc) * Math.min(k * 7, 1);
  s.arm += ((on && s.disc > 0.6 ? 1 : 0) - s.arm) * Math.min(k * 3.5, 1);
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
      {rig?.body && rig.box && createPortal(<Engraving box={rig.box} body={rig.body} now={now} st={st} />, rig.body)}
    </group>
  );
}

export default function ThreadIndex({ headRef }: Props) {
  const rootRef = useRef<HTMLElement>(null);
const now = useNowPlaying();
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const tagRef = useRef<HTMLParagraphElement>(null);
  const rotRef = useRef<number[]>([]); // per item: yaw, pitch

  // spread the picks evenly through the list so sleeves and discs are mixed
  const picked = useMemo<Entry[]>(
    () => [
      { id: "music", label: "Music", model: "/models/cd_player_split.glb", front: 0.55, pitch: (70 * Math.PI) / 180, roll: (-14 * Math.PI) / 180 },
      { id: "films", label: "Films", model: "/models/vhs-player.glb", front: -0.6, pitch: (30 * Math.PI) / 180, roll: (9 * Math.PI) / 180 },
      { id: "books", label: "Illustrated Books", model: "/models/coffee_table_books.glb", front: -0.3, pitch: (38 * Math.PI) / 180, roll: (-11 * Math.PI) / 180 },
      { id: "photos", label: "Photographs", model: "/models/camera.glb", over: true, pitch: (14 * Math.PI) / 180, roll: (8 * Math.PI) / 180 },
      { id: "headphones", label: "Headphones", tag: "[I LOVE MY HEADPHONES]", decor: true, model: "/models/headphones.glb", front: 0.5, pitch: (8 * Math.PI) / 180, roll: (-10 * Math.PI) / 180 },
      { id: "dumbbell", label: "Dumbbell", tag: "[I LOVE WORKING OUT]", decor: true, model: "/models/dumbbell.glb", front: -0.4, pitch: (28 * Math.PI) / 180, roll: (-22 * Math.PI) / 180 },
      { id: "game", label: "Game", tag: "[MY ALL-TIME FAVOURITE GAME]", decor: true, model: "/models/game.glb", front: 0.4, pitch: (20 * Math.PI) / 180, roll: (-8 * Math.PI) / 180 },
    ],
    []
  );

useEffect(() => {
  const root = rootRef.current;
  const head = headRef.current;
  if (!root || !head) return;
  if (window.matchMedia("(max-width: 900px)").matches) return; // mobile: no floating/drag animation, the CSS carousel takes over

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const live = reduce ? 0 : 1;
  const count = picked.length;
  // per item: shove x, y, vx, vy, yaw, yaw speed, pitch, pitch speed
  const itm = picked.map(() => new Float32Array(8));
  const rvs = picked.map(() => 0); // how far out each model is (0 = hidden behind the head, 1 = in place)

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
  let overHead = false; // cursor is inside the head's area

  const onMove = (e: PointerEvent) => {
    if (e.pointerType === "touch") return;
    if (inside) {
      pvx = pvx * 0.4 + (e.clientX - cX) * 0.6;
      pvy = pvy * 0.4 + (e.clientY - cY) * 0.6;
    }
    cX = e.clientX;
    cY = e.clientY;
    inside = true;
    const r = head.getBoundingClientRect();
    overHead = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
  };
  const onLeave = () => {
    inside = false;
    overHead = false;
  };
  window.addEventListener("pointermove", onMove);
  document.documentElement.addEventListener("mouseleave", onLeave);

  let hx = 0;
  let hy = 0;
  let trip = 0; // 0..1 how far down the page the head has travelled (follows the scroll)
  let arrive = 0; // smoothed 0..1, starts once the head has landed, drives the models
  let parx = 0;
  let pary = 0;
  let started = false;
  let shown = false; // true while the section is mostly on screen; flips the whole animation on and off
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
    // 0 = the head sits top right, 1 = it has landed in the middle of this section at the bottom of the page
    const maxY = document.documentElement.scrollHeight - window.innerHeight;
    const goal = maxY > 0 ? clamp(window.scrollY / maxY, 0, 1) : 1;
    trip += (goal - trip) * (started && !reduce ? Math.min(TRIP_EASE * s, 1) : 1);
    if (Math.abs(goal - trip) < 0.0005) trip = goal;
    // where the middle of this section is, measured from the head's own spot
    const toX = root.offsetLeft + W / 2 - hw / 2 - head.offsetLeft;
    const toY = root.offsetTop + H / 2 - hh / 2 - head.offsetTop;
    hx = toX * trip ** 3; // slides sideways late, so it drops down the right edge first and stays clear of the text
    hy = toY * trip;
    head.style.transform = `translate(${hx}px, ${hy}px) scale(${1 - (1 - HEAD_END) * trip})`;
    if (!shown && trip > LAND_AT) shown = true; // the models come out as the head lands; plays once
    arrive += ((shown ? 1 : 0) - arrive) * (started && !reduce ? Math.min(ARRIVE_EASE * s, 1) : 1);
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
    // grows and shrinks with the window; the smaller of width and height wins so models never crowd each other
    const fit = clamp(Math.min(W / REF_W, H / REF_H), SCALE_MIN, SCALE_MAX);

    // where the head's centre is right now, in this section's space (items start here)
    const ox = head.offsetLeft - root.offsetLeft + hx + hw / 2;
    const oy = head.offsetTop - root.offsetTop + hy + hh / 2;

    for (let t = 0; t < count; t++) {
      const [fx, fy, base, depth] = SLOTS[t];
      const sz = base * SIZE * fit;
      const m = itm[t];

      // each item pops out from behind the head as it lands
      const goal = arrive > REVEAL_AT + t * STAGGER ? 1 : 0;
      rvs[t] += (goal - rvs[t]) * Math.min(REVEAL_SPEED * s, 1);
      if (Math.abs(goal - rvs[t]) < 0.001) rvs[t] = goal;
      const rv = rvs[t];

      // resting spot around the head, with a slow idle drift and the cursor lean
      const rx = W / 2 + fx * W + Math.sin(now * DRIFT_SPEED + t * 2.1) * DRIFT * live * fit;
      const ry = H / 2 + fy * H + Math.cos(now * DRIFT_SPEED * 0.8 + t * 1.7) * DRIFT * live * fit;
      const bx = ox + (rx - ox) * rv - parx * PARALLAX * depth * live * rv * fit;
      const by = oy + (ry - oy) * rv - pary * PARALLAX * depth * live * rv * fit;

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
        el.style.width = `${sz}px`;
        el.style.height = `${sz}px`;
        el.style.left = `${bx + m[0] - sz / 2}px`;
        el.style.top = `${by + m[1] - sz / 2}px`;
        const far = clamp(1 - depth / 1.2, 0, 1); // 0 = closest, 1 = furthest
        el.style.opacity = String(Math.min(rv * 2, 1));
        el.style.filter = far > 0.01 && !picked[t].model ? `blur(${far * 3}px)` : "";
        el.style.zIndex = rv < 0.95 || picked[t].decor ? "0" : picked[t].over ? "6" : String(clamp(Math.round(depth * 2), 1, 3)); // decor stays at the back, `over` items sit in front of the head (head is 5)
        el.style.setProperty("--grow", String((0.45 + 0.55 * rv) * (0.85 + 0.15 * (1 - far))));
        el.style.pointerEvents = picked[t].over ? "none" : rv > 0.9 ? "auto" : "none";
        el.style.setProperty("--hit", rv > 0.9 && !overHead ? "auto" : "none");
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
      <h2 className="threads__title">Dee Outside Of Design</h2>
      <p className="threads__body">
        Outside of design, I spend my free time listening to and finding new music, watching shows (animations and shows
        especially), reading webtoons or playing tetris. I love working out at home too (not everyday though).
      </p>
      <p className="threads__tag" ref={tagRef} aria-hidden="true" />
      <div
        className="threads__brand"
        aria-hidden="true"
        style={{ WebkitMaskImage: `url(${wordmark})`, maskImage: `url(${wordmark})` }}
      />

      <div className="threads__track">
      {picked.map((entry, i) => {
        const size = SLOTS[i][2] * SIZE;
        const Item: any = entry.decor ? "div" : Link; // decorations are plain, not links
        return (
          <Fragment key={entry.id}>
          <Item
            ref={(el: HTMLAnchorElement | null) => {
              itemRefs.current[i] = el;
            }}
            className={entry.decor ? "thread-item thread-item--decor" : "thread-item"}
            onClick={(e: React.MouseEvent) => {
              if (!entry.over) return;
              const r = headRef.current?.getBoundingClientRect();
              if (r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) e.preventDefault();
            }}
            {...(entry.decor
              ? { "aria-hidden": true }
              : { to: "/lore", state: { category: entry.id }, draggable: false, "aria-label": `Open ${entry.label}` })}
            onPointerEnter={() => {
              if (!tagRef.current) return;
              tagRef.current.textContent = entry.tag ?? `[${entry.label.toUpperCase()}]`;
              tagRef.current.classList.add("is-on");
            }}
            onPointerLeave={() => tagRef.current?.classList.remove("is-on")}
            style={{ width: size, height: size }}
          >
            {entry.item || entry.model ? (
              <Canvas
                className="thread-item__model"
                resize={{ offsetSize: true, scroll: false }}
                dpr={[1, 1.5]}
                flat
                gl={{ alpha: true, antialias: true }}
                camera={{ fov: 36, position: [0, 0, 9.9] }}
              >
                <ambientLight intensity={0.55} />
                <directionalLight position={[3, 4, 10]} intensity={0.35} />
                <Environment resolution={256}>
                  <Lightformer form="rect" intensity={0.4} position={[0, 0, 8]} scale={[12, 12, 1]} />
                  <Lightformer form="rect" intensity={4} position={[-6, 3, 6]} rotation-y={Math.PI / 4} scale={[3, 9, 1]} />
                  <Lightformer form="rect" intensity={4} position={[6, -3, 6]} rotation-y={-Math.PI / 4} scale={[3, 9, 1]} />
                </Environment>
                <Suspense fallback={null}>
                <Spinner rotRef={rotRef} index={i} front={entry.front} swing={entry.swing} pitch={entry.pitch} roll={entry.roll}>
                {entry.item ? <VinylDisc item={entry.item} /> : <GlbModel url={entry.model!} now={now} demo={DEMO} />}
                </Spinner>
                </Suspense>
              </Canvas>
            ) : (
              <div className="thread-item__ph" />
            )}
            {entry.over && <div className="thread-item__hit" />}
          </Item>
          </Fragment>
        );
      })}
      </div>
    </section>
  );
}
