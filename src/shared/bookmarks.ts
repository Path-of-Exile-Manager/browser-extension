// Операции над закладками. Чистые функции над BookmarksData — их легко тестировать;
// запись в хранилище — в конце файла.
import { uid } from "./ids";
import { sameSearch } from "./location";
import { KEYS, update } from "./storage";
import type { BookmarkFolder, BookmarkLocation, BookmarkTrade, BookmarksData, FolderIcon, GameVersion, TradeLocation } from "./types";

type Data = BookmarksData;

const now = () => new Date().toISOString();

export function newFolder(fields: { title: string; icon: FolderIcon; version: GameVersion }): BookmarkFolder {
  return { id: uid(), title: fields.title.trim(), icon: fields.icon, version: fields.version, archivedAt: null, trades: [] };
}

export function newTrade(title: string, location: BookmarkLocation): BookmarkTrade {
  return { id: uid(), title: title.trim(), location, completedAt: null };
}

export function addFolder(data: Data, folder: BookmarkFolder): Data {
  return { folders: [...data.folders, folder] };
}

export function updateFolder(data: Data, id: string, patch: Partial<Omit<BookmarkFolder, "id" | "trades">>): Data {
  return { folders: data.folders.map((f) => (f.id === id ? { ...f, ...patch } : f)) };
}

export function deleteFolder(data: Data, id: string): Data {
  return { folders: data.folders.filter((f) => f.id !== id) };
}

/** Архивировать или вернуть из архива. Папка уходит в конец списка, как в Better Trading. */
export function toggleFolderArchive(data: Data, id: string): Data {
  const folder = data.folders.find((f) => f.id === id);
  if (!folder) return data;
  const toggled = { ...folder, archivedAt: folder.archivedAt ? null : now() };
  return { folders: [...data.folders.filter((f) => f.id !== id), toggled] };
}

/**
 * Переставить папку на место другой. Индексы — внутри всего списка: папки других версий игры
 * и архив остаются на своих местах относительно друг друга.
 */
export function moveFolder(data: Data, id: string, beforeId: string | null): Data {
  const folder = data.folders.find((f) => f.id === id);
  if (!folder || id === beforeId) return data;
  const rest = data.folders.filter((f) => f.id !== id);
  const index = beforeId === null ? rest.length : rest.findIndex((f) => f.id === beforeId);
  rest.splice(index < 0 ? rest.length : index, 0, folder);
  return { folders: rest };
}

export function addTrade(data: Data, folderId: string, trade: BookmarkTrade): Data {
  return { folders: data.folders.map((f) => (f.id === folderId ? { ...f, trades: [...f.trades, trade] } : f)) };
}

export function updateTrade(data: Data, tradeId: string, patch: Partial<Omit<BookmarkTrade, "id">>): Data {
  return {
    folders: data.folders.map((f) =>
      f.trades.some((t) => t.id === tradeId) ? { ...f, trades: f.trades.map((t) => (t.id === tradeId ? { ...t, ...patch } : t)) } : f,
    ),
  };
}

export function deleteTrade(data: Data, tradeId: string): Data {
  return { folders: data.folders.map((f) => ({ ...f, trades: f.trades.filter((t) => t.id !== tradeId) })) };
}

export function toggleTradeCompletion(data: Data, tradeId: string): Data {
  const trade = data.folders.flatMap((f) => f.trades).find((t) => t.id === tradeId);
  if (!trade) return data;
  return updateTrade(data, tradeId, { completedAt: trade.completedAt ? null : now() });
}

/** Перенести закладку в папку перед другой закладкой (`beforeId = null` — в конец). */
export function moveTrade(data: Data, tradeId: string, toFolderId: string, beforeId: string | null): Data {
  const trade = data.folders.flatMap((f) => f.trades).find((t) => t.id === tradeId);
  if (!trade || tradeId === beforeId) return data;
  return {
    folders: data.folders.map((f) => {
      const trades = f.trades.filter((t) => t.id !== tradeId);
      if (f.id !== toFolderId) return trades.length === f.trades.length ? f : { ...f, trades };
      const index = beforeId === null ? trades.length : trades.findIndex((t) => t.id === beforeId);
      trades.splice(index < 0 ? trades.length : index, 0, trade);
      return { ...f, trades };
    }),
  };
}

/**
 * Закладка для текущего адреса — для заголовка вкладки и подсветки в панели.
 * Если совпадений несколько, предпочитаем папки не из архива, затем — по алфавиту (стабильный выбор).
 */
export function findTradeByLocation(data: Data, loc: TradeLocation): { folder: BookmarkFolder; trade: BookmarkTrade } | null {
  if (!loc.type || !loc.slug) return null;
  const matches = data.folders.flatMap((folder) =>
    folder.trades.filter((trade) => sameSearch(trade.location, loc)).map((trade) => ({ folder, trade })),
  );
  if (!matches.length) return null;
  const active = matches.filter((m) => !m.folder.archivedAt);
  const pool = active.length ? active : matches;
  return [...pool].sort((a, b) => a.trade.title.localeCompare(b.trade.title))[0];
}

/** Записать изменения закладок в хранилище. */
export function mutateBookmarks(fn: (data: Data) => Data): Promise<Data> {
  return update(KEYS.bookmarks, fn);
}
