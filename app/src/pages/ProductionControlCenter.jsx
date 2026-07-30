import {
  Alert,
  Badge,
  Box,
  Button,
  Group,
  Loader,
  Modal,
  Paper,
  Progress,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
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
  IconMapPin,
  IconPlayerPlay,
  IconRefresh,
  IconSearch,
  IconTool,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import MWKpiStrip from "../components/ui/MWKpiStrip";
import MWPageHeader from "../components/ui/MWPageHeader";
import MWPanel from "../components/ui/MWPanel";
import { supabase } from "../lib/supabase";
import {
  completeProductionStep,
  releaseProject,
  startProductionStep,
} from "../lib/productionWorkflow";

const DEPARTMENT_ORDER = [
  "Design",
  "Laser",
  "Welding",
  "Prep",
  "Paint/Powder",
  "Assembly",
  "Final QC / Showroom",
];

const OUTSIDE_PROJECT_STATUSES = [
  "New",
  "In Progress",
  "In Production",
  "Ready for Production",
  "Ready for Test Fit",
  "Ready for Installation",
];

function departmentRank(department) {
  const index = DEPARTMENT_ORDER.indexOf(department);
  return index === -1 ? DEPARTMENT_ORDER.length : index;
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

function toIsoDateTime(value) {
  if (!value) return null;
  let date;

  if (value instanceof Date) {
    date = value;
  } else {
    const text = String(value).trim();
    const localMatch = text.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})[,\s]+(\d{1,2}):(\d{2})$/,
    );

    if (localMatch) {
      const [, day, month, year, hour, minute] = localMatch;
      date = new Date(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
      );
    } else {
      date = new Date(text);
    }
  }

  if (Number.isNaN(date.getTime())) {
    throw new Error("Choose a valid date and time.");
  }
  return date.toISOString();
}

function toLocalDateTimeInput(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function getCustomerName(customer) {
  if (!customer) return "No customer assigned";

  const personName =
    `${customer.first_name || ""} ${customer.last_name || ""}`.trim() ||
    customer.contact_name ||
    customer.name;

  return personName || customer.company_name || "Unnamed Customer";
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
        item.notes,
    )
    .filter(Boolean);

  return names.length ? [...new Set(names)].join(", ") : "Unspecified Product";
}

function getOrderDisplayName(customer, items) {
  return `${getCustomerName(customer)} — ${getProductNames(items)}`;
}

function getStatusColor(status) {
  if (status === "Ready") return "red";
  if (status === "In Progress") return "green";
  if (status === "Queued") return "gray";
  if (status === "On Hold") return "orange";
  if (status === "Completed") return "green";
  return "gray";
}

function getDepartmentColor(department) {
  if (department === "Design") return "orange";
  if (department === "Laser") return "red";
  if (department === "CNC") return "yellow";
  if (department === "Welding") return "orange";
  if (department === "Paint" || department === "Powder") return "red";
  if (department === "Assembly" || department === "Showroom") return "green";
  if (department === "QC") return "yellow";
  return "gray";
}

function getOutsideStage(project, workOrder) {
  if (workOrder) {
    return {
      key: "production",
      label: workOrder.step_name || workOrder.department,
      status: workOrder.status,
      workOrder,
    };
  }

  if (
    (project.design_required && project.design_status !== "Completed") ||
    (project.fabrication_required && project.fabrication_status !== "Completed")
  ) {
    return {
      key: "release",
      label: "Design and Welding / Fabrication",
      status: "Ready",
    };
  }

  if (
    project.test_fit_required &&
    project.fabrication_status === "Completed" &&
    project.test_fit_status !== "Completed"
  ) {
    return {
      key: "testFit",
      label: "Test Fit at Customer Site",
      status: project.test_fit_status || "Not Started",
    };
  }

  if (
    (project.finish_required && project.finish_status !== "Completed") ||
    (project.assembly_required && project.assembly_status !== "Completed")
  ) {
    return {
      key: "release",
      label: "Finish / Corrections and Assembly",
      status: "Ready",
    };
  }

  if (project.install_required && project.install_status !== "Completed") {
    return {
      key: "installation",
      label: "Installation at Customer Site",
      status: project.install_status || "Ready to Schedule",
    };
  }

  if (
    project.final_inspection_status &&
    !["Not Required", "Passed"].includes(project.final_inspection_status)
  ) {
    return {
      key: "inspection",
      label: "Final Inspection",
      status: project.final_inspection_status,
    };
  }

  if (
    project.balance_status &&
    !["Not Required", "Paid"].includes(project.balance_status)
  ) {
    return {
      key: "balance",
      label: "Final Balance",
      status: project.balance_status,
    };
  }

  return {
    key: "complete",
    label: "Project Workflow Complete",
    status: "Completed",
  };
}

function ProductionControlCenter({
  setPage,
  setSelectedProductionJob,
  activeUser = "",
}) {
  const [workOrders, setWorkOrders] = useState([]);
  const [jobs, setJobs] = useState({});
  const [customerOrders, setCustomerOrders] = useState({});
  const [customers, setCustomers] = useState({});
  const [projects, setProjects] = useState({});
  const [itemsByOrderId, setItemsByOrderId] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [boardMode, setBoardMode] = useState("shop");
  const [outsideProjects, setOutsideProjects] = useState([]);
  const [outsideJobs, setOutsideJobs] = useState([]);
  const [outsideWorkOrders, setOutsideWorkOrders] = useState([]);
  const [scheduleProject, setScheduleProject] = useState(null);
  const [scheduleType, setScheduleType] = useState("");
  const [scheduleStart, setScheduleStart] = useState(null);
  const [scheduleEnd, setScheduleEnd] = useState(null);
  const [scheduleNotes, setScheduleNotes] = useState("");
  const [scheduleError, setScheduleError] = useState("");

  const loadBoard = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    else setRefreshing(true);

    try {
      const { data: workOrderData, error: workOrderError } = await supabase
        .from("work_orders")
        .select("*")
        .eq("is_active", true)
        .neq("status", "Completed")
        .order("step_order", { ascending: true })
        .order("id", { ascending: true });

      if (workOrderError) throw workOrderError;

      const activeWorkOrders = workOrderData || [];
      const jobIds = [
        ...new Set(
          activeWorkOrders
            .map((workOrder) => workOrder.production_job_id)
            .filter(Boolean),
        ),
      ];

      let jobData = [];
      if (jobIds.length) {
        const { data, error } = await supabase
          .from("production_jobs")
          .select("*")
          .in("id", jobIds)
          .eq("is_active", true);
        if (error) throw error;
        jobData = data || [];
      }

      const activeJobIds = new Set(jobData.map((job) => job.id));
      const validWorkOrders = activeWorkOrders.filter((workOrder) =>
        activeJobIds.has(workOrder.production_job_id),
      );
      const orderIds = [
        ...new Set(jobData.map((job) => job.customer_order_id).filter(Boolean)),
      ];
      const projectIds = [
        ...new Set(jobData.map((job) => job.project_id).filter(Boolean)),
      ];

      const [orderResult, customerResult, itemResult, projectResult] =
        await Promise.all([
          orderIds.length
            ? supabase.from("customer_orders").select("*").in("id", orderIds)
            : Promise.resolve({ data: [], error: null }),
          supabase.from("customers").select("*"),
          orderIds.length
            ? supabase
                .from("customer_order_items")
                .select("*")
                .in("order_id", orderIds)
            : Promise.resolve({ data: [], error: null }),
          projectIds.length
            ? supabase.from("projects").select("*").in("id", projectIds)
            : Promise.resolve({ data: [], error: null }),
        ]);

      if (orderResult.error) throw orderResult.error;
      if (customerResult.error) throw customerResult.error;
      if (itemResult.error) throw itemResult.error;
      if (projectResult.error) throw projectResult.error;

      const { data: outsideProjectData, error: outsideProjectError } =
        await supabase
          .from("projects")
          .select("*")
          .in("status", OUTSIDE_PROJECT_STATUSES)
          .order("created_at", { ascending: false });

      if (outsideProjectError) throw outsideProjectError;

      const orderItems = itemResult.data || [];
      const templateIds = [
        ...new Set(
          orderItems.map((item) => item.product_template_id).filter(Boolean),
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

      const templatesById = Object.fromEntries(
        templates.map((template) => [template.id, template]),
      );
      const groupedItems = {};

      for (const item of orderItems) {
        if (!groupedItems[item.order_id]) groupedItems[item.order_id] = [];
        groupedItems[item.order_id].push({
          ...item,
          product_template: templatesById[item.product_template_id] || null,
        });
      }

      setWorkOrders(validWorkOrders);
      setJobs(Object.fromEntries(jobData.map((job) => [job.id, job])));
      setCustomerOrders(
        Object.fromEntries(
          (orderResult.data || []).map((order) => [order.id, order]),
        ),
      );
      setCustomers(
        Object.fromEntries(
          (customerResult.data || []).map((customer) => [
            customer.id,
            customer,
          ]),
        ),
      );
      const allProjectData = [
        ...(outsideProjectData || []),
        ...(projectResult.data || []),
      ];
      const uniqueProjects = Object.values(
        Object.fromEntries(
          allProjectData.map((project) => [project.id, project]),
        ),
      );

      setProjects(
        Object.fromEntries(
          uniqueProjects.map((project) => [project.id, project]),
        ),
      );
      setOutsideProjects(outsideProjectData || []);
      setOutsideJobs(jobData.filter((job) => job.project_id));
      setOutsideWorkOrders(
        validWorkOrders.filter((workOrder) => workOrder.project_id),
      );
      setItemsByOrderId(groupedItems);
    } catch (error) {
      notifications.show({
        title: "Production Control Failed to Load",
        message: error.message,
        color: "red",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadBoard(true);

    const channel = supabase
      .channel("production-control-center")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "work_orders" },
        () => loadBoard(false),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "production_jobs" },
        () => loadBoard(false),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "projects" },
        () => loadBoard(false),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadBoard]);

  const departments = useMemo(() => {
    return [
      ...new Set(
        workOrders
          .filter((workOrder) => !jobs[workOrder.production_job_id]?.project_id)
          .map((workOrder) => workOrder.department)
          .filter(Boolean),
      ),
    ].sort(
      (a, b) => departmentRank(a) - departmentRank(b) || a.localeCompare(b),
    );
  }, [jobs, workOrders]);

  const departmentOptions = useMemo(
    () => [
      { value: "all", label: "All Active Departments" },
      ...departments.map((department) => ({
        value: department,
        label: department,
      })),
    ],
    [departments],
  );

  const filteredWorkOrders = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    return workOrders.filter((workOrder) => {
      const job = jobs[workOrder.production_job_id];
      if (job?.project_id) return false;

      if (
        departmentFilter !== "all" &&
        workOrder.department !== departmentFilter
      ) {
        return false;
      }

      if (!searchValue) return true;

      const customerOrder = customerOrders[job?.customer_order_id];
      const customer =
        customers[job?.customer_id || customerOrder?.customer_id];
      const items = itemsByOrderId[job?.customer_order_id] || [];
      const project = projects[job?.project_id];

      return [
        workOrder.work_order_number,
        workOrder.step_name,
        workOrder.department,
        workOrder.status,
        job?.production_job_number,
        customerOrder?.order_number,
        getCustomerName(customer),
        getCustomerCompany(customer),
        getProductNames(items),
        getOrderDisplayName(customer, items),
        project?.project_number,
        project?.project_name,
        project?.contact_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(searchValue);
    });
  }, [
    customerOrders,
    customers,
    departmentFilter,
    itemsByOrderId,
    jobs,
    projects,
    search,
    workOrders,
  ]);

  const visibleDepartments = departments.filter(
    (department) =>
      departmentFilter === "all" || department === departmentFilter,
  );
  const shopWorkOrders = workOrders.filter(
    (workOrder) => !jobs[workOrder.production_job_id]?.project_id,
  );
  const readyCount = shopWorkOrders.filter(
    (workOrder) => workOrder.status === "Ready",
  ).length;
  const inProgressCount = shopWorkOrders.filter(
    (workOrder) => workOrder.status === "In Progress",
  ).length;
  const holdCount = shopWorkOrders.filter(
    (workOrder) => workOrder.status === "On Hold",
  ).length;

  const outsideCards = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    return outsideProjects
      .map((project) => {
        const projectJobs = outsideJobs
          .filter((job) => job.project_id === project.id)
          .sort((a, b) => Number(b.id) - Number(a.id));
        const activeJob = projectJobs[0];
        const activeWorkOrder = outsideWorkOrders
          .filter(
            (workOrder) =>
              workOrder.production_job_id === activeJob?.id &&
              ["Ready", "In Progress", "On Hold", "Queued"].includes(
                workOrder.status,
              ),
          )
          .sort((a, b) => Number(a.step_order) - Number(b.step_order))[0];

        return {
          project,
          job: activeJob,
          stage: getOutsideStage(project, activeWorkOrder),
        };
      })
      .filter(({ project, stage }) => {
        if (!searchValue) return true;
        return [
          project.project_number,
          project.project_name,
          project.contact_name,
          project.assigned_to,
          project.location,
          project.status,
          stage.label,
          stage.status,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(searchValue);
      });
  }, [outsideJobs, outsideProjects, outsideWorkOrders, search]);

  const boardKpis =
    boardMode === "outside"
      ? [
          {
            label: "Active Outside Projects",
            value: outsideCards.length,
            description: "Projects still moving",
            icon: IconMapPin,
            color: "red",
          },
          {
            label: "Ready",
            value: outsideCards.filter(({ stage }) =>
              ["Ready", "Ready to Schedule", "Not Started"].includes(
                stage.status,
              ),
            ).length,
            description: "Can move now",
            icon: IconPlayerPlay,
            color: "red",
          },
          {
            label: "In Progress",
            value: outsideCards.filter(
              ({ stage }) => stage.status === "In Progress",
            ).length,
            description: "Work currently underway",
            icon: IconClock,
            color: "green",
          },
          {
            label: "Site Events",
            value: outsideCards.filter(({ stage }) =>
              ["testFit", "installation"].includes(stage.key),
            ).length,
            description: "Test fits and installations",
            icon: IconMapPin,
            color: "orange",
          },
        ]
      : [
          {
            label: "Active Departments",
            value: departments.length,
            description: "Departments with current work",
            icon: IconTool,
            color: "red",
          },
          {
            label: "Ready",
            value: readyCount,
            description: "Can be started now",
            icon: IconPlayerPlay,
            color: "red",
          },
          {
            label: "In Progress",
            value: inProgressCount,
            description: "Work currently underway",
            icon: IconClock,
            color: "green",
          },
          {
            label: "On Hold",
            value: holdCount,
            description: "Needs management attention",
            icon: IconAlertTriangle,
            color: "orange",
          },
        ];

  function openSchedule(project, type) {
    const isTestFit = type === "testFit";
    const startValue = isTestFit
      ? project.test_fit_start
      : project.install_start;
    const endValue = isTestFit ? project.test_fit_end : project.install_end;

    setScheduleProject(project);
    setScheduleType(type);
    setScheduleStart(toLocalDateTimeInput(startValue));
    setScheduleEnd(toLocalDateTimeInput(endValue));
    setScheduleNotes(project.scheduled_notes || "");
    setScheduleError("");
  }

  function closeSchedule() {
    setScheduleProject(null);
    setScheduleType("");
    setScheduleStart(null);
    setScheduleEnd(null);
    setScheduleNotes("");
    setScheduleError("");
  }

  async function updateOutsideProject(project, updates, successMessage) {
    if (!project?.id || updatingId) return;

    try {
      setUpdatingId(`project-${project.id}`);
      const { error } = await supabase
        .from("projects")
        .update(updates)
        .eq("id", project.id);
      if (error) throw error;

      await loadBoard(false);
      notifications.show({
        title: "Outside Workflow Updated",
        message: successMessage,
        color: "green",
        icon: <IconCheck size={18} />,
      });
      return true;
    } catch (error) {
      notifications.show({
        title: "Outside Workflow Could Not Update",
        message: error.message,
        color: "red",
      });
      return false;
    } finally {
      setUpdatingId(null);
    }
  }

  async function saveSiteSchedule() {
    if (!scheduleProject || !scheduleType || !scheduleStart || updatingId) {
      return;
    }

    try {
      setScheduleError("");
      const isTestFit = scheduleType === "testFit";
      const label = isTestFit ? "Test fit" : "Installation";
      setUpdatingId(`project-${scheduleProject.id}`);

      const { error } = await supabase.rpc("mw_schedule_outside_stage", {
        p_project_id: Number(scheduleProject.id),
        p_stage: isTestFit ? "testfit" : "installation",
        p_start: toIsoDateTime(scheduleStart),
        p_end: toIsoDateTime(scheduleEnd),
        p_notes: scheduleNotes.trim() || null,
      });

      if (error) throw error;

      closeSchedule();
      await loadBoard(false);
      notifications.show({
        title: `${label} Scheduled`,
        message: `${label} was saved successfully.`,
        color: "green",
        icon: <IconCheck size={18} />,
      });
    } catch (error) {
      setScheduleError(error.message || "The schedule could not be saved.");
      notifications.show({
        title: "Schedule Could Not Be Saved",
        message: error.message || "Choose a valid start date and time.",
        color: "red",
      });
    } finally {
      setUpdatingId(null);
    }
  }

  async function releaseOutsideProject(project) {
    if (!project?.id || updatingId) return;

    try {
      setUpdatingId(`project-${project.id}`);
      const job = await releaseProject(
        project.id,
        activeUser || project.assigned_to || project.intake_owner,
      );
      await loadBoard(false);
      notifications.show({
        title: "Project Released",
        message: `${job.production_job_number} is ready in ${job.current_department}.`,
        color: "green",
        icon: <IconPlayerPlay size={18} />,
      });
    } catch (error) {
      notifications.show({
        title: "Project Could Not Be Released",
        message: error.message,
        color: "red",
      });
    } finally {
      setUpdatingId(null);
    }
  }

  async function startSiteStage(project, type) {
    const field = type === "testFit" ? "test_fit_status" : "install_status";
    const label = type === "testFit" ? "Test fit" : "Installation";
    await updateOutsideProject(
      project,
      {
        [field]: "In Progress",
        status: "In Progress",
        next_action: `Complete ${label.toLowerCase()}`,
      },
      `${label} is now in progress.`,
    );
  }

  async function completeSiteStage(project, type) {
    const isTestFit = type === "testFit";
    await updateOutsideProject(
      project,
      isTestFit
        ? {
            test_fit_status: "Completed",
            status: "Ready for Production",
            next_action: "Release finish / corrections and assembly",
          }
        : {
            install_status: "Completed",
            status: "In Progress",
            next_action:
              project.final_inspection_status &&
              project.final_inspection_status !== "Not Required"
                ? "Complete final inspection"
                : "Collect the remaining customer balance",
          },
      isTestFit
        ? "Test fit is complete. The project is ready to return to the shop."
        : "Installation is complete.",
    );
  }

  function getDepartmentOrders(department) {
    return filteredWorkOrders.filter(
      (workOrder) => workOrder.department === department,
    );
  }

  async function openProductionJob(workOrder) {
    const job = jobs[workOrder.production_job_id];
    if (!job) {
      notifications.show({
        title: "Production Job Not Found",
        message: "Refresh the board and try again.",
        color: "red",
      });
      return;
    }

    setSelectedProductionJob(job);
    setPage("productionJobDetails");
  }

  async function syncProductionJob(productionJobId) {
    const { data, error } = await supabase
      .from("work_orders")
      .select("*")
      .eq("production_job_id", productionJobId)
      .eq("is_active", true)
      .order("step_order", { ascending: true })
      .order("id", { ascending: true });

    if (error) throw error;

    const jobWorkOrders = data || [];
    const completedCount = jobWorkOrders.filter(
      (workOrder) => workOrder.status === "Completed",
    ).length;
    const progressPercent = jobWorkOrders.length
      ? Math.round((completedCount / jobWorkOrders.length) * 100)
      : 0;
    const currentWorkOrder =
      jobWorkOrders.find((workOrder) => workOrder.status === "In Progress") ||
      jobWorkOrders.find((workOrder) => workOrder.status === "Ready") ||
      jobWorkOrders.find((workOrder) => workOrder.status === "On Hold") ||
      jobWorkOrders.find((workOrder) => workOrder.status === "Queued");

    const updatePayload = currentWorkOrder
      ? {
          current_department: currentWorkOrder.department,
          status:
            currentWorkOrder.status === "On Hold" ? "On Hold" : "In Production",
          progress_percent: progressPercent,
        }
      : {
          current_department: "Completed",
          status: "Completed",
          progress_percent: 100,
          is_active: false,
        };

    const { error: updateError } = await supabase
      .from("production_jobs")
      .update(updatePayload)
      .eq("id", productionJobId);

    if (updateError) throw updateError;
  }

  async function startWorkOrder(workOrder) {
    if (workOrder.status !== "Ready" || updatingId) return;

    try {
      setUpdatingId(workOrder.id);
      await startProductionStep(workOrder.id, activeUser);
      await loadBoard(false);

      notifications.show({
        title: "Work Started",
        message: `${workOrder.work_order_number} is now in progress${
          activeUser ? ` with ${activeUser}` : ""
        }.`,
        color: "green",
        icon: <IconPlayerPlay size={18} />,
      });
    } catch (error) {
      notifications.show({
        title: "Work Order Could Not Start",
        message: error.message,
        color: "red",
      });
    } finally {
      setUpdatingId(null);
    }
  }

  async function completeWorkOrder(workOrder) {
    if (workOrder.status !== "In Progress" || updatingId) return;

    try {
      setUpdatingId(workOrder.id);

      const result = await completeProductionStep(workOrder.id, activeUser);
      await loadBoard(false);

      notifications.show({
        title: "Step Completed",
        message: result?.completed
          ? "The production route is complete."
          : `${result?.next_department || "The next station"} is now ready.`,
        color: "green",
        icon: <IconCheck size={18} />,
      });
    } catch (error) {
      notifications.show({
        title: "Work Order Could Not Complete",
        message: error.message,
        color: "red",
      });
    } finally {
      setUpdatingId(null);
    }
  }

  if (loading) {
    return (
      <Stack gap="xl">
        <MWPageHeader
          title="Production Control Center"
          subtitle="Loading live department queues."
          setPage={setPage}
        />
        <MWPanel>
          <Group justify="center" py={80}>
            <Loader color="red" />
            <Text c="dimmed">Loading production control...</Text>
          </Group>
        </MWPanel>
      </Stack>
    );
  }

  return (
    <Stack gap="xl">
      <MWPageHeader
        title="Production Control Center"
        subtitle="Start, complete, and hand off both in-shop orders and outside projects."
        setPage={setPage}
      />

      <SegmentedControl
        fullWidth
        size="md"
        color="red"
        value={boardMode}
        onChange={setBoardMode}
        data={[
          { value: "shop", label: "In-Shop Orders" },
          { value: "outside", label: "Outside Projects" },
        ]}
      />

      <MWKpiStrip
        compact
        columns={{ base: 1, sm: 2, xl: 4 }}
        items={boardKpis}
      />

      <MWPanel
        title="Board Controls"
        subtitle="Only departments with active work are displayed"
        icon={IconSearch}
      >
        <Group wrap="wrap">
          <TextInput
            style={{ flex: 1, minWidth: 280 }}
            placeholder="Search person, item, order, job, company, department, or status..."
            leftSection={<IconSearch size={17} />}
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
          />
          {boardMode === "shop" && (
            <Select
              w={230}
              value={departmentFilter}
              onChange={(value) => setDepartmentFilter(value || "all")}
              data={departmentOptions}
              allowDeselect={false}
            />
          )}
          <Button
            variant="light"
            color="gray"
            leftSection={
              refreshing ? <Loader size={16} /> : <IconRefresh size={17} />
            }
            disabled={refreshing}
            onClick={() => loadBoard(false)}
          >
            Refresh
          </Button>
        </Group>
      </MWPanel>

      {boardMode === "shop" ? (
        !visibleDepartments.length ? (
          <MWPanel>
            <Alert color="gray" icon={<IconTool size={19} />}>
              No active production work matches the current filters.
            </Alert>
          </MWPanel>
        ) : (
          <SimpleGrid
            cols={{ base: 1, xl: visibleDepartments.length === 1 ? 1 : 2 }}
            spacing="lg"
            style={{ alignItems: "start" }}
          >
            {visibleDepartments.map((department) => {
              const departmentOrders = getDepartmentOrders(department);
              if (!departmentOrders.length && search.trim()) return null;

              return (
                <MWPanel
                  key={department}
                  title={department}
                  subtitle={`${departmentOrders.length} active work order${
                    departmentOrders.length === 1 ? "" : "s"
                  }`}
                  icon={IconTool}
                >
                  <Stack gap="md">
                    {departmentOrders.map((workOrder) => {
                      const job = jobs[workOrder.production_job_id];
                      const customerOrder =
                        customerOrders[job?.customer_order_id];
                      const customer =
                        customers[
                          job?.customer_id || customerOrder?.customer_id
                        ];
                      const items =
                        itemsByOrderId[job?.customer_order_id] || [];
                      const project = projects[job?.project_id];
                      const priority = job?.is_quick_turnaround || job?.rush;
                      const progress = Number(job?.progress_percent || 0);
                      const companyName = getCustomerCompany(customer);
                      const orderReference =
                        customerOrder?.order_number ||
                        project?.project_number ||
                        job?.production_job_number ||
                        "Production order";

                      return (
                        <Paper
                          key={workOrder.id}
                          p="lg"
                          radius="lg"
                          style={{
                            background: priority
                              ? "linear-gradient(145deg, rgba(120,20,0,.2), rgba(255,255,255,.025))"
                              : "rgba(255,255,255,.025)",
                            border: `1px solid ${
                              priority
                                ? "rgba(255,90,50,.42)"
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
                              <Box style={{ minWidth: 0 }}>
                                <Group gap="xs" mb={7} wrap="wrap">
                                  <Badge
                                    color={getStatusColor(workOrder.status)}
                                    variant="light"
                                  >
                                    {workOrder.status}
                                  </Badge>
                                  <Badge color="gray" variant="light">
                                    Step {workOrder.step_order}
                                  </Badge>
                                  {priority && (
                                    <Badge
                                      color="red"
                                      leftSection={<IconFlame size={12} />}
                                    >
                                      {job?.is_quick_turnaround
                                        ? "Quick Turnaround"
                                        : "Rush"}
                                    </Badge>
                                  )}
                                </Group>

                                <Title
                                  order={3}
                                  c="white"
                                  style={{
                                    overflowWrap: "anywhere",
                                    lineHeight: 1.22,
                                  }}
                                >
                                  {project
                                    ? `${project.contact_name || getCustomerName(customer)} — ${project.project_name || "Outside Fabrication"}`
                                    : getOrderDisplayName(customer, items)}
                                </Title>
                                {companyName && (
                                  <Text fw={750} c="gray.3" mt={5}>
                                    {companyName}
                                  </Text>
                                )}
                                <Text size="sm" c="gray.4" mt={3}>
                                  {orderReference}
                                  {job?.production_job_number
                                    ? ` · ${job.production_job_number}`
                                    : ""}
                                  {workOrder.work_order_number
                                    ? ` · ${workOrder.work_order_number}`
                                    : ""}
                                </Text>
                              </Box>

                              <ThemeIcon
                                size={46}
                                radius="lg"
                                color={getDepartmentColor(department)}
                                variant="light"
                                style={{ flexShrink: 0 }}
                              >
                                <IconTool size={24} />
                              </ThemeIcon>
                            </Group>

                            <Paper
                              p="sm"
                              radius="md"
                              style={{
                                background: "rgba(0,0,0,.22)",
                                border: "1px solid rgba(255,255,255,.06)",
                              }}
                            >
                              <SimpleGrid
                                cols={{ base: 1, sm: 2 }}
                                spacing="sm"
                              >
                                <Box>
                                  <Text
                                    size="xs"
                                    c="dimmed"
                                    fw={800}
                                    tt="uppercase"
                                  >
                                    Current Step
                                  </Text>
                                  <Text fw={850}>
                                    {workOrder.step_name || department}
                                  </Text>
                                </Box>
                                <Box>
                                  <Text
                                    size="xs"
                                    c="dimmed"
                                    fw={800}
                                    tt="uppercase"
                                  >
                                    Quantity
                                  </Text>
                                  <Text fw={850}>
                                    {workOrder.quantity || 1}
                                  </Text>
                                </Box>
                                <Box>
                                  <Text
                                    size="xs"
                                    c="dimmed"
                                    fw={800}
                                    tt="uppercase"
                                  >
                                    Due
                                  </Text>
                                  <Text fw={850}>
                                    {formatDate(job?.due_date)}
                                  </Text>
                                </Box>
                                <Box>
                                  <Text
                                    size="xs"
                                    c="dimmed"
                                    fw={800}
                                    tt="uppercase"
                                  >
                                    Progress
                                  </Text>
                                  <Text fw={900}>{progress}%</Text>
                                </Box>
                              </SimpleGrid>
                              <Progress
                                value={progress}
                                color={progress >= 100 ? "green" : "red"}
                                size="sm"
                                radius="xl"
                                mt="sm"
                              />
                            </Paper>

                            <Group grow wrap="wrap">
                              <Button
                                variant="light"
                                color="gray"
                                onClick={() => openProductionJob(workOrder)}
                              >
                                Open Job
                              </Button>

                              {workOrder.status === "Ready" && (
                                <Button
                                  color="red"
                                  leftSection={<IconPlayerPlay size={17} />}
                                  loading={updatingId === workOrder.id}
                                  onClick={() => startWorkOrder(workOrder)}
                                >
                                  Start Work
                                </Button>
                              )}

                              {workOrder.status === "In Progress" && (
                                <Button
                                  color="green"
                                  leftSection={<IconCheck size={17} />}
                                  loading={updatingId === workOrder.id}
                                  onClick={() => completeWorkOrder(workOrder)}
                                >
                                  Complete Step
                                </Button>
                              )}

                              {workOrder.status === "Queued" && (
                                <Button variant="light" color="gray" disabled>
                                  Waiting
                                </Button>
                              )}

                              {workOrder.status === "On Hold" && (
                                <Button variant="light" color="orange" disabled>
                                  Management Hold
                                </Button>
                              )}
                            </Group>
                          </Stack>
                        </Paper>
                      );
                    })}
                  </Stack>
                </MWPanel>
              );
            })}
          </SimpleGrid>
        )
      ) : !outsideCards.length ? (
        <MWPanel>
          <Alert color="gray" icon={<IconMapPin size={19} />}>
            No active outside projects match the current search.
          </Alert>
        </MWPanel>
      ) : (
        <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="lg">
          {outsideCards.map(({ project, job, stage }) => {
            const busy =
              updatingId === `project-${project.id}` ||
              updatingId === stage.workOrder?.id;
            const isScheduled = stage.status === "Scheduled";
            const isInProgress = stage.status === "In Progress";

            return (
              <Paper
                key={project.id}
                p="lg"
                radius="lg"
                style={{
                  background:
                    "linear-gradient(145deg, rgba(120,20,0,.13), rgba(255,255,255,.025))",
                  border: "1px solid rgba(255,90,50,.28)",
                }}
              >
                <Stack gap="md">
                  <Group
                    justify="space-between"
                    align="flex-start"
                    wrap="nowrap"
                  >
                    <Box style={{ minWidth: 0 }}>
                      <Group gap="xs" mb={7} wrap="wrap">
                        <Badge
                          color={getStatusColor(stage.status)}
                          variant="light"
                        >
                          {stage.status}
                        </Badge>
                        <Badge color="gray" variant="light">
                          {project.project_number || `Project ${project.id}`}
                        </Badge>
                      </Group>
                      <Title order={3} c="white" style={{ lineHeight: 1.22 }}>
                        {project.contact_name || "Outside Project"} —{" "}
                        {project.project_name || "Outside Fabrication"}
                      </Title>
                      <Text size="sm" c="gray.4" mt={4}>
                        Assigned to {project.assigned_to || "Unassigned"}
                        {job?.production_job_number
                          ? ` · ${job.production_job_number}`
                          : ""}
                      </Text>
                    </Box>
                    <ThemeIcon
                      size={46}
                      radius="lg"
                      color="red"
                      variant="light"
                      style={{ flexShrink: 0 }}
                    >
                      <IconMapPin size={24} />
                    </ThemeIcon>
                  </Group>

                  <Paper
                    p="md"
                    radius="md"
                    style={{
                      background: "rgba(0,0,0,.24)",
                      border: "1px solid rgba(255,255,255,.07)",
                    }}
                  >
                    <Text size="xs" c="dimmed" fw={800} tt="uppercase">
                      Current Required Stage
                    </Text>
                    <Title order={4} c="white" mt={4}>
                      {stage.label}
                    </Title>
                    {stage.key === "testFit" && project.test_fit_start && (
                      <Text size="sm" c="gray.3" mt={6}>
                        Scheduled{" "}
                        {new Date(project.test_fit_start).toLocaleString()}
                      </Text>
                    )}
                    {stage.key === "installation" && project.install_start && (
                      <Text size="sm" c="gray.3" mt={6}>
                        Scheduled{" "}
                        {new Date(project.install_start).toLocaleString()}
                      </Text>
                    )}
                  </Paper>

                  <Group grow wrap="wrap">
                    {stage.workOrder?.status === "Ready" && (
                      <Button
                        color="red"
                        leftSection={<IconPlayerPlay size={17} />}
                        loading={busy}
                        onClick={() => startWorkOrder(stage.workOrder)}
                      >
                        Start {stage.label}
                      </Button>
                    )}

                    {stage.workOrder?.status === "In Progress" && (
                      <Button
                        color="green"
                        leftSection={<IconCheck size={17} />}
                        loading={busy}
                        onClick={() => completeWorkOrder(stage.workOrder)}
                      >
                        Complete {stage.label}
                      </Button>
                    )}

                    {stage.workOrder?.status === "Queued" && (
                      <Button variant="light" color="gray" disabled>
                        Waiting for Previous Stage
                      </Button>
                    )}

                    {stage.key === "release" && (
                      <Button
                        color="red"
                        leftSection={<IconPlayerPlay size={17} />}
                        loading={busy}
                        onClick={() => releaseOutsideProject(project)}
                      >
                        Release Next Shop Stages
                      </Button>
                    )}

                    {["testFit", "installation"].includes(stage.key) &&
                      !isScheduled &&
                      !isInProgress && (
                        <Button
                          color="red"
                          leftSection={<IconMapPin size={17} />}
                          onClick={() => openSchedule(project, stage.key)}
                        >
                          Schedule{" "}
                          {stage.key === "testFit"
                            ? "Test Fit"
                            : "Installation"}
                        </Button>
                      )}

                    {["testFit", "installation"].includes(stage.key) &&
                      isScheduled && (
                        <>
                          <Button
                            variant="light"
                            color="gray"
                            onClick={() => openSchedule(project, stage.key)}
                          >
                            Change Schedule
                          </Button>
                          <Button
                            color="red"
                            leftSection={<IconPlayerPlay size={17} />}
                            loading={busy}
                            onClick={() => startSiteStage(project, stage.key)}
                          >
                            Start{" "}
                            {stage.key === "testFit"
                              ? "Test Fit"
                              : "Installation"}
                          </Button>
                        </>
                      )}

                    {["testFit", "installation"].includes(stage.key) &&
                      isInProgress && (
                        <Button
                          color="green"
                          leftSection={<IconCheck size={17} />}
                          loading={busy}
                          onClick={() => completeSiteStage(project, stage.key)}
                        >
                          Complete{" "}
                          {stage.key === "testFit"
                            ? "Test Fit"
                            : "Installation"}
                        </Button>
                      )}

                    {stage.key === "inspection" && (
                      <Button
                        color="green"
                        leftSection={<IconCheck size={17} />}
                        loading={busy}
                        onClick={() =>
                          updateOutsideProject(
                            project,
                            {
                              final_inspection_status: "Passed",
                              next_action:
                                "Collect the remaining customer balance",
                            },
                            "Final inspection was marked passed.",
                          )
                        }
                      >
                        Pass Final Inspection
                      </Button>
                    )}

                    {stage.key === "balance" && (
                      <Button variant="light" color="orange" disabled>
                        Record Final Payment in Office
                      </Button>
                    )}

                    {stage.key === "complete" && (
                      <Button
                        color="green"
                        leftSection={<IconCheck size={17} />}
                        loading={busy}
                        onClick={() =>
                          updateOutsideProject(
                            project,
                            {
                              status: "Completed",
                              percent_complete: 100,
                              next_action: "Project workflow is complete",
                            },
                            "The outside project was completed.",
                          )
                        }
                      >
                        Complete Project
                      </Button>
                    )}
                  </Group>
                </Stack>
              </Paper>
            );
          })}
        </SimpleGrid>
      )}

      <Modal
        opened={Boolean(scheduleProject)}
        onClose={closeSchedule}
        title={`Schedule ${
          scheduleType === "testFit" ? "Customer-Site Test Fit" : "Installation"
        }`}
        centered
        size="lg"
      >
        <Stack gap="md">
          {scheduleError && (
            <Alert color="red" icon={<IconAlertTriangle size={18} />}>
              {scheduleError}
            </Alert>
          )}
          <TextInput
            type="datetime-local"
            label="Start Date and Time"
            value={scheduleStart}
            onChange={(event) => setScheduleStart(event.currentTarget.value)}
            required
          />
          <TextInput
            type="datetime-local"
            label="Expected End Date and Time"
            value={scheduleEnd}
            onChange={(event) => setScheduleEnd(event.currentTarget.value)}
          />
          <Textarea
            label="Schedule Notes"
            placeholder="Crew, access instructions, customer contact, or site notes"
            minRows={4}
            value={scheduleNotes}
            onChange={(event) => setScheduleNotes(event.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button variant="light" color="gray" onClick={closeSchedule}>
              Cancel
            </Button>
            <Button
              color="red"
              leftSection={<IconCheck size={17} />}
              loading={Boolean(updatingId)}
              disabled={!scheduleStart}
              onClick={saveSiteSchedule}
            >
              Save Schedule
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

export default ProductionControlCenter;
