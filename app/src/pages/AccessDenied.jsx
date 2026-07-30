import { Alert, Button, Card, Group, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { IconArrowLeft, IconLock, IconShieldX } from "@tabler/icons-react";

function AccessDenied({ accessLevel, requestedPage, setPage }) {
  return (
    <Stack gap="xl">
      <Card
        withBorder
        radius="xl"
        p={{ base: "xl", sm: 42 }}
        style={{
          background:
            "linear-gradient(145deg, rgba(105, 0, 0, 0.28), rgba(13, 17, 21, 0.98) 52%)",
          borderColor: "rgba(220, 38, 38, 0.48)",
        }}
      >
        <Stack align="center" gap="lg" ta="center">
          <ThemeIcon color="red" variant="light" size={76} radius="xl">
            <IconShieldX size={40} />
          </ThemeIcon>

          <div>
            <Text size="xs" fw={900} c="red.4" style={{ letterSpacing: "0.16em" }}>
              METAL WORX ACCESS CONTROL
            </Text>
            <Title order={1} mt={6}>Access Restricted</Title>
            <Text c="dimmed" mt="sm" maw={620}>
              Your {accessLevel || "employee"} account does not have permission
              to open this area of Metal Worx OS.
            </Text>
          </div>

          <Alert color="gray" icon={<IconLock size={18} />} w="100%" maw={620}>
            Requested area: <strong>{requestedPage}</strong>. Contact a Metal Worx
            Administrator if your job responsibilities require access.
          </Alert>

          <Group>
            <Button
              color="red"
              leftSection={<IconArrowLeft size={18} />}
              onClick={() => setPage("dashboard")}
            >
              Return to Mission Control
            </Button>
          </Group>
        </Stack>
      </Card>
    </Stack>
  );
}

export default AccessDenied;