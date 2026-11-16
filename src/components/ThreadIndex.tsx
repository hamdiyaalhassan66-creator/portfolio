import { Fragment, Suspense, memo, useEffect, useMemo, useRef, useState } from "react";
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

type Props = {
  headRef: RefObject<HTMLDivElement | null>; // marks the pile of faces the models come out of
  landRef: RefObject<number>; // 0..1, written by Information: how far the faces have converged into the pile
};

// what hangs on each thread; `item` is the lore item whose 3D model is shown (none yet = placeholder)
type Entry = { id: string; label: string; item?: LoreItem; model?: string; front?: number; swing?: number; pitch?: number; roll?: number; decor?: boolean; over?: boolean; tag?: string };

// each item: angle on the wheel in degrees (0 = straight above the hub, negative = left), size in px, depth (bigger = closer, leans more)
const SLOTS: [number, number, number][] = [
  [-24, 360, 1.5], // cd player / turntable
  [-48, 340, 0.7], // vhs
  [24, 350, 1.4], // books
  [0, 470, 1.5], // camera, top of the wheel
  [48, 300, 0.6], // headphones
  [72, 440, 0.95], // dumbbell
  [-72, 400, 1.0], // game
];
const HUB_Y = 1.35; // pushed down so the top model stays at the same height (HUB_Y - WHEEL_RY = 0.4)
const WHEEL_RX = 0.58; // wider wheel, models spread further apart
const WHEEL_RY = 0.95; // taller wheel
const COMPACT = 1100; // at or below this width (phones + tablets) the floating wheel is off and the CSS carousel takes over
const DRAG_GAIN = 1; // 1 = the model at the top of the wheel follows your cursor exactly, lower = a heavier wheel
const WHEEL_GLIDE = 0.965; // how the wheel slows after you let go, closer to 1 = keeps turning longer
const SPAN = 168; // degrees one lap of the wheel covers (7 models x 24 degrees apart); change it if you add models or move slots
const DRAG_TAP = 6; // px, a press that moves less than this is still a click
const WHEEL_SPIN = 0; // degrees per second the wheel turns (0 = still)
const SIZE = 0.5; // scales every model together, keeping their relative sizes (1 = the old size)
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
const LAND_AT = 0.45; // the models start once the head's trip is this far along (1 = fully landed)
const REVEAL_AT = 0.02; // the first model starts coming out straight away
const STAGGER = 0.03; // each following model waits a little longer
const REVEAL_SPEED = 0.16; // how fast each one comes out (higher = faster)
const ARRIVE_EASE = 0.16; // how fast the reveal clock runs (higher = models come out sooner)
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
  const lastO = useRef(-1);
  useFrame(() => {
    const o = st.current.disc;
    if (Math.abs(o - lastO.current) < 0.002) return; // nothing changed, skip the text re-layout
    lastO.current = o;
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

function ThreadIndex({ headRef, landRef }: Props) {
  const rootRef = useRef<HTMLElement>(null);
const now = useNowPlaying();
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const tagRef = useRef<HTMLParagraphElement>(null);
  const rotRef = useRef<number[]>([]); // per item: yaw, pitch
  const [live, setLive] = useState(false);
  const liveRef = useRef(false); // read by the animation loop so it can sleep off-screen
  const drag = useRef({ on: false, moved: 0, sx: 0, sy: 0, lx: 0 });
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const io = new IntersectionObserver(
      ([e]) => {
        liveRef.current = e.isIntersecting;
        setLive(e.isIntersecting);
      },
      { rootMargin: "600px 0px" }
    );
    io.observe(root);
    return () => io.disconnect();
  }, []);

  // phones + tablets: lighter rendering, tracked live so rotating or resizing switches modes without a reload
  const [small, setSmall] = useState(() => window.matchMedia(`(max-width: ${COMPACT}px)`).matches);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${COMPACT}px)`);
    const on = () => setSmall(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const [near, setNear] = useState<Set<number>>(() => new Set());
  useEffect(() => {
    const els = itemRefs.current;
    const io = new IntersectionObserver(
      (entries) =>
        setNear((prev) => {
          const next = new Set(prev);
          for (const e of entries) {
            const i = els.indexOf(e.target as HTMLAnchorElement);
            if (i < 0) continue;
            if (e.isIntersecting) next.add(i);
            else if (small) next.delete(i); // desktop keeps it once loaded
          }
          return next;
        }),
      { rootMargin: small ? "0px 150px" : "150% 0px 150% 0px" } // desktop: start building canvases about 1.5 screens early
    );
    els.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [small]);

  // spread the picks evenly through the list so sleeves and discs are mixed
  const picked = useMemo<Entry[]>(
    () => [
      { id: "music", label: "Music", model: "/models/cd_player_split.glb", front: 0.55, pitch: (70 * Math.PI) / 180, roll: (-14 * Math.PI) / 180 },
      { id: "films", label: "Films", model: "/models/vhs-player.opt.glb", front: -0.6, pitch: (30 * Math.PI) / 180, roll: (9 * Math.PI) / 180 },
      { id: "books", label: "Illustrated Books", model: "/models/coffee_table_books.opt.glb", front: -0.3, pitch: (38 * Math.PI) / 180, roll: (-11 * Math.PI) / 180 },
      { id: "photos", label: "Photographs", model: "/models/camera.opt.glb", over: true, pitch: (14 * Math.PI) / 180, roll: (8 * Math.PI) / 180 },
      { id: "headphones", label: "Headphones", tag: "[I LOVE MY HEADPHONES]", decor: true, model: "/models/headphones.opt.glb", front: 0.5, pitch: (8 * Math.PI) / 180, roll: (-10 * Math.PI) / 180 },
      { id: "dumbbell", label: "Dumbbell", tag: "[I LOVE WORKING OUT]", decor: true, model: "/models/dumbbell.opt.glb", front: -0.4, pitch: (28 * Math.PI) / 180, roll: (-22 * Math.PI) / 180 },
      { id: "game", label: "Game", tag: "[MY ALL-TIME FAVOURITE GAME]", decor: true, model: "/models/game.opt.glb", front: 0.4, pitch: (20 * Math.PI) / 180, roll: (-8 * Math.PI) / 180 },
    ],
    []
  );
    // fetch the .glb files in the background while you read, so they are ready when the canvases are built
  useEffect(() => {
    if (small) return;
    const t = window.setTimeout(() => picked.forEach((p) => p.model && useGLTF.preload(p.model)), 800);
    return () => window.clearTimeout(t);
  }, [picked, small]);

useEffect(() => {
  const root = rootRef.current;
  const head = headRef.current;
  if (!root || !head) return;
  if (small) return; // phones + tablets: no floating/drag animation, the CSS carousel takes over

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const live = reduce ? 0 : 1;
  const count = picked.length;
  // per item: shove x, y, vx, vy, yaw, yaw speed, pitch, pitch speed
  const itm = picked.map(() => new Float32Array(8));
  const szs: number[] = []; // last size written per item, so width/height only touch the DOM when they change
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
  let overHead = false; // cursor is inside the head's area (worked out once per frame)

  // the wheel: how far it has turned (degrees), and how fast it is turning (degrees per frame)
  let wheel = 0;
  let wheelV = 0;

  const onMove = (e: PointerEvent) => {
    const d = drag.current;
    if (d.on) {
      // dragging the wheel: every model follows along the path
      const dAng = (((e.clientX - d.lx) / (W * WHEEL_RX)) * 180 * DRAG_GAIN) / Math.PI;
      d.lx = e.clientX;
      d.moved = Math.max(d.moved, Math.hypot(e.clientX - d.sx, e.clientY - d.sy));
      wheel += dAng;
      wheelV = wheelV * 0.4 + dAng * 0.6;
      cX = e.clientX;
      cY = e.clientY;
      inside = true;
      return;
    }
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
    overHead = false;
  };
  const onUp = () => {
    drag.current.on = false; // wheelV carries on as momentum
    document.body.style.userSelect = "";
  };
  // start a drag from anywhere inside the section (mouse / pen; touch keeps using the models so vertical scroll still works)
  const onDown = (e: PointerEvent) => {
    if (e.button !== 0 || e.pointerType === "touch" || drag.current.on) return; // a model already started this drag
    const rr = root.getBoundingClientRect();
    if (e.clientX < rr.left || e.clientX > rr.right || e.clientY < rr.top || e.clientY > rr.bottom) return;
    const hr = head.getBoundingClientRect();
    if (e.clientX >= hr.left && e.clientX <= hr.right && e.clientY >= hr.top && e.clientY <= hr.bottom) return; // keep the portrait clear
    drag.current = { on: true, moved: 0, sx: e.clientX, sy: e.clientY, lx: e.clientX };
    document.body.style.userSelect = "none";
  };
  // touchpad: swipe left / right with two fingers to turn the wheel
  const onWheel = (e: WheelEvent) => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return; // vertical scrolling stays normal
    const rr = root.getBoundingClientRect();
    if (e.clientX < rr.left || e.clientX > rr.right || e.clientY < rr.top || e.clientY > rr.bottom) return;
    e.preventDefault(); // also stops the browser's swipe-back gesture
    wheel += ((-e.deltaX / (W * WHEEL_RX)) * 180 * DRAG_GAIN) / Math.PI;
    wheelV = 0; // the touchpad already sends its own inertia
  };
  window.addEventListener("pointerdown", onDown, { passive: true });
  window.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
  document.documentElement.addEventListener("mouseleave", onLeave);

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
    if (!W || !liveRef.current) return; // asleep while the section is off-screen

    // the faces converge into a pile; the models come out of it, and fold back in when you scroll up
    const rr = root.getBoundingClientRect();
    const hr = head.getBoundingClientRect();
    const land = landRef.current ?? 0;
    shown = land > LAND_AT;
    arrive += ((shown ? 1 : 0) - arrive) * (started && !reduce ? Math.min(ARRIVE_EASE * s, 1) : 1);
    started = true;

    overHead = inside && cX >= hr.left && cX <= hr.right && cY >= hr.top && cY <= hr.bottom;
    const mx = cX - rr.left;
    const my = cY - rr.top;
    parx += ((inside ? clamp(mx / W - 0.5, -0.5, 0.5) : 0) - parx) * 0.05 * s;
    pary += ((inside ? clamp(my / H - 0.5, -0.5, 0.5) : 0) - pary) * 0.05 * s;
    pvx *= 0.85;
    pvy *= 0.85;
    const speed = Math.hypot(pvx, pvy);
    // the wheel turns with your drag and keeps going a little after you let go
    if (drag.current.on) {
      wheelV *= Math.pow(0.85, s); // holding still kills the speed, so only a flick throws it
    } else {
      wheel += wheelV * s;
      wheelV *= Math.pow(WHEEL_GLIDE, s);
      if (Math.abs(wheelV) < 0.002) wheelV = 0;
    }
    // grows and shrinks with the window; the smaller of width and height wins so models never crowd each other
    const fit = clamp(Math.min(W / REF_W, H / REF_H), SCALE_MIN, SCALE_MAX);
    const RX = W * WHEEL_RX; // the wheel is an ellipse now: wide, but no taller than before
    const RY = H * WHEEL_RY;

    // where the head's centre is right now, in this section's space (items start here)
    const ox = hr.left + hr.width / 2 - rr.left;
    const oy = hr.top + hr.height / 2 - rr.top;

    for (let t = 0; t < count; t++) {
      const [angle, base, depth] = SLOTS[t];
      const sz = base * SIZE * fit;
      const m = itm[t];

      // each item pops out from behind the head as it lands
      const goal = arrive > REVEAL_AT + t * STAGGER ? 1 : 0;
      rvs[t] += (goal - rvs[t]) * Math.min(REVEAL_SPEED * s, 1);
      if (Math.abs(goal - rvs[t]) < 0.001) rvs[t] = goal;
      const rv = rvs[t];

      // resting spot around the head, with a slow idle drift and the cursor lean
      // where this model sits on the wheel; past one end it re-enters from the other
      const a = ((((angle + wheel + (now / 1000) * WHEEL_SPIN + SPAN / 2) % SPAN) + SPAN) % SPAN) - SPAN / 2;
      const ang = (a * Math.PI) / 180;
      const edge = clamp((SPAN / 2 - Math.abs(a)) / 14, 0, 1); // fades over the last 14 degrees so the wrap never shows
      const rx = W / 2 + RX * Math.sin(ang) + Math.sin(now * DRIFT_SPEED + t * 2.1) * DRIFT * live * fit;
      const ry = H * HUB_Y - RY * Math.cos(ang) + Math.cos(now * DRIFT_SPEED * 0.8 + t * 1.7) * DRIFT * live * fit;
      const bx = ox + (rx - ox) * rv - parx * PARALLAX * depth * live * rv * fit;
      const by = oy + (ry - oy) * rv - pary * PARALLAX * depth * live * rv * fit;

      // a moving cursor shoves the item away and sets it spinning
      if (inside && live && rv > 0.9 && !drag.current.on) {
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
        if (szs[t] !== sz) {
          szs[t] = sz;
          el.style.width = `${sz}px`;
          el.style.height = `${sz}px`;
        }
        const far = clamp(1 - depth / 1.2, 0, 1); // 0 = closest, 1 = furthest
        el.style.opacity = String(Math.min(rv * 2, 1) * edge);
        el.style.filter = far > 0.01 && !picked[t].model ? `blur(${far * 3}px)` : "";
        el.style.zIndex = rv < 0.95 || picked[t].decor ? "0" : picked[t].over ? "6" : String(clamp(Math.round(depth * 2), 1, 3)); // decor stays at the back, `over` items sit in front of the head (head is 5)
        const grow = (0.45 + 0.55 * rv) * (0.85 + 0.15 * (1 - far));
        el.style.transform = `translate3d(${bx + m[0] - sz / 2}px, ${by + m[1] - sz / 2}px, 0) scale(${grow})`;
        const hot = rv > 0.9 && edge > 0.5; // fully out, and not fading at the wrap point
        el.style.pointerEvents = picked[t].over ? "none" : hot ? "auto" : "none";
        el.style.setProperty("--hit", hot && !overHead ? "auto" : "none");
        el.style.cursor = drag.current.on ? "grabbing" : "grab";
        el.style.touchAction = "pan-y"; // on tablets, vertical swipes still scroll the page
      }
    }
  };
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    window.removeEventListener("pointerdown", onDown);
    window.removeEventListener("wheel", onWheel);
    window.removeEventListener("pointermove", onMove);
    document.body.style.userSelect = "";
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    document.documentElement.removeEventListener("mouseleave", onLeave);
    // switching to phone/tablet mode: hand positioning back to the CSS carousel
    itemRefs.current.forEach((el) => {
      if (!el) return;
      for (const p of ["transform", "opacity", "filter", "zIndex", "pointerEvents", "cursor", "touchAction"]) (el.style as any)[p] = "";
      el.style.removeProperty("--hit");
    });
  };
}, [picked, headRef, landRef, small]);

  return (
    <section className="threads" ref={rootRef} aria-label="An index of Dee's mind">

      <div className="threads__track">
      {picked.map((entry, i) => {
        const size = SLOTS[i][1] * SIZE;
        const Item: any = entry.decor ? "div" : Link; // decorations are plain, not links
        return (
          <Fragment key={entry.id}>
          <Item
            ref={(el: HTMLAnchorElement | null) => {
              itemRefs.current[i] = el;
            }}
            className={entry.decor ? "thread-item thread-item--decor" : "thread-item"}
            onPointerDown={(e: React.PointerEvent) => {
              drag.current.moved = 0;
              if (small || e.button !== 0) return;
              const r = headRef.current?.getBoundingClientRect();
              if (entry.over && r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) return;
              drag.current = { on: true, moved: 0, sx: e.clientX, sy: e.clientY, lx: e.clientX };
            }}
            onDragStart={(e: React.DragEvent) => e.preventDefault()}
            onClick={(e: React.MouseEvent) => {
              if (drag.current.moved > DRAG_TAP) {
                e.preventDefault(); // it was a drag, not a click, so don't open the link
                return;
              }
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
            {(entry.item || entry.model) && near.has(i) ? (
              <Canvas
                className="thread-item__model"
                resize={{ offsetSize: true, scroll: false }}
                frameloop={live ? "always" : "never"}
                dpr={small ? 1 : [1, 1.5]}
                flat
                gl={{ alpha: true, antialias: !small, powerPreference: small ? "low-power" : "high-performance" }}
                camera={{ fov: 36, position: [0, 0, 9.9] }}
                onCreated={({ gl }) =>
                  // let the browser restore the context instead of leaving a dead canvas
                  gl.domElement.addEventListener("webglcontextlost", (e) => e.preventDefault())
                }
              >
                <ambientLight intensity={0.55} />
                <directionalLight position={[3, 4, 10]} intensity={0.35} />
                <Environment resolution={small ? 64 : 128}>
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

export default memo(ThreadIndex);
