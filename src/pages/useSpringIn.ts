import { useLayoutEffect } from "react";
import type { RefObject } from "react";

// scales the <li> children of a list in, each time `open` turns true
export function useSpringIn(open: boolean, ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!open || !el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.style.visibility = "hidden"; // no flash of the full-size list while animejs loads
    let dead = false;
    let anim: { cancel: () => void } | undefined;
    import("animejs").then(({ animate, stagger }) => {
      if (dead) return;
      el.style.visibility = ""; // show first, so the first frame is the animation's start
      anim = animate(el.querySelectorAll("li"), {
        scale: [0.85, 1],
        opacity: [0, 1],
        translateY: [-6, 0],
        duration: 220,
        delay: stagger(20),
        ease: "outQuart",
      });
    });
    return () => {
      dead = true;
      anim?.cancel();
      el.style.visibility = "";
    };
  }, [open, ref]);
}