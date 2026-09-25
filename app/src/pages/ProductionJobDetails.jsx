import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  FileButton,
  Group,
  Image,
  Loader,
  Modal,
  Paper,
  Progress,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconBuildingFactory2,
  IconCalendar,
  IconCash,
  IconCheck,
  IconClipboardCheck,
  IconClock,
  IconExternalLink,
  IconHistory,
  IconMail,
  IconPackage,
  IconPhoto,
  IconPhone,
  IconRefresh,
  IconRoute,
  IconUpload,
  IconUser,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";

import { supabase } from "../lib/supabase";
import MWPageHeader from "../components/ui/MWPageHeader";
import MWSection from "../components/ui/MWSection";
import { uploadOrderImages } from "../services/orderImageService";

const DESIGN_WORK_OPTIONS = [
  "New Design Required",
  "Existing Logo — Placement Only",
  "Design Already on File",
  "Customer-Supplied Cut-Ready File",
  "Design Changes Required",
];

function parseDesignInstructions(notes) {
  const lines = String(notes || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const fileLine = lines.find((line) =>
    line.toLowerCase().startsWith("design file:")
  );

  return {
    workType: lines[0] || "New Design Required",
    fileName: fileLine?.slice(fileLine.indexOf(":") + 1).trim() || "",
    description: lines
      .slice(1)
      .filter((line) => !line.toLowerCase().startsWith("design file:"))
      .join("\n"),
  };
}

function ProductionJobDetails({ selectedProductionJob, setPage }) {
  const [job, setJob] = useState(selectedProductionJob || null);
  const [customer, setCustomer] = useState(null);
  const [order, setOrder] = useState(null);
  const [orderItems, setOrderItems] = useState([]);
  const [productsById, setProductsById] = useState({});
  const [workOrders, setWorkOrders] = useState([]);
  const [referenceImages, setReferenceImages] = useState([]);
  const [payments, setPayments] = useState([]);
  const [materialRequests, setMaterialRequests] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [designModalOpen, setDesignModalOpen] = useState(false);
  const [savingDesignInstructions, setSavingDesignInstructions] = useState(false);
  const [designDraft, setDesignDraft] = useState(parseDesignInstructions(""));
  const [errorMessage, setErrorMessage] = useState("");

  function openDesignInstructions() {
    setDesignDraft(parseDesignInstructions(order?.design_notes));
    setDesignModalOpen(true);
  }

  async function saveDesignInstructions() {
    if (!order?.id) return;

    setSavingDesignInstructions(true);
    try {
      const designNotes = [
        designDraft.workType,
        designDraft.fileName.trim()
          ? `Design file: ${designDraft.fileName.trim()}`
          : "",
        designDraft.description.trim(),
      ]
        .filter(Boolean)
        .join("\n");
      const { error } = await supabase
        .from("customer_orders")
        .update({ design_notes: designNotes })
        .eq("id", order.id);

      if (error) throw error;
      await loadJobFolder();
      setDesignModalOpen(false);
      notifications.show({
        title: "Design Instructions Updated",
        message: "The work type, file name, and placement notes are now visible to Production.",
        color: "green",
      });
    } catch (error) {
      console.error(error);
      notifications.show({
        title: "Design Instructions Could Not Be Saved",
        message: error?.message || "Please try again.",
        color: "red",
      });
    } finally {
      setSavingDesignInstructions(false);
    }
  }

  async function addReferenceFiles(files) {
    const selectedFiles = Array.from(files || []);
    if (!selectedFiles.length) return;

    if (!job?.customer_order_id) {
      notifications.show({
        title: "Order Link Required",
        message: "This production job must be connected to a customer order before artwork can be added.",
        color: "orange",
      });
      return;
    }

    setUploadingFiles(true);
    try {
      await uploadOrderImages(job.customer_order_id, selectedFiles, "Production Reference");
      await loadJobFolder();
      notifications.show({
        title: "Files Added",
        message: `${selectedFiles.length} artwork or reference file${selectedFiles.length === 1 ? " was" : "s were"} added to this job.`,
        color: "green",
      });
    } catch (error) {
      console.error(error);
      notifications.show({
        title: "Files Could Not Be Added",
        message: error?.message || "The selected files could not be uploaded.",
        color: "red",
      });
    } finally {
      setUploadingFiles(false);
    }
  }

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

      const [
        orderResult,
        itemsResult,
        workOrdersResult,
        imageResult,
        paymentResult,
        activityResult,
        materialResult,
      ] = await Promise.all([
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
        jobData.customer_order_id
          ? supabase
              .from("customer_order_reference_images")
              .select("*")
              .eq("customer_order_id", jobData.customer_order_id)
              .order("sort_order", { ascending: true })
          : Promise.resolve({ data: [], error: null }),
        jobData.customer_order_id
          ? supabase
              .from("customer_order_payments")
              .select("*")
              .eq("customer_order_id", jobData.customer_order_id)
              .order("payment_date", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from("work_order_activity")
          .select("*")
          .eq("production_job_id", jobData.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("material_requests")
          .select("*, material_request_items(*)")
          .in(
            "source_id",
            [jobData.id, jobData.customer_order_id]
              .filter(Boolean)
              .map(String)
          )
          .order("created_at", { ascending: false }),
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
        workOrdersResult.error ||
        imageResult.error ||
        paymentResult.error ||
        activityResult.error ||
        materialResult.error;

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
      setReferenceImages(imageResult.data || []);
      setPayments(paymentResult.data || []);
      setActivity(activityResult.data || []);
      setMaterialRequests(materialResult.data || []);
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
    if (status === "Blocked") return "red";
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

  function money(value) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(Number(value || 0));
  }

  function readinessColor(complete, warning = false) {
    if (complete) return "green";
    return warning ? "orange" : "red";
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
  const blockedStep = workOrders.find(
    (workOrder) => workOrder.status === "Blocked" || workOrder.blocked_reason
  );
  const totalPaid = payments.reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0
  );
  const orderTotal = Number(order?.order_total || order?.total_amount || 0);
  const recordedPaid = Math.max(totalPaid, Number(order?.amount_paid || 0));
  const balanceDue = Math.max(
    0,
    Number.isFinite(Number(order?.balance_due)) && order?.balance_due !== null
      ? Number(order.balance_due)
      : orderTotal - recordedPaid
  );
  const designReady =
    order?.design_needed === false ||
    ["Existing Design", "Ready for Laser", "Approved", "Completed"].includes(
      order?.design_status
    );
  const paymentReady =
    orderTotal === 0 ||
    order?.deposit_received ||
    recordedPaid > 0 ||
    order?.final_payment_received;
  const materialsReady =
    materialRequests.length === 0 ||
    materialRequests.every((request) =>
      ["Fulfilled", "Received", "Completed", "Cancelled"].includes(request.status)
    );
  const designInstructions = parseDesignInstructions(order?.design_notes);
  const nextAction = blockedStep
    ? `Resolve ${blockedStep.step_name || blockedStep.department}: ${blockedStep.blocked_reason || "production is blocked"}`
    : inProgressStep
      ? `Complete ${inProgressStep.step_name || inProgressStep.department}`
      : readyStep
        ? `Start ${readyStep.step_name || readyStep.department}`
        : workOrders.length > 0 && completedSteps === workOrders.length
          ? "Complete final office closeout"
          : "Review the production route and assign the next station";

  return (
    <>
      <Modal
        opened={designModalOpen}
        onClose={() => setDesignModalOpen(false)}
        title="Edit Design Instructions"
        centered
        size="lg"
      >
        <Stack gap="md">
          <Select
            label="What does Design need to do?"
            data={DESIGN_WORK_OPTIONS}
            value={designDraft.workType}
            onChange={(value) =>
              setDesignDraft((current) => ({
                ...current,
                workType: value || "New Design Required",
              }))
            }
            searchable
            allowDeselect={false}
          />
          <TextInput
            label="Existing File Name / Search Name"
            description="Enter the CorelDRAW, SVG, DXF, PDF, or customer file name so it is easy to find."
            placeholder="Example: Robert_AirForce_Logo.cdr"
            value={designDraft.fileName}
            onChange={(event) =>
              setDesignDraft((current) => ({
                ...current,
                fileName: event.currentTarget.value,
              }))
            }
          />
          <Textarea
            label="Placement / Design Instructions"
            description="Explain where the logo goes, required size, holes, weld points, layers, or other details."
            placeholder="Place the existing logo centered on the 24-inch flag..."
            minRows={4}
            autosize
            value={designDraft.description}
            onChange={(event) =>
              setDesignDraft((current) => ({
                ...current,
                description: event.currentTarget.value,
              }))
            }
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setDesignModalOpen(false)}>
              Cancel
            </Button>
            <Button
              color="red"
              loading={savingDesignInstructions}
              onClick={saveDesignInstructions}
            >
              Save Design Instructions
            </Button>
          </Group>
        </Stack>
      </Modal>

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

      <Alert
        mb="lg"
        color={blockedStep ? "red" : inProgressStep ? "blue" : "orange"}
        icon={<IconRoute size={20} />}
        title="Next Action"
      >
        <Group justify="space-between" align="center" gap="md">
          <Text fw={800}>{nextAction}</Text>
          {currentStep?.assigned_to && (
            <Badge color="dark" variant="filled">
              Owner: {currentStep.assigned_to}
            </Badge>
          )}
        </Group>
      </Alert>

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

      <MWSection
        title="Release Readiness"
        subtitle="The checks that should be clear before work advances"
        mt="lg"
      >
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
          {[
            {
              label: "Artwork / Approval",
              value: order?.design_status || (order?.design_needed === false ? "On file" : "Not recorded"),
              complete: designReady,
              icon: IconClipboardCheck,
            },
            {
              label: "Payment",
              value: paymentReady ? `${money(recordedPaid)} received` : "Deposit not recorded",
              complete: paymentReady,
              icon: IconCash,
            },
            {
              label: "Materials",
              value: materialRequests.length
                ? `${materialRequests.filter((request) => ["Fulfilled", "Received", "Completed"].includes(request.status)).length}/${materialRequests.length} ready`
                : "No request required",
              complete: materialsReady,
              icon: IconPackage,
            },
            {
              label: "Station Assignment",
              value: currentStep?.assigned_to || "Not assigned",
              complete: Boolean(currentStep?.assigned_to) || completedSteps === workOrders.length,
              warning: true,
              icon: IconUser,
            },
          ].map((check) => {
            const CheckIcon = check.icon;
            return (
              <Paper key={check.label} withBorder radius="lg" p="md">
                <Group wrap="nowrap" align="flex-start">
                  <CheckIcon size={22} color={check.complete ? "#40c057" : check.warning ? "#fab005" : "#fa5252"} />
                  <div>
                    <Text size="xs" fw={900} c="dimmed">{check.label.toUpperCase()}</Text>
                    <Text fw={900}>{check.value}</Text>
                    <Badge mt={6} color={readinessColor(check.complete, check.warning)} variant="light">
                      {check.complete ? "Ready" : check.warning ? "Needs owner" : "Needs attention"}
                    </Badge>
                  </div>
                </Group>
              </Paper>
            );
          })}
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
                  {customer?.phone ? (
                    <Button component="a" href={`tel:${customer.phone}`} variant="subtle" color="gray" p={0} leftSection={<IconPhone size={15} />}>
                      {customer.phone}
                    </Button>
                  ) : <Text fw={700}>Not provided</Text>}
                </div>
                <div>
                  <Text size="xs" fw={800} c="dimmed">
                    EMAIL
                  </Text>
                  {customer?.email ? (
                    <Button component="a" href={`mailto:${customer.email}`} variant="subtle" color="gray" p={0} leftSection={<IconMail size={15} />}>
                      {customer.email}
                    </Button>
                  ) : <Text fw={700}>Not provided</Text>}
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

          <MWSection
            title="Design Instructions"
            subtitle="What Design needs to do and where to find the artwork"
            action={
              <Button
                color="red"
                variant="light"
                leftSection={<IconClipboardCheck size={17} />}
                onClick={openDesignInstructions}
              >
                Edit Instructions
              </Button>
            }
          >
            <Stack gap="md">
              <Card withBorder radius="lg" p="md">
                <Stack gap="sm">
                  <div>
                    <Text size="xs" fw={900} c="dimmed">DESIGN WORK</Text>
                    <Badge color="violet" variant="light" size="lg" mt={4}>
                      {designInstructions.workType}
                    </Badge>
                  </div>
                  <Divider />
                  <div>
                    <Text size="xs" fw={900} c="dimmed">FIND FILE</Text>
                    <Text fw={800} mt={3}>
                      {designInstructions.fileName || "No file name or search location entered"}
                    </Text>
                  </div>
                  <Divider />
                  <div>
                    <Text size="xs" fw={900} c="dimmed">PLACEMENT / DESIGN NOTES</Text>
                    <Text mt={3} style={{ whiteSpace: "pre-wrap" }}>
                      {designInstructions.description || "No placement or design instructions entered."}
                    </Text>
                  </div>
                </Stack>
              </Card>
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

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg" mt="lg">
        <MWSection
          title="Artwork & Reference Files"
          subtitle={`${referenceImages.length} connected file${referenceImages.length === 1 ? "" : "s"}`}
        >
          <Group justify="space-between" align="center" mb="md" wrap="wrap">
            <Text size="sm" c="dimmed">Add customer artwork, design proofs, or production reference images.</Text>
            <FileButton
              onChange={addReferenceFiles}
              accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml,application/pdf"
              multiple
            >
              {(props) => (
                <Button {...props} color="red" leftSection={<IconUpload size={17} />} loading={uploadingFiles}>
                  Add Images / Files
                </Button>
              )}
            </FileButton>
          </Group>
          {referenceImages.length === 0 ? (
            <Card withBorder radius="lg" p="xl">
              <Stack align="center" gap="xs">
                <IconPhoto size={30} color="#8b8f97" />
                <Text c="dimmed">No artwork or customer reference image is attached.</Text>
              </Stack>
            </Card>
          ) : (
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              {referenceImages.map((image) => (
                <Card key={image.id} withBorder radius="lg" p="xs">
                  <Image src={image.image_url} alt={image.caption || image.image_type || "Order artwork"} h={190} fit="contain" radius="md" />
                  <Group justify="space-between" mt="sm" wrap="nowrap">
                    <div>
                      <Text fw={800} lineClamp={1}>{image.caption || image.image_type || "Reference file"}</Text>
                      <Text size="xs" c="dimmed">{image.show_on_work_order ? "Included on work order" : "Internal reference"}</Text>
                    </div>
                    <Button component="a" href={image.image_url} target="_blank" rel="noreferrer" variant="subtle" color="gray" px="xs" aria-label="Open file">
                      <IconExternalLink size={18} />
                    </Button>
                  </Group>
                </Card>
              ))}
            </SimpleGrid>
          )}
        </MWSection>

        <MWSection title="Payment & Balance" subtitle="Amounts recorded against the source order">
          <SimpleGrid cols={3} spacing="sm" mb="md">
            <Paper withBorder p="md" radius="lg"><Text size="xs" c="dimmed" fw={900}>ORDER TOTAL</Text><Text fw={900} fz="lg">{money(orderTotal)}</Text></Paper>
            <Paper withBorder p="md" radius="lg"><Text size="xs" c="dimmed" fw={900}>PAID</Text><Text fw={900} fz="lg" c="green">{money(recordedPaid)}</Text></Paper>
            <Paper withBorder p="md" radius="lg"><Text size="xs" c="dimmed" fw={900}>BALANCE</Text><Text fw={900} fz="lg" c={balanceDue > 0 ? "orange" : "green"}>{money(balanceDue)}</Text></Paper>
          </SimpleGrid>
          <Stack gap="xs">
            {payments.length === 0 ? <Text c="dimmed">No individual payment entries are recorded.</Text> : payments.map((payment) => (
              <Group key={payment.id} justify="space-between" p="sm" style={{ borderBottom: "1px solid var(--mantine-color-dark-4)" }}>
                <div><Text fw={800}>{payment.payment_type || "Payment"}</Text><Text size="xs" c="dimmed">{formatDate(payment.payment_date)} · {payment.payment_method || "Method not entered"}</Text></div>
                <Text fw={900} c="green">{money(payment.amount)}</Text>
              </Group>
            ))}
          </Stack>
        </MWSection>
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg" mt="lg">
        <MWSection title="Material Readiness" subtitle="Requests connected to this order or production job">
          <Stack gap="sm">
            {materialRequests.length === 0 ? <Text c="dimmed">No material request is connected. This job can use stock or does not require a request.</Text> : materialRequests.map((request) => (
              <Card key={request.id} withBorder radius="lg" p="md">
                <Group justify="space-between" align="flex-start">
                  <div><Text fw={900}>{request.request_number || request.source_title || "Material request"}</Text><Text size="sm" c="dimmed">{request.item_count || request.material_request_items?.length || 0} items · Needed {formatDate(request.needed_by)}</Text></div>
                  <Badge color={statusColor(request.status)} variant="light">{request.status || "Open"}</Badge>
                </Group>
                {(request.shortage_count > 0 || request.blocked_work) && <Alert mt="sm" color="orange" icon={<IconAlertTriangle size={16} />}>{request.shortage_count || 0} shortages recorded{request.blocked_work ? " · Production blocked" : ""}</Alert>}
              </Card>
            ))}
          </Stack>
        </MWSection>

        <MWSection title="Workflow History" subtitle="Who changed the job and when">
          <Stack gap="sm">
            {activity.length === 0 ? <Text c="dimmed">No workflow activity has been recorded yet.</Text> : activity.slice(0, 12).map((entry) => (
              <Group key={entry.id} align="flex-start" wrap="nowrap">
                <IconHistory size={18} color="#ff2b2b" style={{ marginTop: 3 }} />
                <div style={{ flex: 1 }}>
                  <Group justify="space-between" gap="sm"><Text fw={800}>{entry.event_type?.replaceAll("_", " ") || "Workflow update"}</Text><Text size="xs" c="dimmed">{formatDate(entry.created_at, true)}</Text></Group>
                  <Text size="sm" c="dimmed">{[entry.from_department && entry.to_department ? `${entry.from_department} → ${entry.to_department}` : null, entry.from_status && entry.to_status ? `${entry.from_status} → ${entry.to_status}` : null, entry.actor ? `by ${entry.actor}` : null].filter(Boolean).join(" · ")}</Text>
                  {entry.notes && <Text size="sm" mt={3}>{entry.notes}</Text>}
                </div>
              </Group>
            ))}
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

                    <SimpleGrid cols={2} spacing="xs">
                      <div><Text size="xs" c="dimmed" fw={800}>OWNER</Text><Text size="sm" fw={700}>{workOrder.assigned_to || "Unassigned"}</Text></div>
                      <div><Text size="xs" c="dimmed" fw={800}>PRIORITY</Text><Text size="sm" fw={700}>{workOrder.priority || "Normal"}</Text></div>
                    </SimpleGrid>

                    {workOrder.blocked_reason && (
                      <Alert color="red" icon={<IconAlertTriangle size={16} />}>
                        {workOrder.blocked_reason}
                      </Alert>
                    )}

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
