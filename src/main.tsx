import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Disable service workers in Lovable preview/iframe contexts to prevent
// stale caching and constant page reload loops.
const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com");

if (isPreviewHost || isInIframe) {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister());
      });
      if ("caches" in window) {
        window.caches.keys().then((keys) => keys.forEach((k) => window.caches.delete(k)));
      }
    }, { once: true });
  }
}

createRoot(document.getElementById("root")!).render(<App />);
