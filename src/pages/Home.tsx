import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { PROJECTS, srcSet } from "./projects";
import InfoButton from "./InfoButton";
import { useSpringIn } from "./useSpringIn";
import "./Home.css";

const Drift = lazy(() => import("./Drift"));

const VIEWS = ["Strip", "Drift"] as const; // add new showcase styles here
type View = (typeof VIEWS)[number];

const host = (u: string) => u.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
// lets the browser pick the smallest file that fits: portrait cards are narrow, landscape ones are wide
const SIZES_P = "(max-width: 700px) 100vw, (max-width: 900px) 50vw, 75vh";

const Arrow = () => (
  <svg className="work__arrow" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
    <path d="M7 15 15 7M8.5 7H15v6.5" />
  </svg>
);

export default function Home() {
  const [view, setView] = useState<View>("Strip");
  const [viewsOpen, setViewsOpen] = useState(false); // style list, collapsed by default
  const viewsRef = useRef<HTMLUListElement>(null);
  useSpringIn(viewsOpen, viewsRef);
  const [active, setActive] = useState<string | null>(null); // the hovered project cycles through its images
  const track = useRef<HTMLElement>(null); // the page-tall area the strip slides through
  const stage = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLDivElement>(null);

  const pick = (v: View) => {
    if (v === view) return;
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }); // each style starts at the top
    setActive(null);
    setView(v);
  };

  // the page scrolls down as usual and the strip slides sideways with it (the page is as tall as the strip is long)
  useEffect(() => {
    if (view !== "Strip") return; // Drift has its own motion
    const main = track.current;
    const box = stage.current;
    const el = strip.current;
    if (!main || !box || !el) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let travel = 0; // how far the strip has to slide
    let start = 0; // page scroll position where the sliding begins
    let cur = 0;
    let raf = 0;

    const render = () => {
      el.style.transform = travel ? `translate3d(${Math.round(-cur)}px,0,0)` : "";
    };
    const measure = () => {
      if (window.innerWidth <= 900) {
        travel = 0; // phones stack the panels and scroll down
      } else {
        el.style.transform = "";
        travel = Math.max(0, el.scrollWidth - box.clientWidth);
      }
      main.style.setProperty("--travel", `${travel}px`);
      const bar = parseFloat(getComputedStyle(box).top) || 0;
      start = main.getBoundingClientRect().top + window.scrollY - bar;
      cur = Math.min(Math.max(window.scrollY - start, 0), travel);
      render();
    };
    const frame = () => {
      const target = Math.min(Math.max(window.scrollY - start, 0), travel);
      cur += (target - cur) * (still ? 1 : 0.14);
      if (Math.abs(target - cur) < 0.3) cur = target;
      render();
      raf = cur === target ? 0 : requestAnimationFrame(frame); // sleeps when nothing is moving
    };
    const onScroll = () => {
      if (!travel || raf) return; // stacked layout: nothing slides, so nothing to do
      raf = requestAnimationFrame(frame);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    let rz = 0;
    let lastW = window.innerWidth;
    const onResize = () => {
      if (window.innerWidth === lastW) return; // address bar show/hide only changes the height
      lastW = window.innerWidth;
      cancelAnimationFrame(rz);
      rz = requestAnimationFrame(measure);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(raf);
      cancelAnimationFrame(rz);
    };
  }, [view]);

  // header with a collapse button, the same chip as Info
  const viewsList = (
    <div className="works__views">
      <InfoButton className="works__toggle" label="View" open={viewsOpen} controls="works-views-list" onClick={() => setViewsOpen((v) => !v)} />
      {viewsOpen && (
        <ul className="works__list" id="works-views-list" ref={viewsRef} aria-label="Showcase style">
          {VIEWS.map((v) => (
            <li key={v}>
              <button
                type="button"
                className={"works__view" + (v === view ? " is-on" : "")}
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
    <main className="works" data-view={view} ref={track}>
      {view === "Strip" ? (
        <div className="works__stage" ref={stage}>

          <div className="works__strip" ref={strip}>
            {PROJECTS.map((p, n) => {
              const url = p.link; // the live site, the chip is hidden when a project has none
              const hovered = active === p.id;
              const still = p.thumbnail ?? p.images[0]; // the thumbnail, or the first image if none is set
              const imgs = still ? [still] : [];
              return (
                <article
                  key={p.id}
                  className="work"
                  onPointerEnter={(e) => e.pointerType === "mouse" && setActive(p.id)}
                  onPointerLeave={() => setActive(null)}
                >
                  <div className="work__media" aria-hidden="true">
                    {imgs.map((src) => (
                      <picture key={src}>
                        <source type="image/avif" srcSet={srcSet(src, "avif")} sizes={SIZES_P} />
                        <source type="image/webp" srcSet={srcSet(src, "webp")} sizes={SIZES_P} />
                        <img
                          src={src}
                          alt=""
                          className="work__shot is-on"
                          loading={n < 2 ? "eager" : "lazy"}
                          fetchPriority={n === 0 ? "high" : "auto"}
                          decoding="async"
                          draggable={false}
                        />
                      </picture>
                    ))}
                    {hovered && p.video && (
                      <video className="work__video" src={p.video} autoPlay muted loop playsInline preload="auto" />
                    )}
                    </div>

                  <Link to={`/works/${p.id}`} className="work__cover" tabIndex={-1} aria-hidden="true" />

                  <div className="work__label">
                    {p.deliverables && <p className="work__cat">{p.deliverables}</p>}
                    <h2 className="work__name">
                      <Link to={`/works/${p.id}`}>{p.name}</Link>
                    </h2>
                    <div className="work__links">
                      <Link to={`/works/${p.id}`} className="ibtn">
                        <span>View Project</span>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <path d="M5 11 11 5M6 5h5v5" />
                        </svg>
                      </Link>
                      {url && (
                        <a className="work__chip" href={url} target="_blank" rel="noreferrer">
                          <span>{host(url)}</span>
                          <Arrow />
                        </a>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      ) : (
        <Suspense fallback={null}>
  <Drift />
</Suspense>
      )}
      <div className="works__ui">{viewsList}</div>
    </main>
  );
}