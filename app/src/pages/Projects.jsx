import {
  Alert,
  Badge,
  Box,
  Button,
  Group,
  Loader,
  Paper,
  Progress,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from "@mantine/core";
import {
  IconAlertTriangle,
  IconArrowRight,
  IconClipboardCheck,
  IconCircleCheck,
  IconMapPin,
  IconPackage,
  IconRefresh,
  IconRotateClockwise,
  IconSearch,
  IconTool,
  IconTrash,
  IconTruckDelivery,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import MWKpiStrip from "../components/ui/MWKpiStrip";
import MWPageHeader from "../components/ui/MWPageHeader";
import MWPanel from "../components/ui/MWPanel";
import { supabase } from "../lib/supabase";

function getStatusColor(status) {
  if (status === "Completed") return "green";
  if (status === "In Progress") return "blue";
  if (status === "On Hold") return "orange";
  if (status === "Cancelled") return "red";
  return "gray";
}

function getPriorityColor(priority) {
  if (priority === "Rush") return "red";
  if (priority === "High") return "orange";
  if (priority === "Low") return "gray";
  return "green";
}

function formatDate(value, includeTime = false) {
  if (!value) return "Not set";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(includeTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}

function getCustomerName(customer) {
  if (!customer) return "";

  return (
    `${customer.first_name || ""} ${customer.last_name || ""}`.trim() ||
    customer.contact_name ||
    customer.name ||
    customer.company_name ||
    ""
  );
}

function getProjectPerson(project, customer) {
  return (
    project.contact_name ||
    project.customer_contact_name ||
    getCustomerName(customer) ||
    "Customer not assigned"
  );
}

function getProjectCompany(project, customer, person) {
  const company = project.company_name || customer?.company_name || "";
  return company === person ? "" : company;
}

function getProjectItem(project) {
  return (
    project.project_name ||
    project.item_name ||
    project.description ||
    project.project_type ||
    project.project_category ||
    "Project not specified"
  );
}

function getProjectIdentity(project, customer) {
  return `${getProjectPerson(project, customer)} — ${getProjectItem(project)}`;
}

function Projects({ setPage, setSelectedProject }) {
  const [projects, setProjects] = useState([]);
  const [completedProjects, setCompletedProjects] = useState([]);
  const [viewMode, setViewMode] = useState("active");
  const [customers, setCustomers] = useState({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [trackingByProject, setTrackingByProject] = useState({});

  const loadProjects = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    else setRefreshing(true);

    setErrorMessage("");

    try {
      const [projectResult, customerResult] = await Promise.all([
        supabase
          .from("projects")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase.from("customers").select("*"),
      ]);

      if (projectResult.error) throw projectResult.error;
      if (customerResult.error) throw customerResult.error;

      const allProjects = projectResult.data || [];
      const loadedProjects = allProjects.filter(
        (project) => project.is_active === true && !["Completed", "Cancelled"].includes(project.status)
      );
      const loadedCompletedProjects = allProjects.filter(
        (project) => project.status === "Completed"
      );
      const trackedProjects = [...loadedProjects, ...loadedCompletedProjects];
      const projectIds = trackedProjects.map((project) => project.id);
      let checklistRows = [];
      let updateRows = [];

      if (projectIds.length) {
        const [checklistResult, updateResult] = await Promise.all([
          supabase
            .from("project_checklist_items")
            .select("project_id, status")
            .in("project_id", projectIds),
          supabase
            .from("project_daily_updates")
            .select(
              "project_id, update_date, status, leadership_attention_required, created_at"
            )
            .in("project_id", projectIds)
            .order("update_date", { ascending: false })
            .order("created_at", { ascending: false }),
        ]);

        if (checklistResult.error) throw checklistResult.error;
        if (updateResult.error) throw updateResult.error;
        checklistRows = checklistResult.data || [];
        updateRows = updateResult.data || [];
      }

      const trackingMap = Object.fromEntries(
        trackedProjects.map((project) => [
          project.id,
          {
            tasks: 0,
            applicable: 0,
            complete: 0,
            blocked: 0,
            latestUpdate: null,
          },
        ])
      );

      checklistRows.forEach((task) => {
        const tracking = trackingMap[task.project_id];
        if (!tracking) return;
        tracking.tasks += 1;
        if (task.status !== "Not Applicable") tracking.applicable += 1;
        if (task.status === "Complete") tracking.complete += 1;
        if (task.status === "Blocked") tracking.blocked += 1;
      });

      updateRows.forEach((update) => {
        const tracking = trackingMap[update.project_id];
        if (tracking && !tracking.latestUpdate) tracking.latestUpdate = update;
      });

      setProjects(loadedProjects);
      setCompletedProjects(loadedCompletedProjects);
      setTrackingByProject(trackingMap);
      setCustomers(
        Object.fromEntries(
          (customerResult.data || []).map((customer) => [
            customer.id,
            customer,
          ])
        )
      );
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error?.message || "Outside fabrication projects could not be loaded."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadProjects(true);
  }, [loadProjects]);

  const filteredProjects = useMemo(() => {
    const term = search.trim().toLowerCase();
    const source = viewMode === "completed" ? completedProjects : projects;
    if (!term) return source;

    return source.filter((project) => {
      const customer = customers[project.customer_id];
      const person = getProjectPerson(project, customer);
      const company = getProjectCompany(project, customer, person);

      return [
        getProjectIdentity(project, customer),
        person,
        company,
        project.project_number,
        project.project_name,
        project.project_type,
        project.project_category,
        project.intake_owner,
        project.work_location,
        project.status,
        project.assigned_to,
        project.contact_phone,
        project.job_address,
        project.next_action,
        project.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [completedProjects, customers, projects, search, viewMode]);

  const siteVisitCount = projects.filter(
    (project) =>
      project.site_visit_required &&
      project.site_visit_status !== "Completed"
  ).length;
  const installCount = projects.filter(
    (project) =>
      project.install_required && project.install_date && project.install_status !== "Completed"
  ).length;
  const holdCount = projects.filter(
    (project) => project.status === "On Hold"
  ).length;

  function openProject(project) {
    setSelectedProject({ ...project, initialTab: "overview" });
    setPage("projectDetails");
  }

  function openProjectChecklist(project) {
    setSelectedProject({ ...project, initialTab: "tracking" });
    setPage("projectDetails");
  }

  function editProject(project) {
    setSelectedProject(project);
    setPage("editProject");
  }

  async function completeProject(project) {
    if (!window.confirm(`Mark "${project.project_name || project.project_number}" complete and remove it from the active-project board?`)) return;
    const { error } = await supabase
      .from("projects")
      .update({
        status: "Completed",
        percent_complete: 100,
        completed_at: new Date().toISOString(),
        next_action: "Project complete",
        is_active: false,
      })
      .eq("id", project.id);
    if (error) {
      setErrorMessage(error.message || "The project could not be completed.");
      return;
    }
    await loadProjects();
  }

  async function reopenProject(project) {
    const { error } = await supabase
      .from("projects")
      .update({
        status: "In Progress",
        completed_at: null,
        is_active: true,
        next_action: "Review project status",
      })
      .eq("id", project.id);
    if (error) {
      setErrorMessage(error.message || "The project could not be reopened.");
      return;
    }
    await loadProjects();
  }

  async function removeProject(project) {
    if (!window.confirm(`Delete/archive "${project.project_name || project.project_number}"? Linked business records will be preserved.`)) return;
    try {
      const linkedTables = [
        "project_quotes",
        "project_material_requests",
        "project_payments",
        "project_checklist_items",
        "project_daily_updates",
      ];
      const counts = await Promise.all(
        linkedTables.map((table) =>
          supabase.from(table).select("id", { count: "exact", head: true }).eq("project_id", project.id)
        )
      );
      const failedCount = counts.find((result) => result.error);
      if (failedCount?.error) throw failedCount.error;
      const hasHistory = counts.some((result) => Number(result.count || 0) > 0);

      if (hasHistory) {
        const { error } = await supabase
          .from("projects")
          .update({
            is_active: false,
            status: project.status === "Completed" ? "Completed" : "Cancelled",
            next_action: "Archived",
          })
          .eq("id", project.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("projects").delete().eq("id", project.id);
        if (error) throw error;
      }
      await loadProjects();
    } catch (error) {
      setErrorMessage(error.message || "The project could not be removed.");
    }
  }

  if (loading) {
    return (
      <Stack gap="xl">
        <MWPageHeader
          title="Outside Fabrication"
          subtitle="Loading active Metal Worx projects."
          setPage={setPage}
        />
        <MWPanel>
          <Group justify="center" py={90}>
            <Loader color="red" />
            <Text c="dimmed">Loading outside fabrication projects...</Text>
          </Group>
        </MWPanel>
      </Stack>
    );
  }

  return (
    <Stack gap="xl">
      <MWPageHeader
        title="Outside Fabrication"
        subtitle="Field fabrication, railings, gates, installs, repairs, and shop-intake projects."
        buttonText="+ New Project"
        onButtonClick={() => setPage("newProject")}
        setPage={setPage}
        showDashboard
      />

      <MWKpiStrip
        compact
        columns={{ base: 1, sm: 2, xl: 4 }}
        items={[
          {
            label: "Active Projects",
            value: projects.length,
            description: "Current outside-fabrication work",
            icon: IconTool,
            color: "red",
          },
          {
            label: "Site Visits",
            value: siteVisitCount,
            description: "Required or scheduled",
            icon: IconMapPin,
            color: "blue",
          },
          {
            label: "Installs",
            value: installCount,
            description: "Required or scheduled",
            icon: IconTruckDelivery,
            color: "green",
          },
          {
            label: "On Hold",
            value: holdCount,
            description: "Needs management attention",
            icon: IconAlertTriangle,
            color: "orange",
          },
        ]}
      />

      {errorMessage && (
        <Alert
          color="red"
          icon={<IconAlertTriangle size={18} />}
          title="Projects Failed to Load"
        >
          {errorMessage}
        </Alert>
      )}

      <MWPanel
        title={viewMode === "completed" ? "Completed Project Library" : "Project Tracker"}
        subtitle={
          viewMode === "completed"
            ? `${filteredProjects.length} of ${completedProjects.length} completed project packages shown`
            : `${filteredProjects.length} of ${projects.length} active projects shown`
        }
        icon={IconTool}
      >
        <SegmentedControl
          mb="lg"
          fullWidth
          value={viewMode}
          onChange={setViewMode}
          data={[
            { label: `Active Projects (${projects.length})`, value: "active" },
            { label: `Completed Library (${completedProjects.length})`, value: "completed" },
          ]}
        />
        <Group mb="lg" wrap="wrap">
          <TextInput
            style={{ flex: 1, minWidth: 280 }}
            placeholder="Search person, project, company, owner, status, address, or next action..."
            leftSection={<IconSearch size={17} />}
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
          />
          <Button
            variant="light"
            color="gray"
            leftSection={
              refreshing ? <Loader size={16} /> : <IconRefresh size={17} />
            }
            disabled={refreshing}
            onClick={() => loadProjects(false)}
          >
            Refresh
          </Button>
        </Group>

        {!filteredProjects.length ? (
          <Alert color="gray" icon={<IconTool size={18} />}>
            No {viewMode === "completed" ? "completed project packages" : "active projects"} match the current search.
          </Alert>
        ) : (
          <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }} spacing="lg">
            {filteredProjects.map((project) => {
              const customer = customers[project.customer_id];
              const person = getProjectPerson(project, customer);
              const company = getProjectCompany(
                project,
                customer,
                person
              );
              const requirements = [
                project.site_visit_required && "Site Visit",
                project.measurements_required && "Measurements",
                project.quote_required && "Quote",
                project.fabrication_required && "Fabrication",
                project.test_fit_required && "Test Fit",
                project.finish_required && "Finish",
                project.install_required && "Install",
              ].filter(Boolean);
              const tracking = trackingByProject[project.id] || {
                tasks: 0,
                applicable: 0,
                complete: 0,
                blocked: 0,
                latestUpdate: null,
              };
              const checklistPercent = tracking.applicable
                ? Math.round((tracking.complete / tracking.applicable) * 100)
                : 0;
              const latestUpdate = tracking.latestUpdate;

              return (
                <Paper
                  key={project.id}
                  p="lg"
                  radius="lg"
                  style={{
                    background:
                      project.priority === "Rush"
                        ? "linear-gradient(145deg, rgba(120,0,10,.2), rgba(255,255,255,.025))"
                        : "rgba(255,255,255,.025)",
                    border: `1px solid ${
                      project.priority === "Rush"
                        ? "rgba(255,55,65,.5)"
                        : "rgba(255,255,255,.08)"
                    }`,
                  }}
                >
                  <Stack gap="md">
                    <Group justify="space-between" align="flex-start">
                      <Group gap="xs" wrap="wrap">
                        <Badge
                          color={getStatusColor(project.status)}
                          variant="light"
                        >
                          {project.status || "New"}
                        </Badge>
                        <Badge color={getPriorityColor(project.priority)}>
                          {project.priority || "Normal"}
                        </Badge>
                      </Group>

                      <ThemeIcon color="red" variant="light" radius="md">
                        <IconTool size={19} />
                      </ThemeIcon>
                    </Group>

                    <Box>
                      <Title
                        order={3}
                        c="white"
                        style={{
                          lineHeight: 1.25,
                          overflowWrap: "anywhere",
                        }}
                      >
                        {getProjectIdentity(project, customer)}
                      </Title>
                      {company && (
                        <Text fw={700} c="gray.3" mt={5}>
                          {company}
                        </Text>
                      )}
                      <Text size="sm" c="dimmed" mt={3}>
                        {project.project_number || "No project number"}
                      </Text>
                    </Box>

                    <Paper
                      p="sm"
                      radius="md"
                      style={{
                        background: "rgba(0,0,0,.2)",
                        border: "1px solid rgba(255,255,255,.06)",
                      }}
                    >
                      <Stack gap="xs">
                        <Group justify="space-between" wrap="nowrap">
                          <Text size="sm" c="dimmed">
                            Owner
                          </Text>
                          <Text size="sm" fw={750} ta="right">
                            {project.assigned_to ||
                              project.intake_owner ||
                              "Unassigned"}
                          </Text>
                        </Group>
                        <Group justify="space-between" wrap="nowrap">
                          <Text size="sm" c="dimmed">
                            Location
                          </Text>
                          <Text size="sm" fw={750} ta="right">
                            {project.work_location ||
                              project.job_address ||
                              "Not set"}
                          </Text>
                        </Group>
                        <Group justify="space-between" wrap="nowrap">
                          <Text size="sm" c="dimmed">
                            Due
                          </Text>
                          <Text size="sm" fw={750} ta="right">
                            {formatDate(
                              project.due_date ||
                                project.target_completion_date
                            )}
                          </Text>
                        </Group>
                      </Stack>
                    </Paper>

                    <Paper
                      p="sm"
                      radius="md"
                      style={{
                        background: "rgba(120,0,12,.1)",
                        border: "1px solid rgba(255,50,65,.18)",
                      }}
                    >
                      <Text size="xs" fw={850} c="dimmed" tt="uppercase">
                        Next Action
                      </Text>
                      <Text fw={800} c="white">
                        {project.next_action || "Review project status"}
                      </Text>
                    </Paper>

                    <Paper
                      p="sm"
                      radius="md"
                      style={{
                        background: "rgba(0,0,0,.2)",
                        border:
                          tracking.blocked > 0 ||
                          latestUpdate?.leadership_attention_required
                            ? "1px solid rgba(255,70,75,.55)"
                            : "1px solid rgba(255,255,255,.06)",
                      }}
                    >
                      <Group justify="space-between" mb={6}>
                        <Group gap={6}>
                          <IconClipboardCheck size={16} />
                          <Text size="sm" fw={800}>
                            Checklist
                          </Text>
                        </Group>
                        <Text size="sm" fw={800}>
                          {tracking.tasks
                            ? `${tracking.complete}/${tracking.applicable}`
                            : "Not started"}
                        </Text>
                      </Group>
                      <Progress
                        value={checklistPercent}
                        color={tracking.blocked ? "red" : "green"}
                        size="sm"
                        radius="xl"
                      />
                      <Group gap="xs" mt="sm" wrap="wrap">
                        {tracking.blocked > 0 && (
                          <Badge color="red" variant="filled">
                            {tracking.blocked} Blocked
                          </Badge>
                        )}
                        {latestUpdate ? (
                          <Badge
                            color={
                              latestUpdate.status === "Blocked"
                                ? "red"
                                : latestUpdate.status === "At Risk"
                                  ? "orange"
                                  : "green"
                            }
                            variant="light"
                          >
                            {latestUpdate.status} · Updated{" "}
                            {formatDate(latestUpdate.update_date)}
                          </Badge>
                        ) : (
                          <Badge color="gray" variant="light">
                            No daily update
                          </Badge>
                        )}
                        {latestUpdate?.leadership_attention_required && (
                          <Badge color="red" variant="filled">
                            Leadership Attention
                          </Badge>
                        )}
                      </Group>
                    </Paper>

                    <Group gap="xs" wrap="wrap">
                      {requirements.length ? (
                        requirements.map((requirement) => (
                          <Badge
                            key={requirement}
                            color="gray"
                            variant="light"
                          >
                            {requirement}
                          </Badge>
                        ))
                      ) : (
                        <Badge color="gray" variant="light">
                          No workflow flags
                        </Badge>
                      )}
                    </Group>

                    <Stack gap="xs">
                      <Button
                        fullWidth
                        color="red"
                        rightSection={<IconArrowRight size={17} />}
                        onClick={() => openProject(project)}
                      >
                        {viewMode === "completed" ? "Open Project Package" : "Open Project"}
                      </Button>
                      {viewMode === "completed" ? (
                        <Button
                          fullWidth
                          variant="light"
                          color="blue"
                          leftSection={<IconPackage size={17} />}
                          onClick={() => {
                            setSelectedProject({ ...project, initialTab: "package" });
                            setPage("projectDetails");
                          }}
                        >
                          Files & Reuse Checklist
                        </Button>
                      ) : (
                        <Button
                          fullWidth
                          variant="light"
                          color="blue"
                          leftSection={<IconClipboardCheck size={17} />}
                          onClick={() => openProjectChecklist(project)}
                        >
                          Checklist & Updates
                        </Button>
                      )}
                      <Button
                        fullWidth
                        variant="light"
                        color="gray"
                        onClick={() => editProject(project)}
                      >
                        Edit Project
                      </Button>
                      {project.status === "Completed" ? (
                        <Button
                          fullWidth
                          variant="light"
                          color="green"
                          leftSection={<IconRotateClockwise size={17} />}
                          onClick={() => reopenProject(project)}
                        >
                          Reopen Project
                        </Button>
                      ) : (
                        <Button
                          fullWidth
                          variant="light"
                          color="green"
                          leftSection={<IconCircleCheck size={17} />}
                          onClick={() => completeProject(project)}
                        >
                          Mark Complete
                        </Button>
                      )}
                      <Button
                        fullWidth
                        variant="subtle"
                        color="red"
                        leftSection={<IconTrash size={17} />}
                        onClick={() => removeProject(project)}
                      >
                        Delete / Archive
                      </Button>
                    </Stack>
                  </Stack>
                </Paper>
              );
            })}
          </SimpleGrid>
        )}
      </MWPanel>
    </Stack>
  );
}

export default Projects;
