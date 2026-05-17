import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Always unregister any stale service workers and clear caches so users
// never see outdated pages/components after an update.
if ("serviceWorker" in navigator) {
  window.addEventListener(
    "load",
    () => {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister());
      });
      if ("caches" in window) {
        window.caches.keys().then((keys) => keys.forEach((k) => window.caches.delete(k)));
      }
    },
    { once: true }
  );
}

createRoot(document.getElementById("root")!).render(<App />);
