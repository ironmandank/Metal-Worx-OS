import {
  Alert,
  Button,
  Card,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import {
  IconAlertTriangle,
  IconCalendar,
  IconCheck,
  IconDeviceFloppy,
  IconFileDescription,
  IconPackage,
  IconPhoto,
  IconTool,
  IconUser,
} from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";

import MWPageHeader from "../components/ui/MWPageHeader";
import MWPanel from "../components/ui/MWPanel";
import { supabase } from "../lib/supabase";

const CATEGORY_OPTIONS = [
  "Flag",
  "Custom Art",
  "Hand Rail",
  "Gate",
  "Repair",
  "Powder Coat",
  "Laser Cutting",
];

const STARTING_STATIONS = {
  Flag: "Needs Design",
  "Custom Art": "Needs Design",
  "Hand Rail": "Needs Estimate",
  Gate: "Needs Estimate",
  Repair: "Needs Estimate",
  "Powder Coat": "Ready for Production",
  "Laser Cutting": "Ready for Production",
};

const FINISH_OPTIONS = [
  "Paint",
  "Powder Coat",
  "Patina",
  "Raw Steel",
  "Clear Coat",
  "Customer Finish",
];

function toDateInputValue(value) {
  if (!value) return null;
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toDateString(value) {
  if (!value) return null;
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayString() {
  return toDateString(new Date());
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isValidImageUrl(value) {
  if (!value) return true;

  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

function NewJob({ setPage, activeUser = "" }) {
  const [formData, setFormData] = useState({
    customer_name: "",
    job_name: "",
    category: "Flag",
    priority: "Normal",
    date_ordered: todayString(),
    due_date: "",
    quantity: 1,
    finish_type: "",
    paint_colors: "",
    assigned_to: "",
    reference_image: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);

  useEffect(() => {
    function warnBeforeLeaving(event) {
      if (!dirty || saving) return;
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [dirty, saving]);

  const startingStation =
    STARTING_STATIONS[formData.category] || "Ready for Production";

  const dueDateWarning = useMemo(() => {
    if (!formData.date_ordered || !formData.due_date) return "";

    const ordered = new Date(`${formData.date_ordered}T12:00:00`);
    const due = new Date(`${formData.due_date}T12:00:00`);

    return due < ordered
      ? "Due Date cannot be earlier than Date Ordered."
      : "";
  }, [formData.date_ordered, formData.due_date]);

  function updateField(field, value) {
    setDirty(true);
    setValidationErrors([]);
    setFormData((current) => ({ ...current, [field]: value }));
  }

  function validateForm() {
    const errors = [];

    if (!cleanText(formData.customer_name)) {
      errors.push("Person Who Ordered is required.");
    }
    if (!cleanText(formData.job_name)) {
      errors.push("Item Ordered is required.");
    }
    if (!cleanText(formData.category)) {
      errors.push("Category is required.");
    }
    if (!formData.date_ordered) {
      errors.push("Date Ordered is required.");
    }
    if (!formData.due_date) {
      errors.push("Due Date is required.");
    }
    if (dueDateWarning) errors.push(dueDateWarning);
    if (Number(formData.quantity || 0) < 1) {
      errors.push("Quantity must be at least 1.");
    }
    if (!isValidImageUrl(cleanText(formData.reference_image))) {
      errors.push("Reference Image must be a valid http or https address.");
    }

    return errors;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;

    const errors = validateForm();
    if (errors.length) {
      setValidationErrors(errors);
      notifications.show({
        title: "Job Needs Attention",
        message: "Complete the required job information before saving.",
        color: "orange",
      });
      return;
    }

    setSaving(true);

    try {
      const payload = {
        customer_name: cleanText(formData.customer_name),
        job_name: cleanText(formData.job_name),
        category: cleanText(formData.category),
        priority: cleanText(formData.priority) || "Normal",
        date_ordered: formData.date_ordered,
        due_date: formData.due_date,
        quantity: Math.max(1, Number(formData.quantity || 1)),
        finish_type: cleanText(formData.finish_type),
        paint_colors: cleanText(formData.paint_colors),
        assigned_to: cleanText(formData.assigned_to),
        reference_image: cleanText(formData.reference_image),
        notes: cleanText(formData.notes),
        current_station: startingStation,
        status: "In Progress",
        is_complete: false,
      };

      const { data: duplicates, error: duplicateError } = await supabase
        .from("jobs")
        .select("id")
        .ilike("customer_name", payload.customer_name)
        .ilike("job_name", payload.job_name)
        .eq("due_date", payload.due_date)
        .limit(1);

      if (duplicateError) throw duplicateError;
      if ((duplicates || []).length) {
        throw new Error(
          "A job for this person, item, and due date already exists."
        );
      }

      const { data: savedJob, error: jobError } = await supabase
        .from("jobs")
        .insert([payload])
        .select("*")
        .single();

      if (jobError) throw jobError;

      const { error: historyError } = await supabase
        .from("job_history")
        .insert([
          {
            job_id: savedJob.id,
            moved_by: activeUser || "Metal Worx Team",
            notes: `Job created in ${startingStation}`,
          },
        ]);

      if (historyError) {
        const { error: rollbackError } = await supabase
          .from("jobs")
          .delete()
          .eq("id", savedJob.id);

        if (rollbackError) {
          throw new Error(
            `${historyError.message}. The job was created, but its opening history failed; management review is required.`
          );
        }

        throw historyError;
      }

      setDirty(false);
      notifications.show({
        title: "Production Job Created",
        message: `${payload.customer_name} — ${payload.job_name} is now in ${startingStation}.`,
        color: "green",
        icon: <IconCheck size={18} />,
      });
      setPage("productionBoard");
    } catch (error) {
      notifications.show({
        title: "Job Could Not Be Created",
        message: error.message,
        color: "red",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Stack gap="xl">
      <MWPageHeader
        title="New Production Job"
        subtitle="Create a Metal Worx job using standardized customer, item, schedule, and production information."
        buttonText="Production Board"
        onButtonClick={() => setPage("productionBoard")}
        setPage={setPage}
      />

      {validationErrors.length > 0 && (
        <Alert
          color="orange"
          icon={<IconAlertTriangle size={19} />}
          title="Complete the Required Job Information"
        >
          <Stack gap={4}>
            {validationErrors.map((error) => (
              <Text size="sm" key={error}>
                • {error}
              </Text>
            ))}
          </Stack>
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Stack gap="lg">
          <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
            <MWPanel
              title="Customer & Item"
              subtitle="Who placed the order and what Metal Worx is producing"
              icon={IconUser}
            >
              <Stack gap="md">
                <TextInput
                  label="Person Who Ordered"
                  placeholder="John Smith"
                  leftSection={<IconUser size={17} />}
                  value={formData.customer_name}
                  onChange={(event) =>
                    updateField("customer_name", event.currentTarget.value)
                  }
                  required
                  maxLength={150}
                />
                <TextInput
                  label="Item Ordered"
                  placeholder='24" Army Retirement Flag'
                  leftSection={<IconPackage size={17} />}
                  value={formData.job_name}
                  onChange={(event) =>
                    updateField("job_name", event.currentTarget.value)
                  }
                  required
                  maxLength={200}
                />
                <Select
                  label="Category"
                  data={CATEGORY_OPTIONS}
                  value={formData.category}
                  onChange={(value) => updateField("category", value || "Flag")}
                  allowDeselect={false}
                  searchable
                  required
                />
                <Card withBorder radius="md" p="md">
                  <Text size="xs" fw={850} c="dimmed" tt="uppercase">
                    Starting Station
                  </Text>
                  <Text fw={850} c="red.4" mt={4}>
                    {startingStation}
                  </Text>
                  <Text size="xs" c="dimmed" mt={4}>
                    Automatically selected from the job category
                  </Text>
                </Card>
              </Stack>
            </MWPanel>

            <MWPanel
              title="Schedule & Assignment"
              subtitle="Priority, required completion, and ownership"
              icon={IconCalendar}
            >
              <Stack gap="md">
                <Group grow align="flex-start">
                  <DateInput
                    label="Date Ordered"
                    value={toDateInputValue(formData.date_ordered)}
                    onChange={(value) =>
                      updateField("date_ordered", toDateString(value))
                    }
                    valueFormat="MMM D, YYYY"
                    required
                    clearable={false}
                  />
                  <DateInput
                    label="Due Date"
                    value={toDateInputValue(formData.due_date)}
                    onChange={(value) =>
                      updateField("due_date", toDateString(value))
                    }
                    valueFormat="MMM D, YYYY"
                    minDate={toDateInputValue(formData.date_ordered)}
                    required
                    error={dueDateWarning || undefined}
                  />
                </Group>

                <Group grow align="flex-start">
                  <Select
                    label="Priority"
                    data={["Normal", "High", "Rush", "Emergency"]}
                    value={formData.priority}
                    onChange={(value) =>
                      updateField("priority", value || "Normal")
                    }
                    allowDeselect={false}
                  />
                  <NumberInput
                    label="Quantity"
                    value={formData.quantity}
                    onChange={(value) => updateField("quantity", value)}
                    min={1}
                    allowDecimal={false}
                    required
                  />
                </Group>

                <TextInput
                  label="Assigned To"
                  placeholder="Employee or team"
                  value={formData.assigned_to}
                  onChange={(event) =>
                    updateField("assigned_to", event.currentTarget.value)
                  }
                />
              </Stack>
            </MWPanel>

            <MWPanel
              title="Finish Requirements"
              subtitle="How the finished job should be prepared"
              icon={IconTool}
            >
              <Stack gap="md">
                <Select
                  label="Finish Type"
                  placeholder="Select finish type"
                  data={FINISH_OPTIONS}
                  value={formData.finish_type || null}
                  onChange={(value) => updateField("finish_type", value || "")}
                  clearable
                />
                <TextInput
                  label="Paint / Powder Colors"
                  placeholder="Flat black, candy red, white stars"
                  value={formData.paint_colors}
                  onChange={(event) =>
                    updateField("paint_colors", event.currentTarget.value)
                  }
                />
                <Textarea
                  label="Production Notes"
                  placeholder="Special instructions, plaque wording, customer notes, or production requirements"
                  minRows={5}
                  value={formData.notes}
                  onChange={(event) =>
                    updateField("notes", event.currentTarget.value)
                  }
                />
              </Stack>
            </MWPanel>

            <MWPanel
              title="Reference Information"
              subtitle="Optional image link for the production traveler"
              icon={IconPhoto}
            >
              <Stack gap="md">
                <TextInput
                  label="Reference Image URL"
                  placeholder="https://..."
                  leftSection={<IconPhoto size={17} />}
                  value={formData.reference_image}
                  onChange={(event) =>
                    updateField("reference_image", event.currentTarget.value)
                  }
                />
                <Alert color="blue" icon={<IconFileDescription size={18} />}>
                  This legacy job form accepts an image URL. Customer orders and
                  inventory items use the full Metal Worx image-upload system.
                </Alert>
                <Card withBorder radius="md" p="md">
                  <Stack gap="xs">
                    <Text size="xs" fw={850} c="dimmed" tt="uppercase">
                      Job Display Name
                    </Text>
                    <Text fw={850}>
                      {cleanText(formData.customer_name) ||
                        "Person Who Ordered"}{" "}
                      — {cleanText(formData.job_name) || "Item Ordered"}
                    </Text>
                  </Stack>
                </Card>
              </Stack>
            </MWPanel>
          </SimpleGrid>

          <Group justify="space-between" wrap="wrap">
            <Text size="sm" c="dimmed">
              {dirty ? "Unsaved job information" : "No unsaved changes"}
            </Text>
            <Group>
              <Button
                type="button"
                variant="light"
                color="gray"
                disabled={saving}
                onClick={() => setPage("productionBoard")}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                color="red"
                loading={saving}
                leftSection={<IconDeviceFloppy size={18} />}
              >
                Create Production Job
              </Button>
            </Group>
          </Group>
        </Stack>
      </form>
    </Stack>
  );
}

export default NewJob;