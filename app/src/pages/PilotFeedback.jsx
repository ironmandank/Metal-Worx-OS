import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  FileInput,
  Group,
  Image,
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
  IconAlertTriangle,
  IconBug,
  IconCheck,
  IconEye,
  IconMessageReport,
  IconPaperclip,
  IconRefresh,
  IconTool,
} from "@tabler/icons-react";

import MWPageHeader from "../components/ui/MWPageHeader";
import MWSection from "../components/ui/MWSection";
import {
  createPilotFeedback,
  getPilotFeedback,
  PILOT_FEEDBACK_CATEGORIES,
  PILOT_FEEDBACK_PRIORITIES,
  PILOT_FEEDBACK_STATUSES,
  resolvePilotFeedback,
  updatePilotFeedback,
} from "../services/pilotFeedbackService";

const EMPTY_FORM = {
  title: "",
  description: "",
  page_name: "",
  attempted_action: "",
  actual_result: "",
  suggested_improvement: "",
  category: "Issue",
  priority: "Normal",
  blocked_work: false,
};

function priorityColor(priority) {
  if (priority === "Critical") return "red";
  if (priority === "High") return "orange";
  if (priority === "Low") return "gray";
  return "blue";
}

function statusColor(status) {
  if (["Resolved", "Closed"].includes(status)) return "green";
  if (status === "In Progress") return "blue";
  if (status === "Reviewing") return "yellow";
  if (status === "Deferred") return "gray";
  return "red";
}

function formatDate(value) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function PilotFeedback() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [screenshot, setScreenshot] = useState(null);
  const [statusFilter, setStatusFilter] = useState("Active");
  const [selectedItem, setSelectedItem] = useState(null);
  const [resolutionNotes, setResolutionNotes] = useState("");

  useEffect(() => {
    loadFeedback();
  }, []);

  async function loadFeedback() {
    setLoading(true);
    try {
      setItems(await getPilotFeedback());
    } catch (error) {
      notifications.show({
        color: "red",
        title: "Could not load pilot feedback",
        message: error.message,
      });
    } finally {
      setLoading(false);
    }
  }

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submitFeedback() {
    if (!form.title.trim() || !form.description.trim()) {
      notifications.show({
        color: "orange",
        title: "More information needed",
        message: "Enter a short title and explain what happened.",
      });
      return;
    }

    setSaving(true);
    try {
      await createPilotFeedback(form, screenshot);
      setForm(EMPTY_FORM);
      setScreenshot(null);
      await loadFeedback();
      notifications.show({
        color: "green",
        title: "Feedback recorded",
        message: "The pilot issue is now available for management review.",
      });
    } catch (error) {
      notifications.show({
        color: "red",
        title: "Could not save feedback",
        message: error.message,
      });
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(item, status) {
    try {
      await updatePilotFeedback(item.id, { status });
      await loadFeedback();
      setSelectedItem((current) =>
        current?.id === item.id ? { ...current, status } : current
      );
    } catch (error) {
      notifications.show({
        color: "red",
        title: "Could not update feedback",
        message: error.message,
      });
    }
  }

  async function markResolved() {
    if (!selectedItem) return;
    try {
      await resolvePilotFeedback(selectedItem.id, resolutionNotes);
      setSelectedItem(null);
      setResolutionNotes("");
      await loadFeedback();
      notifications.show({
        color: "green",
        title: "Issue resolved",
        message: "The resolution was recorded successfully.",
      });
    } catch (error) {
      notifications.show({
        color: "red",
        title: "Could not resolve feedback",
        message: error.message,
      });
    }
  }

  const filteredItems = useMemo(() => {
    if (statusFilter === "All") return items;
    if (statusFilter === "Active") {
      return items.filter((item) => !["Resolved", "Closed"].includes(item.status));
    }
    return items.filter((item) => item.status === statusFilter);
  }, [items, statusFilter]);

  const metrics = useMemo(
    () => ({
      open: items.filter((item) => item.status === "Open").length,
      blocked: items.filter(
        (item) => item.blocked_work && !["Resolved", "Closed"].includes(item.status)
      ).length,
      active: items.filter((item) =>
        ["Reviewing", "In Progress"].includes(item.status)
      ).length,
      resolved: items.filter((item) => ["Resolved", "Closed"].includes(item.status))
        .length,
    }),
    [items]
  );

  return (
    <>
      <MWPageHeader
        title="Employee Pilot Feedback"
        subtitle="Report problems, improvement ideas, questions, and training needs while testing Metal Worx OS."
      />

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="lg" mb="xl">
        {[
          ["Open", metrics.open, "red", IconBug],
          ["Work Blocked", metrics.blocked, "orange", IconAlertTriangle],
          ["Being Handled", metrics.active, "blue", IconTool],
          ["Resolved", metrics.resolved, "green", IconCheck],
        ].map(([label, value, color, Icon]) => (
          <Card
            key={label}
            withBorder
            radius="lg"
            p="lg"
            style={{
              background:
                "linear-gradient(145deg, rgba(27, 31, 36, 0.98), rgba(16, 19, 23, 0.98))",
              minHeight: 122,
            }}
          >
            <div
              style={{
                alignItems: "center",
                display: "grid",
                gap: 16,
                gridTemplateColumns: "52px minmax(0, 1fr)",
                minHeight: 84,
                width: "100%",
              }}
            >
              <div
                style={{
                  alignItems: "center",
                  background: `var(--mantine-color-${color}-9)`,
                  border: `1px solid var(--mantine-color-${color}-7)`,
                  borderRadius: 14,
                  display: "flex",
                  height: 52,
                  justifyContent: "center",
                  width: 52,
                }}
              >
                <Icon
                  size={25}
                  color="white"
                  style={{
                    display: "block",
                    inset: "auto",
                    margin: 0,
                    position: "static",
                    transform: "none",
                  }}
                />
              </div>
              <div style={{ minWidth: 0 }}>
                <Title
                  order={2}
                  c={color}
                  style={{
                    fontSize: "2.15rem",
                    lineHeight: 1,
                    marginBottom: 8,
                  }}
                >
                  {value}
                </Title>
                <Text
                  size="xs"
                  fw={900}
                  c="dimmed"
                  tt="uppercase"
                  style={{ letterSpacing: "0.08em", lineHeight: 1.25 }}
                >
                  {label}
                </Text>
              </div>
            </div>
          </Card>
        ))}
      </SimpleGrid>

      <MWSection
        title="Report Something"
        subtitle="Give enough detail that someone else can reproduce or understand it."
      >
        <Stack gap="lg">
          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
            <Select
              label="Feedback Type"
              data={PILOT_FEEDBACK_CATEGORIES}
              value={form.category}
              onChange={(value) => setField("category", value || "Issue")}
            />
            <Select
              label="Priority"
              data={PILOT_FEEDBACK_PRIORITIES}
              value={form.priority}
              onChange={(value) => setField("priority", value || "Normal")}
            />
            <TextInput
              label="Page or Area"
              placeholder="Example: Production Control"
              value={form.page_name}
              onChange={(event) => setField("page_name", event.currentTarget.value)}
            />
          </SimpleGrid>

          <TextInput
            required
            label="Short Title"
            placeholder="Example: Start Work button did not respond"
            value={form.title}
            onChange={(event) => setField("title", event.currentTarget.value)}
          />

          <Textarea
            required
            minRows={3}
            autosize
            label="What Happened?"
            placeholder="Describe the problem or idea in your own words."
            value={form.description}
            onChange={(event) => setField("description", event.currentTarget.value)}
          />

          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
            <Textarea
              minRows={3}
              autosize
              label="What Were You Trying to Do?"
              placeholder="List the action or steps you followed."
              value={form.attempted_action}
              onChange={(event) => setField("attempted_action", event.currentTarget.value)}
            />
            <Textarea
              minRows={3}
              autosize
              label="What Did the App Do?"
              placeholder="Include any error message or unexpected result."
              value={form.actual_result}
              onChange={(event) => setField("actual_result", event.currentTarget.value)}
            />
          </SimpleGrid>

          <Textarea
            minRows={2}
            autosize
            label="Suggested Improvement"
            placeholder="Optional: tell us what would make this easier."
            value={form.suggested_improvement}
            onChange={(event) =>
              setField("suggested_improvement", event.currentTarget.value)
            }
          />

          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
            <FileInput
              label="Screenshot"
              description="Optional image showing the problem"
              placeholder="Choose screenshot"
              accept="image/png,image/jpeg,image/webp"
              leftSection={<IconPaperclip size={16} />}
              value={screenshot}
              onChange={setScreenshot}
              clearable
            />
            <Checkbox
              mt={{ base: 0, md: 30 }}
              label="This problem stopped me from continuing my work"
              checked={form.blocked_work}
              onChange={(event) => setField("blocked_work", event.currentTarget.checked)}
            />
          </SimpleGrid>

          {form.blocked_work && (
            <Alert color="orange" icon={<IconAlertTriangle size={20} />}>
              This report will be clearly marked as blocking employee work.
            </Alert>
          )}

          <Group justify="flex-end">
            <Button
              color="red"
              size="md"
              leftSection={<IconMessageReport size={18} />}
              loading={saving}
              onClick={submitFeedback}
            >
              Submit Feedback
            </Button>
          </Group>
        </Stack>
      </MWSection>

      <MWSection
        title="Pilot Issue Board"
        subtitle={`${filteredItems.length} feedback item${filteredItems.length === 1 ? "" : "s"} shown`}
      >
        <Group mb="lg" align="flex-end">
          <Select
            label="Status"
            data={["Active", "All", ...PILOT_FEEDBACK_STATUSES]}
            value={statusFilter}
            onChange={(value) => setStatusFilter(value || "Active")}
            w={{ base: "100%", sm: 240 }}
          />
          <Button
            variant="subtle"
            color="gray"
            leftSection={<IconRefresh size={17} />}
            onClick={loadFeedback}
          >
            Refresh
          </Button>
        </Group>

        {loading ? (
          <Group justify="center" py="xl">
            <Loader color="red" />
          </Group>
        ) : filteredItems.length === 0 ? (
          <Card withBorder radius="lg" p="xl">
            <Text c="dimmed" ta="center">
              No pilot feedback matches this status.
            </Text>
          </Card>
        ) : (
          <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
            {filteredItems.map((item) => (
              <Card key={item.id} withBorder radius="lg" p="lg">
                <Stack gap="sm">
                  <Group justify="space-between" align="flex-start">
                    <Group gap="xs">
                      <Badge color={statusColor(item.status)}>{item.status}</Badge>
                      <Badge color={priorityColor(item.priority)} variant="light">
                        {item.priority}
                      </Badge>
                      <Badge color="gray" variant="outline">
                        {item.category}
                      </Badge>
                    </Group>
                    {item.blocked_work && <Badge color="orange">Work Blocked</Badge>}
                  </Group>

                  <Title order={3}>{item.title}</Title>
                  <Text>{item.description}</Text>
                  <Text size="sm" c="dimmed">
                    {item.page_name || "Page not specified"} • Reported by {item.reported_by_name || "Unknown"} • {formatDate(item.created_at)}
                  </Text>

                  <Group justify="space-between" mt="sm">
                    <Select
                      aria-label="Feedback status"
                      data={PILOT_FEEDBACK_STATUSES}
                      value={item.status}
                      onChange={(value) => value && changeStatus(item, value)}
                      w={170}
                    />
                    <Button
                      variant="light"
                      color="gray"
                      leftSection={<IconEye size={17} />}
                      onClick={() => {
                        setSelectedItem(item);
                        setResolutionNotes(item.resolution_notes || "");
                      }}
                    >
                      Review
                    </Button>
                  </Group>
                </Stack>
              </Card>
            ))}
          </SimpleGrid>
        )}
      </MWSection>

      <Modal
        opened={Boolean(selectedItem)}
        onClose={() => setSelectedItem(null)}
        title="Pilot Feedback Review"
        size="lg"
        centered
      >
        {selectedItem && (
          <Stack gap="md">
            <Group gap="xs">
              <Badge color={statusColor(selectedItem.status)}>
                {selectedItem.status}
              </Badge>
              <Badge color={priorityColor(selectedItem.priority)}>
                {selectedItem.priority}
              </Badge>
              {selectedItem.blocked_work && <Badge color="orange">Work Blocked</Badge>}
            </Group>
            <Title order={3}>{selectedItem.title}</Title>
            <Text>{selectedItem.description}</Text>

            {selectedItem.attempted_action && (
              <div>
                <Text fw={800}>Attempted Action</Text>
                <Text>{selectedItem.attempted_action}</Text>
              </div>
            )}
            {selectedItem.actual_result && (
              <div>
                <Text fw={800}>Actual Result</Text>
                <Text>{selectedItem.actual_result}</Text>
              </div>
            )}
            {selectedItem.suggested_improvement && (
              <div>
                <Text fw={800}>Suggested Improvement</Text>
                <Text>{selectedItem.suggested_improvement}</Text>
              </div>
            )}
            {selectedItem.screenshot_url && (
              <Image
                src={selectedItem.screenshot_url}
                alt="Pilot feedback screenshot"
                radius="md"
                mah={420}
                fit="contain"
              />
            )}

            <Textarea
              label="Resolution Notes"
              minRows={3}
              autosize
              value={resolutionNotes}
              onChange={(event) => setResolutionNotes(event.currentTarget.value)}
              placeholder="Record what was fixed, changed, or explained."
            />

            <Group justify="flex-end">
              <Button variant="subtle" color="gray" onClick={() => setSelectedItem(null)}>
                Close
              </Button>
              <Button color="green" leftSection={<IconCheck size={17} />} onClick={markResolved}>
                Mark Resolved
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </>
  );
}

export default PilotFeedback;