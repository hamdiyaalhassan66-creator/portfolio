import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import Header from "./components/Header";
import Home from "./pages/Home";
import Work from "./pages/Work";
import About from "./pages/About";
import Contact from "./pages/Contact";

const Lab = lazy(() => import("./pages/Lab"));
const Lore = lazy(() => import("./pages/Lore"));

export default function App() {
  return (
    <>
<Header />

      <Suspense fallback={<p style={{ padding: 24 }}>Loading…</p>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/work" element={<Work />} />
          <Route path="/lab" element={<Lab />} />
          <Route path="/information" element={<About />} />
          <Route path="/lore" element={<Lore />} />
          <Route path="/contact" element={<Contact />} />
        </Routes>
      </Suspense>
    </>
  );
}