// Макет сайта торговли: заглушка chrome.*, строки результатов, тот же content script, что и в сборке.
import type { BridgeState } from "../src/shared/messages";
import { installChromeMock, setMockBridgeStatus } from "./chrome-mock";
import { ROWS, rowHtml } from "./mock-rows";
import "../src/content/generated/tokens-scoped.css";
import "../src/content/content.css";

installChromeMock();

const SEARCH_PATH = "/trade/search/Mercenaries/Ab3dE9fQ";

async function seed() {
  const { KEYS, write } = await import("../src/shared/storage");
  const { newFolder, newTrade } = await import("../src/shared/bookmarks");
  const loc = (slug: string) => ({ version: "1" as const, type: "search", slug });
  const build = { ...newFolder({ title: "Билд на молнии", icon: "zap", version: "1" }) };
  build.trades = [
    newTrade("Броня ES + резисты", loc("Ab3dE9fQ")),
    newTrade("Кольцо на крит", loc("Kq9xY2")),
    { ...newTrade("Амулет +1 к уровню камней", loc("Pz7Lm1")), completedAt: new Date().toISOString() },
  ];
  const currency = { ...newFolder({ title: "Валюта и фарм", icon: "coins", version: "1" }) };
  currency.trades = [newTrade("Скарабеи оптом", { version: "1", type: "exchange", slug: "Xc8Vb4" }), newTrade("Divination Cards", loc("Dv4Cr9"))];
  const poe2 = { ...newFolder({ title: "PoE 2 — Monk", icon: "swords", version: "2" }), trades: [] };
  await write(KEYS.bookmarks, { folders: [build, currency, poe2] });
  await write(KEYS.settings, { ...(await import("../src/shared/types")).DEFAULT_SETTINGS, expandedFolderIds: [build.id] });
  const now = Date.now();
  await write(KEYS.history, [
    { id: "h1", version: "1", type: "search", league: "Mercenaries", slug: "Ab3dE9fQ", isLive: false, title: "Body Armour (Rare)", createdAt: new Date(now - 60_000).toISOString() },
    { id: "h2", version: "1", type: "search", league: "Mercenaries", slug: "Kq9xY2", isLive: true, title: "Кольцо на крит", createdAt: new Date(now - 45 * 60_000).toISOString() },
    { id: "h3", version: "2", type: "search", league: "poe2/Rise%20of%20the%20Abyssal", slug: "M0nk55", isLive: false, title: "Quarterstaff (Rare)", createdAt: new Date(now - 26 * 3600_000).toISOString() },
    { id: "h4", version: "1", type: "exchange", league: "Mercenaries", slug: "Xc8Vb4", isLive: false, title: "", createdAt: new Date(now - 3 * 86400_000).toISOString() },
  ]);
}

async function main() {
  const params = new URLSearchParams(window.location.search);
  // ?seed=1 — примеры закладок и истории; ?reset=1 — чистый первый запуск.
  if (params.has("seed") || params.has("reset")) localStorage.clear();
  if (params.has("seed")) await seed();
  // ?bridge=connected | app-closed | not-installed — статус связи с приложением (Native Messaging тут не имитируется).
  const bridge = params.get("bridge");
  if (bridge) await setMockBridgeStatus({ state: bridge as BridgeState, appVersion: bridge === "connected" ? "0.1.0" : null });
  // ?path=/trade/search/Standard/xyz — открыть «другой» поиск (например, ещё не сохранённый).
  history.replaceState(null, "", (params.get("path") ?? SEARCH_PATH) + window.location.search);
  document.getElementById("resultset")!.innerHTML = ROWS.map(rowHtml).join("");
  await import("../src/content/page-hook");
  await import("../src/content/index");
}

void main();
