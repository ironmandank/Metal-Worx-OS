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
  IconChartBar,
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

function Reports({ setPage }) {
  const [view, setView] = useState("weekly");
  const [data, setData] = useState(null);
  const [weekly, setWeekly] = useState(null);
  const [reportLoading, setReportLoading] = useState(true);
  const [weeklyLoading, setWeeklyLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [weeklyError, setWeeklyError] = useState("");
  const [exportingPDF, setExportingPDF] = useState(false);
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

  function ComparisonCard({ label, value, previous, format = "number", note }) {
    const currentNumber = numberValue(value);
    const previousNumber = numberValue(previous);
    const difference = currentNumber - previousNumber;
    const formattedValue =
      format === "money"
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

    return (
      <Card withBorder radius="lg" p="lg">
        <Stack gap="xs">
          <Text size="xs" c="dimmed" fw={900} tt="uppercase">
            {label}
          </Text>
          <Group justify="space-between" align="flex-end">
            <Title order={2}>{formattedValue}</Title>
            <Badge
              color={difference > 0 ? "green" : difference < 0 ? "orange" : "gray"}
              variant="light"
              leftSection={<TrendIcon size={13} />}
            >
              {difference > 0 ? "+" : ""}
              {format === "money" ? money(difference) : difference.toFixed(format === "percent" ? 1 : 0)}
            </Badge>
          </Group>
          <Text size="sm" c="dimmed">
            {note || `Previous week: ${previousNumber.toLocaleString()}`}
          </Text>
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
        <Stack gap="xs">
          <Group justify="space-between">
            <Text fw={800}>{label}</Text>
            <Text fw={900}>
              {actualNumber}{suffix} / {targetNumber}{suffix}
            </Text>
          </Group>
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

  const summaryCards = [
    { label: "Open Orders", value: summary.openOrders || 0, subtext: "Customer orders still active", icon: <IconClipboardList size={24} />, onClick: () => setPage("customerOrders") },
    { label: "Outside Projects", value: summary.openProjects || 0, subtext: "Active field / fabrication projects", icon: <IconFolder size={24} />, onClick: () => setPage("projects") },
    { label: "Production Jobs", value: summary.activeProductionJobs || 0, subtext: "Active shop production jobs", icon: <IconBuildingFactory2 size={24} />, onClick: () => setPage("productionControl") },
    { label: "Open Callbacks", value: summary.openCallbacks || 0, subtext: "Customer follow-ups still open", icon: <IconUser size={24} />, onClick: () => setPage("callbacks") },
    { label: "Overdue Work", value: summary.overdueWork || 0, subtext: "Orders, projects, or callbacks past due", icon: <IconAlertTriangle size={24} />, onClick: () => setPage("actionCenter") },
    { label: "Pipeline Value", value: money(summary.totalPipelineValue), subtext: "Open order + project value", icon: <IconCash size={24} />, onClick: () => setPage("dashboard") },
    { label: "Outstanding Balance", value: money(summary.totalOutstandingBalance), subtext: "Estimated unpaid open balances", icon: <IconCash size={24} />, onClick: () => setPage("dashboard") },
    { label: "Report Health", value: "Live", subtext: "Read-only from Supabase", icon: <IconChartBar size={24} />, onClick: loadReports },
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
        subtitle="Historical weekly performance and a separate live operating snapshot."
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
          <Group justify="space-between" align="center">
            <SegmentedControl
              value={view}
              onChange={setView}
              data={[
                { label: "Weekly Scorecard", value: "weekly" },
                { label: "Live Operations", value: "live" },
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
                    <Title order={2}>Weekly Operations Scorecard</Title>
                    <Text c="dimmed">Completed outcomes, throughput, delivery performance, and goals.</Text>
                  </div>
                </Group>
                <Group gap="xs">
                  <Button variant="default" onClick={() => setSelectedWeek(shiftDays(selectedWeek, -7))}><IconArrowLeft size={18} /></Button>
                  <Badge size="xl" color="red" variant="light">{weekLabel()}</Badge>
                  <Button variant="default" disabled={selectedWeek >= dateKey(getMonday())} onClick={() => setSelectedWeek(shiftDays(selectedWeek, 7))}><IconArrowRight size={18} /></Button>
                </Group>
              </Group>
            </Card>

            {weeklyError ? (
              <Card withBorder radius="lg" p="lg"><Text c="red">{weeklyError}</Text></Card>
            ) : weeklyLoading && !weekly ? (
              <Card withBorder radius="lg" p="xl"><Text c="dimmed">Loading weekly performance…</Text></Card>
            ) : (
              <>
                <MWSection title="Completed Outcomes" subtitle="What Metal Worx finished during the selected week—not what is currently open.">
                  <SimpleGrid cols={{ base: 1, sm: 2, xl: 4 }} spacing="md">
                    <ComparisonCard label="Production Jobs" value={current.production_jobs_completed} previous={previous.production_jobs_completed} />
                    <ComparisonCard label="Customer Orders Closed" value={current.customer_orders_closed} previous={previous.customer_orders_closed} />
                    <ComparisonCard label="Outside Projects" value={current.outside_projects_completed} previous={previous.outside_projects_completed} />
                    <ComparisonCard label="Closed Order Value" value={current.closed_order_value} previous={previous.closed_order_value} format="money" />
                  </SimpleGrid>
                </MWSection>

                <MWSection title="Delivery Performance" subtitle="Speed, reliability, and shop throughput compared with the prior week.">
                  <SimpleGrid cols={{ base: 1, sm: 2, xl: 4 }} spacing="md">
                    <ComparisonCard label="On-Time Completion" value={current.on_time_percent} previous={previous.on_time_percent} format="percent" />
                    <ComparisonCard label="Average Job Time" value={current.average_job_days} previous={previous.average_job_days} format="days" note="From production-job creation to completion" />
                    <ComparisonCard label="Production Steps" value={current.production_steps_completed} previous={previous.production_steps_completed} />
                    <ComparisonCard label="Quick Jobs Completed" value={current.quick_jobs_completed} previous={previous.quick_jobs_completed} />
                  </SimpleGrid>
                </MWSection>

                <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="lg">
                  <MWSection title="Weekly Goals" subtitle="Targets set by management for this specific week.">
                    <Stack gap="sm">
                      <GoalCard label="Production Jobs" actual={current.production_jobs_completed} target={goals.production_jobs_target} />
                      <GoalCard label="Production Steps" actual={current.production_steps_completed} target={goals.production_steps_target} />
                      <GoalCard label="Customer Orders Closed" actual={current.customer_orders_closed} target={goals.customer_orders_target} />
                      <GoalCard label="Outside Projects" actual={current.outside_projects_completed} target={goals.outside_projects_target} />
                      <GoalCard label="Site Visits" actual={current.site_visits_completed} target={goals.site_visits_target} />
                      <GoalCard label="On-Time Performance" actual={current.on_time_percent} target={goals.on_time_percent_target} suffix="%" />
                      <Button color="red" variant="light" leftSection={<IconTargetArrow size={18} />} onClick={openGoals}>Set Goals & Weekly Focus</Button>
                    </Stack>
                  </MWSection>

                  <MWSection title="Department Throughput" subtitle="Completed production steps by department during this week.">
                    <Stack gap="sm">
                      {(weekly?.department_performance || []).length === 0 ? (
                        <Text c="dimmed">No production steps were completed during this week.</Text>
                      ) : (
                        (weekly?.department_performance || []).map((department) => (
                          <Card key={department.department} withBorder radius="lg" p="md">
                            <Group justify="space-between">
                              <div>
                                <Text fw={900}>{department.department}</Text>
                                <Text size="sm" c="dimmed">{numberValue(department.estimated_hours_completed).toFixed(1)} estimated hours completed</Text>
                              </div>
                              <Badge size="lg" color="red">{department.steps_completed} steps</Badge>
                            </Group>
                          </Card>
                        ))
                      )}
                    </Stack>
                  </MWSection>
                </SimpleGrid>

                <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="lg">
                  <MWSection title="Flow & Constraint Signals" subtitle="Weekly indicators that explain throughput without repeating today’s active-work board.">
                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                      <Card withBorder radius="lg" p="md"><Text size="xs" c="dimmed" fw={900}>NEW CUSTOMER ORDERS</Text><Title order={3}>{numberValue(current.new_customer_orders)}</Title></Card>
                      <Card withBorder radius="lg" p="md"><Text size="xs" c="dimmed" fw={900}>NEW OUTSIDE PROJECTS</Text><Title order={3}>{numberValue(current.new_outside_projects)}</Title></Card>
                      <Card withBorder radius="lg" p="md"><Text size="xs" c="dimmed" fw={900}>CALLBACKS → PROJECTS</Text><Title order={3}>{numberValue(current.callbacks_converted_to_projects)}</Title></Card>
                      <Card withBorder radius="lg" p="md"><Text size="xs" c="dimmed" fw={900}>SITE VISITS COMPLETED</Text><Title order={3}>{numberValue(current.site_visits_completed)}</Title></Card>
                      <Card withBorder radius="lg" p="md"><Text size="xs" c="dimmed" fw={900}>MATERIAL REQUESTS FILLED</Text><Title order={3}>{numberValue(current.material_requests_fulfilled)}</Title></Card>
                      <Card withBorder radius="lg" p="md"><Text size="xs" c="dimmed" fw={900}>BLOCKED REQUESTS CREATED</Text><Title order={3} c={numberValue(current.blocked_material_requests_created) > 0 ? "orange" : undefined}>{numberValue(current.blocked_material_requests_created)}</Title></Card>
                    </SimpleGrid>
                  </MWSection>

                  <MWSection title="Management Review" subtitle="A concise record of the week’s focus, lessons, and decisions.">
                    <Stack gap="md">
                      <Card withBorder radius="lg" p="lg">
                        <Text size="xs" c="dimmed" fw={900} tt="uppercase">Weekly Focus</Text>
                        <Text mt="xs" fw={700}>{goals.weekly_focus || "No weekly focus has been recorded."}</Text>
                      </Card>
                      <Card withBorder radius="lg" p="lg">
                        <Text size="xs" c="dimmed" fw={900} tt="uppercase">Management Notes</Text>
                        <Text mt="xs" style={{ whiteSpace: "pre-wrap" }}>{goals.management_notes || "No management notes have been recorded."}</Text>
                      </Card>
                      <Button variant="default" onClick={openGoals}>Edit Review</Button>
                    </Stack>
                  </MWSection>
                </SimpleGrid>
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
                  <MWSection title="Top Customers by Orders"><BarList items={data?.topCustomers} emptyText="No customer order history found." /></MWSection>
                </SimpleGrid>

                <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
                  <MWSection title="Attention Summary">
                    <Stack>{(data?.attentionItems || []).map((item) => <Card key={item.label} withBorder radius="lg" p="md"><Group justify="space-between"><div><Text fw={800}>{item.label}</Text><Text size="sm" c="dimmed">Needs operational attention</Text></div><Badge color={item.value > 0 ? "red" : "green"} size="lg">{item.value}</Badge></Group></Card>)}</Stack>
                  </MWSection>
                  <MWSection title="Financial Snapshot">
                    <Stack>
                      {[
                        ["Open Customer Order Value", summary.orderPipelineValue],
                        ["Open Outside Project Value", summary.projectPipelineValue],
                        ["Customer Order Balance", summary.openOrderBalance],
                        ["Outside Project Balance", summary.openProjectBalance],
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