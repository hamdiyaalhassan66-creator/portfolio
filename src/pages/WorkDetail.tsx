import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { PROJECTS, srcSet } from "./projects";
import "./WorkDetail.css";

type PanelKey = "details" | "collaborators";

function PanelBar({ title, open, controls, onToggle }: { title: string; open: boolean; controls: string; onToggle: () => void }) {
  return (
    <button type="button" className="acc__bar" aria-expanded={open} aria-controls={controls} onClick={onToggle}>
      <span className="acc__title">{title}</span>
      <span className="acc__toggle" aria-hidden="true">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 12h12" />
          {!open && <path d="M12 6v12" />}
        </svg>
      </span>
    </button>
  );
}

// spring({ bounce: 0.18, duration: 641 }) sampled into a CSS easing; it settles in about 1140ms
const SPRING =
  "linear(0, 0.0335, 0.1148, 0.2212, 0.337, 0.4515, 0.558, 0.6529, 0.7345, 0.8026, 0.8579, 0.9018, 0.9356, 0.961, 0.9795, 0.9925, 1.0012, 1.0066, 1.0096, 1.0109, 1.011, 1.0105, 1.0094, 1.0082, 1.0069, 1.0057, 1.0045, 1.0035, 1.0027, 1.002, 1.0014, 1.0009, 1.0006, 1.0004, 1.0002, 1, 1, 0.9999, 0.9999, 0.9999, 1)";
const SPRING_MS = 900;

function Collapse({ open, id, children }: { open: boolean; id: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  const anim = useRef<Animation | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (first.current) {
      first.current = false;
      el.hidden = !open;
      return;
    }
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const from = el.hidden ? 0 : el.offsetHeight; // pick up from wherever a half-finished animation is
    anim.current?.cancel();
    if (open) el.hidden = false;
    const to = open ? el.scrollHeight : 0;
    if (still || from === to) {
      el.hidden = !open;
      return;
    }
    const a = el.animate([{ height: `${from}px` }, { height: `${to}px` }], { duration: SPRING_MS, easing: SPRING });
    anim.current = a;
    a.onfinish = () => {
      if (!open) el.hidden = true;
      anim.current = null;
    };
  }, [open]);

  useEffect(() => () => anim.current?.cancel(), []);

  return (
    <div className="acc__body" id={id} ref={ref} hidden>
      <div className="acc__inner">{children}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="row">
      <span>{label}</span>
      <span className="row__line" aria-hidden="true" />
      <div className="row__value">{children}</div>
    </div>
  );
}

type Project = (typeof PROJECTS)[number];

function ProjectLogo({ project, className, lazy }: { project: Project; className: string; lazy?: boolean }) {
  return (
    <span className={className} style={{ background: project.color }}>
      {project.logo ? (
        <img
          src={project.logo}
          alt=""
          decoding="async"
          loading={lazy ? "lazy" : undefined}
          style={{ width: `${project.logoSize ?? 45}%` }}
        />
      ) : (
        <span>{project.mark ?? project.name}</span>
      )}
    </span>
  );
}

function PagerItem({ label, project }: { label: string; project: Project }) {
  return (
    <Link to={`/works/${project.id}`} className="pager__item">
      <span className="pager__label">{label}</span>
      <span className="pager__card">
        <ProjectLogo project={project} className="pager__logo" lazy />
        <span className="pager__name">{project.name}</span>
        <span className="pager__tag">{project.deliverables}</span>
      </span>
    </Link>
  );
}

export default function WorkDetail() {
  const { id } = useParams();
  const project = PROJECTS.find((p) => p.id === id);
  const panelId = useId();
  const [openPanel, setOpenPanel] = useState<PanelKey | null>(null);
  const toggle = (k: PanelKey) => setOpenPanel((o) => (o === k ? null : k));

  useEffect(() => {
    window.scrollTo(0, 0);
    setOpenPanel(null);
  }, [id]);

  // Esc or scrolling closes the open panel
  useEffect(() => {
    if (!openPanel) return;
    const startY = window.scrollY;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenPanel(null);
    };
    const onScroll = () => {
      // small threshold so tiny layout shifts while the panel opens don't close it
      if (Math.abs(window.scrollY - startY) > 8) setOpenPanel(null);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll);
    };
  }, [openPanel]);

  if (!project) return <Navigate to="/" replace />;

  const i = PROJECTS.indexOf(project);
  const prev = PROJECTS[(i - 1 + PROJECTS.length) % PROJECTS.length];
  const next = PROJECTS[(i + 1) % PROJECTS.length];

  return (
    <main className="detail">
      <header className="detail__head">
        <div className="detail__headmain">
          <Link to="/" className="detail__back">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M10 3 5 8l5 5" />
            </svg>
            Back to works
          </Link>
          <div className="detail__intro">
            <ProjectLogo project={project} className="detail__mark" />
            <div className="detail__text">
              <h1 className="detail__name">{project.name}</h1>
              <p className="detail__desc">{project.description}</p>
            </div>
          </div>
        </div>

        <div className="detail__panels">
          <div className="acc__stack">
            <div className="acc">
              <PanelBar title="Details" open={openPanel === "details"} controls={`${panelId}-details`} onToggle={() => toggle("details")} />
              <Collapse open={openPanel === "details"} id={`${panelId}-details`}>
                <Row label="Deliverables">{project.deliverables}</Row>
                <Row label="Industry">{project.industry}</Row>
                <Row label="Year">{project.year}</Row>
                {project.link && (
                  <Row label="Project link">
                    <a href={project.link} target="_blank" rel="noopener noreferrer">
                      {project.link.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                    </a>
                  </Row>
                )}
              </Collapse>
            </div>

            <div className="acc">
              <PanelBar
                title="Collaborators"
                open={openPanel === "collaborators"}
                controls={`${panelId}-collaborators`}
                onToggle={() => toggle("collaborators")}
              />
              <Collapse open={openPanel === "collaborators"} id={`${panelId}-collaborators`}>
                {project.collaborators.map((c) => (
                  <Row key={c.role + c.name} label={c.role}>
                    {c.name}
                  </Row>
                ))}
              </Collapse>
            </div>
          </div>
        </div>
      </header>

      <button
        type="button"
        className="detail__overlay"
        data-open={openPanel ? "" : undefined}
        aria-label="Close panel"
        tabIndex={-1}
        onClick={() => setOpenPanel(null)}
      />

      <section className="detail__gallery" aria-label={`${project.name} images`}>
        {project.images.map((src, i) => (
          <picture key={src}>
            <source type="image/avif" srcSet={srcSet(src, "avif")} sizes="(max-width: 700px) 100vw, 50vw" />
            <source type="image/webp" srcSet={srcSet(src, "webp")} sizes="(max-width: 700px) 100vw, 50vw" />
            <img
              src={src}
              alt={`${project.name} ${i + 1}`}
              width={864}
              height={820}
              decoding="async"
              loading={i < 2 ? "eager" : "lazy"}
              fetchPriority={i === 0 ? "high" : undefined}
            />
          </picture>
        ))}
      </section>

      <nav className="pager" aria-label="More projects">
        <div className="pager__row">
          <PagerItem label="Previous" project={prev} />
          <PagerItem label="Next" project={next} />
        </div>
        <Link to="/" className="pager__all">
          All projects
        </Link>
      </nav>
    </main>
  );
}