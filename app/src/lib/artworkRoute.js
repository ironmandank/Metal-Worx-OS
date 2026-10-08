const CLOSED_STATUSES = new Set([
  "completed",
  "complete",
  "closed",
  "cancelled",
  "canceled",
]);

const FUTURE_STATUSES = new Set(["pending", "queued"]);

function normalizedStatus(value) {
  return String(value || "").trim().toLowerCase();
}

function routeOrder(left, right) {
  const stepDifference = Number(left?.step_order || 0) - Number(right?.step_order || 0);
  if (stepDifference !== 0) return stepDifference;
  return Number(left?.id || 0) - Number(right?.id || 0);
}

export function selectCurrentArtworkWorkOrder(route = []) {
  const orderedRoute = [...route].sort(routeOrder);
  const openRoute = orderedRoute.filter(
    (row) => !CLOSED_STATUSES.has(normalizedStatus(row?.status))
  );

  return openRoute.find(
    (row) => !FUTURE_STATUSES.has(normalizedStatus(row?.status))
  ) || openRoute[0] || [...orderedRoute].reverse().find(
    (row) => ["completed", "complete"].includes(normalizedStatus(row?.status))
  );
}
