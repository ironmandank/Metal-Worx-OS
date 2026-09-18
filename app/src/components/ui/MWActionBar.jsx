import {
  Button,
  Card,
  Group,
} from "@mantine/core";

function MWActionBar({
  actions = [],
  compact = false,
}) {
  const visibleActions = actions.filter(
    (action) => action && action.visible !== false
  );

  if (visibleActions.length === 0) {
    return null;
  }

  return (
    <Card
      withBorder
      radius="lg"
      p={compact ? "xs" : "sm"}
      style={{
        background:
          "var(--mantine-color-dark-7)",
      }}
    >
      <Group
        gap="sm"
        wrap="wrap"
        align="stretch"
      >
          {visibleActions.map(
            (action, index) => (
              <Button
                key={
                  action.key ||
                  action.label ||
                  index
                }
                color={
                  action.color || "gray"
                }
                variant={
                  action.variant ||
                  "light"
                }
                size={
                  compact
                    ? "sm"
                    : "md"
                }
                leftSection={
                  action.icon || null
                }
                loading={
                  Boolean(
                    action.loading
                  )
                }
                disabled={
                  Boolean(
                    action.disabled
                  )
                }
                onClick={
                  action.onClick
                }
                style={{
                  flex: "1 1 170px",
                  minWidth: Math.min(action.minWidth || 145, 170),
                  height: "auto",
                  minHeight: compact ? 38 : 42,
                  paddingTop: 8,
                  paddingBottom: 8,
                  fontWeight: 700,
                }}
                styles={{
                  label: {
                    whiteSpace: "normal",
                    textAlign: "center",
                    lineHeight: 1.15,
                  },
                }}
              >
                {action.label}
              </Button>
            )
          )}
      </Group>
    </Card>
  );
}

export default MWActionBar;
