import {
  Badge,
  Box,
  Divider,
  Group,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
} from "@mantine/core";
import {
  IconAlertTriangle,
  IconCheck,
  IconCircleCheck,
  IconPhoto,
  IconQrcode,
  IconRefresh,
  IconTag,
  IconTruck,
  IconBuildingWarehouse,
} from "@tabler/icons-react";

import MWPanel from "../ui/MWPanel";

function clampPercentage(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.max(0, Math.min(numericValue, 100));
}

function getHealthConfig(score) {
  if (score >= 90) {
    return {
      label: "Excellent",
      color: "green",
      icon: IconCircleCheck,
    };
  }

  if (score >= 75) {
    return {
      label: "Good",
      color: "blue",
      icon: IconCheck,
    };
  }

  if (score >= 50) {
    return {
      label: "Needs Attention",
      color: "orange",
      icon: IconAlertTriangle,
    };
  }

  return {
    label: "At Risk",
    color: "red",
    icon: IconAlertTriangle,
  };
}

function HealthRequirement({
  label,
  description = "",
  complete = false,
  icon: Icon,
  successColor = "green",
  warningColor = "orange",
}) {
  const color = complete
    ? successColor
    : warningColor;

  return (
    <Box
      p="md"
      style={{
        borderRadius: 12,
        border:
          "1px solid rgba(255,255,255,0.07)",
        backgroundColor:
          "rgba(255,255,255,0.022)",
      }}
    >
      <Group
        align="flex-start"
        gap="md"
        wrap="nowrap"
      >
        <ThemeIcon
          size={36}
          radius="md"
          color={color}
          variant="light"
          style={{
            flexShrink: 0,
            border:
              "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {complete ? (
            <IconCheck
              size={18}
              stroke={2.4}
            />
          ) : (
            <Icon
              size={18}
              stroke={2}
            />
          )}
        </ThemeIcon>

        <Box
          style={{
            minWidth: 0,
            flex: 1,
          }}
        >
          <Text
            fw={800}
            size="sm"
            c="gray.1"
            style={{
              lineHeight: 1.3,
              textAlign: "left",
            }}
          >
            {label}
          </Text>

          {description && (
            <Text
              size="xs"
              c="gray.5"
              mt={4}
              style={{
                lineHeight: 1.4,
                textAlign: "left",
              }}
            >
              {description}
            </Text>
          )}
        </Box>

        <Badge
          color={color}
          variant="light"
          radius="sm"
          size="sm"
          styles={{
            root: {
              flexShrink: 0,
              border:
                "1px solid rgba(255,255,255,0.08)",
              fontWeight: 800,
            },
          }}
        >
          {complete
            ? "Complete"
            : "Missing"}
        </Badge>
      </Group>
    </Box>
  );
}

function SummaryStat({
  label,
  value,
  color = "gray",
}) {
  return (
    <Box
      p="md"
      style={{
        borderRadius: 12,
        border:
          "1px solid rgba(255,255,255,0.07)",
        backgroundColor:
          "rgba(255,255,255,0.022)",
      }}
    >
      <Text
        size="xs"
        c="gray.5"
        fw={750}
        style={{
          lineHeight: 1.3,
          textAlign: "left",
        }}
      >
        {label}
      </Text>

      <Text
        mt={5}
        fw={900}
        size="xl"
        c={`${color}.3`}
        style={{
          lineHeight: 1,
          textAlign: "left",
          fontVariantNumeric:
            "tabular-nums",
        }}
      >
        {value}
      </Text>
    </Box>
  );
}

function MWInventoryHealthCard({
  title = "Inventory Health",
  subtitle = "Measures quantity status and data completeness across inventory.",
  icon = IconRefresh,
  score = 0,
  totalItems = 0,
  healthyItems = 0,
  itemsNeedingAttention = 0,
  missingImages = 0,
  missingVendors = 0,
  missingStorage = 0,
  missingQrLabels = 0,
  missingReorderPoints = 0,
  requirements = null,
  compact = false,
}) {
  const safeScore =
    clampPercentage(score);

  const healthConfig =
    getHealthConfig(safeScore);

  const HealthIcon =
    healthConfig.icon;

  const defaultRequirements = [
    {
      key: "images",
      label: "Item Images",
      description:
        "Every item should have a clear reference image.",
      complete:
        Number(missingImages || 0) === 0,
      icon: IconPhoto,
    },
    {
      key: "vendors",
      label: "Vendor Assignment",
      description:
        "Stock items should have a preferred or default vendor.",
      complete:
        Number(missingVendors || 0) === 0,
      icon: IconTruck,
    },
    {
      key: "storage",
      label: "Storage Position",
      description:
        "Every stock item should have a default shop area, rack, shelf, or bin.",
      complete:
        Number(missingStorage || 0) === 0,
      icon: IconBuildingWarehouse,
    },
    {
      key: "qr",
      label: "QR Label",
      description:
        "Items and storage positions should have printable QR records.",
      complete:
        Number(missingQrLabels || 0) === 0,
      icon: IconQrcode,
    },
    {
      key: "reorder",
      label: "Reorder Point",
      description:
        "Stock items should have a reorder threshold.",
      complete:
        Number(
          missingReorderPoints || 0
        ) === 0,
      icon: IconTag,
    },
  ];

  const displayRequirements =
    Array.isArray(requirements) &&
    requirements.length > 0
      ? requirements
      : defaultRequirements;

  return (
    <MWPanel
      title={title}
      subtitle={subtitle}
      icon={icon}
      color={healthConfig.color}
      compact={compact}
      rightSection={
        <Badge
          color={healthConfig.color}
          variant="light"
          radius="sm"
          size="lg"
          leftSection={
            <HealthIcon size={14} />
          }
          styles={{
            root: {
              border:
                "1px solid rgba(255,255,255,0.08)",
              fontWeight: 850,
            },
          }}
        >
          {healthConfig.label}
        </Badge>
      }
      fullHeight
    >
      <Stack gap="lg">
        <Group
          justify="space-between"
          align="flex-end"
          gap="lg"
          wrap="wrap"
        >
          <Box>
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
              Overall Health Score
            </Text>

            <Text
              mt={6}
              fw={900}
              size="34px"
              c="gray.0"
              style={{
                lineHeight: 1,
                letterSpacing:
                  "-0.045em",
                textAlign: "left",
                fontVariantNumeric:
                  "tabular-nums",
              }}
            >
              {safeScore}%
            </Text>
          </Box>

          <Text
            size="sm"
            c="gray.5"
            maw={440}
            style={{
              lineHeight: 1.45,
              textAlign: "right",
            }}
          >
            Health combines stock status,
            assigned vendors, storage
            locations, item images, QR
            records, and reorder settings.
          </Text>
        </Group>

        <Progress
          value={safeScore}
          color={healthConfig.color}
          size={16}
          radius="xl"
          styles={{
            root: {
              backgroundColor:
                "rgba(255,255,255,0.08)",
              boxShadow:
                "inset 0 1px 3px rgba(0,0,0,0.25)",
            },
          }}
        />

        <SimpleGrid
          cols={{
            base: 1,
            sm: 3,
          }}
          spacing="sm"
        >
          <SummaryStat
            label="Total Items"
            value={totalItems}
            color="blue"
          />

          <SummaryStat
            label="Healthy Items"
            value={healthyItems}
            color="green"
          />

          <SummaryStat
            label="Need Attention"
            value={itemsNeedingAttention}
            color={
              Number(
                itemsNeedingAttention
              ) > 0
                ? "orange"
                : "green"
            }
          />
        </SimpleGrid>

        <Divider color="rgba(255,255,255,0.08)" />

        <Box>
          <Text
            size="xs"
            c="gray.5"
            fw={800}
            tt="uppercase"
            mb="sm"
            style={{
              letterSpacing:
                "0.07em",
              textAlign: "left",
            }}
          >
            Data Readiness
          </Text>

          <SimpleGrid
            cols={{
              base: 1,
              md: 2,
            }}
            spacing="sm"
          >
            {displayRequirements.map(
              (requirement, index) => (
                <HealthRequirement
                  key={
                    requirement.key ||
                    requirement.label ||
                    `health-requirement-${index}`
                  }
                  label={
                    requirement.label
                  }
                  description={
                    requirement.description
                  }
                  complete={
                    requirement.complete
                  }
                  icon={
                    requirement.icon ||
                    IconAlertTriangle
                  }
                  successColor={
                    requirement.successColor ||
                    "green"
                  }
                  warningColor={
                    requirement.warningColor ||
                    "orange"
                  }
                />
              )
            )}
          </SimpleGrid>
        </Box>
      </Stack>
    </MWPanel>
  );
}

export default MWInventoryHealthCard;