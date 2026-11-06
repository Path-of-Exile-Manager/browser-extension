// Отслеживание переходов по сайту торговли.
// Сайт — одностраничное приложение и меняет адрес через history.pushState. Хук в мире страницы
// (page-hook.ts) шлёт событие на каждый pushState/replaceState; плюс popstate (назад/вперёд).
// Редкий опрос раз в секунду — подстраховка, если хук не успел встать (Better Trading опрашивал адрес каждые 500 мс).
import { parseTradePath, sameLocation } from "@/shared/location";
import type { TradeLocation } from "@/shared/types";

export const NAVIGATE_EVENT = "poe-manager:navigate";

export function currentLocation(): TradeLocation {
  return parseTradePath(window.location.pathname);
}

export function watchNavigation(onChange: (loc: TradeLocation, prev: TradeLocation) => void): () => void {
  let last = currentLocation();
  const check = () => {
    const next = currentLocation();
    if (sameLocation(next, last)) return;
    const prev = last;
    last = next;
    onChange(next, prev);
  };
  // Адрес меняется синхронно внутри pushState, но проверяем в следующем такте — после обработчиков сайта.
  const deferred = () => setTimeout(check, 0);
  window.addEventListener(NAVIGATE_EVENT, deferred);
  window.addEventListener("popstate", deferred);
  const timer = window.setInterval(() => {
    if (document.visibilityState === "visible") check();
  }, 1000);
  return () => {
    window.removeEventListener(NAVIGATE_EVENT, deferred);
    window.removeEventListener("popstate", deferred);
    window.clearInterval(timer);
  };
}
