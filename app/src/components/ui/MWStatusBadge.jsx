import { Badge, Box } from "@mantine/core";
import {
  IconAlertCircleFilled,
  IconArrowRight,
  IconCircleCheckFilled,
  IconClockFilled,
  IconFileDollar,
  IconPackage,
  IconPlayerPauseFilled,
  IconRosetteDiscountCheckFilled,
  IconTruckDelivery,
  IconX,
} from "@tabler/icons-react";

const STATUS_CONFIG = {
  new: {
    label: "New",
    color: "gray",
    icon: IconClockFilled,
  },

  open: {
    label: "Open",
    color: "blue",
    icon: IconClockFilled,
  },

  active: {
    label: "Active",
    color: "blue",
    icon: IconCircleCheckFilled,
  },

  started: {
    label: "Started",
    color: "blue",
    icon: IconArrowRight,
  },

  scheduled: {
    label: "Scheduled",
    color: "blue",
    icon: IconClockFilled,
  },

  pending: {
    label: "Pending",
    color: "yellow",
    icon: IconClockFilled,
  },

  waiting: {
    label: "Waiting",
    color: "yellow",
    icon: IconClockFilled,
  },

  "on hold": {
    label: "On Hold",
    color: "orange",
    icon: IconPlayerPauseFilled,
  },

  blocked: {
    label: "Blocked",
    color: "red",
    icon: IconAlertCircleFilled,
  },

  overdue: {
    label: "Overdue",
    color: "red",
    icon: IconAlertCircleFilled,
  },

  urgent: {
    label: "Urgent",
    color: "red",
    icon: IconAlertCircleFilled,
  },

  critical: {
    label: "Critical",
    color: "red",
    icon: IconAlertCircleFilled,
  },

  complete: {
    label: "Complete",
    color: "green",
    icon: IconCircleCheckFilled,
  },

  completed: {
    label: "Completed",
    color: "green",
    icon: IconCircleCheckFilled,
  },

  approved: {
    label: "Approved",
    color: "green",
    icon: IconRosetteDiscountCheckFilled,
  },

  accepted: {
    label: "Accepted",
    color: "green",
    icon: IconCircleCheckFilled,
  },

  converted: {
    label: "Converted",
    color: "green",
    icon: IconCircleCheckFilled,
  },

  paid: {
    label: "Paid",
    color: "green",
    icon: IconCircleCheckFilled,
  },

  received: {
    label: "Received",
    color: "green",
    icon: IconPackage,
  },

  ordered: {
    label: "Ordered",
    color: "blue",
    icon: IconTruckDelivery,
  },

  delivered: {
    label: "Delivered",
    color: "green",
    icon: IconTruckDelivery,
  },

  rejected: {
    label: "Rejected",
    color: "red",
    icon: IconX,
  },

  cancelled: {
    label: "Cancelled",
    color: "gray",
    icon: IconX,
  },

  canceled: {
    label: "Canceled",
    color: "gray",
    icon: IconX,
  },

  draft: {
    label: "Draft",
    color: "gray",
    icon: IconFileDollar,
  },

  quoted: {
    label: "Quoted",
    color: "blue",
    icon: IconFileDollar,
  },

  invoiced: {
    label: "Invoiced",
    color: "violet",
    icon: IconFileDollar,
  },

  "not started": {
    label: "Not Started",
    color: "gray",
    icon: IconClockFilled,
  },

  "in progress": {
    label: "In Progress",
    color: "blue",
    icon: IconArrowRight,
  },

  "in production": {
    label: "In Production",
    color: "violet",
    icon: IconPackage,
  },

  "design needed": {
    label: "Design Needed",
    color: "orange",
    icon: IconAlertCircleFilled,
  },

  "design fee pending": {
    label: "Design Fee Pending",
    color: "yellow",
    icon: IconFileDollar,
  },

  "design fee paid": {
    label: "Design Fee Paid",
    color: "green",
    icon: IconCircleCheckFilled,
  },

  "design in progress": {
    label: "Design In Progress",
    color: "blue",
    icon: IconArrowRight,
  },

  "design complete": {
    label: "Design Complete",
    color: "green",
    icon: IconCircleCheckFilled,
  },

  "quote needed": {
    label: "Quote Needed",
    color: "orange",
    icon: IconAlertCircleFilled,
  },

  "materials quoted": {
    label: "Materials Quoted",
    color: "blue",
    icon: IconFileDollar,
  },

  "quote sent": {
    label: "Quote Sent",
    color: "blue",
    icon: IconFileDollar,
  },

  "customer accepts quote": {
    label: "Quote Accepted",
    color: "green",
    icon: IconRosetteDiscountCheckFilled,
  },

  "down payment received": {
    label: "Down Payment Received",
    color: "green",
    icon: IconCircleCheckFilled,
  },

  "materials ordered": {
    label: "Materials Ordered",
    color: "blue",
    icon: IconTruckDelivery,
  },

  "materials received": {
    label: "Materials Received",
    color: "green",
    icon: IconPackage,
  },

  "install scheduled": {
    label: "Install Scheduled",
    color: "blue",
    icon: IconClockFilled,
  },

  "install complete": {
    label: "Install Complete",
    color: "green",
    icon: IconCircleCheckFilled,
  },

  "item complete": {
    label: "Item Complete",
    color: "green",
    icon: IconCircleCheckFilled,
  },

  "payment due": {
    label: "Payment Due",
    color: "orange",
    icon: IconFileDollar,
  },

  "payment received": {
    label: "Payment Received",
    color: "green",
    icon: IconCircleCheckFilled,
  },

  excellent: {
    label: "Excellent",
    color: "green",
    icon: IconCircleCheckFilled,
  },

  good: {
    label: "Good",
    color: "blue",
    icon: IconCircleCheckFilled,
  },

  watch: {
    label: "Watch",
    color: "yellow",
    icon: IconAlertCircleFilled,
  },

  "at risk": {
    label: "At Risk",
    color: "orange",
    icon: IconAlertCircleFilled,
  },

  normal: {
    label: "Normal",
    color: "green",
    icon: IconCircleCheckFilled,
  },

  high: {
    label: "High",
    color: "orange",
    icon: IconAlertCircleFilled,
  },

  low: {
    label: "Low",
    color: "gray",
    icon: IconClockFilled,
  },

  "low stock": {
    label: "Low Stock",
    color: "orange",
    icon: IconAlertCircleFilled,
  },

  "out of stock": {
    label: "Out of Stock",
    color: "red",
    icon: IconAlertCircleFilled,
  },

  available: {
    label: "Available",
    color: "green",
    icon: IconCircleCheckFilled,
  },

  reserved: {
    label: "Reserved",
    color: "violet",
    icon: IconPackage,
  },
};

function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\s+/g, " ");
}

function formatFallbackLabel(value) {
  const normalizedValue = String(value || "").trim();

  if (!normalizedValue) {
    return "Unknown";
  }

  return normalizedValue
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getStatusConfig(status) {
  const normalizedStatus = normalizeStatus(status);

  if (STATUS_CONFIG[normalizedStatus]) {
    return STATUS_CONFIG[normalizedStatus];
  }

  if (normalizedStatus.includes("overdue")) {
    return STATUS_CONFIG.overdue;
  }

  if (
    normalizedStatus.includes("complete") ||
    normalizedStatus.includes("approved") ||
    normalizedStatus.includes("received")
  ) {
    return {
      label: formatFallbackLabel(status),
      color: "green",
      icon: IconCircleCheckFilled,
    };
  }

  if (
    normalizedStatus.includes("progress") ||
    normalizedStatus.includes("scheduled") ||
    normalizedStatus.includes("ordered") ||
    normalizedStatus.includes("sent")
  ) {
    return {
      label: formatFallbackLabel(status),
      color: "blue",
      icon: IconArrowRight,
    };
  }

  if (
    normalizedStatus.includes("needed") ||
    normalizedStatus.includes("pending") ||
    normalizedStatus.includes("waiting")
  ) {
    return {
      label: formatFallbackLabel(status),
      color: "yellow",
      icon: IconClockFilled,
    };
  }

  if (
    normalizedStatus.includes("blocked") ||
    normalizedStatus.includes("rejected") ||
    normalizedStatus.includes("cancel")
  ) {
    return {
      label: formatFallbackLabel(status),
      color: "red",
      icon: IconAlertCircleFilled,
    };
  }

  return {
    label: formatFallbackLabel(status),
    color: "gray",
    icon: IconClockFilled,
  };
}

function MWStatusBadge({
  status,
  label,
  color,
  variant = "light",
  size = "md",
  radius = "sm",
  showIcon = true,
  icon = null,
  fullWidth = false,
  uppercase = true,
  style = {},
  styles = {},
  ...badgeProps
}) {
  const config = getStatusConfig(status);
  const BadgeIcon = icon || config.icon;

  return (
    <Badge
      color={color || config.color}
      variant={variant}
      size={size}
      radius={radius}
      leftSection={
        showIcon && BadgeIcon ? (
          <BadgeIcon
            size={size === "lg" ? 14 : 12}
            stroke={2}
          />
        ) : null
      }
      style={{
        width: fullWidth ? "100%" : "fit-content",
        maxWidth: "100%",
        fontWeight: 800,
        letterSpacing: uppercase ? "0.025em" : 0,
        textTransform: uppercase ? "uppercase" : "none",
        border:
          variant === "light"
            ? "1px solid rgba(255,255,255,0.09)"
            : undefined,
        ...style,
      }}
      styles={{
        root: {
          overflow: "hidden",
          ...styles.root,
        },
        label: {
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          ...styles.label,
        },
        section: {
          flexShrink: 0,
          ...styles.section,
        },
      }}
      {...badgeProps}
    >
      <Box
        component="span"
        style={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label || config.label}
      </Box>
    </Badge>
  );
}

export default MWStatusBadge;