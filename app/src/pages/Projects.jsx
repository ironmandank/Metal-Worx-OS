import {
  Alert,
  Badge,
  Box,
  Button,
  Group,
  Loader,
  Paper,
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
  IconMapPin,
  IconRefresh,
  IconSearch,
  IconTool,
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
  const [customers, setCustomers] = useState({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const loadProjects = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    else setRefreshing(true);

    setErrorMessage("");

    try {
      const [projectResult, customerResult] = await Promise.all([
        supabase
          .from("projects")
          .select("*")
          .eq("is_active", true)
          .order("created_at", { ascending: false }),
        supabase.from("customers").select("*"),
      ]);

      if (projectResult.error) throw projectResult.error;
      if (customerResult.error) throw customerResult.error;

      setProjects(projectResult.data || []);
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
    if (!term) return projects;

    return projects.filter((project) => {
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
  }, [customers, projects, search]);

  const siteVisitCount = projects.filter(
    (project) =>
      project.site_visit_required &&
      project.site_visit_status !== "Completed"
  ).length;
  const installCount = projects.filter(
    (project) =>
      project.install_required && project.install_status !== "Completed"
  ).length;
  const holdCount = projects.filter(
    (project) => project.status === "On Hold"
  ).length;

  function openProject(project) {
    setSelectedProject(project);
    setPage("projectDetails");
  }

  function editProject(project) {
    setSelectedProject(project);
    setPage("editProject");
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
        title="Project Tracker"
        subtitle={`${filteredProjects.length} of ${projects.length} active projects shown`}
        icon={IconTool}
      >
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
            No active projects match the current search.
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

                    <Group grow>
                      <Button
                        color="red"
                        rightSection={<IconArrowRight size={17} />}
                        onClick={() => openProject(project)}
                      >
                        Open Project
                      </Button>
                      <Button
                        variant="light"
                        color="gray"
                        onClick={() => editProject(project)}
                      >
                        Edit
                      </Button>
                    </Group>
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