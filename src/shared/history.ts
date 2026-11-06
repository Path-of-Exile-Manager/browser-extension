import { uid } from "./ids";
import { isConcreteSearch, sameSearch } from "./location";
import { KEYS, update } from "./storage";
import type { HistoryEntry, TradeLocation } from "./types";

export const MAX_HISTORY = 50;

/** Добавить поиск в начало истории. Повтор того же поиска подряд не пишется — только освежается. */
export function addHistoryEntry(history: HistoryEntry[], loc: TradeLocation, title: string, at = new Date()): HistoryEntry[] {
  if (!isConcreteSearch(loc)) return history;
  const last = history[0];
  if (last && sameSearch(last, loc) && last.league === loc.league) {
    // Тот же поиск: обновим заголовок, если раньше его не было (форма поиска заполняется не сразу).
    if (!last.title && title) return [{ ...last, title }, ...history.slice(1)];
    return history;
  }
  const entry: HistoryEntry = {
    id: uid(),
    version: loc.version,
    type: loc.type,
    league: loc.league,
    slug: loc.slug,
    isLive: loc.isLive,
    title,
    createdAt: at.toISOString(),
  };
  return [entry, ...history].slice(0, MAX_HISTORY);
}

export function logHistory(loc: TradeLocation, title: string): Promise<HistoryEntry[]> {
  return update(KEYS.history, (h) => addHistoryEntry(h, loc, title));
}
