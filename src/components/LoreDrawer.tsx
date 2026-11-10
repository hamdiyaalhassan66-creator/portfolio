import { useEffect, useRef, useState } from "react";
import type { LoreItem } from "../data/lore";
import SleeveViewer from "./SleeveViewer";
import "./LoreDrawer.css";

export default function LoreDrawer({ item, onClose }: { item: LoreItem; onClose: () => void }) {
  const [playing, setPlaying] = useState(0);
  const closeRef = useRef<HTMLButtonElement>(null);
  const tracks = item.tracks ?? [];
  const current = tracks[playing];

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
    <div className="drawer-overlay" onClick={onClose} aria-hidden="true" />
    <aside className="drawer" aria-label={`${item.title} details`}>
      <div className="drawer__bar">
        <span className="drawer__bar-title">
          {item.title} - {item.creator}
        </span>
        <button ref={closeRef} className="drawer__close" onClick={onClose} aria-label="Close">
          <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 12h12" stroke="currentColor" strokeWidth="2" fill="none" />
          </svg>
        </button>
      </div>

      <div className="drawer__body">
        <div className="drawer__hero">
          <SleeveViewer item={item} />
          <div className="drawer__head">
            <h2 className="drawer__title">{item.title}</h2>
            <div className="drawer__details">
              {item.creatorUrl ? (
                <a className="drawer__creator is-link" href={item.creatorUrl} target="_blank" rel="noreferrer">
                  {item.creator}
                </a>
              ) : (
                <span className="drawer__creator">{item.creator}</span>
              )}
              <p className="drawer__meta">
                {[item.kind, item.genre, item.year, item.songs ? `${item.songs} songs` : undefined]
                  .filter(Boolean)
                  .map((part) => (
                    <span key={part}>{part}</span>
                  ))}
              </p>
            </div>
          </div>
        </div>

        {tracks.length > 0 && (
          <>
            <h3 className="drawer__label">Tracklist</h3>
            <div className="drawer__list">
              <div className="drawer__row drawer__row--head">
                <span className="drawer__num">#</span>
                <span className="drawer__name">Title</span>
                <span className="drawer__time">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-label="Duration">
                    <path d="M8 1.33a6.67 6.67 0 1 0 0 13.34A6.67 6.67 0 0 0 8 1.33zM8.67 4v4.27l3 1.8-.67 1.1-3.67-2.2V4z" />
                  </svg>
                </span>
              </div>
              {tracks.map((t, i) => (
                <button
                  key={`${i}-${t.title}`}
                  className={"drawer__row" + (i === playing ? " is-playing" : "")}
                  onClick={() => setPlaying(i)}
                >
                  <span className="drawer__num">{String(i + 1).padStart(2, "0")}</span>
                  <span className="drawer__name">{t.title}</span>
                  <span className="drawer__time">{t.duration ?? ""}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {current && (
        <div className="drawer__player">
          <span className="drawer__pause" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2 1.33h4v13.34H2zM10 1.33h4v13.34h-4z" />
            </svg>
          </span>
          <div className="drawer__now">
            <div className="drawer__now-row">
              <span>{current.title}</span>
              <span className="drawer__now-time">0:00 / {current.duration ?? "--:--"}</span>
            </div>
            <div className="drawer__progress" />
          </div>
        </div>
      )}
    </aside>
    </>
  );
}