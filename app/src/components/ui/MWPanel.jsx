import {
  Badge,
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

function MWPanel({
  title,
  subtitle = "",
  icon: Icon = null,
  color = "red",
  children = null,
  footer = null,
  badge = "",
  badgeColor = "gray",
  actionLabel = "",
  actionIcon: ActionIcon = null,
  onAction = null,
  secondaryActionLabel = "",
  secondaryActionIcon: SecondaryActionIcon = null,
  onSecondaryAction = null,
  rightSection = null,
  compact = false,
  highlight = false,
  withBorder = true,
  radius = "xl",
  padding = null,
  minHeight = null,
  fullHeight = false,
  headerAlign = "left",
}) {
  const hasHeader = Boolean(
    title ||
      subtitle ||
      Icon ||
      badge ||
      actionLabel ||
      secondaryActionLabel ||
      rightSection
  );

  const hasPrimaryAction =
    Boolean(actionLabel) &&
    typeof onAction === "function";

  const hasSecondaryAction =
    Boolean(secondaryActionLabel) &&
    typeof onSecondaryAction === "function";

  const resolvedPadding =
    padding || (compact ? "md" : "lg");

  return (
    <Card
      withBorder={withBorder}
      radius={radius}
      p={0}
      style={{
        position: "relative",
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
                var(--mantine-color-${color}-9) 18%,
                rgba(255,255,255,0.045)
              ),
              rgba(255,255,255,0.016)
            )`
          : "linear-gradient(145deg, rgba(255,255,255,0.045), rgba(255,255,255,0.014))",
        boxShadow: highlight
          ? "0 14px 34px rgba(0,0,0,0.22)"
          : "0 10px 28px rgba(0,0,0,0.14)",
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

      <Stack gap={0} h={fullHeight ? "100%" : undefined}>
        {hasHeader && (
          <>
            <Box px={resolvedPadding} py={resolvedPadding}>
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
                      textAlign: headerAlign,
                    }}
                  >
                    <Group
                      gap="sm"
                      wrap="wrap"
                      justify={
                        headerAlign === "center"
                          ? "center"
                          : "flex-start"
                      }
                    >
                      {title && (
                        <Title
                          order={compact ? 4 : 3}
                          c="gray.0"
                          style={{
                            lineHeight: 1.2,
                            letterSpacing: "-0.02em",
                            textAlign: headerAlign,
                            overflowWrap: "break-word",
                          }}
                        >
                          {title}
                        </Title>
                      )}

                      {badge && (
                        <Badge
                          color={badgeColor}
                          variant="light"
                          radius="sm"
                          size="md"
                          styles={{
                            root: {
                              border:
                                "1px solid rgba(255,255,255,0.08)",
                              fontWeight: 800,
                            },
                          }}
                        >
                          {badge}
                        </Badge>
                      )}
                    </Group>

                    {subtitle && (
                      <Text
                        size={compact ? "xs" : "sm"}
                        c="gray.5"
                        mt={title ? 5 : 0}
                        style={{
                          lineHeight: 1.45,
                          textAlign: headerAlign,
                          maxWidth: 760,
                        }}
                      >
                        {subtitle}
                      </Text>
                    )}
                  </Box>
                </Group>

                <Group gap="sm" wrap="wrap">
                  {rightSection}

                  {hasSecondaryAction && (
                    <Button
                      variant="default"
                      radius="md"
                      size={compact ? "xs" : "sm"}
                      leftSection={
                        SecondaryActionIcon ? (
                          <SecondaryActionIcon size={16} />
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
                          <IconChevronRight size={15} />
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
            flex: fullHeight ? 1 : undefined,
            minWidth: 0,
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
                backgroundColor: "rgba(0,0,0,0.12)",
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

export default MWPanel;