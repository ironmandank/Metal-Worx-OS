import {
  Box,
  Card,
  Group,
  Progress,
  Stack,
  Text,
  ThemeIcon,
} from "@mantine/core";
import {
  IconArrowDownRight,
  IconArrowUpRight,
  IconMinus,
} from "@tabler/icons-react";

function getTrendConfig(trend) {
  if (trend === "up") {
    return {
      icon: IconArrowUpRight,
      color: "green",
    };
  }

  if (trend === "down") {
    return {
      icon: IconArrowDownRight,
      color: "red",
    };
  }

  return {
    icon: IconMinus,
    color: "gray",
  };
}

function clampPercentage(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.max(0, Math.min(numericValue, 100));
}

function MWInventoryMetricCard({
  label,
  value,
  description = "",
  icon: Icon,
  color = "red",
  trend = "neutral",
  trendLabel = "",
  progress = null,
  progressLabel = "",
  compact = false,
  onClick = null,
}) {
  const isClickable =
    typeof onClick === "function";

  const trendConfig =
    getTrendConfig(trend);

  const TrendIcon =
    trendConfig.icon;

  const safeProgress =
    progress === null ||
    progress === undefined
      ? null
      : clampPercentage(progress);

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
        minHeight: compact ? 132 : 154,
        overflow: "hidden",
        textAlign: "left",
        cursor: isClickable
          ? "pointer"
          : "default",
        borderColor:
          "rgba(255,255,255,0.08)",
        background:
          "linear-gradient(145deg, rgba(255,255,255,0.045), rgba(255,255,255,0.014))",
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
          right: 0,
          height: 4,
          background:
            `var(--mantine-color-${color}-6)`,
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
          <Box
            style={{
              minWidth: 0,
              flex: 1,
            }}
          >
            <Text
              size="xs"
              c="gray.5"
              fw={800}
              tt="uppercase"
              style={{
                lineHeight: 1.25,
                letterSpacing: "0.065em",
                textAlign: "left",
              }}
            >
              {label}
            </Text>

            <Text
              mt={6}
              fw={900}
              size={compact ? "24px" : "30px"}
              c="gray.0"
              style={{
                lineHeight: 1,
                letterSpacing: "-0.04em",
                textAlign: "left",
                whiteSpace: "nowrap",
                fontVariantNumeric:
                  "tabular-nums",
              }}
            >
              {value}
            </Text>
          </Box>

          {Icon && (
            <ThemeIcon
              size={compact ? 38 : 44}
              radius="md"
              color={color}
              variant="light"
              style={{
                flexShrink: 0,
                border:
                  "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <Icon
                size={compact ? 19 : 22}
                stroke={2}
              />
            </ThemeIcon>
          )}
        </Group>

        <Box>
          {description && (
            <Text
              size="xs"
              c="gray.5"
              style={{
                lineHeight: 1.4,
                textAlign: "left",
              }}
            >
              {description}
            </Text>
          )}

          {trendLabel && (
            <Group
              gap={6}
              mt={description ? 8 : 0}
              wrap="nowrap"
            >
              <ThemeIcon
                size={24}
                radius="xl"
                color={trendConfig.color}
                variant="light"
              >
                <TrendIcon size={13} />
              </ThemeIcon>

              <Text
                size="xs"
                fw={750}
                c={`${trendConfig.color}.3`}
                style={{
                  lineHeight: 1.2,
                  textAlign: "left",
                }}
              >
                {trendLabel}
              </Text>
            </Group>
          )}

          {safeProgress !== null && (
            <Box mt="sm">
              <Group
                justify="space-between"
                align="center"
                mb={6}
              >
                <Text
                  size="xs"
                  c="gray.5"
                  fw={700}
                >
                  {progressLabel || "Progress"}
                </Text>

                <Text
                  size="xs"
                  c="gray.3"
                  fw={850}
                  style={{
                    fontVariantNumeric:
                      "tabular-nums",
                  }}
                >
                  {safeProgress}%
                </Text>
              </Group>

              <Progress
                value={safeProgress}
                color={color}
                size={8}
                radius="xl"
                styles={{
                  root: {
                    backgroundColor:
                      "rgba(255,255,255,0.08)",
                  },
                }}
              />
            </Box>
          )}
        </Box>
      </Stack>
    </Card>
  );
}

export default MWInventoryMetricCard;