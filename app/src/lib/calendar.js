export function addDays(value, days) {
  const date = value instanceof Date ? new Date(value) : new Date(`${value}T12:00:00`);
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date;
}

export function dateKey(date) {
  const value = new Date(date);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function firstOfMonth(value = new Date()) {
  const date = new Date(value);
  date.setHours(12, 0, 0, 0);
  date.setDate(1);
  return date;
}

export function moveMonth(value, amount) {
  const date = firstOfMonth(value);
  date.setMonth(date.getMonth() + amount);
  return date;
}

export function buildMonthGrid(value) {
  const month = firstOfMonth(value);
  const gridStart = addDays(dateKey(month), -month.getDay());
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
}
