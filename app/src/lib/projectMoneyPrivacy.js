const STORAGE_PREFIX = "mwProjectMoneyUnlocked:";
let currentActiveUser = "";

export const PROJECT_MONEY_ALLOWED_NAMES = ["Dan", "Lori", "Kory", "Chad"];

function normalizedName(value) {
  return String(value || "").trim().toLowerCase();
}

export function canUnlockProjectMoney(activeUser) {
  const name = normalizedName(activeUser);
  return PROJECT_MONEY_ALLOWED_NAMES.some((allowed) => normalizedName(allowed) === name);
}

function storageKey(activeUser) {
  return `${STORAGE_PREFIX}${normalizedName(activeUser)}`;
}

export function isProjectMoneyUnlocked(activeUser) {
  if (!canUnlockProjectMoney(activeUser) || typeof window === "undefined") return false;
  return window.sessionStorage.getItem(storageKey(activeUser)) === "true";
}

export function setProjectMoneyUnlocked(activeUser, unlocked) {
  if (typeof window === "undefined") return;
  const key = storageKey(activeUser);
  if (unlocked) window.sessionStorage.setItem(key, "true");
  else window.sessionStorage.removeItem(key);
}

export function setProjectMoneyActiveUser(activeUser) {
  currentActiveUser = activeUser || "";
}

export function formatProjectMoney(value, activeUser = currentActiveUser) {
  if (!isProjectMoneyUnlocked(activeUser)) return "$••••••";
  return Number(value || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
}
