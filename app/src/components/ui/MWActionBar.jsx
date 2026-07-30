import {
  Button,
  Card,
  Group,
  ScrollArea,
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
      <ScrollArea
        type="auto"
        scrollbarSize={6}
      >
        <Group
          gap="sm"
          wrap="nowrap"
          style={{
            minWidth: "max-content",
          }}
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
                  minWidth:
                    action.minWidth ||
                    145,
                  height:
                    compact
                      ? 38
                      : 42,
                  fontWeight: 700,
                }}
              >
                {action.label}
              </Button>
            )
          )}
        </Group>
      </ScrollArea>
    </Card>
  );
}

export default MWActionBar;