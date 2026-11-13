import type { MutableRefObject } from "react";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { Environment, Lightformer, useGLTF } from "@react-three/drei";
import { Box3, BufferAttribute, BufferGeometry, CanvasTexture, CatmullRomCurve3, DoubleSide, MeshPhysicalMaterial, RepeatWrapping, SRGBColorSpace, Vector3 } from "three";
import type { Group, Mesh, MeshStandardMaterial } from "three";

const MODEL = "/models/lanyard.glb";
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
const CUT = 57.7; // height (in the card model's own units) where the black tab ends. Everything above is cut off

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

// ---- the card's front design ----
const FACE = { x: 0.02, y: 0.02, w: 0.468, h: 0.7389 }; // where the front face sits in the model's textures (0-1)
const PORTRAIT = "/information/card-portrait.jpg"; // public/information/card-portrait.jpg
const PAPER = ["#f8f5ef", "#ede8de"]; // card colour, top to bottom
const LIGHT = 0.85;
const FINISH = 0.3;
const GLOSS = 1; // clear laminate layer on top of the print (0 = none, 1 = full)
const ENGRAVE_DEPTH = 5; // how deep the DEE-SPACE07 engraving looks
const PHOTO_BG = ["#dcd8d2", "#b7b1a8"]; // colour behind your photo, top to bottom
const PHOTO_TILT = 4; // degrees
const BLUE = "#1046F9"; // accent
const TEXT = BLUE; // printed text
const INK = "#2E1D11"; // handwriting
const SHEEN = 1; // how much the card reflects the room (0 = none, 1 = full)
const SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const MONO = 'ui-monospace, Menlo, Consolas, monospace';
const SCRIPT = '"Caveat", "Segoe Script", "Bradley Hand", cursive';
const FIELDS: [string, string][] = [
  ["NAME:", "Dee"],
  ["SPECIALTY:", "Product & UI/UX Design"],
  ["BELIEVES IN:", "Small, odd details"],
];
const MR_PLAIN = `rgb(254,${Math.round(FINISH * 255)},0)`; // plain surface in the roughness map (green = roughness, blue = metal)

function grain() {
  const n = document.createElement("canvas");
  n.width = n.height = 128;
  const g = n.getContext("2d")!;
  const d = g.createImageData(128, 128);
  for (let i = 0; i < d.data.length; i += 4) {
    d.data[i] = d.data[i + 1] = d.data[i + 2] = Math.random() * 255;
    d.data[i + 3] = 255;
  }
  g.putImageData(d, 0, 0);
  return n;
}

// your photo is a JPG on white: lift off the white that touches the edges, so the colour behind shows through
function cutout(img: HTMLImageElement) {
  const k = Math.min(1, 640 / img.naturalWidth);
  const w = Math.round(img.naturalWidth * k);
  const h = Math.round(img.naturalHeight * k);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  g.drawImage(img, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h);
  const px = d.data;
  const gone = new Uint8Array(w * h);
  const stack: number[] = [];
  const seed = (i: number) => {
    if (gone[i] || Math.min(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]) < 225) return;
    gone[i] = 1;
    stack.push(i);
  };
  for (let x = 0; x < w; x++) seed(x); // top edge only, the shirt reaches the bottom
  for (let y = 0; y < h * 0.55; y++) {
    seed(y * w);
    seed(y * w + w - 1);
  }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % w;
    if (x > 0) seed(i - 1);
    if (x < w - 1) seed(i + 1);
    if (i >= w) seed(i - w);
    if (i < w * (h - 1)) seed(i + w);
  }
  for (let i = 0; i < w * h; i++) {
    const x = i % w;
    const rim = (x > 0 && gone[i - 1]) || (x < w - 1 && gone[i + 1]) || (i >= w && gone[i - w]) || (i < w * (h - 1) && gone[i + w]);
    px[i * 4 + 3] = gone[i] ? 0 : rim ? 140 : 255; // softens the edge a little
  }
  g.putImageData(d, 0, 0);
  return c;
}

function loadPhoto() {
  return new Promise<HTMLCanvasElement | null>((done) => {
    const i = new Image();
    i.onload = () => done(cutout(i));
    i.onerror = () => {
      console.warn("card photo not found:", PORTRAIT);
      done(null);
    };
    i.src = PORTRAIT;
  });
}

// the DEE-SPACE07 inscription (drawn in a 958px wide card), used for both the print and the metal sheen
function stamp(g: CanvasRenderingContext2D, ink: string) {
  g.fillStyle = ink;
  g.font = `700 90px ${MONO}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("dee-space07", 477.5, 1394);
  g.textBaseline = "alphabetic";
  g.textAlign = "left";
}

// shared pieces, used on both faces of the card
function paperBg(g: CanvasRenderingContext2D) {
  const paper = g.createLinearGradient(0, 0, 0, 1513);
  paper.addColorStop(0, PAPER[0]);
  paper.addColorStop(1, PAPER[1]);
  g.fillStyle = paper;
  g.fillRect(0, 0, 959, 1514);
}

function header(g: CanvasRenderingContext2D) {
  g.fillStyle = TEXT;
  g.textAlign = "left";
  g.font = `800 100px ${SANS}`;
  g.fillText("MEMBER", 70, 240);
  g.fillText("CARD", 70, 335);
  g.font = `500 30px ${MONO}`;
  g.fillText("DEE-SPACE 07", 72, 390);
  g.textAlign = "right";
  g.fillText("VALID", 888, 118);
  g.fillText("2026", 888, 158);
  g.textAlign = "left";
}

function holder(g: CanvasRenderingContext2D, y: number) {
  g.fillStyle = TEXT;
  g.textAlign = "left";
  g.font = `500 30px ${MONO}`;
  ["THE HOLDER OF THIS CARD IS AN OFFICIAL", "MEMBER OF DEE-SPACE 07"].forEach((t, i) => g.fillText(t, 72, y + i * 42));
}

// the front of the card, drawn upright
function drawFront(w: number, h: number, photo: HTMLCanvasElement | null) {
  const c = document.createElement("canvas");
  c.width = Math.round(w);
  c.height = Math.round(h);
  const g = c.getContext("2d")!;
  g.scale(w / 958, w / 958); // everything below is laid out for a 958px wide card

  paperBg(g);
  header(g);
  g.fillStyle = TEXT;
  g.font = `500 30px ${MONO}`;
  g.fillText("ID No. 001", 72, 690);

  // photo: just the picture, tilted, no border or shadow
  const fx = 560, fy = 270, fw = 328, fh = 460;
  g.save();
  g.translate(fx + fw / 2, fy + fh / 2);
  g.rotate((PHOTO_TILT * Math.PI) / 180);
  const pw = fw;
  const ph = fh;
  g.beginPath();
  g.rect(-pw / 2, -ph / 2, pw, ph);
  g.clip();
  const bg = g.createLinearGradient(0, -ph / 2, 0, ph / 2);
  bg.addColorStop(0, PHOTO_BG[0]);
  bg.addColorStop(1, PHOTO_BG[1]);
  g.fillStyle = bg;
  g.fillRect(-pw / 2, -ph / 2, pw, ph);
  if (photo) {
    const dw = pw * 1.12; // a little zoom so the face fills the print
    const dh = photo.height * (dw / photo.width); // sits on the bottom edge
    g.drawImage(photo, -dw / 2, ph / 2 - dh, dw, dh);
  }
  g.globalAlpha = 0.1; // film grain
  g.fillStyle = g.createPattern(grain(), "repeat")!;
  g.fillRect(-pw / 2, -ph / 2, pw, ph);
  g.globalAlpha = 1; // soft vignette
  const vg = g.createRadialGradient(0, 0, ph * 0.25, 0, 0, ph * 0.75);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.2)");
  g.fillStyle = vg;
  g.fillRect(-pw / 2, -ph / 2, pw, ph);
  g.restore();

  // fields: label, then the handwriting on a line
  FIELDS.forEach(([label, value], i) => {
    const y = 850 + i * 150;
    g.fillStyle = TEXT;
    g.font = `500 32px ${MONO}`;
    g.fillText(label, 70, y);
    const x0 = 70 + g.measureText(label).width + 16;
    g.strokeStyle = TEXT;
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(x0, y + 12);
    g.lineTo(888, y + 12);
    g.stroke();
    g.fillStyle = INK;
    let f = 80;
    g.font = `400 ${f}px ${SCRIPT}`;
    while (g.measureText(value).width > 888 - x0 - 16 && f > 36) {
      f -= 2;
      g.font = `400 ${f}px ${SCRIPT}`;
    }
    g.fillText(value, x0 + 8, y + 4);
  });

  holder(g, 1235);
  return c;
}

const BACK = { ...FACE, x: 0.512 }; // the back face, in the same textures

// copy one of the model's textures into a canvas, with the front face's position in it
function faceCanvas(base: HTMLImageElement) {
  const c = document.createElement("canvas");
  c.width = base.width;
  c.height = base.height;
  const g = c.getContext("2d")!;
  g.drawImage(base, 0, 0);
  return { c, g, fx: FACE.x * c.width, fy: FACE.y * c.height, fw: FACE.w * c.width, fh: FACE.h * c.height };
}

// flat-fill both faces, which clears the old lettering (UMBRELLA, L1 CLEARANCE...) from a map
function wipe(m: ReturnType<typeof faceCanvas>, color: string) {
  m.g.fillStyle = color;
  for (const f of [FACE, BACK]) m.g.fillRect(f.x * m.c.width, f.y * m.c.height, f.w * m.c.width, f.h * m.c.height);
}

// a soft blur, so the edges of the engraving are bevelled instead of sharp
function soft(a: Float32Array, w: number, h: number, r: number) {
  const t = new Float32Array(a.length);
  const o = new Float32Array(a.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let k = -r; k <= r; k++) s += a[y * w + Math.min(w - 1, Math.max(0, x + k))];
      t[y * w + x] = s / (2 * r + 1);
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let k = -r; k <= r; k++) s += t[Math.min(h - 1, Math.max(0, y + k)) * w + x];
      o[y * w + x] = s / (2 * r + 1);
    }
  }
  return o;
}

// engrave DEE-SPACE07 into the bump map: draw it as a height map, then turn that into normals
function engrave(n: ReturnType<typeof faceCanvas>, x = FACE.x) {
  const s = n.fw / 958;
  const X0 = 90, Y0 = 1316, X1 = 870, Y1 = 1470; // the area around the stamp, in card units
  const w = Math.round((X1 - X0) * s);
  const h = Math.round((Y1 - Y0) * s);
  const hc = document.createElement("canvas");
  hc.width = w;
  hc.height = h;
  const g = hc.getContext("2d")!;
  g.fillStyle = "#000";
  g.fillRect(0, 0, w, h);
  g.translate(0, h);
  g.scale(s, -s); // the texture is stored upside down, like the colour one
  g.translate(-X0, -Y0);
  stamp(g, "#fff");
  const px = g.getImageData(0, 0, w, h).data;
  let H = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) H[i] = px[i * 4] / 255;
  const r = Math.max(2, Math.round(2.5 * s));
  H = soft(soft(H, w, h, r), w, h, r);
  const at = (x: number, y: number) => H[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))];
  const out = n.g.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = ((at(x + 1, y) - at(x - 1, y)) / 2) * ENGRAVE_DEPTH;
      const ny = (-(at(x, y + 1) - at(x, y - 1)) / 2) * ENGRAVE_DEPTH; // green points up the picture
      const l = Math.hypot(nx, ny, 1);
      const i = (y * w + x) * 4;
      out.data[i] = 128 + (nx / l) * 127;
      out.data[i + 1] = 128 + (ny / l) * 127;
      out.data[i + 2] = 128 + (1 / l) * 127;
      out.data[i + 3] = 255;
    }
  }
  n.g.putImageData(out, Math.round(x * n.c.width + X0 * s), Math.round(n.fy + n.fh - Y1 * s));
}

// the back keeps the model's own design. only the "studio" line and the round logo are replaced
const LOGO_BG = "#2E1D11"; // website logo block colour (match .header__logo-mark in Header.css)
const LOGO_FG = "#e9e4da"; // its letters
const LOGO_RAISE = 1; // if the logo looks sunken instead of raised, set this to -1
const LOGO = { x: 179, y: 410, w: 600, h: 360 }; // square block, in card units (958 wide)

function drawLogo(g: CanvasRenderingContext2D, bg: string, fg: string) {
  g.fillStyle = bg;
  g.fillRect(LOGO.x, LOGO.y, LOGO.w, LOGO.h);
  g.fillStyle = fg;
  g.font = `800 230px ${SANS}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("D-S", LOGO.x + LOGO.w / 2, LOGO.y + LOGO.h / 2 + 8);
  g.textAlign = "left";
  g.textBaseline = "alphabetic";
}

// raise the logo out of the back's bump map: the block a little, the letters a bit more
function embossLogo(n: ReturnType<typeof faceCanvas>) {
  const s = n.fw / 958;
  const x0 = BACK.x * n.c.width;
  const X0 = LOGO.x - 30, Y0 = LOGO.y - 30, X1 = LOGO.x + LOGO.w + 30, Y1 = LOGO.y + LOGO.h + 30;
  const w = Math.round((X1 - X0) * s);
  const h = Math.round((Y1 - Y0) * s);
  const hc = document.createElement("canvas");
  hc.width = w;
  hc.height = h;
  const g = hc.getContext("2d")!;
  g.fillStyle = "#000";
  g.fillRect(0, 0, w, h);
  g.translate(0, h);
  g.scale(s, -s); // the texture is stored upside down, like the colour one
  g.translate(-X0, -Y0);
  drawLogo(g, "#808080", "#ffffff");
  const px = g.getImageData(0, 0, w, h).data;
  let H = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) H[i] = px[i * 4] / 255;
  const r = Math.max(2, Math.round(3 * s));
  H = soft(soft(H, w, h, r), w, h, r);
  const at = (x: number, y: number) => H[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))];
  const out = n.g.createImageData(w, h);
  const k = ENGRAVE_DEPTH * 1.2 * LOGO_RAISE;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = (-(at(x + 1, y) - at(x - 1, y)) / 2) * k;
      const ny = ((at(x, y + 1) - at(x, y - 1)) / 2) * k;
      const l = Math.hypot(nx, ny, 1);
      const i = (y * w + x) * 4;
      out.data[i] = 128 + (nx / l) * 127;
      out.data[i + 1] = 128 + (ny / l) * 127;
      out.data[i + 2] = 128 + (1 / l) * 127;
      out.data[i + 3] = 255;
    }
  }
  n.g.putImageData(out, Math.round(x0 + X0 * s), Math.round(n.fy + n.fh - Y1 * s));
}

function patchBack(m: ReturnType<typeof faceCanvas>) {
  const s = m.fw / 958;
  const x0 = BACK.x * m.c.width;
  const bottom = m.fy + m.fh;
  // wipe a box (in card units) by stretching the paper just left of it across it, so any gradient stays
  const clear = (x: number, y: number, w: number, h: number) =>
    m.g.drawImage(m.c, x0 + (x - 12) * s, bottom - (y + h) * s, 1, h * s, x0 + x * s, bottom - (y + h) * s, w * s, h * s);
  clear(55, 150, 440, 150); // the old "THIS CARD IS PROPERTY OF DEE-SPACE STUDIO." lines
  clear(240, 380, 480, 420); // the round d logo

  const o = document.createElement("canvas");
  o.width = Math.round(m.fw);
  o.height = Math.round(m.fh);
  const g = o.getContext("2d")!;
  g.scale(m.fw / 958, m.fw / 958);

  g.fillStyle = TEXT;
  g.font = `700 34px ${MONO}`;
  g.fillText("THIS CARD IS PROPERTY OF", 73, 205);
  g.fillText("DEE-SPACE07.", 73, 248);
  drawLogo(g, LOGO_BG, LOGO_FG);

  m.g.save();
  m.g.translate(x0, bottom);
  m.g.scale(1, -1); // the model stores its card upside down
  m.g.drawImage(o, 0, 0, m.fw, m.fh);
  m.g.restore();
}

// the model's colour, roughness/metal and bump textures, with the new card painted in
async function buildMaps(base: HTMLImageElement, mrBase?: HTMLImageElement, nmBase?: HTMLImageElement) {
  const photo = await loadPhoto();
  await document.fonts.load('400 80px "Caveat"').catch(() => []);

  const col = faceCanvas(base);
  col.g.save();
  col.g.translate(col.fx, col.fy + col.fh);
  col.g.scale(1, -1); // the model stores its card upside down
  col.g.drawImage(drawFront(col.fw, col.fh, photo), 0, 0, col.fw, col.fh);
  col.g.restore();
  patchBack(col);

  let mr: HTMLCanvasElement | undefined;
  if (mrBase) {
    const m = faceCanvas(mrBase);
    wipe(m, MR_PLAIN); // an even satin finish on both faces
    mr = m.c;
  }
  let nm: HTMLCanvasElement | undefined;
  if (nmBase) {
    const n = faceCanvas(nmBase);
    wipe(n, "#8080ff"); // flat, so no old lettering shows as bumps
    engrave(n);
    embossLogo(n);
    engrave(n, BACK.x);
    nm = n.c;
  }
  return { map: col.c, mr, nm };
}

function Hanging({ fade, compact }: { fade: MutableRefObject<number>; compact: boolean }) {
  const { scene: raw } = useGLTF(MODEL);
  const size = useThree((s) => s.size);
  const gl = useThree((s) => s.gl);
  const holder = useRef<Group>(null);
  const H = size.height;
  const W = size.width;
  const phone = W < 600;
  const cardH = compact ? H * (phone ? 0.72 : 0.76) : H * 0.78; // height of the card (a touch smaller to make room for the drop)
  const reach = H * (compact ? 0.15 : 0.13); // strap length from the top edge down to the clip
  const drop = H * (compact ? 0.03 : 0.04); // pushes the whole lanyard down
  const u = cardH / 500; // scales the strap and clip with the card (they were drawn for a ~500px card)
  const reduce = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);

  // the new model's card only. its own strap and clasp are dropped, ours replaces them
  const scene = useMemo(() => {
    const s = raw.clone(true);
    s.getObjectByName("Lanyard_Strap")?.removeFromParent();
    s.getObjectByName("Lanyard_Clasp")?.removeFromParent();

    // the card's built-in metal clip is part of the same mesh, so drop every triangle above the black tab
    s.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh || !mesh.geometry.index) return;
      const g = mesh.geometry.clone();
      const p = g.attributes.position;
      const old = g.index!.array;
      const keep: number[] = [];
      for (let i = 0; i < old.length; i += 3) {
        if (p.getZ(old[i]) <= CUT && p.getZ(old[i + 1]) <= CUT && p.getZ(old[i + 2]) <= CUT) {
          keep.push(old[i], old[i + 1], old[i + 2]);
        }
      }
      g.setIndex(keep);
      const box = new Box3();
      const v = new Vector3();
      for (const i of keep) box.expandByPoint(v.fromBufferAttribute(p, i));
      g.boundingBox = box; // so the card re-fits to what is left and hangs from the top of the black tab
      mesh.geometry = g;
      mesh.material = (mesh.material as MeshStandardMaterial).clone();
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

  // paint the new front design over the card's front face
  useEffect(() => {
    const mesh = scene.getObjectByProperty("isMesh", true) as Mesh | undefined;
    const mat = mesh?.material as MeshStandardMaterial | undefined;
    if (!mesh || !mat) return;
    const kept = mat.userData; // the model's own textures, kept so this can run again
    kept.map ??= mat.map?.image;
    kept.mr ??= mat.roughnessMap?.image;
    kept.nm ??= mat.normalMap?.image;
    if (!kept.map) return;
    let dead = false;
    mesh.visible = false; // hidden for a moment so the old design never flashes
    buildMaps(kept.map, kept.mr, kept.nm)
      .then((m) => {
        if (dead) return;
        const tex = (c: HTMLCanvasElement, srgb: boolean) => {
          const t = new CanvasTexture(c);
          t.flipY = false;
          if (srgb) t.colorSpace = SRGBColorSpace;
          t.anisotropy = gl.capabilities.getMaxAnisotropy();
          return t;
        };
        const phys = new MeshPhysicalMaterial({
          map: tex(m.map, true),
          color: "#ffffff",
          roughness: 1, // the roughness map decides
          metalness: 1, // the metal map decides (plain = 0)
          envMapIntensity: SHEEN,
          clearcoat: GLOSS,
          clearcoatRoughness: 0.06,
        });
        if (m.mr) {
          const t = tex(m.mr, false);
          phys.roughnessMap = t;
          phys.metalnessMap = t;
        }
        if (m.nm) {
          phys.normalMap = tex(m.nm, false);
          phys.clearcoatNormalMap = phys.normalMap; // so the engraving and emboss show in the gloss
        }
        phys.side = mat.side;
        mesh.material = phys;
      })
      .catch(() => {})
      .finally(() => {
        if (!dead) mesh.visible = true;
      });
    return () => {
      dead = true;
    };
  }, [scene, gl]);

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

  const sim = useRef({ nodes: [] as Node[], acc: 0, ry: 0, spin: 0, sv: 0, k: K_REST, ang: 0, drag: false, ox: 0, oy: 0, tx: 0, ty: 0, ax: 0, ay: 0, seg: 1, lx: 0 });

  // (re)build the strap whenever the canvas size changes
  useEffect(() => {
    const s = sim.current;
    s.ax = compact ? W / 2 : W * 0.33; // right side on desktop, centred on tablet and mobile
    s.ay = H / 2 + 24 - drop; // the strap starts just above the top edge, pushed down by `drop`
    s.seg = (reach + 24) / (NODES - 1);
    const tilt = reduce ? 0 : 0.35; // start slightly swung so it settles in on load
    s.nodes = Array.from({ length: NODES }, (_, i) => {
      const x = s.ax + Math.sin(tilt) * s.seg * i;
      const y = s.ay - Math.cos(tilt) * s.seg * i;
      return { x, y, px: x, py: y, m: i === NODES - 1 ? 6 : 1 }; // the card end is heavy
    });
  }, [H, W, reach, drop, reduce, compact]);

  // dragging: follow the cursor anywhere on the page
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const s = sim.current;
      if (!s.drag) return;
      const r = gl.domElement.getBoundingClientRect();
      s.tx = e.clientX - r.left - r.width / 2;
      s.ty = r.height / 2 - (e.clientY - r.top);
      s.sv = (e.clientX - s.lx) * 0.012; // sideways drag turns the card (works on touch too)
      s.lx = e.clientX;
      s.spin += s.sv;
    };
    const up = () => {
      sim.current.drag = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    const noScroll = (e: TouchEvent) => {
      if (sim.current.drag) e.preventDefault(); // dragging the card must not scroll the page
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    window.addEventListener("touchmove", noScroll, { passive: false });
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      window.removeEventListener("touchmove", noScroll);
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
    s.acc += Math.min(dt, 0.05);
    while (s.acc >= STEP) {
      step(s);
      s.acc -= STEP;
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
      g.position.set(b.x, b.y, 0);
      let da = Math.atan2(b.x - a.x, -(b.y - a.y)) - s.ang;
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
    const r = gl.domElement.getBoundingClientRect();
    s.drag = true;
    s.lx = e.clientX;
    s.tx = e.clientX - r.left - r.width / 2;
    s.ty = r.height / 2 - (e.clientY - r.top);
    s.ox = end.x - s.tx; // keep hold of the spot you grabbed
    s.oy = end.y - s.ty;
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
  };

  return (
    <>
      <mesh ref={ribbon} geometry={geo} position-z={-2} frustumCulled={false}>
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
        {/* (clip removed: the strap now ends at the top of the black tab) */}
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
          ? {
              position: "relative",
              top: 0,
              right: "auto",
              width: "calc(100% + 32px)", // runs edge to edge past .information__top's 16px padding
              height: "clamp(460px, 110vw, 600px)",
              margin: "0 -16px",
              transform: "none",
              pointerEvents: "none",
              zIndex: 0,
            }
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
        dpr={[1, compact ? 1.5 : 2]}
        flat
        eventSource={document.body}
        eventPrefix="client"
        gl={{ alpha: true, antialias: true }}
        camera={{ zoom: 1, position: [0, 0, 1000], near: 1, far: 3000 }}
      >
        <ambientLight intensity={0.8 * LIGHT} />
        <directionalLight position={[-300, 500, 800]} intensity={0.9 * LIGHT} />
        <Environment resolution={256}>
          <Lightformer form="rect" intensity={0.08 * LIGHT} position={[0, 0, 8]} scale={[16, 16, 1]} />
          <Lightformer form="rect" intensity={6 * LIGHT} position={[-2, 1.5, 9]} scale={[2, 8, 1]} />
          <Lightformer form="rect" intensity={5 * LIGHT} position={[2.5, -1, 9]} scale={[1.5, 7, 1]} />
          <Lightformer form="rect" intensity={4 * LIGHT} position={[-6, 3, 6]} rotation-y={Math.PI / 4} scale={[3, 9, 1]} />
          <Lightformer form="rect" intensity={3.5 * LIGHT} position={[6, -3, 6]} rotation-y={-Math.PI / 4} scale={[3, 9, 1]} />
        </Environment>
        <Suspense fallback={null}>
          <Hanging fade={fade} compact={compact} />
        </Suspense>
      </Canvas>
    </div>
  );
}

useGLTF.preload(MODEL);