import { useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import DiscWheel from "../components/DiscWheel";
import LoreDrawer from "../components/LoreDrawer";
import { getLoreItems, type LoreCategory } from "../data/lore";
import "./Lore.css";

const tabs: { id: LoreCategory; label: string }[] = [
  { id: "music", label: "Music" },
  { id: "films", label: "Films" },
  { id: "books", label: "Illustrated Books" },
];

const middle = (count: number) => Math.max(0, Math.floor((count - 1) / 2));

// stagger index for the line-by-line reveal
const d = (i: number) => ({ "--i": i }) as CSSProperties;

export default function Lore() {
  const [category, setCategory] = useState<LoreCategory>("music");
  const [activeIndex, setActiveIndex] = useState(() => middle(getLoreItems("music").length));
  const [drawerOpen, setDrawerOpen] = useState(false);

  const items = getLoreItems(category);
  const active = items[activeIndex];
  const step = (delta: number) =>
    setActiveIndex((i) => (items.length ? (i + delta + items.length) % items.length : 0));

  function selectCategory(next: LoreCategory) {
    setCategory(next);
    setActiveIndex(middle(getLoreItems(next).length));
  }

  return (
    <main className="lore">
      <h1 className="sr-only">The Lore</h1>

      <section className="lore__intro">
        <p className="lore__text">
          Lorem ipsum dolor sit amet consectetur. Sed enim leo in velit urna id varius magna.
          Porttitor viverra maecenas sit at egestas ut sapien id. Aliquet feugiat nibh at cras
          vivamus eu. Rhoncus amet nisl a aliquet et a rutrum nisi. Turpis in ut natoque leo
          justo tellus.
        </p>

        <div className="lore__tabs">
          {tabs.map(({ id, label }) => {
            const isActive = id === category;
            return (
              <button
                key={id}
                className={"lore__tab" + (isActive ? " is-active" : "")}
                aria-pressed={isActive}
                onClick={() => selectCategory(id)}
              >
                {isActive ? `[${label}]` : label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="lore__stage">
        <DiscWheel items={items} activeIndex={activeIndex} onChange={setActiveIndex} />

        {active ? (
          <div className="lore__now" key={active.id} aria-live="polite">
            <div className="lore__head">
              <div className="reveal">
                <h2 className="lore__title rise" style={d(0)}>
                  {active.title}
                </h2>
              </div>

              <div className="lore__details">
                <div className="reveal">
                  {active.creatorUrl ? (
                    <a
                      className="lore__creator rise"
                      style={d(1)}
                      href={active.creatorUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {active.creator}
                    </a>
                  ) : (
                    <span className="lore__creator rise" style={d(1)}>
                      {active.creator}
                    </span>
                  )}
                </div>

                <div className="reveal">
                  <p className="lore__meta rise" style={d(2)}>
                    {[active.kind, active.genre, active.year, active.songs ? `${active.songs} songs` : undefined]
                      .filter(Boolean)
                      .map((part) => (
                        <span key={part}>{part}</span>
                      ))}
                  </p>
                </div>
              </div>
            </div>

            <div className="reveal">
              <button
                className="lore__info rise"
                style={d(3)}
                aria-expanded={drawerOpen}
                onClick={() => setDrawerOpen(true)}
              >
                Info
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M5.33 3.33L10.67 8l-5.34 4.67" fill="none" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </button>
            </div>
          </div>
        ) : (
          <p className="lore__empty">Nothing here yet</p>
        )}
      </section>

      <div className="player">
        <button
          className="player__btn player__btn--back"
          onClick={() => step(-1)}
        >
          <SkipBackIcon /> Back
        </button>
        <button className="player__btn player__btn--play">
          <PlayIcon /> Play
        </button>
        <button
          className="player__btn player__btn--forward"
          onClick={() => step(1)}
        >
          Forward <SkipForwardIcon />
        </button>
      </div>

      <Link to="/contact" className="lore__recs">
        Leave me your recommendations
      </Link>

      {drawerOpen && active && <LoreDrawer item={active} onClose={() => setDrawerOpen(false)} />}
    </main>
  );
}

const iconProps = {
  width: 16,
  height: 16,
  viewBox: "0 0 16 16",
  fill: "currentColor",
  "aria-hidden": true,
} as const;

function SkipBackIcon() {
  return (
    <svg {...iconProps}>
      <path d="M2 2.67h1.67v10.66H2zM14 2.67v10.66L5 8z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg {...iconProps}>
      <path d="M3.33 2v12L13.5 8z" />
    </svg>
  );
}

function SkipForwardIcon() {
  return (
    <svg {...iconProps}>
      <path d="M2 2.67v10.66L11 8zM12.33 2.67H14v10.66h-1.67z" />
    </svg>
  );
}