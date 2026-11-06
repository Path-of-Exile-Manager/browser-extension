// Шрифты дизайн-системы (Inter, JetBrains Mono — SIL OFL) для элементов внутри страницы сайта.
// @font-face в CSS content script не знает адреса расширения, поэтому регистрируем через FontFace API.
// Файлы кладёт в dist/fonts скрипт сборки; они перечислены в web_accessible_resources.

const CYRILLIC = "U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116";
const LATIN =
  "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";

const FACES = [
  { family: "Inter Variable", file: "inter-latin-wght-normal.woff2", range: LATIN },
  { family: "Inter Variable", file: "inter-cyrillic-wght-normal.woff2", range: CYRILLIC },
  { family: "JetBrains Mono Variable", file: "jetbrains-mono-latin-wght-normal.woff2", range: LATIN },
  { family: "JetBrains Mono Variable", file: "jetbrains-mono-cyrillic-wght-normal.woff2", range: CYRILLIC },
];

export function registerFonts(): void {
  for (const f of FACES) {
    try {
      const face = new FontFace(f.family, `url("${chrome.runtime.getURL(`fonts/${f.file}`)}") format("woff2")`, {
        weight: "100 900",
        style: "normal",
        display: "swap",
        unicodeRange: f.range,
      });
      document.fonts.add(face);
    } catch {
      // Без шрифта элементы покажутся системным sans-serif — не критично.
    }
  }
}
