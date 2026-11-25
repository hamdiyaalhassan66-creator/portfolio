import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import "./Header.css";

import type { PointerEvent, ReactNode } from "react";

const icons: Record<string, ReactNode> = {
  folder: <path d="M1.33 2h5.34L8 3.33h6.67V14H1.33z" />,
  flask: <path d="M5.33 1.33h5.34v1.34H10v3.9l4 6.9v1.2H2v-1.2l4-6.9v-3.9h-.67z" />,
  user: (
    <path d="M8 1.33a3.33 3.33 0 1 1 0 6.67 3.33 3.33 0 0 1 0-6.67ZM2 14.67v-1.34c0-2.23 2.7-4 6-4s6 1.77 6 4v1.34z" />
  ),
  star: <path d="M8 .67l2.06 4.84 5.27.46-4 3.46 1.2 5.14L8 11.7l-4.53 2.87 1.2-5.14-4-3.46 5.27-.46z" />,
  contacts: (
    <path
      fillRule="evenodd"
      d="M4 1.33h10.67v13.34H4zM1.33 3.33h1.34v2H1.33zM1.33 7h1.34v2H1.33zM1.33 10.67h1.34v2H1.33zM9.33 4.67a1.67 1.67 0 1 0 0 3.33 1.67 1.67 0 0 0 0-3.33zM6.67 11.33c0-1.1 1.2-2 2.66-2s2.67.9 2.67 2z"
    />
  ),
};

const links = [
  { to: "/", label: "Work", icon: "folder" },
  { to: "/side-quests", label: "Side Quests", icon: "flask" },
  { to: "/info", label: "Info", icon: "user" },
  { to: "/archive", label: "Archive", icon: "star" },
  { to: "/contact", label: "Contact", icon: "contacts" },
];

const GROW = 30; // px added to the hovered tab (30 → 60, same as the active tab)
const REACH = 2; // how many tab widths the effect travels along the nav
const STIFFNESS = 0.14; // higher = snappier
const DAMPING = 0.74; // lower = bouncier, 0.8+ settles with no overshoot

export default function Header() {
  const [open, setOpen] = useState(false);
    const navRef = useRef<HTMLElement>(null);

  // dock effect: each tab grows by how close the pointer is to its centre.
  // one rAF loop keeps a value + velocity per tab and springs it toward its target, so nothing restarts mid-move
  const anim = useRef({ target: [] as number[], value: [] as number[], vel: [] as number[], raf: 0, last: 0 });
  const getTabs = () => Array.from(navRef.current?.querySelectorAll<HTMLElement>(".header__link") ?? []);

  const tick = (now: number) => {
    const s = anim.current;
    const k = Math.min((now - s.last) / 16.67, 3); // frame-rate independent
    s.last = now;
    let moving = false;
    getTabs().forEach((tab, i) => {
      const target = s.target[i] ?? 0;
      const v = s.value[i] ?? 0;
      const vel = ((s.vel[i] ?? 0) + (target - v) * STIFFNESS * k) * Math.pow(DAMPING, k);
      const next = v + vel * k;
      s.vel[i] = vel;
      s.value[i] = next;
      tab.style.setProperty("--grow", `${Math.max(next, 0)}px`);
      if (Math.abs(vel) > 0.01 || Math.abs(target - next) > 0.05) moving = true;
    });
    s.raf = moving ? requestAnimationFrame(tick) : 0;
  };
  const run = () => {
    if (anim.current.raf) return;
    anim.current.last = performance.now();
    anim.current.raf = requestAnimationFrame(tick);
  };

  const spans = useRef<{ c: number; w: number }[]>([]); // tab centres and widths, measured once per hover
  const reduce = useRef(false);
  const measureTabs = (e: PointerEvent<HTMLElement>) => {
    if (e.pointerType !== "mouse") return;
    reduce.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    spans.current = getTabs().map((t) => {
      const r = t.getBoundingClientRect();
      return { c: r.left + r.width / 2, w: r.width };
    });
  };
  const handleMove = (e: PointerEvent<HTMLElement>) => {
    if (e.pointerType !== "mouse" || reduce.current) return;
    spans.current.forEach((s, i) => {
      const d = Math.abs(e.clientX - s.c) / s.w;
      const f = d < REACH ? (Math.cos((Math.PI * d) / REACH) + 1) / 2 : 0;
      anim.current.target[i] = f * GROW;
    });
    run();
  };
  const handleLeave = () => {
    anim.current.target = [];
    run();
  };
  useEffect(() => () => cancelAnimationFrame(anim.current.raf), []); // stop the loop on unmount

  // while the page scrolls (up or down) the tabs shrink to 12px, and spring back once scrolling stops
  useEffect(() => {
    const nav = navRef.current;
    if (!nav || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let lastY = window.scrollY;
    let stop = 0;
    let settle = 0;
    const onScroll = () => {
      if (Math.abs(window.scrollY - lastY) < 1) return;
      lastY = window.scrollY;
      nav.classList.add("is-scrolling", "is-scroll-anim");
      clearTimeout(stop);
      clearTimeout(settle);
      stop = window.setTimeout(() => {
        nav.classList.remove("is-scrolling"); // scrolling stopped: back to the default height
        settle = window.setTimeout(() => nav.classList.remove("is-scroll-anim"), 400); // drop the transition so the hover spring isn't slowed
      }, 150);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      clearTimeout(stop);
      clearTimeout(settle);
    };
  }, []);
  const { pathname } = useLocation();
  const onLore = pathname.startsWith("/lore"); // the lore page is reached from Information, so that tab stays lit
  const onWork = pathname.startsWith("/works/"); // a project page is reached from Works, so that tab stays lit
  const isOn = (to: string, isActive: boolean) => isActive || (to === "/info" && onLore) || (to === "/" && onWork);

  // while the menu is open: lock page scroll, close on Escape, and close if the screen grows to desktop size
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const size = () => window.innerWidth > 767 && setOpen(false);
    window.addEventListener("keydown", key);
    window.addEventListener("resize", size);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", key);
      window.removeEventListener("resize", size);
    };
  }, [open]);

  return (
    <>
    <Link to="/" className="header__logo" aria-label="Dee-Space home">
      <img className="header__logo-img header__logo-img--dark" src="/logo.svg" alt="" />
      <img className="header__logo-img header__logo-img--light" src="/logo-light.svg" alt="" />
    </Link>
    <header className="header">
      <nav className="header__nav" ref={navRef} onPointerEnter={measureTabs} onPointerMove={handleMove} onPointerLeave={handleLeave}>
        {links.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            aria-label={label}
            title={label}
            className={({ isActive }) => "header__link" + (isOn(to, isActive) ? " is-active" : "")}
          >
            <svg className="header__icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              {icons[icon]}
            </svg>
            {label}
          </NavLink>
        ))}
      </nav>

      <button
        type="button"
        className="header__menu"
        aria-label="Open menu"
        aria-expanded={open}
        aria-controls="menu-sheet"
        onClick={() => setOpen(true)}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M2 5h14M2 9h14M2 13h14" />
        </svg>
      </button>
    </header>

    <div className={"menu" + (open ? " is-open" : "")} id="menu-sheet" aria-hidden={!open}>
      <button type="button" className="menu__backdrop" aria-label="Close menu" tabIndex={open ? 0 : -1} onClick={() => setOpen(false)} />
      <nav className="menu__panel" aria-label="Main">
        <div className="menu__bar">
          <span className="menu__title">Menu</span>
          <button type="button" className="menu__close" aria-label="Close menu" tabIndex={open ? 0 : -1} onClick={() => setOpen(false)}>
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3 8h10" stroke="currentColor" strokeWidth="2" />
            </svg>
          </button>
        </div>
        {links.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            tabIndex={open ? 0 : -1}
            className={({ isActive }) => "menu__link" + (isOn(to, isActive) ? " is-active" : "")}
            onClick={() => setOpen(false)}
          >
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
    </>
  );
}