import {
  Alert, Badge, Button, Group, Loader, Modal, Paper, Select, SimpleGrid,
  Stack, Switch, Text, Textarea, TextInput, ThemeIcon, Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconAlertTriangle, IconBolt, IconCheck, IconClock, IconPackage,
  IconPlayerPlay, IconPlus, IconRefresh,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { supabase } from "../lib/supabase";
import { getDashboardData } from "../services/dashboardService";
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
  if (!value) return "No completion date";
  return new Date(value).toLocaleString("en-US", {
    weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

function QuickTurnaroundDashboard({ setPage, setSelectedCustomerOrder, activeUser, readOnly = false }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [commitments, setCommitments] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [statusFilter, setStatusFilter] = useState("Active");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [artworkOrders, setArtworkOrders] = useState([]);
  const [viewMode, setViewMode] = useState("hot");
  const [savingHuddleOrder, setSavingHuddleOrder] = useState("");
  const [formAttempted, setFormAttempted] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [commitmentResult, profileResult, dashboardData] = await Promise.all([
        supabase.from("quick_turnaround_dashboard").select("*").order("attention_rank").order("required_by"),
        supabase.from("employee_profiles").select("display_name,profile_type,is_active").eq("is_active", true).order("display_name"),
        getDashboardData(),
      ]);
      if (commitmentResult.error) throw commitmentResult.error;
      setCommitments(commitmentResult.data || []);
      setProfiles(profileResult.data || []);
      setArtworkOrders(dashboardData?.artworkOrders || []);
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
  const activeTitles = new Set(active.map((item) => String(item.title || "").trim().toLowerCase()).filter(Boolean));
  const activeSourceIds = new Set(active.map((item) => String(item.source_id || "")).filter(Boolean));
  const unlinkedArtwork = artworkOrders.filter((order) =>
    !activeSourceIds.has(String(order.id)) &&
    !activeTitles.has(String(order.title || "").trim().toLowerCase())
  );
  const promotedArtwork = unlinkedArtwork.filter((order) => order.showOnHuddle || order.dueDate || Number(order.businessDaysInShop || 0) >= 12);
  const regularArtwork = unlinkedArtwork
    .filter((order) => !order.showOnHuddle && !order.dueDate && Number(order.businessDaysInShop || 0) < 12)
    .sort((left, right) => Number(right.businessDaysInShop || 0) - Number(left.businessDaysInShop || 0));
  const agingSoon = regularArtwork.filter((order) => Number(order.businessDaysInShop || 0) >= 10).length;
  const overdue = active.filter((item) => item.timing_status === "Overdue").length;
  const dueToday = active.filter((item) => ["Due Today", "Due Soon"].includes(item.timing_status)).length;
  const blocked = active.filter((item) => item.status === "Blocked" || item.materials_status === "Blocked").length;

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function saveCommitment() {
    if (saving) return;
    setFormAttempted(true);
    const missingFields = [
      !form.title.trim() && "Artwork / Order Name",
      !form.customerName.trim() && "Customer / Requestor",
    ].filter(Boolean);
    if (missingFields.length) {
      notifications.show({
        title: "Complete the required fields",
        message: `Still needed: ${missingFields.join(", ")}.`,
        color: "orange",
      });
      return;
    }
    setSaving(true);
    try {
      const materialsRequired = form.materialsStatus !== "Not Required";
      const { error } = await supabase.rpc("mw_save_quick_turnaround_commitment", {
        p_id: null, p_source_type: "Manual", p_source_id: null, p_source_number: null,
        p_title: form.title.trim(), p_customer_name: form.customerName.trim() || null,
        p_description: form.description.trim() || null, p_priority: form.priority,
        p_status: "Open", p_required_by: form.requiredBy ? new Date(`${form.requiredBy}T${form.requiredTime || "17:00"}:00`).toISOString() : null,
        p_assigned_to: form.assignedTo || null, p_department: form.department || null,
        p_materials_required: materialsRequired, p_materials_status: form.materialsStatus,
        p_reason: form.reason.trim() || null, p_notes: form.notes.trim() || null,
        p_created_by: activeUser || null, p_date_received: form.dateReceived || null,
        p_hot_reason_category: form.reasonCategory,
      });
      if (error) throw error;
      setModalOpen(false); setForm(EMPTY_FORM); setFormAttempted(false); await loadData();
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

  async function toggleHuddleOrder(order, checked) {
    setSavingHuddleOrder(String(order.id));
    const { error } = await supabase.from("customer_orders").update({ show_on_huddle: checked }).eq("id", order.id);
    if (error) notifications.show({ title: "Hot Items List Not Updated", message: error.message, color: "red" });
    else {
      notifications.show({ title: checked ? "Added to Hot Items" : "Removed from Hot Items", message: `${order.title} ${checked ? "will appear" : "will no longer appear unless it has a date or reaches 12 business days"} on the TV Huddle.`, color: checked ? "green" : "gray" });
      await loadData();
    }
    setSavingHuddleOrder("");
  }

  if (loading) return <Stack gap="xl"><MWPageHeader title="Hot Artwork" subtitle="Loading this week’s artwork priorities." setPage={setPage} showBack backPage="dashboard" backLabel="Mission Control" showDashboard={false}/><MWPanel><Group justify="center" py={90}><Loader color="red"/><Text c="dimmed">Loading hot artwork…</Text></Group></MWPanel></Stack>;

  return <Stack gap="xl">
    <MWPageHeader title="Hot Artwork" subtitle="Weekly control for artwork with deadlines, customer escalations, or too much time in the shop." setPage={setPage} showBack backPage="dashboard" backLabel="Mission Control" showDashboard={false}/>
    <MWKpiStrip items={[
      { label: "Hot Items", value: active.length + promotedArtwork.length, description: "Selected, dated, or 12+ business days", icon: IconBolt, color: "red" },
      { label: "Artwork Orders", value: regularArtwork.length, description: "Regular open artwork", icon: IconPackage, color: "blue" },
      { label: "Aging Soon", value: agingSoon, description: "10–11 business days", icon: IconClock, color: "orange" },
      { label: "Due Today", value: dueToday, description: "Requires attention today", icon: IconClock, color: "yellow" },
      { label: "Overdue / Blocked", value: overdue + blocked, description: "Requires immediate attention", icon: IconAlertTriangle, color: "red" },
    ]} columns={{ base: 1, sm: 2, xl: 5 }} compact/>

    <MWPanel title="Hot Artwork Controls" subtitle="Filter the list or add artwork that needs weekly visibility" icon={IconBolt}>
      <Group justify="space-between">
        <Group><Button color="red" variant={viewMode === "hot" ? "filled" : "light"} onClick={() => setViewMode("hot")}>Hot Items ({active.length + promotedArtwork.length})</Button><Button color="blue" variant={viewMode === "orders" ? "filled" : "light"} onClick={() => setViewMode("orders")}>Artwork Orders ({unlinkedArtwork.length})</Button><Button variant="light" color="gray" leftSection={<IconRefresh size={17}/>} onClick={loadData}>Refresh</Button></Group>
        {!readOnly && <Button color="red" leftSection={<IconPlus size={18}/>} onClick={() => { setFormAttempted(false); setModalOpen(true); }}>Add Hot Artwork</Button>}
      </Group>
    </MWPanel>

    {viewMode === "hot" ? <>
    <MWPanel title="Hot Artwork Filters" subtitle="Refine manually prioritized artwork" icon={IconBolt}>
      <Group><Select w={190} value={statusFilter} onChange={(value) => setStatusFilter(value || "Active")} data={["Active", "Open", "Acknowledged", "In Progress", "Blocked", "Completed", "Cancelled", { value: "all", label: "All Statuses" }]}/><Select w={170} value={priorityFilter} onChange={(value) => setPriorityFilter(value || "all")} data={[{ value: "all", label: "All Priorities" }, "Critical", "Urgent", "High"]}/></Group>
    </MWPanel>
    <MWPanel title="Hot Items This Week" subtitle={`${filtered.length + promotedArtwork.length} selected, dated, or aging item${filtered.length + promotedArtwork.length === 1 ? "" : "s"} shown`} icon={IconClock}>
      {promotedArtwork.length > 0 && <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="md" mb="md">{promotedArtwork.map((item) => { const aged=Number(item.businessDaysInShop||0)>=12; const automatic=Boolean(item.dueDate)||aged; return <Paper key={`promoted-${item.id}`} p="lg" radius="lg" withBorder><Stack gap="sm"><Group justify="space-between"><Badge color={item.dueDate?"red":aged?"orange":"blue"}>{item.dueDate?"DATED ORDER":aged?"12+ BUSINESS DAYS":"SELECTED FOR HUDDLE"}</Badge>{!automatic && <Switch checked={Boolean(item.showOnHuddle)} disabled={savingHuddleOrder===String(item.id)} label="Show on TV Huddle" onChange={(event)=>toggleHuddleOrder(item,event.currentTarget.checked)}/>}</Group><Title order={3}>{item.title}</Title><Text c="dimmed">{item.customer} · {item.department}</Text><Group justify="space-between"><Text fw={900} c={aged?"red.4":"gray.1"}>{item.businessDaysInShop} business days</Text><Text>{item.dueDate?`Requested ${new Date(`${item.dueDate}T12:00:00`).toLocaleDateString()}`:item.owner}</Text></Group><Button variant="light" color="gray" onClick={() => { setSelectedCustomerOrder?.({ id:item.id }); setPage("customerOrderDetails"); }}>Open Order</Button></Stack></Paper>})}</SimpleGrid>}
      {!filtered.length ? <Alert color="gray" icon={<IconClock size={19}/>}>No commitments match the current filters.</Alert> : <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="md">{filtered.map((item) => <Paper key={item.id} p="lg" radius="lg" style={{ background: "rgba(255,255,255,.025)", border: `1px solid ${item.timing_status === "Overdue" ? "rgba(250,82,82,.55)" : "rgba(255,255,255,.08)"}` }}><Stack gap="md">
        <Group justify="space-between" align="flex-start" wrap="nowrap"><Stack gap={4}><Group gap="xs"><Badge color={priorityColor(item.priority)}>{item.priority}</Badge><Badge color={timingColor(item.timing_status)} variant="light">{item.timing_status}</Badge><Badge color="gray" variant="light">{item.source_type}</Badge></Group><Title order={3}>{item.title}</Title><Text c="dimmed" size="sm">{[item.customer_name, item.source_number].filter(Boolean).join(" · ") || "Internal Metal Worx commitment"}</Text></Stack><ThemeIcon size={48} radius="lg" color={timingColor(item.timing_status)} variant="light"><IconBolt size={24}/></ThemeIcon></Group>
        <Paper p="sm" withBorder><Group justify="space-between"><Group gap="xs"><IconClock size={18}/><Text fw={800}>{item.required_by ? `Required ${formatDue(item.required_by)}` : "Completion date not set"}</Text></Group><Text fw={900} c={item.timing_status === "Overdue" ? "red.4" : "gray.1"}>{!item.required_by ? "DATE OPEN" : item.timing_status === "Overdue" ? "PAST DUE" : `${Math.round(Number(item.hours_remaining || 0))} hrs`}</Text></Group></Paper>
        <SimpleGrid cols={{ base: 2, sm: 4 }}><Stack gap={2}><Text size="xs" c="dimmed" fw={800}>ASSIGNED TO</Text><Text fw={750}>{item.assigned_to || "Unassigned"}</Text></Stack><Stack gap={2}><Text size="xs" c="dimmed" fw={800}>CURRENT STATION</Text><Text fw={750}>{item.department || "Not assigned"}</Text></Stack><Stack gap={2}><Text size="xs" c="dimmed" fw={800}>DAYS IN SHOP</Text><Text fw={900} c={Number(item.days_in_shop || 0) >= 14 ? "red.4" : "gray.1"}>{item.days_in_shop || 0}</Text></Stack><Stack gap={2}><Text size="xs" c="dimmed" fw={800}>WHY HOT</Text><Badge w="fit-content" color={item.hot_reason_category === "Aging" ? "orange" : "red"} variant="light">{item.hot_reason_category || "Deadline"}</Badge></Stack></SimpleGrid>
        {item.description && <Text size="sm">{item.description}</Text>}
        {!readOnly && <Group grow>{item.status === "Open" && <Button color="blue" variant="light" leftSection={<IconCheck size={17}/>} onClick={() => updateStatus(item.id, "Acknowledged")}>Acknowledge</Button>}{["Open", "Acknowledged"].includes(item.status) && <Button color="orange" variant="light" leftSection={<IconPlayerPlay size={17}/>} onClick={() => updateStatus(item.id, "In Progress")}>Start Work</Button>}{!["Completed", "Cancelled"].includes(item.status) && <Button color="green" leftSection={<IconCheck size={17}/>} onClick={() => updateStatus(item.id, "Completed")}>Complete</Button>}</Group>}
      </Stack></Paper>)}</SimpleGrid>}
    </MWPanel>
    </> : <MWPanel title="Artwork Orders" subtitle="Choose undated orders for Hot Items; dated and 12-business-day orders appear automatically" icon={IconPackage}>
      {!unlinkedArtwork.length ? <Alert color="gray" icon={<IconPackage size={19}/>}>No artwork orders are waiting.</Alert> : <SimpleGrid cols={{ base:1, md:2, xl:3 }} spacing="md">{unlinkedArtwork.sort((left,right)=>Number(right.businessDaysInShop||0)-Number(left.businessDaysInShop||0)).map((item) => { const age=Number(item.businessDaysInShop||0); const automatic=Boolean(item.dueDate)||age>=12; return <Paper key={item.id} p="md" radius="lg" withBorder><Stack gap="sm"><Group justify="space-between"><Badge color={item.dueDate?"red":age>=12?"orange":item.showOnHuddle?"blue":age>=10?"orange":"gray"}>{item.dueDate?"DATED":age>=12?"AGING":item.showOnHuddle?"ON HUDDLE":age>=10?"AGING SOON":"REGULAR"}</Badge><Text fw={900} c={age>=10?"orange.4":"gray.1"}>{age} business day{age===1?"":"s"}</Text></Group><Title order={4}>{item.title}</Title><Text size="sm" c="dimmed">{item.customer}</Text><Switch checked={automatic||Boolean(item.showOnHuddle)} disabled={automatic||savingHuddleOrder===String(item.id)} label={automatic?item.dueDate?"Automatically shown because it has a date":"Automatically shown at 12 business days":"Show on Hot Items This Week"} onChange={(event)=>toggleHuddleOrder(item,event.currentTarget.checked)}/><SimpleGrid cols={2}><div><Text size="xs" c="dimmed" fw={800}>STATION</Text><Text size="sm" fw={750}>{item.department}</Text></div><div><Text size="xs" c="dimmed" fw={800}>LEAD</Text><Text size="sm" fw={750}>{item.owner}</Text></div></SimpleGrid><Text size="sm">{item.dueDate ? `Requested ${new Date(`${item.dueDate}T12:00:00`).toLocaleDateString()}` : "No requested date"}</Text><Button variant="light" color="gray" onClick={() => { setSelectedCustomerOrder?.({ id:item.id }); setPage("customerOrderDetails"); }}>Open Order</Button></Stack></Paper>})}</SimpleGrid>}
    </MWPanel>}

    <Modal opened={modalOpen} onClose={() => { setModalOpen(false); setFormAttempted(false); }} title="Add Hot Artwork" centered size="lg"><Stack>
      <Alert color="blue" variant="light">Only the artwork name and customer are required. Dates, assignment, station, and notes can be added later.</Alert>
      <TextInput label="Artwork / Order Name" placeholder="Example: 24-inch ASOS Double Logo Flag" required error={formAttempted && !form.title.trim() ? "Enter the artwork or order name" : null} value={form.title} onChange={(event) => updateForm("title", event.currentTarget.value)}/>
      <SimpleGrid cols={{ base: 1, sm: 2 }}><TextInput label="Customer / Requestor" required error={formAttempted && !form.customerName.trim() ? "Enter who the artwork is for" : null} value={form.customerName} onChange={(event) => updateForm("customerName", event.currentTarget.value)}/><Select label="Why Is It Hot?" data={["Deadline", "Aging", "Customer Escalation", "Other"]} value={form.reasonCategory} onChange={(value) => updateForm("reasonCategory", value || "Deadline")}/><TextInput label="Date Received" type="date" value={form.dateReceived} max={new Date().toISOString().slice(0, 10)} onChange={(event) => updateForm("dateReceived", event.currentTarget.value)}/><Select label="Priority" data={["Critical", "Urgent", "High"]} value={form.priority} onChange={(value) => updateForm("priority", value || "Urgent")}/><TextInput label="Required Completion Date" type="date" value={form.requiredBy} min={new Date().toISOString().slice(0, 10)} onChange={(event) => updateForm("requiredBy", event.currentTarget.value)}/><TextInput label="Required Time" type="time" value={form.requiredTime} disabled={!form.requiredBy} onChange={(event) => updateForm("requiredTime", event.currentTarget.value)}/><Select label="Assigned To" searchable clearable data={profiles.map((profile) => profile.display_name)} value={form.assignedTo} onChange={(value) => updateForm("assignedTo", value || "")}/><Select label="Current Station" clearable data={["Design", "Customer Approval", "Laser", "Prep", "Welding", "Paint", "Powder", "Assembly", "Final QC", "Showroom", "Office"]} value={form.department} onChange={(value) => updateForm("department", value || "")}/><Select label="Material Readiness" data={["Not Required", "Needs Pricing", "Needs Ordering", "Ordered", "Partially Received", "Ready", "Blocked"]} value={form.materialsStatus} onChange={(value) => updateForm("materialsStatus", value || "Not Required")}/></SimpleGrid>
      <Textarea label="Description" minRows={2} value={form.description} onChange={(event) => updateForm("description", event.currentTarget.value)}/><TextInput label="Reason / Concern" placeholder="Deadline details, customer concern, or why it has been here too long" value={form.reason} onChange={(event) => updateForm("reason", event.currentTarget.value)}/><Textarea label="Operations Notes" minRows={2} value={form.notes} onChange={(event) => updateForm("notes", event.currentTarget.value)}/>
      <Button h={52} color="red" fullWidth disabled={saving} leftSection={saving ? <Loader size={18} color="white"/> : <IconBolt size={19}/>} onClick={saveCommitment}>Add to Hot Artwork</Button>
    </Stack></Modal>
  </Stack>;
}

export default QuickTurnaroundDashboard;
