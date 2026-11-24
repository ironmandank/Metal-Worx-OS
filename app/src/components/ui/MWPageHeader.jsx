import { Button, Group, Stack, Text, Title } from "@mantine/core";

function MWPageHeader({
  title,
  subtitle,
  buttonText,
  onButtonClick,
  secondaryButtonText,
  onSecondaryButtonClick,
  setPage,
  showBack = false,
  backPage,
  backLabel = "Back",
  showDashboard = true,
  showActions = true,
}) {
  return (
    <div className="mw-page-header">
      <Stack gap={6}>
        {showActions && (
          <Group gap="xs">
            {showBack && setPage && backPage && (
              <Button
                size="xs"
                variant="subtle"
                color="gray"
                onClick={() => setPage(backPage)}
              >
                ← {backLabel}
              </Button>
            )}

            {showDashboard && setPage && (
              <Button
                size="xs"
                variant="subtle"
                color="red"
                onClick={() => setPage("dashboard")}
              >
                🏠 Dashboard
              </Button>
            )}
          </Group>
        )}

        <Title order={1}>{title}</Title>

        {subtitle && (
          <Text c="dimmed" size="sm">
            {subtitle}
          </Text>
        )}
      </Stack>

      {(buttonText && onButtonClick) || (secondaryButtonText && onSecondaryButtonClick) ? (
        <Group gap="xs" wrap="wrap" justify="flex-end">
          {secondaryButtonText && onSecondaryButtonClick && (
            <Button color="orange" variant="light" onClick={onSecondaryButtonClick}>
              {secondaryButtonText}
            </Button>
          )}
          {buttonText && onButtonClick && (
            <Button color="red" onClick={onButtonClick}>
              {buttonText}
            </Button>
          )}
        </Group>
      ) : null}
    </div>
  );
}

export default MWPageHeader;