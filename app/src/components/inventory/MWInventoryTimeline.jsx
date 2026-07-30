import {
  Box,
  Divider,
  Group,
  ScrollArea,
  Stack,
  Text,
  ThemeIcon,
} from "@mantine/core";
import {
  IconActivity,
  IconAdjustments,
  IconArrowRight,
  IconBox,
  IconCheck,
  IconClock,
  IconPackage,
  IconRefresh,
  IconShoppingCart,
  IconTruckDelivery,
} from "@tabler/icons-react";

import MWPanel from "../ui/MWPanel";
import MWStatusBadge from "../ui/MWStatusBadge";

function formatDateTime(value) {
  if (!value) {
    return "Unknown time";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString();
}

function getActivityConfig(type) {
  if (type === "received") {
    return {
      color: "green",
      icon: IconTruckDelivery,
      label: "Received",
    };
  }

  if (type === "reserved") {
    return {
      color: "violet",
      icon: IconPackage,
      label: "Reserved",
    };
  }

  if (type === "issued") {
    return {
      color: "red",
      icon: IconArrowRight,
      label: "Issued",
    };
  }

  if (type === "transferred") {
    return {
      color: "blue",
      icon: IconRefresh,
      label: "Moved",
    };
  }

  if (type === "adjusted") {
    return {
      color: "orange",
      icon: IconAdjustments,
      label: "Adjusted",
    };
  }

  if (type === "ordered") {
    return {
      color: "blue",
      icon: IconShoppingCart,
      label: "Ordered",
    };
  }

  if (type === "completed") {
    return {
      color: "green",
      icon: IconCheck,
      label: "Complete",
    };
  }

  return {
    color: "gray",
    icon: IconActivity,
    label: "Activity",
  };
}

function TimelineItem({
  activity,
  showDivider = false,
}) {
  const config = getActivityConfig(
    activity.type
  );

  const ActivityIcon = config.icon;

  return (
    <Box>
      <Group
        align="flex-start"
        gap="md"
        wrap="nowrap"
        py="md"
      >
        <Box
          style={{
            position: "relative",
            width: 38,
            flexShrink: 0,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <ThemeIcon
            size={36}
            radius="xl"
            color={
              activity.color ||
              config.color
            }
            variant="light"
            style={{
              zIndex: 1,
              border:
                "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <ActivityIcon
              size={18}
              stroke={2.1}
            />
          </ThemeIcon>

          {showDivider && (
            <Box
              style={{
                position: "absolute",
                top: 36,
                bottom: -20,
                width: 1,
                background:
                  "rgba(255,255,255,0.08)",
              }}
            />
          )}
        </Box>

        <Box
          style={{
            minWidth: 0,
            flex: 1,
          }}
        >
          <Group
            justify="space-between"
            align="flex-start"
            gap="md"
            wrap="wrap"
          >
            <Box
              style={{
                minWidth: 0,
                flex: 1,
              }}
            >
              <Text
                fw={850}
                size="sm"
                c="gray.1"
                style={{
                  lineHeight: 1.35,
                  textAlign: "left",
                  overflowWrap: "break-word",
                }}
              >
                {activity.title ||
                  "Inventory activity"}
              </Text>

              {activity.description && (
                <Text
                  size="xs"
                  c="gray.5"
                  mt={4}
                  style={{
                    lineHeight: 1.45,
                    textAlign: "left",
                    overflowWrap: "break-word",
                  }}
                >
                  {activity.description}
                </Text>
              )}
            </Box>

            <MWStatusBadge
              status={config.label}
              label={
                activity.status ||
                config.label
              }
              color={
                activity.color ||
                config.color
              }
              variant="light"
              size="sm"
            />
          </Group>

          <Group
            gap="md"
            mt="sm"
            wrap="wrap"
          >
            <Group
              gap={6}
              wrap="nowrap"
            >
              <IconClock
                size={14}
                color="var(--mantine-color-gray-6)"
              />

              <Text
                size="xs"
                c="gray.6"
              >
                {formatDateTime(
                  activity.date ||
                    activity.created_at ||
                    activity.occurred_at
                )}
              </Text>
            </Group>

            {activity.itemName && (
              <Group
                gap={6}
                wrap="nowrap"
              >
                <IconBox
                  size={14}
                  color="var(--mantine-color-gray-6)"
                />

                <Text
                  size="xs"
                  c="gray.5"
                >
                  {activity.itemName}
                </Text>
              </Group>
            )}

            {activity.quantity !==
              null &&
              activity.quantity !==
                undefined && (
                <Text
                  size="xs"
                  fw={800}
                  c="gray.4"
                  style={{
                    fontVariantNumeric:
                      "tabular-nums",
                  }}
                >
                  Qty {activity.quantity}
                </Text>
              )}

            {activity.performedBy && (
              <Text
                size="xs"
                c="gray.6"
              >
                By {activity.performedBy}
              </Text>
            )}
          </Group>
        </Box>
      </Group>

      {showDivider && (
        <Divider
          ml={52}
          color="rgba(255,255,255,0.05)"
        />
      )}
    </Box>
  );
}

function MWInventoryTimeline({
  title = "Recent Inventory Activity",
  subtitle = "Latest receiving, reservation, transfer, issue, and adjustment activity.",
  icon = IconActivity,
  color = "blue",
  activities = [],
  maxHeight = 430,
  emptyTitle = "No inventory activity",
  emptyDescription = "Activity will appear here after quantities are received, moved, reserved, issued, or adjusted.",
  actionLabel = "",
  onAction = null,
  compact = false,
}) {
  const safeActivities =
    Array.isArray(activities)
      ? activities.filter(Boolean)
      : [];

  return (
    <MWPanel
      title={title}
      subtitle={subtitle}
      icon={icon}
      color={color}
      actionLabel={actionLabel}
      onAction={onAction}
      compact={compact}
      fullHeight
    >
      {safeActivities.length === 0 ? (
        <Stack
          align="center"
          justify="center"
          mih={240}
          gap="sm"
        >
          <ThemeIcon
            size={52}
            radius="xl"
            color="gray"
            variant="light"
            style={{
              border:
                "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <IconActivity size={25} />
          </ThemeIcon>

          <Text
            fw={850}
            c="gray.3"
            ta="center"
          >
            {emptyTitle}
          </Text>

          <Text
            size="sm"
            c="gray.5"
            ta="center"
            maw={420}
            style={{
              lineHeight: 1.45,
            }}
          >
            {emptyDescription}
          </Text>
        </Stack>
      ) : (
        <ScrollArea.Autosize
          mah={maxHeight}
          type="auto"
          offsetScrollbars
        >
          <Stack gap={0}>
            {safeActivities.map(
              (activity, index) => (
                <TimelineItem
                  key={
                    activity.id ||
                    `${activity.type || "activity"}-${index}`
                  }
                  activity={activity}
                  showDivider={
                    index <
                    safeActivities.length -
                      1
                  }
                />
              )
            )}
          </Stack>
        </ScrollArea.Autosize>
      )}
    </MWPanel>
  );
}

export default MWInventoryTimeline;