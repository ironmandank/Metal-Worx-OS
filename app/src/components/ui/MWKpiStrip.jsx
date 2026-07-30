import {
  Box,
  Divider,
  Group,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
} from "@mantine/core";
import { IconChevronRight } from "@tabler/icons-react";

function KpiItem({
  label,
  value,
  description = "",
  icon: Icon = null,
  color = "gray",
  onClick = null,
  compact = false,
}) {
  const isClickable =
    typeof onClick === "function";

  return (
    <Box
      component={
        isClickable
          ? "button"
          : "div"
      }
      type={
        isClickable
          ? "button"
          : undefined
      }
      onClick={
        isClickable
          ? onClick
          : undefined
      }
      style={{
        width: "100%",
        minWidth: 0,
        padding: compact
          ? "14px 16px"
          : "18px 20px",
        border: "none",
        borderRadius: 0,
        background: "transparent",
        color: "inherit",
        font: "inherit",
        textAlign: "left",
        cursor: isClickable
          ? "pointer"
          : "default",
      }}
    >
      <Group
        justify="space-between"
        align="center"
        gap="lg"
        wrap="nowrap"
      >
        <Group
          gap="md"
          align="center"
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
                size={compact ? 19 : 22}
                stroke={2}
              />
            </ThemeIcon>
          )}

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
                letterSpacing: "0.065em",
                lineHeight: 1.25,
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

            {description && (
              <Text
                size="xs"
                c="gray.5"
                mt={7}
                style={{
                  lineHeight: 1.4,
                  textAlign: "left",
                }}
              >
                {description}
              </Text>
            )}
          </Box>
        </Group>

        {isClickable && (
          <IconChevronRight
            size={18}
            color="var(--mantine-color-gray-6)"
            style={{
              flexShrink: 0,
            }}
          />
        )}
      </Group>
    </Box>
  );
}

function MWKpiStrip({
  items = [],
  columns = {
    base: 1,
    sm: 2,
    lg: 4,
  },
  compact = false,
  withBorder = true,
  radius = "xl",
}) {
  const safeItems = Array.isArray(items)
    ? items.filter(Boolean)
    : [];

  return (
    <Box
      style={{
        width: "100%",
        overflow: "hidden",
        borderRadius:
          radius === "xl"
            ? "var(--mantine-radius-xl)"
            : radius,
        border: withBorder
          ? "1px solid rgba(255,255,255,0.08)"
          : "none",
        background:
          "linear-gradient(145deg, rgba(255,255,255,0.045), rgba(255,255,255,0.014))",
        boxShadow:
          "0 10px 28px rgba(0,0,0,0.12)",
      }}
    >
      <SimpleGrid
        cols={columns}
        spacing={0}
        verticalSpacing={0}
      >
        {safeItems.map(
          (item, index) => (
            <Box
              key={
                item.key ||
                item.label ||
                `kpi-item-${index}`
              }
              style={{
                minWidth: 0,
                position: "relative",
              }}
            >
              <KpiItem
                label={item.label}
                value={item.value}
                description={
                  item.description
                }
                icon={item.icon}
                color={
                  item.color ||
                  "gray"
                }
                onClick={item.onClick}
                compact={compact}
              />

              {index <
                safeItems.length - 1 && (
                <Divider
                  orientation="vertical"
                  style={{
                    position: "absolute",
                    top: 16,
                    right: 0,
                    bottom: 16,
                    height: "auto",
                    borderColor:
                      "rgba(255,255,255,0.07)",
                  }}
                />
              )}
            </Box>
          )
        )}
      </SimpleGrid>
    </Box>
  );
}

export default MWKpiStrip;