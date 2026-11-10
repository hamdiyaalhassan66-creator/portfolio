import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import App from "./App";
import "@fontsource-variable/inter";
import "@fontsource/azeret-mono/500.css";
import "./index.css";

gsap.registerPlugin(useGSAP, ScrollTrigger);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);