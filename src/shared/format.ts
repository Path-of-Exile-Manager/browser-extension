/** «только что», «5 мин назад», «3 ч назад», «вчера», «12 окт». */
export function formatRelative(iso: string, now = Date.now()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Math.max(0, now - t);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "только что";
  if (min < 60) return `${min} мин назад`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} ч назад`;
  const d = Math.floor(h / 24);
  if (d === 1) return "вчера";
  if (d < 7) return `${d} дн назад`;
  return new Date(t).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

/** Склонение: plural(3, "закладка", "закладки", "закладок"). */
export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

/** Число без лишних нулей с точкой: 1374, 0.6, 2.5. */
export function formatNumber(n: number): string {
  return n.toLocaleString("ru-RU", { maximumFractionDigits: n < 10 ? 2 : n < 100 ? 1 : 0 }).replace(",", ".").replace(/\u00a0/g, " ");
}
