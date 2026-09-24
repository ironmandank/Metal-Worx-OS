import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  FileButton,
  Group,
  Loader,
  Modal,
  Paper,
  Progress,
  SegmentedControl,
  SimpleGrid,
  ScrollArea,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconAlertTriangle,
  IconArrowRight,
  IconClipboardCheck,
  IconCircleCheck,
  IconCalendarEvent,
  IconChevronLeft,
  IconChevronRight,
  IconMapPin,
  IconMail,
  IconNotes,
  IconPackage,
  IconPhone,
  IconPrinter,
  IconRefresh,
  IconRotateClockwise,
  IconSearch,
  IconTool,
  IconTrash,
  IconTruckDelivery,
  IconUpload,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import MWKpiStrip from "../components/ui/MWKpiStrip";
import MWPageHeader from "../components/ui/MWPageHeader";
import MWPanel from "../components/ui/MWPanel";
import OutsideWorkspaceNav from "../components/OutsideWorkspaceNav";
import { supabase } from "../lib/supabase";
import { releaseProject } from "../lib/productionWorkflow";
import { addDays, buildMonthGrid, dateKey, firstOfMonth, moveMonth } from "../lib/calendar";
import { OUTSIDE_PHASES, getOutsideNextDate, getOutsidePhase, getSuggestedNextAction } from "../lib/outsideProjectWorkflow";
import companyLogo from "../assets/metal-worx-official-transparent.png";

const CALENDAR_TYPES = [
  { label: "Railings & Handrails", color: "#1677c8", terms: ["rail", "handrail"] },
  { label: "Gates & Fences", color: "#2f9e44", terms: ["gate", "fence"] },
  { label: "Repair & Restoration", color: "#e67700", terms: ["repair", "restore", "restoration"] },
  { label: "Custom Fabrication", color: "#7950f2", terms: ["fabrication", "custom", "prototype", "container", "trailer"] },
  { label: "Install & Field Work", color: "#0ca6a6", terms: ["install", "field", "site"] },
  { label: "Other Project", color: "#66717a", terms: [] },
];

function updateAgeLabel(update) {
  if (!update?.update_date) return { label: "No daily update", color: "red" };
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const date = new Date(`${String(update.update_date).slice(0, 10)}T12:00:00`);
  const days = Math.max(0, Math.round((today - date) / 86400000));
  if (days === 0) return { label: "Updated today", color: "green" };
  if (days === 1) return { label: "Updated yesterday", color: "blue" };
  return { label: `${days} days since update`, color: days >= 3 ? "red" : "orange" };
}

const OUTSIDE_WORKSPACES = [
  {
    key: "estimates",
    label: "Estimates & Site Visits",
    description: "Unscheduled and scheduled field estimates",
    phases: ["pre_quote"],
    color: "cyan",
  },
  {
    key: "approvals",
    label: "Quotes & Approvals",
    description: "Pricing, customer decisions, and deposits",
    phases: ["quote_approval"],
    color: "violet",
  },
  {
    key: "production",
    label: "Production & Materials",
    description: "Released work, materials, and fabrication",
    phases: ["ready", "production"],
    color: "orange",
  },
  {
    key: "field",
    label: "Field Work & Closeout",
    description: "Test fits, installs, closeout, and holds",
    phases: ["field", "closeout", "hold"],
    color: "teal",
  },
];

const capacityCalendarStyles = `
  .mw-capacity-shell { border: 1px solid rgba(255,255,255,.1); border-radius: 14px; overflow: hidden; background: #0b1014; }
  .mw-month-weekdays, .mw-month-grid { display:grid; grid-template-columns:repeat(7,minmax(130px,1fr)); min-width:910px; }
  .mw-month-weekday { padding:10px; text-align:center; color:#99a4ab; background:#11181d; border-right:1px solid #2b343a; font-size:11px; font-weight:900; letter-spacing:.08em; text-transform:uppercase; }
  .mw-month-day { min-height:132px; padding:8px; border-top:1px solid #2b343a; border-right:1px solid #252d33; background:#0e1418; cursor:pointer; }
  .mw-month-day:hover { background:#172127; }
  .mw-month-day.weekend { background:#151318; }
  .mw-month-day.outside { background:#090d10; opacity:.45; }
  .mw-month-day.today { box-shadow:inset 0 0 0 2px #f21b2d; background:#1d1014; }
  .mw-month-day-head { display:flex; align-items:center; justify-content:space-between; gap:6px; margin-bottom:7px; }
  .mw-month-day-number { color:#f4f6f7; font-size:15px; font-weight:900; }
  .mw-month-load { color:#78858d; font-size:9px; font-weight:800; text-transform:uppercase; }
  .mw-month-project { width:100%; margin-top:5px; padding:6px 7px; border:0; border-left:5px solid; border-radius:5px; color:#fff; background:#20282e; text-align:left; cursor:pointer; box-shadow:0 2px 7px rgba(0,0,0,.25); }
  .mw-month-project:hover { filter:brightness(1.18); }
  .mw-month-project strong, .mw-month-project span { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .mw-month-project strong { font-size:10px; }
  .mw-month-project span { margin-top:2px; color:#c1c8cd; font-size:9px; }
  .mw-month-project.rush { outline:1px solid #ff3445; }
  @media (max-width:700px) { .mw-month-weekdays, .mw-month-grid { grid-template-columns:repeat(7,120px); min-width:840px; } .mw-month-day { min-height:112px; } }
`;

function getStatusColor(status) {
  if (status === "Completed") return "green";
  if (["In Progress", "Needs Scheduling"].includes(status)) return "blue";
  if (["On Hold", "Awaiting Deposit"].includes(status)) return "orange";
  if (status === "Cancelled") return "red";
  return "gray";
}

function getPriorityColor(priority) {
  if (priority === "Rush") return "red";
  if (priority === "High") return "orange";
  if (priority === "Low") return "gray";
  return "green";
}

function formatDate(value, includeTime = false) {
  if (!value) return "Not set";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(includeTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}

function money(value) {
  return Number(value || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
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
    project.contact_name ||
    project.customer_contact_name ||
    getCustomerName(customer) ||
    "Customer not assigned"
  );
}

function getProjectCompany(project, customer, person) {
  const company = project.company_name || customer?.company_name || "";
  return company === person ? "" : company;
}

function getProjectItem(project) {
  return (
    project.project_name ||
    project.item_name ||
    project.description ||
    project.project_type ||
    project.project_category ||
    "Project not specified"
  );
}

function getProjectIdentity(project, customer) {
  return `${getProjectPerson(project, customer)} — ${getProjectItem(project)}`;
}

function getCalendarType(project) {
  const words = [project.project_type, project.project_category, project.project_name, project.notes]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return CALENDAR_TYPES.find((type) => type.terms.some((term) => words.includes(term))) || CALENDAR_TYPES.at(-1);
}

function getCalendarEntryType(entry) {
  if (entry.kind === "estimate") return { label: "Estimate Visit", color: "#f59f00" };
  if (entry.kind === "site_visit") return { label: "Site Visit", color: "#0ca6a6" };
  if (entry.kind === "test_fit") return { label: "Test Fit", color: "#7950f2" };
  if (entry.kind === "install") return { label: "Installation", color: "#2f9e44" };
  return getCalendarType(entry.project || {});
}

function Projects({ setPage, setSelectedProject, setSelectedQuote, activeUser, accessLevel }) {
  const [projects, setProjects] = useState([]);
  const [completedProjects, setCompletedProjects] = useState([]);
  const [archivedProjects, setArchivedProjects] = useState([]);
  const [siteVisits, setSiteVisits] = useState([]);
  const [quotesById, setQuotesById] = useState({});
  const [approvalsByQuote, setApprovalsByQuote] = useState({});
  const [viewMode, setViewMode] = useState("active");
  const [workspaceView, setWorkspaceView] = useState("board");
  const [activeWorkspace, setActiveWorkspace] = useState(() => {
    const savedWorkspace = window.localStorage.getItem("mw-outside-workspace");
    return OUTSIDE_WORKSPACES.some((workspace) => workspace.key === savedWorkspace)
      ? savedWorkspace
      : "estimates";
  });
  const [customers, setCustomers] = useState({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [trackingByProject, setTrackingByProject] = useState({});
  const [calendarMonth, setCalendarMonth] = useState(() => firstOfMonth());
  const [selectedCalendarDay, setSelectedCalendarDay] = useState(null);
  const [advancingVisitId, setAdvancingVisitId] = useState(null);
  const [bypassVisit, setBypassVisit] = useState(null);
  const [bypassReason, setBypassReason] = useState("");
  const [visitEditor, setVisitEditor] = useState(null);
  const [visitDraft, setVisitDraft] = useState({});
  const [visitFilesById, setVisitFilesById] = useState({});
  const [savingVisit, setSavingVisit] = useState(false);
  const [uploadingVisitFile, setUploadingVisitFile] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [archiveReason, setArchiveReason] = useState("");
  const [archivingProject, setArchivingProject] = useState(false);
  const [updateTarget, setUpdateTarget] = useState(null);
  const [quickUpdate, setQuickUpdate] = useState({ status: "On Track", work_completed: "", work_in_progress: "", next_steps: "", blockers: "", leadership_attention_required: false });
  const [savingQuickUpdate, setSavingQuickUpdate] = useState(false);
  const [restoringProjectId, setRestoringProjectId] = useState(null);
  const [completingProjectId, setCompletingProjectId] = useState(null);
  const [selectedAlertKey, setSelectedAlertKey] = useState(null);

  useEffect(() => {
    window.localStorage.setItem("mw-outside-workspace", activeWorkspace);
  }, [activeWorkspace]);

  const activeUserName = typeof activeUser === "string"
    ? activeUser
    : activeUser?.full_name || activeUser?.name || activeUser?.display_name || "Metal Worx";
  const isAdministrator = String(accessLevel || "").toLowerCase().includes("admin");

  const loadProjects = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    else setRefreshing(true);

    setErrorMessage("");

    try {
      const [projectResult, customerResult, siteVisitResult, visitFileResult, allQuoteResult, allApprovalResult] = await Promise.all([
        supabase
          .from("projects")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase.from("customers").select("*"),
        supabase
          .from("prequote_site_visits")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("prequote_site_visit_files")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("project_quotes")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("customer_quote_approvals")
          .select("id, quote_id, status, approved_at, signer_name, document_version, created_at")
          .order("created_at", { ascending: false }),
      ]);

      if (projectResult.error) throw projectResult.error;
      if (customerResult.error) throw customerResult.error;
      if (siteVisitResult.error) throw siteVisitResult.error;
      if (visitFileResult.error) throw visitFileResult.error;
      if (allQuoteResult.error) throw allQuoteResult.error;
      if (allApprovalResult.error) throw allApprovalResult.error;

      const allProjects = projectResult.data || [];
      const loadedProjects = allProjects.filter(
        (project) => project.is_active === true && !["Completed", "Cancelled"].includes(project.status)
      );
      const loadedCompletedProjects = allProjects.filter(
        (project) => project.status === "Completed" && !project.archived_at
      );
      const loadedArchivedProjects = allProjects.filter(
        (project) => Boolean(project.archived_at)
      );
      const trackedProjects = [...loadedProjects, ...loadedCompletedProjects];
      const projectIds = trackedProjects.map((project) => project.id);
      let checklistRows = [];
      let updateRows = [];
      const allQuoteRows = allQuoteResult.data || [];
      const allApprovalRows = allApprovalResult.data || [];
      let quoteRows = allQuoteRows.filter((quote) => projectIds.includes(quote.project_id));
      let approvalRows = allApprovalRows.filter((approval) => quoteRows.some((quote) => quote.id === approval.quote_id));

      if (projectIds.length) {
        const [checklistResult, updateResult] = await Promise.all([
          supabase
            .from("project_checklist_items")
            .select("project_id, status")
            .in("project_id", projectIds),
          supabase
            .from("project_daily_updates")
            .select(
              "project_id, update_date, status, work_completed, work_in_progress, next_steps, blockers, leadership_attention_required, project_lead, created_at"
            )
            .in("project_id", projectIds)
            .order("update_date", { ascending: false })
            .order("created_at", { ascending: false }),
        ]);

        if (checklistResult.error) throw checklistResult.error;
        if (updateResult.error) throw updateResult.error;
        checklistRows = checklistResult.data || [];
        updateRows = updateResult.data || [];
      }

      const trackingMap = Object.fromEntries(
        trackedProjects.map((project) => [
          project.id,
          {
            tasks: 0,
            applicable: 0,
            complete: 0,
            blocked: 0,
            latestUpdate: null,
            latestApproval: null,
            latestQuote: null,
          },
        ])
      );

      checklistRows.forEach((task) => {
        const tracking = trackingMap[task.project_id];
        if (!tracking) return;
        tracking.tasks += 1;
        if (task.status !== "Not Applicable") tracking.applicable += 1;
        if (task.status === "Complete") tracking.complete += 1;
        if (task.status === "Blocked") tracking.blocked += 1;
      });

      updateRows.forEach((update) => {
        const tracking = trackingMap[update.project_id];
        if (tracking && !tracking.latestUpdate) tracking.latestUpdate = update;
      });

      const projectIdByQuote = Object.fromEntries(quoteRows.map((quote) => [quote.id, quote.project_id]));
      quoteRows.forEach((quote) => {
        const tracking = trackingMap[quote.project_id];
        if (tracking && !tracking.latestQuote) tracking.latestQuote = quote;
      });
      approvalRows.forEach((approval) => {
        const tracking = trackingMap[projectIdByQuote[approval.quote_id]];
        if (tracking && !tracking.latestApproval) tracking.latestApproval = approval;
      });

      setProjects(loadedProjects);
      setCompletedProjects(loadedCompletedProjects);
      setArchivedProjects(loadedArchivedProjects);
      setSiteVisits((siteVisitResult.data || []).filter(
        (visit) => visit.status !== "Cancelled" && !visit.project_id
      ));
      setVisitFilesById((visitFileResult.data || []).reduce((grouped, file) => {
        if (!grouped[file.visit_id]) grouped[file.visit_id] = [];
        grouped[file.visit_id].push(file);
        return grouped;
      }, {}));
      setQuotesById(Object.fromEntries(allQuoteRows.map((quote) => [quote.id, quote])));
      setApprovalsByQuote(allApprovalRows.reduce((latest, approval) => {
        if (!latest[approval.quote_id]) latest[approval.quote_id] = approval;
        return latest;
      }, {}));
      setTrackingByProject(trackingMap);
      setCustomers(
        Object.fromEntries(
          (customerResult.data || []).map((customer) => [
            customer.id,
            customer,
          ])
        )
      );
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error?.message || "Outside fabrication projects could not be loaded."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadProjects(true);
  }, [loadProjects]);

  const filteredProjects = useMemo(() => {
    const term = search.trim().toLowerCase();
    const source = workspaceView === "completed"
      ? completedProjects
      : workspaceView === "archived"
        ? archivedProjects
        : projects;
    if (!term) return source;

    return source.filter((project) => {
      const customer = customers[project.customer_id];
      const person = getProjectPerson(project, customer);
      const company = getProjectCompany(project, customer, person);

      return [
        getProjectIdentity(project, customer),
        person,
        company,
        project.project_number,
        project.project_name,
        project.project_type,
        project.project_category,
        project.intake_owner,
        project.work_location,
        project.status,
        project.assigned_to,
        project.contact_phone,
        project.job_address,
        project.next_action,
        project.notes,
        project.archive_reason,
        project.archived_by,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [archivedProjects, completedProjects, customers, projects, search, workspaceView]);

  const filteredSiteVisits = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return siteVisits;
    return siteVisits.filter((visit) => [
      visit.customer_name,
      visit.contact_name,
      visit.contact_phone,
      visit.job_site_address,
      visit.assigned_estimator,
      visit.status,
      visit.notes,
    ].filter(Boolean).join(" ").toLowerCase().includes(term));
  }, [search, siteVisits]);

  const activeSiteVisits = useMemo(
    () => filteredSiteVisits.filter((visit) => !visit.quote_id && ["Open", "Scheduled", "Completed"].includes(visit.status)),
    [filteredSiteVisits]
  );

  const linkedQuoteVisits = useMemo(
    () => filteredSiteVisits.filter((visit) => {
      if (!visit.quote_id || visit.bypassed_to_production) return false;
      const quote = quotesById[visit.quote_id];
      return quote && !quote.project_id && !quote.converted_project_id;
    }),
    [filteredSiteVisits, quotesById]
  );

  const commandQueues = useMemo(() => {
    const financiallyCleared = (project) =>
      ["Approved", "Bypassed"].includes(project.approval_status) &&
      (!project.down_payment_required || ["Received", "Paid", "Not Required"].includes(project.down_payment_status));
    const hasSchedule = (project) => Boolean(
      project.planned_start_date || project.site_visit_start || project.test_fit_start || project.install_start || project.install_date
    );
    const activeStatus = (project) => ["In Progress", "Active"].includes(project.status);
    const queueProject = (project, stage, color) => ({
      id: `project-${project.id}`,
      kind: "project",
      label: getProjectIdentity(project, customers[project.customer_id]),
      location: [project.city, project.state].filter(Boolean).join(", ") || project.job_address || "Location not entered",
      owner: project.assigned_to || project.intake_owner || "Unassigned",
      stage,
      color,
      project,
    });

    const projectQueue = filteredProjects.filter((project) => !activeStatus(project));
    return [
      {
        key: "requests",
        label: "Requests & Estimates",
        description: "New customer requests and site visits that still need a formal quote.",
        color: "cyan",
        items: activeSiteVisits.map((visit) => ({
          id: `visit-${visit.id}`,
          kind: "visit",
          label: visit.customer_name || "Potential Customer",
          location: visit.job_site_address || "Address not entered",
          owner: visit.assigned_estimator || "Unassigned",
          stage: visit.status === "Completed" ? "Ready for Quote" : visit.requested_visit_date ? "Visit Scheduled" : "New Request",
          color: visit.status === "Completed" ? "green" : "cyan",
          visit,
        })),
      },
      {
        key: "quotes",
        label: "Quotes & Approval",
        description: "Pricing is being prepared or the customer decision is still pending.",
        color: "violet",
        items: [
          ...linkedQuoteVisits.map((visit) => {
            const quote = quotesById[visit.quote_id];
            return {
              id: `quote-${visit.quote_id}`,
              kind: "quote",
              label: visit.customer_name || quote?.customer_name || quote?.project_name || "Customer Quote",
              location: visit.job_site_address || quote?.job_site_address || "Address not entered",
              owner: quote?.prepared_by || visit.assigned_estimator || "Unassigned",
              stage: quote?.status === "Sent" ? "Awaiting Approval" : "Quote Draft",
              color: "violet",
              visit,
            };
          }),
          ...projectQueue
            .filter((project) => !["Approved", "Bypassed"].includes(project.approval_status) && getOutsidePhase(project).key === "quote_approval")
            .map((project) => queueProject(project, project.quote_status === "Sent" ? "Awaiting Approval" : "Quote & Approval", "violet")),
        ],
      },
      {
        key: "deposit",
        label: "Awaiting Deposit",
        description: "Approved, but the required deposit has not been received.",
        color: "orange",
        items: projectQueue
          .filter((project) => ["Approved", "Bypassed"].includes(project.approval_status) && project.down_payment_required && !["Received", "Paid"].includes(project.down_payment_status))
          .map((project) => queueProject(project, "Deposit", "orange")),
      },
      {
        key: "scheduling",
        label: "Needs Scheduling",
        description: "Approved and financially cleared; ready for a confirmed date.",
        color: "red",
        items: projectQueue
          .filter((project) => financiallyCleared(project) && !hasSchedule(project))
          .map((project) => queueProject(project, "Ready", "red")),
      },
      {
        key: "scheduled",
        label: "Scheduled",
        description: "Confirmed work with a planned start or field-work date.",
        color: "blue",
        items: projectQueue
          .filter((project) => financiallyCleared(project) && hasSchedule(project))
          .map((project) => queueProject(project, "Scheduled", "blue")),
      },
      {
        key: "active",
        label: "Active Work",
        description: "Projects currently being fabricated, prepared, test-fitted, or installed.",
        color: "green",
        items: filteredProjects
          .filter(activeStatus)
          .map((project) => queueProject(project, "Active", "green")),
      },
    ];
  }, [activeSiteVisits, customers, filteredProjects, linkedQuoteVisits, quotesById]);

  const leadershipSummary = useMemo(() => {
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 86400000);
    return {
      attention: projects.filter((project) => {
        const tracking = trackingByProject[project.id];
        return tracking?.blocked > 0 || tracking?.latestUpdate?.leadership_attention_required || project.status === "On Hold";
      }).length,
      overdue: projects.filter((project) => {
        const due = project.due_date || project.target_completion_date;
        return due && new Date(due) < now;
      }).length,
      upcoming: projects.filter((project) => {
        const date = getOutsideNextDate(project);
        if (!date) return false;
        const value = new Date(date);
        return value >= now && value <= nextWeek;
      }).length,
      balance: projects.reduce((sum, project) => sum + Math.max(Number(project.balance_due || 0), 0), 0),
    };
  }, [projects, trackingByProject]);

  const projectAlertGroups = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const effectiveProject = (project) => {
      const approval = trackingByProject[project.id]?.latestApproval;
      return approval?.status === "Approved"
        ? { ...project, approval_status: "Approved", quote_status: "Approved" }
        : project;
    };
    const isOverdue = (project) => {
      const value = project.next_action_date || project.due_date || project.target_completion_date;
      if (!value) return false;
      const date = new Date(value);
      date.setHours(0, 0, 0, 0);
      return date < today;
    };
    const materialNeedsAttention = (project) => [
      "Pricing Needed",
      "Ready to Order",
      "Ordered",
      "Partially Received",
      "Waiting",
      "Pending",
    ].includes(project.material_status);

    return [
      {
        key: "quote_waiting",
        label: "Awaiting Customer",
        description: "Sent quotes still waiting for approval",
        color: "violet",
        icon: IconMail,
        projects: projects.filter((project) => {
          const effective = effectiveProject(project);
          const quoteStatus = trackingByProject[project.id]?.latestQuote?.status || effective.quote_status;
          return quoteStatus === "Sent" && effective.approval_status !== "Approved";
        }),
      },
      {
        key: "stale_update",
        label: "Update Needed",
        description: "No project update within three days",
        color: "red",
        icon: IconNotes,
        projects: projects.filter((project) => updateAgeLabel(trackingByProject[project.id]?.latestUpdate).color === "red"),
      },
      {
        key: "unscheduled_install",
        label: "Install Not Scheduled",
        description: "Field-ready work without an install date",
        color: "blue",
        icon: IconTruckDelivery,
        projects: projects.filter((project) => {
          const effective = effectiveProject(project);
          return project.install_required &&
            project.install_status !== "Completed" &&
            getOutsidePhase(effective).key === "field" &&
            !(project.install_start || project.install_date);
        }),
      },
      {
        key: "overdue",
        label: "Overdue",
        description: "Past-due project action dates",
        color: "orange",
        icon: IconAlertTriangle,
        projects: projects.filter(isOverdue),
      },
      {
        key: "materials",
        label: "Materials Attention",
        description: "Pricing, ordering, or delivery required",
        color: "yellow",
        icon: IconPackage,
        projects: projects.filter(materialNeedsAttention),
      },
    ];
  }, [projects, trackingByProject]);

  const selectedAlertGroup = projectAlertGroups.find((group) => group.key === selectedAlertKey);

  const projectsByPhase = useMemo(() => Object.fromEntries(
    OUTSIDE_PHASES.map((phase) => [phase.key, filteredProjects.filter((project) => {
      const approval = trackingByProject[project.id]?.latestApproval;
      const operationalProject = approval?.status === "Approved" ? { ...project, approval_status: "Approved", quote_status: "Approved" } : project;
      return getOutsidePhase(operationalProject).key === phase.key;
    })])
  ), [filteredProjects, trackingByProject]);

  const workspaceCounts = useMemo(() => Object.fromEntries(
    OUTSIDE_WORKSPACES.map((workspace) => {
      const projectCount = workspace.phases.reduce(
        (total, phase) => total + (projectsByPhase[phase]?.length || 0),
        0
      );
      const visitCount = workspace.key === "estimates"
        ? activeSiteVisits.length
        : workspace.key === "approvals"
          ? linkedQuoteVisits.length
          : 0;
      return [workspace.key, projectCount + visitCount];
    })
  ), [activeSiteVisits, linkedQuoteVisits, projectsByPhase]);

  const selectedWorkspace = OUTSIDE_WORKSPACES.find(
    (workspace) => workspace.key === activeWorkspace
  ) || OUTSIDE_WORKSPACES[0];

  const selectedWorkspaceProjects = useMemo(() => selectedWorkspace.phases.flatMap(
    (phase) => projectsByPhase[phase] || []
  ), [projectsByPhase, selectedWorkspace]);

  const siteVisitCount = siteVisits.filter((visit) => ["Open", "Scheduled"].includes(visit.status)).length + projects.filter(
    (project) =>
      project.site_visit_required &&
      project.site_visit_status !== "Completed"
  ).length;
  const installCount = projects.filter(
    (project) =>
      project.install_required && project.install_date && project.install_status !== "Completed"
  ).length;
  const holdCount = projects.filter(
    (project) => project.status === "On Hold"
  ).length;

  const calendarDays = useMemo(() => {
    return buildMonthGrid(calendarMonth);
  }, [calendarMonth]);

  const calendarEntriesByDay = useMemo(() => {
    const result = {};
    const addEntry = (date, entry) => {
      if (!date) return;
      const key = dateKey(date);
      if (!result[key]) result[key] = [];
      if (!result[key].some((item) => item.id === entry.id)) result[key].push(entry);
    };

    siteVisits.filter((visit) => ["Open", "Scheduled"].includes(visit.status)).forEach((visit) => addEntry(visit.requested_visit_date, {
      id: `estimate-${visit.id}`,
      kind: "estimate",
      label: visit.customer_name || "Estimate Visit",
      owner: visit.assigned_estimator || "Unassigned",
      location: visit.job_site_address || "Address not entered",
      visit,
    }));

    projects.forEach((project) => {
      if (project.planned_start_date) {
      const duration = Math.max(Number(project.planned_duration_days || 1), 1);
      for (let index = 0; index < duration; index += 1) {
          addEntry(addDays(project.planned_start_date, index), {
            id: `project-${project.id}-${index}`,
            kind: "project",
            label: project.project_name || project.project_number,
            owner: project.assigned_to || project.intake_owner || "Unassigned",
            location: project.work_location || project.job_address || "Location not entered",
            project,
          });
        }
      }

      [
        ["site_visit", project.site_visit_start || project.site_visit_date, "Site Visit"],
        ["test_fit", project.test_fit_start, "Test Fit"],
        ["install", project.install_start || project.install_date, "Installation"],
      ].forEach(([kind, date, label]) => addEntry(date, {
        id: `${kind}-${project.id}`,
        kind,
        label: `${project.project_name || project.project_number} — ${label}`,
        owner: project.assigned_to || project.intake_owner || "Unassigned",
        location: project.work_location || project.job_address || "Location not entered",
        project,
      }));
    });
    return result;
  }, [projects, siteVisits]);

  const calendarEntryCount = useMemo(
    () => Object.values(calendarEntriesByDay).reduce((total, entries) => total + entries.length, 0),
    [calendarEntriesByDay]
  );

  function openVisitEditor(visit) {
    setVisitEditor(visit);
    setVisitDraft({
      customer_name: visit.customer_name || "",
      contact_name: visit.contact_name || "",
      contact_phone: visit.contact_phone || "",
      contact_email: visit.contact_email || "",
      job_site_address: visit.job_site_address || "",
      requested_visit_date: visit.requested_visit_date || "",
      requested_visit_time: visit.requested_visit_time?.slice(0, 5) || "",
      assigned_estimator: visit.assigned_estimator || "",
      one_way_miles: visit.one_way_miles || 0,
      notes: visit.notes || "",
      access_instructions: visit.access_instructions || "",
      site_conditions: visit.site_conditions || "",
      measurements: visit.measurements || "",
      labor_requirements: visit.labor_requirements || "",
      material_requirements: visit.material_requirements || "",
      customer_decisions: visit.customer_decisions || "",
      recommended_next_step: visit.recommended_next_step || "",
    });
  }

  function updateVisitDraft(field, value) {
    setVisitDraft((current) => ({ ...current, [field]: value }));
  }

  async function saveVisitEditor(closeAfterSave = true) {
    if (!visitEditor) return null;
    if (!visitDraft.customer_name?.trim() || !visitDraft.job_site_address?.trim()) {
      notifications.show({ title: "Customer and Address Required", message: "Enter the customer/job name and job-site address before saving.", color: "orange" });
      return null;
    }
    setSavingVisit(true);
    try {
      const updates = {
        ...visitDraft,
        customer_name: visitDraft.customer_name.trim(),
        job_site_address: visitDraft.job_site_address.trim(),
        requested_visit_date: visitDraft.requested_visit_date || null,
        requested_visit_time: visitDraft.requested_visit_time || null,
        one_way_miles: Number(visitDraft.one_way_miles || 0),
        status: visitEditor.status === "Completed" ? "Completed" : visitDraft.requested_visit_date ? "Scheduled" : "Open",
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await supabase
        .from("prequote_site_visits")
        .update(updates)
        .eq("id", visitEditor.id)
        .select("*")
        .single();
      if (error) throw error;
      setSiteVisits((current) => current.map((visit) => visit.id === data.id ? data : visit));
      setVisitEditor(data);
      if (closeAfterSave) setVisitEditor(null);
      notifications.show({ title: "Estimate Updated", message: `${data.customer_name} was saved.`, color: "green" });
      return data;
    } catch (error) {
      notifications.show({ title: "Estimate Could Not Save", message: error.message, color: "red" });
      return null;
    } finally {
      setSavingVisit(false);
    }
  }

  function completionMissing(visit, files) {
    return [
      [visit.notes, "estimate notes"],
      [visit.measurements, "measurements"],
      [visit.labor_requirements, "labor requirements"],
      [visit.material_requirements, "material requirements"],
      [visit.customer_decisions, "customer decisions"],
      [visit.recommended_next_step, "recommended next step"],
      [files.length, "at least one site photo or attachment"],
    ].filter(([value]) => !String(value || "").trim()).map(([, label]) => label);
  }

  async function completeVisit() {
    const saved = await saveVisitEditor(false);
    if (!saved) return;
    const files = visitFilesById[saved.id] || [];
    const missing = completionMissing(saved, files);
    if (missing.length) {
      notifications.show({
        title: "Site Visit Is Not Ready to Complete",
        message: `Add ${missing.join(", ")}. Enter “Not needed” when a category does not apply.`,
        color: "orange",
      });
      return;
    }
    setSavingVisit(true);
    try {
      const timestamp = new Date().toISOString();
      const { data, error } = await supabase
        .from("prequote_site_visits")
        .update({ status: "Completed", completed_at: timestamp, completed_by: activeUserName, updated_at: timestamp })
        .eq("id", saved.id)
        .select("*")
        .single();
      if (error) throw error;
      setSiteVisits((current) => current.map((visit) => visit.id === data.id ? data : visit));
      setVisitEditor(data);
      notifications.show({ title: "Site Visit Completed", message: "The estimate is ready to become a quote.", color: "green" });
    } catch (error) {
      notifications.show({ title: "Site Visit Could Not Complete", message: error.message, color: "red" });
    } finally {
      setSavingVisit(false);
    }
  }

  async function uploadVisitFile(file) {
    if (!file || !visitEditor) return;
    setUploadingVisitFile(true);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
    const storagePath = `prequote-site-visits/${visitEditor.id}/${Date.now()}-${safeName}`;
    try {
      const { error: uploadError } = await supabase.storage
        .from("project-files")
        .upload(storagePath, file, { contentType: file.type || undefined, upsert: false });
      if (uploadError) throw uploadError;
      const { data, error } = await supabase.from("prequote_site_visit_files").insert({
        visit_id: visitEditor.id,
        file_name: file.name,
        storage_path: storagePath,
        file_type: file.type || null,
        file_size: file.size,
        uploaded_by: activeUserName,
      }).select("*").single();
      if (error) {
        await supabase.storage.from("project-files").remove([storagePath]);
        throw error;
      }
      setVisitFilesById((current) => ({ ...current, [visitEditor.id]: [data, ...(current[visitEditor.id] || [])] }));
      notifications.show({ title: "File Attached", message: file.name, color: "green" });
    } catch (error) {
      notifications.show({ title: "File Could Not Upload", message: error.message, color: "red" });
    } finally {
      setUploadingVisitFile(false);
    }
  }

  async function openVisitFile(file) {
    const { data, error } = await supabase.storage.from("project-files").createSignedUrl(file.storage_path, 900);
    if (error) {
      notifications.show({ title: "File Could Not Open", message: error.message, color: "red" });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  function printSiteVisit(visit) {
    const popup = window.open("", "_blank");
    if (!popup) return;
    const line = (label, value) => `<div><b>${label}</b><span>${String(value || "Not entered").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</span></div>`;
    popup.document.write(`<!doctype html><html><head><title>Site Visit — ${visit.customer_name}</title><style>@page{size:letter;margin:.45in}body{font:13px Arial;color:#111}header{border-top:8px solid #b00012;border-bottom:2px solid #111;padding:12px 0;margin-bottom:14px}h1{margin:0}section{display:grid;grid-template-columns:1fr 1fr;gap:10px}section div{border:1px solid #777;padding:9px;min-height:54px}b,span{display:block}b{font-size:10px;color:#666;text-transform:uppercase;margin-bottom:5px}.wide{grid-column:1/-1;min-height:90px}</style></head><body><header><h1>METAL WORX — SITE VISIT</h1><p>Estimate field sheet</p></header><section>${line("Customer / Job", visit.customer_name)}${line("Assigned Estimator", visit.assigned_estimator)}${line("Address", visit.job_site_address)}${line("Scheduled", `${formatDate(visit.requested_visit_date)} ${visit.requested_visit_time || ""}`)}${line("Contact", `${visit.contact_name || ""} ${visit.contact_phone || ""}`)}${line("Email", visit.contact_email)}${line("Access Instructions", visit.access_instructions)}${line("Site Conditions", visit.site_conditions)}${line("Estimate Notes", visit.notes)}${line("Measurements", visit.measurements)}${line("Labor Requirements", visit.labor_requirements)}${line("Material Requirements", visit.material_requirements)}${line("Customer Decisions", visit.customer_decisions)}${line("Recommended Next Step", visit.recommended_next_step)}</section><script>window.onload=()=>window.print()</script></body></html>`);
    popup.document.close();
  }

  async function moveVisitToQuote(visit) {
    setAdvancingVisitId(visit.id);
    try {
      const { data, error } = await supabase.rpc("mw_advance_prequote_site_visit", {
        p_visit_id: visit.id,
        p_action: "quote",
        p_actor: activeUserName,
        p_bypass_reason: null,
      });
      if (error) throw error;

      const quoteId = data?.quote_id;
      const { data: quote, error: quoteError } = await supabase
        .from("project_quotes")
        .select("*")
        .eq("id", quoteId)
        .single();
      if (quoteError) throw quoteError;

      notifications.show({
        title: data?.existing ? "Quote Already Started" : "Draft Quote Created",
        message: `${quote.quote_number} is linked to ${visit.customer_name} and ready for pricing.`,
        color: "green",
      });
      setSelectedQuote(quote);
      setSelectedProject(null);
      setPage("quoteBuilder");
    } catch (error) {
      notifications.show({ title: "Could Not Move to Quote", message: error.message, color: "red" });
    } finally {
      setAdvancingVisitId(null);
    }
  }

  function openLinkedQuote(visit) {
    const quote = quotesById[visit.quote_id];
    if (!quote) return;
    setSelectedQuote(quote);
    setSelectedProject(quote.project_id ? projects.find((project) => project.id === quote.project_id) || null : null);
    setPage("quoteBuilder");
  }

  async function releaseApprovedQuote(visit) {
    const quote = quotesById[visit.quote_id];
    if (!quote) return;
    setAdvancingVisitId(visit.id);
    try {
      const { data, error } = await supabase.rpc("mw_convert_quote_to_project", {
        p_quote_id: Number(quote.id),
        p_converted_by: activeUserName,
        p_fabrication_required: true,
        p_test_fit_required: true,
        p_finish_required: true,
        p_assembly_required: false,
        p_install_required: true,
        p_design_required: false,
        p_down_payment_required: Number(quote.total_amount || 0) > 0,
      });
      if (error) throw error;
      const project = Array.isArray(data) ? data[0] : data;
      if (!project?.id) throw new Error("The outside project was not returned.");

      const { error: visitError } = await supabase
        .from("prequote_site_visits")
        .update({
          project_id: project.id,
          status: "Released to Production",
          updated_at: new Date().toISOString(),
        })
        .eq("id", visit.id);
      if (visitError) throw visitError;

      let productionJob = null;
      let readinessMessage = "The project is waiting for its production-readiness requirements.";
      try {
        productionJob = await releaseProject(project.id, activeUserName);
        readinessMessage = `${productionJob.production_job_number} is ready in ${productionJob.current_department}.`;
      } catch (releaseError) {
        readinessMessage = releaseError.message;
      }

      notifications.show({
        title: productionJob ? "Project Released to Production" : "Project Created — Readiness Check Required",
        message: `${project.project_number} was created. ${readinessMessage}`,
        color: productionJob ? "green" : "orange",
      });
      setActiveWorkspace("production");
      await loadProjects(false);
    } catch (error) {
      notifications.show({ title: "Could Not Release Project", message: error.message, color: "red" });
    } finally {
      setAdvancingVisitId(null);
    }
  }

  async function bypassToProduction() {
    if (!bypassVisit || !bypassReason.trim()) {
      notifications.show({ title: "Bypass Reason Required", message: "Explain why the quote and approval are being bypassed.", color: "orange" });
      return;
    }
    setAdvancingVisitId(bypassVisit.id);
    try {
      const { data, error } = await supabase.rpc("mw_advance_prequote_site_visit", {
        p_visit_id: bypassVisit.id,
        p_action: "bypass",
        p_actor: activeUserName,
        p_bypass_reason: bypassReason.trim(),
      });
      if (error) throw error;
      notifications.show({
        title: "Administrator Bypass Recorded",
        message: `${data?.project_number || "The project"} is ready for production.`,
        color: "orange",
      });
      setBypassVisit(null);
      setBypassReason("");
      setActiveWorkspace("production");
      await loadProjects(false);
    } catch (error) {
      notifications.show({ title: "Could Not Bypass Workflow", message: error.message, color: "red" });
    } finally {
      setAdvancingVisitId(null);
    }
  }

  function printDailyUpdateSheets(prefilled = true) {
    const printableProjects = prefilled ? projects : [null];
    const pages = printableProjects.map((project) => {
      const customer = project ? customers[project.customer_id] : null;
      const identity = project ? getProjectIdentity(project, customer) : "";
      const lead = project ? project.assigned_to || project.intake_owner || "" : "";
      const field = (label, size = "normal") => `<div class="field ${size}"><b>${label}</b><div></div></div>`;
      return `<section class="sheet"><header><div class="brand"><img src="${companyLogo}" alt="Metal Worx"><div><h1>DAILY PROJECT UPDATE</h1><p>OUTSIDE FABRICATION • FIELD & SHOP OPERATIONS</p></div></div><div class="doc"><b>MW-OPS-01</b><span>Daily Control Record</span></div></header><div class="instructions"><b>PROJECT LEAD:</b> Complete at the end of the shift. Be specific about quantities, locations, decisions, and dates. Return to Operations for entry into Metal Worx OS.</div><div class="meta"><span class="wide"><b>PROJECT / CUSTOMER</b>${identity || "____________________________________________"}</span><span><b>PROJECT NUMBER</b>${project?.project_number || "________________"}</span></div><div class="meta"><span><b>DATE</b>____________________</span><span><b>PROJECT LEAD</b>${lead || "____________________"}</span><span><b>CREW / SUPPORT</b>____________________</span></div><div class="status"><b>OVERALL STATUS</b><span>☐ On Track</span><span>☐ At Risk</span><span>☐ Blocked</span><span>☐ Complete</span><span>Percent Complete: ______ %</span></div><div class="primary">${field("1. WORK COMPLETED TODAY", "large")}${field("2. WORK CURRENTLY IN PROGRESS", "large")}${field("3. NEXT STEPS / TOMORROW'S PLAN", "large")}</div><div class="two-col"><div>${field("4. PROBLEMS / BLOCKERS")}${field("5. MATERIALS NEEDED — ITEM, QTY & NEEDED-BY DATE")}${field("6. LABOR / EQUIPMENT HELP NEEDED")}</div><div>${field("7. SCHEDULE OR SITE CHANGES")}${field("8. CUSTOMER / VENDOR FOLLOW-UP")}${field("9. LEADERSHIP DECISION NEEDED")}</div></div><div class="bottom"><span><b>ESTIMATED COMPLETION DATE</b>____________________</span><span><b>LEADERSHIP ATTENTION</b>☐ Yes &nbsp;&nbsp; ☐ No</span><span><b>LEAD INITIALS</b>____________</span><span><b>OPS ENTERED</b>____________</span></div><footer><b>METAL WORX INC.</b><span>1122 Gillespie Street • Fayetteville, NC 28306 • (910) 438-9353</span><span>Controlled Daily Operations Record</span></footer></section>`;
    }).join("");
    const popup = window.open("", "_blank");
    if (!popup) {
      setErrorMessage("Allow pop-ups for Metal Worx OS, then try printing again.");
      return;
    }
    popup.document.write(`<!doctype html><html><head><title>Daily Project Update Sheets</title><style>@page{size:letter portrait;margin:.25in}*{box-sizing:border-box}body{margin:0;background:#d9dde0;font:10px Arial,Helvetica,sans-serif;color:#111}.sheet{page-break-after:always;width:8in;min-height:10.5in;margin:16px auto;background:#fff;border:1px solid #20252a;padding:14px 16px 11px;position:relative;box-shadow:0 8px 28px rgba(0,0,0,.18)}.sheet:last-child{page-break-after:auto}header{height:72px;display:flex;align-items:center;justify-content:space-between;border-top:8px solid #b00012;border-bottom:2px solid #20252a;padding:7px 4px}.brand{display:flex;align-items:center;gap:16px}.brand img{width:130px;height:48px;object-fit:contain}.brand h1{margin:0;font-size:22px;letter-spacing:.055em}.brand p{margin:4px 0 0;color:#555;font-size:9px;font-weight:800;letter-spacing:.07em}.doc{text-align:right;border-left:1px solid #999;padding-left:12px}.doc b,.doc span{display:block}.doc b{color:#b00012;font-size:11px}.doc span{color:#666;font-size:8px;margin-top:3px}.instructions{padding:7px 9px;background:#f0f1f2;border-left:5px solid #b00012;margin:8px 0;line-height:1.35}.meta{display:flex;border:1px solid #555;border-bottom:0}.meta span{flex:1;min-height:38px;padding:6px 8px;border-right:1px solid #555;font-size:12px}.meta span:last-child{border-right:0}.meta .wide{flex:2}.meta b,.bottom b{display:block;font-size:7px;letter-spacing:.1em;color:#596168;margin-bottom:5px}.status{display:flex;align-items:center;gap:16px;border:1px solid #555;padding:8px;font-size:10px}.status b{margin-right:4px;letter-spacing:.06em}.field{margin-top:6px}.field b{display:block;background:#252a2e;color:#fff;border-left:6px solid #c60018;padding:4px 7px;font-size:9px;letter-spacing:.045em}.field div{height:50px;border:1px solid #777;border-top:0;background:repeating-linear-gradient(#fff,#fff 23px,#d7dadd 24px)}.field.large div{height:62px}.two-col{display:grid;grid-template-columns:1fr 1fr;gap:8px}.bottom{display:grid;grid-template-columns:1.4fr 1.2fr .8fr .8fr;border:1px solid #555;margin-top:8px;padding:7px;gap:10px}.bottom span{border-right:1px solid #bbb;padding-right:6px}.bottom span:last-child{border:0}footer{display:flex;justify-content:space-between;align-items:center;margin-top:9px;border-top:3px solid #b00012;padding-top:5px;color:#555;font-size:7px;letter-spacing:.05em}footer b{color:#111}@media print{body{background:#fff}.sheet{margin:0;width:auto;min-height:10.45in;box-shadow:none}}</style></head><body>${pages}<script>window.onload=()=>window.print()</script></body></html>`);
    popup.document.close();
  }

  function openProject(project) {
    setSelectedProject({ ...project, initialTab: "overview" });
    setPage("projectDetails");
  }

  function openProjectChecklist(project) {
    setSelectedProject({ ...project, initialTab: "tracking" });
    setPage("projectDetails");
  }

  function editProject(project) {
    setSelectedProject(project);
    setPage("editProject");
  }

  async function completeProject(project) {
    if (!window.confirm(`Mark "${project.project_name || project.project_number}" complete and remove it from the active-project board?`)) return;
    setCompletingProjectId(project.id);
    try {
      const { error } = await supabase
        .from("projects")
        .update({
          status: "Completed",
          percent_complete: 100,
          completed_at: new Date().toISOString(),
          next_action: "Project complete",
          is_active: false,
        })
        .eq("id", project.id);
      if (error) throw error;
      notifications.show({
        title: "Project Completed",
        message: `${project.project_name || project.project_number || "The project"} was moved to Completed.`,
        color: "green",
      });
      await loadProjects();
    } catch (error) {
      setErrorMessage(error.message || "The project could not be completed.");
    } finally {
      setCompletingProjectId(null);
    }
  }

  async function reopenProject(project) {
    const { error } = await supabase
      .from("projects")
      .update({
        status: "In Progress",
        completed_at: null,
        is_active: true,
        next_action: "Review project status",
      })
      .eq("id", project.id);
    if (error) {
      setErrorMessage(error.message || "The project could not be reopened.");
      return;
    }
    await loadProjects();
  }

  async function removeProject(project) {
    if (!isAdministrator) return;
    setArchiveTarget(project);
    setArchiveReason("");
  }

  async function confirmArchiveProject() {
    if (!archiveTarget?.id || !archiveReason.trim() || archivingProject) return;
    setArchivingProject(true);
    try {
      const { error } = await supabase.rpc("mw_archive_project", {
        p_project_id: Number(archiveTarget.id),
        p_reason: archiveReason.trim(),
        p_archived_by: activeUserName,
      });
      if (error) throw error;
      notifications.show({
        title: "Project Archived",
        message: "The project was removed from active work and remains searchable in Archived.",
        color: "green",
      });
      setArchiveTarget(null);
      setArchiveReason("");
      await loadProjects();
    } catch (error) {
      setErrorMessage(error.message || "The project could not be archived.");
    } finally {
      setArchivingProject(false);
    }
  }

  function openQuickUpdate(project) {
    setUpdateTarget(project);
    setQuickUpdate({ status: "On Track", work_completed: "", work_in_progress: "", next_steps: "", blockers: "", leadership_attention_required: false });
  }

  async function saveQuickProjectUpdate() {
    if (!updateTarget?.id || savingQuickUpdate) return;
    const hasContent = [quickUpdate.work_completed, quickUpdate.work_in_progress, quickUpdate.next_steps, quickUpdate.blockers].some((value) => value.trim());
    if (!hasContent) {
      notifications.show({ title: "Update Is Blank", message: "Enter at least one update or next step.", color: "orange" });
      return;
    }
    setSavingQuickUpdate(true);
    try {
      const { error } = await supabase.from("project_daily_updates").insert({
        project_id: updateTarget.id,
        project_lead: updateTarget.assigned_to || activeUserName,
        update_date: new Date().toISOString().slice(0, 10),
        status: quickUpdate.status,
        work_completed: quickUpdate.work_completed.trim() || null,
        work_in_progress: quickUpdate.work_in_progress.trim() || null,
        next_steps: quickUpdate.next_steps.trim() || null,
        blockers: quickUpdate.blockers.trim() || null,
        leadership_attention_required: quickUpdate.leadership_attention_required || quickUpdate.status === "Blocked",
      });
      if (error) throw error;
      setUpdateTarget(null);
      await loadProjects();
      notifications.show({ title: "Project Update Saved", message: "The Operations Board and leadership report are current.", color: "green" });
    } catch (error) {
      notifications.show({ title: "Update Could Not Be Saved", message: error.message, color: "red" });
    } finally {
      setSavingQuickUpdate(false);
    }
  }

  async function restoreArchivedProject(project) {
    if (!isAdministrator || restoringProjectId) return;
    setRestoringProjectId(project.id);
    try {
      const { error } = await supabase.rpc("mw_restore_archived_project", { p_project_id: Number(project.id) });
      if (error) throw error;
      await loadProjects();
      notifications.show({ title: "Project Restored", message: "The project is active and back on the Operations Board.", color: "green" });
    } catch (error) {
      notifications.show({ title: "Project Could Not Be Restored", message: error.message, color: "red" });
    } finally {
      setRestoringProjectId(null);
    }
  }

  if (loading) {
    return (
      <Stack gap="xl">
        <MWPageHeader
          title="Outside Fabrication"
          subtitle="Loading active Metal Worx projects."
          setPage={setPage}
        />
        <MWPanel>
          <Group justify="center" py={90}>
            <Loader color="red" />
            <Text c="dimmed">Loading outside fabrication projects...</Text>
          </Group>
        </MWPanel>
      </Stack>
    );
  }

  return (
    <Stack gap="xl">
      <style>{capacityCalendarStyles}</style>
      <MWPageHeader
        title="Outside Fabrication"
        subtitle="Field fabrication, railings, gates, installs, repairs, and shop-intake projects."
        buttonText="+ New Project"
        onButtonClick={() => setPage("newProject")}
        setPage={setPage}
        showDashboard
      />

      <OutsideWorkspaceNav current="projects" setPage={setPage} />

      <MWKpiStrip
        compact
        columns={{ base: 1, sm: 2, xl: 4 }}
        items={[
          {
            label: "Active Projects",
            value: projects.length,
            description: "Current outside-fabrication work",
            icon: IconTool,
            color: "red",
          },
          {
            label: "Site Visits",
            value: siteVisitCount,
            description: "Required or scheduled",
            icon: IconMapPin,
            color: "blue",
          },
          {
            label: "Installs",
            value: installCount,
            description: "Required or scheduled",
            icon: IconTruckDelivery,
            color: "green",
          },
          {
            label: "On Hold",
            value: holdCount,
            description: "Needs management attention",
            icon: IconAlertTriangle,
            color: "orange",
          },
        ]}
      />

      <MWPanel
        title="Outside Operations Workspace"
        subtitle="Use the workflow queue for daily operations, then open the calendar when work has been scheduled."
        icon={IconTool}
      >
        <SegmentedControl
          fullWidth
          value={workspaceView}
          onChange={(value) => {
            setWorkspaceView(value);
            setViewMode(value === "completed" ? "completed" : value === "archived" ? "archived" : "active");
          }}
          data={[
            { label: "Workflow Queue", value: "board" },
            { label: "Project List", value: "list" },
            { label: "Calendar", value: "calendar" },
            { label: `Completed (${completedProjects.length})`, value: "completed" },
            { label: `Archived (${archivedProjects.length})`, value: "archived" },
          ]}
        />
        <SimpleGrid cols={{ base: 2, lg: 4 }} mt="lg">
          <Paper p="md" withBorder><Text size="xs" c="dimmed" fw={800} tt="uppercase">Needs Leadership</Text><Text fz={28} fw={900} c={leadershipSummary.attention ? "red" : "green"}>{leadershipSummary.attention}</Text></Paper>
          <Paper p="md" withBorder><Text size="xs" c="dimmed" fw={800} tt="uppercase">Overdue</Text><Text fz={28} fw={900} c={leadershipSummary.overdue ? "orange" : "green"}>{leadershipSummary.overdue}</Text></Paper>
          <Paper p="md" withBorder><Text size="xs" c="dimmed" fw={800} tt="uppercase">Next 7 Days</Text><Text fz={28} fw={900}>{leadershipSummary.upcoming}</Text></Paper>
          <Paper p="md" withBorder><Text size="xs" c="dimmed" fw={800} tt="uppercase">Outstanding Balance</Text><Text fz={28} fw={900}>{money(leadershipSummary.balance)}</Text></Paper>
        </SimpleGrid>
      </MWPanel>

      <MWPanel
        title="Outside Project Alerts"
        subtitle="Automatic follow-up list for customer decisions, project updates, installation scheduling, overdue dates, and materials."
        icon={IconAlertTriangle}
      >
        <SimpleGrid cols={{ base: 1, sm: 2, xl: 5 }} spacing="sm">
          {projectAlertGroups.map((group) => {
            const AlertIcon = group.icon;
            const active = selectedAlertKey === group.key;
            return (
              <Paper
                key={group.key}
                role="button"
                tabIndex={0}
                withBorder
                radius="lg"
                p="md"
                onClick={() => setSelectedAlertKey(active ? null : group.key)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") setSelectedAlertKey(active ? null : group.key);
                }}
                style={{
                  cursor: "pointer",
                  borderColor: active ? `var(--mantine-color-${group.color}-6)` : undefined,
                  background: active ? `var(--mantine-color-${group.color}-light)` : "rgba(255,255,255,.02)",
                }}
              >
                <Group justify="space-between" align="flex-start" wrap="nowrap">
                  <div style={{ minWidth: 0 }}>
                    <Group gap={7} wrap="nowrap">
                      <AlertIcon size={17} style={{ flexShrink: 0 }} />
                      <Text fw={900} size="sm" style={{ lineHeight: 1.2 }}>{group.label}</Text>
                    </Group>
                    <Text size="xs" c="dimmed" mt={5}>{group.description}</Text>
                  </div>
                  <Badge color={group.projects.length ? group.color : "green"} variant={active ? "filled" : "light"} size="lg">
                    {group.projects.length}
                  </Badge>
                </Group>
              </Paper>
            );
          })}
        </SimpleGrid>

        {selectedAlertGroup && (
          <Stack gap="sm" mt="lg">
            <Group justify="space-between" align="center">
              <div>
                <Text fw={900}>{selectedAlertGroup.label}</Text>
                <Text size="xs" c="dimmed">Select a project to review and resolve the alert.</Text>
              </div>
              <Button size="xs" variant="subtle" color="gray" onClick={() => setSelectedAlertKey(null)}>Hide List</Button>
            </Group>
            {selectedAlertGroup.projects.length === 0 ? (
              <Alert color="green">No projects currently need attention in this category.</Alert>
            ) : (
              <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }} spacing="sm">
                {selectedAlertGroup.projects.map((project) => {
                  const customer = customers[project.customer_id];
                  return (
                    <Card key={project.id} withBorder radius="md" p="md">
                      <Stack gap="xs">
                        <Group justify="space-between" align="flex-start" wrap="nowrap">
                          <Text fw={900} style={{ overflowWrap: "anywhere" }}>{getProjectIdentity(project, customer)}</Text>
                          <Badge color={selectedAlertGroup.color} variant="light">{project.project_number || "Project"}</Badge>
                        </Group>
                        <Text size="sm" c="dimmed">Owner: {project.assigned_to || project.intake_owner || "Unassigned"}</Text>
                        <Text size="sm">{project.next_action || getSuggestedNextAction(project)}</Text>
                        <Button size="xs" color="red" fullWidth onClick={() => openProject(project)}>Open Project</Button>
                      </Stack>
                    </Card>
                  );
                })}
              </SimpleGrid>
            )}
          </Stack>
        )}
      </MWPanel>

      {workspaceView === "calendar" && <>
      <MWPanel
        title="Project Capacity Calendar"
        subtitle="Full-month workload view. Open Edit Project to set the planned start date and estimated workdays."
        icon={IconCalendarEvent}
        rightSection={<Group gap="xs"><Button size="xs" variant="light" leftSection={<IconPrinter size={15}/>} onClick={() => printDailyUpdateSheets(false)}>Print Blank Sheet</Button><Button size="xs" color="red" leftSection={<IconPrinter size={15}/>} onClick={() => printDailyUpdateSheets(true)}>Print Active Projects</Button></Group>}
      >
        <Group justify="space-between" align="center" mb="md" wrap="wrap">
          <Group gap="xs">
            <Button variant="default" size="xs" aria-label="Previous month" onClick={() => setCalendarMonth((value) => moveMonth(value, -1))}><IconChevronLeft size={17}/></Button>
            <Button variant="light" size="xs" onClick={() => setCalendarMonth(firstOfMonth())}>Today</Button>
            <Button variant="default" size="xs" aria-label="Next month" onClick={() => setCalendarMonth((value) => moveMonth(value, 1))}><IconChevronRight size={17}/></Button>
          </Group>
          <Title order={3} ta="center">{calendarMonth.toLocaleDateString("en-US", { month:"long", year:"numeric" })}</Title>
          <Text size="xs" c="dimmed">Click any day to view its full schedule</Text>
        </Group>
        <Group gap="md" mb="md" wrap="wrap">
          <Group gap={6}><Box w={14} h={14} style={{background:"#f59f00",borderRadius:3}}/><Text size="xs" fw={700}>Estimate Visit</Text></Group>
          <Group gap={6}><Box w={14} h={14} style={{background:"#7950f2",borderRadius:3}}/><Text size="xs" fw={700}>Test Fit</Text></Group>
          <Group gap={6}><Box w={14} h={14} style={{background:"#2f9e44",borderRadius:3}}/><Text size="xs" fw={700}>Installation</Text></Group>
          {CALENDAR_TYPES.map((type) => <Group key={type.label} gap={6}><Box w={14} h={14} style={{background:type.color,borderRadius:3}}/><Text size="xs" fw={700}>{type.label}</Text></Group>)}
          <Group gap={6}><Box w={14} h={14} style={{background:"transparent",border:"2px solid #ff3445",borderRadius:3}}/><Text size="xs" fw={700}>Rush Priority</Text></Group>
        </Group>
        <ScrollArea type="auto">
            <div className="mw-capacity-shell">
              <div className="mw-month-weekdays">
                {["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].map((weekday) => <div key={weekday} className="mw-month-weekday">{weekday}</div>)}
              </div>
              <div className="mw-month-grid">
                {calendarDays.map((day) => {
                  const key = dateKey(day);
                  const dayEntries = calendarEntriesByDay[key] || [];
                  const today = key === dateKey(new Date());
                  const weekend = day.getDay() === 0 || day.getDay() === 6;
                  const outside = day.getMonth() !== calendarMonth.getMonth();
                  return <div key={key} role="button" tabIndex={0} className={`mw-month-day ${weekend ? "weekend" : ""} ${today ? "today" : ""} ${outside ? "outside" : ""}`} onClick={() => setSelectedCalendarDay(day)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelectedCalendarDay(day); }}>
                    <div className="mw-month-day-head"><span className="mw-month-day-number">{day.getDate()}</span><span className="mw-month-load">{dayEntries.length ? `${dayEntries.length} item${dayEntries.length === 1 ? "" : "s"}` : "Open"}</span></div>
                    {dayEntries.map((entry) => {
                      const calendarType = getCalendarEntryType(entry);
                      return <div key={entry.id} className={`mw-month-project ${entry.project?.priority === "Rush" ? "rush" : ""}`} style={{borderLeftColor:calendarType.color}} title={`${entry.label} — ${entry.owner}`}><strong>{entry.label}</strong><span>{calendarType.label} · {entry.owner}</span></div>;
                    })}
                  </div>;
                })}
              </div>
            </div>
          </ScrollArea>
        {!calendarEntryCount && <Alert color="blue" mt="md">Nothing is scheduled yet. Add an estimate date, field-work date, or planned project start date.</Alert>}
      </MWPanel>

      <Modal
        opened={Boolean(selectedCalendarDay)}
        onClose={() => setSelectedCalendarDay(null)}
        title={selectedCalendarDay ? selectedCalendarDay.toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric", year:"numeric" }) : "Scheduled Work"}
        size="lg"
        centered
      >
        <Stack gap="sm">
          {selectedCalendarDay && (calendarEntriesByDay[dateKey(selectedCalendarDay)] || []).length ? (
            (calendarEntriesByDay[dateKey(selectedCalendarDay)] || []).map((entry) => {
              const calendarType = getCalendarEntryType(entry);
              return <Card key={entry.id} withBorder radius="md" p="md" style={{ borderLeft:`6px solid ${calendarType.color}` }} onClick={() => entry.project ? openProject(entry.project) : setPage("quoteCenter")}>
                <Stack gap={3}>
                  <Group gap="xs"><Text fw={900}>{entry.label}</Text>{entry.project?.priority === "Rush" && <Badge color="red">Rush</Badge>}</Group>
                  <Text size="sm">Assigned: {entry.owner}</Text>
                  <Text size="sm">{entry.location}</Text>
                  <Text size="xs" c="dimmed">{calendarType.label} · Click to open {entry.project ? "project" : "site-visit tracker"}</Text>
                </Stack>
              </Card>;
            })
          ) : (
            <Alert color="green" title="Available Day">No projects are scheduled on this date.</Alert>
          )}
        </Stack>
      </Modal>
      </>}

      {workspaceView === "board" && (
        <MWPanel
          title="Outside Project Command Center"
          subtitle="Take in new work, finish quotes, collect deposits, schedule approved projects, and follow active work in one place."
          icon={IconClipboardCheck}
          rightSection={<Group gap="xs"><Button size="xs" color="red" onClick={() => setPage("quoteCenter")}>New Customer Request</Button><Button size="xs" variant="light" color="blue" leftSection={<IconCalendarEvent size={15} />} onClick={() => setWorkspaceView("calendar")}>Open Calendar</Button></Group>}
        >
          <Group mb="md" wrap="wrap">
            <TextInput
              style={{ flex: 1, minWidth: 280 }}
              placeholder="Search customers, projects, owners, or locations..."
              leftSection={<IconSearch size={17} />}
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
            />
            <Button variant="light" color="gray" leftSection={refreshing ? <Loader size={16} /> : <IconRefresh size={17} />} disabled={refreshing} onClick={() => loadProjects(false)}>Refresh</Button>
          </Group>

          <SimpleGrid cols={{ base: 2, md: 3, xl: 6 }} spacing="sm" mb="lg">
            {commandQueues.map((queue) => (
              <Card key={queue.key} withBorder radius="md" p="sm">
                <Text size="xs" c="dimmed" fw={800} tt="uppercase" lh={1.2}>{queue.label}</Text>
                <Title order={3} c={queue.color}>{queue.items.length}</Title>
              </Card>
            ))}
          </SimpleGrid>

          <Stack gap="sm">
            {commandQueues.map((queue) => (
              <Card key={queue.key} withBorder radius="md" p="md">
                <Group justify="space-between" mb="sm" align="flex-start">
                  <div>
                    <Text fw={900}>{queue.label}</Text>
                    <Text size="xs" c="dimmed">{queue.description}</Text>
                  </div>
                  <Badge color={queue.color}>{queue.items.length}</Badge>
                </Group>
                {queue.items.length ? (
                  <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }} spacing="md">
                    {queue.items.map((item) => (
                      <Paper key={item.id} withBorder radius="md" p="sm">
                        <Text fw={900} size="sm" lh={1.25}>{item.label}</Text>
                        <Badge mt={6} size="xs" color={item.color || queue.color}>{item.stage}</Badge>
                        <Text size="xs" c="dimmed" mt={5}>{item.location}</Text>
                        <Text size="xs" c="dimmed">Owner: {item.owner}</Text>
                        <SimpleGrid cols={item.kind === "project" ? 2 : 1} spacing="xs" mt="sm">
                          <Button
                            fullWidth
                            size="xs"
                            color={queue.color}
                            variant="light"
                            onClick={() => {
                              if (item.kind === "visit") openVisitEditor(item.visit);
                              else if (item.kind === "quote") openLinkedQuote(item.visit);
                              else openProject(item.project);
                            }}
                          >
                            {item.kind === "visit" ? "Open Request" : item.kind === "quote" ? "Open Quote" : "Open Project"}
                          </Button>
                          {item.kind === "project" && (
                            <Button
                              fullWidth
                              size="xs"
                              color="green"
                              leftSection={<IconCircleCheck size={14} />}
                              loading={completingProjectId === item.project.id}
                              onClick={() => completeProject(item.project)}
                            >
                              Quick Complete
                            </Button>
                          )}
                        </SimpleGrid>
                      </Paper>
                    ))}
                  </SimpleGrid>
                ) : (
                  <Text size="sm" c="dimmed">No work is currently in this section.</Text>
                )}
              </Card>
            ))}
          </Stack>
        </MWPanel>
      )}

      {workspaceView === "legacy-board" && (
        <MWPanel
          title="Outside Operations Board"
          subtitle="Choose one part of the workflow to see the work that needs attention without scrolling through every stage."
          icon={IconClipboardCheck}
        >
          <Group mb="lg" wrap="wrap">
            <TextInput
              style={{ flex: 1, minWidth: 280 }}
              placeholder="Search projects, customers, owners, addresses, or next actions..."
              leftSection={<IconSearch size={17} />}
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
            />
            <Button variant="light" color="gray" leftSection={refreshing ? <Loader size={16} /> : <IconRefresh size={17} />} disabled={refreshing} onClick={() => loadProjects(false)}>Refresh</Button>
          </Group>

          <SimpleGrid cols={{ base: 1, sm: 2, xl: 4 }} spacing="sm" mb="xl">
            {OUTSIDE_WORKSPACES.map((workspace) => {
              const active = workspace.key === activeWorkspace;
              return <Paper
                key={workspace.key}
                role="button"
                tabIndex={0}
                p="md"
                radius="lg"
                withBorder
                onClick={() => setActiveWorkspace(workspace.key)}
                onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setActiveWorkspace(workspace.key); }}
                style={{ cursor: "pointer", borderColor: active ? `var(--mantine-color-${workspace.color}-6)` : undefined, background: active ? `var(--mantine-color-${workspace.color}-light)` : "rgba(255,255,255,.02)" }}
              >
                <Group justify="space-between" wrap="nowrap">
                  <div>
                    <Text fw={900}>{workspace.label}</Text>
                    <Text size="xs" c="dimmed">{workspace.description}</Text>
                  </div>
                  <Badge color={workspace.color} variant={active ? "filled" : "light"} size="lg">{workspaceCounts[workspace.key] || 0}</Badge>
                </Group>
              </Paper>;
            })}
          </SimpleGrid>

          <Group justify="space-between" mb="md" align="flex-end">
            <div>
              <Title order={3}>{selectedWorkspace.label}</Title>
              <Text size="sm" c="dimmed">{selectedWorkspace.description}</Text>
            </div>
            {selectedWorkspace.key === "estimates" && <Button color="red" onClick={() => setPage("quoteCenter")}>Open Site Visit Tracker</Button>}
          </Group>

          {selectedWorkspace.key === "estimates" && activeSiteVisits.length > 0 && (
            <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }} spacing="md" mb="lg">
              {activeSiteVisits.map((visit) => {
                const files = visitFilesById[visit.id] || [];
                const nextAction = visit.status === "Completed" ? "Create the formal quote" : visit.requested_visit_date ? "Complete the site visit" : "Schedule the site visit";
                return <Card key={visit.id} withBorder p="md" radius="lg" style={{ borderLeft: `5px solid ${visit.status === "Completed" ? "#2f9e44" : "#f59f00"}` }}>
                <Stack gap="xs">
                  <Group justify="space-between"><Badge color={visit.status === "Completed" ? "green" : visit.requested_visit_date ? "blue" : "orange"}>{visit.status === "Completed" ? "Visit Completed" : visit.requested_visit_date ? "Scheduled Estimate" : "Needs Scheduling"}</Badge><Badge color="cyan" variant="light">Pre-Quote</Badge></Group>
                  <Text fw={900}>{visit.customer_name || "Potential Customer"}</Text>
                  <Text size="sm">{visit.job_site_address || "Address not entered"}</Text>
                  <Text size="sm" c="dimmed">Assigned: {visit.assigned_estimator || "Unassigned"}</Text>
                  <Text size="sm" c="dimmed">Visit: {formatDate(visit.requested_visit_date)}{visit.requested_visit_time ? ` at ${String(visit.requested_visit_time).slice(0, 5)}` : ""}</Text>
                  {(visit.contact_phone || visit.contact_email) && <Text size="xs" c="dimmed">{[visit.contact_phone, visit.contact_email].filter(Boolean).join(" · ")}</Text>}
                  <Group gap="xs"><Badge color={files.length ? "green" : "gray"} variant="light">{files.length} file{files.length === 1 ? "" : "s"}</Badge><Badge color="gray" variant="light">Updated {formatDate(visit.updated_at)}</Badge></Group>
                  <Text size="sm" fw={800}>Next: {nextAction}</Text>
                  <Stack gap={8} mt={4}>
                    <Button fullWidth variant="light" color="cyan" onClick={() => openVisitEditor(visit)}>{visit.requested_visit_date ? "Open / Edit Estimate" : "Schedule Site Visit"}</Button>
                    <SimpleGrid cols={2} spacing={8}>
                      <Button size="xs" variant="default" leftSection={<IconMapPin size={15} />} disabled={!visit.job_site_address} onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(visit.job_site_address)}`, "_blank", "noopener,noreferrer")}>Maps</Button>
                      <Button size="xs" variant="default" leftSection={<IconPrinter size={15} />} onClick={() => printSiteVisit(visit)}>Print Sheet</Button>
                      {visit.contact_phone && <Button size="xs" variant="default" leftSection={<IconPhone size={15} />} component="a" href={`tel:${visit.contact_phone}`}>Call</Button>}
                      {visit.contact_email && <Button size="xs" variant="default" leftSection={<IconMail size={15} />} component="a" href={`mailto:${visit.contact_email}`}>Email</Button>}
                    </SimpleGrid>
                    {visit.status !== "Completed" && <Button fullWidth color="green" onClick={() => openVisitEditor(visit)}>Complete Site Visit</Button>}
                    <Button fullWidth color="blue" loading={advancingVisitId === visit.id} onClick={() => moveVisitToQuote(visit)}>{visit.status === "Completed" ? "Create Quote" : "Move to Quote"}</Button>
                    {isAdministrator && <Button fullWidth variant="light" color="orange" onClick={() => { setBypassVisit(visit); setBypassReason(""); }}>Skip Quote &amp; Approval</Button>}
                  </Stack>
                </Stack>
              </Card>;
              })}
            </SimpleGrid>
          )}

          {selectedWorkspace.key === "approvals" && linkedQuoteVisits.length > 0 && (
            <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }} spacing="md" mb="lg">
              {linkedQuoteVisits.map((visit) => {
                const quote = quotesById[visit.quote_id];
                const approval = approvalsByQuote[visit.quote_id];
                const approved = quote?.status === "Approved" || approval?.status === "Approved";
                return <Card key={visit.id} withBorder p="md" radius="lg" style={{ borderLeft: `5px solid ${approved ? "#2f9e44" : "#7950f2"}` }}>
                  <Stack gap="xs">
                    <Group justify="space-between">
                      <Badge color={quote?.status === "Draft" ? "gray" : quote?.status === "Sent" ? "blue" : approved ? "green" : "orange"}>Quote: {quote?.status || "Not Started"}</Badge>
                      <Badge color={approved ? "green" : approval?.status === "Changes Requested" ? "red" : "orange"}>Approval: {approved ? "Approved" : approval?.status || "Not Sent"}</Badge>
                    </Group>
                    <Text fw={900}>{visit.customer_name || quote?.customer_name || "Potential Customer"}</Text>
                    <Text size="sm" c="dimmed">{quote?.quote_number || "Quote number pending"}</Text>
                    <Text size="sm">{visit.job_site_address || quote?.job_site_address || "Address not entered"}</Text>
                    <Text size="sm" fw={800}>{approved ? "Ready to release into production" : quote?.status === "Draft" ? "Complete pricing and send the quote" : "Waiting for customer approval"}</Text>
                    <Stack gap={8} mt={4}>
                      <Button fullWidth variant="light" color="violet" onClick={() => openLinkedQuote(visit)}>Open Quote</Button>
                      {approved && <Button fullWidth color="green" loading={advancingVisitId === visit.id} onClick={() => releaseApprovedQuote(visit)}>Release to Production</Button>}
                      {isAdministrator && !approved && <Button fullWidth variant="subtle" color="orange" onClick={() => { setBypassVisit(visit); setBypassReason(""); }}>Skip Quote &amp; Approval</Button>}
                    </Stack>
                  </Stack>
                </Card>;
              })}
            </SimpleGrid>
          )}

          {selectedWorkspaceProjects.length > 0 && (
            <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }} spacing="md">
              {selectedWorkspaceProjects.map((project) => {
                const customer = customers[project.customer_id];
                const tracking = trackingByProject[project.id] || {};
                const approvalStatus = tracking.latestApproval?.status || project.approval_status;
                const operationalProject = approvalStatus === "Approved" ? { ...project, approval_status: "Approved", quote_status: "Approved" } : project;
                const phase = getOutsidePhase(operationalProject);
                const nextDate = getOutsideNextDate(project);
                const needsAttention = tracking.blocked > 0 || tracking.latestUpdate?.leadership_attention_required;
                const updateAge = updateAgeLabel(tracking.latestUpdate);
                return <Card key={project.id} withBorder p="md" radius="lg" onClick={() => openProject(project)} style={{ cursor: "pointer", borderColor: needsAttention ? "var(--mantine-color-red-6)" : undefined }}>
                  <Stack gap="xs">
                    <Group justify="space-between" align="flex-start"><Badge color={phase.color}>{phase.label}</Badge>{project.priority === "Rush" && <Badge color="red">Rush</Badge>}</Group>
                    <Text fw={900}>{getProjectIdentity(project, customer)}</Text>
                    <Text size="sm" c="dimmed">Owner: {project.assigned_to || project.intake_owner || "Unassigned"}</Text>
                    <Text size="sm" fw={800}>{project.next_action || getSuggestedNextAction(operationalProject)}</Text>
                    <Text size="xs" c="dimmed">Next date: {formatDate(nextDate)}</Text>
                    <Card withBorder radius="md" p="xs" bg="rgba(255,255,255,.025)">
                      <Group justify="space-between" gap="xs" mb={4}>
                        <Text size="xs" fw={800}>Latest Update</Text>
                        <Badge size="xs" color={updateAge.color}>{updateAge.label}</Badge>
                      </Group>
                      <Text size="xs" c="dimmed" lineClamp={2}>
                        {tracking.latestUpdate?.work_in_progress || tracking.latestUpdate?.next_steps || tracking.latestUpdate?.work_completed || "No project update has been entered."}
                      </Text>
                    </Card>
                    <Group gap="xs">
                      {needsAttention && <Badge color="red">Attention</Badge>}
                      {phase.key === "quote_approval" && <Badge color={approvalStatus === "Approved" ? "green" : "gray"}>Approval: {approvalStatus || "Pending"}</Badge>}
                      {project.down_payment_required && <Badge color={project.down_payment_status === "Received" ? "green" : "orange"}>Deposit</Badge>}
                      {Number(project.balance_due || 0) > 0 && <Badge color="yellow">{money(project.balance_due)} due</Badge>}
                    </Group>
                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs" mt={6}>
                      <Button
                        size="xs"
                        color="red"
                        onClick={(event) => {
                          event.stopPropagation();
                          openProject(project);
                        }}
                      >
                        Open Project
                      </Button>
                      <Button
                        size="xs"
                        variant="light"
                        color="blue"
                        leftSection={<IconNotes size={14} />}
                        onClick={(event) => {
                          event.stopPropagation();
                          openQuickUpdate(project);
                        }}
                      >
                        Update
                      </Button>
                      <Button
                        size="xs"
                        color="green"
                        leftSection={<IconCircleCheck size={14} />}
                        loading={completingProjectId === project.id}
                        style={{ gridColumn: "1 / -1" }}
                        onClick={(event) => {
                          event.stopPropagation();
                          completeProject(project);
                        }}
                      >
                        Mark Complete
                      </Button>
                      {isAdministrator && (
                        <Button
                          size="xs"
                          variant="light"
                          color="orange"
                          leftSection={<IconTrash size={14} />}
                          onClick={(event) => {
                            event.stopPropagation();
                            removeProject(project);
                          }}
                        >
                          Archive
                        </Button>
                      )}
                    </SimpleGrid>
                  </Stack>
                </Card>;
              })}
            </SimpleGrid>
          )}

          {!selectedWorkspaceProjects.length && !(selectedWorkspace.key === "estimates" && activeSiteVisits.length) && !(selectedWorkspace.key === "approvals" && linkedQuoteVisits.length) && (
            <Alert color="green">No active work is currently in {selectedWorkspace.label.toLowerCase()}.</Alert>
          )}
        </MWPanel>
      )}

      <Modal
        opened={Boolean(visitEditor)}
        onClose={() => setVisitEditor(null)}
        title={visitEditor ? `Estimate & Site Visit — ${visitEditor.customer_name}` : "Estimate & Site Visit"}
        size="xl"
        centered
        scrollAreaComponent={ScrollArea.Autosize}
      >
        <Stack gap="md">
          <Alert color={visitEditor?.status === "Completed" ? "green" : "blue"}>
            {visitEditor?.status === "Completed"
              ? "This site visit is complete and ready to become a formal quote."
              : "Save the scheduling and field information here. Required completion items are marked below."}
          </Alert>

          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput label="Customer / Job" required value={visitDraft.customer_name || ""} onChange={(event) => updateVisitDraft("customer_name", event.currentTarget.value)} />
            <TextInput label="Job-Site Address" required value={visitDraft.job_site_address || ""} onChange={(event) => updateVisitDraft("job_site_address", event.currentTarget.value)} />
            <TextInput label="Contact Name" value={visitDraft.contact_name || ""} onChange={(event) => updateVisitDraft("contact_name", event.currentTarget.value)} />
            <TextInput label="Contact Phone" value={visitDraft.contact_phone || ""} onChange={(event) => updateVisitDraft("contact_phone", event.currentTarget.value)} />
            <TextInput label="Contact Email" type="email" value={visitDraft.contact_email || ""} onChange={(event) => updateVisitDraft("contact_email", event.currentTarget.value)} />
            <TextInput label="Assigned Estimator" placeholder="Chad, Kory, etc." value={visitDraft.assigned_estimator || ""} onChange={(event) => updateVisitDraft("assigned_estimator", event.currentTarget.value)} />
            <TextInput label="Visit Date" type="date" value={visitDraft.requested_visit_date || ""} onChange={(event) => updateVisitDraft("requested_visit_date", event.currentTarget.value)} />
            <TextInput label="Visit Time" type="time" value={visitDraft.requested_visit_time || ""} onChange={(event) => updateVisitDraft("requested_visit_time", event.currentTarget.value)} />
          </SimpleGrid>

          <Group grow wrap="wrap">
            <Button variant="light" color="blue" leftSection={<IconMapPin size={17} />} disabled={!visitDraft.job_site_address} onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(visitDraft.job_site_address || "")}`, "_blank", "noopener,noreferrer")}>Open Google Maps</Button>
            {visitDraft.contact_phone && <Button variant="light" color="gray" leftSection={<IconPhone size={17} />} component="a" href={`tel:${visitDraft.contact_phone}`}>Call Customer</Button>}
            {visitDraft.contact_email && <Button variant="light" color="gray" leftSection={<IconMail size={17} />} component="a" href={`mailto:${visitDraft.contact_email}`}>Email Customer</Button>}
          </Group>

          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Textarea label="Access Instructions" minRows={3} value={visitDraft.access_instructions || ""} onChange={(event) => updateVisitDraft("access_instructions", event.currentTarget.value)} />
            <Textarea label="Site Conditions" minRows={3} value={visitDraft.site_conditions || ""} onChange={(event) => updateVisitDraft("site_conditions", event.currentTarget.value)} />
            <Textarea label="Estimate Notes *" description="Scope, customer request, installation concerns, and other field notes." minRows={4} value={visitDraft.notes || ""} onChange={(event) => updateVisitDraft("notes", event.currentTarget.value)} />
            <Textarea label="Measurements *" description="Enter all verified dimensions." minRows={4} value={visitDraft.measurements || ""} onChange={(event) => updateVisitDraft("measurements", event.currentTarget.value)} />
            <Textarea label="Labor Requirements *" description="Crew size, hours, equipment, or enter Not needed." minRows={3} value={visitDraft.labor_requirements || ""} onChange={(event) => updateVisitDraft("labor_requirements", event.currentTarget.value)} />
            <Textarea label="Material Requirements *" description="Material, quantity, finish, or enter Not needed." minRows={3} value={visitDraft.material_requirements || ""} onChange={(event) => updateVisitDraft("material_requirements", event.currentTarget.value)} />
            <Textarea label="Customer Decisions *" description="Choices, approvals, open questions, or enter None." minRows={3} value={visitDraft.customer_decisions || ""} onChange={(event) => updateVisitDraft("customer_decisions", event.currentTarget.value)} />
            <Textarea label="Recommended Next Step *" description="Example: Prepare formal quote, return for measurements, or close lead." minRows={3} value={visitDraft.recommended_next_step || ""} onChange={(event) => updateVisitDraft("recommended_next_step", event.currentTarget.value)} />
          </SimpleGrid>

          <Card withBorder radius="md" p="md">
            <Stack gap="sm">
              <Group justify="space-between" wrap="wrap">
                <div><Text fw={900}>Site Photos & Attachments *</Text><Text size="xs" c="dimmed">Photos, sketches, drawings, measurements, or reference documents.</Text></div>
                <FileButton onChange={uploadVisitFile} accept="image/jpeg,image/png,image/webp,application/pdf">
                  {(props) => <Button {...props} loading={uploadingVisitFile} leftSection={<IconUpload size={17} />}>Attach File</Button>}
                </FileButton>
              </Group>
              {(visitFilesById[visitEditor?.id] || []).length ? (
                <SimpleGrid cols={{ base: 1, sm: 2 }}>
                  {(visitFilesById[visitEditor?.id] || []).map((file) => <Button key={file.id} variant="default" justify="space-between" onClick={() => openVisitFile(file)}>{file.file_name}</Button>)}
                </SimpleGrid>
              ) : <Text size="sm" c="dimmed">No files attached yet.</Text>}
            </Stack>
          </Card>

          <Group justify="space-between" wrap="wrap">
            <Button variant="default" leftSection={<IconPrinter size={17} />} onClick={() => printSiteVisit({ ...visitEditor, ...visitDraft })}>Print Site-Visit Sheet</Button>
            <Group wrap="wrap">
              <Button variant="default" onClick={() => setVisitEditor(null)}>Close</Button>
              <Button color="blue" loading={savingVisit} onClick={() => saveVisitEditor(true)}>Save Estimate</Button>
              {visitEditor?.status !== "Completed" && <Button color="green" loading={savingVisit} onClick={completeVisit}>Complete Site Visit</Button>}
              {visitEditor?.status === "Completed" && <Button color="violet" loading={advancingVisitId === visitEditor.id} onClick={() => moveVisitToQuote(visitEditor)}>Create Quote</Button>}
            </Group>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={Boolean(bypassVisit)}
        onClose={() => { setBypassVisit(null); setBypassReason(""); }}
        title="Administrator Bypass to Production"
        centered
      >
        <Stack>
          <Alert color="orange" icon={<IconAlertTriangle size={18} />}>
            This skips the formal quote and customer-approval gates. The reason and administrator will be saved permanently with the project.
          </Alert>
          <Text fw={900}>{bypassVisit?.customer_name}</Text>
          <Textarea
            label="Required Bypass Reason"
            placeholder="Example: Internal company project, warranty correction, or management-authorized emergency work"
            minRows={4}
            required
            value={bypassReason}
            onChange={(event) => setBypassReason(event.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => { setBypassVisit(null); setBypassReason(""); }}>Cancel</Button>
            <Button color="orange" loading={advancingVisitId === bypassVisit?.id} onClick={bypassToProduction}>Bypass & Create Project</Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={Boolean(archiveTarget)}
        onClose={() => {
          if (!archivingProject) {
            setArchiveTarget(null);
            setArchiveReason("");
          }
        }}
        title="Archive Outside Project"
        centered
      >
        <Stack>
          <Alert color="orange" icon={<IconAlertTriangle size={18} />}>
            This removes the project from active boards and calendars. It does
            not delete the project, quotes, payments, files, or history.
          </Alert>
          <Text fw={900}>
            {archiveTarget?.project_name || archiveTarget?.project_number}
          </Text>
          <Textarea
            label="Reason for archiving"
            description="Required and saved with the project record."
            placeholder="Example: Customer never responded after estimate follow-ups."
            minRows={4}
            required
            value={archiveReason}
            onChange={(event) => setArchiveReason(event.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button variant="default" disabled={archivingProject} onClick={() => setArchiveTarget(null)}>
              Keep Active
            </Button>
            <Button color="orange" loading={archivingProject} disabled={!archiveReason.trim()} onClick={confirmArchiveProject}>
              Archive Project
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={Boolean(updateTarget)}
        onClose={() => !savingQuickUpdate && setUpdateTarget(null)}
        title="Add Today’s Project Update"
        centered
        size="lg"
      >
        <Stack>
          <Text fw={900}>{updateTarget?.project_name || updateTarget?.project_number}</Text>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Select label="Overall Status" allowDeselect={false} value={quickUpdate.status} data={["On Track", "At Risk", "Blocked", "Complete"]} onChange={(value) => setQuickUpdate((current) => ({ ...current, status: value || "On Track" }))} />
            <Checkbox mt={30} label="Leadership attention required" checked={quickUpdate.leadership_attention_required} onChange={(event) => setQuickUpdate((current) => ({ ...current, leadership_attention_required: event.currentTarget.checked }))} />
            <Textarea label="Completed Today" minRows={3} value={quickUpdate.work_completed} onChange={(event) => setQuickUpdate((current) => ({ ...current, work_completed: event.currentTarget.value }))} />
            <Textarea label="Currently In Progress" minRows={3} value={quickUpdate.work_in_progress} onChange={(event) => setQuickUpdate((current) => ({ ...current, work_in_progress: event.currentTarget.value }))} />
            <Textarea label="Next Steps" minRows={3} value={quickUpdate.next_steps} onChange={(event) => setQuickUpdate((current) => ({ ...current, next_steps: event.currentTarget.value }))} />
            <Textarea label="Blockers" minRows={3} value={quickUpdate.blockers} onChange={(event) => setQuickUpdate((current) => ({ ...current, blockers: event.currentTarget.value }))} />
          </SimpleGrid>
          <Group justify="flex-end">
            <Button variant="default" disabled={savingQuickUpdate} onClick={() => setUpdateTarget(null)}>Cancel</Button>
            <Button color="red" loading={savingQuickUpdate} onClick={saveQuickProjectUpdate}>Save Today’s Update</Button>
          </Group>
        </Stack>
      </Modal>

      {errorMessage && (
        <Alert
          color="red"
          icon={<IconAlertTriangle size={18} />}
          title="Projects Failed to Load"
        >
          {errorMessage}
        </Alert>
      )}

      {(workspaceView === "list" || workspaceView === "completed" || workspaceView === "archived") && <MWPanel
        title={viewMode === "completed" ? "Completed Project Library" : viewMode === "archived" ? "Archived Project Library" : "Project Tracker"}
        subtitle={
          viewMode === "completed"
            ? `${filteredProjects.length} of ${completedProjects.length} completed project packages shown`
            : viewMode === "archived"
              ? `${filteredProjects.length} of ${archivedProjects.length} archived projects shown`
            : `${filteredProjects.length} of ${projects.length} active projects shown`
        }
        icon={IconTool}
      >
        <Group mb="lg" wrap="wrap">
          <TextInput
            style={{ flex: 1, minWidth: 280 }}
            placeholder="Search person, project, company, owner, status, address, or next action..."
            leftSection={<IconSearch size={17} />}
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
          />
          <Button
            variant="light"
            color="gray"
            leftSection={
              refreshing ? <Loader size={16} /> : <IconRefresh size={17} />
            }
            disabled={refreshing}
            onClick={() => loadProjects(false)}
          >
            Refresh
          </Button>
        </Group>

        {!filteredProjects.length ? (
          <Alert color="gray" icon={<IconTool size={18} />}>
            No {viewMode === "completed" ? "completed project packages" : viewMode === "archived" ? "archived projects" : "active projects"} match the current search.
          </Alert>
        ) : (
          <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }} spacing="lg">
            {filteredProjects.map((project) => {
              const customer = customers[project.customer_id];
              const person = getProjectPerson(project, customer);
              const company = getProjectCompany(
                project,
                customer,
                person
              );
              const requirements = [
                project.site_visit_required && "Site Visit",
                project.measurements_required && "Measurements",
                project.quote_required && "Quote",
                project.fabrication_required && "Fabrication",
                project.test_fit_required && "Test Fit",
                project.finish_required && "Finish",
                project.install_required && "Install",
              ].filter(Boolean);
              const tracking = trackingByProject[project.id] || {
                tasks: 0,
                applicable: 0,
                complete: 0,
                blocked: 0,
                latestUpdate: null,
              };
              const checklistPercent = tracking.applicable
                ? Math.round((tracking.complete / tracking.applicable) * 100)
                : 0;
              const latestUpdate = tracking.latestUpdate;

              return (
                <Paper
                  key={project.id}
                  p="lg"
                  radius="lg"
                  style={{
                    background:
                      project.priority === "Rush"
                        ? "linear-gradient(145deg, rgba(120,0,10,.2), rgba(255,255,255,.025))"
                        : "rgba(255,255,255,.025)",
                    border: `1px solid ${
                      project.priority === "Rush"
                        ? "rgba(255,55,65,.5)"
                        : "rgba(255,255,255,.08)"
                    }`,
                  }}
                >
                  <Stack gap="md">
                    <Group justify="space-between" align="flex-start">
                      <Group gap="xs" wrap="wrap">
                        <Badge
                          color={getStatusColor(project.status)}
                          variant="light"
                        >
                          {project.status || "New"}
                        </Badge>
                        <Badge color={getPriorityColor(project.priority)}>
                          {project.priority || "Normal"}
                        </Badge>
                      </Group>

                      <ThemeIcon color="red" variant="light" radius="md">
                        <IconTool size={19} />
                      </ThemeIcon>
                    </Group>

                    <Box>
                      <Title
                        order={3}
                        c="white"
                        style={{
                          lineHeight: 1.25,
                          overflowWrap: "anywhere",
                        }}
                      >
                        {getProjectIdentity(project, customer)}
                      </Title>
                      {company && (
                        <Text fw={700} c="gray.3" mt={5}>
                          {company}
                        </Text>
                      )}
                      <Text size="sm" c="dimmed" mt={3}>
                        {project.project_number || "No project number"}
                      </Text>
                    </Box>

                    <Paper
                      p="sm"
                      radius="md"
                      style={{
                        background: "rgba(0,0,0,.2)",
                        border: "1px solid rgba(255,255,255,.06)",
                      }}
                    >
                      <Stack gap="xs">
                        <Group justify="space-between" wrap="nowrap">
                          <Text size="sm" c="dimmed">
                            Owner
                          </Text>
                          <Text size="sm" fw={750} ta="right">
                            {project.assigned_to ||
                              project.intake_owner ||
                              "Unassigned"}
                          </Text>
                        </Group>
                        <Group justify="space-between" wrap="nowrap">
                          <Text size="sm" c="dimmed">
                            Location
                          </Text>
                          <Text size="sm" fw={750} ta="right">
                            {project.work_location ||
                              project.job_address ||
                              "Not set"}
                          </Text>
                        </Group>
                        <Group justify="space-between" wrap="nowrap">
                          <Text size="sm" c="dimmed">
                            Due
                          </Text>
                          <Text size="sm" fw={750} ta="right">
                            {formatDate(
                              project.due_date ||
                                project.target_completion_date
                            )}
                          </Text>
                        </Group>
                      </Stack>
                    </Paper>

                    <Paper
                      p="sm"
                      radius="md"
                      style={{
                        background: "rgba(120,0,12,.1)",
                        border: "1px solid rgba(255,50,65,.18)",
                      }}
                    >
                      <Text size="xs" fw={850} c="dimmed" tt="uppercase">
                        Next Action
                      </Text>
                      <Text fw={800} c="white">
                        {project.next_action || "Review project status"}
                      </Text>
                    </Paper>

                    <Paper
                      p="sm"
                      radius="md"
                      style={{
                        background: "rgba(0,0,0,.2)",
                        border:
                          tracking.blocked > 0 ||
                          latestUpdate?.leadership_attention_required
                            ? "1px solid rgba(255,70,75,.55)"
                            : "1px solid rgba(255,255,255,.06)",
                      }}
                    >
                      <Group justify="space-between" mb={6}>
                        <Group gap={6}>
                          <IconClipboardCheck size={16} />
                          <Text size="sm" fw={800}>
                            Checklist
                          </Text>
                        </Group>
                        <Text size="sm" fw={800}>
                          {tracking.tasks
                            ? `${tracking.complete}/${tracking.applicable}`
                            : "Not started"}
                        </Text>
                      </Group>
                      <Progress
                        value={checklistPercent}
                        color={tracking.blocked ? "red" : "green"}
                        size="sm"
                        radius="xl"
                      />
                      <Group gap="xs" mt="sm" wrap="wrap">
                        {tracking.blocked > 0 && (
                          <Badge color="red" variant="filled">
                            {tracking.blocked} Blocked
                          </Badge>
                        )}
                        {latestUpdate ? (
                          <Badge
                            color={
                              latestUpdate.status === "Blocked"
                                ? "red"
                                : latestUpdate.status === "At Risk"
                                  ? "orange"
                                  : "green"
                            }
                            variant="light"
                          >
                            {latestUpdate.status} · Updated{" "}
                            {formatDate(latestUpdate.update_date)}
                          </Badge>
                        ) : (
                          <Badge color="gray" variant="light">
                            No daily update
                          </Badge>
                        )}
                        {latestUpdate?.leadership_attention_required && (
                          <Badge color="red" variant="filled">
                            Leadership Attention
                          </Badge>
                        )}
                      </Group>
                    </Paper>

                    <Group gap="xs" wrap="wrap">
                      {requirements.length ? (
                        requirements.map((requirement) => (
                          <Badge
                            key={requirement}
                            color="gray"
                            variant="light"
                          >
                            {requirement}
                          </Badge>
                        ))
                      ) : (
                        <Badge color="gray" variant="light">
                          No workflow flags
                        </Badge>
                      )}
                    </Group>

                    <Stack gap="xs">
                      <Button
                        fullWidth
                        color="red"
                        rightSection={<IconArrowRight size={17} />}
                        onClick={() => openProject(project)}
                      >
                        {viewMode === "completed" ? "Open Project Package" : "Open Project"}
                      </Button>
                      {viewMode === "completed" ? (
                        <Button
                          fullWidth
                          variant="light"
                          color="blue"
                          leftSection={<IconPackage size={17} />}
                          onClick={() => {
                            setSelectedProject({ ...project, initialTab: "package" });
                            setPage("projectDetails");
                          }}
                        >
                          Files & Reuse Checklist
                        </Button>
                      ) : (
                        <Button
                          fullWidth
                          variant="light"
                          color="blue"
                          leftSection={<IconClipboardCheck size={17} />}
                          onClick={() => openProjectChecklist(project)}
                        >
                          Checklist & Updates
                        </Button>
                      )}
                      {viewMode !== "archived" && <Button
                        fullWidth
                        variant="light"
                        color="gray"
                        onClick={() => editProject(project)}
                      >
                        Edit Project
                      </Button>}
                      {viewMode === "archived" && isAdministrator && (
                        <Button
                          fullWidth
                          color="green"
                          leftSection={<IconRotateClockwise size={17} />}
                          loading={restoringProjectId === project.id}
                          onClick={() => restoreArchivedProject(project)}
                        >
                          Restore Project
                        </Button>
                      )}
                      {viewMode !== "archived" && (project.status === "Completed" ? (
                        <Button
                          fullWidth
                          variant="light"
                          color="green"
                          leftSection={<IconRotateClockwise size={17} />}
                          onClick={() => reopenProject(project)}
                        >
                          Reopen Project
                        </Button>
                      ) : (
                        <Button
                          fullWidth
                          variant="light"
                          color="green"
                          leftSection={<IconCircleCheck size={17} />}
                          onClick={() => completeProject(project)}
                        >
                          Mark Complete
                        </Button>
                      ))}
                      {isAdministrator && viewMode !== "archived" && <Button
                        fullWidth
                        variant="subtle"
                        color="red"
                        leftSection={<IconTrash size={17} />}
                        onClick={() => removeProject(project)}
                      >
                        Archive Project
                      </Button>}
                    </Stack>
                  </Stack>
                </Paper>
              );
            })}
          </SimpleGrid>
        )}
      </MWPanel>}
    </Stack>
  );
}

export default Projects;
