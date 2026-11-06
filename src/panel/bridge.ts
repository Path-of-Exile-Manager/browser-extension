// Связь панели (iframe) со страницей сайта торговли через content script.
import { create } from "zustand";
import { isContentMessage, PANEL_SOURCE, type PanelToContent } from "@/shared/messages";
import { updateSettings } from "@/shared/storage";
import type { TradeLocation } from "@/shared/types";

type TradeContext = {
  /** Панель встроена в страницу и получила от неё состояние. */
  connected: boolean;
  location: TradeLocation | null;
  recommendedTitle: string;
  visibleItemIds: string[];
};

export const useTrade = create<TradeContext>(() => ({
  connected: false,
  location: null,
  recommendedTitle: "",
  visibleItemIds: [],
}));

function parentOrigin(): string {
  // Сайт торговли бывает и на www., и без него. ancestorOrigins есть в Chromium.
  return window.location.ancestorOrigins?.[0] ?? "*";
}

/** Сообщение без поля source (его добавляет post). */
type Outgoing = PanelToContent extends infer M ? (M extends PanelToContent ? Omit<M, "source"> : never) : never;

function post(message: Outgoing) {
  if (window.parent === window) return;
  window.parent.postMessage({ source: PANEL_SOURCE, ...message }, parentOrigin());
}

export function startBridge() {
  window.addEventListener("message", (event) => {
    // Принимаем только сообщения окна, в которое встроена панель.
    if (event.source !== window.parent || window.parent === window || !isContentMessage(event.data)) return;
    const message = event.data;
    if (message.type === "state") {
      useTrade.setState({
        connected: true,
        location: message.location,
        recommendedTitle: message.recommendedTitle,
        visibleItemIds: message.visibleItemIds,
      });
    } else if (message.type === "show-tab") {
      void updateSettings({ tab: message.tab });
    }
  });
  post({ type: "ready" });
}

/** Перейти по адресу сайта торговли: в этой вкладке — через страницу, в новой — сами. */
export function openTradeUrl(url: string, newTab = false) {
  if (newTab || window.parent === window) {
    window.open(url, "_blank", "noopener");
    return;
  }
  post({ type: "navigate", url });
}

export function collapsePanel() {
  post({ type: "set-collapsed", collapsed: true });
}

export function revealItem(itemId: string) {
  post({ type: "reveal-item", itemId });
}
