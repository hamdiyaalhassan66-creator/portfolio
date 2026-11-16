import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { PROJECTS, SLIDE_MS, srcSet } from "./projects";
import InfoButton from "./InfoButton";
import "./Home.css";

const Drift = lazy(() => import("./Drift"));
const Flow = lazy(() => import("./Flow"));

const VIEWS = ["Strip", "Drift", "Flow"] as const; // add new showcase styles here
type View = (typeof VIEWS)[number];

const plain = (t: string) => !/^\d{4}$/.test(t) && t.toLowerCase() !== "framer"; // drops the year and Framer tags
const host = (u: string) => u.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
const SIZES = "(max-width: 700px) 100vw, (max-width: 900px) 50vw, 75vh"; // lets the browser pick the smallest file that fits

const Arrow = () => (
  <svg className="work__arrow" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
    <path d="M7 15 15 7M8.5 7H15v6.5" />
  </svg>
);

export default function Home() {
  const [view, setView] = useState<View>("Strip");
  const [active, setActive] = useState<string | null>(null); // the hovered project cycles through its images
  const [tick, setTick] = useState(0);
  const [open, setOpen] = useState<string | null>(null); // the project whose Info panel is open
  const track = useRef<HTMLElement>(null); // the page-tall area the strip slides through
  const stage = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLDivElement>(null);

  const pick = (v: View) => {
    if (v === view) return;
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }); // each style starts at the top
    setActive(null);
    setView(v);
  };

  // the slideshow only runs while a panel is hovered
  useEffect(() => {
    setTick(0);
    if (!active) return;
    const t = window.setInterval(() => setTick((n) => n + 1), SLIDE_MS);
    return () => window.clearInterval(t);
  }, [active]);

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
      el.style.transform = travel ? `translate3d(${(-cur).toFixed(1)}px,0,0)` : "";
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
      if (!raf) raf = requestAnimationFrame(frame);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measure);
      cancelAnimationFrame(raf);
    };
  }, [view]);

  // each list is drawn twice: once in the blended label strip, once in a plain layer on top that only shows the active chip
  const viewsList = (solid: boolean) => (
    <ul className="works__views" aria-label={solid ? undefined : "Showcase style"}>
      {VIEWS.map((v) => (
        <li key={v}>
          <button
            type="button"
            className={"works__view" + (v === view ? " is-on" : "")}
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
    <main className="works" data-view={view} ref={track}>
      {view === "Strip" ? (
        <div className="works__stage" ref={stage}>
          <span className="works__mark" aria-hidden="true">
            DEE-07
          </span>

          <div className="works__strip" ref={strip}>
            {PROJECTS.map((p, n) => {
              const tags = p.tags.filter(plain);
              const url = p.link; // the live site, the chip is hidden when a project has none
              const hovered = active === p.id;
              const imgs = hovered ? p.images : p.images.slice(0, 1); // the other images only load once you hover
              const cur = hovered && p.images.length ? tick % p.images.length : 0;
              const isOpen = open === p.id;
              return (
                <article
                  key={p.id}
                  className="work"
                  onPointerEnter={(e) => e.pointerType === "mouse" && setActive(p.id)}
                  onPointerLeave={() => setActive(null)}
                >
                  <div className="work__media" aria-hidden="true">
{imgs.map((src, i) => (
  <picture key={src}>
    <source type="image/avif" srcSet={srcSet(src, "avif")} sizes={SIZES} />
    <source type="image/webp" srcSet={srcSet(src, "webp")} sizes={SIZES} />
    <img
      src={src}
      alt=""
      className={"work__shot" + (i === cur ? " is-on" : "")}
      loading={n < 3 ? "eager" : "lazy"}
      fetchPriority={n === 0 ? "high" : "auto"}
      decoding="async"
      draggable={false}
    />
  </picture>
))}
                  </div>

                  <Link to={`/works/${p.id}`} className="work__cover" tabIndex={-1} aria-hidden="true" />

                  <div className="work__label">
                    {isOpen && (
                      <div className="work__info" id={`info-${p.id}`}>
                        <p>{p.blurb}</p>
                        {tags.length > 1 && (
                          <ul>
                            {tags.slice(1).map((t) => (
                              <li key={t}>{t}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                    {p.deliverables && <p className="work__cat">{p.deliverables}</p>}
                    <h2 className="work__name">
                      <Link to={`/works/${p.id}`}>{p.name}</Link>
                    </h2>
                    <div className="work__links">
                      <InfoButton open={isOpen} controls={`info-${p.id}`} onClick={() => setOpen(isOpen ? null : p.id)} />
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
  {view === "Drift" ? <Drift /> : <Flow />}
</Suspense>
      )}

      <div className="works__ui">{viewsList(false)}</div>
      <div className="works__solid" aria-hidden="true">
        {viewsList(true)}
      </div>
    </main>
  );
}