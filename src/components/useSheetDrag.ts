import { useEffect, useRef, type MutableRefObject, type RefObject } from "react";
import { animate, type spring } from "animejs";

type Opts = {
  drawerRef: RefObject<HTMLElement | null>;
  overlayRef: RefObject<HTMLElement | null>;
  gripRef: RefObject<HTMLElement | null>; // the bar you grab
  closing: MutableRefObject<boolean>;
  ease: ReturnType<typeof spring>;
  onClose: () => void;
  enabled?: boolean;
};

const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b);
// pulling the wrong way (up) stretches with growing resistance, capped near 90px
const rubber = (d: number) => (1 - 1 / ((d * 0.55) / 90 + 1)) * 90;

export function useSheetDrag({ drawerRef, overlayRef, gripRef, closing, ease, onClose, enabled = true }: Opts) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const grip = gripRef.current;
    const sheet = drawerRef.current;
    const overlay = overlayRef.current;
    if (!enabled || !grip || !sheet || !overlay) return;

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const paper = document.createElement("div"); // wrinkles and creases, styled in LoreDrawer.css
    paper.className = "drawer__paper";
    paper.setAttribute("aria-hidden", "true");
    sheet.appendChild(paper);
    let w = 0; // how wrinkled the paper is right now, 0 to 1
    let id = -1;
    let startX = 0;
    let startY = 0;
    let dx = 0;
    let dy = 0;
    let y = 0; // what's drawn, which trails the finger
    let r = 0;
    let height = 1;
    let lastY = 0;
    let lastT = 0;
    let vx = 0;
    let vy = 0; // px per ms
    let lastX = 0;
    let baseL = 0; // sheet's resting position, for turning the pointer into sheet coordinates
    let baseT = 0;
    let bx = 0; // where the shading is drawn, trails the finger
    let by = 0;
    let ang = 0;
    let spd = 0;
    let raf = 0;

    const targetY = () => (dy >= 0 ? dy : -rubber(-dy));
    const targetR = () => (still ? 0 : clamp(dx * 0.03, -4, 4)); // the sheet swings below the point you hold

    const tick = () => {
      y += (targetY() - y) * 0.4; // the lag is what makes it feel like it has weight
      r += (targetR() - r) * 0.18;
      sheet.style.transform = `translate3d(0, ${y}px, 0) rotate(${r}deg)`;
      const live = performance.now() - lastT < 80 ? Math.hypot(vx, vy) : 0; // 0 once the finger rests
      spd += (live - spd) * 0.2;
      if (spd > 0.08) ang = Math.atan2(vy, vx); // keeps the last direction while slowing to a stop
      const wt = still ? 0 : clamp(Math.max(Math.abs(dy) / (height * 0.35), spd * 0.6), 0, 1);
      w += (wt - w) * 0.25;
      bx += (lastX - baseL - bx) * 0.2; // the shading trails the finger
      by += (lastY - baseT - y - by) * 0.2;
      paper.style.setProperty("--wrinkle", w.toFixed(3));
      paper.style.setProperty("--bx", `${bx.toFixed(1)}px`);
      paper.style.setProperty("--by", `${by.toFixed(1)}px`);
      paper.style.setProperty("--ang", `${ang.toFixed(3)}rad`);
      paper.style.setProperty("--str", (1 + clamp(spd * 1.2, 0, 1.3)).toFixed(2));
      overlay.style.opacity = String(1 - clamp(y / height, 0, 1) * 0.9);
      raf = requestAnimationFrame(tick);
    };

    const down = (e: PointerEvent) => {
      if (e.button !== 0 || closing.current || id !== -1) return;
      if ((e.target as Element).closest("button, a")) return; // the close button keeps working
      id = e.pointerId;
      grip.setPointerCapture(id);
      const rect = sheet.getBoundingClientRect();
      height = rect.height;
      baseL = rect.left;
      baseT = rect.top;
      lastX = e.clientX;
      bx = e.clientX - rect.left;
      by = e.clientY - rect.top;
      sheet.style.transformOrigin = `${e.clientX - rect.left}px ${e.clientY - rect.top}px`; // pivot where you grabbed
      paper.style.setProperty("--gx", `${e.clientX - rect.left}px`); // the creases fan out from this point
      paper.style.setProperty("--gy", `${e.clientY - rect.top}px`);
      sheet.style.willChange = "transform";
      sheet.dataset.grabbed = "";
      startX = e.clientX;
      startY = e.clientY;
      lastY = e.clientY;
      lastT = performance.now();
      dx = dy = y = r = vx = vy = w = spd = 0;
      raf = requestAnimationFrame(tick);
    };

    const move = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      dx = e.clientX - startX;
      dy = e.clientY - startY;
      const now = performance.now();
      const dt = now - lastT;
      if (dt > 0) {
        vx = vx * 0.6 + ((e.clientX - lastX) / dt) * 0.4;
        vy = vy * 0.6 + ((e.clientY - lastY) / dt) * 0.4;
      }
      lastX = e.clientX;
      lastY = e.clientY;
      lastT = now;
    };

    const up = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      cancelAnimationFrame(raf);
      id = -1;
      if (grip.hasPointerCapture(e.pointerId)) grip.releasePointerCapture(e.pointerId);
      delete sheet.dataset.grabbed;
      paper.style.setProperty("--wrinkle", "0"); // fades out through the CSS transition
      if (performance.now() - lastT > 80) vy = 0; // held still before letting go, so no flick
      const fade = Number(overlay.style.opacity || 1);

      if (y > height * 0.3 || (vy > 0.6 && y > 24)) {
        closing.current = true;
        animate(overlay, { opacity: [fade, 0], duration: 250, ease: "outQuad" });
        animate(sheet, {
          y: [`${y}px`, `${height * 1.05}px`],
          rotate: [`${r}deg`, "0deg"],
          ease,
          onComplete: () => onCloseRef.current(),
        });
      } else {
        animate(overlay, { opacity: [fade, 1], duration: 200, ease: "outQuad" });
        animate(sheet, {
          y: [`${y}px`, "0px"],
          rotate: [`${r}deg`, "0deg"],
          ease,
          onComplete: () => {
            sheet.style.transformOrigin = "";
            sheet.style.willChange = "";
          },
        });
      }
    };

    grip.addEventListener("pointerdown", down);
    grip.addEventListener("pointermove", move);
    grip.addEventListener("pointerup", up);
    grip.addEventListener("pointercancel", up);
    return () => {
      cancelAnimationFrame(raf);
      paper.remove();
      grip.removeEventListener("pointerdown", down);
      grip.removeEventListener("pointermove", move);
      grip.removeEventListener("pointerup", up);
      grip.removeEventListener("pointercancel", up);
    };
  }, [enabled, drawerRef, overlayRef, gripRef, closing, ease]);
}