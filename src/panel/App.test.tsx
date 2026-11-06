import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DesignSystemProvider } from "@/design-system";
import { parseTradePath } from "@/shared/location";
import { CONTENT_SOURCE } from "@/shared/messages";
import { KEYS, read, write } from "@/shared/storage";
import { generateBackup } from "@/shared/transfer";
import { newFolder, newTrade } from "@/shared/bookmarks";
import { setMockBridgeStatus } from "../../dev/chrome-mock";
import { App } from "./App";
import { startBridge, useTrade } from "./bridge";

startBridge();

function renderApp() {
  return render(
    <DesignSystemProvider toasts={false}>
      <App />
    </DesignSystemProvider>,
  );
}

/** Сообщение от content script, как его присылает страница сайта. */
function pageState(path: string, recommendedTitle = "") {
  act(() => {
    useTrade.setState({ connected: true, location: parseTradePath(path), recommendedTitle, visibleItemIds: [] });
  });
}

describe("панель", () => {
  it("без страницы сайта — подсказка, а не пустота", async () => {
    useTrade.setState({ connected: false, location: null });
    renderApp();
    expect(await screen.findByText("Нет связи с сайтом торговли", {}, { timeout: 3000 })).toBeInTheDocument();
  });

  it("сохраняет открытый поиск в новую папку и показывает его как текущий", async () => {
    const user = userEvent.setup();
    renderApp();
    pageState("/trade/search/Mercenaries/Ab3dE9fQ", "Body Armour (Rare)");

    await user.click(await screen.findByRole("button", { name: "Сохранить поиск" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Название")).toHaveValue("Body Armour (Rare)");
    // Папок ещё нет — предлагается новая с именем по умолчанию.
    expect(within(dialog).getByLabelText("Название новой папки")).toHaveValue("Закладки");
    await user.click(within(dialog).getByRole("button", { name: "Сохранить" }));

    await waitFor(async () => {
      const { folders } = await read(KEYS.bookmarks);
      expect(folders).toHaveLength(1);
      expect(folders[0]).toMatchObject({ title: "Закладки", version: "1", trades: [{ title: "Body Armour (Rare)", location: { slug: "Ab3dE9fQ" } }] });
    });
    // Шапка теперь говорит, что поиск уже в закладках, а в списке он выделен как текущий.
    expect(await screen.findByTitle("Закладки / Body Armour (Rare)")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /Body Armour \(Rare\)/, current: "page" })).toBeInTheDocument();
  });

  it("показывает только папки своей игры", async () => {
    const poe1 = { ...newFolder({ title: "Билд PoE1", icon: "zap", version: "1" }), trades: [newTrade("Кольцо", { version: "1", type: "search", slug: "r" })] };
    const poe2 = newFolder({ title: "Монах PoE2", icon: "swords", version: "2" });
    await write(KEYS.bookmarks, { folders: [poe1, poe2] });
    renderApp();
    pageState("/trade2/search/poe2/Standard/x");
    expect(await screen.findByText("Монах PoE2")).toBeInTheDocument();
    expect(screen.queryByText("Билд PoE1")).not.toBeInTheDocument();
    expect(screen.getByText(/Ещё 1 папка для PoE 1/)).toBeInTheDocument();
  });

  it("восстанавливает закладки из файла резервной копии", async () => {
    const user = userEvent.setup();
    renderApp();
    pageState("/trade/search/Standard/a");
    await user.click(await screen.findByRole("button", { name: "Настройки" }));
    const backup = generateBackup([{ ...newFolder({ title: "Из Better Trading", icon: "coins", version: "1" }), trades: [] }]);
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    await user.upload(input, new File([backup], "backup.txt", { type: "text/plain" }));
    await waitFor(async () => expect((await read(KEYS.bookmarks)).folders.map((f) => f.title)).toEqual(["Из Better Trading"]));
  });

  it("показывает связь с приложением poe-manager", async () => {
    const user = userEvent.setup();
    await setMockBridgeStatus({ state: "app-closed" });
    renderApp();
    pageState("/trade/search/Standard/a");
    expect(await screen.findByRole("button", { name: "Приложение не запущено" })).toBeInTheDocument();

    await act(() => setMockBridgeStatus({ state: "connected", appVersion: "0.1.0" }));
    await user.click(await screen.findByRole("button", { name: "Приложение на связи · 0.1.0" }));
    // Клик по значку открывает настройки, где статус расписан подробно.
    expect(await screen.findByText("Связь работает, пока открыта вкладка сайта торговли.")).toBeInTheDocument();
  });

  it("сообщения принимаются только от родительского окна", () => {
    useTrade.setState({ connected: false, location: null });
    window.dispatchEvent(new MessageEvent("message", { data: { source: CONTENT_SOURCE, type: "state", location: parseTradePath("/trade") } }));
    expect(useTrade.getState().connected).toBe(false);
  });
});
