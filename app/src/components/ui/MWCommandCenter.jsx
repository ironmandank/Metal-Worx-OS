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
  IconActivityHeartbeat,
  IconArrowRight,
  IconCalendarDue,
  IconCircleCheckFilled,
  IconFlag,
  IconProgressCheck,
  IconUser,
} from "@tabler/icons-react";

function clampPercentage(value) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    return 0;
  }

  return Math.max(0, Math.min(parsedValue, 100));
}

function CommandCenterLabel({ children }) {
  return (
    <Text
      size="xs"
      c="gray.5"
      fw={800}
      tt="uppercase"
      style={{
        letterSpacing: "0.09em",
      }}
    >
      {children}
    </Text>
  );
}

function DetailItem({ icon, label, value }) {
  return (
    <Group gap="sm" align="flex-start" wrap="nowrap">
      <ThemeIcon
        size={34}
        radius="md"
        variant="light"
        color="gray"
        style={{
          flexShrink: 0,
          backgroundColor: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {icon}
      </ThemeIcon>

      <Box style={{ minWidth: 0 }}>
        <Text size="xs" c="gray.5" fw={600}>
          {label}
        </Text>

        <Text
          size="sm"
          c="gray.1"
          fw={700}
          mt={2}
          style={{
            lineHeight: 1.35,
            overflowWrap: "anywhere",
          }}
        >
          {value || "Not set"}
        </Text>
      </Box>
    </Group>
  );
}

function ProgressPanel({
  icon,
  label,
  value,
  color,
  description,
  badge,
}) {
  return (
    <Box
      p="lg"
      style={{
        height: "100%",
        borderRadius: "14px",
        border: "1px solid rgba(255,255,255,0.08)",
        background:
          "linear-gradient(145deg, rgba(255,255,255,0.055), rgba(255,255,255,0.018))",
      }}
    >
      <Stack gap="md">
        <Group justify="space-between" align="center" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <ThemeIcon
              size={38}
              radius="md"
              color={color}
              variant="light"
              style={{
                flexShrink: 0,
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              {icon}
            </ThemeIcon>

            <CommandCenterLabel>{label}</CommandCenterLabel>
          </Group>

          <Text
            size="xl"
            fw={900}
            c="gray.0"
            style={{
              lineHeight: 1,
              letterSpacing: "-0.03em",
            }}
          >
            {value}%
          </Text>
        </Group>

        <Progress
          value={value}
          color={color}
          size={12}
          radius="xl"
          styles={{
            root: {
              backgroundColor: "rgba(255,255,255,0.09)",
            },
          }}
        />

        <Group justify="space-between" align="center" gap="sm">
          <Text
            size="xs"
            c="gray.5"
            style={{
              lineHeight: 1.4,
            }}
          >
            {description}
          </Text>

          {badge && (
            <Badge
              color={color}
              variant="light"
              radius="sm"
              size="sm"
              styles={{
                root: {
                  border: "1px solid rgba(255,255,255,0.08)",
                },
              }}
            >
              {badge}
            </Badge>
          )}
        </Group>
      </Stack>
    </Box>
  );
}

function MWCommandCenter({
  title = "Command Center",
  subtitle = "",
  currentStage = "Not Started",
  currentStageStatus = "Not Started",
  currentStageOwner = "Not assigned",
  currentStageColor = "gray",
  nextAction = "No next action",
  progress = 0,
  progressColor = "red",
  health = 100,
  healthLabel = "Excellent",
  healthColor = "green",
  status = "New",
  statusColor = "gray",
  priority = "Normal",
  priorityColor = "green",
  dueDate = "Not set",
  assignedTo = "Not assigned",
  footer = null,
}) {
  const safeProgress = clampPercentage(progress);
  const safeHealth = clampPercentage(health);

  return (
    <Card
      withBorder
      radius="xl"
      p={0}
      style={{
        position: "relative",
        overflow: "hidden",
        borderColor: "rgba(255,255,255,0.09)",
        background:
          "linear-gradient(135deg, #202020 0%, #171717 48%, #111111 100%)",
        boxShadow:
          "0 18px 45px rgba(0,0,0,0.22), 0 3px 10px rgba(0,0,0,0.16)",
      }}
    >
      <Box
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(circle at 10% 0%, rgba(224,49,49,0.16), transparent 34%)",
        }}
      />

      <Box
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          bottom: 0,
          width: 6,
          background:
            "linear-gradient(180deg, var(--mantine-color-red-5), var(--mantine-color-red-8))",
        }}
      />

      <Stack gap={0} style={{ position: "relative" }}>
        <Box px={{ base: "lg", md: "xl" }} py="xl">
          <Group
            justify="space-between"
            align="flex-start"
            gap="lg"
            wrap="wrap"
          >
            <Box style={{ minWidth: 0 }}>
              <CommandCenterLabel>{title}</CommandCenterLabel>

              {subtitle && (
                <Title
                  order={2}
                  c="gray.0"
                  mt={6}
                  style={{
                    lineHeight: 1.15,
                    letterSpacing: "-0.025em",
                    overflowWrap: "anywhere",
                  }}
                >
                  {subtitle}
                </Title>
              )}
            </Box>

            <Group gap="sm">
              <Badge
                leftSection={<IconFlag size={13} />}
                color={priorityColor}
                variant="light"
                size="lg"
                radius="sm"
                styles={{
                  root: {
                    border: "1px solid rgba(255,255,255,0.1)",
                    fontWeight: 800,
                  },
                }}
              >
                {priority} Priority
              </Badge>

              <Badge
                leftSection={<IconCircleCheckFilled size={13} />}
                color={statusColor}
                variant="filled"
                size="lg"
                radius="sm"
                styles={{
                  root: {
                    fontWeight: 800,
                    boxShadow: "0 5px 14px rgba(0,0,0,0.18)",
                  },
                }}
              >
                {status}
              </Badge>
            </Group>
          </Group>
        </Box>

        <Divider color="rgba(255,255,255,0.08)" />

        <Box px={{ base: "lg", md: "xl" }} py="xl">
          <SimpleGrid
            cols={{
              base: 1,
              lg: 12,
            }}
            spacing="lg"
            verticalSpacing="lg"
          >
            <Box
              style={{
                gridColumn: "span 5",
                minWidth: 0,
              }}
            >
              <Stack gap="md">
                <CommandCenterLabel>Current Stage</CommandCenterLabel>

                <Box
                  p="lg"
                  style={{
                    minHeight: "190px",
                    height: "100%",
                    borderRadius: "16px",
                    border: `1px solid var(--mantine-color-${currentStageColor}-7)`,
                    background:
                      "linear-gradient(145deg, rgba(255,255,255,0.07), rgba(255,255,255,0.022))",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
                  }}
                >
                  <Stack justify="space-between" h="100%" gap="xl">
                    <Group
                      justify="space-between"
                      align="flex-start"
                      wrap="nowrap"
                      gap="lg"
                    >
                      <Group align="flex-start" wrap="nowrap" gap="md">
                        <ThemeIcon
                          color={currentStageColor}
                          variant="filled"
                          radius="lg"
                          size={54}
                          style={{
                            flexShrink: 0,
                            boxShadow: "0 8px 20px rgba(0,0,0,0.24)",
                          }}
                        >
                          <IconProgressCheck size={28} stroke={2.2} />
                        </ThemeIcon>

                        <Box style={{ minWidth: 0 }}>
                          <Text
                            size="xs"
                            c="gray.5"
                            fw={700}
                            mb={5}
                          >
                            Active workflow stage
                          </Text>

                          <Title
                            order={3}
                            c="gray.0"
                            style={{
                              lineHeight: 1.18,
                              letterSpacing: "-0.02em",
                              overflowWrap: "anywhere",
                            }}
                          >
                            {currentStage}
                          </Title>
                        </Box>
                      </Group>

                      <Badge
                        color={currentStageColor}
                        variant="light"
                        radius="sm"
                        size="md"
                        style={{
                          flexShrink: 0,
                          border: "1px solid rgba(255,255,255,0.08)",
                        }}
                      >
                        {currentStageStatus}
                      </Badge>
                    </Group>

                    <Divider color="rgba(255,255,255,0.08)" />

                    <DetailItem
                      icon={<IconUser size={18} />}
                      label="Stage Owner"
                      value={currentStageOwner}
                    />
                  </Stack>
                </Box>
              </Stack>
            </Box>

            <Box
              style={{
                gridColumn: "span 7",
                minWidth: 0,
              }}
            >
              <Stack gap="md">
                <CommandCenterLabel>Required Next Action</CommandCenterLabel>

                <Box
                  p="lg"
                  style={{
                    minHeight: "190px",
                    height: "100%",
                    borderRadius: "16px",
                    border: "1px solid rgba(255,255,255,0.09)",
                    background:
                      "linear-gradient(145deg, rgba(224,49,49,0.105), rgba(255,255,255,0.025))",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
                  }}
                >
                  <Stack justify="space-between" h="100%" gap="xl">
                    <Group align="flex-start" wrap="nowrap" gap="md">
                      <ThemeIcon
                        color="red"
                        variant="light"
                        radius="lg"
                        size={54}
                        style={{
                          flexShrink: 0,
                          border: "1px solid rgba(224,49,49,0.22)",
                        }}
                      >
                        <IconArrowRight size={28} stroke={2.2} />
                      </ThemeIcon>

                      <Box style={{ minWidth: 0 }}>
                        <Text
                          size="xs"
                          c="gray.5"
                          fw={700}
                          mb={6}
                        >
                          The next step needed to keep this project moving
                        </Text>

                        <Text
                          fw={850}
                          size="xl"
                          c="gray.0"
                          style={{
                            lineHeight: 1.35,
                            letterSpacing: "-0.015em",
                            overflowWrap: "anywhere",
                          }}
                        >
                          {nextAction}
                        </Text>
                      </Box>
                    </Group>

                    <Divider color="rgba(255,255,255,0.08)" />

                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
                      <DetailItem
                        icon={<IconUser size={18} />}
                        label="Assigned To"
                        value={assignedTo}
                      />

                      <DetailItem
                        icon={<IconCalendarDue size={18} />}
                        label="Due Date"
                        value={dueDate}
                      />
                    </SimpleGrid>
                  </Stack>
                </Box>
              </Stack>
            </Box>

            <Box
              style={{
                gridColumn: "span 7",
                minWidth: 0,
              }}
            >
              <ProgressPanel
                icon={<IconProgressCheck size={20} />}
                label="Project Progress"
                value={safeProgress}
                color={progressColor}
                description="Overall completion across the full project workflow"
              />
            </Box>

            <Box
              style={{
                gridColumn: "span 5",
                minWidth: 0,
              }}
            >
              <ProgressPanel
                icon={<IconActivityHeartbeat size={20} />}
                label="Project Health"
                value={safeHealth}
                color={healthColor}
                description="Schedule, workflow, payment, and material readiness"
                badge={healthLabel}
              />
            </Box>
          </SimpleGrid>
        </Box>

        {footer && (
          <>
            <Divider color="rgba(255,255,255,0.08)" />

            <Box
              px={{ base: "lg", md: "xl" }}
              py="lg"
              style={{
                backgroundColor: "rgba(0,0,0,0.14)",
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

export default MWCommandCenter;