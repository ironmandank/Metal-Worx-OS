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
import { notifications } from "@mantine/notifications";
import {
  IconAlertTriangle,
  IconCheck,
  IconClock,
  IconFileInvoice,
  IconFlame,
  IconPackage,
  IconRefresh,
  IconSearch,
  IconSettingsAutomation,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import MWKpiStrip from "../components/ui/MWKpiStrip";
import MWPageHeader from "../components/ui/MWPageHeader";
import MWPanel from "../components/ui/MWPanel";
import { buildProductionJob } from "../lib/buildProductionJob";
import { supabase } from "../lib/supabase";

const ACTIVE_STATUSES = [
  "New",
  "Design Needed",
  "In Design",
  "Ready for Production",
  "Ready",
  "In Production",
  "Production Complete",
  "Ready for Pickup",
  "Ready to Ship",
  "Ready for Installation",
  "On Hold",
];

const OFFICE_CLOSEOUT_STATUSES = [
  "Production Complete",
  "Ready for Pickup",
  "Ready to Ship",
  "Ready for Installation",
];

const STATUS_OPTIONS = [
  { value: "active", label: "Active Orders" },
  { value: "officeCloseout", label: "Office Closeout" },
  { value: "all", label: "All Orders" },
  { value: "New", label: "New" },
  { value: "Design Needed", label: "Design Needed" },
  { value: "In Design", label: "In Design" },
  { value: "Ready for Production", label: "Ready for Production" },
  { value: "In Production", label: "In Production" },
  { value: "Production Complete", label: "Production Complete" },
  { value: "Ready for Pickup", label: "Ready for Pickup" },
  { value: "Ready to Ship", label: "Ready to Ship" },
  { value: "Ready for Installation", label: "Ready for Installation" },
  { value: "On Hold", label: "On Hold" },
  { value: "Completed", label: "Completed" },
  { value: "Cancelled", label: "Cancelled" },
];

function formatMoney(value) {
  const amount = Number(value || 0);
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

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

function getOrderingPersonName(customer) {
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

  const personName = getOrderingPersonName(customer);
  return customer.company_name === personName ? "" : customer.company_name;
}

function getOrderItemNames(order) {
  const names = (order.items || [])
    .map(
      (item) =>
        item.product_template?.name ||
        item.item_name ||
        item.description ||
        item.notes,
    )
    .filter(Boolean);

  if (names.length) return [...new Set(names)].join(", ");
  if (order.design_needed) return "Custom Artwork / Design Needed";
  return order.order_type || "Customer Order";
}

function getOrderDisplayName(order) {
  return `${getOrderingPersonName(order.customer)} — ${getOrderItemNames(order)}`;
}

function getStatusColor(status) {
  if (status === "Completed") return "green";
  if (status === "Ready for Pickup") return "cyan";
  if (status === "Ready to Ship") return "blue";
  if (status === "Ready for Installation") return "violet";
  if (status === "Production Complete") return "teal";
  if (status === "In Production") return "red";
  if (status === "Ready for Production" || status === "Ready") return "green";
  if (status === "Design Needed" || status === "In Design") return "orange";
  if (status === "On Hold") return "yellow";
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
  if (department === "Showroom") return "green";
  return "gray";
}

function CustomerOrders({
  setPage,
  setSelectedCustomerOrder,
  setSelectedProductionJob,
  activeUser = "",
}) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [buildingOrderId, setBuildingOrderId] = useState(null);

  const loadOrders = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    else setRefreshing(true);

    try {
      const { data: orderData, error: orderError } = await supabase
        .from("customer_orders")
        .select("*")
        .order("created_at", { ascending: false });

      if (orderError) throw orderError;

      const baseOrders = orderData || [];
      const orderIds = baseOrders.map((order) => order.id);
      const customerIds = [
        ...new Set(
          baseOrders.map((order) => order.customer_id).filter(Boolean),
        ),
      ];

      const [customersResult, itemsResult, jobsResult] = await Promise.all([
        customerIds.length
          ? supabase.from("customers").select("*").in("id", customerIds)
          : Promise.resolve({ data: [], error: null }),
        orderIds.length
          ? supabase
              .from("customer_order_items")
              .select("*")
              .in("order_id", orderIds)
          : Promise.resolve({ data: [], error: null }),
        orderIds.length
          ? supabase
              .from("production_jobs")
              .select("*")
              .in("customer_order_id", orderIds)
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (customersResult.error) throw customersResult.error;
      if (itemsResult.error) throw itemsResult.error;
      if (jobsResult.error) throw jobsResult.error;

      const items = itemsResult.data || [];
      const templateIds = [
        ...new Set(
          items.map((item) => item.product_template_id).filter(Boolean),
        ),
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
        (customersResult.data || []).map((customer) => [customer.id, customer]),
      );
      const templatesById = Object.fromEntries(
        templates.map((template) => [template.id, template]),
      );
      const jobsByOrderId = {};
      for (const job of jobsResult.data || []) {
        if (!jobsByOrderId[job.customer_order_id]) {
          jobsByOrderId[job.customer_order_id] = job;
        }
      }
      const itemsByOrderId = {};

      for (const item of items) {
        if (!itemsByOrderId[item.order_id]) itemsByOrderId[item.order_id] = [];
        itemsByOrderId[item.order_id].push({
          ...item,
          product_template: templatesById[item.product_template_id] || null,
        });
      }

      setOrders(
        baseOrders.map((order) => ({
          ...order,
          customer: customersById[order.customer_id] || null,
          items: itemsByOrderId[order.id] || [],
          production_job: jobsByOrderId[order.id] || null,
        })),
      );
    } catch (error) {
      notifications.show({
        title: "Orders Failed to Load",
        message: error.message,
        color: "red",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadOrders(true);

    const channel = supabase
      .channel("customer-orders-page")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "customer_orders" },
        () => loadOrders(false),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "production_jobs" },
        () => loadOrders(false),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadOrders]);

  const filteredOrders = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    return orders.filter((order) => {
      if (
        statusFilter === "active" &&
        !ACTIVE_STATUSES.includes(order.status || "New")
      ) {
        return false;
      }

      if (
        statusFilter === "officeCloseout" &&
        !OFFICE_CLOSEOUT_STATUSES.includes(order.status)
      ) {
        return false;
      }

      if (
        statusFilter !== "active" &&
        statusFilter !== "officeCloseout" &&
        statusFilter !== "all" &&
        order.status !== statusFilter
      ) {
        return false;
      }

      if (!searchValue) return true;

      return [
        order.order_number,
        order.status,
        order.order_type,
        order.design_status,
        order.starting_department,
        getOrderingPersonName(order.customer),
        getCustomerCompany(order.customer),
        getOrderDisplayName(order),
        getOrderItemNames(order),
        order.production_job?.production_job_number,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(searchValue);
    });
  }, [orders, search, statusFilter]);

  const activeOrders = orders.filter((order) =>
    ACTIVE_STATUSES.includes(order.status || "New"),
  );
  const designCount = activeOrders.filter(
    (order) => order.design_needed && !order.production_job,
  ).length;
  const readyCount = activeOrders.filter(
    (order) =>
      !order.production_job &&
      order.items.length > 0 &&
      (!order.design_needed || order.design_status === "Ready for Laser"),
  ).length;
  const productionCount = activeOrders.filter(
    (order) => order.status === "In Production",
  ).length;

  function openOrder(order) {
    setSelectedCustomerOrder(order);
    setPage("customerOrderDetails");
  }

  function openProductionJob(job) {
    if (setSelectedProductionJob) setSelectedProductionJob(job);
    setPage(
      setSelectedProductionJob ? "productionJobDetails" : "productionJobs",
    );
  }

  function canBuild(order) {
    if (order.production_job) return false;
    if (!order.items.length) return false;
    if (!order.design_needed) return true;
    return order.design_status === "Ready for Laser";
  }

  async function handleBuild(order) {
    if (!order.items.length) {
      notifications.show({
        title: "Order Has No Items",
        message: "Add at least one line item before building production.",
        color: "orange",
      });
      return;
    }

    if (!canBuild(order)) {
      notifications.show({
        title: "Design Not Ready",
        message: "Complete the Design workflow before building production.",
        color: "orange",
      });
      return;
    }

    try {
      setBuildingOrderId(order.id);
      const productionJob = await buildProductionJob(order, activeUser);

      notifications.show({
        title: "Production Job Ready",
        message: `${productionJob.production_job_number} was created with its work orders.`,
        color: "green",
        icon: <IconCheck size={18} />,
      });

      await loadOrders(false);
      openProductionJob(productionJob);
    } catch (error) {
      notifications.show({
        title: "Production Build Failed",
        message: error.message,
        color: "red",
      });
    } finally {
      setBuildingOrderId(null);
    }
  }

  if (loading) {
    return (
      <Stack gap="xl">
        <MWPageHeader
          title="Customer Orders"
          subtitle="Loading customer orders and production connections."
          setPage={setPage}
        />
        <MWPanel>
          <Group justify="center" py={80}>
            <Loader color="red" />
            <Text c="dimmed">Loading customer orders...</Text>
          </Group>
        </MWPanel>
      </Stack>
    );
  }

  return (
    <Stack gap="xl">
      <MWPageHeader
        title="Customer Orders"
        subtitle="Move approved customer work into production with one controlled build."
        buttonText="+ New Order"
        onButtonClick={() => setPage("orderBuilder")}
        setPage={setPage}
      />

      <MWKpiStrip
        compact
        columns={{ base: 1, sm: 2, xl: 4 }}
        items={[
          {
            label: "Active Orders",
            value: activeOrders.length,
            description: "Open customer commitments",
            icon: IconFileInvoice,
            color: "red",
          },
          {
            label: "Design Queue",
            value: designCount,
            description: "Design work required",
            icon: IconSettingsAutomation,
            color: "orange",
          },
          {
            label: "Ready to Build",
            value: readyCount,
            description: "Can enter production now",
            icon: IconCheck,
            color: "green",
          },
          {
            label: "In Production",
            value: productionCount,
            description: "Connected production jobs",
            icon: IconPackage,
            color: "gray",
          },
        ]}
      />

      <MWPanel
        title="Order Controls"
        subtitle="Search, filter, refresh, or open the design queue"
        icon={IconSearch}
      >
        <Group justify="space-between" wrap="wrap">
          <Group wrap="wrap" style={{ flex: 1 }}>
            <TextInput
              style={{ flex: 1, minWidth: 260 }}
              placeholder="Search order, customer, item, job, department, or status..."
              leftSection={<IconSearch size={17} />}
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
            />
            <Select
              w={210}
              value={statusFilter}
              onChange={(value) => setStatusFilter(value || "active")}
              data={STATUS_OPTIONS}
              allowDeselect={false}
            />
            <Button
              variant="light"
              color="gray"
              leftSection={
                refreshing ? <Loader size={16} /> : <IconRefresh size={17} />
              }
              disabled={refreshing}
              onClick={() => loadOrders(false)}
            >
              Refresh
            </Button>
          </Group>
          <Button
            variant="light"
            color="orange"
            onClick={() => setPage("designQueue")}
          >
            Design Queue
          </Button>
        </Group>
      </MWPanel>

      <MWPanel
        title="Order Queue"
        subtitle={`${filteredOrders.length} order${filteredOrders.length === 1 ? "" : "s"} shown`}
        icon={IconFileInvoice}
      >
        {!filteredOrders.length ? (
          <Alert color="gray" icon={<IconFileInvoice size={19} />}>
            No customer orders match the current filters.
          </Alert>
        ) : (
          <SimpleGrid
            cols={{ base: 1, xl: filteredOrders.length === 1 ? 1 : 2 }}
            spacing="md"
          >
            {filteredOrders.map((order) => {
              const built = Boolean(order.production_job);
              const buildReady = canBuild(order);
              const quick = order.is_quick_turnaround || order.rush;

              return (
                <Paper
                  key={order.id}
                  p="lg"
                  radius="lg"
                  style={{
                    background: quick
                      ? "linear-gradient(145deg, rgba(120,20,0,.2), rgba(255,255,255,.025))"
                      : "rgba(255,255,255,.025)",
                    border: `1px solid ${
                      quick
                        ? "rgba(255,100,40,.45)"
                        : built
                          ? "rgba(60,190,110,.28)"
                          : "rgba(255,255,255,.09)"
                    }`,
                  }}
                >
                  <Stack gap="md">
                    <Group
                      justify="space-between"
                      align="flex-start"
                      wrap="nowrap"
                    >
                      <Box>
                        <Group gap="xs" mb={7}>
                          <Badge
                            color={getStatusColor(order.status)}
                            variant="light"
                          >
                            {order.status || "New"}
                          </Badge>
                          {quick && (
                            <Badge
                              color="red"
                              leftSection={<IconFlame size={12} />}
                            >
                              {order.is_quick_turnaround
                                ? "Quick Turnaround"
                                : "Rush"}
                            </Badge>
                          )}
                          {built && (
                            <Badge color="green">Production Connected</Badge>
                          )}
                        </Group>

                        <Title
                          order={3}
                          c="white"
                          style={{
                            lineHeight: 1.22,
                            overflowWrap: "anywhere",
                          }}
                        >
                          {getOrderDisplayName(order)}
                        </Title>

                        <Group gap="xs" mt={7} wrap="wrap">
                          <Text
                            size="sm"
                            fw={900}
                            c="red.4"
                            style={{ letterSpacing: "0.04em" }}
                          >
                            {order.order_number || `Order #${order.id}`}
                          </Text>

                          {getCustomerCompany(order.customer) && (
                            <>
                              <Text size="sm" c="dimmed">
                                •
                              </Text>
                              <Text size="sm" c="gray.4" fw={700}>
                                {getCustomerCompany(order.customer)}
                              </Text>
                            </>
                          )}
                        </Group>
                      </Box>

                      <ThemeIcon
                        size={48}
                        radius="lg"
                        color={quick ? "red" : built ? "green" : "gray"}
                        variant="light"
                      >
                        {quick ? (
                          <IconFlame size={25} />
                        ) : built ? (
                          <IconCheck size={25} />
                        ) : (
                          <IconFileInvoice size={25} />
                        )}
                      </ThemeIcon>
                    </Group>

                    <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
                      <Box>
                        <Text size="xs" c="dimmed" fw={800} tt="uppercase">
                          Items
                        </Text>
                        <Text fw={850}>{order.items.length}</Text>
                      </Box>
                      <Box>
                        <Text size="xs" c="dimmed" fw={800} tt="uppercase">
                          Start
                        </Text>
                        <Badge
                          color={getDepartmentColor(order.starting_department)}
                          variant="light"
                        >
                          {order.starting_department || "Not set"}
                        </Badge>
                      </Box>
                      <Box>
                        <Text size="xs" c="dimmed" fw={800} tt="uppercase">
                          Due
                        </Text>
                        <Text fw={850} size="sm">
                          {formatDate(order.due_date)}
                        </Text>
                      </Box>
                      <Box>
                        <Text size="xs" c="dimmed" fw={800} tt="uppercase">
                          Total
                        </Text>
                        <Text fw={850}>{formatMoney(order.total_amount)}</Text>
                      </Box>
                    </SimpleGrid>

                    {order.design_needed && !built && (
                      <Alert
                        color={
                          order.design_status === "Ready for Laser"
                            ? "green"
                            : "orange"
                        }
                        icon={
                          order.design_status === "Ready for Laser" ? (
                            <IconCheck size={18} />
                          ) : (
                            <IconClock size={18} />
                          )
                        }
                      >
                        Design: {order.design_status || "Design Needed"}
                      </Alert>
                    )}

                    {!order.items.length && !built && (
                      <Alert
                        color="orange"
                        icon={<IconAlertTriangle size={18} />}
                      >
                        Add at least one order item before building production.
                      </Alert>
                    )}

                    {built && (
                      <Paper
                        p="sm"
                        radius="md"
                        style={{
                          background: "rgba(35,150,80,.08)",
                          border: "1px solid rgba(60,190,110,.2)",
                        }}
                      >
                        <Group justify="space-between">
                          <Box>
                            <Text size="xs" c="dimmed" fw={800} tt="uppercase">
                              Production Job
                            </Text>
                            <Text fw={900} c="green.4">
                              {order.production_job.production_job_number}
                            </Text>
                          </Box>
                          <Badge color="green" variant="light">
                            {order.production_job.progress_percent || 0}%
                          </Badge>
                        </Group>
                      </Paper>
                    )}

                    <Group grow>
                      <Button
                        variant="light"
                        color="gray"
                        onClick={() => openOrder(order)}
                      >
                        Review Order
                      </Button>

                      {built ? (
                        <Button
                          color="green"
                          variant="light"
                          onClick={() =>
                            openProductionJob(order.production_job)
                          }
                        >
                          Open Production Job
                        </Button>
                      ) : buildReady ? (
                        <Button
                          color="red"
                          loading={buildingOrderId === order.id}
                          leftSection={<IconSettingsAutomation size={18} />}
                          onClick={() => handleBuild(order)}
                        >
                          Build Production
                        </Button>
                      ) : (
                        <Button
                          color="orange"
                          variant="light"
                          onClick={() =>
                            order.items.length
                              ? setPage("designQueue")
                              : openOrder(order)
                          }
                        >
                          {order.items.length ? "Complete Design" : "Add Items"}
                        </Button>
                      )}
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

export default CustomerOrders;
