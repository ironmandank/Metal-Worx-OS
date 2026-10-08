import { useState } from "react";
import { Alert, Button, Group, SimpleGrid, Stack, Text, Textarea } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconBolt, IconCheck } from "@tabler/icons-react";

import { supabase } from "../lib/supabase";

export default function ProjectQuickUpdate({ project, activeUser, onSaved }) {
  const [completed, setCompleted] = useState("");
  const [inProgress, setInProgress] = useState("");
  const [nextStep, setNextStep] = useState(project?.next_action || "");
  const [blocker, setBlocker] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (![completed, inProgress, nextStep, blocker].some((value) => value.trim())) {
      notifications.show({ title: "Update Needed", message: "Enter at least one project update.", color: "orange" });
      return;
    }
    setSaving(true);
    const updateDate = new Date().toISOString().slice(0, 10);
    const { error } = await supabase.from("project_daily_updates").insert({
      project_id: project.id,
      update_date: updateDate,
      project_lead: activeUser || project.assigned_to || null,
      status: blocker.trim() ? "Blocked" : project.status || "In Progress",
      work_completed: completed.trim() || null,
      work_in_progress: inProgress.trim() || null,
      next_steps: nextStep.trim() || null,
      blockers: blocker.trim() || null,
      leadership_attention_required: Boolean(blocker.trim()),
    });
    if (!error && (nextStep.trim() || blocker.trim())) {
      const projectUpdate = {};
      if (nextStep.trim()) projectUpdate.next_action = nextStep.trim();
      if (blocker.trim()) projectUpdate.blocked_details = blocker.trim();
      const result = await supabase.from("projects").update(projectUpdate).eq("id", project.id);
      if (result.error) {
        setSaving(false);
        notifications.show({ title: "Project Could Not Be Updated", message: result.error.message, color: "red" });
        return;
      }
    }
    setSaving(false);
    if (error) {
      notifications.show({ title: "Daily Update Could Not Be Saved", message: error.message, color: "red" });
      return;
    }
    setCompleted("");
    setInProgress("");
    setBlocker("");
    notifications.show({ title: "Today's Update Saved", message: "The Morning Huddle will show this project update.", color: "green" });
    onSaved?.();
  }

  return (
    <Alert color="red" variant="light" icon={<IconBolt size={22} />} title="Update Today">
      <Stack gap="sm">
        <Text size="sm">Record today’s progress here. Use Daily Updates for the full report when more detail is needed.</Text>
        <SimpleGrid cols={{ base: 1, md: 2 }}>
          <Textarea label="Completed Today" minRows={2} value={completed} onChange={(event) => setCompleted(event.currentTarget.value)} placeholder="What was finished?" />
          <Textarea label="In Progress" minRows={2} value={inProgress} onChange={(event) => setInProgress(event.currentTarget.value)} placeholder="What is the team working on now?" />
          <Textarea label="Next Step" minRows={2} value={nextStep} onChange={(event) => setNextStep(event.currentTarget.value)} placeholder="What happens next?" />
          <Textarea label="Blocker (optional)" minRows={2} value={blocker} onChange={(event) => setBlocker(event.currentTarget.value)} placeholder="Only enter something that needs attention." />
        </SimpleGrid>
        <Group justify="flex-end"><Button color="red" loading={saving} leftSection={<IconCheck size={16} />} onClick={save}>Save Today's Update</Button></Group>
      </Stack>
    </Alert>
  );
}
