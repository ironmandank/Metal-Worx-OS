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
  .tv-kpis { display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); gap:10px; margin-top:14px; }
  .tv-kpi { display:flex; min-width:0; min-height:140px; padding:15px; border:1px solid #354047; border-radius:10px; background:#11181c; flex-direction:column; align-items:center; text-align:center; }
  .tv-kpi span { display:flex; width:100%; min-height:48px; align-items:flex-start; justify-content:center; color:#d3d9dd !important; font-size:13px; font-weight:900; line-height:1.2; text-transform:uppercase; }
  .tv-kpi strong { display:flex; min-height:58px; margin-top:auto; align-items:center; justify-content:center; color:#fff; font-size:clamp(30px,3vw,52px); line-height:1; }
  .tv-kpi.danger strong { color:#ff4050; } .tv-kpi.warn strong { color:#ffb22d; } .tv-kpi.good strong { color:#83dc4d; }
  .tv-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin-top:14px; }
  .tv-panel { min-height:190px; overflow:hidden; border:1px solid #354047; border-radius:10px; background:#10161a; }
  .tv-panel h2 { display:flex; align-items:center; gap:9px; margin:0; padding:13px 16px; border-bottom:1px solid #354047; color:#f6f7f8 !important; font-size:clamp(17px,1.25vw,24px); line-height:1.2; text-transform:uppercase; }
  .tv-panel h2 svg { color:#ff3445; flex:0 0 auto; }
  .tv-list { list-style:none; padding:0; margin:0; }
  .tv-list li { padding:13px 16px; border-bottom:1px solid #273036; font-size:clamp(14px,1vw,19px); line-height:1.25; }
  .tv-list strong { display:block; color:#fff; }
  .tv-list small { display:block; margin-top:4px; color:#9ba5ac; font-size:.82em; }
  .tv-empty { padding:28px 16px; color:#8c979f; font-size:18px; text-align:center; }
  .tv-foot { margin-top:12px; color:#76828a; font-size:12px; text-align:center; text-transform:uppercase; letter-spacing:.15em; }
  @media(max-width:1400px){ .tv-kpis{grid-template-columns:repeat(4,1fr)} .tv-grid{grid-template-columns:1fr 1fr} }
  @media(max-width:700px){
    .tv-board{width:100%;padding:8px;overflow-x:hidden}
    .tv-head{align-items:stretch;flex-direction:column;padding:13px}
    .tv-brand{align-items:center;gap:10px}.tv-brand img{width:92px;height:40px}.tv-brand h1{font-size:20px;line-height:1.1}.tv-brand p{font-size:13px}
    .tv-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.tv-clock{grid-column:1/-1;min-width:0;text-align:center}.tv-btn{justify-content:center;min-width:0;padding:0 8px}.tv-btn.red{grid-column:1/-1}
    .tv-summary{padding:14px}.tv-summary p{font-size:17px;line-height:1.42}
    .tv-kpis{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.tv-kpi{min-height:122px;padding:12px}.tv-kpi span{min-height:43px;font-size:12px}.tv-kpi strong{min-height:48px;font-size:36px}
    .tv-grid{grid-template-columns:minmax(0,1fr);gap:10px}.tv-panel{grid-column:auto;min-height:0}.tv-panel h2{padding:12px;font-size:16px}.tv-list li{padding:12px;font-size:15px}.tv-empty{padding:20px 12px;font-size:15px;min-height:0}
  }
`;

const text = (value, fallback = "Not assigned") => String(value || fallback);
const dateOnly = (value) => value ? new Date(String(value).length === 10 ? `${value}T12:00:00` : value).toLocaleDateString() : "Date not set";

function buildExecutiveSummary(data, openSiteVisitCount = 0, artworkOrderCount = 0, hotArtworkCount = 0) {
  const h = data?.morningHuddle || {};
  const s = h.summary || {};
  const projects = data?.outsideProjects || [];
  const sentences = [`${hotArtworkCount} hot artwork priorit${hotArtworkCount === 1 ? "y" : "ies"}, ${artworkOrderCount} regular artwork order${artworkOrderCount === 1 ? "" : "s"}, ${s.activeShopJobs || 0} active shop job${s.activeShopJobs === 1 ? "" : "s"}, ${projects.length} outside project${projects.length === 1 ? "" : "s"}, and ${openSiteVisitCount} open site visit${openSiteVisitCount === 1 ? "" : "s"}.`];
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
  const priorityItems = data?.priorityFeed?.combined || [];
  const artworkOrders = data?.artworkOrders || [];
  const projectLeadCount = new Set(projects.map((project) => String(project.owner || project.assigned_to || "").trim()).filter(Boolean)).size;
  const blockerTasks = (huddle.checklistItems || []).filter((item) => item.status === "Blocked" || item.blocker);
  const linkedPriorityIds = new Set(priorityItems.filter((item) => item.sourceType === "customerOrder" && item.sourceId).map((item) => String(item.sourceId)));
  const priorityTitles = new Set(priorityItems.map((item) => String(item.title || "").trim().toLowerCase()).filter(Boolean));
  const unduplicatedOrders = artworkOrders.filter((order) => !linkedPriorityIds.has(String(order.id)) && !priorityTitles.has(String(order.title || "").trim().toLowerCase()));
  const agingArtwork = unduplicatedOrders.filter((order) => Number(order.businessDaysInShop || 0) >= 12).map((order) => ({ ...order, daysInShop: order.businessDaysInShop, hotReasonCategory: "Aging", dueDisplay: "12+ business days" }));
  const regularArtwork = unduplicatedOrders.filter((order) => Number(order.businessDaysInShop || 0) < 12).sort((a,b) => Number(b.businessDaysInShop || 0) - Number(a.businessDaysInShop || 0)).slice(0,10);
  const priorities = [...priorityItems, ...agingArtwork].filter((item,index,all) => all.findIndex((candidate) => String(candidate.sourceType || candidate.type) === String(item.sourceType || item.type) && String(candidate.sourceId || candidate.id) === String(item.sourceId || item.id)) === index).slice(0,10);
  const executive = useMemo(() => buildExecutiveSummary(data, siteVisits.length, regularArtwork.length, priorities.length), [data, siteVisits.length, regularArtwork.length, priorities.length]);
  const field = (huddle.todayFieldWork || []).slice(0,6);
  const blockers = [...(huddle.blockers || []), ...blockerTasks.map((b) => ({ title: b.blocker || "Blocked checklist task", detail: "Checklist blocker" }))].slice(0,6);
  const shopWorkload = (huddle.shopWorkload || []).filter((item) => Number(item.count || 0) > 0);

  async function fullscreen() { if (!document.fullscreenElement) await document.documentElement.requestFullscreen(); else await document.exitFullscreen(); }

  return <div className="tv-board"><style>{styles}</style>
    <header className="tv-head">
      <div className="tv-brand"><img src={metalWorxLogo} alt="Metal Worx"/><div><h1>Metal Worx Morning Huddle</h1><p>Whole-shop priorities, deadlines, and decisions</p></div></div>
      <div className="tv-actions"><div className="tv-clock"><strong>{now.toLocaleTimeString([], {hour:"numeric",minute:"2-digit"})}</strong><span>{now.toLocaleDateString([], {weekday:"long",month:"long",day:"numeric"})}</span></div><button className="tv-btn" onClick={load}><IconRefresh/> Refresh</button><button className="tv-btn" onClick={fullscreen}><IconArrowsMaximize/> Full Screen</button><button className="tv-btn red" onClick={() => setPage("dashboard")}><IconX/> Exit TV</button></div>
    </header>
    {error && <div className="tv-summary"><p>{error}</p></div>}
    <section className="tv-summary"><label>Executive Summary</label><p>{loading ? "Preparing today’s operating summary…" : executive}</p></section>
    <section className="tv-kpis">
      <div className="tv-kpi danger"><span>Hot Artwork This Week</span><strong>{priorities.length}</strong></div>
      <div className="tv-kpi warn"><span>Artwork Orders</span><strong>{regularArtwork.length}</strong></div>
      <div className="tv-kpi good"><span>Active Shop Jobs</span><strong>{summary.activeShopJobs || 0}</strong></div>
      <div className="tv-kpi"><span>Outside Projects</span><strong>{projects.length}</strong></div>
      <div className="tv-kpi warn"><span>Open Site Visits</span><strong>{siteVisits.length}</strong></div>
      <div className="tv-kpi good"><span>Field Today</span><strong>{summary.todayFieldWork || 0}</strong></div>
      <div className="tv-kpi danger"><span>Needs Attention</span><strong>{Number(summary.blockers || blockers.length) + Number(summary.overdueActions || 0)}</strong></div>
    </section>
    <section className="tv-grid">
      <div className="tv-panel"><h2><IconClipboardCheck/> Hot Artwork This Week</h2>{priorities.length ? <ul className="tv-list">{priorities.map((x,i)=><li key={`${x.sourceType || x.type || "priority"}-${x.id || x.sourceId || i}`}><strong>{text(x.title,"Artwork priority")}</strong><small>{text(x.owner)} · {text(x.department,"Stage not assigned")} · {x.daysInShop || 0} days in shop · {text(x.hotReasonCategory,"Deadline")} · {text(x.dueDisplay || x.dueDate,"No deadline set")}{x.reason ? ` · ${x.reason}` : ""}</small></li>)}</ul>:<div className="tv-empty">No artwork has been marked hot for this week.</div>}</div>
      <div className="tv-panel"><h2><IconClipboardCheck/> Artwork Orders</h2>{regularArtwork.length ? <ul className="tv-list">{regularArtwork.map((x)=><li key={x.id}><strong>{text(x.title,"Artwork order")}</strong><small>{text(x.customer,"Customer not entered")} · {x.businessDaysInShop || 0} business days · {text(x.department,"Not released")} · Lead: {text(x.owner)}</small></li>)}</ul>:<div className="tv-empty">No regular artwork orders are waiting outside the hot list.</div>}</div>
      <div className="tv-panel"><h2><IconTool/> Production by Station</h2>{shopWorkload.length ? <ul className="tv-list">{shopWorkload.map((item)=><li key={item.name}><strong>{item.name}: {item.count}</strong><small>{item.ready || 0} ready · {item.inProgress || 0} active · {item.onHold || 0} on hold</small></li>)}</ul>:<div className="tv-empty">Artwork has not been released into a production station yet.</div>}</div>
      <div className="tv-panel"><h2><IconCalendarEvent/> Field Schedule</h2>{field.length ? <ul className="tv-list">{field.map((x,i)=><li key={x.id || i}><strong>{text(x.title,"Field activity")}</strong><small>{dateOnly(x.start || x.date || x.dueDate)} · {text(x.owner)}</small></li>)}</ul>:<div className="tv-empty">No field work scheduled today.</div>}</div>
      <div className="tv-panel"><h2><IconCalendarEvent/> Pre-Quote Site Visits</h2>{siteVisits.length ? <ul className="tv-list">{siteVisits.slice(0,8).map((visit)=><li key={visit.id}><strong>{text(visit.customer_name,"Potential job")}</strong><small>{dateOnly(visit.requested_visit_date)} · {text(visit.assigned_estimator)} · {text(visit.job_site_address,"Address not entered")}</small></li>)}</ul>:<div className="tv-empty">No open pre-quote site visits.</div>}</div>
      <div className="tv-panel"><h2><IconAlertTriangle/> Leadership Attention</h2>{blockers.length ? <ul className="tv-list">{blockers.map((x,i)=><li key={x.id || i}><strong>{text(x.title,"Blocker")}</strong><small>{text(x.detail,"Immediate review required")}</small></li>)}</ul>:<div className="tv-empty">No blockers recorded.</div>}</div>
      <div className="tv-panel"><h2><IconUsers/> Outside Project Leads</h2>{projects.length ? <ul className="tv-list">{projects.slice(0,12).map((p)=><li key={p.id}><strong>{text(p.title || p.projectName || p.project_name || p.project_number,"Project")}</strong><small>Lead: {text(p.owner || p.assigned_to)}</small></li>)}</ul>:<div className="tv-empty">No active outside projects.</div>}</div>
      <div className="tv-panel"><h2><IconTool/> Materials & Purchasing</h2><ul className="tv-list"><li><strong>{data?.outsideSummary?.materialsNeedOrdered || 0} need ordering</strong><small>Projects requiring purchasing action</small></li><li><strong>{data?.outsideSummary?.materialsWaiting || 0} waiting on material</strong><small>Ordered but not fully received</small></li><li><strong>Busiest shop station: {summary.busiestDepartment || "None"}</strong><small>{summary.busiestDepartmentCount || 0} active at this station</small></li></ul></div>
    </section>
    <div className="tv-foot">Auto-refreshes every 30 seconds · Metal Worx Operations System</div>
  </div>;
}
