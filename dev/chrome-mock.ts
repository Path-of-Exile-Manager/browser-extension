// Заглушка chrome.* для разработки вне расширения (pnpm dev, dev/trade-mock.html) и тестов.
// Хранилища — localStorage: панель (iframe) и «страница» на одном origin видят одни данные,
// событие storage пересылает изменения между ними, как chrome.storage.onChanged.
// Native Messaging не имитируется: статус связи с приложением можно задать `setMockBridgeStatus`.
import { BRIDGE_STATUS_KEY, type BridgeStatus } from "@/shared/messages";

type AreaName = "local" | "session";
type Listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => void;

const PREFIX: Record<AreaName, string> = { local: "chrome-mock:", session: "chrome-mock-session:" };

export function installChromeMock() {
  const listeners = new Set<Listener>();
  const emit = (area: AreaName, key: string, oldValue: unknown, newValue: unknown) =>
    listeners.forEach((l) => l({ [key]: { oldValue, newValue } }, area));

  window.addEventListener("storage", (e) => {
    for (const area of ["local", "session"] as const) {
      if (!e.key?.startsWith(PREFIX[area])) continue;
      emit(area, e.key.slice(PREFIX[area].length), e.oldValue && JSON.parse(e.oldValue), e.newValue && JSON.parse(e.newValue));
    }
  });

  const makeArea = (area: AreaName) => {
    const prefix = PREFIX[area];
    const readKey = (key: string) => {
      const raw = localStorage.getItem(prefix + key);
      return raw === null ? undefined : JSON.parse(raw);
    };
    return {
      async get(keys: string | string[] | null) {
        const list =
          keys === null
            ? Object.keys(localStorage)
                .filter((k) => k.startsWith(prefix))
                .map((k) => k.slice(prefix.length))
            : [keys].flat();
        return Object.fromEntries(list.map((k) => [k, readKey(k)]).filter(([, v]) => v !== undefined));
      },
      async set(items: Record<string, unknown>) {
        for (const [key, value] of Object.entries(items)) {
          const old = readKey(key);
          localStorage.setItem(prefix + key, JSON.stringify(value));
          emit(area, key, old, value);
        }
      },
      async remove(keys: string | string[]) {
        for (const key of [keys].flat()) {
          const old = readKey(key);
          localStorage.removeItem(prefix + key);
          emit(area, key, old, undefined);
        }
      },
    };
  };

  const fakePort = () => ({
    name: "",
    onDisconnect: { addListener() {} },
    onMessage: { addListener() {} },
    postMessage() {},
    disconnect() {},
  });

  (globalThis as unknown as { chrome: unknown }).chrome = {
    storage: {
      local: makeArea("local"),
      session: makeArea("session"),
      onChanged: { addListener: (l: Listener) => listeners.add(l), removeListener: (l: Listener) => listeners.delete(l) },
    },
    runtime: {
      id: "mock-extension",
      getURL: (path: string) => new URL(`/${path}`, window.location.origin).href,
      getManifest: () => ({ version: "dev" }),
      connect: fakePort,
      onMessage: { addListener() {} },
    },
  };
}

/** Статус связи с приложением для макета и тестов. */
export function setMockBridgeStatus(status: Partial<BridgeStatus> & Pick<BridgeStatus, "state">) {
  return chrome.storage.session.set({
    [BRIDGE_STATUS_KEY]: { appVersion: null, features: [], error: null, updatedAt: Date.now(), ...status } satisfies BridgeStatus,
  });
}
