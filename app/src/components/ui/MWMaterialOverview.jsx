import {
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
  IconCash,
  IconCheck,
  IconCircleCheck,
  IconFileDollar,
  IconPackage,
  IconProgressCheck,
  IconShoppingCart,
  IconTruckDelivery,
} from "@tabler/icons-react";

import MWDataRow from "./MWDataRow";
import MWPanel from "./MWPanel";
import MWStatusBadge from "./MWStatusBadge";

function clampPercentage(value) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    return 0;
  }

  return Math.max(0, Math.min(parsedValue, 100));
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function FinancialValue({
  value,
  color = "gray",
}) {
  return (
    <Text
      fw={900}
      size="lg"
      c={color === "gray" ? "gray.0" : `${color}.3`}
      style={{
        minWidth: 100,
        flexShrink: 0,
        lineHeight: 1,
        textAlign: "right",
        whiteSpace: "nowrap",
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "-0.025em",
      }}
    >
      {value}
    </Text>
  );
}

function ReadinessStat({
  label,
  value,
  color = "gray",
  icon: Icon,
}) {
  return (
    <Box
      px="md"
      py="sm"
      style={{
        minWidth: 0,
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.07)",
        backgroundColor: "rgba(255,255,255,0.022)",
      }}
    >
      <Group
        justify="space-between"
        align="center"
        wrap="nowrap"
        gap="md"
      >
        <Group
          gap="sm"
          wrap="nowrap"
          style={{
            minWidth: 0,
            flex: 1,
          }}
        >
          <ThemeIcon
            size={30}
            radius="md"
            color={color}
            variant="light"
            style={{
              flexShrink: 0,
              border:
                "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <Icon size={15} stroke={2.1} />
          </ThemeIcon>

          <Text
            size="sm"
            fw={750}
            c="gray.3"
            style={{
              minWidth: 0,
              lineHeight: 1.3,
              textAlign: "left",
            }}
          >
            {label}
          </Text>
        </Group>

        <Text
          size="lg"
          fw={900}
          c={`${color}.3`}
          style={{
            minWidth: 28,
            flexShrink: 0,
            lineHeight: 1,
            textAlign: "right",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {value}
        </Text>
      </Group>
    </Box>
  );
}

function MWMaterialOverview({
  internalCost = 0,
  customerPrice = 0,
  materialProfit = 0,
  materialMargin = 0,
  readiness = 0,
  pricing = 0,
  approval = 0,
  ready = 0,
  ordered = 0,
  received = 0,
  outstanding = 0,
  total = 0,
}) {
  const safeReadiness = clampPercentage(readiness);

  const numericTotal = Number(total || 0);
  const numericOutstanding = Number(
    outstanding || 0
  );

  const numericMargin = Number(
    materialMargin || 0
  );

  const materialsReady =
    numericTotal === 0 ||
    numericOutstanding === 0;

  const readinessColor = materialsReady
    ? "green"
    : "orange";

  const marginColor =
    numericMargin >= 25
      ? "green"
      : numericMargin > 0
        ? "orange"
        : "gray";

  return (
    <MWPanel
      title="Material Overview"
      subtitle="Financial performance and readiness of materials required for this project."
      icon={IconPackage}
      color="orange"
    >
      <Stack gap="xl">
        <Box>
          <Group
            justify="space-between"
            align="center"
            gap="lg"
            wrap="wrap"
            mb="sm"
          >
            <Box>
              <Text
                size="xs"
                c="gray.5"
                fw={850}
                tt="uppercase"
                style={{
                  letterSpacing: "0.075em",
                  textAlign: "left",
                }}
              >
                Financial Summary
              </Text>

              <Text
                size="sm"
                c="gray.5"
                mt={4}
                style={{
                  lineHeight: 1.4,
                  textAlign: "left",
                }}
              >
                Material cost, customer pricing, profit, and margin.
              </Text>
            </Box>

            <MWStatusBadge
              status={
                numericMargin >= 25
                  ? "Excellent"
                  : numericMargin > 0
                    ? "Watch"
                    : "Pending"
              }
              label={
                numericMargin >= 25
                  ? "Healthy Margin"
                  : numericMargin > 0
                    ? "Review Margin"
                    : "No Margin"
              }
              color={marginColor}
              variant="light"
            />
          </Group>

          <Box
            px="md"
            style={{
              borderRadius: 14,
              border:
                "1px solid rgba(255,255,255,0.07)",
              backgroundColor:
                "rgba(255,255,255,0.018)",
            }}
          >
            <MWDataRow
              label="Internal Material Cost"
              value="Estimated purchasing cost"
              icon={IconShoppingCart}
              color="red"
              compact
              showDivider
              rightSection={
                <FinancialValue
                  value={formatCurrency(
                    internalCost
                  )}
                />
              }
            />

            <MWDataRow
              label="Customer Material Price"
              value="Material amount included in the customer quote"
              icon={IconFileDollar}
              color="violet"
              compact
              showDivider
              rightSection={
                <FinancialValue
                  value={formatCurrency(
                    customerPrice
                  )}
                />
              }
            />

            <MWDataRow
              label="Material Profit"
              value="Material revenue before labor and overhead"
              icon={IconCash}
              color="green"
              compact
              showDivider
              rightSection={
                <FinancialValue
                  value={formatCurrency(
                    materialProfit
                  )}
                  color={
                    Number(materialProfit) > 0
                      ? "green"
                      : "gray"
                  }
                />
              }
            />

            <MWDataRow
              label="Material Margin"
              value="Profit as a percentage of material revenue"
              icon={IconProgressCheck}
              color={marginColor}
              compact
              rightSection={
                <FinancialValue
                  value={`${numericMargin.toFixed(
                    1
                  )}%`}
                  color={marginColor}
                />
              }
            />
          </Box>
        </Box>

        <Divider color="rgba(255,255,255,0.08)" />

        <Box>
          <Group
            justify="space-between"
            align="flex-start"
            gap="xl"
            wrap="wrap"
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
                fw={850}
                tt="uppercase"
                style={{
                  letterSpacing: "0.075em",
                  textAlign: "left",
                }}
              >
                Material Readiness
              </Text>

              <Text
                size="sm"
                c="gray.5"
                mt={4}
                style={{
                  lineHeight: 1.45,
                  textAlign: "left",
                }}
              >
                Tracks each required material from pricing through final
                receiving.
              </Text>
            </Box>

            <Group
              gap="md"
              wrap="nowrap"
              align="center"
            >
              <MWStatusBadge
                status={
                  materialsReady
                    ? "Available"
                    : "Pending"
                }
                label={
                  materialsReady
                    ? "Materials Ready"
                    : `${numericOutstanding} Outstanding`
                }
                color={readinessColor}
                variant="light"
              />

              <Text
                fw={900}
                size="32px"
                c="gray.0"
                style={{
                  minWidth: 72,
                  flexShrink: 0,
                  lineHeight: 1,
                  textAlign: "right",
                  whiteSpace: "nowrap",
                  fontVariantNumeric:
                    "tabular-nums",
                  letterSpacing: "-0.04em",
                }}
              >
                {safeReadiness}%
              </Text>
            </Group>
          </Group>

          <Progress
            value={safeReadiness}
            color={readinessColor}
            size={16}
            radius="xl"
            mt="lg"
            styles={{
              root: {
                backgroundColor:
                  "rgba(255,255,255,0.08)",
                boxShadow:
                  "inset 0 1px 3px rgba(0,0,0,0.25)",
              },
            }}
          />

          <Text
            size="sm"
            c="gray.4"
            mt="md"
            style={{
              lineHeight: 1.45,
              textAlign: "left",
            }}
          >
            {numericTotal === 0
              ? "No project-specific material requests have been added."
              : materialsReady
                ? "All required project materials have been received and are ready for production."
                : `${numericOutstanding} material request${
                    numericOutstanding === 1
                      ? ""
                      : "s"
                  } still require receiving before the project is fully material-ready.`}
          </Text>

          <SimpleGrid
            cols={{
              base: 1,
              sm: 2,
              lg: 3,
            }}
            spacing="sm"
            mt="lg"
          >
            <ReadinessStat
              label="Pricing Needed"
              value={pricing}
              color="red"
              icon={IconFileDollar}
            />

            <ReadinessStat
              label="Awaiting Approval"
              value={approval}
              color="orange"
              icon={IconAlertTriangle}
            />

            <ReadinessStat
              label="Ready to Order"
              value={ready}
              color="violet"
              icon={IconShoppingCart}
            />

            <ReadinessStat
              label="Ordered"
              value={ordered}
              color="blue"
              icon={IconTruckDelivery}
            />

            <ReadinessStat
              label="Received"
              value={received}
              color="green"
              icon={IconCheck}
            />

            <ReadinessStat
              label="Outstanding"
              value={numericOutstanding}
              color={
                numericOutstanding > 0
                  ? "orange"
                  : "green"
              }
              icon={
                numericOutstanding > 0
                  ? IconAlertTriangle
                  : IconCircleCheck
              }
            />
          </SimpleGrid>

          {materialsReady && numericTotal > 0 && (
            <Group
              gap="md"
              p="md"
              mt="lg"
              wrap="nowrap"
              style={{
                borderRadius: 12,
                border:
                  "1px solid rgba(64,192,87,0.2)",
                backgroundColor:
                  "rgba(64,192,87,0.07)",
              }}
            >
              <ThemeIcon
                size={34}
                radius="xl"
                color="green"
                variant="light"
                style={{
                  flexShrink: 0,
                }}
              >
                <IconCheck
                  size={18}
                  stroke={2.4}
                />
              </ThemeIcon>

              <Box style={{ minWidth: 0 }}>
                <Text
                  size="sm"
                  fw={800}
                  c="green.3"
                  style={{
                    textAlign: "left",
                  }}
                >
                  Material requirement complete
                </Text>

                <Text
                  size="xs"
                  c="gray.5"
                  mt={2}
                  style={{
                    lineHeight: 1.4,
                    textAlign: "left",
                  }}
                >
                  All project material has been received and can be released
                  with the production package.
                </Text>
              </Box>
            </Group>
          )}
        </Box>
      </Stack>
    </MWPanel>
  );
}

export default MWMaterialOverview;