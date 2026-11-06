// Разбор строки результата поиска на сайте торговли.
// Селекторы цены, сокетов, iLvl, продавца — из Better Trading 1.9.2. Разметка предмета
// (itemPopupContainer, itemName/typeLine, *Mod, unmet) — стандартная разметка подсказки предмета
// pathofexile.com. Всё разбирается осторожно: чего нет — то пусто, ошибок не бросаем.
import type { Item, ItemMod, ItemState, ModKind, ModSegment, Rarity } from "@/design-system/game/types";

export type ItemType =
  | "armour"
  | "helmet"
  | "gloves"
  | "boots"
  | "belt"
  | "amulet"
  | "ring"
  | "shield"
  | "one-hand-weapon"
  | "two-hand-weapon"
  | "unknown";

export type RowPrice = { amount: number; currency: string; iconUrl?: string };

export type ParsedRow = {
  id: string;
  price: RowPrice | null;
  socketsCount: number;
  itemType: ItemType;
  ilvl: number | null;
  seller: { account: string | null; character: string | null };
};

const text = (el: Element | null | undefined) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();

export function parsePrice(row: Element): RowPrice | null {
  const field = row.querySelector('[data-field="price"]');
  if (!field) return null;
  const amountText = text(field.querySelector(":scope > br + span"));
  const amount = Number.parseFloat(amountText.replace(",", "."));
  const img = field.querySelector<HTMLImageElement>(".currency-image img");
  const currency = text(field.querySelector(".currency-text span")) || img?.alt || "";
  if (!(amount > 0) || !currency) return null;
  return { amount, currency, iconUrl: img?.src || undefined };
}

const TYPE_BY_ICON: Array<[RegExp, ItemType]> = [
  [/\/BodyArmours\//, "armour"],
  [/\/Helmets\//, "helmet"],
  [/\/Gloves\//, "gloves"],
  [/\/Boots\//, "boots"],
  [/\/Belts\//, "belt"],
  [/\/Amulets\//, "amulet"],
  [/\/Rings\//, "ring"],
  [/\/Shields\//, "shield"],
  [/\/OneHandWeapons\//, "one-hand-weapon"],
  [/\/TwoHandWeapons\//, "two-hand-weapon"],
];

const ITEM_CLASS: Record<ItemType, string> = {
  armour: "Body Armour",
  helmet: "Helmet",
  gloves: "Gloves",
  boots: "Boots",
  belt: "Belt",
  amulet: "Amulet",
  ring: "Ring",
  shield: "Shield",
  "one-hand-weapon": "One Hand Weapon",
  "two-hand-weapon": "Two Hand Weapon",
  unknown: "",
};

function iconOf(row: Element): HTMLImageElement | null {
  return row.querySelector<HTMLImageElement>(".icon img");
}

export function itemTypeOf(row: Element): ItemType {
  const src = iconOf(row)?.src ?? "";
  // Ссылки на картинки бывают закодированы в base64 (web.poecdn.com/gen/image/<base64>/…).
  let decoded = src;
  const encoded = src.match(/\/gen\/image\/([^/]+)\//)?.[1];
  if (encoded) {
    try {
      decoded += atob(encoded.replace(/-/g, "+").replace(/_/g, "/"));
    } catch {
      /* не base64 — ищем в исходной ссылке */
    }
  }
  return TYPE_BY_ICON.find(([re]) => re.test(decoded))?.[1] ?? "unknown";
}

export function parseRow(row: HTMLElement): ParsedRow {
  const ilvlMatch = text(row.querySelector(".itemLevel")).match(/(\d+)/);
  const pm = row.querySelector<HTMLAnchorElement>("a.pm-btn")?.href.match(/compose\?to=(.+)$/)?.[1];
  const character = text(row.querySelector(".character-name")).match(/IGN: (.+)/)?.[1];
  return {
    id: row.dataset.id ?? "",
    price: parsePrice(row),
    socketsCount: row.querySelectorAll(".sockets .socket").length,
    itemType: itemTypeOf(row),
    ilvl: ilvlMatch ? Number.parseInt(ilvlMatch[1], 10) : null,
    seller: {
      account: pm ? safeDecode(pm) : null,
      character: character ?? null,
    },
  };
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Редкость — из класса контейнера подсказки: `rarePopup`, `uniquePopup`, `divinationCard`… */
const RARITY_CLASS = /\b(normal|magic|rare|unique|gem|currency|divination)(?:Popup|Item|Card)\b/i;

function rarityOf(row: Element, container: Element): Rarity {
  const classNames = [container, ...Array.from(row.querySelectorAll(".itemPopupContainer, .itemHeader"))]
    .map((el) => el.className)
    .join(" ");
  const match = classNames.match(RARITY_CLASS);
  return match ? (match[1].toLowerCase() as Rarity) : "normal";
}

const MOD_SELECTORS: Array<[string, ModKind]> = [
  [".enchantMod", "enchant"],
  [".implicitMod", "implicit"],
  [".fracturedMod", "fractured"],
  [".explicitMod", "explicit"],
  [".craftedMod", "crafted"],
];

/** `+105(100-109) to maximum Energy Shield` → значения и диапазоны отдельными сегментами. */
export function modSegments(modText: string): ModSegment[] {
  const segments: ModSegment[] = [];
  const re = /([+-]?\d+(?:\.\d+)?%?)(?:\s?\((\d+(?:\.\d+)?)[-–](\d+(?:\.\d+)?)\))?/g;
  let last = 0;
  for (let m = re.exec(modText); m; m = re.exec(modText)) {
    if (m.index > last) segments.push(modText.slice(last, m.index));
    segments.push(m[2] ? { value: m[1], range: [Number(m[2]), Number(m[3])] } : { value: m[1] });
    last = m.index + m[0].length;
  }
  if (last < modText.length) segments.push(modText.slice(last));
  return segments;
}

/** Полный разбор предмета — для закреплённых лотов. */
export function parseItem(row: HTMLElement): Item {
  const container = row.querySelector(".itemPopupContainer") ?? row.querySelector(".itemRendered") ?? row;
  const header = container.querySelector(".itemHeader");
  const nameEl = header?.querySelector(".itemName:not(.typeLine)");
  const typeEl = header?.querySelector(".itemName.typeLine");
  const name = text(nameEl);
  const base = text(typeEl);

  const mods: ItemMod[] = [];
  for (const [selector, kind] of MOD_SELECTORS) {
    container.querySelectorAll(selector).forEach((el) => {
      const t = text(el);
      if (t) mods.push({ kind, segments: modSegments(t) });
    });
  }

  const states: ItemState[] = [];
  const stateText = Array.from(container.querySelectorAll(".unmet, .corrupted, .mirrored"))
    .map((el) => text(el))
    .join(" ");
  if (/corrupted/i.test(stateText)) states.push("corrupted");
  if (/mirrored/i.test(stateText)) states.push("mirrored");
  if (/unidentified/i.test(stateText)) states.push("unidentified");

  const ilvl = text(row.querySelector(".itemLevel")).match(/(\d+)/)?.[1];
  const quality = Array.from(container.querySelectorAll(".property"))
    .map((el) => text(el))
    .find((t) => /^quality/i.test(t))
    ?.match(/\+?(\d+)%/)?.[1];

  const img = iconOf(row);
  const ratio = img && img.naturalWidth > 0 ? img.naturalHeight / img.naturalWidth : 1;
  const width = Math.max(1, Math.min(4, Math.round(4 / Math.max(ratio, 1))));

  return {
    rarity: rarityOf(row, container),
    itemClass: ITEM_CLASS[itemTypeOf(row)],
    name: name && base ? name : undefined,
    baseType: base || name || "Предмет",
    itemLevel: ilvl ? Number(ilvl) : undefined,
    quality: quality ? Number(quality) : undefined,
    mods,
    states: states.length ? states : undefined,
    size: [width, 4],
    iconUrl: img?.src || undefined,
  };
}
