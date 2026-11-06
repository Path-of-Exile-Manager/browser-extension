// Сборка расширения в dist/ — эту папку загружают в Chrome («Загрузить распакованное»).
//
//   panel.html + assets/   — панель (React + дизайн-система), обычная сборка Vite по vite.config.ts
//   content.js             — content script сайта торговли, один IIFE-файл (content scripts не умеют ES-модули)
//   page-hook.js           — хук навигации в мире страницы (IIFE)
//   background.js          — service worker (ES-модуль)
//   content.css            — токены на .pm-ui + стили элементов в странице
//   fonts/                 — Inter и JetBrains Mono для элементов в странице
//   icons/, manifest.json
//
// `node scripts/build.mjs --zip` дополнительно кладёт архив для Chrome Web Store в release/.
import { spawnSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const TRADE_MATCHES = ["https://www.pathofexile.com/trade*", "https://pathofexile.com/trade*"];

// Постоянный ID распакованной сборки — см. scripts/extension-id.json (проверяется тестом key → ID).
const { id: EXTENSION_ID, key: EXTENSION_KEY } = JSON.parse(readFileSync(join(root, "scripts", "extension-id.json"), "utf8"));

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

// 1. Панель
await build({ configFile: join(root, "vite.config.ts"), logLevel: "warn" });

// 2. Скрипты: по одному файлу без общих чанков
const scripts = [
  { entry: "src/content/index.ts", file: "content.js", format: "iife" },
  { entry: "src/content/page-hook.ts", file: "page-hook.js", format: "iife" },
  { entry: "src/background/index.ts", file: "background.js", format: "es" },
];
for (const s of scripts) {
  await build({
    configFile: false,
    root,
    logLevel: "warn",
    resolve: { alias: { "@": join(root, "src") } },
    define: {
      __EXT_VERSION__: JSON.stringify(pkg.version),
      "process.env.NODE_ENV": JSON.stringify("production"),
    },
    build: {
      outDir: dist,
      emptyOutDir: false,
      // Небольшие файлы оставляем читаемыми: так их проще проверять в магазине расширений и отлаживать.
      minify: false,
      target: "chrome111",
      lib: { entry: join(root, s.entry), formats: [s.format], name: "poeManager", fileName: () => s.file },
    },
  });
}

// 3. Стили для страницы сайта
const tokensScoped = join(root, "src", "content", "generated", "tokens-scoped.css");
if (!existsSync(tokensScoped)) {
  console.error("Нет src/content/generated/tokens-scoped.css — запустите pnpm sync:design-system");
  process.exit(1);
}
writeFileSync(
  join(dist, "content.css"),
  readFileSync(tokensScoped, "utf8") + "\n" + readFileSync(join(root, "src", "content", "content.css"), "utf8"),
);

// 4. Шрифты для элементов в странице (панель берёт свои из assets/)
mkdirSync(join(dist, "fonts"), { recursive: true });
for (const [pkgName, prefix] of [
  ["@fontsource-variable/inter", "inter"],
  ["@fontsource-variable/jetbrains-mono", "jetbrains-mono"],
]) {
  for (const subset of ["latin", "cyrillic"]) {
    const file = `${prefix}-${subset}-wght-normal.woff2`;
    copyFileSync(join(root, "node_modules", ...pkgName.split("/"), "files", file), join(dist, "fonts", file));
  }
}

// 5. Иконки
cpSync(join(root, "public", "icons"), join(dist, "icons"), { recursive: true });

// 6. Манифест
const icons = { 16: "icons/icon-16.png", 32: "icons/icon-32.png", 48: "icons/icon-48.png", 128: "icons/icon-128.png" };
const manifest = {
  manifest_version: 3,
  name: "poe-manager — сайт торговли",
  short_name: "poe-manager",
  version: pkg.version,
  description: "Закладки поисков, история, закреплённые лоты и пересчёт цен на pathofexile.com/trade (PoE 1 и PoE 2).",
  minimum_chrome_version: "111",
  icons,
  action: { default_title: "poe-manager: показать или скрыть панель", default_icon: icons },
  background: { service_worker: "background.js", type: "module" },
  // storage — закладки и настройки; nativeMessaging — связь с приложением poe-manager.
  permissions: ["storage", "nativeMessaging"],
  content_scripts: [
    { matches: TRADE_MATCHES, js: ["page-hook.js"], run_at: "document_start", world: "MAIN" },
    { matches: TRADE_MATCHES, js: ["content.js"], css: ["content.css"], run_at: "document_idle" },
  ],
  web_accessible_resources: [
    {
      resources: ["panel.html", "assets/*", "fonts/*"],
      matches: ["https://www.pathofexile.com/*", "https://pathofexile.com/*"],
    },
  ],
};
const writeManifest = (withKey) =>
  writeFileSync(join(dist, "manifest.json"), JSON.stringify(withKey ? { ...manifest, key: EXTENSION_KEY } : manifest, null, 2) + "\n");
writeManifest(true);

console.log(`Сборка готова: dist/ (версия ${pkg.version}, ID расширения ${EXTENSION_ID})`);

// 7. Архив для магазина
if (process.argv.includes("--zip")) {
  const release = join(root, "release");
  mkdirSync(release, { recursive: true });
  const zip = join(release, `poe-manager-extension-${pkg.version}.zip`);
  rmSync(zip, { force: true });
  // В магазин — без поля key: ID там выдаёт Chrome Web Store. Его потом нужно добавить приложению
  // (переменная сборки POE_MANAGER_EXTENSION_IDS, см. crates/browser-bridge/src/config.rs).
  writeManifest(false);
  // bsdtar есть в Windows 10+, macOS и большинстве Linux: -a выбирает формат по расширению.
  // Перечисляем содержимое dist явно: так manifest.json лежит в корне архива без префикса «./».
  const result = spawnSync("tar", ["-a", "-c", "-f", zip, "-C", dist, ...readdirSync(dist)], { stdio: "inherit" });
  writeManifest(true);
  if (result.status !== 0) {
    console.error("Не удалось создать архив (нужна утилита tar)");
    process.exit(1);
  }
  console.log(`Архив: release/poe-manager-extension-${pkg.version}.zip`);
}
