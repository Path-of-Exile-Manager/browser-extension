// Content script сайта торговли: раскладка с панелью, навигация, история, заголовок вкладки,
// улучшения результатов, закрепление лотов, связь с панелью (iframe) и service worker.
import { logHistory } from "@/shared/history";
import { isConcreteSearch, sameLocation, TRADE_ORIGIN } from "@/shared/location";
import { CONTENT_SOURCE, isPanelMessage, TRADE_TAB_PORT, type ContentToPanel, type TabMessage } from "@/shared/messages";
import { KEYS, read, subscribe, update, updateSettings } from "@/shared/storage";
import type { EnhancerId, PinnedItem, Settings, TradeLocation } from "@/shared/types";
import { findTradeByLocation } from "@/shared/bookmarks";
import { ResultsEnhancer, visibleItemIds } from "./enhancers";
import { registerFonts } from "./fonts";
import { mountLayout } from "./layout";
import { currentLocation, watchNavigation } from "./navigation";
import { PageTitle } from "./page-title";
import { parseItem, type ParsedRow } from "./row-parser";
import { recommendTitle } from "./search-panel";

const MAX_PINS = 50;

async function main() {
  // Нет приложения торговли (техработы, другая страница) — ничего не встраиваем.
  const tradeApp = document.getElementById("trade");
  if (!tradeApp) return;

  registerFonts();
  keepTradeTabPort();
  const panelUrl = chrome.runtime.getURL("panel.html");
  const panelOrigin = new URL(panelUrl).origin;
  const layout = mountLayout(panelUrl);

  let settings: Settings = await read(KEYS.settings);
  let bookmarks = await read(KEYS.bookmarks);
  let pins = await read(KEYS.pins);
  let location = currentLocation();
  layout.setCollapsed(settings.collapsed);

  const setCollapsed = (collapsed: boolean) => {
    layout.setCollapsed(collapsed);
    void updateSettings({ collapsed });
  };
  layout.onToggleRequest(setCollapsed);

  // ---------- связь с панелью ----------
  const post = (message: ContentToPanel) => layout.frame.contentWindow?.postMessage(message, panelOrigin);
  let lastState = "";
  const sendState = (force = false) => {
    const message: ContentToPanel = {
      source: CONTENT_SOURCE,
      type: "state",
      location,
      recommendedTitle: recommendTitle(),
      visibleItemIds: visibleItemIds(),
    };
    const json = JSON.stringify(message);
    if (!force && json === lastState) return;
    lastState = json;
    post(message);
  };

  window.addEventListener("message", (event) => {
    if (event.source !== layout.frame.contentWindow || event.origin !== panelOrigin || !isPanelMessage(event.data)) return;
    const message = event.data;
    switch (message.type) {
      case "ready":
        sendState(true);
        break;
      case "set-collapsed":
        setCollapsed(message.collapsed);
        break;
      case "navigate":
        // Только адреса сайта торговли.
        if (message.url.startsWith(`${TRADE_ORIGIN}/trade`) || message.url.startsWith("https://pathofexile.com/trade")) {
          window.location.assign(message.url);
        }
        break;
      case "reveal-item":
        revealItem(message.itemId);
        break;
    }
  });

  // ---------- заголовок вкладки ----------
  const title = new PageTitle();
  title.recalculate(location, bookmarks);
  let lastRecommended = recommendTitle();

  // ---------- история ----------
  // Форма поиска заполняется не сразу после смены адреса, поэтому пишем с задержкой
  // и ещё раз позже — дописать имя, если в первый раз его не было.
  const scheduleHistory = (loc: TradeLocation) => {
    if (!isConcreteSearch(loc)) return;
    for (const delay of [1200, 4000]) {
      window.setTimeout(() => {
        if (sameLocation(currentLocation(), loc)) void logHistory(loc, recommendTitle());
      }, delay);
    }
  };
  scheduleHistory(location);

  // ---------- улучшения результатов ----------
  const pinnedIds = () => new Set(pins.map((p) => p.id));

  const togglePin = (row: HTMLElement, parsed: ParsedRow) => {
    const id = parsed.id;
    const wasPinned = pins.some((p) => p.id === id);
    if (!wasPinned) {
      const pinned: PinnedItem = {
        id,
        pinnedAt: new Date().toISOString(),
        location,
        searchTitle: findTradeByLocation(bookmarks, location)?.trade.title || recommendTitle(),
        item: parseItem(row),
        price: parsed.price,
        seller: parsed.seller,
      };
      void update(KEYS.pins, (all) => [pinned, ...all.filter((p) => p.id !== id)].slice(0, MAX_PINS));
      post({ source: CONTENT_SOURCE, type: "show-tab", tab: "pins" });
      if (layout.isCollapsed()) setCollapsed(false);
    } else {
      void update(KEYS.pins, (all) => all.filter((p) => p.id !== id));
    }
  };

  const enhancer = new ResultsEnhancer({
    getLocation: () => location,
    isEnabled: (id: EnhancerId) => !settings.disabledEnhancers.includes(id),
    getPinnedIds: pinnedIds,
    togglePin,
  });
  enhancer.start(tradeApp.parentElement ?? tradeApp);

  // ---------- подписки ----------
  watchNavigation((loc) => {
    location = loc;
    title.recalculate(loc, bookmarks);
    sendState();
    scheduleHistory(loc);
  });

  subscribe(KEYS.bookmarks, (value) => {
    bookmarks = value;
    title.recalculate(location, bookmarks);
  });
  subscribe(KEYS.pins, (value) => {
    pins = value;
    enhancer.refreshPins(pinnedIds());
  });
  subscribe(KEYS.settings, (value) => {
    const enhancersChanged = value.disabledEnhancers.join() !== settings.disabledEnhancers.join();
    settings = value;
    if (value.collapsed !== layout.isCollapsed()) layout.setCollapsed(value.collapsed);
    if (enhancersChanged) enhancer.reset();
  });

  chrome.runtime.onMessage.addListener((message: TabMessage) => {
    if (message?.type === "toggle-panel") setCollapsed(!layout.isCollapsed());
  });

  // Форма поиска и список результатов меняются без смены адреса: раз в секунду сверяем и шлём панели.
  window.setInterval(() => {
    if (document.visibilityState !== "visible") return;
    sendState();
    const recommended = recommendTitle();
    if (recommended !== lastRecommended) {
      lastRecommended = recommended;
      title.recalculate(location, bookmarks);
    }
  }, 1000);
}

/**
 * Порт «открыта вкладка торговли»: пока хоть один такой порт открыт, service worker держит связь
 * с приложением poe-manager. Service worker может перезапуститься — тогда порт закроется,
 * и мы откроем его заново. Если расширение обновили или выключили, chrome.runtime.id пропадает — выходим.
 */
function keepTradeTabPort() {
  const open = () => {
    if (!chrome.runtime?.id) return;
    try {
      const port = chrome.runtime.connect({ name: TRADE_TAB_PORT });
      port.onDisconnect.addListener(() => {
        void chrome.runtime.lastError;
        window.setTimeout(open, 1000);
      });
    } catch {
      // Контекст расширения уничтожен (расширение обновили) — эта страница больше не наша.
    }
  };
  open();
}

function revealItem(itemId: string) {
  const row = document.querySelector<HTMLElement>(`.resultset > div.row[data-id="${CSS.escape(itemId)}"]`);
  if (!row) return;
  row.scrollIntoView({ block: "center", behavior: "smooth" });
  row.classList.add("pmgr-reveal");
  window.setTimeout(() => row.classList.remove("pmgr-reveal"), 1600);
}

void main();
