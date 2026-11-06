import { describe, expect, it } from "vitest";
import { buildTradeUrl, leagueName, parseTradePath, realmName, sameSearch } from "./location";

describe("parseTradePath", () => {
  it("PoE 1, обычный поиск", () => {
    expect(parseTradePath("/trade/search/Settlers%20of%20Kalguur/AbC123")).toEqual({
      version: "1",
      type: "search",
      league: "Settlers%20of%20Kalguur",
      slug: "AbC123",
      isLive: false,
    });
  });

  it("live-поиск", () => {
    expect(parseTradePath("/trade/search/Standard/xyz/live").isLive).toBe(true);
  });

  it("PoE 2: реалм poe2 входит в лигу", () => {
    expect(parseTradePath("/trade2/search/poe2/Rise%20of%20the%20Abyssal/q1")).toEqual({
      version: "2",
      type: "search",
      league: "poe2/Rise%20of%20the%20Abyssal",
      slug: "q1",
      isLive: false,
    });
  });

  it("консоль: xbox", () => {
    const loc = parseTradePath("/trade/exchange/xbox/Standard/ex1");
    expect(loc).toMatchObject({ type: "exchange", league: "xbox/Standard", slug: "ex1" });
    expect(realmName(loc.league)).toBe("Xbox");
  });

  it("главная страница торговли — без поиска", () => {
    expect(parseTradePath("/trade")).toEqual({ version: "1", type: null, league: null, slug: null, isLive: false });
    expect(parseTradePath("/trade/search/Standard")).toMatchObject({ league: "Standard", slug: null });
  });
});

describe("buildTradeUrl", () => {
  it("собирает адрес обратно, в том числе live и trade2", () => {
    expect(buildTradeUrl({ version: "1", type: "search", slug: "a" }, "Standard")).toBe("https://www.pathofexile.com/trade/search/Standard/a");
    expect(buildTradeUrl({ version: "2", type: "search", slug: "b" }, "poe2/Standard", { live: true })).toBe(
      "https://www.pathofexile.com/trade2/search/poe2/Standard/b/live",
    );
  });

  it("разбор и сборка взаимно обратны", () => {
    const path = "/trade2/search/poe2/Dawn%20of%20the%20Hunt/zz9/live";
    const loc = parseTradePath(path);
    expect(buildTradeUrl({ version: loc.version, type: loc.type!, slug: loc.slug! }, loc.league!, { live: loc.isLive })).toBe(
      `https://www.pathofexile.com${path}`,
    );
  });
});

describe("подписи", () => {
  it("лига без реалма и URL-кодировки", () => {
    expect(leagueName("poe2/Rise%20of%20the%20Abyssal")).toBe("Rise of the Abyssal");
    expect(leagueName("Standard")).toBe("Standard");
    expect(leagueName(null)).toBeNull();
  });

  it("sameSearch не смотрит на лигу и live", () => {
    expect(sameSearch({ version: "1", type: "search", slug: "a" }, parseTradePath("/trade/search/Hardcore/a/live"))).toBe(true);
    expect(sameSearch({ version: "2", type: "search", slug: "a" }, parseTradePath("/trade/search/Hardcore/a"))).toBe(false);
  });
});
