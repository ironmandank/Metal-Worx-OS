export const INVENTORY_POSITION_TYPES = [
  {
    "value": "unclassified",
    "label": "Unclassified"
  },
  {
    "value": "small_crate",
    "label": "Small Crate"
  },
  {
    "value": "large_crate",
    "label": "Large Crate"
  },
  {
    "value": "shelf",
    "label": "Shelf"
  },
  {
    "value": "rack",
    "label": "Rack"
  },
  {
    "value": "floor",
    "label": "Floor Position"
  },
  {
    "value": "other",
    "label": "Other / Not a Crate"
  }
];

const POSITION_TYPE_LABELS = Object.fromEntries(
  INVENTORY_POSITION_TYPES.map(({ value, label }) => [value, label])
);

export function getInventoryPositionTypeLabel(value) {
  return POSITION_TYPE_LABELS[value] || "Unclassified";
}

export function formatInventoryBinOption(bin) {
  return [
    bin.code,
    bin.name,
    bin.zone,
    getInventoryPositionTypeLabel(bin.position_type),
  ].filter(Boolean).join(" · ");
}
