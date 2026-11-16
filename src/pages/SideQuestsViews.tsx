import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as RKeyEvent, PointerEvent as RPointerEvent, WheelEvent as RWheelEvent } from "react";
import type { Project } from "./SideQuests";
import "./SideQuestsViews.css";

type Props = { list: Project[]; ratios: Map<string, number>; onActive: (p: number) => void; intro?: string };
type Img = { src: string; alt: string; p: number };

const flat = (list: Project[]): Img[] => list.flatMap((pr, p) => pr.images.map((src) => ({ src, alt: pr.name, p })));
const ratioOf = (ratios: Map<string, number>, src: string) => ratios.get(src) ?? 0.8;
const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b);

export function AltView({ view, ...rest }: Props & { view: string }) {
  if (view === "Carousel") return <Carousel {...rest} />;
  if (view === "Zoom") return <Zoom {...rest} />;
  return <ListView {...rest} />;
}

/* ---------- 3D carousel ---------- */
function Carousel({ list, ratios, onActive }: Props) {
  const imgs = useMemo(() => flat(list).slice(0, 24), [list]); // 24 max keeps the ring light
  const m = Math.max(imgs.length, 6);
  const root = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const s = useRef({ a: 0, v: 0, drag: false, lx: 0, hover: false });

  useEffect(() => {
    const el = root.current;
    const rg = ring.current;
    if (!el || !rg || !imgs.length) return;
    const st = s.current;
    const step = 360 / m;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let R = 600;
    let raf = 0;
    let shown = -1;
    const size = () => {
      const cw = clamp(el.clientWidth * 0.17, 96, 210); // card width follows the screen
      R = (cw * 1.12) / 2 / Math.tan(Math.PI / m); // ring radius so neighbours almost touch
      el.style.setProperty("--cw", `${cw}px`);
      el.style.setProperty("--r", `${R}px`);
    };
    const frame = () => {
      if (!st.drag) {
        st.a += st.v;
        st.v *= 0.95;
        if (Math.abs(st.v) < 0.01) st.v = 0;
        if (!reduce && !st.hover && st.v === 0) st.a += 0.05; // slow idle turn
      }
      rg.style.transform = `translateZ(${-R}px) rotateY(${st.a.toFixed(2)}deg)`;
      const idx = ((Math.round(-st.a / step) % m) + m) % m; // the card facing you
      if (idx !== shown && idx < imgs.length) {
        shown = idx;
        onActive(imgs[idx].p);
      }
      raf = requestAnimationFrame(frame);
    };
    size();
    const ro = new ResizeObserver(size);
    ro.observe(el);
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [imgs, m, onActive]);

  const down = (e: RPointerEvent<HTMLDivElement>) => {
    const st = s.current;
    st.drag = true;
    st.lx = e.clientX;
    st.v = 0;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: RPointerEvent<HTMLDivElement>) => {
    const st = s.current;
    if (!st.drag) return;
    const d = (e.clientX - st.lx) * 0.22;
    st.lx = e.clientX;
    st.a += d;
    st.v = d; // keeps turning after you let go
  };
  const up = () => {
    s.current.drag = false;
  };
  const wheel = (e: RWheelEvent<HTMLDivElement>) => {
    s.current.v = clamp(s.current.v - (e.deltaX + e.deltaY) * 0.01, -6, 6);
  };
  const key = (e: RKeyEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") s.current.v -= 2;
    else if (e.key === "ArrowLeft") s.current.v += 2;
  };

  return (
    <div
      className="sqv-c"
      ref={root}
      tabIndex={0}
      role="group"
      aria-label="3D carousel. Drag or use the arrow keys to turn it"
      style={{ "--step": `${360 / m}deg` } as CSSProperties}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") s.current.hover = true;
      }}
      onPointerLeave={() => {
        s.current.hover = false;
      }}
      onWheel={wheel}
      onKeyDown={key}
    >
      <div className="sqv-c__ring" ref={ring}>
        {imgs.map((im, i) => (
          <figure className="sqv-c__item" key={i} style={{ "--i": i, "--ar": ratioOf(ratios, im.src) } as CSSProperties}>
            <img src={im.src} alt={im.alt} draggable={false} decoding="async" />
          </figure>
        ))}
      </div>
    </div>
  );
}

/* ---------- list: intro text, then one row per project. Hover shows the first 5 thumbnails ---------- */
function ListView({ list, onActive, intro }: Props) {
  const [open, setOpen] = useState<number | null>(null);
  const coarse = () => window.matchMedia("(hover: none)").matches;
  const set = (i: number | null) => {
    setOpen(i);
    if (i !== null) onActive(i);
  };
  return (
    <div className="sqv">
      {intro && <p className="sqv__intro">{intro}</p>}
      <ul className="sqv-l">
        {list.map((pr, i) => (
          <li
            key={pr.id}
            className={"sqv-l__row" + (open === i ? " is-open" : "")}
            onPointerEnter={(e) => e.pointerType === "mouse" && set(i)}
            onPointerLeave={(e) => e.pointerType === "mouse" && set(null)}
          >
            <button
              type="button"
              className="sqv-l__head"
              aria-expanded={open === i}
              onClick={() => coarse() && set(open === i ? null : i)} // touch: tap to open and close
              onFocus={(e) => e.currentTarget.matches(":focus-visible") && set(i)} // keyboard: focus opens it
              onBlur={() => !coarse() && set(null)}
            >
              <span className="sqv-l__no">{i + 1}</span>
              <span className="sqv-l__name">{pr.name}</span>
              <span className="sqv-l__cat">{pr.category}</span>
            </button>
            {open === i && (
              <div className="sqv-l__peek" aria-hidden="true">
                {pr.images.slice(0, 5).map((src, j) => (
                  <img key={j} src={src} alt="" draggable={false} decoding="async" style={{ "--j": j } as CSSProperties} />
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- zoom: scroll drives a camera that zooms out, drifts over the grid and zooms back in. The view warps like a lens with the scroll speed ---------- */
const PATH = { c: 2, r: 6 }; // columns and rows the camera travels in one pass (whole numbers, so it ends centred on a card)
const WARP = 0.3; // lens strength at full scroll speed
const wrap = (d: number, L: number) => d - Math.round(d / L) * L; // shortest way round, the grid repeats endlessly
const sstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// critically damped spring: gives the camera its lag, never overshoots
const damp = (cur: number, to: number, vel: { v: number }, time: number, dt: number) => {
  const om = 2 / time;
  const x = om * dt;
  const e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const d = cur - to;
  const t = (vel.v + om * d) * dt;
  vel.v = (vel.v - om * t) * e;
  return to + (d + t) * e;
};

function Zoom({ list, onActive }: Props) {
  const imgs = useMemo(() => flat(list).slice(0, 24), [list]);
  const track = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ W: 0, H: 0 });
  const [cur, setCur] = useState(0); // project shown behind the cards

  // the stage size drives the layout
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    let raf = 0;
    const read = () =>
      setDims((d) =>
        d.W === el.clientWidth && Math.abs(d.H - el.clientHeight) < 60 ? d : { W: el.clientWidth, H: el.clientHeight },
      ); // small height changes (mobile browser bars) don't rebuild the grid
    read();
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(read);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  const lay = useMemo(() => {
    const { W, H } = dims;
    if (!W || !H || !imgs.length) return null;
    const bp = W <= 700 ? 0 : W <= 1100 ? 1 : 2; // phone / tablet / desktop
    const tile = Math.round(Math.min(W * 0.36, H * 0.3, 340)); // card size in focus
    const cell = tile * 1.95; // grid spacing
    const so = Math.min(0.8, W / ([2.6, 3.6, 4.6][bp] * cell)); // zoomed-out scale: about 3 / 4 / 5 cards across
    const cols = [4, 6, 7][bp]; // wider than the screen even after the lens pulls the edges in, so the repeat never shows
    const rows = Math.max(PATH.r + 1, Math.ceil(imgs.length / cols), Math.ceil(H / (so * cell)) + 2);
    const L = Math.round(Math.hypot(PATH.c, PATH.r) * cell * so * 1.1 + H * 1.2); // scroll distance of one pass, in px
    return { W, H, tile, cell, so, cols, rows, n: cols * rows, L };
  }, [dims, imgs]);

  // the motion loop. It only runs while the camera is catching up with the scroll
  useLayoutEffect(() => {
    const box = track.current;
    if (!box || !lay) return;
    const { W, H, tile, cell, so, cols, rows, L } = lay;
    const els = Array.from(box.querySelectorAll<HTMLElement>(".sqv-z__tile"));
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const GW = cols * cell;
    const GH = rows * cell;
    const R2 = (W * W + H * H) / 4; // squared half diagonal, the lens is centred on the screen
    const px = els.map((_, i) => (i % cols) * cell);
    const py = els.map((_, i) => Math.floor(i / cols) * cell);
    const shown = els.map(() => true);
    const vp = { v: 0 };
    const va = { v: 0 };
    const top = box.getBoundingClientRect().top + window.scrollY;
    const goal = () => clamp((window.scrollY - top) / L, 0, 1); // scroll progress, 0 to 1
    let P = goal(); // the camera's own progress, it follows the scroll with a lag
    let a = 0; // current lens strength
    let title = -1;
    let raf = 0;
    let last = 0;

    const draw = () => {
      const w = sstep(0.08, 0.32, P) * (1 - sstep(0.78, 0.96, P)); // 0 = in focus, 1 = zoomed out
      const k = 1 + (so - 1) * w;
      const cx = P * PATH.c * cell;
      const cy = P * PATH.r * cell;
      const q = (2 * a) / R2;
      for (let i = 0; i < els.length; i++) {
        const dx = wrap(px[i] - cx, GW) * k;
        const dy = wrap(py[i] - cy, GH) * k;
        const g = Math.max(0.3, 1 - (a * (dx * dx + dy * dy)) / R2); // barrel lens: the further from the middle, the more it pulls in
        const sx = W / 2 + dx * g;
        const sy = H / 2 + dy * g;
        const r = tile * k * 0.8;
        const on = sx + r > 0 && sx - r < W && sy + r > 0 && sy - r < H;
        if (on !== shown[i]) {
          shown[i] = on;
          els[i].style.display = on ? "" : "none"; // off screen cards cost nothing
        }
        if (!on) continue;
        let t = `translate3d(${(sx - tile / 2).toFixed(1)}px,${(sy - tile / 2).toFixed(1)}px,0) scale(${k.toFixed(3)})`;
        if (a > 0.002) {
          // the lens's local stretch at this card, which is what makes the cards lean and skew
          const m = (-q * dx * dy).toFixed(4);
          t += ` matrix(${(g - q * dx * dx).toFixed(4)},${m},${m},${(g - q * dy * dy).toFixed(4)},0,0)`;
        }
        els[i].style.transform = t;
      }
      // the project name follows the card nearest the middle
      const ci =
        ((Math.round(cy / cell) % rows) + rows) % rows * cols + (((Math.round(cx / cell) % cols) + cols) % cols);
      const p = imgs[ci % imgs.length].p;
      if (p !== title) {
        title = p;
        setCur(p);
        onActive(p);
      }
    };

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const g = goal();
      if (still) {
        P = g;
        a = 0;
      } else {
        P = damp(P, g, vp, 0.3, dt);
        const speed = Math.abs(vp.v) * L; // scroll px per second the camera is covering
        a = damp(a, Math.min(1, speed / 1600) * WARP, va, 0.2, dt);
      }
      const idle = Math.abs(P - g) < 1e-5 && Math.abs(vp.v) < 1e-4 && a < 1e-3;
      if (idle) {
        P = g;
        a = 0;
        vp.v = va.v = 0;
      }
      draw();
      raf = idle ? 0 : requestAnimationFrame(frame); // nothing runs while the page is at rest
    };
    const kick = () => {
      if (raf) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };

    draw();
    window.addEventListener("scroll", kick, { passive: true });
    return () => {
      window.removeEventListener("scroll", kick);
      cancelAnimationFrame(raf);
    };
  }, [lay, imgs, onActive]);

  const pr = list[cur] ?? list[0];

  return (
    <div className="sqv-z" ref={track} style={{ height: lay ? `calc(100svh + ${lay.L}px)` : "100svh" }}>
      <div
        className="sqv-z__stage"
        ref={stage}
        role="group"
        aria-label="Zoom view. Scroll to move through the projects"
        style={{ "--tile": `${lay?.tile ?? 140}px` } as CSSProperties}
      >
        {pr && (
          <div className="sqv-z__title" key={pr.id}>
            <h2 className="sqv-z__name">{pr.name}</h2>
            <p className="sqv-z__cat">{pr.category}</p>
          </div>
        )}
        {lay &&
          Array.from({ length: lay.n }, (_, i) => {
            const im = imgs[i % imgs.length];
            return (
              <figure className="sqv-z__tile" key={i}>
                <img src={im.src} alt={im.alt} draggable={false} decoding="async" fetchPriority={i < 6 ? "high" : "low"} />
              </figure>
            );
          })}
      </div>
    </div>
  );
}