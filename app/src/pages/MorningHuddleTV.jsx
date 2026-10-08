import { useEffect, useMemo, useState } from "react";
import {
  IconAlertTriangle,
  IconArrowsMaximize,
  IconCalendarEvent,
  IconClipboardCheck,
  IconRefresh,
  IconTool,
  IconUsers,
  IconX,
} from "@tabler/icons-react";

import { getDashboardData } from "../services/dashboardService";
import { supabase } from "../lib/supabase";
import metalWorxLogo from "../assets/metal-worx-official-transparent.png";

const styles = `
  .tv-board, .tv-board * { box-sizing: border-box; }
  .tv-board { min-height: 100vh; padding: 18px; color: #f6f7f8; background: #05080a; font-family: Arial, sans-serif; }
  .tv-head { display:flex; align-items:center; justify-content:space-between; gap:20px; padding:14px 18px; border:1px solid #39434a; border-radius:12px; background:#10161a; }
  .tv-brand { display:flex; align-items:center; gap:18px; }
  .tv-brand img { width:210px; height:62px; object-fit:contain; }
  .tv-brand h1 { margin:0; color:#fff !important; font-size:clamp(25px,2.2vw,42px); text-transform:uppercase; text-shadow:0 1px 2px #000; }
  .tv-brand p { margin:5px 0 0; color:#a9b1b7; font-size:clamp(14px,1.1vw,20px); }
  .tv-actions { display:flex; align-items:center; gap:10px; }
  .tv-clock { text-align:right; min-width:190px; }
  .tv-clock strong { display:block; font-size:clamp(23px,2vw,36px); }
  .tv-clock span { color:#a9b1b7; font-size:14px; }
  .tv-btn { display:inline-flex; align-items:center; gap:8px; min-height:46px; padding:0 15px; border:1px solid #46515a; border-radius:8px; color:#fff; background:#151d22; font-weight:800; cursor:pointer; }
  .tv-btn.red { background:#8d000b; border-color:#d41725; }
  .tv-summary { margin-top:14px; padding:11px 18px; border:1px solid #7d151d; border-radius:10px; background:linear-gradient(135deg,#241216,#11171b); }
  .tv-summary label { color:#ff5965; font-size:12px; font-weight:900; letter-spacing:.08em; text-transform:uppercase; }
  .tv-summary p { margin:6px 0 0; font-size:clamp(14px,1vw,18px); line-height:1.32; font-weight:700; }
  .tv-kpis { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:10px; margin-top:14px; }
  .tv-kpi { display:flex; min-width:0; min-height:140px; padding:15px; border:1px solid #354047; border-radius:10px; background:#11181c; flex-direction:column; align-items:center; text-align:center; }
  .tv-kpi span { display:flex; width:100%; min-height:48px; align-items:flex-start; justify-content:center; color:#d3d9dd !important; font-size:13px; font-weight:900; line-height:1.2; text-transform:uppercase; }
  .tv-kpi strong { display:flex; min-height:58px; margin-top:auto; align-items:center; justify-content:center; color:#fff; font-size:clamp(30px,3vw,52px); line-height:1; }
  .tv-kpi.danger strong { color:#ff4050; } .tv-kpi.warn strong { color:#ffb22d; } .tv-kpi.good strong { color:#83dc4d; }
  .tv-pipeline { margin-top:14px; padding:18px; border:1px solid #354047; border-radius:10px; background:#10161a; }
  .tv-pipeline-head { display:flex; align-items:center; gap:11px; margin-bottom:15px; color:#f6f7f8; font-size:clamp(22px,1.45vw,30px); font-weight:900; text-transform:uppercase; }
  .tv-pipeline-head svg { color:#ff3445; }
  .tv-pipeline-grid { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:12px; }
  .tv-pipeline-stage { min-width:0; min-height:185px; padding:14px 15px; border:1px solid #343e45; border-radius:10px; background:#171e23; }
  .tv-pipeline-stage.expandable { cursor:pointer; transition:border-color .15s ease,background .15s ease; }
  .tv-pipeline-stage.expandable:hover,.tv-pipeline-stage.expandable:focus-visible { border-color:#a53a43; background:#1d252a; outline:none; }
  .tv-pipeline-stage-head { display:flex; align-items:center; justify-content:space-between; gap:8px; }
  .tv-pipeline-stage-head span { color:#cbd2d7; font-size:clamp(15px,1vw,20px); font-weight:900; line-height:1.15; text-transform:uppercase; }
  .tv-pipeline-stage-head strong { color:#fff; font-size:clamp(34px,2.4vw,48px); line-height:1; }
  .tv-pipeline-jobs { display:grid; gap:8px; margin-top:11px; }
  .tv-pipeline-job { padding-top:8px; border-top:1px solid #303a41; color:#fff; font-size:clamp(14px,.92vw,18px); font-weight:850; line-height:1.22; overflow-wrap:anywhere; }
  .tv-pipeline-job small { display:block; margin-top:4px; color:#aeb8be; font-size:clamp(12px,.76vw,15px); font-weight:650; line-height:1.25; }
  .tv-pipeline-toggle { width:100%; padding:10px 4px 2px; border:0; border-top:1px solid #3a464d; color:#fff; background:transparent; font:inherit; font-size:clamp(13px,.82vw,16px); font-weight:900; cursor:pointer; }
  .tv-pipeline-none { margin-top:16px; color:#929da4; font-size:clamp(13px,.82vw,16px); }
  .tv-pipeline-stage.attention { border-color:#8d3138; background:#261317; }
  .tv-pipeline-stage.attention .tv-pipeline-stage-head strong { color:#ff5965; }
  .tv-grid { display:grid; grid-template-columns:repeat(12,minmax(0,1fr)); gap:12px; margin-top:14px; align-items:start; }
  .tv-panel { height:100%; min-height:190px; overflow:hidden; border:1px solid #354047; border-radius:10px; background:#10161a; }
  .tv-panel { grid-column:span 6; }
  .tv-panel.tv-hot-artwork { grid-column:span 6; }
  .tv-panel.tv-outside { grid-column:1 / -1; }
  .tv-panel.tv-production { grid-column:span 6; }
  .tv-panel.tv-field { grid-column:span 6; }
  .tv-panel h2 { display:flex; align-items:center; gap:9px; margin:0; padding:15px 18px; border-bottom:1px solid #354047; color:#f6f7f8 !important; font-size:clamp(20px,1.4vw,28px); line-height:1.2; text-transform:uppercase; }
  .tv-panel h2 svg { color:#ff3445; flex:0 0 auto; }
  .tv-card-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:9px; padding:11px; }
  .tv-card-grid.wide { grid-template-columns:repeat(4,minmax(0,1fr)); }
  .tv-outside-pipeline { padding:11px; }
  .tv-item-card { min-width:0; min-height:110px; padding:14px 15px; border:1px solid #303a41; border-radius:9px; background:#161d21; }
  .tv-item-card.urgent { border-color:#8f252e; background:linear-gradient(135deg,#291216,#171d21); }
  .tv-item-card strong { display:block; color:#fff; font-size:clamp(17px,1.05vw,21px); line-height:1.2; overflow-wrap:anywhere; }
  .tv-item-card small { display:block; margin-top:7px; color:#b5bec4; font-size:clamp(13px,.82vw,16px); line-height:1.3; overflow-wrap:anywhere; }
  .tv-card-tag { display:inline-block; margin-bottom:7px; padding:3px 7px; border-radius:999px; color:#fff; background:#9b0010; font-size:10px; font-weight:900; letter-spacing:.03em; text-transform:uppercase; }
  .tv-card-tag.gray { color:#dce2e5; background:#364047; }
  .tv-card-tag.green { color:#c8f8d2; background:#14532d; }
  .tv-project-progress { height:8px; margin:9px 0 5px; overflow:hidden; border-radius:999px; background:#303a41; }
  .tv-project-progress span { display:block; height:100%; border-radius:999px; background:linear-gradient(90deg,#b00012,#ff4050); }
  .tv-project-progress-label { display:flex; justify-content:space-between; gap:8px; color:#c8d0d5; font-size:11px; font-weight:800; }
  .tv-more { display:flex; min-height:40px; margin:0 11px 11px; border:1px dashed #48545c; border-radius:8px; color:#c4ccd1; background:#12181c; align-items:center; justify-content:center; font-size:13px; font-weight:900; }
  .tv-age { display:inline-block; margin-left:6px; padding:2px 7px; border-radius:999px; color:#d9e0e4; background:#273138; font-size:.76em; font-weight:900; }
  .tv-age.watch { color:#ffd083; background:#4b3300; }
  .tv-age.hot { color:#fff; background:#9b0010; }
  .tv-workload { display:inline-block; margin-right:7px; padding:2px 8px; border-radius:999px; font-size:.76em; font-weight:900; text-transform:uppercase; }
  .tv-workload.green { color:#b7f7c7; background:#14532d; }
  .tv-workload.teal { color:#b8fff2; background:#115e59; }
  .tv-workload.cyan { color:#c4f1ff; background:#155e75; }
  .tv-workload.orange { color:#ffe1ad; background:#7c2d12; }
  .tv-workload.red { color:#ffd0d4; background:#7f1d1d; }
  .tv-workload.gray { color:#e1e5e8; background:#374151; }
  .tv-empty { padding:28px 16px; color:#8c979f; font-size:18px; text-align:center; }
  .tv-foot { margin-top:12px; color:#76828a; font-size:12px; text-align:center; text-transform:uppercase; letter-spacing:.15em; }
  @media(max-width:1400px){ .tv-kpis{grid-template-columns:repeat(3,1fr)} .tv-pipeline-grid{grid-template-columns:repeat(3,minmax(0,1fr))} .tv-grid{grid-template-columns:1fr 1fr} .tv-panel,.tv-panel.tv-production,.tv-panel.tv-field{grid-column:span 1}.tv-panel.tv-hot-artwork,.tv-panel.tv-outside{grid-column:1 / -1}.tv-card-grid.wide{grid-template-columns:repeat(3,minmax(0,1fr))} }
  @media(max-width:700px){
    .tv-board{width:100%;padding:8px;overflow-x:hidden}
    .tv-head{align-items:stretch;flex-direction:column;padding:13px}
    .tv-brand{align-items:center;gap:10px}.tv-brand img{width:92px;height:40px}.tv-brand h1{font-size:20px;line-height:1.1}.tv-brand p{font-size:13px}
    .tv-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.tv-clock{grid-column:1/-1;min-width:0;text-align:center}.tv-btn{justify-content:center;min-width:0;padding:0 8px}.tv-btn.red{grid-column:1/-1}
    .tv-summary{padding:10px 12px}.tv-summary p{font-size:15px;line-height:1.3}
    .tv-kpis{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.tv-kpi{min-height:122px;padding:12px}.tv-kpi span{min-height:43px;font-size:12px}.tv-kpi strong{min-height:48px;font-size:36px}
    .tv-pipeline{padding:11px}.tv-pipeline-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.tv-pipeline-stage{min-height:108px;padding:8px}.tv-pipeline-stage-head span{font-size:11px}.tv-pipeline-stage-head strong{font-size:24px}
    .tv-grid{grid-template-columns:minmax(0,1fr);gap:10px}.tv-panel,.tv-panel.tv-hot-artwork,.tv-panel.tv-outside{grid-column:auto;min-height:0}.tv-panel h2{padding:12px;font-size:16px}.tv-card-grid,.tv-card-grid.wide{grid-template-columns:1fr;padding:8px}.tv-item-card{min-height:0;padding:10px}.tv-empty{padding:20px 12px;font-size:15px;min-height:0}
  }
`;

const text = (value, fallback = "Not assigned") => String(value || fallback);
const dateOnly = (value) => value ? new Date(String(value).length === 10 ? `${value}T12:00:00` : value).toLocaleDateString() : "Date not set";

function MoreCount({ total, shown }) {
  const remaining = Math.max(0, Number(total || 0) - Number(shown || 0));
  return remaining > 0 ? <div className="tv-more">+ {remaining} more — open Metal Worx OS for the full list</div> : null;
}

const OUTSIDE_HUDDLE_STAGES = [
  "Site Visits",
  "Needs Quote",
  "Quote & Approval",
  "Awaiting Deposit",
  "Needs Scheduling",
  "Fabrication / Shop",
  "Install / Field Work",
  "Closeout",
  "On Hold",
];

function designUrgency(item) {
  const due = item?.dueDate ? new Date(item.dueDate).getTime() : Number.POSITIVE_INFINITY;
  const daysUntilDue = Number.isFinite(due) ? Math.ceil((due - Date.now()) / 86400000) : Number.POSITIVE_INFINITY;
  if (daysUntilDue < 0) return { rank: 0, label: "Overdue", urgent: true };
  if (daysUntilDue <= 7) return { rank: 1, label: "Due Soon", urgent: true };
  if (Number(item?.businessDaysInShop || 0) >= 12) return { rank: 2, label: "Aging", urgent: false };
  return { rank: 3, label: "Normal", urgent: false };
}

function buildExecutiveSummary(data, openSiteVisitCount = 0, hotArtworkCount = 0) {
  const h = data?.morningHuddle || {};
  const s = h.summary || {};
  const projects = data?.outsideProjects || [];
  const sentences = [`${hotArtworkCount} hot item${hotArtworkCount === 1 ? "" : "s"} selected or dated for this week, ${s.activeShopJobs || 0} active shop job${s.activeShopJobs === 1 ? "" : "s"}, ${projects.length} outside project${projects.length === 1 ? "" : "s"}, and ${openSiteVisitCount} open site visit${openSiteVisitCount === 1 ? "" : "s"}.`];
  if (s.blockers) sentences.push(`${s.blockers} active blocker${s.blockers === 1 ? " requires" : "s require"} leadership attention before new work is released.`);
  else sentences.push("No active operational blockers are currently recorded.");
  if (s.overdueActions) sentences.push(`${s.overdueActions} overdue action${s.overdueActions === 1 ? " must" : "s must"} be assigned and recovered today.`);
  if (s.todayFieldWork) sentences.push(`${s.todayFieldWork} field activit${s.todayFieldWork === 1 ? "y is" : "ies are"} scheduled today.`);
  return sentences.join(" ");
}

export default function MorningHuddleTV({ setPage }) {
  const [data, setData] = useState(null);
  const [now, setNow] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [siteVisits, setSiteVisits] = useState([]);
  const [expandedStages, setExpandedStages] = useState({});

  async function load() {
    try {
      setError("");
      const [dashboardData, siteVisitResult] = await Promise.all([
        getDashboardData(),
        supabase.from("prequote_site_visits").select("*").in("status", ["Open", "Scheduled"]).order("requested_visit_date", { ascending: true, nullsFirst: false }),
      ]);
      if (siteVisitResult.error) throw siteVisitResult.error;
      setData(dashboardData);
      setSiteVisits(siteVisitResult.data || []);
    }
    catch (e) { setError(e?.message || "Huddle data could not load."); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); const refresh = setInterval(load, 30000); return () => clearInterval(refresh); }, []);
  useEffect(() => { const clock = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(clock); }, []);

  const huddle = data?.morningHuddle || {};
  const summary = huddle.summary || {};
  const projects = data?.outsideProjects || [];
  const priorityItems = data?.priorityFeed?.quickCommitments || [];
  const artworkOrders = data?.artworkOrders || [];
  const blockerTasks = (huddle.checklistItems || []).filter((item) => item.status === "Blocked" || item.blocker);
  const linkedPriorityIds = new Set(priorityItems.filter((item) => item.sourceType === "customerOrder" && item.sourceId).map((item) => String(item.sourceId)));
  const priorityTitles = new Set(priorityItems.map((item) => String(item.title || "").trim().toLowerCase()).filter(Boolean));
  const unduplicatedOrders = artworkOrders.filter((order) => !linkedPriorityIds.has(String(order.id)) && !priorityTitles.has(String(order.title || "").trim().toLowerCase()));
  const smallFabrication = artworkOrders
    .filter((order) => order.isSmallFabrication)
    .sort((left, right) => {
      if (Boolean(left.dueDate) !== Boolean(right.dueDate)) return left.dueDate ? -1 : 1;
      return Number(right.businessDaysInShop || 0) - Number(left.businessDaysInShop || 0);
    });
  const designQueue = artworkOrders
    .filter((order) => String(order.department || "").toLowerCase().includes("design"))
    .sort((left, right) => {
      const urgencyDifference = designUrgency(left).rank - designUrgency(right).rank;
      if (urgencyDifference !== 0) return urgencyDifference;
      return Number(right.businessDaysInShop || 0) - Number(left.businessDaysInShop || 0);
    })
    .slice(0, 12);
  const outsideProjectPipeline = OUTSIDE_HUDDLE_STAGES.map((name) => ({
    name,
    items: projects.filter((project) => project.workflowStage === name),
  })).filter((stage) => stage.items.length > 0);
  const promotedArtwork = unduplicatedOrders
    .filter((order) => !order.isSmallFabrication)
    .filter((order) => order.showOnHuddle || order.dueDate || Number(order.businessDaysInShop || 0) >= 12)
    .map((order) => ({
      ...order,
      daysInShop: order.businessDaysInShop,
      hotReasonCategory: order.dueDate ? "Dated Order" : order.showOnHuddle ? "Selected for Huddle" : "Aging",
      dueDisplay: order.dueDate ? `Requested ${dateOnly(order.dueDate)}` : order.showOnHuddle ? "Manually selected" : "12+ business days",
    }));
  const priorities = [...priorityItems, ...promotedArtwork].filter((item,index,all) => all.findIndex((candidate) => String(candidate.sourceType || candidate.type) === String(item.sourceType || item.type) && String(candidate.sourceId || candidate.id) === String(item.sourceId || item.id)) === index).slice(0,12);
  const executive = useMemo(() => buildExecutiveSummary(data, siteVisits.length, priorities.length), [data, siteVisits.length, priorities.length]);
  const field = (huddle.todayFieldWork || []).slice(0,6);
  const blockers = [...(huddle.blockers || []), ...blockerTasks.map((b) => ({ title: b.blocker || "Blocked checklist task", detail: "Checklist blocker" }))].slice(0,6);
  const shopWorkload = (huddle.shopWorkload || []).filter((item) => Number(item.count || 0) > 0);
  const artworkPipeline = huddle.artworkPipeline || [];
  const projectUpdates = projects
    .filter((project) => project.latestUpdate)
    .sort((left, right) => String(right.latestUpdate.update_date || "").localeCompare(String(left.latestUpdate.update_date || "")))
    .slice(0, 8);

  async function fullscreen() { if (!document.fullscreenElement) await document.documentElement.requestFullscreen(); else await document.exitFullscreen(); }
  function toggleStage(stageName) { setExpandedStages((current) => ({ ...current, [stageName]: !current[stageName] })); }

  return <div className="tv-board"><style>{styles}</style>
    <header className="tv-head">
      <div className="tv-brand"><img src={metalWorxLogo} alt="Metal Worx"/><div><h1>Metal Worx Morning Huddle</h1><p>Whole-shop priorities, deadlines, and decisions</p></div></div>
      <div className="tv-actions"><div className="tv-clock"><strong>{now.toLocaleTimeString([], {hour:"numeric",minute:"2-digit"})}</strong><span>{now.toLocaleDateString([], {weekday:"long",month:"long",day:"numeric"})}</span></div><button className="tv-btn" onClick={load}><IconRefresh/> Refresh</button><button className="tv-btn" onClick={fullscreen}><IconArrowsMaximize/> Full Screen</button><button className="tv-btn red" onClick={() => setPage("dashboard")}><IconX/> Exit TV</button></div>
    </header>
    {error && <div className="tv-summary"><p>{error}</p></div>}
    <section className="tv-summary"><label>Executive Summary</label><p>{loading ? "Preparing today’s operating summary…" : executive}</p></section>
    <section className="tv-kpis">
      <div className="tv-kpi danger"><span>Hot Items This Week</span><strong>{priorities.length}</strong></div>
      <div className="tv-kpi good"><span>Active Shop Jobs</span><strong>{summary.activeShopJobs || 0}</strong></div>
      <div className="tv-kpi warn"><span>Small Fabrication</span><strong>{smallFabrication.length}</strong></div>
      <div className="tv-kpi"><span>Outside Projects</span><strong>{projects.length}</strong></div>
      <div className="tv-kpi warn"><span>Open Site Visits</span><strong>{siteVisits.length}</strong></div>
      <div className="tv-kpi danger"><span>Needs Attention</span><strong>{Number(summary.blockers || blockers.length) + Number(summary.overdueActions || 0)}</strong></div>
    </section>
    <section className="tv-pipeline">
      <div className="tv-pipeline-head"><IconClipboardCheck/> Artwork Pipeline Overview</div>
      <div className="tv-pipeline-grid">
        {artworkPipeline.map((stage) => (
          <div
            className={`tv-pipeline-stage ${stage.items?.length > 3 ? "expandable" : ""} ${["Customer Approval", "Waiting for Pickup", "Ready to Ship"].includes(stage.name) && Number(stage.count || 0) > 0 ? "attention" : ""}`}
            key={stage.name}
            role={stage.items?.length > 3 ? "button" : undefined}
            tabIndex={stage.items?.length > 3 ? 0 : undefined}
            aria-expanded={stage.items?.length > 3 ? Boolean(expandedStages[stage.name]) : undefined}
            onClick={stage.items?.length > 3 ? () => toggleStage(stage.name) : undefined}
            onKeyDown={stage.items?.length > 3 ? (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggleStage(stage.name); } } : undefined}
          >
            <div className="tv-pipeline-stage-head"><span>{stage.name}</span><strong>{stage.count || 0}</strong></div>
            {stage.items?.length ? <div className="tv-pipeline-jobs">{stage.items.slice(0,expandedStages[stage.name] ? stage.items.length : 3).map((job) => <div className="tv-pipeline-job" key={job.id}>{text(job.title,"Artwork job")}<small>{text(job.customer,"Customer")} · {text(job.owner,"Unassigned")}</small></div>)}{stage.items.length > 3 && <button className="tv-pipeline-toggle" type="button" onClick={(event) => { event.stopPropagation(); toggleStage(stage.name); }}>{expandedStages[stage.name] ? "Show less" : `+ ${stage.items.length - 3} more — tap to expand`}</button>}</div> : <div className="tv-pipeline-none">No active jobs</div>}
          </div>
        ))}
      </div>
    </section>
    <section className="tv-grid">
      <div className="tv-panel tv-hot-artwork">
        <h2><IconClipboardCheck/> Hot Items This Week</h2>
        {priorities.length ? <><div className="tv-card-grid">{priorities.slice(0,6).map((x,i)=><div className="tv-item-card urgent" key={`${x.sourceType || x.type || "priority"}-${x.id || x.sourceId || i}`}><span className="tv-card-tag">{text(x.hotReasonCategory,"Priority")}</span><strong>{text(x.title,"Artwork priority")}</strong><small>{text(x.department,"Stage not assigned")} · {x.daysInShop || 0} days in shop<br/>{text(x.dueDisplay || x.dueDate,"No deadline set")}{x.reason ? ` · ${x.reason}` : ""}</small></div>)}</div><MoreCount total={priorities.length} shown={6}/></>:<div className="tv-empty">No hot items are selected or dated for this week.</div>}
      </div>
      <div className="tv-panel tv-hot-artwork">
        <h2><IconClipboardCheck/> Recommended Design Priority — Deadline & Age</h2>
        {designQueue.length ? <><div className="tv-card-grid">{designQueue.slice(0,6).map((x,i)=>{const urgency=designUrgency(x);return <div className={`tv-item-card ${urgency.urgent ? "urgent" : ""}`} key={`design-${x.id || i}`}><span className={`tv-card-tag ${urgency.rank > 1 ? "gray" : ""}`}>{urgency.label}</span><strong>{text(x.title,"Artwork order")}</strong><small>{text(x.owner)} · {x.designWorkLabel || "Design Work"}<br/>{x.businessDaysInShop || 0} business days · {text(x.dueDate,"No deadline set")}</small></div>;})}</div><MoreCount total={designQueue.length} shown={6}/></>:<div className="tv-empty">No work is currently waiting in Design.</div>}
      </div>
      <div className="tv-panel tv-outside">
        <h2><IconUsers/> Outside Project Pipeline</h2>
        {outsideProjectPipeline.length ? <div className="tv-pipeline-grid tv-outside-pipeline">{outsideProjectPipeline.map((stage)=>{const stageKey=`outside-${stage.name}`;const expandable=stage.items.length>3;return <div className={`tv-pipeline-stage ${expandable ? "expandable" : ""} ${["Site Visits","Needs Quote","Quote & Approval","On Hold"].includes(stage.name) ? "attention" : ""}`} key={stageKey} role={expandable ? "button" : undefined} tabIndex={expandable ? 0 : undefined} aria-expanded={expandable ? Boolean(expandedStages[stageKey]) : undefined} onClick={expandable ? ()=>toggleStage(stageKey) : undefined} onKeyDown={expandable ? (event)=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();toggleStage(stageKey);}} : undefined}><div className="tv-pipeline-stage-head"><span>{stage.name}</span><strong>{stage.items.length}</strong></div><div className="tv-pipeline-jobs">{stage.items.slice(0,expandedStages[stageKey] ? stage.items.length : 3).map((p)=><div className="tv-pipeline-job" key={p.id}>{text(p.projectName || p.projectNumber,"Project")}<small>{text(p.owner)} · {dateOnly(p.targetDate)}<br/>Next: {text(p.nextAction,"Review project")}</small></div>)}{expandable && <button className="tv-pipeline-toggle" type="button" onClick={(event)=>{event.stopPropagation();toggleStage(stageKey);}}>{expandedStages[stageKey] ? "Show less" : `+ ${stage.items.length-3} more — tap to expand`}</button>}</div></div>;})}</div>:<div className="tv-empty">No active outside projects.</div>}
      </div>
      <div className="tv-panel tv-outside">
        <h2><IconClipboardCheck/> Latest Project Updates</h2>
        {projectUpdates.length ? <div className="tv-card-grid wide">{projectUpdates.map((project) => { const update = project.latestUpdate; return <div className={`tv-item-card ${update.blockers ? "urgent" : ""}`} key={`project-update-${project.id}`}><span className={`tv-card-tag ${update.blockers ? "" : "green"}`}>{dateOnly(update.update_date)}</span><strong>{text(project.projectName,"Project")}</strong><small>{update.work_completed ? `Done: ${update.work_completed}` : "No completed work entered"}<br/>{update.work_in_progress ? `Now: ${update.work_in_progress}` : "No in-progress note entered"}<br/>Next: {text(update.next_steps || project.nextAction,"Next action not entered")}{update.blockers ? <><br/>Blocker: {update.blockers}</> : null}</small></div>; })}</div>:<div className="tv-empty">No project updates have been entered yet.</div>}
      </div>
      <div className="tv-panel tv-production"><h2><IconTool/> Production by Station</h2>{shopWorkload.length ? <div className="tv-card-grid">{shopWorkload.slice(0,6).map((item)=><div className="tv-item-card" key={item.name}><span className="tv-card-tag gray">{item.count} total</span><strong>{item.name}</strong><small>{item.ready || 0} ready · {item.inProgress || 0} active · {item.onHold || 0} on hold</small></div>)}</div>:<div className="tv-empty">Artwork has not been released into a production station yet.</div>}</div>
      <div className="tv-panel tv-field"><h2><IconCalendarEvent/> Field Schedule</h2>{field.length ? <div className="tv-card-grid">{field.slice(0,4).map((x,i)=><div className="tv-item-card" key={x.id || i}><span className="tv-card-tag green">{dateOnly(x.start || x.date || x.dueDate)}</span><strong>{text(x.title,"Field activity")}</strong><small>Lead: {text(x.owner)}</small></div>)}</div>:<div className="tv-empty">No field work scheduled today.</div>}</div>
      <div className="tv-panel"><h2><IconCalendarEvent/> Pre-Quote Site Visits</h2>{siteVisits.length ? <><div className="tv-card-grid">{siteVisits.slice(0,4).map((visit)=><div className="tv-item-card" key={visit.id}><span className="tv-card-tag gray">{dateOnly(visit.requested_visit_date)}</span><strong>{text(visit.customer_name,"Potential job")}</strong><small>{text(visit.assigned_estimator)} · {text(visit.job_site_address,"Address not entered")}</small></div>)}</div><MoreCount total={siteVisits.length} shown={4}/></>:<div className="tv-empty">No open pre-quote site visits.</div>}</div>
      <div className="tv-panel"><h2><IconAlertTriangle/> Leadership Attention</h2>{blockers.length ? <div className="tv-card-grid">{blockers.slice(0,4).map((x,i)=><div className="tv-item-card urgent" key={x.id || i}><span className="tv-card-tag">Needs Action</span><strong>{text(x.title,"Blocker")}</strong><small>{text(x.detail,"Immediate review required")}</small></div>)}</div>:<div className="tv-empty">No blockers recorded.</div>}</div>
      <div className="tv-panel"><h2><IconTool/> Materials & Purchasing</h2><div className="tv-card-grid"><div className="tv-item-card"><span className="tv-card-tag gray">Purchasing</span><strong>{data?.outsideSummary?.materialsNeedOrdered || 0} need ordering</strong><small>Projects requiring purchasing action</small></div><div className="tv-item-card"><span className="tv-card-tag gray">Receiving</span><strong>{data?.outsideSummary?.materialsWaiting || 0} waiting on material</strong><small>Ordered but not fully received</small></div><div className="tv-item-card"><span className="tv-card-tag gray">Shop Load</span><strong>{summary.busiestDepartment || "No active station"}</strong><small>{summary.busiestDepartmentCount || 0} active at the busiest station</small></div></div></div>
    </section>
    <div className="tv-foot">Auto-refreshes every 30 seconds · Metal Worx Operations System</div>
  </div>;
}
