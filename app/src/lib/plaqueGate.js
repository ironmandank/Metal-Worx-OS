export function confirmPlaqueUncheck(currentValue, nextValue) {
  if (!currentValue || nextValue) return true;
  return window.prompt("Enter authorization code to remove the plaque requirement:") === "1122";
}
