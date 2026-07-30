import { useEffect, useMemo, useState } from "react";

import {
  IconAlertTriangle,
  IconBolt,
  IconBox,
  IconBuildingFactory2,
  IconCalendarEvent,
  IconClipboardList,
  IconHammer,
  IconMapPin,
  IconRefresh,
  IconShieldCheck,
  IconSparkles,
  IconTool,
  IconTruckDelivery,
  IconUsers,
} from "@tabler/icons-react";

import { supabase } from "../lib/supabase";
import { getDashboardData } from "../services/dashboardService";
import metalWorxLogo from "../assets/metal-worx-official-transparent.png";

const styles = `
  .mc-page, .mc-page * { box-sizing: border-box; }
  .mc-page {
    --mc-red: #f21b2d;
    --mc-red-dark: #85000a;
    --mc-green: #76d43b;
    --mc-amber: #f3a51f;
    --mc-bg: #070b0e;
    --mc-panel: #10161a;
    --mc-panel-2: #151d22;
    --mc-line: #3a454d;
    --mc-muted: #8f9ba5;
    display: grid;
    gap: 12px;
    width: 100%;
    max-width: 1920px;
    margin: 0 auto;
    color: #f4f6f7;
  }
  .mc-button {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    min-height: 38px; padding: 0 10px; border: 1px solid #46515a; border-radius: 7px;
    color: #f4f6f7; background: linear-gradient(180deg, #182025, #11171b);
    font-family: inherit; font-size: .72rem; font-weight: 800; cursor: pointer; white-space: nowrap;
  }
  .mc-button:hover { border-color: var(--mc-red); background: #1d252b; }
  .mc-button.primary { border-color: #b60715; background: linear-gradient(180deg, #d30c1d, #8e000b); }
  .mc-button svg { width: 17px; height: 17px; }
  .mc-topbar {
    position: relative; display: grid; grid-template-columns: minmax(340px, 1fr) auto;
    align-items: center; gap: 18px; min-height: 98px; padding: 15px 18px;
    border: 1px solid var(--mc-line); border-radius: 8px;
    background:
      linear-gradient(90deg, rgba(7,11,14,.94), rgba(13,19,23,.96)),
      repeating-linear-gradient(135deg, transparent 0 28px, rgba(255,255,255,.025) 29px 30px);
    overflow: hidden;
  }
  .mc-topbar::after {
    content: ""; position: absolute; inset: 0; pointer-events: none; opacity: .22;
    background-image:
      linear-gradient(rgba(255,255,255,.07) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,.07) 1px, transparent 1px);
    background-size: 32px 32px;
    mask-image: linear-gradient(90deg, transparent 28%, #000 60%, transparent);
  }
  .mc-brand { position: relative; z-index: 1; display: flex; align-items: center; gap: 18px; min-width: 0; }
  .mc-logo {
    width: 192px; height: 64px; padding-right: 18px; object-fit: contain;
    border-right: 1px solid #3c454d;
  }
  .mc-title-block { min-width: 0; }
  .mc-title-block strong {
    display: block; color: var(--mc-red); font-size: clamp(1.15rem, 1.55vw, 1.55rem);
    letter-spacing: .045em; text-transform: uppercase; line-height: 1.05;
  }
  .mc-title-block span { display: block; margin-top: 7px; color: #dce1e5; font-size: 1rem; }
  .mc-top-actions {
    position: relative; z-index: 1; display: grid;
    grid-template-columns: 148px 200px 96px;
    align-items: center; justify-content: end; gap: 8px;
  }
  .mc-clock {
    min-height: 38px; border: 1px solid #46515a; border-radius: 7px; background: rgba(18,25,29,.92);
  }
  .mc-clock {
    display: grid; grid-template-columns: 1fr; place-items: center; gap: 2px;
    min-width: 148px; padding: 6px 10px; text-align: center;
  }
  .mc-clock b { font-size: .66rem; white-space: nowrap; }
  .mc-clock strong { color: #fff; font-size: .9rem; white-space: nowrap; }
  .mc-clock small { color: #66727b; font-size: .53rem; white-space: nowrap; }
  .mc-executive-commitment { font-size: .76rem; }
  .mc-refresh-button { font-size: .72rem; }

  .mc-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
  .mc-kpi {
    display: grid; grid-template-columns: 56px 1fr; align-items: center; gap: 13px;
    min-height: 96px; padding: 13px 15px; border: 1px solid var(--mc-line); border-radius: 7px;
    color: inherit; text-align: left; background: linear-gradient(145deg, #162027, #10161a);
    box-shadow: inset 0 1px rgba(255,255,255,.025); cursor: pointer;
  }
  .mc-kpi:hover { border-color: #7d151d; background: linear-gradient(145deg, #1a252b, #12191e); }
  .mc-kpi-icon {
    display: grid; place-items: center; width: 52px; height: 52px; border: 1px solid #49535b;
    border-radius: 50%; color: var(--mc-red); background: #11171b;
  }
  .mc-kpi-icon svg { width: 25px; height: 25px; }
  .mc-kpi:nth-child(5) .mc-kpi-icon,
  .mc-kpi:nth-child(6) .mc-kpi-icon { color: var(--mc-amber); }
  .mc-kpi:nth-child(7) .mc-kpi-icon,
  .mc-kpi:nth-child(8) .mc-kpi-icon { color: var(--mc-green); }
  .mc-kpi-copy { min-width: 0; }
  .mc-kpi-copy span { display: block; color: #d9dee2; font-size: .75rem; font-weight: 900; text-transform: uppercase; }
  .mc-kpi-copy strong { display: block; margin-top: 3px; font-size: 2rem; line-height: 1; }
  .mc-kpi-copy small { display: block; margin-top: 5px; color: var(--mc-muted); font-size: .66rem; }

  .mc-panel { overflow: hidden; border: 1px solid var(--mc-line); border-radius: 7px; background: var(--mc-panel); }
  .mc-panel-head {
    display: flex; align-items: center; justify-content: space-between; gap: 14px;
    min-height: 44px; padding: 8px 12px; border-bottom: 1px solid #364048;
    background: linear-gradient(180deg, #141c21, #10161a);
  }
  .mc-panel-title { display: flex; align-items: center; gap: 9px; min-width: 0; }
  .mc-panel-title svg { width: 20px; height: 20px; color: var(--mc-red); flex: 0 0 auto; }
  .mc-panel-title div { min-width: 0; }
  .mc-panel-title h2 { margin: 0; color: #f5f6f7; font-size: 1rem; line-height: 1.15; text-transform: uppercase; }
  .mc-panel-title small { display: block; margin-top: 2px; color: #74818a; font-size: .62rem; }
  .mc-link {
    border: 0; color: #d9dfe3; background: transparent; font: inherit; font-size: .72rem;
    cursor: pointer; white-space: nowrap;
  }
  .mc-link:hover { color: var(--mc-red); }

  .mc-flow-toolbar {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    padding: 9px 12px 0;
  }
  .mc-flow-toggle {
    display: inline-grid; grid-template-columns: 1fr 1fr; gap: 3px; padding: 3px;
    border: 1px solid #3a454d; border-radius: 7px; background: #0b1013;
  }
  .mc-flow-toggle button {
    min-height: 30px; padding: 0 13px; border: 0; border-radius: 5px;
    color: #89959e; background: transparent; font-family: inherit; font-size: .62rem;
    font-weight: 900; text-transform: uppercase; cursor: pointer; white-space: nowrap;
  }
  .mc-flow-toggle button.active {
    color: #fff; background: linear-gradient(180deg, #bd0b18, #790008);
  }
  .mc-flow-context {
    color: #78858e; font-size: .62rem; font-weight: 700; text-align: right;
  }

  .mc-flow {
    display: grid; grid-template-columns: repeat(8, minmax(118px, 1fr)); gap: 4px;
    padding: 12px; overflow-x: auto;
  }
  .mc-flow-card {
    position: relative; min-width: 118px; min-height: 128px; padding: 13px 14px 11px 22px;
    border: 1px solid #465159; color: inherit; text-align: left;
    background: linear-gradient(145deg, #1b252b, #131a1f); cursor: pointer;
    clip-path: polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%, 14px 50%);
  }
  .mc-flow-card:first-child { padding-left: 14px; clip-path: polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%); }
  .mc-flow-card:hover { background: #243038; }
  .mc-flow-card:last-child {
    border-color: #8c1821;
    background: linear-gradient(145deg, #25191d, #15171a);
  }
  .mc-flow-card:last-child:hover { background: #302126; }
  .mc-flow-card:last-child svg { color: #ff5965; }
  .mc-flow-card svg { width: 24px; height: 24px; color: #d9dfe3; }
  .mc-flow-card span {
    display: flex; align-items: flex-start; min-height: 34px; margin-top: 8px; color: #e3e7ea;
    font-size: clamp(.56rem, .61vw, .68rem); font-weight: 900; line-height: 1.12;
    white-space: normal; text-transform: uppercase;
  }
  .mc-flow-label { display: flex; }
  .mc-flow-card strong { display: block; margin-top: 2px; font-size: 1.8rem; line-height: 1; }
  .mc-flow-meter { height: 5px; margin-top: 10px; background: #3a444b; }
  .mc-flow-meter i { display: block; height: 100%; background: var(--mc-green); }
  .mc-flow-card.warn .mc-flow-meter i { background: var(--mc-amber); }
  .mc-flow-card.danger .mc-flow-meter i { background: var(--mc-red); }
  .mc-flow-card small { display: block; margin-top: 5px; color: #9aa5ad; font-size: .58rem; text-align: right; }

  .mc-closeout-list { display: grid; }
  .mc-closeout-row {
    display: grid; grid-template-columns: minmax(170px, 1.5fr) minmax(120px, .8fr) repeat(3, minmax(105px, .7fr)) auto;
    align-items: center; gap: 12px; min-height: 54px; padding: 9px 12px;
    border: 0; border-bottom: 1px solid #303940; color: inherit; text-align: left;
    background: transparent; width: 100%; cursor: pointer;
  }
  .mc-closeout-row:hover { background: rgba(255,255,255,.025); }
  .mc-closeout-row:last-child { border-bottom: 0; }
  .mc-closeout-main, .mc-closeout-detail { min-width: 0; }
  .mc-closeout-main strong, .mc-closeout-detail strong {
    display: block; overflow: hidden; color: #e7eaec; font-size: .7rem;
    text-overflow: ellipsis; white-space: nowrap;
  }
  .mc-closeout-main small, .mc-closeout-detail small {
    display: block; overflow: hidden; margin-top: 3px; color: #75818a; font-size: .58rem;
    text-overflow: ellipsis; white-space: nowrap;
  }
  .mc-closeout-check {
    display: inline-flex; align-items: center; justify-content: center; min-height: 24px;
    padding: 0 8px; border-radius: 12px; color: #ff8791; background: #3b1017;
    font-size: .56rem; font-weight: 900; text-transform: uppercase; white-space: nowrap;
  }
  .mc-closeout-check.done { color: #9be870; background: #18361a; }
  .mc-closeout-open {
    display: inline-flex; align-items: center; justify-content: center; min-height: 30px;
    padding: 0 10px; border: 1px solid #8e111b; border-radius: 5px; color: #fff;
    background: linear-gradient(180deg, #ba0b18, #780008); font-size: .6rem; font-weight: 900;
    text-transform: uppercase; white-space: nowrap;
  }
  .mc-outside-stage {
    display: inline-flex; align-items: center; justify-content: center; min-height: 24px;
    padding: 0 8px; border-radius: 12px; color: #ffd37a; background: #3e2b09;
    font-size: .56rem; font-weight: 900; text-transform: uppercase; white-space: nowrap;
  }

  .mc-three { display: grid; grid-template-columns: 1.08fr 1fr 1fr; gap: 8px; }
  .mc-list { min-height: 226px; }
  .mc-row {
    display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(76px, .8fr) auto;
    align-items: center; gap: 9px; min-height: 37px; padding: 7px 10px;
    border: 0; border-bottom: 1px solid #303940; color: inherit; text-align: left;
    background: transparent; width: 100%; cursor: pointer;
  }
  .mc-row:hover { background: rgba(255,255,255,.025); }
  .mc-row:last-child { border-bottom: 0; }
  .mc-row-main, .mc-row-meta { min-width: 0; }
  .mc-row-main strong, .mc-row-meta strong {
    display: block; overflow: hidden; color: #e7eaec; font-size: .7rem; text-overflow: ellipsis; white-space: nowrap;
  }
  .mc-row-main small, .mc-row-meta small { display: block; overflow: hidden; margin-top: 2px; color: #75818a; font-size: .58rem; text-overflow: ellipsis; white-space: nowrap; }
  .mc-tag {
    display: inline-flex; align-items: center; min-height: 20px; padding: 0 7px; border-radius: 10px;
    color: #ff8791; background: #3b1017; font-size: .58rem; font-weight: 900; text-transform: uppercase;
  }
  .mc-tag.green { color: #9be870; background: #18361a; }
  .mc-tag.amber { color: #ffc45c; background: #3d2b0b; }
  .mc-empty { display: grid; place-items: center; min-height: 180px; padding: 18px; color: #707b84; font-size: .72rem; text-align: center; }

  .mc-hot { border-top: 2px solid var(--mc-red); }
  .mc-hot .mc-row { grid-template-columns: 72px minmax(0, 1.5fr) minmax(80px, .7fr) auto; }
  .mc-priority {
    display: inline-flex; justify-content: center; padding: 4px 6px; border-radius: 4px;
    color: #fff; background: #b50715; font-size: .55rem; font-weight: 900; text-transform: uppercase;
  }
  .mc-priority.quick { color: #ffd678; background: #674500; }

  .mc-bottom { display: grid; grid-template-columns: 1.15fr .85fr; gap: 8px; }
  .mc-health-body { display: grid; grid-template-columns: 170px 1fr; align-items: center; gap: 20px; padding: 15px; }
  .mc-score {
    display: grid; place-items: center; width: 132px; aspect-ratio: 1; margin: auto; border-radius: 50%;
    background: conic-gradient(var(--mc-green) calc(var(--score) * 1%), #2b343a 0);
  }
  .mc-score-inner {
    display: grid; place-items: center; width: 100px; aspect-ratio: 1; border-radius: 50%; background: #0c1114;
  }
  .mc-score strong { font-size: 2rem; line-height: 1; }
  .mc-score span {
    width: 76px; margin-top: 5px; color: var(--mc-green); font-size: .48rem;
    font-weight: 900; line-height: 1.15; text-align: center; text-transform: uppercase;
  }
  .mc-health-line {
    display: grid; grid-template-columns: 22px 1fr auto; align-items: center; gap: 8px;
    min-height: 34px; border-bottom: 1px solid #303940;
  }
  .mc-health-line:last-child { border-bottom: 0; }
  .mc-health-line svg { width: 16px; height: 16px; color: #aab3ba; }
  .mc-health-line b { font-size: .69rem; }
  .mc-health-line b small { display: block; margin-top: 2px; color: #69757e; font-size: .55rem; font-weight: 500; }
  .mc-health-line strong { color: var(--mc-green); font-size: .78rem; }
  .mc-health-line strong.warn { color: var(--mc-amber); }
  .mc-health-line strong.danger { color: var(--mc-red); }
  .mc-readiness { display: grid; grid-template-columns: repeat(3, 1fr); min-height: 100%; }
  .mc-ready-card { display: grid; place-items: center; padding: 18px 10px; border-right: 1px solid #303940; text-align: center; }
  .mc-ready-card:last-child { border-right: 0; }
  .mc-ready-card span { color: #8e9aa3; font-size: .64rem; text-transform: uppercase; }
  .mc-ready-card strong { margin-top: 7px; font-size: 1.7rem; }
  .mc-ready-card small { margin-top: 4px; color: #68747d; font-size: .56rem; }
  .mc-ready-card.ready strong { color: var(--mc-green); }
  .mc-ready-card.order strong { color: var(--mc-amber); }
  .mc-ready-card.wait strong { color: var(--mc-red); }
  .mc-huddle-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .mc-huddle-card {
    min-height: 118px; padding: 17px 18px; border-right: 1px solid #303940;
    background: linear-gradient(180deg, rgba(255,255,255,.012), transparent);
  }
  .mc-huddle-card:last-child { border-right: 0; }
  .mc-huddle-card span {
    display: block; color: #8fa0ad; font-size: .62rem; font-weight: 800;
    letter-spacing: .04em; text-transform: uppercase;
  }
  .mc-huddle-card strong { display: block; margin-top: 9px; font-size: 1.75rem; line-height: 1; }
  .mc-huddle-card small { display: block; margin-top: 8px; color: #76838d; font-size: .59rem; line-height: 1.4; }
  .mc-huddle-card.alert strong { color: var(--mc-red); }
  .mc-huddle-card.field strong { color: var(--mc-amber); }
  .mc-huddle-card.shop strong { color: var(--mc-green); }
  .mc-footer {
    padding: 7px 12px; border: 1px solid #2d363d; color: #68747d;
    background: repeating-linear-gradient(135deg, #0c1114 0 8px, #12181c 8px 16px);
    font-size: .58rem; font-weight: 800; letter-spacing: .16em; text-align: center; text-transform: uppercase;
  }

  @media (max-width: 1180px) {
    .mc-topbar { grid-template-columns: 1fr; }
    .mc-top-actions { justify-content: start; }
    .mc-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .mc-three { grid-template-columns: 1fr; }
    .mc-huddle-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 760px) {
    .mc-logo { width: 110px; }
    .mc-title-block span { font-size: .84rem; }
    .mc-top-actions { grid-template-columns: 1fr 1fr; width: 100%; }
    .mc-clock { min-width: 0; }
    .mc-kpis, .mc-bottom { grid-template-columns: 1fr; }
    .mc-health-body { grid-template-columns: 1fr; }
    .mc-closeout-row { grid-template-columns: 1fr 1fr; }
    .mc-closeout-open { justify-self: start; }
    .mc-flow-toolbar { align-items: stretch; flex-direction: column; }
    .mc-flow-context { text-align: left; }
  }
  @media (max-width: 500px) {
    .mc-brand { align-items: flex-start; }
    .mc-logo { width: 88px; height: 42px; }
    .mc-top-actions { grid-template-columns: 1fr; }
    .mc-clock { grid-column: auto; }
    .mc-kpi { min-height: 82px; }
    .mc-hot .mc-row, .mc-row { grid-template-columns: 1fr; }
    .mc-tag, .mc-priority { justify-self: start; }
    .mc-readiness { grid-template-columns: 1fr; }
    .mc-ready-card { border-right: 0; border-bottom: 1px solid #303940; }
    .mc-huddle-grid { grid-template-columns: 1fr; }
    .mc-huddle-card { border-right: 0; border-bottom: 1px solid #303940; }
  }
`;

const flowIcons = [
  IconSparkles,
  IconBolt,
  IconTool,
  IconBuildingFactory2,
  IconHammer,
  IconTool,
  IconShieldCheck,
  IconBox,
];

const outsideFlowIcons = [
  IconClipboardList,
  IconSparkles,
  IconTool,
  IconClipboardList,
  IconHammer,
  IconTool,
  IconMapPin,
  IconShieldCheck,
];

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getCloseoutCustomerName(customer) {
  if (!customer) return "Customer not assigned";
  return (
    `${customer.first_name || ""} ${customer.last_name || ""}`.trim() ||
    customer.contact_name ||
    customer.name ||
    customer.company_name ||
    "Unnamed Customer"
  );
}

function formatCloseoutMoney(value) {
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

async function getOfficeCloseoutOrders() {
  const closeoutStatuses = [
    "Production Complete",
    "Ready for Pickup",
    "Ready to Ship",
    "Ready for Installation",
  ];

  const { data: orders, error: ordersError } = await supabase
    .from("customer_orders")
    .select("*")
    .in("status", closeoutStatuses)
    .order("updated_at", { ascending: false });

  if (ordersError) throw ordersError;

  const customerIds = [
    ...new Set(
      (orders || []).map((order) => order.customer_id).filter(Boolean),
    ),
  ];

  let customersById = {};
  if (customerIds.length) {
    const { data: customers, error: customersError } = await supabase
      .from("customers")
      .select("*")
      .in("id", customerIds);

    if (customersError) throw customersError;
    customersById = Object.fromEntries(
      (customers || []).map((customer) => [customer.id, customer]),
    );
  }

  return (orders || []).map((order) => ({
    ...order,
    customer: customersById[order.customer_id] || null,
  }));
}

function outsideStageComplete(required, status) {
  return (
    !required ||
    ["Completed", "Not Required", "Passed", "Paid"].includes(status)
  );
}

function getOutsideProjectStage(project) {
  const projectStatus = String(project.status || "")
    .trim()
    .toLowerCase();

  const productionStatuses = [
    "in production",
    "ready for test fit",
    "ready for finish",
    "ready for assembly",
    "ready for installation",
    "production complete",
    "office closeout",
  ];

  const hasProductionProgress = [
    project.design_status,
    project.fabrication_status,
    project.test_fit_status,
    project.finish_status,
    project.assembly_status,
    project.install_status,
    project.final_inspection_status,
  ].some(
    (status) =>
      status && !["Not Started", "Not Required", "Pending"].includes(status),
  );

  if (!productionStatuses.includes(projectStatus) && !hasProductionProgress) {
    return "Pre-Production / Quote";
  }

  if (!outsideStageComplete(project.design_required, project.design_status)) {
    return "Design";
  }

  if (
    !outsideStageComplete(
      project.fabrication_required,
      project.fabrication_status,
    )
  ) {
    return "Welding / Fabrication";
  }

  if (
    !outsideStageComplete(project.test_fit_required, project.test_fit_status)
  ) {
    return "Test Fit";
  }

  if (!outsideStageComplete(project.finish_required, project.finish_status)) {
    return "Finish / Corrections";
  }

  if (
    !outsideStageComplete(project.assembly_required, project.assembly_status)
  ) {
    return "Assembly";
  }

  if (project.install_required) {
    if (["Scheduled", "In Progress"].includes(project.install_status)) {
      return "Installation";
    }

    if (project.install_status !== "Completed") {
      return "Ready for Installation";
    }
  }

  const finalInspectionRequired =
    project.final_inspection_required === true ||
    (project.final_inspection_status &&
      project.final_inspection_status !== "Not Required");

  if (
    finalInspectionRequired &&
    !["Passed", "Completed"].includes(project.final_inspection_status)
  ) {
    return "Final Inspection";
  }

  const balanceRequired =
    project.balance_status && project.balance_status !== "Not Required";

  if (balanceRequired && project.balance_status !== "Paid") {
    return "Final Balance";
  }

  return "Office Closeout";
}

async function getOutsideWorkflowProjects() {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data || [])
    .filter(
      (project) =>
        !["completed", "cancelled"].includes(
          String(project.status || "")
            .trim()
            .toLowerCase(),
        ),
    )
    .map((project) => ({
      ...project,
      workflowStage: getOutsideProjectStage(project),
    }));
}

function Dashboard({
  setPage,
  openActionCenter,
  openProject,
  openCustomerOrder,
  openCallback,
}) {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [officeCloseoutOrders, setOfficeCloseoutOrders] = useState([]);
  const [outsideProjects, setOutsideProjects] = useState([]);
  const [flowMode, setFlowMode] = useState("shop");
  const [selectedOutsideStage, setSelectedOutsideStage] = useState("");

  useEffect(() => {
    loadDashboard();
    const refreshTimer = window.setInterval(() => loadDashboard(false), 60000);
    return () => window.clearInterval(refreshTimer);
  }, []);

  useEffect(() => {
    const clockTimer = window.setInterval(
      () => setCurrentTime(new Date()),
      1000,
    );
    return () => window.clearInterval(clockTimer);
  }, []);

  async function loadDashboard(showLoading = true) {
    if (showLoading) setLoading(true);
    else setRefreshing(true);
    setLoadError("");

    try {
      const [result, closeoutOrders, outsideWorkflowProjects] =
        await Promise.all([
          getDashboardData(),
          getOfficeCloseoutOrders(),
          getOutsideWorkflowProjects(),
        ]);
      setDashboardData(result);
      setOfficeCloseoutOrders(closeoutOrders);
      setOutsideProjects(outsideWorkflowProjects);
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Dashboard load error:", error);
      setLoadError(error?.message || "Dashboard failed to load.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function goToPage(pageName) {
    setPage(pageName);
  }

  function goToActionCenter(filter = "All") {
    if (openActionCenter) openActionCenter(filter);
    else setPage("actionCenter");
  }

  async function openProjectById(projectId) {
    if (!projectId) return goToPage("projects");
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .maybeSingle();

    if (error || !data) {
      console.error("Project open error:", error);
      return goToPage("projects");
    }

    if (openProject) openProject(data);
    else goToPage("projectDetails");
  }

  async function openOrderById(orderId) {
    if (!orderId) return goToPage("customerOrders");
    const { data, error } = await supabase
      .from("customer_orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();

    if (error || !data) {
      console.error("Order open error:", error);
      return goToPage("customerOrders");
    }

    if (openCustomerOrder) openCustomerOrder(data);
    else goToPage("customerOrderDetails");
  }

  async function openAction(item) {
    if (item?.sourceType === "project") return openProjectById(item.sourceId);
    if (item?.sourceType === "customerOrder")
      return openOrderById(item.sourceId);
    if (item?.sourceType === "callback" && openCallback) {
      openCallback(item.sourceId);
      return;
    }
    goToActionCenter("All");
  }

  const stats = dashboardData?.stats || {};
  const outsideSummary = dashboardData?.outsideSummary || {};
  const huddle = dashboardData?.morningHuddle || {};
  const huddleSummary = huddle.summary || {};
  const projectHealth = huddle.projectHealth || {};
  const attention = safeArray(dashboardData?.dailyAttention);
  const schedule = safeArray(dashboardData?.outsideSchedule);
  const flow = safeArray(dashboardData?.shopFlow);
  const outsideCloseoutProjects = outsideProjects.filter(
    (project) => project.workflowStage === "Office Closeout",
  );
  const unifiedCloseoutCount =
    officeCloseoutOrders.length + outsideCloseoutProjects.length;

  const statCards = [
    [
      "Open Orders",
      stats.openOrders || 0,
      "Customer orders",
      IconClipboardList,
      () => goToPage("customerOrders"),
    ],
    [
      "Outside Projects",
      outsideProjects.length,
      "Field projects",
      IconHammer,
      () => goToPage("projects"),
    ],
    [
      "Open Work Orders",
      stats.openWorkOrders || 0,
      "Active work",
      IconTool,
      () => goToPage("jobQueue"),
    ],
    [
      "Due Today",
      stats.dueToday || 0,
      "Actions due",
      IconCalendarEvent,
      () => goToActionCenter("Due Today"),
    ],
    [
      "Overdue",
      stats.overdue || 0,
      "Past due actions",
      IconAlertTriangle,
      () => goToActionCenter("Overdue"),
    ],
    [
      "Site Visits",
      stats.siteVisits || 0,
      "Field checks",
      IconMapPin,
      () => goToPage("fieldSchedule"),
    ],
    [
      "Installs",
      stats.installs || 0,
      "Scheduled installs",
      IconTruckDelivery,
      () => goToPage("fieldSchedule"),
    ],
    [
      "In Production",
      stats.inProduction || 0,
      "Active shop jobs",
      IconBuildingFactory2,
      () => goToPage("productionJobs"),
    ],
  ];

  const flowItems = useMemo(() => {
    const defaults = [
      "Design",
      "Laser",
      "Welding",
      "Prep",
      "Paint/Powder",
      "Assembly",
      "Final QC / Showroom",
      "Office Closeout",
    ];
    return defaults.map((name, index) => {
      if (name === "Office Closeout") {
        const count = unifiedCloseoutCount;
        const capacity = 10;
        return {
          name,
          count,
          capacity,
          percentage: Math.min(
            100,
            Math.round((count / Math.max(1, capacity)) * 100),
          ),
        };
      }
      const source =
        flow.find((item) => {
          const current = String(item.name || "").toLowerCase();
          const target = name.toLowerCase();
          return current === target || current.includes(target.split("/")[0]);
        }) ||
        flow[index] ||
        {};
      const count = Number(source.count || 0);
      const capacity = Number(source.capacity || 10);
      const percentage = Math.min(
        100,
        Math.round((count / Math.max(1, capacity)) * 100),
      );
      return { name, count, capacity, percentage };
    });
  }, [flow, unifiedCloseoutCount]);

  const outsideFlowItems = useMemo(() => {
    const stages = [
      "Pre-Production / Quote",
      "Design",
      "Welding / Fabrication",
      "Test Fit",
      "Finish / Corrections",
      "Assembly",
      "Installation",
      "Office Closeout",
    ];

    return stages.map((name) => {
      const count = outsideProjects.filter(
        (project) =>
          project.workflowStage === name ||
          (name === "Installation" &&
            project.workflowStage === "Ready for Installation"),
      ).length;
      const capacity = 10;
      return {
        name,
        count,
        capacity,
        percentage: Math.min(
          100,
          Math.round((count / Math.max(1, capacity)) * 100),
        ),
      };
    });
  }, [outsideProjects]);

  const displayedFlowItems =
    flowMode === "outside" ? outsideFlowItems : flowItems;

  const displayedOutsideProjects = selectedOutsideStage
    ? outsideProjects.filter(
        (project) =>
          project.workflowStage === selectedOutsideStage ||
          (selectedOutsideStage === "Installation" &&
            project.workflowStage === "Ready for Installation"),
      )
    : outsideProjects;

  const hotItems = attention.slice(0, 5);
  const commitments = safeArray(huddle.todayFocus).length
    ? safeArray(huddle.todayFocus).slice(0, 5)
    : hotItems.slice(0, 5);
  const fieldItems = schedule.slice(0, 5);
  const riskItems = [
    ...safeArray(huddle.blockers),
    ...attention.filter(
      (item) => item.tag === "Overdue" || item.priority === "Critical",
    ),
  ].slice(0, 5);

  const scheduleScore = clampScore(100 - Number(stats.overdue || 0) * 12);
  const projectScore = clampScore(
    100 -
      Number(projectHealth.attentionNeeded || 0) * 9 -
      Number(projectHealth.blocked || 0) * 18,
  );
  const productionScore = clampScore(
    100 - Number(huddleSummary.blockers || 0) * 15,
  );
  const materialIssues =
    Number(outsideSummary.materialsNeedOrdered || 0) +
    Number(outsideSummary.materialsWaiting || 0);
  const materialScore = clampScore(100 - materialIssues * 9);
  const blockerScore = clampScore(
    100 - Number(huddleSummary.blockers || 0) * 20,
  );
  const overallScore = clampScore(
    (scheduleScore +
      projectScore +
      productionScore +
      materialScore +
      blockerScore) /
      5,
  );

  if (loading) {
    return (
      <div className="mc-page">
        <style>{styles}</style>
        <section className="mc-panel">
          <div className="mc-empty">
            Loading the Metal Worx operations board…
          </div>
        </section>
      </div>
    );
  }

  if (loadError && !dashboardData) {
    return (
      <div className="mc-page">
        <style>{styles}</style>
        <section className="mc-panel">
          <div className="mc-empty">
            <div>
              <p>{loadError}</p>
              <button
                className="mc-button primary"
                onClick={() => loadDashboard()}
              >
                <IconRefresh /> Retry Dashboard
              </button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mc-page">
      <style>{styles}</style>

      <header className="mc-topbar">
        <div className="mc-brand">
          <img className="mc-logo" src={metalWorxLogo} alt="Metal Worx" />
          <div className="mc-title-block">
            <strong>Metal Worx OS</strong>
            <span>Operations Command Center</span>
          </div>
        </div>

        <div className="mc-top-actions">
          <div className="mc-clock">
            <b>
              {currentTime.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </b>
            <strong>
              {currentTime.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              })}
            </strong>
            <small>
              Updated{" "}
              {lastUpdated.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              })}
            </small>
          </div>
          <button
            className="mc-button primary mc-executive-commitment"
            onClick={() => goToPage("quickTurnaround")}
          >
            <IconBolt /> Today&apos;s Commitments
          </button>
          <button
            className="mc-button mc-refresh-button"
            onClick={() => loadDashboard(false)}
            disabled={refreshing}
          >
            <IconRefresh /> {refreshing ? "Refreshing" : "Refresh"}
          </button>
        </div>
      </header>

      <section className="mc-kpis">
        {statCards.map(([label, value, subtitle, StatIcon, onClick]) => (
          <button
            className="mc-kpi"
            type="button"
            key={label}
            onClick={onClick}
          >
            <span className="mc-kpi-icon">
              <StatIcon />
            </span>
            <span className="mc-kpi-copy">
              <span>{label}</span>
              <strong>{value}</strong>
              <small>{subtitle}</small>
            </span>
          </button>
        ))}
      </section>

      <section className="mc-panel">
        <PanelHead
          icon={IconBuildingFactory2}
          title="Operations Flow"
          subtitle={
            flowMode === "outside"
              ? "Live workload across outside fabrication and field installation"
              : "Live workload from production through office closeout"
          }
          action={
            flowMode === "outside"
              ? "Open Outside Projects"
              : "Open Production Control"
          }
          onAction={() =>
            goToPage(flowMode === "outside" ? "projects" : "productionControl")
          }
        />
        <div className="mc-flow-toolbar">
          <div className="mc-flow-toggle">
            <button
              type="button"
              className={flowMode === "shop" ? "active" : ""}
              onClick={() => setFlowMode("shop")}
            >
              In-Shop Orders
            </button>
            <button
              type="button"
              className={flowMode === "outside" ? "active" : ""}
              onClick={() => {
                setFlowMode("outside");
                setSelectedOutsideStage("");
              }}
            >
              Outside Projects
            </button>
          </div>
          <div className="mc-flow-context">
            {flowMode === "outside"
              ? `${outsideProjects.length} active outside project${
                  outsideProjects.length === 1 ? "" : "s"
                }`
              : `${unifiedCloseoutCount} order${
                  unifiedCloseoutCount === 1 ? "" : "s"
                } awaiting office closeout`}
          </div>
        </div>
        <div
          className="mc-flow"
          style={{
            gridTemplateColumns: `repeat(${displayedFlowItems.length}, minmax(118px, 1fr))`,
          }}
        >
          {displayedFlowItems.map((item, index) => {
            const FlowIcon =
              flowMode === "outside"
                ? outsideFlowIcons[index]
                : flowIcons[index];
            const tone =
              item.percentage >= 90
                ? "danger"
                : item.percentage >= 70
                  ? "warn"
                  : "";
            const isOfficeCloseout = item.name === "Office Closeout";
            return (
              <button
                className={`mc-flow-card ${tone}`}
                key={item.name}
                onClick={() => {
                  if (isOfficeCloseout) {
                    setFlowMode("shop");
                    window.setTimeout(() => {
                      document
                        .getElementById("office-closeout-queue")
                        ?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        });
                    }, 0);
                    return;
                  }
                  if (flowMode === "outside") {
                    setSelectedOutsideStage(item.name);
                    window.setTimeout(() => {
                      document
                        .getElementById("outside-workflow-queue")
                        ?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        });
                    }, 0);
                    return;
                  }
                  goToPage("productionControl");
                }}
              >
                <FlowIcon />
                <span className="mc-flow-label">
                  {item.name === "Paint/Powder" ? (
                    <>
                      Paint /<br />
                      Powder
                    </>
                  ) : item.name === "Office Closeout" ? (
                    <>
                      Office
                      <br />
                      Closeout
                    </>
                  ) : item.name === "Welding / Fabrication" ? (
                    <>
                      Welding /<br />
                      Fabrication
                    </>
                  ) : item.name === "Finish / Corrections" ? (
                    <>
                      Finish /<br />
                      Corrections
                    </>
                  ) : item.name === "Ready for Installation" ? (
                    <>
                      Ready for
                      <br />
                      Installation
                    </>
                  ) : item.name === "Pre-Production / Quote" ? (
                    <>
                      Pre-Production
                      <br />/ Quote
                    </>
                  ) : item.name === "Final Inspection" ? (
                    <>
                      Final
                      <br />
                      Inspection
                    </>
                  ) : item.name === "Final Balance" ? (
                    <>
                      Final
                      <br />
                      Balance
                    </>
                  ) : item.name === "Project Closeout" ? (
                    <>
                      Project
                      <br />
                      Closeout
                    </>
                  ) : (
                    item.name
                  )}
                </span>
                <strong>{item.count}</strong>
                <div className="mc-flow-meter">
                  <i style={{ width: `${Math.max(4, item.percentage)}%` }} />
                </div>
                <small>
                  {item.count} / {item.capacity}
                </small>
              </button>
            );
          })}
        </div>
      </section>

      {flowMode === "shop" ? (
        <section className="mc-panel" id="office-closeout-queue">
          <PanelHead
            icon={IconClipboardList}
            title="Office Closeout Queue"
            subtitle="Internal orders and outside projects awaiting payment or final office completion"
            action={`All Closeouts (${unifiedCloseoutCount})`}
            onAction={() => goToPage("customerOrders")}
          />
          <div className="mc-closeout-list">
            {unifiedCloseoutCount === 0 ? (
              <Empty text="No orders or outside projects are awaiting office closeout." />
            ) : (
              <>
                {officeCloseoutOrders.slice(0, 10).map((closeoutOrder) => {
                  const balance = Math.max(
                    Number(closeoutOrder.balance_due || 0),
                    0,
                  );
                  const paymentComplete = balance <= 0;
                  const notificationComplete = Boolean(
                    closeoutOrder.ready_notification_sent,
                  );
                  const fulfillmentComplete = Boolean(
                    closeoutOrder.fulfillment_completed,
                  );

                  return (
                    <button
                      className="mc-closeout-row"
                      type="button"
                      key={`order-${closeoutOrder.id}`}
                      onClick={() => openOrderById(closeoutOrder.id)}
                    >
                      <span className="mc-closeout-main">
                        <strong>
                          {getCloseoutCustomerName(closeoutOrder.customer)}
                        </strong>
                        <small>
                          Customer Order ·{" "}
                          {closeoutOrder.order_number || closeoutOrder.id} ·{" "}
                          {closeoutOrder.status}
                        </small>
                      </span>
                      <span className="mc-closeout-detail">
                        <strong>{formatCloseoutMoney(balance)}</strong>
                        <small>Remaining balance</small>
                      </span>
                      <span
                        className={`mc-closeout-check ${
                          paymentComplete ? "done" : ""
                        }`}
                      >
                        {paymentComplete ? "Paid" : "Payment Due"}
                      </span>
                      <span
                        className={`mc-closeout-check ${
                          notificationComplete ? "done" : ""
                        }`}
                      >
                        {notificationComplete ? "Notified" : "Notify Customer"}
                      </span>
                      <span
                        className={`mc-closeout-check ${
                          fulfillmentComplete ? "done" : ""
                        }`}
                      >
                        {fulfillmentComplete
                          ? "Fulfilled"
                          : closeoutOrder.fulfillment_method ||
                            "Pickup Pending"}
                      </span>
                      <span className="mc-closeout-open">Open Closeout</span>
                    </button>
                  );
                })}

                {outsideCloseoutProjects.slice(0, 10).map((project) => {
                  const paymentComplete = ["Paid", "Not Required"].includes(
                    project.balance_status,
                  );
                  const inspectionComplete = [
                    "Passed",
                    "Not Required",
                  ].includes(project.final_inspection_status);
                  const installationComplete =
                    !project.install_required ||
                    project.install_status === "Completed";

                  return (
                    <button
                      className="mc-closeout-row"
                      type="button"
                      key={`project-${project.id}`}
                      onClick={() => openProjectById(project.id)}
                    >
                      <span className="mc-closeout-main">
                        <strong>
                          {project.project_name ||
                            project.contact_name ||
                            "Outside Project"}
                        </strong>
                        <small>
                          Outside Project ·{" "}
                          {project.project_number || project.id} · Office
                          Closeout
                        </small>
                      </span>
                      <span className="mc-closeout-detail">
                        <strong>{project.balance_status || "Pending"}</strong>
                        <small>Final balance</small>
                      </span>
                      <span
                        className={`mc-closeout-check ${
                          paymentComplete ? "done" : ""
                        }`}
                      >
                        {paymentComplete ? "Paid" : "Payment Due"}
                      </span>
                      <span
                        className={`mc-closeout-check ${
                          inspectionComplete ? "done" : ""
                        }`}
                      >
                        {inspectionComplete
                          ? "Inspection Passed"
                          : "Inspection Pending"}
                      </span>
                      <span
                        className={`mc-closeout-check ${
                          installationComplete ? "done" : ""
                        }`}
                      >
                        {installationComplete
                          ? "Installation Complete"
                          : "Installation Pending"}
                      </span>
                      <span className="mc-closeout-open">Open Closeout</span>
                    </button>
                  );
                })}
              </>
            )}
          </div>
        </section>
      ) : (
        <section className="mc-panel" id="outside-workflow-queue">
          <PanelHead
            icon={IconMapPin}
            title="Outside Project Workflow Queue"
            subtitle={
              selectedOutsideStage
                ? `Projects currently at ${selectedOutsideStage}`
                : "Active fabrication, test-fit, finishing, assembly, and installation work"
            }
            action={
              selectedOutsideStage
                ? `Clear Filter (${displayedOutsideProjects.length})`
                : `Outside Projects (${outsideProjects.length})`
            }
            onAction={() =>
              selectedOutsideStage
                ? setSelectedOutsideStage("")
                : goToPage("projects")
            }
          />
          <div className="mc-closeout-list">
            {displayedOutsideProjects.length === 0 ? (
              <Empty
                text={
                  selectedOutsideStage
                    ? `No outside projects are currently at ${selectedOutsideStage}.`
                    : "No active outside projects are currently in workflow."
                }
              />
            ) : (
              displayedOutsideProjects.slice(0, 10).map((outsideProject) => (
                <button
                  className="mc-closeout-row"
                  type="button"
                  key={outsideProject.id}
                  onClick={() => openProjectById(outsideProject.id)}
                >
                  <span className="mc-closeout-main">
                    <strong>
                      {outsideProject.project_name ||
                        outsideProject.contact_name ||
                        "Outside Project"}
                    </strong>
                    <small>
                      {outsideProject.project_number ||
                        `Project #${outsideProject.id}`}{" "}
                      · {outsideProject.status || "Active"}
                    </small>
                  </span>
                  <span className="mc-closeout-detail">
                    <strong>
                      {outsideProject.assigned_to || "Unassigned"}
                    </strong>
                    <small>Project owner</small>
                  </span>
                  <span className="mc-outside-stage">
                    {outsideProject.workflowStage}
                  </span>
                  <span
                    className={`mc-closeout-check ${
                      outsideProject.test_fit_status === "Completed" ||
                      !outsideProject.test_fit_required
                        ? "done"
                        : ""
                    }`}
                  >
                    {outsideProject.test_fit_required
                      ? `Test Fit: ${outsideProject.test_fit_status || "Not Started"}`
                      : "No Test Fit"}
                  </span>
                  <span
                    className={`mc-closeout-check ${
                      outsideProject.install_status === "Completed"
                        ? "done"
                        : ""
                    }`}
                  >
                    {outsideProject.install_required
                      ? `Install: ${outsideProject.install_status || "Not Started"}`
                      : "No Install"}
                  </span>
                  <span className="mc-closeout-open">Open Project</span>
                </button>
              ))
            )}
          </div>
        </section>
      )}

      <section className="mc-panel mc-hot">
        <PanelHead
          icon={IconBolt}
          title="Hot Today & Quick Commitments"
          subtitle="Priority work requiring immediate execution"
          action={`View All (${attention.length})`}
          onAction={() => goToPage("quickTurnaround")}
        />
        {hotItems.length === 0 ? (
          <Empty text="No hot items are currently flagged." />
        ) : (
          hotItems.map((item, index) => (
            <button
              className="mc-row"
              key={item.id || index}
              onClick={() => openAction(item)}
            >
              <span
                className={`mc-priority ${
                  String(item.type || "")
                    .toLowerCase()
                    .includes("quick")
                    ? "quick"
                    : ""
                }`}
              >
                {item.priority || item.tag || "Hot"}
              </span>
              <span className="mc-row-main">
                <strong>{item.title || "Untitled commitment"}</strong>
                <small>
                  {item.customer ||
                    item.issue ||
                    item.type ||
                    "Metal Worx work item"}
                </small>
              </span>
              <span className="mc-row-meta">
                <strong>{item.owner || "Unassigned"}</strong>
                <small>{item.next || item.nextAction || "Open"}</small>
              </span>
              <span className="mc-tag">
                {item.status || item.tag || "Open"}
              </span>
            </button>
          ))
        )}
      </section>

      <section className="mc-three">
        <section className="mc-panel">
          <PanelHead
            icon={IconBolt}
            title="Today’s Commitments"
            subtitle="Immediate execution list"
            action="View All"
            onAction={() => goToPage("quickTurnaround")}
          />
          <div className="mc-list">
            {commitments.length === 0 ? (
              <Empty text="No commitments are assigned today." />
            ) : (
              commitments.map((item, index) => (
                <button
                  className="mc-row"
                  key={item.id || index}
                  onClick={() => openAction(item)}
                >
                  <span className="mc-row-main">
                    <strong>{item.title}</strong>
                    <small>{item.customer || item.nextAction}</small>
                  </span>
                  <span className="mc-row-meta">
                    <strong>{item.owner || "Unassigned"}</strong>
                    <small>{item.nextAction || "Open"}</small>
                  </span>
                  <span className="mc-tag amber">{item.status || "Today"}</span>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="mc-panel">
          <PanelHead
            icon={IconCalendarEvent}
            title="Field Schedule"
            subtitle="Site visits, test fits, and installs"
            action="View Schedule"
            onAction={() => goToPage("fieldSchedule")}
          />
          <div className="mc-list">
            {fieldItems.length === 0 ? (
              <Empty text="No field work is scheduled in the next seven days." />
            ) : (
              fieldItems.map((item, index) => (
                <button
                  className="mc-row"
                  key={item.id || index}
                  onClick={() => openProjectById(item.projectId)}
                >
                  <span className="mc-row-main">
                    <strong>
                      {item.time} · {item.customer}
                    </strong>
                    <small>{item.job || item.location}</small>
                  </span>
                  <span className="mc-row-meta">
                    <strong>{item.owner || "Unassigned"}</strong>
                    <small>{item.date || item.day}</small>
                  </span>
                  <span className={`mc-tag ${item.isToday ? "green" : ""}`}>
                    {item.isToday ? "Today" : item.status || "Scheduled"}
                  </span>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="mc-panel">
          <PanelHead
            icon={IconAlertTriangle}
            title="Projects Requiring Action"
            subtitle="Highest operational risk"
            action="View All"
            onAction={() => goToActionCenter("All")}
          />
          <div className="mc-list">
            {riskItems.length === 0 ? (
              <Empty text="No project risks or blockers are currently detected." />
            ) : (
              riskItems.map((item, index) => (
                <button
                  className="mc-row"
                  key={item.id || index}
                  onClick={() => openAction(item)}
                >
                  <span className="mc-row-main">
                    <strong>{item.title}</strong>
                    <small>
                      {item.detail || item.issue || item.nextAction}
                    </small>
                  </span>
                  <span className="mc-row-meta">
                    <strong>{item.owner || "Unassigned"}</strong>
                    <small>{item.next || "Needs action"}</small>
                  </span>
                  <span className="mc-tag">
                    {item.tag || item.status || "Action"}
                  </span>
                </button>
              ))
            )}
          </div>
        </section>
      </section>

      <section className="mc-bottom">
        <section className="mc-panel">
          <PanelHead
            icon={IconShieldCheck}
            title="Operations Health"
            subtitle="Live readiness and execution score"
            action="Action Center"
            onAction={() => goToActionCenter("All")}
          />
          <div className="mc-health-body">
            <div className="mc-score" style={{ "--score": overallScore }}>
              <div className="mc-score-inner">
                <strong>{overallScore}</strong>
                <span>{overallScore >= 90 ? "Strong" : "Action Required"}</span>
              </div>
            </div>
            <div>
              <HealthLine
                icon={IconCalendarEvent}
                label="Schedule"
                detail={`${stats.overdue || 0} overdue`}
                score={scheduleScore}
              />
              <HealthLine
                icon={IconClipboardList}
                label="Projects"
                detail={`${projectHealth.blocked || 0} blocked`}
                score={projectScore}
              />
              <HealthLine
                icon={IconBuildingFactory2}
                label="Production"
                detail={`${stats.inProduction || 0} active jobs`}
                score={productionScore}
              />
              <HealthLine
                icon={IconBox}
                label="Materials"
                detail={`${materialIssues} need attention`}
                score={materialScore}
              />
              <HealthLine
                icon={IconAlertTriangle}
                label="Blockers"
                detail={`${huddleSummary.blockers || 0} active`}
                score={blockerScore}
              />
            </div>
          </div>
        </section>

        <section className="mc-panel">
          <PanelHead
            icon={IconBox}
            title="Material Readiness"
            subtitle="Open project material status"
            action="View Projects"
            onAction={() => goToPage("projects")}
          />
          <div className="mc-readiness">
            <div className="mc-ready-card ready">
              <span>Ready</span>
              <strong>
                {Math.max(0, outsideProjects.length - materialIssues)}
              </strong>
              <small>Projects clear</small>
            </div>
            <div className="mc-ready-card order">
              <span>Need Ordering</span>
              <strong>{outsideSummary.materialsNeedOrdered || 0}</strong>
              <small>Purchase required</small>
            </div>
            <div className="mc-ready-card wait">
              <span>Waiting Material</span>
              <strong>{outsideSummary.materialsWaiting || 0}</strong>
              <small>Ordered / pending</small>
            </div>
          </div>
        </section>
      </section>

      <section className="mc-panel">
        <PanelHead
          icon={IconUsers}
          title="Morning Huddle"
          subtitle="Today’s operating brief"
          action="Open Action Center"
          onAction={() => goToActionCenter("All")}
        />
        <div className="mc-huddle-grid">
          <div className="mc-huddle-card">
            <span>Top Priority</span>
            <strong>{commitments.length}</strong>
            <small>
              {commitments[0]?.title ||
                "No immediate commitment is currently assigned."}
            </small>
          </div>
          <div className="mc-huddle-card alert">
            <span>Active Blockers</span>
            <strong>{huddleSummary.blockers || 0}</strong>
            <small>
              {huddleSummary.blockers
                ? "Escalate blockers before releasing new work."
                : "No active blockers detected."}
            </small>
          </div>
          <div className="mc-huddle-card field">
            <span>Field Work Today</span>
            <strong>{huddleSummary.todayFieldWork || 0}</strong>
            <small>
              Site visits, test fits, and installations scheduled today.
            </small>
          </div>
          <div className="mc-huddle-card shop">
            <span>Active Shop Jobs</span>
            <strong>
              {huddleSummary.activeShopJobs || stats.inProduction || 0}
            </strong>
            <small>
              Busiest station: {huddleSummary.busiestDepartment || "None"}
              {huddleSummary.busiestDepartmentCount
                ? ` (${huddleSummary.busiestDepartmentCount})`
                : ""}
            </small>
          </div>
        </div>
      </section>

      <footer className="mc-footer">
        Built by fabricators · Powered by data · Driven by purpose
      </footer>
    </div>
  );
}

function PanelHead({ icon: Icon, title, subtitle, action, onAction }) {
  return (
    <div className="mc-panel-head">
      <div className="mc-panel-title">
        <Icon />
        <div>
          <h2>{title}</h2>
          <small>{subtitle}</small>
        </div>
      </div>
      {action && (
        <button className="mc-link" type="button" onClick={onAction}>
          {action} ›
        </button>
      )}
    </div>
  );
}

function Empty({ text }) {
  return <div className="mc-empty">{text}</div>;
}

function HealthLine({ icon: Icon, label, detail, score }) {
  const tone = score < 65 ? "danger" : score < 85 ? "warn" : "";
  return (
    <div className="mc-health-line">
      <Icon />
      <b>
        {label}
        <small>{detail}</small>
      </b>
      <strong className={tone}>{score}</strong>
    </div>
  );
}

export default Dashboard;
