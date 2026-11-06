import type { BookmarkLocation, GameVersion, TradeLocation } from "./types";

export const TRADE_ORIGIN = "https://www.pathofexile.com";

/** Сегменты-реалмы: в адресе они стоят перед лигой. */
const REALMS = ["xbox", "sony", "poe2"];

/**
 * Разбор адреса сайта торговли:
 * `/trade/search/Settlers%20of%20Kalguur/AbC123/live` →
 * `{ version: "1", type: "search", league: "Settlers%20of%20Kalguur", slug: "AbC123", isLive: true }`.
 * `/trade2/search/poe2/Standard/xyz` → `{ version: "2", league: "poe2/Standard", … }`.
 */
export function parseTradePath(pathname: string): TradeLocation {
  const parts = pathname.split("/").slice(1);
  let versionPart: string | undefined;
  let type: string | undefined;
  let league: string | undefined;
  let slug: string | undefined;
  let live: string | undefined;

  if (REALMS.includes(parts[2])) {
    let realm: string, leagueInRealm: string | undefined;
    [versionPart, type, realm, leagueInRealm, slug, live] = parts;
    league = leagueInRealm ? `${realm}/${leagueInRealm}` : undefined;
  } else {
    [versionPart, type, league, slug, live] = parts;
  }

  return {
    version: versionPart === "trade2" ? "2" : "1",
    type: type || null,
    league: league || null,
    slug: slug || null,
    isLive: live === "live",
  };
}

/** Страница поиска или обмена с конкретным запросом. */
export function isConcreteSearch(loc: TradeLocation): loc is TradeLocation & { type: string; league: string; slug: string } {
  return Boolean(loc.type && loc.league && loc.slug);
}

/** Адрес поиска. `league` — как в URL (уже закодирована). */
export function buildTradeUrl(
  loc: { version: GameVersion; type: string; slug: string },
  league: string,
  options: { live?: boolean } = {},
): string {
  const base = loc.version === "2" ? "trade2" : "trade";
  const url = [TRADE_ORIGIN, base, loc.type, league, loc.slug].join("/");
  return options.live ? `${url}/live` : url;
}

/** Один и тот же поиск (live-режим не важен). */
export function sameSearch(a: { version: GameVersion; type: string | null; slug: string | null }, b: { version: GameVersion; type: string | null; slug: string | null }): boolean {
  return a.version === b.version && a.type === b.type && a.slug === b.slug;
}

/** Полностью одинаковые адреса, включая лигу и live. */
export function sameLocation(a: TradeLocation, b: TradeLocation): boolean {
  return sameSearch(a, b) && a.league === b.league && a.isLive === b.isLive;
}

export function toBookmarkLocation(loc: TradeLocation): BookmarkLocation | null {
  if (!loc.type || !loc.slug) return null;
  return { version: loc.version, type: loc.type, slug: loc.slug };
}

/** Лига для показа: `poe2/Rise%20of%20the%20Abyssal` → «Rise of the Abyssal». */
export function leagueName(league: string | null): string | null {
  if (!league) return null;
  const last = league.split("/").pop() ?? league;
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}

/** Реалм для показа: «Xbox», «PlayStation» или null для ПК. */
export function realmName(league: string | null): string | null {
  const realm = league?.includes("/") ? league.split("/")[0] : null;
  if (realm === "xbox") return "Xbox";
  if (realm === "sony") return "PlayStation";
  return null;
}

export function gameLabel(version: GameVersion): string {
  return version === "2" ? "PoE 2" : "PoE 1";
}

export function tradeTypeLabel(type: string | null): string {
  if (type === "search") return "поиск";
  if (type === "exchange") return "обмен валюты";
  return type ?? "торговля";
}
