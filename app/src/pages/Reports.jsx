import { useEffect, useState } from "react";

import { notifications } from "@mantine/notifications";
import {
  Badge,
  Button,
  Card,
  Group,
  Modal,
  NumberInput,
  Progress,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  Title,
} from "@mantine/core";

import {
  IconAlertTriangle,
  IconArrowLeft,
  IconArrowRight,
  IconBuildingFactory2,
  IconCalendarStats,
  IconCash,
  IconClipboardList,
  IconDeviceFloppy,
  IconFileTypePdf,
  IconFolder,
  IconMinus,
  IconRefresh,
  IconTargetArrow,
  IconTrendingDown,
  IconTrendingUp,
  IconUser,
} from "@tabler/icons-react";

import MWPageHeader from "../components/ui/MWPageHeader";
import MWSection from "../components/ui/MWSection";

import {
  getReportsData,
  getWeeklyOperationsSummary,
  saveWeeklyOperationsGoals,
} from "../services/reportService";
import { exportReportsToPDF } from "../services/reportExportService";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "../lib/supabase";
import metalWorxLogo from "../assets/metal-worx-official-transparent.png";

function getMonday(value = new Date()) {
  const date = new Date(value);
  date.setHours(12, 0, 0, 0);
  const day = date.getDay();
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  return date;
}

function dateKey(value) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftDays(value, days) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

function numberValue(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

const artworkReadyStatuses = new Set([
  "waiting for customer pickup",
  "ready for pickup",
  "ready to ship",
  "completed — shipped",
  "completed — picked up",
]);

function artworkDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function artworkPercentile(values, percentile) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * percentile;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function artworkStats(values) {
  if (!values.length) return { n: 0, average: null, median: null, p75: null, min: null, max: null };
  return {
    n: values.length,
    average: values.reduce((sum, value) => sum + value, 0) / values.length,
    median: artworkPercentile(values, 0.5),
    p75: artworkPercentile(values, 0.75),
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

function sameDepartment(left, right) {
  return String(left || "").trim().toLowerCase() === String(right || "").trim().toLowerCase();
}

async function getArtworkTurnaroundReport(days = 30) {
  const endExclusive = new Date();
  endExclusive.setHours(0, 0, 0, 0);
  endExclusive.setDate(endExclusive.getDate() + 1);
  const start = new Date(endExclusive);
  start.setDate(start.getDate() - days);
  const end = new Date(endExclusive);
  end.setDate(end.getDate() - 1);

  const { data: orders = [], error: ordersError } = await supabase
    .from("customer_orders")
    .select("id, created_at, starting_department, order_type")
    .eq("order_type", "Custom Artwork")
    .gte("created_at", start.toISOString())
    .lt("created_at", endExclusive.toISOString());
  if (ordersError) throw ordersError;

  const orderIds = orders.map((order) => order.id).filter(Boolean);
  if (!orderIds.length) {
    return {
      days,
      periodStart: artworkDateKey(start),
      periodEnd: artworkDateKey(end),
      orderCount: 0,
      readyCount: 0,
      coveragePercent: 0,
      turnaround: artworkStats([]),
      stages: [],
    };
  }

  const { data: jobs = [], error: jobsError } = await supabase
    .from("production_jobs")
    .select("id, customer_order_id, current_department")
    .in("customer_order_id", orderIds);
  if (jobsError) throw jobsError;

  const jobIds = jobs.map((job) => job.id).filter(Boolean);
  const { data: activities = [], error: activityError } = jobIds.length
    ? await supabase
        .from("work_order_activity")
        .select("id, production_job_id, created_at, from_department, to_department, to_status")
        .in("production_job_id", jobIds)
        .order("created_at", { ascending: true })
    : { data: [], error: null };
  if (activityError) throw activityError;

  const orderById = new Map(orders.map((order) => [String(order.id), order]));
  const firstReadyByOrder = new Map();
  const firstReadyByJob = new Map();
  const activitiesByJob = new Map();
  for (const activity of activities) {
    const key = String(activity.production_job_id);
    const job = jobs.find((candidate) => String(candidate.id) === key);
    const order = job && orderById.get(String(job.customer_order_id));
    const occurredAt = new Date(activity.created_at);
    if (order && occurredAt < endExclusive) {
      const status = String(activity.to_status || "").trim().toLowerCase();
      const isReady = artworkReadyStatuses.has(status) ||
        (status.includes("completed") && status.includes("shipped"));
      if (isReady && occurredAt >= new Date(order.created_at)) {
        const orderKey = String(order.id);
        const jobKey = String(activity.production_job_id);
        const priorOrderReady = firstReadyByOrder.get(orderKey);
        const priorJobReady = firstReadyByJob.get(jobKey);
        if (!priorOrderReady || occurredAt < priorOrderReady) firstReadyByOrder.set(orderKey, occurredAt);
        if (!priorJobReady || occurredAt < priorJobReady) firstReadyByJob.set(jobKey, occurredAt);
      }
    }
    if (!activitiesByJob.has(key)) activitiesByJob.set(key, []);
    activitiesByJob.get(key).push(activity);
  }

  const turnaroundDays = [];
  for (const [orderId, readyAt] of firstReadyByOrder) {
    const order = orderById.get(orderId);
    const elapsed = (readyAt - new Date(order.created_at)) / 86400000;
    if (elapsed >= 0) turnaroundDays.push(elapsed);
  }

  const intervalsByStage = new Map();
  const addInterval = (stage, startAt, endAt) => {
    const label = String(stage || "").trim().replace(/\s*\/\s*/g, " / ");
    const duration = (new Date(endAt) - new Date(startAt)) / 86400000;
    if (!label || !Number.isFinite(duration) || duration <= 0) return;
    if (!intervalsByStage.has(label)) intervalsByStage.set(label, []);
    intervalsByStage.get(label).push(duration);
  };

  for (const job of jobs) {
    const order = orderById.get(String(job.customer_order_id));
    const events = (activitiesByJob.get(String(job.id)) || []).slice().sort(
      (a, b) => new Date(a.created_at) - new Date(b.created_at)
    );
    const moves = events.filter((event) => !sameDepartment(event.from_department, event.to_department));
    const readyAt = firstReadyByJob.get(String(job.id));
    if (!moves.length) {
      if (readyAt && sameDepartment(order.starting_department, job.current_department)) {
        addInterval(order.starting_department, order.created_at, readyAt);
      }
      continue;
    }
    const first = moves[0];
    if (sameDepartment(first.from_department, order.starting_department)) {
      addInterval(first.from_department, order.created_at, first.created_at);
    }
    for (let index = 1; index < moves.length; index += 1) {
      const previous = moves[index - 1];
      const current = moves[index];
      if (sameDepartment(previous.to_department, current.from_department)) {
        addInterval(current.from_department, previous.created_at, current.created_at);
      }
    }
    const last = moves[moves.length - 1];
    if (readyAt && sameDepartment(last.to_department, job.current_department)) {
      addInterval(last.to_department, last.created_at, readyAt);
    }
  }

  const stages = [...intervalsByStage.entries()]
    .map(([name, values]) => ({ name, ...artworkStats(values) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return {
    days,
    periodStart: artworkDateKey(start),
    periodEnd: artworkDateKey(end),
    orderCount: orders.length,
    readyCount: turnaroundDays.length,
    coveragePercent: orders.length ? (turnaroundDays.length / orders.length) * 100 : 0,
    turnaround: artworkStats(turnaroundDays),
    stages,
  };
}

function formatArtworkDays(value) {
  return value == null ? "—" : `${value.toFixed(2)} days`;
}

function artworkDateLabel(value) {
  const date = new Date(`${value}T12:00:00`);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

async function imageUrlToDataUrl(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("The Metal Worx logo could not be loaded.");
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("The Metal Worx logo could not be loaded."));
    reader.readAsDataURL(blob);
  });
}

async function exportArtworkTurnaroundReport(report) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const logoData = await imageUrlToDataUrl(metalWorxLogo);
  const startLabel = artworkDateLabel(report.periodStart);
  const endLabel = artworkDateLabel(report.periodEnd);
  const generated = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const drawHeader = (subtitle) => {
    doc.setFillColor(26, 26, 26);
    doc.rect(0, 0, width, 82, "F");
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(32, 12, 135, 58, 5, 5, "F");
    doc.addImage(logoData, "PNG", 39, 18, 121, 45);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("ARTWORK TURNAROUND REPORT", 188, 36);
    doc.setTextColor(192, 192, 192);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(subtitle, 189, 55);
    doc.setTextColor(181, 18, 27);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("METAL WORX INC.", width - 32, 36, { align: "right" });
  };
  const drawFooter = (pageNumber) => {
    doc.setDrawColor(215, 218, 221);
    doc.line(32, height - 28, width - 32, height - 28);
    doc.setTextColor(90, 90, 90);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(`Generated ${generated} | Artwork orders created ${startLabel} - ${endLabel}`, 32, height - 15);
    doc.text(`Page ${pageNumber} of 2`, width - 32, height - 15, { align: "right" });
  };

  drawHeader(`Latest ${report.days}-day period: ${startLabel} - ${endLabel}`);
  const cards = [
    ["ORDERS IN PERIOD", String(report.orderCount), "Custom Artwork orders"],
    ["READY / SHIP", String(report.readyCount), `${report.coveragePercent.toFixed(0)}% of orders in period`],
    ["AVERAGE TO READY", formatArtworkDays(report.turnaround.average), `${report.turnaround.n} completed orders`],
    ["MEDIAN TO READY", formatArtworkDays(report.turnaround.median), "half completed by this time"],
  ];
  const margin = 32;
  const gap = 10;
  const cardY = 99;
  const cardW = (width - 2 * margin - 3 * gap) / 4;
  cards.forEach(([label, value, note], index) => {
    const x = margin + index * (cardW + gap);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(215, 218, 221);
    doc.roundedRect(x, cardY, cardW, 70, 6, 6, "FD");
    doc.setFillColor(181, 18, 27);
    doc.roundedRect(x, cardY, 5, 70, 2, 2, "F");
    doc.setTextColor(85, 85, 85);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text(label, x + 14, cardY + 18);
    doc.setTextColor(26, 26, 26);
    doc.setFontSize(17);
    doc.text(value, x + 14, cardY + 42);
    doc.setTextColor(85, 85, 85);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(note, x + 14, cardY + 59, { maxWidth: cardW - 26 });
  });

  doc.setTextColor(26, 26, 26);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Elapsed time by artwork section", 32, 199);
  doc.setTextColor(85, 85, 85);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Average and median calendar days between connected station changes", 32, 214);
  autoTable(doc, {
    startY: 225,
    margin: { left: 32, right: 32 },
    head: [["Section", "Average days", "Median days", "75th percentile", "Completed intervals"]],
    body: report.stages.map((stage) => [
      stage.name,
      formatArtworkDays(stage.average),
      formatArtworkDays(stage.median),
      formatArtworkDays(stage.p75),
      stage.n,
    ]),
    theme: "grid",
    styles: { font: "helvetica", fontSize: 8, cellPadding: 6, textColor: [35, 35, 35] },
    headStyles: { fillColor: [26, 26, 26], textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [244, 245, 246] },
  });
  const tableBottom = doc.lastAutoTable?.finalY || 340;
  const timingY = Math.min(tableBottom + 24, 492);
  doc.setTextColor(26, 26, 26);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Order-to-ready summary", 32, timingY);
  doc.setTextColor(85, 85, 85);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const summary = `Average ${formatArtworkDays(report.turnaround.average)}   |   Median ${formatArtworkDays(report.turnaround.median)}   |   75th percentile ${formatArtworkDays(report.turnaround.p75)}   |   Range ${formatArtworkDays(report.turnaround.min)} - ${formatArtworkDays(report.turnaround.max)}`;
  doc.text(summary, 32, timingY + 15, { maxWidth: width - 64 });
  doc.setTextColor(85, 85, 85);
  doc.setFontSize(7.5);
  doc.text("Turnaround begins at order creation and ends at the first recorded pickup-ready or ship-ready status. Calendar days include weekends.", 32, timingY + 32, { maxWidth: width - 64 });
  doc.text("Section intervals use recorded station moves. Time includes queue and hands-on work; the current open station interval is not included until the next move.", 32, timingY + 46, { maxWidth: width - 64 });
  drawFooter(1);

  doc.addPage("letter", "landscape");
  drawHeader("Practical 30-day improvement pilot");
  doc.setTextColor(26, 26, 26);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Ways to shorten turnaround", 32, 119);
  const stageToReview = [...report.stages]
    .filter((stage) => stage.n >= 3 && stage.median != null)
    .sort((left, right) => right.median - left.median)[0];
  const trendNote = report.turnaround.average != null && report.turnaround.median != null
    ? report.turnaround.average > report.turnaround.median
      ? "Average turnaround exceeds the median, suggesting some longer jobs are pulling the average up."
      : "Average and median are close, so this period's turnaround is relatively consistent."
    : "More completed orders are needed before comparing the average and median.";
  const stageNote = stageToReview
    ? `${stageToReview.name} has the highest median section time among sections with at least 3 completed intervals (${stageToReview.median.toFixed(2)} days, n=${stageToReview.n}).`
    : "No section has at least 3 completed intervals yet; collect more station moves before ranking sections.";
  const recommendations = [
    ["Review the longest jobs first", trendNote, "At the morning review, flag older open jobs, identify the reason they are waiting, and assign the next action."],
    ["Investigate a repeatable station delay", stageNote, "For the next 2 weeks, record whether delays come from queueing, materials, customer approval, rework, or active work."],
    ["Record every station move and ready date", `${report.readyCount} of ${report.orderCount} orders have a recorded ready / ship milestone (${report.coveragePercent.toFixed(0)}% coverage).`, "Capture each section entry and exit plus the first pickup-ready or ship-ready time. Use the same status definitions consistently."],
    ["Review again after 30 days", "A repeat report will show whether turnaround and section times changed as more milestones are recorded.", "Compare overall and section medians with this report before setting targets or changing staffing and scheduling."],
  ];
  autoTable(doc, {
    startY: 135,
    margin: { left: 32, right: 32 },
    head: [["Action", "What the data says", "Practical next step"]],
    body: recommendations,
    theme: "grid",
    styles: { font: "helvetica", fontSize: 8, cellPadding: 7, textColor: [35, 35, 35], valign: "top" },
    headStyles: { fillColor: [26, 26, 26], textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [244, 245, 246] },
    columnStyles: { 0: { cellWidth: 145 }, 1: { cellWidth: 250 }, 2: { cellWidth: "auto" } },
  });
  doc.setTextColor(85, 85, 85);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Use these results as an initial operating snapshot. Stage timing is elapsed time between recorded moves, not hands-on labor time.", 32, (doc.lastAutoTable?.finalY || 390) + 24, { maxWidth: width - 64 });
  drawFooter(2);
  const filenameDate = report.periodEnd || artworkDateKey(new Date());
  doc.save(`MetalWorx_Artwork_Turnaround_${report.days}Day_${filenameDate}.pdf`);
}

 function Reports({ setPage }) {
  const [view, setView] = useState("weekly");
  const [data, setData] = useState(null);
  const [weekly, setWeekly] = useState(null);
  const [reportLoading, setReportLoading] = useState(true);
  const [weeklyLoading, setWeeklyLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [weeklyError, setWeeklyError] = useState("");
  const [exportingPDF, setExportingPDF] = useState(false);
  const [artworkReportLoading, setArtworkReportLoading] = useState(false);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [savingGoals, setSavingGoals] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState(dateKey(getMonday()));
  const [goalForm, setGoalForm] = useState({
    week_start: dateKey(getMonday()),
    production_jobs_target: 0,
    production_steps_target: 0,
    customer_orders_target: 0,
    outside_projects_target: 0,
    on_time_percent_target: 90,
    site_visits_target: 0,
    weekly_focus: "",
    management_notes: "",
  });

  useEffect(() => {
    loadReports();
  }, []);

  useEffect(() => {
    loadWeekly(selectedWeek);
  }, [selectedWeek]);

  async function loadReports() {
    setReportLoading(true);
    setLoadError("");
    try {
      setData(await getReportsData());
    } catch (error) {
      console.error("Reports load error:", error);
      setLoadError(error.message || "Reports failed to load.");
    } finally {
      setReportLoading(false);
    }
  }

  async function loadWeekly(weekStart = selectedWeek) {
    setWeeklyLoading(true);
    setWeeklyError("");
    try {
      setWeekly(await getWeeklyOperationsSummary(weekStart));
    } catch (error) {
      console.error("Weekly summary load error:", error);
      setWeeklyError(error.message || "Weekly summary failed to load.");
    } finally {
      setWeeklyLoading(false);
    }
  }

  async function refreshAll() {
    await Promise.all([loadReports(), loadWeekly(selectedWeek)]);
  }

  async function handlePDFExport() {
    if (!data || exportingPDF) return;
    setExportingPDF(true);
    try {
      exportReportsToPDF(data);
    } catch (error) {
      console.error("PDF export error:", error);
      window.alert(error.message || "PDF export failed.");
    } finally {
      setExportingPDF(false);
    }
  }

  async function handleArtworkReport() {
    if (artworkReportLoading) return;
    setArtworkReportLoading(true);
    try {
      const report = await getArtworkTurnaroundReport(30);
      await exportArtworkTurnaroundReport(report);
      notifications.show({
        title: "Artwork report created",
        message: `Your ${report.days}-day artwork turnaround PDF has been downloaded.`,
        color: "green",
      });
    } catch (error) {
      console.error("Artwork turnaround report error:", error);
      notifications.show({
        title: "Report could not be created",
        message: error.message || "Check the data connection and try again.",
        color: "red",
      });
    } finally {
      setArtworkReportLoading(false);
    }
  }

  function money(value) {
    return `$${numberValue(value).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  function weekLabel() {
    if (!weekly?.week_start) return "Selected Week";
    const start = new Date(`${weekly.week_start}T12:00:00`);
    const end = new Date(`${weekly.week_end}T12:00:00`);
    return `${start.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })} – ${end.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}`;
  }

  function openGoals() {
    const goals = weekly?.goals || {};
    setGoalForm({
      week_start: weekly?.week_start || selectedWeek,
      production_jobs_target: numberValue(goals.production_jobs_target),
      production_steps_target: numberValue(goals.production_steps_target),
      customer_orders_target: numberValue(goals.customer_orders_target),
      outside_projects_target: numberValue(goals.outside_projects_target),
      on_time_percent_target: numberValue(goals.on_time_percent_target || 90),
      site_visits_target: numberValue(goals.site_visits_target),
      weekly_focus: goals.weekly_focus || "",
      management_notes: goals.management_notes || "",
    });
    setGoalsOpen(true);
  }

  function updateGoal(field, value) {
    setGoalForm((current) => ({ ...current, [field]: value }));
  }

  async function saveGoals() {
    setSavingGoals(true);
    try {
      await saveWeeklyOperationsGoals(goalForm);
      notifications.show({
        title: "Weekly goals saved",
        message: "The scorecard targets and management focus were updated.",
        color: "green",
      });
      setGoalsOpen(false);
      await loadWeekly(selectedWeek);
    } catch (error) {
      notifications.show({
        title: "Could not save weekly goals",
        message: error.message,
        color: "red",
      });
    } finally {
      setSavingGoals(false);
    }
  }

  function ComparisonCard({ label, value, previous, format = "number", note, showComparison = true }) {
    const currentNumber = value == null ? null : numberValue(value);
    const previousNumber = previous == null ? null : numberValue(previous);
    const difference = (currentNumber || 0) - (previousNumber || 0);
    const formattedValue =
      currentNumber == null
        ? "—"
        : format === "money"
          ? money(currentNumber)
          : format === "percent"
            ? `${currentNumber.toFixed(1)}%`
            : format === "days"
              ? `${currentNumber.toFixed(1)} days`
              : currentNumber.toLocaleString();

    const TrendIcon = difference > 0
      ? IconTrendingUp
      : difference < 0
        ? IconTrendingDown
        : IconMinus;
    const showTrend = showComparison && currentNumber != null && previousNumber != null;

    return (
      <Card withBorder radius="lg" p="lg">
        <Stack gap="xs" align="center">
          <Text size="xs" c="dimmed" fw={900} tt="uppercase" ta="center" w="100%">
            {label}
          </Text>
          <Group justify="center" align="center" gap="xs" w="100%">
            <Title order={2} ta="center">{formattedValue}</Title>
            {showTrend && (
              <Badge
                color={difference > 0 ? "green" : difference < 0 ? "orange" : "gray"}
                variant="light"
                leftSection={<TrendIcon size={13} />}
              >
                {difference > 0 ? "+" : ""}
                {format === "money" ? money(difference) : difference.toFixed(format === "percent" ? 1 : 0)}
              </Badge>
            )}
          </Group>
          {(note || previousNumber != null) && (
            <Text size="sm" c="dimmed" ta="center">
              {note || `Previous full week: ${previousNumber.toLocaleString()}`}
            </Text>
          )}
        </Stack>
      </Card>
    );
  }

  function GoalCard({ label, actual, target, suffix = "" }) {
    const actualNumber = numberValue(actual);
    const targetNumber = numberValue(target);
    const percent = targetNumber > 0
      ? Math.min((actualNumber / targetNumber) * 100, 100)
      : 0;

    return (
      <Card withBorder radius="lg" p="md">
        <Stack gap="xs" align="center">
          <Text fw={800} ta="center">{label}</Text>
          <Text fw={900} ta="center">
            {actualNumber}{suffix} / {targetNumber}{suffix}
          </Text>
          <Progress
            value={percent}
            color={targetNumber > 0 && actualNumber >= targetNumber ? "green" : "red"}
            size="lg"
            radius="xl"
          />
          <Text size="xs" c="dimmed">
            {targetNumber === 0
              ? "No goal has been set for this week."
              : `${Math.round(percent)}% of weekly goal`}
          </Text>
        </Stack>
      </Card>
    );
  }

  function BarList({ items = [], emptyText = "No data found." }) {
    const max = Math.max(...items.map((item) => item.value), 1);
    if (items.length === 0) return <Text c="dimmed">{emptyText}</Text>;

    return (
      <Stack gap="sm">
        {items.map((item) => (
          <div key={item.label} className="mw-report-bar-row">
            <Group justify="space-between" mb={4}>
              <Text size="sm" fw={700}>{item.label}</Text>
              <Text size="sm" c="dimmed">{item.value}</Text>
            </Group>
            <div className="mw-report-bar-track">
              <div
                className="mw-report-bar-fill"
                style={{ width: `${Math.max((item.value / max) * 100, 5)}%` }}
              />
            </div>
          </div>
        ))}
      </Stack>
    );
  }

  const current = weekly?.current || {};
  const previous = weekly?.previous || {};
  const goals = weekly?.goals || {};
  const summary = data?.summary || {};
  const isSelectedCurrentWeek = selectedWeek === dateKey(getMonday());
  const onTimeDueJobs =
    numberValue(current.jobs_completed_on_time) +
    numberValue(current.jobs_completed_late);
  const onTimeNote = onTimeDueJobs
    ? `${numberValue(current.jobs_completed_on_time)} of ${onTimeDueJobs} completed jobs with a due date were on time.`
    : "No completed jobs had a due date recorded.";
  const averageJobTimeNote = current.production_jobs_completed
    ? `From job creation to completion • ${numberValue(current.production_jobs_completed)} completed jobs`
    : "No production jobs were completed in this period.";
  const departmentPerformance = Array.isArray(weekly?.department_performance)
    ? weekly.department_performance
    : [];
  const maxDepartmentSteps = Math.max(
    ...departmentPerformance.map((department) => numberValue(department.steps_completed)),
    1
  );
  const hasWeeklyPlan = Boolean(
    goals.weekly_focus ||
    goals.management_notes ||
    numberValue(goals.production_jobs_target) > 0 ||
    numberValue(goals.production_steps_target) > 0 ||
    numberValue(goals.customer_orders_target) > 0 ||
    numberValue(goals.outside_projects_target) > 0 ||
    numberValue(goals.site_visits_target) > 0 ||
    (numberValue(goals.on_time_percent_target) > 0 &&
      numberValue(goals.on_time_percent_target) !== 90)
  );
  const weeklyGoalItems = [
    { label: "Production Jobs", actual: current.production_jobs_completed, target: goals.production_jobs_target },
    { label: "Production Steps", actual: current.production_steps_completed, target: goals.production_steps_target },
    { label: "Customer Orders Closed", actual: current.customer_orders_closed, target: goals.customer_orders_target },
    { label: "Outside Projects", actual: current.outside_projects_completed, target: goals.outside_projects_target },
    { label: "Site Visits", actual: current.site_visits_completed, target: goals.site_visits_target },
    { label: "On-Time Performance", actual: current.on_time_percent, target: goals.on_time_percent_target, suffix: "%" },
  ].filter((goal) =>
    numberValue(goal.target) > 0 &&
    !(goal.label === "On-Time Performance" && numberValue(goal.target) === 90)
  );
  const weeklyActivity = [
    { label: "New customer orders", value: current.new_customer_orders },
    { label: "New outside projects", value: current.new_outside_projects },
    { label: "Callbacks completed", value: current.callbacks_completed },
    { label: "Callbacks converted to projects", value: current.callbacks_converted_to_projects },
    { label: "Site visits completed", value: current.site_visits_completed },
    { label: "Material requests filled", value: current.material_requests_fulfilled },
    { label: "Blocked material requests", value: current.blocked_material_requests_created },
  ].map((item) => ({ ...item, value: numberValue(item.value) }))
    .filter((item) => item.value > 0);

  const summaryCards = [
    { label: "Open Orders", value: summary.openOrders || 0, subtext: "Customer orders still active", icon: <IconClipboardList size={24} />, onClick: () => setPage("customerOrders") },
    { label: "Outside Projects", value: summary.openProjects || 0, subtext: "Active field / fabrication projects", icon: <IconFolder size={24} />, onClick: () => setPage("projects") },
    { label: "Production Jobs", value: summary.activeProductionJobs || 0, subtext: "Active shop production jobs", icon: <IconBuildingFactory2 size={24} />, onClick: () => setPage("productionControl") },
    { label: "Open Callbacks", value: summary.openCallbacks || 0, subtext: "Customer follow-ups still open", icon: <IconUser size={24} />, onClick: () => setPage("callbacks") },
    { label: "Overdue Work", value: summary.overdueWork || 0, subtext: "Orders, projects, or callbacks past due", icon: <IconAlertTriangle size={24} />, onClick: () => setPage("actionCenter") },
    { label: "Open Work Value", value: money(summary.totalPipelineValue), subtext: "Recorded value of open orders and projects", icon: <IconCash size={24} />, onClick: () => setPage("dashboard") },
  ];

  return (
    <>
      <style>{`
        .mw-weekly-scorecard .mantine-Card-root {
          background: #17191d !important;
          border-color: #3a3f46 !important;
        }

        .mw-weekly-scorecard .mantine-Title-root {
          color: #ffffff !important;
        }

        .mw-weekly-scorecard .mantine-Text-root {
          color: #e6e9ed !important;
        }

        .mw-weekly-scorecard .mantine-Progress-root {
          background: #34383e !important;
        }

        .mw-weekly-scorecard .mantine-Badge-root {
          border: 1px solid rgba(255, 255, 255, 0.12);
        }

        .mw-weekly-scorecard .mw-weekly-hero {
          background:
            linear-gradient(135deg, rgba(118, 0, 0, 0.46), rgba(16, 18, 22, 0.98)) !important;
          border-color: rgba(205, 32, 32, 0.55) !important;
        }

        .mw-weekly-scorecard .mw-weekly-metric-value {
          color: #ffffff !important;
          text-shadow: 0 1px 0 rgba(0, 0, 0, 0.6);
        }

        .mw-weekly-scorecard .mw-weekly-label {
          color: #c8cdd4 !important;
        }
      `}</style>

      <MWPageHeader
        title="Reports & Analytics"
        subtitle="Weekly results, current workload, and artwork turnaround."
        setPage={setPage}
        showDashboard
      />

      <Modal
        opened={goalsOpen}
        onClose={() => !savingGoals && setGoalsOpen(false)}
        title="Weekly Goals & Management Focus"
        size="xl"
        centered
      >
        <Stack gap="lg">
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            <NumberInput label="Production Jobs" min={0} value={goalForm.production_jobs_target} onChange={(value) => updateGoal("production_jobs_target", value)} />
            <NumberInput label="Production Steps" min={0} value={goalForm.production_steps_target} onChange={(value) => updateGoal("production_steps_target", value)} />
            <NumberInput label="Customer Orders Closed" min={0} value={goalForm.customer_orders_target} onChange={(value) => updateGoal("customer_orders_target", value)} />
            <NumberInput label="Outside Projects" min={0} value={goalForm.outside_projects_target} onChange={(value) => updateGoal("outside_projects_target", value)} />
            <NumberInput label="On-Time Target (%)" min={0} max={100} value={goalForm.on_time_percent_target} onChange={(value) => updateGoal("on_time_percent_target", value)} />
            <NumberInput label="Site Visits" min={0} value={goalForm.site_visits_target} onChange={(value) => updateGoal("site_visits_target", value)} />
          </SimpleGrid>
          <Textarea label="Weekly Focus" description="The one operational result management wants emphasized this week." minRows={2} value={goalForm.weekly_focus} onChange={(event) => updateGoal("weekly_focus", event.currentTarget.value)} />
          <Textarea label="Management Notes" description="Lessons, wins, and decisions to carry into the next week." minRows={4} value={goalForm.management_notes} onChange={(event) => updateGoal("management_notes", event.currentTarget.value)} />
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <Button fullWidth variant="default" disabled={savingGoals} onClick={() => setGoalsOpen(false)}>Cancel</Button>
            <Button fullWidth color="red" leftSection={<IconDeviceFloppy size={17} />} loading={savingGoals} onClick={saveGoals}>Save Weekly Goals</Button>
          </SimpleGrid>
        </Stack>
      </Modal>

      <Stack gap="lg">
        <Card withBorder radius="lg" p="md">
          <Group justify="space-between" align="center" wrap="wrap">
            <Group gap="sm" align="center">
              <div style={{ width: 42, height: 42, borderRadius: 12, background: "#fff1f1", color: "#b5121b", display: "grid", placeItems: "center" }}>
                <IconCalendarStats size={22} />
              </div>
              <Stack gap={2}>
                <Text fw={800}>Artwork Turnaround Report</Text>
                <Text size="sm" c="dimmed">Create a branded PDF for the latest 30 days of artwork orders and station timing.</Text>
              </Stack>
            </Group>
            <Button color="red" leftSection={<IconFileTypePdf size={17} />} onClick={handleArtworkReport} loading={artworkReportLoading}>
              Create 30-Day Report
            </Button>
          </Group>
        </Card>

        <Card withBorder radius="lg" p="md">
          <Group justify="space-between" align="center">
            <SegmentedControl
              value={view}
              onChange={setView}
              data={[
                { label: "Weekly Performance", value: "weekly" },
                { label: "Current Workload", value: "live" },
              ]}
            />
            <Group gap="sm">
              {view === "live" && (
                <Button variant="light" color="red" leftSection={<IconFileTypePdf size={17} />} onClick={handlePDFExport} loading={exportingPDF} disabled={!data}>Export Live PDF</Button>
              )}
              <Button color="red" leftSection={<IconRefresh size={17} />} onClick={refreshAll} loading={reportLoading || weeklyLoading}>Refresh</Button>
            </Group>
          </Group>
        </Card>

        {view === "weekly" ? (
          <Stack gap="lg" className="mw-weekly-scorecard">
            <Card withBorder radius="lg" p="lg" className="mw-weekly-hero">
              <Group justify="space-between" align="center">
                <Group gap="md">
                  <div style={{ padding: 12, borderRadius: 12, background: "rgba(170, 0, 0, 0.24)" }}>
                    <IconCalendarStats size={28} />
                  </div>
                  <div>
                    <Title order={2}>{isSelectedCurrentWeek ? "Week-to-Date Operations" : "Weekly Operations Scorecard"}</Title>
                    <Text c="dimmed">
                      {isSelectedCurrentWeek
                        ? `Week in progress through ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}. Weekly timestamps use Eastern Time; week-over-week changes appear after the week closes.`
                        : "Monday–Sunday totals in Eastern Time, compared with the previous full week."}
                    </Text>
                  </div>
                </Group>
                <Group gap="xs">
                  <Button variant="default" onClick={() => setSelectedWeek(shiftDays(selectedWeek, -7))}><IconArrowLeft size={18} /></Button>
                  <Badge size="xl" color="red" variant="light">{weekLabel()}</Badge>
                  <Button variant="default" disabled={selectedWeek >= dateKey(getMonday())} onClick={() => setSelectedWeek(shiftDays(selectedWeek, 7))}><IconArrowRight size={18} /></Button>
                  <Button variant="light" color="red" leftSection={<IconTargetArrow size={17} />} onClick={openGoals}>Weekly Goals & Focus</Button>
                </Group>
              </Group>
            </Card>

            {weeklyError ? (
              <Card withBorder radius="lg" p="lg"><Text c="red">{weeklyError}</Text></Card>
            ) : weeklyLoading && !weekly ? (
              <Card withBorder radius="lg" p="xl"><Text c="dimmed">Loading weekly performance…</Text></Card>
            ) : (
              <>
                <MWSection
                  title="Completed Outcomes"
                  subtitle="Calculation: counts use completion or closed dates within the selected Monday–Sunday week. Closed Order Value sums the recorded totals of orders closed in that window."
                >
                  <SimpleGrid cols={{ base: 1, sm: 2, xl: 4 }} spacing="md">
                    <ComparisonCard label="Production Jobs" value={current.production_jobs_completed} previous={previous.production_jobs_completed} showComparison={!isSelectedCurrentWeek} note={isSelectedCurrentWeek ? "Week-to-date total" : undefined} />
                    <ComparisonCard label="Customer Orders Closed" value={current.customer_orders_closed} previous={previous.customer_orders_closed} showComparison={!isSelectedCurrentWeek} note={isSelectedCurrentWeek ? "Week-to-date total" : undefined} />
                    <ComparisonCard label="Outside Projects Completed" value={current.outside_projects_completed} previous={previous.outside_projects_completed} showComparison={!isSelectedCurrentWeek} note={isSelectedCurrentWeek ? "Week-to-date total" : undefined} />
                    <ComparisonCard
                      label="Closed Order Value"
                      value={numberValue(current.customer_orders_closed) > 0 ? current.closed_order_value : null}
                      previous={previous.closed_order_value}
                      format="money"
                      showComparison={!isSelectedCurrentWeek && numberValue(current.customer_orders_closed) > 0}
                      note={numberValue(current.customer_orders_closed) > 0 ? undefined : "No customer orders closed in this period."}
                    />
                  </SimpleGrid>
                </MWSection>

                <MWSection
                  title="Delivery Performance"
                  subtitle="Calculation: on-time rate = jobs completed by the due date ÷ completed jobs with a due date. Turnaround averages completion minus job creation; production steps count work orders completed in the week."
                >
                  <SimpleGrid cols={{ base: 1, sm: 2, xl: 3 }} spacing="md">
                    <ComparisonCard label="On-Time Completion" value={current.on_time_percent} format="percent" note={onTimeNote} showComparison={false} />
                    <ComparisonCard label="Average Job Turnaround" value={current.average_job_days} format="days" note={averageJobTimeNote} showComparison={false} />
                    <ComparisonCard label="Production Steps" value={current.production_steps_completed} previous={previous.production_steps_completed} showComparison={!isSelectedCurrentWeek} note={isSelectedCurrentWeek ? "Week-to-date station steps" : undefined} />
                  </SimpleGrid>
                </MWSection>

                <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="lg">
                  {hasWeeklyPlan && (
                    <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "center" }}>
                      <div style={{ width: "min(100%, 760px)" }}>
                        <MWSection title="Weekly Goals" subtitle="Calculation: each actual is compared with the target entered for the week; progress is actual ÷ target, capped at 100%.">
                          <Stack gap="sm">
                            {weeklyGoalItems.length > 0
                              ? weeklyGoalItems.map((goal) => (
                                <GoalCard key={goal.label} label={goal.label} actual={goal.actual} target={goal.target} suffix={goal.suffix || ""} />
                              ))
                              : <Text c="dimmed">A weekly focus is recorded, but no numeric targets are set.</Text>}
                          </Stack>
                        </MWSection>
                      </div>
                    </div>
                  )}

                  <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "center" }}>
                    <div style={{ width: "min(100%, 760px)" }}>
                      <MWSection
                        title="Production Steps by Station"
                        subtitle="Calculation: count completed work orders by their recorded department during the selected week. Each record is one step, not labor hours."
                      >
                    <Stack gap="md">
                      {departmentPerformance.length === 0 ? (
                        <Text c="dimmed">No production steps were completed during this week.</Text>
                      ) : (
                        departmentPerformance.map((department) => {
                          const steps = numberValue(department.steps_completed);
                          return (
                            <div key={department.department}>
                              <Group justify="space-between" mb={5}>
                                <Text fw={800}>{department.department}</Text>
                                <Badge size="md" color="red">{steps} steps</Badge>
                              </Group>
                              <Progress value={(steps / maxDepartmentSteps) * 100} color="red" size="sm" radius="xl" />
                            </div>
                          );
                        })
                      )}
                    </Stack>
                      </MWSection>
                    </div>
                  </div>
                </SimpleGrid>

                {weeklyActivity.length > 0 && (
                  <MWSection title="Other Recorded Activity" subtitle="Calculation: each count uses that event’s recorded date within the selected week; zero-count items are hidden.">
                    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
                      {weeklyActivity.map((item) => (
                        <Card key={item.label} withBorder radius="lg" p="md">
                          <Text size="xs" c="dimmed" fw={900} tt="uppercase">{item.label}</Text>
                          <Title order={3} mt={6}>{item.value.toLocaleString()}</Title>
                        </Card>
                      ))}
                    </SimpleGrid>
                  </MWSection>
                )}

                {(goals.weekly_focus || goals.management_notes) && (
                  <MWSection title="Management Review" subtitle="Recorded weekly focus and decisions.">
                    <Stack gap="md">
                      {goals.weekly_focus && (
                        <Card withBorder radius="lg" p="lg">
                          <Text size="xs" c="dimmed" fw={900} tt="uppercase">Weekly Focus</Text>
                          <Text mt="xs" fw={700}>{goals.weekly_focus}</Text>
                        </Card>
                      )}
                      {goals.management_notes && (
                        <Card withBorder radius="lg" p="lg">
                          <Text size="xs" c="dimmed" fw={900} tt="uppercase">Management Notes</Text>
                          <Text mt="xs" style={{ whiteSpace: "pre-wrap" }}>{goals.management_notes}</Text>
                        </Card>
                      )}
                      <Button variant="default" onClick={openGoals}>Edit Weekly Plan</Button>
                    </Stack>
                  </MWSection>
                )}
              </>
            )}
          </Stack>
        ) : (
          <Stack gap="lg">
            {loadError ? (
              <Card withBorder radius="lg" p="lg"><Stack><Text c="red">{loadError}</Text><Button color="red" onClick={loadReports}>Retry</Button></Stack></Card>
            ) : reportLoading && !data ? (
              <Card withBorder radius="lg" p="xl"><Text c="dimmed">Pulling current ERP data…</Text></Card>
            ) : (
              <>
                <section className="mw-report-summary-grid">
                  {summaryCards.map((card) => (
                    <button type="button" key={card.label} className="mw-report-summary-card" onClick={card.onClick}>
                      <div><Text size="xs" c="dimmed" fw={900} tt="uppercase">{card.label}</Text><Title order={2}>{card.value}</Title><Text size="sm" c="dimmed">{card.subtext}</Text></div>
                      <div className="mw-report-summary-icon">{card.icon}</div>
                    </button>
                  ))}
                </section>

                <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
                  <MWSection title="Customer Order Status"><BarList items={data?.orderStatusBreakdown} emptyText="No open customer orders." /></MWSection>
                  <MWSection title="Outside Project Status"><BarList items={data?.projectStatusBreakdown} emptyText="No active outside projects." /></MWSection>
                  <MWSection title="Production Status"><BarList items={data?.productionStatusBreakdown} emptyText="No active production jobs." /></MWSection>
                  <MWSection title="Department Workload"><BarList items={data?.departmentWorkload} emptyText="No active work orders." /></MWSection>
                  <MWSection title="Order Owner Workload"><BarList items={data?.orderOwnerBreakdown} emptyText="No customer order owners found." /></MWSection>
                  <MWSection title="Project Owner Workload"><BarList items={data?.projectOwnerBreakdown} emptyText="No project owner workload found." /></MWSection>
                  <MWSection title="Callback Owner Workload"><BarList items={data?.callbackOwnerBreakdown} emptyText="No callback workload found." /></MWSection>
                </SimpleGrid>

                <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
                  <MWSection title="Attention Summary">
                    <Stack>{(data?.attentionItems || []).map((item) => <Card key={item.label} withBorder radius="lg" p="md"><Group justify="space-between"><div><Text fw={800}>{item.label}</Text><Text size="sm" c="dimmed">Needs operational attention</Text></div><Badge color={item.value > 0 ? "red" : "green"} size="lg">{item.value}</Badge></Group></Card>)}</Stack>
                  </MWSection>
                  <MWSection title="Open Work Value" subtitle="Recorded value of open work; this is not collected cash.">
                    <Stack>
                      {[
                        ["Open Customer Order Value", summary.orderPipelineValue],
                        ["Open Outside Project Value", summary.projectPipelineValue],
                      ].map(([label, value]) => <Card key={label} withBorder radius="lg" p="md"><Group justify="space-between"><Text c="dimmed">{label}</Text><Text fw={900}>{money(value)}</Text></Group></Card>)}
                    </Stack>
                  </MWSection>
                </SimpleGrid>
              </>
            )}
          </Stack>
        )}
      </Stack>
    </>
  );
}

export default Reports;