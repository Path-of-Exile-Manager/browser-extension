// Чтение формы поиска сайта торговли. Селекторы — из Better Trading 1.9.2 (рабочие на конец 2025);
// если сайт поменяет вёрстку, здесь первое место для правки.

const NAME_INPUT = ".search-panel .search-bar .search-left input";
const CATEGORY_INPUT = ".search-advanced-items .filter-group:nth-of-type(1) .filter-property:nth-of-type(1) input";
const RARITY_INPUT = ".search-advanced-items .filter-group:nth-of-type(1) .filter-property:nth-of-type(2) input";
const STAT_TITLES = ".search-advanced-pane:last-child .filter-group-body .filter:not(.disabled) .filter-title";

function inputValue(selector: string, nullValue?: string): string | null {
  const input = document.querySelector<HTMLInputElement>(selector);
  const value = input?.value?.trim();
  if (!value || value === nullValue) return null;
  return value;
}

/** Имя для закладки: имя предмета, иначе «Категория (Редкость)», иначе категория. */
export function recommendTitle(): string {
  const name = inputValue(NAME_INPUT);
  if (name) return name;
  const category = inputValue(CATEGORY_INPUT, "Any");
  const rarity = inputValue(RARITY_INPUT, "Any");
  if (!category) return "";
  return rarity ? `${category} (${rarity})` : category;
}

/** Тексты включённых фильтров модов: «# to maximum life» (без префикса pseudo). */
export function searchedStats(): string[] {
  return Array.from(document.querySelectorAll<HTMLElement>(STAT_TITLES))
    .map((el) => (el.innerText || el.textContent || "").trim().toLowerCase().replace(/^pseudo /, ""))
    .filter(Boolean);
}
