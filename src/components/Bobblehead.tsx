import { useEffect, useRef } from "react";

const SRC = "/information/bobblehead.png";
const PIVOT_X = 0.487; // where the spring sits across the image (fraction of width)

// a bobblehead: drag it and it leans toward the cursor; let go and it wiggles back on a loose spring
export default function Bobblehead() {
  const boxRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const w = useRef({ a: 0, v: 0, target: 0, drag: false }); // angle, speed, where the pull wants it, being held

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const k = Math.min((now - last) / 16.67, 2); // 1 = a 60fps frame, so it feels the same on any screen
      last = now;
      const s = w.current;
      const el = imgRef.current;
      if (!el) return;
      if (!s.drag && Math.abs(s.a) < 0.01 && Math.abs(s.v) < 0.01) {
        if (s.a !== 0) { s.a = 0; s.v = 0; el.style.transform = ""; }
        return; // at rest
      }
      s.v += ((s.drag ? s.target : 0) - s.a) * (s.drag ? 0.3 : 0.12) * k; // held: tight follow. released: loose swing
      s.v *= Math.pow(s.drag ? 0.7 : 0.93, k); // released: closer to 1 = more wiggles
      s.a += s.v * k;
      el.style.transform = `rotate(${s.a}deg)`;
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  // every few seconds, if it's resting, give it a little bump so people know it can be pulled
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let t = 0;
    const nudge = () => {
      const s = w.current;
      if (!s.drag && Math.abs(s.a) < 0.5 && Math.abs(s.v) < 0.5) {
        s.v += (Math.random() < 0.5 ? -1 : 1) * 1.8; // bump strength (higher = bigger rock)
      }
      t = window.setTimeout(nudge, 5000 + Math.random() * 4000); // next one in 5 to 9 seconds
    };
    t = window.setTimeout(nudge, 2500); // first one shortly after the page loads
    return () => window.clearTimeout(t);
  }, []);

  // shake the phone and the head rocks: reads the accelerometer and kicks the swing on a hard jolt
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!("DeviceMotionEvent" in window)) return;
    let px = 0;
    let py = 0;
    let pz = 0;
    let ready = false; // the first reading only sets the baseline
    let lastKick = 0;
    const onMotion = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity;
      if (!a || a.x == null || a.y == null || a.z == null) return;
      const dx = a.x - px;
      const jolt = Math.abs(dx) + Math.abs(a.y - py) + Math.abs(a.z - pz);
      px = a.x;
      py = a.y;
      pz = a.z;
      if (!ready) {
        ready = true;
        return;
      }
      const now = performance.now();
      const s = w.current;
      if (jolt > 15 && now - lastKick > 50 && !s.drag) { // 15 = how hard the shake has to be (lower = more sensitive)
        lastKick = now;
        s.v += Math.max(-6, Math.min(6, -dx * 0.5)); // 6 = strongest single kick
      }
    };
    window.addEventListener("devicemotion", onMotion);
    return () => window.removeEventListener("devicemotion", onMotion);
  }, []);

  // iPhones only send motion data after a one-time permission, which has to be asked from a tap
  const motionAsked = useRef(false);
  const askMotion = () => {
    if (motionAsked.current) return;
    motionAsked.current = true;
    const DME = (window as any).DeviceMotionEvent;
    if (typeof DME?.requestPermission === "function") DME.requestPermission().catch(() => {});
  };

  const pull = (e: React.PointerEvent) => {
    const r = boxRef.current?.getBoundingClientRect();
    if (!r) return;
    const dx = e.clientX - (r.left + r.width * PIVOT_X);
    w.current.target = Math.max(-40, Math.min(40, (dx / r.width) * 80)); // 40 = furthest lean, in degrees
  };

  return (
    <div className="information__bobble">
      <div className="bobble__fig" ref={boxRef}>
        <img className="bobble__body" src={SRC} alt="" draggable={false} />
        <img
          className="bobble__head"
          ref={imgRef}
          src={SRC}
          alt=""
          draggable={false}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            w.current.drag = true;
            pull(e);
          }}
          onPointerMove={(e) => {
            if (w.current.drag) pull(e);
            else w.current.v += Math.max(-4, Math.min(4, e.movementX * 0.1)); // brushing past it gives it a push
          }}
          onPointerUp={() => {
            w.current.drag = false;
            askMotion();
          }}
          onPointerCancel={() => (w.current.drag = false)}
        />
      </div>
    </div>
  );
}