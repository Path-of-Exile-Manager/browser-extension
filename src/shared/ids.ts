/** Короткий уникальный id: случайная часть + время, base36. */
export function uid(): string {
  const random = crypto.getRandomValues(new Uint32Array(2));
  return random[0].toString(36) + random[1].toString(36) + Date.now().toString(36);
}
