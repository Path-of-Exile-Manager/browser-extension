import { buildTradeUrl } from "@/shared/location";
import { KEYS, read } from "@/shared/storage";
import type { BookmarkLocation, GameVersion } from "@/shared/types";
import { openTradeUrl, useTrade } from "./bridge";

/**
 * Лига для открытия закладки (в закладках лиги нет): текущая лига страницы, если версия игры та же;
 * иначе последняя лига этой версии из истории; иначе Standard.
 */
export async function leagueFor(version: GameVersion): Promise<string> {
  const loc = useTrade.getState().location;
  if (loc?.version === version && loc.league) return loc.league;
  const history = await read(KEYS.history);
  const recent = history.find((h) => h.version === version)?.league;
  if (recent) return recent;
  return version === "2" ? "poe2/Standard" : "Standard";
}

export async function tradeUrlFor(location: BookmarkLocation, options: { live?: boolean } = {}): Promise<string> {
  return buildTradeUrl(location, await leagueFor(location.version), options);
}

export async function openBookmark(location: BookmarkLocation, options: { live?: boolean; newTab?: boolean } = {}) {
  openTradeUrl(await tradeUrlFor(location, options), options.newTab);
}

/** Клик с Ctrl/⌘ или средней кнопкой — в новой вкладке, как у ссылок. */
export function wantsNewTab(event: { ctrlKey: boolean; metaKey: boolean; button: number }): boolean {
  return event.ctrlKey || event.metaKey || event.button === 1;
}
