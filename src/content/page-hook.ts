// Выполняется в мире страницы (manifest: "world": "MAIN", document_start).
// Content script живёт в изолированном мире и не видит вызовы history.pushState сайта,
// поэтому здесь мы оборачиваем pushState/replaceState и сообщаем о переходе событием на window.
// Никаких данных страницы не читаем и не передаём.
(() => {
  const EVENT = "poe-manager:navigate";
  const w = window as Window & { __poeManagerHooked?: boolean };
  if (w.__poeManagerHooked) return;
  w.__poeManagerHooked = true;

  for (const method of ["pushState", "replaceState"] as const) {
    const original = history[method];
    history[method] = function (this: History, ...args: Parameters<History["pushState"]>) {
      const result = original.apply(this, args);
      window.dispatchEvent(new Event(EVENT));
      return result;
    };
  }
})();

export {};
