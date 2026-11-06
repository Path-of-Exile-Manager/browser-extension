// Связь с приложением poe-manager через Chrome Native Messaging (docs/extension-bridge.md).
//
// - Держим соединение, только пока открыта хотя бы одна вкладка торговли (порт «trade-tab» от content script):
//   открытый порт Native Messaging не даёт service worker заснуть.
// - Приложение сами не запускаем (решение 16): мост сообщает `app-status`, и мы ждём, пока пользователь его откроет.
// - Статус пишем в chrome.storage.session — его показывает панель.
import {
  BRIDGE_STATUS_KEY,
  IDLE_STATUS,
  isNativeIncoming,
  NATIVE_HOST,
  PROTOCOL_VERSION,
  TRADE_TAB_PORT,
  type BridgeState,
  type BridgeStatus,
  type NativeIncoming,
  type NativeOutgoing,
} from "@/shared/messages";
import { uid } from "@/shared/ids";

/** Через сколько повторить, если мост завершился с ошибкой. */
export const RETRY_MS = { error: 10_000, "not-installed": 60_000 } as const;

type Port = chrome.runtime.Port;

/** Часть chrome.*, которой пользуется мост, — чтобы в тестах подставить заглушку. */
export type BridgeApi = {
  connectNative: (host: string) => Port;
  lastErrorMessage: () => string | undefined;
  onConnect: (listener: (port: Port) => void) => void;
  writeStatus: (status: BridgeStatus) => void;
  extVersion: string;
  extensionId: string;
  browserVersion: string | null;
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
};

export function chromeApi(): BridgeApi {
  return {
    connectNative: (host) => chrome.runtime.connectNative(host),
    lastErrorMessage: () => chrome.runtime.lastError?.message,
    onConnect: (listener) => chrome.runtime.onConnect.addListener(listener),
    writeStatus: (status) => void chrome.storage.session.set({ [BRIDGE_STATUS_KEY]: status }),
    extVersion: chrome.runtime.getManifest().version,
    extensionId: chrome.runtime.id,
    browserVersion: navigator.userAgent.match(/Chrome\/([\d.]+)/)?.[1] ?? null,
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  };
}

/** Текст ошибки Chrome при отключении порта → состояние. */
export function classifyDisconnect(message: string | undefined): { state: BridgeState; error: string | null } {
  if (!message) return { state: "error", error: "Мост завершился без объяснения причины" };
  if (/not found/i.test(message)) return { state: "not-installed", error: null };
  if (/forbidden/i.test(message)) return { state: "error", error: "Приложение не разрешает подключаться этому расширению (другой ID расширения)" };
  if (/exited/i.test(message)) return { state: "error", error: "Мост приложения неожиданно завершился" };
  return { state: "error", error: message };
}

export class Bridge {
  private native: Port | null = null;
  private readonly tabs = new Set<Port>();
  private retryTimer: unknown = null;
  private status: BridgeStatus = { ...IDLE_STATUS };
  private pendingHello: string | null = null;

  constructor(private readonly api: BridgeApi) {}

  start(): void {
    this.setStatus({ state: "idle" });
    this.api.onConnect((port) => {
      if (port.name !== TRADE_TAB_PORT) return;
      this.tabs.add(port);
      port.onDisconnect.addListener(() => {
        this.tabs.delete(port);
        if (this.tabs.size === 0) this.disconnect();
      });
      this.connect();
    });
  }

  getStatus(): BridgeStatus {
    return this.status;
  }

  private setStatus(patch: Partial<BridgeStatus>): void {
    this.status = { ...this.status, ...patch, updatedAt: Date.now() };
    if (patch.state && patch.state !== "connected") this.status = { ...this.status, appVersion: patch.appVersion ?? null, features: patch.features ?? [] };
    this.api.writeStatus(this.status);
  }

  private connect(): void {
    if (this.native || this.tabs.size === 0) return;
    if (this.retryTimer !== null) {
      this.api.clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    let port: Port;
    try {
      port = this.api.connectNative(NATIVE_HOST);
    } catch (error) {
      this.setStatus({ state: "error", error: error instanceof Error ? error.message : String(error) });
      return;
    }
    this.native = port;
    this.setStatus({ state: "connecting", error: null });

    port.onMessage.addListener((message: unknown) => this.onNativeMessage(message));
    port.onDisconnect.addListener(() => {
      // lastError нужно прочитать здесь, иначе Chrome пишет «Unchecked runtime.lastError».
      const { state, error } = classifyDisconnect(this.api.lastErrorMessage());
      if (this.native !== port) return; // отключили сами
      this.native = null;
      this.pendingHello = null;
      this.setStatus({ state, error });
      if (this.tabs.size > 0 && (state === "error" || state === "not-installed")) {
        this.retryTimer = this.api.setTimeout(() => {
          this.retryTimer = null;
          this.connect();
        }, RETRY_MS[state]);
      }
    });
  }

  private disconnect(): void {
    if (this.retryTimer !== null) {
      this.api.clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    const port = this.native;
    this.native = null;
    this.pendingHello = null;
    port?.disconnect();
    this.setStatus({ state: "idle", error: null });
  }

  private send(message: NativeOutgoing): void {
    this.native?.postMessage(message);
  }

  private onNativeMessage(raw: unknown): void {
    if (!isNativeIncoming(raw)) return; // неизвестное — от будущих версий приложения
    const message: NativeIncoming = raw;
    switch (message.type) {
      case "app-status":
        if (message.running) {
          this.setStatus({ state: "connecting", error: null });
          this.pendingHello = uid();
          this.send({
            v: PROTOCOL_VERSION,
            type: "hello",
            id: this.pendingHello,
            extVersion: this.api.extVersion,
            browser: "chrome",
            browserVersion: this.api.browserVersion,
            extensionId: this.api.extensionId,
          });
        } else {
          this.pendingHello = null;
          this.setStatus({ state: "app-closed", error: null });
        }
        break;
      case "welcome":
        if (message.re && message.re !== this.pendingHello) return;
        this.pendingHello = null;
        this.setStatus({ state: "connected", appVersion: message.appVersion, features: message.features, error: null });
        break;
      case "error":
        if (message.re && message.re === this.pendingHello) {
          this.pendingHello = null;
          this.setStatus({ state: "error", error: `Приложение отклонило подключение: ${message.message}` });
        }
        break;
    }
  }
}
