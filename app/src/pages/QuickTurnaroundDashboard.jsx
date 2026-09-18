import {
  Alert, Badge, Button, Group, Loader, Modal, Paper, Select, SimpleGrid,
  Stack, Text, Textarea, TextInput, ThemeIcon, Title,
} from "@mantine/core";
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
  requiredBy: "", requiredTime: "17:00", dateReceived: new Date().toISOString().slice(0, 10),
  assignedTo: "", department: "", materialsStatus: "Not Required",
  reasonCategory: "Deadline", reason: "", notes: "",
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

function QuickTurnaroundDashboard({ setPage, activeUser, readOnly = false }) {
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

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function saveCommitment() {
    if (!form.title.trim() || !form.requiredBy || saving) return;
    setSaving(true);
    try {
      const materialsRequired = form.materialsStatus !== "Not Required";
      const { error } = await supabase.rpc("mw_save_quick_turnaround_commitment", {
        p_id: null, p_source_type: "Manual", p_source_id: null, p_source_number: null,
        p_title: form.title.trim(), p_customer_name: form.customerName.trim() || null,
        p_description: form.description.trim() || null, p_priority: form.priority,
        p_status: "Open", p_required_by: new Date(`${form.requiredBy}T${form.requiredTime || "17:00"}:00`).toISOString(),
        p_assigned_to: form.assignedTo || null, p_department: form.department || null,
        p_materials_required: materialsRequired, p_materials_status: form.materialsStatus,
        p_reason: form.reason.trim() || null, p_notes: form.notes.trim() || null,
        p_created_by: activeUser || null, p_date_received: form.dateReceived || null,
        p_hot_reason_category: form.reasonCategory,
      });
      if (error) throw error;
      setModalOpen(false); setForm(EMPTY_FORM); await loadData();
      notifications.show({ title: "Hot Artwork Added", message: "The artwork is now visible on the TV Huddle.", color: "green", icon: <IconCheck size={18}/> });
    } catch (error) {
      notifications.show({ title: "Commitment Save Failed", message: error.message, color: "red" });
    } finally { setSaving(false); }
  }

  async function updateStatus(id, status) {
    const { error } = await supabase.rpc("mw_update_quick_turnaround_status", { p_id: id, p_status: status, p_employee: activeUser || null });
    if (error) notifications.show({ title: "Status Update Failed", message: error.message, color: "red" });
    else await loadData();
  }

  if (loading) return <Stack gap="xl"><MWPageHeader title="Hot Artwork" subtitle="Loading this week’s artwork priorities." setPage={setPage} showBack backPage="dashboard" backLabel="Mission Control" showDashboard={false}/><MWPanel><Group justify="center" py={90}><Loader color="red"/><Text c="dimmed">Loading hot artwork…</Text></Group></MWPanel></Stack>;

  return <Stack gap="xl">
    <MWPageHeader title="Hot Artwork" subtitle="Weekly control for artwork with deadlines, customer escalations, or too much time in the shop." setPage={setPage} showBack backPage="dashboard" backLabel="Mission Control" showDashboard={false}/>
    <MWKpiStrip items={[
      { label: "Hot Artwork", value: active.length, description: "Open weekly priorities", icon: IconBolt, color: "red" },
      { label: "Due Today", value: dueToday, description: "Requires attention today", icon: IconClock, color: "yellow" },
      { label: "Overdue", value: overdue, description: "Past promised time", icon: IconAlertTriangle, color: "red" },
      { label: "Blocked", value: blocked, description: "Work or materials blocked", icon: IconPackage, color: "orange" },
    ]} columns={{ base: 1, sm: 2, xl: 4 }} compact/>

    <MWPanel title="Hot Artwork Controls" subtitle="Filter the list or add artwork that needs weekly visibility" icon={IconBolt}>
      <Group justify="space-between">
        <Group><Select w={190} value={statusFilter} onChange={(value) => setStatusFilter(value || "Active")} data={["Active", "Open", "Acknowledged", "In Progress", "Blocked", "Completed", "Cancelled", { value: "all", label: "All Statuses" }]}/><Select w={170} value={priorityFilter} onChange={(value) => setPriorityFilter(value || "all")} data={[{ value: "all", label: "All Priorities" }, "Critical", "Urgent", "High"]}/><Button variant="light" color="gray" leftSection={<IconRefresh size={17}/>} onClick={loadData}>Refresh</Button></Group>
        {!readOnly && <Button color="red" leftSection={<IconPlus size={18}/>} onClick={() => setModalOpen(true)}>Add Hot Artwork</Button>}
      </Group>
    </MWPanel>

    <MWPanel title="Hot Artwork This Week" subtitle={`${filtered.length} artwork priorit${filtered.length === 1 ? "y" : "ies"} shown`} icon={IconClock}>
      {!filtered.length ? <Alert color="gray" icon={<IconClock size={19}/>}>No commitments match the current filters.</Alert> : <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="md">{filtered.map((item) => <Paper key={item.id} p="lg" radius="lg" style={{ background: "rgba(255,255,255,.025)", border: `1px solid ${item.timing_status === "Overdue" ? "rgba(250,82,82,.55)" : "rgba(255,255,255,.08)"}` }}><Stack gap="md">
        <Group justify="space-between" align="flex-start" wrap="nowrap"><Stack gap={4}><Group gap="xs"><Badge color={priorityColor(item.priority)}>{item.priority}</Badge><Badge color={timingColor(item.timing_status)} variant="light">{item.timing_status}</Badge><Badge color="gray" variant="light">{item.source_type}</Badge></Group><Title order={3}>{item.title}</Title><Text c="dimmed" size="sm">{[item.customer_name, item.source_number].filter(Boolean).join(" · ") || "Internal Metal Worx commitment"}</Text></Stack><ThemeIcon size={48} radius="lg" color={timingColor(item.timing_status)} variant="light"><IconBolt size={24}/></ThemeIcon></Group>
        <Paper p="sm" withBorder><Group justify="space-between"><Group gap="xs"><IconClock size={18}/><Text fw={800}>Required {formatDue(item.required_by)}</Text></Group><Text fw={900} c={item.timing_status === "Overdue" ? "red.4" : "gray.1"}>{item.timing_status === "Overdue" ? "PAST DUE" : `${Math.round(Number(item.hours_remaining || 0))} hrs`}</Text></Group></Paper>
        <SimpleGrid cols={{ base: 2, sm: 4 }}><Stack gap={2}><Text size="xs" c="dimmed" fw={800}>ASSIGNED TO</Text><Text fw={750}>{item.assigned_to || "Unassigned"}</Text></Stack><Stack gap={2}><Text size="xs" c="dimmed" fw={800}>CURRENT STATION</Text><Text fw={750}>{item.department || "Not assigned"}</Text></Stack><Stack gap={2}><Text size="xs" c="dimmed" fw={800}>DAYS IN SHOP</Text><Text fw={900} c={Number(item.days_in_shop || 0) >= 14 ? "red.4" : "gray.1"}>{item.days_in_shop || 0}</Text></Stack><Stack gap={2}><Text size="xs" c="dimmed" fw={800}>WHY HOT</Text><Badge w="fit-content" color={item.hot_reason_category === "Aging" ? "orange" : "red"} variant="light">{item.hot_reason_category || "Deadline"}</Badge></Stack></SimpleGrid>
        {item.description && <Text size="sm">{item.description}</Text>}
        {!readOnly && <Group grow>{item.status === "Open" && <Button color="blue" variant="light" leftSection={<IconCheck size={17}/>} onClick={() => updateStatus(item.id, "Acknowledged")}>Acknowledge</Button>}{["Open", "Acknowledged"].includes(item.status) && <Button color="orange" variant="light" leftSection={<IconPlayerPlay size={17}/>} onClick={() => updateStatus(item.id, "In Progress")}>Start Work</Button>}{!["Completed", "Cancelled"].includes(item.status) && <Button color="green" leftSection={<IconCheck size={17}/>} onClick={() => updateStatus(item.id, "Completed")}>Complete</Button>}</Group>}
      </Stack></Paper>)}</SimpleGrid>}
    </MWPanel>

    <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title="Add Hot Artwork" centered size="lg"><Stack>
      <TextInput label="Artwork / Order Name" placeholder="Example: 24-inch ASOS Double Logo Flag" required value={form.title} onChange={(event) => updateForm("title", event.currentTarget.value)}/>
      <SimpleGrid cols={{ base: 1, sm: 2 }}><TextInput label="Customer / Requestor" value={form.customerName} onChange={(event) => updateForm("customerName", event.currentTarget.value)}/><Select label="Why Is It Hot?" data={["Deadline", "Aging", "Customer Escalation", "Other"]} value={form.reasonCategory} onChange={(value) => updateForm("reasonCategory", value || "Deadline")}/><TextInput label="Date Received" type="date" required value={form.dateReceived} max={new Date().toISOString().slice(0, 10)} onChange={(event) => updateForm("dateReceived", event.currentTarget.value)}/><Select label="Priority" data={["Critical", "Urgent", "High"]} value={form.priority} onChange={(value) => updateForm("priority", value || "Urgent")}/><TextInput label="Required Completion Date" type="date" required value={form.requiredBy} min={new Date().toISOString().slice(0, 10)} onChange={(event) => updateForm("requiredBy", event.currentTarget.value)}/><TextInput label="Required Time" type="time" value={form.requiredTime} onChange={(event) => updateForm("requiredTime", event.currentTarget.value)}/><Select label="Assigned To" searchable clearable data={profiles.map((profile) => profile.display_name)} value={form.assignedTo} onChange={(value) => updateForm("assignedTo", value || "")}/><Select label="Current Station" clearable data={["Design", "Customer Approval", "Laser", "Prep", "Welding", "Paint", "Powder", "Assembly", "Final QC", "Showroom", "Office"]} value={form.department} onChange={(value) => updateForm("department", value || "")}/><Select label="Material Readiness" data={["Not Required", "Needs Pricing", "Needs Ordering", "Ordered", "Partially Received", "Ready", "Blocked"]} value={form.materialsStatus} onChange={(value) => updateForm("materialsStatus", value || "Not Required")}/></SimpleGrid>
      <Textarea label="Description" minRows={2} value={form.description} onChange={(event) => updateForm("description", event.currentTarget.value)}/><TextInput label="Reason / Concern" placeholder="Deadline details, customer concern, or why it has been here too long" value={form.reason} onChange={(event) => updateForm("reason", event.currentTarget.value)}/><Textarea label="Operations Notes" minRows={2} value={form.notes} onChange={(event) => updateForm("notes", event.currentTarget.value)}/>
      <Button h={52} color="red" fullWidth disabled={!form.title.trim() || !form.requiredBy || !form.dateReceived || saving} leftSection={saving ? <Loader size={18} color="white"/> : <IconBolt size={19}/>} onClick={saveCommitment}>Add to Hot Artwork</Button>
    </Stack></Modal>
  </Stack>;
}

export default QuickTurnaroundDashboard;
