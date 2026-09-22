import { useEffect, useMemo, useState } from "react";
import {
  Alert, Badge, Button, Card, Checkbox, Group, NumberInput, Select,
  SimpleGrid, Stack, Tabs, Text, Textarea, TextInput, Title,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import { IconAlertTriangle, IconCheck, IconClipboardCheck, IconMessage, IconPlus } from "@tabler/icons-react";

import { supabase } from "../lib/supabase";

const BLOCK_REASONS = [
  "Waiting on Customer", "Waiting on Material", "Waiting on Design",
  "Waiting on Payment", "Waiting on Site Access", "Equipment Problem",
  "Scheduling Conflict", "Other",
];

function money(value) {
  return Number(value || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function dateValue(value) {
  return value ? new Date(`${String(value).slice(0, 10)}T12:00:00`) : null;
}

function ProjectControlCenter({ project, activeUser, onProjectUpdated }) {
  const [changeOrders, setChangeOrders] = useState([]);
  const [communications, setCommunications] = useState([]);
  const [files, setFiles] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [saving, setSaving] = useState(false);
  const [nextActionDraft, setNextActionDraft] = useState({ action: "", owner: "", due: null });
  const [blockerDraft, setBlockerDraft] = useState({ reason: null, details: "" });
  const [closeoutDraft, setCloseoutDraft] = useState({ signoffName: "", warrantyDate: null, finalPhotos: false });
  const [changeDraft, setChangeDraft] = useState({ title: "", description: "", reason: "", amount_delta: 0, schedule_days_delta: 0 });
  const [communicationDraft, setCommunicationDraft] = useState({ communication_type: "Phone Call", direction: "Outgoing", contact_name: project?.contact_name || "", subject: "", summary: "", follow_up_required: false, follow_up_due: null });

  async function loadControls() {
    if (!project?.id) return;
    const [changes, comms, fileResult, quoteResult] = await Promise.all([
      supabase.from("project_change_orders").select("*").eq("project_id", project.id).order("created_at", { ascending: false }),
      supabase.from("project_communications").select("*").eq("project_id", project.id).order("created_at", { ascending: false }),
      supabase.from("project_files").select("id,category,story_stage,customer_visible,created_at").eq("project_id", project.id),
      supabase.from("project_quotes").select("id,quote_number,status,valid_until,revision_number,is_current_revision,total_amount").eq("project_id", project.id).order("revision_number", { ascending: false }),
    ]);
    const error = changes.error || comms.error || fileResult.error || quoteResult.error;
    if (error) {
      notifications.show({ title: "Project Controls Could Not Load", message: error.message, color: "red" });
      return;
    }
    setChangeOrders(changes.data || []);
    setCommunications(comms.data || []);
    setFiles(fileResult.data || []);
    setQuotes(quoteResult.data || []);
  }

  useEffect(() => { loadControls(); }, [project?.id]);

  useEffect(() => {
    setNextActionDraft({ action: project?.next_action || "", owner: project?.next_action_owner || project?.assigned_to || "", due: dateValue(project?.next_action_due) });
    setBlockerDraft({ reason: project?.blocked_reason_category || null, details: project?.blocked_details || "" });
    setCloseoutDraft({ signoffName: project?.customer_signoff_by || "", warrantyDate: dateValue(project?.warranty_expires_at), finalPhotos: Boolean(project?.final_photos_confirmed) });
  }, [project]);

  const alerts = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const result = [];
    if (project.next_action_due && dateValue(project.next_action_due) < today) result.push("Next action is overdue");
    if (project.promised_quote_date && dateValue(project.promised_quote_date) < today && !["Sent", "Approved"].includes(project.quote_status)) result.push("Promised quote date has passed");
    communications.filter((item) => item.follow_up_required && !item.follow_up_completed_at && item.follow_up_due && dateValue(item.follow_up_due) <= today).forEach(() => result.push("Customer follow-up is due"));
    quotes.filter((quote) => quote.is_current_revision && quote.status !== "Approved" && quote.valid_until && dateValue(quote.valid_until) < today).forEach(() => result.push("Current quote has expired"));
    if (project.blocked_reason_category) result.push(`Blocked: ${project.blocked_reason_category}`);
    return [...new Set(result)];
  }, [communications, project, quotes]);

  const closeout = useMemo(() => {
    const completionPhotos = files.filter((file) => ["Completion Photo", "Installation Photo"].includes(file.category) || file.story_stage === "Completed Project").length;
    return [
      ["Final inspection completed", ["Completed", "Passed"].includes(project.final_inspection_status)],
      ["Final photographs uploaded", project.final_photos_confirmed || completionPhotos > 0],
      ["Customer sign-off recorded", Boolean(project.customer_signoff_at)],
      ["Story Board completion stage documented", files.some((file) => file.story_stage === "Completed Project")],
      ["Final balance resolved", Number(project.balance_due || 0) <= 0 || project.closeout_financial_bypass],
    ];
  }, [files, project]);

  async function updateProject(updates, title = "Project controls updated") {
    setSaving(true);
    const { error } = await supabase.from("projects").update(updates).eq("id", project.id);
    setSaving(false);
    if (error) return notifications.show({ title: "Update Failed", message: error.message, color: "red" });
    notifications.show({ title, message: "The project record and reminders were updated.", color: "green" });
    await onProjectUpdated?.();
  }

  async function addChangeOrder() {
    if (!changeDraft.title.trim()) return;
    setSaving(true);
    const nextSequence = Math.max(0, ...changeOrders.map((item) => Number(String(item.change_order_number || "").replace(/\D/g, "")) || 0)) + 1;
    const nextNumber = `CO-${String(nextSequence).padStart(3, "0")}`;
    const { error } = await supabase.from("project_change_orders").insert({
      project_id: project.id, change_order_number: nextNumber, ...changeDraft,
      created_by: activeUser || null,
    });
    setSaving(false);
    if (error) return notifications.show({ title: "Change Order Could Not Be Added", message: error.message, color: "red" });
    setChangeDraft({ title: "", description: "", reason: "", amount_delta: 0, schedule_days_delta: 0 });
    await loadControls();
  }

  async function updateChangeOrder(item, status) {
    const approvalName = status === "Approved" ? window.prompt("Customer approval name:") : null;
    if (status === "Approved" && !approvalName?.trim()) return;
    const { error } = await supabase.from("project_change_orders").update({
      status,
      customer_approval_name: status === "Approved" ? approvalName.trim() : item.customer_approval_name,
      customer_approved_at: status === "Approved" ? new Date().toISOString() : item.customer_approved_at,
      updated_at: new Date().toISOString(),
    }).eq("id", item.id);
    if (error) return notifications.show({ title: "Change Order Could Not Update", message: error.message, color: "red" });
    if (status === "Approved" && Number(item.amount_delta || 0) !== 0) {
      await updateProject({
        contract_total: Number(project.contract_total || 0) + Number(item.amount_delta || 0),
        balance_due: Number(project.balance_due || 0) + Number(item.amount_delta || 0),
      }, "Change order approved");
    }
    await loadControls();
  }

  async function addCommunication() {
    if (!communicationDraft.summary.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("project_communications").insert({
      project_id: project.id,
      ...communicationDraft,
      follow_up_due: communicationDraft.follow_up_due ? communicationDraft.follow_up_due.toISOString().slice(0, 10) : null,
      recorded_by: activeUser || null,
    });
    setSaving(false);
    if (error) return notifications.show({ title: "Communication Could Not Be Saved", message: error.message, color: "red" });
    setCommunicationDraft({ communication_type: "Phone Call", direction: "Outgoing", contact_name: project.contact_name || "", subject: "", summary: "", follow_up_required: false, follow_up_due: null });
    await loadControls();
  }

  async function completeFollowUp(item) {
    const { error } = await supabase.from("project_communications").update({ follow_up_completed_at: new Date().toISOString() }).eq("id", item.id);
    if (error) return notifications.show({ title: "Follow-Up Could Not Update", message: error.message, color: "red" });
    await loadControls();
  }

  return <Stack gap="lg">
    {alerts.length > 0 && <Alert color="orange" icon={<IconAlertTriangle size={18} />} title="Project attention required">{alerts.join(" • ")}</Alert>}
    <Tabs defaultValue="actions">
      <Tabs.List grow><Tabs.Tab value="actions">Next Action & Blockers</Tabs.Tab><Tabs.Tab value="changes">Change Orders ({changeOrders.length})</Tabs.Tab><Tabs.Tab value="communications">Communication ({communications.length})</Tabs.Tab><Tabs.Tab value="closeout">Closeout Readiness</Tabs.Tab></Tabs.List>

      <Tabs.Panel value="actions" pt="lg"><SimpleGrid cols={{ base: 1, lg: 2 }}>
        <Card withBorder radius="lg" p="lg"><Stack><Title order={4}>Unified Next Action</Title><TextInput label="What happens next?" value={nextActionDraft.action} onChange={(event) => setNextActionDraft((draft) => ({ ...draft, action: event.currentTarget.value }))} /><TextInput label="Owner" value={nextActionDraft.owner} onChange={(event) => setNextActionDraft((draft) => ({ ...draft, owner: event.currentTarget.value }))} /><DateInput label="Due date" value={nextActionDraft.due} onChange={(value) => setNextActionDraft((draft) => ({ ...draft, due: value }))} clearable /><Button color="red" loading={saving} onClick={() => updateProject({ next_action: nextActionDraft.action || null, next_action_owner: nextActionDraft.owner || null, next_action_due: nextActionDraft.due ? nextActionDraft.due.toISOString().slice(0, 10) : null })}>Save Next Action</Button></Stack></Card>
        <Card withBorder radius="lg" p="lg"><Stack><Title order={4}>Blocked / Waiting</Title><Select label="Reason" data={BLOCK_REASONS} value={blockerDraft.reason} onChange={(value) => setBlockerDraft((draft) => ({ ...draft, reason: value }))} clearable /><Textarea label="Details" value={blockerDraft.details} onChange={(event) => setBlockerDraft((draft) => ({ ...draft, details: event.currentTarget.value }))} minRows={3} /><Group grow><Button color="orange" loading={saving} disabled={!blockerDraft.reason} onClick={() => updateProject({ blocked_reason_category: blockerDraft.reason, blocked_details: blockerDraft.details || null, status: "On Hold" })}>Mark Blocked</Button><Button variant="light" color="green" onClick={() => updateProject({ blocked_reason_category: null, blocked_details: null, status: project.status === "On Hold" ? "In Progress" : project.status }, "Blocker cleared")}>Clear Blocker</Button></Group></Stack></Card>
      </SimpleGrid></Tabs.Panel>

      <Tabs.Panel value="changes" pt="lg"><Stack><Card withBorder radius="lg" p="lg"><Stack><Title order={4}>New Change Order</Title><SimpleGrid cols={{ base: 1, md: 2 }}><TextInput label="Title" value={changeDraft.title} onChange={(e) => setChangeDraft((d) => ({ ...d, title: e.currentTarget.value }))} /><TextInput label="Reason" value={changeDraft.reason} onChange={(e) => setChangeDraft((d) => ({ ...d, reason: e.currentTarget.value }))} /><NumberInput label="Price change" value={changeDraft.amount_delta} onChange={(value) => setChangeDraft((d) => ({ ...d, amount_delta: Number(value || 0) }))} prefix="$" decimalScale={2} /><NumberInput label="Schedule change (days)" value={changeDraft.schedule_days_delta} onChange={(value) => setChangeDraft((d) => ({ ...d, schedule_days_delta: Number(value || 0) }))} /></SimpleGrid><Textarea label="Scope added or removed" value={changeDraft.description} onChange={(e) => setChangeDraft((d) => ({ ...d, description: e.currentTarget.value }))} /><Button leftSection={<IconPlus size={16} />} color="red" loading={saving} onClick={addChangeOrder}>Create Change Order</Button></Stack></Card>
        {changeOrders.map((item) => <Card key={item.id} withBorder radius="lg" p="md"><Group justify="space-between" align="flex-start"><div><Group gap="xs"><Text fw={900}>{item.change_order_number} · {item.title}</Text><Badge color={item.status === "Approved" ? "green" : item.status === "Declined" ? "red" : "orange"}>{item.status}</Badge></Group><Text size="sm" c="dimmed" mt={4}>{item.description || item.reason || "No description"}</Text></div><Text fw={900} c={Number(item.amount_delta) >= 0 ? "green" : "red"}>{money(item.amount_delta)}</Text></Group>{!['Approved','Declined','Cancelled'].includes(item.status) && <Group mt="md"><Button size="xs" variant="light" onClick={() => updateChangeOrder(item, "Sent")}>Mark Sent</Button><Button size="xs" color="green" onClick={() => updateChangeOrder(item, "Approved")}>Record Approval</Button><Button size="xs" color="red" variant="light" onClick={() => updateChangeOrder(item, "Declined")}>Declined</Button></Group>}</Card>)}</Stack></Tabs.Panel>

      <Tabs.Panel value="communications" pt="lg"><Stack><Card withBorder radius="lg" p="lg"><Stack><Title order={4}>Record Customer Communication</Title><SimpleGrid cols={{ base: 1, md: 3 }}><Select label="Type" data={["Phone Call","Email","Text Message","Meeting","Site Conversation","Other"]} value={communicationDraft.communication_type} onChange={(value) => setCommunicationDraft((d) => ({ ...d, communication_type: value }))} /><Select label="Direction" data={["Incoming","Outgoing","Internal"]} value={communicationDraft.direction} onChange={(value) => setCommunicationDraft((d) => ({ ...d, direction: value }))} /><TextInput label="Contact" value={communicationDraft.contact_name} onChange={(e) => setCommunicationDraft((d) => ({ ...d, contact_name: e.currentTarget.value }))} /></SimpleGrid><TextInput label="Subject" value={communicationDraft.subject} onChange={(e) => setCommunicationDraft((d) => ({ ...d, subject: e.currentTarget.value }))} /><Textarea label="What was discussed?" value={communicationDraft.summary} onChange={(e) => setCommunicationDraft((d) => ({ ...d, summary: e.currentTarget.value }))} minRows={3} /><Checkbox label="Follow-up required" checked={communicationDraft.follow_up_required} onChange={(e) => setCommunicationDraft((d) => ({ ...d, follow_up_required: e.currentTarget.checked }))} />{communicationDraft.follow_up_required && <DateInput label="Follow-up due" value={communicationDraft.follow_up_due} onChange={(value) => setCommunicationDraft((d) => ({ ...d, follow_up_due: value }))} />}<Button color="red" leftSection={<IconMessage size={16} />} loading={saving} onClick={addCommunication}>Save Communication</Button></Stack></Card>
        {communications.map((item) => <Card key={item.id} withBorder radius="lg" p="md"><Group justify="space-between" align="flex-start"><div><Group gap="xs"><Badge>{item.communication_type}</Badge><Badge color="gray" variant="light">{item.direction}</Badge><Text fw={900}>{item.subject || item.contact_name || "Customer communication"}</Text></Group><Text size="sm" mt="xs">{item.summary}</Text><Text size="xs" c="dimmed" mt="xs">{new Date(item.created_at).toLocaleString()} · {item.recorded_by || "Metal Worx"}</Text></div>{item.follow_up_required && !item.follow_up_completed_at && <Button size="xs" color="green" onClick={() => completeFollowUp(item)}>Complete Follow-Up</Button>}</Group></Card>)}</Stack></Tabs.Panel>

      <Tabs.Panel value="closeout" pt="lg"><Card withBorder radius="lg" p="lg"><Stack><Title order={4}>Project Closeout Readiness</Title>{closeout.map(([label, complete]) => <Group key={label} justify="space-between"><Text>{label}</Text><Badge color={complete ? "green" : "orange"} leftSection={complete ? <IconCheck size={12} /> : <IconAlertTriangle size={12} />}>{complete ? "Complete" : "Required"}</Badge></Group>)}<SimpleGrid cols={{ base: 1, md: 2 }}><TextInput label="Customer sign-off name" value={closeoutDraft.signoffName} onChange={(event) => setCloseoutDraft((draft) => ({ ...draft, signoffName: event.currentTarget.value }))} /><DateInput label="Warranty expiration" value={closeoutDraft.warrantyDate} onChange={(value) => setCloseoutDraft((draft) => ({ ...draft, warrantyDate: value }))} clearable /></SimpleGrid><Checkbox label="Final photos confirmed" checked={closeoutDraft.finalPhotos} onChange={(event) => setCloseoutDraft((draft) => ({ ...draft, finalPhotos: event.currentTarget.checked }))} /><Button color="red" leftSection={<IconClipboardCheck size={16} />} onClick={() => updateProject({ customer_signoff_by: closeoutDraft.signoffName || null, customer_signoff_at: closeoutDraft.signoffName ? (project.customer_signoff_at || new Date().toISOString()) : null, warranty_expires_at: closeoutDraft.warrantyDate ? closeoutDraft.warrantyDate.toISOString().slice(0, 10) : null, final_photos_confirmed: closeoutDraft.finalPhotos }, "Closeout information saved")}>Save Closeout Information</Button></Stack></Card></Tabs.Panel>
    </Tabs>
  </Stack>;
}

export default ProjectControlCenter;
