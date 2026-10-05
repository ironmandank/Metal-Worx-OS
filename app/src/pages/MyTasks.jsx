import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Group,
  Loader,
  Modal,
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
  IconPlus,
  IconRefresh,
  IconTrash,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import MWPageHeader from "../components/ui/MWPageHeader";
import MWPanel from "../components/ui/MWPanel";
import { supabase } from "../lib/supabase";

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

export default function MyTasks({ setPage }) {
  const [tasks, setTasks] = useState([]);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    details: "",
    priority: "Normal",
    due_date: localDateKey(),
    due_time: "",
  });

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const currentUserId = sessionData?.session?.user?.id || "";
      setUserId(currentUserId);
      if (!currentUserId) throw new Error("Your employee session could not be found. Please sign in again.");

      const { data, error } = await supabase
        .from("personal_follow_ups")
        .select("id,owner_user_id,owner_name,title,details,note_type,priority,due_at,status,completed_at,created_at,updated_at")
        .eq("owner_user_id", currentUserId)
        .order("status", { ascending: false })
        .order("due_at", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      notifications.show({ title: "Tasks Could Not Be Loaded", message: error.message, color: "red" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const today = localDateKey();
  const openTasks = useMemo(() => tasks.filter((task) => task.status !== "Completed"), [tasks]);
  const todayTasks = useMemo(() => openTasks.filter((task) => localDateKey(task.due_at) === today), [openTasks, today]);
  const overdueTasks = useMemo(() => openTasks.filter((task) => task.due_at && localDateKey(task.due_at) < today), [openTasks, today]);
  const laterTasks = useMemo(() => openTasks.filter((task) => !task.due_at || localDateKey(task.due_at) > today), [openTasks, today]);
  const completedToday = useMemo(() => tasks.filter((task) => task.status === "Completed" && localDateKey(task.completed_at) === today), [tasks, today]);

  async function addTask(event) {
    event.preventDefault();
    if (!form.title.trim() || !userId || saving) return;
    setSaving(true);
    try {
      const { data: profile, error: profileError } = await supabase
        .from("employee_profiles")
        .select("display_name")
        .eq("auth_user_id", userId)
        .maybeSingle();
      if (profileError) throw profileError;

      const { error } = await supabase.from("personal_follow_ups").insert({
        owner_user_id: userId,
        owner_name: profile?.display_name || "Team Member",
        title: form.title.trim(),
        details: form.details.trim() || null,
        note_type: "Task",
        priority: form.priority,
        due_at: dueDateTime(form.due_date, form.due_time),
        created_by: userId,
      });
      if (error) throw error;
      setForm({ title: "", details: "", priority: "Normal", due_date: localDateKey(), due_time: "" });
      setTaskOpen(false);
      await loadTasks();
      notifications.show({ title: "Task Added", message: "The task is on your daily list.", color: "green" });
    } catch (error) {
      notifications.show({ title: "Task Could Not Be Added", message: error.message, color: "red" });
    } finally {
      setSaving(false);
    }
  }

  async function completeTask(task, completed) {
    const { error } = await supabase.from("personal_follow_ups").update({
      status: completed ? "Completed" : "Open",
      completed_at: completed ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq("id", task.id).eq("owner_user_id", userId);
    if (error) {
      notifications.show({ title: "Task Could Not Be Updated", message: error.message, color: "red" });
      return;
    }
    await loadTasks();
  }

  async function deleteTask(task) {
    if (!window.confirm(`Delete “${task.title}”?`)) return;
    const { error } = await supabase.from("personal_follow_ups").delete().eq("id", task.id).eq("owner_user_id", userId);
    if (error) notifications.show({ title: "Task Could Not Be Deleted", message: error.message, color: "red" });
    else await loadTasks();
  }

  function TaskCard({ task, completed = false }) {
    const overdue = !completed && task.due_at && localDateKey(task.due_at) < today;
    return <Card withBorder radius="lg" p="md" style={{ borderLeft: `4px solid ${overdue ? "#fa5252" : completed ? "#40c057" : "#e03131"}` }}>
      <Group align="flex-start" wrap="nowrap">
        <Checkbox size="lg" mt={3} checked={completed} aria-label={completed ? `Reopen ${task.title}` : `Complete ${task.title}`} onChange={(event) => completeTask(task, event.currentTarget.checked)}/>
        <Stack gap={6} style={{ flex: 1, minWidth: 0 }}>
          <Group gap="xs" wrap="wrap">
            <Text fw={900} td={completed ? "line-through" : undefined} c={completed ? "dimmed" : undefined}>{task.title}</Text>
            <Badge size="sm" color={priorityColor(task.priority)} variant="light">{task.priority}</Badge>
            {overdue && <Badge size="sm" color="red">Overdue</Badge>}
          </Group>
          {task.details && <Text size="sm" c="dimmed" style={{ whiteSpace: "pre-wrap" }}>{task.details}</Text>}
          <Group gap={5}><IconClock size={14}/><Text size="xs" c="dimmed">{completed ? `Completed ${dueLabel(task.completed_at)}` : dueLabel(task.due_at)}</Text></Group>
        </Stack>
        <Button variant="subtle" color="gray" size="compact-sm" aria-label={`Delete ${task.title}`} onClick={() => deleteTask(task)}><IconTrash size={17}/></Button>
      </Group>
    </Card>;
  }

  if (loading) return <Stack gap="xl"><MWPageHeader title="My Tasks" subtitle="Loading your daily task list." setPage={setPage} showBack backPage="dashboard" backLabel="Command" showDashboard={false}/><MWPanel><Group justify="center" py={80}><Loader color="red"/><Text c="dimmed">Loading tasks…</Text></Group></MWPanel></Stack>;

  return <Stack gap="xl">
    <MWPageHeader title="My Tasks" subtitle="Plan today, check work off, and keep unfinished items visible." setPage={setPage} showBack backPage="dashboard" backLabel="Command" showDashboard={false}/>

    <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
      <Card withBorder radius="lg" p="lg"><Group><ThemeIcon color="red" variant="light" size="lg"><IconCalendarCheck size={22}/></ThemeIcon><div><Text size="xs" c="dimmed" fw={800}>TODAY</Text><Title order={2}>{todayTasks.length}</Title></div></Group></Card>
      <Card withBorder radius="lg" p="lg"><Group><ThemeIcon color="orange" variant="light" size="lg"><IconClock size={22}/></ThemeIcon><div><Text size="xs" c="dimmed" fw={800}>OVERDUE</Text><Title order={2}>{overdueTasks.length}</Title></div></Group></Card>
      <Card withBorder radius="lg" p="lg"><Group><ThemeIcon color="blue" variant="light" size="lg"><IconClipboardList size={22}/></ThemeIcon><div><Text size="xs" c="dimmed" fw={800}>ALL OPEN</Text><Title order={2}>{openTasks.length}</Title></div></Group></Card>
      <Card withBorder radius="lg" p="lg"><Group><ThemeIcon color="green" variant="light" size="lg"><IconCheck size={22}/></ThemeIcon><div><Text size="xs" c="dimmed" fw={800}>DONE TODAY</Text><Title order={2}>{completedToday.length}</Title></div></Group></Card>
    </SimpleGrid>

    <Group justify="space-between">
      <Button color="red" size="md" leftSection={<IconPlus size={18}/>} onClick={() => setTaskOpen(true)}>Add Today’s Task</Button>
      <Button variant="light" color="gray" leftSection={<IconRefresh size={17}/>} onClick={loadTasks}>Refresh</Button>
    </Group>

    {overdueTasks.length > 0 && <MWPanel title="Needs Attention" subtitle="These tasks are past due and remain open." icon={IconClock} color="orange"><Stack gap="sm">{overdueTasks.map((task) => <TaskCard key={task.id} task={task}/>)}</Stack></MWPanel>}

    <MWPanel title="Today’s Tasks" subtitle="Check each task when it is complete." icon={IconCalendarCheck} color="red">
      {todayTasks.length ? <Stack gap="sm">{todayTasks.map((task) => <TaskCard key={task.id} task={task}/>)}</Stack> : <Alert color="green" icon={<IconCheck size={18}/>}>Nothing is waiting on today’s list. Add a task whenever something comes up.</Alert>}
    </MWPanel>

    {laterTasks.length > 0 && <MWPanel title="Upcoming & Unscheduled" subtitle="Open tasks that are due later or do not have a date." icon={IconClipboardList} color="blue"><Stack gap="sm">{laterTasks.map((task) => <TaskCard key={task.id} task={task}/>)}</Stack></MWPanel>}

    <MWPanel title="Completed Today" subtitle="Today’s finished work remains visible for review." icon={IconCheck} color="green" rightSection={<Button variant="subtle" color="gray" size="xs" onClick={() => setShowCompleted((value) => !value)}>{showCompleted ? "Hide" : "Show"}</Button>}>
      {!showCompleted ? <Text c="dimmed" size="sm">{completedToday.length} task{completedToday.length === 1 ? "" : "s"} completed today.</Text> : completedToday.length ? <Stack gap="sm">{completedToday.map((task) => <TaskCard key={task.id} task={task} completed/>)}</Stack> : <Text c="dimmed">No tasks have been completed today yet.</Text>}
    </MWPanel>

    <Modal opened={taskOpen} onClose={() => setTaskOpen(false)} title="Add a Task" centered>
      <form onSubmit={addTask}><Stack>
        <TextInput label="Task" placeholder="What needs to be completed?" value={form.title} onChange={(event) => setForm({ ...form, title: event.currentTarget.value })} required autoFocus/>
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
