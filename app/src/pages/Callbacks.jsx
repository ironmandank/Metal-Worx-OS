import { useEffect, useRef, useState } from "react";

import { DateTimePicker } from "@mantine/dates";
import { notifications } from "@mantine/notifications";

import {
  Badge,
  Button,
  Card,
  Group,
  Modal,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
} from "@mantine/core";

import MWPageHeader from "../components/ui/MWPageHeader";

import {
  completeCallback,
  createCallback,
  getLinkedProject,
  getOpenCallbacks,
  promoteCallbackToSiteVisit,
} from "../services/callbackService";

import {
  getActiveProfiles,
  markNotificationsReadBySource,
} from "../services/notificationService";

function Callbacks({
  setPage,
  openProject,
  selectedCallbackId,
  setSelectedCallbackId,
}) {
  const [callbacks, setCallbacks] = useState([]);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [siteVisitSaving, setSiteVisitSaving] = useState(false);
  const [siteVisitModalOpen, setSiteVisitModalOpen] = useState(false);
  const [siteVisitCallback, setSiteVisitCallback] = useState(null);
  const [siteVisitForm, setSiteVisitForm] = useState({
    site_visit_at: null,
    assigned_to: "Chad",
    job_address: "",
    city: "",
    state: "NC",
    zip_code: "",
    notes: "",
  });

  const selectedCardRef = useRef(null);

  const [form, setForm] = useState({
    title: "",
    contact_name: "",
    company_name: "",
    phone: "",
    email: "",
    callback_type: "Callback",
    assigned_to: "",
    due_at: null,
    priority: "Medium",
    notes: "",
  });

  useEffect(() => {
    loadPageData();
  }, []);

  useEffect(() => {
    if (
      selectedCallbackId &&
      selectedCardRef.current
    ) {
      selectedCardRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [selectedCallbackId, callbacks]);

  async function loadPageData() {
    await Promise.all([
      loadCallbacks(),
      loadPeople(),
    ]);
  }

  async function loadPeople() {
    try {
      const profiles = await getActiveProfiles();

      const personNames = (profiles || [])
        .filter(
          (profile) =>
            profile.profile_type === "Person"
        )
        .map(
          (profile) =>
            profile.display_name
        )
        .filter(Boolean);

      setPeople(personNames);

      setForm((current) => {
        if (
          current.assigned_to ||
          personNames.length === 0
        ) {
          return current;
        }

        return {
          ...current,
          assigned_to: personNames[0],
        };
      });
    } catch (error) {
      console.error(
        "Callback profile load error:",
        error
      );

      notifications.show({
        title: "Employee Profiles",
        message:
          "Employee assignment options could not be loaded.",
        color: "orange",
      });
    }
  }

  async function loadCallbacks() {
    setLoading(true);

    try {
      const data =
        await getOpenCallbacks();

      setCallbacks(data || []);
    } catch (error) {
      notifications.show({
        title:
          "Callbacks failed to load",
        message: error.message,
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  }

  function updateForm(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function saveCallback() {
    if (!form.title.trim()) {
      notifications.show({
        title: "Missing title",
        message:
          "Add a short title for the callback.",
        color: "red",
      });

      return;
    }

    if (!form.assigned_to) {
      notifications.show({
        title: "Missing assignment",
        message:
          "Assign the callback to a person.",
        color: "red",
      });

      return;
    }

    setSaving(true);

    try {
      await createCallback({
        ...form,

        due_at: toIsoDateTime(form.due_at),
      });

      notifications.show({
        title: "Callback created",
        message:
          "The callback has been added and the assigned person has been notified.",
        color: "green",
      });

      setForm({
        title: "",
        contact_name: "",
        company_name: "",
        phone: "",
        email: "",
        callback_type: "Callback",
        assigned_to:
          people.length > 0
            ? people[0]
            : "",
        due_at: null,
        priority: "Medium",
        notes: "",
      });

      await loadCallbacks();
    } catch (error) {
      notifications.show({
        title: "Callback failed",
        message: error.message,
        color: "red",
      });
    } finally {
      setSaving(false);
    }
  }

  async function markComplete(callback) {
    const outcomeNotes = window.prompt(
      "Outcome notes for this callback:",
      ""
    );

    try {
      await completeCallback(
        callback.id,
        outcomeNotes || ""
      );

      await markNotificationsReadBySource({
        sourceType: "callback",
        sourceId: callback.id,
      });

      notifications.show({
        title: "Callback completed",
        message:
          "The callback has been closed and its notification has been resolved.",
        color: "green",
      });

      if (
        callback.id ===
        selectedCallbackId
      ) {
        setSelectedCallbackId?.(null);
      }

      await loadCallbacks();
    } catch (error) {
      notifications.show({
        title:
          "Could not complete callback",
        message: error.message,
        color: "red",
      });
    }
  }

  function openSiteVisit(callback) {
    setSiteVisitCallback(callback);
    setSiteVisitForm({
      site_visit_at: callback.site_visit_at || null,
      assigned_to: callback.site_visit_assigned_to || "Chad",
      job_address: callback.site_visit_address || "",
      city: callback.site_visit_city || "",
      state: callback.site_visit_state || "NC",
      zip_code: callback.site_visit_zip || "",
      notes: "",
    });
    setSiteVisitModalOpen(true);
  }

  function updateSiteVisitForm(field, value) {
    setSiteVisitForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function toIsoDateTime(value) {
    if (!value) return null;

    const parsed = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      throw new Error("Choose a valid site visit date and time.");
    }

    return parsed.toISOString();
  }

  async function saveSiteVisit() {
    if (!siteVisitCallback?.id) return;

    if (!siteVisitForm.assigned_to) {
      notifications.show({
        title: "Assignment required",
        message: "Select the person responsible for the site visit.",
        color: "red",
      });
      return;
    }

    setSiteVisitSaving(true);

    try {
      const result = await promoteCallbackToSiteVisit({
        callbackId: siteVisitCallback.id,
        siteVisitAt: toIsoDateTime(siteVisitForm.site_visit_at),
        assignedTo: siteVisitForm.assigned_to,
        jobAddress: siteVisitForm.job_address,
        city: siteVisitForm.city,
        state: siteVisitForm.state,
        zipCode: siteVisitForm.zip_code,
        siteNotes: siteVisitForm.notes,
      });

      notifications.show({
        title: result.project_created
          ? "Site-visit project created"
          : "Site-visit project updated",
        message: `${result.project_number} is now connected to this callback.`,
        color: "green",
      });

      setSiteVisitModalOpen(false);
      setSiteVisitCallback(null);
      await loadCallbacks();
    } catch (error) {
      notifications.show({
        title: "Could not create site visit",
        message: error.message,
        color: "red",
      });
    } finally {
      setSiteVisitSaving(false);
    }
  }

  async function openLinkedProject(callback) {
    if (!callback?.linked_project_id) return;

    try {
      const project = await getLinkedProject(callback.linked_project_id);

      if (openProject) {
        openProject(project);
      } else {
        setPage("projects");
      }
    } catch (error) {
      notifications.show({
        title: "Could not open project",
        message: error.message,
        color: "red",
      });
    }
  }

  function callbackStatus(callback) {
    if (!callback.due_at) {
      return "Open";
    }

    const now = new Date();
    const due = new Date(
      callback.due_at
    );

    if (due < now) {
      return "Overdue";
    }

    const sameDay =
      due.getFullYear() ===
        now.getFullYear() &&
      due.getMonth() ===
        now.getMonth() &&
      due.getDate() ===
        now.getDate();

    return sameDay
      ? "Due Today"
      : "Scheduled";
  }

  function statusColor(status) {
    if (status === "Overdue") {
      return "red";
    }

    if (status === "Due Today") {
      return "orange";
    }

    if (status === "Scheduled") {
      return "blue";
    }

    return "gray";
  }

  return (
    <div className="callbacks-page">
      <MWPageHeader
        title="Callbacks & Follow-Ups"
        subtitle="Track customer calls, quote follow-ups, site visit follow-ups, and assigned communication tasks."
        setPage={setPage}
        showDashboard={true}
        buttonText="Refresh"
        onButtonClick={loadCallbacks}
      />

      <Modal
        opened={siteVisitModalOpen}
        onClose={() => {
          if (!siteVisitSaving) {
            setSiteVisitModalOpen(false);
            setSiteVisitCallback(null);
          }
        }}
        title="Create Site Visit Project"
        size="lg"
        centered
        closeOnClickOutside={!siteVisitSaving}
        closeOnEscape={!siteVisitSaving}
      >
        <Stack gap="md">
          <Card withBorder radius="md" p="md">
            <Text fw={700}>{siteVisitCallback?.title}</Text>
            <Text size="sm" c="dimmed">
              {siteVisitCallback?.company_name ||
                siteVisitCallback?.contact_name ||
                "Customer information will be copied from the callback."}
            </Text>
            {siteVisitCallback?.linked_project_id && (
              <Badge mt="sm" color="green">
                Already connected — this will update the existing project
              </Badge>
            )}
          </Card>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <Select
              label="Assigned To"
              description="Chad is selected automatically."
              data={people.includes("Chad") ? people : ["Chad", ...people]}
              value={siteVisitForm.assigned_to}
              onChange={(value) =>
                updateSiteVisitForm("assigned_to", value || "Chad")
              }
              searchable
            />

            <DateTimePicker
              label="Site Visit Date / Time"
              description="Leave blank if it still needs scheduling."
              value={siteVisitForm.site_visit_at}
              onChange={(value) =>
                updateSiteVisitForm("site_visit_at", value)
              }
              clearable
            />

            <TextInput
              label="Job Address"
              value={siteVisitForm.job_address}
              onChange={(event) =>
                updateSiteVisitForm("job_address", event.currentTarget.value)
              }
            />

            <TextInput
              label="City"
              value={siteVisitForm.city}
              onChange={(event) =>
                updateSiteVisitForm("city", event.currentTarget.value)
              }
            />

            <TextInput
              label="State"
              value={siteVisitForm.state}
              onChange={(event) =>
                updateSiteVisitForm("state", event.currentTarget.value)
              }
            />

            <TextInput
              label="ZIP Code"
              value={siteVisitForm.zip_code}
              onChange={(event) =>
                updateSiteVisitForm("zip_code", event.currentTarget.value)
              }
            />
          </SimpleGrid>

          <Textarea
            label="Site Visit Notes"
            description="These notes are added to the project without replacing the callback notes."
            minRows={3}
            value={siteVisitForm.notes}
            onChange={(event) =>
              updateSiteVisitForm("notes", event.currentTarget.value)
            }
          />

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <Button
              fullWidth
              variant="default"
              disabled={siteVisitSaving}
              onClick={() => {
                setSiteVisitModalOpen(false);
                setSiteVisitCallback(null);
              }}
            >
              Cancel
            </Button>

            <Button
              fullWidth
              color="red"
              loading={siteVisitSaving}
              onClick={saveSiteVisit}
            >
              {siteVisitCallback?.linked_project_id
                ? "Update Site Visit"
                : "Create Project & Site Visit"}
            </Button>
          </SimpleGrid>
        </Stack>
      </Modal>

      <SimpleGrid
        cols={{
          base: 1,
          lg: 3,
        }}
        spacing="lg"
      >
        <Card
          withBorder
          radius="lg"
          p="lg"
          className="callbacks-form-card"
        >
          <Stack>
            <Title order={3}>
              New Callback
            </Title>

            <TextInput
              label="Title"
              placeholder="Call customer about railing estimate"
              value={form.title}
              onChange={(event) =>
                updateForm(
                  "title",
                  event.currentTarget.value
                )
              }
            />

            <Group grow>
              <Select
                label="Type"
                data={[
                  "Callback",
                  "Follow-Up",
                  "Quote Follow-Up",
                  "Site Visit Follow-Up",
                ]}
                value={
                  form.callback_type
                }
                onChange={(value) =>
                  updateForm(
                    "callback_type",
                    value
                  )
                }
              />

              <Select
                label="Priority"
                data={[
                  "Low",
                  "Medium",
                  "High",
                ]}
                value={form.priority}
                onChange={(value) =>
                  updateForm(
                    "priority",
                    value
                  )
                }
              />
            </Group>

            <Group grow>
              <TextInput
                label="Contact Name"
                value={
                  form.contact_name
                }
                onChange={(event) =>
                  updateForm(
                    "contact_name",
                    event.currentTarget
                      .value
                  )
                }
              />

              <TextInput
                label="Company"
                value={
                  form.company_name
                }
                onChange={(event) =>
                  updateForm(
                    "company_name",
                    event.currentTarget
                      .value
                  )
                }
              />
            </Group>

            <Group grow>
              <TextInput
                label="Phone"
                value={form.phone}
                onChange={(event) =>
                  updateForm(
                    "phone",
                    event.currentTarget
                      .value
                  )
                }
              />

              <TextInput
                label="Email"
                value={form.email}
                onChange={(event) =>
                  updateForm(
                    "email",
                    event.currentTarget
                      .value
                  )
                }
              />
            </Group>

            <Group grow>
              <Select
                label="Assigned To"
                placeholder="Select employee"
                data={people}
                value={
                  form.assigned_to ||
                  null
                }
                onChange={(value) =>
                  updateForm(
                    "assigned_to",
                    value || ""
                  )
                }
                searchable
                clearable
              />

              <DateTimePicker
                label="Due Date / Time"
                value={form.due_at}
                onChange={(value) =>
                  updateForm(
                    "due_at",
                    value
                  )
                }
              />
            </Group>

            <Textarea
              label="Notes"
              minRows={4}
              placeholder="What needs to be discussed or followed up on?"
              value={form.notes}
              onChange={(event) =>
                updateForm(
                  "notes",
                  event.currentTarget
                    .value
                )
              }
            />

            <Button
              color="red"
              loading={saving}
              onClick={saveCallback}
            >
              Add Callback
            </Button>
          </Stack>
        </Card>

        <div className="callbacks-list-area">
          <div className="callbacks-list-header">
            <Title order={3}>
              Open Callbacks
            </Title>

            <Text c="dimmed">
              {callbacks.length} open
            </Text>
          </div>

          {loading ? (
            <Card
              withBorder
              radius="lg"
              p="lg"
            >
              <Text c="dimmed">
                Loading callbacks...
              </Text>
            </Card>
          ) : callbacks.length === 0 ? (
            <Card
              withBorder
              radius="lg"
              p="lg"
            >
              <Text c="dimmed">
                No open callbacks.
              </Text>
            </Card>
          ) : (
            <Stack>
              {callbacks.map(
                (callback) => {
                  const status =
                    callbackStatus(
                      callback
                    );

                  const isSelected =
                    callback.id ===
                    selectedCallbackId;

                  return (
                    <Card
                      key={callback.id}
                      ref={
                        isSelected
                          ? selectedCardRef
                          : null
                      }
                      withBorder
                      radius="lg"
                      p="md"
                      className={
                        isSelected
                          ? "callback-card-selected"
                          : ""
                      }
                    >
                      <Stack gap="xs">
                        <Group
                          justify="space-between"
                          align="flex-start"
                        >
                          <div>
                            <Title
                              order={4}
                            >
                              {
                                callback.title
                              }
                            </Title>

                            <Text
                              size="sm"
                              c="dimmed"
                            >
                              {callback.company_name ||
                                callback.contact_name ||
                                "No contact name"}
                            </Text>
                          </div>

                          <Group gap="xs">
                            {isSelected && (
                              <Badge color="red">
                                Opened from
                                Notification
                              </Badge>
                            )}

                            <Badge
                              color={statusColor(
                                status
                              )}
                            >
                              {status}
                            </Badge>

                            <Badge
                              color="red"
                              variant="light"
                            >
                              {
                                callback.priority
                              }
                            </Badge>

                            {callback.linked_project_id && (
                              <Badge color="green">
                                Project Connected
                              </Badge>
                            )}
                          </Group>
                        </Group>

                        <Text size="sm">
                          <strong>
                            Assigned:
                          </strong>{" "}
                          {callback.assigned_to ||
                            "Unassigned"}
                        </Text>

                        <Text size="sm">
                          <strong>
                            Due:
                          </strong>{" "}
                          {callback.due_at
                            ? new Date(
                                callback.due_at
                              ).toLocaleString()
                            : "No due date"}
                        </Text>

                        <Text size="sm">
                          <strong>
                            Phone:
                          </strong>{" "}
                          {callback.phone ||
                            "Not set"}
                        </Text>

                        {callback.email && (
                          <Text size="sm">
                            <strong>
                              Email:
                            </strong>{" "}
                            {
                              callback.email
                            }
                          </Text>
                        )}

                        {callback.notes && (
                          <Text
                            size="sm"
                            style={{
                              whiteSpace:
                                "pre-wrap",
                            }}
                          >
                            {
                              callback.notes
                            }
                          </Text>
                        )}

                        {callback.site_visit_required && (
                          <Card withBorder radius="md" p="sm">
                            <Text size="sm" fw={700}>
                              Site Visit: {callback.site_visit_status}
                            </Text>
                            <Text size="sm" c="dimmed">
                              {callback.site_visit_at
                                ? new Date(callback.site_visit_at).toLocaleString()
                                : "Date and time still need to be scheduled"}
                              {callback.site_visit_assigned_to
                                ? ` • ${callback.site_visit_assigned_to}`
                                : ""}
                            </Text>
                          </Card>
                        )}

                        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
                          <Button
                            fullWidth
                            size="xs"
                            color="red"
                            variant={callback.linked_project_id ? "light" : "filled"}
                            onClick={() => openSiteVisit(callback)}
                          >
                            {callback.linked_project_id
                              ? "Update Site Visit"
                              : "Schedule Site Visit"}
                          </Button>

                          {callback.linked_project_id && (
                            <Button
                              fullWidth
                              size="xs"
                              color="blue"
                              variant="light"
                              onClick={() => openLinkedProject(callback)}
                            >
                              Open Project
                            </Button>
                          )}

                          <Button
                            fullWidth
                            size="xs"
                            color="green"
                            onClick={() =>
                              markComplete(
                                callback
                              )
                            }
                          >
                            Complete & Resolve
                          </Button>
                        </SimpleGrid>
                      </Stack>
                    </Card>
                  );
                }
              )}
            </Stack>
          )}
        </div>
      </SimpleGrid>
    </div>
  );
}

export default Callbacks;