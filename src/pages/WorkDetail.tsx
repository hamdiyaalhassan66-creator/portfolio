import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { PROJECTS, srcSet } from "./projects";
import "./WorkDetail.css";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="info__section">
      <h3 className="info__sub">{title}</h3>
      <div className="info__body">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="info__field">
      <span className="info__label">{label}</span>
      <span className="info__value">{children}</span>
    </div>
  );
}

// portrait = 1 column, wide = 2 columns, full = all 3 columns (16:9 and wider)
const shape = (w?: number | null, h?: number | null) =>
  !w || !h || w <= h ? "portrait" : w / h >= 1.7 ? "full" : "wide";

export default function WorkDetail() {
  const { id } = useParams();
  const project = PROJECTS.find((p) => p.id === id);
  const [infoOpen, setInfoOpen] = useState(false);
  const [videoKind, setVideoKind] = useState<Record<string, string>>({}); // videos are assumed "wide" until their size is known
  const strip = useRef<HTMLDivElement>(null);
  const infoBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    strip.current?.scrollTo(0, 0);
    setInfoOpen(false);
  }, [id]);

  // Esc closes the overlay
  useEffect(() => {
    if (!infoOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setInfoOpen(false);
        infoBtn.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [infoOpen]);

  if (!project) return <Navigate to="/" replace />;

  const media: { type: string; url: string; w?: number | null; h?: number | null }[] = project.detailMedia?.length
    ? project.detailMedia
    : project.images.map((url) => ({ type: "image", url }));

  const closeInfo = () => {
    setInfoOpen(false);
    infoBtn.current?.focus();
  };

  return (
    <main className="detail">
      <header className="detail__head">
        <div className="detail__main">
          <Link to="/" className="ibtn detail__back">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M10 3 5 8l5 5" />
            </svg>
            <span>Back to works</span>
          </Link>
          <div className="detail__titleline">
            <div className="detail__titlerow">
              <h1 className="detail__name">{project.name}</h1>
              <span className="detail__kind">{project.deliverables}</span>
            </div>
          </div>
        </div>
        <div className="detail__side">
          <p className="detail__desc">{project.description}</p>
          <button
            ref={infoBtn}
            type="button"
            className="ibtn detail__info"
            aria-haspopup="dialog"
            aria-expanded={infoOpen}
            onClick={() => setInfoOpen(true)}
          >
            <span>Info</span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M3 8h10M8 3v10" />
            </svg>
          </button>
        </div>
      </header>

      <section className="detail__gallery" ref={strip} aria-label={`${project.name} media`}>
        {media.map((m, i) => {
          const kind = m.type === "video" ? videoKind[m.url] ?? "wide" : shape(m.w, m.h);
          const cls = "detail__item" + (kind === "portrait" ? "" : " is-" + kind);
          const sizes =
            kind === "full" ? "100vw" : kind === "wide" ? "(max-width: 700px) 100vw, 67vw" : "(max-width: 700px) 100vw, 34vw";
          return m.type === "video" ? (
            <div key={m.url} className={cls}>
              <video
                src={m.url}
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
                onLoadedMetadata={(e) => {
                  const v = e.currentTarget;
                  setVideoKind((s) => ({ ...s, [m.url]: shape(v.videoWidth, v.videoHeight) }));
                }}
              />
            </div>
          ) : (
            <picture key={m.url} className={cls}>
              <source type="image/avif" srcSet={srcSet(m.url, "avif")} sizes={sizes} />
              <source type="image/webp" srcSet={srcSet(m.url, "webp")} sizes={sizes} />
              <img
                src={m.url}
                alt={`${project.name} ${i + 1}`}
                decoding="async"
                loading={i < 2 ? "eager" : "lazy"}
                fetchPriority={i === 0 ? "high" : undefined}
              />
            </picture>
          );
        })}
      </section>

      {infoOpen && (
        <div className="info" role="dialog" aria-modal="true" aria-labelledby="info-title">
          <button type="button" className="info__backdrop" aria-label="Close info" tabIndex={-1} onClick={closeInfo} />

          <div className="info__panel">
            <h2 className="info__title" id="info-title">{project.name}</h2>

            <Section title="Description">
              <p className="info__text">{project.description}</p>
            </Section>

            {project.role && (
              <Section title="Role">
                <p className="info__text">{project.role}</p>
              </Section>
            )}

            <Section title="Details">
              {project.client && <Field label="Client">{project.client}</Field>}
              <Field label="Deliverables">{project.deliverables}</Field>
              <Field label="Type / Industry">{project.industry}</Field>
              <Field label="Year">{project.year}</Field>
              {project.link && (
                <Field label="View site">
                  <a className="ibtn info__chip" href={project.link} target="_blank" rel="noopener noreferrer">
                    <span>{project.link.replace(/^https?:\/\//, "").replace(/\/$/, "")}</span>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M5 11 11 5M6 5h5v5" />
                    </svg>
                  </a>
                </Field>
              )}
            </Section>

            <Section title="Collaborators">
              {project.collaborators.map((c) => (
                <Field key={c.role + c.name} label={c.role}>
                  {c.name}
                </Field>
              ))}
            </Section>
          </div>

          <button type="button" className="ibtn info__close" onClick={closeInfo} autoFocus>
            <span>Close</span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>
      )}
    </main>
  );
}