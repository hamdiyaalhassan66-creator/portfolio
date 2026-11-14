import { useEffect, useId, useState } from "react";
import type { ReactNode } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { PROJECTS } from "./projects";
import "./WorkDetail.css";

function Section({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  const bodyId = useId();
  return (
    <section className="section">
      <button type="button" className="section__bar" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen((o) => !o)}>
        <span className="section__title">{title}</span>
        <span className="section__toggle" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 12h12" />
            {!open && <path d="M12 6v12" />}
          </svg>
        </span>
      </button>
      <div className="section__body" id={bodyId} hidden={!open}>
        {children}
      </div>
    </section>
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

function ProjectLogo({ project, className }: { project: Project; className: string }) {
  return (
    <span className={className} style={{ background: project.color }}>
      {project.logo ? (
        <img src={project.logo} alt="" style={{ width: `${project.logoSize ?? 45}%` }} />
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
        <ProjectLogo project={project} className="pager__logo" />
        <span className="pager__name">{project.name}</span>
      </span>
    </Link>
  );
}

export default function WorkDetail() {
  const { id } = useParams();
  const project = PROJECTS.find((p) => p.id === id);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  if (!project) return <Navigate to="/" replace />;

  const i = PROJECTS.indexOf(project);
  const prev = PROJECTS[(i - 1 + PROJECTS.length) % PROJECTS.length];
  const next = PROJECTS[(i + 1) % PROJECTS.length];

  return (
    <main className="detail">
      <div className="detail__main">
        <Link to="/" className="detail__back">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M10 3 5 8l5 5" />
          </svg>
          Back to works
        </Link>

        <div className="detail__title">
          <h1 className="detail__name">{project.name}</h1>
          <ProjectLogo project={project} className="detail__mark" />
        </div>

        <Section title="Project Brief">
          <p className="brief__text">{project.description}</p>
        </Section>

        <Section title="Details">
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
        </Section>

        <Section title="Collaborators">
          {project.collaborators.map((c) => (
            <Row key={c.role + c.name} label={c.role}>
              {c.name}
            </Row>
          ))}
        </Section>

        <nav className="pager" aria-label="More projects">
          <div className="pager__row">
            <PagerItem label="Previous" project={prev} />
            <PagerItem label="Next" project={next} />
          </div>
          <Link to="/" className="pager__all">
            All projects
          </Link>
        </nav>
      </div>

      <section className="detail__gallery" aria-label={`${project.name} images`}>
        {project.images.map((src, i) => (
          <img key={src} src={src} alt={`${project.name} ${i + 1}`} loading={i === 0 ? "eager" : "lazy"} />
        ))}
      </section>
    </main>
  );
}