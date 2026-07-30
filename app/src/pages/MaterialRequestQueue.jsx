import {
  Alert,
  Badge,
  Box,
  Button,
  Center,
  Divider,
  Group,
  Loader,
  Modal,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  ThemeIcon,
  Timeline,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconAlertTriangle,
  IconCheck,
  IconClock,
  IconEye,
  IconFlame,
  IconPackage,
  IconRefresh,
  IconShoppingCart,
  IconX,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import MWKpiStrip from "../components/ui/MWKpiStrip";
import MWPageHeader from "../components/ui/MWPageHeader";
import MWPanel from "../components/ui/MWPanel";
import {
  MATERIAL_REQUEST_STATUSES,
  getMaterialRequestById,
  getMaterialRequestDashboard,
  getMaterialRequestPriorityColor,
  getMaterialRequestSourceLabel,
  getMaterialRequestStatusColor,
  subscribeToMaterialRequestChanges,
  updateMaterialRequestStatus,
} from "../services/materialRequestCartService";

const STATUS_OPTIONS = [
  {
    value: "active",
    label: "Active Requests",
  },
  {
    value: "all",
    label: "All Requests",
  },
  {
    value: MATERIAL_REQUEST_STATUSES.SUBMITTED,
    label: "Submitted",
  },
  {
    value: MATERIAL_REQUEST_STATUSES.BLOCKED,
    label: "Blocked",
  },
  {
    value: MATERIAL_REQUEST_STATUSES.APPROVED,
    label: "Approved",
  },
  {
    value: MATERIAL_REQUEST_STATUSES.PARTIALLY_FULFILLED,
    label: "Partially Fulfilled",
  },
  {
    value: MATERIAL_REQUEST_STATUSES.FULFILLED,
    label: "Fulfilled",
  },
  {
    value: MATERIAL_REQUEST_STATUSES.CANCELLED,
    label: "Cancelled",
  },
];

const SOURCE_OPTIONS = [
  {
    value: "all",
    label: "All Request Types",
  },
  {
    value: "shop_supply",
    label: "Shop Supply / Restock",
  },
  {
    value: "project",
    label: "Projects",
  },
  {
    value: "customer_order",
    label: "Customer Orders",
  },
  {
    value: "production_job",
    label: "Production Jobs",
  },
];

const PRIORITY_OPTIONS = [
  {
    value: "all",
    label: "All Priorities",
  },
  {
    value: "critical",
    label: "Critical",
  },
  {
    value: "high",
    label: "High",
  },
  {
    value: "normal",
    label: "Normal",
  },
];

const ACTIVE_STATUSES = [
  MATERIAL_REQUEST_STATUSES.SUBMITTED,
  MATERIAL_REQUEST_STATUSES.BLOCKED,
  MATERIAL_REQUEST_STATUSES.APPROVED,
  MATERIAL_REQUEST_STATUSES.PARTIALLY_FULFILLED,
];

function formatDateTime(value) {
  if (!value) {
    return "No deadline";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "No deadline";
  }

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatStatus(value) {
  return String(value || "submitted")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function MaterialRequestQueue({ setPage, activeUser = "" }) {
  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [requests, setRequests] = useState([]);

  const [statusFilter, setStatusFilter] = useState("active");

  const [sourceFilter, setSourceFilter] = useState("all");

  const [priorityFilter, setPriorityFilter] = useState("all");

  const [selectedRequestId, setSelectedRequestId] = useState(null);

  const [selectedRequest, setSelectedRequest] = useState(null);

  const [selectedItems, setSelectedItems] = useState([]);

  const [selectedHistory, setSelectedHistory] = useState([]);

  const [loadingDetails, setLoadingDetails] = useState(false);

  const [updatingStatus, setUpdatingStatus] = useState(false);

  const loadRequests = useCallback(async (showLoader = false) => {
    if (showLoader) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const data = await getMaterialRequestDashboard();

      setRequests(data || []);
    } catch (error) {
      notifications.show({
        title: "Material Requests Failed to Load",
        message: error.message,
        color: "red",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadRequests(true);

    const unsubscribe = subscribeToMaterialRequestChanges(() => {
      loadRequests(false);
    });

    const timer = window.setInterval(() => {
      loadRequests(false);
    }, 30000);

    return () => {
      unsubscribe();
      window.clearInterval(timer);
    };
  }, [loadRequests]);

  const filteredRequests = useMemo(() => {
    return requests.filter((request) => {
      if (
        statusFilter === "active" &&
        !ACTIVE_STATUSES.includes(request.status)
      ) {
        return false;
      }

      if (
        statusFilter !== "active" &&
        statusFilter !== "all" &&
        request.status !== statusFilter
      ) {
        return false;
      }

      if (sourceFilter !== "all" && request.source_type !== sourceFilter) {
        return false;
      }

      if (priorityFilter !== "all" && request.priority !== priorityFilter) {
        return false;
      }

      return true;
    });
  }, [priorityFilter, requests, sourceFilter, statusFilter]);

  const activeRequests = requests.filter((request) =>
    ACTIVE_STATUSES.includes(request.status),
  );

  const blockedCount = activeRequests.filter(
    (request) =>
      request.status === MATERIAL_REQUEST_STATUSES.BLOCKED ||
      request.blocked_work ||
      request.has_current_shortage,
  ).length;

  const priorityCount = activeRequests.filter(
    (request) =>
      request.is_priority_work ||
      request.priority === "critical" ||
      request.priority === "high",
  ).length;

  const shopSupplyCount = activeRequests.filter(
    (request) => request.source_type === "shop_supply",
  ).length;

  const selectedHasShortage = selectedItems.some(
    (item) => numberValue(item.current_shortage_quantity) > 0,
  );

  async function openRequest(requestId) {
    try {
      setSelectedRequestId(requestId);

      setLoadingDetails(true);

      const result = await getMaterialRequestById(requestId);

      setSelectedRequest(result.request);

      setSelectedItems(result.items);

      setSelectedHistory(result.history);
    } catch (error) {
      notifications.show({
        title: "Request Details Failed to Load",
        message: error.message,
        color: "red",
      });

      closeDetails();
    } finally {
      setLoadingDetails(false);
    }
  }

  function closeDetails() {
    setSelectedRequestId(null);
    setSelectedRequest(null);
    setSelectedItems([]);
    setSelectedHistory([]);
  }

  async function changeStatus(status) {
    if (!selectedRequest?.id || updatingStatus) {
      return;
    }

    const confirmed = window.confirm(
      `Change ${selectedRequest.request_number} to ${formatStatus(status)}?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setUpdatingStatus(true);

      await updateMaterialRequestStatus(
        selectedRequest.id,
        status,
        activeUser,
        {
          previous_status: selectedRequest.status,
          new_status: status,
        },
      );

      const refreshed = await getMaterialRequestById(selectedRequest.id);

      setSelectedRequest(refreshed.request);

      setSelectedItems(refreshed.items);

      setSelectedHistory(refreshed.history);

      await loadRequests(false);

      notifications.show({
        title: "Request Status Updated",
        message: `${selectedRequest.request_number} is now ${formatStatus(
          status,
        )}.`,
        color:
          status === MATERIAL_REQUEST_STATUSES.CANCELLED
            ? "gray"
            : status === MATERIAL_REQUEST_STATUSES.FULFILLED
              ? "green"
              : "blue",
        icon: <IconCheck size={18} />,
      });
    } catch (error) {
      notifications.show({
        title: "Status Update Failed",
        message: error.message,
        color: "red",
      });
    } finally {
      setUpdatingStatus(false);
    }
  }

  if (loading) {
    return (
      <Stack gap="xl">
        <MWPageHeader
          title="Material Request Queue"
          subtitle="Loading submitted material and shop-supply requests."
          setPage={setPage}
          showBack
          backPage="inventoryDashboard"
          backLabel="Inventory"
          showDashboard={false}
        />

        <MWPanel>
          <Center py={90}>
            <Stack align="center" gap="sm">
              <Loader color="red" />

              <Text c="dimmed">Loading material requests...</Text>
            </Stack>
          </Center>
        </MWPanel>
      </Stack>
    );
  }

  return (
    <Stack gap="xl">
      <MWPageHeader
        title="Material Request Queue"
        subtitle="Review job materials, shop restock requests, current shortages, priority work, and fulfillment status."
        setPage={setPage}
        showBack
        backPage="inventoryDashboard"
        backLabel="Inventory"
        showDashboard={false}
      />

      <MWKpiStrip
        items={[
          {
            label: "Active Requests",
            value: activeRequests.length,
            description: "Awaiting action",
            icon: IconShoppingCart,
            color: "red",
          },
          {
            label: "Blocked",
            value: blockedCount,
            description: "Current shortages or blocked work",
            icon: IconAlertTriangle,
            color: "red",
          },
          {
            label: "Priority Work",
            value: priorityCount,
            description: "High or critical requests",
            icon: IconFlame,
            color: "orange",
          },
          {
            label: "Shop Restock",
            value: shopSupplyCount,
            description: "General shop-supply requests",
            icon: IconPackage,
            color: "blue",
          },
        ]}
        columns={{
          base: 1,
          sm: 2,
          xl: 4,
        }}
        compact
      />

      <MWPanel
        title="Queue Controls"
        subtitle="Filter submitted requests or refresh current inventory availability"
        icon={IconShoppingCart}
      >
        <Group justify="space-between" wrap="wrap">
          <Group wrap="wrap">
            <Select
              w={205}
              value={statusFilter}
              onChange={(value) => setStatusFilter(value || "active")}
              data={STATUS_OPTIONS}
              allowDeselect={false}
            />

            <Select
              w={215}
              value={sourceFilter}
              onChange={(value) => setSourceFilter(value || "all")}
              data={SOURCE_OPTIONS}
              allowDeselect={false}
            />

            <Select
              w={180}
              value={priorityFilter}
              onChange={(value) => setPriorityFilter(value || "all")}
              data={PRIORITY_OPTIONS}
              allowDeselect={false}
            />

            <Button
              variant="light"
              color="gray"
              leftSection={
                refreshing ? <Loader size={16} /> : <IconRefresh size={17} />
              }
              onClick={() => loadRequests(false)}
              disabled={refreshing}
            >
              Refresh
            </Button>
          </Group>

          <Button
            color="red"
            leftSection={<IconShoppingCart size={18} />}
            onClick={() => setPage("materialRequestCart")}
          >
            New Material Request
          </Button>
        </Group>
      </MWPanel>

      <MWPanel
        title="Material Requests"
        subtitle={`${filteredRequests.length} request${
          filteredRequests.length === 1 ? "" : "s"
        } shown`}
        icon={IconPackage}
      >
        {!filteredRequests.length ? (
          <Alert color="gray" icon={<IconPackage size={19} />}>
            No material requests match the current filters.
          </Alert>
        ) : (
          <SimpleGrid
            cols={{
              base: 1,
              xl: filteredRequests.length === 1 ? 1 : 2,
            }}
            spacing="md"
          >
            {filteredRequests.map((request) => {
              const blocked =
                request.status === MATERIAL_REQUEST_STATUSES.BLOCKED ||
                request.blocked_work ||
                request.has_current_shortage;

              const priority =
                request.is_priority_work ||
                request.priority === "critical" ||
                request.priority === "high";

              return (
                <Paper
                  key={request.id}
                  p="lg"
                  radius="lg"
                  style={{
                    background: blocked
                      ? "linear-gradient(145deg, rgba(105,0,0,.18), rgba(255,255,255,.025))"
                      : "rgba(255,255,255,.025)",

                    border: `1px solid ${
                      blocked
                        ? "rgba(250,82,82,.48)"
                        : priority
                          ? "rgba(255,146,43,.35)"
                          : "rgba(255,255,255,.08)"
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
                        <Group gap="xs" mb={6}>
                          <Badge
                            color={getMaterialRequestStatusColor(
                              request.status,
                            )}
                          >
                            {formatStatus(request.status)}
                          </Badge>

                          <Badge
                            color={
                              request.priority === "normal"
                                ? "gray"
                                : getMaterialRequestPriorityColor(
                                    request.priority,
                                  )
                            }
                            variant="light"
                          >
                            {request.priority}
                          </Badge>

                          <Badge color="gray" variant="light">
                            {getMaterialRequestSourceLabel(request.source_type)}
                          </Badge>
                        </Group>

                        <Title order={3} c="white">
                          {request.request_number}
                        </Title>

                        <Text fw={750} mt={3} c="gray.1">
                          {request.source_title ||
                            request.source_number ||
                            "Metal Worx Material Request"}
                        </Text>

                        <Text size="sm" c="dimmed">
                          {[request.customer_name, request.department]
                            .filter(Boolean)
                            .join(" · ")}
                        </Text>
                      </Box>

                      <ThemeIcon
                        size={48}
                        radius="lg"
                        color={blocked ? "red" : priority ? "orange" : "gray"}
                        variant="light"
                      >
                        {blocked ? (
                          <IconAlertTriangle size={25} />
                        ) : priority ? (
                          <IconFlame size={25} />
                        ) : (
                          <IconPackage size={25} />
                        )}
                      </ThemeIcon>
                    </Group>

                    <SimpleGrid
                      cols={{
                        base: 2,
                        sm: 4,
                      }}
                      spacing="sm"
                    >
                      <Box>
                        <Text size="xs" c="dimmed" fw={800} tt="uppercase">
                          Items
                        </Text>

                        <Text fw={850}>
                          {request.live_item_count ?? request.item_count ?? 0}
                        </Text>
                      </Box>

                      <Box>
                        <Text size="xs" c="dimmed" fw={800} tt="uppercase">
                          Shortages
                        </Text>

                        <Text
                          fw={850}
                          c={
                            Number(request.live_shortage_count || 0) > 0
                              ? "red.4"
                              : "green.4"
                          }
                        >
                          {request.live_shortage_count || 0}
                        </Text>
                      </Box>

                      <Box>
                        <Text size="xs" c="dimmed" fw={800} tt="uppercase">
                          Requested By
                        </Text>

                        <Text fw={850}>
                          {request.requested_by || "Unknown"}
                        </Text>
                      </Box>

                      <Box>
                        <Text size="xs" c="dimmed" fw={800} tt="uppercase">
                          Needed By
                        </Text>

                        <Text fw={850} size="sm">
                          {formatDateTime(request.needed_by)}
                        </Text>
                      </Box>
                    </SimpleGrid>

                    {blocked && (
                      <Alert color="red" icon={<IconAlertTriangle size={18} />}>
                        {request.live_shortage_count ||
                          request.shortage_count ||
                          0}{" "}
                        item line
                        {Number(
                          request.live_shortage_count ||
                            request.shortage_count ||
                            0,
                        ) === 1
                          ? " is"
                          : "s are"}{" "}
                        currently short.
                      </Alert>
                    )}

                    {request.notes && (
                      <Text size="sm" c="dimmed" lineClamp={2}>
                        {request.notes}
                      </Text>
                    )}

                    <Button
                      variant="light"
                      color={blocked ? "red" : "gray"}
                      leftSection={<IconEye size={17} />}
                      onClick={() => openRequest(request.id)}
                    >
                      Review Request
                    </Button>
                  </Stack>
                </Paper>
              );
            })}
          </SimpleGrid>
        )}
      </MWPanel>

      <Modal
        opened={Boolean(selectedRequestId)}
        onClose={closeDetails}
        title="Material Request Review"
        size="xl"
        centered
        overlayProps={{
          backgroundOpacity: 0.78,
          blur: 4,
        }}
        styles={{
          content: {
            background: "#17191d",
            border: "1px solid rgba(255,255,255,.12)",
          },
          header: {
            background: "#17191d",
            borderBottom: "1px solid rgba(255,255,255,.08)",
          },
          title: {
            color: "#ffffff",
            fontWeight: 850,
          },
          body: {
            background: "#17191d",
          },
        }}
      >
        {loadingDetails ? (
          <Center py={80}>
            <Stack align="center" gap="sm">
              <Loader color="red" />

              <Text c="dimmed">Loading request details...</Text>
            </Stack>
          </Center>
        ) : selectedRequest ? (
          <Stack gap="lg">
            <Paper
              p="lg"
              radius="lg"
              style={{
                background:
                  "linear-gradient(135deg, rgba(128,0,0,.22), rgba(255,255,255,.025))",
                border: "1px solid rgba(255,70,70,.24)",
              }}
            >
              <Group justify="space-between" align="flex-start">
                <Box>
                  <Group gap="xs" mb={6}>
                    <Badge
                      color={getMaterialRequestStatusColor(
                        selectedRequest.status,
                      )}
                    >
                      {formatStatus(selectedRequest.status)}
                    </Badge>

                    <Badge
                      color={
                        selectedRequest.priority === "normal"
                          ? "gray"
                          : getMaterialRequestPriorityColor(
                              selectedRequest.priority,
                            )
                      }
                      variant="light"
                    >
                      {selectedRequest.priority}
                    </Badge>

                    <Badge color="gray" variant="light">
                      {getMaterialRequestSourceLabel(
                        selectedRequest.source_type,
                      )}
                    </Badge>
                  </Group>

                  <Title order={2} c="white">
                    {selectedRequest.request_number}
                  </Title>

                  <Text fw={750} mt={4} c="gray.1">
                    {selectedRequest.source_title ||
                      selectedRequest.source_number ||
                      "Material Request"}
                  </Text>

                  <Text c="gray.4">
                    {[selectedRequest.customer_name, selectedRequest.department]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                </Box>

                <ThemeIcon
                  size={54}
                  radius="lg"
                  color={selectedRequest.blocked_work ? "red" : "gray"}
                  variant="light"
                >
                  <IconPackage size={28} />
                </ThemeIcon>
              </Group>
            </Paper>

            <SimpleGrid
              cols={{
                base: 2,
                md: 4,
              }}
            >
              <Paper
                p="sm"
                withBorder
                style={{ background: "rgba(255,255,255,.025)" }}
              >
                <Text size="xs" c="dimmed" fw={800}>
                  REQUESTED BY
                </Text>

                <Text fw={850} c="white">
                  {selectedRequest.requested_by || "Unknown"}
                </Text>
              </Paper>

              <Paper
                p="sm"
                withBorder
                style={{ background: "rgba(255,255,255,.025)" }}
              >
                <Text size="xs" c="dimmed" fw={800}>
                  DEPARTMENT
                </Text>

                <Text fw={850} c="white">
                  {selectedRequest.department || "Not selected"}
                </Text>
              </Paper>

              <Paper
                p="sm"
                withBorder
                style={{ background: "rgba(255,255,255,.025)" }}
              >
                <Text size="xs" c="dimmed" fw={800}>
                  NEEDED BY
                </Text>

                <Text fw={850} size="sm" c="white">
                  {formatDateTime(selectedRequest.needed_by)}
                </Text>
              </Paper>

              <Paper
                p="sm"
                withBorder
                style={{ background: "rgba(255,255,255,.025)" }}
              >
                <Text size="xs" c="dimmed" fw={800}>
                  CREATED
                </Text>

                <Text fw={850} size="sm" c="white">
                  {formatDateTime(selectedRequest.created_at)}
                </Text>
              </Paper>
            </SimpleGrid>

            {selectedRequest.notes && (
              <Alert color="red" title="Request Notes" variant="light">
                {selectedRequest.notes}
              </Alert>
            )}

            <Divider label="Requested Inventory" labelPosition="left" />

            {!selectedItems.length ? (
              <Alert color="gray">
                No inventory items were found for this request.
              </Alert>
            ) : (
              <Table.ScrollContainer minWidth={850}>
                <Table verticalSpacing="md" horizontalSpacing="sm">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Item</Table.Th>

                      <Table.Th>Requested</Table.Th>

                      <Table.Th>Available Now</Table.Th>

                      <Table.Th>Short</Table.Th>

                      <Table.Th>Location</Table.Th>

                      <Table.Th>Status</Table.Th>
                    </Table.Tr>
                  </Table.Thead>

                  <Table.Tbody>
                    {selectedItems.map((item) => {
                      const currentShort = numberValue(
                        item.current_shortage_quantity,
                      );

                      return (
                        <Table.Tr key={item.id}>
                          <Table.Td>
                            <Text fw={850} c="gray.1">
                              {item.current_item_name || item.item_name}
                            </Text>

                            <Text size="xs" c="dimmed">
                              {item.current_item_number ||
                                item.item_number ||
                                "Inventory item"}
                            </Text>
                          </Table.Td>

                          <Table.Td>
                            <Text fw={850} c="gray.1">
                              {item.quantity_requested}
                            </Text>
                          </Table.Td>

                          <Table.Td>
                            <Text fw={850} c="gray.1">
                              {item.current_quantity_available}
                            </Text>
                          </Table.Td>

                          <Table.Td>
                            <Text
                              fw={900}
                              c={currentShort > 0 ? "red.4" : "green.4"}
                            >
                              {currentShort}
                            </Text>
                          </Table.Td>

                          <Table.Td>
                            <Text size="sm">
                              {[item.default_bin_code, item.default_bin_name]
                                .filter(Boolean)
                                .join(" · ") || "Unassigned"}
                            </Text>
                          </Table.Td>

                          <Table.Td>
                            <Badge
                              color={currentShort > 0 ? "red" : "green"}
                              variant="light"
                            >
                              {currentShort > 0 ? "Shortage" : "Available"}
                            </Badge>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            )}

            <Divider label="Workflow Actions" labelPosition="left" />

            {selectedHasShortage && (
              <Alert
                color="orange"
                variant="light"
                icon={<IconAlertTriangle size={19} />}
              >
                This request still has an inventory shortage. It may be approved
                for purchasing, but it cannot be marked fulfilled until enough
                stock is received.
              </Alert>
            )}

            <Group grow>
              {[
                MATERIAL_REQUEST_STATUSES.SUBMITTED,
                MATERIAL_REQUEST_STATUSES.BLOCKED,
              ].includes(selectedRequest.status) && (
                <Button
                  color="green"
                  leftSection={<IconCheck size={17} />}
                  loading={updatingStatus}
                  onClick={() =>
                    changeStatus(MATERIAL_REQUEST_STATUSES.APPROVED)
                  }
                >
                  Approve Request
                </Button>
              )}

              {selectedRequest.status ===
                MATERIAL_REQUEST_STATUSES.APPROVED && (
                <Button
                  color="yellow"
                  variant="light"
                  leftSection={<IconClock size={17} />}
                  loading={updatingStatus}
                  onClick={() =>
                    changeStatus(MATERIAL_REQUEST_STATUSES.PARTIALLY_FULFILLED)
                  }
                >
                  Partially Fulfilled
                </Button>
              )}

              {[
                MATERIAL_REQUEST_STATUSES.APPROVED,
                MATERIAL_REQUEST_STATUSES.PARTIALLY_FULFILLED,
              ].includes(selectedRequest.status) && (
                <Button
                  color="green"
                  leftSection={<IconCheck size={17} />}
                  loading={updatingStatus}
                  disabled={selectedHasShortage}
                  onClick={() =>
                    changeStatus(MATERIAL_REQUEST_STATUSES.FULFILLED)
                  }
                >
                  Mark Fulfilled
                </Button>
              )}

              {![
                MATERIAL_REQUEST_STATUSES.FULFILLED,
                MATERIAL_REQUEST_STATUSES.CANCELLED,
              ].includes(selectedRequest.status) && (
                <Button
                  color="gray"
                  variant="light"
                  leftSection={<IconX size={17} />}
                  loading={updatingStatus}
                  onClick={() =>
                    changeStatus(MATERIAL_REQUEST_STATUSES.CANCELLED)
                  }
                >
                  Cancel Request
                </Button>
              )}
            </Group>

            <Divider label="Request History" labelPosition="left" />

            {!selectedHistory.length ? (
              <Text c="dimmed" size="sm">
                No history has been recorded.
              </Text>
            ) : (
              <Timeline
                active={selectedHistory.length}
                bulletSize={26}
                lineWidth={2}
              >
                {selectedHistory.map((history) => (
                  <Timeline.Item
                    key={history.id}
                    bullet={<IconCheck size={14} />}
                    title={formatStatus(history.action)}
                  >
                    <Text size="sm" c="dimmed">
                      {history.employee_name || "Metal Worx OS"} ·{" "}
                      {formatDateTime(history.created_at)}
                    </Text>
                  </Timeline.Item>
                ))}
              </Timeline>
            )}
          </Stack>
        ) : (
          <Alert color="red">The request could not be loaded.</Alert>
        )}
      </Modal>
    </Stack>
  );
}

export default MaterialRequestQueue;