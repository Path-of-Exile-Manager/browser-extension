/// <reference types="node" />
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { TRADE_TAB_PORT, type BridgeStatus } from "@/shared/messages";
import { Bridge, classifyDisconnect, RETRY_MS, type BridgeApi } from "./bridge";

/** Порт Chrome: события и отправленные сообщения. */
function fakePort(name = "") {
  const disconnect = new Set<() => void>();
  const message = new Set<(m: unknown) => void>();
  const port = {
    name,
    sent: [] as unknown[],
    disconnected: false,
    onDisconnect: { addListener: (fn: () => void) => disconnect.add(fn) },
    onMessage: { addListener: (fn: (m: unknown) => void) => message.add(fn) },
    postMessage: (m: unknown) => port.sent.push(m),
    disconnect: () => {
      port.disconnected = true;
    },
    /** Другая сторона прислала сообщение. */
    receive: (m: unknown) => message.forEach((fn) => fn(m)),
    /** Другая сторона закрыла порт. */
    close: () => disconnect.forEach((fn) => fn()),
  };
  return port;
}
type FakePort = ReturnType<typeof fakePort>;

function setup() {
  const natives: FakePort[] = [];
  const statuses: BridgeStatus[] = [];
  const timers: Array<{ fn: () => void; ms: number }> = [];
  let onConnect: (port: chrome.runtime.Port) => void = () => {};
  let lastError: string | undefined;
  const api: BridgeApi = {
    connectNative: vi.fn(() => {
      const port = fakePort();
      natives.push(port);
      return port as unknown as chrome.runtime.Port;
    }),
    lastErrorMessage: () => lastError,
    onConnect: (listener) => {
      onConnect = listener;
    },
    writeStatus: (s) => statuses.push(s),
    extVersion: "0.2.0",
    extensionId: "abnbkbopbfhbfbinmeihjniikcamacol",
    browserVersion: "153.0.1",
    setTimeout: (fn, ms) => timers.push({ fn, ms }),
    clearTimeout: () => timers.splice(0),
  };
  const bridge = new Bridge(api);
  bridge.start();
  return {
    bridge,
    api,
    natives,
    timers,
    state: () => bridge.getStatus().state,
    openTab: () => {
      const tab = fakePort(TRADE_TAB_PORT);
      onConnect(tab as unknown as chrome.runtime.Port);
      return tab;
    },
    setLastError: (m: string | undefined) => {
      lastError = m;
    },
  };
}

describe("связь с приложением", () => {
  it("без вкладок торговли не подключается", () => {
    const t = setup();
    expect(t.state()).toBe("idle");
    expect(t.api.connectNative).not.toHaveBeenCalled();
  });

  it("рукопожатие: app-status → hello → welcome", () => {
    const t = setup();
    t.openTab();
    expect(t.api.connectNative).toHaveBeenCalledWith("com.poemanager.bridge");
    expect(t.state()).toBe("connecting");

    const native = t.natives[0];
    native.receive({ v: 1, type: "app-status", running: true });
    const hello = native.sent[0] as { type: string; id: string; extVersion: string; browser: string; extensionId: string };
    expect(hello).toMatchObject({ v: 1, type: "hello", extVersion: "0.2.0", browser: "chrome", browserVersion: "153.0.1" });

    native.receive({ v: 1, type: "welcome", re: hello.id, appVersion: "0.1.0", protocol: 1, features: [] });
    expect(t.bridge.getStatus()).toMatchObject({ state: "connected", appVersion: "0.1.0" });
  });

  it("приложение не запущено, потом закрыли — сами не запускаем, ждём", () => {
    const t = setup();
    t.openTab();
    const native = t.natives[0];
    native.receive({ v: 1, type: "app-status", running: false });
    expect(t.state()).toBe("app-closed");
    expect(native.sent).toHaveLength(0);

    native.receive({ v: 1, type: "app-status", running: true });
    native.receive({ v: 1, type: "welcome", re: (native.sent[0] as { id: string }).id, appVersion: "0.1.0", protocol: 1, features: [] });
    expect(t.state()).toBe("connected");

    native.receive({ v: 1, type: "app-status", running: false });
    expect(t.bridge.getStatus()).toMatchObject({ state: "app-closed", appVersion: null });
    expect(t.api.connectNative).toHaveBeenCalledTimes(1);
  });

  it("приложение не установлено → повтор через минуту", () => {
    const t = setup();
    t.openTab();
    t.setLastError("Specified native messaging host not found.");
    t.natives[0].close();
    expect(t.state()).toBe("not-installed");
    expect(t.timers).toEqual([expect.objectContaining({ ms: RETRY_MS["not-installed"] })]);
    t.timers[0].fn();
    expect(t.api.connectNative).toHaveBeenCalledTimes(2);
  });

  it("одно соединение на все вкладки; последняя закрылась — отключаемся", () => {
    const t = setup();
    const a = t.openTab();
    const b = t.openTab();
    expect(t.api.connectNative).toHaveBeenCalledTimes(1);
    a.close();
    expect(t.natives[0].disconnected).toBe(false);
    b.close();
    expect(t.natives[0].disconnected).toBe(true);
    expect(t.state()).toBe("idle");
  });

  it("чужие и неизвестные сообщения игнорируются", () => {
    const t = setup();
    t.openTab();
    const native = t.natives[0];
    native.receive({ v: 2, type: "app-status", running: true });
    native.receive({ v: 1, type: "future-feature" });
    native.receive("мусор");
    expect(t.state()).toBe("connecting");
    // welcome на чужой запрос — не наш
    native.receive({ v: 1, type: "app-status", running: true });
    native.receive({ v: 1, type: "welcome", re: "other", appVersion: "9", protocol: 1, features: [] });
    expect(t.state()).toBe("connecting");
  });

  it("тексты ошибок Chrome", () => {
    expect(classifyDisconnect("Specified native messaging host not found.").state).toBe("not-installed");
    expect(classifyDisconnect("Access to the specified native messaging host is forbidden.").error).toMatch(/ID расширения/);
    expect(classifyDisconnect("Native host has exited.").error).toMatch(/завершился/);
  });
});

it("ID расширения выводится из ключа в extension-id.json (как это делает Chrome)", () => {
  // Тесты запускаются из корня расширения.
  const { id, key } = JSON.parse(readFileSync(join(process.cwd(), "scripts", "extension-id.json"), "utf8")) as { id: string; key: string };
  const hex = createHash("sha256").update(Buffer.from(key, "base64")).digest("hex").slice(0, 32);
  const derived = [...hex].map((c) => String.fromCharCode(97 + Number.parseInt(c, 16))).join("");
  expect(derived).toBe(id);
  // Тот же ID ждёт приложение.
  const config = readFileSync(join(process.cwd(), "..", "desktop-application", "crates", "browser-bridge", "src", "config.rs"), "utf8");
  expect(config).toContain(`DEV_EXTENSION_ID: &str = "${id}"`);
});
