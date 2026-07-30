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

function clampPercentage(value) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    return 0;
  }

  return Math.max(0, Math.min(parsedValue, 100));
}

function formatMetricValue({
  value,
  prefix = "",
  suffix = "",
}) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  return `${prefix}${value}${suffix}`;
}

function getTrendConfig(direction) {
  const configurations = {
    up: {
      icon: IconArrowUpRight,
      color: "green",
    },
    down: {
      icon: IconArrowDownRight,
      color: "red",
    },
    neutral: {
      icon: IconMinus,
      color: "gray",
    },
  };

  return (
    configurations[direction] ||
    configurations.neutral
  );
}

function MWMetricCard({
  label,
  value,
  prefix = "",
  suffix = "",
  description = "",
  icon: Icon = null,
  color = "red",
  trend = null,
  trendLabel = "",
  trendDirection = "neutral",
  progress = null,
  progressLabel = "",
  footer = null,
  compact = false,
  horizontal = false,
  onClick = null,
  selected = false,
  loading = false,
  minHeight = null,
  valueSize = null,
  nowrapValue = true,
}) {
  const isClickable =
    typeof onClick === "function";

  const hasProgress =
    progress !== null &&
    progress !== undefined &&
    Number.isFinite(Number(progress));

  const safeProgress = hasProgress
    ? clampPercentage(progress)
    : 0;

  const trendConfig =
    getTrendConfig(trendDirection);

  const TrendIcon = trendConfig.icon;

  const formattedValue = loading
    ? "..."
    : formatMetricValue({
        value,
        prefix,
        suffix,
      });

  const resolvedValueSize =
    valueSize ||
    (horizontal
      ? compact
        ? "22px"
        : "28px"
      : compact
        ? "24px"
        : "32px");

  const headerContent = (
    <Group
      justify="space-between"
      align={horizontal ? "center" : "flex-start"}
      wrap="nowrap"
      gap="md"
      style={{
        minWidth: 0,
        width: "100%",
      }}
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
            lineHeight: 1.35,
            letterSpacing: "0.07em",
            whiteSpace: horizontal
              ? "nowrap"
              : "normal",
            overflow: horizontal
              ? "hidden"
              : "visible",
            textOverflow: horizontal
              ? "ellipsis"
              : "clip",
          }}
        >
          {label}
        </Text>

        {!horizontal && (
          <Text
            mt={compact ? 6 : 8}
            fw={900}
            c="gray.0"
            size={resolvedValueSize}
            title={formattedValue}
            style={{
              lineHeight: 1.05,
              letterSpacing: "-0.04em",
              whiteSpace: nowrapValue
                ? "nowrap"
                : "normal",
              overflow: nowrapValue
                ? "hidden"
                : "visible",
              textOverflow: nowrapValue
                ? "ellipsis"
                : "clip",
              fontVariantNumeric:
                "tabular-nums",
            }}
          >
            {formattedValue}
          </Text>
        )}
      </Box>

      {horizontal && (
        <Text
          fw={900}
          c="gray.0"
          size={resolvedValueSize}
          title={formattedValue}
          style={{
            flexShrink: 0,
            maxWidth: "55%",
            lineHeight: 1.05,
            letterSpacing: "-0.04em",
            whiteSpace: nowrapValue
              ? "nowrap"
              : "normal",
            overflow: nowrapValue
              ? "hidden"
              : "visible",
            textOverflow: nowrapValue
              ? "ellipsis"
              : "clip",
            textAlign: "right",
            fontVariantNumeric:
              "tabular-nums",
          }}
        >
          {formattedValue}
        </Text>
      )}

      {Icon && !horizontal && (
        <ThemeIcon
          size={compact ? 40 : 46}
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
            size={compact ? 20 : 24}
            stroke={2}
          />
        </ThemeIcon>
      )}
    </Group>
  );

  return (
    <Card
      component={
        isClickable ? "button" : "div"
      }
      type={
        isClickable ? "button" : undefined
      }
      withBorder
      radius="lg"
      p={compact ? "md" : "lg"}
      onClick={
        isClickable ? onClick : undefined
      }
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight:
          minHeight ||
          (horizontal
            ? compact
              ? 92
              : 110
            : compact
              ? 150
              : 185),
        overflow: "hidden",
        cursor: isClickable
          ? "pointer"
          : "default",
        textAlign: "left",
        font: "inherit",
        color: "inherit",
        borderColor: selected
          ? `var(--mantine-color-${color}-6)`
          : "rgba(255,255,255,0.08)",
        background: selected
          ? `linear-gradient(
              145deg,
              color-mix(
                in srgb,
                var(--mantine-color-${color}-9) 20%,
                rgba(255,255,255,0.05)
              ),
              rgba(255,255,255,0.018)
            )`
          : "linear-gradient(145deg, rgba(255,255,255,0.045), rgba(255,255,255,0.016))",
        boxShadow: selected
          ? `0 0 0 1px var(--mantine-color-${color}-7), 0 14px 34px rgba(0,0,0,0.22)`
          : "0 8px 24px rgba(0,0,0,0.12)",
        transition:
          "transform 140ms ease, border-color 140ms ease, box-shadow 140ms ease, background-color 140ms ease",
      }}
    >
      <Box
        style={{
          position: "absolute",
          top: 0,
          left: horizontal ? 0 : 0,
          right: horizontal ? "auto" : 0,
          bottom: horizontal ? 0 : "auto",
          width: horizontal ? 4 : "auto",
          height: horizontal ? "auto" : 4,
          background: `var(--mantine-color-${color}-6)`,
        }}
      />

      <Stack
        gap={compact ? "sm" : "md"}
        justify="space-between"
        h="100%"
      >
        {horizontal && Icon ? (
          <Group
            align="center"
            wrap="nowrap"
            gap="md"
          >
            <ThemeIcon
              size={compact ? 40 : 46}
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
                size={compact ? 20 : 24}
                stroke={2}
              />
            </ThemeIcon>

            {headerContent}
          </Group>
        ) : (
          headerContent
        )}

        {description && (
          <Text
            size={compact ? "xs" : "sm"}
            c="gray.5"
            style={{
              lineHeight: 1.45,
              minHeight: horizontal
                ? "auto"
                : compact
                  ? 34
                  : 40,
              display: "-webkit-box",
              WebkitLineClamp: horizontal
                ? 1
                : 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {description}
          </Text>
        )}

        {hasProgress && (
          <Stack gap={7}>
            <Group
              justify="space-between"
              gap="sm"
              wrap="nowrap"
            >
              <Text
                size="xs"
                c="gray.5"
                fw={600}
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {progressLabel || "Progress"}
              </Text>

              <Text
                size="xs"
                c="gray.3"
                fw={800}
                style={{
                  flexShrink: 0,
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
              size={compact ? 8 : 10}
              radius="xl"
              styles={{
                root: {
                  backgroundColor:
                    "rgba(255,255,255,0.08)",
                },
              }}
            />
          </Stack>
        )}

        {(trend !== null || trendLabel) && (
          <Group
            gap={6}
            align="center"
            wrap="nowrap"
          >
            <ThemeIcon
              size={24}
              radius="xl"
              color={trendConfig.color}
              variant="light"
              style={{
                flexShrink: 0,
              }}
            >
              <TrendIcon
                size={14}
                stroke={2.2}
              />
            </ThemeIcon>

            {trend !== null &&
              trend !== undefined && (
                <Text
                  size="xs"
                  fw={800}
                  c={`${trendConfig.color}.4`}
                  style={{
                    flexShrink: 0,
                    fontVariantNumeric:
                      "tabular-nums",
                  }}
                >
                  {trend}
                </Text>
              )}

            {trendLabel && (
              <Text
                size="xs"
                c="gray.5"
                style={{
                  minWidth: 0,
                  lineHeight: 1.35,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {trendLabel}
              </Text>
            )}
          </Group>
        )}

        {footer && (
          <Box
            pt="sm"
            style={{
              borderTop:
                "1px solid rgba(255,255,255,0.07)",
            }}
          >
            {footer}
          </Box>
        )}
      </Stack>
    </Card>
  );
}

export default MWMetricCard;