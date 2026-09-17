import { useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  FileButton,
  Group,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";

import { supabase } from "../lib/supabase";
import MWPageHeader from "../components/ui/MWPageHeader";
import MWSection from "../components/ui/MWSection";
import { notifications } from "@mantine/notifications";
import {
  canonicalStation,
  completeProductionStep,
  startProductionStep,
} from "../lib/productionWorkflow";
import { uploadOrderImages } from "../components/design/DesignIntakeModal";

function DepartmentQueue({
  department,
  setPage,
  setSelectedProductionJob,
  activeUser,
  accessLevel,
  refreshKey = 0,
  onCreateDesign,
}) {
  const [workOrders, setWorkOrders] = useState([]);
  const [jobDetails, setJobDetails] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadQueue();
  }, [department, refreshKey]);

  async function loadQueue() {
    setLoading(true);

    const { data, error } = await supabase
      .from("work_orders")
      .select("*")
      .eq("department", canonicalStation(department) || department)
      .in("status", ["Ready", "In Progress"])
      .order("step_order", { ascending: true });

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    const queue = data || [];

    setWorkOrders(queue);
    await loadJobDetails(queue);
    setLoading(false);
  }

  async function loadJobDetails(workOrderList) {
    const productionJobIds = [
      ...new Set(
        workOrderList
          .map((workOrder) => workOrder.production_job_id)
          .filter(Boolean)
      ),
    ];

    const details = {};

    for (const productionJobId of productionJobIds) {
      const { data: job } = await supabase
        .from("production_jobs")
        .select("*")
        .eq("id", productionJobId)
        .single();

      if (!job) continue;

      const [orderResult, itemsResult] = await Promise.all([
        job.customer_order_id
          ? supabase
              .from("customer_orders")
              .select("*")
              .eq("id", job.customer_order_id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        job.customer_order_id
          ? supabase
              .from("customer_order_items")
              .select("*")
              .eq("order_id", job.customer_order_id)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (orderResult.error) console.error(orderResult.error);
      if (itemsResult.error) console.error(itemsResult.error);

      const order = orderResult.data || null;
      const items = itemsResult.data || [];
      let project = null;
      if (job.project_id) {
        const { data: projectData, error: projectError } = await supabase
          .from("projects")
          .select("*")
          .eq("id", job.project_id)
          .maybeSingle();
        if (projectError) console.error(projectError);
        project = projectData || null;
      }
      const resolvedCustomerId =
        job.customer_id || order?.customer_id || project?.customer_id;
      let customer = null;

      if (resolvedCustomerId) {
        const { data: customerData, error: customerError } = await supabase
          .from("customers")
          .select("*")
          .eq("id", resolvedCustomerId)
          .maybeSingle();

        if (customerError) console.error(customerError);
        customer = customerData || null;
      }

      let products = [];

      if (items.length) {
        const productIds = [
          ...new Set(
            items
              .map((item) => item.product_template_id)
              .filter(Boolean)
          ),
        ];

        if (productIds.length > 0) {
          const { data: productData } = await supabase
            .from("product_templates")
            .select("*")
            .in("id", productIds);

          products = productData || [];
        }
      }

      details[productionJobId] = {
        job,
        customer,
        order,
        items,
        products,
        project,
      };
    }

    setJobDetails(details);
  }

  function getCustomerName(customer) {
    if (!customer) return "No customer";

    return (
      `${customer.first_name || ""} ${customer.last_name || ""}`.trim() ||
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

  function getProductNames(items, products) {
    const productMap = Object.fromEntries(
      (products || []).map((product) => [product.id, product])
    );
    const names = (items || [])
      .map(
        (item) =>
          productMap[item.product_template_id]?.name ||
          item.item_name ||
          item.description ||
          item.notes
      )
      .filter(Boolean);

    return names.length
      ? [...new Set(names)].join(", ")
      : "Unspecified Product";
  }

  function formatDate(value) {
    if (!value) return "Not set";

    const parsed = new Date(`${value}T12:00:00`);
    if (Number.isNaN(parsed.getTime())) return value;

    return parsed.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function getStatusColor(status) {
    if (status === "Ready") return "blue";
    if (status === "In Progress") return "green";
    return "gray";
  }

  async function openProductionJob(workOrder) {
    const detail = jobDetails[workOrder.production_job_id];

    if (detail?.job) {
      setSelectedProductionJob(detail.job);
      setPage("productionJobDetails");
      return;
    }

    const { data, error } = await supabase
      .from("production_jobs")
      .select("*")
      .eq("id", workOrder.production_job_id)
      .single();

    if (error) {
      console.error(error);
      return;
    }

    setSelectedProductionJob(data);
    setPage("productionJobDetails");
  }

  async function startWorkOrder(workOrder) {
    const order = jobDetails[workOrder.production_job_id]?.order;
    if (
      department === "Design" &&
      order?.design_fee_required &&
      !order?.design_fee_paid &&
      order?.design_fee_status !== "Paid"
    ) {
      notifications.show({
        title: "Design Fee Is Still Pending",
        message: "Record the $50 design fee before starting this new design.",
        color: "orange",
      });
      return;
    }
    try {
      await startProductionStep(workOrder.id, activeUser);
      notifications.show({
        title: "Work Started",
        message: `${workOrder.work_order_number} is now in progress.`,
        color: "green",
      });
      await loadQueue();
    } catch (error) {
      notifications.show({
        title: "Could Not Start Work",
        message: error.message,
        color: "red",
      });
    }
  }

  async function submitDesignForApproval(workOrder, file) {
    const detail = jobDetails[workOrder.production_job_id];
    if (!detail?.order?.id || !file) return;
    try {
      await uploadOrderImages(detail.order.id, [file], "Design Proof");
      const note = `Design proof submitted by ${activeUser || "Design Team"} on ${new Date().toLocaleString()}.`;
      const { error } = await supabase
        .from("customer_orders")
        .update({
          status: "Awaiting Customer Approval",
          design_status: "Awaiting Customer Approval",
          design_notes: [detail.order.design_notes, note].filter(Boolean).join("\n"),
        })
        .eq("id", detail.order.id);
      if (error) throw error;
      notifications.show({
        title: "Ready for Customer Approval",
        message: "The proof is saved. An administrator must confirm the customer approval before Laser.",
        color: "green",
      });
      await loadQueue();
    } catch (error) {
      notifications.show({
        title: "Could Not Submit Design",
        message: error?.message || "The proof could not be submitted.",
        color: "red",
      });
    }
  }

  async function returnDesignForChanges(workOrder) {
    const detail = jobDetails[workOrder.production_job_id];
    if (!detail?.order?.id) return;
    try {
      const note = `Customer changes requested by ${activeUser || "Administrator"} on ${new Date().toLocaleString()}.`;
      const { error } = await supabase
        .from("customer_orders")
        .update({
          status: "In Design",
          design_status: "In Design",
          design_notes: [detail.order.design_notes, note].filter(Boolean).join("\n"),
        })
        .eq("id", detail.order.id);
      if (error) throw error;
      notifications.show({
        title: "Returned to Design",
        message: "The order is back in Kory's In Progress queue.",
        color: "orange",
      });
      await loadQueue();
    } catch (error) {
      notifications.show({ title: "Could Not Return Design", message: error.message, color: "red" });
    }
  }

  async function approveDesign(workOrder) {
    const detail = jobDetails[workOrder.production_job_id];
    if (!detail?.order?.id) return;
    try {
      const result = await completeProductionStep(workOrder.id, activeUser);
      const note = `Customer approval confirmed by ${activeUser || "Administrator"} on ${new Date().toLocaleString()}.`;
      const { error } = await supabase
        .from("customer_orders")
        .update({
          design_status: "Customer Approved",
          design_notes: [detail.order.design_notes, note].filter(Boolean).join("\n"),
        })
        .eq("id", detail.order.id);
      if (error) throw error;
      notifications.show({
        title: "Customer Approval Confirmed",
        message: `${result?.next_department || "Laser"} is now ready to begin.`,
        color: "green",
      });
      await loadQueue();
    } catch (error) {
      notifications.show({ title: "Could Not Approve Design", message: error.message, color: "red" });
    }
  }

  async function completeWorkOrder(workOrder) {
    try {
      const result = await completeProductionStep(workOrder.id, activeUser);
      notifications.show({
        title: result?.completed ? "Production Route Completed" : "Step Completed",
        message: result?.completed
          ? "The order is ready for pickup, shipping, or installation."
          : `${result?.next_department || "The next station"} is now ready.`,
        color: "green",
      });
      await loadQueue();
    } catch (error) {
      notifications.show({
        title: "Could Not Complete Work",
        message: error.message,
        color: "red",
      });
    }
  }

  const readyOrders = workOrders.filter(
    (workOrder) => workOrder.status === "Ready"
  );

  const awaitingApprovalOrders = workOrders.filter((workOrder) => {
    const order = jobDetails[workOrder.production_job_id]?.order;
    return department === "Design" && order?.design_status === "Awaiting Customer Approval";
  });

  const inProgressOrders = workOrders.filter((workOrder) => {
    const order = jobDetails[workOrder.production_job_id]?.order;
    return workOrder.status === "In Progress" && order?.design_status !== "Awaiting Customer Approval";
  });

  const isAdministrator = String(accessLevel || "").toLowerCase().includes("admin");

  function renderWorkOrder(workOrder) {
    const detail = jobDetails[workOrder.production_job_id];
    const job = detail?.job;
    const customer = detail?.customer;
    const order = detail?.order;
    const items = detail?.items || [];
    const products = detail?.products || [];
    const project = detail?.project;
    const customerName = project?.contact_name || getCustomerName(customer);
    const companyName = getCustomerCompany(customer);
    const productNames = getProductNames(items, products);
    const orderNumber =
      order?.order_number ||
      order?.customer_order_number ||
      project?.project_number ||
      "Order not linked";

    return (
      <Card key={workOrder.id} withBorder radius="lg" p="lg">
        <Stack gap="sm">
          <Group justify="space-between">
            <Group gap="xs">
              <Badge color={getStatusColor(workOrder.status)} variant="light">
                {workOrder.status}
              </Badge>
              {department === "Design" && (
                <Badge
                  color={order?.design_fee_required
                    ? (order?.design_fee_paid || order?.design_fee_status === "Paid" ? "green" : "orange")
                    : "gray"}
                  variant="light"
                >
                  {order?.design_fee_required
                    ? (order?.design_fee_paid || order?.design_fee_status === "Paid" ? "$50 Fee Paid" : "$50 Fee Pending")
                    : "No Design Fee"}
                </Badge>
              )}
            </Group>

            {job?.rush && <Badge color="red">Rush</Badge>}
          </Group>

          <Title order={3} style={{ lineHeight: 1.25, overflowWrap: "anywhere" }}>
            {customerName} — {project?.project_name || productNames}
          </Title>

          <Stack gap={2}>
            {companyName && <Text fw={700}>{companyName}</Text>}
            {department === "Design" && order?.design_notes && (
              <Text size="sm"><b>Artwork:</b> {String(order.design_notes).split("\n")[0]}</Text>
            )}
            {department === "Design" && (customer?.phone || customer?.email) && (
              <Text size="sm" c="dimmed">
                {[customer.phone, customer.email].filter(Boolean).join(" • ")}
              </Text>
            )}
            <Text size="sm" c="dimmed">
              {orderNumber}
              {job?.production_job_number
                ? ` • ${job.production_job_number}`
                : ""}
              {workOrder.work_order_number
                ? ` • ${workOrder.work_order_number}`
                : ""}
            </Text>
          </Stack>

          <Card withBorder radius="md" p="sm">
            <Group justify="space-between">
              <Text size="sm">Due Date</Text>

              <Text size="sm" fw={700}>
                {formatDate(job?.due_date)}
              </Text>
            </Group>

            <Group justify="space-between" mt="xs">
              <Text size="sm">Job Progress</Text>

              <Text size="sm" fw={700}>
                {job?.progress_percent || 0}%
              </Text>
            </Group>

            <Progress
              mt="xs"
              value={job?.progress_percent || 0}
              color="red"
              size="sm"
              radius="xl"
            />
          </Card>

          <Group grow>
            <Button
              variant="light"
              color="gray"
              onClick={() => openProductionJob(workOrder)}
            >
              Open Job
            </Button>

            {department === "Design" && order?.design_status === "Awaiting Customer Approval" ? (
              isAdministrator ? (
                <>
                  <Button color="orange" variant="light" onClick={() => returnDesignForChanges(workOrder)}>Changes Requested</Button>
                  <Button color="green" onClick={() => approveDesign(workOrder)}>Confirm Approval</Button>
                </>
              ) : (
                <Button disabled>Waiting for Administrator</Button>
              )
            ) : (
              <>
                <Button color="red" variant="light" disabled={workOrder.status !== "Ready"} onClick={() => startWorkOrder(workOrder)}>Start</Button>
                {department === "Design" ? (
                  <FileButton onChange={(file) => submitDesignForApproval(workOrder, file)} accept="image/*,.pdf,.svg">
                    {(props) => <Button {...props} color="green" disabled={workOrder.status !== "In Progress"}>Upload Proof & Submit</Button>}
                  </FileButton>
                ) : (
                  <Button color="green" disabled={workOrder.status !== "In Progress"} onClick={() => completeWorkOrder(workOrder)}>Complete</Button>
                )}
              </>
            )}
          </Group>
        </Stack>
      </Card>
    );
  }

  return (
    <>
      <MWPageHeader
        title={department === "Design" ? "Design Intake & Queue" : `${department} Queue`}
        subtitle={department === "Design"
          ? "Add customer design work, track Kory's progress, and hold finished proofs for customer approval."
          : `Only work currently ready or in progress for ${department}.`}
        buttonText={department === "Design" ? "Add Design Work" : "Production Control"}
        onButtonClick={department === "Design" ? onCreateDesign : () => setPage("productionControl")}
      />

      {department === "Design" && (
        <Alert icon={<IconInfoCircle />} color="blue" mb="md" title="How design work moves">
          Add the customer request here. New artwork waits for the $50 design fee, Kory or the design team uploads the proof,
          an administrator records customer approval, and the approved job moves to Laser. Artwork already on file skips Design.
        </Alert>
      )}

      {loading ? (
        <MWSection title="Loading Queue">
          <Text c="dimmed">Loading {department} work orders...</Text>
        </MWSection>
      ) : (
        <SimpleGrid cols={{ base: 1, xl: department === "Design" ? 3 : 2 }} spacing="lg">
          <MWSection
            title="In Progress"
            subtitle={`${inProgressOrders.length} currently being worked`}
          >
            <Stack>
              {inProgressOrders.length === 0 ? (
                <Text c="dimmed">No work currently in progress.</Text>
              ) : (
                inProgressOrders.map(renderWorkOrder)
              )}
            </Stack>
          </MWSection>

          <MWSection
            title="Ready"
            subtitle={`${readyOrders.length} ready to start`}
          >
            <Stack>
              {readyOrders.length === 0 ? (
                <Text c="dimmed">No work ready to start.</Text>
              ) : (
                readyOrders.map(renderWorkOrder)
              )}
            </Stack>
          </MWSection>

          {department === "Design" && (
            <MWSection title="Customer Approval" subtitle={`${awaitingApprovalOrders.length} awaiting confirmation`}>
              <Stack>
                {awaitingApprovalOrders.length === 0 ? (
                  <Text c="dimmed">No designs are awaiting customer approval.</Text>
                ) : (
                  awaitingApprovalOrders.map(renderWorkOrder)
                )}
              </Stack>
            </MWSection>
          )}
        </SimpleGrid>
      )}
    </>
  );
}

export default DepartmentQueue;
