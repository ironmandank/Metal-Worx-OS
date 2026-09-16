import { Badge, Card, Group, SimpleGrid, Stack, Text, ThemeIcon } from "@mantine/core";
import { IconCalendarEvent, IconFileSpreadsheet, IconLayoutDashboard, IconPackage } from "@tabler/icons-react";

const AREAS = [
  { page: "projects", label: "Command Center", description: "All projects by stage", step: "Overview", icon: IconLayoutDashboard, color: "red" },
  { page: "quoteCenter", label: "Estimates & Approvals", description: "Site visits, quotes, signatures", step: "1", icon: IconFileSpreadsheet, color: "violet" },
  { page: "procurement", label: "Materials", description: "Price, order, and receive", step: "2", icon: IconPackage, color: "orange" },
  { page: "fieldSchedule", label: "Field Schedule", description: "Visits, test fits, installs", step: "3", icon: IconCalendarEvent, color: "blue" },
];

export default function OutsideWorkspaceNav({ current, setPage }) {
  return (
    <Card withBorder radius="lg" p="sm">
      <Group justify="space-between" mb="sm" px={4}>
        <div>
          <Text fw={900}>Outside Operations</Text>
          <Text size="xs" c="dimmed">Estimate → approve → prepare → complete field work</Text>
        </div>
        <Badge color="red" variant="light">One connected workflow</Badge>
      </Group>
      <SimpleGrid cols={{ base: 1, sm: 2, xl: 4 }} spacing="xs">
        {AREAS.map((area) => {
          const active = current === area.page;
          const Icon = area.icon;
          return (
            <Card
              key={area.page}
              component="button"
              type="button"
              withBorder
              radius="md"
              p="sm"
              onClick={() => setPage(area.page)}
              style={{
                cursor: "pointer",
                textAlign: "left",
                minHeight: 94,
                borderColor: active ? `var(--mantine-color-${area.color}-6)` : undefined,
                background: active ? `color-mix(in srgb, var(--mantine-color-${area.color}-9) 32%, transparent)` : "rgba(255,255,255,.018)",
              }}
            >
              <Group wrap="nowrap" gap="sm" align="flex-start">
                <ThemeIcon color={area.color} variant={active ? "filled" : "light"} radius="md"><Icon size={18} /></ThemeIcon>
                <Stack gap={3} style={{ minWidth: 0, flex: 1 }}>
                  <Group gap={6} wrap="wrap" align="center">
                    <Badge size="xs" color={area.color} variant="light">{area.step}</Badge>
                    <Text size="sm" fw={900} lh={1.2} style={{ whiteSpace: "normal", overflowWrap: "anywhere" }}>{area.label}</Text>
                  </Group>
                  <Text size="xs" c="dimmed" lh={1.25} style={{ whiteSpace: "normal", overflowWrap: "anywhere" }}>{area.description}</Text>
                </Stack>
              </Group>
            </Card>
          );
        })}
      </SimpleGrid>
    </Card>
  );
}
