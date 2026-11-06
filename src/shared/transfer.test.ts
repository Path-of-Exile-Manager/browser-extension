import { describe, expect, it } from "vitest";
import { newFolder, newTrade } from "./bookmarks";
import { BACKUP_SECTION_DELIMITER, deserializeFolder, generateBackup, normalizeIcon, restoreBackup, serializeFolder } from "./transfer";
import type { BookmarkFolder } from "./types";

/** Код папки так, как его делает Better Trading 1.9.2 (js-base64: UTF-8 → Base64). */
function btCode(version: 1 | 2 | 3, payload: object): string {
  const json = JSON.stringify(payload);
  if (version === 1) return btoa(json);
  const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(json)));
  return `${version}:${b64}`;
}

function folder(title: string, trades: Array<[string, string]>, extra: Partial<BookmarkFolder> = {}): BookmarkFolder {
  return {
    ...newFolder({ title, icon: "gem", version: "1" }),
    trades: trades.map(([t, slug]) => newTrade(t, { version: "1", type: "search", slug })),
    ...extra,
  };
}

describe("код папки", () => {
  it("туда и обратно, с кириллицей", () => {
    const f = folder("Билд на молнии ⚡", [
      ["Кольцо", "r1"],
      ["Амулет", "a2"],
    ]);
    const restored = deserializeFolder(serializeFolder(f))!;
    expect(restored.title).toBe("Билд на молнии ⚡");
    expect(restored.icon).toBe("gem");
    expect(restored.trades.map((t) => [t.title, t.location])).toEqual([
      ["Кольцо", { version: "1", type: "search", slug: "r1" }],
      ["Амулет", { version: "1", type: "search", slug: "a2" }],
    ]);
    // Новые id, чтобы импорт не конфликтовал с исходной папкой.
    expect(restored.id).not.toBe(f.id);
  });

  it("читает код Better Trading v3 и переводит его значки", () => {
    const code = btCode(3, { icn: "poe2-chaos", tit: "Monk", ver: "2", trs: [{ tit: "Staff", loc: "2:search:S1" }] });
    expect(deserializeFolder(code)).toMatchObject({
      title: "Monk",
      icon: "coins",
      version: "2",
      trades: [{ title: "Staff", location: { version: "2", type: "search", slug: "S1" } }],
    });
  });

  it("читает старые коды v2 и v1", () => {
    expect(deserializeFolder(btCode(2, { icn: "slayer", tit: "Слэер", trs: [{ tit: "Меч", loc: "search:x" }] }))).toMatchObject({
      title: "Слэер",
      icon: "swords",
      version: "1",
      trades: [{ location: { version: "1", type: "search", slug: "x" } }],
    });
    expect(deserializeFolder(btCode(1, { icn: null, tit: "Old", trs: [{ tit: "T", loc: "exchange:e" }] }))).toMatchObject({
      icon: "folder",
      trades: [{ location: { type: "exchange", slug: "e" } }],
    });
  });

  it("мусор — null, а не исключение", () => {
    expect(deserializeFolder("")).toBeNull();
    expect(deserializeFolder("3:не base64")).toBeNull();
    expect(deserializeFolder(btoa("{}"))).toBeNull();
  });

  it("неизвестный значок — папка", () => {
    expect(normalizeIcon("something-new")).toBe("swords");
    expect(normalizeIcon(42)).toBe("folder");
    expect(normalizeIcon("map")).toBe("map");
  });
});

describe("резервная копия", () => {
  it("разделяет активные и архивные папки, как Better Trading", () => {
    const active = folder("A", [["t", "1"]]);
    const archived = folder("B", [["t", "2"]], { archivedAt: "2026-01-01T00:00:00.000Z" });
    const text = generateBackup([active, archived]);
    const [a, b] = text.split(BACKUP_SECTION_DELIMITER);
    expect(a.split("\n")).toHaveLength(1);
    expect(b.split("\n")).toHaveLength(1);

    const restored = restoreBackup([], text);
    expect(restored.added).toBe(2);
    expect(restored.folders.map((f) => [f.title, Boolean(f.archivedAt)])).toEqual([
      ["A", false],
      ["B", true],
    ]);
  });

  it("повторное восстановление не удваивает папки", () => {
    const text = generateBackup([folder("A", [["t", "1"]])]);
    const once = restoreBackup([], text);
    const twice = restoreBackup(once.folders, text);
    expect(twice.added).toBe(0);
    expect(twice.skipped).toBe(1);
    expect(twice.folders).toHaveLength(1);
  });

  it("принимает файл Better Trading с переводами строк Windows", () => {
    const code = btCode(3, { icn: "divine", tit: "Валюта", ver: "1", trs: [{ tit: "Divine", loc: "1:exchange:d" }] });
    const result = restoreBackup([], `${code}\r\n--------------------\r\n`);
    expect(result.added).toBe(1);
    expect(result.folders[0]).toMatchObject({ title: "Валюта", icon: "coins", archivedAt: null });
  });

  it("считает нераспознанные строки", () => {
    expect(restoreBackup([], "мусор\nещё мусор").invalid).toBe(2);
  });
});
