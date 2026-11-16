import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import "./SideQuests.css";
import InfoButton from "./InfoButton";
import { AltView } from "./SideQuestsViews";

type Category = "Tools" | "Mobile apps" | "Creative" | "Game";
export type Project = { id: string; name: string; category: Category; tags: string[]; images: string[] };

const TABS = ["All", "Tools", "Mobile apps", "Creative", "Game"] as const;
type Tab = (typeof TABS)[number];

const VIEWS = ["Grid", "Zoom"] as const; // add new showcase styles here
type View = (typeof VIEWS)[number];
type Bp = "phone" | "tablet" | "desktop";
const getBp = (): Bp => (window.innerWidth <= 700 ? "phone" : window.innerWidth <= 1100 ? "tablet" : "desktop");
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
const srcSet = (src: string) => [240, 360, 480].map((w) => `${sized(src, w)} ${w}w`).join(", ");
const SIZES = "(max-width: 700px) 34vw, (max-width: 1100px) 26vw, 17vw"; // phones no longer download desktop-sized photos

// TODO: your projects. Order here = order on the page. Each project's images stay together as one block
const PROJECTS: Project[] = [
  { id: "bezel-studio", name: "Bezel Studio", category: "Tools", tags: ["Parallax", "Grid", "Creative"], images: photos(0, 8) },
  { id: "orbit", name: "Orbit", category: "Mobile apps", tags: ["iOS", "Prototype"], images: photos(2, 6) },
  { id: "fieldnotes", name: "Fieldnotes", category: "Creative", tags: ["Illustration", "Print"], images: photos(4, 7) },
  { id: "tetris-rain", name: "Tetris Rain", category: "Game", tags: ["Canvas", "Sound"], images: photos(1, 5) },
  { id: "palette-lab", name: "Palette Lab", category: "Tools", tags: ["Colour", "Plugin"], images: photos(3, 6) },
];
// the Archive page: the same tile field with two blocks of images, no filters or labels
const ARCHIVE: Project[] = [0, 3].map((s, i) => ({
  id: "archive-" + i,
  name: `Archive ${i + 1}`,
  category: "Creative" as const,
  tags: [],
  images: photos(s, 8),
}));

const AR = [2 / 3, 1, 1.5, 1, 2 / 3]; // starting ratios, each image then snaps to its own (2:3, 1:1 or 3:2) once it loads

const RATIOS = [2 / 3, 1, 1.5]; // 2:3, 1:1, 3:2
// picks the closest of the three ratios for any image
const snap = (w: number, h: number) => {
  const r = w / h;
  return RATIOS.reduce((a, b) => (Math.abs(Math.log(r / b)) < Math.abs(Math.log(r / a)) ? b : a));
};

type Item = { src: string; alt: string; p: number; x: number; y: number; ar: number; n?: number };

// Grid: masonry columns, every tile keeps its own ratio.
// x = column index, y = tile centre in column widths, n = how many 4px gaps sit above it
function buildGrid(list: Project[], bp: Bp, ratios: Map<string, number>) {
  const cols = bp === "phone" ? 3 : bp === "tablet" ? 4 : 6;
  const GAP_U = 0.015; // about 4px in column widths, only used to compare column heights
  const colU = new Array<number>(cols).fill(0);
  const colN = new Array<number>(cols).fill(0);
  const key = (c: number) => colU[c] + colN[c] * GAP_U;
  const items: Item[] = [];
  let g = 0;
  list.forEach((pr, p) => {
    let t = 0; // every project starts below the tallest column
    for (let c = 1; c < cols; c++) if (key(c) > key(t)) t = c;
    colU.fill(colU[t]);
    colN.fill(colN[t]);
    pr.images.forEach((src) => {
      let c = 0; // each image goes in the shortest column
      for (let q = 1; q < cols; q++) if (key(q) < key(c)) c = q;
      const ar = ratios.get(src) ?? AR[g % AR.length];
      items.push({ src, alt: pr.name, p, x: c, y: colU[c] + 0.5 / ar, n: colN[c], ar });
      colU[c] += 1 / ar;
      colN[c]++;
      g++;
    });
  });
  let t = 0;
  for (let c = 1; c < cols; c++) if (key(c) > key(t)) t = c;
  return { items, count: list.length, total: colU[t], cols, gaps: colN[t] };
}

// one entry point for every style. New styles get a branch here
function build(list: Project[], _view: View, bp: Bp, ratios: Map<string, number>) {
  return buildGrid(list, bp, ratios);
}

// page y (px) of a tile's centre, mirrors the CSS of each style. New styles get a branch here too
function tileY(it: Item, view: View, W: number, _H: number, cols: number) {
  if (view === "Grid") return TOP + it.y * ((W - 4 * (cols - 1)) / cols) + (it.n ?? 0) * 4;
  return TOP + it.y * (W / cols);
}

export default function SideQuests({ archive = false }: { archive?: boolean }) {
  const [tab, setTab] = useState<Tab>("All");
  const [active, setActive] = useState(0); // the project whose name is shown
  const [view, setView] = useState<View>("Grid");
  const [morph, setMorph] = useState(false); // true while the tiles glide to their new spots
  const [info, setInfo] = useState(false);
  const [bp, setBp] = useState<Bp>(getBp);
  const fieldRef = useRef<HTMLDivElement>(null);
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
  const layout = useMemo(() => build(list, view, bp, ratios.current), [list, view, bp, ver]);

  const pick = (v: View) => {
    if (v === view) return;
    if (v !== "Grid" || view !== "Grid") {
      anchor.current = null; // Zoom has no scroll position to keep
      window.scrollTo(0, 0);
      setView(v);
      return;
    }
    // remember which image is in the middle of the screen, the new style opens on the same one
    const mid = window.scrollY + window.innerHeight / 2;
    let best = 0;
    let bd = Infinity;
    layout.items.forEach((it, i) => {
      const d = Math.abs(tileY(it, view, window.innerWidth, window.innerHeight, layout.cols) - mid);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    anchor.current = best % list.reduce((n, pr) => n + pr.images.length, 0);
    setView(v);
    setMorph(true);
  };

  // a new tab starts again from the top
  useEffect(() => {
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
        key={tab}
        ref={fieldRef}
        style={{ "--h": layout.total, "--cols": layout.cols, "--hn": layout.gaps } as CSSProperties}
      >
        {layout.items.map((it, i) => (
          <figure
            className="sq__tile"
            key={i}
            style={{ "--x": it.x, "--y": it.y, "--ar": it.ar, "--n": it.n ?? 0 } as CSSProperties}
          >
            <img
              src={it.src}
              srcSet={srcSet(it.src)}
              sizes={SIZES}
              alt={it.alt}
              draggable={false}
              decoding="async"
              loading={i < 6 ? "eager" : "lazy"}
              fetchPriority={i < 3 ? "high" : "auto"}
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
        ))}
      </div>
    ),
    [layout, tab, view, morph]
  );

  const project = list[active] ?? list[0];

  // each list is drawn twice: once in the blended label strip, once in a plain layer on top that only shows the active chip
  const tabsList = (solid: boolean) => (
    <ul className="sq__tabs" aria-label={solid ? undefined : "Filter projects"}>
      {TABS.map((t) => (
        <li key={t}>
          <button
            type="button"
            className={"sq__tab" + (t === tab ? " is-on" : "")}
            aria-pressed={t === tab}
            tabIndex={solid ? -1 : undefined}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        </li>
      ))}
    </ul>
  );
  const viewsList = (solid: boolean) => (
    <ul className="sq__tags" aria-label={solid ? undefined : "Showcase style"}>
      {VIEWS.map((v) => (
        <li key={v}>
          <button
            type="button"
            className={"sq__tab" + (v === view ? " is-on" : "")}
            aria-pressed={v === view}
            tabIndex={solid ? -1 : undefined}
            onClick={() => pick(v)}
          >
            {v}
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <main
      className={"sq" + (archive ? " sq--archive" : "") + (view === "Zoom" ? " sq--zoom" : "")}
      style={{ "--top": `${TOP}px` } as CSSProperties}
    >
      {view === "Grid" ? field : <AltView key={tab} view={view} list={list} ratios={ratios.current} onActive={setActive} />}

      <div className="sq__ui">
        {tabsList(false)}

        {project && (
          <>
            <p className="sq__name" key={project.id}>
              <span>{project.name}</span> <span className="sq__muted">{project.category}</span>
            </p>
            {info && (
              <ul className="sq__panel" id="sq-info-panel" key={"info-" + project.id}>
                {project.tags.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            )}
          </>
        )}

        {viewsList(false)}
      </div>

      <div className="sq__solid" aria-hidden="true">
        {tabsList(true)}
        {viewsList(true)}
      </div>

      <InfoButton className="sq__info" open={info} controls="sq-info-panel" onClick={() => setInfo((v) => !v)} />
    </main>
  );
}