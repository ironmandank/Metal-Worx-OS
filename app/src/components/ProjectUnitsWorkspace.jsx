import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Group,
  Loader,
  Modal,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconCheck,
  IconPackage,
  IconPlus,
  IconRefresh,
  IconTruckDelivery,
} from "@tabler/icons-react";

import { supabase } from "../lib/supabase";
import { HANDOFF_METHODS, HANDOFF_STATUSES, summarizeProjectUnits, UNIT_STAGES, UNIT_STATUSES } from "../lib/projectUnits";

const EMPTY_UNIT = {
  unit_name: "",
  unit_number: "",
  description: "",
  stage: "Planning",
  status: "Not Started",
  handoff_status: "Not Ready",
  handoff_method: "Customer Pickup",
  assigned_to: "",
  notes: "",
};

function formatDateTime(value) {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function handoffColor(status) {
  if (["Picked Up", "Delivered"].includes(status)) return "green";
  if (["Pickup Scheduled", "Delivery Scheduled"].includes(status)) return "blue";
  if (status === "Waiting for Customer Pickup") return "orange";
  return "gray";
}

export default function ProjectUnitsWorkspace({ project, activeUser, compact = false, onChanged }) {
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_UNIT);

  async function loadUnits() {
    if (!project?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("project_units")
      .select("*")
      .eq("project_id", project.id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true });
    setLoading(false);
    if (error) {
      notifications.show({ title: "Project Units Could Not Load", message: error.message, color: "red" });
      return;
    }
    setUnits(data || []);
  }

  useEffect(() => { loadUnits(); }, [project?.id]);

  const summary = useMemo(() => summarizeProjectUnits(units), [units]);

  async function updateUnit(unit, updates) {
    setSavingId(unit.id);
    const payload = { ...updates };
    if (updates.handoff_status === "Picked Up" || updates.handoff_status === "Delivered") {
      payload.stage = "Completed";
      payload.status = "Complete";
    }
    if (updates.stage === "Completed") payload.status = "Complete";
    const { error } = await supabase.from("project_units").update(payload).eq("id", unit.id);
    setSavingId(null);
    if (error) {
      notifications.show({ title: "Unit Could Not Be Updated", message: error.message, color: "red" });
      return;
    }
    await loadUnits();
    onChanged?.();
  }

  async function createUnit() {
    if (!form.unit_name.trim()) {
      notifications.show({ title: "Unit Name Required", message: "Name the container, section, gate, rail run, or other deliverable.", color: "orange" });
      return;
    }
    setCreating(true);
    const { error } = await supabase.from("project_units").insert({
      project_id: project.id,
      ...form,
      unit_name: form.unit_name.trim(),
      unit_number: form.unit_number.trim() || null,
      description: form.description.trim() || null,
      assigned_to: form.assigned_to.trim() || project.assigned_to || activeUser || null,
      notes: form.notes.trim() || null,
      sort_order: units.length + 1,
    });
    setCreating(false);
    if (error) {
      notifications.show({ title: "Unit Could Not Be Added", message: error.message, color: "red" });
      return;
    }
    setModalOpen(false);
    setForm(EMPTY_UNIT);
    await loadUnits();
    onChanged?.();
    notifications.show({ title: "Project Unit Added", message: "The deliverable now has its own production and handoff status.", color: "green" });
  }

  if (loading) return <Group justify="center" py="lg"><Loader size="sm" color="red"/><Text>Loading project units…</Text></Group>;

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <Box>
          <Group gap="xs"><IconPackage size={21}/><Title order={compact ? 4 : 3}>Project Units &amp; Handoffs</Title></Group>
          <Text size="sm" c="dimmed">Track each container, assembly, section, or deliverable independently.</Text>
        </Box>
        <Group gap="xs">
          <Button variant="light" color="gray" leftSection={<IconRefresh size={16}/>} onClick={loadUnits}>Refresh</Button>
          <Button color="red" leftSection={<IconPlus size={16}/>} onClick={() => setModalOpen(true)}>Add Unit</Button>
        </Group>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
        <Card withBorder p="sm"><Text size="xs" c="dimmed" tt="uppercase" fw={800}>Units</Text><Text size="xl" fw={900}>{summary.total}</Text></Card>
        <Card withBorder p="sm"><Text size="xs" c="dimmed" tt="uppercase" fw={800}>Finished / Handed Off</Text><Text size="xl" fw={900} c="green">{summary.completed}/{summary.total}</Text></Card>
        <Card withBorder p="sm"><Text size="xs" c="dimmed" tt="uppercase" fw={800}>Waiting / Scheduled</Text><Text size="xl" fw={900} c={summary.ready ? "orange" : undefined}>{summary.ready}</Text></Card>
      </SimpleGrid>

      {units.length === 0 ? (
        <Alert color="gray" icon={<IconPackage size={18}/>}>
          This project has no individual units yet. Add units when parts of the job can finish, ship, or be picked up at different times.
        </Alert>
      ) : (
        <Stack gap="sm">
          {units.map((unit) => (
            <Card key={unit.id} withBorder radius="md" p="md">
              <Group justify="space-between" align="flex-start" wrap="wrap" mb="sm">
                <Box>
                  <Text fw={900}>{unit.unit_name}</Text>
                  <Text size="xs" c="dimmed">{unit.unit_number || `Unit ${unit.sort_order || unit.id}`} · {unit.assigned_to || project.assigned_to || "Unassigned"}</Text>
                </Box>
                <Group gap="xs">
                  <Badge color={unit.status === "Complete" ? "green" : unit.status === "Blocked" ? "red" : "blue"}>{unit.status}</Badge>
                  <Badge color={handoffColor(unit.handoff_status)} variant="light">{unit.handoff_status}</Badge>
                </Group>
              </Group>
              <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="sm">
                <Select label="Production Stage" data={UNIT_STAGES} value={unit.stage} disabled={savingId === unit.id} onChange={(value) => value && updateUnit(unit, { stage: value })}/>
                <Select label="Work Status" data={UNIT_STATUSES} value={unit.status} disabled={savingId === unit.id} onChange={(value) => value && updateUnit(unit, { status: value })}/>
                <Select label="Pickup / Delivery" data={HANDOFF_STATUSES} value={unit.handoff_status} disabled={savingId === unit.id} onChange={(value) => value && updateUnit(unit, { handoff_status: value })}/>
                <Select label="Handoff Method" data={HANDOFF_METHODS} value={unit.handoff_method} disabled={savingId === unit.id} onChange={(value) => value && updateUnit(unit, { handoff_method: value })}/>
                <TextInput type="datetime-local" label="Scheduled Date & Time" value={unit.scheduled_handoff_at ? String(unit.scheduled_handoff_at).slice(0,16) : ""} onChange={(event) => updateUnit(unit, { scheduled_handoff_at: event.currentTarget.value ? new Date(event.currentTarget.value).toISOString() : null })}/>
                <TextInput label="Assigned To" defaultValue={unit.assigned_to || ""} onBlur={(event) => updateUnit(unit, { assigned_to: event.currentTarget.value.trim() || null })}/>
                <Box style={{ alignSelf: "end" }}><Text size="xs" c="dimmed">Handoff Schedule</Text><Text size="sm" fw={700}><IconTruckDelivery size={14} style={{ verticalAlign: "middle", marginRight: 5 }}/>{formatDateTime(unit.scheduled_handoff_at)}</Text></Box>
                <Box style={{ alignSelf: "end" }}><Text size="xs" c="dimmed">Completed</Text><Text size="sm" fw={700}>{formatDateTime(unit.completed_at)}</Text></Box>
              </SimpleGrid>
              <Textarea mt="sm" label="Unit Notes" minRows={2} defaultValue={unit.notes || ""} onBlur={(event) => updateUnit(unit, { notes: event.currentTarget.value.trim() || null })}/>
            </Card>
          ))}
        </Stack>
      )}

      <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title="Add Project Unit" centered size="lg">
        <Stack>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput label="Unit Name" required placeholder="Container 1, East Rail Run, Gate A…" value={form.unit_name} onChange={(event) => setForm((current) => ({ ...current, unit_name: event.currentTarget.value }))}/>
            <TextInput label="Unit Number / Identifier" placeholder="Optional" value={form.unit_number} onChange={(event) => setForm((current) => ({ ...current, unit_number: event.currentTarget.value }))}/>
            <Select label="Starting Stage" data={UNIT_STAGES} value={form.stage} onChange={(value) => setForm((current) => ({ ...current, stage: value || "Planning" }))}/>
            <Select label="Work Status" data={UNIT_STATUSES} value={form.status} onChange={(value) => setForm((current) => ({ ...current, status: value || "Not Started" }))}/>
            <Select label="Handoff Method" data={HANDOFF_METHODS} value={form.handoff_method} onChange={(value) => setForm((current) => ({ ...current, handoff_method: value || "Customer Pickup" }))}/>
            <TextInput label="Assigned To" value={form.assigned_to} placeholder={project.assigned_to || activeUser || "Employee"} onChange={(event) => setForm((current) => ({ ...current, assigned_to: event.currentTarget.value }))}/>
          </SimpleGrid>
          <Textarea label="Description" minRows={2} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.currentTarget.value }))}/>
          <Textarea label="Notes" minRows={2} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.currentTarget.value }))}/>
          <Group justify="flex-end"><Button variant="light" color="gray" onClick={() => setModalOpen(false)}>Cancel</Button><Button color="red" loading={creating} leftSection={<IconCheck size={16}/>} onClick={createUnit}>Add Unit</Button></Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
