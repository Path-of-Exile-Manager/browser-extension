// Улучшения результатов поиска на сайте торговли.
//
// Как работает: MutationObserver следит за приложением сайта; новые строки результатов
// (`.resultset > div.row[data-id]` без пометки `data-pmgr-enhanced`) проходят через все включённые улучшения.
// Всё, что мы вставляем, помечено классом `pmgr-injected`, всё, что меняем, — перечислено в reset(),
// поэтому выключение улучшения в настройках применяется сразу, без перезагрузки страницы.
//
// Внешний вид — токены дизайн-системы (content.css): строки получают класс `pmgr-ui`, на котором
// определены CSS-переменные; глобальная область сайта не затрагивается.
import { gameLabel } from "@/shared/location";
import { plural } from "@/shared/format";
import type { EnhancerId, TradeLocation } from "@/shared/types";
import { icon } from "./icons";
import { parseRow, type ParsedRow } from "./row-parser";
import { searchedStats } from "./search-panel";

const ROWS = ".resultset > div.row[data-id]";
const MOD_ELEMENTS = ".explicitMod, .implicitMod, .pseudoMod, .craftedMod, .fracturedMod, .enchantMod";

type Context = {
  location: TradeLocation;
  statNeedles: RegExp[];
  pinnedIds: Set<string>;
};

type Enhancer = {
  id: EnhancerId;
  enhance: (row: HTMLElement, parsed: ParsedRow, ctx: Context) => void;
};

export type EnhancerDeps = {
  getLocation: () => TradeLocation;
  isEnabled: (id: EnhancerId) => boolean;
  getPinnedIds: () => Set<string>;
  togglePin: (row: HTMLElement, parsed: ParsedRow) => void;
};

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, children: Array<Node | string> = []): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  node.append(...children);
  return node;
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---------- 1. Подсветка модов из фильтров ----------
const highlightStatFilters: Enhancer = {
  id: "highlight-stat-filters",
  enhance(row, _parsed, { statNeedles }) {
    if (!statNeedles.length) return;
    row.querySelectorAll<HTMLElement>(MOD_ELEMENTS).forEach((mod) => {
      const modText = mod.textContent ?? "";
      if (statNeedles.some((needle) => needle.test(modText))) mod.classList.add("pmgr-mod-highlight");
    });
  },
};

// ---------- 2. Максимум сокетов (PoE 1) ----------
// Нагрудник с низким уровнем предмета физически не получит больше сокетов, чем позволяет iLvl.
const SOCKET_THRESHOLDS = [
  { maxSockets: 2, ilvl: 1 },
  { maxSockets: 3, ilvl: 24 },
  { maxSockets: 4, ilvl: 34 },
  { maxSockets: 5, ilvl: 49 },
];

const maximumSockets: Enhancer = {
  id: "maximum-sockets",
  enhance(row, { socketsCount, itemType, ilvl }, { location }) {
    if (location.version !== "1" || itemType !== "armour" || !ilvl || socketsCount === 0) return;
    const threshold = SOCKET_THRESHOLDS.find((t) => ilvl <= t.ilvl);
    if (!threshold || threshold.maxSockets <= socketsCount) return;
    const frame = row.querySelector(".itemRendered");
    if (!frame) return;
    const n = threshold.maxSockets;
    const badge = el("div", "pmgr-ui pmgr-injected pmgr-badge pmgr-badge--warning", [
      icon("triangle-alert", 12),
      `Макс. ${n} ${plural(n, "сокет", "сокета", "сокетов")} при iLvl ${ilvl}`,
    ]);
    frame.prepend(badge);
  },
};

// ---------- 3. Группировка одинаковых лотов ----------
function groupHash(row: HTMLElement): string {
  const seller = row.querySelector(".profile-link [href]")?.getAttribute("href")?.replace(/^\/account\/view-profile\//, "") ?? "";
  const name = (row.querySelector(".itemHeader")?.textContent ?? "").replace(/superior/i, "");
  const price = row.querySelector(".price")?.textContent ?? "";
  return [seller, name, price].join("|").replace(/\s/g, "").toLowerCase();
}

function groupHead(row: HTMLElement, hash: string): HTMLElement {
  let head = row;
  for (let prev = row.previousElementSibling as HTMLElement | null; prev; prev = prev.previousElementSibling as HTMLElement | null) {
    if (prev.getAttribute("data-pmgr-group") !== hash) break;
    head = prev;
  }
  return head;
}

function setGroupState(head: HTMLElement, state: "hidden" | "visible") {
  const hash = head.getAttribute("data-pmgr-group");
  for (let next = head.nextElementSibling as HTMLElement | null; next; next = next.nextElementSibling as HTMLElement | null) {
    if (next.getAttribute("data-pmgr-group") !== hash) break;
    next.setAttribute("data-pmgr-group-state", state);
  }
}

function groupButton(head: HTMLElement): HTMLButtonElement | null {
  let button = head.querySelector<HTMLButtonElement>(".pmgr-group-button");
  if (button) return button;
  const btns = head.querySelector(".details .btns");
  if (!btns) return null;
  button = el("button", "pmgr-ui pmgr-injected pmgr-btn pmgr-group-button");
  button.type = "button";
  button.dataset.count = "0";
  button.setAttribute("aria-expanded", "false");
  button.addEventListener("click", () => {
    const expanded = button!.getAttribute("aria-expanded") !== "true";
    button!.setAttribute("aria-expanded", String(expanded));
    renderGroupButton(button!);
    setGroupState(head, expanded ? "visible" : "hidden");
  });
  btns.append(button);
  return button;
}

function renderGroupButton(button: HTMLButtonElement) {
  const n = Number(button.dataset.count);
  const expanded = button.getAttribute("aria-expanded") === "true";
  button.replaceChildren(icon(expanded ? "chevron-up" : "chevron-down", 14), `Ещё ${n} ${plural(n, "такой же", "таких же", "таких же")}`);
  button.title = expanded ? "Скрыть одинаковые лоты" : "Показать одинаковые лоты этого продавца";
}

const regroupSimilars: Enhancer = {
  id: "regroup-similars",
  enhance(row) {
    const hash = groupHash(row);
    row.setAttribute("data-pmgr-group", hash);
    const head = groupHead(row, hash);
    if (head === row) return;
    const button = groupButton(head);
    if (!button) return;
    button.dataset.count = String(Number(button.dataset.count) + 1);
    renderGroupButton(button);
    row.setAttribute("data-pmgr-group-state", button.getAttribute("aria-expanded") === "true" ? "visible" : "hidden");
  },
};

// ---------- 4. Закрепление ----------
function renderPinButton(button: HTMLButtonElement, pinned: boolean) {
  button.setAttribute("aria-pressed", String(pinned));
  button.replaceChildren(icon(pinned ? "pin-off" : "pin", 14), pinned ? "Открепить" : "Закрепить");
  button.title = pinned ? "Убрать из закреплённых" : "Закрепить лот в панели poe-manager";
}

function pinnable(deps: EnhancerDeps): Enhancer {
  return {
    id: "pinnable",
    enhance(row, parsed, { pinnedIds }) {
      const btns = row.querySelector(".details .btns");
      if (!btns || !parsed.id) return;
      const button = el("button", "pmgr-ui pmgr-injected pmgr-btn pmgr-pin-button");
      button.type = "button";
      renderPinButton(button, pinnedIds.has(parsed.id));
      button.addEventListener("click", () => deps.togglePin(row, parsed));
      btns.append(button);
      row.classList.toggle("pmgr-pinned", pinnedIds.has(parsed.id));
    },
  };
}

// ---------- Запуск ----------
export class ResultsEnhancer {
  private readonly enhancers: Enhancer[];
  private running = false;
  private rerun = false;
  private timer: number | null = null;
  private observer: MutationObserver | null = null;

  constructor(private readonly deps: EnhancerDeps) {
    this.enhancers = [highlightStatFilters, maximumSockets, regroupSimilars, pinnable(deps)];
  }

  start(root: Element): void {
    this.observer = new MutationObserver(() => this.schedule());
    this.observer.observe(root, { childList: true, subtree: true });
    this.schedule();
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null;
  }

  schedule(): void {
    if (this.timer !== null || !this.observer) return;
    this.timer = window.setTimeout(() => {
      this.timer = null;
      void this.run();
    }, 30);
  }

  private async run(): Promise<void> {
    if (this.running) {
      this.rerun = true;
      return;
    }
    this.running = true;
    try {
      const rows = Array.from(document.querySelectorAll<HTMLElement>(`${ROWS}:not([data-pmgr-enhanced])`)).filter(
        (r) => !r.classList.contains("exchange") && !r.closest(".resultset")?.classList.contains("exchange"),
      );
      if (!rows.length) return;

      const location = this.deps.getLocation();
      const enabled = this.enhancers.filter((e) => this.deps.isEnabled(e.id));
      const ctx: Context = {
        location,
        statNeedles: enabled.some((e) => e.id === "highlight-stat-filters")
          ? searchedStats().map((s) => new RegExp(escapeRegex(s).replace(/#/g, "[+-]?\\d+(?:\\.\\d+)?"), "i"))
          : [],
        pinnedIds: this.deps.getPinnedIds(),
      };

      for (const row of rows) {
        // Строку могли перерисовать, пока ждали курсы.
        if (!row.isConnected || row.hasAttribute("data-pmgr-enhanced")) continue;
        row.setAttribute("data-pmgr-enhanced", "");
        row.classList.add("pmgr-ui");
        const parsed = parseRow(row);
        for (const enhancer of enabled) {
          try {
            enhancer.enhance(row, parsed, ctx);
          } catch (error) {
            console.warn(`[poe-manager] улучшение ${enhancer.id} (${gameLabel(location.version)}):`, error);
          }
        }
      }
    } finally {
      this.running = false;
      if (this.rerun) {
        this.rerun = false;
        this.schedule();
      }
    }
  }

  /** Снять все улучшения и применить заново (после изменения настроек). */
  reset(): void {
    document.querySelectorAll(".pmgr-injected").forEach((n) => n.remove());
    document.querySelectorAll(".pmgr-mod-highlight").forEach((n) => n.classList.remove("pmgr-mod-highlight"));
    document.querySelectorAll(`${ROWS}[data-pmgr-enhanced]`).forEach((row) => {
      row.classList.remove("pmgr-pinned", "pmgr-ui");
      row.removeAttribute("data-pmgr-enhanced");
      row.removeAttribute("data-pmgr-group");
      row.removeAttribute("data-pmgr-group-state");
    });
    this.schedule();
  }

  /** Обновить кнопки и подсветку закреплённых (закрепили или открепили в панели). */
  refreshPins(pinnedIds: Set<string>): void {
    document.querySelectorAll<HTMLElement>(`${ROWS}[data-pmgr-enhanced]`).forEach((row) => {
      const pinned = pinnedIds.has(row.dataset.id ?? "");
      row.classList.toggle("pmgr-pinned", pinned);
      const button = row.querySelector<HTMLButtonElement>(".pmgr-pin-button");
      if (button) renderPinButton(button, pinned);
    });
  }
}

export function visibleItemIds(): string[] {
  return Array.from(document.querySelectorAll<HTMLElement>(ROWS))
    .map((r) => r.dataset.id ?? "")
    .filter(Boolean);
}
