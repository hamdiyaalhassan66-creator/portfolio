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
  return (
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
            className={({ isActive }) => "header__link" + (isActive ? " is-active" : "")}
          >
            <svg className="header__icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              {icons[icon]}
            </svg>
            {label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}