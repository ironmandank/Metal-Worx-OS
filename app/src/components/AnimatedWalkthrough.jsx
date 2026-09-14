import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  IconArrowLeft,
  IconArrowRight,
  IconBriefcase,
  IconBuildingFactory2,
  IconHelpCircle,
  IconTool,
  IconUsers,
  IconX,
} from "@tabler/icons-react";

const TOURS = {
  overview: {
    label: "System Overview",
    icon: IconBuildingFactory2,
    description: "Navigation, dashboard, alerts, and the main operating areas.",
    steps: [
      { page: "dashboard", target: "nav-menu", title: "Main Navigation", text: "Open Menu to reach Office, Sales, Outside Projects, Inventory, Production, and every shop station." },
      { page: "dashboard", target: "global-search", title: "Global Search", text: "Use this search area to quickly find orders, customers, jobs, projects, and inventory." },
      { page: "dashboard", target: "shop-status", title: "Live Shop Status", text: "LIVE confirms that the operating system is connected and ready for current shop information." },
      { page: "dashboard", target: "notifications", title: "Notifications", text: "Open the bell for assignments, callbacks, project changes, and items requiring attention." },
      { page: "dashboard", target: "page-content", title: "Operations Command Center", text: "The dashboard brings together shop work, outside projects, Hot Artwork, schedules, blockers, and Morning Huddle information." },
    ],
  },
  office: {
    label: "Office & Orders",
    icon: IconBriefcase,
    description: "Customers, new orders, quotes, inventory, payment, and closeout.",
    steps: [
      { page: "customerOrders", target: "page-content", title: "Customer Orders", text: "Review every active order, promised date, customer, status, and production connection here." },
      { page: "orderBuilder", target: "page-content", title: "Create an Order", text: "Enter the customer, items, fulfillment method, promised date, design needs, and payment information before saving." },
      { page: "quoteCenter", target: "page-content", title: "Quote Center", text: "Create and manage project or standalone quotes, then export the approved Metal Worx format." },
      { page: "inventoryItems", target: "page-content", title: "Inventory Control", text: "Search and select inventory, change bins in bulk, update quantities, archive items, and use administrator-only permanent deletion when appropriate." },
      { page: "dashboard", target: "page-content", title: "Office Closeout", text: "Use the dashboard closeout queues to finish payment, fulfillment, documentation, and final project records." },
    ],
  },
  shop: {
    label: "Shop & Artwork",
    icon: IconTool,
    description: "Hot Artwork, production priorities, stations, and completion.",
    steps: [
      { page: "hotToday", target: "page-content", title: "Hot Artwork", text: "Type up to 10 art priorities with the customer, pickup or ship method, promised date, lead, and production notes." },
      { page: "hotToday", target: "page-content", title: "Hot Today", text: "Promote existing work that management needs moved immediately. Mark it complete or remove it when priorities change." },
      { page: "productionControl", target: "page-content", title: "Production Control", text: "See active shop work and move jobs through Design, Laser, Prep, Welding, Finish, Assembly, and Final QC." },
      { page: "designQueue", target: "page-content", title: "Design Queue", text: "Track artwork and customer-approval work before releasing files to production." },
      { page: "dashboard", target: "page-content", title: "Whole-Shop Visibility", text: "The dashboard and TV Huddle combine artwork, shop production, outside work, materials, dates, and blockers." },
    ],
  },
  outside: {
    label: "Outside Projects",
    icon: IconUsers,
    description: "Intake, checklist, lead updates, completion, and saved packages.",
    steps: [
      { page: "projects", target: "page-content", title: "Outside Project Index", text: "Review active project cards, leads, stages, checklist progress, daily updates, and quick actions." },
      { page: "newProject", target: "page-content", title: "Project Intake Assistant", text: "Paste a write-up or upload PDF, Word, Excel, CSV, Markdown, or text. Always review the prepared project, checklist, materials, and quote before saving." },
      { page: "projects", target: "page-content", title: "Project Checklist", text: "Open a project and use Checklist & Updates to add only the tasks needed for that individual project." },
      { page: "projects", target: "page-content", title: "Daily Lead Update", text: "Project leads record the update date, completed work, current work, next steps, blockers, needs, and decisions." },
      { page: "projects", target: "page-content", title: "Complete & Package", text: "Complete the project from Quick Actions, preserve its files and history, and reuse a blank copy of its checklist on a similar future job." },
    ],
  },
  huddle: {
    label: "Morning Huddle",
    icon: IconUsers,
    description: "TV mode, whole-shop priorities, deadlines, leads, and leadership notes.",
    steps: [
      { page: "dashboard", target: "page-content", title: "Prepare the Huddle", text: "Review Hot Today, Hot Artwork, dated customer orders, shop workload, outside projects, field work, and blockers before the meeting." },
      { page: "dashboard", target: "page-content", title: "TV Huddle", text: "Select TV Huddle, then use Full Screen on the shop television. The board refreshes automatically and covers the whole Metal Worx operation." },
      { page: "dashboard", target: "page-content", title: "Promised Dates & Leads", text: "The TV board calls out upcoming pickup and ship dates, assigned shop leads, outside-project leads, field work, and missing updates." },
      { page: "dashboard", target: "page-content", title: "Leadership Notes", text: "Prepare Leadership Notes, copy them into ChatGPT, and request one concise executive paragraph plus blockers, decisions, needs, and next priorities." },
    ],
  },
};

const WALKTHROUGH_STYLES = `
  .mw-tour-help{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:40px;padding:0 12px;border:1px solid #46515a;border-radius:9px;background:#151d22;color:#fff;font:800 13px Arial,sans-serif;cursor:pointer;white-space:nowrap}
  .mw-tour-help:hover{border-color:#e32232;color:#fff}.mw-tour-help svg{width:19px;height:19px;color:#ff3445}
  .mw-tour-backdrop{position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.62);animation:mw-tour-fade .22s ease both}
  .mw-tour-spotlight{position:fixed;z-index:10001;border:3px solid #ff2638;border-radius:14px;box-shadow:0 0 0 9999px rgba(0,0,0,.66),0 0 28px rgba(255,38,56,.75);pointer-events:none;transition:all .38s cubic-bezier(.2,.8,.2,1);animation:mw-tour-pulse 1.7s ease-in-out infinite}
  .mw-tour-card{position:fixed;z-index:2147483001;width:min(420px,calc(100vw - 24px));padding:20px;border:1px solid #56616a;border-radius:16px;background:linear-gradient(145deg,#161d21,#0a0e11);box-shadow:0 24px 70px rgba(0,0,0,.7);color:#f7f8f9;font-family:Arial,sans-serif;animation:mw-tour-rise .3s ease both;pointer-events:auto!important}
  .mw-tour-card-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.mw-tour-eyebrow{color:#ff4a58;font-size:12px;font-weight:900;letter-spacing:.09em;text-transform:uppercase}.mw-tour-card h2{margin:6px 0 8px;color:#fff!important;font-size:25px;line-height:1.08}.mw-tour-card p{margin:0;color:#c9d0d5;font-size:16px;line-height:1.5}.mw-tour-close{border:0;background:transparent;color:#aeb7bd;cursor:pointer}.mw-tour-progress{height:6px;margin:18px 0 14px;border-radius:999px;background:#283036;overflow:hidden}.mw-tour-progress i{display:block;height:100%;background:linear-gradient(90deg,#a9000d,#ff3042);transition:width .3s ease}.mw-tour-actions{display:flex;justify-content:space-between;gap:10px;position:relative;z-index:2}.mw-tour-actions button{appearance:none!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:6px!important;min-height:46px!important;padding:0 16px!important;border:1px solid #46515a!important;border-radius:9px!important;background:#151d22!important;color:#fff!important;font-weight:850!important;cursor:pointer!important;pointer-events:auto!important;touch-action:manipulation}.mw-tour-actions button.primary{border-color:#d91525!important;background:#a9000d!important}.mw-tour-actions button:disabled{opacity:.35!important;cursor:not-allowed!important}
  .mw-tour-picker{position:fixed!important;inset:0!important;z-index:2147483000!important;display:grid!important;place-items:center!important;width:100vw!important;height:100dvh!important;padding:14px!important;overflow:hidden!important;background:rgba(0,0,0,.86)!important}.mw-tour-picker-panel{position:relative!important;width:min(760px,100%)!important;max-height:calc(100dvh - 28px)!important;overflow-y:auto!important;overscroll-behavior:contain;padding:22px!important;border:1px solid #46515a!important;border-radius:18px!important;background:#0e1418!important;color:#fff!important;font-family:Arial,sans-serif!important}.mw-tour-picker-head{display:flex!important;justify-content:space-between!important;gap:12px!important}.mw-tour-picker h2{margin:0!important;color:#fff!important;background:transparent!important}.mw-tour-picker p{color:#aeb7bd!important;background:transparent!important}.mw-tour-options{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:12px!important;margin-top:18px!important}.mw-tour-option{appearance:none!important;display:flex!important;align-items:flex-start!important;gap:13px!important;width:100%!important;min-height:112px!important;margin:0!important;padding:16px!important;border:1px solid #364148!important;border-radius:12px!important;background:#151c20!important;color:#fff!important;text-align:left!important;cursor:pointer!important;box-shadow:none!important}.mw-tour-option:hover{border-color:#e32232!important;transform:translateY(-1px)}.mw-tour-option svg{flex:0 0 auto!important;color:#ff3445!important;background:transparent!important}.mw-tour-option>span{display:block!important;min-width:0!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important}.mw-tour-option strong{display:block!important;margin:0!important;padding:0!important;color:#fff!important;background:transparent!important;font-size:17px!important;line-height:1.25!important}.mw-tour-option span span{display:block!important;margin-top:7px!important;padding:0!important;border:0!important;border-radius:0!important;color:#aeb7bd!important;background:transparent!important;font-size:14px!important;line-height:1.4!important}.mw-tour-picker .mw-tour-close{appearance:none!important;display:grid!important;place-items:center!important;flex:0 0 42px!important;width:42px!important;height:42px!important;padding:0!important;border:1px solid #3b454c!important;border-radius:9px!important;background:#171e22!important;color:#fff!important}
  @keyframes mw-tour-fade{from{opacity:0}to{opacity:1}}@keyframes mw-tour-rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}@keyframes mw-tour-pulse{50%{box-shadow:0 0 0 9999px rgba(0,0,0,.66),0 0 42px rgba(255,38,56,.95)}}
  @media(max-width:700px){.mw-tour-help span{display:none}.mw-tour-help{width:40px;padding:0}.mw-tour-picker{place-items:start center!important;padding:calc(env(safe-area-inset-top) + 12px) 12px calc(env(safe-area-inset-bottom) + 12px)!important}.mw-tour-picker-panel{max-height:calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 24px)!important;padding:18px!important}.mw-tour-options{grid-template-columns:1fr!important}.mw-tour-option{min-height:100px!important}.mw-tour-card{left:12px!important;right:12px!important;bottom:calc(env(safe-area-inset-bottom) + 12px)!important;top:auto!important;width:auto}.mw-tour-card h2{font-size:21px}.mw-tour-card p{font-size:15px}.mw-tour-spotlight{display:none}}
`;

export default function AnimatedWalkthrough({ currentPage, navigate }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const savedTour = (() => {
    try { return JSON.parse(sessionStorage.getItem("mw-active-tour") || "null"); }
    catch { return null; }
  })();
  const [tourKey, setTourKey] = useState(savedTour?.tourKey || "");
  const [stepIndex, setStepIndex] = useState(Number(savedTour?.stepIndex || 0));
  const [rect, setRect] = useState(null);
  const tour = tourKey ? TOURS[tourKey] : null;
  const step = tour?.steps[stepIndex];

  const cardPosition = useMemo(() => {
    if (!rect) return { left: 24, bottom: 24 };
    const roomBelow = window.innerHeight - rect.bottom;
    if (roomBelow > 290) return { left: Math.min(Math.max(12, rect.left), window.innerWidth - 440), top: rect.bottom + 18 };
    return { left: Math.min(Math.max(12, rect.left), window.innerWidth - 440), bottom: Math.max(18, window.innerHeight - rect.top + 18) };
  }, [rect]);

  useEffect(() => {
    if (!step) return undefined;
    if (step.page && currentPage !== step.page) {
      navigate(step.page);
      return undefined;
    }
    const update = () => {
      const element = document.querySelector(`[data-tour="${step.target}"]`);
      if (!element) { setRect(null); return; }
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => {
        const bounds = element.getBoundingClientRect();
        setRect({ left: Math.max(6, bounds.left - 7), top: Math.max(6, bounds.top - 7), width: Math.min(window.innerWidth - 12, bounds.width + 14), height: Math.min(window.innerHeight - 12, bounds.height + 14), right: bounds.right + 7, bottom: bounds.bottom + 7 });
      }, 280);
    };
    const timer = window.setTimeout(update, 180);
    window.addEventListener("resize", update);
    return () => { window.clearTimeout(timer); window.removeEventListener("resize", update); };
  }, [currentPage, navigate, step]);

  function saveProgress(key, index) { sessionStorage.setItem("mw-active-tour", JSON.stringify({ tourKey: key, stepIndex: index })); }
  function start(key) {
    setPickerOpen(false); setTourKey(key); setStepIndex(0); setRect(null); saveProgress(key, 0);
    const firstStep = TOURS[key]?.steps[0];
    if (firstStep?.page && firstStep.page !== currentPage) navigate(firstStep.page);
  }
  function close() { sessionStorage.removeItem("mw-active-tour"); setTourKey(""); setStepIndex(0); setRect(null); }
  function next() {
    if (stepIndex >= tour.steps.length - 1) { localStorage.setItem(`mw-tour-${tourKey}-completed`, new Date().toISOString()); close(); return; }
    const nextIndex = stepIndex + 1;
    const nextStep = tour.steps[nextIndex];
    saveProgress(tourKey, nextIndex); setRect(null); setStepIndex(nextIndex);
    if (nextStep?.page && nextStep.page !== currentPage) navigate(nextStep.page);
  }
  function previous() {
    const previousIndex = Math.max(0, stepIndex - 1);
    const previousStep = tour.steps[previousIndex];
    saveProgress(tourKey, previousIndex); setRect(null); setStepIndex(previousIndex);
    if (previousStep?.page && previousStep.page !== currentPage) navigate(previousStep.page);
  }

  const overlay = <>
    {pickerOpen && <div className="mw-tour-picker" role="dialog" aria-modal="true" aria-label="Choose a guided walkthrough">
      <div className="mw-tour-picker-panel">
        <div className="mw-tour-picker-head"><div><h2>Metal Worx OS Guided Walkthrough</h2><p>Choose the part of the system you want to learn. You can stop or replay a tour at any time.</p></div><button type="button" className="mw-tour-close" onClick={() => setPickerOpen(false)} aria-label="Close"><IconX/></button></div>
        <div className="mw-tour-options">{Object.entries(TOURS).map(([key, option]) => { const TourIcon = option.icon; return <button type="button" className="mw-tour-option" key={key} onClick={() => start(key)}><TourIcon/><span><strong>{option.label}</strong><span>{option.description}</span></span></button>; })}</div>
      </div>
    </div>}
    {step && <>
      <div className="mw-tour-backdrop"/>
      {rect && <div className="mw-tour-spotlight" style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}/>} 
      <section className="mw-tour-card" style={cardPosition} role="dialog" aria-live="polite">
        <div className="mw-tour-card-top"><div><div className="mw-tour-eyebrow">{tour.label} · Step {stepIndex + 1} of {tour.steps.length}</div><h2>{step.title}</h2></div><button type="button" className="mw-tour-close" onClick={close} aria-label="Exit walkthrough"><IconX/></button></div>
        <p>{step.text}</p>
        <div className="mw-tour-progress"><i style={{ width: `${((stepIndex + 1) / tour.steps.length) * 100}%` }}/></div>
        <div className="mw-tour-actions"><button type="button" onClick={previous} disabled={stepIndex === 0}><IconArrowLeft/> Back</button><button type="button" className="primary" onClick={next}>{stepIndex === tour.steps.length - 1 ? "Finish" : "Next"}<IconArrowRight/></button></div>
      </section>
    </>}
  </>;

  return <>
    <style>{WALKTHROUGH_STYLES}</style>
    <button type="button" className="mw-tour-help" data-tour="help" onClick={() => setPickerOpen(true)} title="Guided walkthrough"><IconHelpCircle/><span>Help Tour</span></button>
    {createPortal(overlay, document.body)}
  </>;
}
