import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Loader,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconBuildingFactory2,
  IconCalendar,
  IconCheck,
  IconClock,
  IconPackage,
  IconRefresh,
  IconUser,
} from "@tabler/icons-react";

import { supabase } from "../lib/supabase";
import MWPageHeader from "../components/ui/MWPageHeader";
import MWSection from "../components/ui/MWSection";

function ProductionJobDetails({ selectedProductionJob, setPage }) {
  const [job, setJob] = useState(selectedProductionJob || null);
  const [customer, setCustomer] = useState(null);
  const [order, setOrder] = useState(null);
  const [orderItems, setOrderItems] = useState([]);
  const [productsById, setProductsById] = useState({});
  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const loadJobFolder = useCallback(async () => {
    if (!selectedProductionJob?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const { data: jobData, error: jobError } = await supabase
        .from("production_jobs")
        .select("*")
        .eq("id", selectedProductionJob.id)
        .single();

      if (jobError) throw jobError;

      setJob(jobData);

      const [orderResult, itemsResult, workOrdersResult] = await Promise.all([
        jobData.customer_order_id
          ? supabase
              .from("customer_orders")
              .select("*")
              .eq("id", jobData.customer_order_id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        jobData.customer_order_id
          ? supabase
              .from("customer_order_items")
              .select("*")
              .eq("order_id", jobData.customer_order_id)
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from("work_orders")
          .select("*")
          .eq("production_job_id", jobData.id)
          .order("step_order", { ascending: true }),
      ]);

      const resolvedCustomerId =
        jobData.customer_id || orderResult.data?.customer_id;
      const customerResult = resolvedCustomerId
        ? await supabase
            .from("customers")
            .select("*")
            .eq("id", resolvedCustomerId)
            .maybeSingle()
        : { data: null, error: null };

      const relatedError =
        orderResult.error ||
        customerResult.error ||
        itemsResult.error ||
        workOrdersResult.error;

      if (relatedError) throw relatedError;

      const nextItems = itemsResult.data || [];
      const productIds = [
        ...new Set(
          nextItems
            .map((item) => item.product_template_id)
            .filter(Boolean)
        ),
      ];

      let productMap = {};

      if (productIds.length > 0) {
        const { data: productData, error: productError } = await supabase
          .from("product_templates")
          .select("*")
          .in("id", productIds);

        if (productError) throw productError;

        productMap = Object.fromEntries(
          (productData || []).map((product) => [product.id, product])
        );
      }

      setCustomer(customerResult.data || null);
      setOrder(orderResult.data || null);
      setOrderItems(nextItems);
      setProductsById(productMap);
      setWorkOrders(workOrdersResult.data || []);
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error?.message || "The production job folder could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }, [selectedProductionJob?.id]);

  useEffect(() => {
    loadJobFolder();
  }, [loadJobFolder]);

  const customerName = useMemo(() => {
    if (!customer) return "Customer not available";

    return (
      `${customer.first_name || ""} ${customer.last_name || ""}`.trim() ||
      customer.contact_name ||
      customer.name ||
      customer.company_name ||
      "Unnamed Customer"
    );
  }, [customer]);

  const companyName = useMemo(() => {
    if (!customer?.company_name || customer.company_name === customerName) {
      return "";
    }

    return customer.company_name;
  }, [customer, customerName]);

  const itemNames = useMemo(() => {
    const names = orderItems
      .map((item) => {
        const product = productsById[item.product_template_id];
        return (
          product?.name ||
          item.item_name ||
          item.description ||
          item.notes
        );
      })
      .filter(Boolean);

    return names.length
      ? [...new Set(names)].join(", ")
      : "Unspecified Product";
  }, [orderItems, productsById]);

  const jobDisplayName = `${customerName} — ${itemNames}`;

  const completedSteps = workOrders.filter(
    (workOrder) => workOrder.status === "Completed"
  ).length;

  const inProgressStep = workOrders.find(
    (workOrder) => workOrder.status === "In Progress"
  );

  const readyStep = workOrders.find(
    (workOrder) => workOrder.status === "Ready"
  );

  const progressPercent =
    workOrders.length > 0
      ? Math.round((completedSteps / workOrders.length) * 100)
      : Number(job?.progress_percent || 0);

  function statusColor(status) {
    if (status === "Completed") return "green";
    if (status === "In Progress") return "blue";
    if (status === "Ready") return "red";
    if (status === "On Hold") return "orange";
    if (status === "Cancelled") return "gray";
    return "dark";
  }

  function formatDate(value, includeTime = false) {
    if (!value) return "Not set";

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;

    return parsed.toLocaleString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
      ...(includeTime
        ? { hour: "numeric", minute: "2-digit" }
        : {}),
    });
  }

  function getOrderNumber() {
    return (
      order?.order_number ||
      order?.customer_order_number ||
      (job?.customer_order_id ? `Order #${job.customer_order_id}` : "Not linked")
    );
  }

  function getLineQuantity(item) {
    return item.quantity ?? item.qty ?? 1;
  }

  if (loading) {
    return (
      <MWSection title="Production Job Folder">
        <Group justify="center" py="xl">
          <Loader color="red" />
          <Text c="dimmed">Loading production job...</Text>
        </Group>
      </MWSection>
    );
  }

  if (!job) {
    return (
      <>
        <MWPageHeader
          title="Production Job"
          subtitle="No production job is currently selected."
        />

        <MWSection title="Job Not Found">
          <Stack>
            {errorMessage && (
              <Alert
                color="red"
                icon={<IconAlertTriangle size={18} />}
                title="Unable to Load Job"
              >
                {errorMessage}
              </Alert>
            )}

            <Text c="dimmed">
              Return to Production Control and open a production job.
            </Text>

            <Button
              color="red"
              leftSection={<IconArrowLeft size={18} />}
              onClick={() => setPage("productionControl")}
            >
              Back to Production
            </Button>
          </Stack>
        </MWSection>
      </>
    );
  }

  const currentStep = inProgressStep || readyStep;

  return (
    <>
      <MWPageHeader
        title={jobDisplayName}
        subtitle={[
          companyName,
          getOrderNumber(),
          job.production_job_number,
          job.current_department || "No department assigned",
        ]
          .filter(Boolean)
          .join(" • ")}
        buttonText="Production Control"
        onButtonClick={() => setPage("productionControl")}
      />

      {errorMessage && (
        <Alert
          mb="lg"
          color="red"
          icon={<IconAlertTriangle size={18} />}
          title="Job Folder Warning"
          withCloseButton
          onClose={() => setErrorMessage("")}
        >
          {errorMessage}
        </Alert>
      )}

      <MWSection
        title="Production Overview"
        subtitle="Live status for this connected customer order"
        rightSection={
          <Button
            variant="subtle"
            color="gray"
            leftSection={<IconRefresh size={17} />}
            onClick={loadJobFolder}
          >
            Refresh
          </Button>
        }
      >
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
          <Card withBorder radius="lg" p="md">
            <Group justify="space-between" align="flex-start">
              <div>
                <Text size="xs" fw={800} c="dimmed">
                  JOB STATUS
                </Text>
                <Title order={3} mt={4}>
                  {job.status || "Unknown"}
                </Title>
              </div>
              <Badge color={job.rush ? "red" : "gray"} variant="light">
                {job.rush ? "Rush" : "Normal"}
              </Badge>
            </Group>
          </Card>

          <Card withBorder radius="lg" p="md">
            <Group gap="sm" align="flex-start">
              <IconBuildingFactory2 size={22} color="#ff2b2b" />
              <div>
                <Text size="xs" fw={800} c="dimmed">
                  CURRENT STEP
                </Text>
                <Title order={3} mt={4}>
                  {currentStep?.step_name ||
                    job.current_department ||
                    "Not assigned"}
                </Title>
              </div>
            </Group>
          </Card>

          <Card withBorder radius="lg" p="md">
            <Group gap="sm" align="flex-start">
              <IconCalendar size={22} color="#ff2b2b" />
              <div>
                <Text size="xs" fw={800} c="dimmed">
                  DUE DATE
                </Text>
                <Title order={3} mt={4}>
                  {formatDate(job.due_date)}
                </Title>
              </div>
            </Group>
          </Card>

          <Card withBorder radius="lg" p="md">
            <Text size="xs" fw={800} c="dimmed">
              PRODUCTION PROGRESS
            </Text>
            <Group justify="space-between" mt={4} mb="xs">
              <Title order={3}>{progressPercent}%</Title>
              <Text size="sm" c="dimmed">
                {completedSteps}/{workOrders.length} steps
              </Text>
            </Group>
            <Progress value={progressPercent} color="red" size="md" radius="xl" />
          </Card>
        </SimpleGrid>
      </MWSection>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg" mt="lg">
        <Stack gap="lg">
          <MWSection title="Customer & Order" subtitle="Source order information">
            <Stack gap="md">
              <Group gap="sm" align="flex-start" wrap="nowrap">
                <IconUser size={22} color="#ff2b2b" />
                <div>
                  <Title order={3}>{customerName}</Title>
                  {companyName && <Text fw={700}>{companyName}</Text>}
                  <Text c="dimmed">
                    {getOrderNumber()}
                    {job.production_job_number
                      ? ` • ${job.production_job_number}`
                      : ""}
                  </Text>
                </div>
              </Group>

              <Divider />

              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                <div>
                  <Text size="xs" fw={800} c="dimmed">
                    PHONE
                  </Text>
                  <Text fw={700}>{customer?.phone || "Not provided"}</Text>
                </div>
                <div>
                  <Text size="xs" fw={800} c="dimmed">
                    EMAIL
                  </Text>
                  <Text fw={700}>{customer?.email || "Not provided"}</Text>
                </div>
                <div>
                  <Text size="xs" fw={800} c="dimmed">
                    ORDER STATUS
                  </Text>
                  <Badge color="red" variant="light" mt={4}>
                    {order?.status || "Not available"}
                  </Badge>
                </div>
                <div>
                  <Text size="xs" fw={800} c="dimmed">
                    STARTING DEPARTMENT
                  </Text>
                  <Text fw={700}>
                    {order?.starting_department || "Not set"}
                  </Text>
                </div>
              </SimpleGrid>
            </Stack>
          </MWSection>

          <MWSection title="Production Notes" subtitle="Order and job instructions">
            <Card withBorder radius="lg" p="md">
              <Text style={{ whiteSpace: "pre-wrap" }}>
                {order?.notes || job.notes || "No production notes were entered."}
              </Text>
            </Card>
          </MWSection>
        </Stack>

        <MWSection
          title="Products"
          subtitle={`${orderItems.length} order line${
            orderItems.length === 1 ? "" : "s"
          } connected to this job`}
        >
          <Stack gap="md">
            {orderItems.length === 0 && (
              <Card withBorder radius="lg" p="xl">
                <Stack align="center" gap="xs">
                  <IconPackage size={30} color="#8b8f97" />
                  <Text c="dimmed">No product lines are connected.</Text>
                </Stack>
              </Card>
            )}

            {orderItems.map((item, index) => {
              const product = productsById[item.product_template_id];

              return (
                <Card key={item.id || index} withBorder radius="lg" p="md">
                  <Stack gap="sm">
                    <Group justify="space-between" align="flex-start">
                      <div>
                        <Badge color="red" variant="light" mb="xs">
                          {product?.category || "Product"}
                        </Badge>
                        <Title order={4}>
                          {product?.name ||
                            item.item_name ||
                            item.description ||
                            "Product line"}
                        </Title>
                      </div>
                      <Badge color="gray" variant="filled" size="lg">
                        Qty {getLineQuantity(item)}
                      </Badge>
                    </Group>

                    <SimpleGrid cols={2} spacing="sm">
                      <div>
                        <Text size="xs" fw={800} c="dimmed">SIZE</Text>
                        <Text fw={700}>{product?.size || "Not set"}</Text>
                      </div>
                      <div>
                        <Text size="xs" fw={800} c="dimmed">MATERIAL</Text>
                        <Text fw={700}>{product?.material || "Not set"}</Text>
                      </div>
                      <div>
                        <Text size="xs" fw={800} c="dimmed">FINISH</Text>
                        <Text fw={700}>
                          {product?.default_finish || "Not set"}
                        </Text>
                      </div>
                      <div>
                        <Text size="xs" fw={800} c="dimmed">COLORS</Text>
                        <Text fw={700}>
                          {product?.default_colors || "Not set"}
                        </Text>
                      </div>
                    </SimpleGrid>
                  </Stack>
                </Card>
              );
            })}
          </Stack>
        </MWSection>
      </SimpleGrid>

      <MWSection
        title="Production Route"
        subtitle={`${completedSteps} of ${workOrders.length} workflow steps completed`}
        mt="lg"
      >
        {workOrders.length === 0 ? (
          <Card withBorder radius="lg" p="xl">
            <Text c="dimmed" ta="center">
              No work orders were generated for this production job.
            </Text>
          </Card>
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2, xl: 3 }} spacing="md">
            {workOrders.map((workOrder) => {
              const complete = workOrder.status === "Completed";

              return (
                <Card
                  key={workOrder.id}
                  withBorder
                  radius="lg"
                  p="md"
                  style={{
                    borderColor: complete
                      ? "rgba(46, 204, 113, 0.45)"
                      : workOrder.status === "In Progress"
                        ? "rgba(34, 139, 230, 0.55)"
                        : workOrder.status === "Ready"
                          ? "rgba(220, 38, 38, 0.65)"
                          : undefined,
                  }}
                >
                  <Stack gap="sm">
                    <Group justify="space-between">
                      <Badge color="dark" variant="filled">
                        Step {workOrder.step_order}
                      </Badge>
                      <Badge
                        color={statusColor(workOrder.status)}
                        variant="light"
                        leftSection={
                          complete ? <IconCheck size={12} /> : undefined
                        }
                      >
                        {workOrder.status || "Unknown"}
                      </Badge>
                    </Group>

                    <div>
                      <Title order={4}>{workOrder.step_name}</Title>
                      <Text size="sm" c="dimmed">
                        {workOrder.department || "No department"}
                      </Text>
                    </div>

                    <Text size="xs" c="dimmed">
                      {workOrder.work_order_number || "Work order number not set"}
                    </Text>

                    {(workOrder.started_at || workOrder.completed_at) && (
                      <Stack gap={4}>
                        {workOrder.started_at && (
                          <Group gap={6} wrap="nowrap">
                            <IconClock size={14} color="#8b8f97" />
                            <Text size="xs" c="dimmed">
                              Started {formatDate(workOrder.started_at, true)}
                            </Text>
                          </Group>
                        )}
                        {workOrder.completed_at && (
                          <Group gap={6} wrap="nowrap">
                            <IconCheck size={14} color="#2ecc71" />
                            <Text size="xs" c="dimmed">
                              Completed {formatDate(workOrder.completed_at, true)}
                            </Text>
                          </Group>
                        )}
                      </Stack>
                    )}
                  </Stack>
                </Card>
              );
            })}
          </SimpleGrid>
        )}
      </MWSection>
    </>
  );
}

export default ProductionJobDetails;