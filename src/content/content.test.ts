import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ROWS, rowHtml } from "../../dev/mock-rows";
import { parseTradePath } from "@/shared/location";
import type { EnhancerId } from "@/shared/types";
import { ResultsEnhancer } from "./enhancers";
import { modSegments, parseItem, parseRow } from "./row-parser";
import { recommendTitle, searchedStats } from "./search-panel";

function renderPage() {
  document.body.innerHTML = `
    <div id="app"><div id="trade">
      <div class="search-panel">
        <div class="search-bar"><div class="search-left"><input value=""></div></div>
        <div class="search-advanced-items"><div class="filter-group">
          <div class="filter-property"><input value="Body Armour"></div>
          <div class="filter-property"><input value="Rare"></div>
        </div></div>
        <div class="search-advanced-pane"><div class="filter-group-body">
          <div class="filter"><span class="filter-title">+# to maximum Energy Shield</span></div>
          <div class="filter disabled"><span class="filter-title">+# to maximum Life</span></div>
        </div></div>
      </div>
      <div class="results"><div class="resultset">${ROWS.map(rowHtml).join("")}</div></div>
    </div></div>`;
}

const row = (id: string) => document.querySelector<HTMLElement>(`.row[data-id="${id}"]`)!;

beforeEach(renderPage);

describe("форма поиска", () => {
  it("предлагает имя «Категория (Редкость)» и видит только включённые фильтры", () => {
    expect(recommendTitle()).toBe("Body Armour (Rare)");
    expect(searchedStats()).toEqual(["+# to maximum energy shield"]);
  });
});

describe("разбор строки результата", () => {
  it("цена, сокеты, iLvl, продавец, тип по картинке", () => {
    expect(parseRow(row("a1f3"))).toMatchObject({
      id: "a1f3",
      price: { amount: 2.5, currency: "Divine Orb" },
      socketsCount: 6,
      ilvl: 84,
      itemType: "armour",
      seller: { account: "ExileTrader", character: "ExileTrader_char" },
    });
  });

  it("предмет: редкость, имя, база, моды по типам, порча", () => {
    const item = parseItem(row("a1f3"));
    expect(item).toMatchObject({ rarity: "rare", name: "Doom Shell", baseType: "Vaal Regalia", itemLevel: 84, quality: 20, states: ["corrupted"] });
    expect(item.mods.map((m) => m.kind)).toEqual(["implicit", "explicit", "explicit", "explicit", "crafted"]);
    expect(parseItem(row("d4e8")).rarity).toBe("unique");
  });

  it("числа модов отделяются от текста, диапазоны распознаются", () => {
    expect(modSegments("+105(100-109) to maximum Energy Shield")).toEqual([{ value: "+105", range: [100, 109] }, " to maximum Energy Shield"]);
    expect(modSegments("Adds 5 to 12 Fire Damage")).toEqual(["Adds ", { value: "5" }, " to ", { value: "12" }, " Fire Damage"]);
  });
});

describe("улучшения результатов", () => {
  let running: ResultsEnhancer | null = null;
  afterEach(() => running?.stop());

  async function enhance(disabled: EnhancerId[] = [], pinned: string[] = []) {
    const togglePin = vi.fn();
    const enhancer = new ResultsEnhancer({
      getLocation: () => parseTradePath("/trade/search/Mercenaries/abc"),
      isEnabled: (id) => !disabled.includes(id),
      getPinnedIds: () => new Set(pinned),
      togglePin,
    });
    running = enhancer;
    enhancer.start(document.getElementById("app")!);
    await vi.waitFor(() => expect(document.querySelectorAll(".row[data-pmgr-enhanced]")).toHaveLength(ROWS.length));
    return { enhancer, togglePin };
  }

  it("подсветка модов из фильтров", async () => {
    await enhance();
    const highlighted = Array.from(row("a1f3").querySelectorAll(".pmgr-mod-highlight")).map((m) => m.textContent);
    expect(highlighted).toEqual(["+105 to maximum Energy Shield"]);
  });

  it("предупреждение о сокетах только для нагрудника с низким iLvl", async () => {
    await enhance();
    expect(row("b7c2").querySelector(".pmgr-badge--warning")?.textContent).toBe("Макс. 4 сокета при iLvl 30");
    expect(row("a1f3").querySelector(".pmgr-badge--warning")).toBeNull();
  });

  it("одинаковые лоты сворачиваются под кнопку у первого", async () => {
    await enhance();
    const button = row("c9d1").querySelector<HTMLButtonElement>(".pmgr-group-button")!;
    expect(button.textContent).toBe("Ещё 2 таких же");
    expect(row("c9d2").getAttribute("data-pmgr-group-state")).toBe("hidden");
    button.click();
    expect(row("c9d3").getAttribute("data-pmgr-group-state")).toBe("visible");
  });

  it("кнопка «Закрепить» и подсветка закреплённых", async () => {
    const { enhancer, togglePin } = await enhance([], ["d4e8"]);
    expect(row("d4e8").classList.contains("pmgr-pinned")).toBe(true);
    expect(row("d4e8").querySelector(".pmgr-pin-button")?.getAttribute("aria-pressed")).toBe("true");
    row("a1f3").querySelector<HTMLButtonElement>(".pmgr-pin-button")!.click();
    expect(togglePin).toHaveBeenCalledWith(row("a1f3"), expect.objectContaining({ id: "a1f3" }));
    enhancer.refreshPins(new Set(["a1f3"]));
    expect(row("a1f3").classList.contains("pmgr-pinned")).toBe(true);
    expect(row("d4e8").classList.contains("pmgr-pinned")).toBe(false);
  });

  it("выключенные улучшения не применяются, reset снимает всё", async () => {
    const { enhancer } = await enhance(["pinnable"]);
    expect(document.querySelector(".pmgr-pin-button")).toBeNull();
    expect(document.querySelector(".pmgr-group-button")).not.toBeNull();
    enhancer.reset();
    expect(document.querySelector(".pmgr-injected")).toBeNull();
    expect(document.querySelector("[data-pmgr-group-state]")).toBeNull();
    await vi.waitFor(() => expect(document.querySelectorAll(".row[data-pmgr-enhanced]")).toHaveLength(ROWS.length));
  });
});
