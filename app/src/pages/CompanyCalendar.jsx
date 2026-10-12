import { useEffect, useMemo, useState } from "react";
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Checkbox,
  Divider,
  Group,
  Modal,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconAlertTriangle,
  IconBrandGoogle,
  IconBuildingWarehouse,
  IconCalendarEvent,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconEdit,
  IconMapPin,
  IconPlus,
  IconBriefcase,
  IconRefresh,
  IconSearch,
  IconTrash,
  IconUser,
  IconUsers,
  IconX,
} from "@tabler/icons-react";

import { supabase } from "../lib/supabase";

const EVENT_TYPES = [
  "Employee Unavailable",
  "Time Off",
  "Company Event",
  "Holiday / Closure",
  "Training",
  "Equipment Maintenance",
  "Delivery / Vendor",
  "Important Reminder",
  "Outside Job",
];

const OUTSIDE_JOB_MILESTONES = [
  "General Work",
  "Site Visit",
  "Test Fit",
  "Installation",
];

const PRIORITIES = ["Low", "Normal", "High", "Critical"];

const EVENT_COLORS = {
  "Employee Unavailable": "#8b5cf6",
  "Time Off": "#3b82f6",
  "Company Event": "#e11d32",
  "Holiday / Closure": "#ef4444",
  Training: "#14b8a6",
  "Equipment Maintenance": "#f59e0b",
  "Delivery / Vendor": "#06b6d4",
  "Important Reminder": "#f97316",
  "Outside Job": "#22c55e",
};

const DEPARTMENTS = [
  "Office",
  "Sales",
  "Design",
  "Laser",
  "Prep",
  "Welding",
  "Paint",
  "Powder",
  "Assembly",
  "QC",
  "Showroom",
  "Outside Fabrication",
  "Installation",
  "Operations",
];

const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

const calendarStyles = `
  .mw-calendar,
  .mw-calendar * {
    box-sizing: border-box;
  }

  .mw-calendar {
    --mw-red: #e11d32;
    --mw-red-bright: #ff3047;
    --mw-green: #50d173;
    --mw-panel: #11171b;
    --mw-panel-2: #171d22;
    --mw-border: #303941;
    --mw-muted: #89939b;
    display: grid;
    gap: 16px;
    width: 100%;
    max-width: 1780px;
    margin: 0 auto;
    color: #f5f7f8;
    container-type: inline-size;
  }

  .mw-calendar-hero {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 24px;
    min-height: 128px;
    overflow: hidden;
    padding: 24px 28px 24px 32px;
    border: 1px solid #354049;
    border-radius: 16px;
    background:
      radial-gradient(circle at 85% 20%, rgba(185,0,24,.17), transparent 32%),
      linear-gradient(120deg, #141a1f, #0b1013);
    box-shadow: 0 18px 44px rgba(0,0,0,.25);
  }

  .mw-calendar-hero::before {
    content: "";
    position: absolute;
    inset: 0 auto 0 0;
    width: 5px;
    background: linear-gradient(#ff3047, #87000f);
    box-shadow: 0 0 18px rgba(225,29,50,.55);
  }

  .mw-calendar-title {
    display: flex;
    align-items: center;
    gap: 17px;
    min-width: 0;
  }

  .mw-calendar-title-icon {
    display: grid;
    place-items: center;
    width: 58px;
    height: 58px;
    flex: 0 0 58px;
    border: 1px solid rgba(255,48,71,.36);
    border-radius: 14px;
    color: #fff;
    background: linear-gradient(145deg, #b20018, #67000c);
    box-shadow: 0 10px 24px rgba(112,0,14,.3);
  }

  .mw-calendar-title-icon svg {
    width: 29px;
    height: 29px;
  }

  .mw-calendar-title-copy {
    min-width: 0;
  }

  .mw-calendar-eyebrow {
    display: block;
    margin-bottom: 5px;
    color: #ff4056;
    font-size: .66rem;
    font-weight: 950;
    letter-spacing: .17em;
    text-transform: uppercase;
  }

  .mw-calendar-title-copy h1 {
    margin: 0;
    color: #fff;
    font-size: clamp(1.65rem, 3cqw, 2.55rem);
    font-weight: 900;
    line-height: 1;
    letter-spacing: -.035em;
  }

  .mw-calendar-title-copy p {
    max-width: 760px;
    margin: 8px 0 0;
    color: #8e99a2;
    font-size: .78rem;
    line-height: 1.45;
  }

  .mw-calendar-hero-actions {
    display: flex;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 10px;
  }

  .mw-calendar-stats {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
  }

  .mw-calendar-stat {
    display: grid;
    grid-template-columns: 46px minmax(0, 1fr);
    align-items: center;
    gap: 12px;
    min-height: 94px;
    padding: 15px;
    border: 1px solid #303941;
    border-radius: 13px;
    background: linear-gradient(145deg, #141a1f, #0e1317);
    box-shadow: 0 10px 24px rgba(0,0,0,.17);
  }

  .mw-calendar-stat-icon {
    display: grid;
    place-items: center;
    width: 46px;
    height: 46px;
    border: 1px solid rgba(225,29,50,.25);
    border-radius: 11px;
    color: #ff3349;
    background: rgba(134,0,16,.16);
  }

  .mw-calendar-stat-icon svg {
    width: 22px;
    height: 22px;
  }

  .mw-calendar-stat span,
  .mw-calendar-stat strong,
  .mw-calendar-stat small {
    display: block;
  }

  .mw-calendar-stat span {
    color: #9ba5ad;
    font-size: .62rem;
    font-weight: 900;
    letter-spacing: .07em;
    text-transform: uppercase;
  }

  .mw-calendar-stat strong {
    margin-top: 3px;
    color: #fff;
    font-size: 1.65rem;
    line-height: 1;
  }

  .mw-calendar-stat small {
    margin-top: 5px;
    color: #68737b;
    font-size: .55rem;
  }

  .mw-calendar-filters {
    padding: 16px;
    border: 1px solid #303941;
    border-radius: 14px;
    background: #10161a;
  }

  .mw-calendar-filter-grid {
    display: grid;
    grid-template-columns: minmax(220px, 1.6fr) minmax(170px, .8fr) minmax(170px, .8fr) auto;
    align-items: end;
    gap: 12px;
  }

  .mw-calendar-main {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 330px;
    align-items: start;
    gap: 16px;
  }

  .mw-calendar-board,
  .mw-calendar-side {
    overflow: hidden;
    border: 1px solid #303941;
    border-radius: 15px;
    background: #10161a;
    box-shadow: 0 13px 30px rgba(0,0,0,.18);
  }

  .mw-calendar-board-head,
  .mw-calendar-side-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
    min-height: 66px;
    padding: 14px 16px;
    border-bottom: 1px solid #303941;
  }

  .mw-calendar-month-title {
    color: #fff;
    font-size: 1.05rem;
    font-weight: 900;
    letter-spacing: .055em;
    text-transform: uppercase;
  }

  .mw-calendar-weekdays,
  .mw-calendar-week {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
  }

  .mw-calendar-week {
    position: relative;
  }

  .mw-calendar-span-layer {
    position: absolute;
    inset: 0;
    z-index: 3;
    pointer-events: none;
  }

  .mw-calendar-span-event {
    position: absolute;
    top: calc(42px + (var(--span-lane) * 27px));
    left: calc((100% / 7) * var(--span-start) + 8px);
    width: calc((100% / 7) * var(--span-days) - 16px);
    height: 23px;
    padding: 4px 9px 4px 12px;
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--event-color) 48%, #252d33);
    border-left: 5px solid var(--event-color);
    border-radius: 5px;
    color: #fff;
    background: color-mix(in srgb, var(--event-color) 22%, #182026);
    box-shadow: 0 3px 10px rgba(0,0,0,.28);
    font: inherit;
    font-size: .56rem;
    font-weight: 900;
    line-height: 1.2;
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;
    pointer-events: auto;
  }

  .mw-calendar-span-event:hover {
    filter: brightness(1.18);
  }

  .mw-calendar-weekday {
    display: grid;
    place-items: center;
    min-height: 34px;
    border-right: 1px solid #2d353b;
    border-bottom: 1px solid #343c43;
    color: #7f8991;
    background: #0d1215;
    font-size: .54rem;
    font-weight: 950;
    letter-spacing: .1em;
  }

  .mw-calendar-weekday:last-child {
    border-right: 0;
  }

  .mw-calendar-day {
    position: relative;
    min-width: 0;
    min-height: 132px;
    padding: 8px;
    border: 0;
    border-right: 1px solid #2d353b;
    border-bottom: 1px solid #2d353b;
    color: #e9ecee;
    background: #11171b;
    text-align: left;
  }

  .mw-calendar-day:nth-child(7n) {
    border-right: 0;
  }

  .mw-calendar-day.outside {
    background: #0d1215;
  }

  .mw-calendar-day.weekend:not(.today) {
    background: #0f1519;
  }

  .mw-calendar-day.today {
    background:
      linear-gradient(145deg, rgba(135,0,17,.13), transparent 60%),
      #12181c;
  }

  .mw-calendar-day:hover {
    background: #171e23;
  }

  .mw-company-date-marker-v3 {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 26px;
    height: 26px;
    padding: 0 4px;
    border: 0;
    border-radius: 3px;
    color: #f4f6f7;
    background: transparent;
    cursor: pointer;
    font-family: inherit;
    font-size: .82rem;
    font-weight: 950;
    line-height: 1;
    user-select: none;
    text-shadow: 0 1px 2px rgba(0,0,0,.7);
    transition:
      color 140ms ease,
      background 140ms ease,
      transform 140ms ease;
  }

  .mw-company-date-marker-v3:hover {
    color: #ffffff;
    background: rgba(255,255,255,.08);
    transform: translateY(-1px);
  }

  .mw-calendar-day.outside .mw-company-date-marker-v3 {
    color: #59636a;
    opacity: .72;
  }

  .mw-calendar-day.weekend:not(.outside):not(.today)
    .mw-company-date-marker-v3 {
    color: #b8c0c5;
  }

  .mw-calendar-day.today .mw-company-date-marker-v3 {
    min-width: 31px;
    height: 27px;
    padding: 0 7px;
    color: #fff;
    background: linear-gradient(145deg, #e00020, #a90014);
    border-radius: 4px;
    box-shadow:
      0 0 0 3px rgba(225,29,50,.12),
      0 5px 14px rgba(225,29,50,.34);
  }

  .mw-calendar-events {
    display: grid;
    gap: 4px;
    margin-top: calc(6px + (var(--span-lanes, 0) * 27px));
  }

  .mw-calendar-event {
    position: relative;
    display: block;
    width: 100%;
    min-width: 0;
    padding: 5px 6px 5px 10px;
    overflow: hidden;
    border: 1px solid rgba(255,255,255,.07);
    border-radius: 5px;
    color: #f6f7f8;
    background: #1a2126;
    font-size: .54rem;
    font-weight: 800;
    line-height: 1.25;
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;
  }

  .mw-calendar-event::before {
    content: "";
    position: absolute;
    inset: 0 auto 0 0;
    width: 4px;
    background: var(--event-color);
  }

  .mw-calendar-more {
    display: block;
    padding-left: 4px;
    color: #8e98a0;
    font-size: .5rem;
    font-weight: 800;
  }

  .mw-calendar-side-head strong,
  .mw-calendar-side-head span {
    display: block;
  }

  .mw-calendar-side-head strong {
    color: #fff;
    font-size: .83rem;
    text-transform: uppercase;
  }

  .mw-calendar-side-head span {
    margin-top: 3px;
    color: #6f7a82;
    font-size: .55rem;
  }

  .mw-calendar-upcoming {
    display: grid;
    max-height: 710px;
    overflow-y: auto;
  }

  .mw-calendar-upcoming-item {
    display: grid;
    grid-template-columns: 42px minmax(0, 1fr);
    gap: 11px;
    width: 100%;
    min-height: 74px;
    padding: 11px 13px;
    border: 0;
    border-bottom: 1px solid #2c343a;
    color: #e8ebed;
    background: transparent;
    text-align: left;
    cursor: pointer;
  }

  .mw-calendar-upcoming-item:hover {
    background: rgba(255,255,255,.025);
  }

  .mw-calendar-upcoming-date {
    display: grid;
    place-items: center;
    align-self: start;
    min-height: 44px;
    border: 1px solid #3b444b;
    border-radius: 8px;
    background: #151b20;
    text-align: center;
  }

  .mw-calendar-upcoming-date strong,
  .mw-calendar-upcoming-date span {
    display: block;
  }

  .mw-calendar-upcoming-date strong {
    color: #fff;
    font-size: .88rem;
    line-height: 1;
  }

  .mw-calendar-upcoming-date span {
    margin-top: 3px;
    color: #ff4056;
    font-size: .48rem;
    font-weight: 900;
    text-transform: uppercase;
  }

  .mw-calendar-upcoming-copy {
    min-width: 0;
  }

  .mw-calendar-upcoming-copy strong,
  .mw-calendar-upcoming-copy span,
  .mw-calendar-upcoming-copy small {
    display: block;
  }

  .mw-calendar-upcoming-copy strong {
    overflow: hidden;
    color: #fff;
    font-size: .64rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mw-calendar-upcoming-copy span {
    margin-top: 4px;
    color: #8e989f;
    font-size: .53rem;
  }

  .mw-calendar-upcoming-copy small {
    margin-top: 5px;
    color: #68737b;
    font-size: .5rem;
  }

  .mw-calendar-empty {
    display: grid;
    place-items: center;
    min-height: 190px;
    padding: 28px;
    color: #748089;
    font-size: .66rem;
    text-align: center;
  }

  .mw-calendar-legend {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 9px 15px;
    padding: 12px 15px;
    border-top: 1px solid #303941;
    background: #0d1215;
  }

  .mw-calendar-legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #8b959d;
    font-size: .52rem;
  }

  .mw-calendar-legend-item i {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--legend-color);
  }

  .mw-calendar-modal-summary {
    padding: 13px;
    border: 1px solid #333c43;
    border-radius: 10px;
    background: #11171b;
  }

  @container (max-width: 1180px) {
    .mw-calendar-hero {
      grid-template-columns: 1fr;
    }

    .mw-calendar-hero-actions {
      justify-content: flex-start;
    }

    .mw-calendar-main {
      grid-template-columns: 1fr;
    }

    .mw-calendar-upcoming {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      max-height: none;
    }

    .mw-calendar-upcoming-item:nth-child(odd) {
      border-right: 1px solid #2c343a;
    }
  }

  @container (max-width: 850px) {
    .mw-calendar-stats {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .mw-calendar-filter-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .mw-calendar-day {
      min-height: 108px;
      padding: 6px;
    }
  }

  @container (max-width: 620px) {
    .mw-calendar-title {
      align-items: flex-start;
    }

    .mw-calendar-filter-grid,
    .mw-calendar-upcoming {
      grid-template-columns: 1fr;
    }

    .mw-calendar-upcoming-item:nth-child(odd) {
      border-right: 0;
    }

    .mw-calendar-board {
      overflow-x: auto;
    }

    .mw-calendar-weekdays,
    .mw-calendar-grid {
      min-width: 760px;
    }

    .mw-calendar-week {
      min-width: 760px;
    }
  }

  @container (max-width: 430px) {
    .mw-calendar-stats {
      grid-template-columns: 1fr;
    }

    .mw-calendar-title {
      flex-wrap: wrap;
    }

    .mw-calendar-title-copy {
      width: 100%;
    }
  }
`;

function pad(value) {
  return String(value).padStart(2, "0");
}

function toLocalInputValue(dateValue) {
  const date = dateValue ? new Date(dateValue) : new Date();

  if (Number.isNaN(date.getTime())) return "";

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function startOfDay(dateValue) {
  const date = new Date(dateValue);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(dateValue) {
  const date = new Date(dateValue);
  date.setHours(23, 59, 59, 999);
  return date;
}

function sameDay(first, second) {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

function buildMonthDays(monthDate) {
  const first = new Date(
    monthDate.getFullYear(),
    monthDate.getMonth(),
    1
  );
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - first.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
}

function eventTouchesDay(event, day) {
  const start = new Date(event.start_at);
  const end = new Date(event.end_at);
  return start <= endOfDay(day) && end >= startOfDay(day);
}

function isMultiDayEvent(event) {
  return !sameDay(new Date(event.start_at), new Date(event.end_at));
}

function buildWeekSpans(weekDays, events) {
  const weekStart = startOfDay(weekDays[0]);
  const weekEnd = endOfDay(weekDays[6]);
  const laneEnds = [];

  return events
    .filter(isMultiDayEvent)
    .filter((event) => new Date(event.start_at) <= weekEnd && new Date(event.end_at) >= weekStart)
    .sort((first, second) => new Date(first.start_at) - new Date(second.start_at))
    .map((event) => {
      const startIndex = Math.max(0, weekDays.findIndex((day) => eventTouchesDay(event, day)));
      let endIndex = startIndex;
      weekDays.forEach((day, index) => {
        if (eventTouchesDay(event, day)) endIndex = index;
      });
      let lane = laneEnds.findIndex((lastEnd) => lastEnd < startIndex);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = endIndex;

      return {
        event,
        startIndex,
        dayCount: endIndex - startIndex + 1,
        lane,
        continuesBefore: new Date(event.start_at) < weekStart,
        continuesAfter: new Date(event.end_at) > weekEnd,
      };
    });
}

function formatEventTime(event) {
  if (event.all_day) return "All day";

  const start = new Date(event.start_at);
  const end = new Date(event.end_at);

  return `${start.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })}–${end.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

function emptyForm(dateValue = new Date()) {
  const start = new Date(dateValue);
  start.setHours(8, 0, 0, 0);

  const end = new Date(dateValue);
  end.setHours(9, 0, 0, 0);

  return {
    id: "",
    title: "",
    event_type: "Company Event",
    start_at: toLocalInputValue(start),
    end_at: toLocalInputValue(end),
    all_day: false,
    employee_profile_id: "",
    department: "",
    location: "",
    notes: "",
    status: "Scheduled",
    priority: "Normal",
    created_by: "",
    outside_project_id: "",
    outside_project_milestone: "General Work",
    is_project_schedule: false,
  };
}

function CompanyCalendar({ authenticatedProfile, openProject }) {
  const [monthDate, setMonthDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const [events, setEvents] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [outsideProjects, setOutsideProjects] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [currentProfile, setCurrentProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [employeeFilter, setEmployeeFilter] = useState("All");
  const [modalOpened, setModalOpened] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [googleConnection, setGoogleConnection] = useState(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    loadCalendar();
  }, [monthDate]);

  useEffect(() => {
    if (String(authenticatedProfile?.access_level || "").toLowerCase().includes("admin")) {
      loadGoogleStatus();
    }
  }, [authenticatedProfile]);

  async function calendarAction(action, payload = {}) {
    const { data, error } = await supabase.functions.invoke("google-calendar-sync", {
      body: { action, ...payload },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  }

  function projectGoogleSource(milestone) {
    return {
      "Site Visit": "project_site_visit",
      "Test Fit": "project_test_fit",
      Installation: "project_install",
      "General Work": "project_general_work",
    }[milestone || "General Work"] || "project_general_work";
  }

  async function pushGoogleChange(sourceType, sourceId) {
    if (googleConnection?.status !== "Connected" || !sourceId) return false;
    try {
      await calendarAction("push", { source_type: sourceType, source_id: String(sourceId) });
      await loadGoogleStatus();
      return true;
    } catch (error) {
      notifications.show({
        color: "orange",
        title: "Saved in Metal Worx OS",
        message: `Google Calendar did not update: ${error.message}`,
      });
      return false;
    }
  }

  async function loadGoogleStatus() {
    try {
      const data = await calendarAction("status");
      setGoogleConnection(data?.connection || null);
    } catch (error) {
      console.error("Google Calendar status error:", error);
    }
  }

  async function connectGoogleCalendar() {
    setGoogleLoading(true);
    try {
      const data = await calendarAction("authorize");
      if (!data?.authorization_url) throw new Error("Google authorization could not be started.");
      window.location.assign(data.authorization_url);
    } catch (error) {
      notifications.show({ color: "red", title: "Google Calendar connection failed", message: error.message });
      setGoogleLoading(false);
    }
  }

  async function syncGoogleCalendar() {
    setGoogleLoading(true);
    try {
      const data = await calendarAction("sync");
      const result = data?.result || {};
      notifications.show({
        color: "green",
        title: "Calendars synchronized",
        message: `${result.imported || 0} imported, ${result.exported || 0} sent to Google, and ${result.updated || 0} updated.`,
      });
      await Promise.all([loadCalendar(), loadGoogleStatus()]);
    } catch (error) {
      notifications.show({ color: "red", title: "Calendar sync failed", message: error.message });
    } finally {
      setGoogleLoading(false);
    }
  }

  async function loadCalendar() {
    setLoading(true);
    setLoadError("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      setCurrentUser(user || null);

      const monthDays = buildMonthDays(monthDate);
      const rangeStart = startOfDay(monthDays[0]).toISOString();
      const rangeEnd = endOfDay(
        monthDays[monthDays.length - 1]
      ).toISOString();

      const [eventsResult, employeesResult, profileResult, projectsResult] =
        await Promise.all([
          supabase
            .from("company_calendar_events")
            .select(
              `
                *,
                employee_profile:employee_profiles!company_calendar_events_employee_profile_id_fkey(
                  id,
                  display_name,
                  department
                )
              `
            )
            .lte("start_at", rangeEnd)
            .gte("end_at", rangeStart)
            .neq("status", "Cancelled")
            .order("start_at", { ascending: true }),
          supabase
            .from("employee_profiles")
            .select(
              "id, display_name, department, access_level, auth_user_id, is_active"
            )
            .eq("is_active", true)
            .order("display_name", { ascending: true }),
          user
            ? supabase
                .from("employee_profiles")
                .select(
                  "id, display_name, department, access_level, auth_user_id, is_active"
                )
                .eq("auth_user_id", user.id)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
          supabase
            .from("projects")
            .select(
              "id,project_number,project_name,project_type,status,is_active,work_location,job_address,city,state,planned_start_date,target_completion_date,site_visit_start,site_visit_end,site_visit_status,test_fit_start,test_fit_end,test_fit_status,install_start,install_end,install_status"
            )
            .eq("is_active", true)
            .order("project_name", { ascending: true }),
        ]);

      if (eventsResult.error) throw eventsResult.error;
      if (employeesResult.error) throw employeesResult.error;
      if (profileResult.error) throw profileResult.error;
      if (projectsResult.error) throw projectsResult.error;

      const calendarEvents = eventsResult.data || [];
      const linkedKeys = new Set(
        calendarEvents
          .filter((event) => event.outside_project_id)
          .map(
            (event) =>
              `${event.outside_project_id}:${event.outside_project_milestone || "General Work"}`
          )
      );
      const projectEvents = [];
      for (const project of projectsResult.data || []) {
        const milestones = [
          ["Site Visit", project.site_visit_start, project.site_visit_end, project.site_visit_status],
          ["Test Fit", project.test_fit_start, project.test_fit_end, project.test_fit_status],
          ["Installation", project.install_start, project.install_end, project.install_status],
          ["General Work", project.planned_start_date, project.target_completion_date, project.status],
        ];
        for (const [milestone, startValue, endValue, milestoneStatus] of milestones) {
          if (["completed", "closed", "archived", "cancelled"].includes(String(milestoneStatus || "").toLowerCase())) continue;
          if (!startValue || linkedKeys.has(`${project.id}:${milestone}`)) continue;
          const start = new Date(startValue);
          const end = endValue ? new Date(endValue) : new Date(start.getTime() + 60 * 60 * 1000);
          if (end < new Date(rangeStart) || start > new Date(rangeEnd)) continue;
          projectEvents.push({
            id: `project-${project.id}-${milestone}`,
            title: `${project.project_name} — ${milestone}`,
            event_type: "Outside Job",
            start_at: start.toISOString(),
            end_at: end.toISOString(),
            all_day: milestone === "General Work",
            department: "Outside Fabrication",
            location: project.work_location || project.job_address || null,
            status: project.status || "Scheduled",
            priority: "Normal",
            outside_project_id: project.id,
            outside_project_milestone: milestone,
            project,
            is_project_schedule: true,
          });
        }
      }
      const mergedEvents = calendarEvents.map((event) => {
        if (!event.outside_project_id) return event;
        const project = (projectsResult.data || []).find(
          (item) => String(item.id) === String(event.outside_project_id)
        );
        if (!project) return event;
        const milestone = event.outside_project_milestone || "General Work";
        const schedule = {
          "Site Visit": [project.site_visit_start, project.site_visit_end],
          "Test Fit": [project.test_fit_start, project.test_fit_end],
          Installation: [project.install_start, project.install_end],
          "General Work": [project.planned_start_date, project.target_completion_date],
        }[milestone];
        return schedule?.[0]
          ? {
              ...event,
              start_at: new Date(schedule[0]).toISOString(),
              end_at: schedule[1]
                ? new Date(schedule[1]).toISOString()
                : event.end_at,
              project,
            }
          : { ...event, project };
      });
      setEvents([
        ...mergedEvents.filter(
          (event) => !["Completed", "Cancelled"].includes(event.status)
        ),
        ...projectEvents,
      ]);
      setEmployees(employeesResult.data || []);
      setOutsideProjects(projectsResult.data || []);
      setCurrentProfile(profileResult.data || null);
    } catch (error) {
      console.error("Company Calendar load error:", error);
      setLoadError(error.message || "The company calendar could not load.");
    } finally {
      setLoading(false);
    }
  }

  const monthDays = useMemo(
    () => buildMonthDays(monthDate),
    [monthDate]
  );

  const monthWeeks = useMemo(
    () => Array.from({ length: 6 }, (_, index) => monthDays.slice(index * 7, index * 7 + 7)),
    [monthDays]
  );

  const employeeOptions = useMemo(
    () =>
      employees.map((employee) => ({
        value: employee.id,
        label: employee.display_name,
      })),
    [employees]
  );

  const outsideProjectOptions = useMemo(
    () =>
      outsideProjects.map((project) => ({
        value: String(project.id),
        label: `${project.project_number ? `${project.project_number} · ` : ""}${project.project_name}`,
      })),
    [outsideProjects]
  );

  const filteredEvents = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    return events.filter((event) => {
      if (
        typeFilter !== "All" &&
        event.event_type !== typeFilter
      ) {
        return false;
      }

      if (
        employeeFilter !== "All" &&
        event.employee_profile_id !== employeeFilter
      ) {
        return false;
      }

      if (!searchValue) return true;

      return [
        event.title,
        event.event_type,
        event.department,
        event.location,
        event.notes,
        event.employee_profile?.display_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(searchValue);
    });
  }, [events, search, typeFilter, employeeFilter]);

  const upcomingEvents = useMemo(() => {
    const now = new Date();

    return filteredEvents
      .filter((event) => new Date(event.end_at) >= now)
      .sort(
        (first, second) =>
          new Date(first.start_at) - new Date(second.start_at)
      )
      .slice(0, 12);
  }, [filteredEvents]);

  const stats = useMemo(() => {
    const now = new Date();
    const sevenDays = new Date();
    sevenDays.setDate(sevenDays.getDate() + 7);

    const currentMonth = filteredEvents.filter((event) => {
      const start = new Date(event.start_at);
      return (
        start.getMonth() === monthDate.getMonth() &&
        start.getFullYear() === monthDate.getFullYear()
      );
    });

    return {
      month: currentMonth.length,
      upcoming: filteredEvents.filter((event) => {
        const start = new Date(event.start_at);
        return start >= now && start <= sevenDays;
      }).length,
      unavailable: currentMonth.filter((event) =>
        ["Employee Unavailable", "Time Off"].includes(
          event.event_type
        )
      ).length,
      important: currentMonth.filter((event) =>
        ["High", "Critical"].includes(event.priority)
      ).length,
    };
  }, [filteredEvents, monthDate]);

  const isAdministrator =
    currentProfile?.access_level === "Administrator";

  function previousMonth() {
    setMonthDate(
      new Date(
        monthDate.getFullYear(),
        monthDate.getMonth() - 1,
        1
      )
    );
  }

  function nextMonth() {
    setMonthDate(
      new Date(
        monthDate.getFullYear(),
        monthDate.getMonth() + 1,
        1
      )
    );
  }

  function goToToday() {
    const today = new Date();
    setMonthDate(
      new Date(today.getFullYear(), today.getMonth(), 1)
    );
  }

  function openNewEvent(dateValue = new Date()) {
    const nextForm = emptyForm(dateValue);

    if (currentProfile) {
      nextForm.employee_profile_id = currentProfile.id;
      nextForm.department = currentProfile.department || "";
    }

    setForm(nextForm);
    setModalOpened(true);
  }

  function openExistingEvent(event) {
    setForm({
      id: event.is_project_schedule ? "" : event.id,
      title: event.title || "",
      event_type: event.event_type || "Company Event",
      start_at: toLocalInputValue(event.start_at),
      end_at: toLocalInputValue(event.end_at),
      all_day: Boolean(event.all_day),
      employee_profile_id: event.employee_profile_id || "",
      department: event.department || "",
      location: event.location || "",
      notes: event.notes || "",
      status: event.status || "Scheduled",
      priority: event.priority || "Normal",
      created_by: event.created_by || "",
      outside_project_id: event.outside_project_id
        ? String(event.outside_project_id)
        : "",
      outside_project_milestone:
        event.outside_project_milestone || "General Work",
      is_project_schedule: Boolean(event.is_project_schedule),
    });
    setModalOpened(true);
  }

  function updateForm(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function saveEvent() {
    if (!form.title.trim()) {
      notifications.show({
        color: "red",
        title: "Event title required",
        message: "Enter a clear title for this calendar event.",
      });
      return;
    }

    const start = new Date(form.start_at);
    const end = new Date(form.end_at);

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime())
    ) {
      notifications.show({
        color: "red",
        title: "Date required",
        message: "Enter a valid start and end date.",
      });
      return;
    }

    if (end < start) {
      notifications.show({
        color: "red",
        title: "Invalid date range",
        message: "The event must end after it starts.",
      });
      return;
    }

    setSaving(true);

    try {
      const requiresApproval =
        !isAdministrator &&
        ["Time Off", "Employee Unavailable"].includes(
          form.event_type
        );

      const payload = {
        title: form.title.trim(),
        event_type: form.event_type,
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        all_day: form.all_day,
        employee_profile_id:
          form.employee_profile_id || null,
        department: form.department || null,
        location: form.location.trim() || null,
        notes: form.notes.trim() || null,
        priority: form.priority,
        requires_approval: requiresApproval,
        status: requiresApproval
          ? "Pending Approval"
          : form.status,
        outside_project_id:
          form.event_type === "Outside Job" && form.outside_project_id
            ? Number(form.outside_project_id)
            : null,
        outside_project_milestone:
          form.event_type === "Outside Job" && form.outside_project_id
            ? form.outside_project_milestone || "General Work"
            : null,
      };

      if (form.event_type === "Outside Job" && form.outside_project_id) {
        const projectPatch = {};
        if (form.outside_project_milestone === "Site Visit") {
          Object.assign(projectPatch, {
            site_visit_required: true,
            site_visit_start: start.toISOString(),
            site_visit_end: end.toISOString(),
          });
        } else if (form.outside_project_milestone === "Test Fit") {
          Object.assign(projectPatch, {
            test_fit_required: true,
            test_fit_start: start.toISOString(),
            test_fit_end: end.toISOString(),
          });
        } else if (form.outside_project_milestone === "Installation") {
          Object.assign(projectPatch, {
            install_required: true,
            install_start: start.toISOString(),
            install_end: end.toISOString(),
          });
        } else {
          Object.assign(projectPatch, {
            planned_start_date: start.toISOString().slice(0, 10),
            target_completion_date: end.toISOString().slice(0, 10),
          });
        }
        const { error: projectError } = await supabase
          .from("projects")
          .update(projectPatch)
          .eq("id", Number(form.outside_project_id));
        if (projectError) throw projectError;
      }

      let result;

      if (form.id) {
        result = await supabase
          .from("company_calendar_events")
          .update(payload)
          .eq("id", form.id)
          .select()
          .single();
      } else {
        result = await supabase
          .from("company_calendar_events")
          .insert(payload)
          .select()
          .single();
      }

      if (result.error) throw result.error;

      const googleUpdated = form.event_type === "Outside Job" && form.outside_project_id
        ? await pushGoogleChange(projectGoogleSource(form.outside_project_milestone), form.outside_project_id)
        : await pushGoogleChange("company_event", result.data.id);

      notifications.show({
        color: "green",
        title: form.id ? "Event updated" : "Event added",
        message: requiresApproval
          ? "The event was saved and marked pending approval."
          : googleUpdated
            ? "Metal Worx OS and Kory's Google Calendar were updated."
            : "The company calendar has been updated.",
      });

      setModalOpened(false);
      await loadCalendar();
    } catch (error) {
      console.error("Company Calendar save error:", error);
      notifications.show({
        color: "red",
        title: "Calendar update failed",
        message: error.message || "The event could not be saved.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function deleteEvent() {
    if (!form.id) return;

    const canDelete =
      isAdministrator || form.created_by === currentUser?.id;

    if (!canDelete) {
      notifications.show({
        color: "red",
        title: "Permission required",
        message:
          "Only the event creator or an Administrator can remove this event.",
      });
      return;
    }

    if (!window.confirm(`Delete "${form.title}" from the calendar?`)) {
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase
        .from("company_calendar_events")
        .update({ status: "Cancelled" })
        .eq("id", form.id);

      if (error) throw error;

      const googleUpdated = await pushGoogleChange("company_event", form.id);

      notifications.show({
        color: "green",
        title: "Event cancelled",
        message: googleUpdated
          ? "The event was removed from Metal Worx OS and Kory's Google Calendar."
          : "The event was cancelled in Metal Worx OS.",
      });

      setModalOpened(false);
      await loadCalendar();
    } catch (error) {
      notifications.show({
        color: "red",
        title: "Delete failed",
        message: error.message || "The event could not be deleted.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function completeEvent() {
    if (!form.id && !form.is_project_schedule) return;
    setSaving(true);
    try {
      if (form.id) {
        const { error } = await supabase
          .from("company_calendar_events")
          .update({ status: "Completed", updated_by: currentUser?.id || null })
          .eq("id", form.id);
        if (error) throw error;
      } else if (form.is_project_schedule) {
        const { error } = await supabase
          .from("company_calendar_events")
          .insert({
            title: form.title.trim(),
            event_type: "Outside Job",
            start_at: new Date(form.start_at).toISOString(),
            end_at: new Date(form.end_at).toISOString(),
            all_day: form.all_day,
            department: form.department || "Outside Fabrication",
            location: form.location.trim() || null,
            notes: form.notes.trim() || null,
            status: "Completed",
            priority: form.priority || "Normal",
            created_by: currentUser?.id,
            updated_by: currentUser?.id,
            outside_project_id: Number(form.outside_project_id),
            outside_project_milestone:
              form.outside_project_milestone || "General Work",
          });
        if (error) throw error;
      }

      if (form.outside_project_id) {
        const milestoneField = {
          "Site Visit": "site_visit_status",
          "Test Fit": "test_fit_status",
          Installation: "install_status",
        }[form.outside_project_milestone];
        if (milestoneField) {
          const { error } = await supabase
            .from("projects")
            .update({ [milestoneField]: "Completed" })
            .eq("id", Number(form.outside_project_id));
          if (error) throw error;
        }
      }

      if (form.outside_project_id) {
        await pushGoogleChange(projectGoogleSource(form.outside_project_milestone), form.outside_project_id);
      } else if (form.id) {
        await pushGoogleChange("company_event", form.id);
      }

      notifications.show({
        color: "green",
        title: "Calendar activity completed",
        message: "It was removed from the active calendar and retained in history.",
      });
      setModalOpened(false);
      await loadCalendar();
    } catch (error) {
      notifications.show({
        color: "red",
        title: "Could not complete activity",
        message: error.message || "The calendar activity could not be completed.",
      });
    } finally {
      setSaving(false);
    }
  }

  function eventsForDay(day) {
    return filteredEvents
      .filter((event) => !isMultiDayEvent(event))
      .filter((event) => eventTouchesDay(event, day))
      .sort(
        (first, second) =>
          new Date(first.start_at) - new Date(second.start_at)
      );
  }

  return (
    <div className="mw-calendar">
      <style>{calendarStyles}</style>

      <section className="mw-calendar-hero">
        <div className="mw-calendar-title">
          <div className="mw-calendar-title-icon">
            <IconCalendarEvent />
          </div>
          <div className="mw-calendar-title-copy">
            <span className="mw-calendar-eyebrow">
              Metal Worx OS
            </span>
            <h1>Company Calendar</h1>
            <p>
              Employee availability, company events, closures, training,
              maintenance, deliveries, and important dates in one shared
              calendar.
            </p>
          </div>
        </div>

        <div className="mw-calendar-hero-actions">
          <Button
            color="red"
            leftSection={<IconPlus size={17} />}
            onClick={() => openNewEvent(new Date())}
          >
            Add Calendar Event
          </Button>
          <Button
            variant="default"
            leftSection={<IconRefresh size={17} />}
            loading={loading}
            onClick={loadCalendar}
          >
            Refresh
          </Button>
        </div>
      </section>

      {String(authenticatedProfile?.access_level || "")
        .toLowerCase()
        .includes("admin") && (
        <Paper withBorder radius="md" p="md" bg="#11171b">
          <Group justify="space-between" align="center" wrap="wrap">
            <Group gap="sm">
              <IconBrandGoogle size={26} color="#4285f4" />
              <div>
                <Text fw={900}>Kory’s Google Calendar</Text>
                <Text size="sm" c="dimmed">
                  {googleConnection?.status === "Connected"
                    ? `Connected as ${googleConnection.google_email}. Changes move both ways between Google and Metal Worx OS.`
                    : "Connect kory@metalworxinc.net for two-way calendar synchronization."}
                </Text>
                {googleConnection?.last_sync_completed_at && (
                  <Text
                    size="xs"
                    c={
                      googleConnection.last_sync_status === "Error"
                        ? "red"
                        : "dimmed"
                    }
                  >
                    Last sync: {new Date(
                      googleConnection.last_sync_completed_at,
                    ).toLocaleString()} · {googleConnection.last_sync_status}
                  </Text>
                )}
              </div>
            </Group>
            {googleConnection?.status === "Connected" ? (
              <Button
                leftSection={<IconRefresh size={17} />}
                loading={googleLoading}
                onClick={syncGoogleCalendar}
              >
                Sync Now
              </Button>
            ) : (
              <Button
                leftSection={<IconBrandGoogle size={17} />}
                loading={googleLoading}
                onClick={connectGoogleCalendar}
              >
                Connect Kory’s Calendar
              </Button>
            )}
          </Group>
        </Paper>
      )}

      {loadError && (
        <Alert
          color="red"
          icon={<IconAlertTriangle size={18} />}
          title="Company Calendar could not load"
        >
          {loadError}
        </Alert>
      )}

      <section className="mw-calendar-stats">
        {[
          {
            label: "Events This Month",
            value: stats.month,
            detail: monthDate.toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            }),
            icon: IconCalendarEvent,
          },
          {
            label: "Next Seven Days",
            value: stats.upcoming,
            detail: "Upcoming company dates",
            icon: IconClock,
          },
          {
            label: "Employee Availability",
            value: stats.unavailable,
            detail: "Time off or unavailable",
            icon: IconUsers,
          },
          {
            label: "Important Events",
            value: stats.important,
            detail: "High or critical priority",
            icon: IconAlertTriangle,
          },
        ].map((item) => {
          const StatIcon = item.icon;

          return (
            <article className="mw-calendar-stat" key={item.label}>
              <div className="mw-calendar-stat-icon">
                <StatIcon />
              </div>
              <div>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <small>{item.detail}</small>
              </div>
            </article>
          );
        })}
      </section>

      <section className="mw-calendar-filters">
        <div className="mw-calendar-filter-grid">
          <TextInput
            label="Search Calendar"
            placeholder="Search event, employee, department, or location"
            leftSection={<IconSearch size={17} />}
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
          />
          <Select
            label="Event Type"
            data={["All", ...EVENT_TYPES]}
            value={typeFilter}
            onChange={(value) => setTypeFilter(value || "All")}
          />
          <Select
            label="Employee"
            searchable
            data={[
              { value: "All", label: "All Employees" },
              ...employeeOptions,
            ]}
            value={employeeFilter}
            onChange={(value) => setEmployeeFilter(value || "All")}
          />
          <Button
            variant="default"
            leftSection={<IconX size={16} />}
            onClick={() => {
              setSearch("");
              setTypeFilter("All");
              setEmployeeFilter("All");
            }}
          >
            Clear Filters
          </Button>
        </div>
      </section>

      <section className="mw-calendar-main">
        <article className="mw-calendar-board">
          <div className="mw-calendar-board-head">
            <Group gap="xs">
              <Tooltip label="Previous month">
                <ActionIcon
                  variant="default"
                  size="lg"
                  onClick={previousMonth}
                >
                  <IconChevronLeft size={18} />
                </ActionIcon>
              </Tooltip>
              <Button variant="default" onClick={goToToday}>
                Today
              </Button>
              <Tooltip label="Next month">
                <ActionIcon
                  variant="default"
                  size="lg"
                  onClick={nextMonth}
                >
                  <IconChevronRight size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>

            <div className="mw-calendar-month-title">
              {monthDate.toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </div>

            <Button
              color="red"
              variant="light"
              leftSection={<IconPlus size={16} />}
              onClick={() => openNewEvent(new Date())}
            >
              Add Event
            </Button>
          </div>

          <div className="mw-calendar-weekdays">
            {DAYS.map((day) => (
              <div className="mw-calendar-weekday" key={day}>
                {day}
              </div>
            ))}
          </div>

          <div className="mw-calendar-grid">
            {monthWeeks.map((weekDays) => {
              const weekSpans = buildWeekSpans(weekDays, filteredEvents);
              const spanLaneCount = weekSpans.length
                ? Math.max(...weekSpans.map((span) => span.lane)) + 1
                : 0;

              return (
                <div className="mw-calendar-week" key={weekDays[0].toISOString()}>
                  {weekDays.map((day) => {
                    const dayEvents = eventsForDay(day);
                    const isOutside = day.getMonth() !== monthDate.getMonth();
                    const isToday = sameDay(day, new Date());
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;

                    return (
                      <div
                        key={day.toISOString()}
                        className={`mw-calendar-day ${isOutside ? "outside" : ""} ${isToday ? "today" : ""} ${isWeekend ? "weekend" : ""}`}
                        style={{ "--span-lanes": spanLaneCount }}
                        role="button"
                        tabIndex={0}
                        onDoubleClick={() => openNewEvent(day)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") openNewEvent(day);
                        }}
                      >
                        <span
                          className="mw-company-date-marker-v3"
                          role="button"
                          tabIndex={0}
                          onClick={() => openNewEvent(day)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              openNewEvent(day);
                            }
                          }}
                          title="Add event on this date"
                        >
                          {day.getDate()}
                        </span>

                        <div className="mw-calendar-events">
                          {dayEvents.slice(0, 3).map((event) => (
                            <button
                              key={event.id}
                              type="button"
                              className="mw-calendar-event"
                              style={{ "--event-color": EVENT_COLORS[event.event_type] || "#e11d32" }}
                              title={`${event.title} — ${formatEventTime(event)}`}
                              onClick={() => openExistingEvent(event)}
                            >
                              {event.all_day
                                ? event.title
                                : `${new Date(event.start_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} ${event.title}`}
                            </button>
                          ))}

                          {dayEvents.length > 3 && (
                            <span className="mw-calendar-more">+{dayEvents.length - 3} more</span>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  <div className="mw-calendar-span-layer" aria-label="Multi-day events">
                    {weekSpans.map(({ event, startIndex, dayCount, lane, continuesBefore, continuesAfter }) => (
                      <button
                        key={`${event.id}-${weekDays[0].toISOString()}`}
                        type="button"
                        className="mw-calendar-span-event"
                        style={{
                          "--event-color": EVENT_COLORS[event.event_type] || "#e11d32",
                          "--span-start": startIndex,
                          "--span-days": dayCount,
                          "--span-lane": lane,
                        }}
                        title={`${event.title} — ${formatEventTime(event)}`}
                        onClick={() => openExistingEvent(event)}
                      >
                        {continuesBefore ? "← " : ""}{event.title}{continuesAfter ? " →" : ""}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mw-calendar-legend">
            {EVENT_TYPES.map((type) => (
              <span className="mw-calendar-legend-item" key={type}>
                <i
                  style={{
                    "--legend-color": EVENT_COLORS[type],
                  }}
                />
                {type}
              </span>
            ))}
          </div>
        </article>

        <aside className="mw-calendar-side">
          <div className="mw-calendar-side-head">
            <div>
              <strong>Upcoming Events</strong>
              <span>Next scheduled company dates</span>
            </div>
            <Badge color="red" variant="light">
              {upcomingEvents.length}
            </Badge>
          </div>

          {upcomingEvents.length === 0 ? (
            <div className="mw-calendar-empty">
              No upcoming events match the current filters.
            </div>
          ) : (
            <div className="mw-calendar-upcoming">
              {upcomingEvents.map((event) => {
                const eventDate = new Date(event.start_at);

                return (
                  <button
                    key={`upcoming-${event.id}`}
                    type="button"
                    className="mw-calendar-upcoming-item"
                    onClick={() => openExistingEvent(event)}
                  >
                    <div className="mw-calendar-upcoming-date">
                      <div>
                        <strong>{eventDate.getDate()}</strong>
                        <span>
                          {eventDate.toLocaleDateString("en-US", {
                            month: "short",
                          })}
                        </span>
                      </div>
                    </div>
                    <div className="mw-calendar-upcoming-copy">
                      <strong>{event.title}</strong>
                      <span>
                        {formatEventTime(event)} · {event.event_type}
                      </span>
                      <small>
                        {event.employee_profile?.display_name ||
                          event.department ||
                          "Company-wide"}
                      </small>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </aside>
      </section>

      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={form.id ? "Edit Calendar Event" : "Add Calendar Event"}
        size="lg"
        centered
        overlayProps={{ backgroundOpacity: 0.72, blur: 4 }}
      >
        <Stack gap="md">
          <div className="mw-calendar-modal-summary">
            <Group gap="sm" wrap="nowrap">
              <IconCalendarEvent size={21} color="#ff3047" />
              <div>
                <Text fw={900}>
                  {form.id ? "Update Company Calendar" : "New Company Date"}
                </Text>
                <Text size="xs" c="dimmed">
                  Use the company calendar for availability and important
                  non-job events. Site visits and installs remain on Field
                  Schedule.
                </Text>
              </div>
            </Group>
          </div>

          <TextInput
            label="Event Title"
            placeholder="Example: Kory unavailable after 2:00 PM"
            value={form.title}
            onChange={(event) =>
              updateForm("title", event.currentTarget.value)
            }
            required
          />

          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Select
              label="Event Type"
              data={EVENT_TYPES}
              value={form.event_type}
              onChange={(value) => {
                const eventType = value || "Company Event";
                setForm((current) => ({
                  ...current,
                  event_type: eventType,
                  outside_project_id:
                    eventType === "Outside Job"
                      ? current.outside_project_id
                      : "",
                }));
              }}
              required
            />
            <Select
              label="Priority"
              data={PRIORITIES}
              value={form.priority}
              onChange={(value) =>
                updateForm("priority", value || "Normal")
              }
            />
          </SimpleGrid>

          {form.event_type === "Outside Job" && (
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <Select
                label="Link to Outside Project"
                description="You can link it now or edit the event and link it later."
                placeholder="Choose an active outside job"
                searchable
                clearable
                data={outsideProjectOptions}
                value={form.outside_project_id || null}
                leftSection={<IconBriefcase size={16} />}
                onChange={(value) => {
                  const project = outsideProjects.find(
                    (item) => String(item.id) === String(value)
                  );
                  setForm((current) => ({
                    ...current,
                    outside_project_id: value || "",
                    title:
                      current.title || project?.project_name || "",
                    location:
                      current.location ||
                      project?.work_location ||
                      project?.job_address ||
                      "",
                    department:
                      current.department || "Outside Fabrication",
                  }));
                }}
              />
              <Select
                label="Outside Job Activity"
                data={OUTSIDE_JOB_MILESTONES}
                value={form.outside_project_milestone}
                onChange={(value) =>
                  updateForm(
                    "outside_project_milestone",
                    value || "General Work"
                  )
                }
              />
            </SimpleGrid>
          )}

          <Checkbox
            label="All-day event"
            checked={form.all_day}
            onChange={(event) =>
              updateForm("all_day", event.currentTarget.checked)
            }
          />

          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput
              type="datetime-local"
              label="Starts"
              value={form.start_at}
              onChange={(event) =>
                updateForm("start_at", event.currentTarget.value)
              }
              required
            />
            <TextInput
              type="datetime-local"
              label="Ends"
              value={form.end_at}
              onChange={(event) =>
                updateForm("end_at", event.currentTarget.value)
              }
              required
            />
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Select
              label="Employee"
              placeholder="Company-wide or choose employee"
              searchable
              clearable
              data={employeeOptions}
              value={form.employee_profile_id || null}
              onChange={(value) => {
                updateForm("employee_profile_id", value || "");

                const employee = employees.find(
                  (item) => item.id === value
                );

                if (employee?.department) {
                  updateForm("department", employee.department);
                }
              }}
              leftSection={<IconUser size={16} />}
            />
            <Select
              label="Department"
              placeholder="Company-wide or choose department"
              searchable
              clearable
              data={DEPARTMENTS}
              value={form.department || null}
              onChange={(value) =>
                updateForm("department", value || "")
              }
              leftSection={<IconBuildingWarehouse size={16} />}
            />
          </SimpleGrid>

          <TextInput
            label="Location"
            placeholder="Optional location"
            leftSection={<IconMapPin size={16} />}
            value={form.location}
            onChange={(event) =>
              updateForm("location", event.currentTarget.value)
            }
          />

          <Textarea
            label="Notes"
            placeholder="Add any details employees need to know"
            minRows={3}
            autosize
            value={form.notes}
            onChange={(event) =>
              updateForm("notes", event.currentTarget.value)
            }
          />

          {form.id && isAdministrator && (
            <Select
              label="Status"
              data={[
                "Pending Approval",
                "Scheduled",
                "Completed",
                "Cancelled",
              ]}
              value={form.status}
              onChange={(value) =>
                updateForm("status", value || "Scheduled")
              }
            />
          )}

          {!isAdministrator &&
            ["Time Off", "Employee Unavailable"].includes(
              form.event_type
            ) && (
              <Alert color="yellow" icon={<IconAlertTriangle size={17} />}>
                This availability event will be saved as pending
                Administrator approval.
              </Alert>
            )}

          <Divider />

          <Group justify="space-between">
            <div>
              {(form.id || form.is_project_schedule) && (
                <Button
                  color="green"
                  variant="light"
                  loading={saving}
                  onClick={completeEvent}
                >
                  Mark Complete
                </Button>
              )}
              {form.outside_project_id && openProject && (
                <Button
                  variant="light"
                  leftSection={<IconBriefcase size={17} />}
                  onClick={() => {
                    const project = outsideProjects.find(
                      (item) =>
                        String(item.id) ===
                        String(form.outside_project_id)
                    );
                    if (project) {
                      setModalOpened(false);
                      openProject(project);
                    }
                  }}
                >
                  Open Outside Project
                </Button>
              )}
              {form.id &&
                (isAdministrator ||
                  form.created_by === currentUser?.id) && (
                  <Button
                    color="red"
                    variant="subtle"
                    leftSection={<IconTrash size={17} />}
                    loading={saving}
                    onClick={deleteEvent}
                  >
                    Delete Event
                  </Button>
                )}
            </div>

            <Group gap="sm">
              <Button
                variant="default"
                onClick={() => setModalOpened(false)}
              >
                Cancel
              </Button>
              <Button
                color="red"
                leftSection={
                  form.id ? (
                    <IconEdit size={17} />
                  ) : (
                    <IconPlus size={17} />
                  )
                }
                loading={saving}
                onClick={saveEvent}
              >
                {form.id ? "Save Changes" : "Add Event"}
              </Button>
            </Group>
          </Group>
        </Stack>
      </Modal>
    </div>
  );
}

export default CompanyCalendar;
