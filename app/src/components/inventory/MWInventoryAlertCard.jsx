import {
  Badge,
  Box,
  Card,
  Group,
  Stack,
  Text,
  ThemeIcon,
} from "@mantine/core";
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconChevronRight,
  IconCircleCheck,
  IconInfoCircle,
} from "@tabler/icons-react";

function getAlertConfig(severity) {
  if (severity === "critical") {
    return {
      color: "red",
      icon: IconAlertCircle,
      label: "Critical",
    };
  }

  if (severity === "warning") {
    return {
      color: "orange",
      icon: IconAlertTriangle,
      label: "Warning",
    };
  }

  if (severity === "success") {
    return {
      color: "green",
      icon: IconCircleCheck,
      label: "Good",
    };
  }

  return {
    color: "blue",
    icon: IconInfoCircle,
    label: "Info",
  };
}

function MWInventoryAlertCard({
  title,
  description = "",
  count = 0,
  severity = "info",
  actionLabel = "Review",
  onClick = null,
  compact = false,
}) {
  const config = getAlertConfig(severity);
  const AlertIcon = config.icon;

  const isClickable =
    typeof onClick === "function";

  return (
    <Card
      component={isClickable ? "button" : "div"}
      type={isClickable ? "button" : undefined}
      onClick={onClick}
      withBorder
      radius="lg"
      p={compact ? "md" : "lg"}
      style={{
        position: "relative",
        width: "100%",
        minHeight: compact ? 112 : 132,
        overflow: "hidden",
        textAlign: "left",
        cursor: isClickable
          ? "pointer"
          : "default",
        borderColor:
          severity === "critical"
            ? "rgba(250,82,82,0.28)"
            : severity === "warning"
              ? "rgba(255,146,43,0.24)"
              : "rgba(255,255,255,0.08)",
        background:
          severity === "critical"
            ? "linear-gradient(145deg, rgba(250,82,82,0.10), rgba(255,255,255,0.014))"
            : severity === "warning"
              ? "linear-gradient(145deg, rgba(255,146,43,0.08), rgba(255,255,255,0.014))"
              : "linear-gradient(145deg, rgba(255,255,255,0.045), rgba(255,255,255,0.014))",
        boxShadow:
          "0 8px 24px rgba(0,0,0,0.12)",
        transition:
          "transform 140ms ease, border-color 140ms ease, background-color 140ms ease",
      }}
    >
      <Box
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          bottom: 0,
          width: 4,
          background:
            `var(--mantine-color-${config.color}-6)`,
        }}
      />

      <Stack
        gap={compact ? "sm" : "md"}
        h="100%"
        justify="space-between"
      >
        <Group
          justify="space-between"
          align="flex-start"
          gap="md"
          wrap="nowrap"
        >
          <Group
            align="flex-start"
            gap="md"
            wrap="nowrap"
            style={{
              minWidth: 0,
              flex: 1,
            }}
          >
            <ThemeIcon
              size={compact ? 38 : 42}
              radius="md"
              color={config.color}
              variant="light"
              style={{
                flexShrink: 0,
                border:
                  "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <AlertIcon
                size={compact ? 19 : 21}
                stroke={2.1}
              />
            </ThemeIcon>

            <Box
              style={{
                minWidth: 0,
                flex: 1,
              }}
            >
              <Text
                fw={850}
                size={compact ? "sm" : "md"}
                c="gray.0"
                style={{
                  lineHeight: 1.3,
                  textAlign: "left",
                  overflowWrap: "break-word",
                }}
              >
                {title}
              </Text>

              {description && (
                <Text
                  size="xs"
                  c="gray.5"
                  mt={4}
                  style={{
                    lineHeight: 1.45,
                    textAlign: "left",
                  }}
                >
                  {description}
                </Text>
              )}
            </Box>
          </Group>

          <Badge
            color={config.color}
            variant="light"
            radius="sm"
            size={compact ? "sm" : "md"}
            styles={{
              root: {
                flexShrink: 0,
                border:
                  "1px solid rgba(255,255,255,0.08)",
                fontWeight: 850,
                fontVariantNumeric:
                  "tabular-nums",
              },
            }}
          >
            {count}
          </Badge>
        </Group>

        <Group
          justify="space-between"
          align="center"
          gap="md"
          wrap="nowrap"
        >
          <Text
            size="xs"
            c={`${config.color}.3`}
            fw={800}
          >
            {config.label}
          </Text>

          {isClickable && (
            <Group
              gap={5}
              wrap="nowrap"
              style={{
                flexShrink: 0,
              }}
            >
              <Text
                size="xs"
                fw={800}
                c="gray.4"
              >
                {actionLabel}
              </Text>

              <IconChevronRight
                size={15}
                color="var(--mantine-color-gray-5)"
              />
            </Group>
          )}
        </Group>
      </Stack>
    </Card>
  );
}

export default MWInventoryAlertCard;