import { useEffect, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Group,
  Modal,
  NumberInput,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  Table,
  Textarea,
  TextInput,
} from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import { notifications } from "@mantine/notifications";

import { supabase } from "../lib/supabase";
import MWPageHeader from "../components/ui/MWPageHeader";
import MWSection from "../components/ui/MWSection";
import { getActiveProfiles } from "../services/notificationService";

import {
  cancelProjectMaterialRequest,
  createProjectMaterialRequest,
  getProjectMaterialRequests,
  updateProjectMaterialRequest,
} from "../services/projectMaterialService";

function EditProject({ selectedProject, setPage }) {
  const [form, setForm] = useState(selectedProject || {});
  const [saving, setSaving] = useState(false);

  const [people, setPeople] = useState([
    "Chad",
    "Lori",
    "Kory",
    "Dan",
    "Chris",
    "Jesse",
    "Mike",
    "Austin",
  ]);

  const [materialRequests, setMaterialRequests] = useState([]);

  const [materialsLoading, setMaterialsLoading] = useState(false);

  const [materialEditorOpen, setMaterialEditorOpen] = useState(false);

  const [editingMaterialId, setEditingMaterialId] = useState(null);

  const [materialSaving, setMaterialSaving] = useState(false);

  const [materialForm, setMaterialForm] = useState({
    quantity: 1,
    dimensions: "",
    itemName: "",
    description: "",
    vendorName: "",
    neededBy: "",
    priority: "Normal",
    status: "Request Submitted",
    notes: "",
  });

  useEffect(() => {
    setForm(selectedProject || {});
    loadPeople();

    if (selectedProject?.id) {
      loadMaterialRequests(selectedProject.id);
    }
  }, [selectedProject]);

  async function loadPeople() {
    try {
      const profiles = await getActiveProfiles();

      const names = (profiles || [])
        .filter((profile) => profile.profile_type === "Person")
        .map((profile) => profile.display_name)
        .filter(Boolean);

      if (names.length > 0) {
        setPeople(names);
      }
    } catch (error) {
      console.error("Profile load error:", error);
    }
  }

  async function loadMaterialRequests(projectId = form.id) {
    if (!projectId) {
      setMaterialRequests([]);
      return;
    }

    setMaterialsLoading(true);

    try {
      const data = await getProjectMaterialRequests(projectId);

      setMaterialRequests(data || []);
    } catch (error) {
      console.error("Material request load error:", error);

      notifications.show({
        title: "Procurement Load Failed",

        message: error.message || "Unable to load project material requests.",

        color: "red",
      });
    } finally {
      setMaterialsLoading(false);
    }
  }

  function resetMaterialForm() {
    setMaterialForm({
      quantity: 1,
      dimensions: "",
      itemName: "",
      description: "",
      vendorName: "",
      neededBy: "",
      priority: "Normal",
      status: "Request Submitted",
      notes: "",
    });
  }

  function openNewMaterialRequest() {
    setEditingMaterialId(null);
    resetMaterialForm();
    setMaterialEditorOpen(true);
  }

  function openEditMaterialRequest(request) {
    setEditingMaterialId(request.id);

    setMaterialForm({
      quantity: request.quantity ?? 1,

      dimensions: request.dimensions || "",

      itemName: request.item_name || "",

      description: request.description || "",

      vendorName: request.vendor_name || "",

      neededBy: request.needed_by || "",

      priority: request.priority || "Normal",

      status: request.status || "Request Submitted",

      notes: request.notes || "",
    });

    setMaterialEditorOpen(true);
  }

  function updateMaterialForm(field, value) {
    setMaterialForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function saveMaterialRequest() {
    if (!materialForm.itemName.trim()) {
      notifications.show({
        title: "Missing Item",

        message: "Enter an item name before saving.",

        color: "red",
      });

      return;
    }

    setMaterialSaving(true);

    try {
      if (editingMaterialId) {
        await updateProjectMaterialRequest(editingMaterialId, {
          quantity: Number(materialForm.quantity) || 1,

          dimensions: materialForm.dimensions.trim() || null,

          item_name: materialForm.itemName.trim(),

          description: materialForm.description.trim() || null,

          vendor_name: materialForm.vendorName.trim() || null,

          needed_by: materialForm.neededBy || null,

          priority: materialForm.priority || "Normal",

          status: materialForm.status || "Request Submitted",

          notes: materialForm.notes.trim() || null,
        });
      } else {
        await createProjectMaterialRequest({
          projectId: form.id,

          projectNumber: form.project_number || null,

          projectName: form.project_name || "",

          priority: materialForm.priority || "Normal",

          quantity: Number(materialForm.quantity) || 1,

          dimensions: materialForm.dimensions || "",

          itemName: materialForm.itemName,

          description: materialForm.description || "",

          vendorName: materialForm.vendorName || "",

          assignedTo: "Lori",

          neededBy: materialForm.neededBy || null,

          status: materialForm.status || "Request Submitted",

          notes: materialForm.notes || "",

          createdBy: form.intake_owner || "",
        });
      }

      notifications.show({
        title: editingMaterialId
          ? "Material Request Updated"
          : "Material Request Added",

        message: editingMaterialId
          ? "The procurement request was updated."
          : "The request was added and Lori was notified.",

        color: "green",
      });

      setMaterialEditorOpen(false);
      setEditingMaterialId(null);
      resetMaterialForm();

      await loadMaterialRequests();
    } catch (error) {
      notifications.show({
        title: "Material Request Failed",

        message: error.message || "Unable to save the material request.",

        color: "red",
      });
    } finally {
      setMaterialSaving(false);
    }
  }

  async function cancelMaterialRequest(requestId) {
    try {
      await cancelProjectMaterialRequest(requestId);

      notifications.show({
        title: "Request Cancelled",

        message: "The procurement request was cancelled.",

        color: "green",
      });

      await loadMaterialRequests();
    } catch (error) {
      notifications.show({
        title: "Cancellation Failed",

        message: error.message,

        color: "red",
      });
    }
  }

  function materialStatusColor(status) {
    if (status === "Received") {
      return "green";
    }

    if (status === "Ordered" || status === "Partially Received") {
      return "blue";
    }

    if (status === "Cancelled") {
      return "red";
    }

    if (
      status === "Pricing Needed" ||
      status === "Ready to Order" ||
      status === "Request Submitted"
    ) {
      return "orange";
    }

    return "gray";
  }

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function saveProject() {
    if (!form.id) {
      notifications.show({
        title: "Project Not Found",

        message: "Return to Projects and select a project to edit.",

        color: "red",
      });

      return;
    }

    if (form.is_quick_turnaround && !form.quick_turnaround_required_by) {
      notifications.show({
        title: "Missing Required Completion Time",
        message:
          "Quick Turnaround projects require a promised completion date and time.",
        color: "red",
      });

      return;
    }

    setSaving(true);

    const updates = {
      project_name: form.project_name || null,

      project_type: form.project_type || null,

      project_category: form.project_category || null,

      intake_owner: form.intake_owner || null,

      assigned_to: form.assigned_to || null,

      work_location: form.work_location || null,

      contact_name: form.contact_name || null,

      contact_phone: form.contact_phone || null,

      job_address: form.job_address || null,

      city: form.city || null,

      state: form.state || null,

      due_date: form.due_date || null,

      priority: form.priority || "Normal",

      is_quick_turnaround: Boolean(form.is_quick_turnaround),

      quick_turnaround_required_by: form.is_quick_turnaround
        ? form.quick_turnaround_required_by
        : null,

      quick_turnaround_priority: form.is_quick_turnaround
        ? form.quick_turnaround_priority || "Urgent"
        : null,

      quick_turnaround_reason: form.is_quick_turnaround
        ? form.quick_turnaround_reason || null
        : null,

      site_visit_required: Boolean(form.site_visit_required),

      measurements_required: Boolean(form.measurements_required),

      quote_required: Boolean(form.quote_required),

      customer_approval_required: form.customer_approval_required !== false,

      down_payment_required: Boolean(form.down_payment_required),

      design_required: Boolean(form.design_required),

      design_status: form.design_required
        ? !form.design_status || form.design_status === "Not Required"
          ? "Not Started"
          : form.design_status
        : "Not Required",

      fabrication_required: Boolean(form.fabrication_required),

      test_fit_required: Boolean(form.test_fit_required),

      finish_required: Boolean(form.finish_required),

      assembly_required: Boolean(form.assembly_required),

      assembly_status: form.assembly_required
        ? !form.assembly_status || form.assembly_status === "Not Required"
          ? "Not Started"
          : form.assembly_status
        : "Not Required",

      install_required: Boolean(form.install_required),

      notes: form.notes || null,
    };

    const { error } = await supabase
      .from("projects")
      .update(updates)
      .eq("id", form.id);

    setSaving(false);

    if (error) {
      notifications.show({
        title: "Save Failed",

        message: error.message,

        color: "red",
      });

      return;
    }

    try {
      const { data: existingCommitments, error: commitmentLookupError } =
        await supabase
          .from("quick_turnaround_dashboard")
          .select("id,status")
          .eq("source_type", "Project")
          .eq("source_number", form.project_number)
          .not("status", "in", "(Completed,Cancelled)")
          .order("created_at", {
            ascending: false,
          })
          .limit(1);

      if (commitmentLookupError) {
        throw commitmentLookupError;
      }

      const existingCommitment = existingCommitments?.[0] || null;

      if (form.is_quick_turnaround) {
        const materialsRequired = materialRequests.length > 0;

        const materialsReady =
          materialsRequired &&
          materialRequests.every((request) =>
            ["Received", "Ready", "Completed"].includes(request.status),
          );

        const { error: commitmentSaveError } = await supabase.rpc(
          "mw_save_quick_turnaround_commitment",
          {
            p_id: existingCommitment?.id || null,
            p_source_type: "Project",
            p_source_id: null,
            p_source_number: form.project_number,
            p_title: form.project_name || "Outside Fabrication Project",
            p_customer_name:
              form.company_name ||
              form.customer_name ||
              form.contact_name ||
              null,
            p_description: form.next_action || form.notes || null,
            p_priority: form.quick_turnaround_priority || "Urgent",
            p_status: existingCommitment?.status || "Open",
            p_required_by: form.quick_turnaround_required_by,
            p_assigned_to: form.assigned_to || null,
            p_department: null,
            p_materials_required: materialsRequired,
            p_materials_status: !materialsRequired
              ? "Not Required"
              : materialsReady
                ? "Ready"
                : "Needs Pricing",
            p_reason: form.quick_turnaround_reason || null,
            p_notes: "Synchronized from Outside Fabrication Edit Project.",
            p_created_by: form.intake_owner || form.assigned_to || null,
          },
        );

        if (commitmentSaveError) {
          throw commitmentSaveError;
        }
      } else if (existingCommitment) {
        const { error: commitmentCancelError } = await supabase.rpc(
          "mw_update_quick_turnaround_status",
          {
            p_id: existingCommitment.id,
            p_status: "Cancelled",
            p_employee: form.intake_owner || form.assigned_to || null,
          },
        );

        if (commitmentCancelError) {
          throw commitmentCancelError;
        }
      }
    } catch (commitmentError) {
      console.error("Quick commitment synchronization error:", commitmentError);

      notifications.show({
        title: "Project Saved — Quick Commitment Needs Attention",
        message:
          commitmentError.message ||
          "The project was saved, but Today's Commitments could not be synchronized.",
        color: "orange",
        autoClose: 9000,
      });
    }

    notifications.show({
      title: "Project Updated",

      message: "Project information has been saved.",

      color: "green",
    });

    setPage("projectDetails");
  }

  if (!form?.id) {
    return (
      <>
        <MWPageHeader
          title="Edit Project"
          subtitle="No project selected."
          setPage={setPage}
          showBack={true}
          backPage="projects"
          backLabel="Projects"
          showDashboard={true}
        />

        <MWSection title="Project Not Found">
          <Text c="dimmed">
            Return to Projects and select the Edit button on a project.
          </Text>
        </MWSection>
      </>
    );
  }

  return (
    <>
      <MWPageHeader
        title={`Edit ${form.project_number || "Project"}`}
        subtitle={form.project_name || "Update project information"}
        buttonText="Save Changes"
        onButtonClick={saveProject}
        setPage={setPage}
        showBack={true}
        backPage="projectDetails"
        backLabel="Project Details"
        showDashboard={true}
      />

      <SimpleGrid
        cols={{
          base: 1,
          lg: 2,
        }}
        spacing="lg"
      >
        <MWSection
          title="Project Information"
          subtitle="Basic project details and ownership."
        >
          <Stack>
            <TextInput
              label="Project Name"
              value={form.project_name || ""}
              onChange={(event) =>
                updateField("project_name", event.currentTarget.value)
              }
            />

            <SimpleGrid
              cols={{
                base: 1,
                sm: 2,
              }}
            >
              <Select
                label="Project Type"
                data={["Field Fabrication", "Shop Fabrication"]}
                value={form.project_type || null}
                onChange={(value) => updateField("project_type", value)}
                clearable
              />

              <TextInput
                label="Project Category"
                placeholder="Railings, Fence, Repair, Vehicle Part..."
                value={form.project_category || ""}
                onChange={(event) =>
                  updateField("project_category", event.currentTarget.value)
                }
              />
            </SimpleGrid>

            <SimpleGrid
              cols={{
                base: 1,
                sm: 2,
              }}
            >
              <Select
                label="Intake Owner"
                data={people}
                value={form.intake_owner || null}
                onChange={(value) => updateField("intake_owner", value)}
                searchable
                clearable
              />

              <Select
                label="Assigned To"
                data={people}
                value={form.assigned_to || null}
                onChange={(value) => updateField("assigned_to", value)}
                searchable
                clearable
              />
            </SimpleGrid>

            <SimpleGrid
              cols={{
                base: 1,
                sm: 2,
              }}
            >
              <Select
                label="Work Location"
                data={["Field", "Shop", "Field + Shop"]}
                value={form.work_location || null}
                onChange={(value) => updateField("work_location", value)}
                clearable
              />

              <Select
                label="Priority"
                data={["Low", "Normal", "High", "Rush"]}
                value={form.priority || "Normal"}
                onChange={(value) => updateField("priority", value)}
              />
            </SimpleGrid>

            <TextInput
              type="date"
              label="Due Date"
              value={form.due_date || ""}
              onChange={(event) =>
                updateField("due_date", event.currentTarget.value)
              }
            />
          </Stack>
        </MWSection>

        <MWSection
          title="Customer & Job Location"
          subtitle="Contact and project location information."
        >
          <Stack>
            <TextInput
              label="Contact Name"
              value={form.contact_name || ""}
              onChange={(event) =>
                updateField("contact_name", event.currentTarget.value)
              }
            />

            <TextInput
              label="Contact Phone"
              value={form.contact_phone || ""}
              onChange={(event) =>
                updateField("contact_phone", event.currentTarget.value)
              }
            />

            <TextInput
              label="Job Address"
              value={form.job_address || ""}
              onChange={(event) =>
                updateField("job_address", event.currentTarget.value)
              }
            />

            <SimpleGrid
              cols={{
                base: 1,
                sm: 2,
              }}
            >
              <TextInput
                label="City"
                value={form.city || ""}
                onChange={(event) =>
                  updateField("city", event.currentTarget.value)
                }
              />

              <TextInput
                label="State"
                value={form.state || ""}
                onChange={(event) =>
                  updateField("state", event.currentTarget.value)
                }
              />
            </SimpleGrid>
          </Stack>
        </MWSection>

        <MWSection
          title="Quick Turnaround"
          subtitle="Add exceptional urgency without duplicating normal site visits or installations."
        >
          <Stack gap="md">
            <Switch
              label="Mark as Quick Turnaround"
              description="Shows this project on Today's Commitments until completed or turned off."
              checked={Boolean(form.is_quick_turnaround)}
              onChange={(event) =>
                updateField("is_quick_turnaround", event.currentTarget.checked)
              }
              color="red"
              size="md"
            />

            {form.is_quick_turnaround && (
              <Card
                withBorder
                radius="md"
                p="lg"
                style={{
                  background: "rgba(111, 0, 0, 0.14)",
                  borderColor: "rgba(224, 49, 49, 0.32)",
                }}
              >
                <Stack gap="md">
                  <SimpleGrid
                    cols={{
                      base: 1,
                      sm: 2,
                    }}
                    spacing="md"
                  >
                    <DateTimePicker
                      label="Required Completion Date & Time"
                      description="The actual promise Metal Worx must meet"
                      value={form.quick_turnaround_required_by || null}
                      onChange={(value) =>
                        updateField("quick_turnaround_required_by", value)
                      }
                      required
                    />

                    <Select
                      label="Quick Turnaround Priority"
                      data={["Critical", "Urgent", "High"]}
                      value={form.quick_turnaround_priority || "Urgent"}
                      onChange={(value) =>
                        updateField(
                          "quick_turnaround_priority",
                          value || "Urgent",
                        )
                      }
                      required
                    />
                  </SimpleGrid>

                  <Textarea
                    label="Reason for Quick Turnaround"
                    placeholder="Why does this project require priority attention?"
                    value={form.quick_turnaround_reason || ""}
                    onChange={(event) =>
                      updateField(
                        "quick_turnaround_reason",
                        event.currentTarget.value,
                      )
                    }
                    autosize
                    minRows={2}
                    maxRows={4}
                  />

                  <Text size="sm" c="dimmed">
                    Turning this off cancels the active quick commitment. It
                    does not cancel or complete the project itself.
                  </Text>
                </Stack>
              </Card>
            )}
          </Stack>
        </MWSection>

        <MWSection
          title="Required Workflow"
          subtitle="Choose the stages required for this specific project."
        >
          <SimpleGrid
            cols={{
              base: 1,
              sm: 2,
            }}
          >
            <Checkbox
              label="Site Visit Required"
              checked={Boolean(form.site_visit_required)}
              onChange={(event) =>
                updateField("site_visit_required", event.currentTarget.checked)
              }
            />

            <Checkbox
              label="Measurements Required"
              checked={Boolean(form.measurements_required)}
              onChange={(event) =>
                updateField(
                  "measurements_required",
                  event.currentTarget.checked,
                )
              }
            />

            <Checkbox
              label="Quote Required"
              checked={Boolean(form.quote_required)}
              onChange={(event) =>
                updateField("quote_required", event.currentTarget.checked)
              }
            />

            <Checkbox
              label="Customer Approval Required"
              checked={form.customer_approval_required !== false}
              onChange={(event) =>
                updateField(
                  "customer_approval_required",
                  event.currentTarget.checked,
                )
              }
            />

            <Checkbox
              label="Down Payment Required"
              checked={Boolean(form.down_payment_required)}
              onChange={(event) =>
                updateField(
                  "down_payment_required",
                  event.currentTarget.checked,
                )
              }
            />

            <Checkbox
              label="Design Required"
              checked={Boolean(form.design_required)}
              onChange={(event) =>
                updateField("design_required", event.currentTarget.checked)
              }
            />

            <Checkbox
              label="Welding / Fabrication Required"
              checked={Boolean(form.fabrication_required)}
              onChange={(event) =>
                updateField("fabrication_required", event.currentTarget.checked)
              }
            />

            <Checkbox
              label="Test Fit Required"
              checked={Boolean(form.test_fit_required)}
              onChange={(event) =>
                updateField("test_fit_required", event.currentTarget.checked)
              }
            />

            <Checkbox
              label="Finish Required"
              checked={Boolean(form.finish_required)}
              onChange={(event) =>
                updateField("finish_required", event.currentTarget.checked)
              }
            />

            <Checkbox
              label="Assembly Required"
              checked={Boolean(form.assembly_required)}
              onChange={(event) =>
                updateField("assembly_required", event.currentTarget.checked)
              }
            />

            <Checkbox
              label="Install Required"
              checked={Boolean(form.install_required)}
              onChange={(event) =>
                updateField("install_required", event.currentTarget.checked)
              }
            />
          </SimpleGrid>

          <Card withBorder radius="lg" p="md" mt="lg">
            <Stack gap="xs">
              <Text fw={600}>Approval Path</Text>

              <Text size="sm" c="dimmed">
                {form.customer_approval_required !== false
                  ? "Lori prices the materials, then Chad or Kory sends the quote and records customer approval before Lori can order."
                  : "The customer already approved the work. After Lori finishes pricing, Procurement moves directly to Ready to Order."}
              </Text>

              <Text size="sm" c="dimmed">
                Other workflow-stage changes only control which stages apply to
                this project. Existing stage status values are preserved.
              </Text>
            </Stack>
          </Card>
        </MWSection>

        <MWSection
          title="Project Notes"
          subtitle="General project information and internal notes."
        >
          <Stack>
            <Textarea
              minRows={12}
              value={form.notes || ""}
              onChange={(event) =>
                updateField("notes", event.currentTarget.value)
              }
            />
          </Stack>
        </MWSection>

        <div
          style={{
            gridColumn: "1 / -1",
          }}
        >
          <MWSection
            title="Materials / Procurement"
            subtitle="Add or edit material requests connected to this project."
          >
            <Stack>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Requests saved here are assigned to Lori and appear in
                  Procurement.
                </Text>

                <Group>
                  <Button
                    variant="light"
                    color="gray"
                    loading={materialsLoading}
                    onClick={() => loadMaterialRequests()}
                  >
                    Refresh
                  </Button>

                  <Button color="red" onClick={openNewMaterialRequest}>
                    + Add Material
                  </Button>
                </Group>
              </Group>

              {materialRequests.length === 0 ? (
                <Card withBorder radius="lg" p="xl">
                  <Text ta="center" c="dimmed">
                    No material requests have been added to this project.
                  </Text>
                </Card>
              ) : (
                <ScrollArea>
                  <Table
                    striped
                    highlightOnHover
                    withTableBorder
                    withColumnBorders
                    miw={1050}
                  >
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Qty</Table.Th>

                        <Table.Th>Dimensions</Table.Th>

                        <Table.Th>Item</Table.Th>

                        <Table.Th>Description</Table.Th>

                        <Table.Th>Vendor</Table.Th>

                        <Table.Th>Needed By</Table.Th>

                        <Table.Th>Priority</Table.Th>

                        <Table.Th>Status</Table.Th>

                        <Table.Th>Actions</Table.Th>
                      </Table.Tr>
                    </Table.Thead>

                    <Table.Tbody>
                      {materialRequests.map((request) => (
                        <Table.Tr key={request.id}>
                          <Table.Td>{request.quantity || 0}</Table.Td>

                          <Table.Td>{request.dimensions || "—"}</Table.Td>

                          <Table.Td>
                            <Text fw={600} size="sm">
                              {request.item_name || "Unnamed Item"}
                            </Text>
                          </Table.Td>

                          <Table.Td>{request.description || "—"}</Table.Td>

                          <Table.Td>{request.vendor_name || "—"}</Table.Td>

                          <Table.Td>{request.needed_by || "—"}</Table.Td>

                          <Table.Td>{request.priority || "Normal"}</Table.Td>

                          <Table.Td>
                            <Badge
                              color={materialStatusColor(request.status)}
                              variant="light"
                            >
                              {request.status || "Request Submitted"}
                            </Badge>
                          </Table.Td>

                          <Table.Td>
                            <Group gap="xs" wrap="nowrap">
                              <Button
                                size="xs"
                                variant="light"
                                onClick={() => openEditMaterialRequest(request)}
                              >
                                Edit
                              </Button>

                              {request.status !== "Cancelled" && (
                                <Button
                                  size="xs"
                                  variant="subtle"
                                  color="red"
                                  onClick={() =>
                                    cancelMaterialRequest(request.id)
                                  }
                                >
                                  Cancel
                                </Button>
                              )}
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </ScrollArea>
              )}
            </Stack>
          </MWSection>
        </div>
      </SimpleGrid>

      <Group justify="flex-end" mt="xl">
        <Button
          variant="light"
          color="gray"
          onClick={() => setPage("projectDetails")}
        >
          Cancel
        </Button>

        <Button color="red" loading={saving} onClick={saveProject}>
          Save Project Changes
        </Button>
      </Group>

      <Modal
        opened={materialEditorOpen}
        onClose={() => {
          setMaterialEditorOpen(false);

          setEditingMaterialId(null);

          resetMaterialForm();
        }}
        title={
          editingMaterialId ? "Edit Material Request" : "Add Material Request"
        }
        size="lg"
        centered
      >
        <Stack>
          <SimpleGrid
            cols={{
              base: 1,
              sm: 2,
            }}
          >
            <NumberInput
              label="Qty"
              min={0.01}
              decimalScale={2}
              value={materialForm.quantity}
              onChange={(value) => updateMaterialForm("quantity", value)}
            />

            <TextInput
              label="Dimensions"
              value={materialForm.dimensions}
              onChange={(event) =>
                updateMaterialForm("dimensions", event.currentTarget.value)
              }
            />
          </SimpleGrid>

          <TextInput
            label="Item"
            required
            value={materialForm.itemName}
            onChange={(event) =>
              updateMaterialForm("itemName", event.currentTarget.value)
            }
          />

          <Textarea
            label="Description"
            minRows={3}
            value={materialForm.description}
            onChange={(event) =>
              updateMaterialForm("description", event.currentTarget.value)
            }
          />

          <SimpleGrid
            cols={{
              base: 1,
              sm: 2,
            }}
          >
            <TextInput
              label="Vendor"
              value={materialForm.vendorName}
              onChange={(event) =>
                updateMaterialForm("vendorName", event.currentTarget.value)
              }
            />

            <TextInput
              type="date"
              label="Needed By"
              value={materialForm.neededBy}
              onChange={(event) =>
                updateMaterialForm("neededBy", event.currentTarget.value)
              }
            />
          </SimpleGrid>

          <SimpleGrid
            cols={{
              base: 1,
              sm: 2,
            }}
          >
            <Select
              label="Priority"
              data={["Low", "Normal", "High", "Rush"]}
              value={materialForm.priority}
              onChange={(value) =>
                updateMaterialForm("priority", value || "Normal")
              }
            />

            <Select
              label="Status"
              data={[
                "Request Submitted",
                "Pricing Needed",
                "Ready to Order",
                "Ordered",
                "Partially Received",
                "Received",
                "Cancelled",
              ]}
              value={materialForm.status}
              onChange={(value) =>
                updateMaterialForm("status", value || "Request Submitted")
              }
            />
          </SimpleGrid>

          <Textarea
            label="Procurement Notes"
            minRows={2}
            value={materialForm.notes}
            onChange={(event) =>
              updateMaterialForm("notes", event.currentTarget.value)
            }
          />

          <Group justify="flex-end">
            <Button
              variant="light"
              color="gray"
              onClick={() => {
                setMaterialEditorOpen(false);

                setEditingMaterialId(null);

                resetMaterialForm();
              }}
            >
              Cancel
            </Button>

            <Button
              color="red"
              loading={materialSaving}
              onClick={saveMaterialRequest}
            >
              {editingMaterialId
                ? "Save Material Changes"
                : "Add Material Request"}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

export default EditProject;
