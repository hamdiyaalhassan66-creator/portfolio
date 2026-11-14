import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { animate, spring } from "animejs";
import { useSheetDrag } from "./useSheetDrag";
import "./LoreDrawer.css";

const EASE = spring({ bounce: 0.18, duration: 641 });
const KINDS = ["Music", "Films", "Illustrated Books", "Photographs"] as const;
const SHEET_CSV = import.meta.env.VITE_RECS_SHEET_CSV as string | undefined;

type Rec = { kind: string; title: string; artist: string; link: string; note: string; name: string };
let cache: Rec[] | null = null; // survives closing and reopening the drawer, so the sheet is fetched once

// small CSV parser that handles quoted commas, quotes and line breaks
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (c !== "\r") cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

async function loadRecs(): Promise<Rec[]> {
  if (cache) return cache;
  const res = await fetch(SHEET_CSV!);
  if (!res.ok) throw new Error("sheet");
  const [head, ...rows] = parseCsv(await res.text());
  const col = (n: string) => head.findIndex((h) => h.trim().toLowerCase() === n);
  const idx = {
    kind: col("kind"),
    title: col("title"),
    artist: col("artist"),
    link: col("link"),
    note: col("note"),
    name: col("name"),
    ok: col("approved"),
  };
  const get = (r: string[], i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");
  cache = rows
    .filter((r) => get(r, idx.title) && get(r, idx.ok).toUpperCase() === "TRUE")
    .map((r) => ({
      kind: get(r, idx.kind),
      title: get(r, idx.title),
      artist: get(r, idx.artist),
      link: get(r, idx.link),
      note: get(r, idx.note),
      name: get(r, idx.name),
    }))
    .reverse(); // newest first
  return cache;
}

function RecList({ recs, failed }: { recs: Rec[] | null; failed: boolean }) {
  if (failed) return <p className="recs__empty">Couldn't load the list. Try again later.</p>;
  if (!recs) return <p className="recs__empty">Loading</p>;
  if (!recs.length) return <p className="recs__empty">Nothing here yet. Be the first.</p>;
  return (
    <ul className="recs__list">
      {recs.map((r, i) => (
        <li className="recs__item" key={`${i}-${r.title}`}>
          <span className="recs__item-kind">{r.kind}</span>
          <span className="recs__item-title">
            {/^https?:\/\//.test(r.link) ? (
              <a href={r.link} target="_blank" rel="noreferrer">
                {r.title}
              </a>
            ) : (
              r.title
            )}
          </span>
          {r.artist && <span className="recs__item-artist">{r.artist}</span>}
          {r.note && <span className="recs__item-note">{r.note}</span>}
          {r.name && <span className="recs__item-by">Recommended by {r.name}</span>}
        </li>
      ))}
    </ul>
  );
}

export default function RecsDrawer({ onClose }: { onClose: () => void }) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const closing = useRef(false);
  const barRef = useRef<HTMLDivElement>(null);
  const [entered, setEntered] = useState(false);
  const [kind, setKind] = useState<(typeof KINDS)[number]>("Music");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [tab, setTab] = useState<"send" | "list">("send");
  const [recs, setRecs] = useState<Rec[] | null>(cache ?? (SHEET_CSV ? null : []));
  const [recsFailed, setRecsFailed] = useState(false);

  // the list is only fetched when its tab is opened
  useEffect(() => {
    if (tab !== "list" || recs || !SHEET_CSV) return;
    loadRecs().then(setRecs).catch(() => setRecsFailed(true));
  }, [tab, recs]);
  const [error, setError] = useState<string | null>(null); // holds a mailto link when sending fails

  useLayoutEffect(() => {
    const slide = animate(drawerRef.current!, { y: ["105%", "0%"], ease: EASE, onComplete: () => setEntered(true) });
    const fade = animate(overlayRef.current!, { opacity: [0, 1], duration: 300, ease: "outQuad" });
    return () => {
      slide.cancel();
      fade.cancel();
    };
  }, []);

  const requestClose = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    animate(overlayRef.current!, { opacity: 0, duration: 300, ease: "inQuad" });
    animate(drawerRef.current!, { y: "105%", ease: EASE, onComplete: onClose });
  }, [onClose]);

  useSheetDrag({ drawerRef, overlayRef, gripRef: barRef, closing, ease: EASE, onClose, enabled: entered });

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && requestClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [requestClose]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    if (data.botcheck) return; // honeypot filled in, so it's a bot
    const fallback = `mailto:YOUR_EMAIL?subject=${encodeURIComponent(`Recommendation: ${kind}`)}&body=${encodeURIComponent(
      `${data.title} - ${data.artist ?? ""}\n${data.link ?? ""}\n\n${data.note ?? ""}`
    )}`;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          access_key: import.meta.env.VITE_WEB3FORMS_KEY,
          subject: `New recommendation: ${kind}`,
          from_name: data.name || "Anonymous",
          kind,
          title: data.title,
          artist: data.artist,
          link: data.link,
          note: data.note,
        }),
      });
      const json = await res.json();
      if (json.success) setSent(true);
      else setError(fallback);
    } catch {
      setError(fallback);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <div ref={overlayRef} className="drawer-overlay" onClick={requestClose} aria-hidden="true" />
      <aside ref={drawerRef} className="drawer is-open" aria-label="Leave a recommendation">
        <div ref={barRef} className="drawer__bar">
          <span className="drawer__bar-title">Leave me your recommendations</span>
          <button ref={closeRef} className="drawer__close" onClick={requestClose} aria-label="Close">
            <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 12h12" stroke="currentColor" strokeWidth="2" fill="none" />
            </svg>
          </button>
        </div>

        <div className="drawer__body">
          <div className="recs__tabs">
            <button
              type="button"
              className={"recs__kind" + (tab === "send" ? " is-active" : "")}
              aria-pressed={tab === "send"}
              onClick={() => setTab("send")}
            >
              {tab === "send" ? "[Leave one]" : "Leave one"}
            </button>
            <button
              type="button"
              className={"recs__kind" + (tab === "list" ? " is-active" : "")}
              aria-pressed={tab === "list"}
              onClick={() => setTab("list")}
            >
              {tab === "list" ? "[See the list]" : "See the list"}
            </button>
          </div>

          {tab === "list" ? (
            <RecList recs={recs} failed={recsFailed} />
          ) : sent ? (
            <p className="recs__thanks">Thank you, got it. I'll check it out.</p>
          ) : (
            <form className="recs" onSubmit={submit}>
              <div className="recs__field">
                <span className="recs__label">What is it?</span>
                <div className="recs__kinds">
                  {KINDS.map((k) => (
                    <button
                      key={k}
                      type="button"
                      className={"recs__kind" + (k === kind ? " is-active" : "")}
                      aria-pressed={k === kind}
                      onClick={() => setKind(k)}
                    >
                      {k === kind ? `[${k}]` : k}
                    </button>
                  ))}
                </div>
              </div>

              <label className="recs__field">
                <span className="recs__label">Title</span>
                <input className="recs__input" name="title" required autoComplete="off" />
              </label>

              <label className="recs__field">
                <span className="recs__label">Artist / creator</span>
                <input className="recs__input" name="artist" autoComplete="off" />
              </label>

              <label className="recs__field">
                <span className="recs__label">Link (optional)</span>
                <input className="recs__input" name="link" type="url" inputMode="url" autoComplete="off" />
              </label>

              <label className="recs__field">
                <span className="recs__label">Why I should check it out</span>
                <textarea className="recs__input recs__input--area" name="note" rows={4} />
              </label>

              <label className="recs__field">
                <span className="recs__label">Your name (optional, shown on the list)</span>
                <input className="recs__input" name="name" autoComplete="name" />
              </label>

              <input type="checkbox" name="botcheck" tabIndex={-1} autoComplete="off" className="sr-only" aria-hidden="true" />

              {error && (
                <p className="recs__error" role="alert">
                  Couldn't send that. Try again, or <a href={error}>email it to me instead</a>.
                </p>
              )}

              <button className="recs__submit" type="submit" disabled={sending}>
                {sending ? "Sending" : "Send"}
              </button>
            </form>
          )}
        </div>
      </aside>
    </>
  );
}