import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { DesignSystemProvider } from "@/design-system";
import "./styles.css";
import { App } from "./App";
import { startBridge } from "./bridge";

async function boot() {
  // Разработка вне расширения (pnpm dev): подменяем chrome.* заглушкой на localStorage.
  if (import.meta.env.DEV && !globalThis.chrome?.storage) {
    const { installChromeMock } = await import("../../dev/chrome-mock");
    installChromeMock();
  }
  startBridge();
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <DesignSystemProvider>
        <App />
      </DesignSystemProvider>
    </StrictMode>,
  );
}

void boot();
