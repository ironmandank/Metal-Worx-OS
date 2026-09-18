import { useEffect, useMemo, useState } from "react";
import { Alert, Badge, Box, Card, Divider, Group, Loader, Select, Stack, Text, ThemeIcon } from "@mantine/core";
import { IconActivity, IconCash, IconCheck, IconFileUpload, IconListCheck, IconNotes, IconPackage } from "@tabler/icons-react";

import { supabase } from "../lib/supabase";

function when(value) {
  if (!value) return "Date not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function money(value) {
  return Number(value || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

const config = {
  Update: { color: "blue", icon: IconNotes },
  Checklist: { color: "green", icon: IconListCheck },
  Payment: { color: "teal", icon: IconCash },
  File: { color: "violet", icon: IconFileUpload },
  Material: { color: "orange", icon: IconPackage },
  Project: { color: "gray", icon: IconActivity },
};

export default function ProjectActivityTimeline({ project, materialRequests = [] }) {
  const [records, setRecords] = useState({ updates: [], checklist: [], payments: [], files: [] });
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!project?.id) return;
      setLoading(true);
      const [updates, checklist, payments, files] = await Promise.all([
        supabase.from("project_daily_updates").select("*").eq("project_id", project.id).order("created_at", { ascending: false }),
        supabase.from("project_checklist_items").select("*").eq("project_id", project.id).order("updated_at", { ascending: false }),
        supabase.from("project_payments").select("*").eq("project_id", project.id).order("created_at", { ascending: false }),
        supabase.from("project_files").select("*").eq("project_id", project.id).order("created_at", { ascending: false }),
      ]);
      if (cancelled) return;
      const failure = updates.error || checklist.error || payments.error || files.error;
      if (failure) setError(failure.message || "Project history could not be loaded.");
      else {
        setError("");
        setRecords({ updates: updates.data || [], checklist: checklist.data || [], payments: payments.data || [], files: files.data || [] });
      }
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [project?.id]);

  const events = useMemo(() => {
    const result = [];
    if (project?.created_at) result.push({ id: "created", type: "Project", date: project.created_at, title: "Project created", detail: `Entered by ${project.intake_owner || "Metal Worx"}` });
    if (project?.completed_at) result.push({ id: "completed", type: "Project", date: project.completed_at, title: "Project closeout completed", detail: project.closeout_financial_bypass ? `Financial override: ${project.closeout_bypass_reason || "Reason not recorded"}` : `Closed by ${project.closed_by || "Metal Worx"}` });
    records.updates.forEach((update) => result.push({ id: `update-${update.id}`, type: "Update", date: update.created_at || update.update_date, title: `Daily update · ${update.status || "Status recorded"}`, detail: update.work_completed || update.work_in_progress || update.next_steps || update.blockers || "Project update submitted", owner: update.project_lead }));
    records.checklist.forEach((item) => {
      if (item.completed_at) result.push({ id: `task-complete-${item.id}`, type: "Checklist", date: item.completed_at, title: `Completed: ${item.task_title}`, detail: `${item.phase || "Project task"}${item.verified_by ? ` · Verified by ${item.verified_by}` : ""}`, owner: item.assigned_to });
      else if (item.created_at) result.push({ id: `task-created-${item.id}`, type: "Checklist", date: item.created_at, title: `Task added: ${item.task_title}`, detail: item.phase || item.notes || "Project checklist", owner: item.assigned_to });
    });
    records.payments.forEach((payment) => result.push({ id: `payment-${payment.id}`, type: "Payment", date: payment.created_at || payment.payment_date, title: `${payment.payment_type || "Payment"} recorded · ${money(payment.amount)}`, detail: [payment.payment_method, payment.reference_number && `Ref ${payment.reference_number}`].filter(Boolean).join(" · ") || "Payment recorded", owner: payment.recorded_by }));
    records.files.forEach((file) => result.push({ id: `file-${file.id}`, type: "File", date: file.created_at, title: `File uploaded: ${file.file_name}`, detail: [file.category, file.description].filter(Boolean).join(" · ") || "Project file", owner: file.uploaded_by }));
    materialRequests.forEach((request) => {
      if (request.created_at) result.push({ id: `material-${request.id}`, type: "Material", date: request.created_at, title: `Material requested: ${request.item_name || "Material"}`, detail: `${request.quantity || ""} ${request.dimensions || ""}`.trim() || request.status || "Request created" });
      if (request.ordered_at) result.push({ id: `material-order-${request.id}`, type: "Material", date: request.ordered_at, title: `Material ordered: ${request.item_name || "Material"}`, detail: request.purchase_order ? `PO ${request.purchase_order}` : request.vendor_name || "Order recorded", owner: request.ordered_by });
      if (request.received_at) result.push({ id: `material-received-${request.id}`, type: "Material", date: request.received_at, title: `Material received: ${request.item_name || "Material"}`, detail: request.quantity_received ? `Quantity received: ${request.quantity_received}` : "Receipt recorded", owner: request.received_by });
    });
    return result.filter((item) => item.date).sort((left, right) => new Date(right.date) - new Date(left.date));
  }, [materialRequests, project, records]);

  const visible = filter === "All" ? events : events.filter((event) => event.type === filter);

  return <Card withBorder radius="lg" p="lg" mt="md">
    <Group justify="space-between" align="flex-start" mb="md">
      <Box><Text fw={900} size="lg">Complete Project Timeline</Text><Text c="dimmed" size="sm">Daily updates, tasks, payments, uploads, materials, and milestones in chronological order.</Text></Box>
      <Select size="sm" w={170} value={filter} onChange={(value) => setFilter(value || "All")} data={["All", "Update", "Checklist", "Payment", "File", "Material", "Project"]} />
    </Group>
    {error && <Alert color="red" mb="md">{error}</Alert>}
    {loading ? <Group justify="center" py="xl"><Loader size="sm" /></Group> : visible.length === 0 ? <Text c="dimmed" ta="center" py="xl">No matching activity has been recorded.</Text> : <Stack gap={0}>{visible.map((event, index) => {
      const itemConfig = config[event.type] || config.Project;
      const EventIcon = itemConfig.icon;
      return <Box key={event.id} py="sm"><Group align="flex-start" wrap="nowrap"><ThemeIcon color={itemConfig.color} variant="light" radius="xl" size={38}><EventIcon size={18} /></ThemeIcon><Box style={{ flex: 1, minWidth: 0 }}><Group justify="space-between" align="flex-start" wrap="wrap"><Box><Group gap="xs"><Text fw={800}>{event.title}</Text><Badge size="xs" variant="light" color={itemConfig.color}>{event.type}</Badge></Group><Text size="sm" c="dimmed" mt={3}>{event.detail}</Text>{event.owner && <Text size="xs" c="gray.6" mt={3}>By / assigned to {event.owner}</Text>}</Box><Text size="xs" c="dimmed">{when(event.date)}</Text></Group></Box></Group>{index < visible.length - 1 && <Divider mt="sm" />}</Box>;
    })}</Stack>}
  </Card>;
}
