import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Divider,
  Group,
  Loader,
  Modal,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconAlertTriangle,
  IconArrowDown,
  IconArrowUp,
  IconCheck,
  IconCopy,
  IconDeviceFloppy,
  IconEdit,
  IconEye,
  IconGitBranch,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconTrash,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import MWKpiStrip from "../components/ui/MWKpiStrip";
import MWPageHeader from "../components/ui/MWPageHeader";
import MWPanel from "../components/ui/MWPanel";
import { supabase } from "../lib/supabase";

const CATEGORIES = [
  "Flag",
  "Custom Art",
  "Sign",
  "Gate",
  "Hand Rail",
  "Fence",
  "Repair",
  "Powder Coat",
  "Sandblasting",
  "Laser Cutting",
  "Installation",
  "Custom Fabrication",
];

const DEFAULT_STEPS = [
  { name: "Design", department: "Design" },
  { name: "Laser", department: "Laser" },
  { name: "Prep", department: "Prep" },
  { name: "Paint", department: "Paint" },
  { name: "Quality Control", department: "QC" },
  { name: "Showroom", department: "Showroom" },
];

const EMPTY_FORM = {
  id: null,
  name: "",
  description: "",
  category: "Custom Fabrication",
  steps: DEFAULT_STEPS,
  is_active: true,
};

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSteps(steps) {
  if (!Array.isArray(steps)) return [];

  return steps
    .map((step) => {
      if (typeof step === "string") {
        return { name: cleanText(step), department: cleanText(step) };
      }

      return {
        name: cleanText(step?.name || step?.step_name || step?.department),
        department: cleanText(step?.department || step?.name || step?.step_name),
      };
    })
    .filter((step) => step.name || step.department)
    .map((step) => ({
      name: step.name || step.department,
      department: step.department || step.name,
    }));
}

function WorkflowTemplates({ setPage }) {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [expandedIds, setExpandedIds] = useState([]);
  const [editorOpened, setEditorOpened] = useState(false);
  const [editorMode, setEditorMode] = useState("create");
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const refreshTimerRef = useRef(null);

  const loadWorkflows = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    else setRefreshing(true);
    setErrorMessage("");

    try {
      const { data, error } = await supabase
        .from("workflow_templates")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;
      setWorkflows(data || []);
    } catch (error) {
      console.error("Workflow template load error:", error);
      setErrorMessage(
        error?.message || "The workflow template library could not load."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadWorkflows(true);

    const scheduleRefresh = () => {
      window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = window.setTimeout(
        () => loadWorkflows(false),
        250
      );
    };

    const channel = supabase
      .channel("metal-worx-workflow-templates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "workflow_templates" },
        scheduleRefresh
      )
      .subscribe();

    return () => {
      window.clearTimeout(refreshTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [loadWorkflows]);

  const categoryOptions = useMemo(() => {
    const categories = [
      ...new Set(
        workflows.map((workflow) => cleanText(workflow.category)).filter(Boolean)
      ),
    ].sort((a, b) => a.localeCompare(b));

    return [
      { value: "all", label: "All Categories" },
      ...categories.map((category) => ({
        value: category,
        label: category,
      })),
    ];
  }, [workflows]);

  const filteredWorkflows = useMemo(() => {
    const term = search.trim().toLowerCase();

    return workflows.filter((workflow) => {
      if (statusFilter === "active" && workflow.is_active === false) return false;
      if (statusFilter === "inactive" && workflow.is_active !== false) return false;

      if (
        categoryFilter !== "all" &&
        cleanText(workflow.category) !== categoryFilter
      ) {
        return false;
      }

      if (!term) return true;

      const steps = normalizeSteps(workflow.steps);

      return [
        workflow.name,
        workflow.description,
        workflow.category,
        ...steps.flatMap((step) => [step.name, step.department]),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [categoryFilter, search, statusFilter, workflows]);

  const activeCount = workflows.filter(
    (workflow) => workflow.is_active !== false
  ).length;
  const inactiveCount = workflows.length - activeCount;
  const totalSteps = workflows.reduce(
    (sum, workflow) => sum + normalizeSteps(workflow.steps).length,
    0
  );

  function openCreate() {
    setEditorMode("create");
    setFormData({
      ...EMPTY_FORM,
      steps: DEFAULT_STEPS.map((step) => ({ ...step })),
    });
    setValidationErrors([]);
    setEditorOpened(true);
  }

  function openEdit(workflow) {
    setEditorMode("edit");
    setFormData({
      id: workflow.id,
      name: workflow.name || "",
      description: workflow.description || "",
      category: workflow.category || "Custom Fabrication",
      steps: normalizeSteps(workflow.steps),
      is_active: workflow.is_active !== false,
    });
    setValidationErrors([]);
    setEditorOpened(true);
  }

  function openCopy(workflow) {
    setEditorMode("copy");
    setFormData({
      id: null,
      name: `${workflow.name || "Workflow"} Copy`,
      description: workflow.description || "",
      category: workflow.category || "Custom Fabrication",
      steps: normalizeSteps(workflow.steps),
      is_active: true,
    });
    setValidationErrors([]);
    setEditorOpened(true);
  }

  function updateForm(field, value) {
    setValidationErrors([]);
    setFormData((current) => ({ ...current, [field]: value }));
  }

  function updateStep(index, field, value) {
    setValidationErrors([]);
    setFormData((current) => ({
      ...current,
      steps: current.steps.map((step, stepIndex) =>
        stepIndex === index ? { ...step, [field]: value } : step
      ),
    }));
  }

  function addStep() {
    setFormData((current) => ({
      ...current,
      steps: [...current.steps, { name: "", department: "" }],
    }));
  }

  function removeStep(index) {
    setFormData((current) => ({
      ...current,
      steps: current.steps.filter((_, stepIndex) => stepIndex !== index),
    }));
  }

  function moveStep(index, direction) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= formData.steps.length) return;

    setFormData((current) => {
      const steps = [...current.steps];
      [steps[index], steps[targetIndex]] = [steps[targetIndex], steps[index]];
      return { ...current, steps };
    });
  }

  function validateWorkflow() {
    const errors = [];
    const steps = normalizeSteps(formData.steps);

    if (!cleanText(formData.name)) errors.push("Workflow Name is required.");
    if (!cleanText(formData.category)) errors.push("Category is required.");
    if (!steps.length) errors.push("Add at least one workflow step.");

    formData.steps.forEach((step, index) => {
      if (!cleanText(step.name)) {
        errors.push(`Step ${index + 1} needs a step name.`);
      }
      if (!cleanText(step.department)) {
        errors.push(`Step ${index + 1} needs a responsible department.`);
      }
    });

    return errors;
  }

  async function saveWorkflow() {
    if (saving) return;

    const errors = validateWorkflow();
    if (errors.length) {
      setValidationErrors(errors);
      return;
    }

    setSaving(true);

    try {
      const payload = {
        name: cleanText(formData.name),
        description: cleanText(formData.description),
        category: cleanText(formData.category),
        steps: normalizeSteps(formData.steps),
        is_active: Boolean(formData.is_active),
      };

      let duplicateQuery = supabase
        .from("workflow_templates")
        .select("id, name")
        .ilike("name", payload.name);

      if (editorMode === "edit" && formData.id) {
        duplicateQuery = duplicateQuery.neq("id", formData.id);
      }

      const { data: duplicates, error: duplicateError } = await duplicateQuery;
      if (duplicateError) throw duplicateError;
      if ((duplicates || []).length) {
        throw new Error(`A workflow named “${payload.name}” already exists.`);
      }

      if (editorMode === "edit" && formData.id) {
        const { error } = await supabase
          .from("workflow_templates")
          .update(payload)
          .eq("id", formData.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("workflow_templates")
          .insert([payload]);

        if (error) throw error;
      }

      notifications.show({
        title:
          editorMode === "edit" ? "Workflow Updated" : "Workflow Created",
        message: `${payload.name} is ready for use.`,
        color: "green",
        icon: <IconCheck size={18} />,
      });

      setEditorOpened(false);
      await loadWorkflows(false);
    } catch (error) {
      notifications.show({
        title: "Workflow Could Not Be Saved",
        message: error.message,
        color: "red",
      });
    } finally {
      setSaving(false);
    }
  }

  function toggleExpanded(id) {
    setExpandedIds((current) =>
      current.includes(id)
        ? current.filter((workflowId) => workflowId !== id)
        : [...current, id]
    );
  }

  if (loading) {
    return (
      <Stack gap="xl">
        <MWPageHeader
          title="Workflow Templates"
          subtitle="Loading reusable production workflows."
          setPage={setPage}
        />
        <MWPanel>
          <Group justify="center" py={80}>
            <Loader color="red" />
            <Text c="dimmed">Loading workflow templates...</Text>
          </Group>
        </MWPanel>
      </Stack>
    );
  }

  return (
    <Stack gap="xl">
      <MWPageHeader
        title="Workflow Templates"
        subtitle="Reusable production routes for flags, railings, repairs, signs, and fabrication."
        buttonText="+ New Workflow"
        onButtonClick={openCreate}
        setPage={setPage}
      />

      <MWKpiStrip
        compact
        columns={{ base: 1, sm: 2, xl: 4 }}
        items={[
          {
            label: "Workflows",
            value: workflows.length,
            description: "Total production routes",
            icon: IconGitBranch,
            color: "red",
          },
          {
            label: "Active",
            value: activeCount,
            description: "Available for production",
            icon: IconCheck,
            color: "green",
          },
          {
            label: "Inactive",
            value: inactiveCount,
            description: "Retained but unavailable",
            icon: IconAlertTriangle,
            color: "gray",
          },
          {
            label: "Defined Steps",
            value: totalSteps,
            description: "Across all workflows",
            icon: IconGitBranch,
            color: "blue",
          },
        ]}
      />

      <MWPanel
        title="Workflow Controls"
        subtitle={`${filteredWorkflows.length} of ${workflows.length} workflows shown`}
        icon={IconSearch}
      >
        <Group wrap="wrap">
          <TextInput
            style={{ flex: 1, minWidth: 280 }}
            placeholder="Search workflow, category, step, or department..."
            leftSection={<IconSearch size={17} />}
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
          />
          <Select
            w={185}
            value={statusFilter}
            onChange={(value) => setStatusFilter(value || "active")}
            allowDeselect={false}
            data={[
              { value: "active", label: "Active Workflows" },
              { value: "inactive", label: "Inactive Workflows" },
              { value: "all", label: "All Workflows" },
            ]}
          />
          <Select
            w={215}
            searchable
            value={categoryFilter}
            onChange={(value) => setCategoryFilter(value || "all")}
            allowDeselect={false}
            data={categoryOptions}
          />
          <Button
            variant="light"
            color="gray"
            leftSection={
              refreshing ? <Loader size={16} /> : <IconRefresh size={17} />
            }
            disabled={refreshing}
            onClick={() => loadWorkflows(false)}
          >
            Refresh
          </Button>
        </Group>
      </MWPanel>

      {errorMessage && (
        <Alert
          color="red"
          icon={<IconAlertTriangle size={18} />}
          title="Workflow Library Warning"
        >
          {errorMessage}
        </Alert>
      )}

      <MWPanel
        title="Workflow Library"
        subtitle="Production recipes used to generate ordered work"
        icon={IconGitBranch}
      >
        {!filteredWorkflows.length ? (
          <Alert color="gray" icon={<IconGitBranch size={19} />}>
            No workflow templates match the current filters.
          </Alert>
        ) : (
          <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }} spacing="lg">
            {filteredWorkflows.map((workflow) => {
              const steps = normalizeSteps(workflow.steps);
              const expanded = expandedIds.includes(workflow.id);

              return (
                <Card
                  key={workflow.id}
                  withBorder
                  radius="lg"
                  p="lg"
                  shadow="sm"
                  style={{
                    background: "rgba(255,255,255,.025)",
                    borderColor:
                      workflow.is_active === false
                        ? "rgba(255,255,255,.07)"
                        : "rgba(220,0,30,.22)",
                    opacity: workflow.is_active === false ? 0.75 : 1,
                  }}
                >
                  <Stack gap="md">
                    <Group justify="space-between" align="flex-start">
                      <Group gap="xs" wrap="wrap">
                        <Badge color="red" variant="light">
                          {workflow.category || "Workflow"}
                        </Badge>
                        <Badge
                          color={workflow.is_active === false ? "gray" : "green"}
                          variant="light"
                        >
                          {workflow.is_active === false ? "Inactive" : "Active"}
                        </Badge>
                      </Group>
                      <ThemeIcon color="red" variant="light" radius="md">
                        <IconGitBranch size={18} />
                      </ThemeIcon>
                    </Group>

                    <Box>
                      <Title
                        order={3}
                        c="white"
                        style={{ lineHeight: 1.2, overflowWrap: "anywhere" }}
                      >
                        {workflow.name || "Unnamed Workflow"}
                      </Title>
                      <Text
                        c="dimmed"
                        size="sm"
                        mt={6}
                        lineClamp={expanded ? undefined : 2}
                      >
                        {workflow.description || "No workflow description."}
                      </Text>
                    </Box>

                    <Card
                      withBorder
                      radius="md"
                      p="sm"
                      style={{ background: "rgba(0,0,0,.18)" }}
                    >
                      <Group justify="space-between">
                        <Text size="xs" c="dimmed" fw={850} tt="uppercase">
                          Production Route
                        </Text>
                        <Badge color="gray" variant="light">
                          {steps.length} step{steps.length === 1 ? "" : "s"}
                        </Badge>
                      </Group>

                      <Stack gap={6} mt="sm">
                        {(expanded ? steps : steps.slice(0, 4)).map(
                          (step, index) => (
                            <Group key={`${step.name}-${index}`} wrap="nowrap">
                              <Badge
                                color="red"
                                variant="light"
                                circle
                                size="sm"
                              >
                                {index + 1}
                              </Badge>
                              <Text size="sm" fw={750}>
                                {step.name}
                              </Text>
                              <Text size="xs" c="dimmed">
                                {step.department}
                              </Text>
                            </Group>
                          )
                        )}
                        {!expanded && steps.length > 4 && (
                          <Text size="xs" c="dimmed">
                            + {steps.length - 4} additional step
                            {steps.length - 4 === 1 ? "" : "s"}
                          </Text>
                        )}
                      </Stack>
                    </Card>

                    <Group grow>
                      <Button
                        variant="light"
                        color="gray"
                        leftSection={<IconEye size={16} />}
                        onClick={() => toggleExpanded(workflow.id)}
                      >
                        {expanded ? "Collapse" : "View Route"}
                      </Button>
                      <Button
                        color="red"
                        variant="light"
                        leftSection={<IconEdit size={16} />}
                        onClick={() => openEdit(workflow)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="subtle"
                        color="gray"
                        leftSection={<IconCopy size={16} />}
                        onClick={() => openCopy(workflow)}
                      >
                        Copy
                      </Button>
                    </Group>
                  </Stack>
                </Card>
              );
            })}
          </SimpleGrid>
        )}
      </MWPanel>

      <Modal
        opened={editorOpened}
        onClose={() => !saving && setEditorOpened(false)}
        title={
          editorMode === "edit"
            ? "Edit Workflow"
            : editorMode === "copy"
              ? "Copy Workflow"
              : "New Workflow"
        }
        size="xl"
        centered
        closeOnClickOutside={!saving}
        closeOnEscape={!saving}
      >
        <Stack gap="lg">
          {validationErrors.length > 0 && (
            <Alert
              color="orange"
              icon={<IconAlertTriangle size={18} />}
              title="Workflow Needs Attention"
            >
              <Stack gap={3}>
                {validationErrors.map((error) => (
                  <Text size="sm" key={error}>
                    • {error}
                  </Text>
                ))}
              </Stack>
            </Alert>
          )}

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <TextInput
              label="Workflow Name"
              value={formData.name}
              onChange={(event) => updateForm("name", event.currentTarget.value)}
              required
              maxLength={150}
            />
            <Select
              label="Category"
              data={CATEGORIES}
              value={formData.category}
              onChange={(value) =>
                updateForm("category", value || "Custom Fabrication")
              }
              searchable
              allowDeselect={false}
              required
            />
          </SimpleGrid>

          <Textarea
            label="Description"
            value={formData.description}
            onChange={(event) =>
              updateForm("description", event.currentTarget.value)
            }
            minRows={3}
          />

          <Switch
            label="Active Workflow"
            description="Active workflows can be selected for new production work"
            checked={formData.is_active}
            onChange={(event) =>
              updateForm("is_active", event.currentTarget.checked)
            }
          />

          <Divider label="Ordered Production Steps" labelPosition="left" />

          <Stack gap="sm">
            {formData.steps.map((step, index) => (
              <Card key={`editor-step-${index}`} withBorder radius="md" p="sm">
                <Group align="flex-end" wrap="nowrap">
                  <Badge color="red" variant="light" size="lg">
                    {index + 1}
                  </Badge>
                  <TextInput
                    label="Step Name"
                    style={{ flex: 1 }}
                    value={step.name}
                    onChange={(event) =>
                      updateStep(index, "name", event.currentTarget.value)
                    }
                    required
                  />
                  <TextInput
                    label="Department"
                    style={{ flex: 1 }}
                    value={step.department}
                    onChange={(event) =>
                      updateStep(index, "department", event.currentTarget.value)
                    }
                    required
                  />
                  <ActionIcon
                    variant="light"
                    color="gray"
                    disabled={index === 0}
                    onClick={() => moveStep(index, -1)}
                    aria-label="Move step up"
                  >
                    <IconArrowUp size={17} />
                  </ActionIcon>
                  <ActionIcon
                    variant="light"
                    color="gray"
                    disabled={index === formData.steps.length - 1}
                    onClick={() => moveStep(index, 1)}
                    aria-label="Move step down"
                  >
                    <IconArrowDown size={17} />
                  </ActionIcon>
                  <ActionIcon
                    variant="light"
                    color="red"
                    onClick={() => removeStep(index)}
                    aria-label="Remove step"
                  >
                    <IconTrash size={17} />
                  </ActionIcon>
                </Group>
              </Card>
            ))}

            <Button
              variant="light"
              color="gray"
              leftSection={<IconPlus size={17} />}
              onClick={addStep}
            >
              Add Workflow Step
            </Button>
          </Stack>

          <Group justify="flex-end">
            <Button
              variant="light"
              color="gray"
              disabled={saving}
              onClick={() => setEditorOpened(false)}
            >
              Cancel
            </Button>
            <Button
              color="red"
              leftSection={<IconDeviceFloppy size={18} />}
              loading={saving}
              onClick={saveWorkflow}
            >
              {editorMode === "edit" ? "Save Changes" : "Create Workflow"}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

export default WorkflowTemplates;