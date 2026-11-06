// Раскладка страницы: панель справа фиксированной ширины, сайт сужается на её ширину (как в Better Trading),
// а не перекрывается. Сама панель — iframe со страницей расширения: её стили и стили сайта
// друг на друга не влияют, а дизайн-система работает целиком (порталы Radix, шрифты, Tailwind).
import { icon } from "./icons";

/** Состояние «свёрнуто» дублируется в localStorage сайта: его можно прочитать синхронно, без мигания при загрузке. */
const COLLAPSED_KEY = "poe-manager:panel-collapsed";

export type Layout = {
  frame: HTMLIFrameElement;
  isCollapsed: () => boolean;
  setCollapsed: (collapsed: boolean) => void;
  onToggleRequest: (cb: (collapsed: boolean) => void) => void;
};

export function readCollapsedSync(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function mountLayout(panelUrl: string): Layout {
  const body = document.body;
  body.classList.add("pmgr-body");

  const panel = document.createElement("div");
  panel.id = "pmgr-panel";
  panel.className = "pmgr-ui";
  panel.setAttribute("data-density", "compact");

  const frame = document.createElement("iframe");
  frame.className = "pmgr-panel-frame";
  frame.title = "poe-manager — закладки и история";
  // Копирование ссылок из панели в буфер обмена.
  frame.allow = "clipboard-write";
  frame.src = panelUrl;
  panel.appendChild(frame);

  // Ярлык у правого края: виден, когда панель свёрнута.
  const handle = document.createElement("button");
  handle.id = "pmgr-handle";
  handle.type = "button";
  handle.className = "pmgr-ui";
  handle.title = "Показать панель poe-manager";
  handle.setAttribute("aria-label", "Показать панель poe-manager");
  const logo = document.createElement("span");
  logo.className = "pmgr-logo";
  logo.textContent = "p";
  handle.append(icon("chevrons-left", 16), logo);

  body.append(panel, handle);

  let collapsed = false;
  let toggleCb: ((c: boolean) => void) | null = null;
  handle.addEventListener("click", () => toggleCb?.(false));

  const setCollapsed = (value: boolean) => {
    collapsed = value;
    body.classList.toggle("pmgr-collapsed", value);
    panel.setAttribute("aria-hidden", String(value));
    // Свёрнутая панель не должна ловить фокус клавиатурой.
    frame.tabIndex = value ? -1 : 0;
    try {
      window.localStorage.setItem(COLLAPSED_KEY, value ? "1" : "0");
    } catch {
      /* приватный режим и т. п. */
    }
  };
  setCollapsed(readCollapsedSync());

  return {
    frame,
    isCollapsed: () => collapsed,
    setCollapsed,
    onToggleRequest: (cb) => {
      toggleCb = cb;
    },
  };
}
