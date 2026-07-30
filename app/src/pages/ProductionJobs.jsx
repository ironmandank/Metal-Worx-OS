import {
  Alert,
  Badge,
  Box,
  Button,
  Group,
  Loader,
  Paper,
  Progress,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconAlertTriangle,
  IconCheck,
  IconClock,
  IconFlame,
  IconPackage,
  IconRefresh,
  IconSearch,
  IconTool,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import MWKpiStrip from "../components/ui/MWKpiStrip";
import MWPageHeader from "../components/ui/MWPageHeader";
import MWPanel from "../components/ui/MWPanel";
import { supabase } from "../lib/supabase";

const ACTIVE_STATUSES = [
  "New",
  "Ready",
  "In Production",
  "On Hold",
];

const STATUS_OPTIONS = [
  { value: "active", label: "Active Jobs" },
  { value: "all", label: "All Jobs" },
  { value: "New", label: "New" },
  { value: "Ready", label: "Ready" },
  { value: "In Production", label: "In Production" },
  { value: "On Hold", label: "On Hold" },
  { value: "Completed", label: "Completed" },
  { value: "Cancelled", label: "Cancelled" },
];

function formatDate(value) {
  if (!value) return "Not set";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getCustomerName(customer) {
  if (!customer) return "No customer assigned";

  const fullName = `${customer.first_name || ""} ${
    customer.last_name || ""
  }`.trim();

  return (
    fullName ||
    customer.contact_name ||
    customer.name ||
    customer.company_name ||
    "Unnamed Customer"
  );
}

function getCustomerCompany(customer) {
  if (!customer?.company_name) return "";

  return customer.company_name === getCustomerName(customer)
    ? ""
    : customer.company_name;
}

function getProductNames(items) {
  const names = (items || [])
    .map(
      (item) =>
        item.product_template?.name ||
        item.item_name ||
        item.description ||
        item.notes
    )
    .filter(Boolean);

  return names.length ? [...new Set(names)].join(", ") : "Unspecified Product";
}

function getProductionDisplayName(job) {
  return `${getCustomerName(job.customer)} — ${getProductNames(job.items)}`;
}

function getStatusColor(status) {
  if (status === "Completed") return "green";
  if (status === "In Production") return "red";
  if (status === "Ready") return "green";
  if (status === "On Hold") return "orange";
  if (status === "Cancelled") return "gray";
  return "gray";
}

function getDepartmentColor(department) {
  if (department === "Design") return "orange";
  if (department === "Laser") return "red";
  if (department === "CNC") return "yellow";
  if (department === "Welding") return "orange";
  if (department === "Prep") return "gray";
  if (department === "Paint" || department === "Powder") return "red";
  if (department === "Assembly") return "green";
  if (department === "QC") return "yellow";
  if (department === "Showroom") return "green";
  return "gray";
}

function ProductionJobs({
  setPage,
  setSelectedProductionJob,
  activeUser = "",
}) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [departmentFilter, setDepartmentFilter] = useState("all");

  const loadJobs = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    else setRefreshing(true);

    try {
      const { data: jobData, error: jobError } = await supabase
        .from("production_jobs")
        .select("*")
        .order("created_at", { ascending: false });

      if (jobError) throw jobError;

      const baseJobs = jobData || [];
      const jobIds = baseJobs.map((job) => job.id);
      const orderIds = [
        ...new Set(baseJobs.map((job) => job.customer_order_id).filter(Boolean)),
      ];
      const [customersResult, ordersResult, itemsResult, workOrdersResult] =
        await Promise.all([
          supabase.from("customers").select("*"),
          orderIds.length
            ? supabase.from("customer_orders").select("*").in("id", orderIds)
            : Promise.resolve({ data: [], error: null }),
          orderIds.length
            ? supabase
                .from("customer_order_items")
                .select("*")
                .in("order_id", orderIds)
            : Promise.resolve({ data: [], error: null }),
          jobIds.length
            ? supabase
                .from("work_orders")
                .select("*")
                .in("production_job_id", jobIds)
                .order("step_order", { ascending: true })
            : Promise.resolve({ data: [], error: null }),
        ]);

      for (const result of [
        customersResult,
        ordersResult,
        itemsResult,
        workOrdersResult,
      ]) {
        if (result.error) throw result.error;
      }

      const items = itemsResult.data || [];
      const templateIds = [
        ...new Set(items.map((item) => item.product_template_id).filter(Boolean)),
      ];

      let templates = [];
      if (templateIds.length) {
        const { data, error } = await supabase
          .from("product_templates")
          .select("*")
          .in("id", templateIds);
        if (error) throw error;
        templates = data || [];
      }

      const customersById = Object.fromEntries(
        (customersResult.data || []).map((customer) => [customer.id, customer])
      );
      const ordersById = Object.fromEntries(
        (ordersResult.data || []).map((order) => [order.id, order])
      );
      const templatesById = Object.fromEntries(
        templates.map((template) => [template.id, template])
      );
      const itemsByOrderId = {};
      const workOrdersByJobId = {};

      for (const item of items) {
        if (!itemsByOrderId[item.order_id]) itemsByOrderId[item.order_id] = [];
        itemsByOrderId[item.order_id].push({
          ...item,
          product_template: templatesById[item.product_template_id] || null,
        });
      }

      for (const workOrder of workOrdersResult.data || []) {
        if (!workOrdersByJobId[workOrder.production_job_id]) {
          workOrdersByJobId[workOrder.production_job_id] = [];
        }
        workOrdersByJobId[workOrder.production_job_id].push(workOrder);
      }

      setJobs(
        baseJobs.map((job) => {
          const customerOrder =
            ordersById[job.customer_order_id] || null;
          const resolvedCustomerId =
            job.customer_id ||
            customerOrder?.customer_id ||
            null;
          const workOrders = workOrdersByJobId[job.id] || [];
          const completedCount = workOrders.filter(
            (workOrder) => workOrder.status === "Completed"
          ).length;
          const readyCount = workOrders.filter((workOrder) =>
            ["Ready", "In Progress"].includes(workOrder.status)
          ).length;
          const calculatedProgress = workOrders.length
            ? Math.round((completedCount / workOrders.length) * 100)
            : Number(job.progress_percent || 0);

          return {
            ...job,
            customer: customersById[resolvedCustomerId] || null,
            customer_order: customerOrder,
            items: itemsByOrderId[job.customer_order_id] || [],
            work_orders: workOrders,
            completed_work_orders: completedCount,
            ready_work_orders: readyCount,
            display_progress: calculatedProgress,
          };
        })
      );
    } catch (error) {
      notifications.show({
        title: "Production Jobs Failed to Load",
        message: error.message,
        color: "red",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadJobs(true);

    const channel = supabase
      .channel("production-jobs-page")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "production_jobs" },
        () => loadJobs(false)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "work_orders" },
        () => loadJobs(false)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadJobs]);

  const departments = useMemo(() => {
    return [
      { value: "all", label: "All Departments" },
      ...[...new Set(jobs.map((job) => job.current_department).filter(Boolean))]
        .sort()
        .map((department) => ({ value: department, label: department })),
    ];
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    return jobs.filter((job) => {
      if (
        statusFilter === "active" &&
        (!job.is_active || !ACTIVE_STATUSES.includes(job.status || "New"))
      ) {
        return false;
      }

      if (
        statusFilter !== "active" &&
        statusFilter !== "all" &&
        job.status !== statusFilter
      ) {
        return false;
      }

      if (
        departmentFilter !== "all" &&
        job.current_department !== departmentFilter
      ) {
        return false;
      }

      if (!searchValue) return true;

      return [
        job.production_job_number,
        job.status,
        job.current_department,
        getCustomerName(job.customer),
        getCustomerCompany(job.customer),
        getProductionDisplayName(job),
        getProductNames(job.items),
        job.customer_order?.order_number,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(searchValue);
    });
  }, [departmentFilter, jobs, search, statusFilter]);

  const activeJobs = jobs.filter(
    (job) => job.is_active && ACTIVE_STATUSES.includes(job.status || "New")
  );
  const quickCount = activeJobs.filter(
    (job) => job.is_quick_turnaround || job.rush
  ).length;
  const onHoldCount = activeJobs.filter((job) => job.status === "On Hold").length;
  const completedToday = jobs.filter((job) => {
    if (job.status !== "Completed") return false;
    const completed = job.work_orders
      .map((workOrder) => workOrder.completed_at)
      .filter(Boolean)
      .sort()
      .at(-1);
    return completed && new Date(completed).toDateString() === new Date().toDateString();
  }).length;

  function openJob(job) {
    setSelectedProductionJob(job);
    setPage("productionJobDetails");
  }

  if (loading) {
    return (
      <Stack gap="xl">
        <MWPageHeader
          title="Production Jobs"
          subtitle="Loading production jobs and work-order progress."
          setPage={setPage}
        />
        <MWPanel>
          <Group justify="center" py={80}>
            <Loader color="red" />
            <Text c="dimmed">Loading production jobs...</Text>
          </Group>
        </MWPanel>
      </Stack>
    );
  }

  return (
    <Stack gap="xl">
      <MWPageHeader
        title="Production Jobs"
        subtitle="Connected customer work, current departments, and live work-order progress."
        buttonText="Production Control"
        onButtonClick={() => setPage("productionControl")}
        setPage={setPage}
      />

      <MWKpiStrip
        compact
        columns={{ base: 1, sm: 2, xl: 4 }}
        items={[
          {
            label: "Active Jobs",
            value: activeJobs.length,
            description: "Currently moving through production",
            icon: IconTool,
            color: "red",
          },
          {
            label: "Priority",
            value: quickCount,
            description: "Rush or Quick Turnaround",
            icon: IconFlame,
            color: "orange",
          },
          {
            label: "On Hold",
            value: onHoldCount,
            description: "Needs management attention",
            icon: IconAlertTriangle,
            color: "yellow",
          },
          {
            label: "Completed Today",
            value: completedToday,
            description: "Finished work today",
            icon: IconCheck,
            color: "green",
          },
        ]}
      />

      <MWPanel
        title="Production Controls"
        subtitle={`Viewing as ${activeUser || "Metal Worx team"}`}
        icon={IconTool}
      >
        <Group wrap="wrap">
          <TextInput
            style={{ flex: 1, minWidth: 280 }}
            placeholder="Search job, order, customer, product, department, or status..."
            leftSection={<IconSearch size={17} />}
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
          />
          <Select
            w={200}
            value={statusFilter}
            onChange={(value) => setStatusFilter(value || "active")}
            data={STATUS_OPTIONS}
            allowDeselect={false}
          />
          <Select
            w={210}
            value={departmentFilter}
            onChange={(value) => setDepartmentFilter(value || "all")}
            data={departments}
            allowDeselect={false}
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

      <MWPanel
        title="Production Queue"
        subtitle={`${filteredJobs.length} job${filteredJobs.length === 1 ? "" : "s"} shown`}
        icon={IconPackage}
      >
        {!filteredJobs.length ? (
          <Alert color="gray" icon={<IconPackage size={19} />}>
            No production jobs match the current filters.
          </Alert>
        ) : (
          <SimpleGrid
            cols={{ base: 1, xl: filteredJobs.length === 1 ? 1 : 2 }}
            spacing="md"
          >
            {filteredJobs.map((job) => {
              const priority = job.is_quick_turnaround || job.rush;
              const inactive = !job.is_active;
              const onHold = job.status === "On Hold";

              return (
                <Paper
                  key={job.id}
                  p="lg"
                  radius="lg"
                  style={{
                    opacity: inactive ? 0.72 : 1,
                    background: priority
                      ? "linear-gradient(145deg, rgba(120,20,0,.2), rgba(255,255,255,.025))"
                      : "rgba(255,255,255,.025)",
                    border: `1px solid ${
                      onHold
                        ? "rgba(255,180,40,.45)"
                        : priority
                          ? "rgba(255,90,50,.45)"
                          : "rgba(255,255,255,.09)"
                    }`,
                  }}
                >
                  <Stack gap="md">
                    <Group justify="space-between" align="flex-start" wrap="nowrap">
                      <Box>
                        <Group gap="xs" mb={7}>
                          <Badge color={getStatusColor(job.status)} variant="light">
                            {job.status || "New"}
                          </Badge>
                          {priority && (
                            <Badge color="red" leftSection={<IconFlame size={12} />}>
                              {job.is_quick_turnaround ? "Quick Turnaround" : "Rush"}
                            </Badge>
                          )}
                          {inactive && <Badge color="gray">Inactive</Badge>}
                        </Group>

                        <Title
                          order={3}
                          c="white"
                          style={{
                            lineHeight: 1.22,
                            overflowWrap: "anywhere",
                          }}
                        >
                          {getProductionDisplayName(job)}
                        </Title>

                        <Group gap="xs" mt={7} wrap="wrap">
                          <Text
                            size="sm"
                            fw={900}
                            c="red.4"
                            style={{ letterSpacing: "0.04em" }}
                          >
                            {job.production_job_number || `PJ-${job.id}`}
                          </Text>

                          {job.customer_order?.order_number && (
                            <>
                              <Text size="sm" c="dimmed">
                                •
                              </Text>
                              <Text size="sm" c="gray.4" fw={750}>
                                {job.customer_order.order_number}
                              </Text>
                            </>
                          )}

                          {getCustomerCompany(job.customer) && (
                            <>
                              <Text size="sm" c="dimmed">
                                •
                              </Text>
                              <Text size="sm" c="gray.5" fw={700}>
                                {getCustomerCompany(job.customer)}
                              </Text>
                            </>
                          )}
                        </Group>
                      </Box>

                      <ThemeIcon
                        size={48}
                        radius="lg"
                        color={onHold ? "yellow" : priority ? "red" : "gray"}
                        variant="light"
                      >
                        {onHold ? (
                          <IconAlertTriangle size={25} />
                        ) : priority ? (
                          <IconFlame size={25} />
                        ) : (
                          <IconTool size={25} />
                        )}
                      </ThemeIcon>
                    </Group>

                    <Paper
                      p="md"
                      radius="md"
                      style={{
                        background: "rgba(0,0,0,.22)",
                        border: "1px solid rgba(255,255,255,.07)",
                      }}
                    >
                      <Group justify="space-between" mb="xs">
                        <Box>
                          <Text size="xs" c="dimmed" fw={800} tt="uppercase">
                            Current Department
                          </Text>
                          <Badge
                            color={getDepartmentColor(job.current_department)}
                            variant="light"
                            mt={4}
                          >
                            {job.current_department || "Not assigned"}
                          </Badge>
                        </Box>
                        <Box ta="right">
                          <Text size="xs" c="dimmed" fw={800} tt="uppercase">
                            Progress
                          </Text>
                          <Text fw={900} size="xl" c="white">
                            {job.display_progress}%
                          </Text>
                        </Box>
                      </Group>
                      <Progress
                        value={job.display_progress}
                        color={job.display_progress >= 100 ? "green" : "red"}
                        size="md"
                        radius="xl"
                      />
                    </Paper>

                    <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
                      <Box>
                        <Text size="xs" c="dimmed" fw={800} tt="uppercase">
                          Work Orders
                        </Text>
                        <Text fw={850}>{job.work_orders.length}</Text>
                      </Box>
                      <Box>
                        <Text size="xs" c="dimmed" fw={800} tt="uppercase">
                          Completed
                        </Text>
                        <Text fw={850} c="green.4">
                          {job.completed_work_orders}
                        </Text>
                      </Box>
                      <Box>
                        <Text size="xs" c="dimmed" fw={800} tt="uppercase">
                          Ready Now
                        </Text>
                        <Text fw={850}>{job.ready_work_orders}</Text>
                      </Box>
                      <Box>
                        <Text size="xs" c="dimmed" fw={800} tt="uppercase">
                          Due
                        </Text>
                        <Text fw={850} size="sm">
                          {formatDate(job.due_date)}
                        </Text>
                      </Box>
                    </SimpleGrid>

                    {!job.work_orders.length && job.is_active && (
                      <Alert color="orange" icon={<IconClock size={18} />}>
                        This job has no work orders and needs management review.
                      </Alert>
                    )}

                    <Stack gap="sm">
                      <Button fullWidth color="red" onClick={() => openJob(job)}>
                        Open Job
                      </Button>
                      <Button
                        fullWidth
                        variant="light"
                        color="gray"
                        onClick={() => setPage("productionControl")}
                      >
                        Production Control
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

export default ProductionJobs;