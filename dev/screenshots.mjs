// Скриншоты расширения на макете сайта торговли — для сверки с дизайн-системой.
//
// Нужны: запущенный `pnpm dev` (порт по умолчанию 5173, можно PORT=…) и установленный Chrome
// (CHROME=путь, если не в стандартном месте). Кликает через Chrome DevTools Protocol,
// панель в макете — тот же origin, поэтому до её DOM можно дотянуться из страницы.
//
//   node dev/screenshots.mjs            → .screens/*.png
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, ".screens");
mkdirSync(out, { recursive: true });

const PORT = process.env.PORT ?? "5173";
const BASE = `http://localhost:${PORT}/dev/trade-mock.html`;
const CHROME = process.env.CHROME ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const DEBUG_PORT = 9333;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${DEBUG_PORT}`,
    // Профиль — во временной папке: внутри проекта его файлы видит Vite и перезагружает страницу.
    `--user-data-dir=${join(tmpdir(), "poe-manager-extension-screens")}`,
    "--no-first-run",
    "--hide-scrollbars",
    "--window-size=1600,900",
    "about:blank",
  ],
  { stdio: "ignore" },
);

async function target() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json();
      const page = list.find((t) => t.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      /* Chrome ещё стартует */
    }
    await sleep(200);
  }
  throw new Error("Chrome не ответил по DevTools Protocol");
}

const ws = new WebSocket(await target());
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let nextId = 1;
const pending = new Map();
ws.addEventListener("message", (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, (msg) => (msg.error ? reject(new Error(`${method}: ${msg.error.message}`)) : resolve(msg.result)));
    ws.send(JSON.stringify({ id, method, params }));
  });

await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });

/** Выполнить код в странице. В нём доступны `panel` (document панели) и `click(el)`. */
async function run(code) {
  const expression = `(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0; i < 50 && !document.querySelector("#pmgr-panel iframe")?.contentDocument?.querySelector("[role=tablist]"); i++) await sleep(100);
    const frame = document.querySelector("#pmgr-panel iframe");
    if (!frame) throw new Error("панель не встроена: " + document.title + " " + location.href);
    const panel = frame.contentDocument;
    const byText = (doc, sel, text) => [...doc.querySelectorAll(sel)].find((el) => el.textContent.trim().includes(text));
    const press = (el) => {
      const opts = { bubbles: true, cancelable: true, button: 0, pointerType: "mouse", view: el.ownerDocument.defaultView };
      el.dispatchEvent(new PointerEvent("pointerdown", opts));
      el.dispatchEvent(new MouseEvent("mousedown", opts));
      el.dispatchEvent(new PointerEvent("pointerup", opts));
      el.dispatchEvent(new MouseEvent("mouseup", opts));
      el.click();
    };
    ${code}
  })()`;
  const result = await send("Runtime.evaluate", { expression, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
}

async function shot(name, query, code = "") {
  await send("Page.navigate", { url: `${BASE}?${query.startsWith("reset") ? "" : "seed=1&bridge=connected"}${query}` });
  await sleep(2500);
  if (code) {
    await run(code);
    await sleep(700);
  }
  const { data } = await send("Page.captureScreenshot", { format: "png" });
  // Windows: свежий PNG иногда на миг держит антивирус — повторяем запись.
  for (let attempt = 0; ; attempt++) {
    try {
      writeFileSync(join(out, `${name}.png`), Buffer.from(data, "base64"));
      break;
    } catch (error) {
      if (attempt >= 5) throw error;
      await sleep(500);
    }
  }
  console.log(`${name}.png`);
}

try {
  await shot("0-first-run", "reset=1&path=/trade/search/Mercenaries/NewSearch1");
  await shot("1-bookmarks", "");
  await shot("2-save-dialog", "&path=/trade/search/Mercenaries/NewSearch1", `press(byText(panel, "button", "Сохранить поиск"));`);
  await shot("3-history", "", `press(byText(panel, "[role=tab]", "История"));`);
  await shot(
    "4-pins",
    "",
    `press(document.querySelector('.row[data-id="a1f3"] .pmgr-pin-button'));
     await sleep(300);
     press(document.querySelector('.row[data-id="d4e8"] .pmgr-pin-button'));`,
  );
  await shot("5-settings", "", `press(panel.querySelector('button[aria-label="Настройки"]'));`);
  await shot("6-folder-menu", "", `press(panel.querySelector('button[aria-label^="Действия с папкой"]'));`);
  await shot("7-collapsed", "", `press(panel.querySelector('button[aria-label="Свернуть панель"]'));`);
  await shot("8-groups-expanded", "", `press(document.querySelector('.pmgr-group-button')); window.scrollTo(0, 700);`);
} finally {
  ws.close();
  chrome.kill();
}
