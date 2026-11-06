// Service worker расширения.
// 1. Связь с приложением poe-manager (Native Messaging) — bridge.ts.
// 2. Кнопка расширения на панели браузера: на сайте торговли сворачивает/разворачивает панель,
//    на других сайтах открывает сайт торговли.
// 3. Уборка: при обновлении удаляем данные, которые больше не используются.
import type { TabMessage } from "@/shared/messages";
import { OBSOLETE_KEYS } from "@/shared/storage";
import { Bridge, chromeApi } from "./bridge";

new Bridge(chromeApi()).start();

chrome.runtime.onInstalled.addListener(() => {
  void chrome.storage.local.remove(OBSOLETE_KEYS);
});

chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id === undefined) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "toggle-panel" } satisfies TabMessage);
  } catch {
    // На вкладке нет нашего content script — это не сайт торговли.
    await chrome.tabs.create({ url: "https://www.pathofexile.com/trade" });
  }
});
