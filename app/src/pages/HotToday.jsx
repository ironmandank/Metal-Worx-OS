import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Divider,
  Grid,
  Group,
  Loader,
  Modal,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Title,
  Tooltip,
} from "@mantine/core";
import {
  IconAlertTriangle,
  IconBolt,
  IconCheck,
  IconClock,
  IconEdit,
  IconFlame,
  IconRefresh,
  IconTrash,
  IconUser,
} from "@tabler/icons-react";

import { supabase } from "../lib/supabase";
import {
  HOT_TODAY_MATERIALS_STATUSES,
  HOT_TODAY_PRIORITIES,
  HOT_TODAY_SOURCE_TYPES,
  completeHotTodayItem,
  createHotTodayItem,
  expireHotTodayItems,
  getHotTodayMaterialsColor,
  getHotTodayPriorityColor,
  getHotTodaySourceLabel,
  getTodaysHotTodayItems,
  removeHotTodayItem,
  subscribeToHotTodayChanges,
  updateHotTodayItem,
} from "../services/hotTodayService";

const DEPARTMENT_OPTIONS = [
  "Office",
  "Design",
  "Laser",
  "Prep",
  "Welding",
  "Paint",
  "Powder",
  "Assembly",
  "QC",
  "Showroom",
  "Field / Installation",
];

const PRIORITY_OPTIONS = [
  {
    value: HOT_TODAY_PRIORITIES.CRITICAL,
    label: "Critical — Must move immediately",
  },
  {
    value: HOT_TODAY_PRIORITIES.HIGH,
    label: "High — Priority for today",
  },
  {
    value: HOT_TODAY_PRIORITIES.NORMAL,
    label: "Normal — Keep visible today",
  },
];

const MATERIALS_OPTIONS = [
  {
    value: HOT_TODAY_MATERIALS_STATUSES.READY,
    label: "Ready",
  },
  {
    value: HOT_TODAY_MATERIALS_STATUSES.PARTIAL,
    label: "Partially Ready",
  },
  {
    value: HOT_TODAY_MATERIALS_STATUSES.WAITING,
    label: "Waiting on Materials",
  },
  {
    value: HOT_TODAY_MATERIALS_STATUSES.SHORTAGE,
    label: "Material Shortage",
  },
  {
    value: HOT_TODAY_MATERIALS_STATUSES.NOT_REQUIRED,
    label: "Materials Not Required",
  },
  {
    value: HOT_TODAY_MATERIALS_STATUSES.UNKNOWN,
    label: "Not Confirmed",
  },
];

const SOURCE_OPTIONS = [
  {
    value: HOT_TODAY_SOURCE_TYPES.PROJECT,
    label: "Project",
  },
  {
    value: HOT_TODAY_SOURCE_TYPES.CUSTOMER_ORDER,
    label: "Customer Order",
  },
  {
    value: HOT_TODAY_SOURCE_TYPES.PRODUCTION_JOB,
    label: "Production Job",
  },
];

const EMPTY_FORM = {
  sourceType: HOT_TODAY_SOURCE_TYPES.PROJECT,
  sourceId: "",
  title: "",
  customerName: "",
  assignedTo: "",
  assignedToName: "",
  department: "",
  reason: "",
  priority: HOT_TODAY_PRIORITIES.HIGH,
  notes: "",
  dueAt: "",
  materialsStatus: HOT_TODAY_MATERIALS_STATUSES.UNKNOWN,
  blocker: "",
};

function firstValue(record, keys, fallback = "") {
  for (const key of keys) {
    const value = record?.[key];

    if (value !== null && value !== undefined && String(value).trim() !== "") {
      return value;
    }
  }

  return fallback;
}

function formatDateTimeForInput(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const pad = (number) => String(number).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDueTime(value) {
  if (!value) {
    return "No due time";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "No due time";
  }

  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatHoursRemaining(hours) {
  if (hours === null || hours === undefined) {
    return "No deadline";
  }

  const numericHours = Number(hours);

  if (numericHours < 0) {
    return `${Math.abs(numericHours).toFixed(1)} hrs overdue`;
  }

  if (numericHours < 1) {
    return `${Math.max(0, Math.round(numericHours * 60))} min remaining`;
  }

  return `${numericHours.toFixed(1)} hrs remaining`;
}

function formatMaterialsLabel(status) {
  const labels = {
    ready: "Materials Ready",
    partial: "Partially Ready",
    waiting: "Waiting on Materials",
    shortage: "Material Shortage",
    not_required: "Not Required",
    unknown: "Not Confirmed",
  };

  return labels[status] || "Not Confirmed";
}

function getSourceTable(sourceType) {
  const tables = {
    [HOT_TODAY_SOURCE_TYPES.PROJECT]: "projects",
    [HOT_TODAY_SOURCE_TYPES.CUSTOMER_ORDER]: "customer_orders",
    [HOT_TODAY_SOURCE_TYPES.PRODUCTION_JOB]: "production_jobs",
  };

  return tables[sourceType];
}

function normalizeSourceRecord(record, sourceType) {
  const id = String(
    firstValue(record, [
      "id",
      "project_id",
      "order_id",
      "production_job_id",
      "job_id",
    ])
  );

  if (sourceType === HOT_TODAY_SOURCE_TYPES.PROJECT) {
    const projectNumber = firstValue(record, [
      "project_number",
      "work_order_number",
      "work_order_no",
      "job_number",
    ]);

    const title = firstValue(record, [
      "project_name",
      "name",
      "title",
      "job_name",
      "customer_name",
    ]);

    const customerName = firstValue(record, [
      "customer_name",
      "customer",
      "client_name",
      "contact_name",
    ]);

    return {
      id,
      title: [projectNumber, title].filter(Boolean).join(" — ") || `Project ${id}`,
      customerName,
      assignedTo: String(
        firstValue(record, [
          "assigned_to",
          "assigned_to_id",
          "employee_id",
          "owner_id",
        ])
      ),
      assignedToName: String(
        firstValue(record, [
          "assigned_to_name",
          "employee_name",
          "owner_name",
        ])
      ),
      department: String(
        firstValue(record, ["department", "current_department"])
      ),
      raw: record,
    };
  }

  if (sourceType === HOT_TODAY_SOURCE_TYPES.CUSTOMER_ORDER) {
    const orderNumber = firstValue(record, [
      "order_number",
      "order_no",
      "work_order_number",
      "job_number",
    ]);

    const title = firstValue(record, [
      "order_name",
      "title",
      "description",
      "customer_name",
    ]);

    const customerName = firstValue(record, [
      "customer_name",
      "customer",
      "client_name",
      "contact_name",
    ]);

    return {
      id,
      title:
        [orderNumber, title].filter(Boolean).join(" — ") ||
        `Customer Order ${id}`,
      customerName,
      assignedTo: String(
        firstValue(record, [
          "assigned_to",
          "assigned_to_id",
          "employee_id",
          "owner_id",
        ])
      ),
      assignedToName: String(
        firstValue(record, [
          "assigned_to_name",
          "employee_name",
          "owner_name",
        ])
      ),
      department: String(
        firstValue(record, ["department", "current_department"])
      ),
      raw: record,
    };
  }

  const jobNumber = firstValue(record, [
    "job_number",
    "production_number",
    "work_order_number",
    "order_number",
  ]);

  const title = firstValue(record, [
    "job_name",
    "title",
    "description",
    "product_name",
    "customer_name",
  ]);

  const customerName = firstValue(record, [
    "customer_name",
    "customer",
    "client_name",
  ]);

  return {
    id,
    title:
      [jobNumber, title].filter(Boolean).join(" — ") ||
      `Production Job ${id}`,
    customerName,
    assignedTo: String(
      firstValue(record, [
        "assigned_to",
        "assigned_to_id",
        "employee_id",
        "owner_id",
      ])
    ),
    assignedToName: String(
      firstValue(record, [
        "assigned_to_name",
        "employee_name",
        "owner_name",
      ])
    ),
    department: String(
      firstValue(record, [
        "department",
        "current_department",
        "current_stage",
        "station",
      ])
    ),
    raw: record,
  };
}

function normalizeEmployee(record) {
  const id = String(
    firstValue(record, ["id", "user_id", "employee_id", "profile_id"])
  );

  const name = String(
    firstValue(
      record,
      ["full_name", "name", "display_name", "employee_name", "email"],
      "Employee"
    )
  );

  return {
    value: id,
    label: name,
  };
}

export default function HotToday() {
  const [items, setItems] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [sourceRecords, setSourceRecords] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);

  const [loading, setLoading] = useState(true);
  const [loadingSources, setLoadingSources] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [message, setMessage] = useState(null);

  const departmentData = useMemo(
    () => DEPARTMENT_OPTIONS.map((department) => ({
      value: department,
      label: department,
    })),
    []
  );

  const departmentFilterData = useMemo(
    () => [
      {
        value: "All",
        label: "All Departments",
      },
      ...departmentData,
    ],
    [departmentData]
  );

  const employeeData = useMemo(() => {
    const seen = new Set();

    return employees.filter((employee) => {
      if (!employee.value || seen.has(employee.value)) {
        return false;
      }

      seen.add(employee.value);
      return true;
    });
  }, [employees]);

  const sourceData = useMemo(
    () =>
      sourceRecords.map((record) => ({
        value: record.id,
        label: record.title,
      })),
    [sourceRecords]
  );

  const visibleItems = useMemo(() => {
    if (departmentFilter === "All") {
      return items;
    }

    return items.filter(
      (item) => item.department === departmentFilter
    );
  }, [departmentFilter, items]);

  const criticalCount = useMemo(
    () => items.filter((item) => item.priority === "critical").length,
    [items]
  );

  const blockedCount = useMemo(
    () =>
      items.filter(
        (item) =>
          item.is_blocked ||
          item.materials_status === "waiting" ||
          item.materials_status === "shortage"
      ).length,
    [items]
  );

  const dueSoonCount = useMemo(
    () =>
      items.filter((item) => {
        const hours = Number(item.hours_remaining);

        return (
          item.hours_remaining !== null &&
          item.hours_remaining !== undefined &&
          hours >= 0 &&
          hours <= 2
        );
      }).length,
    [items]
  );

  const loadHotToday = useCallback(async () => {
    try {
      setLoading(true);
      await expireHotTodayItems();
      const data = await getTodaysHotTodayItems();
      setItems(data);
    } catch (error) {
      setMessage({
        color: "red",
        text: error.message || "Unable to load Hot Today work.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadEmployees = useCallback(async () => {
    const { data, error } = await supabase
      .from("employee_profiles")
      .select("*");

    if (error) {
      console.error("Unable to load employee profiles:", error);
      return;
    }

    setEmployees((data || []).map(normalizeEmployee));
  }, []);

  const loadSourceRecords = useCallback(async (sourceType) => {
    const table = getSourceTable(sourceType);

    if (!table) {
      setSourceRecords([]);
      return;
    }

    try {
      setLoadingSources(true);

      const { data, error } = await supabase
        .from(table)
        .select("*")
        .limit(500);

      if (error) {
        throw error;
      }

      const normalized = (data || [])
        .map((record) => normalizeSourceRecord(record, sourceType))
        .filter((record) => record.id);

      normalized.sort((a, b) => a.title.localeCompare(b.title));
      setSourceRecords(normalized);
    } catch (error) {
      setSourceRecords([]);
      setMessage({
        color: "red",
        text:
          error.message ||
          `Unable to load ${getHotTodaySourceLabel(sourceType)} records.`,
      });
    } finally {
      setLoadingSources(false);
    }
  }, []);

  useEffect(() => {
    loadHotToday();
    loadEmployees();

    const unsubscribe = subscribeToHotTodayChanges(() => {
      loadHotToday();
    });

    const refreshTimer = window.setInterval(() => {
      loadHotToday();
    }, 30000);

    return () => {
      unsubscribe();
      window.clearInterval(refreshTimer);
    };
  }, [loadEmployees, loadHotToday]);

  useEffect(() => {
    if (modalOpen && !editingItem) {
      loadSourceRecords(form.sourceType);
    }
  }, [
    editingItem,
    form.sourceType,
    loadSourceRecords,
    modalOpen,
  ]);

  function updateForm(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingItem(null);
    setSourceRecords([]);
  }

  function openCreateModal() {
    resetForm();
    setMessage(null);
    setModalOpen(true);
  }

  function openEditModal(item) {
    setEditingItem(item);
    setForm({
      sourceType: item.source_type,
      sourceId: item.source_id,
      title: item.title || "",
      customerName: item.customer_name || "",
      assignedTo: item.assigned_to || "",
      assignedToName: item.assigned_to_name || "",
      department: item.department || "",
      reason: item.reason || "",
      priority: item.priority || HOT_TODAY_PRIORITIES.HIGH,
      notes: item.notes || "",
      dueAt: formatDateTimeForInput(item.due_at),
      materialsStatus:
        item.materials_status ||
        HOT_TODAY_MATERIALS_STATUSES.UNKNOWN,
      blocker: item.blocker || "",
    });

    setMessage(null);
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) {
      return;
    }

    setModalOpen(false);
    resetForm();
  }

  function handleSourceTypeChange(value) {
    setForm((current) => ({
      ...current,
      sourceType: value,
      sourceId: "",
      title: "",
      customerName: "",
      assignedTo: "",
      assignedToName: "",
      department: "",
    }));

    setSourceRecords([]);
  }

  function handleSourceRecordChange(value) {
    const selected = sourceRecords.find(
      (record) => record.id === value
    );

    if (!selected) {
      updateForm("sourceId", value || "");
      return;
    }

    const matchedEmployee = employeeData.find(
      (employee) => employee.value === selected.assignedTo
    );

    setForm((current) => ({
      ...current,
      sourceId: selected.id,
      title: selected.title,
      customerName: selected.customerName || "",
      assignedTo: matchedEmployee ? matchedEmployee.value : "",
      assignedToName:
        matchedEmployee?.label || selected.assignedToName || "",
      department: DEPARTMENT_OPTIONS.includes(selected.department)
        ? selected.department
        : current.department,
    }));
  }

  function handleEmployeeChange(value) {
    const employee = employeeData.find(
      (option) => option.value === value
    );

    setForm((current) => ({
      ...current,
      assignedTo: value || "",
      assignedToName: employee?.label || "",
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.sourceId) {
      setMessage({
        color: "red",
        text: "Select the existing work item being promoted.",
      });
      return;
    }

    if (!form.title.trim()) {
      setMessage({
        color: "red",
        text: "Enter a title for this Hot Today item.",
      });
      return;
    }

    if (!form.department) {
      setMessage({
        color: "red",
        text: "Select the responsible department.",
      });
      return;
    }

    if (!form.reason.trim()) {
      setMessage({
        color: "red",
        text: "Enter why management made this item Hot Today.",
      });
      return;
    }

    try {
      setSaving(true);
      setMessage(null);

      if (editingItem) {
        await updateHotTodayItem(editingItem.id, {
          title: form.title,
          customerName: form.customerName,
          assignedTo: form.assignedTo,
          assignedToName: form.assignedToName,
          department: form.department,
          reason: form.reason,
          priority: form.priority,
          notes: form.notes,
          dueAt: form.dueAt,
          materialsStatus: form.materialsStatus,
          blocker: form.blocker,
        });
      } else {
        await createHotTodayItem(form);
      }

      setModalOpen(false);
      resetForm();
      await loadHotToday();

      setMessage({
        color: "green",
        text: editingItem
          ? "Hot Today priority updated."
          : "Work item promoted to Hot Today.",
      });
    } catch (error) {
      const duplicateItem =
        error.code === "23505" ||
        String(error.message).toLowerCase().includes("duplicate");

      setMessage({
        color: "red",
        text: duplicateItem
          ? "This work item is already marked Hot Today for this workday."
          : error.message || "Unable to save the Hot Today item.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleComplete(item) {
    const confirmed = window.confirm(
      `Mark “${item.title}” complete and remove it from Hot Today?`
    );

    if (!confirmed) {
      return;
    }

    try {
      await completeHotTodayItem(item.id);
      await loadHotToday();

      setMessage({
        color: "green",
        text: "Hot Today item completed.",
      });
    } catch (error) {
      setMessage({
        color: "red",
        text: error.message || "Unable to complete the item.",
      });
    }
  }

  async function handleRemove(item) {
    const reason = window.prompt(
      `Why is “${item.title}” being removed from Hot Today?`
    );

    if (reason === null) {
      return;
    }

    if (!reason.trim()) {
      setMessage({
        color: "red",
        text: "A removal reason is required.",
      });
      return;
    }

    try {
      await removeHotTodayItem(item.id, reason);
      await loadHotToday();

      setMessage({
        color: "green",
        text: "Item removed from Hot Today.",
      });
    } catch (error) {
      setMessage({
        color: "red",
        text: error.message || "Unable to remove the item.",
      });
    }
  }

  return (
    <Stack gap="lg">
      <Paper
        p="xl"
        radius="lg"
        style={{
          background:
            "linear-gradient(135deg, rgba(139, 0, 0, 0.96), rgba(34, 6, 6, 0.98) 58%, rgba(12, 12, 14, 1))",
          border: "1px solid rgba(255, 72, 72, 0.26)",
          boxShadow: "0 18px 50px rgba(0, 0, 0, 0.28)",
        }}
      >
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <Group align="flex-start">
            <ThemeIcon
              size={52}
              radius="md"
              color="red"
              variant="filled"
            >
              <IconFlame size={30} />
            </ThemeIcon>

            <Box>
              <Text
                size="xs"
                fw={800}
                tt="uppercase"
                c="red.2"
                style={{ letterSpacing: 1.6 }}
              >
                Management Priority Control
              </Text>

              <Title order={1} c="white">
                Hot Today
              </Title>

              <Text c="gray.3" maw={720} mt={4}>
                Promote existing work that management needs prioritized
                today. Hot Today is separate from customer-promised Quick
                Turnaround work.
              </Text>
            </Box>
          </Group>

          <Group>
            <Tooltip label="Refresh Hot Today">
              <ActionIcon
                size="lg"
                variant="light"
                color="gray"
                onClick={loadHotToday}
                disabled={loading}
              >
                <IconRefresh size={20} />
              </ActionIcon>
            </Tooltip>

            <Button
              color="red"
              size="md"
              leftSection={<IconFlame size={18} />}
              onClick={openCreateModal}
            >
              Promote Work
            </Button>
          </Group>
        </Group>
      </Paper>

      {message && (
        <Alert
          color={message.color}
          title={message.color === "red" ? "Attention" : "Hot Today"}
          withCloseButton
          onClose={() => setMessage(null)}
        >
          {message.text}
        </Alert>
      )}

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
        <Card withBorder radius="lg" p="lg">
          <Group justify="space-between">
            <Box>
              <Text size="xs" c="dimmed" fw={700} tt="uppercase">
                Active Today
              </Text>
              <Text size="2rem" fw={900}>
                {items.length}
              </Text>
            </Box>

            <ThemeIcon size={44} radius="md" color="red" variant="light">
              <IconFlame size={24} />
            </ThemeIcon>
          </Group>
        </Card>

        <Card withBorder radius="lg" p="lg">
          <Group justify="space-between">
            <Box>
              <Text size="xs" c="dimmed" fw={700} tt="uppercase">
                Critical
              </Text>
              <Text size="2rem" fw={900} c="red">
                {criticalCount}
              </Text>
            </Box>

            <ThemeIcon size={44} radius="md" color="red" variant="light">
              <IconBolt size={24} />
            </ThemeIcon>
          </Group>
        </Card>

        <Card withBorder radius="lg" p="lg">
          <Group justify="space-between">
            <Box>
              <Text size="xs" c="dimmed" fw={700} tt="uppercase">
                Due Within 2 Hours
              </Text>
              <Text size="2rem" fw={900} c="orange">
                {dueSoonCount}
              </Text>
            </Box>

            <ThemeIcon
              size={44}
              radius="md"
              color="orange"
              variant="light"
            >
              <IconClock size={24} />
            </ThemeIcon>
          </Group>
        </Card>

        <Card withBorder radius="lg" p="lg">
          <Group justify="space-between">
            <Box>
              <Text size="xs" c="dimmed" fw={700} tt="uppercase">
                Blocked
              </Text>
              <Text size="2rem" fw={900} c="yellow">
                {blockedCount}
              </Text>
            </Box>

            <ThemeIcon
              size={44}
              radius="md"
              color="yellow"
              variant="light"
            >
              <IconAlertTriangle size={24} />
            </ThemeIcon>
          </Group>
        </Card>
      </SimpleGrid>

      <Card withBorder radius="lg" p="lg">
        <Group justify="space-between" mb="lg" wrap="wrap">
          <Box>
            <Title order={3}>Today’s Management Priorities</Title>
            <Text size="sm" c="dimmed">
              Active items automatically leave this list at the end of
              the workday.
            </Text>
          </Box>

          <Select
            w={240}
            value={departmentFilter}
            onChange={(value) => setDepartmentFilter(value || "All")}
            data={departmentFilterData}
            allowDeselect={false}
          />
        </Group>

        {loading ? (
          <Center py={70}>
            <Stack align="center" gap="sm">
              <Loader color="red" />
              <Text c="dimmed">Loading Hot Today work...</Text>
            </Stack>
          </Center>
        ) : visibleItems.length === 0 ? (
          <Center py={70}>
            <Stack align="center" gap="sm">
              <ThemeIcon
                size={58}
                radius="xl"
                color="gray"
                variant="light"
              >
                <IconFlame size={30} />
              </ThemeIcon>

              <Title order={4}>No Hot Today work</Title>

              <Text c="dimmed" ta="center" maw={460}>
                Management has not promoted any active work for this
                department today.
              </Text>

              <Button
                mt="sm"
                color="red"
                variant="light"
                onClick={openCreateModal}
              >
                Promote Existing Work
              </Button>
            </Stack>
          </Center>
        ) : (
          <Table.ScrollContainer minWidth={1050}>
            <Table verticalSpacing="md" horizontalSpacing="md">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Priority Work</Table.Th>
                  <Table.Th>Due</Table.Th>
                  <Table.Th>Assignment</Table.Th>
                  <Table.Th>Department</Table.Th>
                  <Table.Th>Materials</Table.Th>
                  <Table.Th>Blocker</Table.Th>
                  <Table.Th ta="right">Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>

              <Table.Tbody>
                {visibleItems.map((item) => {
                  const overdue =
                    item.hours_remaining !== null &&
                    Number(item.hours_remaining) < 0;

                  return (
                    <Table.Tr key={item.id}>
                      <Table.Td>
                        <Stack gap={4}>
                          <Group gap="xs">
                            <Badge
                              color={getHotTodayPriorityColor(
                                item.priority
                              )}
                              variant="filled"
                            >
                              {item.priority}
                            </Badge>

                            <Badge color="gray" variant="light">
                              {getHotTodaySourceLabel(
                                item.source_type
                              )}
                            </Badge>
                          </Group>

                          <Text fw={800}>{item.title}</Text>

                          {item.customer_name && (
                            <Text size="sm" c="dimmed">
                              {item.customer_name}
                            </Text>
                          )}

                          <Text size="xs" c="dimmed">
                            Reason: {item.reason}
                          </Text>
                        </Stack>
                      </Table.Td>

                      <Table.Td>
                        <Stack gap={3}>
                          <Text fw={700}>
                            {formatDueTime(item.due_at)}
                          </Text>

                          <Text
                            size="xs"
                            fw={700}
                            c={overdue ? "red" : "dimmed"}
                          >
                            {formatHoursRemaining(
                              item.hours_remaining
                            )}
                          </Text>
                        </Stack>
                      </Table.Td>

                      <Table.Td>
                        <Group gap="xs" wrap="nowrap">
                          <IconUser size={16} />
                          <Text size="sm">
                            {item.assigned_to_name || "Unassigned"}
                          </Text>
                        </Group>
                      </Table.Td>

                      <Table.Td>
                        <Badge color="red" variant="light">
                          {item.department}
                        </Badge>
                      </Table.Td>

                      <Table.Td>
                        <Badge
                          color={getHotTodayMaterialsColor(
                            item.materials_status
                          )}
                          variant="light"
                        >
                          {formatMaterialsLabel(
                            item.materials_status
                          )}
                        </Badge>
                      </Table.Td>

                      <Table.Td>
                        {item.blocker ? (
                          <Group gap="xs" wrap="nowrap">
                            <IconAlertTriangle
                              size={17}
                              color="var(--mantine-color-yellow-5)"
                            />
                            <Text size="sm" c="yellow.4">
                              {item.blocker}
                            </Text>
                          </Group>
                        ) : (
                          <Text size="sm" c="dimmed">
                            None
                          </Text>
                        )}
                      </Table.Td>

                      <Table.Td>
                        <Group justify="flex-end" gap="xs" wrap="nowrap">
                          <Tooltip label="Edit">
                            <ActionIcon
                              color="blue"
                              variant="light"
                              onClick={() => openEditModal(item)}
                            >
                              <IconEdit size={17} />
                            </ActionIcon>
                          </Tooltip>

                          <Tooltip label="Mark complete">
                            <ActionIcon
                              color="green"
                              variant="light"
                              onClick={() => handleComplete(item)}
                            >
                              <IconCheck size={17} />
                            </ActionIcon>
                          </Tooltip>

                          <Tooltip label="Remove from Hot Today">
                            <ActionIcon
                              color="red"
                              variant="light"
                              onClick={() => handleRemove(item)}
                            >
                              <IconTrash size={17} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Card>

      <Modal
        opened={modalOpen}
        onClose={closeModal}
        title={
          <Group gap="sm">
            <ThemeIcon color="red" variant="light">
              <IconFlame size={18} />
            </ThemeIcon>

            <Box>
              <Text fw={800}>
                {editingItem
                  ? "Update Hot Today Priority"
                  : "Promote Work to Hot Today"}
              </Text>
              <Text size="xs" c="dimmed">
                Management priority for the current workday
              </Text>
            </Box>
          </Group>
        }
        size="xl"
        centered
        closeOnClickOutside={!saving}
      >
        <form onSubmit={handleSubmit}>
          <Stack gap="md">
            {!editingItem && (
              <>
                <Grid>
                  <Grid.Col span={{ base: 12, md: 4 }}>
                    <Select
                      label="Work Type"
                      description="Choose where the work currently exists"
                      value={form.sourceType}
                      onChange={handleSourceTypeChange}
                      data={SOURCE_OPTIONS}
                      allowDeselect={false}
                      required
                    />
                  </Grid.Col>

                  <Grid.Col span={{ base: 12, md: 8 }}>
                    <Select
                      label="Existing Work Item"
                      description="Search the selected source"
                      placeholder={
                        loadingSources
                          ? "Loading work..."
                          : "Select an existing item"
                      }
                      value={form.sourceId}
                      onChange={handleSourceRecordChange}
                      data={sourceData}
                      searchable
                      clearable
                      disabled={loadingSources}
                      rightSection={
                        loadingSources ? <Loader size={16} /> : null
                      }
                      required
                    />
                  </Grid.Col>
                </Grid>

                <Divider />
              </>
            )}

            <Grid>
              <Grid.Col span={{ base: 12, md: 8 }}>
                <TextInput
                  label="Hot Today Title"
                  description="Readable work description for dashboards and TVs"
                  value={form.title}
                  onChange={(event) =>
                    updateForm("title", event.currentTarget.value)
                  }
                  required
                />
              </Grid.Col>

              <Grid.Col span={{ base: 12, md: 4 }}>
                <Select
                  label="Priority"
                  value={form.priority}
                  onChange={(value) =>
                    updateForm(
                      "priority",
                      value || HOT_TODAY_PRIORITIES.HIGH
                    )
                  }
                  data={PRIORITY_OPTIONS}
                  allowDeselect={false}
                  required
                />
              </Grid.Col>

              <Grid.Col span={{ base: 12, md: 6 }}>
                <TextInput
                  label="Customer"
                  value={form.customerName}
                  onChange={(event) =>
                    updateForm(
                      "customerName",
                      event.currentTarget.value
                    )
                  }
                />
              </Grid.Col>

              <Grid.Col span={{ base: 12, md: 6 }}>
                <TextInput
                  label="Due Time"
                  type="datetime-local"
                  value={form.dueAt}
                  onChange={(event) =>
                    updateForm("dueAt", event.currentTarget.value)
                  }
                />
              </Grid.Col>

              <Grid.Col span={{ base: 12, md: 6 }}>
                <Select
                  label="Responsible Department"
                  placeholder="Select department"
                  value={form.department}
                  onChange={(value) =>
                    updateForm("department", value || "")
                  }
                  data={departmentData}
                  searchable
                  required
                />
              </Grid.Col>

              <Grid.Col span={{ base: 12, md: 6 }}>
                <Select
                  label="Assigned Employee"
                  placeholder="Unassigned"
                  value={form.assignedTo}
                  onChange={handleEmployeeChange}
                  data={employeeData}
                  searchable
                  clearable
                />
              </Grid.Col>

              <Grid.Col span={{ base: 12, md: 6 }}>
                <Select
                  label="Materials Readiness"
                  value={form.materialsStatus}
                  onChange={(value) =>
                    updateForm(
                      "materialsStatus",
                      value ||
                        HOT_TODAY_MATERIALS_STATUSES.UNKNOWN
                    )
                  }
                  data={MATERIALS_OPTIONS}
                  allowDeselect={false}
                />
              </Grid.Col>

              <Grid.Col span={{ base: 12, md: 6 }}>
                <TextInput
                  label="Current Blocker"
                  placeholder="Leave blank when work is not blocked"
                  value={form.blocker}
                  onChange={(event) =>
                    updateForm("blocker", event.currentTarget.value)
                  }
                />
              </Grid.Col>
            </Grid>

            <Textarea
              label="Why is this Hot Today?"
              description="Management reason for promoting this work"
              placeholder="Example: Customer pickup at 3:00 PM"
              value={form.reason}
              onChange={(event) =>
                updateForm("reason", event.currentTarget.value)
              }
              minRows={2}
              autosize
              required
            />

            <Textarea
              label="Production Notes"
              placeholder="Instructions the team needs to see"
              value={form.notes}
              onChange={(event) =>
                updateForm("notes", event.currentTarget.value)
              }
              minRows={3}
              autosize
            />

            <Group justify="flex-end" mt="sm">
              <Button
                variant="default"
                onClick={closeModal}
                disabled={saving}
              >
                Cancel
              </Button>

              <Button
                type="submit"
                color="red"
                loading={saving}
                leftSection={
                  editingItem ? (
                    <IconCheck size={18} />
                  ) : (
                    <IconFlame size={18} />
                  )
                }
              >
                {editingItem
                  ? "Save Hot Today Changes"
                  : "Promote to Hot Today"}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}