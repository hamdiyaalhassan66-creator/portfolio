import { useEffect, useRef, useState } from "react";
import ThreadIndex from "../components/ThreadIndex";
import Bobblehead from "../components/Bobblehead";
import Lanyard from "../components/Lanyard";
import "./Information.css";

// the cut-out head shots; hovering the head steps to the next one
const PORTRAITS = [
  "/information/portrait.png",
  "/information/portrait-2.png",
  "/information/portrait-3.png",
  "/information/portrait-4.png",
];

const WORK = [
  { role: "Product Designer", place: "Refine Studio", years: "2024 - 2025" },
  { role: "Web Designer & Framer Developer", place: "Oxegene", years: "2023 - Present" },
  { role: "UI/UX Designer", place: "Freelance", years: "2022 - Present" },
];

export default function Information() {
  const headRef = useRef<HTMLDivElement>(null);
  const [face, setFace] = useState(0);
  const timer = useRef<number | undefined>(undefined);

  const stop = () => {
    window.clearInterval(timer.current);
    timer.current = undefined;
  };

  const handleEnter = () => {
    if (timer.current !== undefined) return;
    setFace((f) => (f + 1) % PORTRAITS.length); // step right away
    timer.current = window.setInterval(() => {
      setFace((f) => (f + 1) % PORTRAITS.length);
    }, 150); // change 150 to speed up or slow down
  };

  useEffect(() => stop, []); // clear on unmount
  useEffect(() => {
    PORTRAITS.forEach((src) => {
      const img = new Image();
      img.src = src;
    }); // preload so the swap never flashes
  }, []);
  return (
    <main className="information">
      <div
        className="information__head"
        ref={headRef}
        onPointerEnter={handleEnter}
        onPointerLeave={stop}
      >
        <img
          src={PORTRAITS[face]}
          alt="Portrait of Dee"
          draggable={false}
        />
      </div>
      <Bobblehead />
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
            I’m opened to any<em> freelance projects, collaborations, or full-time opportunities</em>.
          </p>
        </div>

        <div className="information__work">
          <h2 className="information__work-title">Where I’ve worked at so far</h2>
          <div className="information__work-list">
            {WORK.map((w, i) => (
              <div className="information__job" key={i}>
                <div>
                  <div className="information__role">{w.role}</div>
                  <div>{w.place}</div>
                </div>
                <span className="information__dash" />
                <span className="information__years">{w.years}</span>
              </div>
            ))}
          </div>
        </div>

        <Lanyard />
      </div>

      <ThreadIndex headRef={headRef} />
    </main>
  );
}