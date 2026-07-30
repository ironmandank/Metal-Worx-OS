import {
  Badge,
  Button,
  Card,
  Group,
  SimpleGrid,
  Tabs,
  Text,
  Title,
} from "@mantine/core";
import {
  IconClipboardList,
  IconFile,
  IconMessage,
  IconNotes,
  IconPhoto,
  IconTimeline,
} from "@tabler/icons-react";

import MWPageHeader from "../components/ui/MWPageHeader";
import MWSection from "../components/ui/MWSection";

function CustomerDetails({ selectedCustomer, setPage }) {
  if (!selectedCustomer) {
    return (
      <>
        <MWPageHeader
          title="Customer Details"
          subtitle="No customer selected."
        />

        <Button color="red" onClick={() => setPage("customers")}>
          Back to Customers
        </Button>
      </>
    );
  }

  const customerName =
    selectedCustomer.company_name ||
    `${selectedCustomer.first_name || ""} ${selectedCustomer.last_name || ""}`;

  return (
    <>
      <MWPageHeader
        title={customerName}
        subtitle="Customer profile, orders, files, messages, and activity."
        buttonText="+ New Order"
        onButtonClick={() => setPage("orderBuilder")}
      />

      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg" mb="lg">
        <Card withBorder radius="lg" p="lg">
          <Text c="dimmed" size="sm">
            Contact
          </Text>
          <Title order={4} mt="xs">
            {selectedCustomer.first_name || ""} {selectedCustomer.last_name || ""}
          </Title>
          <Text mt="sm">{selectedCustomer.phone || "No phone"}</Text>
          <Text>{selectedCustomer.email || "No email"}</Text>
        </Card>

        <Card withBorder radius="lg" p="lg">
          <Text c="dimmed" size="sm">
            Customer Type
          </Text>
          <Title order={4} mt="xs">
            {selectedCustomer.customer_type || "Customer"}
          </Title>
          <Badge mt="sm" color={selectedCustomer.is_active ? "green" : "gray"}>
            {selectedCustomer.is_active ? "Active" : "Inactive"}
          </Badge>
        </Card>

        <Card withBorder radius="lg" p="lg">
          <Text c="dimmed" size="sm">
            Location
          </Text>
          <Title order={4} mt="xs">
            {selectedCustomer.city || "No city"}
          </Title>
          <Text>{selectedCustomer.state || ""}</Text>
        </Card>
      </SimpleGrid>

      <MWSection title="Customer Workspace">
        <Tabs defaultValue="orders">
          <Tabs.List>
            <Tabs.Tab value="orders" leftSection={<IconClipboardList size={16} />}>
              Orders
            </Tabs.Tab>
            <Tabs.Tab value="files" leftSection={<IconFile size={16} />}>
              Files
            </Tabs.Tab>
            <Tabs.Tab value="photos" leftSection={<IconPhoto size={16} />}>
              Photos
            </Tabs.Tab>
            <Tabs.Tab value="messages" leftSection={<IconMessage size={16} />}>
              Messages
            </Tabs.Tab>
            <Tabs.Tab value="notes" leftSection={<IconNotes size={16} />}>
              Notes
            </Tabs.Tab>
            <Tabs.Tab value="timeline" leftSection={<IconTimeline size={16} />}>
              Timeline
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="orders" pt="lg">
            <Text c="dimmed">Customer order history will appear here.</Text>
          </Tabs.Panel>

          <Tabs.Panel value="files" pt="lg">
            <Text c="dimmed">Customer files will appear here.</Text>
          </Tabs.Panel>

          <Tabs.Panel value="photos" pt="lg">
            <Text c="dimmed">Reference photos and completed job photos will appear here.</Text>
          </Tabs.Panel>

          <Tabs.Panel value="messages" pt="lg">
            <Text c="dimmed">Customer-related messages will appear here.</Text>
          </Tabs.Panel>

          <Tabs.Panel value="notes" pt="lg">
            <Text c="dimmed">{selectedCustomer.notes || "No notes yet."}</Text>
          </Tabs.Panel>

          <Tabs.Panel value="timeline" pt="lg">
            <Text c="dimmed">Customer activity timeline will appear here.</Text>
          </Tabs.Panel>
        </Tabs>
      </MWSection>

      <Group mt="lg">
        <Button variant="light" color="gray" onClick={() => setPage("customers")}>
          Back to Customers
        </Button>
      </Group>
    </>
  );
}

export default CustomerDetails;