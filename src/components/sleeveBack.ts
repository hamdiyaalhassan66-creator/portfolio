import * as THREE from "three";
import type { LoreItem } from "../data/lore";

const S = 1024;

// if the back shows mirrored or upside down on the sleeve, flip these
const FLIP_X = false;
const FLIP_Y = false;
const BACK_IMAGE = 0.08; // base strength, boosted automatically for very light or very dark backs
const BACK_IMAGE_BY_ID: Record<string, number> = {
  // exact strength per album, skips the auto boost. e.g. "best-of-sade": 0.6,
};
const COLUMNS_MIN_TRACKS = 11; // albums with this many songs or more (more than 10) use the two-column layout, the rest never do
const TURNS = 0; // quarter turns clockwise (0-3). The new mapping starts from a different angle, so re-tune this
const CONTENT = 0.78; // 1 = type fills the back, smaller = smaller type and bigger margins // quarter turns clockwise (0-3). Your text reads bottom-to-top, so 1 should fix it

type G = CanvasRenderingContext2D;
type Group = { side?: string; tracks: { label: string; title: string; duration?: string }[] };

/* ---------- colour ---------- */

// the most vivid colour on the cover (vivid pixels count far more than greys)
export function dominantColor(img: HTMLImageElement): [number, number, number] {
  const N = 48;
  const c = document.createElement("canvas");
  c.width = c.height = N;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  const side = Math.min(img.width, img.height);
  g.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, N, N);
  const data = g.getImageData(0, 0, N, N).data;

  const buckets = new Map<number, { w: number; r: number; g: number; b: number }>();
  for (let p = 0; p < data.length; p += 4) {
    const r = data[p];
    const gr = data[p + 1];
    const b = data[p + 2];
    const max = Math.max(r, gr, b);
    const min = Math.min(r, gr, b);
    const val = max / 255;
    if (val < 0.1) continue;
    const sat = (max - min) / max;
    const w = 0.01 + sat * sat * val;
    const key = ((r >> 5) << 6) | ((gr >> 5) << 3) | (b >> 5);
    const e = buckets.get(key) ?? { w: 0, r: 0, g: 0, b: 0 };
    e.w += w;
    e.r += r * w;
    e.g += gr * w;
    e.b += b * w;
    buckets.set(key, e);
  }

  let best: { w: number; r: number; g: number; b: number } | null = null;
  buckets.forEach((e) => {
    if (!best || e.w > best.w) best = e;
  });
  if (!best) return [30, 30, 30];
  const b = best as { w: number; r: number; g: number; b: number };
  return [Math.round(b.r / b.w), Math.round(b.g / b.w), Math.round(b.b / b.w)];
}

// gives the back mesh flat 0-1 UVs across its two big axes, so the texture fills the whole back
export function flattenBackUv(mesh: THREE.Mesh) {
  const geo = mesh.geometry.clone() as THREE.BufferGeometry;
  const pos = geo.attributes.position;
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  const min = [bb.min.x, bb.min.y, bb.min.z];
  const max = [bb.max.x, bb.max.y, bb.max.z];
  const size = max.map((m, i) => m - min[i]);
  const thin = size.indexOf(Math.min(...size));
  const [a, b] = [0, 1, 2].filter((i) => i !== thin);

  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const p = [pos.getX(i), pos.getY(i), pos.getZ(i)];
    uv[i * 2] = (max[a] - p[a]) / size[a];
    uv[i * 2 + 1] = (max[b] - p[b]) / size[b];
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  mesh.geometry = geo;
}

/* ---------- helpers ---------- */

const hash = (s: string) => [...s].reduce((n, ch) => n + ch.charCodeAt(0), 0);

const fonts = () => {
  const css = getComputedStyle(document.documentElement);
  return {
    sans: css.getPropertyValue("--font-sans").trim() || "Inter, system-ui, sans-serif",
    mono: css.getPropertyValue("--font-sans").trim() || "Inter, system-ui, sans-serif", // backs use the sans font only
  };
};

function groups(item: LoreItem): Group[] {
  const out: Group[] = [];
  (item.tracks ?? []).forEach((t) => {
    let grp = out[out.length - 1];
    if (!grp || grp.side !== t.side) {
      grp = { side: t.side, tracks: [] };
      out.push(grp);
    }
    const n = grp.tracks.length + 1;
    grp.tracks.push({
      label: t.side ? `${t.side}${n}` : String(n).padStart(2, "0"),
      title: t.title,
      duration: t.duration,
    });
  });
  return out;
}

function clip(g: G, text: string, maxW: number) {
  if (g.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && g.measureText(t + "…").width > maxW) t = t.slice(0, -1);
  return t + "…";
}

// biggest font size that fits every track into the given height
function listSize(gr: Group[], height: number, max: number) {
  const lines = gr.reduce((n, x) => n + x.tracks.length, 0) + Math.max(0, gr.length - 1) * 1.2;
  return Math.max(10, Math.min(max, height / (Math.max(lines, 1) * 1.45)));
}

/* ---------- layouts ---------- */

type Fonts = ReturnType<typeof fonts>;

// 1. centred heading, small list below (like the Aquaregia sleeve)
function stacked(g: G, item: LoreItem, ink: string, f: Fonts) {
  g.fillStyle = ink;
  g.textAlign = "center";
  g.font = `600 46px ${f.sans}`;
  g.fillText(clip(g, item.title, 820), S / 2, 140);
  g.globalAlpha = 0.65;
  g.font = `400 30px ${f.sans}`;
  g.fillText(clip(g, item.creator, 820), S / 2, 190);

  const gr = groups(item);
  const size = listSize(gr, 520, 30);
  const lh = size * 1.45;

  if (gr.length) {
    g.globalAlpha = 0.6;
    g.textAlign = "center";
    g.font = `600 22px ${f.sans}`;
    g.fillText("TRACKLIST", S / 2, 300);
  }

  g.globalAlpha = 1;
  g.textAlign = "center";
  g.font = `400 ${size}px ${f.sans}`;
  let y = 360;
  for (const grp of gr) {
    for (const t of grp.tracks) {
      g.fillText(clip(g, t.title, 760), S / 2, y);
      y += lh;
    }
    y += lh * 1.2;
  }

  g.globalAlpha = 0.6;
  g.textAlign = "center";
  g.font = `400 22px ${f.mono}`;
  g.fillText([item.kind, item.year].filter(Boolean).join(" · ").toUpperCase(), S / 2, 960);
  g.globalAlpha = 1;
}

// 2. big left-aligned title, list, credit line at the bottom (like The Thrills sleeve)
function credits(g: G, item: LoreItem, ink: string, f: Fonts) {
  g.fillStyle = ink;
  g.textAlign = "left";
  let size = 84;
  const title = item.title.toUpperCase();
  g.font = `700 ${size}px ${f.sans}`;
  while (size > 36 && g.measureText(title).width > 860) {
    size -= 4;
    g.font = `700 ${size}px ${f.sans}`;
  }
  g.fillText(title, 80, 50 + size);
  g.globalAlpha = 0.75;
  g.font = `600 40px ${f.sans}`;
  g.fillText(clip(g, item.creator, 860), 80, 50 + size + 56);
  g.globalAlpha = 1;

  const gr = groups(item);
  const ls = listSize(gr, 520, 32);
  const lh = ls * 1.45;
  if (gr.length) {
    g.globalAlpha = 0.6;
    g.textAlign = "left";
    g.font = `600 22px ${f.sans}`;
    g.fillText("TRACKLIST", 80, 310);
    g.globalAlpha = 1;
  }
  let y = 360;
  for (const grp of gr) {
    for (const t of grp.tracks) {
      g.font = `500 ${ls}px ${f.sans}`;
      g.textAlign = "left";
      g.fillText(clip(g, t.title, 700), 80, y);
      if (t.duration) {
        g.textAlign = "right";
        g.font = `400 ${ls * 0.85}px ${f.mono}`;
        g.fillText(t.duration, S - 80, y);
      }
      y += lh;
    }
    y += lh * 0.8;
  }

  g.textAlign = "left";
  g.globalAlpha = 0.6;
  g.font = `400 22px ${f.mono}`;
  const meta = [item.kind, item.genre, item.year, item.songs ? `${item.songs} songs` : undefined];
  g.fillText(meta.filter(Boolean).join(" · ").toUpperCase(), 80, 960);
  g.globalAlpha = 1;
}

// 3. editorial: kind and year on top, big title, ruled tracklist, genre and count at the bottom
function ledger(g: G, item: LoreItem, ink: string, f: Fonts) {
  const L = 80;
  const R = S - 80;
  g.fillStyle = ink;
  g.strokeStyle = ink;
  g.lineWidth = 2;

  // top row: kind on the left, year on the right
  g.globalAlpha = 0.7;
  g.font = `500 24px ${f.sans}`;
  g.textAlign = "left";
  g.fillText((item.kind ?? "").toUpperCase(), L, 90);
  g.textAlign = "right";
  g.fillText(item.year ? String(item.year) : "", R, 90);
  g.globalAlpha = 0.35;
  g.beginPath();
  g.moveTo(L, 115);
  g.lineTo(R, 115);
  g.stroke();

  // title and artist
  g.globalAlpha = 1;
  g.textAlign = "left";
  let size = 76;
  g.font = `700 ${size}px ${f.sans}`;
  while (size > 36 && g.measureText(item.title).width > R - L) {
    size -= 4;
    g.font = `700 ${size}px ${f.sans}`;
  }
  const ty = 155 + size;
  g.fillText(item.title, L, ty);
  g.globalAlpha = 0.75;
  g.font = `500 34px ${f.sans}`;
  g.fillText(clip(g, item.creator, R - L), L, ty + 52);

  // tracklist
  const gr = groups(item);
  const ls = listSize(gr, 880 - (ty + 165), 30);
  const lh = ls * 1.45;
  if (gr.length) {
    g.globalAlpha = 0.6;
    g.textAlign = "left";
    g.font = `600 22px ${f.sans}`;
    g.fillText("TRACKLIST", L, ty + 120);
    g.globalAlpha = 1;
  }
  let y = ty + 165;
  for (const grp of gr) {
    if (grp.side) {
      g.globalAlpha = 0.7;
      g.font = `600 22px ${f.sans}`;
      g.textAlign = "left";
      g.fillText(`SIDE ${grp.side}`, L, y);
      y += lh;
    }
    for (const t of grp.tracks) {
      g.font = `500 ${ls}px ${f.sans}`;
      g.textAlign = "left";
      g.globalAlpha = 0.6;
      g.fillText(t.label, L, y);
      g.globalAlpha = 1;
      g.fillText(clip(g, t.title, 640), L + ls * 3, y);
      if (t.duration) {
        g.textAlign = "right";
        g.globalAlpha = 0.7;
        g.fillText(t.duration, R, y);
      }
      y += lh;
    }
    y += lh * 0.8;
  }

  // bottom row: genre on the left, song count on the right
  g.globalAlpha = 0.35;
  g.beginPath();
  g.moveTo(L, 905);
  g.lineTo(R, 905);
  g.stroke();
  g.globalAlpha = 0.7;
  g.font = `500 24px ${f.sans}`;
  g.textAlign = "left";
  g.fillText((item.genre ?? "").toUpperCase(), L, 950);
  g.textAlign = "right";
  g.fillText(item.songs ? `${item.songs} SONGS` : "", R, 950);
  g.globalAlpha = 1;
}

// 4. two numbered columns, title and artist at the bottom (like the Coalmine reissue sleeve)
function columns(g: G, item: LoreItem, ink: string, f: Fonts) {
  const L = 80;
  const R = S - 80;
  const GAP = 40;
  const COL = (R - L - GAP) / 2;
  g.fillStyle = ink;
  g.strokeStyle = ink;
  g.lineWidth = 2;

  const all = groups(item).flatMap((grp) => grp.tracks);
  if (all.length) {
    g.globalAlpha = 0.6;
    g.textAlign = "left";
    g.font = `600 22px ${f.sans}`;
    g.fillText("TRACKLIST", L, 100);

    const per = Math.ceil(all.length / 2);
    const cols = [all.slice(0, per), all.slice(per)];

    // split a title into as many lines as it needs to fit the column
    const wrap = (s: number, title: string, maxW: number) => {
      g.font = `500 ${s}px ${f.sans}`;
      const lines: string[] = [];
      let cur = "";
      for (const w of title.split(" ")) {
        const next = cur ? `${cur} ${w}` : w;
        if (cur && g.measureText(next).width > maxW) {
          lines.push(cur);
          cur = w;
        } else cur = next;
      }
      lines.push(cur);
      return lines;
    };

    // the size only depends on how many rows are needed, never on how long a title is
    let size = 28;
    let laid: string[][][] = [];
    for (; size > 10; size -= 1) {
      laid = cols.map((c) => c.map((t) => wrap(size, t.title, COL - size * 2.6)));
      const rows = Math.max(...laid.map((c) => c.reduce((n, l) => n + l.length, 0)));
      if (rows * size * 1.5 <= 590) break;
    }
    const lh = size * 1.5;
    const num = size * 2.6;

    cols.forEach((c, ci) => {
      const x = L + ci * (COL + GAP);
      let y = 190;
      c.forEach((t, ti) => {
        g.font = `500 ${size}px ${f.sans}`;
        g.globalAlpha = 0.6;
        g.fillText(t.label, x, y);
        g.globalAlpha = 1;
        laid[ci][ti].forEach((line) => {
          g.fillText(line, x + num, y);
          y += lh;
        });
      });
    });
  }

  // rule, then title and artist at the bottom
  g.globalAlpha = 0.35;
  g.beginPath();
  g.moveTo(L, 800);
  g.lineTo(R, 800);
  g.stroke();

  g.globalAlpha = 1;
  g.textAlign = "left";
  let ts = 72;
  g.font = `700 ${ts}px ${f.sans}`;
  while (ts > 36 && g.measureText(item.title).width > R - L) {
    ts -= 4;
    g.font = `700 ${ts}px ${f.sans}`;
  }
  g.fillText(item.title, L, 830 + ts);

  g.globalAlpha = 0.75;
  g.font = `500 32px ${f.sans}`;
  g.fillText(clip(g, item.creator, R - L - 280), L, 960);

  g.globalAlpha = 0.6;
  g.textAlign = "right";
  g.font = `500 22px ${f.sans}`;
  g.fillText([item.kind, item.year].filter(Boolean).join(" · ").toUpperCase(), R, 960);
  g.globalAlpha = 1;
}

const LAYOUTS = [stacked, credits, ledger, columns];

/* ---------- the texture ---------- */

export function backTexture(item: LoreItem, rgb: [number, number, number], img?: HTMLImageElement) {
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d")!;
  const [r, gr, b] = rgb;
  const lum = 0.2126 * r + 0.7152 * gr + 0.0722 * b;
  const ink = lum > 150 ? "#141210" : "#f6f1ea";

  g.fillStyle = `rgb(${r},${gr},${b})`;
  g.fillRect(0, 0, S, S);

  // faint cover image for texture (square centre crop, soft blur)
  const extreme = Math.abs(lum / 255 - 0.5) * 2; // 0 = mid tone, 1 = pure white or black
  const light = lum > 200;
  const strength = Math.min(1, BACK_IMAGE_BY_ID[item.id] ?? (light ? BACK_IMAGE * 0.23 : BACK_IMAGE * (1 + extreme * 2)));
  if (img && strength > 0) {
    const side = Math.min(img.width, img.height);
    g.save();
    g.globalAlpha = strength;
    g.globalCompositeOperation = lum > 200 ? "multiply" : "soft-light"; // soft-light can't darken pure white, multiply can
    g.filter = "blur(2px)";
    g.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, S, S);
    g.restore();
  }

  g.save();
  g.translate(S / 2, S / 2);
  g.rotate((TURNS * Math.PI) / 2);
  g.scale(FLIP_X ? -1 : 1, FLIP_Y ? -1 : 1);
  g.scale(CONTENT, CONTENT);
  g.translate(-S / 2, -S / 2);
  const f = fonts();
  // more than 10 songs: two columns. 10 or fewer: one of the other three layouts.
  const many = (item.tracks?.length ?? 0) >= COLUMNS_MIN_TRACKS;
  const pool = many ? [columns] : LAYOUTS.filter((l) => l !== columns);
  pool[hash(item.id) % pool.length](g, item, ink, f);
  g.restore();

  const tex = new THREE.CanvasTexture(c);
  tex.flipY = false; // glTF convention, same as the front
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}