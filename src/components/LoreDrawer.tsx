import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { animate, spring } from "animejs";
import type { LoreItem } from "../data/lore";
import SleeveViewer from "./SleeveViewer";
import "./LoreDrawer.css";

const PREVIEW = 20; // preview length in seconds
const EASE = spring({ bounce: 0.18, duration: 641 });
const fmt = (s: number) => `0:${String(Math.floor(s)).padStart(2, "0")}`;

export default function LoreDrawer({ item, open, onClose }: { item: LoreItem; open: boolean; onClose: () => void }) {
  const [playing, setPlaying] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const seeking = useRef(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const closing = useRef(false);
  const [entered, setEntered] = useState(false);
  const [warm] = useState(!open); // mounted hidden ahead of the click, so the canvas can build early
  const tracks = item.tracks ?? [];
  const current = playing === null ? undefined : tracks[playing];

  // preview clock: runs while playing
  useEffect(() => {
    if (!isPlaying) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      if (!seeking.current) setTime((t) => Math.min(t + dt, PREVIEW));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying]);

  // stop at the end of the preview
  useEffect(() => {
    if (time >= PREVIEW) setIsPlaying(false);
  }, [time]);

  const togglePlay = () => {
    if (!isPlaying && time >= PREVIEW) setTime(0); // replay from the start
    setIsPlaying((p) => !p);
  };

  const seekTo = (e: ReactPointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(Math.max(e.clientX - rect.left, 0), rect.width);
    setTime((x / rect.width) * PREVIEW);
  };

  // slide in
  useLayoutEffect(() => {
    if (!open) return;
    const slide = animate(drawerRef.current!, {
      x: ["100%", "0%"],
      ease: EASE,
      onComplete: () => setEntered(true),
    });
    const fade = animate(overlayRef.current!, { opacity: [0, 1], duration: 300, ease: "outQuad" });
    return () => {
      slide.cancel();
      fade.cancel();
    };
  }, [open]);

  // slide out, then unmount
  const requestClose = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    animate(overlayRef.current!, { opacity: 0, duration: 300, ease: "inQuad" });
    animate(drawerRef.current!, { x: "100%", ease: EASE, onComplete: onClose });
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && requestClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, requestClose]);

  return (
    <>
    <div
      ref={overlayRef}
      className="drawer-overlay"
      style={open ? undefined : { visibility: "hidden" }}
      onClick={requestClose}
      aria-hidden="true"
    />
    <aside
      ref={drawerRef}
      className={"drawer" + (open ? " is-open" : "")}
      style={open ? undefined : { visibility: "hidden" }}
      aria-label={`${item.title} details`}
    >
      <div className="drawer__bar">
        <span className="drawer__bar-title">
          {item.title} - {item.creator}
        </span>
        <button ref={closeRef} className="drawer__close" onClick={requestClose} aria-label="Close">
          <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 12h12" stroke="currentColor" strokeWidth="2" fill="none" />
          </svg>
        </button>
      </div>

      <div className="drawer__body">
        <div className="drawer__hero">
          <SleeveViewer item={item} ready={warm || entered} />
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
                <span className="drawer__lead" />
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
                  onClick={() => {
                    setPlaying(i);
                    setTime(0);
                    setIsPlaying(true);
                  }}
                >
                  <span className="drawer__lead" aria-hidden="true">
                    {i === playing ? <WaveIcon active={isPlaying} /> : <PlayIcon />}
                  </span>
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
          <button
            className="drawer__pause"
            onClick={togglePlay}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              {isPlaying ? (
                <path d="M2 1.33h4v13.34H2zM10 1.33h4v13.34h-4z" />
              ) : (
                <path d="M3.33 2v12L13.5 8z" />
              )}
            </svg>
          </button>
          <div className="drawer__now">
            <div className="drawer__now-row">
              <span>{current.title}</span>
              <span className="drawer__now-time">
                {fmt(time)} / {fmt(PREVIEW)}
              </span>
            </div>
            <div
              className="drawer__progress"
              role="slider"
              tabIndex={0}
              aria-label="Seek preview"
              aria-valuemin={0}
              aria-valuemax={PREVIEW}
              aria-valuenow={Math.floor(time)}
              aria-valuetext={`${fmt(time)} of ${fmt(PREVIEW)}`}
              style={{ "--p": time / PREVIEW } as CSSProperties}
              onPointerDown={(e) => {
                seeking.current = true;
                e.currentTarget.setPointerCapture(e.pointerId);
                seekTo(e);
              }}
              onPointerMove={(e) => seeking.current && seekTo(e)}
              onPointerUp={() => (seeking.current = false)}
              onPointerCancel={() => (seeking.current = false)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight") setTime((t) => Math.min(t + 1, PREVIEW));
                if (e.key === "ArrowLeft") setTime((t) => Math.max(t - 1, 0));
              }}
            >
              <span className="drawer__progress-fill" />
              <span className="drawer__progress-thumb" />
            </div>
          </div>
        </div>
      )}
    </aside>
    </>
  );
}

const iconProps = { width: 16, height: 16, viewBox: "0 0 16 16", fill: "currentColor" } as const;

function PlayIcon() {
  return (
    <svg {...iconProps}>
      <path d="M3.33 2v12L13.5 8z" />
    </svg>
  );
}

// s = resting height, p = peak height while playing, d = animation offset
const WAVE_BARS = [
  { x: 2, s: 0.3, p: 0.9, d: "0s" },
  { x: 4.67, s: 0.67, p: 0.3, d: "-0.3s" },
  { x: 7.33, s: 1, p: 0.4, d: "-0.6s" },
  { x: 10, s: 0.52, p: 1, d: "-0.15s" },
  { x: 12.67, s: 0.22, p: 0.7, d: "-0.45s" },
];

function WaveIcon({ active }: { active: boolean }) {
  return (
    <svg {...iconProps} className={"wave" + (active ? " is-active" : "")}>
      {WAVE_BARS.map((b) => (
        <rect
          key={b.x}
          className="wave__bar"
          x={b.x}
          y="1.33"
          width="1.33"
          height="13.34"
          style={{ "--s": b.s, "--p": b.p, "--d": b.d } as CSSProperties}
        />
      ))}
    </svg>
  );
}