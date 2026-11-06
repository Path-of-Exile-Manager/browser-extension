// Экспорт и импорт папок закладок, резервная копия.
//
// Форматы совпадают с Better PathOfExile Trading (см. docs/research-better-trading.md, п. 2.3),
// поэтому коды папок и файлы резервных копий переносятся между расширениями в обе стороны.
//
// Код папки v3: `3:` + Base64(UTF-8 JSON) — `{ icn, tit, ver, trs: [{ tit, loc: "версия:тип:slug" }] }`.
// Читаем также v2 (`2:` + Base64, в loc нет версии) и v1 (Base64 без префикса, только Latin-1).
//
// Резервная копия: коды активных папок по строке, разделитель, коды архивных папок.
import { newFolder, newTrade } from "./bookmarks";
import { FOLDER_ICONS, type BookmarkFolder, type BookmarkTrade, type FolderIcon, type GameVersion } from "./types";

export const BACKUP_SECTION_DELIMITER = "\n--------------------\n";
const LINE_DELIMITER = "\n";

function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function base64ToUtf8(base64: string): string {
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Иконки Better Trading (асцендантства, валюта) → наши иконки Lucide. */
const BT_ICON_MAP: Array<[RegExp, FolderIcon]> = [
  [/mirror/, "sparkles"],
  [/card/, "scroll"],
  [/essence/, "flask"],
  [/fossil|rune|gemcutter/, "gem"],
  [/map|waystone/, "map"],
  [/scarab/, "bug"],
  [/alchemy|chaos|exalt|divine|annul|augment|chance|regal|transmute|vaal|wisdom|artificer|glassblower/, "coins"],
];

export function normalizeIcon(icon: unknown): FolderIcon {
  if (typeof icon !== "string" || !icon) return "folder";
  if ((FOLDER_ICONS as readonly string[]).includes(icon)) return icon as FolderIcon;
  for (const [re, ours] of BT_ICON_MAP) if (re.test(icon)) return ours;
  // Остальное у Better Trading — асцендантства: оружие как общий знак билда.
  return "swords";
}

type ExportPayload = {
  icn: string | null;
  tit: string;
  ver?: string;
  trs: Array<{ tit: string; loc: string }>;
};

export function serializeFolder(folder: Pick<BookmarkFolder, "icon" | "title" | "version" | "trades">): string {
  const payload: ExportPayload = {
    icn: folder.icon,
    tit: folder.title,
    ver: folder.version,
    trs: folder.trades.map((t) => ({ tit: t.title, loc: `${t.location.version}:${t.location.type}:${t.location.slug}` })),
  };
  return `3:${utf8ToBase64(JSON.stringify(payload))}`;
}

function exportVersion(code: string): 1 | 2 | 3 {
  if (code.startsWith("3:")) return 3;
  if (code.startsWith("2:")) return 2;
  return 1;
}

const asVersion = (v: unknown): GameVersion => (v === "2" || v === 2 ? "2" : "1");

/** Разобрать код папки. Возвращает новую папку с новыми id или null, если код не похож на папку. */
export function deserializeFolder(rawCode: string): BookmarkFolder | null {
  const code = rawCode.trim();
  if (!code) return null;
  try {
    const version = exportVersion(code);
    const json = version >= 2 ? base64ToUtf8(code.slice(2)) : atob(code);
    const payload = JSON.parse(json) as ExportPayload;
    if (!payload || typeof payload.tit !== "string" || !Array.isArray(payload.trs)) return null;

    const folderVersion = version >= 3 ? asVersion(payload.ver) : "1";
    const trades: BookmarkTrade[] = [];
    for (const t of payload.trs) {
      if (!t || typeof t.loc !== "string") continue;
      const parts = t.loc.split(":");
      const [v, type, slug] = version >= 3 ? parts : ["1", ...parts];
      if (!type || !slug) continue;
      trades.push(newTrade(String(t.tit ?? ""), { version: asVersion(v), type, slug }));
    }
    return { ...newFolder({ title: payload.tit, icon: normalizeIcon(payload.icn), version: folderVersion }), trades };
  } catch {
    return null;
  }
}

export function generateBackup(folders: BookmarkFolder[]): string {
  const active = folders.filter((f) => !f.archivedAt).map(serializeFolder);
  const archived = folders.filter((f) => f.archivedAt).map(serializeFolder);
  return [active.join(LINE_DELIMITER), archived.join(LINE_DELIMITER)].join(BACKUP_SECTION_DELIMITER);
}

/** Отпечаток папки для поиска дублей при восстановлении: название + набор поисков. */
function fingerprint(f: Pick<BookmarkFolder, "title" | "version" | "trades">): string {
  return [f.version, f.title, ...f.trades.map((t) => `${t.location.version}:${t.location.type}:${t.location.slug}`).sort()].join("|");
}

export type RestoreResult = { folders: BookmarkFolder[]; added: number; skipped: number; invalid: number };

/**
 * Восстановить из резервной копии. Папки добавляются к существующим; точные дубли пропускаются,
 * поэтому повторное восстановление того же файла ничего не удвоит.
 * Принимает и файл резервной копии, и просто коды папок по строке.
 */
export function restoreBackup(existing: BookmarkFolder[], text: string): RestoreResult {
  const normalized = text.replace(/\r\n/g, "\n");
  const [activeSection, archivedSection = ""] = normalized.split(BACKUP_SECTION_DELIMITER);
  const known = new Set(existing.map(fingerprint));
  const result: RestoreResult = { folders: [...existing], added: 0, skipped: 0, invalid: 0 };

  const restoreSection = (section: string, archived: boolean) => {
    for (const line of section.split(LINE_DELIMITER).map((l) => l.trim()).filter(Boolean)) {
      const folder = deserializeFolder(line);
      if (!folder) {
        result.invalid++;
        continue;
      }
      const fp = fingerprint(folder);
      if (known.has(fp)) {
        result.skipped++;
        continue;
      }
      known.add(fp);
      result.folders.push(archived ? { ...folder, archivedAt: new Date().toISOString() } : folder);
      result.added++;
    }
  };
  restoreSection(activeSection, false);
  restoreSection(archivedSection, true);
  return result;
}
