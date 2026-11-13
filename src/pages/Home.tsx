import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ALL_SHOTS, DEFAULT_SHOTS, PROJECTS, SLIDE_MS } from "./projects";
import "./Home.css";

export default function Home() {
  const [active, setActive] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // restart the slideshow whenever the hovered project changes
  useEffect(() => {
    setTick(0);
    const t = window.setInterval(() => setTick((n) => n + 1), SLIDE_MS);
    return () => window.clearInterval(t);
  }, [active]);

  const list = active ? PROJECTS.find((p) => p.id === active)!.images : DEFAULT_SHOTS;
  const current = list[tick % list.length];

  return (
    <main className="works">
      <div className="works__main">
        <p className="works__intro">
          Lorem ipsum dolor sit amet consectetur. Sed enim leo in velit urna id varius magna. Porttitor viverra maecenas sit at egestas ut sapien id.
        </p>
        <h2 className="works__tab">Recent Works</h2>
        <ul className="works__list">
          {PROJECTS.map((p) => (
            <li key={p.id} className="work" onPointerEnter={() => setActive(p.id)} onPointerLeave={() => setActive(null)}>
              <div className="work__logo" style={{ background: p.color }}>
                {p.logo ? <img src={p.logo} alt="" style={{ width: `${p.logoSize ?? 45}%` }} /> : <span>{p.mark ?? p.name}</span>}
              </div>
              <div className="work__body">
                <div className="work__text">
                  <h3 className="work__name">
                    <Link to={`/works/${p.id}`}>{p.name}</Link>
                  </h3>
                  <p className="work__blurb">{p.blurb}</p>
                </div>
                <ul className="work__tags">
                  {p.tags.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <aside className="works__preview" aria-hidden="true">
        {ALL_SHOTS.map((src) => (
          <img key={src} src={src} alt="" className={"works__shot" + (src === current ? " is-on" : "")} />
        ))}
      </aside>
    </main>
  );
}