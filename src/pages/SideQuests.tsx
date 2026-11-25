import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, MouseEvent } from "react";
import "./SideQuests.css";
import InfoButton from "./InfoButton";
import { useSpringIn } from "./useSpringIn";
import { AltView, captureTiles, playFlip } from "./SideQuestsViews";
import Lightbox from "./Lightbox";
import useScrollWarp, { warpPulse, clearAllSlices, warpState, BEND_X, BEND_X_GRID } from "./useScrollWarp";

type Category = "Tools" | "Mobile Apps" | "Creative" | "Game";
export type Project = { id: string; name: string; category: Category; description?: string; tags: string[]; images: string[] };

const TABS = ["All", "Tools", "Mobile Apps", "Creative", "Game"] as const;
type Tab = (typeof TABS)[number];

const VIEWS = ["Grid", "Snap", "List"] as const; // add new showcase styles here
type View = (typeof VIEWS)[number];
type Bp = "phone" | "tablet" | "desktop";
const getBp = (): Bp => (window.innerWidth <= 700 ? "phone" : window.innerWidth <= 1100 ? "tablet" : "desktop");
const ZOOMS: Record<Bp, number[]> = { phone: [4, 3, 2], tablet: [12, 9, 6, 4], desktop: [12, 9, 6, 4] }; // columns per zoom step, zoomed out to zoomed in
const ZOOM_DEFAULT: Record<Bp, number> = { phone: 1, tablet: 0, desktop: 0 }; // phone opens on 3, tablet and desktop on 12
const MORPH = 900; // ms, how long tiles glide when the style changes (keep in sync with the CSS)
const NAV_H = 50; // px, height of the site nav including the hanging tab; tweak if it differs
const TOP = NAV_H + 40; // the thumbnails start 40px below the nav

// placeholder photos (the same Unsplash ones as the Archive page), swap for your project images
const PHOTO_IDS = [
  "1634671459608-2f449da23a5e",
  "1541908328660-db3f2c9ee652",
  "1615269258407-02af965f7ef6",
  "1638317875669-719f70b4c27c",
  "1568230940446-77e19e3a9fac",
  "1649289787452-2bac003a4096",
  "1647580424745-f418ac9adfe8",
];
const BACKUP = [64, 1005, 1011, 1027, 91, 177, 338]; // Picsum IDs, used only if an Unsplash link fails
const photos = (start: number, n: number) =>
  Array.from(
    { length: n },
    (_, i) => `https://images.unsplash.com/photo-${PHOTO_IDS[(start + i) % PHOTO_IDS.length]}?auto=format&fit=crop&w=480&q=60`
  );
const sized = (src: string, w: number) => src.replace("w=480", `w=${w}`);
const srcSet = (src: string) => [240, 360, 480, 720, 1080].map((w) => `${sized(src, w)} ${w}w`).join(", ");
const sizesFor = (span = 1, cols = 6) => `${Math.round((span * 100) / cols)}vw`; // a tile is one column wide, a landscape tile two

// TODO: your projects. Order here = order on the page. Each project's images stay together as one block
const PROJECTS: Project[] = [
  { id: "bezel-studio", name: "Bezel Studio", category: "Tools", description: "A tool for shaping device bezels and mockups, built in Framer.", tags: ["Parallax", "Grid", "Creative"], images: photos(0, 8) },
  { id: "orbit", name: "Orbit", category: "Mobile Apps", description: "An iOS prototype for tracking habits with a calm, orbit-style interface.", tags: ["iOS", "Prototype"], images: photos(2, 6) },
  { id: "fieldnotes", name: "Fieldnotes", category: "Creative", description: "Illustrated notes from walks and trips, collected as a small print series.", tags: ["Illustration", "Print"], images: photos(4, 7) },
  { id: "tetris-rain", name: "Tetris Rain", category: "Game", description: "A browser game where tetrominoes fall like rain, with a sound track.", tags: ["Canvas", "Sound"], images: photos(1, 5) },
  { id: "palette-lab", name: "Palette Lab", category: "Tools", description: "A plugin for building and testing colour palettes straight in your design tool.", tags: ["Colour", "Plugin"], images: photos(3, 6) },
];
// the Archive page: the same tile field with two blocks of images, no filters or labels
const ARCHIVE: Project[] = [0, 3].map((s, i) => ({
  id: "archive-" + i,
  name: `Archive ${i + 1}`,
  category: "Creative" as const,
  tags: ["Archive", "Photography"], // swap for your real tags
  images: photos(s, 8),
}));

// TODO: replace with your own copy
const INTRO = "Side projects and experiments I make outside client work: small tools, apps, prints and games.";
const ARCHIVE_INTRO = "A running archive of photos and visuals that didn't fit anywhere else.";

const RATIOS = [2 / 3, 1, 1.5]; // 2:3, 1:1, 3:2
// picks the closest of the three ratios for any image
const snap = (w: number, h: number) => {
  const r = w / h;
  return RATIOS.reduce((a, b) => (Math.abs(Math.log(r / b)) < Math.abs(Math.log(r / a)) ? b : a));
};

type Item = { src: string; alt: string; p: number; k?: number; x: number; y: number; ar: number; n?: number; s?: number };

// Grid: 3 columns, laid out in rows. P = portrait (1 cell), L = landscape (2 cells wide), . = an empty cell.
// x = column, y = row centre (in rows), s = how many cells wide
const BANDS3 = ["LP", "P.P", ".L", "PP.", "P.P", "L."]; // each row adds up to 3 cells
// any column count: rows are built from the 3-cell patterns, an L that would run off the edge becomes a P
function rowFor(cols: number, bi: number) {
  let row = "";
  let cells = 0;
  for (let j = 0; cells < cols; j++) {
    for (const ch of BANDS3[(bi + j * 2) % BANDS3.length]) {
      if (cells >= cols) break;
      const w = ch === "L" ? 2 : 1;
      if (cells + w > cols) {
        row += "P";
        cells++;
      } else {
        row += ch;
        cells += w;
      }
    }
  }
  return row;
}
function buildGrid(list: Project[], cols: number, _ratios: Map<string, number>) {
  const items: Item[] = [];
  let r = 0;
  list.forEach((pr, p) => {
    let bi = p * 2; // every project opens on a fresh row, each with its own pattern offset
    while (rowFor(cols, bi)[0] === ".") bi++; // and never with an empty cell
    let k = 0; // the image's number inside its project
    while (k < pr.images.length) {
      let c = 0;
      for (const ch of rowFor(cols, bi++)) {
        if (ch === ".") {
          c++;
          continue;
        }
        if (k >= pr.images.length) break;
        const s = ch === "L" ? 2 : 1;
        items.push({ src: pr.images[k], alt: pr.name, p, k, x: c, y: r + 0.5, ar: s / 1.25, n: 0, s });
        k++;
        c += s;
      }
      r++;
    }
  });
  return { items, count: list.length, total: r, cols, gaps: 0 };
}

// one entry point for every style. New styles get a branch here
function build(list: Project[], _view: View, _bp: Bp, ratios: Map<string, number>, cols: number) {
  return buildGrid(list, cols, ratios);
}

// page y (px) of a tile's centre, mirrors the CSS of each style. New styles get a branch here too
function tileY(it: Item, view: View, W: number, _H: number, cols: number) {
  if (view === "Grid") return TOP + it.y * (W / cols) * 1.25;
  return TOP + it.y * (W / cols);
}

export default function SideQuests({ archive = false }: { archive?: boolean }) {
  useScrollWarp();
  const [tab, setTab] = useState<Tab>("All");
  const [active, setActive] = useState(0); // the project whose name is shown
  const VIEW_KEY = "sq-view" + (archive ? "-archive" : ""); // each page remembers its own view
  const [view, setView] = useState<View>(() => {
    try {
      const v = sessionStorage.getItem(VIEW_KEY);
      return (VIEWS as readonly string[]).includes(v ?? "") ? (v as View) : "Grid";
    } catch {
      return "Grid";
    }
  });
  const [zoom, setZoom] = useState(() => ZOOM_DEFAULT[getBp()]); // index into ZOOMS, higher = bigger tiles
  const [morph, setMorph] = useState(false); // true while the tiles glide to their new spots
  const [info, setInfo] = useState(false);
  const [catOpen, setCatOpen] = useState(false); // category list, collapsed by default
  const [viewOpen, setViewOpen] = useState(false); // style list, collapsed by default
  const [lb, setLb] = useState<{ p: number; i: number; rect: DOMRect | null } | null>(null); // the open slideshow: project, image, where the thumbnail was
  const catRef = useRef<HTMLUListElement>(null);
  const viewRef = useRef<HTMLUListElement>(null);
  useSpringIn(catOpen, catRef);
  useSpringIn(viewOpen, viewRef);
  const [bp, setBp] = useState<Bp>(getBp);
  const fieldRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const anchor = useRef<number | null>(null); // the image in the middle of the screen when the style changes
  const ratios = useRef(new Map<string, number>()); // each image's snapped ratio, filled in as the images load
  const [ver, setVer] = useState(0); // bumps when a new ratio is learned, so the layout re-flows
  const bumpTimer = useRef(0);
  const bump = () => {
    window.clearTimeout(bumpTimer.current);
    bumpTimer.current = window.setTimeout(() => setVer((v) => v + 1), 150);
  };

  // learn every ratio when the browser is idle, from 48px copies, so other styles are ready when you switch
  useEffect(() => {
    if ((navigator as any).connection?.saveData) return; // images still snap to their ratio as they load
    const run = () => {
      new Set((archive ? ARCHIVE : PROJECTS).flatMap((p) => p.images)).forEach((src) => {
        if (ratios.current.has(src)) return;
        const im = new Image();
        im.decoding = "async";
        im.onload = () => {
          ratios.current.set(src, snap(im.naturalWidth, im.naturalHeight));
          bump();
        };
        im.src = sized(src, 48);
      });
    };
    const w = window as any;
    const id = w.requestIdleCallback ? w.requestIdleCallback(run, { timeout: 1500 }) : window.setTimeout(run, 400);
    return () => {
      if (w.requestIdleCallback) w.cancelIdleCallback(id);
      else window.clearTimeout(id);
      window.clearTimeout(bumpTimer.current);
    };
  }, [archive]);

  useEffect(() => {
    const mqs = [window.matchMedia("(max-width: 700px)"), window.matchMedia("(max-width: 1100px)")];
    const on = () => setBp(getBp());
    mqs.forEach((m) => m.addEventListener("change", on));
    return () => mqs.forEach((m) => m.removeEventListener("change", on));
  }, []);

  useEffect(() => {
    if (!morph) return;
    const t = setTimeout(() => setMorph(false), MORPH + 100);
    return () => clearTimeout(t);
  }, [morph]);

  const list = useMemo(
    () => (archive ? ARCHIVE : tab === "All" ? PROJECTS : PROJECTS.filter((p) => p.category === tab)),
    [tab, archive]
  );
  const cols = ZOOMS[bp][zoom];
  const layout = useMemo(() => build(list, view, bp, ratios.current, cols), [list, view, bp, cols, ver]);

  // clicking any thumbnail in any view opens the slideshow on that image (tiles carry data-id="projectId:imageIndex")
  const openShow = (e: MouseEvent<HTMLElement>) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-id]");
    if (!el) return;
    const id = el.dataset.id!;
    const at = id.lastIndexOf(":");
    const p = list.findIndex((pr) => pr.id === id.slice(0, at));
    const i = Number(id.slice(at + 1));
    if (p < 0 || !(i >= 0)) return;
    setLb({ p, i, rect: (el.querySelector("img") ?? el).getBoundingClientRect() });
  };

  const pick = (v: View) => {
    if (v === view) return;
    clearAllSlices(mainRef.current); // the bent slices belong to the old tiles
    captureTiles(mainRef.current); // remember where every thumbnail is, before the page jumps to the top
    anchor.current = null;
    window.scrollTo(0, 0);
    setView(v);
    try {
      sessionStorage.setItem(VIEW_KEY, v);
    } catch {}
  };

  // zoom: fewer columns = bigger tiles. The image in the middle of the screen stays in the middle
  const zoomBy = (d: number) => {
    const z = Math.min(ZOOMS[bp].length - 1, Math.max(0, zoom + d));
    if (z === zoom) return;
    const el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2)?.closest<HTMLElement>("[data-id]");
    const at = layout.items.findIndex((it) => `${list[it.p].id}:${it.k}` === el?.dataset.id);
    captureTiles(mainRef.current); // remember where every thumbnail is, so they glide to their new cells
    anchor.current = Math.max(0, at);
    setZoom(z);
  };

  const pickTab = (t: Tab) => {
    if (t === tab) return;
    clearAllSlices(mainRef.current);
    captureTiles(mainRef.current, true); // remember where every thumbnail is (and keep copies), before the page jumps to the top
    anchor.current = null;
    window.scrollTo(0, 0);
    setTab(t);
  };

  // Grid curves at the left and right edges as much as at the top and bottom
  useLayoutEffect(() => {
    warpState.side = view === "Grid" ? BEND_X_GRID : BEND_X;
    return () => {
      warpState.side = BEND_X;
    };
  }, [view]);

  // arriving in Grid: the thumbnails fly in from where they were in the other view
  useLayoutEffect(() => {
    const f = fieldRef.current;
    if (view !== "Grid" || !f) return;
    f.style.setProperty("--cw", `${f.clientWidth / layout.cols}px`); // exact column width, so the measurement is final
    const zoomed = anchor.current !== null; // a zoom: put the middle image back in the middle before the flight is measured
    if (zoomed) {
      const it = layout.items[anchor.current! % layout.items.length];
      const y = f.getBoundingClientRect().top + window.scrollY + tileY(it, view, window.innerWidth, window.innerHeight, layout.cols) - window.innerHeight / 2;
      anchor.current = null;
      window.scrollTo({ top: Math.max(0, y), behavior: "instant" as ScrollBehavior });
    }
    playFlip(f);
    if (zoomed) warpPulse(0.6); // the surface bulges while the tiles glide
  }, [view, tab, cols]); // eslint-disable-line react-hooks/exhaustive-deps

    // line both lists up with the active nav tab's real edges, at any window width
  useEffect(() => {
    const main = mainRef.current;
    const tab = document.querySelector<HTMLElement>('.header [aria-current="page"]');
    if (!main || !tab) return; // falls back to the CSS percentages
    const set = () => {
      if (window.innerWidth <= 767) {
        main.style.removeProperty("--tl"); // phones use the screen edges from the CSS
        main.style.removeProperty("--tr");
        return;
      }
      const r = tab.getBoundingClientRect();
      if (!r.width) return; // the nav is hidden, keep the CSS values
      main.style.setProperty("--tl", `${r.left}px`);
      main.style.setProperty("--tr", `${r.right}px`);
    };
    let raf = 0;
    const onResize = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        set();
      });
    };
    set();
    const ro = new ResizeObserver(onResize);
    ro.observe(tab);
    window.addEventListener("resize", onResize, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, [archive]);

  // the browser must not restore an old scroll position on reload, the page always opens at the top
  useLayoutEffect(() => {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    return () => {
      if ("scrollRestoration" in history) history.scrollRestoration = "auto"; // other pages keep the normal behaviour
    };
  }, []);

  // a new tab starts again from the top (before the first paint, so nothing jumps on screen)
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    setActive(0);
  }, [tab]);

  // the project name follows the block that has reached the middle of the screen. No per-frame work on the tiles
  useEffect(() => {
    const field = fieldRef.current;
    if (!field || layout.items.length === 0) return;
    if (anchor.current !== null) {
      const it = layout.items[anchor.current % layout.items.length];
      const y =
        field.getBoundingClientRect().top + window.scrollY +
        tileY(it, view, window.innerWidth, window.innerHeight, layout.cols) - window.innerHeight / 2;
      anchor.current = null;
      window.scrollTo({ top: Math.max(0, y), behavior: "instant" as ScrollBehavior });
    }

    const els = Array.from(field.querySelectorAll<HTMLElement>(".sq__tile"));
    const grp = layout.items.map((it) => it.p);
    const n = layout.count;
    const gcy: number[] = new Array(n).fill(0); // each project's centre, in the field's space
    let top = 0;
    let H = 0;
    let raf = 0;
    let shown = 0;

    // layout reads happen here (on resize), never while scrolling
    const measure = () => {
      field.style.setProperty("--cw", `${field.clientWidth / layout.cols}px`); // exact cell width, scrollbar included
      H = window.innerHeight;
      top = field.getBoundingClientRect().top + window.scrollY;
      const sum = new Array(n).fill(0);
      const cnt = new Array(n).fill(0);
      els.forEach((el, i) => {
        sum[grp[i]] += el.offsetTop;
        cnt[grp[i]]++;
      });
      for (let p = 0; p < n; p++) gcy[p] = cnt[p] ? sum[p] / cnt[p] : 0;
    };
    const update = () => {
      const mid = window.scrollY + H / 2;
      let now = 0; // before any block has reached the middle, the first one is named
      let bestY = -Infinity;
      for (let p = 0; p < n; p++) {
        const gy = top + gcy[p];
        if (gy <= mid && gy > bestY) {
          now = p;
          bestY = gy;
        }
      }
      if (now !== shown) {
        shown = now;
        setActive(now);
      }
    };
    const onScroll = () => {
      if (!raf)
        raf = requestAnimationFrame(() => {
          raf = 0;
          update();
        });
    };
    const onResize = () => {
      measure();
      update();
    };

    measure();
    update();
    const late = setTimeout(onResize, MORPH + 80); // positions are only final once the glide ends
    const ro = new ResizeObserver(onResize);
    ro.observe(field);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      clearTimeout(late);
      ro.disconnect();
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [layout, view]);

  // memoised, so a name change never re-renders the images
  const field = useMemo(
    () => (
      <div
        className={"sq__field" + (morph ? " is-morph" : "")}
        data-view={view}
        ref={fieldRef}
        style={{ "--h": layout.total, "--cols": layout.cols, "--hn": layout.gaps } as CSSProperties}
      >
        {layout.items.map((it, i) => {
          const id = `${list[it.p].id}:${it.k}`; // the same image keeps the same tile when the category changes
          return (
          <figure
            className="sq__tile"
            data-id={id}
            key={id}
            style={{ "--x": it.x, "--y": it.y, "--ar": it.ar, "--n": it.n ?? 0, "--s": it.s ?? 1 } as CSSProperties}
          >
            <figcaption className="sq__cap" aria-hidden="true">
              {String((it.k ?? i) + 1).padStart(2, "0")}
            </figcaption>
            <img
              src={it.src}
              srcSet={srcSet(it.src)}
              sizes={sizesFor(it.s, layout.cols)}
              alt={it.alt}
              draggable={false}
              decoding="async"
              loading={i < layout.cols * 2 ? "eager" : "lazy"}
              fetchPriority={i < layout.cols ? "high" : "auto"}
              onLoad={(e) => {
                const img = e.currentTarget;
                if (!img.naturalWidth) return;
                const r = snap(img.naturalWidth, img.naturalHeight);
                const had = ratios.current.get(it.src);
                ratios.current.set(it.src, r);
                if (had !== r) bump();
                img.parentElement?.style.setProperty("--ar", String(r)); // the tile reshapes itself, no re-render
              }}
              onError={(e) => {
                const img = e.currentTarget;
                if (img.dataset.backup) return;
                img.dataset.backup = "1";
                img.removeAttribute("srcset");
                img.removeAttribute("sizes");
                img.src = `https://picsum.photos/id/${BACKUP[i % BACKUP.length]}/480/600`;
              }}
            />
          </figure>
          );
        })}
      </div>
    ),
    [layout, list, view, morph]
  );

  const project = list[active] ?? list[0];

  // each list has a header with a collapse button, the same chip as Info
  const tabsList = (
    <div className="sq__tabs">
      <InfoButton className="sq__toggle" label="Category" open={catOpen} controls="sq-cat-list" onClick={() => setCatOpen((v) => !v)} />
      {catOpen && (
        <ul className="sq__list" id="sq-cat-list" ref={catRef} aria-label="Filter projects">
          {TABS.map((t) => (
            <li key={t}>
              <button
                type="button"
                className={"sq__tab" + (t === tab ? " is-on" : "")}
                aria-pressed={t === tab}
                onClick={() => pickTab(t)}
              >
                {t}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
  const viewsList = (
    <div className="sq__tags">
      <InfoButton className="sq__toggle" label="View" open={viewOpen} controls="sq-view-list" onClick={() => setViewOpen((v) => !v)} />
      {viewOpen && (
        <ul className="sq__list" id="sq-view-list" ref={viewRef} aria-label="Showcase style">
          {VIEWS.map((v) => (
            <li key={v}>
              <button
                type="button"
                className={"sq__tab" + (v === view ? " is-on" : "")}
                aria-pressed={v === view}
                onClick={() => pick(v)}
              >
                {v}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <main
      ref={mainRef}
      className={"sq" + (archive ? " sq--archive" : "")}
      style={{ "--top": `${TOP}px` } as CSSProperties}
      onClick={openShow}
    >
      {view === "Grid" ? (
        <>
          <p className="sq__intro">{archive ? ARCHIVE_INTRO : INTRO}</p>
          {field}
        </>
      ) : (
        <AltView key={tab} view={view} list={list} ratios={ratios.current} onActive={setActive} />
      )}

      <div className="sq__ui">
        {tabsList}
        {viewsList}
        {view === "Grid" && (
          <div className="sq__zoom" role="group" aria-label="Zoom">
            <button type="button" aria-label="Zoom in" disabled={zoom >= ZOOMS[bp].length - 1} onClick={() => zoomBy(1)}>
              <svg viewBox="0 0 10 10" aria-hidden="true"><path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.2" fill="none" /></svg>
            </button>
            <button type="button" aria-label="Zoom out" disabled={zoom <= 0} onClick={() => zoomBy(-1)}>
              <svg viewBox="0 0 10 10" aria-hidden="true"><path d="M1 5h8" stroke="currentColor" strokeWidth="1.2" fill="none" /></svg>
            </button>
          </div>
        )}
      </div>

      {lb && list[lb.p] && <Lightbox list={list} start={{ p: lb.p, i: lb.i }} origin={lb.rect} onClose={() => setLb(null)} />}

      {project && view !== "List" && (
        <div className="sq__id">
          {info && (
            <ul className="sq__panel" id="sq-info-panel" key={"info-" + project.id}>
              {project.tags.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          )}
          <div className="sq__line">
            <p className="sq__name" key={project.id}>
              <span className="sq__title">{project.name}</span>
              <span className="sq__muted">{project.category}</span>
            </p>
            <InfoButton open={info} controls="sq-info-panel" onClick={() => setInfo((v) => !v)} />
          </div>
        </div>
      )}
    </main>
  );
}