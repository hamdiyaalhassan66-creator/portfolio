import "./Information.css";
import { Suspense, lazy, useEffect, useRef } from "react";
// three.js lives in its own chunk, so the text and faces paint first
const ThreadIndex = lazy(() => import("../components/ThreadIndex"));

// the five head shots in the strip, shapes are baked into the images
const FACES = [
  { id: "a", src: "face-purple.webp" },
  { id: "b", src: "face-red.webp" },
  { id: "c", src: "face-lime.webp" },
  { id: "d", src: "portrait-burgundy.webp", sticker: "glasses-sticker.webp" },
];

const SCROLL_DIST = 900; // how much scrolling (in Figma px) the move takes
const STACK_VIEW_Y = 0.5; // while scrolling, the faces ride at this height of the screen (0 = top, 0.5 = centre, 1 = bottom)
const PILE_VIEW_Y = 0.95; // where the portrait settles once you reach the bottom. Higher = more of it cut off by the page edge. The models come out of it
const PILE_SCALE = 1.4; // size of the end portrait compared to its size in the strip (1 = same size)
const SMOOTH = 0.3; // how fast the faces catch up with the scroll (0.12 felt floaty, 1 = locked to the scroll)
const CONVERGE = 1.8; // the stacks merge into the pile only in the last stretch of the page, this many screen heights long (smaller = later)

// where each face ends up, in Figma px: centre x / y of its stack, plus the offset and tilt inside the stack
const STACK: Record<string, { x: number; y: number; r: number }> = {
  a: { x: 256, y: 1728, r: -5 }, // left stack, back
  b: { x: 300, y: 1772, r: 4 }, // left stack, front
  c: { x: 1520, y: 1728, r: 5 }, // right stack, back
  d: { x: 1476, y: 1772, r: -4 }, // right stack, front
};

// phase 2: how each face sits in the pile at the bottom (offset from the pile centre in Figma px, tilt in degrees)
const PILE: Record<string, { x: number; y: number; r: number }> = {
  a: { x: -26, y: -18, r: -8 },
  c: { x: 24, y: -14, r: 7 },
  d: { x: 0, y: 0, r: 0 }, // the only face left at the end
  b: { x: 0, y: 0, r: 0 }, // on top
};

const WORK = [
  { role: "Product Designer", place: "Refine Studio", years: "2024 - 2025" },
  { role: "Web Designer & Framer Dev", place: "Oxegene", years: "2023 - Present" },
  { role: "Product/Web Designer & Framer Dev", place: "Freelance", years: "2022 - Present" },
  { role: "UI/UX Designer", place: "Pixeldesk Agency", years: "2022 - 2023" },
];

const CAPABILITIES = [
  ["Web Design", "Framer Development", "Product Design", "E-commerce Design", "SEO"],
  ["Animation / Prototyping", "User Experience & Interface", "Interaction Design", "Design Systems"],
];

const CLIENTS = [
  "dEX Ghana",
  "Khaya AI",
  "HIS SON JESUS",
  "Gecric Integrity",
  "Digiits Agency",
  "Prekesse",
  "Bittern Consulting",
  "Turdemoji",
];

// face-red (b) last, so it is always the one on top of the pile
const STACK_ORDER = [...FACES.filter((f) => f.id !== "b"), ...FACES.filter((f) => f.id === "b")];

export default function Information() {
  const rootRef = useRef<HTMLElement>(null);
  const stacksRef = useRef<HTMLDivElement>(null);
  const hubRef = useRef<HTMLDivElement>(null);
  const landRef = useRef(0);

  useEffect(() => {
    const t = window.setTimeout(() => void import("../components/ThreadIndex"), 1200);
    return () => window.clearTimeout(t);
  }, []);

  // on scroll the faces leave the strip and fly into two stacks that move in opposite directions
  useEffect(() => {
    const root = rootRef.current;
    const layer = stacksRef.current;
    const hub = hubRef.current;
    if (!root || !layer || !hub) return;
    hub.style.bottom = `${(1 - PILE_VIEW_Y) * 100}vh`; // the marker the models come out of sits where the pile lands (overrides the CSS value)
    hub.style.width = `calc(var(--u) * ${350 * PILE_SCALE})`; // the marker is also the click-guard area over the portrait, so it grows with it
    hub.style.height = `calc(var(--u) * ${363 * PILE_SCALE})`;

    const small = window.matchMedia("(max-width: 1100px)");
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");
    const faces = Array.from(layer.querySelectorAll<HTMLElement>(".stack-face"));
    const start: Record<string, { x: number; sy: number }> = {};
    let split = false;
    let target = 0;
    let p = 0;
    let raf = 0;
    let up = false; // last scroll direction
    let last = 0; // time of the previous frame
    let spareHidden = false;
    const REVEAL = 0.6; // going up, the spare faces come back once the stacks are this far out (1 = fully out, 0 = home)

    // remember where each face is in the strip right now, so the stack starts exactly there
    const capture = () => {
      root.querySelectorAll(".is-picked").forEach((el) => el.classList.remove("is-picked"));
      const lr = layer.getBoundingClientRect();
      faces.forEach((el) => {
        const id = el.dataset.id!;
        let best = Infinity;
        let pick: HTMLElement | null = null;
        root.querySelectorAll<HTMLElement>(`.information__track .face--${id}`).forEach((m) => {
          const r = m.getBoundingClientRect();
          const cx = r.left - lr.left + r.width / 2;
          const d = Math.abs(cx - lr.width / 2); // the copy nearest the middle of the screen
          if (d < best) {
            best = d;
            pick = m;
            start[id] = { x: cx, sy: r.top + r.height / 2 }; // sy = height on the screen right now
          }
        });
        (pick as HTMLElement | null)?.classList.add("is-picked"); // this strip face is covered by its stack face
      });
    };

    const ease = (v: number) => (v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2);

    let u = 1;
    let D = 1;
    let maxY = 2;
    let D2 = 2; // scroll position where the stacks start merging
    let hx = 0;
    // layout reads happen here (on resize), not on every scroll event / frame
    const measure = () => {
      u = window.innerWidth / 1728;
      D = SCROLL_DIST * u;
      maxY = Math.max(document.documentElement.scrollHeight - window.innerHeight, D + 1);
      D2 = Math.max(maxY - CONVERGE * window.innerHeight, D + 1);
      const lr = layer.getBoundingClientRect();
      const hr = hub.getBoundingClientRect();
      hx = hr.left - lr.left + hr.width / 2;
    };

    // p runs 0..2: 0 to 1 = strip to the two stacks, 1 to 2 = stacks converge into one pile at the bottom
    const render = () => {
      landRef.current = Math.max(p - 1, 0);
      const e1 = ease(Math.min(p, 1));
      const e2 = ease(Math.max(p - 1, 0));
      // spare strip faces: gone as soon as you scroll down, back once the stacks are on their way home
      const hide = !(up && p < REVEAL);
      if (hide !== spareHidden) {
        spareHidden = hide;
        root.classList.toggle("is-spare-hidden", hide);
      }
      const vh = window.innerHeight; // the screen height the stacks ride at, in this layer's space
      faces.forEach((el) => {
        const id = el.dataset.id!;
        const s = start[id];
        const t = STACK[id];
        const q = PILE[id];
        if (!s || !t || !q) return;
        const x1 = s.x + (t.x * u - s.x) * e1;
        const x = x1 + (hx + q.x * u - x1) * e2;
        // heights are worked out on the screen, then turned into page coordinates, so the faces stay put while you scroll
        const sy1 = s.sy + (vh * STACK_VIEW_Y + (t.y - 1750) * u - s.sy) * e1; // 1750 = the middle of the two stack heights, so back and front faces keep their offset
        const sy = sy1 + (vh * PILE_VIEW_Y + q.y * u - sy1) * e2;
        const y = sy; // the layer is fixed to the screen, so screen height is the position
        const r = t.r * e1 + (q.r - t.r) * e2;
        const g = id === "b" ? 1 + (PILE_SCALE - 1) * e2 : 1; // only the red portrait grows, and only while it settles into the pile
        el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) rotate(${r}deg) scale(${g})`;
        el.style.opacity = id === "b" ? "1" : String(Math.max(1 - e2 * 1.4, 0)); // the others melt away, leaving only the red portrait
      });
    };

    const reset = () => {
      last = 0;
      up = false;
      split = false;
      target = 0;
      p = 0;
      root.classList.remove("is-split");
    };

    const frame = (now: number) => {
      const dt = last ? Math.min((now - last) / 16.67, 3) : 1; // 1 = one frame at 60fps
      last = now;
      p += (target - p) * (1 - Math.pow(1 - SMOOTH, dt)); // same feel on 60Hz and 120Hz screens
      if (Math.abs(target - p) < 0.0005) p = target;
      render();
      if (split && target === 0 && p === 0) reset(); // back at the top: hand over to the strip again
      raf = p === target ? 0 : requestAnimationFrame(frame);
      if (!raf) last = 0; // the loop is idle, so the next start begins with a normal frame
    };

    const onScroll = () => {
      if (small.matches || still.matches) {
        if (split) reset();
        landRef.current = 1; // no scroll animation: the models just appear
        return;
      }
      const y = window.scrollY;
      const next = Math.min(Math.max(y / D, 0), 1) + Math.min(Math.max((y - D2) / Math.max(maxY - D2, 1), 0), 1);
      if (next > target) up = false;
      else if (next < target) up = true;
      target = next;
      if (target > 0 && !split) {
        capture();
        split = true;
        root.classList.add("is-split");
        render();
      }
      if (!raf) raf = requestAnimationFrame(frame);
    };

    const onResize = () => {
      measure();
      onScroll();
    };
    const ro = new ResizeObserver(onResize); // page height changes (fonts, images) re-measure too
    ro.observe(root);
    measure();
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(raf);
      root.classList.remove("is-split");
    };
  }, []);

  return (
    <main className="information" ref={rootRef}>
      <p className="information__intro">
        Hello there, I'm Hamdiya or simply Diya / Dee. A product and UI/UX designer who also builds what she designs.
      </p>

      <div className="information__faces">
        <div className="information__track">
          {[...FACES, ...FACES, ...FACES].map((f, i) => (
            <div className={`face face--${f.id}`} key={i} aria-hidden={i >= FACES.length}>
              <img src={`/information/${f.src}`} alt={i === 0 ? "Portraits of Dee" : ""} draggable={false} decoding="async" loading={i < FACES.length ? "eager" : "lazy"} />
              {f.sticker && <img className="face__sticker" src={`/information/${f.sticker}`} alt="" draggable={false} decoding="async" />}
            </div>
          ))}
        </div>
      </div>

      {/* the faces again, but as two stacks; hidden until you scroll */}
      <div className="information__stacks" ref={stacksRef} aria-hidden="true">
        {STACK_ORDER.map((f) => (
          <div className={`face face--${f.id} stack-face`} key={f.id} data-id={f.id}>
            <img src={`/information/${f.src}`} alt="" draggable={false} decoding="async" />
            {f.sticker && <img className="face__sticker" src={`/information/${f.sticker}`} alt="" draggable={false} decoding="async" />}
          </div>
        ))}
      </div>

      <div className="information__sections">
        <section className="information__block">
          <h2 className="information__label">Me</h2>
          <div className="information__copy">
            <p>
              I’ve spent 4+ years designing interfaces and developing some of them in Framer. I recently started building
              my own apps and tools with the help of AI too. I like owning the whole path, from the first sketch to the
              shipped component.
            </p>
            <p>
              My approach focuses on visual direction, consistency, and story-telling, shaping ideas into visuals that feel
              intentional and relevant. I refine each project according to how I think and see things
            </p>
          </div>
        </section>

        <section className="information__block">
          <h2 className="information__label">Education</h2>
          <div className="information__copy">
            <p>
              I’ve always been a creative and visual individual growing up and I guess it was natural for me to switch to
              the design path after studying Statistics with Computer Science from the University of Ghana. I used to
              illustrate, and it still shapes how I design. I look for the small, odd detail that makes a screen feel like
              someone made it.
            </p>
          </div>
        </section>

        <section className="information__block">
          <h2 className="information__label">Experience</h2>
          <div className="information__jobs">
            {WORK.map((w) => (
              <div className="information__job" key={`${w.place}-${w.years}`}>
                <span className="information__years">{w.years}</span>
                <div>{w.role}</div>
                <div>{w.place}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="information__block">
          <h2 className="information__label">Skills</h2>
          <ul className="information__list">
            {CAPABILITIES.flat().map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </section>

        <section className="information__block">
          <h2 className="information__label">Clients</h2>
          <ul className="information__list">
            {CLIENTS.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </section>
      </div>
            <div className="information__hub" ref={hubRef} aria-hidden="true" />
      <Suspense fallback={null}>
        <ThreadIndex headRef={hubRef} landRef={landRef} />
      </Suspense>
      <p className="information__outside information__outside--left">
        Outside of design, I spend my free time listening to and finding new music, watching shows (animations and shows
        especially), reading webtoons or playing tetris.
      </p>
      <p className="information__outside information__outside--right">I love working out at home too (not everyday though).</p>
    </main>
  );
}