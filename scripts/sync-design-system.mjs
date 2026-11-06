// Копирует дизайн-систему из десктопного приложения в расширение.
//
// Источник истины — desktop-application/ui/src/design-system (там токены, компоненты, правила).
// Расширение — отдельный репозиторий, поэтому держит копию; руками в src/design-system не правим,
// а меняем в десктопе и запускаем `pnpm sync:design-system`.
//
// Что делает:
//   1. Копирует папку целиком, кроме тестов (*.test.ts/tsx).
//   2. Пишет src/design-system/SOURCE.md — откуда и когда скопировано, хэш содержимого.
//   3. Генерирует src/content/generated/tokens-scoped.css: те же CSS-переменные, но не на :root,
//      а на `.pmgr-ui` — для элементов, которые content script вставляет в страницу сайта торговли.
//      Так токены не попадают в глобальную область чужого сайта.
//
// Путь к десктопу можно переопределить: DESKTOP_DIR=… pnpm sync:design-system

import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const desktopDir = process.env.DESKTOP_DIR ?? join(root, "..", "desktop-application");
const srcDs = join(desktopDir, "ui", "src", "design-system");
const dstDs = join(root, "src", "design-system");

if (!existsSync(srcDs)) {
  console.error(`Не найдена дизайн-система десктопа: ${srcDs}\nУкажите путь: DESKTOP_DIR=… pnpm sync:design-system`);
  process.exit(1);
}

rmSync(dstDs, { recursive: true, force: true });
cpSync(srcDs, dstDs, {
  recursive: true,
  filter: (path) => !/\.test\.tsx?$/.test(path),
});

// Хэш содержимого — чтобы видеть, отличается ли копия от десктопа.
const hash = createHash("sha256");
const files = [];
function walk(dir) {
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else {
      files.push(relative(dstDs, path).replaceAll("\\", "/"));
      hash.update(relative(dstDs, path).replaceAll("\\", "/"));
      hash.update(readFileSync(path));
    }
  }
}
walk(dstDs);

writeFileSync(
  join(dstDs, "SOURCE.md"),
  [
    "# Копия дизайн-системы",
    "",
    "Эта папка — **копия** `desktop-application/ui/src/design-system`. Руками не править:",
    "меняйте дизайн-систему в десктопе и запускайте `pnpm sync:design-system`.",
    "",
    `- Скопировано: ${new Date().toISOString()}`,
    `- Файлов: ${files.length}`,
    `- SHA-256 содержимого: \`${hash.digest("hex")}\``,
    "",
  ].join("\n"),
);

// ---------- токены для элементов внутри страницы сайта ----------
const tokensCss = readFileSync(join(dstDs, "tokens", "tokens.css"), "utf8");
const rootBlock = tokensCss.match(/:root\s*\{([\s\S]*?)\n\}/);
const compactBlock = tokensCss.match(/\[data-density="compact"\]\s*\{([\s\S]*?)\n\}/);
if (!rootBlock || !compactBlock) {
  console.error("Не удалось разобрать tokens.css: нет блока :root или [data-density=compact]");
  process.exit(1);
}
const generatedDir = join(root, "src", "content", "generated");
mkdirSync(generatedDir, { recursive: true });
writeFileSync(
  join(generatedDir, "tokens-scoped.css"),
  [
    "/* Сгенерировано scripts/sync-design-system.mjs из design-system/tokens/tokens.css. Руками не править. */",
    "/* Токены живут на .pmgr-ui, а не на :root: страница сайта торговли — чужая. Плотность всегда компактная. */",
    `.pmgr-ui {${rootBlock[1]}\n${compactBlock[1]}\n}`,
    "",
  ].join("\n"),
);

console.log(`design-system: ${files.length} файлов скопировано из ${relative(root, srcDs)}`);
console.log("tokens-scoped.css: обновлён");
