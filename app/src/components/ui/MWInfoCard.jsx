import {
  Box,
  Card,
  Divider,
  Group,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
} from "@mantine/core";
import { IconChevronRight } from "@tabler/icons-react";

function normalizeItems(items = []) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.filter(Boolean);
}

function InfoRow({
  label,
  value,
  icon: Icon = null,
  color = "gray",
  fullWidth = false,
  mono = false,
  muted = false,
}) {
  const displayValue =
    value === null ||
    value === undefined ||
    value === ""
      ? "Not set"
      : value;

  return (
    <Group
      align="flex-start"
      gap="md"
      wrap="nowrap"
      style={{
        minWidth: 0,
        width: "100%",
        gridColumn: fullWidth
          ? "1 / -1"
          : undefined,
      }}
    >
      {Icon && (
        <ThemeIcon
          size={38}
          radius="md"
          color={color}
          variant="light"
          style={{
            flexShrink: 0,
            border:
              "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <Icon size={19} stroke={2} />
        </ThemeIcon>
      )}

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
          fw={750}
          style={{
            lineHeight: 1.3,
            textAlign: "left",
          }}
        >
          {label}
        </Text>

        <Text
          mt={4}
          size="sm"
          fw={750}
          c={muted ? "gray.5" : "gray.1"}
          ff={mono ? "monospace" : undefined}
          style={{
            lineHeight: 1.4,
            textAlign: "left",
            whiteSpace: "pre-wrap",
            overflowWrap: "break-word",
            wordBreak: "normal",
          }}
        >
          {displayValue}
        </Text>
      </Box>
    </Group>
  );
}

function MWInfoCard({
  title = "",
  subtitle = "",
  icon: Icon = null,
  color = "red",
  items = [],
  columns = 2,
  children = null,
  footer = null,
  actionLabel = "",
  onAction = null,
  compact = false,
  withBorder = true,
  highlight = false,
  minHeight = null,
}) {
  const safeItems = normalizeItems(items);

  const hasHeader = Boolean(
    title ||
      subtitle ||
      Icon
  );

  const hasAction =
    Boolean(actionLabel) &&
    typeof onAction === "function";

  const safeColumns = Math.max(
    1,
    Math.min(Number(columns) || 1, 4)
  );

  return (
    <Card
      withBorder={withBorder}
      radius="lg"
      p={0}
      style={{
        position: "relative",
        height: "100%",
        minHeight: minHeight || undefined,
        overflow: "hidden",
        borderColor: highlight
          ? `var(--mantine-color-${color}-7)`
          : "rgba(255,255,255,0.08)",
        background: highlight
          ? `linear-gradient(
              145deg,
              color-mix(
                in srgb,
                var(--mantine-color-${color}-9) 18%,
                rgba(255,255,255,0.045)
              ),
              rgba(255,255,255,0.018)
            )`
          : "linear-gradient(145deg, rgba(255,255,255,0.045), rgba(255,255,255,0.016))",
        boxShadow: highlight
          ? "0 12px 30px rgba(0,0,0,0.2)"
          : "0 8px 24px rgba(0,0,0,0.12)",
      }}
    >
      {highlight && (
        <Box
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            bottom: 0,
            width: 4,
            background: `var(--mantine-color-${color}-6)`,
          }}
        />
      )}

      <Stack gap={0} h="100%">
        {hasHeader && (
          <>
            <Box
              px={compact ? "md" : "lg"}
              py={compact ? "md" : "lg"}
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
                    {title && (
                      <Text
                        fw={850}
                        size={compact ? "sm" : "md"}
                        c="gray.0"
                        style={{
                          lineHeight: 1.3,
                          letterSpacing: "-0.012em",
                          textAlign: "left",
                          overflowWrap: "break-word",
                        }}
                      >
                        {title}
                      </Text>
                    )}

                    {subtitle && (
                      <Text
                        size="xs"
                        c="gray.5"
                        mt={title ? 4 : 0}
                        style={{
                          lineHeight: 1.45,
                          textAlign: "left",
                          maxWidth: 680,
                        }}
                      >
                        {subtitle}
                      </Text>
                    )}
                  </Box>
                </Group>

                {hasAction && (
                  <Box
                    component="button"
                    type="button"
                    onClick={onAction}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      flexShrink: 0,
                      padding: 0,
                      border: 0,
                      background: "transparent",
                      color: `var(--mantine-color-${color}-4)`,
                      cursor: "pointer",
                      font: "inherit",
                    }}
                  >
                    <Text size="xs" fw={800}>
                      {actionLabel}
                    </Text>

                    <IconChevronRight size={15} />
                  </Box>
                )}
              </Group>
            </Box>

            <Divider color="rgba(255,255,255,0.07)" />
          </>
        )}

        <Box
          px={compact ? "md" : "lg"}
          py={compact ? "md" : "lg"}
          style={{
            flex: 1,
          }}
        >
          {safeItems.length > 0 && (
            <SimpleGrid
              cols={{
                base: 1,
                sm: safeColumns,
              }}
              spacing={compact ? "lg" : "xl"}
              verticalSpacing={compact ? "lg" : "xl"}
            >
              {safeItems.map((item, index) => (
                <InfoRow
                  key={`${item.label || "item"}-${index}`}
                  label={item.label}
                  value={item.value}
                  icon={item.icon}
                  color={item.color || color}
                  fullWidth={item.fullWidth}
                  mono={item.mono}
                  muted={item.muted}
                />
              ))}
            </SimpleGrid>
          )}

          {children}
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

export default MWInfoCard;