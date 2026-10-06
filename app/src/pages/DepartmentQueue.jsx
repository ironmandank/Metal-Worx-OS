import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  FileButton,
  Group,
  Image,
  Modal,
  Paper,
  Progress,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import {
  IconAlertTriangle,
  IconClock,
  IconChevronRight,
  IconDownload,
  IconEdit,
  IconExternalLink,
  IconFlag,
  IconInfoCircle,
  IconHistory,
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
  moveArtworkToStation,
  returnLaserWorkToDesign,
  setArtworkWorkflowStatus,
  SHOP_STATIONS,
  startProductionStep,
} from "../lib/productionWorkflow";
import { uploadOrderImages } from "../services/orderImageService";
import { notifyTeam } from "../services/teamNotificationService";
import { getTodaysHotTodayItems } from "../services/hotTodayService";
import {
  getDesignComplexity,
  getDesignPriority,
  sortDesignQueue,
} from "../lib/designPriority";

function referenceImageLabel(image, index) {
  return image?.caption || image?.image_type || `Reference image ${index + 1}`;
}

async function downloadReferenceImage(image, index) {
  const fileName = referenceImageLabel(image, index);
  try {
    const response = await fetch(image.image_url);
    if (!response.ok) throw new Error(`Download failed (${response.status})`);
    const blobUrl = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(blobUrl);
  } catch (error) {
    window.open(image.image_url, "_blank", "noopener,noreferrer");
    notifications.show({
      title: "Opened Image",
      message: "The browser opened the image in a new tab so you can save it from there.",
      color: "blue",
    });
  }
}

function DesignImageGallery({ images, imageHeight = 100 }) {
  if (!images?.length) {
    return <Text size="sm" c="dimmed">No artwork or reference images have been added.</Text>;
  }

  return (
    <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
      {images.map((image, index) => {
        const label = referenceImageLabel(image, index);
        return (
          <Card key={image.id || `${image.image_url}-${index}`} withBorder radius="md" p="xs">
            <a href={image.image_url} target="_blank" rel="noreferrer" aria-label={`Open ${label}`}>
              <Image src={image.image_url} alt={label} h={imageHeight} fit="contain" radius="sm" />
            </a>
            <Text size="xs" fw={700} mt="xs" lineClamp={2}>{label}</Text>
            <Group grow gap={6} mt="xs">
              <Button
                component="a"
                href={image.image_url}
                target="_blank"
                rel="noreferrer"
                size="compact-xs"
                variant="light"
                leftSection={<IconExternalLink size={13} />}
              >
                Open
              </Button>
              <Button
                size="compact-xs"
                variant="light"
                color="gray"
                leftSection={<IconDownload size={13} />}
                onClick={() => downloadReferenceImage(image, index)}
              >
                Download
              </Button>
            </Group>
          </Card>
        );
      })}
    </SimpleGrid>
  );
}

function DepartmentQueue({
  department,
  setPage,
  setSelectedProductionJob,
  activeUser,
  accessLevel,
  refreshKey = 0,
  onCreateDesign,
  unifiedArtwork = false,
}) {
  const [workOrders, setWorkOrders] = useState([]);
  const [jobDetails, setJobDetails] = useState({});
  const [loading, setLoading] = useState(true);
  const [queueFilter, setQueueFilter] = useState("All");
  const [stageFilter, setStageFilter] = useState("All Active Stages");
  const [movingStageId, setMovingStageId] = useState(null);
  const [selectedWorkOrderIds, setSelectedWorkOrderIds] = useState([]);
  const [bulkStage, setBulkStage] = useState(null);
  const [bulkMoving, setBulkMoving] = useState(false);
  const [artworkDrafts, setArtworkDrafts] = useState({});
  const [noteTarget, setNoteTarget] = useState(null);
  const [noteText, setNoteText] = useState("");
  const [bypassTarget, setBypassTarget] = useState(null);
  const [bypassReason, setBypassReason] = useState("");
  const [savingAction, setSavingAction] = useState(false);
  const [activityTarget, setActivityTarget] = useState(null);
  const [activities, setActivities] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [detailTarget, setDetailTarget] = useState(null);
  const [editDesignTarget, setEditDesignTarget] = useState(null);
  const [additionalDesignPhotos, setAdditionalDesignPhotos] = useState([]);
  const [designDraft, setDesignDraft] = useState({
    customerName: "",
    workType: "New Design Required",
    fileName: "",
    description: "",
    dueDate: null,
    assignedTo: "",
    priority: "Normal",
    feeRequired: false,
    feePaid: false,
    phone: "",
    email: "",
  });
  const [hotTodayItems, setHotTodayItems] = useState([]);

  useEffect(() => {
    loadQueue();
  }, [department, refreshKey]);

  async function loadQueue() {
    setLoading(true);

    let query = supabase
      .from("work_orders")
      .select("*")
      .eq("is_active", true);

    if (!unifiedArtwork) {
      query = query
        .eq("department", canonicalStation(department) || department)
        .in("status", ["Ready", "In Progress", "Blocked"]);
    }

    const { data, error } = await query
      .order("production_job_id", { ascending: true })
      .order("step_order", { ascending: true });

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    const rows = data || [];
    const queue = unifiedArtwork
      ? Object.values(rows.reduce((groups, row) => {
          const key = String(row.production_job_id || row.id);
          groups[key] = groups[key] || [];
          groups[key].push(row);
          return groups;
        }, {}))
          .filter((route) => route.some((row) => canonicalStation(row.department) === "Design"))
          .map((route) => route.find((row) => ["Ready", "In Progress", "Blocked"].includes(row.status)) || [...route].reverse().find((row) => row.status === "Completed"))
          .filter(Boolean)
      : rows;

    setWorkOrders(queue);
    try {
      await Promise.all([
        loadJobDetails(queue),
        (department === "Design" || unifiedArtwork)
          ? getTodaysHotTodayItems({ department: "Design" })
              .then(setHotTodayItems)
              .catch((hotError) => {
                console.warn("Hot Today design ranking unavailable:", hotError);
                setHotTodayItems([]);
              })
          : Promise.resolve(),
      ]);
    } catch (detailError) {
      console.error("Could not load queue details:", detailError);
      notifications.show({
        title: "Some Project Details Could Not Load",
        message: "The queue is available. Refresh the page to try loading the remaining details again.",
        color: "orange",
      });
    }
    setLoading(false);
  }

  function stationFor(workOrder) {
    return canonicalStation(workOrder?.department) || workOrder?.department || "Unassigned";
  }

  function isDesignStation(workOrder) {
    return stationFor(workOrder) === "Design";
  }

  function currentWorkflowStatus(workOrder) {
    const order = jobDetails[workOrder.production_job_id]?.order;
    if (order?.status === "Completed") {
      return order?.fulfillment_method === "Pickup" ? "Completed — Picked Up" : "Completed — Shipped";
    }
    if (order?.status === "Ready for Pickup") return "Waiting for Customer Pickup";
    if (order?.status === "Ready to Ship") return "Ready to Ship";
    if (order?.design_status === "Awaiting Customer Approval") return "Awaiting Customer Approval";
    return workOrder.status;
  }

  function updateArtworkDraft(workOrder, field, value) {
    if (!value) return;
    setArtworkDrafts((current) => ({
      ...current,
      [workOrder.id]: {
        stage: current[workOrder.id]?.stage ?? stationFor(workOrder),
        status: current[workOrder.id]?.status ?? currentWorkflowStatus(workOrder),
        ...(field === "stage" && value !== "Design" &&
          (current[workOrder.id]?.status ?? currentWorkflowStatus(workOrder)) === "Awaiting Customer Approval"
          ? { status: "Ready" }
          : {}),
        [field]: value,
      },
    }));
  }

  function artworkDraft(workOrder) {
    const savedDraft = artworkDrafts[workOrder.id];
    if (!savedDraft) return {
      stage: stationFor(workOrder),
      status: currentWorkflowStatus(workOrder),
    };
    const validStatuses = artworkStatusOptions({
      ...workOrder,
      department: SHOP_STATIONS.includes(savedDraft.stage) ? savedDraft.stage : stationFor(workOrder),
    });
    return {
      stage: SHOP_STATIONS.includes(savedDraft.stage) ? savedDraft.stage : stationFor(workOrder),
      status: validStatuses.includes(savedDraft.status) ? savedDraft.status : currentWorkflowStatus(workOrder),
    };
  }

  function artworkDraftChanged(workOrder) {
    const draft = artworkDraft(workOrder);
    return draft.stage !== stationFor(workOrder) || draft.status !== currentWorkflowStatus(workOrder);
  }

  async function applyArtworkUpdate(workOrder, draft, blockedNote = "") {
    if (!SHOP_STATIONS.includes(draft.stage)) {
      throw new Error("Choose a valid Stage before saving this artwork job.");
    }
    const currentStage = stationFor(workOrder);
    const currentStatus = currentWorkflowStatus(workOrder);
    const statusChanged = draft.status !== currentStatus;
    const stageChanged = draft.stage !== currentStage;
    const terminalStatus = [
      "Waiting for Customer Pickup",
      "Ready to Ship",
      "Completed — Picked Up",
      "Completed — Shipped",
    ].includes(draft.status);
    const shouldSetStatus = statusChanged || (stageChanged && !terminalStatus && draft.status !== "Ready");
    let targetWorkOrderId = workOrder.id;

    if (stageChanged && !terminalStatus) {
      const moveResult = await moveArtworkToStation(
        workOrder.id,
        draft.stage,
        activeUser,
        `Moved from ${currentStage} to ${draft.stage} from the Artwork Workflow.`
      );
      targetWorkOrderId = moveResult?.work_order_id || workOrder.id;
    }
    if (shouldSetStatus) {
      await setArtworkWorkflowStatus(
        targetWorkOrderId,
        draft.status,
        activeUser,
        draft.status === "Blocked"
          ? blockedNote
          : `Status changed to ${draft.status} from the Artwork Workflow.`
      );
    }

    return { stageChanged, statusChanged };
  }

  async function saveArtworkUpdate(workOrder) {
    if (savingAction || movingStageId || !artworkDraftChanged(workOrder)) return;
    const draft = artworkDraft(workOrder);
    const stageChanged = draft.stage !== stationFor(workOrder);
    let blockedNote = "";

    if (draft.status === "Blocked") {
      blockedNote = window.prompt("Why is this artwork blocked?", "") || "";
      if (!blockedNote.trim()) return;
    }
    if (["Completed — Picked Up", "Completed — Shipped"].includes(draft.status) &&
        !window.confirm(`Mark this artwork ${draft.status.toLowerCase()} and move it to the archive?`)) return;

    setSavingAction(true);
    setMovingStageId(stageChanged ? workOrder.id : null);
    try {
      await applyArtworkUpdate(workOrder, draft, blockedNote);

      notifications.show({
        title: "Artwork Updated",
        message: "The stage and status were saved together. Images, files, notes, and history stayed with the job.",
        color: "green",
      });
      setDetailTarget(null);
      setArtworkDrafts((current) => {
        const next = { ...current };
        delete next[workOrder.id];
        return next;
      });

      if (draft.status === "Waiting for Customer Pickup") {
        setStageFilter("Waiting for Pickup");
        setQueueFilter("All");
      } else if (draft.status === "Ready to Ship") {
        setStageFilter("Ready to Ship");
        setQueueFilter("All");
      } else if (["Completed — Picked Up", "Completed — Shipped"].includes(draft.status)) {
        setStageFilter("Completed / Archive");
        setQueueFilter("Completed / Archive");
      } else if (stageChanged) {
        setStageFilter(draft.stage);
        setQueueFilter("All");
      }
      await loadQueue();
    } catch (error) {
      notifications.show({
        title: "Artwork Could Not Be Updated",
        message: error?.message || "Please try again.",
        color: "red",
      });
    } finally {
      setSavingAction(false);
      setMovingStageId(null);
    }
  }

  async function saveAllArtworkUpdates() {
    if (savingAction || movingStageId) return;
    const changedOrders = workOrders.filter(artworkDraftChanged);
    if (changedOrders.length === 0) return;

    const completedCount = changedOrders.filter((workOrder) =>
      ["Completed — Picked Up", "Completed — Shipped"].includes(artworkDraft(workOrder).status)
    ).length;
    if (completedCount > 0 && !window.confirm(
      `${completedCount} item${completedCount === 1 ? " will" : "s will"} be marked completed and moved to the archive. Save all changes?`
    )) return;

    const blockedNotes = {};
    for (const workOrder of changedOrders) {
      if (artworkDraft(workOrder).status !== "Blocked") continue;
      const reason = window.prompt(
        `Why is ${workOrder.work_order_number || "this artwork"} blocked?`,
        ""
      ) || "";
      if (!reason.trim()) return;
      blockedNotes[workOrder.id] = reason.trim();
    }

    setSavingAction(true);
    const successfulIds = [];
    const failed = [];
    for (const workOrder of changedOrders) {
      try {
        await applyArtworkUpdate(workOrder, artworkDraft(workOrder), blockedNotes[workOrder.id]);
        successfulIds.push(workOrder.id);
      } catch (error) {
        failed.push({ workOrder, error });
      }
    }

    try {
      setArtworkDrafts((current) => {
        const next = { ...current };
        successfulIds.forEach((id) => delete next[id]);
        return next;
      });
      await loadQueue();
      notifications.show({
        title: failed.length ? "Some Artwork Needs Attention" : "All Artwork Changes Saved",
        message: failed.length
          ? `${successfulIds.length} updated; ${failed.length} could not be updated and remain pending.`
          : `${successfulIds.length} artwork item${successfulIds.length === 1 ? " was" : "s were"} updated together.`,
        color: failed.length ? "orange" : "green",
      });
    } finally {
      setSavingAction(false);
    }
  }

  function artworkStatusOptions(workOrder) {
    return [
      "Ready",
      "In Progress",
      "Needs Plaque",
      "Blocked",
      ...(isDesignStation(workOrder) ? ["Awaiting Customer Approval"] : []),
      "Waiting for Customer Pickup",
      "Ready to Ship",
      "Completed — Picked Up",
      "Completed — Shipped",
    ];
  }

  async function loadJobDetails(workOrderList) {
    const productionJobIds = [
      ...new Set(
        workOrderList
          .map((workOrder) => workOrder.production_job_id)
          .filter(Boolean)
      ),
    ];

    if (productionJobIds.length === 0) {
      setJobDetails({});
      return;
    }

    const { data: jobs = [], error: jobsError } = await supabase
      .from("production_jobs")
      .select("*")
      .in("id", productionJobIds);
    if (jobsError) throw jobsError;

    const orderIds = [...new Set(jobs.map((job) => job.customer_order_id).filter(Boolean))];
    const projectIds = [...new Set(jobs.map((job) => job.project_id).filter(Boolean))];
    const materialSourceIds = [...new Set(jobs.flatMap((job) => [job.id, job.customer_order_id]).filter(Boolean).map(String))];

    const [ordersResult, itemsResult, imagesResult, projectsResult, materialsResult] = await Promise.all([
      orderIds.length ? supabase.from("customer_orders").select("*").in("id", orderIds) : Promise.resolve({ data: [], error: null }),
      orderIds.length ? supabase.from("customer_order_items").select("*").in("order_id", orderIds) : Promise.resolve({ data: [], error: null }),
      orderIds.length ? supabase.from("customer_order_reference_images").select("*").in("customer_order_id", orderIds).order("sort_order", { ascending: true }) : Promise.resolve({ data: [], error: null }),
      projectIds.length ? supabase.from("projects").select("*").in("id", projectIds) : Promise.resolve({ data: [], error: null }),
      materialSourceIds.length ? supabase.from("material_requests").select("*").in("source_id", materialSourceIds).order("created_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
    ]);
    const batchError = [ordersResult, itemsResult, imagesResult, projectsResult, materialsResult].find((result) => result.error)?.error;
    if (batchError) throw batchError;

    const orders = ordersResult.data || [];
    const items = itemsResult.data || [];
    const images = imagesResult.data || [];
    const projects = projectsResult.data || [];
    const materials = materialsResult.data || [];
    const customerIds = [...new Set([
      ...jobs.map((job) => job.customer_id),
      ...orders.map((order) => order.customer_id),
      ...projects.map((project) => project.customer_id),
    ].filter(Boolean))];
    const productIds = [...new Set(items.map((item) => item.product_template_id).filter(Boolean))];

    const [customersResult, productsResult] = await Promise.all([
      customerIds.length ? supabase.from("customers").select("*").in("id", customerIds) : Promise.resolve({ data: [], error: null }),
      productIds.length ? supabase.from("product_templates").select("*").in("id", productIds) : Promise.resolve({ data: [], error: null }),
    ]);
    const relatedError = customersResult.error || productsResult.error;
    if (relatedError) throw relatedError;

    const byId = (rows) => Object.fromEntries((rows || []).map((row) => [String(row.id), row]));
    const ordersById = byId(orders);
    const projectsById = byId(projects);
    const customersById = byId(customersResult.data);
    const productsById = byId(productsResult.data);
    const details = {};

    jobs.forEach((job) => {
      const order = ordersById[String(job.customer_order_id)] || null;
      const project = projectsById[String(job.project_id)] || null;
      const jobItems = items.filter((item) => String(item.order_id) === String(job.customer_order_id));
      const resolvedCustomerId = job.customer_id || order?.customer_id || project?.customer_id;
      const sourceIds = new Set([job.id, job.customer_order_id].filter(Boolean).map(String));
      details[job.id] = {
        job,
        customer: customersById[String(resolvedCustomerId)] || null,
        order,
        items: jobItems,
        products: jobItems.map((item) => productsById[String(item.product_template_id)]).filter(Boolean),
        project,
        images: images.filter((image) => String(image.customer_order_id) === String(job.customer_order_id)),
        materials: materials.filter((material) => sourceIds.has(String(material.source_id))),
      };
    });

    setJobDetails(details);
  }

  function getCustomerName(customer) {
    if (!customer) return "No customer";

    return (
      `${customer.first_name || ""} ${customer.last_name || ""}`.trim() ||
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

  function getDesignWorkDetails(order) {
    const lines = String(order?.design_notes || "").split("\n").map((line) => line.trim()).filter(Boolean);
    const fileLine = lines.find((line) => line.toLowerCase().startsWith("design file:"));
    const complexity = getDesignComplexity({ order });
    return {
      workType: lines[0] || "",
      fileName: fileLine ? fileLine.slice(fileLine.indexOf(":") + 1).trim() : "",
      description: lines
        .slice(1)
        .filter((line) => !line.toLowerCase().startsWith("design file:"))
        .join("\n"),
      color: complexity.color,
      easeLabel: complexity.label,
    };
  }

  function toDateInputValue(value) {
    if (!value) return null;
    const parsed = new Date(`${String(value).slice(0, 10)}T12:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function toDateString(value) {
    if (!value) return null;
    if (typeof value === "string") return value.slice(0, 10);
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function openDesignEditor(workOrder) {
    const detail = jobDetails[workOrder.production_job_id];
    const designWork = getDesignWorkDetails(detail?.order);
    setDesignDraft({
      customerName: detail?.order?.artwork_customer_name || detail?.project?.contact_name || getCustomerName(detail?.customer),
      workType: designWork.workType || "New Design Required",
      fileName: designWork.fileName || "",
      description: designWork.description || "",
      dueDate: toDateInputValue(detail?.job?.due_date),
      assignedTo: workOrder.assigned_to || "",
      priority: workOrder.priority || "Normal",
      feeRequired: Boolean(detail?.order?.design_fee_required),
      feePaid: Boolean(
        detail?.order?.design_fee_paid ||
        detail?.order?.design_fee_status === "Paid"
      ),
      phone: detail?.customer?.phone || "",
      email: detail?.customer?.email || "",
    });
    setAdditionalDesignPhotos([]);
    setEditDesignTarget(workOrder);
  }

  async function uploadAdditionalDesignPhotos() {
    if (!editDesignTarget || additionalDesignPhotos.length === 0 || savingAction) return;
    const detail = jobDetails[editDesignTarget.production_job_id];
    if (!detail?.order?.id) {
      notifications.show({
        title: "Photos Could Not Be Added",
        message: "This design job is not linked to a customer order.",
        color: "red",
      });
      return;
    }

    setSavingAction(true);
    try {
      await uploadOrderImages(detail.order.id, additionalDesignPhotos, "Design Reference");
      notifications.show({
        title: "Design Photos Added",
        message: `${additionalDesignPhotos.length} photo${additionalDesignPhotos.length === 1 ? " was" : "s were"} added to this design job. Existing images were kept.`,
        color: "green",
      });
      setAdditionalDesignPhotos([]);
      await loadQueue();
    } catch (error) {
      notifications.show({
        title: "Photos Could Not Be Added",
        message: error?.message || "Please try the upload again.",
        color: "red",
      });
    } finally {
      setSavingAction(false);
    }
  }

  async function saveDesignJob() {
    if (!editDesignTarget || savingAction) return;
    const detail = jobDetails[editDesignTarget.production_job_id];
    if (!designDraft.customerName.trim()) {
      notifications.show({
        title: "Customer Name Required",
        message: "Enter the customer or order name for this design job.",
        color: "orange",
      });
      return;
    }
    const designNotes = [
      designDraft.workType,
      designDraft.fileName.trim()
        ? `Design file: ${designDraft.fileName.trim()}`
        : "",
      designDraft.description.trim(),
    ].filter(Boolean).join("\n");

    setSavingAction(true);
    try {
      const updates = [
        supabase.from("work_orders").update({
          assigned_to: designDraft.assignedTo.trim() || null,
          priority: designDraft.priority,
        }).eq("id", editDesignTarget.id),
        supabase.from("production_jobs").update({
          due_date: toDateString(designDraft.dueDate),
        }).eq("id", editDesignTarget.production_job_id),
      ];

      if (detail?.order?.id) {
        updates.push(
          supabase.from("customer_orders").update({
            artwork_customer_name: designDraft.customerName.trim(),
            design_notes: designNotes,
            design_fee_required: designDraft.feeRequired,
            design_fee_paid: designDraft.feeRequired && designDraft.feePaid,
            design_fee_status: !designDraft.feeRequired
              ? "Not Required"
              : designDraft.feePaid ? "Paid" : "Pending",
          }).eq("id", detail.order.id)
        );
      }

      if (detail?.customer?.id) {
        updates.push(
          supabase.from("customers").update({
            phone: designDraft.phone.trim() || null,
            email: designDraft.email.trim() || null,
          }).eq("id", detail.customer.id)
        );
      }

      const results = await Promise.all(updates);
      const failed = results.find((result) => result.error);
      if (failed?.error) throw failed.error;

      notifications.show({
        title: "Design Job Updated",
        message: "The artwork request and queue information were saved.",
        color: "green",
      });
      setEditDesignTarget(null);
      setDetailTarget(null);
      await loadQueue();
    } catch (error) {
      notifications.show({
        title: "Design Job Could Not Be Updated",
        message: error?.message || "Please try again.",
        color: "red",
      });
    } finally {
      setSavingAction(false);
    }
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

  async function openHistory(workOrder) {
    setActivityTarget(workOrder);
    setActivityLoading(true);
    const { data, error } = await supabase
      .from("work_order_activity")
      .select("*")
      .eq("work_order_id", workOrder.id)
      .order("created_at", { ascending: false });
    if (error) {
      notifications.show({ title: "History Could Not Load", message: error.message, color: "red" });
      setActivities([]);
    } else {
      setActivities(data || []);
    }
    setActivityLoading(false);
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
      isDesignStation(workOrder) &&
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
      let designStatusWarning = "";
      if (isDesignStation(workOrder) && order?.id) {
        const note = `Design started by ${activeUser || "Design Team"} on ${new Date().toLocaleString()}.`;
        const { error: orderError } = await supabase
          .from("customer_orders")
          .update({
            status: "In Design",
            design_status: "In Progress",
            design_notes: [order.design_notes, note].filter(Boolean).join("\n"),
          })
          .eq("id", order.id);
        if (orderError) designStatusWarning = " The work started, but the customer-order design label could not be synchronized.";
      }
      notifications.show({
        title: "Work Started",
        message: `${workOrder.work_order_number} is now in progress.${designStatusWarning}`,
        color: designStatusWarning ? "orange" : "green",
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

  async function submitDesignForApproval(workOrder, file = null) {
    const detail = jobDetails[workOrder.production_job_id];
    if (!detail?.order?.id) return;
    try {
      if (file) await uploadOrderImages(detail.order.id, [file], "Design Proof");
      const note = `${file ? "Design proof submitted" : "Design marked complete"} by ${activeUser || "Design Team"} on ${new Date().toLocaleString()}.`;
      const { error } = await supabase
        .from("customer_orders")
        .update({
          status: "Awaiting Customer Approval",
          design_status: "Awaiting Customer Approval",
          design_notes: [detail.order.design_notes, note].filter(Boolean).join("\n"),
        })
        .eq("id", detail.order.id);
      if (error) throw error;
      await notifyTeam({
        names: ["Dan"],
        title: "Artwork Is Ready for Customer Approval",
        message: `${detail.order.order_number || "Artwork order"} has a new proof ready for approval.`,
        sourceId: detail.order.id,
        targetPage: "designQueue",
        priority: "High",
      }).catch(console.warn);
      notifications.show({
        title: "Design Complete — Customer Approval Needed",
        message: file
          ? "The proof is saved. An administrator must confirm customer approval before Laser."
          : "The design moved to Customer Approval. A proof can still be attached from the job record.",
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
      await notifyTeam({
        names: ["Kory"],
        departments: ["Design"],
        title: "Artwork Changes Requested",
        message: `${detail.order.order_number || "Artwork order"} was returned for customer changes.`,
        sourceId: detail.order.id,
        targetPage: "designQueue",
        priority: "High",
      }).catch(console.warn);
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
      if (!result?.completed && result?.next_department) {
        await notifyTeam({
          departments: [result.next_department],
          title: `Work Released to ${result.next_department}`,
          message: `${workOrder.work_order_number} is ready to start.`,
          sourceId: workOrder.customer_order_id,
          targetPage: "productionControl",
        }).catch(console.warn);
      }
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
      if (!result?.completed && result?.next_department) {
        await notifyTeam({
          departments: [result.next_department],
          title: `Work Released to ${result.next_department}`,
          message: `${workOrder.work_order_number} is ready to start.`,
          sourceId: workOrder.customer_order_id,
          targetPage: "productionControl",
        }).catch(console.warn);
      }
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

  async function returnToDesign(workOrder) {
    const reason = window.prompt("Why is this artwork being returned to Design?");
    if (!reason?.trim()) return;
    if (!window.confirm("Return this artwork to Design? It will be removed from the Laser Queue and reopened in the Design Queue.")) return;
    try {
      await returnLaserWorkToDesign(workOrder.id, activeUser, reason.trim());
      notifications.show({
        title: "Returned to Design",
        message: `${workOrder.work_order_number} was removed from Laser and reopened in the Design Queue.`,
        color: "orange",
      });
      await loadQueue();
    } catch (error) {
      notifications.show({
        title: "Could Not Return Artwork",
        message: error?.message || "The artwork could not be returned to Design.",
        color: "red",
      });
    }
  }

  function workflowStage(workOrder) {
    const order = jobDetails[workOrder.production_job_id]?.order;
    if (order?.status === "Completed" || order?.fulfillment_completed) return "Completed / Archive";
    if (order?.status === "Ready for Pickup") return "Waiting for Pickup";
    if (["Ready to Ship", "Ready for Installation"].includes(order?.status)) return "Ready to Ship";
    if (order?.design_status === "Awaiting Customer Approval") return "Customer Approval";
    return stationFor(workOrder);
  }

  const displayedWorkOrders = useMemo(() => {
    if (!unifiedArtwork || stageFilter === "All Active Stages") {
      return unifiedArtwork
        ? workOrders.filter((workOrder) => workflowStage(workOrder) !== "Completed / Archive")
        : workOrders;
    }
    return workOrders.filter((workOrder) => workflowStage(workOrder) === stageFilter);
  }, [jobDetails, stageFilter, unifiedArtwork, workOrders]);

  const readyOrders = useMemo(() => {
    const ready = displayedWorkOrders.filter((workOrder) => workOrder.status === "Ready" && !["Customer Approval", "Waiting for Pickup", "Ready to Ship", "Completed / Archive"].includes(workflowStage(workOrder)));
    return (department === "Design" || unifiedArtwork)
      ? sortDesignQueue(ready, jobDetails, hotTodayItems)
      : ready;
  }, [department, displayedWorkOrders, hotTodayItems, jobDetails, unifiedArtwork]);

  const allAwaitingApprovalOrders = workOrders.filter((workOrder) => {
    const order = jobDetails[workOrder.production_job_id]?.order;
    return (department === "Design" || unifiedArtwork) && order?.design_status === "Awaiting Customer Approval";
  });
  const awaitingApprovalOrders = displayedWorkOrders.filter((workOrder) => {
    const order = jobDetails[workOrder.production_job_id]?.order;
    return (department === "Design" || unifiedArtwork) && order?.design_status === "Awaiting Customer Approval";
  });

  const inProgressOrders = displayedWorkOrders.filter((workOrder) => {
    const order = jobDetails[workOrder.production_job_id]?.order;
    return workOrder.status === "In Progress" && order?.design_status !== "Awaiting Customer Approval";
  });

  const blockedOrders = displayedWorkOrders.filter(
    (workOrder) => workOrder.status === "Blocked"
  );

  const waitingPickupOrders = workOrders.filter((workOrder) => currentWorkflowStatus(workOrder) === "Waiting for Customer Pickup");
  const readyToShipOrders = workOrders.filter((workOrder) => currentWorkflowStatus(workOrder) === "Ready to Ship");
  const archivedOrders = workOrders.filter((workOrder) => workflowStage(workOrder) === "Completed / Archive");
  const activeArtworkOrders = workOrders.filter((workOrder) => workflowStage(workOrder) !== "Completed / Archive");
  const stageOverview = [
    ["All Active", activeArtworkOrders.length],
    ...SHOP_STATIONS.map((stage) => [
      stage,
      workOrders.filter((workOrder) => workflowStage(workOrder) === stage).length,
    ]),
    ["Customer Approval", allAwaitingApprovalOrders.length],
    ["Waiting for Pickup", waitingPickupOrders.length],
    ["Ready to Ship", readyToShipOrders.length],
    ["Completed / Archive", archivedOrders.length],
  ];

  function selectStageOverview(stage) {
    if (stage === "All Active") {
      setStageFilter("All Active Stages");
      setQueueFilter("All");
      return;
    }
    setStageFilter(stage);
    setQueueFilter(stage === "Completed / Archive" ? "Completed / Archive" : "All");
  }

  function toggleWorkOrderSelection(workOrderId) {
    setSelectedWorkOrderIds((current) => current.includes(workOrderId)
      ? current.filter((id) => id !== workOrderId)
      : [...current, workOrderId]);
  }

  function visibleSelectableOrders() {
    if (queueFilter === "Ready") return readyOrders;
    if (queueFilter === "In Progress") return inProgressOrders;
    if (queueFilter === "Blocked") return blockedOrders;
    if (queueFilter === "Customer Approval") return awaitingApprovalOrders;
    if (queueFilter === "Waiting for Pickup") return waitingPickupOrders;
    if (queueFilter === "Ready to Ship") return readyToShipOrders;
    return displayedWorkOrders.filter((workOrder) => workflowStage(workOrder) !== "Completed / Archive");
  }

  async function moveSelectedArtwork() {
    if (!bulkStage || bulkMoving || selectedWorkOrderIds.length === 0) return;
    const selectedOrders = workOrders.filter((workOrder) =>
      selectedWorkOrderIds.includes(workOrder.id) &&
      workflowStage(workOrder) !== "Completed / Archive" &&
      stationFor(workOrder) !== bulkStage
    );
    if (selectedOrders.length === 0) {
      notifications.show({
        title: "Nothing to Move",
        message: "The selected artwork is already in that stage or is archived.",
        color: "orange",
      });
      return;
    }

    setBulkMoving(true);
    const results = await Promise.allSettled(selectedOrders.map((workOrder) =>
      moveArtworkToStation(
        workOrder.id,
        bulkStage,
        activeUser,
        `Bulk moved from ${stationFor(workOrder)} to ${bulkStage} from the Artwork Workflow.`
      )
    ));
    const failed = results.filter((result) => result.status === "rejected");
    const movedCount = results.length - failed.length;
    notifications.show({
      title: failed.length ? "Bulk Move Partially Completed" : "Artwork Moved",
      message: failed.length
        ? `${movedCount} moved to ${bulkStage}; ${failed.length} could not be moved.`
        : `${movedCount} artwork job${movedCount === 1 ? " was" : "s were"} moved to ${bulkStage}.`,
      color: failed.length ? "orange" : "green",
    });
    setSelectedWorkOrderIds([]);
    setBulkStage(null);
    setStageFilter(bulkStage);
    setQueueFilter("All");
    await loadQueue();
    setBulkMoving(false);
  }

  const isAdministrator = String(accessLevel || "").toLowerCase().includes("admin");
  const pendingArtworkUpdates = unifiedArtwork
    ? workOrders.filter(artworkDraftChanged)
    : [];

  function renderWorkOrder(workOrder) {
    const detail = jobDetails[workOrder.production_job_id];
    const job = detail?.job;
    const customer = detail?.customer;
    const order = detail?.order;
    const designWork = (department === "Design" || unifiedArtwork) ? getDesignWorkDetails(order) : { workType: "", fileName: "" };
    const items = detail?.items || [];
    const products = detail?.products || [];
    const project = detail?.project;
    const images = detail?.images || [];
    const materials = detail?.materials || [];
    const customerName = order?.artwork_customer_name || project?.contact_name || getCustomerName(customer);
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
              {isDesignStation(workOrder) && (
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

          {unifiedArtwork && (
            <Paper withBorder radius="md" p="sm">
              <Stack gap="sm">
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                  <Select
                    label="Stage"
                    description="Choose where the job belongs"
                    data={SHOP_STATIONS}
                    value={artworkDraft(workOrder).stage}
                    allowDeselect={false}
                    disabled={!isAdministrator || Boolean(movingStageId) || workflowStage(workOrder) === "Completed / Archive"}
                    onChange={(value) => updateArtworkDraft(workOrder, "stage", value)}
                  />
                  <Select
                    label="Status"
                    description="Choose its current work or delivery status"
                    data={artworkStatusOptions({ ...workOrder, department: artworkDraft(workOrder).stage })}
                    value={artworkDraft(workOrder).status}
                    allowDeselect={false}
                    disabled={!isAdministrator || savingAction}
                    onChange={(value) => updateArtworkDraft(workOrder, "status", value)}
                  />
                </SimpleGrid>
                {isAdministrator && workflowStage(workOrder) !== "Completed / Archive" && (
                  <Button
                    color="red"
                    loading={savingAction || movingStageId === workOrder.id}
                    disabled={!artworkDraftChanged(workOrder)}
                    onClick={() => saveArtworkUpdate(workOrder)}
                  >
                    Update Stage & Status
                  </Button>
                )}
              </Stack>
            </Paper>
          )}

          <Stack gap={2}>
            {companyName && <Text fw={700}>{companyName}</Text>}
            {(department === "Design" || unifiedArtwork) && order?.design_notes && (
              <Text size="sm" c={`${designWork.color}.4`} fw={800}>
                Artwork: {String(order.design_notes).split("\n")[0]}
              </Text>
            )}
            {(department === "Design" || unifiedArtwork) && designWork.fileName && (
              <Text size="sm"><b>Find File:</b> {designWork.fileName}</Text>
            )}
            {(department === "Design" || unifiedArtwork) && (customer?.phone || customer?.email) && (
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
                <Text size="sm" fw={800}>Artwork & Reference Files ({images.length})</Text>
              </Group>
              <DesignImageGallery images={images} imageHeight={82} />
            </div>
          )}

          {workOrder.status === "Blocked" && (
            <Alert icon={<IconAlertTriangle size={18} />} color="red" title="Work is blocked">
              {workOrder.blocked_reason || "No blocker reason was recorded."}
            </Alert>
          )}

          <SimpleGrid cols={2} spacing="xs">
            {isDesignStation(workOrder) && (
              <Button
                fullWidth
                size="xs"
                color="blue"
                variant="light"
                leftSection={<IconEdit size={15} />}
                onClick={() => openDesignEditor(workOrder)}
              >
                Edit Design Job
              </Button>
            )}
            <Button fullWidth size="xs" variant="subtle" color="gray" leftSection={<IconHistory size={15} />} onClick={() => openHistory(workOrder)}>
              History
            </Button>
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
            {isAdministrator && stationFor(workOrder) === "Laser" && (
              <Button fullWidth size="xs" variant="light" color="orange" leftSection={<IconRoute size={15} />} onClick={() => returnToDesign(workOrder)}>
                Return to Design
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

            {isDesignStation(workOrder) && order?.design_status === "Awaiting Customer Approval" ? (
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
                {isDesignStation(workOrder) ? (
                  <>
                    <Button
                      color="green"
                      h="auto"
                      mih={42}
                      py={8}
                      styles={{ label: { whiteSpace: "normal", lineHeight: 1.15, textAlign: "center" } }}
                      disabled={workOrder.status !== "In Progress"}
                      onClick={() => approveDesign(workOrder)}
                    >
                      Completed — Ready to Cut
                    </Button>
                    <FileButton onChange={(file) => submitDesignForApproval(workOrder, file)} accept="image/*,.pdf,.svg">
                      {(props) => <Button {...props} color="blue" variant="light" disabled={workOrder.status !== "In Progress"}>Upload Proof for Approval</Button>}
                    </FileButton>
                  </>
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

  function renderQueueCard(workOrder, index) {
    const detail = jobDetails[workOrder.production_job_id];
    const job = detail?.job;
    const customer = detail?.customer;
    const project = detail?.project;
    const order = detail?.order;
    const designWork = (department === "Design" || unifiedArtwork) ? getDesignWorkDetails(order) : { workType: "", fileName: "" };
    const customerName = order?.artwork_customer_name || project?.contact_name || getCustomerName(customer);
    const workName = project?.project_name || getProductNames(detail?.items || [], detail?.products || []);
    const overdue = isPastDue(job?.due_date);
    const designRank = isDesignStation(workOrder) && workOrder.status === "Ready"
      ? getDesignPriority(workOrder, detail, hotTodayItems)
      : null;

    return (
      <Card
        key={workOrder.id}
        withBorder
        radius="lg"
        p="md"
        role="button"
        tabIndex={0}
        onClick={() => setDetailTarget(workOrder)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") setDetailTarget(workOrder);
        }}
        style={{ cursor: "pointer" }}
      >
        <Stack gap="sm">
          <Group justify="space-between" align="flex-start" wrap="nowrap">
            <Group gap={6} wrap="wrap">
              {unifiedArtwork && isAdministrator && workflowStage(workOrder) !== "Completed / Archive" && (
                <Checkbox
                  aria-label={`Select ${workOrder.work_order_number || "artwork"}`}
                  checked={selectedWorkOrderIds.includes(workOrder.id)}
                  onClick={(event) => event.stopPropagation()}
                  onChange={() => toggleWorkOrderSelection(workOrder.id)}
                />
              )}
              {designRank && (
                <Badge color={designRank.color} variant="filled">
                  #{index + 1} · {designRank.reason}
                </Badge>
              )}
              <Badge color={getStatusColor(workOrder.status)} variant="light">{workOrder.status}</Badge>
              {unifiedArtwork && <Badge color="violet" variant="light">{workflowStage(workOrder)}</Badge>}
              {isDesignStation(workOrder) && (
                <Badge
                  color={order?.design_fee_required
                    ? (order?.design_fee_paid || order?.design_fee_status === "Paid" ? "green" : "orange")
                    : "gray"}
                  variant="filled"
                >
                  {order?.design_fee_required
                    ? (order?.design_fee_paid || order?.design_fee_status === "Paid" ? "Design Fee Paid" : "Design Fee Pending")
                    : "No Design Fee"}
                </Badge>
              )}
              {overdue && <Badge color="red">Overdue</Badge>}
              {workOrder.priority === "High" && <Badge color="orange">High Priority</Badge>}
            </Group>
            <IconChevronRight size={20} color="var(--mantine-color-dimmed)" />
          </Group>

          <div>
            <Text fw={900} size="lg" lineClamp={2}>{customerName} — {workName}</Text>
            {designWork.workType && (
              <Text size="xs" fw={900} c={`${designWork.color}.4`} mt={4} lineClamp={2}>
                Design Work: {designWork.workType}
              </Text>
            )}
            {designWork.fileName && (
              <Text size="xs" fw={800} c="yellow.4" mt={3} lineClamp={2}>
                Find File: {designWork.fileName}
              </Text>
            )}
            <Text size="sm" c="dimmed" mt={3}>
              {workOrder.assigned_to || "Unassigned"} · Due {formatDate(job?.due_date)} · {getStationAge(workOrder)}
            </Text>
          </div>

          {unifiedArtwork && (
            <Paper withBorder radius="md" p="xs" onClick={(event) => event.stopPropagation()}>
              <Stack gap="xs">
                <SimpleGrid cols={2} spacing="xs">
                  <Select
                    size="xs"
                    label="Stage"
                    data={SHOP_STATIONS}
                    value={artworkDraft(workOrder).stage}
                    allowDeselect={false}
                    disabled={!isAdministrator || Boolean(movingStageId) || workflowStage(workOrder) === "Completed / Archive"}
                    onChange={(value) => updateArtworkDraft(workOrder, "stage", value)}
                  />
                  <Select
                    size="xs"
                    label="Status"
                    data={artworkStatusOptions({ ...workOrder, department: artworkDraft(workOrder).stage })}
                    value={artworkDraft(workOrder).status}
                    allowDeselect={false}
                    disabled={!isAdministrator || savingAction}
                    onChange={(value) => updateArtworkDraft(workOrder, "status", value)}
                  />
                </SimpleGrid>
                {isAdministrator && workflowStage(workOrder) !== "Completed / Archive" && (
                  <Button
                    size="xs"
                    color="red"
                    loading={savingAction || movingStageId === workOrder.id}
                    disabled={!artworkDraftChanged(workOrder)}
                    onClick={() => saveArtworkUpdate(workOrder)}
                  >
                    Update Stage & Status
                  </Button>
                )}
              </Stack>
            </Paper>
          )}

          <Progress value={job?.progress_percent || 0} color="red" size="sm" radius="xl" />

          <Stack gap={6}>
            <Text size="xs" c="dimmed" ta="center">Click the card to view files, notes, materials, and actions</Text>
            {isDesignStation(workOrder) && (
              <Button
                fullWidth
                size="xs"
                color="blue"
                variant="light"
                leftSection={<IconEdit size={15} />}
                onClick={(event) => {
                  event.stopPropagation();
                  openDesignEditor(workOrder);
                }}
              >
                Edit Design Job
              </Button>
            )}
            {workOrder.status === "Ready" && (
              <Button
                fullWidth
                size="xs"
                color="red"
                onClick={(event) => {
                  event.stopPropagation();
                  startWorkOrder(workOrder);
                }}
              >
                Start
              </Button>
            )}
            {workOrder.status === "In Progress" && !isDesignStation(workOrder) && (
              <Button
                fullWidth
                size="xs"
                color="green"
                h="auto"
                mih={40}
                py={8}
                styles={{ label: { whiteSpace: "normal", lineHeight: 1.15, textAlign: "center" } }}
                onClick={(event) => {
                  event.stopPropagation();
                  completeWorkOrder(workOrder);
                }}
              >
                Complete
              </Button>
            )}
            {workOrder.status === "In Progress" && isDesignStation(workOrder) && (
              <Button
                fullWidth
                size="xs"
                color="green"
                onClick={(event) => {
                  event.stopPropagation();
                  approveDesign(workOrder);
                }}
              >
                Completed — Ready to Cut
              </Button>
            )}
          </Stack>
        </Stack>
      </Card>
    );
  }

  return (
    <>
      <MWPageHeader
        title={unifiedArtwork ? "Artwork Workflow" : department === "Design" ? "Design Intake & Queue" : `${department} Queue`}
        subtitle={unifiedArtwork
          ? "One place for every artwork job. Filter the list, then use the dropdowns to move the same job through Design, Laser, Prep, Showroom, pickup, shipping, and completion."
          : department === "Design"
          ? "Add customer design work, track Kory's progress, and hold finished proofs for customer approval."
          : `Only work currently ready or in progress for ${department}.`}
        buttonText={(department === "Design" || unifiedArtwork) ? "Add Artwork" : "Production Control"}
        onButtonClick={(department === "Design" || unifiedArtwork) ? onCreateDesign : () => setPage("productionControl")}
      />

      {unifiedArtwork ? (
        <Alert icon={<IconInfoCircle />} color="blue" mb="md" title="One job, one record">
          Images, files, customer details, notes, and history stay attached to the original job. Changing Stage moves that job; changing Status records whether it is active, blocked, awaiting approval, waiting for pickup, shipped, or completed.
        </Alert>
      ) : department === "Design" && (
        <Alert icon={<IconInfoCircle />} color="blue" mb="md" title="How design work moves">
          Add the customer request here. New artwork waits for the $50 design fee, Kory or the design team uploads the proof,
          an administrator records customer approval, and the approved job moves to Laser. Artwork already on file skips Design.
        </Alert>
      )}

      {unifiedArtwork && isAdministrator && pendingArtworkUpdates.length > 0 && (
        <Paper
          withBorder
          radius="lg"
          p="md"
          mb="lg"
          style={{
            position: "sticky",
            top: 12,
            zIndex: 30,
            borderColor: "var(--mantine-color-red-6)",
            boxShadow: "0 10px 28px rgba(0, 0, 0, 0.28)",
          }}
        >
          <Group justify="space-between" align="center" wrap="wrap">
            <div>
              <Text fw={900} c="red.4">
                {pendingArtworkUpdates.length} Unsaved Change{pendingArtworkUpdates.length === 1 ? "" : "s"}
              </Text>
              <Text size="sm" c="dimmed">
                Continue through the full list, then save every Stage and Status update together.
              </Text>
            </div>
            <Group>
              <Button
                variant="default"
                disabled={savingAction}
                onClick={() => setArtworkDrafts({})}
              >
                Discard Changes
              </Button>
              <Button
                color="red"
                loading={savingAction}
                onClick={saveAllArtworkUpdates}
              >
                Save All Changes ({pendingArtworkUpdates.length})
              </Button>
            </Group>
          </Group>
        </Paper>
      )}

      {unifiedArtwork && (
        <Card withBorder radius="lg" p="md" mb="lg">
          <Stack gap="sm">
            <div>
              <Text fw={800}>Artwork Pipeline</Text>
              <Text size="sm" c="dimmed">Live totals by stage. Select a stage to see only that work.</Text>
            </div>
            <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="xs">
              {stageOverview.map(([label, count]) => {
                const selected = label === "All Active"
                  ? stageFilter === "All Active Stages" && queueFilter === "All"
                  : stageFilter === label;
                return (
                  <Button
                    key={label}
                    size="sm"
                    color={label === "Completed / Archive" ? "gray" : "red"}
                    variant={selected ? "filled" : "light"}
                    h="auto"
                    mih={42}
                    py={8}
                    styles={{ label: { whiteSpace: "normal", lineHeight: 1.15, textAlign: "center" } }}
                    onClick={() => selectStageOverview(label)}
                  >
                    {label} ({count})
                  </Button>
                );
              })}
            </SimpleGrid>
          </Stack>
        </Card>
      )}

      {unifiedArtwork && isAdministrator && (
        <Card withBorder radius="lg" p="md" mb="lg">
          <Group justify="space-between" align="flex-end" wrap="wrap">
            <Stack gap={2}>
              <Text fw={800}>Move Multiple Artwork Jobs</Text>
              <Text size="sm" c="dimmed">Select cards below, choose the new stage, and move them together.</Text>
            </Stack>
            <Group align="flex-end" wrap="wrap">
              <Button
                variant="light"
                color="gray"
                onClick={() => setSelectedWorkOrderIds(visibleSelectableOrders().map((workOrder) => workOrder.id))}
              >
                Select All Shown
              </Button>
              <Button
                variant="subtle"
                color="gray"
                disabled={selectedWorkOrderIds.length === 0}
                onClick={() => setSelectedWorkOrderIds([])}
              >
                Clear
              </Button>
              <Select
                label={`${selectedWorkOrderIds.length} selected`}
                placeholder="Choose destination"
                data={SHOP_STATIONS}
                value={bulkStage}
                onChange={setBulkStage}
                style={{ minWidth: 220 }}
              />
              <Button
                color="red"
                loading={bulkMoving}
                disabled={!bulkStage || selectedWorkOrderIds.length === 0}
                onClick={moveSelectedArtwork}
              >
                Move Selected
              </Button>
            </Group>
          </Group>
        </Card>
      )}

      <Card withBorder radius="lg" p="md" mb="lg">
        <Group justify="space-between" align="center" wrap="wrap">
          <Stack gap={2}>
            <Text fw={800}>{unifiedArtwork ? "Work Status" : "Queue View"}</Text>
            <Text size="sm" c="dimmed">{unifiedArtwork ? "Narrow the selected stage by its current work status." : "Focus the station team on the work that needs attention now."}</Text>
          </Stack>
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs" style={{ flex: "1 1 520px" }}>
            {[
              ["All", displayedWorkOrders.length],
              ["Ready", readyOrders.length],
              ["In Progress", inProgressOrders.length],
              ["Blocked", blockedOrders.length],
              ...((department === "Design" && !unifiedArtwork)
                ? [["Customer Approval", awaitingApprovalOrders.length]]
                : []),
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
        <Stack gap="lg">
          {(queueFilter === "All" || queueFilter === "Ready") && (
            <MWSection title="Ready" subtitle={`${readyOrders.length} ready to start`}>
              <SimpleGrid cols={{ base: 1, sm: 2, lg: 3, xl: 4 }} spacing="md" align="start">
                {readyOrders.length === 0 ? <Text c="dimmed">No work ready to start.</Text> : readyOrders.map(renderQueueCard)}
              </SimpleGrid>
            </MWSection>
          )}

          {(queueFilter === "All" || queueFilter === "In Progress") && (
            <MWSection title="In Progress" subtitle={`${inProgressOrders.length} currently being worked`}>
              <SimpleGrid cols={{ base: 1, sm: 2, lg: 3, xl: 4 }} spacing="md" align="start">
                {inProgressOrders.length === 0 ? <Text c="dimmed">No work currently in progress.</Text> : inProgressOrders.map(renderQueueCard)}
              </SimpleGrid>
            </MWSection>
          )}

          {(queueFilter === "All" || queueFilter === "Blocked") && (
            <MWSection title="Blocked Work" subtitle={`${blockedOrders.length} waiting on a resolution`}>
              <SimpleGrid cols={{ base: 1, sm: 2, lg: 3, xl: 4 }} spacing="md" align="start">
                {blockedOrders.length === 0 ? <Text c="dimmed">No blocked work at this station.</Text> : blockedOrders.map(renderQueueCard)}
              </SimpleGrid>
            </MWSection>
          )}

          {(department === "Design" || unifiedArtwork) && (queueFilter === "All" || queueFilter === "Customer Approval") && (
            <MWSection title="Customer Approval" subtitle={`${awaitingApprovalOrders.length} awaiting confirmation`}>
              <SimpleGrid cols={{ base: 1, sm: 2, lg: 3, xl: 4 }} spacing="md" align="start">
                {awaitingApprovalOrders.length === 0 ? (
                  <Text c="dimmed">No designs are awaiting customer approval.</Text>
                ) : (
                  awaitingApprovalOrders.map(renderQueueCard)
                )}
              </SimpleGrid>
            </MWSection>
          )}

          {unifiedArtwork && (queueFilter === "All" || queueFilter === "Waiting for Pickup") && (
            <MWSection title="Waiting for Customer Pickup" subtitle={`${waitingPickupOrders.length} completed item${waitingPickupOrders.length === 1 ? "" : "s"} waiting for the customer`}>
              <SimpleGrid cols={{ base: 1, sm: 2, lg: 3, xl: 4 }} spacing="md" align="start">
                {waitingPickupOrders.length === 0 ? <Text c="dimmed">No artwork is currently waiting for customer pickup.</Text> : waitingPickupOrders.map(renderQueueCard)}
              </SimpleGrid>
            </MWSection>
          )}

          {unifiedArtwork && (queueFilter === "All" || queueFilter === "Ready to Ship") && (
            <MWSection title="Ready to Ship" subtitle={`${readyToShipOrders.length} completed item${readyToShipOrders.length === 1 ? "" : "s"} waiting to be shipped`}>
              <SimpleGrid cols={{ base: 1, sm: 2, lg: 3, xl: 4 }} spacing="md" align="start">
                {readyToShipOrders.length === 0 ? <Text c="dimmed">No artwork is currently ready to ship.</Text> : readyToShipOrders.map(renderQueueCard)}
              </SimpleGrid>
            </MWSection>
          )}

          {unifiedArtwork && (queueFilter === "Completed / Archive") && (
            <MWSection title="Completed Artwork Archive" subtitle={`${archivedOrders.length} completed item${archivedOrders.length === 1 ? "" : "s"}`}>
              <SimpleGrid cols={{ base: 1, sm: 2, lg: 3, xl: 4 }} spacing="md" align="start">
                {archivedOrders.length === 0 ? <Text c="dimmed">No completed artwork is in the archive.</Text> : archivedOrders.map(renderQueueCard)}
              </SimpleGrid>
            </MWSection>
          )}
        </Stack>
      )}

      <Modal
        opened={Boolean(detailTarget)}
        onClose={() => setDetailTarget(null)}
        title="Work Details & Actions"
        centered
        size="xl"
        scrollAreaComponent={Modal.NativeScrollArea}
      >
        {detailTarget && renderWorkOrder(detailTarget)}
      </Modal>

      <Modal
        opened={Boolean(editDesignTarget)}
        onClose={() => {
          setEditDesignTarget(null);
          setAdditionalDesignPhotos([]);
        }}
        title="Edit Design Job"
        centered
        size="lg"
        scrollAreaComponent={Modal.NativeScrollArea}
      >
        <Stack gap="md">
          <Alert color="blue" icon={<IconInfoCircle size={18} />}>
            Update the artwork request here. These details appear on the Design Queue card and inside the production job.
          </Alert>
          <TextInput
            label="Customer / Order Name"
            description="Changing this corrects only this job. Other orders keep their current customer name."
            placeholder="Enter the correct customer or company"
            required
            value={designDraft.customerName}
            onChange={(event) => {
              const value = event.currentTarget.value;
              setDesignDraft((current) => ({ ...current, customerName: value }));
            }}
          />
          <Select
            label="What does Design need to do?"
            data={[
              "New Design Required",
              "Existing Logo — Placement Only",
              "Design Already on File",
              "Customer-Supplied Cut-Ready File",
              "Design Changes Required",
            ]}
            value={designDraft.workType}
            onChange={(value) => setDesignDraft((current) => ({
              ...current,
              workType: value || "New Design Required",
            }))}
            searchable
            allowDeselect={false}
          />
          <TextInput
            label="Existing File Name / Search Name"
            placeholder="Example: AMC_Auto_Sales_Logo.cdr"
            description="Enter the exact CorelDRAW, SVG, DXF, PDF, or customer file name."
            value={designDraft.fileName}
            onChange={(event) => {
              const value = event.currentTarget.value;
              setDesignDraft((current) => ({ ...current, fileName: value }));
            }}
          />
          <Textarea
            label="Design / Placement Instructions"
            placeholder="Place the existing logo on the 24-inch flag, centered above the plaque..."
            minRows={4}
            autosize
            value={designDraft.description}
            onChange={(event) => {
              const value = event.currentTarget.value;
              setDesignDraft((current) => ({ ...current, description: value }));
            }}
          />
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <DateInput
              label="Required Completion Date"
              placeholder="Select date"
              valueFormat="MMM D, YYYY"
              value={designDraft.dueDate}
              onChange={(value) => setDesignDraft((current) => ({ ...current, dueDate: value }))}
              clearable
            />
            <Select
              label="Priority"
              data={["Normal", "High", "Rush", "Emergency"]}
              value={designDraft.priority}
              onChange={(value) => setDesignDraft((current) => ({
                ...current,
                priority: value || "Normal",
              }))}
              allowDeselect={false}
            />
            <TextInput
              label="Assigned To"
              placeholder="Kory or design team member"
              value={designDraft.assignedTo}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setDesignDraft((current) => ({ ...current, assignedTo: value }));
              }}
            />
            <TextInput
              label="Customer Phone"
              value={designDraft.phone}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setDesignDraft((current) => ({ ...current, phone: value }));
              }}
            />
            <TextInput
              label="Customer Email"
              type="email"
              value={designDraft.email}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setDesignDraft((current) => ({ ...current, email: value }));
              }}
            />
          </SimpleGrid>
          <Paper withBorder radius="md" p="md">
            <Stack gap="sm">
              <Switch
                label="Design fee is required"
                checked={designDraft.feeRequired}
                onChange={(event) => {
                  const checked = event.currentTarget.checked;
                  setDesignDraft((current) => ({
                    ...current,
                    feeRequired: checked,
                    feePaid: checked ? current.feePaid : false,
                  }));
                }}
              />
              <Switch
                label="Customer paid the design fee"
                checked={designDraft.feePaid}
                disabled={!designDraft.feeRequired}
                onChange={(event) => {
                  const checked = event.currentTarget.checked;
                  setDesignDraft((current) => ({ ...current, feePaid: checked }));
                }}
              />
            </Stack>
          </Paper>
          <Paper withBorder radius="md" p="md">
            <Stack gap="sm">
              <div>
                <Text fw={800}>Current Design Images</Text>
                <Text size="sm" c="dimmed" mb="sm">
                  Every image attached to this job is shown below. Open or download any file before adding more.
                </Text>
                <DesignImageGallery
                  images={jobDetails[editDesignTarget?.production_job_id]?.images || []}
                  imageHeight={120}
                />
              </div>
            </Stack>
          </Paper>
          <Paper withBorder radius="md" p="md">
            <Stack gap="sm">
              <div>
                <Text fw={800}>Add More Design Photos</Text>
                <Text size="sm" c="dimmed">
                  Add reference photos, sketches, or artwork to this design job. Existing images stay in place.
                </Text>
              </div>
              <FileButton
                multiple
                accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
                onChange={(files) => setAdditionalDesignPhotos(files || [])}
              >
                {(props) => (
                  <Button {...props} variant="light" color="blue" leftSection={<IconPhoto size={16} />}>
                    Choose Photos
                  </Button>
                )}
              </FileButton>
              {additionalDesignPhotos.length > 0 && (
                <Text size="sm" fw={700}>
                  {additionalDesignPhotos.length} photo{additionalDesignPhotos.length === 1 ? "" : "s"} selected
                </Text>
              )}
              <Button
                color="blue"
                disabled={additionalDesignPhotos.length === 0}
                loading={savingAction}
                onClick={uploadAdditionalDesignPhotos}
              >
                Add Photos to This Design Job
              </Button>
            </Stack>
          </Paper>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => {
              setEditDesignTarget(null);
              setAdditionalDesignPhotos([]);
            }}>Cancel</Button>
            <Button color="red" loading={savingAction} onClick={saveDesignJob}>Save Design Job</Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={Boolean(activityTarget)}
        onClose={() => {
          setActivityTarget(null);
          setActivities([]);
        }}
        title={`${activityTarget?.work_order_number || "Work Order"} History`}
        centered
        size="lg"
      >
        {activityLoading ? <Text c="dimmed">Loading activity history…</Text> : activities.length ? (
          <Stack gap="xs">
            {activities.map((activity) => (
              <Paper key={activity.id} withBorder radius="md" p="sm">
                <Group justify="space-between" align="flex-start">
                  <div>
                    <Text fw={850}>{activity.event_type}</Text>
                    <Text size="xs" c="dimmed">{activity.actor || "Metal Worx Team"}</Text>
                  </div>
                  <Text size="xs" c="dimmed">{new Date(activity.created_at).toLocaleString()}</Text>
                </Group>
                {(activity.from_status || activity.to_status) && <Text size="sm" mt={5}>{activity.from_status || "—"} → {activity.to_status || "—"}</Text>}
                {activity.notes && <Text size="sm" mt={4} style={{ whiteSpace: "pre-wrap" }}>{activity.notes}</Text>}
              </Paper>
            ))}
          </Stack>
        ) : <Text c="dimmed">No activity has been recorded for this station yet.</Text>}
      </Modal>

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
