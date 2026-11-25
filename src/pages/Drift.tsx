import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type {
  CSSProperties,
  KeyboardEvent as RKeyEvent,
  MouseEvent as RMouseEvent,
  PointerEvent as RPointerEvent,
  WheelEvent as RWheelEvent,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import { PROJECTS, srcSet } from "./projects";
import InfoButton from "./InfoButton";
import "./Drift.css";

type Tile = { x: number; y: number; w: number; h: number; p: number; src: string; d: number }; // d = depth, how fast it moves
type Grow = { id: string; src: string; l: number; t: number; w: number; h: number };

const RATIOS = [0.75, 1, 1.33, 1.5]; // width / height of each tile, picked at random
const AUTO_X = 0.35; // px per frame the collage drifts when nobody touches it (content moves left and up)
const AUTO_Y = 0.18;
const FRICTION = 0.94; // how fast a drag or wheel flick slows down
const MARGIN = 80; // px outside the screen where tiles are still drawn
const SIZES = "(max-width: 700px) 68vw, (max-width: 1100px) 42vw, 30vw"; // the biggest tile is about this wide

const mod = (a: number, n: number) => ((a % n) + n) % n;
const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b);
const host = (u: string) => u.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
const Arrow = () => (
  <svg className="work__arrow" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
    <path d="M7 15 15 7M8.5 7H15v6.5" />
  </svg>
);

// small seeded random, so the collage looks the same on every visit
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// the repeating block is a little bigger than the screen plus one tile, so a tile is never needed in two places at once
const chunk = (W: number, H: number) => {
  const unit = W <= 700 ? W / 2.4 : W <= 1100 ? W / 3.9 : W / 5.5; // base tile width: phone / tablet / desktop
  return { unit, cell: unit * 1.5, CW: W + unit * 1.8, CH: H + unit * 2.4 }; // cell > tile = gaps between tiles
};

// three depth layers. Each layer is its own evenly spaced grid and moves as one, so tiles in a layer never bunch up
const LAYERS = [
  { s: 0.8, d: 0.7 }, // far: small, slow
  { s: 1, d: 1 },
  { s: 1.25, d: 1.3 }, // close: big, fast
];

function pack(CW: number, CH: number, unit: number, cell: number, pool: typeof PROJECTS): Tile[] {
  const used = new Array<number>(pool.length).fill(0);
  const tiles: Tile[] = [];
  LAYERS.forEach(({ s, d }, li) => {
    const rand = seeded(7 + li * 13);
    const lc = cell * s * 1.6; // cell size for this layer
    const cols = Math.max(2, Math.round(CW / lc));
    const rows = Math.max(3, Math.round(CH / (lc * 0.9)));
    const cw = CW / cols;
    const ch = CH / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const w = Math.round(unit * s * (1 + rand() * 0.3));
        const h = Math.round(w / RATIOS[Math.floor(rand() * RATIOS.length)]);
        const p = (c + r * 2 + li * 3) % pool.length; // neighbours are different projects
        const imgs = pool[p].images;
        tiles.push({
          x: Math.round(c * cw + (r % 2) * cw * 0.5 + (rand() - 0.5) * cw * 0.4),
          y: Math.round(r * ch + (rand() - 0.5) * ch * 0.4),
          w,
          h,
          p,
          src: imgs[used[p]++ % imgs.length],
          d,
        });
      }
    }
  });
  return tiles.sort((a, b) => a.d - b.d); // far tiles first, so close ones are drawn on top
}

export default function Drift() {
  const navigate = useNavigate();
  const stage = useRef<HTMLDivElement>(null);
  const st = useRef({ x: 0, y: 0, vx: 0, vy: 0, drag: false, lx: 0, ly: 0, moved: 0, t: 0, kick: () => {} });
  const [dims, setDims] = useState({ W: 0, H: 0 });
  const [grow, setGrow] = useState<Grow | null>(null); // the tile that is growing to full screen
  const [go, setGo] = useState(false);
  const [center, setCenter] = useState(-1); // index of the tile in front, the only one that shows details
  const [info, setInfo] = useState(false);
  const infoOn = useRef(false);
  infoOn.current = info;
  useEffect(() => st.current.kick(), [info]); // closing the Info panel restarts the drift

  const pool = useMemo(() => PROJECTS.filter((p) => p.images.length), []);
  const tiles = useMemo(() => {
    if (!dims.W || !pool.length) return [] as Tile[];
    const { unit, cell, CW, CH } = chunk(dims.W, dims.H);
    return pack(CW, CH, unit, cell, pool);
  }, [dims.W, dims.H, pool]);
  const firstOf = useMemo(() => {
    const seen = new Set<number>();
    return tiles.map((t) => (seen.has(t.p) ? false : (seen.add(t.p), true))); // only one tab stop per project
  }, [tiles]);

  // the stage size drives the layout
  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    let raf = 0;
    const read = () =>
  setDims((d) =>
    d.W === el.clientWidth && Math.abs(d.H - el.clientHeight) < 60 ? d : { W: el.clientWidth, H: el.clientHeight },
  ); // small height changes (mobile browser bars) don't rebuild the layout
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

  // the motion loop: moves every visible tile and brings the one in the middle to the front
  useEffect(() => {
    const box = stage.current;
    if (!box || !tiles.length) return;
    const els = Array.from(box.querySelectorAll<HTMLElement>(".drift__tile"));
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const { W, H } = dims;
    const { CW, CH } = chunk(W, H);
    const k = W <= 700 ? 0.7 : 1; // slower drift on phones
    const s = st.current;
    const vis = els.map(() => true);
    let cur = -1;
    let raf = 0;
    els.forEach((el) => el.classList.remove("is-center"));
    setCenter(-1);

    const draw = () => {
      let front = -1; // the topmost tile covering the middle of the screen
      for (let i = 0; i < els.length; i++) {
        const t = tiles[i];
        const sx = mod(t.x - s.x * t.d + t.w, CW) - t.w; // wraps around, so the collage never ends
        const sy = mod(t.y - s.y * t.d + t.h, CH) - t.h;
        const on = sx < W + MARGIN && sx + t.w > -MARGIN && sy < H + MARGIN && sy + t.h > -MARGIN;
        if (on !== vis[i]) {
          vis[i] = on;
          els[i].style.display = on ? "" : "none"; // tiles off screen cost nothing and never load their photo
        }
        if (!on) continue;
        els[i].style.transform = `translate3d(${sx.toFixed(2)}px,${sy.toFixed(2)}px,0)`;
        if (sx <= W / 2 && sx + t.w >= W / 2 && sy <= H / 2 && sy + t.h >= H / 2) front = i; // later tiles are drawn on top
      }
      if (front !== cur) {
        if (cur >= 0) els[cur].classList.remove("is-center");
        cur = front;
        if (cur >= 0) els[cur].classList.add("is-center");
        setCenter(cur);
        setInfo(false); // the Info panel closes when another card takes the middle
      }
    };

    let last = 0;
    let run = true;
    const frame = (now: number) => {
      const f = Math.min(now - last, 50) / 16.7 || 1; // 1 at 60Hz, so 120Hz screens drift at the same speed
      last = now;
      if (!s.drag) {
        const auto = still || infoOn.current ? 0 : k; // the collage holds still while an Info panel is open
        s.x += (s.vx + AUTO_X * auto) * f;
        s.y += (s.vy + AUTO_Y * auto) * f;
        const fr = Math.pow(FRICTION, f);
        s.vx *= fr;
        s.vy *= fr;
        if (Math.abs(s.vx) < 0.01) s.vx = 0;
        if (Math.abs(s.vy) < 0.01) s.vy = 0;
      }
      draw();
      const idle = (still || infoOn.current) && !s.vx && !s.vy && !s.drag;
      raf = run && !idle ? requestAnimationFrame(frame) : 0; // sleeps when nothing moves
    };
    const kick = () => {
      if (raf || !run) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };
    s.kick = kick;
    kick();

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
      io.disconnect();
      document.removeEventListener("visibilitychange", vc);
      s.kick = () => {};
    };
  }, [tiles, dims, pool]);

  // click a tile: it grows to full screen, then the project opens
  useEffect(() => {
    if (!grow) return;
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setGo(true)));
    const t = window.setTimeout(() => navigate(`/works/${grow.id}`), 700);
    return () => {
      cancelAnimationFrame(r);
      window.clearTimeout(t);
    };
  }, [grow, navigate]);

  const open = (e: RMouseEvent<HTMLAnchorElement>, id: string, src: string) => {
    if (st.current.moved > 10) {
      e.preventDefault(); // it was a drag, not a click
      return;
    }
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return; // the link just opens
    e.preventDefault();
    const r = e.currentTarget.getBoundingClientRect();
    setGrow({ id, src, l: r.left, t: r.top, w: r.width, h: r.height });
  };

  const down = (e: RPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const s = st.current;
    s.drag = true;
    s.lx = e.clientX;
    s.ly = e.clientY;
    s.moved = 0;
    s.vx = 0;
    s.vy = 0;
    s.t = performance.now();
    stage.current?.classList.add("is-drag");
    s.kick();
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - s.lx;
      const dy = ev.clientY - s.ly;
      s.lx = ev.clientX;
      s.ly = ev.clientY;
      s.moved += Math.abs(dx) + Math.abs(dy);
      s.x -= dx; // the collage follows the finger
      s.y -= dy;
      s.vx = clamp(-dx, -60, 60); // and keeps gliding after you let go
      s.vy = clamp(-dy, -60, 60);
      s.t = performance.now();
    };
    const up = () => {
      s.drag = false;
      if (performance.now() - s.t > 80) {
        s.vx = 0;
        s.vy = 0;
      }
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
  const wheel = (e: RWheelEvent<HTMLDivElement>) => {
    const s = st.current;
    s.vx = clamp(s.vx + e.deltaX * 0.08, -40, 40);
    s.vy = clamp(s.vy + e.deltaY * 0.08, -40, 40);
    s.kick();
  };
  const key = (e: RKeyEvent<HTMLDivElement>) => {
    const s = st.current;
    if (e.key === "ArrowRight") s.vx += 14;
    else if (e.key === "ArrowLeft") s.vx -= 14;
    else if (e.key === "ArrowDown") s.vy += 14;
    else if (e.key === "ArrowUp") s.vy -= 14;
    else return;
    s.kick();
  };

  return (
    <div
      className="drift"
      ref={stage}
      tabIndex={0}
      role="group"
      aria-label="Project collage. Drag, scroll or use the arrow keys to explore"
      onPointerDown={down}
      onWheel={wheel}
      onKeyDown={key}
    >
      {tiles.map((t, i) => {
        const pj = pool[t.p];
        const front = i === center; // only the card in front shows the details
        return (
          <div
            key={i}
            className="drift__tile"
            style={{ width: t.w, height: t.h, "--dim": (0.4 + clamp((1.4 - t.d) / 0.8, 0, 1) * 0.4).toFixed(2) } as CSSProperties}
          >
            <Link
              to={`/works/${pj.id}`}
              className="drift__link"
              aria-label={pj.name}
              tabIndex={firstOf[i] ? undefined : -1}
              draggable={false}
              onClick={(e) => open(e, pj.id, t.src)}
            >
              <picture>
  <source type="image/avif" srcSet={srcSet(t.src, "avif")} sizes={SIZES} />
  <source type="image/webp" srcSet={srcSet(t.src, "webp")} sizes={SIZES} />
  <img src={t.src} alt="" loading="lazy" decoding="async" draggable={false} />
</picture>
            </Link>

            {front && (
              <div className="drift__label work__label" onPointerDown={(e) => e.stopPropagation()}>
                {info && (
                  <div className="work__info" id="drift-info">
                    <p>{pj.blurb}</p>
                  </div>
                )}
                {pj.deliverables && <p className="work__cat">{pj.deliverables}</p>}
                <h2 className="work__name">
                  <Link to={`/works/${pj.id}`}>{pj.name}</Link>
                </h2>
                <div className="work__links">
                  <InfoButton open={info} controls="drift-info" onClick={() => setInfo((v) => !v)} />
                  {pj.link && (
                    <a className="work__chip" href={pj.link} target="_blank" rel="noreferrer">
                      <span>{host(pj.link)}</span>
                      <Arrow />
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {grow && (
        <div
          className={"drift__grow" + (go ? " is-go" : "")}
          style={{ "--gl": `${grow.l}px`, "--gt": `${grow.t}px`, "--gw": `${grow.w}px`, "--gh": `${grow.h}px` } as CSSProperties}
        >
          <picture>
  <source type="image/avif" srcSet={srcSet(grow.src, "avif")} sizes={SIZES} />
  <source type="image/webp" srcSet={srcSet(grow.src, "webp")} sizes={SIZES} />
  <img src={grow.src} alt="" />
</picture>
        </div>
      )}
    </div>
  );
}