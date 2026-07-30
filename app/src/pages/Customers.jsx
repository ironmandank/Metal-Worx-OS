import { useEffect, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Group,
  SimpleGrid,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import {
  IconMail,
  IconMapPin,
  IconPhone,
  IconSearch,
} from "@tabler/icons-react";

import { supabase } from "../lib/supabase";

import MWPageHeader from "../components/ui/MWPageHeader";
import MWSection from "../components/ui/MWSection";
import CustomerDrawer from "../components/customers/CustomerDrawer";

function Customers({ setPage, setSelectedCustomer }) {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [drawerOpened, setDrawerOpened] = useState(false);

  useEffect(() => {
    loadCustomers();
  }, []);

  async function loadCustomers() {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setCustomers(data || []);
  }

  const filteredCustomers = customers.filter((customer) => {
    const text = `
      ${customer.first_name || ""}
      ${customer.last_name || ""}
      ${customer.company_name || ""}
      ${customer.phone || ""}
      ${customer.email || ""}
    `.toLowerCase();

    return text.includes(search.toLowerCase());
  });

  return (
    <>
      <MWPageHeader
        title="Customers"
        subtitle="Manage customer records, order history, and shop activity."
        buttonText="+ New Customer"
        onButtonClick={() => setDrawerOpened(true)}
      />

      <MWSection
        title="Customer Hub"
        subtitle="Search and manage customer records."
      >
        <TextInput
          mb="lg"
          leftSection={<IconSearch size={16} />}
          placeholder="Search customers..."
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
        />

        {filteredCustomers.length === 0 ? (
          <Card withBorder radius="lg" p="xl">
            <Text c="dimmed">No customers found.</Text>
          </Card>
        ) : (
          <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }} spacing="lg">
            {filteredCustomers.map((customer) => (
              <Card
                key={customer.id}
                withBorder
                radius="lg"
                shadow="sm"
                p="lg"
              >
                <Group justify="space-between" mb="md">
                  <Badge color="red" variant="light">
                    {customer.customer_type || "Customer"}
                  </Badge>

                  <Badge
                    color={customer.is_active ? "green" : "gray"}
                    variant="filled"
                  >
                    {customer.is_active ? "Active" : "Inactive"}
                  </Badge>
                </Group>

                <Title order={3}>
                  {customer.company_name ||
                    `${customer.first_name || ""} ${
                      customer.last_name || ""
                    }`}
                </Title>

                <Text c="dimmed" mb="md">
                  {customer.first_name || customer.last_name
                    ? `${customer.first_name || ""} ${
                        customer.last_name || ""
                      }`
                    : "No contact name"}
                </Text>

                <Group gap="xs" mb="xs">
                  <IconPhone size={16} />
                  <Text size="sm">{customer.phone || "No phone"}</Text>
                </Group>

                <Group gap="xs" mb="xs">
                  <IconMail size={16} />
                  <Text size="sm">{customer.email || "No email"}</Text>
                </Group>

                <Group gap="xs" mb="lg">
                  <IconMapPin size={16} />
                  <Text size="sm">
                    {customer.city || "No city"}
                    {customer.state ? `, ${customer.state}` : ""}
                  </Text>
                </Group>

                <Group grow>
                  <Button
                    color="red"
                    onClick={() => {
                      setSelectedCustomer(customer);
                      setPage("orderBuilder");
                    }}
                  >
                    New Order
                  </Button>

                  <Button
                    variant="light"
                    onClick={() => {
                      setSelectedCustomer(customer);
                      setPage("customerDetails");
                    }}
                  >
                    View
                  </Button>

                  <Button variant="subtle">
                    Edit
                  </Button>
                </Group>
              </Card>
            ))}
          </SimpleGrid>
        )}
      </MWSection>

      <CustomerDrawer
        opened={drawerOpened}
        onClose={() => setDrawerOpened(false)}
        onCustomerSaved={loadCustomers}
      />
    </>
  );
}

export default Customers;