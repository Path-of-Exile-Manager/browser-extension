// Сообщения между частями расширения и с приложением poe-manager.
//
//  ┌────────────── вкладка pathofexile.com/trade ──────────────┐
//  │ content script ──postMessage──▶ iframe panel.html (React) │
//  │       ▲  ◀──────postMessage───────┘                       │
//  └───────┼───────────────────────────────────────────────────┘
//          │ порт «trade-tab» (пока он открыт, держим связь с приложением)
//          ▼
//   service worker ──Native Messaging──▶ poe-manager.exe (мост) ──канал──▶ приложение
//
// Данные (закладки, история, закреплённые, настройки) не пересылаются сообщениями:
// обе стороны читают chrome.storage.local и слушают onChanged. Статус связи с приложением —
// в chrome.storage.session (его видит панель).
import type { TradeLocation } from "./types";

export const CONTENT_SOURCE = "poe-manager:content";
export const PANEL_SOURCE = "poe-manager:panel";

/** Content script → панель. */
export type ContentToPanel =
  | {
      source: typeof CONTENT_SOURCE;
      type: "state";
      location: TradeLocation;
      /** Предлагаемое имя для закладки: имя предмета или «Категория (Редкость)» из формы поиска. */
      recommendedTitle: string;
      /** На странице есть результаты поиска (для «Показать в результатах»). */
      visibleItemIds: string[];
    }
  | { source: typeof CONTENT_SOURCE; type: "show-tab"; tab: "pins" };

/** Панель → content script. */
export type PanelToContent =
  | { source: typeof PANEL_SOURCE; type: "ready" }
  | { source: typeof PANEL_SOURCE; type: "navigate"; url: string }
  | { source: typeof PANEL_SOURCE; type: "set-collapsed"; collapsed: boolean }
  | { source: typeof PANEL_SOURCE; type: "reveal-item"; itemId: string };

/** Порт content script → service worker: «открыта вкладка торговли». */
export const TRADE_TAB_PORT = "trade-tab";

/** Service worker → content script (кнопка расширения на панели браузера). */
export type TabMessage = { type: "toggle-panel" };

export function isContentMessage(data: unknown): data is ContentToPanel {
  return typeof data === "object" && data !== null && (data as { source?: unknown }).source === CONTENT_SOURCE;
}

export function isPanelMessage(data: unknown): data is PanelToContent {
  return typeof data === "object" && data !== null && (data as { source?: unknown }).source === PANEL_SOURCE;
}

// ---------- связь с приложением (docs/extension-bridge.md) ----------

/** Имя хоста Native Messaging — его регистрирует приложение (crates/browser-bridge/src/config.rs). */
export const NATIVE_HOST = "com.poemanager.bridge";
export const PROTOCOL_VERSION = 1;

/** Мост / приложение → расширение. */
export type NativeIncoming =
  /** От моста: запущено ли приложение. */
  | { v: 1; type: "app-status"; running: boolean }
  | { v: 1; type: "welcome"; re?: string | null; appVersion: string; protocol: number; features: string[] }
  | { v: 1; type: "error"; re?: string | null; code: string; message: string };

/** Расширение → приложение. */
export type NativeOutgoing = {
  v: 1;
  type: "hello";
  id: string;
  extVersion: string;
  browser: "chrome";
  browserVersion: string | null;
  extensionId: string;
};

export function isNativeIncoming(data: unknown): data is NativeIncoming {
  if (typeof data !== "object" || data === null) return false;
  const m = data as Record<string, unknown>;
  if (m.v !== PROTOCOL_VERSION) return false;
  switch (m.type) {
    case "app-status":
      return typeof m.running === "boolean";
    case "welcome":
      return typeof m.appVersion === "string" && Array.isArray(m.features);
    case "error":
      return typeof m.code === "string" && typeof m.message === "string";
    default:
      return false;
  }
}

/**
 * - `idle` — нет открытых вкладок торговли, связь не нужна;
 * - `connecting` — мост запущен, ждём рукопожатия;
 * - `app-closed` — мост работает, приложение не запущено (сами его не запускаем);
 * - `connected` — рукопожатие прошло;
 * - `not-installed` — Chrome не нашёл хост: приложение не установлено или ни разу не запускалось;
 * - `error` — прочее (ID расширения не разрешён, мост упал).
 */
export type BridgeState = "idle" | "connecting" | "app-closed" | "connected" | "not-installed" | "error";

export type BridgeStatus = {
  state: BridgeState;
  appVersion: string | null;
  features: string[];
  error: string | null;
  updatedAt: number;
};

/** Ключ статуса в chrome.storage.session. */
export const BRIDGE_STATUS_KEY = "pm:bridge";

export const IDLE_STATUS: BridgeStatus = { state: "idle", appVersion: null, features: [], error: null, updatedAt: 0 };
