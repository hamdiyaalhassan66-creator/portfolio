import { useEffect } from "react";

const GAIN = 1.8; // scroll speed (px/ms) to bend. about 0.55px/ms reaches the full effect
const BEND = 0.9; // radians the surface has turned at the top and bottom edge of the screen (0.9 = about 52deg)
const DEPTH = 800; // px of perspective on each tile, lower = stronger trapezoids
const SMOOTH = 70; // ms, smooths the scroll speed so wheel steps don't jerk the curve
const UP = 90; // ms, how fast the bend builds
const DOWN = 320; // ms, how slowly it relaxes when you stop
export const BEND_X = 0.45; // radians the surface has turned at the left and right edge (Snap, List)
export const BEND_X_GRID = 0.4; // same, for the Grid view
const PULSE = 450; // ms, how long a zoom pulse takes to fade
const EDGE = 2; // how much the bend hugs the screen edges. 1 = even across the screen, higher = flatter middle, sharper edges
const PULL = 0.22; // overall strength: how far (as a share of DEPTH) the screen edges come towards you

// call this to make the surface bulge for a moment (the zoom does)
export const warpPulse = (strength = 0.6) => window.dispatchEvent(new CustomEvent("sq-warp", { detail: strength }));

// the current bend, shared with views that place their own tiles (Snap). hook = that view's draw function
export const warpState: { cur: number; hook: (() => void) | null; side: number } = { cur: 0, hook: null, side: BEND_X };

// where a point of the flat screen (x, y in px) lands once the page is bent by `cur` (0 to 1)
export const bendPoint = (x: number, y: number, cur: number, W: number, H: number): number[] => {
  const hx = W / 2;
  const hy = H / 2;
  const px = x - hx;
  const py = y - hy;
  const u = Math.max(-1.2, Math.min(1.2, px / hx));
  const v = Math.max(-1.2, Math.min(1.2, py / hy));
  // how far it comes towards you: grows from the centre, BEND weighs the top and bottom, BEND_X the sides
  const Z = Math.min(DEPTH * 0.5, cur * DEPTH * PULL * (BEND * Math.abs(v) ** EDGE + warpState.side * Math.abs(u) ** EDGE));
  const k = DEPTH / (DEPTH - Z);
  return [hx + px * k, hy + py * k];
};

// matrix3d that maps a box w x h onto four screen corners q (top-left, top-right, bottom-right, bottom-left), measured from the element's own top-left.
// sx: the box starts sx px in from the element's left edge (used for slices). Use with transform-origin: 0 0
export const quadMatrix = (q: number[][], w: number, h: number, sx = 0): string | null => {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  const den = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(den) < 1e-6) return null;
  const g = (dx3 * dy2 - dx2 * dy3) / den;
  const hh = (dx1 * dy3 - dx3 * dy1) / den;
  const A = x1 - x0 + g * x1, B = x3 - x0 + hh * x3;
  const D = y1 - y0 + g * y1, E = y3 - y0 + hh * y3;
  return `matrix3d(${A / w},${D / w},0,${g / w},${B / h},${E / h},0,${hh / h},0,0,1,0,${x0 - (sx * A) / w},${y0 - (sx * D) / w},0,${1 - (sx * g) / w})`;
};

const SLICES = 5; // how many vertical slices a tile is cut into while it bends. More = smoother curve, more elements
const sliceStore = new WeakMap<HTMLElement, HTMLElement[]>();

export const clearSlices = (el: HTMLElement) => {
  sliceStore.get(el)?.forEach((c) => c.remove());
  sliceStore.delete(el);
  el.style.clipPath = "";
};

// removes every slice under root (call when tiles are about to be replaced)
export const clearAllSlices = (root: HTMLElement | null) => {
  root?.querySelectorAll("[data-slice]").forEach((n) => n.remove());
  root?.querySelectorAll<HTMLElement>(".sq__tile, .sqv-g__item").forEach((n) => (n.style.clipPath = ""));
};

// bends one tile. (L, T, w, h): its flat box on screen. (lw, lh): its own layout size. (ox, oy): where the element's top-left sits on screen
export const bendTile = (el: HTMLElement, L: number, T: number, w: number, h: number, lw: number, lh: number, ox: number, oy: number, cur: number, W: number, H: number, sliceable: boolean) => {
  const flying = el.getAnimations().some((a) => !("animationName" in a)); // only the zoom / view-switch flight counts, not the CSS fade-in
  const n = sliceable && el.parentElement && !flying ? SLICES : 1; // a tile that is flying stays in one piece
  let cl = sliceStore.get(el);
  if (n === 1) {
    if (cl) clearSlices(el);
    cl = undefined;
  } else if (!cl || !cl[0]?.isConnected) {
    cl = [];
    for (let s = 1; s < n; s++) {
      const c = el.cloneNode(true) as HTMLElement;
      c.removeAttribute("data-id");
      c.dataset.slice = "1";
      c.setAttribute("aria-hidden", "true");
      c.style.animation = "none";
      c.style.pointerEvents = "none";
      c.querySelectorAll("img").forEach((im) => {
        im.loading = "eager"; // a slice never waits for its image
        im.decoding = "async";
      });
      (cl[s - 2] ?? el).after(c);
      cl.push(c);
    }
    sliceStore.set(el, cl);
  }
  const all = [el, ...(cl ?? [])];
  for (let s = 0; s < n; s++) {
    const x0 = s / n;
    const x1 = (s + 1) / n;
    // the slice's four corners go through the bend. Neighbouring slices and tiles share corners, so they stay joined
    const q = [[L + w * x0, T], [L + w * x1, T], [L + w * x1, T + h], [L + w * x0, T + h]].map(([x, y]) => {
      const [X, Y] = bendPoint(x, y, cur, W, H);
      return [X - ox, Y - oy];
    });
    const m = quadMatrix(q, lw / n, lh, lw * x0);
    if (!m) continue;
    const t = all[s];
    t.style.transformOrigin = "0 0";
    t.style.transform = m;
    t.style.clipPath = n === 1 ? "" : `inset(0px ${s === n - 1 ? 0 : Math.max(0, lw * (1 - x1) - 0.6)}px 0px ${s === 0 ? 0 : Math.max(0, lw * x0 - 0.6)}px)`; // a hair of overlap hides the seams
  }
  return true;
};

const TILES = ".sq__field[data-warp] .sq__tile:not([data-slice]), .sqv-l__row[data-warp]"; // nothing carries data-warp, so Grid and List stay flat. Only Snap bends

// cx and cy: the tile's centre (cx on screen, cy in page px). bx and by: the translate its own CSS gives it, in px
type Entry = { el: HTMLElement; cx: number; cy: number; w: number; h: number; bx: number; by: number };

// scroll fast and the page wraps onto a cylinder: flat in the middle of the screen, tipping back and shrinking towards the top and bottom
export default function useScrollWarp() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let last = window.scrollY;
    let time = performance.now();
    let vs = 0; // smoothed scroll speed
    let cur = 0; // current bend, 0 to 1
    let measured = false;
    let pulse = 0; // an extra bend that fades by itself, 0 to 1
    let list: Entry[] = [];
    const on = new Set<HTMLElement>(); // tiles that currently carry an offset

    const drop = (t: HTMLElement) => {
      clearSlices(t);
      t.style.transform = "";
      t.style.transformOrigin = "";
      on.delete(t);
    };
    const clearAll = () => {
      on.forEach(drop);
      measured = false;
    };

    // the tile's own CSS translate (the centring), so the warp adds to it instead of replacing it
    const baseTranslate = (el: HTMLElement, r: DOMRect) => {
      const v = getComputedStyle(el).translate;
      if (!v || v === "none") return [0, 0];
      const p = v.split(" ");
      const n = (s: string | undefined, size: number) => (!s ? 0 : s.endsWith("%") ? (parseFloat(s) / 100) * size : parseFloat(s));
      return [n(p[0], r.width), n(p[1], r.height)];
    };

    // one layout read, only when a scroll starts and everything is flat
    const measure = () => {
      const sy = window.scrollY;
      list = Array.from(document.querySelectorAll<HTMLElement>(TILES)).map((el) => {
        const op = el.offsetParent as HTMLElement | null;
        const grid = !!op && el.classList.contains("sq__tile");
        // grid tiles use their layout box, which ignores a fly-in animation that may still be running
        const r = grid ? new DOMRect(0, 0, el.offsetWidth, el.offsetHeight) : el.getBoundingClientRect();
        const [bx, by] = baseTranslate(el, r);
        if (grid) {
          const pr = op!.getBoundingClientRect();
          return { el, cx: pr.left + el.offsetLeft + r.width / 2 + bx, cy: pr.top + sy + el.offsetTop + r.height / 2 + by, w: r.width, h: r.height, bx, by };
        }
        return { el, cx: r.left + r.width / 2, cy: r.top + r.height / 2 + sy, w: r.width, h: r.height, bx, by };
      });
      return list.length > 0;
    };

    const frame = (now: number) => {
      raf = 0;
      const W = window.innerWidth;
      const H = window.innerHeight;
      const hy = H / 2;
      const y = window.scrollY;
      const dt = Math.max(1, Math.min(64, now - time));
      time = now;
      const dy = y - last;
      last = y;

      // a jump (a tab change scrolls to the top) is not a scroll: skip it and measure again
      if (Math.abs(dy) > H * 1.5) {
        vs = 0;
        cur = 0;
        clearAll();
        if (pulse < 0.004) {
          warpState.cur = 0;
          warpState.hook?.();
          return; // a zoom pulse keeps going through its own jump
        }
      }

      vs += (Math.abs(dy) / dt - vs) * (1 - Math.exp(-dt / SMOOTH));
      pulse *= Math.exp(-dt / PULSE);
      const target = Math.min(1, Math.max(vs * GAIN, pulse));
      cur += (target - cur) * (1 - Math.exp(-dt / (target > cur ? UP : DOWN)));

      warpState.cur = cur;
      if (cur < 0.004 && target < 0.004) {
        cur = 0;
        vs = 0;
        warpState.cur = 0;
        clearAll();
        warpState.hook?.(); // lets the Snap view settle flat
        return; // idle: no more frames until the next scroll
      }

      if (!measured) {
        measure(); // the Snap view has no tiles to measure, it bends its own through warpState
        measured = true;
      }

      const cull = hy * 3; // past this it is far off screen, leave it alone

      for (const e of list) {
        if (!e.el.isConnected) continue;
        const s = e.cy - y - hy; // px below (+) or above (-) the middle of the screen
        if (s > cull || s < -cull) {
          if (on.has(e.el)) drop(e.el);
          continue;
        }
        const L = e.cx - e.w / 2;
        const T = e.cy - y - e.h / 2;
        const isTile = e.el.classList.contains("sq__tile"); // List rows bend as one piece
        const seen = T + e.h > -300 && T < H + 300; // tiles near the screen are sliced a little early, so the work is spread over several frames
        if (!bendTile(e.el, L, T, e.w, e.h, e.w, e.h, L, T, cur, W, H, isTile && seen)) continue;
        on.add(e.el);
      }
      warpState.hook?.(); // the Snap view redraws with the new bend
      raf = requestAnimationFrame(frame);
    };

    const born = performance.now();
    const onScroll = () => {
      if (performance.now() - born < 700) {
        last = window.scrollY; // scrolls right after load come from the browser (restoring, images settling), not from you
        return;
      }
      if (!raf) {
        time = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    const onPulse = (ev: Event) => {
      clearAll(); // positions are about to change, measure again
      last = window.scrollY;
      pulse = Math.max(pulse, (ev as CustomEvent<number>).detail ?? 0.6);
      onScroll();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("sq-warp", onPulse);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("sq-warp", onPulse);
      warpState.cur = 0;
      cancelAnimationFrame(raf);
      clearAll();
    };
  }, []);
}