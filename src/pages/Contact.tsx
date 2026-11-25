import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import "./InfoButton.css"; // the Info button's styles, so Close looks exactly like it (adjust the path if the file lives elsewhere)
import "./Contact.css";

const EMAIL = "hamdiyaalhassan66@gmail.com";
const PHONE = "+233 54 330 9548";

// same five heads as the Figma strip, same images as the Information page
const FACES = [
  { id: "a", src: "face-purple.png" },
  { id: "b", src: "face-red.png" },
  { id: "c", src: "face-lime.png" },
  { id: "d", src: "portrait-burgundy.png", sticker: "glasses-sticker.png" },
];

const SOCIALS = [
  { label: "LinkedIn", href: "#" }, // TODO: your profile links
  { label: "Instagram", href: "#" },
  { label: "X", href: "#" },
];

// one row: a grey label bar on the left, the values on the right
function Row({ label, tall, children }: { label: string; tall?: boolean; children: ReactNode }) {
  return (
    <div className={"contact__row" + (tall ? " contact__row--tall" : "")}>
      <h2 className="contact__label">{label}</h2>
      <div className="contact__vals">{children}</div>
    </div>
  );
}

// the phone number copies on click
function Phone({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setDone(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setDone(false), 1500);
    } catch {
      /* clipboard blocked: nothing to do */
    }
  };

  return (
    <button type="button" className="contact__phone" onClick={copy} aria-label={`Copy ${value}`}>
      <span>{value}</span>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M13.9987 1.33337C14.1755 1.33337 14.3451 1.40361 14.4701 1.52864C14.5951 1.65366 14.6654 1.82323 14.6654 2.00004V11.3334C14.6654 11.5102 14.5951 11.6798 14.4701 11.8048C14.3451 11.9298 14.1755 12 13.9987 12C13.8219 12 13.6523 11.9298 13.5273 11.8048C13.4023 11.6798 13.332 11.5102 13.332 11.3334V2.66671H4.66536C4.48855 2.66671 4.31898 2.59647 4.19396 2.47145C4.06894 2.34642 3.9987 2.17685 3.9987 2.00004C3.9987 1.82323 4.06894 1.65366 4.19396 1.52864C4.31898 1.40361 4.48855 1.33337 4.66536 1.33337H13.9987ZM1.33203 14V4.66671C1.33203 4.4899 1.40227 4.32033 1.52729 4.1953C1.65232 4.07028 1.82189 4.00004 1.9987 4.00004H11.332C11.5088 4.00004 11.6784 4.07028 11.8034 4.1953C11.9285 4.32033 11.9987 4.4899 11.9987 4.66671V14C11.9987 14.1769 11.9285 14.3464 11.8034 14.4714C11.6784 14.5965 11.5088 14.6667 11.332 14.6667H1.9987C1.82189 14.6667 1.65232 14.5965 1.52729 14.4714C1.40227 14.3464 1.33203 14.1769 1.33203 14Z"
          fill="currentColor"
        />
      </svg>
      <span className="contact__copied" aria-live="polite">{done ? "Copied" : ""}</span>
    </button>
  );
}

export default function Contact() {
  const navigate = useNavigate();
  // go back to where you came from, or to the work page if this is the first page opened
  const close = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate("/"));

  // the page is one screen, nothing scrolls while it is open
  useEffect(() => {
    const html = document.documentElement;
    const prev = [html.style.overflow, document.body.style.overflow];
    html.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prev[0];
      document.body.style.overflow = prev[1];
    };
  }, []);

  return (
    <main className="contact">
      {/* blurred strip of faces, loops like the Information page */}
      <div className="contact__faces" aria-hidden="true">
        <div className="contact__track">
          {[...FACES, ...FACES, ...FACES].map((f, i) => (
            <div className={`contact__face contact__face--${f.id}`} key={i}>
              <img src={`/information/${f.src}`} alt="" draggable={false} decoding="async" loading={i < FACES.length ? "eager" : "lazy"} />
              {f.sticker && (
                <img className="contact__sticker" src={`/information/${f.sticker}`} alt="" draggable={false} decoding="async" />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="contact__content">
        <Row label="Reach me" tall>
          <a className="contact__link" href={`mailto:${EMAIL}`}>{EMAIL}</a>
          <Phone value={PHONE} />
        </Row>

        <Row label="For collaborations" tall>
          <a className="contact__link" href={`mailto:${EMAIL}?subject=Collaboration`}>{EMAIL}</a>
        </Row>

        <Row label="Start a project">
          <a className="contact__link" href={`mailto:${EMAIL}?subject=Project%20enquiry`}>{EMAIL}</a>
        </Row>

        <Row label="Socials">
          {SOCIALS.map((s) => (
            <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer">
              {s.label}
            </a>
          ))}
        </Row>
      </div>

      <button type="button" className="ibtn contact__x" onClick={close}>
        <span>Close</span>
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M3.3 2.2 8 6.9l4.7-4.7 1.1 1.1L9.1 8l4.7 4.7-1.1 1.1L8 9.1l-4.7 4.7-1.1-1.1L6.9 8 2.2 3.3z" fill="currentColor" />
        </svg>
      </button>
    </main>
  );
}