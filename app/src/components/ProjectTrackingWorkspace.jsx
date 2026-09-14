import { useEffect, useMemo, useState } from "react";
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Group,
  Loader,
  Modal,
  Progress,
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
  IconAlertTriangle,
  IconArrowLeft,
  IconCheck,
  IconClipboardCheck,
  IconNotes,
  IconPlus,
  IconRefresh,
  IconTrash,
} from "@tabler/icons-react";

import { supabase } from "../lib/supabase";

const EMPTY_TASK = {
  phase: "",
  task_title: "",
  task_description: "",
  assigned_to: "",
  priority: "Normal",
  status: "Not Started",
  target_date: "",
  blocker: "",
  notes: "",
};

const EMPTY_UPDATE = {
  update_date: new Date().toISOString().slice(0, 10),
  status: "On Track",
  work_completed: "",
  work_in_progress: "",
  next_steps: "",
  materials_needed: "",
  labor_needed: "",
  decisions_needed: "",
  blockers: "",
  schedule_change: "",
  budget_change: "",
  leadership_attention_required: false,
};

const CHECKLIST_TEMPLATES = {
  "General Outside Project": [["Planning","Confirm final scope and measurements"],["Design","Complete drawings and customer approval"],["Materials","Price, order, and receive required materials"],["Fabrication","Complete fabrication and internal quality check"],["Finish","Complete paint or powder coating"],["Installation","Confirm installation date and site readiness"],["Closeout","Complete final inspection, payment, and records"]],
  "Handrail / Guardrail": [["Site","Field measure and document mounting conditions"],["Design","Approve layout, height, returns, and code requirements"],["Materials","Order rail, posts, plate, anchors, and finish supplies"],["Fabrication","Cut, fit, weld, and inspect rail sections"],["Finish","Prep and apply approved finish"],["Installation","Confirm crew, access, anchors, and install date"],["Closeout","Final inspection, photos, cleanup, and customer signoff"]],
  "Gate / Fence": [["Site","Verify opening, grade, swing, and utilities"],["Design","Approve gate/fence layout and hardware"],["Materials","Order steel, posts, hinges, latch, and anchors"],["Fabrication","Fabricate panels, gate, and posts"],["Finish","Prep and apply approved finish"],["Installation","Set posts, install sections, and adjust hardware"],["Closeout","Function test, photos, cleanup, and signoff"]],
  "Container Modification": [["Planning","Confirm container scope, access, and dimensions"],["Design","Approve openings, reinforcements, and attachments"],["Materials","Order steel, hardware, sealant, and finish supplies"],["Fabrication","Cut, reinforce, weld, and weatherproof modifications"],["Quality","Inspect welds, fit, operation, and water protection"],["Delivery","Confirm transport or site installation plan"],["Closeout","Final photos, customer review, and records"]],
  "Repair / Restoration": [["Intake","Document existing condition and repair limits"],["Estimate","Confirm repair method and customer approval"],["Materials","Source replacement steel, hardware, and coatings"],["Repair","Disassemble, repair, weld, and test fit"],["Finish","Clean, prep, and refinish"],["Delivery","Schedule pickup, delivery, or reinstallation"],["Closeout","Final inspection, photos, and customer acceptance"]],
};

function formatDate(value) {
  if (!value) return "Not set";
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
}

function statusColor(status) {
  if (status === "Complete" || status === "On Track") return "green";
  if (status === "Blocked") return "red";
  if (status === "At Risk") return "orange";
  if (status === "In Progress") return "blue";
  return "gray";
}

function ProjectTrackingWorkspace({
  project,
  activeUser,
  setPage,
  onShowOverview,
}) {
  const [tasks, setTasks] = useState([]);
  const [dailyUpdates, setDailyUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingTask, setSavingTask] = useState(false);
  const [savingUpdate, setSavingUpdate] = useState(false);
  const [savingNoChange, setSavingNoChange] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskForm, setTaskForm] = useState(EMPTY_TASK);
  const [dailyForm, setDailyForm] = useState(EMPTY_UPDATE);

  function updateTaskForm(field, value) {
    setTaskForm((current) => ({ ...current, [field]: value }));
  }

  function updateDailyForm(field, value) {
    setDailyForm((current) => ({ ...current, [field]: value }));
  }
  const [selectedTemplate, setSelectedTemplate] = useState("General Outside Project");

  async function loadTracking() {
    if (!project?.id) return;
    setLoading(true);
    try {
      const [taskResult, updateResult] = await Promise.all([
        supabase
          .from("project_checklist_items")
          .select("*")
          .eq("project_id", project.id)
          .order("sort_order", { ascending: true })
          .order("id", { ascending: true }),
        supabase
          .from("project_daily_updates")
          .select("*")
          .eq("project_id", project.id)
          .order("update_date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(30),
      ]);

      if (taskResult.error) throw taskResult.error;
      if (updateResult.error) throw updateResult.error;
      setTasks(taskResult.data || []);
      setDailyUpdates(updateResult.data || []);
    } catch (error) {
      notifications.show({
        title: "Project Tracking Could Not Load",
        message: error.message,
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTracking();
  }, [project?.id]);

  const applicableTasks = useMemo(
    () => tasks.filter((task) => task.status !== "Not Applicable"),
    [tasks],
  );
  const completedTasks = applicableTasks.filter(
    (task) => task.status === "Complete",
  ).length;
  const checklistPercent = applicableTasks.length
    ? Math.round((completedTasks / applicableTasks.length) * 100)
    : 0;
  const blockedTasks = tasks.filter((task) => task.status === "Blocked");

  function openNewTask() {
    setTaskForm({ ...EMPTY_TASK, assigned_to: project.assigned_to || activeUser || "" });
    setTaskModalOpen(true);
  }

  async function addTask() {
    if (!taskForm.task_title.trim()) {
      notifications.show({
        title: "Task Name Required",
        message: "Enter what needs to be completed.",
        color: "orange",
      });
      return;
    }

    setSavingTask(true);
    try {
      const { error } = await supabase.from("project_checklist_items").insert({
        project_id: project.id,
        phase: taskForm.phase.trim() || null,
        task_title: taskForm.task_title.trim(),
        task_description: taskForm.task_description.trim() || null,
        sort_order: tasks.length + 1,
        assigned_to: taskForm.assigned_to.trim() || null,
        priority: taskForm.priority,
        status: taskForm.status,
        target_date: taskForm.target_date || null,
        blocker: taskForm.blocker.trim() || null,
        notes: taskForm.notes.trim() || null,
      });
      if (error) throw error;
      setTaskModalOpen(false);
      setTaskForm(EMPTY_TASK);
      await loadTracking();
      notifications.show({ title: "Checklist Item Added", message: "The task was saved.", color: "green" });
    } catch (error) {
      notifications.show({ title: "Task Could Not Be Added", message: error.message, color: "red" });
    } finally {
      setSavingTask(false);
    }
  }

  async function addTemplateChecklist() {
    if (tasks.length > 0) return;
    setSavingTask(true);
    try {
      const selectedTasks = CHECKLIST_TEMPLATES[selectedTemplate] || CHECKLIST_TEMPLATES["General Outside Project"];
      const rows = selectedTasks.map(([phase, title], index) => ({
        project_id: project.id,
        phase,
        task_title: title,
        sort_order: index + 1,
        assigned_to: project.assigned_to || activeUser || null,
        priority: "Normal",
        status: "Not Started",
        notes: `${selectedTemplate} template item — edit or remove as needed.`,
      }));
      const { error } = await supabase.from("project_checklist_items").insert(rows);
      if (error) throw error;
      await loadTracking();
      notifications.show({
        title: "Checklist Template Added",
        message: `${selectedTemplate} was copied to this project.`,
        color: "green",
      });
    } catch (error) {
      notifications.show({ title: "Template Could Not Be Added", message: error.message, color: "red" });
    } finally {
      setSavingTask(false);
    }
  }

  async function updateTask(task, updates) {
    const payload = { ...updates };
    if (updates.status === "Complete" && !task.completed_at) {
      payload.completed_at = new Date().toISOString();
    }
    if (updates.status && updates.status !== "Complete") payload.completed_at = null;

    setTasks((current) =>
      current.map((item) => (item.id === task.id ? { ...item, ...payload } : item)),
    );
    const { error } = await supabase
      .from("project_checklist_items")
      .update(payload)
      .eq("id", task.id);
    if (error) {
      await loadTracking();
      notifications.show({ title: "Task Could Not Be Updated", message: error.message, color: "red" });
    }
  }

  async function deleteTask(task) {
    if (!window.confirm(`Remove checklist item: ${task.task_title}?`)) return;
    const { error } = await supabase.from("project_checklist_items").delete().eq("id", task.id);
    if (error) {
      notifications.show({ title: "Task Could Not Be Removed", message: error.message, color: "red" });
      return;
    }
    await loadTracking();
  }

  async function saveDailyUpdate() {
    const hasContent = [
      dailyForm.work_completed,
      dailyForm.work_in_progress,
      dailyForm.next_steps,
      dailyForm.materials_needed,
      dailyForm.labor_needed,
      dailyForm.decisions_needed,
      dailyForm.blockers,
      dailyForm.schedule_change,
      dailyForm.budget_change,
    ].some((value) => value.trim());

    if (!hasContent) {
      notifications.show({
        title: "Update Is Blank",
        message: "Enter at least one project update before saving.",
        color: "orange",
      });
      return;
    }

    if (!dailyForm.update_date) {
      notifications.show({
        title: "Update Date Required",
        message: "Select the day this project update is for.",
        color: "orange",
      });
      return;
    }

    setSavingUpdate(true);
    try {
      const clean = Object.fromEntries(
        Object.entries(dailyForm).map(([key, value]) => [
          key,
          typeof value === "string" ? value.trim() || null : value,
        ]),
      );
      const { error } = await supabase.from("project_daily_updates").insert({
        project_id: project.id,
        project_lead: project.assigned_to || activeUser || null,
        ...clean,
      });
      if (error) throw error;
      setDailyForm({
        ...EMPTY_UPDATE,
        update_date: new Date().toISOString().slice(0, 10),
      });
      await loadTracking();
      notifications.show({ title: "Daily Update Saved", message: "Leadership reporting is current.", color: "green" });
    } catch (error) {
      notifications.show({ title: "Update Could Not Be Saved", message: error.message, color: "red" });
    } finally {
      setSavingUpdate(false);
    }
  }

  async function saveNoChangeUpdate() {
    const updateDate = dailyForm.update_date || new Date().toISOString().slice(0, 10);
    const lead = project.assigned_to || activeUser || null;

    if (!window.confirm(`Record a no-change update for ${formatDate(updateDate)}?`)) return;

    setSavingNoChange(true);
    try {
      const { error } = await supabase.from("project_daily_updates").insert({
        project_id: project.id,
        project_lead: lead,
        update_date: updateDate,
        status: dailyForm.status || "On Track",
        work_in_progress: "No change reported. Work remains in its current stage.",
        next_steps: "Continue the current project plan.",
        leadership_attention_required: false,
      });
      if (error) throw error;
      await loadTracking();
      notifications.show({
        title: "No-Change Update Saved",
        message: `${lead || "The project lead"} is recorded as current for ${formatDate(updateDate)}.`,
        color: "green",
      });
    } catch (error) {
      notifications.show({ title: "Update Could Not Be Saved", message: error.message, color: "red" });
    } finally {
      setSavingNoChange(false);
    }
  }

  if (loading) {
    return (
      <Group justify="center" py="xl">
        <Loader color="red" />
        <Text>Loading checklist and daily updates...</Text>
      </Group>
    );
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Group>
          <Button
            variant="light"
            color="gray"
            leftSection={<IconArrowLeft size={17} />}
            onClick={() => {
              onShowOverview?.();
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            Project Overview
          </Button>
          <Button
            variant="light"
            color="gray"
            onClick={() => setPage?.("projects")}
          >
            All Projects
          </Button>
        </Group>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <Card withBorder radius="lg" p="lg">
          <Text size="xs" c="dimmed" tt="uppercase" fw={800}>Checklist Progress</Text>
          <Title order={2}>{checklistPercent}%</Title>
          <Progress value={checklistPercent} color="red" mt="sm" />
          <Text size="sm" c="dimmed" mt="xs">{completedTasks} of {applicableTasks.length} applicable tasks complete</Text>
        </Card>
        <Card withBorder radius="lg" p="lg">
          <Text size="xs" c="dimmed" tt="uppercase" fw={800}>Open Tasks</Text>
          <Title order={2}>{applicableTasks.length - completedTasks}</Title>
          <Text size="sm" c="dimmed" mt="xs">Items still requiring action</Text>
        </Card>
        <Card withBorder radius="lg" p="lg">
          <Text size="xs" c="dimmed" tt="uppercase" fw={800}>Blocked</Text>
          <Title order={2} c={blockedTasks.length ? "red" : undefined}>{blockedTasks.length}</Title>
          <Text size="sm" c="dimmed" mt="xs">Project stoppers requiring attention</Text>
        </Card>
      </SimpleGrid>

      <Card withBorder radius="lg" p="lg">
        <Group justify="space-between" align="flex-start" mb="md">
          <div>
            <Group gap="xs"><IconClipboardCheck size={21} /><Title order={3}>Project Checklist</Title></Group>
            <Text c="dimmed" size="sm">This checklist belongs only to {project.project_number || project.project_name}.</Text>
          </div>
          <Group>
            <Button variant="light" color="gray" leftSection={<IconRefresh size={16} />} onClick={loadTracking}>Refresh</Button>
            <Button color="red" leftSection={<IconPlus size={16} />} onClick={openNewTask}>Add Task</Button>
          </Group>
        </Group>

        {tasks.length === 0 ? (
          <Alert color="gray" title="Blank checklist" icon={<IconClipboardCheck size={18} />}>
            <Stack gap="sm">
              <Text size="sm">Add only the tasks required for this project. New projects will remain blank.</Text>
              <Group align="end">
                <Select label="Start from a template" value={selectedTemplate} data={Object.keys(CHECKLIST_TEMPLATES)} onChange={(value) => setSelectedTemplate(value || "General Outside Project")} style={{ minWidth: 250 }} />
                <Button variant="light" color="blue" loading={savingTask} onClick={addTemplateChecklist}>Copy Template to Project</Button>
              </Group>
            </Stack>
          </Alert>
        ) : (
          <Stack gap="sm">
            {tasks.map((task) => (
              <Card key={task.id} withBorder radius="md" p="md">
                <Group justify="space-between" align="flex-start" wrap="nowrap">
                  <Group align="flex-start" wrap="nowrap" style={{ minWidth: 0 }}>
                    <Checkbox
                      mt={4}
                      checked={task.status === "Complete"}
                      onChange={(event) =>
                        updateTask(task, {
                          status: event.currentTarget.checked
                            ? "Complete"
                            : "Not Started",
                        })
                      }
                    />
                    <div style={{ minWidth: 0 }}>
                      <Text size="xs" c="dimmed" fw={800} tt="uppercase">
                        {task.phase || "General"}
                      </Text>
                      <Text
                        fw={800}
                        td={task.status === "Complete" ? "line-through" : undefined}
                        style={{ overflowWrap: "anywhere" }}
                      >
                        {task.task_title}
                      </Text>
                      {task.task_description && (
                        <Text size="sm" c="dimmed" style={{ overflowWrap: "anywhere" }}>
                          {task.task_description}
                        </Text>
                      )}
                    </div>
                  </Group>
                  <ActionIcon
                    color="red"
                    variant="subtle"
                    aria-label="Remove task"
                    onClick={() => deleteTask(task)}
                  >
                    <IconTrash size={18} />
                  </ActionIcon>
                </Group>

                <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="sm" mt="md">
                  <TextInput
                    label="Assigned To"
                    value={task.assigned_to || ""}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      setTasks((current) =>
                        current.map((item) =>
                          item.id === task.id
                            ? { ...item, assigned_to: value }
                            : item,
                        ),
                      );
                    }}
                    onBlur={(event) =>
                      updateTask(task, {
                        assigned_to: event.currentTarget.value.trim() || null,
                      })
                    }
                  />
                  <Select
                    label="Priority"
                    value={task.priority}
                    allowDeselect={false}
                    data={["Low", "Normal", "High", "Urgent"]}
                    onChange={(value) =>
                      updateTask(task, { priority: value || "Normal" })
                    }
                  />
                  <Select
                    label="Status"
                    value={task.status}
                    allowDeselect={false}
                    data={[
                      "Not Started",
                      "In Progress",
                      "Blocked",
                      "Complete",
                      "Not Applicable",
                    ]}
                    onChange={(value) =>
                      updateTask(task, { status: value || "Not Started" })
                    }
                  />
                  <TextInput
                    type="date"
                    label="Target Date"
                    value={task.target_date || ""}
                    onChange={(event) =>
                      updateTask(task, {
                        target_date: event.currentTarget.value || null,
                      })
                    }
                  />
                </SimpleGrid>

                <Textarea
                  mt="sm"
                  label="Blocker / Notes"
                  minRows={2}
                  autosize
                  placeholder={
                    task.status === "Blocked"
                      ? "What is stopping this task?"
                      : "Task notes, needs, or status details"
                  }
                  value={task.blocker || task.notes || ""}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setTasks((current) =>
                      current.map((item) =>
                        item.id === task.id
                          ? { ...item, blocker: value }
                          : item,
                      ),
                    );
                  }}
                  onBlur={(event) =>
                    updateTask(task, {
                      blocker: event.currentTarget.value.trim() || null,
                    })
                  }
                />
              </Card>
            ))}
          </Stack>
        )}
      </Card>

      <Card withBorder radius="lg" p="lg">
        <Group gap="xs" mb={4}><IconNotes size={21} /><Title order={3}>End-of-Day Project Update</Title></Group>
        <Text c="dimmed" size="sm" mb="lg">The project lead records progress, needs, risks, and decisions here for the leadership summary.</Text>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <TextInput
            type="date"
            label="Update Date"
            required
            value={dailyForm.update_date}
            onChange={(event) => updateDailyForm("update_date", event.currentTarget.value)}
          />
          <Select label="Overall Status" allowDeselect={false} value={dailyForm.status} data={["On Track", "At Risk", "Blocked", "Complete"]} onChange={(value) => updateDailyForm("status", value || "On Track")} />
          <TextInput
            label="Updated By"
            value={project.assigned_to || activeUser || "Project Lead"}
            readOnly
          />
          <Checkbox mt={30} label="Leadership attention required" checked={dailyForm.leadership_attention_required} onChange={(event) => updateDailyForm("leadership_attention_required", event.currentTarget.checked)} />
          <Textarea label="Completed Today" minRows={3} value={dailyForm.work_completed} onChange={(event) => updateDailyForm("work_completed", event.currentTarget.value)} />
          <Textarea label="Currently In Progress" minRows={3} value={dailyForm.work_in_progress} onChange={(event) => updateDailyForm("work_in_progress", event.currentTarget.value)} />
          <Textarea label="Next Steps" minRows={3} value={dailyForm.next_steps} onChange={(event) => updateDailyForm("next_steps", event.currentTarget.value)} />
          <Textarea label="Project Stoppers / Blockers" minRows={3} value={dailyForm.blockers} onChange={(event) => updateDailyForm("blockers", event.currentTarget.value)} />
          <Textarea label="Materials Needed" minRows={2} value={dailyForm.materials_needed} onChange={(event) => updateDailyForm("materials_needed", event.currentTarget.value)} />
          <Textarea label="Labor / Help Needed" minRows={2} value={dailyForm.labor_needed} onChange={(event) => updateDailyForm("labor_needed", event.currentTarget.value)} />
          <Textarea label="Leadership Decisions Needed" minRows={2} value={dailyForm.decisions_needed} onChange={(event) => updateDailyForm("decisions_needed", event.currentTarget.value)} />
          <Textarea label="Schedule Changes" minRows={2} value={dailyForm.schedule_change} onChange={(event) => updateDailyForm("schedule_change", event.currentTarget.value)} />
          <Textarea label="Budget Changes" minRows={2} value={dailyForm.budget_change} onChange={(event) => updateDailyForm("budget_change", event.currentTarget.value)} />
        </SimpleGrid>

        <Group justify="flex-end" mt="lg">
          <Button
            variant="light"
            color="gray"
            loading={savingNoChange}
            onClick={saveNoChangeUpdate}
          >
            No Change Today
          </Button>
          <Button color="red" leftSection={<IconCheck size={17} />} loading={savingUpdate} onClick={saveDailyUpdate}>Save Project Update</Button>
        </Group>
      </Card>

      <Card withBorder radius="lg" p="lg">
        <Title order={3} mb="md">Recent Updates</Title>
        {dailyUpdates.length === 0 ? <Text c="dimmed">No daily updates have been recorded for this project.</Text> : (
          <Stack gap="md">
            {dailyUpdates.map((update) => (
              <Card key={update.id} withBorder radius="md" p="md">
                <Group justify="space-between" mb="sm"><Group><Badge color={statusColor(update.status)}>{update.status}</Badge>{update.leadership_attention_required && <Badge color="red" leftSection={<IconAlertTriangle size={12} />}>Leadership Attention</Badge>}</Group><Text size="sm" c="dimmed">{formatDate(update.update_date)} · {update.project_lead || "Project Lead"}</Text></Group>
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                  {update.work_completed && <div><Text size="xs" fw={800} tt="uppercase">Completed</Text><Text size="sm" style={{ whiteSpace: "pre-wrap" }}>{update.work_completed}</Text></div>}
                  {update.work_in_progress && <div><Text size="xs" fw={800} tt="uppercase">In Progress</Text><Text size="sm" style={{ whiteSpace: "pre-wrap" }}>{update.work_in_progress}</Text></div>}
                  {update.next_steps && <div><Text size="xs" fw={800} tt="uppercase">Next Steps</Text><Text size="sm" style={{ whiteSpace: "pre-wrap" }}>{update.next_steps}</Text></div>}
                  {update.blockers && <div><Text size="xs" fw={800} tt="uppercase" c="red">Blockers</Text><Text size="sm" style={{ whiteSpace: "pre-wrap" }}>{update.blockers}</Text></div>}
                  {update.materials_needed && <div><Text size="xs" fw={800} tt="uppercase">Materials Needed</Text><Text size="sm">{update.materials_needed}</Text></div>}
                  {update.decisions_needed && <div><Text size="xs" fw={800} tt="uppercase">Decisions Needed</Text><Text size="sm">{update.decisions_needed}</Text></div>}
                </SimpleGrid>
              </Card>
            ))}
          </Stack>
        )}
      </Card>

      <Modal opened={taskModalOpen} onClose={() => setTaskModalOpen(false)} title="Add Project Checklist Item" centered size="lg">
        <Stack>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput label="Phase / Section" placeholder="Planning, Fabrication, Install..." value={taskForm.phase} onChange={(event) => updateTaskForm("phase", event.currentTarget.value)} />
            <TextInput label="Assigned To" value={taskForm.assigned_to} onChange={(event) => updateTaskForm("assigned_to", event.currentTarget.value)} />
          </SimpleGrid>
          <TextInput label="Task" required placeholder="What must be completed?" value={taskForm.task_title} onChange={(event) => updateTaskForm("task_title", event.currentTarget.value)} />
          <Textarea label="Description" minRows={2} value={taskForm.task_description} onChange={(event) => updateTaskForm("task_description", event.currentTarget.value)} />
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <Select label="Priority" allowDeselect={false} value={taskForm.priority} data={["Low", "Normal", "High", "Urgent"]} onChange={(value) => setTaskForm((current) => ({ ...current, priority: value || "Normal" }))} />
            <Select label="Status" allowDeselect={false} value={taskForm.status} data={["Not Started", "In Progress", "Blocked", "Complete", "Not Applicable"]} onChange={(value) => setTaskForm((current) => ({ ...current, status: value || "Not Started" }))} />
            <TextInput type="date" label="Target Date" value={taskForm.target_date} onChange={(event) => updateTaskForm("target_date", event.currentTarget.value)} />
          </SimpleGrid>
          <Textarea label="Blocker / Project Stopper" minRows={2} value={taskForm.blocker} onChange={(event) => updateTaskForm("blocker", event.currentTarget.value)} />
          <Textarea label="Notes" minRows={2} value={taskForm.notes} onChange={(event) => updateTaskForm("notes", event.currentTarget.value)} />
          <Group justify="flex-end"><Button variant="light" color="gray" onClick={() => setTaskModalOpen(false)}>Cancel</Button><Button color="red" loading={savingTask} onClick={addTask}>Add Task</Button></Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

export default ProjectTrackingWorkspace;
