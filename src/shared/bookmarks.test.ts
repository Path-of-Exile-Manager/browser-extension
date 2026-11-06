import { describe, expect, it } from "vitest";
import { addHistoryEntry, MAX_HISTORY } from "./history";
import { parseTradePath } from "./location";
import { addFolder, addTrade, findTradeByLocation, moveFolder, moveTrade, newFolder, newTrade, toggleFolderArchive } from "./bookmarks";
import type { BookmarksData } from "./types";

function setup() {
  const a = newFolder({ title: "A", icon: "folder", version: "1" });
  const b = newFolder({ title: "B", icon: "folder", version: "1" });
  const t1 = newTrade("Z-ring", { version: "1", type: "search", slug: "s1" });
  const t2 = newTrade("Amulet", { version: "1", type: "search", slug: "s2" });
  const t3 = newTrade("A-ring", { version: "1", type: "search", slug: "s1" });
  let data: BookmarksData = { folders: [] };
  data = addFolder(addFolder(data, a), b);
  data = addTrade(addTrade(data, a.id, t1), a.id, t2);
  data = addTrade(data, b.id, t3);
  return { data, a, b, t1, t2, t3 };
}

describe("закладки", () => {
  it("перенос закладки в другую папку перед другой закладкой", () => {
    const { data, a, b, t2, t3 } = setup();
    const moved = moveTrade(data, t2.id, b.id, t3.id);
    expect(moved.folders.find((f) => f.id === a.id)!.trades.map((t) => t.title)).toEqual(["Z-ring"]);
    expect(moved.folders.find((f) => f.id === b.id)!.trades.map((t) => t.title)).toEqual(["Amulet", "A-ring"]);
  });

  it("перенос в конец своей папки", () => {
    const { data, a, t1 } = setup();
    expect(moveTrade(data, t1.id, a.id, null).folders[0].trades.map((t) => t.title)).toEqual(["Amulet", "Z-ring"]);
  });

  it("перестановка папок", () => {
    const { data, a, b } = setup();
    expect(moveFolder(data, b.id, a.id).folders.map((f) => f.title)).toEqual(["B", "A"]);
    expect(moveFolder(data, a.id, null).folders.map((f) => f.title)).toEqual(["B", "A"]);
  });

  it("архивация уносит папку в конец", () => {
    const { data, a } = setup();
    const archived = toggleFolderArchive(data, a.id);
    expect(archived.folders.map((f) => f.title)).toEqual(["B", "A"]);
    expect(archived.folders[1].archivedAt).not.toBeNull();
  });

  it("закладка для адреса: без учёта лиги, по алфавиту, активные важнее архива", () => {
    const { data, a } = setup();
    const loc = parseTradePath("/trade/search/Hardcore/s1/live");
    expect(findTradeByLocation(data, loc)?.trade.title).toBe("A-ring");
    const bArchived = toggleFolderArchive(data, data.folders[1].id);
    expect(findTradeByLocation(bArchived, loc)?.folder.id).toBe(a.id);
    expect(findTradeByLocation(data, parseTradePath("/trade/search/Standard/none"))).toBeNull();
  });
});

describe("история", () => {
  const loc = parseTradePath("/trade/search/Standard/s1");
  it("повтор подряд не пишется, но дописывает пустое имя", () => {
    let h = addHistoryEntry([], loc, "");
    h = addHistoryEntry(h, loc, "Кольцо");
    expect(h).toHaveLength(1);
    expect(h[0].title).toBe("Кольцо");
    expect(addHistoryEntry(h, loc, "Другое")[0].title).toBe("Кольцо");
  });

  it("не больше 50 записей, новые сверху; главная страница не пишется", () => {
    let h = addHistoryEntry([], parseTradePath("/trade"), "x");
    expect(h).toHaveLength(0);
    for (let i = 0; i < MAX_HISTORY + 5; i++) h = addHistoryEntry(h, parseTradePath(`/trade/search/Standard/s${i}`), `t${i}`);
    expect(h).toHaveLength(MAX_HISTORY);
    expect(h[0].title).toBe(`t${MAX_HISTORY + 4}`);
  });
});
