import { useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  FileButton,
  Group,
  Image,
  Modal,
  Paper,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  Title,
} from "@mantine/core";
import {
  IconAlertTriangle,
  IconClock,
  IconFlag,
  IconInfoCircle,
  IconNotes,
  IconPhoto,
  IconRoute,
  IconUserCheck,
} from "@tabler/icons-react";

import { supabase } from "../lib/supabase";
import MWPageHeader from "../components/ui/MWPageHeader";
import MWSection from "../components/ui/MWSection";
import { notifications } from "@mantine/notifications";
import {
  canonicalStation,
  bypassProductionStep,
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
  const [queueFilter, setQueueFilter] = useState("All");
  const [noteTarget, setNoteTarget] = useState(null);
  const [noteText, setNoteText] = useState("");
  const [bypassTarget, setBypassTarget] = useState(null);
  const [bypassReason, setBypassReason] = useState("");
  const [savingAction, setSavingAction] = useState(false);

  useEffect(() => {
    loadQueue();
  }, [department, refreshKey]);

  async function loadQueue() {
    setLoading(true);

    const { data, error } = await supabase
      .from("work_orders")
      .select("*")
      .eq("department", canonicalStation(department) || department)
      .in("status", ["Ready", "In Progress", "Blocked"])
      .order("station_entered_at", { ascending: true });

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

      const [orderResult, itemsResult, imageResult] = await Promise.all([
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
        job.customer_order_id
          ? supabase
              .from("customer_order_reference_images")
              .select("*")
              .eq("customer_order_id", job.customer_order_id)
              .order("sort_order", { ascending: true })
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (orderResult.error) console.error(orderResult.error);
      if (itemsResult.error) console.error(itemsResult.error);

      const order = orderResult.data || null;
      const items = itemsResult.data || [];
      const images = imageResult.data || [];
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
      const { data: materialData, error: materialError } = await supabase
        .from("material_requests")
        .select("*")
        .in(
          "source_id",
          [job.id, job.customer_order_id].filter(Boolean).map(String)
        )
        .order("created_at", { ascending: false });
      if (materialError) console.error(materialError);

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
        images,
        materials: materialData || [],
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
    if (status === "Blocked") return "red";
    return "gray";
  }

  function getStationAge(workOrder) {
    const enteredAt = workOrder.station_entered_at || workOrder.started_at || workOrder.created_at;
    if (!enteredAt) return "Station time unavailable";
    const elapsedHours = Math.max(0, Math.floor((Date.now() - new Date(enteredAt).getTime()) / 3600000));
    if (elapsedHours < 1) return "Entered this hour";
    if (elapsedHours < 24) return `${elapsedHours}h in station`;
    const days = Math.floor(elapsedHours / 24);
    const hours = elapsedHours % 24;
    return `${days}d${hours ? ` ${hours}h` : ""} in station`;
  }

  function isPastDue(value) {
    if (!value) return false;
    const dueDate = new Date(`${value}T23:59:59`);
    return !Number.isNaN(dueDate.getTime()) && dueDate < new Date();
  }

  async function updateWorkOrder(workOrder, changes, title, message) {
    const { error } = await supabase.from("work_orders").update(changes).eq("id", workOrder.id);
    if (error) {
      notifications.show({ title: "Update Failed", message: error.message, color: "red" });
      return;
    }
    await supabase.from("work_order_activity").insert({
      work_order_id: workOrder.id,
      production_job_id: workOrder.production_job_id,
      event_type: title,
      from_status: workOrder.status,
      to_status: changes.status || workOrder.status,
      from_department: workOrder.department,
      to_department: workOrder.department,
      actor: activeUser || "Production Team",
      notes: changes.blocked_reason || message,
    });
    notifications.show({ title, message, color: "green" });
    await loadQueue();
  }

  async function saveNote() {
    if (!noteTarget || !noteText.trim() || savingAction) return;
    setSavingAction(true);
    try {
      const nextNotes = [noteTarget.notes, `${activeUser || "Production Team"}: ${noteText.trim()}`]
        .filter(Boolean)
        .join("\n");
      await updateWorkOrder(
        noteTarget,
        { notes: nextNotes },
        "Station Note Added",
        noteText.trim()
      );
      setNoteTarget(null);
      setNoteText("");
    } finally {
      setSavingAction(false);
    }
  }

  async function confirmBypass() {
    if (!bypassTarget || !bypassReason.trim() || savingAction) return;
    setSavingAction(true);
    try {
      const result = await bypassProductionStep(
        bypassTarget.id,
        activeUser,
        bypassReason.trim()
      );
      notifications.show({
        title: "Administrator Bypass Recorded",
        message: result?.completed
          ? "The production route is complete."
          : `${result?.next_department || "The next station"} is now ready.`,
        color: "orange",
      });
      setBypassTarget(null);
      setBypassReason("");
      await loadQueue();
    } catch (error) {
      notifications.show({
        title: "Station Could Not Be Bypassed",
        message: error?.message || "The bypass could not be recorded.",
        color: "red",
      });
    } finally {
      setSavingAction(false);
    }
  }

  async function claimWorkOrder(workOrder) {
    await updateWorkOrder(
      workOrder,
      { assigned_to: activeUser || "Production Team" },
      "Work Assigned",
      `${workOrder.work_order_number} is now assigned to ${activeUser || "Production Team"}.`
    );
  }

  async function blockWorkOrder(workOrder) {
    const reason = window.prompt("Why is this work blocked?");
    if (!reason?.trim()) return;
    await updateWorkOrder(
      workOrder,
      { status: "Blocked", blocked_reason: reason.trim(), assigned_to: workOrder.assigned_to || activeUser || null },
      "Work Blocked",
      "The issue is visible in this station queue until it is resolved."
    );
  }

  async function resumeWorkOrder(workOrder) {
    await updateWorkOrder(
      workOrder,
      { status: workOrder.started_at ? "In Progress" : "Ready", blocked_reason: null },
      "Work Resumed",
      "The blocker has been cleared."
    );
  }

  async function togglePriority(workOrder) {
    const nextPriority = workOrder.priority === "High" ? "Normal" : "High";
    await updateWorkOrder(
      workOrder,
      { priority: nextPriority },
      "Priority Updated",
      `${workOrder.work_order_number} is now ${nextPriority.toLowerCase()} priority.`
    );
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
      const result = await completeProductionStep(
        workOrder.id,
        activeUser,
        "Customer approval confirmed and design released to the next station."
      );
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
    const completionNotes = window.prompt(
      "Enter a short completion note for the next station:"
    );
    if (!completionNotes?.trim()) return;
    try {
      const result = await completeProductionStep(
        workOrder.id,
        activeUser,
        completionNotes.trim()
      );
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

  const blockedOrders = workOrders.filter(
    (workOrder) => workOrder.status === "Blocked"
  );

  const isAdministrator = String(accessLevel || "").toLowerCase().includes("admin");

  function renderWorkOrder(workOrder) {
    const detail = jobDetails[workOrder.production_job_id];
    const job = detail?.job;
    const customer = detail?.customer;
    const order = detail?.order;
    const items = detail?.items || [];
    const products = detail?.products || [];
    const project = detail?.project;
    const images = detail?.images || [];
    const materials = detail?.materials || [];
    const customerName = project?.contact_name || getCustomerName(customer);
    const companyName = getCustomerCompany(customer);
    const productNames = getProductNames(items, products);
    const orderNumber =
      order?.order_number ||
      order?.customer_order_number ||
      project?.project_number ||
      "Order not linked";
    const priority = job?.rush ? "Rush" : workOrder.priority || "Normal";
    const overdue = isPastDue(job?.due_date);
    const materialBlockers = materials.filter(
      (request) =>
        request.blocked_work ||
        Number(request.shortage_count || 0) > 0 ||
        !["Fulfilled", "Received", "Completed", "Cancelled"].includes(request.status)
    );
    const materialsReady = materials.length === 0 || materialBlockers.length === 0;

    return (
      <Card key={workOrder.id} withBorder radius="lg" p="md">
        <Stack gap="xs">
          <Group justify="space-between" align="flex-start" wrap="wrap">
            <Group gap="xs">
              <Badge color={getStatusColor(workOrder.status)} variant="light">
                {workOrder.status}
              </Badge>
              {priority !== "Normal" && (
                <Badge color={priority === "Rush" ? "red" : "orange"} variant="filled">
                  {priority}
                </Badge>
              )}
              {overdue && <Badge color="red" variant="outline">Overdue</Badge>}
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

            <Text size="xs" c="dimmed">{getStationAge(workOrder)}</Text>
          </Group>

          <Title order={4} style={{ lineHeight: 1.2, overflowWrap: "anywhere" }}>
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

          <Card withBorder radius="md" p="xs">
            <SimpleGrid cols={2} spacing={6}>
            <Group justify="space-between" wrap="nowrap">
              <Text size="sm">Due Date</Text>

              <Text size="sm" fw={700}>
                {formatDate(job?.due_date)}
              </Text>
            </Group>
            <Group justify="space-between" wrap="nowrap">
              <Text size="sm">Job Progress</Text>

              <Text size="sm" fw={700}>
                {job?.progress_percent || 0}%
              </Text>
            </Group>
            <Group justify="space-between" wrap="nowrap">
              <Group gap={6}>
                <IconUserCheck size={15} />
                <Text size="sm">Assigned To</Text>
              </Group>
              <Text size="sm" fw={700}>{workOrder.assigned_to || "Unassigned"}</Text>
            </Group>
            <Group justify="space-between" wrap="nowrap">
              <Group gap={6}>
                <IconClock size={15} />
                <Text size="sm">Station Time</Text>
              </Group>
              <Text size="sm" fw={700}>{getStationAge(workOrder)}</Text>
            </Group>
            </SimpleGrid>

            <Progress
              mt="xs"
              value={job?.progress_percent || 0}
              color="red"
              size="sm"
              radius="xl"
            />
          </Card>

          <SimpleGrid cols={2} spacing="xs">
            <Paper withBorder radius="md" p="xs">
              <Text size="xs" fw={900} c="dimmed">MATERIALS</Text>
              <Stack gap={3} mt={4}>
                <Text size="xs" fw={700}>
                  {materials.length ? `${materials.length} request${materials.length === 1 ? "" : "s"}` : "No request required"}
                </Text>
                <Badge size="sm" w="fit-content" color={materialsReady ? "green" : "orange"} variant="light">
                  {materialsReady ? "Ready" : `${materialBlockers.length} need attention`}
                </Badge>
              </Stack>
            </Paper>
            <Paper withBorder radius="md" p="xs">
              <Text size="xs" fw={900} c="dimmed">ARTWORK / FILES</Text>
              <Stack gap={3} mt={4}>
                <Text size="xs" fw={700}>{images.length} attached</Text>
                <Badge size="sm" w="fit-content" color={images.length ? "blue" : "gray"} variant="light">
                  {images.length ? "Available" : "None"}
                </Badge>
              </Stack>
            </Paper>
          </SimpleGrid>

          {(order?.notes || job?.notes || project?.internal_notes || workOrder.notes) && (
            <Paper withBorder radius="md" p="xs">
              <Text size="xs" fw={900} c="dimmed">SPECIAL INSTRUCTIONS</Text>
              <Text size="xs" mt={4} lineClamp={3} style={{ whiteSpace: "pre-wrap" }}>
                {[order?.notes, job?.notes, project?.internal_notes, workOrder.notes]
                  .filter(Boolean)
                  .join("\n")}
              </Text>
            </Paper>
          )}

          {images.length > 0 && (
            <div>
              <Group gap="xs" mb="xs">
                <IconPhoto size={16} />
                <Text size="sm" fw={800}>Artwork & Reference Files</Text>
              </Group>
              <SimpleGrid cols={3} spacing="xs">
                {images.slice(0, 2).map((image) => (
                  <Card
                    key={image.id}
                    component="a"
                    href={image.image_url}
                    target="_blank"
                    rel="noreferrer"
                    withBorder
                    radius="md"
                    p={4}
                  >
                    <Image
                      src={image.image_url}
                      alt={image.caption || image.image_type || "Order reference"}
                      h={58}
                      fit="contain"
                      radius="sm"
                    />
                    <Text size="xs" fw={700} mt={4} lineClamp={1}>
                      {image.caption || image.image_type || "Reference"}
                    </Text>
                  </Card>
                ))}
              </SimpleGrid>
                {images.length > 2 && <Paper withBorder radius="md" p="xs" style={{ display:"grid", placeItems:"center", minHeight:82 }}><Text size="sm" fw={900}>+{images.length - 2}<br/><Text component="span" size="xs" c="dimmed">more</Text></Text></Paper>}
              {images.length > 2 && (
                <Text size="xs" c="dimmed" mt={4}>Open Job to view every attachment.</Text>
              )}
            </div>
          )}

          {workOrder.status === "Blocked" && (
            <Alert icon={<IconAlertTriangle size={18} />} color="red" title="Work is blocked">
              {workOrder.blocked_reason || "No blocker reason was recorded."}
            </Alert>
          )}

          <SimpleGrid cols={2} spacing="xs">
            {!workOrder.assigned_to && (
              <Button fullWidth size="xs" variant="light" leftSection={<IconUserCheck size={15} />} onClick={() => claimWorkOrder(workOrder)}>
                Claim
              </Button>
            )}
            {isAdministrator && (
              <Button fullWidth size="xs" variant="subtle" color="orange" leftSection={<IconFlag size={15} />} onClick={() => togglePriority(workOrder)}>
                {workOrder.priority === "High" ? "Normal Priority" : "Mark High Priority"}
              </Button>
            )}
            <Button
              fullWidth size="xs"
              variant="subtle"
              color="gray"
              leftSection={<IconNotes size={15} />}
              onClick={() => {
                setNoteTarget(workOrder);
                setNoteText("");
              }}
            >
              Add Note
            </Button>
            {isAdministrator && (
              <Button
                fullWidth size="xs"
                variant="subtle"
                color="orange"
                leftSection={<IconRoute size={15} />}
                onClick={() => {
                  setBypassTarget(workOrder);
                  setBypassReason("");
                }}
              >
                Admin Bypass
              </Button>
            )}
            {workOrder.status === "Blocked" ? (
              <Button fullWidth size="xs" color="green" variant="light" onClick={() => resumeWorkOrder(workOrder)}>Resume Work</Button>
            ) : (
              <Button fullWidth size="xs" color="red" variant="subtle" onClick={() => blockWorkOrder(workOrder)}>Mark Blocked</Button>
            )}
          </SimpleGrid>

          <Group grow wrap="wrap">
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

      <Card withBorder radius="lg" p="md" mb="lg">
        <Group justify="space-between" align="center" wrap="wrap">
          <Stack gap={2}>
            <Text fw={800}>Queue View</Text>
            <Text size="sm" c="dimmed">Focus the station team on the work that needs attention now.</Text>
          </Stack>
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs" style={{ flex: "1 1 520px" }}>
            {[
              ["All", workOrders.length],
              ["Ready", readyOrders.length],
              ["In Progress", inProgressOrders.length],
              ["Blocked", blockedOrders.length],
            ].map(([label, count]) => (
              <Button
                key={label}
                size="sm"
                color={label === "Blocked" && count > 0 ? "orange" : "red"}
                variant={queueFilter === label ? "filled" : "light"}
                onClick={() => setQueueFilter(label)}
              >
                {label} ({count})
              </Button>
            ))}
          </SimpleGrid>
        </Group>
      </Card>

      {loading ? (
        <MWSection title="Loading Queue">
          <Text c="dimmed">Loading {department} work orders...</Text>
        </MWSection>
      ) : (
        <SimpleGrid cols={{ base: 1, lg: 2, xl: department === "Design" ? 3 : 2 }} spacing="lg">
          {(queueFilter === "All" || queueFilter === "In Progress") && (
            <MWSection title="In Progress" subtitle={`${inProgressOrders.length} currently being worked`}>
              <Stack>
                {inProgressOrders.length === 0 ? <Text c="dimmed">No work currently in progress.</Text> : inProgressOrders.map(renderWorkOrder)}
              </Stack>
            </MWSection>
          )}

          {(queueFilter === "All" || queueFilter === "Ready") && (
            <MWSection title="Ready" subtitle={`${readyOrders.length} ready to start`}>
              <Stack>
                {readyOrders.length === 0 ? <Text c="dimmed">No work ready to start.</Text> : readyOrders.map(renderWorkOrder)}
              </Stack>
            </MWSection>
          )}

          {(queueFilter === "All" || queueFilter === "Blocked") && (
            <MWSection title="Blocked Work" subtitle={`${blockedOrders.length} waiting on a resolution`}>
              <Stack>
                {blockedOrders.length === 0 ? <Text c="dimmed">No blocked work at this station.</Text> : blockedOrders.map(renderWorkOrder)}
              </Stack>
            </MWSection>
          )}

          {department === "Design" && queueFilter === "All" && (
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

      <Modal
        opened={Boolean(noteTarget)}
        onClose={() => {
          setNoteTarget(null);
          setNoteText("");
        }}
        title="Add Station Note"
        centered
      >
        <Stack>
          <Text size="sm" c="dimmed">
            The note will stay with this job and appear in its workflow history.
          </Text>
          <Textarea
            label="Note"
            placeholder="What was completed, checked, changed, or needs attention?"
            minRows={4}
            value={noteText}
            onChange={(event) => setNoteText(event.currentTarget.value)}
            autoFocus
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setNoteTarget(null)}>Cancel</Button>
            <Button color="red" loading={savingAction} disabled={!noteText.trim()} onClick={saveNote}>Save Note</Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={Boolean(bypassTarget)}
        onClose={() => {
          setBypassTarget(null);
          setBypassReason("");
        }}
        title="Administrator Station Bypass"
        centered
      >
        <Stack>
          <Alert color="orange" icon={<IconAlertTriangle size={18} />}>
            This marks the current station complete and releases the next required station. The administrator, reason, and time are permanently recorded.
          </Alert>
          <Textarea
            label="Required bypass reason"
            placeholder="Explain why this work is not required or was completed outside the normal station flow."
            minRows={4}
            value={bypassReason}
            onChange={(event) => setBypassReason(event.currentTarget.value)}
            autoFocus
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setBypassTarget(null)}>Cancel</Button>
            <Button color="orange" loading={savingAction} disabled={!bypassReason.trim()} onClick={confirmBypass}>Confirm Bypass</Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

export default DepartmentQueue;
