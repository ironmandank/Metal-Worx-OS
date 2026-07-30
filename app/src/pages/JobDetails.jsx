import {
  Alert,
  Badge,
  Box,
  Button,
  Grid,
  Group,
  Image,
  Paper,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Timeline,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconArrowRight,
  IconCalendar,
  IconCheck,
  IconClock,
  IconFileDescription,
  IconFlag,
  IconHistory,
  IconPackage,
  IconPhoto,
  IconPrinter,
  IconTool,
  IconUser,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import MWKpiStrip from "../components/ui/MWKpiStrip";
import MWPageHeader from "../components/ui/MWPageHeader";
import MWPanel from "../components/ui/MWPanel";
import { supabase } from "../lib/supabase";

const WORKFLOWS = {
  Flag: [
    "Needs Design",
    "Design",
    "Laser",
    "Prep",
    "Paint",
    "QC",
    "Showroom",
    "Completed",
  ],
  "Custom Art": [
    "Needs Design",
    "Design",
    "Laser",
    "Prep",
    "Paint",
    "QC",
    "Showroom",
    "Completed",
  ],
  "Hand Rail": [
    "Needs Estimate",
    "Scheduled Site Visit",
    "Customer Approval",
    "Ready for Production",
    "Welding",
    "Prep",
    "Sandblast",
    "Powder Coat",
    "QC",
    "Installation",
    "Completed",
  ],
  Gate: [
    "Needs Estimate",
    "Scheduled Site Visit",
    "Customer Approval",
    "Ready for Production",
    "Welding",
    "Prep",
    "Sandblast",
    "Powder Coat",
    "QC",
    "Installation",
    "Completed",
  ],
  Repair: [
    "Needs Estimate",
    "Ready for Production",
    "Welding",
    "Prep",
    "QC",
    "Completed",
  ],
  "Powder Coat": [
    "Ready for Production",
    "Prep",
    "Sandblast",
    "Powder Coat",
    "QC",
    "Showroom",
    "Completed",
  ],
  "Laser Cutting": [
    "Ready for Production",
    "Laser",
    "QC",
    "Showroom",
    "Completed",
  ],
};

function getPersonName(job) {
  return (
    job?.ordered_by_name ||
    job?.customer_contact_name ||
    job?.contact_name ||
    job?.customer_name ||
    "Customer not assigned"
  );
}

function getItemName(job) {
  return (
    job?.item_name ||
    job?.product_name ||
    job?.job_name ||
    job?.description ||
    "Item not specified"
  );
}

function getDisplayName(job) {
  return `${getPersonName(job)} — ${getItemName(job)}`;
}

function formatDate(value, includeTime = false) {
  if (!value) return "Not set";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(includeTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}

function getPriorityColor(priority) {
  const value = String(priority || "").toLowerCase();
  if (value.includes("rush") || value.includes("urgent")) return "red";
  if (value.includes("high")) return "orange";
  if (value.includes("low")) return "gray";
  return "blue";
}

function InfoField({ label, value, icon: Icon }) {
  return (
    <Paper
      p="md"
      radius="md"
      style={{
        background: "rgba(255,255,255,.025)",
        border: "1px solid rgba(255,255,255,.08)",
      }}
    >
      <Group gap="sm" align="flex-start" wrap="nowrap">
        {Icon && (
          <ThemeIcon color="red" variant="light" radius="md">
            <Icon size={17} />
          </ThemeIcon>
        )}
        <Box style={{ minWidth: 0 }}>
          <Text size="xs" fw={850} c="dimmed" tt="uppercase">
            {label}
          </Text>
          <Text fw={750} c="white" mt={3} style={{ overflowWrap: "anywhere" }}>
            {value || "Not set"}
          </Text>
        </Box>
      </Group>
    </Paper>
  );
}

function JobDetails({ selectedJob, setPage }) {
  const [history, setHistory] = useState([]);
  const [moving, setMoving] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const stationOrder = useMemo(
    () => WORKFLOWS[selectedJob?.category] || WORKFLOWS.Flag,
    [selectedJob?.category]
  );

  const loadHistory = useCallback(async () => {
    if (!selectedJob?.id) return;

    setLoadingHistory(true);

    try {
      const { data, error } = await supabase
        .from("job_history")
        .select("*")
        .eq("job_id", selectedJob.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error(error);
      notifications.show({
        title: "History Could Not Load",
        message: error?.message || "The job history could not be loaded.",
        color: "red",
      });
    } finally {
      setLoadingHistory(false);
    }
  }, [selectedJob?.id]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const currentIndex = stationOrder.indexOf(selectedJob?.current_station);
  const progressPercent =
    currentIndex < 0
      ? 0
      : Math.round((currentIndex / Math.max(stationOrder.length - 1, 1)) * 100);
  const nextStation =
    currentIndex >= 0 && currentIndex < stationOrder.length - 1
      ? stationOrder[currentIndex + 1]
      : null;

  async function moveToNextStation() {
    if (!selectedJob?.id || moving) return;

    if (currentIndex === -1) {
      notifications.show({
        title: "Workflow Station Not Recognized",
        message: "The current station is not part of this job workflow.",
        color: "orange",
      });
      return;
    }

    if (!nextStation) {
      notifications.show({
        title: "Job Already Completed",
        message: "There is no remaining workflow station.",
        color: "green",
      });
      return;
    }

    setMoving(true);

    try {
      const { error: updateError } = await supabase
        .from("jobs")
        .update({ current_station: nextStation })
        .eq("id", selectedJob.id);

      if (updateError) throw updateError;

      const { error: historyError } = await supabase
        .from("job_history")
        .insert([
          {
            job_id: selectedJob.id,
            moved_by: "Dan",
            notes: `Moved from ${selectedJob.current_station} to ${nextStation}`,
          },
        ]);

      if (historyError) throw historyError;

      notifications.show({
        title: "Job Advanced",
        message: `${getDisplayName(selectedJob)} moved to ${nextStation}.`,
        color: "green",
        icon: <IconCheck size={18} />,
      });

      setPage("productionBoard");
    } catch (error) {
      console.error(error);
      notifications.show({
        title: "Job Could Not Be Advanced",
        message: error?.message || "The station update failed.",
        color: "red",
      });
    } finally {
      setMoving(false);
    }
  }

  function printTraveler() {
    window.print();
  }

  if (!selectedJob) {
    return (
      <Stack gap="xl">
        <MWPageHeader
          title="Production Job"
          subtitle="No production job is currently selected."
          setPage={setPage}
        />
        <MWPanel title="Job Not Selected" icon={IconAlertTriangle}>
          <Stack align="flex-start">
            <Text c="dimmed">
              Return to the Production Board and select a job.
            </Text>
            <Button
              color="red"
              leftSection={<IconArrowLeft size={18} />}
              onClick={() => setPage("productionBoard")}
            >
              Back to Production Board
            </Button>
          </Stack>
        </MWPanel>
      </Stack>
    );
  }

  const companyName =
    selectedJob.company_name &&
    selectedJob.company_name !== getPersonName(selectedJob)
      ? selectedJob.company_name
      : "";
  const jobReference =
    selectedJob.job_number ||
    selectedJob.order_number ||
    selectedJob.job_id ||
    "Legacy production job";

  return (
    <Stack gap="xl">
      <MWPageHeader
        title={getDisplayName(selectedJob)}
        subtitle={[
          companyName,
          jobReference,
          selectedJob.current_station || "Station not assigned",
        ]
          .filter(Boolean)
          .join(" • ")}
        buttonText="Production Board"
        onButtonClick={() => setPage("productionBoard")}
        setPage={setPage}
      />

      <MWKpiStrip
        compact
        columns={{ base: 1, sm: 2, xl: 4 }}
        items={[
          {
            label: "Current Station",
            value: selectedJob.current_station || "Not set",
            description: "Current workflow position",
            icon: IconTool,
            color: "red",
          },
          {
            label: "Progress",
            value: `${progressPercent}%`,
            description: `${Math.max(currentIndex, 0)} of ${
              stationOrder.length - 1
            } transitions`,
            icon: IconClock,
            color: "blue",
          },
          {
            label: "Priority",
            value: selectedJob.priority || "Normal",
            description: "Current production priority",
            icon: IconFlag,
            color: getPriorityColor(selectedJob.priority),
          },
          {
            label: "Due Date",
            value: formatDate(selectedJob.due_date),
            description: "Required completion date",
            icon: IconCalendar,
            color: "orange",
          },
        ]}
      />

      <Grid gutter="lg">
        <Grid.Col span={{ base: 12, xl: 8 }}>
          <Stack gap="lg">
          <MWPanel
            title="Workflow Progress"
            subtitle={`${progressPercent}% of the selected workflow completed`}
            icon={IconTool}
          >
            <Progress
              value={progressPercent}
              color={progressPercent >= 100 ? "green" : "red"}
              size="lg"
              radius="xl"
              mb="xl"
            />

            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
              {stationOrder.map((station, index) => {
                const complete = index < currentIndex;
                const current = index === currentIndex;

                return (
                  <Paper
                    key={station}
                    p="md"
                    radius="md"
                    style={{
                      background: current
                        ? "linear-gradient(135deg, rgba(170,0,20,.28), rgba(255,255,255,.025))"
                        : "rgba(255,255,255,.025)",
                      border: `1px solid ${
                        complete
                          ? "rgba(46,204,113,.35)"
                          : current
                            ? "rgba(255,45,65,.65)"
                            : "rgba(255,255,255,.08)"
                      }`,
                    }}
                  >
                    <Group gap="sm" wrap="nowrap">
                      <ThemeIcon
                        color={complete ? "green" : current ? "red" : "gray"}
                        variant={current ? "filled" : "light"}
                        radius="xl"
                      >
                        {complete ? (
                          <IconCheck size={17} />
                        ) : (
                          <Text size="xs" fw={900}>
                            {index + 1}
                          </Text>
                        )}
                      </ThemeIcon>
                      <Box>
                        <Text
                          size="xs"
                          fw={800}
                          c={current ? "red.3" : "dimmed"}
                          tt="uppercase"
                        >
                          {complete
                            ? "Completed"
                            : current
                              ? "Current Station"
                              : "Upcoming"}
                        </Text>
                        <Text fw={800} c="white">
                          {station}
                        </Text>
                      </Box>
                    </Group>
                  </Paper>
                );
              })}
            </SimpleGrid>
          </MWPanel>

          <MWPanel
            title="Job Information"
            subtitle="Customer order and production requirements"
            icon={IconFileDescription}
          >
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
              <InfoField
                label="Person Who Ordered"
                value={getPersonName(selectedJob)}
                icon={IconUser}
              />
              <InfoField
                label="Item Ordered"
                value={getItemName(selectedJob)}
                icon={IconPackage}
              />
              <InfoField
                label="Company"
                value={companyName || "Not provided"}
                icon={IconFileDescription}
              />
              <InfoField
                label="Category"
                value={selectedJob.category || "Not set"}
                icon={IconTool}
              />
              <InfoField
                label="Quantity"
                value={selectedJob.quantity || 1}
                icon={IconPackage}
              />
              <InfoField
                label="Finish"
                value={selectedJob.finish_type || "Not set"}
                icon={IconCheck}
              />
              <InfoField
                label="Paint Colors"
                value={selectedJob.paint_colors || "Not set"}
                icon={IconFlag}
              />
              <InfoField
                label="Assigned To"
                value={selectedJob.assigned_to || "Unassigned"}
                icon={IconUser}
              />
              <InfoField
                label="Job Reference"
                value={jobReference}
                icon={IconFileDescription}
              />
            </SimpleGrid>
          </MWPanel>

          <MWPanel
            title="Production Notes"
            subtitle="Instructions and internal job information"
            icon={IconFileDescription}
          >
            <Paper
              p="lg"
              radius="md"
              style={{
                background: "rgba(255,255,255,.025)",
                border: "1px solid rgba(255,255,255,.08)",
              }}
            >
              <Text style={{ whiteSpace: "pre-wrap" }}>
                {selectedJob.notes || "No notes have been added."}
              </Text>
            </Paper>
          </MWPanel>

          <MWPanel
            title="Job History"
            subtitle="Recorded workflow movement"
            icon={IconHistory}
          >
            {loadingHistory ? (
              <Text c="dimmed">Loading job history...</Text>
            ) : history.length === 0 ? (
              <Alert color="gray" icon={<IconHistory size={18} />}>
                No history has been recorded yet.
              </Alert>
            ) : (
              <Timeline active={history.length} bulletSize={26} lineWidth={2}>
                {history.map((item) => (
                  <Timeline.Item
                    key={item.id}
                    bullet={<IconHistory size={14} />}
                    title={item.notes || "Job updated"}
                  >
                    <Text size="sm" c="dimmed">
                      {item.moved_by ? `${item.moved_by} • ` : ""}
                      {formatDate(item.created_at, true)}
                    </Text>
                  </Timeline.Item>
                ))}
              </Timeline>
            )}
          </MWPanel>
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, xl: 4 }}>
          <Stack gap="lg">
          <MWPanel
            title="Reference Image"
            subtitle="Connected production reference"
            icon={IconPhoto}
          >
            {selectedJob.reference_image ? (
              <Image
                src={selectedJob.reference_image}
                alt={getDisplayName(selectedJob)}
                radius="lg"
                fit="contain"
                mah={440}
              />
            ) : (
              <Paper
                p={50}
                radius="lg"
                style={{
                  background: "rgba(0,0,0,.25)",
                  border: "1px dashed rgba(255,255,255,.15)",
                }}
              >
                <Stack align="center">
                  <IconPhoto size={42} color="#777d86" />
                  <Text c="dimmed">No reference image attached</Text>
                </Stack>
              </Paper>
            )}
          </MWPanel>

          <MWPanel
            title="Job Actions"
            subtitle="Advance or export this traveler"
            icon={IconTool}
          >
            <Stack>
              <Paper
                p="md"
                radius="md"
                style={{
                  background: "rgba(150,0,15,.12)",
                  border: "1px solid rgba(255,40,55,.25)",
                }}
              >
                <Text size="xs" fw={850} c="dimmed" tt="uppercase">
                  Next Station
                </Text>
                <Title order={4} mt={4}>
                  {nextStation || "Workflow Complete"}
                </Title>
              </Paper>

              <Button
                color={nextStation ? "red" : "green"}
                size="md"
                leftSection={
                  nextStation ? (
                    <IconArrowRight size={18} />
                  ) : (
                    <IconCheck size={18} />
                  )
                }
                loading={moving}
                disabled={!nextStation}
                onClick={moveToNextStation}
              >
                {nextStation
                  ? `Move to ${nextStation}`
                  : "Job Completed"}
              </Button>

              <Button
                variant="light"
                color="gray"
                leftSection={<IconPrinter size={18} />}
                onClick={printTraveler}
              >
                Print Job Traveler
              </Button>

              <Button
                variant="subtle"
                color="gray"
                leftSection={<IconArrowLeft size={18} />}
                onClick={() => setPage("productionBoard")}
              >
                Back to Production Board
              </Button>
            </Stack>
          </MWPanel>
          </Stack>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}

export default JobDetails;