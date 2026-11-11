import { useRef } from "react";
import ThreadIndex from "../components/ThreadIndex";
import "./Information.css";

const PORTRAIT = "/information/portrait.png"; // the cut-out head shot, used for both portraits

const WORK = [
  { place: "Refine Studio", role: "Product Designer", years: "2024 - 2025" },
  { place: "Refine Studio", role: "Product Designer", years: "2024 - 2025" },
  { place: "Refine Studio", role: "Product Designer", years: "2024 - 2025" },
]; // placeholder rows, swap in the real ones

export default function Information() {
  const headRef = useRef<HTMLDivElement>(null);
  return (
    <main className="information">
      <div className="information__head" ref={headRef}>
        <img src={PORTRAIT} alt="Portrait of Dee" draggable={false} />
      </div>
      <div className="information__top">
        <div className="information__intro">
          <p>
            I’m Diya, a <em>product and UI/UX designer</em> who also builds what she designs. I also can be called a{" "}
            <em>visual &amp; interaction designer</em>. I’m based in Ghana.
          </p>
          <p>
            I’ve spent <em>4+ years</em> designing interfaces and developing some of them in Framer. I recently started
            building my own apps and tools with the help of AI too. I like owning the whole path, from the first sketch to the
            shipped component.
          </p>
        </div>

        <div className="information__story">
          <p>
            I’ve always been a creative and visual individual growing up and I guess it was natural for me to switch to the
            design path after studying Statistics with Computer Science from the University of Ghana. I used to illustrate,
            and it still shapes how I design. I look for the small, odd detail that makes a screen feel like someone made it.
          </p>
          <p>
            My approach focuses on visual direction, consistency, and story-telling, shaping ideas into visuals that feel
            intentional and relevant. I refine each project according to how I think and see things
          </p>
          <p>
            Currently, I work remotely as a freelancer, but I’m also opened to any <em>full-time opportunities</em>.
          </p>
        </div>

        <div className="information__work">
          <h2 className="information__work-title">Where I’ve worked at so far</h2>
          <div className="information__work-list">
            {WORK.map((w, i) => (
              <div className="information__job" key={i}>
                <div>
                  <div>{w.place}</div>
                  <div>{w.role}</div>
                </div>
                <span className="information__dash" />
                <span className="information__years">{w.years}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      <ThreadIndex headRef={headRef} />
    </main>
  );
}