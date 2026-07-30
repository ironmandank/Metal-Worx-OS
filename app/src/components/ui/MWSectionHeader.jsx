import {
  Badge,
  Box,
  Button,
  Group,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { IconChevronRight } from "@tabler/icons-react";

function MWSectionHeader({
  title,
  subtitle = "",
  icon: Icon = null,
  color = "red",
  count = null,
  countLabel = "",
  status = "",
  statusColor = "gray",
  actionLabel = "",
  actionIcon: ActionIcon = null,
  onAction = null,
  secondaryActionLabel = "",
  secondaryActionIcon: SecondaryActionIcon = null,
  onSecondaryAction = null,
  compact = false,
  divider = true,
  rightSection = null,
}) {
  const hasCount =
    count !== null &&
    count !== undefined &&
    count !== "";

  const hasPrimaryAction =
    Boolean(actionLabel) && typeof onAction === "function";

  const hasSecondaryAction =
    Boolean(secondaryActionLabel) &&
    typeof onSecondaryAction === "function";

  return (
    <Box
      pb={divider ? (compact ? "sm" : "md") : 0}
      style={{
        borderBottom: divider
          ? "1px solid rgba(255,255,255,0.08)"
          : "none",
      }}
    >
      <Group
        justify="space-between"
        align="flex-start"
        gap="lg"
        wrap="wrap"
      >
        <Group
          align="flex-start"
          gap={compact ? "sm" : "md"}
          wrap="nowrap"
          style={{ minWidth: 0 }}
        >
          {Icon && (
            <ThemeIcon
              color={color}
              variant="light"
              radius="md"
              size={compact ? 36 : 44}
              style={{
                flexShrink: 0,
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <Icon
                size={compact ? 19 : 23}
                stroke={2}
              />
            </ThemeIcon>
          )}

          <Stack gap={4} style={{ minWidth: 0 }}>
            <Group gap="sm" wrap="wrap">
              <Title
                order={compact ? 4 : 3}
                c="gray.0"
                style={{
                  lineHeight: 1.2,
                  letterSpacing: "-0.02em",
                  overflowWrap: "anywhere",
                }}
              >
                {title}
              </Title>

              {hasCount && (
                <Badge
                  color={color}
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
                  {count}
                  {countLabel ? ` ${countLabel}` : ""}
                </Badge>
              )}

              {status && (
                <Badge
                  color={statusColor}
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
                  {status}
                </Badge>
              )}
            </Group>

            {subtitle && (
              <Text
                size={compact ? "xs" : "sm"}
                c="gray.5"
                style={{
                  lineHeight: 1.45,
                  maxWidth: 760,
                }}
              >
                {subtitle}
              </Text>
            )}
          </Stack>
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
  );
}

export default MWSectionHeader;