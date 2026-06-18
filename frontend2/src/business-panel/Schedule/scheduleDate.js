export function isYmd(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export function todayYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function toYmd(input) {
  // ЖЕСТКО: бизнес-дата это строка YYYY-MM-DD
  if (isYmd(input)) return input;
  if (input instanceof Date) {
    const y = input.getFullYear();
    const m = String(input.getMonth() + 1).padStart(2, "0");
    const d = String(input.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  // если прилетело 'YYYY-MM-DDTHH:mm...' откуда-то
  if (typeof input === "string" && input.length >= 10) return input.slice(0, 10);
  return todayYmd();
}

// Алиас, чтобы старый код не падал
export const toISODate = toYmd;

export function addDaysYmd(ymd, days) {
  // Внутри можно жить с Date, но вход/выход только строка.
  const [y, m, d] = String(ymd).slice(0, 10).split("-").map(Number);
  const dt = new Date(y, (m - 1), d);
  dt.setDate(dt.getDate() + Number(days || 0));
  return toYmd(dt);
}

export function startOfWeekMonday(ymd) {
  const [y, m, d] = String(ymd).slice(0, 10).split("-").map(Number);
  const dt = new Date(y, (m - 1), d);
  const day = dt.getDay(); // 0..6, 0=Sun
  const diff = (day === 0 ? -6 : 1 - day); // к понедельнику
  dt.setDate(dt.getDate() + diff);
  return toYmd(dt);
}

export function weekDatesFromAnchor(anchorYmd) {
  const start = startOfWeekMonday(anchorYmd);
  return Array.from({ length: 7 }, (_, i) => addDaysYmd(start, i));
}

export const ruWeekdayShortMon = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
export const ruWeekdayLong = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];