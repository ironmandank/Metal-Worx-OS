import {
  Badge,
  Box,
  Card,
  Divider,
  Group,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import {
  IconAlertTriangleFilled,
  IconArrowUpRight,
  IconCheck,
  IconCircleCheckFilled,
  IconClock,
  IconMinus,
} from "@tabler/icons-react";

function clampPercentage(value) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    return 0;
  }

  return Math.max(0, Math.min(parsedValue, 100));
}

function getProgressState(value) {
  if (value >= 100) {
    return {
      label: "Complete",
      color: "green",
      icon: IconCircleCheckFilled,
    };
  }

  if (value >= 75) {
    return {
      label: "Near Complete",
      color: "blue",
      icon: IconArrowUpRight,
    };
  }

  if (value >= 40) {
    return {
      label: "In Progress",
      color: "yellow",
      icon: IconClock,
    };
  }

  if (value > 0) {
    return {
      label: "Started",
      color: "orange",
      icon: IconClock,
    };
  }

  return {
    label: "Not Started",
    color: "gray",
    icon: IconMinus,
  };
}

function ProgressStat({
  label,
  value,
  suffix = "",
  color = "gray",
}) {
  return (
    <Box
      p="md"
      style={{
        minWidth: 0,
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.07)",
        backgroundColor: "rgba(255,255,255,0.025)",
        textAlign: "left",
      }}
    >
      <Text
        size="xs"
        c="gray.5"
        fw={700}
        style={{
          lineHeight: 1.3,
          textAlign: "left",
        }}
      >
        {label}
      </Text>

      <Text
        mt={5}
        fw={850}
        size="lg"
        c={`${color}.3`}
        style={{
          lineHeight: 1.1,
          letterSpacing: "-0.025em",
          textAlign: "left",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value === null ||
        value === undefined ||
        value === ""
          ? "—"
          : `${value}${suffix}`}
      </Text>
    </Box>
  );
}

function MilestoneRow({
  milestone,
}) {
  const isComplete =
    milestone.complete === true;

  const isWarning =
    milestone.warning === true;

  const MilestoneIcon = isComplete
    ? IconCheck
    : isWarning
      ? IconAlertTriangleFilled
      : IconClock;

  const milestoneColor = isComplete
    ? "green"
    : isWarning
      ? "orange"
      : "gray";

  return (
    <Group
      gap="md"
      align="flex-start"
      wrap="nowrap"
      p="md"
      style={{
        minWidth: 0,
        width: "100%",
        minHeight: 78,
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.07)",
        backgroundColor: "rgba(255,255,255,0.022)",
      }}
    >
      <Box
        style={{
          width: 34,
          flexShrink: 0,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <ThemeIcon
          size={30}
          radius="xl"
          color={milestoneColor}
          variant="light"
        >
          <MilestoneIcon
            size={16}
            stroke={2.2}
          />
        </ThemeIcon>
      </Box>

      <Box
        style={{
          minWidth: 0,
          flex: 1,
          textAlign: "left",
        }}
      >
        <Text
          size="sm"
          fw={800}
          c="gray.1"
          style={{
            lineHeight: 1.35,
            textAlign: "left",
            overflowWrap: "break-word",
          }}
        >
          {milestone.label}
        </Text>

        {milestone.description && (
          <Text
            size="xs"
            c="gray.5"
            mt={4}
            style={{
              lineHeight: 1.4,
              textAlign: "left",
              overflowWrap: "break-word",
            }}
          >
            {milestone.description}
          </Text>
        )}
      </Box>
    </Group>
  );
}

function MWProgressCard({
  title = "Progress",
  subtitle = "",
  value = 0,
  color = "red",
  icon: Icon = null,
  status = "",
  statusColor = "",
  description = "",
  completed = null,
  total = null,
  remaining = null,
  stats = [],
  milestones = [],
  footer = null,
  compact = false,
  showPercentage = true,
  showStatus = true,
  highlight = false,
}) {
  const safeValue =
    clampPercentage(value);

  const progressState =
    getProgressState(safeValue);

  const ProgressStateIcon =
    progressState.icon;

  const resolvedStatus =
    status || progressState.label;

  const resolvedStatusColor =
    statusColor ||
    progressState.color;

  const computedRemaining =
    remaining !== null &&
    remaining !== undefined
      ? remaining
      : completed !== null &&
          completed !== undefined &&
          total !== null &&
          total !== undefined
        ? Math.max(
            Number(total) -
              Number(completed),
            0
          )
        : null;

  const defaultStats = [];

  if (
    completed !== null &&
    completed !== undefined
  ) {
    defaultStats.push({
      label: "Completed",
      value: completed,
      color: "green",
    });
  }

  if (computedRemaining !== null) {
    defaultStats.push({
      label: "Remaining",
      value: computedRemaining,
      color: "orange",
    });
  }

  if (
    total !== null &&
    total !== undefined
  ) {
    defaultStats.push({
      label: "Total",
      value: total,
      color: "blue",
    });
  }

  const displayStats =
    Array.isArray(stats) &&
    stats.length > 0
      ? stats
      : defaultStats;

  const safeMilestones =
    Array.isArray(milestones)
      ? milestones.filter(Boolean)
      : [];

  return (
    <Card
      withBorder
      radius="lg"
      p={0}
      style={{
        position: "relative",
        height: "100%",
        overflow: "hidden",
        borderColor: highlight
          ? `var(--mantine-color-${color}-7)`
          : "rgba(255,255,255,0.08)",
        background: highlight
          ? `linear-gradient(
              145deg,
              color-mix(
                in srgb,
                var(--mantine-color-${color}-9) 17%,
                rgba(255,255,255,0.045)
              ),
              rgba(255,255,255,0.015)
            )`
          : "linear-gradient(145deg, rgba(255,255,255,0.045), rgba(255,255,255,0.016))",
        boxShadow: highlight
          ? "0 12px 30px rgba(0,0,0,0.2)"
          : "0 8px 24px rgba(0,0,0,0.12)",
      }}
    >
      <Box
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          background: `var(--mantine-color-${color}-6)`,
        }}
      />

      <Stack gap={0} h="100%">
        <Box
          px={compact ? "md" : "lg"}
          py={compact ? "md" : "lg"}
        >
          <Group
            justify="space-between"
            align="flex-start"
            gap="lg"
            wrap="wrap"
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
                    size={compact ? 20 : 23}
                    stroke={2}
                  />
                </ThemeIcon>
              )}

              <Box
                style={{
                  minWidth: 0,
                  flex: 1,
                  textAlign: "left",
                }}
              >
                <Title
                  order={compact ? 5 : 4}
                  c="gray.0"
                  style={{
                    lineHeight: 1.25,
                    letterSpacing: "-0.018em",
                    textAlign: "left",
                    overflowWrap: "break-word",
                  }}
                >
                  {title}
                </Title>

                {subtitle && (
                  <Text
                    size="xs"
                    c="gray.5"
                    mt={4}
                    style={{
                      lineHeight: 1.45,
                      textAlign: "left",
                    }}
                  >
                    {subtitle}
                  </Text>
                )}
              </Box>
            </Group>

            {showStatus && (
              <Badge
                color={resolvedStatusColor}
                variant="light"
                radius="sm"
                size="md"
                leftSection={
                  <ProgressStateIcon
                    size={12}
                  />
                }
                styles={{
                  root: {
                    flexShrink: 0,
                    border:
                      "1px solid rgba(255,255,255,0.08)",
                    fontWeight: 800,
                  },
                }}
              >
                {resolvedStatus}
              </Badge>
            )}
          </Group>
        </Box>

        <Divider color="rgba(255,255,255,0.07)" />

        <Box
          px={compact ? "md" : "lg"}
          py={compact ? "md" : "lg"}
          style={{
            flex: 1,
          }}
        >
          <Stack gap={compact ? "md" : "lg"}>
            <Group
              justify="space-between"
              align="flex-end"
              gap="lg"
              wrap="wrap"
            >
              <Box
                style={{
                  minWidth: 0,
                  flex: 1,
                  textAlign: "left",
                }}
              >
                <Text
                  size="xs"
                  c="gray.5"
                  fw={700}
                  tt="uppercase"
                  style={{
                    letterSpacing:
                      "0.07em",
                    textAlign: "left",
                  }}
                >
                  Completion
                </Text>

                {description && (
                  <Text
                    size="sm"
                    c="gray.4"
                    mt={5}
                    style={{
                      lineHeight: 1.45,
                      maxWidth: 720,
                      textAlign: "left",
                    }}
                  >
                    {description}
                  </Text>
                )}
              </Box>

              {showPercentage && (
                <Text
                  fw={900}
                  c="gray.0"
                  size={
                    compact
                      ? "26px"
                      : "34px"
                  }
                  style={{
                    lineHeight: 1,
                    letterSpacing:
                      "-0.045em",
                    flexShrink: 0,
                    textAlign: "right",
                    fontVariantNumeric:
                      "tabular-nums",
                  }}
                >
                  {safeValue}%
                </Text>
              )}
            </Group>

            <Progress
              value={safeValue}
              color={color}
              size={compact ? 13 : 17}
              radius="xl"
              styles={{
                root: {
                  backgroundColor:
                    "rgba(255,255,255,0.08)",
                  boxShadow:
                    "inset 0 1px 3px rgba(0,0,0,0.28)",
                },
                section: {
                  boxShadow:
                    "0 0 12px rgba(255,255,255,0.06)",
                },
              }}
            />

            {displayStats.length > 0 && (
              <SimpleGrid
                cols={{
                  base: 1,
                  xs: Math.min(
                    displayStats.length,
                    3
                  ),
                }}
                spacing="sm"
              >
                {displayStats.map(
                  (stat, index) => (
                    <ProgressStat
                      key={`${stat.label || "stat"}-${index}`}
                      label={stat.label}
                      value={stat.value}
                      suffix={stat.suffix}
                      color={
                        stat.color ||
                        color
                      }
                    />
                  )
                )}
              </SimpleGrid>
            )}

            {safeMilestones.length > 0 && (
              <Stack gap="sm">
                <Text
                  size="xs"
                  c="gray.5"
                  fw={800}
                  tt="uppercase"
                  style={{
                    letterSpacing:
                      "0.07em",
                    textAlign: "left",
                  }}
                >
                  Milestones
                </Text>

                <SimpleGrid
                  cols={{
                    base: 1,
                    md: 2,
                  }}
                  spacing="sm"
                >
                  {safeMilestones.map(
                    (
                      milestone,
                      index
                    ) => (
                      <MilestoneRow
                        key={`milestone-${index}`}
                        milestone={
                          milestone
                        }
                      />
                    )
                  )}
                </SimpleGrid>
              </Stack>
            )}
          </Stack>
        </Box>

        {footer && (
          <>
            <Divider color="rgba(255,255,255,0.07)" />

            <Box
              px={compact ? "md" : "lg"}
              py={compact ? "sm" : "md"}
              style={{
                backgroundColor:
                  "rgba(0,0,0,0.12)",
              }}
            >
              {footer}
            </Box>
          </>
        )}
      </Stack>
    </Card>
  );
}

export default MWProgressCard;