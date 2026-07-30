import {
  Badge,
  Box,
  Group,
  Text,
  ThemeIcon,
} from "@mantine/core";
import { IconChevronRight } from "@tabler/icons-react";

function formatDisplayValue(value, fallback = "Not set") {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return fallback;
  }

  return value;
}

function MWDataRow({
  label,
  value,
  description = "",
  icon: Icon = null,
  color = "gray",
  status = "",
  statusColor = "gray",
  statusVariant = "light",
  fallback = "Not set",
  mono = false,
  muted = false,
  compact = false,
  emphasize = false,
  showDivider = false,
  rightSection = null,
  onClick = null,
  chevron = false,
  fullWidth = true,
}) {
  const isClickable =
    typeof onClick === "function";

  const displayValue =
    formatDisplayValue(value, fallback);

  const content = (
    <Group
      justify="space-between"
      align="center"
      wrap="nowrap"
      gap="lg"
      style={{
        width: "100%",
        minWidth: 0,
      }}
    >
      <Group
        align="center"
        gap="md"
        wrap="nowrap"
        style={{
          minWidth: 0,
          flex: 1,
        }}
      >
        {Icon && (
          <ThemeIcon
            size={compact ? 34 : 40}
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
              size={compact ? 17 : 20}
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
            mt={3}
            size={compact ? "sm" : "md"}
            fw={emphasize ? 850 : 750}
            c={muted ? "gray.5" : "gray.1"}
            ff={mono ? "monospace" : undefined}
            style={{
              lineHeight: 1.35,
              textAlign: "left",
              overflowWrap: "break-word",
              whiteSpace: "pre-wrap",
              fontVariantNumeric:
                mono || typeof displayValue === "number"
                  ? "tabular-nums"
                  : undefined,
            }}
          >
            {displayValue}
          </Text>

          {description && (
            <Text
              size="xs"
              c="gray.6"
              mt={4}
              style={{
                lineHeight: 1.4,
                textAlign: "left",
                overflowWrap: "break-word",
              }}
            >
              {description}
            </Text>
          )}
        </Box>
      </Group>

      <Group
        gap="sm"
        wrap="nowrap"
        style={{
          flexShrink: 0,
        }}
      >
        {status && (
          <Badge
            color={statusColor}
            variant={statusVariant}
            radius="sm"
            size={compact ? "sm" : "md"}
            styles={{
              root: {
                border:
                  statusVariant === "light"
                    ? "1px solid rgba(255,255,255,0.08)"
                    : undefined,
                fontWeight: 800,
              },
            }}
          >
            {status}
          </Badge>
        )}

        {rightSection}

        {(chevron || isClickable) && (
          <IconChevronRight
            size={17}
            color="var(--mantine-color-gray-6)"
          />
        )}
      </Group>
    </Group>
  );

  if (isClickable) {
    return (
      <Box
        component="button"
        type="button"
        onClick={onClick}
        style={{
          width: fullWidth ? "100%" : "auto",
          padding: compact ? "10px 12px" : "12px 14px",
          border: "none",
          borderBottom: showDivider
            ? "1px solid rgba(255,255,255,0.07)"
            : "none",
          borderRadius: showDivider ? 0 : 10,
          background: "transparent",
          color: "inherit",
          font: "inherit",
          textAlign: "left",
          cursor: "pointer",
          transition:
            "background-color 130ms ease, border-color 130ms ease",
        }}
      >
        {content}
      </Box>
    );
  }

  return (
    <Box
      style={{
        width: fullWidth ? "100%" : "auto",
        padding: compact ? "10px 0" : "12px 0",
        borderBottom: showDivider
          ? "1px solid rgba(255,255,255,0.07)"
          : "none",
      }}
    >
      {content}
    </Box>
  );
}

export default MWDataRow;