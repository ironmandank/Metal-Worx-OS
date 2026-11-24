import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Image,
  Loader,
  Modal,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconCalendarCheck,
  IconCheck,
  IconClipboardList,
  IconClock,
  IconFlag,
  IconPlus,
  IconRefresh,
  IconTrash,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import MWPageHeader from "../components/ui/MWPageHeader";
import MWPanel from "../components/ui/MWPanel";
import { supabase } from "../lib/supabase";
import { createNotificationForProfile } from "../services/notificationService";

const PRIORITIES = ["Low", "Normal", "High", "Urgent"];

function localDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dueDateTime(date, time) {
  if (!date) return null;
  const value = new Date(`${date}T${time || "17:00"}`);
  return Number.isNaN(value.getTime()) ? null : value.toISOString();
}

function dueLabel(value) {
  if (!value) return "No due date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No due date";
  const today = localDateKey();
  const prefix = localDateKey(date) === today ? "Today" : date.toLocaleDateString([], { month: "short", day: "numeric" });
  return `${prefix} at ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

function priorityColor(priority) {
  if (priority === "Urgent") return "red";
  if (priority === "High") return "orange";
  if (priority === "Low") return "gray";
  return "blue";
}

async function loadArtworkPriorityDetails(rows = []) {
  if (!rows.length) return [];

  const jobIds = [...new Set(rows.map((row) => row.production_job_id).filter(Boolean))];
  const profileIds = [...new Set(rows.map((row) => row.employee_profile_id).filter(Boolean))];
  const [jobsResult, employeesResult] = await Promise.all([
    jobIds.length
      ? supabase.from("production_jobs").select("*").in("id", jobIds)
      : Promise.resolve({ data: [], error: null }),
    profileIds.length
      ? supabase.from("employee_profiles").select("id,display_name").in("id", profileIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (jobsResult.error) throw jobsResult.error;
  if (employeesResult.error) throw employeesResult.error;

  const jobs = jobsResult.data || [];
  const orderIds = [...new Set(jobs.map((job) => job.customer_order_id).filter(Boolean))];
  const [ordersResult, itemsResult, workOrdersResult, imagesResult] = await Promise.all([
    orderIds.length
      ? supabase.from("customer_orders").select("*").in("id", orderIds)
      : Promise.resolve({ data: [], error: null }),
    orderIds.length
      ? supabase.from("customer_order_items").select("*").in("order_id", orderIds)
      : Promise.resolve({ data: [], error: null }),
    jobIds.length
      ? supabase.from("work_orders").select("production_job_id,department,status,step_order").in("production_job_id", jobIds).eq("is_active", true).in("status", ["Ready", "In Progress", "Blocked"]).order("step_order", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    orderIds.length
      ? supabase.from("customer_order_reference_images").select("*").in("customer_order_id", orderIds).order("sort_order", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ]);
  const relatedError = ordersResult.error || itemsResult.error || workOrdersResult.error || imagesResult.error;
  if (relatedError) throw relatedError;

  const orders = ordersResult.data || [];
  const customerIds = [...new Set(orders.map((order) => order.customer_id).filter(Boolean))];
  const customersResult = customerIds.length
    ? await supabase.from("customers").select("id,first_name,last_name,company_name").in("id", customerIds)
    : { data: [], error: null };
  if (customersResult.error) throw customersResult.error;

  const byId = (items) => Object.fromEntries((items || []).map((item) => [String(item.id), item]));
  const jobsById = byId(jobs);
  const ordersById = byId(orders);
  const customersById = byId(customersResult.data);
  const employeesById = byId(employeesResult.data);
  const workOrdersByJob = {};
  (workOrdersResult.data || []).forEach((workOrder) => {
    const key = String(workOrder.production_job_id);
    if (!workOrdersByJob[key]) workOrdersByJob[key] = workOrder;
  });

  return rows.map((row) => {
    const job = jobsById[String(row.production_job_id)] || null;
    const order = ordersById[String(job?.customer_order_id)] || null;
    const customer = customersById[String(order?.customer_id)] || null;
    const orderItems = (itemsResult.data || []).filter((item) => String(item.order_id) === String(order?.id));
    const workOrder = workOrdersByJob[String(row.production_job_id)] || null;
    const customerName = order?.artwork_customer_name
      || [customer?.first_name, customer?.last_name].filter(Boolean).join(" ")
      || customer?.company_name
      || "Customer not assigned";
    const itemName = orderItems
      .map((item) => item.item_name || item.description)
      .filter(Boolean)
      .join(", ") || job?.production_job_number || "Artwork item";
    const description = job?.description
      || job?.project_description
      || order?.description
      || order?.special_instructions
      || orderItems.map((item) => item.description).filter(Boolean).join("\n")
      || "";
    const projectNotes = job?.notes
      || order?.notes
      || orderItems.map((item) => item.notes || item.special_instructions).filter(Boolean).join("\n")
      || "";
    const images = (imagesResult.data || []).filter((image) => String(image.customer_order_id) === String(order?.id));

    return {
      ...row,
      employee_name: employeesById[String(row.employee_profile_id)]?.display_name || "Team member",
      customer_name: customerName,
      item_name: itemName,
      description,
      project_notes: projectNotes,
      images,
      department: workOrder?.department || job?.current_department || "Station not set",
      work_status: workOrder?.status || job?.status || "Open",
      due_date: row.due_date || job?.due_date || order?.due_date || null,
    };
  });
}

function ArtworkPriorityCard({ item, isAdministrator, prioritySavingId, onComplete }) {
const [isExpanded, setIsExpanded] = useState(false);
  const workNeeded = [
    [item.needs_cut, "Cutting"],
    [item.needs_welding, "Welding / fabrication"],
    [item.needs_prep, "Prep / sanding"],
    [item.needs_paint, "Paint"],
    [item.needs_powder_coat, "Powder coat"],
    [item.needs_patina, "Patina"],
    [item.needs_clear_coat, "Clear coat"],
    [item.needs_touch_up, "Touch-up"],
  ].filter(([needed]) => needed).map(([, label]) => label);
  const dueDateLabel = item.due_date
    ? new Date(`${item.due_date}T12:00:00`).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", year: "numeric" })
    : null;

  return (
    <Card withBorder radius="lg" p="md" style={{ borderLeft: "4px solid #f08c00" }}>
      <Stack gap="sm">
        <Group align="flex-start" justify="space-between" wrap="wrap">
          <Stack gap={6} style={{ flex: 1, minWidth: 0 }}>
            <Group gap="xs" wrap="wrap">
              <Text fw={900}>{item.customer_name} — {item.item_name}</Text>
              <Badge color="red" variant="filled">Priority now</Badge>
              <Badge color="violet" variant="light">Station: {item.department}</Badge>
              <Badge color="gray" variant="light">{item.work_status}</Badge>
            </Group>
            <Text c="red.7" fw={900} size="lg" style={{ letterSpacing: 0.2 }}>
              {dueDateLabel ? `DUE: ${dueDateLabel}` : "DUE DATE NOT SET"}
            </Text>
          </Stack>
          <Group gap="xs">
            <Button
              variant="light"
              color="orange"
              size="compact-sm"
              onClick={() => setIsExpanded((current) => !current)}
            >
              {isExpanded ? "Hide Details" : "Show Details"}
            </Button>
            {isAdministrator ? (
              <Button
                color="green"
                size="compact-md"
                leftSection={<IconCheck size={16} />}
                loading={prioritySavingId === item.id}
                onClick={() => onComplete(item)}
              >
                Mark Complete
              </Button>
            ) : (
              <Text size="xs" c="dimmed">A manager can mark this complete.</Text>
            )}
          </Group>
        </Group>

        {workNeeded.length > 0 && (
          <Group gap="xs">
            {workNeeded.map((task) => <Badge key={task} color="orange" variant="light">Needs {task}</Badge>)}
          </Group>
        )}

        {isExpanded && (
          <Paper withBorder radius="md" p="sm" mt="xs" style={{ borderColor: "rgba(255,255,255,0.16)" }}>
          <Stack gap="sm">
            {item.description && (
              <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
                <strong>Project description:</strong> {item.description}
              </Text>
            )}
            {item.project_notes && (
              <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
                <strong>Project notes:</strong> {item.project_notes}
              </Text>
            )}
            {item.other_requirements && (
              <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
                <strong>Other work needed:</strong> {item.other_requirements}
              </Text>
            )}
            {item.notes && (
              <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
                <strong>Priority notes:</strong> {item.notes}
              </Text>
            )}
            {item.images?.length > 0 && (
              <Stack gap={4}>
                <Text size="xs" fw={800} c="dimmed">REFERENCE IMAGES</Text>
                <SimpleGrid cols={{ base: 2, sm: Math.min(item.images.length, 4) }} spacing="xs">
                  {item.images.slice(0, 4).map((image, index) => {
                    const label = image.caption || image.image_type || `Reference image ${index + 1}`;
                    const isDesignFile = /\.(cdr|dxf|pdf|ai|eps|dwg|plt|svg)$/i.test(label);
                    return (
                      <Card key={image.id || image.image_url || index} withBorder radius="sm" p={4}>
                        <a href={image.image_url} target="_blank" rel="noreferrer">
                          {isDesignFile ? (
                            <Text size="xs" c="blue" ta="center" py="md">{label}</Text>
                          ) : (
                            <Image src={image.image_url} alt={label} h={110} fit="contain" />
                          )}
                        </a>
                        <Text size="xs" lineClamp={1} mt={4}>{label}</Text>
                      </Card>
                    );
                  })}
                </SimpleGrid>
                {item.images.length > 4 && <Text size="xs" c="dimmed">Plus {item.images.length - 4} more file(s)</Text>}
              </Stack>
            )}
            {!item.description && !item.project_notes && !item.other_requirements && !item.notes && !item.images?.length && (
              <Text size="sm" c="dimmed">No description, notes, or reference images are attached to this item.</Text>
            )}
          </Stack>
        </Paper>
        )}
      </Stack>
    </Card>
  );
}

export default function MyTasks({ setPage, authenticatedProfile }) {
  const [tasks, setTasks] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [artworkPriorityItems, setArtworkPriorityItems] = useState([]);
  const [prioritySavingId, setPrioritySavingId] = useState(null);
  const [userId, setUserId] = useState("");
  const [viewOwnerId, setViewOwnerId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    details: "",
    priority: "Normal",
    due_date: localDateKey(),
    due_time: "",
    owner_user_id: "",
  });
  const isAdministrator = String(authenticatedProfile?.access_level || "").toLowerCase().includes("admin");

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const currentUserId = sessionData?.session?.user?.id || "";
      setUserId(currentUserId);
      if (!currentUserId) throw new Error("Your employee session could not be found. Please sign in again.");

      const tasksQuery = supabase
        .from("personal_follow_ups")
        .select("id,owner_user_id,owner_name,title,details,note_type,priority,due_at,status,completed_at,created_at,updated_at")
        .order("status", { ascending: false })
        .order("due_at", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
      const [{ data, error }, { data: profileRows, error: profilesError }, { data: priorityRows, error: priorityError }] = await Promise.all([
        isAdministrator ? tasksQuery : tasksQuery.eq("owner_user_id", currentUserId),
        supabase.from("employee_profiles").select("id,auth_user_id,display_name,role_title,is_active").eq("is_active", true).not("auth_user_id", "is", null).order("display_name"),
        supabase.from("artwork_priority_items").select("*").order("created_at", { ascending: false }),
      ]);
      if (error) throw error;
      if (profilesError) throw profilesError;
      if (priorityError) throw priorityError;
      const hydratedPriorityItems = await loadArtworkPriorityDetails(priorityRows || []);
      setTasks(data || []);
      setProfiles(profileRows || []);
      setArtworkPriorityItems(hydratedPriorityItems);
      setViewOwnerId((current) => current || currentUserId);
      setForm((current) => ({ ...current, owner_user_id: current.owner_user_id || currentUserId }));
    } catch (error) {
      notifications.show({ title: "Tasks Could Not Be Loaded", message: error.message, color: "red" });
    } finally {
      setLoading(false);
    }
  }, [isAdministrator]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const today = localDateKey();
  const visibleTasks = useMemo(() => isAdministrator && viewOwnerId === "all" ? tasks : tasks.filter((task) => task.owner_user_id === (viewOwnerId || userId)), [isAdministrator, tasks, userId, viewOwnerId]);
  const visibleArtworkPriorityItems = useMemo(
    () => artworkPriorityItems.filter((item) => item.status !== "Completed"),
    [artworkPriorityItems],
  );
  const openTasks = useMemo(() => visibleTasks.filter((task) => task.status !== "Completed"), [visibleTasks]);
  const todayTasks = useMemo(() => openTasks.filter((task) => localDateKey(task.due_at) === today), [openTasks, today]);
  const overdueTasks = useMemo(() => openTasks.filter((task) => task.due_at && localDateKey(task.due_at) < today), [openTasks, today]);
  const laterTasks = useMemo(() => openTasks.filter((task) => !task.due_at || localDateKey(task.due_at) > today), [openTasks, today]);
  const completedToday = useMemo(() => visibleTasks.filter((task) => task.status === "Completed" && localDateKey(task.completed_at) === today), [visibleTasks, today]);

  async function addTask(event) {
    event.preventDefault();
    if (!form.title.trim() || !userId || saving) return;
    setSaving(true);
    try {
      const ownerUserId = isAdministrator ? (form.owner_user_id || userId) : userId;
      const profile = profiles.find((item) => item.auth_user_id === ownerUserId);

      const { error } = await supabase.from("personal_follow_ups").insert({
        owner_user_id: ownerUserId,
        owner_name: profile?.display_name || authenticatedProfile?.display_name || "Team Member",
        title: form.title.trim(),
        details: form.details.trim() || null,
        note_type: "Task",
        priority: form.priority,
        due_at: dueDateTime(form.due_date, form.due_time),
        created_by: userId,
      });
      if (error) throw error;
      if (profile?.id && ownerUserId !== userId) {
        await createNotificationForProfile({
          recipientProfileId: profile.id,
          notificationType: "Task",
          title: "New Task Assigned",
          message: form.title.trim(),
          targetPage: "myTasks",
          priority: form.priority === "Urgent" ? "High" : form.priority,
        });
      }
      setForm({ title: "", details: "", priority: "Normal", due_date: localDateKey(), due_time: "", owner_user_id: ownerUserId });
      setTaskOpen(false);
      await loadTasks();
      notifications.show({ title: "Task Added", message: `The task is on ${profile?.display_name || "the employee"}'s list.`, color: "green" });
    } catch (error) {
      notifications.show({ title: "Task Could Not Be Added", message: error.message, color: "red" });
    } finally {
      setSaving(false);
    }
  }

  async function completeArtworkPriorityItem(item) {
    if (prioritySavingId) return;
    setPrioritySavingId(item.id);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("artwork_priority_items")
        .update({
          status: "Completed",
          completed_at: now,
          completed_by: userData?.user?.id || null,
          updated_at: now,
        })
        .eq("id", item.id);
      if (error) throw error;
      notifications.show({ title: "Priority Item Completed", message: `${item.customer_name} — ${item.item_name} was marked complete.`, color: "green" });
      await loadTasks();
    } catch (error) {
      notifications.show({ title: "Priority Item Could Not Be Updated", message: error.message, color: "red" });
    } finally {
      setPrioritySavingId(null);
    }
  }

  async function completeTask(task, completed) {
    const { error } = await supabase.from("personal_follow_ups").update({
      status: completed ? "Completed" : "Open",
      completed_at: completed ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq("id", task.id);
    if (error) {
      notifications.show({ title: "Task Could Not Be Updated", message: error.message, color: "red" });
      return;
    }
    await loadTasks();
    notifications.show({
      title: completed ? "Task Completed" : "Task Reopened",
      message: completed ? "Moved to Completed Today. It was not deleted." : "Moved back to your open task list.",
      color: completed ? "green" : "blue",
    });
  }

  async function deleteTask(task) {
    if (!window.confirm(`Delete “${task.title}”?`)) return;
    const { error } = await supabase.from("personal_follow_ups").delete().eq("id", task.id);
    if (error) notifications.show({ title: "Task Could Not Be Deleted", message: error.message, color: "red" });
    else await loadTasks();
  }


  function TaskCard({ task, completed = false }) {
    const overdue = !completed && task.due_at && localDateKey(task.due_at) < today;
    return <Card withBorder radius="lg" p="md" style={{ borderLeft: `4px solid ${overdue ? "#fa5252" : completed ? "#40c057" : "#e03131"}` }}>
      <Group align="flex-start" wrap="nowrap">
        <Stack gap={6} style={{ flex: 1, minWidth: 0 }}>
          <Group gap="xs" wrap="wrap">
            <Text fw={900} td={completed ? "line-through" : undefined} c={completed ? "dimmed" : undefined}>{task.title}</Text>
            {isAdministrator && <Badge size="sm" color="grape" variant="light">{task.owner_name || "Unassigned"}</Badge>}
            <Badge size="sm" color={priorityColor(task.priority)} variant="light">{task.priority}</Badge>
            {overdue && <Badge size="sm" color="red">Overdue</Badge>}
          </Group>
          {task.details && <Text size="sm" c="dimmed" style={{ whiteSpace: "pre-wrap" }}>{task.details}</Text>}
          <Group gap={5}><IconClock size={14}/><Text size="xs" c="dimmed">{completed ? `Completed ${dueLabel(task.completed_at)}` : dueLabel(task.due_at)}</Text></Group>
        </Stack>
        <Stack gap={5}>
          <Button color={completed ? "blue" : "green"} variant={completed ? "light" : "filled"} size="compact-sm" leftSection={completed ? <IconRefresh size={15}/> : <IconCheck size={15}/>} onClick={() => completeTask(task, !completed)}>{completed ? "Reopen" : "Complete"}</Button>
          <Button variant="subtle" color="gray" size="compact-sm" leftSection={<IconTrash size={15}/>} aria-label={`Delete ${task.title}`} onClick={() => deleteTask(task)}>Delete</Button>
        </Stack>
      </Group>
    </Card>;
  }

  if (loading) return <Stack gap="xl"><MWPageHeader title="My Tasks" subtitle="Loading your daily task list." setPage={setPage} showBack backPage="dashboard" backLabel="Command" showDashboard={false}/><MWPanel><Group justify="center" py={80}><Loader color="red"/><Text c="dimmed">Loading tasks…</Text></Group></MWPanel></Stack>;

  return <Stack gap="xl">
    <MWPageHeader title="My Tasks" subtitle="Plan today, check work off, and keep unfinished items visible." setPage={setPage} showBack backPage="dashboard" backLabel="Command" showDashboard={false}/>

    <MWPanel
      title="Hot Priority List"
      subtitle="Shared high priority artwork for the team. Each item shows its current station, status, and the work it still needs."
      icon={IconFlag}
      color="orange"
    >
      {visibleArtworkPriorityItems.length
        ? <Stack gap="sm">{visibleArtworkPriorityItems.map((item) => <ArtworkPriorityCard key={item.id} item={item} isAdministrator={isAdministrator} prioritySavingId={prioritySavingId} onComplete={completeArtworkPriorityItem} />)}</Stack>
        : <Alert color="green" icon={<IconCheck size={18} />}>No artwork items are marked hot priority right now.</Alert>}
    </MWPanel>

    <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
      <Card withBorder radius="lg" p="lg"><Group><ThemeIcon color="red" variant="light" size="lg"><IconCalendarCheck size={22}/></ThemeIcon><div><Text size="xs" c="dimmed" fw={800}>TODAY</Text><Title order={2}>{todayTasks.length}</Title></div></Group></Card>
      <Card withBorder radius="lg" p="lg"><Group><ThemeIcon color="orange" variant="light" size="lg"><IconClock size={22}/></ThemeIcon><div><Text size="xs" c="dimmed" fw={800}>OVERDUE</Text><Title order={2}>{overdueTasks.length}</Title></div></Group></Card>
      <Card withBorder radius="lg" p="lg"><Group><ThemeIcon color="blue" variant="light" size="lg"><IconClipboardList size={22}/></ThemeIcon><div><Text size="xs" c="dimmed" fw={800}>ALL OPEN</Text><Title order={2}>{openTasks.length}</Title></div></Group></Card>
      <Card withBorder radius="lg" p="lg"><Group><ThemeIcon color="green" variant="light" size="lg"><IconCheck size={22}/></ThemeIcon><div><Text size="xs" c="dimmed" fw={800}>DONE TODAY</Text><Title order={2}>{completedToday.length}</Title></div></Group></Card>
    </SimpleGrid>

    <Group justify="space-between" align="flex-end" wrap="wrap">
      <Button color="red" size="md" leftSection={<IconPlus size={18}/>} onClick={() => setTaskOpen(true)}>Add Today’s Task</Button>
      <Group align="flex-end">
        {isAdministrator && <Select label="View Task List" w={220} value={viewOwnerId} onChange={(value) => setViewOwnerId(value || userId)} data={[{ value: "all", label: "All Team Tasks" }, ...profiles.map((profile) => ({ value: profile.auth_user_id, label: profile.display_name }))]}/>}
        <Button variant="light" color="gray" leftSection={<IconRefresh size={17}/>} onClick={loadTasks}>Refresh</Button>
      </Group>
    </Group>

    {overdueTasks.length > 0 && <MWPanel title="Needs Attention" subtitle="These tasks are past due and remain open." icon={IconClock} color="orange"><Stack gap="sm">{overdueTasks.map((task) => <TaskCard key={task.id} task={task}/>)}</Stack></MWPanel>}

    <MWPanel title="Today’s Tasks" subtitle="Check each task when it is complete." icon={IconCalendarCheck} color="red">
      {todayTasks.length ? <Stack gap="sm">{todayTasks.map((task) => <TaskCard key={task.id} task={task}/>)}</Stack> : <Alert color="green" icon={<IconCheck size={18}/>}>Nothing is waiting on today’s list. Add a task whenever something comes up.</Alert>}
    </MWPanel>

    {laterTasks.length > 0 && <MWPanel title="Upcoming & Unscheduled" subtitle="Open tasks that are due later or do not have a date." icon={IconClipboardList} color="blue"><Stack gap="sm">{laterTasks.map((task) => <TaskCard key={task.id} task={task}/>)}</Stack></MWPanel>}

    <MWPanel title="Completed Today" subtitle="Completed tasks stay here and can be reopened. Only Delete permanently removes a task." icon={IconCheck} color="green">
      {completedToday.length ? <Stack gap="sm">{completedToday.map((task) => <TaskCard key={task.id} task={task} completed/>)}</Stack> : <Text c="dimmed">No tasks have been completed today yet.</Text>}
    </MWPanel>

    <Modal opened={taskOpen} onClose={() => setTaskOpen(false)} title="Add a Task" centered>
      <form onSubmit={addTask}><Stack>
        <TextInput label="Task" placeholder="What needs to be completed?" value={form.title} onChange={(event) => setForm({ ...form, title: event.currentTarget.value })} required autoFocus/>
        {isAdministrator && <Select label="Assign To" searchable allowDeselect={false} data={profiles.map((profile) => ({ value: profile.auth_user_id, label: profile.display_name }))} value={form.owner_user_id || userId} onChange={(value) => setForm({ ...form, owner_user_id: value || userId })}/>}
        <Textarea label="Details" placeholder="Optional notes or next step" minRows={3} value={form.details} onChange={(event) => setForm({ ...form, details: event.currentTarget.value })}/>
        <Select label="Priority" data={PRIORITIES} value={form.priority} onChange={(value) => setForm({ ...form, priority: value || "Normal" })}/>
        <SimpleGrid cols={2}>
          <TextInput label="Due Date" type="date" value={form.due_date} onChange={(event) => setForm({ ...form, due_date: event.currentTarget.value })} required/>
          <TextInput label="Due Time" type="time" description="Optional; defaults to 5:00 PM" value={form.due_time} onChange={(event) => setForm({ ...form, due_time: event.currentTarget.value })}/>
        </SimpleGrid>
        <Button type="submit" color="red" leftSection={<IconPlus size={18}/>} loading={saving} disabled={!form.title.trim()}>Add to My Tasks</Button>
      </Stack></form>
    </Modal>
  </Stack>;
}
