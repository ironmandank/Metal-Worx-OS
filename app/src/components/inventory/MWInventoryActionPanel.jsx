import {
  Box,
  Button,
  Group,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
} from "@mantine/core";
import { IconChevronRight } from "@tabler/icons-react";

import MWPanel from "../ui/MWPanel";

function InventoryActionButton({
  label,
  description = "",
  icon: Icon,
  color = "red",
  onClick = null,
  disabled = false,
}) {
  return (
    <Button
      variant="light"
      color={color}
      radius="lg"
      h="auto"
      px="md"
      py="md"
      disabled={disabled}
      onClick={onClick}
      styles={{
        root: {
          width: "100%",
          minHeight: 88,
          justifyContent: "flex-start",
          border: "1px solid rgba(255,255,255,0.08)",
          background:
            "linear-gradient(145deg, rgba(255,255,255,0.045), rgba(255,255,255,0.018))",
          boxShadow: "0 6px 18px rgba(0,0,0,0.1)",
        },

        inner: {
          width: "100%",
        },

        label: {
          width: "100%",
          whiteSpace: "normal",
          overflow: "visible",
        },
      }}
    >
      <Group
        justify="space-between"
        align="center"
        gap="md"
        wrap="nowrap"
        w="100%"
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
          <ThemeIcon
            size={42}
            radius="md"
            color={color}
            variant="light"
            style={{
              flexShrink: 0,
              border:
                "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <Icon size={21} stroke={2} />
          </ThemeIcon>

          <Box
            style={{
              minWidth: 0,
              flex: 1,
              textAlign: "left",
            }}
          >
            <Text
              fw={850}
              size="sm"
              c="gray.0"
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
        </Group>

        <IconChevronRight
          size={17}
          color="var(--mantine-color-gray-5)"
          style={{
            flexShrink: 0,
          }}
        />
      </Group>
    </Button>
  );
}

function MWInventoryActionPanel({
  title = "Quick Actions",
  subtitle = "Common inventory tasks and shop-floor workflows.",
  icon = null,
  color = "red",
  actions = [],
  compact = false,
}) {
  const safeActions = Array.isArray(actions)
    ? actions.filter(Boolean)
    : [];

  return (
    <MWPanel
      title={title}
      subtitle={subtitle}
      icon={icon}
      color={color}
      compact={compact}
      fullHeight
    >
      {safeActions.length === 0 ? (
        <Stack
          align="center"
          justify="center"
          mih={180}
          gap="sm"
        >
          <Text fw={800} c="gray.3">
            No actions configured
          </Text>

          <Text
            size="sm"
            c="gray.5"
            ta="center"
          >
            Add inventory actions to this panel.
          </Text>
        </Stack>
      ) : (
        <SimpleGrid
          cols={{
            base: 1,
            sm: 2,
          }}
          spacing="sm"
        >
          {safeActions.map((action, index) => (
            <InventoryActionButton
              key={
                action.key ||
                action.label ||
                `inventory-action-${index}`
              }
              label={action.label}
              description={action.description}
              icon={action.icon}
              color={action.color || color}
              onClick={action.onClick}
              disabled={action.disabled}
            />
          ))}
        </SimpleGrid>
      )}
    </MWPanel>
  );
}

export default MWInventoryActionPanel;