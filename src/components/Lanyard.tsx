import type { MutableRefObject } from "react";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { Environment, Lightformer, RoundedBox, useGLTF } from "@react-three/drei";
import { Box3, BufferAttribute, BufferGeometry, CanvasTexture, CatmullRomCurve3, DoubleSide, RepeatWrapping, SRGBColorSpace, Vector3 } from "three";
import type { Group, Mesh, MeshPhysicalMaterial } from "three";

const MODEL = "/models/plastic_card_holder.glb";
const STEP = 1 / 120; // physics step, in seconds
const GRAVITY = 2400; // px/s²
const DAMP = 0.9985; // closer to 1 = swings for longer
const NODES = 5; // the anchor plus 4 links of strap
const SAMPLES = 32; // how smooth the strap is drawn
const STRAP_W = 40; // px
const K_REST = 0.3; // strap stiffness when hanging (1 = rigid)
const K_DRAG = 0.12; // looser while you hold it, so it stretches
const GRAB = 0.25; // how quickly the held clip follows the cursor (0-1 per step, higher = tighter)
const HELD_DAMP = 0.88; // calms the rest of the strap while you hold it
const STRETCH_DAMP = 0.1; // stretched strap loses energy, so it doesn't whip around
const RUBBER = 0.5; // pull beyond full length counts for half
const MAX_STRETCH = 2.4; // hard limit on how far it can stretch

type Node = { x: number; y: number; px: number; py: number; m: number };

// the blue strap, with DEE-SPACE printed along it
function strapTexture() {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#1046F9";
  g.fillRect(0, 0, 64, 256);
  g.fillStyle = "rgba(255,255,255,0.92)";
  g.font = "700 22px ui-monospace, Menlo, Consolas, monospace";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.save();
  g.translate(32, 128);
  g.rotate(-Math.PI / 2);
  g.fillText("DEE-SPACE ✦", 0, 0);
  g.restore();
  g.strokeStyle = "rgba(255,255,255,0.35)"; // stitching along the edges
  g.setLineDash([6, 5]);
  g.lineWidth = 1.5;
  for (const x of [5, 59]) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, 256);
    g.stroke();
  }
  const t = new CanvasTexture(c);
  t.wrapT = RepeatWrapping;
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function Hanging({ fade, compact }: { fade: MutableRefObject<number>; compact: boolean }) {
  const { scene: raw } = useGLTF(MODEL);
  const size = useThree((s) => s.size);
  const gl = useThree((s) => s.gl);
  const holder = useRef<Group>(null);
  const H = size.height;
  const W = size.width;
  const cardH = compact ? H * 0.9 : H * 0.82; // height of the card
  const reach = H * 0.13; // strap length from the top edge down to the clip
  const u = cardH / 500; // scales the strap and clip with the card (they were drawn for a ~500px card)
  const reduce = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);

  // glassy plastic you can see the card through
  const scene = useMemo(() => {
    const s = raw.clone(true);
    s.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      const mat = mesh.material as MeshPhysicalMaterial;
      if (mat.name === "Clear_Plastic") {
        const m = mat.clone();
        m.transmission = 0;
        m.transparent = true;
        m.opacity = 0.2;
        m.depthWrite = false;
        m.side = DoubleSide;
        m.roughness = 0.06;
        m.metalness = 0;
        m.envMapIntensity = 1.8;
        m.color.set("#e3edf2");
        mesh.material = m;
        mesh.renderOrder = 2;
      }
    });
    return s;
  }, [raw]);

  // scale the model to the card height and put its top-centre at the origin, so it hangs from there
  const fit = useMemo(() => {
    const box = new Box3().setFromObject(scene);
    const sz = box.getSize(new Vector3());
    const c = box.getCenter(new Vector3());
    const k = cardH / sz.y;
    return { k, pos: [-c.x * k, -box.max.y * k, -c.z * k] as [number, number, number], w: sz.x * k, d: sz.z * k };
  }, [scene, cardH]);

  const tex = useMemo(strapTexture, []);
  const geo = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(SAMPLES * 6), 3));
    g.setAttribute("uv", new BufferAttribute(new Float32Array(SAMPLES * 4), 2));
    const idx: number[] = [];
    for (let i = 0; i < SAMPLES - 1; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    g.setIndex(idx);
    return g;
  }, []);
  const ribbon = useRef<Mesh>(null);

  const sim = useRef({ nodes: [] as Node[], acc: 0, ry: 0, spin: 0, sv: 0, k: K_REST, ang: 0, drag: false, ox: 0, oy: 0, tx: 0, ty: 0, ax: 0, ay: 0, seg: 1 });

  // (re)build the strap whenever the canvas size changes
  useEffect(() => {
    const s = sim.current;
    s.ax = W * 0.33; // hang from the right side of the page
    s.ay = H / 2 + 24; // the strap starts just above the top edge
    s.seg = (reach + 24) / (NODES - 1);
    const tilt = reduce ? 0 : 0.35; // start slightly swung so it settles in on load
    s.nodes = Array.from({ length: NODES }, (_, i) => {
      const x = s.ax + Math.sin(tilt) * s.seg * i;
      const y = s.ay - Math.cos(tilt) * s.seg * i;
      return { x, y, px: x, py: y, m: i === NODES - 1 ? 6 : 1 }; // the card end is heavy
    });
  }, [H, W, reach, reduce]);

  // dragging: follow the cursor anywhere on the page
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const s = sim.current;
      if (!s.drag) return;
      const r = gl.domElement.getBoundingClientRect();
      s.tx = e.clientX - r.left - r.width / 2;
      s.ty = r.height / 2 - (e.clientY - r.top);
      s.sv = e.movementX * 0.012; // sideways drag turns the card
      s.spin += s.sv;
    };
    const up = () => {
      sim.current.drag = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [gl]);

  const step = (s: typeof sim.current) => {
    const n = s.nodes;
    const last = n.length - 1;
    const rest = s.seg * (NODES - 1);
    const end = n[last];
    const stretch = Math.hypot(end.x - s.ax, end.y - s.ay) / rest;
    s.k += ((s.drag ? K_DRAG : K_REST) - s.k) * 0.3;
    const damp = DAMP * (1 - Math.min(Math.max(stretch - 1, 0), 1) * STRETCH_DAMP) * (s.drag ? HELD_DAMP : 1);
    for (let i = 1; i <= last; i++) {
      const p = n[i];
      let vx = (p.x - p.px) * damp;
      let vy = (p.y - p.py) * damp;
      let ax = 0;
      let ay = -GRAVITY;
      if (i === last && s.drag) {
        // held: glide the clip toward the cursor, stretching the strap if you pull past its length
        const gx = s.tx + s.ox - s.ax;
        const gy = s.ty + s.oy - s.ay;
        const r = Math.hypot(gx, gy) || 1e-6;
        const reach = Math.min(rest + Math.max(0, r - rest) * RUBBER, rest * MAX_STRETCH);
        p.px = p.x;
        p.py = p.y;
        p.x += (s.ax + (gx / r) * reach - p.x) * GRAB;
        p.y += (s.ay + (gy / r) * reach - p.y) * GRAB;
        continue;
      }
      p.px = p.x;
      p.py = p.y;
      p.x += vx + ax * STEP * STEP;
      p.y += vy + ay * STEP * STEP;
    }
    for (let it = 0; it < 14; it++) {
      for (let i = 0; i < last; i++) {
        const a = n[i];
        const b = n[i + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 1e-6;
        const diff = ((d - s.seg) / d) * (d > s.seg ? s.k : 1); // stretches softly, never compresses
        const wa = i === 0 ? 0 : 1 / a.m;
        const wb = i + 1 === last && s.drag ? 0 : 1 / b.m; // the held clip is moved by the cursor, not by the strap
        const t = wa + wb;
        a.x += (dx * diff * wa) / t;
        a.y += (dy * diff * wa) / t;
        b.x -= (dx * diff * wb) / t;
        b.y -= (dy * diff * wb) / t;
      }
    }
  };

  useFrame((state, dt) => {
    const s = sim.current;
    const n = s.nodes;
    if (n.length < NODES) return;
    if (!compact) {
      s.acc += Math.min(dt, 0.05);
      while (s.acc >= STEP) {
        step(s);
        s.acc -= STEP;
      }
    }
    const last = n.length - 1;
    const a = n[last - 1];
    const b = n[last];

    // the card hangs along the last link, with a slow turn that speeds up when it's flung sideways
    const g = holder.current;
    if (g) {
      const speed = (b.x - b.px) / STEP;
      const turn = Math.max(-0.7, Math.min(0.7, speed * 0.0006)) + (reduce ? 0 : Math.sin(state.clock.elapsedTime * 0.7) * 0.25);
      s.ry += (turn - s.ry) * Math.min(dt * 5, 1);
      if (s.drag) {
        s.sv *= 0.8; // drag momentum fades if the pointer stops
      } else {
        s.spin += s.sv; // keep spinning from the flick...
        s.sv *= 0.92;
        const face = Math.round((s.spin + s.sv * 8) / Math.PI) * Math.PI; // ...then settle on the front or back
        s.spin += (face - s.spin) * Math.min(dt * 5, 1);
      }
      g.position.set(compact ? 0 : b.x, compact ? cardH / 2 : b.y, 0);
      let da = (compact ? 0 : Math.atan2(b.x - a.x, -(b.y - a.y))) - s.ang;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      s.ang += da * Math.min(dt * (s.drag ? 9 : 18), 1);
      g.rotation.set(0, s.spin + s.ry, s.ang, "ZYX");
    }

    // the strap: a flat ribbon along a smooth curve through the links
    const pts = [new Vector3(n[0].x, n[0].y + 80, 0), ...n.map((p) => new Vector3(p.x, p.y, 0))];
    const P = new CatmullRomCurve3(pts, false, "centripetal").getPoints(SAMPLES - 1);
    const pos = geo.attributes.position.array as Float32Array;
    const uv = geo.attributes.uv.array as Float32Array;
    const sw = STRAP_W * u / Math.sqrt(Math.max(1, Math.hypot(b.x - n[0].x, b.y - n[0].y) / (s.seg * (NODES - 1))));
    let len = 0;
    for (let i = 0; i < SAMPLES; i++) {
      const p = P[i];
      const q = P[Math.min(i + 1, SAMPLES - 1)];
      const o = P[Math.max(i - 1, 0)];
      let tx = q.x - o.x;
      let ty = q.y - o.y;
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl;
      ty /= tl;
      const th = (s.spin + s.ry) * Math.pow(i / (SAMPLES - 1), 1.5); // twist grows towards the card
      const cs = Math.cos(th);
      const nx = (-ty * sw * cs) / 2;
      const ny = (tx * sw * cs) / 2;
      const nz = (sw * Math.sin(th)) / 2;
      pos.set([p.x + nx, p.y + ny, nz, p.x - nx, p.y - ny, -nz], i * 6);
      if (i > 0) len += Math.hypot(p.x - P[i - 1].x, p.y - P[i - 1].y);
      uv.set([0, len / (256 * u), 1, len / (256 * u)], i * 4);
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.uv.needsUpdate = true;
  });

  const down = (e: ThreeEvent<PointerEvent>) => {
    if (fade.current < 0.1) return;
    e.stopPropagation();
    const s = sim.current;
    const end = s.nodes[s.nodes.length - 1];
    s.drag = true;
    s.tx = e.point.x;
    s.ty = e.point.y;
    s.ox = end.x - e.point.x; // keep hold of the spot you grabbed
    s.oy = end.y - e.point.y;
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
  };

  return (
    <>
      <mesh ref={ribbon} geometry={geo} position-z={-2} frustumCulled={false} visible={!compact}>
        <meshStandardMaterial map={tex} side={DoubleSide} roughness={0.8} />
      </mesh>
      <group
        ref={holder}
        onPointerDown={down}
        onPointerOver={() => {
          if (!sim.current.drag) document.body.style.cursor = "grab";
        }}
        onPointerOut={() => {
          if (!sim.current.drag) document.body.style.cursor = "";
        }}
      >
        <group scale={fit.k} position={fit.pos}>
          <primitive object={scene} />
        </group>
        {/* the metal clip the strap goes through */}
        <RoundedBox args={[58 * u, 46 * u, fit.d + 12 * u]} radius={6 * u} smoothness={4} position={[0, 8 * u, 0]}>
          <meshStandardMaterial color="#cfd4dc" metalness={1} roughness={0.3} />
        </RoundedBox>
      </group>
    </>
  );
}

export default function Lanyard() {
  const wrap = useRef<HTMLDivElement>(null);
  const fade = useRef(1);
  const [compact, setCompact] = useState(() => window.matchMedia("(max-width: 1100px)").matches);

  // phones and tablets: the card sits in the page instead of hanging
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1100px)");
    const on = () => setCompact(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  // desktop only: fade out over the last 300px of the page
  useEffect(() => {
    if (compact) {
      fade.current = 1;
      if (wrap.current) wrap.current.style.opacity = "";
      return;
    }
    const onScroll = () => {
      const el = document.documentElement;
      const left = el.scrollHeight - window.innerHeight - window.scrollY;
      fade.current = Math.max(0, Math.min(1, left / 300));
      if (wrap.current) wrap.current.style.opacity = String(fade.current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [compact]);

  return (
    <div
      ref={wrap}
      className="lanyard"
      aria-hidden="true"
      style={
        compact
          ? { position: "relative", width: "100%", height: 480, margin: 0, transform: "none", pointerEvents: "none" }
          : {
              position: "fixed",
              top: 0,
              left: 0,
              right: "auto",
              bottom: "auto",
              width: "100%",
              height: "100%",
              margin: 0,
              transform: "none",
              pointerEvents: "none",
              zIndex: 0,
            }
      }
    >
      <Canvas
        orthographic
        dpr={[1, 2]}
        flat
        eventSource={document.body}
        eventPrefix="client"
        gl={{ alpha: true, antialias: true }}
        camera={{ zoom: 1, position: [0, 0, 1000], near: 1, far: 3000 }}
      >
        <ambientLight intensity={0.8} />
        <directionalLight position={[200, 400, 800]} intensity={0.6} />
        <Environment resolution={256}>
          <Lightformer form="rect" intensity={0.6} position={[0, 0, 8]} scale={[12, 12, 1]} />
          <Lightformer form="rect" intensity={5} position={[-6, 3, 6]} rotation-y={Math.PI / 4} scale={[3, 9, 1]} />
          <Lightformer form="rect" intensity={5} position={[6, -3, 6]} rotation-y={-Math.PI / 4} scale={[3, 9, 1]} />
        </Environment>
        <Suspense fallback={null}>
          <Hanging fade={fade} compact={compact} />
        </Suspense>
      </Canvas>
    </div>
  );
}

useGLTF.preload(MODEL);