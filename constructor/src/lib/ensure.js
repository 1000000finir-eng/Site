// У Svelte 5 вираз `(obj.arr ||= []).push(x)` повертає «сирий» масив, а не проксі стану —
// зміна не потрапляє в реактивність. Створюємо окремо й читаємо назад через проксі.
export function arr(obj, key) {
  if (!Array.isArray(obj[key])) obj[key] = [];
  return obj[key];
}
export function rec(obj, key) {
  if (!obj[key] || typeof obj[key] !== "object") obj[key] = {};
  return obj[key];
}
