import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Home } from "./pages/Home.js";
import { Verify } from "./pages/Verify.js";
import { AdTest } from "./pages/AdTest.js";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/verify" element={<Verify />} />
        <Route path="/ad-test" element={<AdTest />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
