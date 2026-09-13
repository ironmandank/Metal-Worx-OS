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
  .tv-summary { margin-top:14px; padding:18px 22px; border:2px solid #7d151d; border-radius:12px; background:linear-gradient(135deg,#241216,#11171b); }
  .tv-summary label { color:#ff5965; font-weight:900; letter-spacing:.08em; text-transform:uppercase; }
  .tv-summary p { margin:10px 0 0; font-size:clamp(18px,1.45vw,28px); line-height:1.42; font-weight:700; }
  .tv-kpis { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:10px; margin-top:14px; }
  .tv-kpi { min-height:108px; padding:15px; border:1px solid #354047; border-radius:10px; background:#11181c; }
  .tv-kpi span { display:block; color:#d3d9dd !important; font-size:13px; font-weight:900; line-height:1.2; text-transform:uppercase; }
  .tv-kpi strong { display:block; margin-top:8px; color:#fff; font-size:clamp(30px,3vw,52px); line-height:1; }
  .tv-kpi.danger strong { color:#ff4050; } .tv-kpi.warn strong { color:#ffb22d; } .tv-kpi.good strong { color:#83dc4d; }
  .tv-grid { display:grid; grid-template-columns:1.2fr 1fr 1fr; gap:12px; margin-top:14px; }
  .tv-panel { min-height:260px; overflow:hidden; border:1px solid #354047; border-radius:10px; background:#10161a; }
  .tv-panel h2 { display:flex; align-items:center; gap:9px; margin:0; padding:13px 16px; border-bottom:1px solid #354047; color:#f6f7f8 !important; font-size:clamp(17px,1.25vw,24px); line-height:1.2; text-transform:uppercase; }
  .tv-panel h2 svg { color:#ff3445; flex:0 0 auto; }
  .tv-list { list-style:none; padding:0; margin:0; }
  .tv-list li { padding:13px 16px; border-bottom:1px solid #273036; font-size:clamp(14px,1vw,19px); line-height:1.25; }
  .tv-list strong { display:block; color:#fff; }
  .tv-list small { display:block; margin-top:4px; color:#9ba5ac; font-size:.82em; }
  .tv-empty { padding:28px 16px; color:#8c979f; font-size:18px; text-align:center; }
  .tv-foot { margin-top:12px; color:#76828a; font-size:12px; text-align:center; text-transform:uppercase; letter-spacing:.15em; }
  @media(max-width:1200px){ .tv-kpis{grid-template-columns:repeat(4,1fr)} .tv-grid{grid-template-columns:1fr 1fr}.tv-panel:first-child{grid-column:1/-1} }
  @media(max-width:700px){
    .tv-board{width:100%;padding:10px;overflow-x:hidden}
    .tv-head{align-items:stretch;flex-direction:column;padding:13px}
    .tv-brand{align-items:center;gap:10px}.tv-brand img{width:105px;height:44px}.tv-brand h1{font-size:22px}.tv-brand p{font-size:14px}
    .tv-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.tv-clock{grid-column:1/-1;min-width:0;text-align:center}.tv-btn{justify-content:center;min-width:0;padding:0 8px}.tv-btn.red{grid-column:1/-1}
    .tv-summary{padding:14px}.tv-summary p{font-size:17px;line-height:1.42}
    .tv-kpis{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.tv-kpi{min-height:92px;padding:12px}.tv-kpi span{font-size:12px}.tv-kpi strong{font-size:36px}
    .tv-grid{grid-template-columns:minmax(0,1fr);gap:10px}.tv-panel,.tv-panel:first-child{grid-column:auto;min-height:0}.tv-panel h2{padding:12px;font-size:16px}.tv-list li{padding:12px;font-size:15px}.tv-empty{padding:20px 12px;font-size:15px;min-height:0}
  }
`;

const text = (value, fallback = "Not assigned") => String(value || fallback);
const dateOnly = (value) => value ? new Date(value).toLocaleDateString() : "Date not set";

function buildExecutiveSummary(data) {
  const h = data?.morningHuddle || {};
  const s = h.summary || {};
  const projects = data?.outsideProjects || [];
  const priorityItems = data?.priorityFeed?.combined || [];
  const sentences = [`Metal Worx begins today with ${priorityItems.length} Hot Today or quick-turnaround priorit${priorityItems.length === 1 ? "y" : "ies"}, ${s.activeShopJobs || 0} active shop job${s.activeShopJobs === 1 ? "" : "s"}, ${projects.length} active outside project${projects.length === 1 ? "" : "s"}, and ${s.todayFieldWork || 0} scheduled field activit${s.todayFieldWork === 1 ? "y" : "ies"}.`];
  if (s.blockers) sentences.push(`${s.blockers} active blocker${s.blockers === 1 ? " requires" : "s require"} leadership attention before new work is released.`);
  else sentences.push("No active operational blockers are currently recorded.");
  if (s.overdueActions) sentences.push(`${s.overdueActions} overdue action${s.overdueActions === 1 ? " must" : "s must"} be assigned and recovered today.`);
  if (projects.length) sentences.push("Outside-project leads are listed on the board for huddle assignments and follow-up.");
  return sentences.join(" ");
}

export default function MorningHuddleTV({ setPage }) {
  const [data, setData] = useState(null);
  const [now, setNow] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    try { setError(""); setData(await getDashboardData()); }
    catch (e) { setError(e?.message || "Huddle data could not load."); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); const refresh = setInterval(load, 30000); return () => clearInterval(refresh); }, []);
  useEffect(() => { const clock = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(clock); }, []);

  const huddle = data?.morningHuddle || {};
  const summary = huddle.summary || {};
  const projects = data?.outsideProjects || [];
  const priorityItems = data?.priorityFeed?.combined || [];
  const projectLeadCount = new Set(projects.map((project) => String(project.owner || project.assigned_to || "").trim()).filter(Boolean)).size;
  const blockerTasks = (huddle.checklistItems || []).filter((item) => item.status === "Blocked" || item.blocker);
  const executive = useMemo(() => buildExecutiveSummary(data), [data]);
  const priorities = [...priorityItems, ...(huddle.todayFocus || [])].filter((item,index,all) => all.findIndex((candidate) => String(candidate.sourceType || candidate.type) === String(item.sourceType || item.type) && String(candidate.sourceId || candidate.id) === String(item.sourceId || item.id)) === index).slice(0,8);
  const field = (huddle.todayFieldWork || []).slice(0,6);
  const blockers = [...(huddle.blockers || []), ...blockerTasks.map((b) => ({ title: b.blocker || "Blocked checklist task", detail: "Checklist blocker" }))].slice(0,6);
  const shopWorkload = (huddle.shopWorkload || []).filter((item) => Number(item.count || 0) > 0);

  async function fullscreen() { if (!document.fullscreenElement) await document.documentElement.requestFullscreen(); else await document.exitFullscreen(); }

  return <div className="tv-board"><style>{styles}</style>
    <header className="tv-head">
      <div className="tv-brand"><img src={metalWorxLogo} alt="Metal Worx"/><div><h1>Monday Morning Huddle</h1><p>Live operations and leadership briefing</p></div></div>
      <div className="tv-actions"><div className="tv-clock"><strong>{now.toLocaleTimeString([], {hour:"numeric",minute:"2-digit"})}</strong><span>{now.toLocaleDateString([], {weekday:"long",month:"long",day:"numeric"})}</span></div><button className="tv-btn" onClick={load}><IconRefresh/> Refresh</button><button className="tv-btn" onClick={fullscreen}><IconArrowsMaximize/> Full Screen</button><button className="tv-btn red" onClick={() => setPage("dashboard")}><IconX/> Exit TV</button></div>
    </header>
    {error && <div className="tv-summary"><p>{error}</p></div>}
    <section className="tv-summary"><label>Executive Summary</label><p>{loading ? "Preparing today’s operating summary…" : executive}</p></section>
    <section className="tv-kpis">
      <div className="tv-kpi danger"><span>Hot Items / Quick Turnaround</span><strong>{priorityItems.length}</strong></div>
      <div className="tv-kpi good"><span>Active Shop Jobs</span><strong>{summary.activeShopJobs || 0}</strong></div>
      <div className="tv-kpi"><span>Outside Projects</span><strong>{projects.length}</strong></div>
      <div className="tv-kpi"><span>Outside Project Leads</span><strong>{projectLeadCount}</strong></div>
      <div className="tv-kpi danger"><span>Blockers</span><strong>{summary.blockers || blockers.length}</strong></div>
      <div className="tv-kpi warn"><span>Overdue</span><strong>{summary.overdueActions || 0}</strong></div>
      <div className="tv-kpi good"><span>Field Today</span><strong>{summary.todayFieldWork || 0}</strong></div>
      <div className="tv-kpi"><span>Due Today</span><strong>{summary.todayActions || 0}</strong></div>
    </section>
    <section className="tv-grid">
      <div className="tv-panel"><h2><IconClipboardCheck/> Hot Items & Today’s Commitments</h2>{priorities.length ? <ul className="tv-list">{priorities.map((x,i)=><li key={`${x.sourceType || x.type || "priority"}-${x.id || x.sourceId || i}`}><strong>{text(x.title,"Priority")}</strong><small>{text(x.owner)} · {text(x.department || x.category || x.nextAction,"Action required")} · {text(x.dueDisplay || x.dueDate,"No time set")}</small></li>)}</ul>:<div className="tv-empty">No Hot Today items or commitments recorded.</div>}</div>
      <div className="tv-panel"><h2><IconTool/> Art & Shop Production</h2>{shopWorkload.length ? <ul className="tv-list">{shopWorkload.map((item)=><li key={item.name}><strong>{item.name}: {item.count}</strong><small>Active work at this station</small></li>)}</ul>:<div className="tv-empty">No active shop production is recorded.</div>}</div>
      <div className="tv-panel"><h2><IconCalendarEvent/> Field Schedule</h2>{field.length ? <ul className="tv-list">{field.map((x,i)=><li key={x.id || i}><strong>{text(x.title,"Field activity")}</strong><small>{dateOnly(x.start || x.date || x.dueDate)} · {text(x.owner)}</small></li>)}</ul>:<div className="tv-empty">No field work scheduled today.</div>}</div>
      <div className="tv-panel"><h2><IconAlertTriangle/> Leadership Attention</h2>{blockers.length ? <ul className="tv-list">{blockers.map((x,i)=><li key={x.id || i}><strong>{text(x.title,"Blocker")}</strong><small>{text(x.detail,"Immediate review required")}</small></li>)}</ul>:<div className="tv-empty">No blockers recorded.</div>}</div>
      <div className="tv-panel"><h2><IconUsers/> Outside Project Leads</h2>{projects.length ? <ul className="tv-list">{projects.slice(0,12).map((p)=><li key={p.id}><strong>{text(p.title || p.projectName || p.project_name || p.project_number,"Project")}</strong><small>Lead: {text(p.owner || p.assigned_to)}</small></li>)}</ul>:<div className="tv-empty">No active outside projects.</div>}</div>
      <div className="tv-panel"><h2><IconTool/> Materials & Purchasing</h2><ul className="tv-list"><li><strong>{data?.outsideSummary?.materialsNeedOrdered || 0} need ordering</strong><small>Projects requiring purchasing action</small></li><li><strong>{data?.outsideSummary?.materialsWaiting || 0} waiting on material</strong><small>Ordered but not fully received</small></li><li><strong>Busiest shop station: {summary.busiestDepartment || "None"}</strong><small>{summary.busiestDepartmentCount || 0} active at this station</small></li></ul></div>
    </section>
    <div className="tv-foot">Auto-refreshes every 30 seconds · Metal Worx Operations System</div>
  </div>;
}
