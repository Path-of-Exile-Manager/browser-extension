import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { installChromeMock } from "../dev/chrome-mock";

// В тестах chrome.storage — заглушка на localStorage jsdom; перед каждым тестом — пустая.
installChromeMock();
beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

// jsdom не умеет ResizeObserver, scrollIntoView и pointer capture — Radix их ожидает.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= () => {};
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
