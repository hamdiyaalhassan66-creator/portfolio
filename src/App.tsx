import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import Header from "./components/Header";
import Home from "./pages/Home";
import Work from "./pages/Work";
import Information from "./pages/Information";
import Archive from "./pages/Archive";
import Contact from "./pages/Contact";
import WorkDetail from "./pages/WorkDetail";
import SideQuests from "./pages/SideQuests";

const Lore = lazy(() => import("./pages/Lore"));

export default function App() {
  return (
    <>
<Header />

      <Suspense fallback={<p style={{ padding: "24px 0" }}>Loading…</p>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/works/:id" element={<WorkDetail />} />
          <Route path="/work" element={<Work />} />
          <Route path="/lab" element={<SideQuests />} />
          <Route path="/information" element={<Information />} />
          <Route path="/archive" element={<Archive />} />
          <Route path="/lore" element={<Lore />} />
          <Route path="/contact" element={<Contact />} />
        </Routes>
      </Suspense>
    </>
  );
}