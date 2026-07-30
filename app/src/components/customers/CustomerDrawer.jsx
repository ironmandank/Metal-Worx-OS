import { useState } from "react";
import {
  Button,
  Drawer,
  Group,
  Select,
  Stack,
  Textarea,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { supabase } from "../../lib/supabase";

function CustomerDrawer({ opened, onClose, onCustomerSaved }) {
  const [formData, setFormData] = useState({
    company_name: "",
    customer_type: "Customer",
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    preferred_contact: "",
    notes: "",
    is_active: true,
  });

  function handleChange(field, value) {
    setFormData({
      ...formData,
      [field]: value,
    });
  }

  async function saveCustomer() {
    const { error } = await supabase.from("customers").insert([formData]);

    if (error) {
      notifications.show({
        title: "Error",
        message: error.message,
        color: "red",
      });
      return;
    }

    notifications.show({
      title: "Customer Saved",
      message: "Customer created successfully.",
      color: "green",
    });

    onCustomerSaved();
    onClose();
  }

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title="New Customer"
      position="right"
      size="lg"
    >
      <Stack>
        <TextInput
          label="Company Name"
          value={formData.company_name}
          onChange={(event) =>
            handleChange("company_name", event.currentTarget.value)
          }
        />

        <Select
          label="Customer Type"
          data={["Customer", "Military", "Business", "Government", "Residential"]}
          value={formData.customer_type}
          onChange={(value) => handleChange("customer_type", value)}
        />

        <Group grow>
          <TextInput
            label="First Name"
            value={formData.first_name}
            onChange={(event) =>
              handleChange("first_name", event.currentTarget.value)
            }
          />

          <TextInput
            label="Last Name"
            value={formData.last_name}
            onChange={(event) =>
              handleChange("last_name", event.currentTarget.value)
            }
          />
        </Group>

        <Group grow>
          <TextInput
            label="Phone"
            value={formData.phone}
            onChange={(event) =>
              handleChange("phone", event.currentTarget.value)
            }
          />

          <TextInput
            label="Email"
            value={formData.email}
            onChange={(event) =>
              handleChange("email", event.currentTarget.value)
            }
          />
        </Group>

        <TextInput
          label="Address"
          value={formData.address}
          onChange={(event) =>
            handleChange("address", event.currentTarget.value)
          }
        />

        <Group grow>
          <TextInput
            label="City"
            value={formData.city}
            onChange={(event) =>
              handleChange("city", event.currentTarget.value)
            }
          />

          <TextInput
            label="State"
            value={formData.state}
            onChange={(event) =>
              handleChange("state", event.currentTarget.value)
            }
          />

          <TextInput
            label="ZIP"
            value={formData.zip}
            onChange={(event) =>
              handleChange("zip", event.currentTarget.value)
            }
          />
        </Group>

        <Select
          label="Preferred Contact"
          data={["Phone", "Email", "Text"]}
          value={formData.preferred_contact}
          onChange={(value) => handleChange("preferred_contact", value)}
          clearable
        />

        <Textarea
          label="Notes"
          minRows={4}
          value={formData.notes}
          onChange={(event) =>
            handleChange("notes", event.currentTarget.value)
          }
        />

        <Group justify="flex-end" mt="md">
          <Button variant="light" color="gray" onClick={onClose}>
            Cancel
          </Button>

          <Button color="red" onClick={saveCustomer}>
            Save Customer
          </Button>
        </Group>
      </Stack>
    </Drawer>
  );
}

export default CustomerDrawer;