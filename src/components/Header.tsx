import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import "./Header.css";

import type { ReactNode } from "react";

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
  { to: "/", label: "Works", icon: "folder" },
  { to: "/lab", label: "Lab", icon: "flask" },
  { to: "/information", label: "Information", icon: "user" },
  { to: "/lore", label: "The Lore", icon: "star" },
  { to: "/contact", label: "Contact", icon: "contacts" },
];

export default function Header() {
  const [open, setOpen] = useState(false);

  // while the menu is open: lock page scroll, close on Escape, and close if the screen grows to desktop size
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const size = () => window.innerWidth > 900 && setOpen(false);
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
    <header className="header">
      <Link to="/" className="header__logo" aria-label="Dee-Space home">
        <span className="header__logo-mark">D-S</span>
        <span className="header__logo-name">DEE-SPACE</span>
      </Link>

      <nav className="header__nav">
        {links.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            aria-label={label}
            title={label}
            className={({ isActive }) => "header__link" + (isActive ? " is-active" : "")}
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
        {links.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            tabIndex={open ? 0 : -1}
            className={({ isActive }) => "menu__link" + (isActive ? " is-active" : "")}
            onClick={() => setOpen(false)}
          >
            <svg className="header__icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              {icons[icon]}
            </svg>
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
    </>
  );
}