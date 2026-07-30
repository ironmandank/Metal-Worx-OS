import {
  Box,
  Group,
  Text,
  ThemeIcon,
} from "@mantine/core";

function MWStatPill({
  label = "",
  value = "",
  icon: Icon = null,
  color = "gray",
  variant = "subtle",
  size = "md",
  fullWidth = false,
  onClick = null,
  title = "",
  valueFirst = false,
  uppercase = false,
  mono = false,
}) {
  const isCompact = size === "sm";
  const isLarge = size === "lg";
  const isClickable = typeof onClick === "function";

  const backgroundByVariant = {
    subtle: "rgba(255,255,255,0.035)",
    light: `color-mix(
      in srgb,
      var(--mantine-color-${color}-8) 18%,
      rgba(255,255,255,0.035)
    )`,
    filled: `var(--mantine-color-${color}-7)`,
  };

  const borderByVariant = {
    subtle: "1px solid rgba(255,255,255,0.08)",
    light: `1px solid var(--mantine-color-${color}-8)`,
    filled: `1px solid var(--mantine-color-${color}-6)`,
  };

  const textColor =
    variant === "filled"
      ? "white"
      : `var(--mantine-color-${color}-3)`;

  const content = (
    <Group
      gap={isCompact ? 6 : isLarge ? 10 : 8}
      wrap="nowrap"
      justify={fullWidth ? "space-between" : "flex-start"}
      style={{
        minWidth: 0,
        width: fullWidth ? "100%" : "auto",
      }}
    >
      <Group
        gap={isCompact ? 6 : 8}
        wrap="nowrap"
        style={{ minWidth: 0 }}
      >
        {Icon && (
          <ThemeIcon
            size={isCompact ? 22 : isLarge ? 30 : 26}
            radius="xl"
            color={color}
            variant={variant === "filled" ? "transparent" : "light"}
            style={{
              flexShrink: 0,
              border:
                variant === "filled"
                  ? "1px solid rgba(255,255,255,0.18)"
                  : "1px solid rgba(255,255,255,0.07)",
              color:
                variant === "filled"
                  ? "white"
                  : `var(--mantine-color-${color}-3)`,
            }}
          >
            <Icon
              size={isCompact ? 12 : isLarge ? 17 : 14}
              stroke={2.2}
            />
          </ThemeIcon>
        )}

        {!valueFirst && label && (
          <Text
            size={isCompact ? "xs" : "sm"}
            fw={700}
            c={variant === "filled" ? "white" : "gray.4"}
            tt={uppercase ? "uppercase" : undefined}
            style={{
              lineHeight: 1.2,
              letterSpacing: uppercase ? "0.045em" : 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </Text>
        )}

        {valueFirst && value !== "" && value !== null && (
          <Text
            size={isCompact ? "xs" : isLarge ? "md" : "sm"}
            fw={850}
            ff={mono ? "monospace" : undefined}
            style={{
              color: textColor,
              lineHeight: 1.2,
              whiteSpace: "nowrap",
            }}
          >
            {value}
          </Text>
        )}
      </Group>

      <Group
        gap={6}
        wrap="nowrap"
        style={{
          minWidth: 0,
          flexShrink: 0,
        }}
      >
        {valueFirst && label && (
          <Text
            size={isCompact ? "xs" : "sm"}
            fw={700}
            c={variant === "filled" ? "white" : "gray.4"}
            tt={uppercase ? "uppercase" : undefined}
            style={{
              lineHeight: 1.2,
              letterSpacing: uppercase ? "0.045em" : 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </Text>
        )}

        {!valueFirst &&
          value !== "" &&
          value !== null &&
          value !== undefined && (
            <Text
              size={isCompact ? "xs" : isLarge ? "md" : "sm"}
              fw={850}
              ff={mono ? "monospace" : undefined}
              style={{
                color: textColor,
                lineHeight: 1.2,
                whiteSpace: "nowrap",
              }}
            >
              {value}
            </Text>
          )}
      </Group>
    </Group>
  );

  if (isClickable) {
    return (
      <Box
        component="button"
        type="button"
        title={title}
        onClick={onClick}
        style={{
          width: fullWidth ? "100%" : "fit-content",
          maxWidth: "100%",
          padding: isCompact
            ? "6px 9px"
            : isLarge
              ? "10px 13px"
              : "8px 11px",
          borderRadius: "999px",
          border: borderByVariant[variant] || borderByVariant.subtle,
          background:
            backgroundByVariant[variant] ||
            backgroundByVariant.subtle,
          color: "inherit",
          cursor: "pointer",
          font: "inherit",
          textAlign: "left",
          transition:
            "transform 130ms ease, border-color 130ms ease, background-color 130ms ease",
        }}
      >
        {content}
      </Box>
    );
  }

  return (
    <Box
      title={title}
      style={{
        width: fullWidth ? "100%" : "fit-content",
        maxWidth: "100%",
        padding: isCompact
          ? "6px 9px"
          : isLarge
            ? "10px 13px"
            : "8px 11px",
        borderRadius: "999px",
        border: borderByVariant[variant] || borderByVariant.subtle,
        background:
          backgroundByVariant[variant] ||
          backgroundByVariant.subtle,
      }}
    >
      {content}
    </Box>
  );
}

export default MWStatPill;