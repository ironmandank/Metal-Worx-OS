import {
  Alert,
  Badge,
  Box,
  Button,
  Group,
  Loader,
  Paper,
  Progress,
  ScrollArea,
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
  IconCheck,
  IconClock,
  IconFlame,
  IconRefresh,
  IconSearch,
  IconTool,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import MWKpiStrip from "../components/ui/MWKpiStrip";
import MWPageHeader from "../components/ui/MWPageHeader";
import MWPanel from "../components/ui/MWPanel";
import { supabase } from "../lib/supabase";

const STATIONS = [
  "Needs Estimate",
  "Scheduled Site Visit",
  "Needs Design",
  "Customer Approval",
  "Ready for Production",
  "Design",
  "Laser",
  "Prep",
  "Paint",
  "Powder Coat",
  "QC",
  "Showroom",
  "Shipping",
  "Completed",
  "On Hold",
];

function getPriorityColor(priority) {
  const value = String(priority || "").toLowerCase();
  if (value.includes("rush") || value.includes("urgent")) return "red";
  if (value.includes("high")) return "orange";
  if (value.includes("low")) return "gray";
  return "blue";
}

function getStationColor(station) {
  if (station === "Completed") return "green";
  if (station === "On Hold") return "orange";
  if (station === "Ready for Production") return "red";
  if (["Design", "Laser", "Prep", "Paint", "Powder Coat", "QC"].includes(station)) {
    return "red";
  }
  return "blue";
}

function formatDate(value) {
  if (!value) return "Not set";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getPersonName(job) {
  return (
    job.ordered_by_name ||
    job.customer_contact_name ||
    job.contact_name ||
    job.customer_name ||
    "Customer not assigned"
  );
}

function getItemName(job) {
  return (
    job.item_name ||
    job.product_name ||
    job.job_name ||
    job.description ||
    "Item not specified"
  );
}

function getDisplayName(job) {
  return `${getPersonName(job)} — ${getItemName(job)}`;
}

function ProductionBoard({ setPage, setSelectedJob }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

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
      console.error(error);
      setErrorMessage(
        error?.message || "The production board could not be loaded."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadJobs(true);

    const channel = supabase
      .channel("metal-worx-production-board")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jobs" },
        () => loadJobs(false)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadJobs]);

  const filteredJobs = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return jobs;

    return jobs.filter((job) =>
      [
        getDisplayName(job),
        job.customer_name,
        job.company_name,
        job.job_name,
        job.item_name,
        job.product_name,
        job.job_number,
        job.order_number,
        job.current_station,
        job.priority,
        job.assigned_to,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(value)
    );
  }, [jobs, search]);

  const activeJobs = jobs.filter(
    (job) => !["Completed", "Cancelled"].includes(job.current_station)
  );
  const productionJobs = jobs.filter((job) =>
    [
      "Ready for Production",
      "Design",
      "Laser",
      "Prep",
      "Paint",
      "Powder Coat",
      "QC",
      "Showroom",
      "Shipping",
    ].includes(job.current_station)
  );
  const holdJobs = jobs.filter(
    (job) => job.current_station === "On Hold"
  );
  const rushJobs = jobs.filter((job) =>
    ["rush", "urgent", "high"].some((value) =>
      String(job.priority || "").toLowerCase().includes(value)
    )
  );

  function openJob(job) {
    setSelectedJob(job);
    setPage("jobDetails");
  }

  if (loading) {
    return (
      <Stack gap="xl">
        <MWPageHeader
          title="Production Board"
          subtitle="Loading the live Metal Worx workflow."
          setPage={setPage}
        />
        <MWPanel>
          <Group justify="center" py={80}>
            <Loader color="red" />
            <Text c="dimmed">Loading production board...</Text>
          </Group>
        </MWPanel>
      </Stack>
    );
  }

  return (
    <Stack gap="xl">
      <MWPageHeader
        title="Production Board"
        subtitle="Live Metal Worx workflow from estimating through completion."
        setPage={setPage}
      />

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
            label: "In Production",
            value: productionJobs.length,
            description: "Active shop workflow",
            icon: IconClock,
            color: "blue",
          },
          {
            label: "Priority",
            value: rushJobs.length,
            description: "Rush, urgent, or high priority",
            icon: IconFlame,
            color: "orange",
          },
          {
            label: "On Hold",
            value: holdJobs.length,
            description: "Needs management attention",
            icon: IconAlertTriangle,
            color: "orange",
          },
        ]}
      />

      <MWPanel
        title="Board Controls"
        subtitle={`${filteredJobs.length} of ${jobs.length} jobs shown`}
        icon={IconSearch}
      >
        <Group wrap="wrap">
          <TextInput
            style={{ flex: 1, minWidth: 280 }}
            placeholder="Search person, item, company, order, station, or priority..."
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
          title="Production Board Warning"
        >
          {errorMessage}
        </Alert>
      )}

      <ScrollArea type="auto" scrollbarSize={10}>
        <Group
          align="flex-start"
          wrap="nowrap"
          gap="md"
          pb="md"
          style={{ minWidth: "max-content" }}
        >
          {STATIONS.map((station) => {
            const stationJobs = filteredJobs.filter(
              (job) => job.current_station === station
            );

            return (
              <Paper
                key={station}
                radius="lg"
                style={{
                  width: 330,
                  minWidth: 330,
                  overflow: "hidden",
                  background: "rgba(13, 18, 22, 0.96)",
                  border: "1px solid rgba(255,255,255,.1)",
                }}
              >
                <Group
                  justify="space-between"
                  p="md"
                  style={{
                    borderBottom: "1px solid rgba(255,255,255,.09)",
                    boxShadow: "inset 0 -2px 0 rgba(220, 0, 25, .7)",
                  }}
                >
                  <Group gap="sm" wrap="nowrap">
                    <ThemeIcon
                      color={getStationColor(station)}
                      variant="light"
                      radius="md"
                    >
                      {station === "Completed" ? (
                        <IconCheck size={18} />
                      ) : (
                        <IconTool size={18} />
                      )}
                    </ThemeIcon>
                    <Box>
                      <Text fw={900} c="white">
                        {station}
                      </Text>
                      <Text size="xs" c="dimmed">
                        Current workflow stage
                      </Text>
                    </Box>
                  </Group>
                  <Badge color={getStationColor(station)} variant="light">
                    {stationJobs.length}
                  </Badge>
                </Group>

                <Stack gap="sm" p="sm" mih={180}>
                  {!stationJobs.length ? (
                    <Text c="dimmed" size="sm" ta="center" py="xl">
                      No jobs at this station.
                    </Text>
                  ) : (
                    stationJobs.map((job) => {
                      const progress = Number(job.progress_percent || 0);
                      const companyName =
                        job.company_name &&
                        job.company_name !== getPersonName(job)
                          ? job.company_name
                          : "";

                      return (
                        <Paper
                          key={job.id}
                          component="button"
                          type="button"
                          onClick={() => openJob(job)}
                          p="md"
                          radius="md"
                          style={{
                            width: "100%",
                            textAlign: "left",
                            cursor: "pointer",
                            color: "inherit",
                            background: "rgba(255,255,255,.035)",
                            border: `1px solid ${
                              String(job.priority || "")
                                .toLowerCase()
                                .includes("rush")
                                ? "rgba(255,50,50,.55)"
                                : "rgba(255,255,255,.09)"
                            }`,
                          }}
                        >
                          <Stack gap="sm">
                            <Group
                              justify="space-between"
                              align="flex-start"
                              wrap="nowrap"
                            >
                              <Title
                                order={4}
                                c="white"
                                style={{
                                  lineHeight: 1.25,
                                  overflowWrap: "anywhere",
                                }}
                              >
                                {getDisplayName(job)}
                              </Title>
                              <IconArrowRight
                                size={18}
                                color="#ff3347"
                                style={{ flexShrink: 0 }}
                              />
                            </Group>

                            {companyName && (
                              <Text size="sm" fw={700} c="gray.3">
                                {companyName}
                              </Text>
                            )}

                            <Group gap="xs" wrap="wrap">
                              <Badge
                                color={getPriorityColor(job.priority)}
                                variant="light"
                              >
                                {job.priority || "Normal"}
                              </Badge>
                              {(job.job_number || job.order_number) && (
                                <Badge color="gray" variant="light">
                                  {job.job_number || job.order_number}
                                </Badge>
                              )}
                            </Group>

                            <SimpleGrid cols={2} spacing="xs">
                              <Box>
                                <Text size="xs" c="dimmed" fw={800}>
                                  DUE
                                </Text>
                                <Text size="sm" fw={700}>
                                  {formatDate(job.due_date)}
                                </Text>
                              </Box>
                              <Box>
                                <Text size="xs" c="dimmed" fw={800}>
                                  ASSIGNED
                                </Text>
                                <Text size="sm" fw={700}>
                                  {job.assigned_to || "Unassigned"}
                                </Text>
                              </Box>
                            </SimpleGrid>

                            {progress > 0 && (
                              <Box>
                                <Group justify="space-between" mb={5}>
                                  <Text size="xs" c="dimmed">
                                    Progress
                                  </Text>
                                  <Text size="xs" fw={800}>
                                    {progress}%
                                  </Text>
                                </Group>
                                <Progress
                                  value={progress}
                                  color={progress >= 100 ? "green" : "red"}
                                  size="xs"
                                  radius="xl"
                                />
                              </Box>
                            )}
                          </Stack>
                        </Paper>
                      );
                    })
                  )}
                </Stack>
              </Paper>
            );
          })}
        </Group>
      </ScrollArea>
    </Stack>
  );
}

export default ProductionBoard;