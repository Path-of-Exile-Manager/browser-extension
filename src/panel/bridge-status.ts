// Статус связи с приложением poe-manager: пишет service worker (background/bridge.ts)
// в chrome.storage.session, панель только читает.
import { useEffect, useState } from "react";
import type { Status } from "@/design-system";
import { BRIDGE_STATUS_KEY, IDLE_STATUS, type BridgeStatus } from "@/shared/messages";

export function useBridgeStatus(): BridgeStatus {
  const [status, setStatus] = useState<BridgeStatus>(IDLE_STATUS);
  useEffect(() => {
    const session = chrome.storage?.session;
    if (!session) return;
    let alive = true;
    void session.get(BRIDGE_STATUS_KEY).then((r) => {
      if (alive && r[BRIDGE_STATUS_KEY]) setStatus(r[BRIDGE_STATUS_KEY] as BridgeStatus);
    });
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === "session" && BRIDGE_STATUS_KEY in changes) setStatus((changes[BRIDGE_STATUS_KEY].newValue as BridgeStatus) ?? IDLE_STATUS);
    };
    chrome.storage.onChanged.addListener(listener);
    return () => {
      alive = false;
      chrome.storage.onChanged.removeListener(listener);
    };
  }, []);
  return status;
}

export type BridgeView = {
  status: Status;
  /** Коротко — для подсказки значка и плашки. */
  label: string;
  /** Что делать пользователю. */
  hint: string;
};

/**
 * Отсутствие приложения — не ошибка: расширение работает и без него (решение 15),
 * поэтому такие состояния нейтральные (info), предупреждение — только при настоящей ошибке.
 */
export function describeBridge(s: BridgeStatus): BridgeView {
  switch (s.state) {
    case "connected":
      return {
        status: "success",
        label: s.appVersion ? `Приложение на связи · ${s.appVersion}` : "Приложение на связи",
        hint: "Связь работает, пока открыта вкладка сайта торговли.",
      };
    case "app-closed":
      return {
        status: "info",
        label: "Приложение не запущено",
        hint: "Запустите poe-manager — связь появится сама. Расширение работает и без приложения.",
      };
    case "not-installed":
      return {
        status: "info",
        label: "Приложение не найдено",
        hint: "Установите poe-manager и запустите его хотя бы раз: при запуске оно само подключается к Chrome.",
      };
    case "error":
      return { status: "warning", label: "Ошибка связи с приложением", hint: s.error ?? "Неизвестная ошибка. Повторим через несколько секунд." };
    case "connecting":
    case "idle":
      return { status: "info", label: "Подключение к приложению…", hint: "Ищем запущенное приложение poe-manager." };
  }
}
