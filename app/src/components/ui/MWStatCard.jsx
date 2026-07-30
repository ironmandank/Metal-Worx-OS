import { Card, Group, Text, Title, ThemeIcon } from "@mantine/core";

function MWStatCard({
  title,
  value,
  subtitle,
  icon,
  color = "red",
  onClick,
}) {
  return (
    <Card
      shadow="md"
      radius="lg"
      padding="lg"
      withBorder
      style={{
        cursor: onClick ? "pointer" : "default",
        transition: "all .2s ease",
        height: "100%",
      }}
      onClick={onClick}
    >
      <Group justify="space-between" mb="md">
        <Text fw={700} c="dimmed" tt="uppercase" size="sm">
          {title}
        </Text>

        {icon && (
          <ThemeIcon color={color} variant="light" radius="xl" size="lg">
            {icon}
          </ThemeIcon>
        )}
      </Group>

      <Title order={1}>{value}</Title>

      <Text mt="sm" size="sm" c="dimmed">
        {subtitle}
      </Text>
    </Card>
  );
}

export default MWStatCard;