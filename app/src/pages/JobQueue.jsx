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
  IconCalendar,
  IconCheck,
  IconClock,
  IconFlame,
  IconListDetails,
  IconRefresh,
  IconSearch,
  IconTool,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import MWKpiStrip from "../components/ui/MWKpiStrip";
import MWPageHeader from "../components/ui/MWPageHeader";
import MWPanel from "../components/ui/MWPanel";
import { supabase } from "../lib/supabase";

const CLOSED_STATIONS = ["Completed", "Cancelled"];

function cleanText(value) {
  return String(value || "").trim();
}

function getPersonName(job) {
  return (
    cleanText(job.ordered_by_name) ||
    cleanText(job.customer_contact_name) ||
    cleanText(job.contact_name) ||
    cleanText(job.customer_name) ||
    "Customer not assigned"
  );
}

function getItemName(job) {
  return (
    cleanText(job.item_name) ||
    cleanText(job.product_name) ||
    cleanText(job.job_name) ||
    cleanText(job.description) ||
    "Item not specified"
  );
}

function getDisplayName(job) {
  return `${getPersonName(job)} — ${getItemName(job)}`;
}

function parseDate(value) {
  if (!value) return null;
  const rawValue = String(value);
  const parsed = new Date(
    rawValue.includes("T") ? rawValue : `${rawValue}T12:00:00`
  );
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(value) {
  const parsed = parseDate(value);
  if (!parsed) return value || "Not set";

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isOverdue(job) {
  const dueDate = parseDate(job.due_date);
  if (!dueDate || CLOSED_STATIONS.includes(job.current_station)) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);
  return dueDate < today;
}

function priorityRank(priority) {
  const value = cleanText(priority).toLowerCase();
  if (value.includes("emergency") || value.includes("urgent")) return 0;
  if (value.includes("rush")) return 1;
  if (value.includes("high")) return 2;
  if (value.includes("normal")) return 3;
  return 4;
}

function priorityColor(priority) {
  const rank = priorityRank(priority);
  if (rank === 0 || rank === 1) return "red";
  if (rank === 2) return "orange";
  if (rank === 4) return "gray";
  return "blue";
}

function sortJobs(a, b) {
  const priorityDifference = priorityRank(a.priority) - priorityRank(b.priority);
  if (priorityDifference) return priorityDifference;

  const aDue = parseDate(a.due_date)?.getTime() ?? Infinity;
  const bDue = parseDate(b.due_date)?.getTime() ?? Infinity;
  if (aDue !== bDue) return aDue - bDue;

  return getDisplayName(a).localeCompare(getDisplayName(b));
}

function JobQueue({ setPage, setSelectedJob }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [stationFilter, setStationFilter] = useState("all");
  const refreshTimerRef = useRef(null);

  const loadJobs = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    else setRefreshing(true);
    setErrorMessage("");

    try {
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setJobs(data || []);
    } catch (error) {
      console.error("Job queue load error:", error);
      setErrorMessage(error?.message || "The job queue could not be loaded.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadJobs(true);

    const scheduleRefresh = () => {
      window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = window.setTimeout(() => loadJobs(false), 250);
    };

    const channel = supabase
      .channel("metal-worx-job-queue")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jobs" },
        scheduleRefresh
      )
      .subscribe();

    return () => {
      window.clearTimeout(refreshTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [loadJobs]);

  const stationOptions = useMemo(() => {
    const stations = [
      ...new Set(jobs.map((job) => cleanText(job.current_station)).filter(Boolean)),
    ].sort((a, b) => a.localeCompare(b));

    return [
      { value: "all", label: "All Stations" },
      ...stations.map((station) => ({ value: station, label: station })),
    ];
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    const term = search.trim().toLowerCase();

    return jobs
      .filter((job) => {
        const closed = CLOSED_STATIONS.includes(job.current_station);

        if (statusFilter === "active" && closed) return false;
        if (statusFilter === "completed" && job.current_station !== "Completed") {
          return false;
        }
        if (statusFilter === "overdue" && !isOverdue(job)) return false;
        if (statusFilter === "hold" && job.current_station !== "On Hold") {
          return false;
        }

        if (
          stationFilter !== "all" &&
          job.current_station !== stationFilter
        ) {
          return false;
        }

        if (!term) return true;

        return [
          getDisplayName(job),
          job.company_name,
          job.job_number,
          job.order_number,
          job.category,
          job.current_station,
          job.priority,
          job.assigned_to,
          job.finish_type,
          job.paint_colors,
          job.notes,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(term);
      })
      .sort(sortJobs);
  }, [jobs, search, stationFilter, statusFilter]);

  const activeJobs = jobs.filter(
    (job) => !CLOSED_STATIONS.includes(job.current_station)
  );
  const overdueCount = activeJobs.filter(isOverdue).length;
  const priorityCount = activeJobs.filter(
    (job) => priorityRank(job.priority) <= 2
  ).length;
  const holdCount = activeJobs.filter(
    (job) => job.current_station === "On Hold"
  ).length;

  function openJob(job) {
    setSelectedJob(job);
    setPage("jobDetails");
  }

  if (loading) {
    return (
      <Stack gap="xl">
        <MWPageHeader
          title="Job Queue"
          subtitle="Loading Metal Worx workflow jobs."
          setPage={setPage}
        />
        <MWPanel>
          <Group justify="center" py={80}>
            <Loader color="red" />
            <Text c="dimmed">Loading job queue...</Text>
          </Group>
        </MWPanel>
      </Stack>
    );
  }

  return (
    <Stack gap="xl">
      <MWPageHeader
        title="Job Queue"
        subtitle="Operational list view for estimating, field, fabrication, finishing, and completion."
        buttonText="+ New Job"
        onButtonClick={() => setPage("newJob")}
        setPage={setPage}
      />

      <Alert color="blue" icon={<IconListDetails size={18} />}>
        This queue tracks the legacy end-to-end <strong>jobs</strong> workflow.
        Work-order execution is managed separately under Production Jobs and
        Production Control.
      </Alert>

      <MWKpiStrip
        compact
        columns={{ base: 1, sm: 2, xl: 4 }}
        items={[
          {
            label: "Active Jobs",
            value: activeJobs.length,
            description: "Open workflow records",
            icon: IconTool,
            color: "red",
          },
          {
            label: "Overdue",
            value: overdueCount,
            description: "Past required completion",
            icon: IconCalendar,
            color: "red",
          },
          {
            label: "Priority",
            value: priorityCount,
            description: "High, Rush, or Emergency",
            icon: IconFlame,
            color: "orange",
          },
          {
            label: "On Hold",
            value: holdCount,
            description: "Needs management attention",
            icon: IconAlertTriangle,
            color: "yellow",
          },
        ]}
      />

      <MWPanel
        title="Queue Controls"
        subtitle={`${filteredJobs.length} of ${jobs.length} jobs shown`}
        icon={IconSearch}
      >
        <Group wrap="wrap">
          <TextInput
            style={{ flex: 1, minWidth: 280 }}
            placeholder="Search person, item, job, order, station, assignment, finish, or notes..."
            leftSection={<IconSearch size={17} />}
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
          />
          <Select
            w={195}
            value={statusFilter}
            onChange={(value) => setStatusFilter(value || "active")}
            allowDeselect={false}
            data={[
              { value: "active", label: "Active Jobs" },
              { value: "overdue", label: "Overdue Jobs" },
              { value: "hold", label: "On Hold" },
              { value: "completed", label: "Completed Jobs" },
              { value: "all", label: "All Jobs" },
            ]}
          />
          <Select
            w={220}
            searchable
            value={stationFilter}
            onChange={(value) => setStationFilter(value || "all")}
            allowDeselect={false}
            data={stationOptions}
          />
          <Button
            variant="light"
            color="gray"
            leftSection={
              refreshing ? <Loader size={16} /> : <IconRefresh size={17} />
            }
            disabled={refreshing}
            onClick={() => loadJobs(false)}
          >
            Refresh
          </Button>
        </Group>
      </MWPanel>

      {errorMessage && (
        <Alert
          color="red"
          icon={<IconAlertTriangle size={18} />}
          title="Job Queue Warning"
        >
          {errorMessage}
        </Alert>
      )}

      <MWPanel
        title="Workflow Jobs"
        subtitle="Priority jobs are shown first, followed by nearest due date"
        icon={IconListDetails}
      >
        {!filteredJobs.length ? (
          <Alert color="gray" icon={<IconCheck size={19} />}>
            No jobs match the current filters.
          </Alert>
        ) : (
          <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="md">
            {filteredJobs.map((job) => {
              const overdue = isOverdue(job);
              const companyName =
                cleanText(job.company_name) &&
                cleanText(job.company_name) !== getPersonName(job)
                  ? cleanText(job.company_name)
                  : "";
              const closed = CLOSED_STATIONS.includes(job.current_station);

              return (
                <Paper
                  key={job.id}
                  p="lg"
                  radius="lg"
                  style={{
                    opacity: closed ? 0.78 : 1,
                    background: overdue
                      ? "linear-gradient(145deg, rgba(120,0,10,.2), rgba(255,255,255,.025))"
                      : "rgba(255,255,255,.025)",
                    border: `1px solid ${
                      overdue
                        ? "rgba(255,40,55,.48)"
                        : "rgba(255,255,255,.09)"
                    }`,
                  }}
                >
                  <Stack gap="md">
                    <Group justify="space-between" align="flex-start" wrap="nowrap">
                      <Box style={{ minWidth: 0 }}>
                        <Group gap="xs" wrap="wrap" mb={7}>
                          <Badge color="red" variant="light">
                            {job.current_station || "Not assigned"}
                          </Badge>
                          <Badge
                            color={priorityColor(job.priority)}
                            variant="light"
                          >
                            {job.priority || "Normal"}
                          </Badge>
                          {overdue && <Badge color="red">Overdue</Badge>}
                        </Group>

                        <Title
                          order={3}
                          c="white"
                          style={{ lineHeight: 1.22, overflowWrap: "anywhere" }}
                        >
                          {getDisplayName(job)}
                        </Title>

                        {companyName && (
                          <Text c="gray.4" fw={700} mt={5}>
                            {companyName}
                          </Text>
                        )}
                      </Box>

                      <ThemeIcon
                        size={46}
                        radius="lg"
                        color={overdue ? "red" : closed ? "green" : "gray"}
                        variant="light"
                        style={{ flexShrink: 0 }}
                      >
                        {closed ? (
                          <IconCheck size={23} />
                        ) : overdue ? (
                          <IconAlertTriangle size={23} />
                        ) : (
                          <IconTool size={23} />
                        )}
                      </ThemeIcon>
                    </Group>

                    <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
                      <Box>
                        <Text size="xs" c="dimmed" fw={800} tt="uppercase">
                          Due
                        </Text>
                        <Text fw={800} c={overdue ? "red.4" : "white"}>
                          {formatDate(job.due_date)}
                        </Text>
                      </Box>
                      <Box>
                        <Text size="xs" c="dimmed" fw={800} tt="uppercase">
                          Assigned
                        </Text>
                        <Text fw={800}>{job.assigned_to || "Unassigned"}</Text>
                      </Box>
                      <Box>
                        <Text size="xs" c="dimmed" fw={800} tt="uppercase">
                          Quantity
                        </Text>
                        <Text fw={800}>{job.quantity || 1}</Text>
                      </Box>
                      <Box>
                        <Text size="xs" c="dimmed" fw={800} tt="uppercase">
                          Category
                        </Text>
                        <Text fw={800}>{job.category || "Not set"}</Text>
                      </Box>
                    </SimpleGrid>

                    {(job.finish_type || job.paint_colors) && (
                      <Card
                        withBorder
                        radius="md"
                        p="sm"
                        style={{ background: "rgba(0,0,0,.18)" }}
                      >
                        <Text size="sm">
                          <strong>Finish:</strong>{" "}
                          {[job.finish_type, job.paint_colors]
                            .filter(Boolean)
                            .join(" • ")}
                        </Text>
                      </Card>
                    )}

                    <Button
                      color="red"
                      rightSection={<IconArrowRight size={17} />}
                      onClick={() => openJob(job)}
                    >
                      Open Job
                    </Button>
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

export default JobQueue;