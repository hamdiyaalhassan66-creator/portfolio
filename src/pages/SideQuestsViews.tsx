import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Project } from "./SideQuests";
import "./SideQuestsViews.css";
import InfoButton from "./InfoButton";
import { warpState, bendTile, clearSlices } from "./useScrollWarp";

type Props = { list: Project[]; ratios: Map<string, number>; onActive: (p: number) => void; intro?: string };
type Img = { src: string; alt: string; p: number; k: number };

const flat = (list: Project[]): Img[] => list.flatMap((pr, p) => pr.images.map((src, k) => ({ src, alt: pr.name, p, k })));
const ratioOf = (ratios: Map<string, number>, src: string) => ratios.get(src) ?? 0.8;
const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b);

/* ---------- view switch: thumbnails fly from their old spot to their new one ---------- */
const flipStore: { from: Map<string, DOMRect> | null; ghosts: Map<string, HTMLElement> | null; ids: Set<string> | null } = { from: null, ghosts: null, ids: null };

export const captureTiles = (root: HTMLElement | null, withGhosts = false) => {
  const m = new Map<string, DOMRect>();
  const g = new Map<string, HTMLElement>();
  const all = new Set<string>(); // every tile in the old set, including the ones off screen
  root?.querySelectorAll<HTMLElement>("[data-id]").forEach((el) => {
    all.add(el.dataset.id!);
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth) {
      m.set(el.dataset.id!, r);
      if (withGhosts) g.set(el.dataset.id!, el.cloneNode(true) as HTMLElement); // kept in case this tile is not in the next set
    }
  });
  flipStore.from = m.size ? m : null;
  flipStore.ghosts = withGhosts && g.size ? g : null;
  flipStore.ids = withGhosts ? all : null;
};

export const playFlip = (root: HTMLElement, dropMode = false) => {
  const from = flipStore.from;
  const gone = flipStore.ghosts;
  const before = flipStore.ids;
  flipStore.from = null;
  flipStore.ghosts = null;
  flipStore.ids = null;
  if (!from || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  root.style.animation = "none"; // the page's own fade would hide the flight
  const H = window.innerHeight;
  const EASE = "cubic-bezier(0.65, 0, 0.2, 1)";
  const drop = dropMode && !!gone; // Snap on a category change: tiles drop out and drop in, instead of flying up or down
  const kept = new Set<string>();
  let entering = 0;
  root.querySelectorAll<HTMLElement>("[data-id]").forEach((el) => {
    kept.add(el.dataset.id!);
    const a = from.get(el.dataset.id!);
    const b = el.getBoundingClientRect();
    if (!b.width || !el.offsetWidth) return;
    el.style.animation = "none";
    if (!a) {
      const kk = b.width / el.offsetWidth;
      const W = window.innerWidth;
      if (b.bottom < 0 || b.top > H || b.right < 0 || b.left > W) return; // off screen, nothing to see
      let start: string;
      if (drop && before?.has(el.dataset.id!)) {
        // it was already in the row, just off screen: it slides in from the side it belongs on
        const dx = b.left + b.width / 2 > W / 2 ? W - b.left : -(b.left + b.width);
        start = `translate(${dx / kk}px,0px)`;
      } else if (drop) {
        start = `translate(0px,${-(b.top + b.height + 40) / kk}px)`; // a project that wasn't there before drops in from above
      } else {
        start = `translate(0px,${(H - b.top) / kk}px)`; // Grid: flies up from below
      }
      el.animate([{ transform: start }, { transform: "translate(0px,0px)" }], {
        duration: 800,
        delay: Math.min(entering++ * 30, 240),
        easing: EASE,
        composite: "add",
        fill: "backwards",
      });
      return;
    }
    const k = b.width / el.offsetWidth; // the tile's own scale (Snap draws its tiles scaled)
    const dx = (a.left + a.width / 2 - (b.left + b.width / 2)) / k;
    const dy = (a.top + a.height / 2 - (b.top + b.height / 2)) / k;
    // one scale for both axes, so the image never stretches. The leftover on the other axis is cropped
    const s = Math.max(a.width / b.width, a.height / b.height);
    const ix = Math.max(0, (b.width - a.width / s) / (2 * k));
    const iy = Math.max(0, (b.height - a.height / s) / (2 * k));
    el.animate(
      [
        { transform: `translate(${dx}px,${dy}px) scale(${s})`, clipPath: `inset(${iy}px ${ix}px)` },
        { transform: "translate(0px,0px) scale(1)", clipPath: "inset(0px 0px)" },
      ],
      { duration: 800, easing: "cubic-bezier(0.65, 0, 0.2, 1)", composite: "add" } // added on top of the tile's own position
    );
  });

  // tiles that are not in the new set: a copy of each carries on off the screen, up or down, whichever is closer
  gone?.forEach((node, id) => {
    const a = from.get(id);
    if (kept.has(id) || !a) return;
    node.removeAttribute("data-id");
    node.style.cssText = `position:fixed;left:${a.left}px;top:${a.top}px;width:${a.width}px;height:${a.height}px;margin:0;z-index:4;translate:none;transform:none;animation:none;pointer-events:none;`;
    root.appendChild(node);
    const dy = !drop && a.top + a.height / 2 < H / 2 ? -(a.top + a.height + 40) : H - a.top + 40;
    const fly = node.animate(
      [{ transform: "translate(0px,0px)" }, { transform: `translate(0px,${dy}px)` }],
      { duration: drop ? 700 : 800, easing: drop ? "cubic-bezier(0.55, 0, 0.9, 0.45)" : EASE, fill: "forwards" } // dropping speeds up like it's falling
    );
    fly.onfinish = () => node.remove();
  });
};

export function AltView({ view, ...rest }: Props & { view: string }) {
  if (view === "Snap") return <Snap {...rest} />;
  return <ListView {...rest} />;
}

/* ---------- list: one row per project. Name, category and description on the left, four thumbnails on the right ---------- */
function ListView({ list, onActive }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<string | null>(null); // the project whose info is open

  useLayoutEffect(() => {
    if (root.current) playFlip(root.current); // arriving from another view: the thumbnails fly to their place
  }, []);

  useLayoutEffect(() => {
    const el = root.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && onActive(Number((e.target as HTMLElement).dataset.p))),
      { rootMargin: "-50% 0px -50% 0px" } // the row on the middle line of the screen is the active one
    );
    el.querySelectorAll("[data-p]").forEach((r) => io.observe(r));
    return () => io.disconnect();
  }, [list, onActive]);

  return (
    <div className="sqv" ref={root}>
      <ul className="sqv-l">
        {list.map((pr, i) => (
          <li className="sqv-l__row" key={pr.id} data-p={i}>
            <div className="sqv-l__info">
              <div className="sqv-l__head">
                <h2 className="sqv-l__name">{pr.name}</h2>
                <span className="sqv-l__cat">{pr.category}</span>
                <InfoButton
                  open={open === pr.id}
                  controls={`sqv-info-${pr.id}`}
                  onClick={() => setOpen((v) => (v === pr.id ? null : pr.id))}
                />
              </div>
              {open === pr.id && pr.tags.length > 0 && (
                <ul className="sqv-l__tags" id={`sqv-info-${pr.id}`}>
                  {pr.tags.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              )}
              {pr.description && <p className="sqv-l__desc">{pr.description}</p>}
            </div>
            <div className="sqv-l__strip">
              {pr.images.slice(0, 4).map((src, k) => (
                <figure className={"sqv-l__img " + (k === 1 ? "is-p" : "is-l")} key={k} data-id={`${pr.id}:${k}`}>
                  <img
                    src={src}
                    alt={k === 0 ? pr.name : ""}
                    draggable={false}
                    decoding="async"
                    loading={i === 0 ? "eager" : "lazy"}
                    fetchPriority={i === 0 ? "high" : "low"}
                  />
                </figure>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- snap: scroll steps through the images on a dot grid. Between two images the camera pulls back to show the strip ---------- */
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

function useBox() {
  const ref = useRef<HTMLDivElement>(null);
  const [d, setD] = useState({ W: 0, H: 0 });
  useLayoutEffect(() => { // measured before the first paint, so the tiles exist the moment the view appears
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const read = () =>
      setD((p) => (p.W === el.clientWidth && Math.abs(p.H - el.clientHeight) < 60 ? p : { W: el.clientWidth, H: el.clientHeight })); // mobile browser bars don't rebuild the layout
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
  return [ref, d] as const;
}

const SLOTS = [[0, 0], [1, 1], [-1, -1], [1, -1], [-1, 1], [0, 1]]; // where each image would like to sit, in grid cells from the centre

function Snap({ list, ratios, onActive }: Props) {
  const imgs = useMemo(() => flat(list).slice(0, 24), [list]);
  const track = useRef<HTMLDivElement>(null);
  const [num, setNum] = useState(0); // the image in focus, shown in the counter
  const [stage, { W, H }] = useBox();
  const arriving = useRef(flipStore.from !== null); // true when we got here from another view

  const lay = useMemo(() => {
    if (!W || !H || !imgs.length) return null;
    const bp = W <= 700 ? 0 : W <= 1100 ? 1 : 2; // phone / tablet / desktop
    const cx = W / (bp === 0 ? 3 : 6); // same columns as the Grid view: 3 on phones, 6 elsewhere
    const cy = H / 3.4; // rows of dots: with the half-row offset, 4 rows fit on screen
    const mc = Math.max(1, Math.floor((W * [0.9, 0.8, 0.7][bp]) / cx)); // most columns a tile may cover
    const mr = Math.max(2, Math.floor((H * 0.62) / cy)); // most rows a tile may cover
    const gap = cx;
    let x = 0;
    let prev = 0;
    const items = imgs.map((im, i) => {
      const ar = ratioOf(ratios, im.src);
      let bc = 1;
      let br = 2;
      let best = Infinity;
      for (let r = 2; r <= mr; r += 2) // even row counts only, so a centred tile has its corners on dots
        for (let c = 1; c <= mc; c++) {
          const err = Math.abs(Math.log((c * cx) / (r * cy) / ar)) - 0.05 * Math.log(c * r); // close to the image's own shape, bigger wins ties
          if (err < best) {
            best = err;
            bc = c;
            br = r;
          }
        }
      const w = bc * cx;
      const h = br * cy;
      x += i ? prev / 2 + gap + w / 2 : 0;
      prev = w;
      const [px, py] = SLOTS[i % SLOTS.length];
      // spots where every corner lands on a dot: columns sit on the centre, rows sit half a row off it
      const pick = (want: number, unit: number, half: boolean, room: number) => {
        let out = 0;
        let bd = Infinity;
        for (let k = -6; k <= 6; k++) {
          const v = (k + (half ? 0.5 : 0)) * unit;
          const d = Math.abs(v - want) + (Math.abs(v) > room + 1 ? 1e6 : 0);
          if (d < bd) {
            bd = d;
            out = v;
          }
        }
        return out;
      };
      return {
        w,
        h,
        x,
        ox: pick(px * cx, cx, bc % 2 === 1, (W - w) / 2),
        oy: pick(py * cy, cy, br % 2 === 1, (H - h) / 2),
      };
    });
    const so = clamp(W / (3.4 * (3 * cx + gap)), 0.2, 0.55); // zoomed-out scale
    const L = (imgs.length - 1) * clamp(H * 1.0, 420, 900); // scroll distance of the whole pass
    return { cx, cy, items, so, L };
  }, [W, H, imgs, ratios]);

  useLayoutEffect(() => {
    const box = track.current;
    if (!box || !lay) return;
    const { items, so, L } = lay;
    const n = items.length;
    const els = Array.from(box.querySelectorAll<HTMLElement>(".sqv-g__item:not([data-slice])"));
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const shown = els.map(() => true);
    const top = box.getBoundingClientRect().top + window.scrollY;
    const goal = () => clamp((window.scrollY - top) / L, 0, 1);
    const vp = { v: 0 };
    const vo = { v: 0 };
    let C = Math.round(goal() * (n - 1)); // the camera's own position, counted in images
    let out = arriving.current ? 1 : 0; // 0 = an image in focus, 1 = pulled back to the strip. Arriving from another view starts pulled back
    let act = -1;
    let raf = 0;
    let last = 0;
    const REST = 160; // ms without scrolling before an image settles
    const FLY = 800; // ms, the length of the flight in playFlip
    // arriving: pretend the page scrolled in the future, so the camera stays pulled back until the tiles have landed, then settles
    let moved = arriving.current ? performance.now() + FLY - REST : 0;
    const landed = window.setTimeout(() => (arriving.current = false), FLY + 100);

    const draw = () => {
      const i = n > 1 ? Math.min(Math.floor(C), n - 2) : 0;
      const j = n > 1 ? i + 1 : 0;
      const f = n > 1 ? C - i : 0;
      const e = sstep(0, 1, f);
      const A = items[i];
      const B = items[j];
      const cam = A.x + (B.x - A.x) * f; // glides along the strip while you scroll
      const ox = (A.ox + (B.ox - A.ox) * e) * (1 - out);
      const oy = (A.oy + (B.oy - A.oy) * e) * (1 - out);
      const k = 1 + (so - 1) * out;
      const bend = warpState.cur > 0.004; // the scroll bend, shared with the other views
      const pad = bend ? W * 0.4 : 0; // a bent tile can reach further than its flat box
      for (let m = 0; m < n; m++) {
        const it = items[m];
        const cx = W / 2 + ox + (it.x - cam) * k;
        const on = cx + (it.w * k) / 2 > -pad && cx - (it.w * k) / 2 < W + pad;
        if (on !== shown[m]) {
          shown[m] = on;
          els[m].style.display = on ? "" : "none"; // off screen images cost nothing
        }
        if (!on) {
          clearSlices(els[m]);
          continue;
        }
        const w = it.w * k;
        const h = it.h * k;
        if (bend) {
          bendTile(els[m], cx - w / 2, H / 2 + oy - h / 2, w, h, it.w, it.h, 0, 0, warpState.cur, W, H, true);
        } else {
          clearSlices(els[m]);
          els[m].style.transformOrigin = "";
          els[m].style.transform = `translate3d(${(cx - it.w / 2).toFixed(1)}px,${(H / 2 + oy - it.h / 2).toFixed(1)}px,0) scale(${k.toFixed(3)})`;
        }
      }
      const idx = clamp(Math.round(C), 0, n - 1);
      if (idx !== act) {
        act = idx;
        onActive(imgs[idx].p);
        setNum(idx);
      }
    };

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const seg = goal() * (n - 1);
      const busy = now - moved < REST; // still scrolling
      const to = busy ? seg : Math.round(seg); // once it stops, the nearest image
      if (still) {
        C = Math.round(seg);
        out = 0;
      } else {
        C = damp(C, to, vp, 0.35, dt);
        out = damp(out, busy ? 1 : 0, vo, 0.45, dt);
      }
      const calm = !busy && Math.abs(C - to) < 1e-3 && out < 1e-3;
      if (calm) {
        C = to;
        out = 0;
        vp.v = vo.v = 0;
      }
      draw();
      raf = calm ? 0 : requestAnimationFrame(frame); // nothing runs while the page is at rest
    };
    const kick = () => {
      moved = performance.now();
      if (raf) return;
      last = moved;
      raf = requestAnimationFrame(frame);
    };

    warpState.hook = draw;
    draw();
    const entering = out > 0; // arriving from another view: tiles fly in, then the camera settles on an image
    playFlip(box, true);
    if (entering) {
      last = performance.now(); // start the loop without touching `moved`, so the camera holds
      raf = requestAnimationFrame(frame);
    }
    window.addEventListener("scroll", kick, { passive: true });
    return () => {
      window.clearTimeout(landed);
      if (warpState.hook === draw) warpState.hook = null;
      els.forEach(clearSlices);
      window.removeEventListener("scroll", kick);
      cancelAnimationFrame(raf);
    };
  }, [lay, imgs, onActive, W, H]);

  return (
    <div className="sqv-g" ref={track} style={{ height: lay ? `calc(100svh + ${lay.L}px)` : "100svh" }}>
      <div
        className="sqv-g__stage"
        ref={stage}
        role="group"
        aria-label="Snap view. Scroll to step through the images"
        style={{ "--cx": `${lay?.cx ?? 64}px`, "--cy": `${lay?.cy ?? 80}px` } as CSSProperties}
      >
        {lay &&
          imgs.map((im, i) => (
            <figure className="sqv-g__item" key={i} data-id={`${list[im.p].id}:${im.k}`} style={{ width: lay.items[i].w, height: lay.items[i].h }}>
              <img
                src={im.src}
                alt={im.alt}
                draggable={false}
                decoding="async"
                loading={i < 3 ? "eager" : "lazy"}
                fetchPriority={i < 3 ? "high" : "low"}
              />
            </figure>
          ))}
      </div>
      <span className="sqv-g__count" aria-hidden="true">
        {String(num + 1).padStart(2, "0")} / {String(imgs.length).padStart(2, "0")}
      </span>
    </div>
  );
}