import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActionIcon,
  Badge,
  Box,
  Center,
  Group,
  Loader,
  Paper,
  Progress,
  Select,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
  Tooltip,
} from "@mantine/core";
import {
  IconAlertTriangle,
  IconArrowsMaximize,
  IconBolt,
  IconCheck,
  IconClock,
  IconFlame,
  IconPackage,
  IconRefresh,
  IconUser,
  IconX,
} from "@tabler/icons-react";

import { supabase } from "../lib/supabase";
import {
  getTodaysHotTodayItems,
  subscribeToHotTodayChanges,
} from "../services/hotTodayService";

const REFRESH_INTERVAL = 30000;
const ROTATION_INTERVAL = 12000;
const ITEMS_PER_SCREEN = 3;

const DEPARTMENTS = [
  "All Departments",
  "Office",
  "Design",
  "Laser",
  "Prep",
  "Welding",
  "Paint",
  "Powder",
  "Assembly",
  "QC",
  "Showroom",
  "Field / Installation",
];

const PRIORITY_RANK = {
  Critical: 0,
  critical: 0,
  Urgent: 1,
  urgent: 1,
  High: 2,
  high: 2,
  Normal: 3,
  normal: 3,
};

function cleanText(value, fallback = "") {
  if (value === null || value === undefined) {
    return fallback;
  }

  const cleaned = String(value).trim();
  return cleaned || fallback;
}

function getPersonItemTitle(person, item) {
  const originalPerson = cleanText(person);
  const cleanPerson = originalPerson
    .replace(/^Internal Metal Worx (Commitment|Priority)$/i, "Metal Worx")
    .trim();
  const cleanItem = cleanText(item, "Work item not specified");

  if (!cleanPerson) {
    return `Metal Worx — ${cleanItem}`;
  }

  const normalizedPerson = cleanPerson.toLowerCase();
  const normalizedItem = cleanItem.toLowerCase();

  if (
    normalizedItem === normalizedPerson ||
    normalizedItem.startsWith(`${normalizedPerson} —`) ||
    normalizedItem.startsWith(`${normalizedPerson} -`)
  ) {
    return cleanItem;
  }

  return `${cleanPerson} — ${cleanItem}`;
}

function getSupportingReference(...values) {
  return [...new Set(values.map((value) => cleanText(value)).filter(Boolean))].join(
    " • "
  );
}

function getHoursRemaining(dueAt) {
  if (!dueAt) {
    return null;
  }

  const dueDate = new Date(dueAt);

  if (Number.isNaN(dueDate.getTime())) {
    return null;
  }

  return (dueDate.getTime() - Date.now()) / 3600000;
}

function formatDueTime(dueAt) {
  if (!dueAt) {
    return "TODAY";
  }

  const dueDate = new Date(dueAt);

  if (Number.isNaN(dueDate.getTime())) {
    return "TODAY";
  }

  return dueDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatHours(hours) {
  if (hours === null || hours === undefined) {
    return "PRIORITY TODAY";
  }

  if (hours < 0) {
    return `${Math.abs(hours).toFixed(1)} HRS OVERDUE`;
  }

  if (hours < 1) {
    return `${Math.max(0, Math.round(hours * 60))} MIN REMAINING`;
  }

  return `${hours.toFixed(1)} HRS REMAINING`;
}

function normalizeMaterialsStatus(value) {
  const normalized = cleanText(value, "Unknown")
    .replaceAll("_", " ")
    .toLowerCase();

  const labels = {
    ready: "Ready",
    partial: "Partially Ready",
    waiting: "Waiting",
    shortage: "Shortage",
    "not required": "Not Required",
    "needs pricing": "Needs Pricing",
    "needs ordering": "Needs Ordering",
    ordered: "Ordered",
    "partially received": "Partially Received",
    blocked: "Blocked",
    unknown: "Not Confirmed",
  };

  return labels[normalized] || cleanText(value, "Not Confirmed");
}

function materialsColor(value) {
  const normalized = cleanText(value).toLowerCase();

  if (
    normalized === "ready" ||
    normalized === "not required" ||
    normalized === "not_required"
  ) {
    return "green";
  }

  if (
    normalized === "blocked" ||
    normalized === "shortage"
  ) {
    return "red";
  }

  if (
    normalized === "waiting" ||
    normalized === "needs ordering" ||
    normalized === "needs_ordering"
  ) {
    return "orange";
  }

  return "yellow";
}

function priorityColor(priority) {
  const normalized = cleanText(priority).toLowerCase();

  if (normalized === "critical") {
    return "red";
  }

  if (normalized === "urgent" || normalized === "high") {
    return "orange";
  }

  return "yellow";
}

function normalizeQuickCommitment(item) {
  return {
    id: `quick-${item.id}`,
    recordId: item.id,
    commitmentType: "quick",
    typeLabel: "QUICK TURNAROUND",
    title: cleanText(item.title, "Quick Turnaround Work"),
    customerName: cleanText(
      item.customer_name,
      "Internal Metal Worx Commitment"
    ),
    sourceLabel: cleanText(item.source_type, "Commitment"),
    sourceNumber: cleanText(item.source_number),
    priority: cleanText(item.priority, "Urgent"),
    department: cleanText(item.department, "Unassigned Department"),
    assignedTo: cleanText(item.assigned_to, "Unassigned"),
    materialsStatus: cleanText(
      item.materials_status,
      "Not Confirmed"
    ),
    blocker:
      item.status === "Blocked" ||
      String(item.materials_status).toLowerCase() === "blocked"
        ? cleanText(
            item.notes || item.description,
            "Work is currently blocked"
          )
        : "",
    reason: cleanText(item.reason),
    notes: cleanText(item.notes || item.description),
    dueAt: item.required_by || null,
    status: cleanText(item.status, "Open"),
  };
}

function normalizeHotToday(item) {
  return {
    id: `hot-${item.id}`,
    recordId: item.id,
    commitmentType: "hot",
    typeLabel: "HOT TODAY",
    title: cleanText(item.title, "Hot Today Priority"),
    customerName: cleanText(
      item.customer_name,
      "Internal Metal Worx Priority"
    ),
    sourceLabel: cleanText(item.source_type, "Work Item")
      .replaceAll("_", " ")
      .toUpperCase(),
    sourceNumber: "",
    priority: cleanText(item.priority, "High"),
    department: cleanText(item.department, "Unassigned Department"),
    assignedTo: cleanText(
      item.assigned_to_name,
      "Unassigned"
    ),
    materialsStatus: cleanText(
      item.materials_status,
      "unknown"
    ),
    blocker: cleanText(item.blocker),
    reason: cleanText(item.reason),
    notes: cleanText(item.notes),
    dueAt: item.due_at || null,
    status: "Active",
  };
}

function ShopTVMode({ setPage }) {
  const initialDepartment = useMemo(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const queryDepartment = searchParams.get("department");
    const savedDepartment = localStorage.getItem(
      "mwShopTvDepartment"
    );

    if (queryDepartment && DEPARTMENTS.includes(queryDepartment)) {
      return queryDepartment;
    }

    if (savedDepartment && DEPARTMENTS.includes(savedDepartment)) {
      return savedDepartment;
    }

    return "All Departments";
  }, []);

  const [department, setDepartment] = useState(initialDepartment);
  const [workItems, setWorkItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(
    Boolean(document.fullscreenElement)
  );

  const loadWork = useCallback(async (showLoader = false) => {
    if (showLoader) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      setError("");

      const [quickResult, hotResult] = await Promise.all([
        supabase
          .from("quick_turnaround_dashboard")
          .select("*")
          .order("attention_rank")
          .order("required_by"),
        getTodaysHotTodayItems(),
      ]);

      if (quickResult.error) {
        throw quickResult.error;
      }

      const activeQuick = (quickResult.data || []).filter(
        (item) =>
          !["Completed", "Cancelled"].includes(item.status)
      );

      const combined = [
        ...activeQuick.map(normalizeQuickCommitment),
        ...(hotResult || []).map(normalizeHotToday),
      ];

      combined.sort((a, b) => {
        const hoursA = getHoursRemaining(a.dueAt);
        const hoursB = getHoursRemaining(b.dueAt);

        const blockedA = Boolean(a.blocker);
        const blockedB = Boolean(b.blocker);

        if (blockedA !== blockedB) {
          return blockedA ? -1 : 1;
        }

        const rankA = PRIORITY_RANK[a.priority] ?? 99;
        const rankB = PRIORITY_RANK[b.priority] ?? 99;

        if (rankA !== rankB) {
          return rankA - rankB;
        }

        if (hoursA !== null && hoursB !== null) {
          return hoursA - hoursB;
        }

        if (hoursA !== null) {
          return -1;
        }

        if (hoursB !== null) {
          return 1;
        }

        return a.title.localeCompare(b.title);
      });

      setWorkItems(combined);
      setLastUpdated(new Date());
    } catch (loadError) {
      setError(
        loadError.message ||
          "Unable to load the shop commitment board."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadWork(true);

    const refreshTimer = window.setInterval(() => {
      loadWork(false);
    }, REFRESH_INTERVAL);

    const unsubscribeHotToday = subscribeToHotTodayChanges(() => {
      loadWork(false);
    });

    return () => {
      window.clearInterval(refreshTimer);
      unsubscribeHotToday();
    };
  }, [loadWork]);

  useEffect(() => {
    const clockTimer = window.setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => window.clearInterval(clockTimer);
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener(
      "fullscreenchange",
      handleFullscreenChange
    );

    return () => {
      document.removeEventListener(
        "fullscreenchange",
        handleFullscreenChange
      );
    };
  }, []);

  const departmentWork = useMemo(() => {
    if (department === "All Departments") {
      return workItems;
    }

    return workItems.filter(
      (item) =>
        item.department.toLowerCase() === department.toLowerCase()
    );
  }, [department, workItems]);

  const totalPages = Math.max(
    1,
    Math.ceil(departmentWork.length / ITEMS_PER_SCREEN)
  );

  const visibleWork = useMemo(() => {
    const safePage = Math.min(currentPage, totalPages - 1);
    const start = safePage * ITEMS_PER_SCREEN;

    return departmentWork.slice(
      start,
      start + ITEMS_PER_SCREEN
    );
  }, [currentPage, departmentWork, totalPages]);

  const visibleColumns = Math.max(
    1,
    Math.min(3, visibleWork.length)
  );

  useEffect(() => {
    setCurrentPage(0);
  }, [department]);

  useEffect(() => {
    if (currentPage >= totalPages) {
      setCurrentPage(0);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (totalPages <= 1) {
      return undefined;
    }

    const rotationTimer = window.setInterval(() => {
      setCurrentPage((page) => (page + 1) % totalPages);
    }, ROTATION_INTERVAL);

    return () => window.clearInterval(rotationTimer);
  }, [totalPages]);

  const hotCount = departmentWork.filter(
    (item) => item.commitmentType === "hot"
  ).length;

  const quickCount = departmentWork.filter(
    (item) => item.commitmentType === "quick"
  ).length;

  const blockedCount = departmentWork.filter(
    (item) => Boolean(item.blocker)
  ).length;

  const overdueCount = departmentWork.filter((item) => {
    const hours = getHoursRemaining(item.dueAt);
    return hours !== null && hours < 0;
  }).length;

  function handleDepartmentChange(value) {
    const nextDepartment = value || "All Departments";

    setDepartment(nextDepartment);
    localStorage.setItem(
      "mwShopTvDepartment",
      nextDepartment
    );

    const url = new URL(window.location.href);

    if (nextDepartment === "All Departments") {
      url.searchParams.delete("department");
    } else {
      url.searchParams.set("department", nextDepartment);
    }

    window.history.replaceState({}, "", url);
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch (fullscreenError) {
      setError(
        fullscreenError.message ||
          "The browser could not enter full-screen mode."
      );
    }
  }

  function leaveTvMode() {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }

    setPage("quickTurnaround");
  }

  if (loading) {
    return (
      <Center
        h="100vh"
        w="100vw"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          background:
            "radial-gradient(circle at top, #260202 0%, #08090b 42%, #030405 100%)",
        }}
      >
        <Stack align="center" gap="lg">
          <ThemeIcon
            size={76}
            radius="xl"
            color="red"
            variant="light"
          >
            <IconBolt size={42} />
          </ThemeIcon>

          <Loader size="lg" color="red" />

          <Text size="xl" c="gray.3" fw={800}>
            Loading Shop Commitments
          </Text>
        </Stack>
      </Center>
    );
  }

  return (
    <Box
      h="100vh"
      w="100vw"
      p={{ base: "sm", lg: "lg" }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background:
          "radial-gradient(circle at top, rgba(75, 0, 0, 0.58) 0%, #0b0d10 34%, #050607 100%)",
        color: "white",
        overflowX: "hidden",
        overflowY: "auto",
      }}
    >
      <Stack gap="md" mih="calc(100vh - 32px)">
        <Paper
          p="md"
          radius="lg"
          style={{
            background:
              "linear-gradient(115deg, rgba(145, 0, 0, 0.96), rgba(45, 3, 3, 0.97) 55%, rgba(12, 14, 17, 0.98))",
            border: "1px solid rgba(255, 70, 70, 0.38)",
            boxShadow: "0 18px 60px rgba(0,0,0,.38)",
          }}
        >
          <Group justify="space-between" align="center" wrap="nowrap">
            <Group gap="lg" wrap="nowrap">
              <img
                src="/metalworx-splash.png"
                alt="Metal Worx"
                style={{
                  width: 96,
                  maxHeight: 58,
                  objectFit: "contain",
                }}
              />

              <Box>
                <Text
                  size="sm"
                  fw={900}
                  c="red.2"
                  tt="uppercase"
                  style={{ letterSpacing: 2.2 }}
                >
                  Metal Worx Operations
                </Text>

                <Title
                  order={1}
                  c="white"
                  style={{
                    fontSize: "clamp(2rem, 3.1vw, 3.6rem)",
                    lineHeight: 1,
                  }}
                >
                  Today’s Commitments
                </Title>

                <Text
                  c="gray.3"
                  fw={700}
                  mt={6}
                  size="lg"
                >
                  {department}
                </Text>
              </Box>
            </Group>

            <Group gap="xl" wrap="nowrap">
              <Box ta="right">
                <Text
                  fw={900}
                  style={{
                    fontSize: "clamp(1.8rem, 2.7vw, 3.1rem)",
                    lineHeight: 1,
                  }}
                >
                  {currentTime.toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </Text>

                <Text c="gray.3" fw={700} mt={5}>
                  {currentTime.toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </Text>
              </Box>

              <Stack gap="xs" w={230}>
                <Select
                  value={department}
                  onChange={handleDepartmentChange}
                  data={DEPARTMENTS}
                  allowDeselect={false}
                  size="md"
                  styles={{
                    input: {
                      background: "rgba(0,0,0,.36)",
                      borderColor: "rgba(255,255,255,.22)",
                      color: "white",
                      fontWeight: 800,
                    },
                  }}
                />

                <Group grow gap="xs">
                  <Tooltip
                    label={
                      isFullscreen
                        ? "Exit full screen"
                        : "Enter full screen"
                    }
                  >
                    <ActionIcon
                      size="lg"
                      color="red"
                      variant="light"
                      onClick={toggleFullscreen}
                    >
                      <IconArrowsMaximize size={20} />
                    </ActionIcon>
                  </Tooltip>

                  <Tooltip label="Refresh board">
                    <ActionIcon
                      size="lg"
                      color="gray"
                      variant="light"
                      onClick={() => loadWork(false)}
                      loading={refreshing}
                    >
                      <IconRefresh size={20} />
                    </ActionIcon>
                  </Tooltip>

                  <Tooltip label="Leave TV mode">
                    <ActionIcon
                      size="lg"
                      color="gray"
                      variant="light"
                      onClick={leaveTvMode}
                    >
                      <IconX size={20} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Stack>
            </Group>
          </Group>
        </Paper>

        <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md">
          {[
            {
              label: "Quick Turnaround",
              value: quickCount,
              icon: IconBolt,
              color: "orange",
            },
            {
              label: "Hot Today",
              value: hotCount,
              icon: IconFlame,
              color: "red",
            },
            {
              label: "Overdue",
              value: overdueCount,
              icon: IconClock,
              color: "red",
            },
            {
              label: "Blocked",
              value: blockedCount,
              icon: IconAlertTriangle,
              color: "yellow",
            },
          ].map((metric) => {
            const MetricIcon = metric.icon;

            return (
              <Paper
                key={metric.label}
                p="md"
                radius="lg"
                style={{
                  background: "rgba(20, 23, 27, 0.94)",
                  border: "1px solid rgba(255,255,255,.1)",
                }}
              >
                <Group justify="space-between" wrap="nowrap">
                  <Box>
                    <Text
                      size="sm"
                      c="gray.5"
                      fw={900}
                      tt="uppercase"
                    >
                      {metric.label}
                    </Text>

                    <Text
                      fw={950}
                      c={`${metric.color}.4`}
                      style={{
                        fontSize: "clamp(2rem, 3vw, 3.6rem)",
                        lineHeight: 1,
                      }}
                    >
                      {metric.value}
                    </Text>
                  </Box>

                  <ThemeIcon
                    size={50}
                    radius="lg"
                    color={metric.color}
                    variant="light"
                  >
                    <MetricIcon size={27} />
                  </ThemeIcon>
                </Group>
              </Paper>
            );
          })}
        </SimpleGrid>

        {error && (
          <Paper
            p="md"
            radius="md"
            style={{
              background: "rgba(250,82,82,.16)",
              border: "1px solid rgba(250,82,82,.45)",
            }}
          >
            <Group>
              <IconAlertTriangle color="var(--mantine-color-red-4)" />
              <Text fw={800}>{error}</Text>
            </Group>
          </Paper>
        )}

        <Box style={{ flex: 1 }}>
          {visibleWork.length === 0 ? (
            <Center mih="48vh">
              <Stack align="center" gap="md">
                <ThemeIcon
                  size={88}
                  radius="xl"
                  color="gray"
                  variant="light"
                >
                  <IconCheck size={48} />
                </ThemeIcon>

                <Title order={2} c="white">
                  No Active Commitments
                </Title>

                <Text size="xl" c="gray.4" ta="center">
                  No Quick Turnaround or Hot Today work is assigned
                  to {department}.
                </Text>
              </Stack>
            </Center>
          ) : (
            <SimpleGrid
              cols={{
                base: 1,
                md: Math.min(2, visibleColumns),
                xl: visibleColumns,
              }}
              spacing="lg"
            >
              {visibleWork.map((item) => {
                const hoursRemaining = getHoursRemaining(item.dueAt);
                const overdue =
                  hoursRemaining !== null && hoursRemaining < 0;
                const dueSoon =
                  hoursRemaining !== null &&
                  hoursRemaining >= 0 &&
                  hoursRemaining <= 2;
                const blocked = Boolean(item.blocker);
                const hot = item.commitmentType === "hot";

                return (
                  <Paper
                    key={item.id}
                    p="lg"
                    radius="lg"
                    style={{
                      minHeight: 330,
                      background: hot
                        ? "linear-gradient(145deg, rgba(100, 0, 0, .4), rgba(20, 21, 24, .97) 62%)"
                        : "linear-gradient(145deg, rgba(120, 55, 0, .24), rgba(20, 21, 24, .97) 62%)",
                      border: `2px solid ${
                        blocked || overdue
                          ? "rgba(250,82,82,.75)"
                          : hot
                            ? "rgba(255,60,60,.42)"
                            : "rgba(255,146,43,.4)"
                      }`,
                      boxShadow:
                        blocked || overdue
                          ? "0 0 30px rgba(250,82,82,.16)"
                          : "0 16px 45px rgba(0,0,0,.28)",
                    }}
                  >
                    <Stack gap="md" h="100%">
                      <Group
                        justify="space-between"
                        align="flex-start"
                        wrap="nowrap"
                      >
                        <Stack
                          gap={7}
                          style={{ minWidth: 0, flex: 1 }}
                        >
                          <Group gap="xs">
                            <Badge
                              size="lg"
                              color={hot ? "red" : "orange"}
                              variant="filled"
                            >
                              {item.typeLabel}
                            </Badge>

                            <Badge
                              size="lg"
                              color={priorityColor(item.priority)}
                              variant="light"
                            >
                              {item.priority}
                            </Badge>
                          </Group>

                          <Title
                            order={2}
                            c="white"
                            style={{
                              fontSize:
                                "clamp(1.35rem, 2vw, 2.25rem)",
                              lineHeight: 1.12,
                              overflowWrap: "anywhere",
                              maxWidth: "100%",
                            }}
                          >
                            {getPersonItemTitle(
                              item.customerName,
                              item.title
                            )}
                          </Title>

                          <Text
                            c="gray.4"
                            fw={700}
                            size="lg"
                            style={{ overflowWrap: "anywhere" }}
                          >
                            {getSupportingReference(
                              item.sourceNumber,
                              item.sourceLabel,
                              item.department,
                              item.assignedTo
                            ) || "Metal Worx priority"}
                          </Text>
                        </Stack>

                        <ThemeIcon
                          size={54}
                          radius="lg"
                          color={hot ? "red" : "orange"}
                          variant="light"
                        >
                          {hot ? (
                            <IconFlame size={30} />
                          ) : (
                            <IconBolt size={30} />
                          )}
                        </ThemeIcon>
                      </Group>

                      <Paper
                        p="md"
                        radius="md"
                        style={{
                          background:
                            overdue || dueSoon
                              ? "rgba(250,82,82,.12)"
                              : "rgba(255,255,255,.045)",
                          border: `1px solid ${
                            overdue || dueSoon
                              ? "rgba(250,82,82,.35)"
                              : "rgba(255,255,255,.08)"
                          }`,
                        }}
                      >
                        <Group justify="space-between" wrap="nowrap">
                          <Group gap="sm" wrap="nowrap">
                            <IconClock size={23} />

                            <Box>
                              <Text
                                size="xs"
                                c="gray.5"
                                fw={900}
                                tt="uppercase"
                              >
                                Due Time
                              </Text>

                              <Text size="xl" fw={950}>
                                {formatDueTime(item.dueAt)}
                              </Text>
                            </Box>
                          </Group>

                          <Text
                            fw={950}
                            ta="right"
                            c={
                              overdue
                                ? "red.4"
                                : dueSoon
                                  ? "orange.4"
                                  : "gray.1"
                            }
                          >
                            {formatHours(hoursRemaining)}
                          </Text>
                        </Group>
                      </Paper>

                      <SimpleGrid cols={3} spacing="sm">
                        <Box>
                          <Text
                            size="xs"
                            c="gray.5"
                            fw={900}
                            tt="uppercase"
                          >
                            Assignment
                          </Text>

                          <Group gap={6} wrap="nowrap">
                            <IconUser size={17} />
                            <Text fw={850} lineClamp={1}>
                              {item.assignedTo}
                            </Text>
                          </Group>
                        </Box>

                        <Box>
                          <Text
                            size="xs"
                            c="gray.5"
                            fw={900}
                            tt="uppercase"
                          >
                            Department
                          </Text>

                          <Text fw={850} lineClamp={1}>
                            {item.department}
                          </Text>
                        </Box>

                        <Box>
                          <Text
                            size="xs"
                            c="gray.5"
                            fw={900}
                            tt="uppercase"
                          >
                            Materials
                          </Text>

                          <Badge
                            color={materialsColor(
                              item.materialsStatus
                            )}
                            variant="light"
                          >
                            {normalizeMaterialsStatus(
                              item.materialsStatus
                            )}
                          </Badge>
                        </Box>
                      </SimpleGrid>

                      {blocked ? (
                        <Paper
                          p="sm"
                          radius="md"
                          mt="auto"
                          style={{
                            background: "rgba(250,82,82,.14)",
                            border:
                              "1px solid rgba(250,82,82,.42)",
                          }}
                        >
                          <Group gap="sm" wrap="nowrap">
                            <IconAlertTriangle
                              size={23}
                              color="var(--mantine-color-red-4)"
                            />

                            <Box>
                              <Text
                                size="xs"
                                c="red.3"
                                fw={900}
                                tt="uppercase"
                              >
                                Blocker
                              </Text>

                              <Text fw={850} c="red.1">
                                {item.blocker}
                              </Text>
                            </Box>
                          </Group>
                        </Paper>
                      ) : (
                        <Group gap="sm" mt="auto" wrap="nowrap">
                          <IconPackage
                            size={20}
                            color="var(--mantine-color-green-5)"
                          />

                          <Text c="gray.3" fw={750} lineClamp={2}>
                            {item.reason ||
                              item.notes ||
                              "Ready for production attention"}
                          </Text>
                        </Group>
                      )}
                    </Stack>
                  </Paper>
                );
              })}
            </SimpleGrid>
          )}
        </Box>

        <Paper
          px="lg"
          py="sm"
          radius="md"
          style={{
            background: "rgba(12,14,17,.92)",
            border: "1px solid rgba(255,255,255,.08)",
          }}
        >
          <Group justify="space-between" wrap="nowrap">
            <Group gap="lg">
              <Text c="gray.4" fw={700}>
                Showing {visibleWork.length} of {departmentWork.length}
              </Text>

              {totalPages > 1 && (
                <Text c="gray.4" fw={700}>
                  Screen {currentPage + 1} of {totalPages}
                </Text>
              )}
            </Group>

            {totalPages > 1 && (
              <Progress
                value={((currentPage + 1) / totalPages) * 100}
                color="red"
                size="sm"
                radius="xl"
                w="35%"
              />
            )}

            <Text c="gray.5" size="sm">
              Updated{" "}
              {lastUpdated
                ? lastUpdated.toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                    second: "2-digit",
                  })
                : "—"}
            </Text>
          </Group>
        </Paper>
      </Stack>
    </Box>
  );
}

export default ShopTVMode;