import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as RMouseEvent, PointerEvent as RPointerEvent } from "react";
import { Link } from "react-router-dom";
import { PROJECTS, srcSet } from "./projects";
import "./Flow.css";

type Kind = "phone" | "tablet" | "desktop";
type Tile = { p: number; src: string; lane: number; ratio: number; size: number; first: boolean };

const COUNT: Record<Kind, number> = { phone: 34, tablet: 46, desktop: 60 }; // dense mosaic, fewer tiles on small screens
const RATIOS = [0.75, 1, 1.33, 1.5]; // width / height, picked at random
const SPEED = 0.025; // laps per second of idle drift
const FRICTION = 0.92; // per 16.7ms, how fast a mouse flick slows down
const FRONT = 0.72; // depth of the tile that shows its details
const PERIOD = 4000; // px of page scroll for one full lap of the stream
const LAPS = 40; // laps of scroll the page has, it starts in the middle so it feels endless
const SIZES = "(max-width: 700px) 36vw, (max-width: 1100px) 26vw, 20vw";

// per size bracket, as fractions of the stage: unit = tile size [of width, of height], spread = how far tiles pile up to the left,
// a / c / b = start (top right), bend, and end (bottom) of the path
const LAYOUT = {
  phone: { unit: [0.3, 0.2], spread: 0.5, a: [0.99, -0.02], c: [0.92, 0.45], b: [0.8, 1.06] },
  tablet: { unit: [0.2, 0.26], spread: 0.3, a: [0.99, -0.02], c: [0.86, 0.42], b: [0.7, 1.06] },
  desktop: { unit: [0.15, 0.34], spread: 0.24, a: [0.99, -0.02], c: [0.84, 0.42], b: [0.64, 1.06] },
} as const;

const mod = (a: number, n: number) => ((a % n) + n) % n;
const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b);
const host = (u: string) => u.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
const kindOf = (w: number): Kind => (w <= 700 ? "phone" : w <= 1100 ? "tablet" : "desktop");

const Arrow = () => (
  <svg className="work__arrow" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
    <path d="M7 15 15 7M8.5 7H15v6.5" />
  </svg>
);

// small seeded random, so the stream looks the same on every visit
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export default function Flow() {
  const stage = useRef<HTMLDivElement>(null);
  const st = useRef({ pos: 0, v: 0, push: 0, drag: false, lx: 0, ly: 0, moved: 0, t: 0, kick: () => {}, dir: [0, 1] as [number, number], len: 1 });
  const [kind, setKind] = useState<Kind>("desktop");
  const [front, setFront] = useState(-1); // project index of the tile in front

  const pool = useMemo(() => PROJECTS.filter((p) => p.images.length), []);
  const tiles = useMemo<Tile[]>(() => {
    if (!pool.length) return [];
    const rand = seeded(11);
    const seen = new Set<number>();
    return Array.from({ length: COUNT[kind] }, (_, i) => {
      const p = i % pool.length;
      const imgs = pool[p].images;
      const first = !seen.has(p); // one tab stop per project
      seen.add(p);
      return {
        p,
        src: imgs[Math.floor(i / pool.length) % imgs.length],
        lane: rand(), // 0 to 1, tiles pile up on one side of the path
        ratio: RATIOS[Math.floor(rand() * RATIOS.length)],
        size: 0.85 + rand() * 0.35,
        first,
      };
    });
  }, [kind, pool]);

  // only the size bracket is state; everything else is measured inside the motion loop
  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const read = () => setKind((k) => (kindOf(el.clientWidth) === k ? k : kindOf(el.clientWidth)));
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // the motion loop: writes transform + opacity only, never touches React state except when the front tile changes
  useEffect(() => {
    const box = stage.current;
    if (!box || !tiles.length) return;
    const els = Array.from(box.querySelectorAll<HTMLElement>(".flow__tile"));
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const s = st.current;
    const n = els.length;
    const ws = new Array<number>(n);
    const hs = new Array<number>(n);
    const vis = new Array<boolean>(n).fill(false);
    const lastOp = new Array<string>(n).fill(""); // only touch the DOM when a value changed
    const lastZ = new Array<number>(n).fill(-1);
    let W = 0, H = 0, ax = 0, ay = 0, cx = 0, cy = 0, bx = 0, by = 0, spread = 0;
    let cur = -1;
    let raf = 0;
    let last = 0;
    let lastY = 0;
    let run = true;

    const measure = () => {
      W = box.clientWidth;
      H = box.clientHeight;
      const L = LAYOUT[kindOf(W)];
      const unit = Math.min(W * L.unit[0], H * L.unit[1]);
      ax = W * L.a[0];
      ay = H * L.a[1];
      cx = W * L.c[0];
      cy = H * L.c[1];
      bx = W * L.b[0];
      by = H * L.b[1];
      spread = W * L.spread;
      const dx = bx - ax;
      const dy = by - ay;
      const len = Math.hypot(dx, dy);
      s.dir = [dx / len, dy / len]; // dragging along the path brings photos closer
      s.len = len;
      els.forEach((el, i) => {
        ws[i] = unit * tiles[i].size;
        hs[i] = ws[i] / tiles[i].ratio;
        el.style.width = `${ws[i].toFixed(1)}px`; // layout is touched only here, on resize
        el.style.height = `${hs[i].toFixed(1)}px`;
      });
    };

    const draw = () => {
      let best = 9;
      let fi = -1;
      const sw = Math.sin(s.pos * 3) * W * 0.06; // the whole stream slowly swings
      for (let i = 0; i < n; i++) {
        const t = tiles[i];
        const z = mod(i / n + s.pos, 1); // 0 = far, 1 = close
        const dim = z < 0.7 ? 0.5 + 0.5 * (z / 0.7) : 1 - 0.65 * ((z - 0.7) / 0.3);
        const op = clamp(z / 0.08, 0, 1) * clamp((1 - z) / 0.05, 0, 1) * dim;
        const on = op > 0.01;
        if (on !== vis[i]) {
          vis[i] = on;
          els[i].style.display = on ? "" : "none"; // hidden tiles cost nothing and never load their photo
        }
        if (!on) continue;
        const u = Math.pow(z, 1.6); // slow far away, quick up close
        const v = 1 - u;
        const px = v * v * ax + 2 * v * u * (cx + sw) + u * u * (bx + sw * 2);
        const py = v * v * ay + 2 * v * u * cy + u * u * by;
        const sc = 0.1 + 1.05 * z * z;
        const off = t.lane * spread * (0.12 + z); // tiles pile up to the left of the path
        // the tile's top right corner sits on the path, the rest hangs down and to the left
        const x = px - off - (ws[i] * sc) / 2 - ws[i] / 2;
        const y = py + (hs[i] * sc) / 2 - hs[i] / 2;
        const el = els[i];
        el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) scale(${sc.toFixed(3)})`;
        const o = op.toFixed(2);
        if (o !== lastOp[i]) {
          lastOp[i] = o;
          el.style.opacity = o;
        }
        const zi = Math.round(z * 100);
        if (zi !== lastZ[i]) {
          lastZ[i] = zi;
          el.style.zIndex = String(zi);
        }
        const d = Math.abs(z - FRONT);
        if (d < best) {
          best = d;
          fi = i;
        }
      }
      const p = fi >= 0 ? tiles[fi].p : -1;
      if (p !== cur) {
        cur = p;
        setFront(p);
      }
    };

    const frame = (now: number) => {
      const dt = Math.min(now - last, 50) || 16;
      last = now;
      if (!s.drag) {
        s.pos += ((still ? 0 : SPEED) + s.v) * (dt / 1000);
        s.v *= Math.pow(FRICTION, dt / 16.7);
        if (Math.abs(s.v) < 0.001) s.v = 0;
      }
      if (s.push) {
        // page scroll is eased in, so mouse wheel steps feel smooth
        const step = s.push * (1 - Math.exp(-dt / 110));
        s.pos += step;
        s.push -= step;
        if (Math.abs(s.push) < 0.00005) {
          s.pos += s.push;
          s.push = 0;
        }
      }
      draw();
      // sleeps when nothing is moving (reduced motion, or nothing happening)
      raf = run && (!still || s.v !== 0 || s.drag || s.push !== 0) ? requestAnimationFrame(frame) : 0;
    };
    const kick = () => {
      if (raf || !run) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };
    s.kick = kick;

    // the page is tall, scrolling it moves the stream. Start in the middle so you can scroll either way
    if (window.scrollY < PERIOD) window.scrollTo({ top: (PERIOD * LAPS) / 2, behavior: "instant" as ScrollBehavior });
    lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      s.push += (y - lastY) / PERIOD;
      lastY = y;
      kick();
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    measure();
    draw();
    kick();
    const ro = new ResizeObserver(() => {
      measure();
      draw();
    });
    ro.observe(box);

    // stop completely while the tab is hidden or the stage is off screen
    const set = (v: boolean) => {
      run = v;
      if (!v) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else kick();
    };
    const io = new IntersectionObserver(([e]) => set(e.isIntersecting && !document.hidden));
    io.observe(box);
    const vc = () => set(!document.hidden);
    document.addEventListener("visibilitychange", vc);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", vc);
    };
  }, [tiles]);

  const down = (e: RPointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    const s = st.current;
    s.drag = true;
    s.lx = e.clientX;
    s.ly = e.clientY;
    s.moved = 0;
    s.v = 0;
    s.t = performance.now();
    stage.current?.classList.add("is-drag");
    s.kick();
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - s.lx;
      const dy = ev.clientY - s.ly;
      s.lx = ev.clientX;
      s.ly = ev.clientY;
      s.moved += Math.abs(dx) + Math.abs(dy);
      const now = performance.now();
      const dp = ((dx * s.dir[0] + dy * s.dir[1]) / s.len) * 0.8; // drag along the stream brings photos closer
      s.pos += dp;
      s.v = clamp((dp / Math.max(now - s.t, 8)) * 1000, -0.8, 0.8);
      s.t = now;
    };
    const up = () => {
      s.drag = false;
      if (performance.now() - s.t > 80) s.v = 0;
      stage.current?.classList.remove("is-drag");
      s.kick();
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };
  const click = (e: RMouseEvent<HTMLAnchorElement>) => {
    if (st.current.moved > 10) e.preventDefault(); // it was a drag, not a click
  };

  const pj = front >= 0 ? pool[front] : null;

  return (
    <div className="flow-track" style={{ height: `calc(var(--ph, 100vh) + ${PERIOD * LAPS}px)` }}>
    <div
      className="flow"
      ref={stage}
      role="group"
      aria-label="Project stream. Scroll or drag to explore"
      onPointerDown={down}
    >
      {tiles.map((t, i) => (
        <div key={i} className="flow__tile" style={{ display: "none" }}>
          <Link to={`/works/${pool[t.p].id}`} className="flow__link" aria-label={pool[t.p].name} tabIndex={t.first ? undefined : -1} draggable={false} onClick={click}>
            <picture>
              <source type="image/avif" srcSet={srcSet(t.src, "avif")} sizes={SIZES} />
              <source type="image/webp" srcSet={srcSet(t.src, "webp")} sizes={SIZES} />
              <img
                src={t.src}
                alt=""
                loading={i < 3 ? "eager" : "lazy"}
                fetchPriority={i < 2 ? "high" : "low"}
                decoding="async"
                draggable={false}
              />
            </picture>
          </Link>
          {i % 3 === 0 && (
            <span className="flow__tag" aria-hidden="true">
              {pool[t.p].name}
            </span>
          )}
        </div>
      ))}

      {pj && (
        <div className="flow__label" onPointerDown={(e) => e.stopPropagation()}>
          {pj.deliverables && <p className="work__cat">{pj.deliverables}</p>}
          <h2 className="work__name">
            <Link to={`/works/${pj.id}`}>{pj.name}</Link>
          </h2>
          {pj.link && (
            <a className="work__chip" href={pj.link} target="_blank" rel="noreferrer">
              <span>{host(pj.link)}</span>
              <Arrow />
            </a>
          )}
        </div>
      )}
    </div>
    </div>
  );
}