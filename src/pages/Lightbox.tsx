import { useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as RPointerEvent, SyntheticEvent } from "react";
import type { Project } from "./SideQuests";
import "./Lightbox.css";
import { flushSync } from "react-dom";

type Props = { list: Project[]; start: { p: number; i: number }; origin: DOMRect | null; onClose: () => void };

const sized = (src: string, w: number) => src.replace("w=480", `w=${w}`);
const srcSet = (src: string) => [720, 1080, 1600].map((w) => `${sized(src, w)} ${w}w`).join(", ");
const pad = (v: number) => String(v).padStart(2, "0");
const EASE = "cubic-bezier(0.65, 0, 0.2, 1)";
const SLIDE = 560; // ms, keep in sync with the CSS
const SIZES = "(max-width: 700px) 100vw, 70vw";

export default function Lightbox({ list, start, origin, onClose }: Props) {
  const [at, setAt] = useState(start); // the project and the image inside it
  const [gone, setGone] = useState<{ src: string; d: number; k: number } | null>(null); // the image on its way out
  const [out, setOut] = useState(false);
  const [fade, setFade] = useState(false); // closing without a thumbnail to shrink into: the whole overlay fades instead
  const [ratios, setRatios] = useState<Record<string, number>>({}); // width / height of each image, once loaded
  const [room, setRoom] = useState({ w: 0, h: 0 }); // the space the stage offers
  const stage = useRef<HTMLDivElement>(null);
  const lastBox = useRef<{ w: number; h: number } | null>(null); // kept while the next image's ratio is unknown
  const root = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const swiped = useRef(false);
  const sx = useRef<number | null>(null);
  const flown = useRef(false);
  const first = useRef(true); // still on the image that opened the slideshow
  const dir = useRef(1); // 1 = moving forward, -1 = backward
  const lastP = useRef(start.p);
  const timer = useRef(0);
  const goneTimer = useRef(0);
  const reduce = useRef(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const fly = !!origin && !reduce.current; // the first image grows out of its thumbnail

  const proj = list[at.p] ?? list[0];
  const imgs = proj.images;
  const n = imgs.length;
  const many = list.length > 1;

  const cur = imgs[at.i];
  const ar = ratios[cur];
  let box = lastBox.current;
  if (ar && room.w && room.h) {
    const w = Math.min(room.w, room.h * ar); // as large as fits, only the aspect ratio decides
    box = { w, h: w / ar };
    lastBox.current = box;
  }

  // every change of image or project goes through here, so the old image can slide out
  const move = (next: { p: number; i: number }, d: number) => {
    first.current = false;
    flown.current = true; // the opening flight is over once you move on
    dir.current = d;
    if (!reduce.current) {
      setGone({ src: list[at.p].images[at.i], d, k: performance.now() });
      window.clearTimeout(goneTimer.current);
      goneTimer.current = window.setTimeout(() => setGone(null), SLIDE);
    }
    setAt(next);
  };
  const go = (d: number) => move({ p: at.p, i: (at.i + d + n) % n }, d);
  const jump = (k: number) => k !== at.i && move({ p: at.p, i: k }, k > at.i ? 1 : -1);
  const goProject = (d: number) => move({ p: (at.p + d + list.length) % list.length, i: 0 }, d);
  // closing: the image shrinks back into its thumbnail while the overlay fades away
  const close = () => {
    if (out) return;
    if (reduce.current) return onClose();
    const img = root.current?.querySelector<HTMLImageElement>(".lb__frame > .lb__img:not(.is-gone)");
    img?.getAnimations().forEach((a) => a.cancel()); // stop any slide or opening flight, so the image is measured in its resting place
    const t = document.querySelector<HTMLElement>(`[data-id="${CSS.escape(`${proj.id}:${at.i}`)}"]`);
    const r = (t?.querySelector("img") ?? t)?.getBoundingClientRect();
    const b = img?.getBoundingClientRect();
    const seen = !!r && r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
    setGone(null);
    setOut(true);
    if (!img || !b || !r || !seen || !b.width || !b.height) {
      setFade(true);
      timer.current = window.setTimeout(onClose, 240);
      return;
    }
    const s = Math.max(r.width / b.width, r.height / b.height);
    const dx = r.left + r.width / 2 - (b.left + b.width / 2);
    const dy = r.top + r.height / 2 - (b.top + b.height / 2);
    const ix = Math.max(0, (b.width - r.width / s) / 2);
    const iy = Math.max(0, (b.height - r.height / s) / 2);
    img.animate(
      [
        { transform: "translate(0px,0px) scale(1)", clipPath: "inset(0px 0px)" },
        { transform: `translate(${dx}px,${dy}px) scale(${s})`, clipPath: `inset(${iy}px ${ix}px)` },
      ],
      { duration: 520, easing: EASE, fill: "forwards" }
    );
    timer.current = window.setTimeout(onClose, 540);
  };
  const act = useRef({ go, close });
  act.current = { go, close };

  // keys, focus and scroll blocking (no scrollbar toggling, so the page behind never shifts)
  useEffect(() => {
    const el = root.current;
    const back = document.activeElement as HTMLElement | null;
    el?.focus();
    // the page behind can't scroll and its scrollbar is hidden. The page keeps its width, so nothing shifts under the overlay
    const html = document.documentElement;
    const pad = html.style.paddingRight;
    html.classList.add("lb-open");
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") act.current.close();
      else if (e.key === "ArrowRight") act.current.go(1);
      else if (e.key === "ArrowLeft") act.current.go(-1);
      else if (e.key === "Tab" && el) {
        const f = Array.from(el.querySelectorAll<HTMLElement>("button:not([tabindex='-1'])"));
        if (!f.length) return;
        const i = f.indexOf(document.activeElement as HTMLElement);
        if (e.shiftKey && i <= 0) {
          e.preventDefault();
          f[f.length - 1].focus();
        } else if (!e.shiftKey && i === f.length - 1) {
          e.preventDefault();
          f[0].focus();
        }
      }
    };
    const stop = (e: Event) => e.preventDefault();
    window.addEventListener("keydown", key);
    el?.addEventListener("wheel", stop, { passive: false });
    return () => {
      window.removeEventListener("keydown", key);
      el?.removeEventListener("wheel", stop);
      window.clearTimeout(timer.current);
      window.clearTimeout(goneTimer.current);
      html.classList.remove("lb-open");
      html.style.paddingRight = pad;
      back?.focus?.();
    };
  }, []);

  // the stage's size, for fitting each image by its aspect ratio
  useEffect(() => {
    const s = stage.current;
    if (!s) return;
    setRoom({ w: s.clientWidth, h: s.clientHeight });
    const ro = new ResizeObserver(([e]) => setRoom({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(s);
    return () => ro.disconnect();
  }, []);

  // the next and previous images of this project load ahead of time
  useEffect(() => {
    [1, -1].forEach((d) => {
      const s = imgs[(at.i + d + n) % n];
      const im = new Image();
      im.srcset = srcSet(s);
      im.sizes = SIZES;
      im.onload = () => {
        const r = im.naturalWidth / im.naturalHeight;
        setRatios((p) => (p[s] === r ? p : { ...p, [s]: r }));
      };
      im.src = sized(s, 1080);
      im.decode?.().catch(() => {}); // decoded before you get there, so nothing paints late
    });
  }, [at, imgs, n]);

  // the filmstrip glides so the current thumbnail stays in the middle
  useEffect(() => {
    const s = strip.current;
    const el = s?.children[at.i] as HTMLElement | undefined;
    if (!s || !el) return;
    const same = lastP.current === at.p; // a new project's strip starts in place, it does not glide
    lastP.current = at.p;
    s.scrollTo({
      left: el.offsetLeft - s.clientWidth / 2 + el.offsetWidth / 2,
      behavior: first.current || !same || reduce.current ? "auto" : "smooth",
    });
  }, [at]);

  // the opening image flies from its thumbnail to its place, cropped to the thumbnail's shape on the way
  const onLoad = (e: SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const r = img.naturalWidth / img.naturalHeight;
    const store = () => setRatios((p) => (p[cur] === r ? p : { ...p, [cur]: r }));
    if (flown.current) return store();
    flushSync(store); // the frame has its final size before the opening flight is measured
    flown.current = true;
    if (!fly || !origin) return;
    const b = img.getBoundingClientRect();
    if (!b.width || !b.height) return;
    const s = Math.max(origin.width / b.width, origin.height / b.height);
    const dx = origin.left + origin.width / 2 - (b.left + b.width / 2);
    const dy = origin.top + origin.height / 2 - (b.top + b.height / 2);
    const ix = Math.max(0, (b.width - origin.width / s) / 2);
    const iy = Math.max(0, (b.height - origin.height / s) / 2);
    img.animate(
      [
        { transform: `translate(${dx}px,${dy}px) scale(${s})`, clipPath: `inset(${iy}px ${ix}px)` },
        { transform: "translate(0px,0px) scale(1)", clipPath: "inset(0px 0px)" },
      ],
      { duration: 550, easing: EASE }
    );
  };

  const down = (e: RPointerEvent) => {
    sx.current = e.clientX;
    swiped.current = false;
  };
  const up = (e: RPointerEvent) => {
    if (sx.current === null) return;
    const dx = e.clientX - sx.current;
    sx.current = null;
    if (e.pointerType !== "mouse" && Math.abs(dx) > 45) {
      swiped.current = true; // the tap that follows a swipe must not move the slideshow again
      go(dx < 0 ? 1 : -1);
    }
  };
  const zone = (d: number) => () => {
    if (swiped.current) {
      swiped.current = false;
      return;
    }
    if (n < 2) close();
    else go(d);
  };

  const key = `${at.p}:${at.i}`;
  const arrow = { "--d": dir.current } as CSSProperties;

  return (
    <div
      className={"lb" + (out ? " is-out" : "") + (fade ? " is-fade" : "")}
      ref={root}
      role="dialog"
      aria-modal="true"
      aria-label={`${proj.name}, image ${at.i + 1} of ${n}`}
      tabIndex={-1}
      onPointerDown={down}
      onPointerUp={up}
      onPointerCancel={() => (sx.current = null)}
    >

      <button type="button" className="lb__zone lb__zone--l" tabIndex={-1} aria-label="Previous image" onClick={zone(-1)} />
      <button type="button" className="lb__zone lb__zone--r" tabIndex={-1} aria-label="Next image" onClick={zone(1)} />

      <div className="lb__top">
        <div className="lb__left">
          <p className="lb__id">
            <span className="lb__name">{proj.name}</span>
            <span className="lb__cat">{proj.category}</span>
          </p>
        </div>
        <div className="lb__right">
          <span className="lb__count" aria-hidden="true">
            {pad(at.i + 1)} / {pad(n)}
          </span>
          <button type="button" className="ibtn" onClick={close}>
            <span>Close</span>
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3.3 2.2 8 6.9l4.7-4.7 1.1 1.1L9.1 8l4.7 4.7-1.1 1.1L8 9.1l-4.7 4.7-1.1-1.1L6.9 8 2.2 3.3z" fill="currentColor" />
            </svg>
          </button>
        </div>
      </div>

      {proj.description && (
        <p className="lb__desc" key={"d-" + proj.id}>
          {proj.description}
        </p>
      )}

      <div className="lb__stage" ref={stage}>
        <div className={"lb__frame" + (first.current ? " is-still" : "")} style={box ? { width: box.w, height: box.h } : undefined}>
          {gone && (
            <img
              className="lb__img is-gone"
              key={"x-" + gone.k}
              style={{ "--d": gone.d } as CSSProperties}
              src={sized(gone.src, 1080)}
              srcSet={srcSet(gone.src)}
              sizes={SIZES}
              alt=""
              aria-hidden="true"
              draggable={false}
            />
          )}
          <img
            key={key}
            className={"lb__img" + (fly && first.current ? " is-fly" : "")}
            style={arrow}
            src={sized(imgs[at.i], 1080)}
            srcSet={srcSet(imgs[at.i])}
            sizes={SIZES}
            alt={`${proj.name}, image ${at.i + 1} of ${n}`}
            draggable={false}
            decoding="async"
            onLoad={onLoad}
          />
        </div>
      </div>

      {many && (
        <div className="lb__bottom">
          <button type="button" className="ibtn" onClick={() => goProject(-1)}>
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M14 7.2H4.6l3.6-3.6L7.1 2.5 1.6 8l5.5 5.5 1.1-1.1-3.6-3.6H14z" fill="currentColor" />
            </svg>
            <span>Previous project</span>
          </button>
          <button type="button" className="ibtn" onClick={() => goProject(1)}>
            <span>Next project</span>
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M2 7.2h9.4L7.8 3.6l1.1-1.1L14.4 8l-5.5 5.5-1.1-1.1 3.6-3.6H2z" fill="currentColor" />
            </svg>
          </button>
        </div>
      )}

      <div className="lb__strip" ref={strip} role="group" aria-label="Choose an image">
        {imgs.map((s, k) => (
          <button
            type="button"
            key={k}
            className={"lb__th" + (k === at.i ? " is-on" : "")}
            aria-label={`Image ${k + 1}`}
            aria-current={k === at.i || undefined}
            onClick={() => jump(k)}
          >
            <img src={sized(s, 240)} alt="" draggable={false} decoding="async" loading="lazy" />
          </button>
        ))}
      </div>
    </div>
  );
}