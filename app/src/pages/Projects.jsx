import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Group,
  Loader,
  Modal,
  Paper,
  Progress,
  SegmentedControl,
  SimpleGrid,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from "@mantine/core";
import {
  IconAlertTriangle,
  IconArrowRight,
  IconClipboardCheck,
  IconCircleCheck,
  IconCalendarEvent,
  IconChevronLeft,
  IconChevronRight,
  IconMapPin,
  IconPackage,
  IconPrinter,
  IconRefresh,
  IconRotateClockwise,
  IconSearch,
  IconTool,
  IconTrash,
  IconTruckDelivery,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import MWKpiStrip from "../components/ui/MWKpiStrip";
import MWPageHeader from "../components/ui/MWPageHeader";
import MWPanel from "../components/ui/MWPanel";
import { supabase } from "../lib/supabase";
import { addDays, buildMonthGrid, dateKey, firstOfMonth, moveMonth } from "../lib/calendar";
import companyLogo from "../assets/metal-worx-official-transparent.png";

const CALENDAR_TYPES = [
  { label: "Railings & Handrails", color: "#1677c8", terms: ["rail", "handrail"] },
  { label: "Gates & Fences", color: "#2f9e44", terms: ["gate", "fence"] },
  { label: "Repair & Restoration", color: "#e67700", terms: ["repair", "restore", "restoration"] },
  { label: "Custom Fabrication", color: "#7950f2", terms: ["fabrication", "custom", "prototype", "container", "trailer"] },
  { label: "Install & Field Work", color: "#0ca6a6", terms: ["install", "field", "site"] },
  { label: "Other Project", color: "#66717a", terms: [] },
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
  if (status === "In Progress") return "blue";
  if (status === "On Hold") return "orange";
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

function Projects({ setPage, setSelectedProject }) {
  const [projects, setProjects] = useState([]);
  const [completedProjects, setCompletedProjects] = useState([]);
  const [viewMode, setViewMode] = useState("active");
  const [customers, setCustomers] = useState({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [trackingByProject, setTrackingByProject] = useState({});
  const [calendarMonth, setCalendarMonth] = useState(() => firstOfMonth());
  const [selectedCalendarDay, setSelectedCalendarDay] = useState(null);

  const loadProjects = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    else setRefreshing(true);

    setErrorMessage("");

    try {
      const [projectResult, customerResult] = await Promise.all([
        supabase
          .from("projects")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase.from("customers").select("*"),
      ]);

      if (projectResult.error) throw projectResult.error;
      if (customerResult.error) throw customerResult.error;

      const allProjects = projectResult.data || [];
      const loadedProjects = allProjects.filter(
        (project) => project.is_active === true && !["Completed", "Cancelled"].includes(project.status)
      );
      const loadedCompletedProjects = allProjects.filter(
        (project) => project.status === "Completed"
      );
      const trackedProjects = [...loadedProjects, ...loadedCompletedProjects];
      const projectIds = trackedProjects.map((project) => project.id);
      let checklistRows = [];
      let updateRows = [];

      if (projectIds.length) {
        const [checklistResult, updateResult] = await Promise.all([
          supabase
            .from("project_checklist_items")
            .select("project_id, status")
            .in("project_id", projectIds),
          supabase
            .from("project_daily_updates")
            .select(
              "project_id, update_date, status, leadership_attention_required, created_at"
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

      setProjects(loadedProjects);
      setCompletedProjects(loadedCompletedProjects);
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
    const source = viewMode === "completed" ? completedProjects : projects;
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
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [completedProjects, customers, projects, search, viewMode]);

  const siteVisitCount = projects.filter(
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

  const scheduledProjects = projects.filter(
    (project) => project.planned_start_date && project.planned_duration_days
  );
  const calendarDays = useMemo(() => {
    return buildMonthGrid(calendarMonth);
  }, [calendarMonth]);
  const scheduledProjectsByDay = useMemo(() => {
    const result = {};
    scheduledProjects.forEach((project) => {
      const startDate = addDays(project.planned_start_date, 0);
      const duration = Math.max(Number(project.planned_duration_days || 1), 1);
      for (let index = 0; index < duration; index += 1) {
        const key = dateKey(addDays(dateKey(startDate), index));
        if (!result[key]) result[key] = [];
        result[key].push(project);
      }
    });
    return result;
  }, [scheduledProjects]);

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
    if (error) {
      setErrorMessage(error.message || "The project could not be completed.");
      return;
    }
    await loadProjects();
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
    if (!window.confirm(`Delete/archive "${project.project_name || project.project_number}"? Linked business records will be preserved.`)) return;
    try {
      const linkedTables = [
        "project_quotes",
        "project_material_requests",
        "project_payments",
        "project_checklist_items",
        "project_daily_updates",
      ];
      const counts = await Promise.all(
        linkedTables.map((table) =>
          supabase.from(table).select("id", { count: "exact", head: true }).eq("project_id", project.id)
        )
      );
      const failedCount = counts.find((result) => result.error);
      if (failedCount?.error) throw failedCount.error;
      const hasHistory = counts.some((result) => Number(result.count || 0) > 0);

      if (hasHistory) {
        const { error } = await supabase
          .from("projects")
          .update({
            is_active: false,
            status: project.status === "Completed" ? "Completed" : "Cancelled",
            next_action: "Archived",
          })
          .eq("id", project.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("projects").delete().eq("id", project.id);
        if (error) throw error;
      }
      await loadProjects();
    } catch (error) {
      setErrorMessage(error.message || "The project could not be removed.");
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
          <Text size="xs" c="dimmed">Click a project to open it</Text>
        </Group>
        <Group gap="md" mb="md" wrap="wrap">
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
                  const dayProjects = scheduledProjectsByDay[key] || [];
                  const today = key === dateKey(new Date());
                  const weekend = day.getDay() === 0 || day.getDay() === 6;
                  const outside = day.getMonth() !== calendarMonth.getMonth();
                  return <div key={key} role="button" tabIndex={0} className={`mw-month-day ${weekend ? "weekend" : ""} ${today ? "today" : ""} ${outside ? "outside" : ""}`} onClick={() => setSelectedCalendarDay(day)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelectedCalendarDay(day); }}>
                    <div className="mw-month-day-head"><span className="mw-month-day-number">{day.getDate()}</span><span className="mw-month-load">{dayProjects.length ? `${dayProjects.length} project${dayProjects.length === 1 ? "" : "s"}` : "Open"}</span></div>
                    {dayProjects.map((project) => {
                      const calendarType = getCalendarType(project);
                      return <button key={project.id} type="button" className={`mw-month-project ${project.priority === "Rush" ? "rush" : ""}`} style={{borderLeftColor:calendarType.color}} title={`${project.project_name || project.project_number} — ${project.assigned_to || "Unassigned lead"}`} onClick={(event) => { event.stopPropagation(); openProject(project); }}><strong>{project.project_name || project.project_number}</strong><span>{project.assigned_to || "Unassigned lead"}</span></button>;
                    })}
                  </div>;
                })}
              </div>
            </div>
          </ScrollArea>
        {!scheduledProjects.length && <Alert color="blue" mt="md">No projects are scheduled yet. Every day is currently open. Add a planned start date and estimated workdays in Edit Project.</Alert>}
      </MWPanel>

      <Modal
        opened={Boolean(selectedCalendarDay)}
        onClose={() => setSelectedCalendarDay(null)}
        title={selectedCalendarDay ? selectedCalendarDay.toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric", year:"numeric" }) : "Scheduled Work"}
        size="lg"
        centered
      >
        <Stack gap="sm">
          {selectedCalendarDay && (scheduledProjectsByDay[dateKey(selectedCalendarDay)] || []).length ? (
            (scheduledProjectsByDay[dateKey(selectedCalendarDay)] || []).map((project) => {
              const calendarType = getCalendarType(project);
              return <Card key={project.id} withBorder radius="md" p="md" style={{ borderLeft:`6px solid ${calendarType.color}` }}>
                <Group justify="space-between" align="flex-start" wrap="wrap">
                  <Stack gap={3} style={{ flex:1 }}>
                    <Group gap="xs"><Text fw={900}>{project.project_name || project.project_number}</Text>{project.priority === "Rush" && <Badge color="red">Rush</Badge>}</Group>
                    <Text size="sm">Lead: {project.assigned_to || "Unassigned"}</Text>
                    <Text size="xs" c="dimmed">{calendarType.label} · Starts {formatDate(project.planned_start_date)} · {Number(project.planned_duration_days || 1)} workday{Number(project.planned_duration_days || 1) === 1 ? "" : "s"}</Text>
                  </Stack>
                  <Button size="xs" onClick={() => openProject(project)}>Open Project</Button>
                </Group>
              </Card>;
            })
          ) : (
            <Alert color="green" title="Available Day">No projects are scheduled on this date.</Alert>
          )}
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

      <MWPanel
        title={viewMode === "completed" ? "Completed Project Library" : "Project Tracker"}
        subtitle={
          viewMode === "completed"
            ? `${filteredProjects.length} of ${completedProjects.length} completed project packages shown`
            : `${filteredProjects.length} of ${projects.length} active projects shown`
        }
        icon={IconTool}
      >
        <SegmentedControl
          mb="lg"
          fullWidth
          value={viewMode}
          onChange={setViewMode}
          data={[
            { label: `Active Projects (${projects.length})`, value: "active" },
            { label: `Completed Library (${completedProjects.length})`, value: "completed" },
          ]}
        />
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
            No {viewMode === "completed" ? "completed project packages" : "active projects"} match the current search.
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
                      <Button
                        fullWidth
                        variant="light"
                        color="gray"
                        onClick={() => editProject(project)}
                      >
                        Edit Project
                      </Button>
                      {project.status === "Completed" ? (
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
                      )}
                      <Button
                        fullWidth
                        variant="subtle"
                        color="red"
                        leftSection={<IconTrash size={17} />}
                        onClick={() => removeProject(project)}
                      >
                        Delete / Archive
                      </Button>
                    </Stack>
                  </Stack>
                </Paper>
              );
            })}
          </SimpleGrid>
        )}
      </MWPanel>
    </Stack>
  );
}

export default Projects;
