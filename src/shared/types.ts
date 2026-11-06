// Данные расширения. Всё хранится в chrome.storage.local (см. storage.ts).
import type { Item } from "@/design-system/game/types";

/** Версия игры: "1" — pathofexile.com/trade, "2" — pathofexile.com/trade2. */
export type GameVersion = "1" | "2";

/** Где сейчас пользователь на сайте торговли. Разбирается из адреса страницы (location.ts). */
export type TradeLocation = {
  version: GameVersion;
  /** `search`, `exchange` или `null` (главная страница торговли). */
  type: string | null;
  /**
   * Лига как в адресе — в URL-кодировке: `Settlers%20of%20Kalguur`.
   * У консольных реалмов и PoE2 — с префиксом: `xbox/Standard`, `poe2/Standard`.
   */
  league: string | null;
  slug: string | null;
  isLive: boolean;
};

/** Поиск, сохранённый в закладку. **Лига не хранится**: при открытии подставляется текущая. */
export type BookmarkLocation = {
  version: GameVersion;
  type: string;
  slug: string;
};

export type BookmarkTrade = {
  id: string;
  title: string;
  location: BookmarkLocation;
  /** Отмечено «выполнено» (купил, что искал). ISO-дата или null. */
  completedAt: string | null;
};

export const FOLDER_ICONS = [
  "folder",
  "swords",
  "shield",
  "gem",
  "coins",
  "sparkles",
  "map",
  "crown",
  "skull",
  "flame",
  "snowflake",
  "zap",
  "target",
  "star",
  "heart",
  "hammer",
  "flask",
  "scroll",
  "bug",
  "package",
] as const;
export type FolderIcon = (typeof FOLDER_ICONS)[number];

export type BookmarkFolder = {
  id: string;
  title: string;
  icon: FolderIcon;
  /** Папка относится к одной версии игры: на trade2 видны только папки PoE2. */
  version: GameVersion;
  archivedAt: string | null;
  trades: BookmarkTrade[];
};

export type BookmarksData = {
  folders: BookmarkFolder[];
};

export type HistoryEntry = {
  id: string;
  version: GameVersion;
  type: string;
  league: string;
  slug: string;
  isLive: boolean;
  title: string;
  createdAt: string;
};

export type PinnedPrice = {
  amount: number;
  /** Как написано на сайте: «Divine Orb». */
  currency: string;
  iconUrl?: string;
};

/** Закреплённый лот: данные, разобранные из строки результата (не копия разметки сайта). */
export type PinnedItem = {
  /** `data-id` строки результата на сайте. */
  id: string;
  pinnedAt: string;
  /** Поиск, в котором закреплён лот. */
  location: TradeLocation;
  searchTitle: string;
  item: Item;
  price: PinnedPrice | null;
  seller: { account: string | null; character: string | null } | null;
};

// Пересчёта цен нет: цены будут в приложении (решение 18 в docs/architecture.md).
export const ENHANCERS = [
  { id: "highlight-stat-filters", label: "Подсветка модов из фильтров поиска", hint: null },
  { id: "maximum-sockets", label: "Предупреждение о максимуме сокетов", hint: "Только PoE 1, нагрудники с низким iLvl" },
  { id: "regroup-similars", label: "Группировка одинаковых лотов", hint: "Тот же продавец, предмет и цена" },
  { id: "pinnable", label: "Кнопка «Закрепить» у лотов", hint: null },
] as const;
export type EnhancerId = (typeof ENHANCERS)[number]["id"];

export type PanelTab = "bookmarks" | "history" | "pins";

export type Settings = {
  disabledEnhancers: EnhancerId[];
  collapsed: boolean;
  expandedFolderIds: string[];
  tab: PanelTab;
  showArchived: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  disabledEnhancers: [],
  collapsed: false,
  expandedFolderIds: [],
  tab: "bookmarks",
  showArchived: false,
};
