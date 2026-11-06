// Проверка главного правила дизайн-системы: в коде UI — только токены (как pnpm check:tokens в десктопе).
//
// Ищет в src/ (кроме копии дизайн-системы и сгенерированных токенов):
//   - цвета значениями: #hex, rgb(), rgba(), hsl(), oklch();
//   - произвольные значения Tailwind с «сырыми» единицами: w-[20px], text-[13px], bg-[#fff];
//   - прямое использование примитивов: --primitive-*.
// Исключение — строка с комментарием `tokens-allow`.
// content.css проверяется на цвета и примитивы; px в нём допустимы только в правилах раскладки сайта
// (ширина панели), поэтому правило про произвольные значения Tailwind к CSS не применяется.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "src");
const skipDirs = [join(srcDir, "design-system"), join(srcDir, "content", "generated")];

const rules = [
  { name: "цвет значением (#hex)", re: /(?<![&\w])#[0-9a-fA-F]{3,8}\b(?![\w-])/ },
  { name: "цвет функцией (rgb/hsl/oklch)", re: /\b(rgba?|hsla?|oklch|oklab|lab|lch)\(/ },
  { name: "произвольное значение Tailwind с единицами", re: /-\[[^\]]*?\d(px|rem|em)\b[^\]]*\]/, tsxOnly: true },
  { name: "произвольный цвет Tailwind", re: /-\[#/ },
  { name: "примитив вместо семантического токена", re: /--primitive-/ },
];

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (skipDirs.includes(path)) continue;
    if (statSync(path).isDirectory()) yield* files(path);
    else if (/\.(tsx?|css)$/.test(name) && !/\.test\.tsx?$/.test(name)) yield path;
  }
}

const problems = [];
for (const file of files(srcDir)) {
  const isCss = file.endsWith(".css");
  readFileSync(file, "utf8")
    .split(/\r?\n/)
    .forEach((line, i) => {
      if (line.includes("tokens-allow")) return;
      for (const rule of rules) {
        if (rule.tsxOnly && isCss) continue;
        if (rule.re.test(line)) problems.push(`${relative(root, file)}:${i + 1}  ${rule.name}\n    ${line.trim()}`);
      }
    });
}

if (problems.length) {
  console.error(`Найдено нарушений правила «только токены»: ${problems.length}\n`);
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log("check-tokens: нарушений нет");
