import { lazy, Suspense, useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import Header from "./components/Header";
import Home from "./pages/Home";

const Work = lazy(() => import("./pages/Work"));
const WorkDetail = lazy(() => import("./pages/WorkDetail"));
const Information = lazy(() => import("./pages/Information"));
const Archive = lazy(() => import("./pages/Archive"));
const Contact = lazy(() => import("./pages/Contact"));
const SideQuests = lazy(() => import("./pages/SideQuests"));
const Lore = lazy(() => import("./pages/Lore"));

// once the browser is idle, fetch the nav pages in the background so tab clicks feel instant
const prefetch = () => {
  const c = (navigator as any).connection;
  if (c?.saveData || /2g/.test(c?.effectiveType ?? "")) return;
  [
    () => import("./pages/SideQuests"),
    () => import("./pages/Information"),
    () => import("./pages/Archive"),
    () => import("./pages/Contact"),
  ].forEach((load) => load());
};

export default function App() {
  useEffect(() => {
    const w = window as any;
    const id = w.requestIdleCallback ? w.requestIdleCallback(prefetch, { timeout: 4000 }) : window.setTimeout(prefetch, 2500);
    return () => (w.requestIdleCallback ? w.cancelIdleCallback(id) : window.clearTimeout(id));
  }, []);
  return (
    <>
<Header />

        <Suspense fallback={<div style={{ minHeight: "100svh" }} />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/works/:id" element={<WorkDetail />} />
          <Route path="/work" element={<Work />} />
          <Route path="/side-quests" element={<SideQuests />} />
          <Route path="/info" element={<Information />} />
          <Route path="/archive" element={<Archive />} />
          <Route path="/lore" element={<Lore />} />
          <Route path="/contact" element={<Contact />} />
        </Routes>
      </Suspense>
    </>
  );
}