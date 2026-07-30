import {
  Alert, Badge, Button, Group, Loader, Modal, Paper, Select, SimpleGrid,
  Stack, Text, Textarea, TextInput, ThemeIcon, Title,
} from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import {
  IconAlertTriangle, IconBolt, IconCheck, IconClock, IconPackage,
  IconPlayerPlay, IconPlus, IconRefresh, IconUser,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { supabase } from "../lib/supabase";
import MWKpiStrip from "../components/ui/MWKpiStrip";
import MWPageHeader from "../components/ui/MWPageHeader";
import MWPanel from "../components/ui/MWPanel";

const EMPTY_FORM = {
  title: "", customerName: "", description: "", priority: "Urgent",
  requiredBy: null, assignedTo: "", department: "", materialsStatus: "Not Required",
  reason: "", notes: "",
};

function timingColor(status) {
  if (status === "Overdue" || status === "Blocked") return "red";
  if (status === "Due Soon") return "orange";
  if (status === "Due Today") return "yellow";
  if (status === "Due Tomorrow") return "blue";
  return "gray";
}

function priorityColor(priority) {
  if (priority === "Critical") return "red";
  if (priority === "Urgent") return "orange";
  return "yellow";
}

function formatDue(value) {
  return new Date(value).toLocaleString("en-US", {
    weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

function QuickTurnaroundDashboard({ setPage, activeUser }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [commitments, setCommitments] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [statusFilter, setStatusFilter] = useState("Active");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [commitmentResult, profileResult] = await Promise.all([
        supabase.from("quick_turnaround_dashboard").select("*").order("attention_rank").order("required_by"),
        supabase.from("employee_profiles").select("display_name,profile_type,is_active").eq("is_active", true).order("display_name"),
      ]);
      if (commitmentResult.error) throw commitmentResult.error;
      setCommitments(commitmentResult.data || []);
      setProfiles(profileResult.data || []);
    } catch (error) {
      notifications.show({ title: "Commitments Failed to Load", message: error.message, color: "red" });
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = useMemo(() => commitments.filter((commitment) => {
    if (statusFilter === "Active" && ["Completed", "Cancelled"].includes(commitment.status)) return false;
    if (statusFilter !== "Active" && statusFilter !== "all" && commitment.status !== statusFilter) return false;
    if (priorityFilter !== "all" && commitment.priority !== priorityFilter) return false;
    return true;
  }), [commitments, priorityFilter, statusFilter]);

  const active = commitments.filter((item) => !["Completed", "Cancelled"].includes(item.status));
  const overdue = active.filter((item) => item.timing_status === "Overdue").length;
  const dueToday = active.filter((item) => ["Due Today", "Due Soon"].includes(item.timing_status)).length;
  const blocked = active.filter((item) => item.status === "Blocked" || item.materials_status === "Blocked").length;

  async function saveCommitment() {
    if (!form.title.trim() || !form.requiredBy || saving) return;
    setSaving(true);
    try {
      const materialsRequired = form.materialsStatus !== "Not Required";
      const { error } = await supabase.rpc("mw_save_quick_turnaround_commitment", {
        p_id: null, p_source_type: "Manual", p_source_id: null, p_source_number: null,
        p_title: form.title.trim(), p_customer_name: form.customerName.trim() || null,
        p_description: form.description.trim() || null, p_priority: form.priority,
        p_status: "Open", p_required_by: form.requiredBy.toISOString(),
        p_assigned_to: form.assignedTo || null, p_department: form.department || null,
        p_materials_required: materialsRequired, p_materials_status: form.materialsStatus,
        p_reason: form.reason.trim() || null, p_notes: form.notes.trim() || null,
        p_created_by: activeUser || null,
      });
      if (error) throw error;
      setModalOpen(false); setForm(EMPTY_FORM); await loadData();
      notifications.show({ title: "Quick Commitment Added", message: "The urgent work is now visible to Operations.", color: "green", icon: <IconCheck size={18}/> });
    } catch (error) {
      notifications.show({ title: "Commitment Save Failed", message: error.message, color: "red" });
    } finally { setSaving(false); }
  }

  async function updateStatus(id, status) {
    const { error } = await supabase.rpc("mw_update_quick_turnaround_status", { p_id: id, p_status: status, p_employee: activeUser || null });
    if (error) notifications.show({ title: "Status Update Failed", message: error.message, color: "red" });
    else await loadData();
  }

  if (loading) return <Stack gap="xl"><MWPageHeader title="Today's Commitments" subtitle="Loading urgent Metal Worx work." setPage={setPage} showBack backPage="dashboard" backLabel="Mission Control" showDashboard={false}/><MWPanel><Group justify="center" py={90}><Loader color="red"/><Text c="dimmed">Loading commitments…</Text></Group></MWPanel></Stack>;

  return <Stack gap="xl">
    <MWPageHeader title="Today's Commitments" subtitle="High-visibility control for quick-turnaround work, promised dates, assignments, and material readiness." setPage={setPage} showBack backPage="dashboard" backLabel="Mission Control" showDashboard={false}/>
    <MWKpiStrip items={[
      { label: "Active Commitments", value: active.length, description: "Open urgent work", icon: IconBolt, color: "red" },
      { label: "Due Today", value: dueToday, description: "Requires attention today", icon: IconClock, color: "yellow" },
      { label: "Overdue", value: overdue, description: "Past promised time", icon: IconAlertTriangle, color: "red" },
      { label: "Blocked", value: blocked, description: "Work or materials blocked", icon: IconPackage, color: "orange" },
    ]} columns={{ base: 1, sm: 2, xl: 4 }} compact/>

    <MWPanel title="Commitment Controls" subtitle="Filter the board or capture urgent work immediately" icon={IconBolt}>
      <Group justify="space-between">
        <Group><Select w={190} value={statusFilter} onChange={(value) => setStatusFilter(value || "Active")} data={["Active", "Open", "Acknowledged", "In Progress", "Blocked", "Completed", "Cancelled", { value: "all", label: "All Statuses" }]}/><Select w={170} value={priorityFilter} onChange={(value) => setPriorityFilter(value || "all")} data={[{ value: "all", label: "All Priorities" }, "Critical", "Urgent", "High"]}/><Button variant="light" color="gray" leftSection={<IconRefresh size={17}/>} onClick={loadData}>Refresh</Button></Group>
        <Button color="red" leftSection={<IconPlus size={18}/>} onClick={() => setModalOpen(true)}>New Quick Commitment</Button>
      </Group>
    </MWPanel>

    <MWPanel title="Quick Turnaround Board" subtitle={`${filtered.length} commitment${filtered.length === 1 ? "" : "s"} shown`} icon={IconClock}>
      {!filtered.length ? <Alert color="gray" icon={<IconClock size={19}/>}>No commitments match the current filters.</Alert> : <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="md">{filtered.map((item) => <Paper key={item.id} p="lg" radius="lg" style={{ background: "rgba(255,255,255,.025)", border: `1px solid ${item.timing_status === "Overdue" ? "rgba(250,82,82,.55)" : "rgba(255,255,255,.08)"}` }}><Stack gap="md">
        <Group justify="space-between" align="flex-start" wrap="nowrap"><Stack gap={4}><Group gap="xs"><Badge color={priorityColor(item.priority)}>{item.priority}</Badge><Badge color={timingColor(item.timing_status)} variant="light">{item.timing_status}</Badge><Badge color="gray" variant="light">{item.source_type}</Badge></Group><Title order={3}>{item.title}</Title><Text c="dimmed" size="sm">{[item.customer_name, item.source_number].filter(Boolean).join(" · ") || "Internal Metal Worx commitment"}</Text></Stack><ThemeIcon size={48} radius="lg" color={timingColor(item.timing_status)} variant="light"><IconBolt size={24}/></ThemeIcon></Group>
        <Paper p="sm" withBorder><Group justify="space-between"><Group gap="xs"><IconClock size={18}/><Text fw={800}>Required {formatDue(item.required_by)}</Text></Group><Text fw={900} c={item.timing_status === "Overdue" ? "red.4" : "gray.1"}>{item.timing_status === "Overdue" ? "PAST DUE" : `${Math.round(Number(item.hours_remaining || 0))} hrs`}</Text></Group></Paper>
        <SimpleGrid cols={2}><Stack gap={2}><Text size="xs" c="dimmed" fw={800}>ASSIGNED TO</Text><Text fw={750}>{item.assigned_to || "Unassigned"}</Text></Stack><Stack gap={2}><Text size="xs" c="dimmed" fw={800}>MATERIALS</Text><Badge w="fit-content" color={item.materials_status === "Ready" || item.materials_status === "Not Required" ? "green" : "orange"} variant="light">{item.materials_status}</Badge></Stack></SimpleGrid>
        {item.description && <Text size="sm">{item.description}</Text>}
        <Group grow>{item.status === "Open" && <Button color="blue" variant="light" leftSection={<IconCheck size={17}/>} onClick={() => updateStatus(item.id, "Acknowledged")}>Acknowledge</Button>}{["Open", "Acknowledged"].includes(item.status) && <Button color="orange" variant="light" leftSection={<IconPlayerPlay size={17}/>} onClick={() => updateStatus(item.id, "In Progress")}>Start Work</Button>}{!["Completed", "Cancelled"].includes(item.status) && <Button color="green" leftSection={<IconCheck size={17}/>} onClick={() => updateStatus(item.id, "Completed")}>Complete</Button>}</Group>
      </Stack></Paper>)}</SimpleGrid>}
    </MWPanel>

    <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title="New Quick Turnaround Commitment" centered size="lg"><Stack>
      <TextInput label="Commitment Title" placeholder="Example: Same-day retirement plaque" required value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.currentTarget.value }))}/>
      <SimpleGrid cols={{ base: 1, sm: 2 }}><TextInput label="Customer / Requestor" value={form.customerName} onChange={(event) => setForm((current) => ({ ...current, customerName: event.currentTarget.value }))}/><Select label="Priority" data={["Critical", "Urgent", "High"]} value={form.priority} onChange={(value) => setForm((current) => ({ ...current, priority: value || "Urgent" }))}/><DateTimePicker label="Required Completion" required value={form.requiredBy} onChange={(value) => setForm((current) => ({ ...current, requiredBy: value }))} minDate={new Date()}/><Select label="Assigned To" searchable clearable data={profiles.map((profile) => profile.display_name)} value={form.assignedTo} onChange={(value) => setForm((current) => ({ ...current, assignedTo: value || "" }))}/><Select label="Department" clearable data={["Design", "Laser", "Prep", "Welding", "Paint", "Powder", "Assembly", "QC", "Showroom", "Office"]} value={form.department} onChange={(value) => setForm((current) => ({ ...current, department: value || "" }))}/><Select label="Material Readiness" data={["Not Required", "Needs Pricing", "Needs Ordering", "Ordered", "Partially Received", "Ready", "Blocked"]} value={form.materialsStatus} onChange={(value) => setForm((current) => ({ ...current, materialsStatus: value || "Not Required" }))}/></SimpleGrid>
      <Textarea label="Description" minRows={2} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.currentTarget.value }))}/><TextInput label="Reason for Quick Turnaround" placeholder="Why is this commitment urgent?" value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.currentTarget.value }))}/><Textarea label="Operations Notes" minRows={2} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.currentTarget.value }))}/>
      <Button h={52} color="red" fullWidth disabled={!form.title.trim() || !form.requiredBy || saving} leftSection={saving ? <Loader size={18} color="white"/> : <IconBolt size={19}/>} onClick={saveCommitment}>Create Quick Commitment</Button>
    </Stack></Modal>
  </Stack>;
}

export default QuickTurnaroundDashboard;