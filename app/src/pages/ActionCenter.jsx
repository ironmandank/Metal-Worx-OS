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
  IconCalendarEvent,
  IconCash,
  IconCheck,
  IconClipboardCheck,
  IconFileDollar,
  IconPhone,
  IconRefresh,
  IconSearch,
  IconTool,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import MWKpiStrip from "../components/ui/MWKpiStrip";
import MWPageHeader from "../components/ui/MWPageHeader";
import MWPanel from "../components/ui/MWPanel";
import { getActionCenterData } from "../services/actionCenterService";

const FILTERS = [
  {
    label: "All",
    countKey: "all",
    icon: IconClipboardCheck,
    color: "red",
  },
  {
    label: "Overdue",
    countKey: "overdue",
    icon: IconAlertTriangle,
    color: "red",
  },
  {
    label: "Due Today",
    countKey: "dueToday",
    icon: IconCalendarEvent,
    color: "orange",
  },
  {
    label: "Next Action",
    countKey: "nextAction",
    icon: IconTool,
    color: "blue",
  },
  {
    label: "Quote",
    countKey: "quote",
    icon: IconFileDollar,
    color: "violet",
  },
  {
    label: "Material",
    countKey: "material",
    icon: IconTool,
    color: "yellow",
  },
  {
    label: "Payment",
    countKey: "payment",
    icon: IconCash,
    color: "green",
  },
  {
    label: "Callback",
    countKey: "callback",
    icon: IconPhone,
    color: "cyan",
  },
];

function priorityColor(priority) {
  const value = String(priority || "").toLowerCase();
  if (value.includes("critical") || value.includes("urgent")) return "red";
  if (value.includes("high")) return "orange";
  if (value.includes("medium")) return "yellow";
  return "gray";
}

function getWorkIdentity(item) {
  const person = String(item.customer || "").trim();
  const work = String(item.title || "").trim() || "Action required";

  if (!person) return `Metal Worx — ${work}`;

  const normalizedPerson = person.toLowerCase();
  const normalizedWork = work.toLowerCase();

  if (
    normalizedWork === normalizedPerson ||
    normalizedWork.startsWith(`${normalizedPerson} —`) ||
    normalizedWork.startsWith(`${normalizedPerson} -`)
  ) {
    return work;
  }

  return `${person} — ${work}`;
}

function getSourceLabel(sourceType) {
  if (sourceType === "customerOrder") return "Customer Order";
  if (sourceType === "project") return "Outside Project";
  if (sourceType === "callback") return "Callback";
  if (sourceType === "productionJob") return "Production Job";
  return "Operational Action";
}

function ActionCenter({
  setPage,
  selectedFilter = "All",
  setSelectedProject,
  setSelectedCustomerOrder,
  setSelectedProductionJob,
  openCallback,
}) {
  const [data, setData] = useState({ actions: [], counts: {} });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [activeFilter, setActiveFilter] = useState(selectedFilter || "All");
  const [search, setSearch] = useState("");

  const loadActions = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    else setRefreshing(true);

    setError("");

    try {
      const result = await getActionCenterData();
      setData(result || { actions: [], counts: {} });
    } catch (loadError) {
      console.error("Action Center load error:", loadError);
      setError(loadError?.message || "Action Center failed to load.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadActions(true);
  }, [loadActions]);

  useEffect(() => {
    setActiveFilter(selectedFilter || "All");
  }, [selectedFilter]);

  const filteredActions = useMemo(() => {
    let results = data.actions || [];

    if (activeFilter !== "All") {
      results = results.filter((item) => item.category === activeFilter);
    }

    const term = search.trim().toLowerCase();
    if (!term) return results;

    return results.filter((item) =>
      [
        getWorkIdentity(item),
        item.title,
        item.customer,
        item.company,
        item.reference,
        item.reason,
        item.nextAction,
        item.owner,
        item.category,
        getSourceLabel(item.sourceType),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [activeFilter, data.actions, search]);

  function openAction(item) {
    if (item.sourceType === "project") {
      setSelectedProject?.({ id: item.sourceId });
      setPage("projectDetails");
      return;
    }

    if (item.sourceType === "customerOrder") {
      setSelectedCustomerOrder?.({ id: item.sourceId });
      setPage("customerOrderDetails");
      return;
    }

    if (item.sourceType === "productionJob") {
      setSelectedProductionJob?.({ id: item.sourceId });
      setPage("productionJobDetails");
      return;
    }

    if (item.sourceType === "callback") {
      if (openCallback) {
        openCallback(item.sourceId);
        return;
      }

      setPage("callbacks");
    }
  }

  if (loading) {
    return (
      <Stack gap="xl">
        <MWPageHeader
          title="Action Center"
          subtitle="Loading operational actions."
          setPage={setPage}
        />
        <MWPanel>
          <Group justify="center" py={90}>
            <Loader color="red" />
            <Text c="dimmed">Loading Action Center...</Text>
          </Group>
        </MWPanel>
      </Stack>
    );
  }

  return (
    <Stack gap="xl">
      <MWPageHeader
        title="Action Center"
        subtitle="Overdue work, follow-ups, quotes, materials, payments, and callbacks requiring attention."
        setPage={setPage}
      />

      <MWKpiStrip
        compact
        columns={{ base: 1, sm: 2, xl: 4 }}
        items={[
          {
            label: "Open Actions",
            value: data.counts.all || 0,
            description: "All work requiring attention",
            icon: IconClipboardCheck,
            color: "red",
          },
          {
            label: "Overdue",
            value: data.counts.overdue || 0,
            description: "Past required action date",
            icon: IconAlertTriangle,
            color: "red",
          },
          {
            label: "Due Today",
            value: data.counts.dueToday || 0,
            description: "Requires action today",
            icon: IconCalendarEvent,
            color: "orange",
          },
          {
            label: "Callbacks",
            value: data.counts.callback || 0,
            description: "Customer follow-up required",
            icon: IconPhone,
            color: "cyan",
          },
        ]}
      />

      {error && (
        <Alert
          color="red"
          icon={<IconAlertTriangle size={18} />}
          title="Action Center Failed to Load"
        >
          <Group justify="space-between" wrap="wrap">
            <Text>{error}</Text>
            <Button
              color="red"
              variant="light"
              leftSection={<IconRefresh size={17} />}
              onClick={() => loadActions(false)}
            >
              Retry
            </Button>
          </Group>
        </Alert>
      )}

      <MWPanel
        title="Action Filters"
        subtitle={`${data.counts.all || 0} total open actions`}
        icon={IconSearch}
      >
        <SimpleGrid cols={{ base: 2, sm: 4, xl: 8 }} spacing="sm">
          {FILTERS.map((filter) => {
            const Icon = filter.icon;
            const active = activeFilter === filter.label;

            return (
              <Paper
                key={filter.label}
                component="button"
                type="button"
                onClick={() => setActiveFilter(filter.label)}
                p="sm"
                radius="md"
                style={{
                  cursor: "pointer",
                  color: "inherit",
                  textAlign: "left",
                  background: active
                    ? "linear-gradient(145deg, rgba(145,0,15,.38), rgba(255,255,255,.035))"
                    : "rgba(255,255,255,.025)",
                  border: `1px solid ${
                    active
                      ? "rgba(255,45,65,.65)"
                      : "rgba(255,255,255,.08)"
                  }`,
                }}
              >
                <Group justify="space-between" wrap="nowrap">
                  <ThemeIcon
                    color={active ? "red" : filter.color}
                    variant="light"
                    radius="md"
                  >
                    <Icon size={18} />
                  </ThemeIcon>
                  <Text fw={950} size="xl">
                    {data.counts[filter.countKey] || 0}
                  </Text>
                </Group>
                <Text
                  size="xs"
                  fw={850}
                  c={active ? "red.3" : "gray.4"}
                  mt="xs"
                  tt="uppercase"
                >
                  {filter.label}
                </Text>
              </Paper>
            );
          })}
        </SimpleGrid>

        <TextInput
          mt="md"
          placeholder="Search person, item, company, owner, reason, or next action..."
          leftSection={<IconSearch size={17} />}
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
          rightSection={
            refreshing ? (
              <Loader size={16} />
            ) : (
              <IconRefresh
                size={17}
                style={{ cursor: "pointer" }}
                onClick={() => loadActions(false)}
              />
            )
          }
        />
      </MWPanel>

      <MWPanel
        title={activeFilter}
        subtitle={`${filteredActions.length} action${
          filteredActions.length === 1 ? "" : "s"
        } shown`}
        icon={IconClipboardCheck}
      >
        {!filteredActions.length ? (
          <Alert color="gray" icon={<IconCheck size={18} />}>
            No open actions match the current filter and search.
          </Alert>
        ) : (
          <Stack gap="sm">
            {filteredActions.map((item) => {
              const PriorityIcon =
                item.category === "Callback" ? IconPhone : IconTool;
              const company =
                item.company && item.company !== item.customer
                  ? item.company
                  : "";

              return (
                <Paper
                  key={item.id}
                  p="lg"
                  radius="lg"
                  style={{
                    background:
                      item.category === "Overdue"
                        ? "linear-gradient(145deg, rgba(120,0,10,.2), rgba(255,255,255,.025))"
                        : "rgba(255,255,255,.025)",
                    border: `1px solid ${
                      item.category === "Overdue"
                        ? "rgba(255,55,65,.5)"
                        : "rgba(255,255,255,.08)"
                    }`,
                  }}
                >
                  <Group
                    justify="space-between"
                    align="stretch"
                    wrap="wrap"
                  >
                    <Group
                      align="flex-start"
                      wrap="nowrap"
                      style={{ flex: "1 1 620px", minWidth: 0 }}
                    >
                      <ThemeIcon
                        size={46}
                        radius="lg"
                        color={priorityColor(item.priority)}
                        variant="light"
                        style={{ flexShrink: 0 }}
                      >
                        <PriorityIcon size={23} />
                      </ThemeIcon>

                      <Stack gap="sm" style={{ flex: 1, minWidth: 0 }}>
                        <Group gap="xs" wrap="wrap">
                          <Badge
                            color={priorityColor(item.priority)}
                            variant="filled"
                          >
                            {item.priority || "Normal"}
                          </Badge>
                          <Badge color="gray" variant="light">
                            {item.category || "Action"}
                          </Badge>
                          <Badge color="blue" variant="light">
                            {getSourceLabel(item.sourceType)}
                          </Badge>
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
                            {getWorkIdentity(item)}
                          </Title>
                          <Text size="sm" c="dimmed" mt={4}>
                            {[company, item.reference]
                              .filter(Boolean)
                              .join(" • ") ||
                              getSourceLabel(item.sourceType)}
                          </Text>
                        </Box>

                        <Text>{item.reason || "Operational action required."}</Text>

                        <Paper
                          p="sm"
                          radius="md"
                          style={{
                            background: "rgba(0,0,0,.22)",
                            border: "1px solid rgba(255,255,255,.06)",
                          }}
                        >
                          <Text size="xs" fw={850} c="dimmed" tt="uppercase">
                            Next Action
                          </Text>
                          <Text fw={800} c="white">
                            {item.nextAction || "Review and determine next step"}
                          </Text>
                        </Paper>
                      </Stack>
                    </Group>

                    <Stack
                      justify="space-between"
                      align="flex-end"
                      gap="md"
                      pl="lg"
                      style={{
                        minWidth: 180,
                        borderLeft: "1px solid rgba(255,255,255,.08)",
                      }}
                    >
                      <Box ta="right">
                        <Text size="xs" fw={850} c="dimmed" tt="uppercase">
                          Owner
                        </Text>
                        <Text fw={800}>{item.owner || "Unassigned"}</Text>
                      </Box>

                      <Box ta="right">
                        <Text size="xs" fw={850} c="dimmed" tt="uppercase">
                          Due
                        </Text>
                        <Text
                          fw={800}
                          c={item.category === "Overdue" ? "red.4" : "white"}
                        >
                          {item.dueDate || "Not set"}
                        </Text>
                      </Box>

                      <Button
                        color="red"
                        variant="light"
                        rightSection={<IconArrowRight size={17} />}
                        onClick={() => openAction(item)}
                      >
                        Open
                      </Button>
                    </Stack>
                  </Group>
                </Paper>
              );
            })}
          </Stack>
        )}
      </MWPanel>
    </Stack>
  );
}

export default ActionCenter;