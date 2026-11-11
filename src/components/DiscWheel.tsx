import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { MutableRefObject } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, useGLTF, useTexture } from "@react-three/drei";
import gsap from "gsap";
import type { LoreItem } from "../data/lore";
import { backTexture, dominantColor, flattenBackUv } from "./sleeveBack";
import "./DiscWheel.css";

const MODEL = "/models/sleeve.glb";
const CD_MODEL = "/models/cd.glb";
const VINYL_MODEL = "/models/vinyl.glb";
const CD_FACE = -Math.PI / 2; // turns the disc from facing sideways to facing the camera
useGLTF.preload(MODEL, false);
useGLTF.preload(CD_MODEL, false);
useGLTF.preload(VINYL_MODEL, false);

// the model's UVs drift from a straight map of position, which stair-steps the circular edge of the art.
// rebuilding them from vertex positions makes the circle exact
const CD_UV = 0.5275; // texture units per model unit (0.4826 / the disc's 0.9148 radius)
function planarUv(geo: THREE.BufferGeometry) {
  const p = geo.attributes.position;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    uv[2 * i] = 0.5 + p.getZ(i) * CD_UV;
    uv[2 * i + 1] = 0.5 + p.getX(i) * CD_UV;
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
}

export function CdDisc({ item }: { item: LoreItem }) {
  const { scene } = useGLTF(CD_MODEL, false);
  const cover = useTexture(item.image);

  const obj = useMemo(() => {
    const root = scene.clone(true);
    const front = cdFaceTexture(cover.image as HTMLImageElement);

    const discs: THREE.Mesh[] = [];
    const drop: THREE.Object3D[] = [];
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.raycast = () => {};
      // only the disc is kept; the jewel case and the hub ring go
      if ((mesh.material as THREE.Material).name === "Material.001") discs.push(mesh);
      else drop.push(mesh);
    });
    drop.forEach((m) => m.removeFromParent());

    // split the top face into its own mesh so the cover prints on it and the underside stays silver
    for (const mesh of discs) {
      const original = mesh.material as THREE.MeshStandardMaterial;
      const ids = mesh.geometry.index!.array;
      const ny = mesh.geometry.attributes.normal;
      const pos = mesh.geometry.attributes.position;
      const top: number[] = [];
      const under: number[] = [];
      const wall: number[] = [];
      for (let t = 0; t < ids.length; t += 3) {
        const a = ids[t];
        const b = ids[t + 1];
        const c = ids[t + 2];
        const ySum = ny.getY(a) + ny.getY(b) + ny.getY(c);
        const cx = (pos.getX(a) + pos.getX(b) + pos.getX(c)) / 3;
        const cz = (pos.getZ(a) + pos.getZ(b) + pos.getZ(c)) / 3;
        if (Math.hypot(cx, cz) < CD_R * 0.9) continue; // only the outer rim is kept, the faces are rebuilt below
        (ySum > 2.7 ? top : ySum < -2.7 ? under : wall).push(a, b, c);
      }
      // clean ring faces instead of the model's fanned triangles
      const yTop = pos.getY(top[0]);
      const yBot = pos.getY(under[0]);
      const makeFace = (up: boolean) => {
        const g = new THREE.RingGeometry(CD_CLEAR, CD_R, 180, 1);
        g.rotateX(up ? -Math.PI / 2 : Math.PI / 2);
        g.translate(0, up ? yTop : yBot, 0);
        planarUv(g);
        return g;
      };
      const topGeo = makeFace(true);
      const underGeo = makeFace(false);
      const wallGeo = mesh.geometry.clone();
      wallGeo.setIndex(wall);

      const silver = original.clone();
      silver.userData.fade = true; // the scene fades sleeves in and out at the ends of the row
      mesh.geometry = underGeo;
      mesh.material = silver;

      // plain metallic edge, so the rim doesn't pick up the texture's outline
      const edgeMat = new THREE.MeshPhysicalMaterial({
        color: CD_EDGE,
        metalness: 1,
        roughness: 0.15,
        envMapIntensity: 1,
      });
      edgeMat.userData.fade = true;
      const rim = new THREE.Mesh(wallGeo, edgeMat);
      rim.raycast = () => {};
      mesh.add(rim);

      const printedMat = new THREE.MeshPhysicalMaterial({
        map: front,
        color: "#ffffff",
        roughness: 0.4,
        metalness: 0,
        clearcoat: 1, // same glossy lacquer layer as the sleeves
        clearcoatRoughness: 0.04,
        envMapIntensity: 1,
      });
      printedMat.userData.fade = true;
      const printed = new THREE.Mesh(topGeo, printedMat);
      printed.raycast = () => {};
      mesh.add(printed);

      // clear plastic ring around the hole, the page shows through it
      const clearMat = new THREE.MeshPhysicalMaterial({
        color: "#dfe8ee",
        transparent: true,
        opacity: CD_CLEAR_OPACITY,
        roughness: 0.04,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.02,
        envMapIntensity: 3,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      clearMat.userData.fade = true;
      clearMat.userData.baseOpacity = CD_CLEAR_OPACITY;
      const clearGeo = new THREE.RingGeometry(CD_HOLE, CD_CLEAR, 128);
      clearGeo.rotateX(-Math.PI / 2);
      clearGeo.translate(0, (yTop + yBot) / 2, 0);
      const clear = new THREE.Mesh(clearGeo, clearMat);
      clear.raycast = () => {};
      mesh.add(clear);
    }

    // centre it, turn it to face the camera, and scale to span 2 world units like the sleeve
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    root.position.sub(center);

    const face = new THREE.Group();
    face.add(root);
    face.rotation.y = CD_FACE;

    const wrapper = new THREE.Group();
    wrapper.add(face);
    wrapper.scale.setScalar(2 / Math.max(size.x, size.y, size.z));
    return wrapper;
  }, [scene, cover]);

  return <primitive object={obj} />;
}

const VINYL_R = 0.15; // the record's outer radius in model units
const HOLE_R = 0.125 * VINYL_R; // centre hole, same proportions as the CD
const CLEAR_R = 0.2 * VINYL_R; // hole to here is clear plastic
const HUB_R = 0.27 * VINYL_R; // CLEAR_R to here is the silver hub band
const COVER_INNER = CLEAR_R; // the record and cover are cut away inside this radius
const COVER_OUTER = 0.147; // leaves a thin black rim at the edge (the record is 0.15)

// how the vinyl model's own textures sit on each face, measured from the file,
// so the cover ring can reuse the record's original shine
const FRONT_UV = (x: number, y: number): [number, number] => [
  0.4703 * x + 1.8775 * y + 0.2907,
  -1.8775 * x + 0.4703 * y + 0.2906,
];
const BACK_UV = (x: number, y: number): [number, number] => [
  1.7497 * x + 0.8276 * y + 0.7092,
  0.8276 * x - 1.7497 * y + 0.7088,
];
const FACE_Z = 0.00105; // height of the record's front face

// square-crops the cover from the centre so it fills the circular label
// flat colour fill, used for the back face so only the record's own surface texture shows
function solidTexture([r, g, b]: [number, number, number]) {
  const c = document.createElement("canvas");
  c.width = c.height = 16;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
  ctx.fillRect(0, 0, 16, 16);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function labelTexture(src: HTMLImageElement, item?: LoreItem) {
  const S = 1024;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d")!;
  const side = Math.min(src.width, src.height);
  g.drawImage(src, (src.width - side) / 2, (src.height - side) / 2, side, side, 0, 0, S, S);

  if (item) {
    const mid = S / 2;
    const FONT = "system-ui, Helvetica, Arial, sans-serif";

    // even tint over the whole cover, clipped to the disc
    g.save();
    g.beginPath();
    g.arc(mid, mid, mid, 0, TAU);
    g.clip();
    g.fillStyle = "rgba(10, 12, 18, 0.25)"; // raise the last number for a darker disc
    g.fillRect(0, 0, S, S);
    g.restore();

    g.fillStyle = "#ffffff";
    g.textBaseline = "alphabetic";

    // thin printed ring just inside the border
    g.strokeStyle = "rgba(255,255,255,0.25)";
    g.lineWidth = 2;
    g.beginPath();
    g.arc(mid, mid, mid * 0.9, 0, TAU);
    g.stroke();

    // text that follows the disc's curve, shrinks until it fits maxDeg
    const arcText = (text: string, r: number, bottom: boolean, px: number, weight: number, track: number, maxDeg: number) => {
      const chars = [...text.toUpperCase()];
      const measure = () => {
        g.font = `${weight} ${px}px ${FONT}`;
        const ws = chars.map((ch) => g.measureText(ch).width);
        return { ws, total: ws.reduce((a, b) => a + b + track, 0) - track };
      };
      let m = measure();
      while ((m.total / r) * (180 / Math.PI) > maxDeg && px > 12) {
        px -= 2;
        m = measure();
      }
      g.textAlign = "center";
      const centre = bottom ? Math.PI / 2 : -Math.PI / 2;
      let cum = 0;
      chars.forEach((ch, i) => {
        const w = m.ws[i];
        const off = cum + w / 2 - m.total / 2;
        cum += w + track;
        const a = bottom ? centre - off / r : centre + off / r;
        const x = mid + r * Math.cos(a);
        const y = mid + r * Math.sin(a);
        const rot = bottom ? a - Math.PI / 2 : a + Math.PI / 2;
        // engraved: light catches the lower edge, shadow sits in the upper edge
        const pass = (dx: number, dy: number, color: string) => {
          g.save();
          g.translate(x + dx, y + dy);
          g.rotate(rot);
          g.fillStyle = color;
          g.fillText(ch, 0, 0);
          g.restore();
        };
        pass(1.5, 1.5, "rgba(255,255,255,0.45)"); // highlight
        pass(-1, -1, "rgba(0,0,0,0.55)"); // inner shadow
        pass(0, 0, "rgba(0,0,0,0.28)"); // recessed fill
      });
    };

    const ringR = mid * 0.8; // one shared radius, so the top and bottom text mirror each other
    arcText(item.title, ringR, false, 30, 700, 5, 150); // top: title
    arcText([item.creator, item.year].filter(Boolean).join("  ·  "), ringR, true, 28, 500, 5, 150); // bottom: artist · year
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function VinylRecord({ item }: { item: LoreItem }) {
  const { scene } = useGLTF(VINYL_MODEL, false);
  const cover = useTexture(item.image);

  const obj = useMemo(() => {
    const root = scene.clone(true);

    // the file is exported tilted by Information 47°, so clear that and the record faces the camera
    const tilted = root.children[0];
    if (tilted) {
      tilted.position.set(0, 0, 0);
      tilted.quaternion.identity();
      tilted.scale.set(1, 1, 1);
    }

    const originals: THREE.MeshStandardMaterial[] = [];
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.raycast = () => {};
      const base = mesh.material as THREE.MeshStandardMaterial;
      originals.push(base);
      const mat = base.clone();
      mat.userData.fade = true; // the scene fades sleeves in and out at the ends of the row
      // discard everything inside CLEAR_R so the original label and surface disappear from the centre
      mat.onBeforeCompile = (s) => {
        s.uniforms.uCut = { value: CLEAR_R };
        s.vertexShader = s.vertexShader
          .replace("#include <common>", "#include <common>\nvarying vec3 vLocal;")
          .replace("#include <begin_vertex>", "#include <begin_vertex>\nvLocal = position;");
        s.fragmentShader = s.fragmentShader
          .replace("#include <common>", "#include <common>\nvarying vec3 vLocal;\nuniform float uCut;")
          .replace("#include <clipping_planes_fragment>", "#include <clipping_planes_fragment>\nif (length(vLocal.xy) < uCut) discard;");
      };
      mat.customProgramCacheKey = () => "vinyl-hole";
      mesh.material = mat;
    });

    // the cover goes over the black surface on both faces, reusing the record's own shine
    const texFront = labelTexture(cover.image as HTMLImageElement, item); // front carries the text
    const texBack = solidTexture(dominantColor(cover.image as HTMLImageElement)); // back is the cover's dominant colour
    texFront.channel = 1; // the cover uses its own UV set, the record's textures keep theirs
    texBack.channel = 1;
    const addLabel = (front: boolean) => {
      const geo = new THREE.RingGeometry(COVER_INNER, COVER_OUTER, 180);
      geo.setAttribute("uv1", geo.attributes.uv.clone()); // the cover's own mapping
      if (!front) geo.rotateY(Math.PI); // faces the other way, still reads the right way round

      // swap the main UVs for the record's own, so its original roughness carries over
      const p = geo.attributes.position;
      const uv = geo.attributes.uv;
      for (let i = 0; i < p.count; i++) {
        const [u, v] = (front ? FRONT_UV : BACK_UV)(p.getX(i), p.getY(i));
        uv.setXY(i, u, v);
      }

      const mat = originals[0].clone();
      mat.map = front ? texFront : texBack;
      mat.aoMap = null;
      mat.polygonOffset = true;
      mat.polygonOffsetFactor = -2;
      mat.polygonOffsetUnits = -2;
      mat.userData.fade = true;
      const label = new THREE.Mesh(geo, mat);
      label.raycast = () => {};
      label.position.z = front ? FACE_Z + 0.0004 : -0.0004;
      root.add(label);
    };
    addLabel(true);
    addLabel(false);

    // silver hub band on both faces, same look as the CD's
    const addHub = (front: boolean) => {
      const geo = new THREE.RingGeometry(CLEAR_R, HUB_R, 96);
      if (!front) geo.rotateY(Math.PI);
      const mat = new THREE.MeshPhysicalMaterial({
        color: "#c4c4c8",
        metalness: 1,
        roughness: 0.25,
        envMapIntensity: 1,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnits: -4,
      });
      mat.userData.fade = true;
      const hub = new THREE.Mesh(geo, mat);
      hub.raycast = () => {};
      hub.position.z = front ? FACE_Z + 0.0008 : -0.0008;
      root.add(hub);
    };
    addHub(true);
    addHub(false);

    // silver outer border, same material as the hub band
    const silverMat = () => {
      const m = new THREE.MeshPhysicalMaterial({
        color: "#c4c4c8",
        metalness: 1,
        roughness: 0.25,
        envMapIntensity: 1,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnits: -4,
      });
      m.userData.fade = true;
      return m;
    };
    const addRim = (front: boolean) => {
      const geo = new THREE.RingGeometry(COVER_OUTER - 0.0005, VINYL_R, 180);
      if (!front) geo.rotateY(Math.PI);
      const rim = new THREE.Mesh(geo, silverMat());
      rim.raycast = () => {};
      rim.position.z = front ? FACE_Z + 0.0008 : -0.0008;
      root.add(rim);
    };
    addRim(true);
    addRim(false);

    // silver side wall
    const wallGeo = new THREE.CylinderGeometry(VINYL_R, VINYL_R, FACE_Z + 0.0016, 180, 1, true);
    wallGeo.rotateX(Math.PI / 2);
    const wall = new THREE.Mesh(wallGeo, silverMat());
    wall.raycast = () => {};
    wall.position.z = FACE_Z / 2;
    root.add(wall);

    // clear plastic ring around the hole, the page shows through it
    const clearMat = new THREE.MeshPhysicalMaterial({
      color: "#dfe8ee",
      transparent: true,
      opacity: 0.3,
      roughness: 0.04,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      envMapIntensity: 3,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    clearMat.userData.fade = true;
    clearMat.userData.baseOpacity = 0.3;
    const clear = new THREE.Mesh(new THREE.RingGeometry(HOLE_R, CLEAR_R, 96), clearMat);
    clear.raycast = () => {};
    clear.position.z = FACE_Z / 2;
    root.add(clear);

    // centre it and scale to span 2 world units like the sleeve
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    root.position.sub(center);

    const wrapper = new THREE.Group();
    wrapper.add(root);
    wrapper.scale.setScalar(2 / Math.max(size.x, size.y));
    return wrapper;
  }, [scene, cover]);

  return <primitive object={obj} />;
}

// ---- tune the feel here ----
const BASE = 0.5; // centre sleeve width, as a fraction of the stage width
const GROW = 0.25; // each step to the right is this much bigger
const GROW_L = 0.22; // each step to the left is this much smaller
const XA_L = 0.8; // now only sets how fast the left side drops (y), not the spacing
const GAP_L = 0.004; // gap between neighbouring sleeves on the left (fraction of stage width)
const XA = 0.285; // horizontal travel per step (fraction of stage width)
const KAPPA = 0.35; // how much the spacing widens toward the right
const Y0 = 0.51; // centre sleeve height (fraction of stage height from the top)
const YP = 0.18; // how far each step to the right climbs
const YN = 0.12; // how far each step to the left drops
const TILT_X = 0.28; // rest pitch, radians (flip the sign to tip the other way)
const TILT_Y = -0.32; // rest yaw (flip the sign to turn the other way)
const ROLL = 0.2; // rest in-plane roll
const Z_STEP = 400; // depth gap between neighbouring sleeves, so tilted ones can't intersect
const Z_LIFT = 500; // extra pull toward the camera while a sleeve is grabbed or flipping
const STEP_YAW = -0.1; // extra yaw per step away from the centre
const STEP_PITCH = -0.1; // extra pitch per step to the right (negative tips the face up, left sleeves tip down more)
const HOVER = 0.22; // how far the sleeve under the cursor leans toward it, radians
const ROT_SENS = 0.012; // radians turned per dragged px when you grab a sleeve
const STEP_PX = 300; // dragging empty space: design px per sleeve
const WHEEL_SENS = 500; // wheel px per sleeve
const SETTLE_MS = 140; // pause after the last wheel event before snapping
const FLICK = 0.25; // seconds of momentum added when you release an empty-space drag
const INTRO_S = 0.7; // total length of the entry animation, seconds
const INTRO_STAGGER = 0.06; // share of that spent staggering the sleeves, the rest is each sleeve's own travel
const INTRO_X = 0.35; // how far right of its resting spot each sleeve starts (fraction of stage width)
// ----------------------------

const TAU = Math.PI * 2;
const motionOn = () => !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const mod = (a: number, n: number) => ((a % n) + n) % n;
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

// same curve as CSS cubic-bezier / anime.js cubicBezier
function bezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0;
    let hi = 1;
    let t = x;
    for (let i = 0; i < 24; i++) {
      const v = ((ax * t + bx) * t + cx) * t;
      if (v < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return ((ay * t + by) * t + cy) * t;
  };
}
const EASE = bezier(0.7, 0.1, 0.5, 0.9);
const EASE_IN = bezier(0.2, 0.1, 0.3, 1); // quicker start for the entry, scroll keeps EASE

const _e = new THREE.Euler();
const _qBase = new THREE.Quaternion();
const _qGrab = new THREE.Quaternion();

/* ---------- 3D ---------- */

// square-crops the cover from the centre so any aspect ratio fits the sleeve face
function coverTexture(src: HTMLImageElement) {
  const S = 1024;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d")!;
  const side = Math.min(src.width, src.height);
  g.drawImage(src, (src.width - side) / 2, (src.height - side) / 2, side, side, 0, 0, S, S);

  const tex = new THREE.CanvasTexture(c);
  tex.flipY = false; // glTF convention
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// ---- CD border ----
const CD_RIM = 0.03; // outer border width, as a fraction of the disc radius
const CD_EDGE = "#7a7a80"; // colour of the disc's thin side wall
const CD_SILVER = ["#8e8e94", "#5c5c62", "#7e7e84", "#4a4a50", "#92929a", "#606066", "#76767c", "#52525a"]; // sheen stops around the rim
const CD_R = 0.9148; // the disc's outer radius in model units
const CD_HOLE = 0.125 * CD_R; // centre hole
const CD_CLEAR = 0.2 * CD_R; // hole to here is clear plastic
const CD_HUB = 0.27 * CD_R; // CD_CLEAR to here is the silver hub band
const CD_CLEAR_OPACITY = 0.3; // lower = more see-through

// prints the cover inside a silver border
function cdFaceTexture(src: HTMLImageElement) {
  const S = 2048;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d")!;
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = "high";
  const mid = S / 2;
  const R = 0.4826 * S; // disc radius in texture px (the model's UVs span 0.0174 to 0.9826)

  // the art across the whole disc area
  const side = Math.min(src.width, src.height);
  g.drawImage(src, (src.width - side) / 2, (src.height - side) / 2, side, side, mid - R, mid - R, R * 2, R * 2);

  // silver border: everything outside the inner circle, with a metallic sheen going around it
  let paint: string | CanvasGradient = "#c4c4c8";
  if (g.createConicGradient) {
    const grad = g.createConicGradient(0, mid, mid);
    CD_SILVER.forEach((col, i) => grad.addColorStop(i / CD_SILVER.length, col));
    grad.addColorStop(1, CD_SILVER[0]);
    paint = grad;
  }
  const inner = R * (1 - CD_RIM);
  g.fillStyle = paint;
  g.beginPath();
  g.rect(0, 0, S, S);
  g.moveTo(mid + inner, mid);
  g.arc(mid, mid, inner, 0, TAU);
  g.fill("evenodd");

  // silver band around the hub, same sheen as the outer border
  g.fillStyle = paint;
  g.beginPath();
  g.arc(mid, mid, R * (CD_HUB / CD_R), 0, TAU);
  g.moveTo(mid + R * (CD_CLEAR / CD_R), mid);
  g.arc(mid, mid, R * (CD_CLEAR / CD_R), 0, TAU, true);
  g.fill("evenodd");

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16;
  return tex; // flipY stays at its default (true), which is what this model's UVs need
}

export function VinylDisc({ item }: { item: LoreItem }) {
  return item.kind === "Single" ? <VinylRecord item={item} /> : <SleeveDisc item={item} />;
}

function SleeveDisc({ item }: { item: LoreItem }) {
  const { scene } = useGLTF(MODEL, false);
  const cover = useTexture(item.image);

  const obj = useMemo(() => {
    const root = scene.clone(true);
    const img = cover.image as HTMLImageElement;
    const front = coverTexture(img);
    const back = backTexture(item, dominantColor(img), img);

    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.raycast = () => {};

      const original = mesh.material as THREE.MeshStandardMaterial;

      // drop the shrink-wrap overlay entirely
      if (original.name === "ShrinkWrap") {
        mesh.visible = false;
        return;
      }

      const isFront = original.name === "Material";
      const isBack = original.name === "BackCover";
      if (isBack) flattenBackUv(mesh); // flat 0-1 UVs so the back texture fills the whole face
      const mat = new THREE.MeshPhysicalMaterial({
        map: isFront ? front : isBack ? back : null,
        color: isFront || isBack ? "#ffffff" : original.color,
        side: original.side,
        roughness: 0.4,
        metalness: 0,
        clearcoat: 1, // the glossy lacquer layer
        clearcoatRoughness: 0.04,
        envMapIntensity: 1,
      });
      mat.userData.fade = true; // the scene fades sleeves in and out at the ends of the row
      mesh.material = mat;
    });

    // centre it and scale to span 2 world units
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    root.position.sub(center);

    const wrapper = new THREE.Group();
    wrapper.add(root);
    wrapper.scale.setScalar(2 / Math.max(size.x, size.y));
    return wrapper;
  }, [scene, cover, item]);

  return <primitive object={obj} />;
}

type PickResult = { i: number; nx: number; ny: number } | null;

type SceneProps = {
  items: LoreItem[];
  pos: MutableRefObject<{ value: number }>;
  invalidateRef: MutableRefObject<(() => void) | null>;
  flip: MutableRefObject<{ idx: number; value: number }>;
  turn: MutableRefObject<{ idx: number; rx: number; ry: number }>;
  hover: MutableRefObject<{ idx: number; nx: number; ny: number }>;
  pickRef: MutableRefObject<((cx: number, cy: number) => PickResult) | null>;
  intro: MutableRefObject<{ value: number }>;
  onReady: () => void;
};

function Ready({ onReady }: { onReady: () => void }) {
  useEffect(() => {
    onReady();
  }, [onReady]);
  return null;
}

function Scene({ items, pos, invalidateRef, flip, turn, hover, pickRef, intro, onReady }: SceneProps) {
  const groups = useRef<(THREE.Group | null)[]>([]);
  const hits = useRef<(THREE.Mesh | null)[]>([]);
  const lean = useRef<{ x: number; y: number }[]>([]); // smoothed hover lean per sleeve
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const ndc = useMemo(() => new THREE.Vector2(), []);
  const { camera, size, invalidate, gl } = useThree();

  useLayoutEffect(() => {
    invalidateRef.current = invalidate;
    return () => {
      invalidateRef.current = null;
    };
  }, [invalidate, invalidateRef]);

  // camera distance chosen so 1 world unit = 1 css px at the stage plane
  useLayoutEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.position.set(0, 0, size.height / 2 / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)));
    cam.updateProjectionMatrix();
    invalidate();
  }, [camera, size.width, size.height, invalidate]);

  // which sleeve is under the pointer (and where on it), used for hover, grab and click
  useLayoutEffect(() => {
    pickRef.current = (cx, cy) => {
      const rect = gl.domElement.getBoundingClientRect();
      ndc.set(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
      if (Math.abs(ndc.x) > 1 || Math.abs(ndc.y) > 1) return null;
      raycaster.setFromCamera(ndc, camera);
      const objs: THREE.Object3D[] = [];
      hits.current.forEach((m, i) => {
        if (m && groups.current[i]?.visible) objs.push(m);
      });
      const r = raycaster.intersectObjects(objs, false)[0];
      if (!r || !r.uv) return null;
      const i = hits.current.indexOf(r.object as THREE.Mesh);
      if (i < 0) return null;
      return { i, nx: (r.uv.x - 0.5) * 2, ny: -(r.uv.y - 0.5) * 2 };
    };
    return () => {
      pickRef.current = null;
    };
  }, [camera, gl, raycaster, ndc, pickRef]);

  useFrame((state, dt) => {
    const W = state.size.width;
    const H = state.size.height;
    const n = items.length;
    const m = motionOn() ? 1 : 0;
    const ease = 1 - Math.exp(-Math.min(dt, 0.05) * 10);
    const side0 = Math.min(BASE * W, 0.66 * H);
    let busy = false;

    for (let i = 0; i < n; i++) {
      const g = groups.current[i];
      if (!g) continue;
      const o = mod(i - pos.current.value + n / 2, n) - n / 2; // 0 = centre sleeve, +1 = next one to the right (wraps)
      // entry animation: left sleeves go first, each eased with EASE
      const delay = (Math.min(Math.max(o + 2, 0), 3) / 3) * INTRO_STAGGER;
      const p = EASE_IN(Math.min(Math.max((intro.current.value - delay) / (1 - INTRO_STAGGER), 0), 1));
      const a = smooth(-3, -2.1, o) * (1 - smooth(1.1, 1.9, o)) * p; // at rest: two on the left, centre, one on the right
      g.visible = a > 0.01;
      if (!g.visible) continue;

      g.traverse((obj) => {
        const mat = (obj as THREE.Mesh).material as THREE.Material | undefined;
        if (mat?.userData?.fade) {
          const base = mat.userData.baseOpacity ?? 1;
          mat.opacity = a * base;
          mat.transparent = a * base < 0.999;
        }
      });

      // position along the climbing path, size growing to the right
      const f = o >= 0 ? (Math.exp(KAPPA * o) - 1) / KAPPA : o * XA_L;
      // depth: the centre sleeve is nearest, and x/y/size are scaled by k so perspective doesn't change the layout
      const lifted = turn.current.idx === i || (flip.current.idx === i && flip.current.value > 0);
      const z = -Math.min(Math.abs(o), 3) * Z_STEP + (lifted ? Z_LIFT : 0);
      const k = (state.camera.position.z - z) / state.camera.position.z;
      const s = -o; // steps to the left of centre
      const x = o >= 0 ? XA * f * W : -(side0 * (s - (GROW_L * s * s) / 2) + GAP_L * W * s);
      g.position.set((x + (1 - p) * INTRO_X * W) * k, (H / 2 - (Y0 - (o >= 0 ? YP : YN) * f) * H) * k, z);
      g.scale.setScalar((k * side0 * Math.max(0.2, 1 + (o >= 0 ? GROW : GROW_L) * o)) / 2);

      // lean toward the cursor while it's over this sleeve
      const l = (lean.current[i] ??= { x: 0, y: 0 });
      const h = hover.current;
      const grabbed = turn.current.idx === i;
      const tx = h.idx === i && !grabbed ? h.nx : 0;
      const ty = h.idx === i && !grabbed ? h.ny : 0;
      l.x += (tx - l.x) * ease;
      l.y += (ty - l.y) * ease;
      if (Math.abs(tx - l.x) > 0.002 || Math.abs(ty - l.y) > 0.002) busy = true;

      // resting pose, plus the hover lean
      _qBase.setFromEuler(
        _e.set((TILT_X + Math.max(o, 0) * STEP_PITCH) * m + l.y * HOVER * m, (TILT_Y + o * STEP_YAW) * m + l.x * HOVER * m, ROLL * m, "YXZ")
      );

      // your own turning (grab) and the click-flip, applied in screen space on top
      const ry = (grabbed ? turn.current.ry : 0) + (flip.current.idx === i ? Math.PI * flip.current.value : 0);
      const rx = grabbed ? turn.current.rx : 0;
      _qGrab.setFromEuler(_e.set(rx, ry, 0, "XYZ"));

      g.quaternion.copy(_qGrab).multiply(_qBase);
    }

    if (busy) state.invalidate();
  });

  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[300, 400, 1000]} intensity={0.35} />
      <Environment resolution={512}>
        <Lightformer form="rect" intensity={0.4} position={[0, 0, 8]} scale={[12, 12, 1]} />
        <Lightformer form="rect" intensity={4} position={[-6, 3, 6]} rotation-y={Math.PI / 4} scale={[3, 9, 1]} />
        <Lightformer form="rect" intensity={4} position={[6, -3, 6]} rotation-y={-Math.PI / 4} scale={[3, 9, 1]} />
        <Lightformer form="rect" intensity={2.5} position={[0, 8, 3]} rotation-x={Math.PI / 3} scale={[10, 2, 1]} />
      </Environment>

      <Suspense fallback={null}>
        {items.map((item, i) => (
          <group
            key={item.id}
            ref={(g) => {
              groups.current[i] = g;
            }}
          >
            <VinylDisc item={item} />
            {/* invisible plate the pointer is tested against */}
            <mesh
              ref={(mesh) => {
                hits.current[i] = mesh;
              }}
            >
              <planeGeometry args={[2, 2]} />
              <meshBasicMaterial visible={false} side={THREE.DoubleSide} />
            </mesh>
          </group>
        ))}
        <Ready onReady={onReady} />
      </Suspense>
    </>
  );
}

/* ---------- wheel + interaction ---------- */

type DiscWheelProps = {
  items: LoreItem[];
  activeIndex: number;
  onChange: (index: number) => void;
};

export default function DiscWheel({ items, activeIndex, onChange }: DiscWheelProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const pos = useRef({ value: activeIndex });
  const tween = useRef<gsap.core.Tween | null>(null);
  const target = useRef(activeIndex);
  const prevItems = useRef<LoreItem[] | null>(null);
  const countRef = useRef(items.length);
  const activeRef = useRef(activeIndex);
  const onChangeRef = useRef(onChange);
  const invalidateRef = useRef<(() => void) | null>(null);
  const pickRef = useRef<((cx: number, cy: number) => PickResult) | null>(null);
  const flip = useRef({ idx: -1, value: 0 });
  const flipTween = useRef<gsap.core.Tween | null>(null);
  const turn = useRef({ idx: -1, rx: 0, ry: 0 });
  const turnTween = useRef<gsap.core.Tween | null>(null);
  const hover = useRef({ idx: -1, nx: 0, ny: 0 });

  useLayoutEffect(() => {
    countRef.current = items.length;
    activeRef.current = activeIndex;
    onChangeRef.current = onChange;
  });

  const render = () => invalidateRef.current?.();

  const intro = useRef({ value: 0 });
  const introPlayed = useRef(false);
  const startIntro = () => {
    if (introPlayed.current) return; // first load only
    introPlayed.current = true;
    if (!motionOn()) {
      intro.current.value = 1;
      render();
      return;
    }
    gsap.to(intro.current, { value: 1, duration: INTRO_S, ease: "none", onUpdate: render });
  };

  const unflip = () => {
    if (flip.current.value <= 0) return;
    flipTween.current?.kill();
    flipTween.current = gsap.to(flip.current, {
      value: 0,
      duration: motionOn() ? 0.6 : 0,
      ease: "power2.inOut",
      onUpdate: render,
    });
  };

  const flipDisc = (i: number) => {
    flipTween.current?.kill();
    if (flip.current.idx !== i) {
      flip.current.idx = i;
      flip.current.value = 0;
    }
    flipTween.current = gsap.to(flip.current, {
      value: flip.current.value > 0.5 ? 0 : 1,
      duration: motionOn() ? 1 : 0,
      ease: "power3.inOut",
      onUpdate: render,
    });
  };

  const goTo = (index: number, notify = true) => {
    const n = countRef.current;
    if (!n) return;
    const idx = mod(index, n);
    // pick the equivalent slot nearest to where we are, so the loop takes the short way round
    const cur = pos.current.value;
    const dest = Math.round(cur + mod(idx - cur + n / 2, n) - n / 2);
    target.current = dest;
    tween.current?.kill();
    if (flip.current.idx !== idx) unflip();
    tween.current = gsap.to(pos.current, {
      value: dest,
      duration: motionOn() ? 1 : 0,
      ease: EASE,
      onUpdate: render,
    });
    if (notify) onChangeRef.current(idx);
  };

  // follow the activeIndex prop (Back / Forward buttons) and reset when the list changes
  useLayoutEffect(() => {
    if (prevItems.current !== items) {
      prevItems.current = items;
      tween.current?.kill();
      pos.current.value = activeIndex;
      target.current = activeIndex;
      render();
      return;
    }
    if (countRef.current && mod(target.current, countRef.current) !== activeIndex) goTo(activeIndex, false);
  }, [activeIndex, items]);

  // wheel, drag, grab and keyboard
  useEffect(() => {
    const root = rootRef.current;
    const stage = root?.parentElement;
    if (!root || !stage) return;

    const scale = () => (root.clientWidth || 1920) / 1920;

    let timer = 0;
    let dragging = false;
    let grabbed = -1; // sleeve under the pointer when it went down (-1 = empty space)
    let turning = false; // true once a grab has become a real drag
    let startX = 0;
    let startY = 0;
    let startPos = 0;
    let anchorX = 0;
    let anchorY = 0;
    let baseRy = 0;
    let travelled = 0;
    let lastT = 0;
    let vel = 0;

    const onWheel = (e: WheelEvent) => {
      if (!countRef.current) return;
      if ((e.target as Element).closest?.(".drawer, .drawer-overlay")) return; // drawer scrolls itself, overlay blocks the wheel
      e.preventDefault();
      tween.current?.kill();
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      pos.current.value += d / WHEEL_SENS;
      render();
      window.clearTimeout(timer);
      timer = window.setTimeout(() => goTo(Math.round(pos.current.value)), SETTLE_MS);
    };

    const updateHover = (e: PointerEvent) => {
      const hit = pickRef.current?.(e.clientX, e.clientY) ?? null;
      hover.current = hit ? { idx: hit.i, nx: hit.nx, ny: hit.ny } : { idx: -1, nx: 0, ny: 0 };
      render();
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || !countRef.current) return;
      dragging = true;
      turning = false;
      travelled = 0;
      startX = e.clientX;
      startY = e.clientY;
      startPos = pos.current.value;
      lastT = performance.now();
      vel = 0;
      grabbed = pickRef.current?.(e.clientX, e.clientY)?.i ?? -1;
      if (grabbed < 0) {
        // empty space: this drag scrolls the row
        tween.current?.kill();
        root.classList.add("is-dragging");
      }
    };

    const onMove = (e: PointerEvent) => {
      if (!dragging) {
        if (!document.querySelector(".drawer.is-open")) updateHover(e);
        return;
      }
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      travelled = Math.max(travelled, Math.hypot(dx, dy));

      if (grabbed >= 0) {
        if (travelled < 6) return; // still just a click
        if (!turning) {
          // the grab becomes a real drag: take the sleeve over, keeping it where it is
          turning = true;
          turnTween.current?.kill();
          flipTween.current?.kill();
          baseRy = flip.current.idx === grabbed ? Math.PI * flip.current.value : 0;
          flip.current.value = 0;
          turn.current.idx = grabbed;
          turn.current.rx = 0;
          turn.current.ry = baseRy;
          hover.current = { idx: -1, nx: 0, ny: 0 };
          anchorX = e.clientX;
          anchorY = e.clientY;
          root.classList.add("is-dragging");
        }
        turn.current.ry = baseRy + (e.clientX - anchorX) * ROT_SENS;
        turn.current.rx = (e.clientY - anchorY) * ROT_SENS;
        render();
        return;
      }

      // empty-space drag: scroll the row
      const now = performance.now();
      const next = startPos - dx / (STEP_PX * scale());
      const dt = now - lastT;
      if (dt > 0) vel = vel * 0.7 + ((next - pos.current.value) / dt) * 0.3;
      pos.current.value = next;
      lastT = now;
      render();
    };

    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      root.classList.remove("is-dragging");

      if (grabbed >= 0) {
        const i = grabbed;
        grabbed = -1;
        if (turning) {
          // let go: spring back to the resting pose, the short way round
          turning = false;
          const t = turn.current;
          t.rx -= Math.round(t.rx / TAU) * TAU;
          t.ry -= Math.round(t.ry / TAU) * TAU;
          turnTween.current?.kill();
          turnTween.current = gsap.to(t, {
            rx: 0,
            ry: 0,
            duration: motionOn() ? 1.2 : 0,
            ease: "elastic.out(1, 0.55)",
            onUpdate: render,
            onComplete: () => {
              t.idx = -1;
              render();
            },
          });
        } else if (i === activeRef.current) {
          flipDisc(i); // click on the centre sleeve: flip it
        } else {
          goTo(i); // click on another sleeve: bring it to the centre
        }
        return;
      }

      if (performance.now() - lastT > 80) vel = 0;
      goTo(Math.round(pos.current.value + vel * 1000 * FLICK));
    };

    const onKey = (e: KeyboardEvent) => {
      const n = countRef.current;
      if (!n || document.querySelector(".drawer.is-open")) return;
      if (e.key === "ArrowRight") goTo(mod(activeRef.current + 1, n));
      if (e.key === "ArrowLeft") goTo(mod(activeRef.current - 1, n));
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    stage.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("keydown", onKey);

    return () => {
      window.clearTimeout(timer);
      tween.current?.kill();
      turnTween.current?.kill();
      flipTween.current?.kill();
      window.removeEventListener("wheel", onWheel);
      stage.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div className="wheel" ref={rootRef}>
      <Canvas
        frameloop="demand"
        flat
        dpr={[1, 2]}
        gl={{ alpha: true, antialias: true }}
        camera={{ fov: 30, near: 10, far: 20000 }}
      >
        <Scene
          items={items}
          pos={pos}
          invalidateRef={invalidateRef}
          flip={flip}
          turn={turn}
          hover={hover}
          pickRef={pickRef}
          intro={intro}
          onReady={startIntro}
        />
      </Canvas>
      <div className="wheel__glass wheel__glass--top" />
      <div className="wheel__glass wheel__glass--left" />
      <div className="wheel__glass wheel__glass--right" />
    </div>
  );
}