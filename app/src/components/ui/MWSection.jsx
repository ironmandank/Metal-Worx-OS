import {
  Box,
  Button,
  Card,
  Divider,
  Group,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { IconChevronRight } from "@tabler/icons-react";

function MWSection({
  title = "",
  subtitle = "",
  icon: Icon = null,
  color = "red",
  children = null,
  footer = null,
  rightSection = null,
  actionLabel = "",
  actionIcon: ActionIcon = null,
  onAction = null,
  secondaryActionLabel = "",
  secondaryActionIcon: SecondaryActionIcon = null,
  onSecondaryAction = null,
  compact = false,
  withBorder = true,
  radius = "xl",
  padding = null,
  background = "panel",
  highlight = false,
  fullHeight = false,
  minHeight = null,
  mb = null,
  mt = null,
}) {
  const hasHeader = Boolean(
    title ||
      subtitle ||
      Icon ||
      rightSection ||
      actionLabel ||
      secondaryActionLabel
  );

  const hasPrimaryAction =
    Boolean(actionLabel) &&
    typeof onAction === "function";

  const hasSecondaryAction =
    Boolean(secondaryActionLabel) &&
    typeof onSecondaryAction === "function";

  const resolvedPadding =
    padding || (compact ? "md" : "lg");

  const backgroundMap = {
    panel:
      "linear-gradient(145deg, rgba(255,255,255,0.045), rgba(255,255,255,0.014))",
    subtle: "rgba(255,255,255,0.022)",
    solid: "var(--mantine-color-dark-7)",
    transparent: "transparent",
  };

  const resolvedBackground =
    backgroundMap[background] ||
    backgroundMap.panel;

  return (
    <Card
      withBorder={withBorder}
      radius={radius}
      p={0}
      mt={mt}
      mb={mb}
      style={{
        position: "relative",
        width: "100%",
        height: fullHeight ? "100%" : "auto",
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
                var(--mantine-color-${color}-9) 16%,
                rgba(255,255,255,0.045)
              ),
              rgba(255,255,255,0.014)
            )`
          : resolvedBackground,
        boxShadow:
          background === "transparent"
            ? "none"
            : highlight
              ? "0 14px 34px rgba(0,0,0,0.2)"
              : "0 10px 28px rgba(0,0,0,0.12)",
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

      <Stack
        gap={0}
        h={fullHeight ? "100%" : undefined}
      >
        {hasHeader && (
          <>
            <Box
              px={resolvedPadding}
              py={resolvedPadding}
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

                  <Box
                    style={{
                      minWidth: 0,
                      flex: 1,
                      textAlign: "left",
                    }}
                  >
                    {title && (
                      <Title
                        order={compact ? 4 : 3}
                        c="gray.0"
                        style={{
                          lineHeight: 1.2,
                          letterSpacing: "-0.02em",
                          textAlign: "left",
                          overflowWrap: "break-word",
                        }}
                      >
                        {title}
                      </Title>
                    )}

                    {subtitle && (
                      <Text
                        size={compact ? "xs" : "sm"}
                        c="gray.5"
                        mt={title ? 5 : 0}
                        style={{
                          lineHeight: 1.45,
                          textAlign: "left",
                          maxWidth: 780,
                        }}
                      >
                        {subtitle}
                      </Text>
                    )}
                  </Box>
                </Group>

                <Group
                  gap="sm"
                  wrap="wrap"
                  style={{
                    flexShrink: 0,
                  }}
                >
                  {rightSection}

                  {hasSecondaryAction && (
                    <Button
                      variant="default"
                      radius="md"
                      size={compact ? "xs" : "sm"}
                      leftSection={
                        SecondaryActionIcon ? (
                          <SecondaryActionIcon
                            size={16}
                          />
                        ) : null
                      }
                      onClick={onSecondaryAction}
                      styles={{
                        root: {
                          borderColor:
                            "rgba(255,255,255,0.1)",
                          backgroundColor:
                            "rgba(255,255,255,0.04)",
                        },
                      }}
                    >
                      {secondaryActionLabel}
                    </Button>
                  )}

                  {hasPrimaryAction && (
                    <Button
                      color={color}
                      radius="md"
                      size={compact ? "xs" : "sm"}
                      leftSection={
                        ActionIcon ? (
                          <ActionIcon size={16} />
                        ) : null
                      }
                      rightSection={
                        !ActionIcon ? (
                          <IconChevronRight
                            size={15}
                          />
                        ) : null
                      }
                      onClick={onAction}
                    >
                      {actionLabel}
                    </Button>
                  )}
                </Group>
              </Group>
            </Box>

            <Divider color="rgba(255,255,255,0.08)" />
          </>
        )}

        <Box
          px={resolvedPadding}
          py={resolvedPadding}
          style={{
            minWidth: 0,
            flex: fullHeight ? 1 : undefined,
          }}
        >
          {children}
        </Box>

        {footer && (
          <>
            <Divider color="rgba(255,255,255,0.08)" />

            <Box
              px={resolvedPadding}
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

export default MWSection;