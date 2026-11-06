// Обёртка над chrome.storage.local. Панель (iframe) и content script работают с одними ключами,
// а chrome.storage.onChanged держит их в синхроне: закладку сохранили в панели — заголовок вкладки
// обновился в странице.
import { DEFAULT_SETTINGS, type BookmarksData, type HistoryEntry, type PinnedItem, type Settings } from "./types";

export const KEYS = {
  bookmarks: "pm:bookmarks",
  history: "pm:history",
  pins: "pm:pins",
  settings: "pm:settings",
} as const;

/** Ключи, которые больше не используются: удаляются при обновлении расширения (background). */
export const OBSOLETE_KEYS = ["pm:rates"];

export type StorageShape = {
  [KEYS.bookmarks]: BookmarksData;
  [KEYS.history]: HistoryEntry[];
  [KEYS.pins]: PinnedItem[];
  [KEYS.settings]: Settings;
};
export type StorageKey = keyof StorageShape;

export const DEFAULTS: StorageShape = {
  [KEYS.bookmarks]: { folders: [] },
  [KEYS.history]: [],
  [KEYS.pins]: [],
  [KEYS.settings]: DEFAULT_SETTINGS,
};

function area(): chrome.storage.StorageArea {
  return chrome.storage.local;
}

function withDefault<K extends StorageKey>(key: K, value: unknown): StorageShape[K] {
  if (value === undefined || value === null) return structuredClone(DEFAULTS[key]);
  // Настройки дополняем значениями по умолчанию: в новых версиях появляются новые поля.
  if (key === KEYS.settings) return { ...DEFAULT_SETTINGS, ...(value as Settings) } as StorageShape[K];
  return value as StorageShape[K];
}

export async function read<K extends StorageKey>(key: K): Promise<StorageShape[K]> {
  const result = await area().get(key);
  return withDefault(key, result[key]);
}

export async function write<K extends StorageKey>(key: K, value: StorageShape[K]): Promise<void> {
  await area().set({ [key]: value });
}

/**
 * Прочитать, изменить, записать. Все изменения одного ключа из одного контекста идут по очереди,
 * чтобы два быстрых клика не затёрли друг друга.
 */
const queues = new Map<string, Promise<unknown>>();
export function update<K extends StorageKey>(key: K, fn: (value: StorageShape[K]) => StorageShape[K]): Promise<StorageShape[K]> {
  const prev = queues.get(key) ?? Promise.resolve();
  const next = prev.then(async () => {
    const value = fn(await read(key));
    await write(key, value);
    return value;
  });
  queues.set(
    key,
    next.catch(() => undefined),
  );
  return next;
}

/** Подписка на изменения ключа (из любого контекста расширения). Возвращает отписку. */
export function subscribe<K extends StorageKey>(key: K, cb: (value: StorageShape[K]) => void): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
    if (areaName !== "local" || !(key in changes)) return;
    cb(withDefault(key, changes[key].newValue));
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

export function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  return update(KEYS.settings, (s) => ({ ...s, ...patch }));
}
