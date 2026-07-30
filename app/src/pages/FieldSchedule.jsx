import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Box,
  Button,
  Group,
  Loader,
  Paper,
  Select,
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
  IconCalendarCheck,
  IconClock,
  IconMapPin,
  IconRefresh,
  IconSearch,
  IconTool,
  IconTruckDelivery,
  IconUser,
} from "@tabler/icons-react";

import MWKpiStrip from "../components/ui/MWKpiStrip";
import MWPageHeader from "../components/ui/MWPageHeader";
import MWPanel from "../components/ui/MWPanel";
import { supabase } from "../lib/supabase";

const SCHEDULE_TYPES = {
  "Site Visit": {
    startField: "site_visit_start",
    endField: "site_visit_end",
    statusField: "site_visit_status",
    icon: IconMapPin,
    color: "blue",
  },
  "Test Fit": {
    startField: "test_fit_start",
    endField: "test_fit_end",
    statusField: "test_fit_status",
    icon: IconTool,
    color: "orange",
  },
  Installation: {
    startField: "install_start",
    endField: "install_end",
    statusField: "install_status",
    icon: IconTruckDelivery,
    color: "violet",
  },
};

function getStatusColor(status) {
  if (status === "Completed") return "green";
  if (status === "Scheduled") return "blue";
  if (status === "In Progress") return "orange";
  if (status === "Adjustments Needed") return "red";
  if (status === "Ready to Schedule") return "yellow";
  return "gray";
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
    project.project_type ||
    project.project_category ||
    project.project_number ||
    "Untitled Project"
  );
}

function getProjectIdentity(project, customer) {
  return `${getProjectPerson(project, customer)} — ${getProjectItem(project)}`;
}

function getLocation(project) {
  const parts = [project.job_address, project.city, project.state].filter(
    Boolean
  );

  return parts.length > 0 ? parts.join(", ") : "Location not set";
}

function getOwner(project) {
  return project.assigned_to || project.intake_owner || "Not assigned";
}

function parseDate(value) {
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateTime(value) {
  const date = parseDate(value);
  if (!date) return "Not scheduled";

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDate(value) {
  if (!value) return "Not set";

  const source =
    typeof value === "string" && !value.includes("T")
      ? `${value}T00:00:00`
      : value;
  const date = parseDate(source);

  if (!date) return String(value);

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function startOfDay(value = new Date()) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(value = new Date()) {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

function getTiming(start) {
  const date = parseDate(start);
  if (!date) {
    return {
      key: "unscheduled",
      label: "Not Scheduled",
      color: "gray",
    };
  }

  const todayStart = startOfDay();
  const todayEnd = endOfDay();

  if (date < todayStart) {
    return {
      key: "overdue",
      label: "Overdue",
      color: "red",
    };
  }

  if (date <= todayEnd) {
    return {
      key: "today",
      label: "Today",
      color: "green",
    };
  }

  const sevenDays = endOfDay();
  sevenDays.setDate(sevenDays.getDate() + 7);

  if (date <= sevenDays) {
    return {
      key: "week",
      label: "Next 7 Days",
      color: "blue",
    };
  }

  return {
    key: "upcoming",
    label: "Upcoming",
    color: "gray",
  };
}

function buildScheduleEntries(projects, customers) {
  const entries = [];

  projects.forEach((project) => {
    const definitions = [
      {
        type: "Site Visit",
        required: project.site_visit_required,
      },
      {
        type: "Test Fit",
        required: project.test_fit_required,
      },
      {
        type: "Installation",
        required: project.install_required,
      },
    ];

    definitions.forEach(({ type, required }) => {
      const config = SCHEDULE_TYPES[type];
      const start = project[config.startField];
      const status = project[config.statusField] || "Not Started";

      if (!required || !start || status === "Completed") return;

      entries.push({
        id: `${type}-${project.id}`,
        type,
        project,
        customer: customers[project.customer_id] || null,
        start,
        end: project[config.endField],
        status,
        config,
        timing: getTiming(start),
      });
    });
  });

  return entries.sort(
    (a, b) =>
      (parseDate(a.start)?.getTime() || Number.MAX_SAFE_INTEGER) -
      (parseDate(b.start)?.getTime() || Number.MAX_SAFE_INTEGER)
  );
}

function FieldSchedule({ setPage, setSelectedProject }) {
  const [projects, setProjects] = useState([]);
  const [customers, setCustomers] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [search, setSearch] = useState("");

  const loadSchedule = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setErrorMessage("");

    try {
      const [projectResult, customerResult] = await Promise.all([
        supabase
          .from("projects")
          .select("*")
          .eq("is_active", true)
          .neq("status", "Cancelled")
          .order("created_at", { ascending: false }),
        supabase.from("customers").select("*"),
      ]);

      if (projectResult.error) throw projectResult.error;
      if (customerResult.error) throw customerResult.error;

      const customerMap = (customerResult.data || []).reduce(
        (result, customer) => {
          result[customer.id] = customer;
          return result;
        },
        {}
      );

      setProjects(projectResult.data || []);
      setCustomers(customerMap);
    } catch (error) {
      console.error("Field Schedule load error:", error);
      setErrorMessage(
        error.message || "The field schedule could not be loaded."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  const entries = useMemo(
    () => buildScheduleEntries(projects, customers),
    [projects, customers]
  );

  const ownerOptions = useMemo(
    () => [
      "All",
      ...Array.from(
        new Set(entries.map((entry) => getOwner(entry.project)).filter(Boolean))
      ).sort(),
    ],
    [entries]
  );

  const filteredEntries = useMemo(() => {
    const term = search.trim().toLowerCase();

    return entries.filter((entry) => {
      const { project, customer, type } = entry;

      if (ownerFilter !== "All" && getOwner(project) !== ownerFilter) {
        return false;
      }

      if (typeFilter !== "All" && type !== typeFilter) {
        return false;
      }

      if (!term) return true;

      const person = getProjectPerson(project, customer);
      const company = getProjectCompany(project, customer, person);
      const searchable = `
        ${getProjectIdentity(project, customer)}
        ${company}
        ${project.project_number || ""}
        ${project.project_type || ""}
        ${project.project_category || ""}
        ${getLocation(project)}
        ${getOwner(project)}
        ${type}
        ${entry.status}
        ${project.scheduled_notes || ""}
      `.toLowerCase();

      return searchable.includes(term);
    });
  }, [entries, ownerFilter, typeFilter, search]);

  const groupedEntries = useMemo(
    () => ({
      "Site Visit": filteredEntries.filter(
        (entry) => entry.type === "Site Visit"
      ),
      "Test Fit": filteredEntries.filter((entry) => entry.type === "Test Fit"),
      Installation: filteredEntries.filter(
        (entry) => entry.type === "Installation"
      ),
    }),
    [filteredEntries]
  );

  const counts = useMemo(
    () => ({
      total: entries.length,
      today: entries.filter((entry) => entry.timing.key === "today").length,
      overdue: entries.filter((entry) => entry.timing.key === "overdue").length,
      week: entries.filter((entry) => entry.timing.key === "week").length,
    }),
    [entries]
  );

  function openProject(project) {
    if (setSelectedProject) {
      setSelectedProject(project);
      setPage("projectDetails");
      return;
    }

    setPage("projects");
  }

  function renderScheduleCard(entry) {
    const { project, customer, type, status, start, end, config, timing } =
      entry;
    const TypeIcon = config.icon;
    const person = getProjectPerson(project, customer);
    const company = getProjectCompany(project, customer, person);

    return (
      <Paper
        key={entry.id}
        withBorder
        radius="lg"
        p="lg"
        style={{
          background:
            "linear-gradient(145deg, rgba(20, 25, 30, 0.98), rgba(12, 15, 18, 0.98))",
          borderColor:
            timing.key === "overdue"
              ? "rgba(250, 82, 82, 0.48)"
              : "rgba(255, 255, 255, 0.1)",
          boxShadow:
            timing.key === "overdue"
              ? "0 14px 38px rgba(120, 0, 0, 0.16)"
              : "0 14px 38px rgba(0, 0, 0, 0.18)",
        }}
      >
        <Stack gap="md">
          <Group justify="space-between" align="flex-start" wrap="nowrap">
            <Group gap="sm" wrap="nowrap">
              <ThemeIcon
                size={44}
                radius="md"
                color={config.color}
                variant="light"
              >
                <TypeIcon size={22} />
              </ThemeIcon>

              <Box>
                <Text size="xs" c="dimmed" fw={900} tt="uppercase">
                  {type}
                </Text>
                <Badge
                  mt={4}
                  color={getStatusColor(status)}
                  variant="light"
                >
                  {status}
                </Badge>
              </Box>
            </Group>

            <Badge color={timing.color} variant="filled">
              {timing.label}
            </Badge>
          </Group>

          <Box>
            <Title order={3} c="white" style={{ lineHeight: 1.18 }}>
              {getProjectIdentity(project, customer)}
            </Title>
            <Text size="sm" c="dimmed" mt={6}>
              {[company, project.project_number].filter(Boolean).join(" • ") ||
                "No project reference"}
            </Text>
          </Box>

          <Paper
            withBorder
            radius="md"
            p="md"
            style={{ background: "rgba(255, 255, 255, 0.025)" }}
          >
            <Stack gap="sm">
              <Group gap="sm" align="flex-start" wrap="nowrap">
                <IconClock size={17} color="#ff4d4d" />
                <Box>
                  <Text size="xs" c="dimmed" fw={800} tt="uppercase">
                    Scheduled
                  </Text>
                  <Text size="sm" fw={700}>
                    {formatDateTime(start)}
                  </Text>
                  {end && (
                    <Text size="xs" c="dimmed">
                      Ends {formatDateTime(end)}
                    </Text>
                  )}
                </Box>
              </Group>

              <Group gap="sm" align="flex-start" wrap="nowrap">
                <IconMapPin size={17} color="#ff4d4d" />
                <Box>
                  <Text size="xs" c="dimmed" fw={800} tt="uppercase">
                    Location
                  </Text>
                  <Text size="sm">{getLocation(project)}</Text>
                </Box>
              </Group>

              <Group gap="sm" align="flex-start" wrap="nowrap">
                <IconUser size={17} color="#ff4d4d" />
                <Box>
                  <Text size="xs" c="dimmed" fw={800} tt="uppercase">
                    Assigned
                  </Text>
                  <Text size="sm">{getOwner(project)}</Text>
                </Box>
              </Group>
            </Stack>
          </Paper>

          {project.scheduled_notes && (
            <Box>
              <Text size="xs" c="dimmed" fw={800} tt="uppercase">
                Schedule Notes
              </Text>
              <Text size="sm" mt={4} lineClamp={3}>
                {project.scheduled_notes}
              </Text>
            </Box>
          )}

          <Group justify="space-between" align="center" mt="auto">
            <Text size="xs" c="dimmed">
              Target: {formatDate(project.target_completion_date)}
            </Text>

            <Button
              color="red"
              variant="light"
              rightSection={<IconArrowRight size={17} />}
              onClick={() => openProject(project)}
            >
              Open Project
            </Button>
          </Group>
        </Stack>
      </Paper>
    );
  }

  function renderScheduleGroup(type, title, subtitle) {
    const records = groupedEntries[type];

    if (typeFilter !== "All" && typeFilter !== type) return null;

    return (
      <MWPanel
        title={title}
        subtitle={`${records.length} ${subtitle}`}
        icon={SCHEDULE_TYPES[type].icon}
      >
        {records.length === 0 ? (
          <Paper
            withBorder
            radius="lg"
            p="xl"
            style={{ background: "rgba(255, 255, 255, 0.02)" }}
          >
            <Stack align="center" gap="xs">
              <ThemeIcon
                size={52}
                radius="xl"
                color="gray"
                variant="light"
              >
                <CalendarCheckIcon />
              </ThemeIcon>
              <Text fw={800}>No matching field work</Text>
              <Text c="dimmed" size="sm" ta="center">
                No active {subtitle} match the current filters.
              </Text>
            </Stack>
          </Paper>
        ) : (
          <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }} spacing="lg">
            {records.map(renderScheduleCard)}
          </SimpleGrid>
        )}
      </MWPanel>
    );
  }

  function CalendarCheckIcon() {
    return <IconCalendarCheck size={25} />;
  }

  return (
    <Stack gap="lg">
      <MWPageHeader
        title="Field Schedule"
        subtitle="Live site visits, test fits, and installation commitments."
        setPage={setPage}
        showBack
        backPage="projects"
        backLabel="Projects"
        showDashboard
      />

      <MWKpiStrip
        items={[
          {
            label: "Active Field Work",
            value: counts.total,
            description: "Scheduled visits, test fits, and installs",
            icon: IconCalendarCheck,
            color: "blue",
          },
          {
            label: "Due Today",
            value: counts.today,
            description: "Requires field execution today",
            icon: IconClock,
            color: "green",
          },
          {
            label: "Overdue",
            value: counts.overdue,
            description: "Past scheduled field time",
            icon: IconAlertTriangle,
            color: "red",
          },
          {
            label: "Next 7 Days",
            value: counts.week,
            description: "Upcoming field commitments",
            icon: IconTruckDelivery,
            color: "violet",
          },
        ]}
        columns={{ base: 1, sm: 2, xl: 4 }}
        compact
      />

      <MWPanel
        title="Schedule Controls"
        subtitle="Find field commitments by customer, project, assignment, or work type."
        icon={IconSearch}
      >
        <SimpleGrid cols={{ base: 1, md: 2, xl: 4 }} spacing="md">
          <TextInput
            label="Search Schedule"
            placeholder="Person, project, company, location..."
            leftSection={<IconSearch size={17} />}
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
          />

          <Select
            label="Assigned To"
            data={ownerOptions}
            value={ownerFilter}
            onChange={(value) => setOwnerFilter(value || "All")}
            allowDeselect={false}
          />

          <Select
            label="Field Work Type"
            data={["All", "Site Visit", "Test Fit", "Installation"]}
            value={typeFilter}
            onChange={(value) => setTypeFilter(value || "All")}
            allowDeselect={false}
          />

          <Button
            mt={25}
            variant="light"
            color="gray"
            leftSection={<IconRefresh size={18} />}
            loading={refreshing}
            onClick={() => loadSchedule(true)}
          >
            Refresh Schedule
          </Button>
        </SimpleGrid>
      </MWPanel>

      {errorMessage && (
        <Alert
          color="red"
          icon={<IconAlertTriangle size={19} />}
          title="Field Schedule Could Not Load"
        >
          {errorMessage}
        </Alert>
      )}

      {loading ? (
        <Paper withBorder radius="lg" p={60}>
          <Group justify="center">
            <Loader color="red" />
            <Text c="dimmed">Loading scheduled field work...</Text>
          </Group>
        </Paper>
      ) : (
        <>
          {renderScheduleGroup(
            "Site Visit",
            "Site Visits",
            "active site visits"
          )}
          {renderScheduleGroup("Test Fit", "Test Fits", "active test fits")}
          {renderScheduleGroup(
            "Installation",
            "Installations",
            "active installations"
          )}
        </>
      )}
    </Stack>
  );
}

export default FieldSchedule;