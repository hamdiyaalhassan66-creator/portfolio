import { lazy, Suspense } from "react";
import { Routes, Route, Link } from "react-router-dom";
import Home from "./pages/Home";
import Work from "./pages/Work";
import About from "./pages/About";
import Contact from "./pages/Contact";

const Lab = lazy(() => import("./pages/Lab"));

export default function App() {
  return (
    <>
      <nav style={{ display: "flex", gap: 24, padding: 24 }}>
        <Link to="/">Home</Link>
        <Link to="/work">Work</Link>
        <Link to="/lab">Lab</Link>
        <Link to="/about">About</Link>
        <Link to="/contact">Contact</Link>
      </nav>

      <Suspense fallback={<p style={{ padding: 24 }}>Loading…</p>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/work" element={<Work />} />
          <Route path="/lab" element={<Lab />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
        </Routes>
      </Suspense>
    </>
  );
}