import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Card,
  Divider,
  Drawer,
  Group,
  Loader,
  Modal,
  NumberInput,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconCheck,
  IconClock,
  IconCurrencyDollar,
  IconListDetails,
  IconPackage,
  IconShoppingCart,
} from "@tabler/icons-react";

import { supabase } from "../lib/supabase";
import MWPageHeader from "../components/ui/MWPageHeader";
import MWSection from "../components/ui/MWSection";

import {
  getOpenProjectMaterialRequests,
  getRecentlyReceivedMaterialRequests,
  markMaterialCustomerApproved,
  markMaterialCustomerQuoteSent,
  markMaterialRequestOrdered,
  receiveMaterialRequest,
  reopenMaterialPricing,
  saveMaterialPricing,
} from "../services/projectMaterialService";

const QUEUES = {
  pricing: "Pricing Needed",
  approval: "Waiting Approval",
  ready: "Ready to Order",
  ordered: "Ordered / Receiving",
  received: "Recently Received",
  all: "All Requests",
};

const QUEUE_META = {
  pricing: {
    color: "red",
    icon: IconCurrencyDollar,
    description: "Needs current vendor pricing",
  },
  approval: {
    color: "orange",
    icon: IconClock,
    description: "Waiting on customer approval",
  },
  ready: {
    color: "grape",
    icon: IconShoppingCart,
    description: "Approved and ready to purchase",
  },
  ordered: {
    color: "blue",
    icon: IconPackage,
    description: "Ordered and awaiting delivery",
  },
  received: {
    color: "green",
    icon: IconCheck,
    description: "Received during the last 7 days",
  },
  all: {
    color: "gray",
    icon: IconListDetails,
    description: "All active and recent requests",
  },
};

function money(value) {
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString();
}

function priorityColor(priority) {
  if (priority === "Rush") return "red";
  if (priority === "High") return "orange";
  if (priority === "Low") return "gray";
  return "green";
}

function statusColor(status) {
  if (status === "Received") return "green";
  if (status === "Partially Received") return "cyan";
  if (status === "Ordered") return "blue";
  if (status === "Ready to Order") return "grape";
  if (status === "Waiting Customer Approval") return "orange";
  if (
    status === "Pricing Needed" ||
    status === "Request Submitted"
  ) {
    return "red";
  }
  if (status === "Cancelled") return "red";
  return "gray";
}

function getActiveUserName(activeUser) {
  if (typeof activeUser === "string") {
    return activeUser.trim() || "Procurement Team";
  }

  return (
    activeUser?.display_name ||
    activeUser?.name ||
    activeUser?.email ||
    "Procurement Team"
  );
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
    project?.contact_name ||
    project?.customer_contact_name ||
    getCustomerName(customer) ||
    "Customer not assigned"
  );
}

function getProjectCompany(project, customer, person) {
  const company = project?.company_name || customer?.company_name || "";
  return company === person ? "" : company;
}

function getProjectItem(project) {
  return (
    project?.project_name ||
    project?.item_name ||
    project?.project_type ||
    project?.project_category ||
    project?.project_number ||
    "Untitled Project"
  );
}

function getProjectIdentity(project, customer) {
  return `${getProjectPerson(project, customer)} — ${getProjectItem(project)}`;
}

function getQueueKey(request) {
  if (request.status === "Received" || request.received) {
    return "received";
  }

  if (
    request.status === "Ordered" ||
    request.status === "Partially Received" ||
    request.ordered
  ) {
    return "ordered";
  }

  if (
    request.status === "Ready to Order" ||
    request.customer_approved
  ) {
    return "ready";
  }

  if (
    request.quote_complete &&
    !request.customer_approved
  ) {
    return "approval";
  }

  return "pricing";
}

function getNextAction(request) {
  const requestQueue = getQueueKey(request);

  if (requestQueue === "pricing") return "Material Pricing";
  if (requestQueue === "approval") {
    return request.customer_quote_sent
      ? "Waiting on Customer"
      : "Mark Quote Sent";
  }
  if (requestQueue === "ready") return "Order Material";
  if (requestQueue === "ordered") return "Receive Material";
  if (requestQueue === "received") return "Receipt Complete";

  return "Review Request";
}

function Procurement({
  setPage,
  setSelectedProject,
  activeUser = null,
}) {
  const [requests, setRequests] = useState([]);
  const [customers, setCustomers] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [queue, setQueue] = useState("pricing");
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [vendorFilter, setVendorFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const [selectedRequest, setSelectedRequest] = useState(null);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [orderingOpen, setOrderingOpen] = useState(false);
  const [receivingOpen, setReceivingOpen] = useState(false);

  const [receiveQuantity, setReceiveQuantity] = useState(0);

  const [pricingForm, setPricingForm] = useState({
    vendorName: "",
    vendorContact: "",
    vendorPhone: "",
    vendorEmail: "",
    quoteDate: "",
    quoteExpiration: "",
    unitCost: 0,
    freightCost: 0,
    taxCost: 0,
    otherCost: 0,
    markupPercent: 0,
    leadTimeDays: "",
    pricingNotes: "",
  });

  const [orderingForm, setOrderingForm] = useState({
    purchaseOrder: "",
    vendorInvoice: "",
    orderedCost: 0,
    orderingNotes: "",
  });

  useEffect(() => {
    loadRequests();
  }, []);

  async function loadRequests() {
    setLoading(true);

    try {
      const [openRequests, receivedRequests] =
        await Promise.all([
          getOpenProjectMaterialRequests(),
          getRecentlyReceivedMaterialRequests(7),
        ]);

      const combinedRequests = [
        ...(openRequests || []),
        ...(receivedRequests || []),
      ];

      const uniqueRequests = Array.from(
        new Map(
          combinedRequests.map((request) => [
            request.id,
            request,
          ])
        ).values()
      );

      const customerIds = Array.from(
        new Set(
          uniqueRequests
            .map(
              (request) =>
                request.projects?.customer_id
            )
            .filter(Boolean)
        )
      );

      if (customerIds.length > 0) {
        const {
          data: customerData,
          error: customerError,
        } = await supabase
          .from("customers")
          .select("*")
          .in("id", customerIds);

        if (customerError) {
          console.error(
            "Procurement customer load error:",
            customerError
          );
          setCustomers({});
        } else {
          const customerMap = (
            customerData || []
          ).reduce(
            (result, customer) => {
              result[customer.id] =
                customer;
              return result;
            },
            {}
          );

          setCustomers(customerMap);
        }
      } else {
        setCustomers({});
      }

      setRequests(uniqueRequests);
    } catch (error) {
      console.error("Procurement load error:", error);

      notifications.show({
        title: "Procurement Load Failed",
        message:
          error.message ||
          "Unable to load procurement requests.",
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  }

  function openDetails(request) {
    setSelectedRequest(request);
    setDetailsOpen(true);
  }

  function openPricing(request) {
    setSelectedRequest(request);

    setPricingForm({
      vendorName: request.vendor_name || "",
      vendorContact: request.vendor_contact || "",
      vendorPhone: request.vendor_phone || "",
      vendorEmail: request.vendor_email || "",
      quoteDate: request.quote_date || "",
      quoteExpiration: request.quote_expiration || "",
      unitCost: Number(request.unit_cost || 0),
      freightCost: Number(request.freight_cost || 0),
      taxCost: Number(request.tax_cost || 0),
      otherCost: Number(request.other_cost || 0),
      markupPercent: Number(request.markup_percent || 0),
      leadTimeDays: request.lead_time_days ?? "",
      pricingNotes: request.pricing_notes || "",
    });

    setPricingOpen(true);
  }

  function openOrdering(request) {
    setSelectedRequest(request);

    setOrderingForm({
      purchaseOrder: request.purchase_order || "",
      vendorInvoice: request.vendor_invoice || "",
      orderedCost: Number(
        request.ordered_cost ||
          request.quoted_total ||
          0
      ),
      orderingNotes: request.ordering_notes || "",
    });

    setOrderingOpen(true);
  }

  function openReceiving(request) {
    setSelectedRequest(request);
    setReceiveQuantity(0);
    setReceivingOpen(true);
  }

  function openProject(request) {
    const selectedProject = request.projects;

    if (!selectedProject) return;

    if (setSelectedProject) {
      setSelectedProject(selectedProject);
    }

    setPage("projectDetails");
  }

  function updatePricingField(field, value) {
    setPricingForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateOrderingField(field, value) {
    setOrderingForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  const operatorName =
    getActiveUserName(activeUser);

  async function savePricing() {
    if (!selectedRequest) return;

    if (!pricingForm.vendorName.trim()) {
      notifications.show({
        title: "Vendor Required",
        message:
          "Enter the vendor used for this material pricing.",
        color: "red",
      });
      return;
    }

    setSaving(true);

    try {
      await saveMaterialPricing({
        requestId: selectedRequest.id,
        projectNumber:
          selectedRequest.projects?.project_number || "",
        projectName:
          selectedRequest.projects?.project_name || "",
        itemName: selectedRequest.item_name || "",
        ...pricingForm,
        completedBy: operatorName,
      });

      notifications.show({
        title: "Pricing Saved",
        message:
          "Vendor pricing was saved and the request moved to Waiting Approval.",
        color: "green",
      });

      setPricingOpen(false);
      await loadRequests();
    } catch (error) {
      notifications.show({
        title: "Pricing Save Failed",
        message:
          error.message ||
          "Unable to save vendor pricing.",
        color: "red",
      });
    } finally {
      setSaving(false);
    }
  }

  async function markQuoteSent(request) {
    try {
      await markMaterialCustomerQuoteSent(request.id);

      notifications.show({
        title: "Quote Marked Sent",
        message:
          "The request is now waiting on customer approval.",
        color: "green",
      });

      await loadRequests();
    } catch (error) {
      notifications.show({
        title: "Update Failed",
        message: error.message,
        color: "red",
      });
    }
  }

  async function approveForOrdering(request) {
    const project = request.projects || {};

    if (
      project.down_payment_required &&
      project.down_payment_status !== "Received"
    ) {
      notifications.show({
        title: "Down Payment Pending",
        message:
          "The project requires a down payment before materials can be ordered.",
        color: "orange",
      });
      return;
    }

    try {
      await markMaterialCustomerApproved({
        requestId: request.id,
        projectNumber: project.project_number || "",
        projectName: project.project_name || "",
        itemName: request.item_name || "",
        customerMaterialPrice:
          request.customer_material_price || 0,
      });

      notifications.show({
        title: "Ready to Order",
        message:
          "Customer approval was recorded and Procurement can now order the material.",
        color: "green",
      });

      await loadRequests();
    } catch (error) {
      notifications.show({
        title: "Approval Failed",
        message: error.message,
        color: "red",
      });
    }
  }

  async function placeOrder() {
    if (!selectedRequest) return;

    setSaving(true);

    try {
      await markMaterialRequestOrdered({
        requestId: selectedRequest.id,
        orderedBy: operatorName,
        ...orderingForm,
      });

      notifications.show({
        title: "Material Ordered",
        message: "The order information was saved.",
        color: "green",
      });

      setOrderingOpen(false);
      await loadRequests();
    } catch (error) {
      notifications.show({
        title: "Order Failed",
        message:
          error.message ||
          "Unable to save the material order.",
        color: "red",
      });
    } finally {
      setSaving(false);
    }
  }

  async function receiveMaterial() {
    if (!selectedRequest) return;

    if (!Number(receiveQuantity)) {
      notifications.show({
        title: "Quantity Required",
        message: "Enter the quantity received.",
        color: "red",
      });
      return;
    }

    setSaving(true);

    try {
      await receiveMaterialRequest({
        requestId: selectedRequest.id,
        quantityReceived: Number(receiveQuantity),
        receivedBy: operatorName,
      });

      notifications.show({
        title: "Receiving Saved",
        message:
          "The received quantity was recorded.",
        color: "green",
      });

      setReceivingOpen(false);
      await loadRequests();
    } catch (error) {
      notifications.show({
        title: "Receiving Failed",
        message:
          error.message ||
          "Unable to receive the material.",
        color: "red",
      });
    } finally {
      setSaving(false);
    }
  }

  async function reopenPricingRequest(request) {
    try {
      await reopenMaterialPricing(request.id);

      notifications.show({
        title: "Pricing Reopened",
        message:
          "The request moved back to Pricing Needed.",
        color: "green",
      });

      setDetailsOpen(false);
      await loadRequests();
    } catch (error) {
      notifications.show({
        title: "Update Failed",
        message: error.message,
        color: "red",
      });
    }
  }

  const counts = useMemo(() => {
    const result = {
      pricing: 0,
      approval: 0,
      ready: 0,
      ordered: 0,
      received: 0,
      all: requests.length,
    };

    requests.forEach((request) => {
      result[getQueueKey(request)] += 1;
    });

    return result;
  }, [requests]);

  const financials = useMemo(() => {
    const approvalValue = requests
      .filter(
        (request) =>
          getQueueKey(request) === "approval"
      )
      .reduce(
        (total, request) =>
          total +
          Number(
            request.customer_material_price || 0
          ),
        0
      );

    const readyCost = requests
      .filter(
        (request) =>
          getQueueKey(request) === "ready"
      )
      .reduce(
        (total, request) =>
          total +
          Number(request.quoted_total || 0),
        0
      );

    const outstandingOrders = requests
      .filter(
        (request) =>
          getQueueKey(request) === "ordered"
      )
      .reduce(
        (total, request) =>
          total +
          Number(
            request.ordered_cost ||
              request.quoted_total ||
              0
          ),
        0
      );

    return {
      approvalValue,
      readyCost,
      outstandingOrders,
    };
  }, [requests]);

  const vendorOptions = useMemo(() => {
    const vendors = requests
      .map((request) => request.vendor_name)
      .filter(Boolean);

    return [
      "All",
      ...Array.from(new Set(vendors)).sort(),
    ];
  }, [requests]);

  const statusOptions = useMemo(() => {
    const statuses = requests
      .map((request) => request.status)
      .filter(Boolean);

    return [
      "All",
      ...Array.from(new Set(statuses)).sort(),
    ];
  }, [requests]);

  const filteredRequests = useMemo(() => {
    const searchValue = search
      .trim()
      .toLowerCase();

    return requests.filter((request) => {
      const requestQueue = getQueueKey(request);

      const queueMatch =
        queue === "all" ||
        requestQueue === queue;

      const priorityMatch =
        priorityFilter === "All" ||
        request.priority === priorityFilter;

      const vendorMatch =
        vendorFilter === "All" ||
        request.vendor_name === vendorFilter;

      const statusMatch =
        statusFilter === "All" ||
        request.status === statusFilter;

      const project = request.projects || {};
      const customer =
        customers[project.customer_id];
      const person =
        getProjectPerson(
          project,
          customer
        );
      const company =
        getProjectCompany(
          project,
          customer,
          person
        );

      const searchableText = [
        getProjectIdentity(
          project,
          customer
        ),
        person,
        company,
        project.project_number,
        project.project_name,
        request.request_number,
        request.item_name,
        request.dimensions,
        request.vendor_name,
        request.description,
        request.purchase_order,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const searchMatch =
        !searchValue ||
        searchableText.includes(searchValue);

      return (
        queueMatch &&
        priorityMatch &&
        vendorMatch &&
        statusMatch &&
        searchMatch
      );
    });
  }, [
    requests,
    queue,
    priorityFilter,
    vendorFilter,
    statusFilter,
    search,
    customers,
  ]);

  const quotedTotalPreview =
    Number(selectedRequest?.quantity || 0) *
      Number(pricingForm.unitCost || 0) +
    Number(pricingForm.freightCost || 0) +
    Number(pricingForm.taxCost || 0) +
    Number(pricingForm.otherCost || 0);

  const customerPricePreview =
    quotedTotalPreview *
    (1 +
      Number(pricingForm.markupPercent || 0) /
        100);

  return (
    <>
      <MWPageHeader
        title="Procurement Center"
        subtitle="Vendor pricing, customer approval, ordering, and receiving for every Metal Worx project."
        setPage={setPage}
        showBack={true}
        backPage="dashboard"
        backLabel="Mission Control"
        showDashboard={true}
      />

      <SimpleGrid
        cols={{
          base: 1,
          sm: 2,
          lg: 3,
        }}
        spacing="md"
        mb="lg"
      >
        {Object.entries(QUEUES).map(
          ([key, label]) => {
            const meta = QUEUE_META[key];
            const QueueIcon = meta.icon;
            const selected = queue === key;

            let description =
              meta.description;

            if (key === "approval") {
              description = `${money(
                financials.approvalValue
              )} waiting`;
            }

            if (key === "ready") {
              description = `${money(
                financials.readyCost
              )} vendor cost`;
            }

            if (key === "ordered") {
              description = `${money(
                financials.outstandingOrders
              )} outstanding`;
            }

            return (
              <Card
                key={key}
                withBorder
                radius="lg"
                p="lg"
                onClick={() => setQueue(key)}
                style={{
                  cursor: "pointer",
                  minHeight: 150,
                  borderLeft:
                    `5px solid var(--mantine-color-${meta.color}-6)`,
                  borderColor: selected
                    ? `var(--mantine-color-${meta.color}-6)`
                    : undefined,
                  boxShadow: selected
                    ? `0 0 0 1px var(--mantine-color-${meta.color}-6)`
                    : undefined,
                }}
              >
                <Stack
                  justify="space-between"
                  h="100%"
                  gap="lg"
                >
                  <Group
                    justify="space-between"
                    align="flex-start"
                    wrap="nowrap"
                  >
                    <Box>
                      <Text fw={700} size="md">
                        {label}
                      </Text>

                      <Text
                        size="sm"
                        c="dimmed"
                        mt={4}
                      >
                        {description}
                      </Text>
                    </Box>

                    <ThemeIcon
                      color={meta.color}
                      variant={
                        selected
                          ? "filled"
                          : "light"
                      }
                      radius="xl"
                      size="xl"
                    >
                      <QueueIcon size={22} />
                    </ThemeIcon>
                  </Group>

                  <Group
                    justify="space-between"
                    align="flex-end"
                  >
                    <Title
                      order={1}
                      c={meta.color}
                      style={{
                        lineHeight: 1,
                      }}
                    >
                      {counts[key]}
                    </Title>

                    <Text size="sm" c="dimmed">
                      request
                      {counts[key] === 1
                        ? ""
                        : "s"}
                    </Text>
                  </Group>
                </Stack>
              </Card>
            );
          }
        )}
      </SimpleGrid>

      <MWSection
        title={QUEUES[queue]}
        subtitle="Work each request by its next required action while keeping every material cost tied to the correct project."
      >
        <Stack gap="md">
          <SimpleGrid
            cols={{
              base: 1,
              sm: 2,
              lg: 5,
            }}
            spacing="sm"
            align="end"
          >
            <TextInput
              label="Search"
              placeholder="Project, material, vendor, PO..."
              value={search}
              onChange={(event) =>
                setSearch(
                  event.currentTarget.value
                )
              }
            />

            <Select
              label="Priority"
              data={[
                "All",
                "Rush",
                "High",
                "Normal",
                "Low",
              ]}
              value={priorityFilter}
              onChange={(value) =>
                setPriorityFilter(
                  value || "All"
                )
              }
            />

            <Select
              label="Vendor"
              searchable
              data={vendorOptions}
              value={vendorFilter}
              onChange={(value) =>
                setVendorFilter(
                  value || "All"
                )
              }
            />

            <Select
              label="Status"
              data={statusOptions}
              value={statusFilter}
              onChange={(value) =>
                setStatusFilter(
                  value || "All"
                )
              }
            />

            <Button
              fullWidth
              variant="light"
              color="gray"
              loading={loading}
              onClick={loadRequests}
            >
              Refresh
            </Button>
          </SimpleGrid>

          <Group gap="xs">
            {Object.entries(QUEUES).map(
              ([key, label]) => (
                <Button
                  key={key}
                  size="xs"
                  variant={
                    queue === key
                      ? "filled"
                      : "light"
                  }
                  color={QUEUE_META[key].color}
                  onClick={() => setQueue(key)}
                >
                  {label} ({counts[key]})
                </Button>
              )
            )}
          </Group>

          {loading ? (
            <Card
              withBorder
              radius="lg"
              p="xl"
            >
              <Group justify="center">
                <Loader color="red" />
                <Text>
                  Loading procurement...
                </Text>
              </Group>
            </Card>
          ) : filteredRequests.length === 0 ? (
            <Card
              withBorder
              radius="lg"
              p="xl"
              style={{
                minHeight: 175,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Stack
                gap={5}
                align="center"
              >
                <ThemeIcon
                  color={QUEUE_META[queue].color}
                  variant="light"
                  radius="xl"
                  size={48}
                >
                  {QUEUE_META[queue].icon}
                </ThemeIcon>

                <Text
                  fw={700}
                  size="lg"
                >
                  No requests in this queue
                </Text>

                <Text
                  size="sm"
                  c="dimmed"
                  ta="center"
                >
                  New matching requests will
                  appear here automatically.
                </Text>
              </Stack>
            </Card>
          ) : (
            <ScrollArea>
              <Table
                striped
                highlightOnHover
                withTableBorder
                withColumnBorders
                miw={1320}
                verticalSpacing="sm"
              >
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>
                      Customer / Project
                    </Table.Th>
                    <Table.Th>Material</Table.Th>
                    <Table.Th>Vendor</Table.Th>
                    <Table.Th>Needed</Table.Th>
                    <Table.Th>Priority</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Cost</Table.Th>
                    <Table.Th>
                      Next Action
                    </Table.Th>
                    <Table.Th>Details</Table.Th>
                  </Table.Tr>
                </Table.Thead>

                <Table.Tbody>
                  {filteredRequests.map(
                    (request) => {
                      const project =
                        request.projects || {};

                      const customer =
                        customers[
                          project.customer_id
                        ];

                      const person =
                        getProjectPerson(
                          project,
                          customer
                        );

                      const company =
                        getProjectCompany(
                          project,
                          customer,
                          person
                        );

                      const requestQueue =
                        getQueueKey(request);

                      return (
                        <Table.Tr
                          key={request.id}
                        >
                          <Table.Td>
                            <Stack gap={2}>
                              <Button
                                variant="subtle"
                                size="compact-sm"
                                px={0}
                                onClick={() =>
                                  openProject(
                                    request
                                  )
                                }
                              >
                                {getProjectIdentity(
                                  project,
                                  customer
                                )}
                              </Button>

                              <Text
                                size="xs"
                                c="dimmed"
                              >
                                {[
                                  company,
                                  project.project_number,
                                ]
                                  .filter(Boolean)
                                  .join(" • ") ||
                                  "No project reference"}
                              </Text>
                            </Stack>
                          </Table.Td>

                          <Table.Td>
                            <Text
                              fw={700}
                              size="sm"
                            >
                              {request.quantity || 0}
                              {" × "}
                              {request.item_name ||
                                "Unnamed Item"}
                            </Text>

                            <Text
                              size="xs"
                              c="dimmed"
                            >
                              {request.dimensions ||
                                "No dimensions"}
                            </Text>
                          </Table.Td>

                          <Table.Td>
                            {request.vendor_name ||
                              "Not selected"}
                          </Table.Td>

                          <Table.Td>
                            {formatDate(
                              request.needed_by
                            )}
                          </Table.Td>

                          <Table.Td>
                            <Badge
                              color={priorityColor(
                                request.priority
                              )}
                              variant="light"
                            >
                              {request.priority ||
                                "Normal"}
                            </Badge>
                          </Table.Td>

                          <Table.Td>
                            <Badge
                              color={statusColor(
                                request.status
                              )}
                              variant="filled"
                            >
                              {request.status ||
                                "Request Submitted"}
                            </Badge>
                          </Table.Td>

                          <Table.Td>
                            <Stack gap={1}>
                              <Text
                                fw={700}
                                size="sm"
                              >
                                {money(
                                  request.quoted_total
                                )}
                              </Text>

                              {Number(
                                request.customer_material_price ||
                                  0
                              ) > 0 && (
                                <Text
                                  size="xs"
                                  c="dimmed"
                                >
                                  Sell{" "}
                                  {money(
                                    request.customer_material_price
                                  )}
                                </Text>
                              )}
                            </Stack>
                          </Table.Td>

                          <Table.Td>
                            {requestQueue ===
                              "pricing" && (
                              <Button
                                size="xs"
                                color="red"
                                onClick={() =>
                                  openPricing(
                                    request
                                  )
                                }
                              >
                                Material Pricing
                              </Button>
                            )}

                            {requestQueue ===
                              "approval" &&
                              (!request.customer_quote_sent ? (
                                <Button
                                  size="xs"
                                  color="orange"
                                  onClick={() =>
                                    markQuoteSent(
                                      request
                                    )
                                  }
                                >
                                  Mark Quote Sent
                                </Button>
                              ) : (
                                <Button
                                  size="xs"
                                  color="green"
                                  onClick={() =>
                                    approveForOrdering(
                                      request
                                    )
                                  }
                                >
                                  Customer Approved
                                </Button>
                              ))}

                            {requestQueue ===
                              "ready" && (
                              <Button
                                size="xs"
                                color="grape"
                                onClick={() =>
                                  openOrdering(
                                    request
                                  )
                                }
                              >
                                🛒 Order Material
                              </Button>
                            )}

                            {requestQueue ===
                              "ordered" && (
                              <Button
                                size="xs"
                                color="blue"
                                onClick={() =>
                                  openReceiving(
                                    request
                                  )
                                }
                              >
                                📦 Receive Material
                              </Button>
                            )}

                            {requestQueue ===
                              "received" && (
                              <Badge
                                color="green"
                                variant="light"
                              >
                                Completed
                              </Badge>
                            )}
                          </Table.Td>

                          <Table.Td>
                            <Button
                              size="xs"
                              variant="light"
                              color="gray"
                              onClick={() =>
                                openDetails(
                                  request
                                )
                              }
                            >
                              View
                            </Button>
                          </Table.Td>
                        </Table.Tr>
                      );
                    }
                  )}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          )}
        </Stack>
      </MWSection>

      <Drawer
        opened={detailsOpen}
        onClose={() =>
          setDetailsOpen(false)
        }
        title="Procurement Request"
        position="right"
        size="lg"
      >
        {selectedRequest && (
          <Stack>
            <Card
              withBorder
              radius="lg"
              p="md"
            >
              <Group
                justify="space-between"
                align="flex-start"
              >
                <Box>
                  <Text
                    size="xs"
                    c="dimmed"
                  >
                    Project
                  </Text>

                  <Title order={4}>
                    {getProjectIdentity(
                      selectedRequest.projects ||
                        {},
                      customers[
                        selectedRequest
                          .projects
                          ?.customer_id
                      ]
                    )}
                  </Title>

                  <Text size="sm">
                    {[
                      getProjectCompany(
                        selectedRequest.projects ||
                          {},
                        customers[
                          selectedRequest
                            .projects
                            ?.customer_id
                        ],
                        getProjectPerson(
                          selectedRequest.projects ||
                            {},
                          customers[
                            selectedRequest
                              .projects
                              ?.customer_id
                          ]
                        )
                      ),
                      selectedRequest.projects
                        ?.project_number,
                    ]
                      .filter(Boolean)
                      .join(" • ") ||
                      "No project reference"}
                  </Text>
                </Box>

                <Badge
                  color={statusColor(
                    selectedRequest.status
                  )}
                  variant="filled"
                >
                  {selectedRequest.status ||
                    "Request Submitted"}
                </Badge>
              </Group>
            </Card>

            <SimpleGrid
              cols={{
                base: 1,
                sm: 2,
              }}
            >
              <Card
                withBorder
                radius="lg"
                p="md"
              >
                <Text
                  size="xs"
                  c="dimmed"
                >
                  Material
                </Text>

                <Text fw={700}>
                  {selectedRequest.quantity ||
                    0}
                  {" × "}
                  {selectedRequest.item_name ||
                    "Unnamed Item"}
                </Text>

                <Text size="sm">
                  {selectedRequest.dimensions ||
                    "No dimensions"}
                </Text>
              </Card>

              <Card
                withBorder
                radius="lg"
                p="md"
              >
                <Text
                  size="xs"
                  c="dimmed"
                >
                  Next Action
                </Text>

                <Text fw={700}>
                  {getNextAction(
                    selectedRequest
                  )}
                </Text>

                <Text size="sm">
                  Needed{" "}
                  {formatDate(
                    selectedRequest.needed_by
                  )}
                </Text>
              </Card>
            </SimpleGrid>

            <Divider label="Vendor Pricing" />

            <SimpleGrid
              cols={{
                base: 1,
                sm: 2,
              }}
            >
              <Text size="sm">
                <strong>Vendor:</strong>{" "}
                {selectedRequest.vendor_name ||
                  "Not selected"}
              </Text>

              <Text size="sm">
                <strong>Contact:</strong>{" "}
                {selectedRequest.vendor_contact ||
                  "—"}
              </Text>

              <Text size="sm">
                <strong>Phone:</strong>{" "}
                {selectedRequest.vendor_phone ||
                  "—"}
              </Text>

              <Text size="sm">
                <strong>Quote Date:</strong>{" "}
                {formatDate(
                  selectedRequest.quote_date
                )}
              </Text>

              <Text size="sm">
                <strong>Vendor Cost:</strong>{" "}
                {money(
                  selectedRequest.quoted_total
                )}
              </Text>

              <Text size="sm">
                <strong>
                  Customer Price:
                </strong>{" "}
                {money(
                  selectedRequest.customer_material_price
                )}
              </Text>
            </SimpleGrid>

            <Divider label="Ordering & Receiving" />

            <SimpleGrid
              cols={{
                base: 1,
                sm: 2,
              }}
            >
              <Text size="sm">
                <strong>PO:</strong>{" "}
                {selectedRequest.purchase_order ||
                  "—"}
              </Text>

              <Text size="sm">
                <strong>Final Cost:</strong>{" "}
                {money(
                  selectedRequest.ordered_cost
                )}
              </Text>

              <Text size="sm">
                <strong>Received:</strong>{" "}
                {selectedRequest.quantity_received ||
                  0}
                {" / "}
                {selectedRequest.quantity ||
                  0}
              </Text>

              <Text size="sm">
                <strong>Ordered:</strong>{" "}
                {formatDate(
                  selectedRequest.ordered_at
                )}
              </Text>
            </SimpleGrid>

            <Group grow>
              <Button
                variant="light"
                color="gray"
                onClick={() =>
                  openProject(
                    selectedRequest
                  )
                }
              >
                Open Project
              </Button>

              {getQueueKey(
                selectedRequest
              ) !== "received" && (
                <Button
                  variant="light"
                  color="orange"
                  onClick={() =>
                    reopenPricingRequest(
                      selectedRequest
                    )
                  }
                >
                  Reprice
                </Button>
              )}
            </Group>
          </Stack>
        )}
      </Drawer>

      <Modal
        opened={pricingOpen}
        onClose={() =>
          setPricingOpen(false)
        }
        title="Material Pricing"
        size="xl"
        centered
      >
        <Stack>
          <Card
            withBorder
            radius="lg"
            p="md"
          >
            <Text fw={700}>
              {getProjectIdentity(
                selectedRequest?.projects ||
                  {},
                customers[
                  selectedRequest?.projects
                    ?.customer_id
                ]
              )}
            </Text>

            <Text size="xs" c="dimmed">
              {selectedRequest?.projects
                ?.project_number ||
                "No project number"}
            </Text>

            <Text size="sm">
              {selectedRequest?.quantity || 0}
              {" × "}
              {selectedRequest?.item_name || ""}
            </Text>

            <Text size="sm" c="dimmed">
              {selectedRequest?.dimensions || ""}
            </Text>
          </Card>

          <SimpleGrid
            cols={{
              base: 1,
              md: 2,
            }}
          >
            <TextInput
              label="Vendor"
              required
              value={pricingForm.vendorName}
              onChange={(event) =>
                updatePricingField(
                  "vendorName",
                  event.currentTarget.value
                )
              }
            />

            <TextInput
              label="Vendor Contact"
              value={pricingForm.vendorContact}
              onChange={(event) =>
                updatePricingField(
                  "vendorContact",
                  event.currentTarget.value
                )
              }
            />

            <TextInput
              label="Vendor Phone"
              value={pricingForm.vendorPhone}
              onChange={(event) =>
                updatePricingField(
                  "vendorPhone",
                  event.currentTarget.value
                )
              }
            />

            <TextInput
              label="Vendor Email"
              value={pricingForm.vendorEmail}
              onChange={(event) =>
                updatePricingField(
                  "vendorEmail",
                  event.currentTarget.value
                )
              }
            />

            <TextInput
              type="date"
              label="Quote Date"
              value={pricingForm.quoteDate}
              onChange={(event) =>
                updatePricingField(
                  "quoteDate",
                  event.currentTarget.value
                )
              }
            />

            <TextInput
              type="date"
              label="Quote Expiration"
              value={pricingForm.quoteExpiration}
              onChange={(event) =>
                updatePricingField(
                  "quoteExpiration",
                  event.currentTarget.value
                )
              }
            />
          </SimpleGrid>

          <SimpleGrid
            cols={{
              base: 1,
              sm: 2,
              lg: 4,
            }}
          >
            <NumberInput
              label="Unit Cost"
              min={0}
              decimalScale={2}
              fixedDecimalScale
              prefix="$"
              value={pricingForm.unitCost}
              onChange={(value) =>
                updatePricingField("unitCost", value)
              }
            />

            <NumberInput
              label="Freight"
              min={0}
              decimalScale={2}
              fixedDecimalScale
              prefix="$"
              value={pricingForm.freightCost}
              onChange={(value) =>
                updatePricingField("freightCost", value)
              }
            />

            <NumberInput
              label="Tax"
              min={0}
              decimalScale={2}
              fixedDecimalScale
              prefix="$"
              value={pricingForm.taxCost}
              onChange={(value) =>
                updatePricingField("taxCost", value)
              }
            />

            <NumberInput
              label="Other"
              min={0}
              decimalScale={2}
              fixedDecimalScale
              prefix="$"
              value={pricingForm.otherCost}
              onChange={(value) =>
                updatePricingField("otherCost", value)
              }
            />
          </SimpleGrid>

          <SimpleGrid
            cols={{
              base: 1,
              md: 2,
            }}
          >
            <NumberInput
              label="Customer Markup"
              min={0}
              decimalScale={2}
              suffix="%"
              value={pricingForm.markupPercent}
              onChange={(value) =>
                updatePricingField("markupPercent", value)
              }
            />

            <NumberInput
              label="Lead Time"
              min={0}
              suffix=" days"
              value={pricingForm.leadTimeDays}
              onChange={(value) =>
                updatePricingField("leadTimeDays", value)
              }
            />
          </SimpleGrid>

          <SimpleGrid
            cols={{
              base: 1,
              md: 2,
            }}
          >
            <Card
              withBorder
              radius="lg"
              p="md"
            >
              <Text size="sm" c="dimmed">
                Vendor Quote Total
              </Text>

              <Title order={3}>
                {money(
                  quotedTotalPreview
                )}
              </Title>
            </Card>

            <Card
              withBorder
              radius="lg"
              p="md"
            >
              <Text size="sm" c="dimmed">
                Customer Material Price
              </Text>

              <Title order={3}>
                {money(
                  customerPricePreview
                )}
              </Title>
            </Card>
          </SimpleGrid>

          <Textarea
            label="Pricing Notes"
            minRows={3}
            value={pricingForm.pricingNotes}
            onChange={(event) =>
              updatePricingField(
                "pricingNotes",
                event.currentTarget.value
              )
            }
          />

          <Group justify="flex-end">
            <Button
              variant="light"
              color="gray"
              onClick={() =>
                setPricingOpen(false)
              }
            >
              Cancel
            </Button>

            <Button
              color="red"
              loading={saving}
              onClick={savePricing}
            >
              Save Material Pricing
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={orderingOpen}
        onClose={() =>
          setOrderingOpen(false)
        }
        title="Place Material Order"
        size="lg"
        centered
      >
        <Stack>
          <Card
            withBorder
            radius="lg"
            p="md"
          >
            <Text fw={700}>
              {getProjectIdentity(
                selectedRequest?.projects ||
                  {},
                customers[
                  selectedRequest?.projects
                    ?.customer_id
                ]
              )}
            </Text>

            <Text size="sm">
              {selectedRequest?.quantity || 0}
              {" × "}
              {selectedRequest?.item_name || ""}
            </Text>

            <Text size="sm" c="dimmed">
              Vendor:{" "}
              {selectedRequest?.vendor_name ||
                "Not set"}
            </Text>

            <Text size="sm">
              Vendor quote:{" "}
              {money(
                selectedRequest?.quoted_total
              )}
            </Text>
          </Card>

          <TextInput
            label="Purchase Order / Reference"
            value={orderingForm.purchaseOrder}
            onChange={(event) =>
              updateOrderingField(
                "purchaseOrder",
                event.currentTarget.value
              )
            }
          />

          <TextInput
            label="Vendor Invoice"
            value={orderingForm.vendorInvoice}
            onChange={(event) =>
              updateOrderingField(
                "vendorInvoice",
                event.currentTarget.value
              )
            }
          />

          <NumberInput
            label="Final Ordered Cost"
            min={0}
            decimalScale={2}
            fixedDecimalScale
            prefix="$"
            value={orderingForm.orderedCost}
            onChange={(value) =>
              updateOrderingField("orderedCost", value)
            }
          />

          <Textarea
            label="Ordering Notes"
            minRows={3}
            value={orderingForm.orderingNotes}
            onChange={(event) =>
              updateOrderingField(
                "orderingNotes",
                event.currentTarget.value
              )
            }
          />

          <Group justify="flex-end">
            <Button
              variant="light"
              color="gray"
              onClick={() =>
                setOrderingOpen(false)
              }
            >
              Cancel
            </Button>

            <Button
              color="blue"
              loading={saving}
              onClick={placeOrder}
            >
              Mark Ordered
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={receivingOpen}
        onClose={() =>
          setReceivingOpen(false)
        }
        title="Receive Material"
        size="md"
        centered
      >
        <Stack>
          <Card
            withBorder
            radius="lg"
            p="md"
          >
            <Text fw={700}>
              {getProjectIdentity(
                selectedRequest?.projects ||
                  {},
                customers[
                  selectedRequest?.projects
                    ?.customer_id
                ]
              )}
            </Text>

            <Text size="sm">
              {selectedRequest?.item_name || ""}
            </Text>

            <Text size="sm">
              Ordered:{" "}
              {selectedRequest?.quantity || 0}
            </Text>

            <Text size="sm">
              Already received:{" "}
              {selectedRequest?.quantity_received ||
                0}
            </Text>

            <Text size="sm">
              Remaining:{" "}
              {Math.max(
                Number(
                  selectedRequest?.quantity ||
                    0
                ) -
                  Number(
                    selectedRequest?.quantity_received ||
                      0
                  ),
                0
              )}
            </Text>
          </Card>

          <NumberInput
            label="Quantity Received"
            min={0.01}
            decimalScale={2}
            value={receiveQuantity}
            onChange={setReceiveQuantity}
          />

          <Group justify="flex-end">
            <Button
              variant="light"
              color="gray"
              onClick={() =>
                setReceivingOpen(false)
              }
            >
              Cancel
            </Button>

            <Button
              color="green"
              loading={saving}
              onClick={receiveMaterial}
            >
              Save Receiving
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

export default Procurement;