// Заголовок вкладки: «⚡ Имя закладки - Path of Exile».
// - имя — закладка для текущего поиска, иначе предлагаемое имя из формы поиска;
// - ⚡ — live-поиск;
// - префикс `(N) ` — счётчик новых лотов, который ставит сам сайт в live-режиме, — сохраняем.
// Сайт сам переписывает заголовок, поэтому следим за <title> и возвращаем свой (не чаще раза в 100 мс,
// чтобы не воевать бесконечно с другими расширениями).
import { findTradeByLocation } from "@/shared/bookmarks";
import type { BookmarksData, TradeLocation } from "@/shared/types";
import { recommendTitle } from "./search-panel";

const COUNTER_PREFIX = /^\((\d+)\) /;
const THROTTLE_MS = 100;

export class PageTitle {
  private baseTitle = document.title.replace(COUNTER_PREFIX, "");
  private title: string | null = null;
  private counter: number | null = null;
  private lastRun = 0;
  private pending: number | null = null;

  constructor() {
    const titleEl = document.querySelector("title");
    if (!titleEl) return;
    new MutationObserver(() => this.onMutation()).observe(titleEl, { childList: true, characterData: true, subtree: true });
  }

  recalculate(location: TradeLocation, bookmarks: BookmarksData): void {
    const bookmark = findTradeByLocation(bookmarks, location)?.trade.title;
    const name = bookmark || (location.type === "search" ? recommendTitle() : "");
    this.title = `${location.isLive ? "⚡ " : ""}${name ? `${name} - ` : ""}${this.baseTitle}`;
    this.apply();
  }

  private apply(): void {
    if (this.title === null) return;
    const next = (this.counter !== null ? `(${this.counter}) ` : "") + this.title;
    if (document.title !== next) document.title = next;
  }

  private onMutation(): void {
    const now = Date.now();
    const run = () => {
      this.lastRun = Date.now();
      this.pending = null;
      const match = COUNTER_PREFIX.exec(document.title);
      this.counter = match ? Number.parseInt(match[1], 10) : null;
      this.apply();
    };
    if (now - this.lastRun >= THROTTLE_MS) run();
    else if (this.pending === null) this.pending = window.setTimeout(run, THROTTLE_MS);
  }
}
