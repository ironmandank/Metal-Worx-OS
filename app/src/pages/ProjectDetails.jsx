import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  Divider,
  Group,
  Loader,
  Modal,
  NumberInput,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { DateInput, DateTimePicker } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import {
  IconActivity,
  IconBuilding,
  IconBolt,
  IconCalendar,
  IconCalendarEvent,
  IconCash,
  IconCheck,
  IconCreditCard,
  IconClipboardCheck,
  IconClock,
  IconFileDollar,
  IconFlag,
  IconMapPin,
  IconNotes,
  IconPackage,
  IconPencil,
  IconPhone,
  IconProgressCheck,
  IconPrinter,
  IconRefresh,
  IconRoute,
  IconSettingsAutomation,
  IconShoppingCart,
  IconTimeline,
  IconUser,
  IconUsers,
} from "@tabler/icons-react";

import { supabase } from "../lib/supabase";
import { releaseProject } from "../lib/productionWorkflow";

import MWActionBar from "../components/ui/MWActionBar";
import MWCommandCenter from "../components/ui/MWCommandCenter";
import MWInfoCard from "../components/ui/MWInfoCard";
import MWMaterialOverview from "../components/ui/MWMaterialOverview";
import MWMetricCard from "../components/ui/MWMetricCard";
import MWPageHeader from "../components/ui/MWPageHeader";
import MWProgressCard from "../components/ui/MWProgressCard";
import MWSection from "../components/ui/MWSection";
import MWSectionHeader from "../components/ui/MWSectionHeader";
import MWStatPill from "../components/ui/MWStatPill";
import MWStatusBadge from "../components/ui/MWStatusBadge";

function money(value) {
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function formatDate(value) {
  if (!value) {
    return "Not set";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString();
}

function formatDateTime(value) {
  if (!value) {
    return "Not set";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function statusColor(status) {
  if (
    [
      "Completed",
      "Approved",
      "Paid",
      "Received",
      "Passed",
      "Pricing Complete",
    ].includes(status)
  ) {
    return "green";
  }

  if (
    [
      "In Progress",
      "Scheduled",
      "Ordered",
      "Partially Received",
      "Sent",
    ].includes(status)
  ) {
    return "blue";
  }

  if (
    [
      "Pending",
      "On Hold",
      "Waiting",
      "Waiting Customer Approval",
      "At Powder Coat",
    ].includes(status)
  ) {
    return "orange";
  }

  if (
    [
      "Cancelled",
      "Declined",
      "Failed",
      "Past Due",
      "Pricing Needed",
      "Adjustments Needed",
      "Needs Rework",
    ].includes(status)
  ) {
    return "red";
  }

  if (["Ready", "Ready to Order", "Ready to Schedule"].includes(status)) {
    return "violet";
  }

  return "gray";
}

function priorityColor(priority) {
  if (priority === "Rush") {
    return "red";
  }

  if (priority === "High") {
    return "orange";
  }

  if (priority === "Low") {
    return "gray";
  }

  return "green";
}

function getRequestStatus(request) {
  return (
    request.status ||
    request.request_status ||
    request.material_status ||
    "Request Submitted"
  );
}

function getMaterialQueue(request) {
  const status = getRequestStatus(request);

  if (status === "Received" || request.received) {
    return "received";
  }

  if (
    status === "Ordered" ||
    status === "Partially Received" ||
    request.ordered
  ) {
    return "ordered";
  }

  if (status === "Ready to Order" || request.customer_approved) {
    return "ready";
  }

  if (
    status === "Waiting Customer Approval" ||
    (request.quote_complete && !request.customer_approved)
  ) {
    return "approval";
  }

  return "pricing";
}

function stageColor(stage) {
  if (stage?.complete) {
    return "green";
  }

  if (stage?.current) {
    return "red";
  }

  return statusColor(stage?.status);
}

function WorkflowStageCard({ stage, index }) {
  const color = stageColor(stage);

  return (
    <Card
      withBorder
      radius="lg"
      p="lg"
      style={{
        position: "relative",
        minHeight: 175,
        overflow: "hidden",
        borderColor: stage.current
          ? "var(--mantine-color-red-7)"
          : "rgba(255,255,255,0.08)",
        background: stage.current
          ? "linear-gradient(145deg, rgba(224,49,49,0.12), rgba(255,255,255,0.025))"
          : "linear-gradient(145deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015))",
        boxShadow: stage.current
          ? "0 12px 28px rgba(0,0,0,0.2)"
          : "0 8px 22px rgba(0,0,0,0.12)",
      }}
    >
      <Box
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          bottom: 0,
          width: 4,
          background: `var(--mantine-color-${color}-6)`,
        }}
      />

      <Stack justify="space-between" h="100%" gap="lg">
        <Group justify="space-between" align="flex-start">
          <ThemeIcon
            color={color}
            variant={stage.current ? "filled" : "light"}
            radius="lg"
            size={44}
            style={{
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {stage.complete ? (
              <IconCheck size={22} stroke={2.5} />
            ) : (
              <Text fw={900}>{index + 1}</Text>
            )}
          </ThemeIcon>

          {stage.current && (
            <MWStatusBadge
              status="In Progress"
              label="Current Stage"
              color="red"
              size="sm"
              variant="filled"
            />
          )}
        </Group>

        <Box>
          <Text
            fw={850}
            size="lg"
            c="gray.0"
            style={{
              lineHeight: 1.25,
              letterSpacing: "-0.015em",
              textAlign: "left",
            }}
          >
            {stage.label}
          </Text>

          <Group gap={6} mt={7} wrap="nowrap">
            <IconUser size={14} color="var(--mantine-color-gray-5)" />

            <Text
              size="xs"
              c="gray.5"
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                textAlign: "left",
              }}
            >
              {stage.owner}
            </Text>
          </Group>
        </Box>

        <MWStatusBadge
          status={stage.complete ? "Complete" : stage.status}
          color={color}
          size="sm"
        />
      </Stack>
    </Card>
  );
}

function ProjectDetails({
  selectedProject,
  setPage,
  setSelectedProductionJob,
  activeUser,
}) {
  const [project, setProject] = useState(selectedProject || null);

  const [materialRequests, setMaterialRequests] = useState([]);

  const [activeTab, setActiveTab] = useState("overview");

  const [materialsLoading, setMaterialsLoading] = useState(false);

  const [projectLoading, setProjectLoading] = useState(false);

  const [saving, setSaving] = useState(false);
  const [releasingProduction, setReleasingProduction] = useState(false);
  const [projectPayments, setProjectPayments] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [paymentType, setPaymentType] = useState("Final Payment");
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("Card");
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [closingProject, setClosingProject] = useState(false);

  async function releaseProjectProduction() {
    if (!project?.id || !productionReady || releasingProduction) return;
    setReleasingProduction(true);
    try {
      const job = await releaseProject(
        project.id,
        activeUser || project.assigned_to || project.intake_owner,
      );
      notifications.show({
        title: "Project Released to Production",
        message: `${job.production_job_number} is ready in ${job.current_department}.`,
        color: "green",
      });
      if (setSelectedProductionJob) setSelectedProductionJob(job);
      setPage("productionJobDetails");
    } catch (error) {
      notifications.show({
        title: "Project Could Not Be Released",
        message: error.message,
        color: "red",
      });
    } finally {
      setReleasingProduction(false);
    }
  }

  useEffect(() => {
    if (!selectedProject?.id) {
      return;
    }

    loadProject();
    loadMaterialRequests();
    loadProjectPayments();
  }, [selectedProject]);

  async function loadProject() {
    if (!selectedProject?.id) {
      return;
    }

    setProjectLoading(true);

    try {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", selectedProject.id)
        .single();

      if (error) {
        throw error;
      }

      setProject(data);
    } catch (error) {
      console.error("Project load error:", error);

      notifications.show({
        title: "Project Load Failed",
        message: error.message || "Unable to load the project.",
        color: "red",
      });
    } finally {
      setProjectLoading(false);
    }
  }

  async function loadProjectPayments() {
    if (!selectedProject?.id) {
      setProjectPayments([]);
      return;
    }

    setPaymentsLoading(true);
    try {
      const { data, error } = await supabase
        .from("project_payments")
        .select("*")
        .eq("project_id", selectedProject.id)
        .order("payment_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProjectPayments(data || []);
    } catch (error) {
      notifications.show({
        title: "Payment History Could Not Load",
        message: error.message,
        color: "red",
      });
    } finally {
      setPaymentsLoading(false);
    }
  }

  function openPaymentModal(defaultType = "Final Payment") {
    const remaining = Math.max(Number(project?.balance_due || 0), 0);
    setPaymentType(defaultType);
    setPaymentAmount(remaining);
    setPaymentMethod("Card");
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentReference("");
    setPaymentNotes("");
    setPaymentError("");
    setPaymentModalOpen(true);
  }

  function closePaymentModal() {
    if (recordingPayment) return;
    setPaymentModalOpen(false);
    setPaymentError("");
  }

  async function recordProjectPayment() {
    const amount = Number(paymentAmount || 0);
    const remaining = Math.max(Number(project?.balance_due || 0), 0);

    if (!project?.id || recordingPayment) return;
    if (amount <= 0) {
      setPaymentError("Enter a payment amount greater than zero.");
      return;
    }
    if (amount > remaining) {
      setPaymentError(
        `Payment cannot exceed the remaining balance of ${money(remaining)}.`,
      );
      return;
    }
    if (!paymentDate) {
      setPaymentError("Select the payment date.");
      return;
    }

    setRecordingPayment(true);
    setPaymentError("");

    try {
      const { error } = await supabase.rpc("mw_record_project_payment", {
        p_project_id: Number(project.id),
        p_payment_type: paymentType,
        p_amount: amount,
        p_payment_method: paymentMethod,
        p_payment_date: paymentDate,
        p_reference_number: paymentReference.trim() || null,
        p_notes: paymentNotes.trim() || null,
        p_recorded_by: activeUser || project.assigned_to || null,
      });

      if (error) throw error;

      setPaymentModalOpen(false);
      await Promise.all([loadProject(), loadProjectPayments()]);
      notifications.show({
        title: "Project Payment Recorded",
        message: `${money(amount)} was added to this project's payment history.`,
        color: "green",
        icon: <IconCheck size={18} />,
      });
    } catch (error) {
      setPaymentError(error.message || "The payment could not be recorded.");
    } finally {
      setRecordingPayment(false);
    }
  }

  async function completeProjectCloseout() {
    if (!project?.id || closingProject) return;

    setClosingProject(true);
    try {
      const { error } = await supabase.rpc("mw_complete_project_closeout", {
        p_project_id: Number(project.id),
        p_closed_by: activeUser || project.assigned_to || null,
      });

      if (error) throw error;

      notifications.show({
        title: "Office Closeout Completed",
        message: `${project.project_number || "The project"} is now completed.`,
        color: "green",
        icon: <IconCheck size={18} />,
      });
      setPage("dashboard");
    } catch (error) {
      notifications.show({
        title: "Project Could Not Be Closed",
        message: error.message,
        color: "red",
      });
    } finally {
      setClosingProject(false);
    }
  }

  async function loadMaterialRequests() {
    if (!selectedProject?.id) {
      setMaterialRequests([]);
      return;
    }

    setMaterialsLoading(true);

    try {
      const { data, error } = await supabase
        .from("project_material_requests")
        .select("*")
        .eq("project_id", selectedProject.id)
        .order("created_at", {
          ascending: true,
        });

      if (error) {
        throw error;
      }

      setMaterialRequests(data || []);
    } catch (error) {
      console.error("Material request load error:", error);

      notifications.show({
        title: "Procurement Load Failed",
        message: error.message || "Unable to load material requests.",
        color: "red",
      });
    } finally {
      setMaterialsLoading(false);
    }
  }

  function buildProcurementSummary(requests = materialRequests) {
    return requests.reduce(
      (summary, request) => {
        const queue = getMaterialQueue(request);

        summary.total += 1;
        summary[queue] += 1;

        summary.internalCost += Number(request.quoted_total || 0);

        summary.customerPrice += Number(request.customer_material_price || 0);

        summary.orderedCost += Number(request.ordered_cost || 0);

        return summary;
      },
      {
        total: 0,
        pricing: 0,
        approval: 0,
        ready: 0,
        ordered: 0,
        received: 0,
        internalCost: 0,
        customerPrice: 0,
        orderedCost: 0,
      },
    );
  }

  function getWorkflowStages(projectData, requests = materialRequests) {
    const stages = [];
    const procurement = buildProcurementSummary(requests);

    if (projectData.site_visit_required) {
      stages.push({
        key: "siteVisit",
        label: "Site Visit",
        owner: projectData.assigned_to || "Field Operations",
        status: projectData.site_visit_status || "Not Started",
        complete: projectData.site_visit_status === "Completed",
      });
    }

    if (projectData.measurements_required) {
      stages.push({
        key: "measurements",
        label: "Measurements",
        owner: projectData.assigned_to || "Field Operations",
        status: projectData.measurements_status || "Not Started",
        complete: projectData.measurements_status === "Completed",
      });
    }

    if (procurement.total > 0) {
      const pricingComplete = procurement.pricing === 0;

      stages.push({
        key: "pricing",
        label: "Material Pricing",
        owner: "Procurement",
        status: pricingComplete ? "Pricing Complete" : "Pricing Needed",
        complete: pricingComplete,
      });
    }

    if (projectData.quote_required) {
      stages.push({
        key: "quote",
        label: "Quote",
        owner: projectData.assigned_to || "Estimating",
        status: projectData.quote_status || "Not Started",
        complete: ["Sent", "Approved"].includes(projectData.quote_status),
      });
    }

    if (projectData.customer_approval_required !== false) {
      stages.push({
        key: "approval",
        label: "Customer Approval",
        owner: projectData.assigned_to || "Estimating",
        status: projectData.approval_status || "Pending",
        complete: projectData.approval_status === "Approved",
      });
    }

    if (projectData.down_payment_required) {
      stages.push({
        key: "downPayment",
        label: "Down Payment",
        owner: "Office",
        status: projectData.down_payment_status || "Pending",
        complete: projectData.down_payment_status === "Received",
      });
    }

    if (procurement.total > 0) {
      const allOrdered =
        procurement.ordered + procurement.received === procurement.total;

      const allReceived = procurement.received === procurement.total;

      stages.push({
        key: "orderMaterials",
        label: "Order Materials",
        owner: "Procurement",
        status: allOrdered
          ? "Ordered"
          : procurement.ready > 0
            ? "Ready to Order"
            : "Waiting",
        complete: allOrdered,
      });

      stages.push({
        key: "receiveMaterials",
        label: "Receive Materials",
        owner: "Procurement",
        status: allReceived
          ? "Received"
          : procurement.received > 0
            ? "Partially Received"
            : "Waiting",
        complete: allReceived,
      });
    }

    if (projectData.design_required) {
      stages.push({
        key: "design",
        label: "Design",
        owner: "Design",
        status: projectData.design_status || "Not Started",
        complete: projectData.design_status === "Completed",
      });
    }

    if (projectData.fabrication_required) {
      stages.push({
        key: "production",
        label: "Welding / Fabrication",
        owner: projectData.assigned_to || "Fabrication",
        status: projectData.fabrication_status || "Not Started",
        complete: projectData.fabrication_status === "Completed",
      });
    }

    if (projectData.test_fit_required) {
      stages.push({
        key: "testFit",
        label: "Test Fit",
        owner: projectData.assigned_to || "Production",
        status: projectData.test_fit_status || "Not Started",
        complete: projectData.test_fit_status === "Completed",
      });
    }

    if (projectData.finish_required) {
      stages.push({
        key: "finish",
        label: "Finish",
        owner: "Paint / Powder",
        status: projectData.finish_status || "Not Started",
        complete: projectData.finish_status === "Completed",
      });
    }

    if (projectData.assembly_required) {
      stages.push({
        key: "assembly",
        label: "Assembly",
        owner: projectData.assigned_to || "Assembly",
        status: projectData.assembly_status || "Not Started",
        complete: projectData.assembly_status === "Completed",
      });
    }

    if (projectData.install_required) {
      stages.push({
        key: "install",
        label: "Installation",
        owner: projectData.assigned_to || "Field Operations",
        status: projectData.install_status || "Not Started",
        complete: projectData.install_status === "Completed",
      });
    }

    if (
      projectData.final_inspection_status &&
      projectData.final_inspection_status !== "Not Required"
    ) {
      stages.push({
        key: "inspection",
        label: "Final Inspection",
        owner: "Quality Control",
        status: projectData.final_inspection_status,
        complete: projectData.final_inspection_status === "Passed",
      });
    }

    if (projectData.balance_status !== "Not Required") {
      stages.push({
        key: "balance",
        label: "Final Balance",
        owner: "Office",
        status: projectData.balance_status || "Pending",
        complete: projectData.balance_status === "Paid",
      });
    }

    let currentFound = false;

    return stages.map((stage) => {
      const complete = stage.complete || stage.status === "Not Required";
      const current = !currentFound && !complete;

      if (current) {
        currentFound = true;
      }

      return {
        ...stage,
        complete,
        current,
      };
    });
  }

  function calculateProgress(projectData, requests = materialRequests) {
    const stages = getWorkflowStages(projectData, requests);

    if (!stages.length) {
      return 0;
    }

    const weightedProgress = stages.reduce((total, stage) => {
      if (stage.complete) {
        return total + 1;
      }

      if (
        ["In Progress", "Scheduled", "Partially Received", "Ordered"].includes(
          stage.status,
        )
      ) {
        return total + 0.5;
      }

      if (["Ready", "Ready to Order", "Sent"].includes(stage.status)) {
        return total + 0.25;
      }

      return total;
    }, 0);

    return Math.round((weightedProgress / stages.length) * 100);
  }

  function calculateNextAction(projectData, requests = materialRequests) {
    if (projectData.status === "Cancelled") {
      return "Project cancelled";
    }

    if (
      projectData.site_visit_required &&
      projectData.site_visit_status !== "Completed"
    ) {
      return projectData.site_visit_status === "Scheduled"
        ? "Complete the scheduled site visit"
        : "Schedule the site visit";
    }

    if (
      projectData.measurements_required &&
      projectData.measurements_status !== "Completed"
    ) {
      return "Complete project measurements";
    }

    const procurement = buildProcurementSummary(requests);

    if (procurement.pricing > 0) {
      return "Complete material pricing";
    }

    if (
      projectData.quote_required &&
      projectData.quote_status === "Not Started"
    ) {
      return "Prepare the customer quote";
    }

    if (
      projectData.quote_required &&
      projectData.quote_status === "In Progress"
    ) {
      return "Finish preparing the customer quote";
    }

    if (
      projectData.customer_approval_required !== false &&
      projectData.quote_status === "Sent" &&
      projectData.approval_status !== "Approved"
    ) {
      return "Waiting for customer approval";
    }

    if (
      (projectData.customer_approval_required === false ||
        projectData.approval_status === "Approved") &&
      projectData.down_payment_required &&
      projectData.down_payment_status !== "Received"
    ) {
      return "Collect the required down payment";
    }

    if (procurement.ready > 0) {
      return "Order approved materials";
    }

    if (procurement.ordered > 0) {
      return "Waiting for material delivery";
    }

    if (
      projectData.design_required &&
      projectData.design_status !== "Completed"
    ) {
      return projectData.design_status === "In Progress"
        ? "Continue project design"
        : "Start project design";
    }

    if (
      projectData.fabrication_required &&
      (procurement.total === 0 || procurement.received === procurement.total) &&
      (!projectData.design_required ||
        projectData.design_status === "Completed") &&
      projectData.fabrication_status !== "Completed"
    ) {
      return projectData.fabrication_status === "In Progress"
        ? "Continue production work"
        : "Release the project to production";
    }

    if (
      projectData.test_fit_required &&
      projectData.fabrication_status === "Completed" &&
      projectData.test_fit_status !== "Completed"
    ) {
      return projectData.test_fit_status === "Scheduled"
        ? "Complete the scheduled test fit"
        : "Schedule the project test fit";
    }

    if (
      projectData.finish_required &&
      (!projectData.test_fit_required ||
        projectData.test_fit_status === "Completed") &&
      projectData.finish_status !== "Completed"
    ) {
      return projectData.finish_status === "At Powder Coat"
        ? "Waiting for powder coating"
        : "Complete paint or powder work";
    }

    if (
      projectData.assembly_required &&
      (!projectData.finish_required ||
        projectData.finish_status === "Completed") &&
      projectData.assembly_status !== "Completed"
    ) {
      return projectData.assembly_status === "In Progress"
        ? "Continue project assembly"
        : "Start project assembly";
    }

    if (
      projectData.install_required &&
      (projectData.assembly_required
        ? projectData.assembly_status === "Completed"
        : !projectData.finish_required ||
          projectData.finish_status === "Completed") &&
      projectData.install_status !== "Completed"
    ) {
      return projectData.install_status === "Scheduled"
        ? "Complete the scheduled installation"
        : "Schedule the installation";
    }

    if (
      projectData.balance_status !== "Not Required" &&
      projectData.balance_status !== "Paid"
    ) {
      return "Collect the remaining customer balance";
    }

    return "Project workflow is complete";
  }

  async function updateProject(updates) {
    if (!project?.id) {
      return;
    }

    setSaving(true);

    try {
      const updatedProject = {
        ...project,
        ...updates,
      };

      const percentComplete = calculateProgress(updatedProject);

      const automaticNextAction = calculateNextAction(updatedProject);

      const finalUpdates = {
        ...updates,
        percent_complete: percentComplete,
        next_action: Object.prototype.hasOwnProperty.call(
          updates,
          "next_action",
        )
          ? updates.next_action
          : automaticNextAction,
      };

      if (
        percentComplete === 100 &&
        updatedProject.balance_status === "Paid" &&
        updatedProject.status !== "Cancelled"
      ) {
        finalUpdates.status = "Completed";
        finalUpdates.next_action = "Project workflow is complete";
      } else if (
        updates.test_fit_status === "Completed" &&
        updatedProject.status === "Ready for Test Fit"
      ) {
        finalUpdates.status = "Ready for Production";
        finalUpdates.next_action = automaticNextAction;
      } else if (percentComplete > 0 && updatedProject.status === "New") {
        finalUpdates.status = "In Progress";
      }

      const { error } = await supabase
        .from("projects")
        .update(finalUpdates)
        .eq("id", project.id);

      if (error) {
        throw error;
      }

      notifications.show({
        title: "Project Updated",
        message: "Project information was saved.",
        color: "green",
      });

      await loadProject();
    } catch (error) {
      notifications.show({
        title: "Update Failed",
        message: error.message || "Unable to update the project.",
        color: "red",
      });
    } finally {
      setSaving(false);
    }
  }

  function updateLocal(field, value) {
    setProject((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function refreshProject() {
    await Promise.all([loadProject(), loadMaterialRequests()]);
  }

  const procurementSummary = useMemo(
    () => buildProcurementSummary(materialRequests),
    [materialRequests],
  );

  const workflowStages = useMemo(() => {
    if (!project) {
      return [];
    }

    return getWorkflowStages(project, materialRequests);
  }, [project, materialRequests]);

  const currentStage =
    workflowStages.find((stage) => stage.current) ||
    workflowStages[workflowStages.length - 1];

  const displayedProgress = project
    ? calculateProgress(project, materialRequests)
    : 0;

  const completedStageCount = workflowStages.filter(
    (stage) => stage.complete,
  ).length;

  const nextActionText = project
    ? calculateNextAction(project, materialRequests)
    : "No next action";

  const materialProfit =
    procurementSummary.customerPrice - procurementSummary.internalCost;

  const materialMargin =
    procurementSummary.customerPrice > 0
      ? (materialProfit / procurementSummary.customerPrice) * 100
      : 0;

  const allMaterialsReceived =
    procurementSummary.total > 0 &&
    procurementSummary.received === procurementSummary.total;

  const materialReadiness =
    procurementSummary.total > 0
      ? Math.round(
          (procurementSummary.received / procurementSummary.total) * 100,
        )
      : 100;

  const materialsOutstanding = Math.max(
    procurementSummary.total - procurementSummary.received,
    0,
  );

  const approvalReady =
    project?.customer_approval_required === false ||
    project?.approval_status === "Approved";

  const paymentReady =
    !project?.down_payment_required ||
    project?.down_payment_status === "Received";

  const materialsReady = procurementSummary.total === 0 || allMaterialsReceived;

  const productionReady =
    approvalReady &&
    paymentReady &&
    materialsReady &&
    project?.status !== "Cancelled" &&
    project?.status !== "On Hold";

  const productionRequirements = [
    {
      label: "Customer Approval",
      complete: approvalReady,
      description: approvalReady
        ? "Approval requirement satisfied"
        : "Customer approval is still required",
    },
    {
      label: "Down Payment",
      complete: paymentReady,
      description: paymentReady
        ? "Payment requirement satisfied"
        : "Required down payment has not been received",
    },
    {
      label: "Materials",
      complete: materialsReady,
      description: materialsReady
        ? "Required material is available"
        : "Material is still outstanding",
    },
  ];

  const productionReadinessPercent = Math.round(
    (productionRequirements.filter((item) => item.complete).length /
      productionRequirements.length) *
      100,
  );

  const projectHealth = useMemo(() => {
    if (!project) {
      return {
        score: 0,
        label: "Unknown",
        color: "gray",
      };
    }

    let score = 100;

    if (project.status === "On Hold") {
      score -= 30;
    }

    if (project.status === "Cancelled") {
      score = 0;
    }

    if (procurementSummary.pricing > 0) {
      score -= 12;
    }

    if (procurementSummary.approval > 0) {
      score -= 8;
    }

    if (procurementSummary.ordered > 0) {
      score -= 5;
    }

    if (project.approval_status === "Declined") {
      score -= 25;
    }

    if (
      project.balance_status === "Past Due" ||
      project.down_payment_status === "Past Due"
    ) {
      score -= 20;
    }

    if (project.due_date) {
      const dueDate = new Date(project.due_date);

      const today = new Date();

      const daysRemaining = (dueDate.getTime() - today.getTime()) / 86400000;

      if (daysRemaining < 0 && project.status !== "Completed") {
        score -= 30;
      } else if (daysRemaining <= 7 && displayedProgress < 75) {
        score -= 12;
      }
    }

    score = Math.max(Math.min(score, 100), 0);

    if (score >= 90) {
      return {
        score,
        label: "Excellent",
        color: "green",
      };
    }

    if (score >= 75) {
      return {
        score,
        label: "Good",
        color: "blue",
      };
    }

    if (score >= 55) {
      return {
        score,
        label: "Needs Attention",
        color: "orange",
      };
    }

    return {
      score,
      label: "At Risk",
      color: "red",
    };
  }, [project, procurementSummary, displayedProgress]);

  const activityFeed = useMemo(() => {
    const activity = [];

    if (project?.created_at) {
      activity.push({
        id: "project-created",
        date: project.created_at,
        title: "Project created",
        detail: project.intake_owner
          ? `Created by ${project.intake_owner}`
          : "Project entered into Metal Worx OS",
        color: "gray",
      });
    }

    materialRequests.forEach((request) => {
      if (request.created_at) {
        activity.push({
          id: `${request.id}-created`,
          date: request.created_at,
          title: "Material request created",
          detail: request.item_name || "Material item",
          color: "red",
        });
      }

      if (request.quote_date) {
        activity.push({
          id: `${request.id}-pricing`,
          date: request.quote_date,
          title: "Material pricing recorded",
          detail: `${request.item_name || "Material"} • ${money(
            request.quoted_total,
          )}`,
          color: "orange",
        });
      }

      if (request.ordered_at) {
        activity.push({
          id: `${request.id}-ordered`,
          date: request.ordered_at,
          title: "Material ordered",
          detail: request.item_name || "Material item",
          color: "blue",
        });
      }

      if (request.received_at) {
        activity.push({
          id: `${request.id}-received`,
          date: request.received_at,
          title: "Material received",
          detail: request.item_name || "Material item",
          color: "green",
        });
      }
    });

    return activity
      .filter((item) => item.date)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 15);
  }, [project, materialRequests]);

  async function printOutsideProjectRecord() {
    if (!project?.id) return;

    const printWindow = window.open("", "_blank", "width=1050,height=800");
    if (!printWindow) {
      notifications.show({
        title: "Print Window Blocked",
        message: "Allow pop-ups for Metal Worx OS and try again.",
        color: "red",
      });
      return;
    }

    printWindow.document.write(
      "<!doctype html><html><body style='font-family:Arial;padding:30px'>Preparing outside project record...</body></html>",
    );

    try {
      const [quotesResult, jobsResult, workOrdersResult] = await Promise.all([
        supabase
          .from("project_quotes")
          .select("*")
          .eq("project_id", project.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("production_jobs")
          .select("*")
          .eq("project_id", project.id)
          .order("created_at", { ascending: true }),
        supabase
          .from("work_orders")
          .select("*")
          .eq("project_id", project.id)
          .order("step_order", { ascending: true })
          .order("id", { ascending: true }),
      ]);

      const loadError =
        quotesResult.error || jobsResult.error || workOrdersResult.error;
      if (loadError) throw loadError;

      const quotes = quotesResult.data || [];
      const selectedQuote =
        quotes.find((quote) => quote.is_active) || quotes[0] || null;

      let quoteItems = [];
      let quoteImages = [];
      if (selectedQuote?.id) {
        const [itemsResult, imagesResult] = await Promise.all([
          supabase
            .from("project_quote_items")
            .select("*")
            .eq("quote_id", selectedQuote.id)
            .order("sort_order", { ascending: true }),
          supabase
            .from("project_quote_images")
            .select("*")
            .eq("quote_id", selectedQuote.id)
            .eq("show_on_pdf", true)
            .order("sort_order", { ascending: true }),
        ]);
        if (itemsResult.error) throw itemsResult.error;
        if (imagesResult.error) throw imagesResult.error;
        quoteItems = itemsResult.data || [];
        quoteImages = imagesResult.data || [];
      }

      const workflowRows = workflowStages
        .map(
          (stage, index) => `
            <tr>
              <td class="center">${index + 1}</td>
              <td>${escapeHtml(stage.label)}</td>
              <td>${escapeHtml(stage.owner || "")}</td>
              <td>${escapeHtml(stage.status || "")}</td>
              <td>${stage.complete ? "Complete" : stage.current ? "Current" : "Pending"}</td>
            </tr>`,
        )
        .join("");

      const productionRows = (workOrdersResult.data || []).length
        ? (workOrdersResult.data || [])
            .map(
              (step) => `
                <tr>
                  <td>${escapeHtml(step.work_order_number || "")}</td>
                  <td>${escapeHtml(step.step_name || step.department || "")}</td>
                  <td>${escapeHtml(step.status || "")}</td>
                  <td>${escapeHtml(formatDateTime(step.started_at || step.start_time))}</td>
                  <td>${escapeHtml(formatDateTime(step.completed_at || step.end_time))}</td>
                </tr>`,
            )
            .join("")
        : `<tr><td colspan="5">No shop production work orders recorded.</td></tr>`;

      const materialRows = materialRequests.length
        ? materialRequests
            .map(
              (request) => `
                <tr>
                  <td class="center">${escapeHtml(request.quantity ?? request.qty ?? 1)}</td>
                  <td>${escapeHtml(request.item_name || request.item || "Unnamed Item")}</td>
                  <td>${escapeHtml(request.dimensions || "")}</td>
                  <td>${escapeHtml(getRequestStatus(request))}</td>
                  <td class="center">${escapeHtml(request.quantity_received || 0)} / ${escapeHtml(request.quantity || request.qty || 1)}</td>
                </tr>`,
            )
            .join("")
        : `<tr><td colspan="5">No project material requests recorded.</td></tr>`;

      const quoteRows = quoteItems.length
        ? quoteItems
            .filter((item) => !item.is_optional || item.is_selected)
            .map(
              (item) => `
                <tr>
                  <td>${escapeHtml(item.title || item.item_type || "Project Item")}</td>
                  <td>${escapeHtml(item.description || "")}</td>
                  <td class="center">${escapeHtml(item.quantity || 1)}</td>
                  <td class="money">${escapeHtml(money(item.line_total))}</td>
                </tr>`,
            )
            .join("")
        : `<tr><td colspan="4">No accepted quote line items recorded.</td></tr>`;

      const paymentRows = projectPayments.length
        ? projectPayments
            .map(
              (payment) => `
                <tr>
                  <td>${escapeHtml(formatDate(payment.payment_date))}</td>
                  <td>${escapeHtml(payment.payment_type)}</td>
                  <td>${escapeHtml(payment.payment_method)}</td>
                  <td>${escapeHtml(payment.reference_number || "")}</td>
                  <td>${escapeHtml(payment.recorded_by || "")}</td>
                  <td class="money">${escapeHtml(money(payment.amount))}</td>
                </tr>`,
            )
            .join("")
        : `<tr><td colspan="6">No project payments recorded.</td></tr>`;

      const imageCards = quoteImages.length
        ? quoteImages
            .map(
              (image) => `
                <figure>
                  <img src="${escapeHtml(image.image_url)}" alt="${escapeHtml(image.caption || "Project image")}" />
                  <figcaption>${escapeHtml(image.caption || "Project Image")}</figcaption>
                </figure>`,
            )
            .join("")
        : `<p class="empty">No project record images selected.</p>`;

      const contractTotal =
        Number(project.contract_total || 0) ||
        Number(selectedQuote?.total_amount || 0);
      const generatedAt = new Date().toLocaleString();

      printWindow.document.open();
      printWindow.document.write(`<!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>${escapeHtml(project.project_number || "Project")} - Outside Project Record</title>
            <style>
              * { box-sizing: border-box; }
              body { margin: 0; color: #151515; background: #fff; font-family: Arial, Helvetica, sans-serif; font-size: 10.5px; line-height: 1.35; }
              .record { width: 100%; max-width: 980px; margin: 0 auto; padding: 24px; }
              .header { display: grid; grid-template-columns: 165px 1fr auto; gap: 18px; align-items: center; border-bottom: 4px solid #c90018; padding-bottom: 16px; }
              .logo { width: 160px; max-height: 72px; object-fit: contain; }
              h1 { margin: 0; font-size: 24px; }
              .eyebrow { color: #c90018; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
              .number { text-align: right; }
              .number strong { display: block; font-size: 17px; }
              .status { display: inline-block; margin-top: 5px; padding: 4px 9px; border-radius: 999px; background: #222; color: #fff; font-weight: 800; }
              .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 11px; margin-top: 13px; }
              .grid.three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
              .box { border: 1px solid #c9c9c9; border-radius: 7px; padding: 10px; break-inside: avoid; }
              .label { color: #666; font-size: 9px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
              .value { margin-top: 3px; font-size: 12.5px; font-weight: 700; overflow-wrap: anywhere; }
              section { margin-top: 17px; }
              h2 { margin: 0 0 8px; padding-bottom: 5px; border-bottom: 2px solid #c90018; font-size: 14px; text-transform: uppercase; }
              table { width: 100%; border-collapse: collapse; }
              th, td { border: 1px solid #cfcfcf; padding: 6px; vertical-align: top; }
              th { color: #fff; background: #222; font-size: 8.5px; letter-spacing: .04em; text-align: left; text-transform: uppercase; }
              .center { text-align: center; }
              .money { text-align: right; white-space: nowrap; }
              .notes { white-space: pre-wrap; overflow-wrap: anywhere; min-height: 42px; }
              .checks { display: grid; grid-template-columns: repeat(3, 1fr); gap: 9px; }
              .check { border: 1px solid #bbb; border-radius: 6px; padding: 9px; text-align: center; font-weight: 800; }
              .check.done { border-color: #238636; background: #eaf7ed; color: #176326; }
              .images { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
              figure { margin: 0; border: 1px solid #ccc; border-radius: 6px; padding: 6px; break-inside: avoid; }
              figure img { width: 100%; height: 155px; object-fit: contain; display: block; }
              figcaption { margin-top: 5px; text-align: center; color: #555; font-size: 9px; }
              .empty { color: #666; font-style: italic; }
              footer { margin-top: 22px; padding-top: 9px; border-top: 1px solid #aaa; color: #666; display: flex; justify-content: space-between; font-size: 9px; }
              @page { size: letter; margin: .42in; }
              @media print { .record { max-width: none; padding: 0; } body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
            </style>
          </head>
          <body>
            <main class="record">
              <header class="header">
                <img class="logo" src="/metal_worx_header_logo_transparent(1).png" alt="Metal Worx" />
                <div><div class="eyebrow">Outside Project Record</div><h1>${escapeHtml(project.project_name || "Outside Project")}</h1></div>
                <div class="number"><span class="label">Project Number</span><strong>${escapeHtml(project.project_number || project.id)}</strong><span class="status">${escapeHtml(project.status || "Unknown")}</span></div>
              </header>

              <div class="grid">
                <div class="box"><div class="label">Customer / Contact</div><div class="value">${escapeHtml(project.contact_name || "Not recorded")}</div><div>${escapeHtml(project.phone || "")} ${escapeHtml(project.email || "")}</div></div>
                <div class="box"><div class="label">Job Site</div><div class="value">${escapeHtml(project.location || project.site_address || "Not recorded")}</div><div>${escapeHtml([project.city, project.state, project.zip].filter(Boolean).join(", "))}</div></div>
              </div>
              <div class="grid three">
                <div class="box"><div class="label">Assigned To</div><div class="value">${escapeHtml(project.assigned_to || "Unassigned")}</div></div>
                <div class="box"><div class="label">Priority</div><div class="value">${escapeHtml(project.priority || "Normal")}</div></div>
                <div class="box"><div class="label">Target Completion</div><div class="value">${escapeHtml(formatDate(project.target_completion_date || project.due_date))}</div></div>
                <div class="box"><div class="label">Contract Total</div><div class="value">${escapeHtml(money(contractTotal))}</div></div>
                <div class="box"><div class="label">Amount Paid</div><div class="value">${escapeHtml(money(project.amount_paid))}</div></div>
                <div class="box"><div class="label">Remaining Balance</div><div class="value">${escapeHtml(money(project.balance_due))}</div></div>
              </div>

              <section><h2>Scope & Quote Reference</h2>
                <div class="grid">
                  <div class="box"><div class="label">Quote</div><div class="value">${escapeHtml(selectedQuote?.quote_number || "No quote connected")}</div><div>${escapeHtml(selectedQuote?.status || "")}</div></div>
                  <div class="box"><div class="label">Project Type</div><div class="value">${escapeHtml(project.project_type || project.project_category || "Outside Fabrication")}</div></div>
                </div>
                <div class="box" style="margin-top:10px"><div class="label">Scope of Work</div><div class="notes">${escapeHtml(selectedQuote?.scope_of_work || project.scope_of_work || project.description || "No scope recorded.")}</div></div>
                <table style="margin-top:10px"><thead><tr><th>Item</th><th>Description</th><th class="center">Qty</th><th class="money">Total</th></tr></thead><tbody>${quoteRows}</tbody></table>
              </section>

              <section><h2>Project Workflow</h2><table><thead><tr><th class="center">Step</th><th>Stage</th><th>Owner</th><th>Status</th><th>Result</th></tr></thead><tbody>${workflowRows}</tbody></table></section>
              <section><h2>Shop Production Work</h2><table><thead><tr><th>Work Order</th><th>Stage</th><th>Status</th><th>Started</th><th>Completed</th></tr></thead><tbody>${productionRows}</tbody></table></section>
              <section><h2>Materials</h2><table><thead><tr><th class="center">Qty</th><th>Item</th><th>Dimensions</th><th>Status</th><th class="center">Received</th></tr></thead><tbody>${materialRows}</tbody></table></section>

              <section><h2>Field Work & Closeout</h2>
                <div class="checks">
                  <div class="check ${project.test_fit_status === "Completed" || !project.test_fit_required ? "done" : ""}">Test Fit: ${escapeHtml(project.test_fit_status || "Not Required")}</div>
                  <div class="check ${project.install_status === "Completed" || !project.install_required ? "done" : ""}">Installation: ${escapeHtml(project.install_status || "Not Required")}</div>
                  <div class="check ${["Passed", "Not Required"].includes(project.final_inspection_status) ? "done" : ""}">Inspection: ${escapeHtml(project.final_inspection_status || "Not Required")}</div>
                </div>
                <div class="grid">
                  <div class="box"><div class="label">Test Fit</div><div class="value">${escapeHtml(formatDateTime(project.test_fit_start))}</div><div>Completed: ${escapeHtml(formatDateTime(project.test_fit_end))}</div></div>
                  <div class="box"><div class="label">Installation</div><div class="value">${escapeHtml(formatDateTime(project.install_start))}</div><div>Completed: ${escapeHtml(formatDateTime(project.install_end))}</div></div>
                </div>
              </section>

              <section><h2>Payment History</h2><table><thead><tr><th>Date</th><th>Type</th><th>Method</th><th>Reference</th><th>Recorded By</th><th class="money">Amount</th></tr></thead><tbody>${paymentRows}</tbody></table></section>
              <section><h2>Project Notes</h2><div class="box"><div class="notes">${escapeHtml(project.notes || "No project notes.")}</div></div></section>
              <section><h2>Project Images</h2><div class="images">${imageCards}</div></section>
              <footer><span>Metal Worx OS · Outside Project Record</span><span>Generated ${escapeHtml(generatedAt)}</span></footer>
            </main>
            <script>window.addEventListener("load",function(){window.setTimeout(function(){window.print();},500);});</script>
          </body>
        </html>`);
      printWindow.document.close();
    } catch (error) {
      printWindow.close();
      notifications.show({
        title: "Project Record Could Not Be Prepared",
        message: error.message,
        color: "red",
      });
    }
  }

  const actionItems = [
    {
      key: "recordPdf",
      label: "Export Record PDF",
      color: "gray",
      variant: "light",
      icon: <IconPrinter size={18} />,
      onClick: printOutsideProjectRecord,
    },
    {
      key: "quote",
      label: "Open Quote",
      color: "red",
      variant: "filled",
      icon: <IconFileDollar size={18} />,
      onClick: () => setPage("quoteBuilder"),
    },
    {
      key: "procurement",
      label: "Procurement",
      color: "orange",
      variant: "light",
      icon: <IconShoppingCart size={18} />,
      onClick: () => setPage("procurement"),
    },
    {
      key: "edit",
      label: "Edit Project",
      color: "gray",
      variant: "light",
      icon: <IconPencil size={18} />,
      onClick: () => setPage("editProject"),
    },
    {
      key: "schedule",
      label: "Schedule",
      color: "blue",
      variant: "light",
      icon: <IconCalendar size={18} />,
      onClick: () => setActiveTab("schedule"),
    },
    {
      key: "production",
      label: productionReady ? "Production Ready" : "Production Check",
      color: productionReady ? "green" : "orange",
      variant: "light",
      icon: <IconSettingsAutomation size={18} />,
      onClick: () => setActiveTab("production"),
    },
    {
      key: "refresh",
      label: "Refresh",
      color: "gray",
      variant: "light",
      icon: <IconRefresh size={18} />,
      loading: projectLoading || materialsLoading,
      onClick: refreshProject,
    },
  ];

  const quickTurnaroundDue = project?.quick_turnaround_required_by
    ? new Date(project.quick_turnaround_required_by)
    : null;

  const quickTurnaroundHours =
    quickTurnaroundDue && !Number.isNaN(quickTurnaroundDue.getTime())
      ? (quickTurnaroundDue.getTime() - Date.now()) / 3600000
      : null;

  const quickTurnaroundTiming =
    quickTurnaroundHours === null
      ? "Not Scheduled"
      : quickTurnaroundHours < 0
        ? "Overdue"
        : quickTurnaroundHours <= 4
          ? "Due Soon"
          : quickTurnaroundDue.toDateString() === new Date().toDateString()
            ? "Due Today"
            : "Upcoming";

  const quickTurnaroundColor =
    quickTurnaroundTiming === "Overdue"
      ? "red"
      : quickTurnaroundTiming === "Due Soon"
        ? "orange"
        : quickTurnaroundTiming === "Due Today"
          ? "yellow"
          : "blue";

  if (!project) {
    return (
      <>
        <MWPageHeader
          title="Project Not Found"
          subtitle="Return to Projects and open a project."
          setPage={setPage}
          showBack
          backPage="projects"
          backLabel="Projects"
          showDashboard
        />

        <MWSection title="Project Not Found">
          <Text c="dimmed">Return to Projects and open a project.</Text>
        </MWSection>
      </>
    );
  }

  if (projectLoading) {
    return (
      <>
        <MWPageHeader
          title={project.project_number || "Project Command Center"}
          subtitle={project.project_name || "Loading project"}
          setPage={setPage}
          showBack
          backPage="projects"
          backLabel="Projects"
          showDashboard
        />

        <Card withBorder radius="lg" p="xl">
          <Group justify="center">
            <Loader color="red" />
            <Text>Loading project...</Text>
          </Group>
        </Card>
      </>
    );
  }

  return (
    <>
      <MWPageHeader
        title={project.project_number || "Project Command Center"}
        subtitle={project.project_name || "Project Command Center"}
        buttonText="Edit Project"
        onButtonClick={() => setPage("editProject")}
        setPage={setPage}
        showBack
        backPage="projects"
        backLabel="Projects"
        showDashboard
      />

      <Stack gap="lg">
        <MWCommandCenter
          title="Project Command Center"
          subtitle={project.project_name || project.project_number || "Project"}
          currentStage={currentStage?.label || project.status || "Project"}
          currentStageStatus={currentStage?.status || "Not Started"}
          currentStageOwner={
            currentStage?.owner || project.assigned_to || "Not assigned"
          }
          currentStageColor={currentStage ? stageColor(currentStage) : "gray"}
          nextAction={nextActionText}
          progress={displayedProgress}
          progressColor="red"
          health={projectHealth.score}
          healthLabel={projectHealth.label}
          healthColor={projectHealth.color}
          status={project.status || "New"}
          statusColor={statusColor(project.status)}
          priority={project.priority || "Normal"}
          priorityColor={priorityColor(project.priority)}
          dueDate={formatDate(project.due_date)}
          assignedTo={project.assigned_to || "Not assigned"}
          footer={
            <Group gap="sm" wrap="wrap">
              <MWStatPill
                label="Workflow"
                value={`${completedStageCount}/${workflowStages.length}`}
                icon={IconRoute}
                color="red"
                size="sm"
              />

              <MWStatPill
                label="Materials"
                value={`${procurementSummary.received}/${procurementSummary.total}`}
                icon={IconPackage}
                color={materialsReady ? "green" : "orange"}
                size="sm"
              />

              <MWStatPill
                label="Due"
                value={formatDate(project.due_date)}
                icon={IconCalendarEvent}
                color="blue"
                size="sm"
              />

              <MWStatPill
                label="Assigned"
                value={project.assigned_to || "Not assigned"}
                icon={IconUser}
                color="gray"
                size="sm"
              />
            </Group>
          }
        />

        {project.is_quick_turnaround && (
          <Alert
            color={quickTurnaroundColor}
            variant="light"
            icon={<IconBolt size={24} />}
            title={
              <Group gap="xs" wrap="wrap">
                <Text fw={900}>Quick Turnaround Project</Text>
                <Badge
                  color={
                    project.quick_turnaround_priority === "Critical"
                      ? "red"
                      : project.quick_turnaround_priority === "Urgent"
                        ? "orange"
                        : "yellow"
                  }
                >
                  {project.quick_turnaround_priority || "Urgent"}
                </Badge>
                <Badge color={quickTurnaroundColor} variant="filled">
                  {quickTurnaroundTiming}
                </Badge>
              </Group>
            }
          >
            <Stack gap="sm">
              <SimpleGrid
                cols={{
                  base: 1,
                  sm: 2,
                  lg: 4,
                }}
                spacing="sm"
              >
                <Stack gap={2}>
                  <Text size="xs" c="dimmed" fw={800} tt="uppercase">
                    Required Completion
                  </Text>
                  <Text fw={850}>
                    {formatDateTime(project.quick_turnaround_required_by)}
                  </Text>
                </Stack>

                <Stack gap={2}>
                  <Text size="xs" c="dimmed" fw={800} tt="uppercase">
                    Time Remaining
                  </Text>
                  <Text fw={850}>
                    {quickTurnaroundHours === null
                      ? "Not scheduled"
                      : quickTurnaroundHours < 0
                        ? `${Math.abs(
                            Math.round(quickTurnaroundHours),
                          )} hours overdue`
                        : `${Math.round(quickTurnaroundHours)} hours`}
                  </Text>
                </Stack>

                <Stack gap={2}>
                  <Text size="xs" c="dimmed" fw={800} tt="uppercase">
                    Assigned To
                  </Text>
                  <Text fw={850}>{project.assigned_to || "Unassigned"}</Text>
                </Stack>

                <Stack gap={2}>
                  <Text size="xs" c="dimmed" fw={800} tt="uppercase">
                    Materials
                  </Text>
                  <Text fw={850}>
                    {materialsReady
                      ? "Ready"
                      : procurementSummary.total > 0
                        ? "Outstanding"
                        : "Not Required"}
                  </Text>
                </Stack>
              </SimpleGrid>

              {project.quick_turnaround_reason && (
                <Text size="sm">
                  <Text component="span" fw={850}>
                    Reason:
                  </Text>
                  {project.quick_turnaround_reason}
                </Text>
              )}

              <Group>
                <Button
                  size="xs"
                  color={quickTurnaroundColor}
                  leftSection={<IconBolt size={16} />}
                  onClick={() => setPage("quickTurnaround")}
                >
                  Open Today's Commitments
                </Button>

                <Button
                  size="xs"
                  variant="light"
                  color="gray"
                  leftSection={<IconPencil size={16} />}
                  onClick={() => setPage("editProject")}
                >
                  Edit Quick Turnaround
                </Button>
              </Group>
            </Stack>
          </Alert>
        )}

        <MWActionBar actions={actionItems} />

        <Tabs
          value={activeTab}
          onChange={(value) => setActiveTab(value || "overview")}
          keepMounted={false}
        >
          <Tabs.List
            mb="lg"
            style={{
              gap: 4,
              padding: 6,
              borderRadius: "var(--mantine-radius-lg)",
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.025)",
            }}
          >
            <Tabs.Tab value="overview" leftSection={<IconBuilding size={16} />}>
              Overview
            </Tabs.Tab>

            <Tabs.Tab value="workflow" leftSection={<IconTimeline size={16} />}>
              Workflow
            </Tabs.Tab>

            <Tabs.Tab
              value="procurement"
              leftSection={<IconShoppingCart size={16} />}
              rightSection={
                procurementSummary.total > 0 ? (
                  <MWStatusBadge
                    status="Active"
                    label={String(procurementSummary.total)}
                    color="red"
                    size="xs"
                    showIcon={false}
                    variant="filled"
                  />
                ) : null
              }
            >
              Procurement
            </Tabs.Tab>

            <Tabs.Tab
              value="production"
              leftSection={<IconSettingsAutomation size={16} />}
            >
              Production
            </Tabs.Tab>

            <Tabs.Tab value="schedule" leftSection={<IconCalendar size={16} />}>
              Schedule
            </Tabs.Tab>

            <Tabs.Tab value="activity" leftSection={<IconActivity size={16} />}>
              Activity
            </Tabs.Tab>

            <Tabs.Tab value="notes" leftSection={<IconNotes size={16} />}>
              Notes
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="overview">
            <Stack gap="lg">
              <MWMaterialOverview
                internalCost={procurementSummary.internalCost}
                customerPrice={procurementSummary.customerPrice}
                materialProfit={materialProfit}
                materialMargin={materialMargin}
                readiness={materialReadiness}
                pricing={procurementSummary.pricing}
                approval={procurementSummary.approval}
                ready={procurementSummary.ready}
                ordered={procurementSummary.ordered}
                received={procurementSummary.received}
                outstanding={materialsOutstanding}
                total={procurementSummary.total}
              />

              <SimpleGrid
                cols={{
                  base: 1,
                  xl: 12,
                }}
                spacing="lg"
              >
                <Box
                  style={{
                    gridColumn: "span 7",
                    minWidth: 0,
                  }}
                >
                  <MWInfoCard
                    title="Customer & Project"
                    subtitle="Primary customer, site location, ownership, and project classification."
                    icon={IconBuilding}
                    color="blue"
                    columns={2}
                    items={[
                      {
                        label: "Customer",
                        value: project.contact_name,
                        icon: IconUser,
                      },
                      {
                        label: "Phone",
                        value: project.contact_phone,
                        icon: IconPhone,
                      },
                      {
                        label: "Project Address",
                        value: project.job_address,
                        icon: IconMapPin,
                        fullWidth: true,
                      },
                      {
                        label: "City / State",
                        value: [project.city, project.state]
                          .filter(Boolean)
                          .join(", "),
                        icon: IconMapPin,
                      },
                      {
                        label: "Assigned To",
                        value: project.assigned_to,
                        icon: IconUsers,
                      },
                      {
                        label: "Project Type",
                        value: project.project_type,
                        icon: IconFlag,
                      },
                      {
                        label: "Category",
                        value: project.project_category,
                        icon: IconBuilding,
                      },
                      {
                        label: "Due Date",
                        value: formatDate(project.due_date),
                        icon: IconCalendarEvent,
                      },
                    ]}
                  />
                </Box>

                <Box
                  style={{
                    gridColumn: "span 5",
                    minWidth: 0,
                  }}
                >
                  <Stack gap="lg">
                    <MWInfoCard
                      title="Approval & Payment"
                      subtitle="Commercial authorization and payment requirements."
                      icon={IconFileDollar}
                      color="green"
                      compact
                    >
                      <Stack gap="md">
                        <Group justify="space-between" gap="lg">
                          <Text size="sm" c="gray.4" fw={700}>
                            Quote
                          </Text>

                          <MWStatusBadge
                            status={project.quote_status || "Not Started"}
                          />
                        </Group>

                        <Divider color="rgba(255,255,255,0.07)" />

                        <Group justify="space-between" gap="lg">
                          <Text size="sm" c="gray.4" fw={700}>
                            Customer Approval
                          </Text>

                          <MWStatusBadge
                            status={project.approval_status || "Pending"}
                          />
                        </Group>

                        <Divider color="rgba(255,255,255,0.07)" />

                        <Group justify="space-between" gap="lg">
                          <Text size="sm" c="gray.4" fw={700}>
                            Down Payment
                          </Text>

                          <MWStatusBadge
                            status={
                              project.down_payment_status || "Not Required"
                            }
                          />
                        </Group>

                        <Divider color="rgba(255,255,255,0.07)" />

                        <Group justify="space-between" gap="lg">
                          <Text size="sm" c="gray.4" fw={700}>
                            Final Balance
                          </Text>

                          <MWStatusBadge
                            status={project.balance_status || "Pending"}
                          />
                        </Group>

                        <Button
                          variant="light"
                          color="red"
                          leftSection={<IconFileDollar size={17} />}
                          onClick={() => setPage("quoteBuilder")}
                        >
                          Open Quote Builder
                        </Button>
                      </Stack>
                    </MWInfoCard>

                    <MWInfoCard
                      title="Project Control"
                      subtitle="Update status, priority, and operational direction."
                      icon={IconProgressCheck}
                      color="red"
                      highlight
                      compact
                    >
                      <Stack gap="md">
                        <SimpleGrid
                          cols={{
                            base: 1,
                            sm: 2,
                          }}
                          spacing="md"
                        >
                          <Select
                            label="Project Status"
                            data={[
                              "New",
                              "In Progress",
                              "On Hold",
                              "Completed",
                              "Cancelled",
                            ]}
                            value={project.status || "New"}
                            onChange={(value) => {
                              if (!value) {
                                return;
                              }

                              updateProject({
                                status: value,
                              });
                            }}
                          />

                          <Select
                            label="Priority"
                            data={["Low", "Normal", "High", "Rush"]}
                            value={project.priority || "Normal"}
                            onChange={(value) => {
                              if (!value) {
                                return;
                              }

                              updateProject({
                                priority: value,
                              });
                            }}
                          />
                        </SimpleGrid>

                        <Textarea
                          label="Next Action"
                          minRows={3}
                          value={project.next_action || ""}
                          onChange={(event) =>
                            updateLocal(
                              "next_action",
                              event.currentTarget.value,
                            )
                          }
                        />

                        <Button
                          color="red"
                          loading={saving}
                          leftSection={<IconCheck size={17} />}
                          onClick={() =>
                            updateProject({
                              next_action: project.next_action,
                            })
                          }
                        >
                          Save Next Action
                        </Button>
                      </Stack>
                    </MWInfoCard>
                  </Stack>
                </Box>
              </SimpleGrid>

              <MWProgressCard
                title="Project Completion"
                subtitle="Overall progress through the complete project lifecycle."
                value={displayedProgress}
                color="red"
                icon={IconProgressCheck}
                completed={completedStageCount}
                total={workflowStages.length}
                description="Includes field verification, pricing, customer authorization, procurement, production, finishing, installation, inspection, and final payment."
                milestones={workflowStages.map((stage) => ({
                  label: stage.label,
                  description: `${stage.owner} • ${stage.status}`,
                  complete: stage.complete,
                  warning: stage.current,
                }))}
              />
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="workflow">
            <Stack gap="lg">
              <MWSection>
                <MWSectionHeader
                  title="Project Workflow"
                  subtitle="Current routing from project intake through final payment."
                  icon={IconTimeline}
                  color="red"
                  count={workflowStages.length}
                  countLabel="Stages"
                />

                <SimpleGrid
                  cols={{
                    base: 1,
                    sm: 2,
                    lg: 3,
                    xl: 4,
                  }}
                  spacing="lg"
                  mt="lg"
                >
                  {workflowStages.map((stage, index) => (
                    <WorkflowStageCard
                      key={stage.key}
                      stage={stage}
                      index={index}
                    />
                  ))}
                </SimpleGrid>
              </MWSection>

              <SimpleGrid
                cols={{
                  base: 1,
                  xl: 3,
                }}
                spacing="lg"
              >
                <MWInfoCard
                  title="Site Visit & Measurements"
                  subtitle="Control field verification and measurement requirements."
                  icon={IconMapPin}
                  color="blue"
                >
                  <Stack gap="md">
                    {project.site_visit_required && (
                      <Select
                        label="Site Visit Status"
                        data={[
                          "Not Required",
                          "Not Started",
                          "Scheduled",
                          "Completed",
                        ]}
                        value={project.site_visit_status || "Not Started"}
                        onChange={(value) => {
                          if (!value) {
                            return;
                          }

                          updateProject({
                            site_visit_status: value,
                          });
                        }}
                      />
                    )}

                    {project.measurements_required && (
                      <Select
                        label="Measurements Status"
                        data={[
                          "Not Required",
                          "Not Started",
                          "In Progress",
                          "Completed",
                        ]}
                        value={project.measurements_status || "Not Started"}
                        onChange={(value) => {
                          if (!value) {
                            return;
                          }

                          updateProject({
                            measurements_status: value,
                          });
                        }}
                      />
                    )}

                    {!project.site_visit_required &&
                      !project.measurements_required && (
                        <Alert color="gray" variant="light">
                          No site visit or measurement requirements are enabled.
                        </Alert>
                      )}
                  </Stack>
                </MWInfoCard>

                <MWInfoCard
                  title="Quote & Payment"
                  subtitle="Manage the commercial approval and payment workflow."
                  icon={IconCash}
                  color="green"
                >
                  <Stack gap="md">
                    <Select
                      label="Quote Status"
                      data={[
                        "Not Required",
                        "Not Started",
                        "In Progress",
                        "Sent",
                        "Approved",
                        "Declined",
                      ]}
                      value={project.quote_status || "Not Started"}
                      onChange={(value) => {
                        if (!value) {
                          return;
                        }

                        updateProject({
                          quote_status: value,
                        });
                      }}
                    />

                    <Select
                      label="Approval Status"
                      data={["Pending", "Approved", "Declined", "On Hold"]}
                      value={project.approval_status || "Pending"}
                      onChange={(value) => {
                        if (!value) {
                          return;
                        }

                        updateProject({
                          approval_status: value,
                        });
                      }}
                    />

                    <Stack gap="sm">
                      <Card withBorder radius="md" p="md">
                        <Group justify="space-between" wrap="nowrap">
                          <Text size="sm" c="dimmed" fw={800} tt="uppercase">
                            Contract Total
                          </Text>
                          <Text fw={900} size="xl" ta="right">
                            {money(project.contract_total)}
                          </Text>
                        </Group>
                      </Card>
                      <Card withBorder radius="md" p="md">
                        <Group justify="space-between" wrap="nowrap">
                          <Text size="sm" c="dimmed" fw={800} tt="uppercase">
                            Amount Paid
                          </Text>
                          <Text fw={900} size="xl" c="green" ta="right">
                            {money(project.amount_paid)}
                          </Text>
                        </Group>
                      </Card>
                      <Card withBorder radius="md" p="md">
                        <Group justify="space-between" wrap="nowrap">
                          <Text size="sm" c="dimmed" fw={800} tt="uppercase">
                            Remaining Balance
                          </Text>
                          <Text
                            fw={900}
                            size="xl"
                            ta="right"
                            c={
                              Number(project.balance_due || 0) > 0
                                ? "red"
                                : "green"
                            }
                          >
                            {money(project.balance_due)}
                          </Text>
                        </Group>
                      </Card>
                    </Stack>

                    <Group justify="space-between" wrap="wrap">
                      <Box>
                        <Text size="sm" c="dimmed">
                          Down Payment
                        </Text>
                        <Text fw={800}>
                          {project.down_payment_status || "Not Required"}
                        </Text>
                      </Box>
                      <Box>
                        <Text size="sm" c="dimmed">
                          Final Balance
                        </Text>
                        <Text
                          fw={800}
                          c={
                            Number(project.balance_due || 0) <= 0
                              ? "green"
                              : "red"
                          }
                        >
                          {Number(project.balance_due || 0) <= 0
                            ? "Paid in Full"
                            : project.balance_status || "Pending"}
                        </Text>
                      </Box>
                      <Button
                        color="green"
                        leftSection={<IconCreditCard size={17} />}
                        disabled={Number(project.balance_due || 0) <= 0}
                        onClick={() =>
                          openPaymentModal(
                            Number(project.amount_paid || 0) > 0
                              ? "Final Payment"
                              : "Down Payment",
                          )
                        }
                      >
                        Record Payment
                      </Button>
                    </Group>

                    {Number(project.balance_due || 0) <= 0 &&
                      (!project.install_required ||
                        project.install_status === "Completed") &&
                      ["Passed", "Not Required"].includes(
                        project.final_inspection_status || "Not Required",
                      ) &&
                      project.status !== "Completed" && (
                        <Card
                          withBorder
                          radius="md"
                          p="lg"
                          style={{
                            background: "rgba(34, 139, 68, 0.16)",
                            borderColor: "rgba(74, 222, 128, 0.36)",
                            overflow: "hidden",
                          }}
                        >
                          <Stack gap="md">
                            <Group gap="sm" wrap="nowrap" align="flex-start">
                              <ThemeIcon
                                color="green"
                                variant="light"
                                radius="xl"
                                style={{ flexShrink: 0 }}
                              >
                                <IconClipboardCheck size={18} />
                              </ThemeIcon>
                              <Box style={{ minWidth: 0 }}>
                                <Text fw={900} size="lg">
                                  Ready to Close
                                </Text>
                                <Text size="sm" c="gray.3">
                                  Installation, inspection, and payment are
                                  complete.
                                </Text>
                              </Box>
                            </Group>
                            <Button
                              color="green"
                              fullWidth
                              loading={closingProject}
                              leftSection={<IconClipboardCheck size={17} />}
                              onClick={completeProjectCloseout}
                              styles={{
                                root: {
                                  height: "auto",
                                  minHeight: 42,
                                  paddingTop: 9,
                                  paddingBottom: 9,
                                },
                                label: {
                                  whiteSpace: "normal",
                                  textAlign: "center",
                                  lineHeight: 1.2,
                                },
                              }}
                            >
                              Complete Closeout
                            </Button>
                          </Stack>
                        </Card>
                      )}

                    <Divider />

                    <Text fw={900}>Payment History</Text>
                    {paymentsLoading ? (
                      <Group justify="center" py="md">
                        <Loader size="sm" color="red" />
                      </Group>
                    ) : projectPayments.length === 0 ? (
                      <Alert color="gray" variant="light">
                        No project payments have been recorded.
                      </Alert>
                    ) : (
                      <Stack gap="sm">
                        {projectPayments.map((payment) => (
                          <Card key={payment.id} withBorder radius="md" p="md">
                            <Group
                              justify="space-between"
                              align="flex-start"
                              wrap="nowrap"
                            >
                              <Box style={{ minWidth: 0 }}>
                                <Text fw={900}>{payment.payment_type}</Text>
                                <Text size="sm" c="dimmed">
                                  Paid {formatDate(payment.payment_date)} ·{" "}
                                  {payment.payment_method}
                                </Text>
                                {(payment.reference_number ||
                                  payment.recorded_by) && (
                                  <Text size="xs" c="dimmed" mt={4}>
                                    {payment.reference_number
                                      ? `Reference: ${payment.reference_number}`
                                      : ""}
                                    {payment.reference_number &&
                                    payment.recorded_by
                                      ? " · "
                                      : ""}
                                    {payment.recorded_by
                                      ? `Recorded by ${payment.recorded_by}`
                                      : ""}
                                  </Text>
                                )}
                                {payment.notes && (
                                  <Text size="sm" mt={6}>
                                    {payment.notes}
                                  </Text>
                                )}
                              </Box>
                              <Text
                                fw={950}
                                size="lg"
                                c="green"
                                ta="right"
                                style={{ flexShrink: 0 }}
                              >
                                {money(payment.amount)}
                              </Text>
                            </Group>
                          </Card>
                        ))}
                      </Stack>
                    )}
                  </Stack>
                </MWInfoCard>

                <MWInfoCard
                  title="Production Status"
                  subtitle="Update fabrication, finishing, installation, and inspection."
                  icon={IconSettingsAutomation}
                  color="orange"
                >
                  <Stack gap="md">
                    {project.design_required && (
                      <Select
                        label="Design Status"
                        data={[
                          "Not Required",
                          "Not Started",
                          "Ready",
                          "In Progress",
                          "Waiting Customer Approval",
                          "Adjustments Needed",
                          "Completed",
                        ]}
                        value={project.design_status || "Not Started"}
                        onChange={(value) => {
                          if (!value) {
                            return;
                          }

                          updateProject({
                            design_status: value,
                          });
                        }}
                      />
                    )}

                    {project.fabrication_required && (
                      <Select
                        label="Welding / Fabrication Status"
                        data={[
                          "Not Required",
                          "Not Started",
                          "Ready",
                          "In Progress",
                          "On Hold",
                          "Completed",
                        ]}
                        value={project.fabrication_status || "Not Started"}
                        onChange={(value) => {
                          if (!value) {
                            return;
                          }

                          updateProject({
                            fabrication_status: value,
                          });
                        }}
                      />
                    )}

                    {project.test_fit_required && (
                      <Select
                        label="Test Fit Status"
                        data={[
                          "Not Required",
                          "Not Started",
                          "Scheduled",
                          "In Progress",
                          "Adjustments Needed",
                          "Completed",
                        ]}
                        value={project.test_fit_status || "Not Started"}
                        onChange={(value) => {
                          if (!value) {
                            return;
                          }

                          updateProject({
                            test_fit_status: value,
                          });
                        }}
                      />
                    )}

                    {project.finish_required && (
                      <Select
                        label="Finish Status"
                        data={[
                          "Not Required",
                          "Not Started",
                          "Ready",
                          "At Powder Coat",
                          "In Progress",
                          "Completed",
                        ]}
                        value={project.finish_status || "Not Started"}
                        onChange={(value) => {
                          if (!value) {
                            return;
                          }

                          updateProject({
                            finish_status: value,
                          });
                        }}
                      />
                    )}

                    {project.assembly_required && (
                      <Select
                        label="Assembly Status"
                        data={[
                          "Not Required",
                          "Not Started",
                          "Ready",
                          "In Progress",
                          "On Hold",
                          "Completed",
                        ]}
                        value={project.assembly_status || "Not Started"}
                        onChange={(value) => {
                          if (!value) {
                            return;
                          }

                          updateProject({
                            assembly_status: value,
                          });
                        }}
                      />
                    )}

                    {project.install_required && (
                      <Select
                        label="Install Status"
                        data={[
                          "Not Required",
                          "Not Started",
                          "Ready to Schedule",
                          "Scheduled",
                          "In Progress",
                          "Completed",
                        ]}
                        value={project.install_status || "Not Started"}
                        onChange={(value) => {
                          if (!value) {
                            return;
                          }

                          updateProject({
                            install_status: value,
                          });
                        }}
                      />
                    )}

                    <Select
                      label="Final Inspection"
                      data={[
                        "Not Required",
                        "Pending",
                        "Passed",
                        "Failed",
                        "Needs Rework",
                      ]}
                      value={project.final_inspection_status || "Not Required"}
                      onChange={(value) => {
                        if (!value) {
                          return;
                        }

                        updateProject({
                          final_inspection_status: value,
                        });
                      }}
                    />
                  </Stack>
                </MWInfoCard>
              </SimpleGrid>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="procurement">
            <MWSection>
              <MWSectionHeader
                title="Materials & Procurement"
                subtitle="Pricing, approval, ordering, and receiving for this project."
                icon={IconShoppingCart}
                color="orange"
                count={procurementSummary.total}
                countLabel="Items"
                secondaryActionLabel="Refresh"
                secondaryActionIcon={IconRefresh}
                onSecondaryAction={loadMaterialRequests}
                actionLabel="Open Procurement"
                actionIcon={IconShoppingCart}
                onAction={() => setPage("procurement")}
              />

              <SimpleGrid
                cols={{
                  base: 1,
                  sm: 2,
                  lg: 3,
                }}
                spacing="md"
                mt="lg"
              >
                <MWMetricCard
                  label="Total Requests"
                  value={procurementSummary.total}
                  icon={IconPackage}
                  color="gray"
                  horizontal
                  compact
                />

                <MWMetricCard
                  label="Need Pricing"
                  value={procurementSummary.pricing}
                  icon={IconFileDollar}
                  color="red"
                  horizontal
                  compact
                />

                <MWMetricCard
                  label="Awaiting Approval"
                  value={procurementSummary.approval}
                  icon={IconClock}
                  color="orange"
                  horizontal
                  compact
                />

                <MWMetricCard
                  label="Ready to Order"
                  value={procurementSummary.ready}
                  icon={IconShoppingCart}
                  color="violet"
                  horizontal
                  compact
                />

                <MWMetricCard
                  label="Ordered"
                  value={procurementSummary.ordered}
                  icon={IconPackage}
                  color="blue"
                  horizontal
                  compact
                />

                <MWMetricCard
                  label="Received"
                  value={procurementSummary.received}
                  icon={IconCheck}
                  color="green"
                  horizontal
                  compact
                />
              </SimpleGrid>

              <Group gap="sm" wrap="wrap" mt="lg" mb="lg">
                <MWStatPill
                  label="Internal Cost"
                  value={money(procurementSummary.internalCost)}
                  icon={IconShoppingCart}
                  color="red"
                  variant="light"
                />

                <MWStatPill
                  label="Customer Price"
                  value={money(procurementSummary.customerPrice)}
                  icon={IconFileDollar}
                  color="violet"
                  variant="light"
                />

                <MWStatPill
                  label="Material Profit"
                  value={money(materialProfit)}
                  icon={IconCash}
                  color="green"
                  variant="light"
                />

                <MWStatPill
                  label="Margin"
                  value={`${materialMargin.toFixed(1)}%`}
                  icon={IconProgressCheck}
                  color={materialMargin >= 25 ? "green" : "orange"}
                  variant="light"
                />
              </Group>

              {materialsLoading ? (
                <Card withBorder radius="lg" p="xl">
                  <Group justify="center">
                    <Loader color="red" />
                    <Text>Loading material requests...</Text>
                  </Group>
                </Card>
              ) : materialRequests.length === 0 ? (
                <Card withBorder radius="lg" p="xl">
                  <Stack align="center" gap="sm">
                    <ThemeIcon
                      color="gray"
                      variant="light"
                      radius="xl"
                      size={54}
                    >
                      <IconPackage size={28} />
                    </ThemeIcon>

                    <Title order={4}>No Material Requests</Title>

                    <Text c="dimmed" ta="center">
                      Add project-specific materials from the Edit Project page.
                    </Text>

                    <Button
                      variant="light"
                      color="red"
                      leftSection={<IconPencil size={17} />}
                      onClick={() => setPage("editProject")}
                    >
                      Add Material
                    </Button>
                  </Stack>
                </Card>
              ) : (
                <ScrollArea>
                  <Table
                    striped
                    highlightOnHover
                    withTableBorder
                    miw={1150}
                    verticalSpacing="md"
                    horizontalSpacing="md"
                  >
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Qty</Table.Th>
                        <Table.Th>Material</Table.Th>
                        <Table.Th>Vendor</Table.Th>
                        <Table.Th>Needed</Table.Th>
                        <Table.Th>Priority</Table.Th>
                        <Table.Th>Status</Table.Th>
                        <Table.Th>Internal Cost</Table.Th>
                        <Table.Th>Customer Price</Table.Th>
                        <Table.Th>Received</Table.Th>
                      </Table.Tr>
                    </Table.Thead>

                    <Table.Tbody>
                      {materialRequests.map((request) => {
                        const status = getRequestStatus(request);

                        const priority = request.priority || "Normal";

                        return (
                          <Table.Tr key={request.id}>
                            <Table.Td>
                              <Text fw={800}>
                                {request.quantity ?? request.qty ?? 1}
                              </Text>
                            </Table.Td>

                            <Table.Td>
                              <Text fw={750} size="sm">
                                {request.item_name ||
                                  request.item ||
                                  "Unnamed Item"}
                              </Text>

                              <Text size="xs" c="dimmed" mt={2}>
                                {request.dimensions || "No dimensions"}
                              </Text>

                              {request.description && (
                                <Text size="xs" c="dimmed" mt={3}>
                                  {request.description}
                                </Text>
                              )}
                            </Table.Td>

                            <Table.Td>
                              {request.vendor_name ||
                                request.vendor ||
                                "Not selected"}
                            </Table.Td>

                            <Table.Td>{formatDate(request.needed_by)}</Table.Td>

                            <Table.Td>
                              <MWStatusBadge
                                status={priority}
                                color={priorityColor(priority)}
                                size="sm"
                              />
                            </Table.Td>

                            <Table.Td>
                              <MWStatusBadge
                                status={status}
                                color={statusColor(status)}
                                size="sm"
                              />
                            </Table.Td>

                            <Table.Td>{money(request.quoted_total)}</Table.Td>

                            <Table.Td>
                              {money(request.customer_material_price)}
                            </Table.Td>

                            <Table.Td>
                              <MWStatPill
                                label="Received"
                                value={`${request.quantity_received || 0} / ${
                                  request.quantity || request.qty || 1
                                }`}
                                icon={IconPackage}
                                color={
                                  Number(request.quantity_received || 0) >=
                                  Number(request.quantity || request.qty || 1)
                                    ? "green"
                                    : "orange"
                                }
                                size="sm"
                              />
                            </Table.Td>
                          </Table.Tr>
                        );
                      })}
                    </Table.Tbody>
                  </Table>
                </ScrollArea>
              )}
            </MWSection>
          </Tabs.Panel>

          <Tabs.Panel value="production">
            <SimpleGrid
              cols={{
                base: 1,
                xl: 3,
              }}
              spacing="lg"
            >
              <Box
                style={{
                  gridColumn: "span 2",
                }}
              >
                <MWProgressCard
                  title="Production Readiness"
                  subtitle="Approval, payment, and material requirements required before release."
                  value={productionReadinessPercent}
                  color={productionReady ? "green" : "orange"}
                  icon={IconSettingsAutomation}
                  status={
                    productionReady
                      ? "Ready for Production"
                      : "Requirements Incomplete"
                  }
                  statusColor={productionReady ? "green" : "orange"}
                  description={
                    productionReady
                      ? "All current project requirements have been satisfied."
                      : "Complete the outstanding requirements before releasing this project to production."
                  }
                  milestones={productionRequirements}
                  footer={
                    <Group
                      justify="space-between"
                      align="center"
                      gap="lg"
                      wrap="wrap"
                    >
                      <Box>
                        <Text fw={800} c="gray.1">
                          Release to Production
                        </Text>

                        <Text size="xs" c="gray.5" mt={3}>
                          Creates the production traveler and places the project
                          in its first required station.
                        </Text>
                      </Box>

                      <Button
                        color={productionReady ? "green" : "gray"}
                        leftSection={<IconSettingsAutomation size={17} />}
                        disabled={!productionReady}
                        loading={releasingProduction}
                        onClick={releaseProjectProduction}
                      >
                        Release to Production
                      </Button>
                    </Group>
                  }
                />
              </Box>

              <MWInfoCard
                title="Production Status"
                subtitle="Current execution status across the fabrication workflow."
                icon={IconSettingsAutomation}
                color="red"
                items={[
                  {
                    label: "Design",
                    value: project.design_status || "Not Required",
                    icon: IconPencil,
                  },
                  {
                    label: "Welding / Fabrication",
                    value: project.fabrication_status || "Not Started",
                    icon: IconSettingsAutomation,
                  },
                  {
                    label: "Test Fit",
                    value: project.test_fit_status || "Not Required",
                    icon: IconClipboardCheck,
                  },
                  {
                    label: "Finish",
                    value: project.finish_status || "Not Required",
                    icon: IconProgressCheck,
                  },
                  {
                    label: "Assembly",
                    value: project.assembly_status || "Not Required",
                    icon: IconPackage,
                  },
                  {
                    label: "Installation",
                    value: project.install_status || "Not Required",
                    icon: IconMapPin,
                  },
                  {
                    label: "Final Inspection",
                    value: project.final_inspection_status || "Not Required",
                    icon: IconCheck,
                  },
                ]}
                footer={
                  <Button
                    fullWidth
                    variant="light"
                    color="red"
                    onClick={() => setActiveTab("workflow")}
                  >
                    Update Workflow Status
                  </Button>
                }
              />
            </SimpleGrid>
          </Tabs.Panel>

          <Tabs.Panel value="schedule">
            <SimpleGrid
              cols={{
                base: 1,
                xl: 2,
              }}
              spacing="lg"
            >
              <MWInfoCard
                title="Edit Project Schedule"
                subtitle="Schedule required field events and target completion."
                icon={IconCalendar}
                color="blue"
              >
                <Stack gap="md">
                  {project.site_visit_required && (
                    <>
                      <DateTimePicker
                        label="Site Visit Start"
                        value={
                          project.site_visit_start
                            ? new Date(project.site_visit_start)
                            : null
                        }
                        onChange={(value) =>
                          updateLocal("site_visit_start", value)
                        }
                      />

                      <DateTimePicker
                        label="Site Visit End"
                        value={
                          project.site_visit_end
                            ? new Date(project.site_visit_end)
                            : null
                        }
                        onChange={(value) =>
                          updateLocal("site_visit_end", value)
                        }
                      />
                    </>
                  )}

                  {project.test_fit_required && (
                    <>
                      <DateTimePicker
                        label="Test Fit Start"
                        value={
                          project.test_fit_start
                            ? new Date(project.test_fit_start)
                            : null
                        }
                        onChange={(value) =>
                          updateLocal("test_fit_start", value)
                        }
                      />

                      <DateTimePicker
                        label="Test Fit End"
                        value={
                          project.test_fit_end
                            ? new Date(project.test_fit_end)
                            : null
                        }
                        onChange={(value) => updateLocal("test_fit_end", value)}
                      />
                    </>
                  )}

                  {project.install_required && (
                    <>
                      <DateTimePicker
                        label="Install Start"
                        value={
                          project.install_start
                            ? new Date(project.install_start)
                            : null
                        }
                        onChange={(value) =>
                          updateLocal("install_start", value)
                        }
                      />

                      <DateTimePicker
                        label="Install End"
                        value={
                          project.install_end
                            ? new Date(project.install_end)
                            : null
                        }
                        onChange={(value) => updateLocal("install_end", value)}
                      />
                    </>
                  )}

                  <DateInput
                    label="Target Completion Date"
                    value={
                      project.target_completion_date
                        ? new Date(project.target_completion_date)
                        : null
                    }
                    onChange={(value) =>
                      updateLocal("target_completion_date", value)
                    }
                  />

                  <Textarea
                    label="Scheduling Notes"
                    minRows={5}
                    value={project.scheduled_notes || ""}
                    onChange={(event) =>
                      updateLocal("scheduled_notes", event.currentTarget.value)
                    }
                  />

                  <Button
                    color="red"
                    loading={saving}
                    leftSection={<IconCheck size={17} />}
                    onClick={() =>
                      updateProject({
                        site_visit_start: project.site_visit_start || null,
                        site_visit_end: project.site_visit_end || null,
                        test_fit_start: project.test_fit_start || null,
                        test_fit_end: project.test_fit_end || null,
                        install_start: project.install_start || null,
                        install_end: project.install_end || null,
                        target_completion_date:
                          project.target_completion_date || null,
                        scheduled_notes: project.scheduled_notes || null,
                      })
                    }
                  >
                    Save Schedule
                  </Button>
                </Stack>
              </MWInfoCard>

              <MWInfoCard
                title="Schedule Summary"
                subtitle="Current scheduled field and completion events."
                icon={IconCalendarEvent}
                color="red"
                columns={2}
                items={[
                  {
                    label: "Site Visit",
                    value: formatDateTime(project.site_visit_start),
                    icon: IconMapPin,
                  },
                  {
                    label: "Test Fit",
                    value: formatDateTime(project.test_fit_start),
                    icon: IconClipboardCheck,
                  },
                  {
                    label: "Installation",
                    value: formatDateTime(project.install_start),
                    icon: IconSettingsAutomation,
                  },
                  {
                    label: "Target Completion",
                    value: formatDate(project.target_completion_date),
                    icon: IconFlag,
                  },
                ]}
                footer={
                  <Stack gap="md">
                    {project.scheduled_notes && (
                      <Box>
                        <Text
                          size="xs"
                          c="gray.5"
                          fw={800}
                          tt="uppercase"
                          style={{
                            letterSpacing: "0.07em",
                          }}
                        >
                          Schedule Notes
                        </Text>

                        <Text
                          size="sm"
                          c="gray.2"
                          mt="sm"
                          style={{
                            whiteSpace: "pre-wrap",
                            lineHeight: 1.5,
                          }}
                        >
                          {project.scheduled_notes}
                        </Text>
                      </Box>
                    )}

                    <Button
                      variant="light"
                      color="red"
                      leftSection={<IconCalendar size={17} />}
                      onClick={() => setPage("fieldSchedule")}
                    >
                      Open Field Schedule
                    </Button>
                  </Stack>
                }
              />
            </SimpleGrid>
          </Tabs.Panel>

          <Tabs.Panel value="activity">
            <MWSection>
              <MWSectionHeader
                title="Project Activity"
                subtitle="Latest project and procurement events."
                icon={IconActivity}
                color="blue"
                count={activityFeed.length}
                countLabel="Events"
              />

              {activityFeed.length === 0 ? (
                <Card withBorder radius="lg" p="xl" mt="lg">
                  <Stack align="center" gap="sm">
                    <ThemeIcon
                      color="gray"
                      variant="light"
                      radius="xl"
                      size={52}
                    >
                      <IconActivity size={26} />
                    </ThemeIcon>

                    <Text ta="center" c="dimmed">
                      No activity has been recorded yet.
                    </Text>
                  </Stack>
                </Card>
              ) : (
                <Stack gap={0} mt="md">
                  {activityFeed.map((activity, index) => (
                    <Box key={activity.id} py="md">
                      <Group align="flex-start" wrap="nowrap" gap="md">
                        <ThemeIcon
                          color={activity.color}
                          variant="light"
                          radius="xl"
                          size={38}
                          mt={2}
                          style={{
                            flexShrink: 0,
                            border: "1px solid rgba(255,255,255,0.08)",
                          }}
                        >
                          <IconActivity size={18} />
                        </ThemeIcon>

                        <Box
                          style={{
                            flex: 1,
                            minWidth: 0,
                          }}
                        >
                          <Group
                            justify="space-between"
                            align="flex-start"
                            wrap="wrap"
                            gap="md"
                          >
                            <Box
                              style={{
                                minWidth: 0,
                              }}
                            >
                              <Text fw={800} c="gray.1">
                                {activity.title}
                              </Text>

                              <Text size="sm" c="gray.5" mt={3}>
                                {activity.detail}
                              </Text>
                            </Box>

                            <MWStatPill
                              label="Date"
                              value={formatDateTime(activity.date)}
                              icon={IconClock}
                              color="gray"
                              size="sm"
                            />
                          </Group>
                        </Box>
                      </Group>

                      {index < activityFeed.length - 1 && (
                        <Divider mt="md" color="rgba(255,255,255,0.07)" />
                      )}
                    </Box>
                  ))}
                </Stack>
              )}
            </MWSection>
          </Tabs.Panel>

          <Tabs.Panel value="notes">
            <MWInfoCard
              title="Project Notes"
              subtitle="Customer requests, measurements, material details, fabrication notes, and installation information."
              icon={IconNotes}
              color="red"
              highlight
            >
              <Stack gap="lg">
                <Textarea
                  minRows={18}
                  value={project.notes || ""}
                  onChange={(event) =>
                    updateLocal("notes", event.currentTarget.value)
                  }
                  placeholder="Customer requests, measurements, material information, fabrication notes, installation details, and other project information..."
                />

                <Group justify="flex-end">
                  <Button
                    variant="light"
                    color="gray"
                    onClick={() => setPage("projects")}
                  >
                    Back to Projects
                  </Button>

                  <Button
                    color="red"
                    loading={saving}
                    leftSection={<IconCheck size={17} />}
                    onClick={() =>
                      updateProject({
                        notes: project.notes,
                      })
                    }
                  >
                    Save Notes
                  </Button>
                </Group>
              </Stack>
            </MWInfoCard>
          </Tabs.Panel>
        </Tabs>
      </Stack>

      <Modal
        opened={paymentModalOpen}
        onClose={closePaymentModal}
        title="Record Project Payment"
        centered
        size="lg"
      >
        <Stack gap="md">
          {paymentError && (
            <Alert color="red" icon={<IconActivity size={18} />}>
              {paymentError}
            </Alert>
          )}

          <Alert color="blue" icon={<IconCreditCard size={18} />}>
            Remaining balance:{" "}
            <Text component="span" fw={900}>
              {money(project.balance_due)}
            </Text>
          </Alert>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <Select
              label="Payment Type"
              required
              allowDeselect={false}
              value={paymentType}
              onChange={(value) => setPaymentType(value || "Final Payment")}
              data={[
                "Design Fee",
                "Down Payment",
                "Deposit",
                "Partial Payment",
                "Final Payment",
                "Imported Payment",
              ]}
            />
            <NumberInput
              label="Amount"
              required
              min={0.01}
              max={Math.max(Number(project.balance_due || 0), 0)}
              decimalScale={2}
              fixedDecimalScale
              prefix="$"
              value={paymentAmount}
              onChange={setPaymentAmount}
            />
            <Select
              label="Payment Method"
              required
              allowDeselect={false}
              value={paymentMethod}
              onChange={(value) => setPaymentMethod(value || "Other")}
              data={["Cash", "Card", "Check", "ACH", "Bank Transfer", "Other"]}
            />
            <TextInput
              type="date"
              label="Payment Date"
              required
              value={paymentDate}
              onChange={(event) => setPaymentDate(event.currentTarget.value)}
            />
          </SimpleGrid>

          <TextInput
            label="Reference / Check Number"
            placeholder="Optional receipt, transaction, or check number"
            value={paymentReference}
            onChange={(event) => setPaymentReference(event.currentTarget.value)}
          />

          <Textarea
            label="Notes"
            placeholder="Optional payment notes"
            minRows={4}
            value={paymentNotes}
            onChange={(event) => setPaymentNotes(event.currentTarget.value)}
          />

          <Group justify="flex-end">
            <Button
              variant="light"
              color="gray"
              disabled={recordingPayment}
              onClick={closePaymentModal}
            >
              Cancel
            </Button>
            <Button
              color="green"
              loading={recordingPayment}
              leftSection={<IconCreditCard size={17} />}
              onClick={recordProjectPayment}
            >
              Record Payment
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

export default ProjectDetails;
