import { useEffect, useMemo, useState } from "react";

import {
  IconAlertTriangle,
  IconBolt,
  IconBox,
  IconBuildingFactory2,
  IconCalendarEvent,
  IconClipboardList,
  IconCopy,
  IconFileDescription,
  IconHammer,
  IconMapPin,
  IconDeviceTv,
  IconRefresh,
  IconShieldCheck,
  IconSparkles,
  IconTool,
  IconTruckDelivery,
  IconUsers,
  IconX,
} from "@tabler/icons-react";

import { supabase } from "../lib/supabase";
import { getDashboardData } from "../services/dashboardService";
import metalWorxLogo from "../assets/metal-worx-official-transparent.png";
import PersonalFollowUps from "../components/PersonalFollowUps";

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
    position: relative; display: grid; grid-template-columns: 1fr;
    align-items: center; gap: 18px; min-height: 76px; padding: 12px 14px;
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
  .mc-brand {
    position: relative; z-index: 1; display: flex; align-items: center; min-width: 0;
  }
  .mc-logo {
    width: 150px; height: 42px; padding-right: 16px; object-fit: contain; object-position: center;
    border-right: 1px solid #3c454d; flex: 0 0 auto;
  }
  .mc-title-block { min-width: 0; padding: 0 0 0 16px; text-align: left; }
  .mc-title-block small {
    display: block; margin-bottom: 3px; color: var(--mc-red); font-size: .58rem;
    font-weight: 900; letter-spacing: .13em; text-transform: uppercase;
  }
  .mc-title-block strong {
    display: block; color: #f4f6f7; font-size: clamp(1.1rem, 1.45vw, 1.42rem);
    letter-spacing: .01em; line-height: 1.05; white-space: nowrap;
  }
  .mc-title-block span { display: block; margin-top: 5px; color: #84919a; font-size: .66rem; white-space: nowrap; }
  .mc-top-actions {
    position: relative; z-index: 1; display: grid;
    grid-template-columns: minmax(126px, .8fr) repeat(3, minmax(140px, 1fr));
    align-items: stretch; justify-content: stretch; width: 100%; gap: 7px;
  }
  .mc-top-actions > * { min-width: 0; width: 100%; }
  .mc-top-actions .mc-button { white-space: normal; line-height: 1.15; }
  .mc-clock {
    min-height: 38px; border: 1px solid #46515a; border-radius: 7px; background: rgba(18,25,29,.92);
  }
  .mc-clock {
    display: grid; grid-template-columns: 1fr; place-items: center; gap: 2px;
    min-width: 126px; padding: 5px 10px; text-align: center;
  }
  .mc-clock b { font-size: .66rem; white-space: nowrap; }
  .mc-clock strong { color: #fff; font-size: .9rem; white-space: nowrap; }
  .mc-clock small { color: #66727b; font-size: .53rem; white-space: nowrap; }
  .mc-executive-commitment { font-size: .76rem; }
  .mc-refresh-button { font-size: .72rem; }
  .mc-brief-backdrop {
    position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center;
    padding: 18px; background: rgba(0,0,0,.82);
  }
  .mc-brief-dialog {
    width: min(920px, 100%); max-height: calc(100vh - 36px); overflow: auto;
    padding: 18px; border: 1px solid var(--mc-line); border-radius: 10px;
    background: #10161a; box-shadow: 0 24px 80px rgba(0,0,0,.55);
  }
  .mc-brief-textarea {
    width: 100%; min-height: 52vh; margin-top: 14px; padding: 14px;
    resize: vertical; border: 1px solid #46515a; border-radius: 7px;
    color: #f4f6f7; background: #080d10; font: 500 .82rem/1.55 Arial, sans-serif;
  }
  .mc-brief-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; margin-top: 12px; }
  .mc-huddle-toolbar { display: flex; justify-content: flex-end; padding: 10px 12px 0; }

  .mc-kpis { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
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
  .mc-kpi:nth-child(5) .mc-kpi-icon { color: var(--mc-amber); }
  .mc-kpi:nth-child(6) .mc-kpi-icon { color: var(--mc-green); }
  .mc-kpi-copy { min-width: 0; }
  .mc-kpi-copy span { display: block; color: #d9dee2; font-size: .75rem; font-weight: 900; text-transform: uppercase; }
  .mc-kpi-copy strong { display: block; margin-top: 3px; font-size: 2rem; line-height: 1; }
  .mc-kpi-copy small { display: block; margin-top: 5px; color: var(--mc-muted); font-size: .66rem; line-height: 1.3; }
  .mc-kpi-copy small.action { color: #b9c3ca; }

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
  .mc-tabbar {
    display: flex; flex-wrap: wrap; gap: 6px; padding: 10px 12px;
    border-bottom: 1px solid #303a41; background: #0b1115;
  }
  .mc-tab {
    min-height: 32px; padding: 0 11px; border: 1px solid #3a454d; border-radius: 6px;
    color: #9ca7af; background: #11181d; font: inherit; font-size: .64rem;
    font-weight: 900; cursor: pointer; white-space: nowrap;
  }
  .mc-tab:hover { color: #fff; border-color: #6c7880; }
  .mc-tab.active { color: #fff; border-color: #c90c1b; background: #8e000b; }
  .mc-tab-count {
    display: inline-grid; place-items: center; min-width: 18px; height: 18px; margin-left: 6px;
    padding: 0 5px; border-radius: 999px; background: rgba(255,255,255,.12); font-size: .56rem;
  }
  .mc-operating-list {
    display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; padding: 10px;
  }
  .mc-operating-card {
    display: grid; gap: 7px; min-width: 0; min-height: 104px; padding: 11px 12px;
    border: 1px solid #344049; border-left: 4px solid #c70b1a; border-radius: 7px;
    color: inherit; text-align: left; background: linear-gradient(145deg, #151d22, #0d1317);
    cursor: pointer;
  }
  .mc-operating-card:hover { border-color: #7d151d; background: #182126; }
  .mc-operating-card-head, .mc-operating-card-foot {
    display: flex; align-items: center; justify-content: space-between; gap: 10px; min-width: 0;
  }
  .mc-operating-card-badges { display: inline-flex; align-items: center; justify-content: flex-end; gap: 6px; min-width: 0; }
  .mc-countdown {
    display: inline-flex; align-items: center; min-height: 20px; padding: 0 7px; border-radius: 10px;
    color: #d8e4eb; background: #26343d; font-size: .58rem; font-weight: 900; text-transform: uppercase; white-space: nowrap;
  }
  .mc-countdown.warning { color: #ffd06b; background: #4a3208; }
  .mc-countdown.urgent { color: #fff0ad; background: #704900; }
  .mc-countdown.today { color: #fff; background: #b50715; }
  .mc-countdown.overdue { color: #fff; background: #d20b1c; box-shadow: 0 0 0 1px #ff5865; }
  .mc-operating-card-title {
    overflow: hidden; color: #f1f3f4; font-size: .76rem; line-height: 1.25;
    text-overflow: ellipsis; white-space: nowrap;
  }
  .mc-operating-card-detail {
    overflow: hidden; color: #7f8b94; font-size: .61rem; text-overflow: ellipsis; white-space: nowrap;
  }
  .mc-operating-card-foot { padding-top: 6px; border-top: 1px solid #2e383f; color: #9da7ae; font-size: .59rem; }
  .mc-operating-card-foot span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .mc-link {
    border: 0; color: #d9dfe3; background: transparent; font: inherit; font-size: .72rem;
    cursor: pointer; white-space: nowrap;
  }
  .mc-link:hover { color: var(--mc-red); }
  .mc-leadership-updates { max-height: 560px; overflow-y: auto; padding: 10px; display: grid; gap: 9px; }
  .mc-leadership-priority .mc-operating-list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .mc-leadership-priority .mc-operating-card { min-height: 94px; }
  .mc-exception-list { display: grid; }
  .mc-exception-row {
    display: grid; grid-template-columns: 118px minmax(220px, 1.1fr) minmax(230px, 1.45fr) 120px auto;
    align-items: center; gap: 12px; width: 100%; min-height: 52px; padding: 8px 12px;
    border: 0; border-bottom: 1px solid #303a41; border-left: 4px solid var(--mc-red);
    color: inherit; text-align: left; background: transparent; cursor: pointer;
  }
  .mc-exception-row:hover { background: rgba(255,255,255,.025); }
  .mc-exception-row:last-child { border-bottom: 0; }
  .mc-exception-project, .mc-exception-issue { min-width: 0; }
  .mc-exception-project strong, .mc-exception-project small, .mc-exception-issue {
    display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .mc-exception-project strong { font-size: .72rem; }
  .mc-exception-project small, .mc-exception-owner { color: #82909a; font-size: .59rem; }
  .mc-exception-issue { color: #c6cdd2; font-size: .65rem; }
  .mc-exception-open { color: #ff727d; font-size: .61rem; font-weight: 900; white-space: nowrap; }
  .mc-update-card {
    display: grid; gap: 9px; padding: 12px; border: 1px solid #354149; border-left: 5px solid #4d5961;
    border-radius: 7px; background: linear-gradient(145deg, #151d22, #10161a);
  }
  .mc-update-card.attention { border-left-color: var(--mc-red); background: linear-gradient(145deg, #211518, #11171b); }
  .mc-update-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  .mc-update-head strong { display: block; font-size: .84rem; }
  .mc-update-head small { display: block; margin-top: 3px; color: var(--mc-muted); font-size: .65rem; }
  .mc-update-status { flex: 0 0 auto; padding: 4px 8px; border-radius: 999px; color: #fff; background: #334049; font-size: .58rem; font-weight: 900; text-transform: uppercase; }
  .mc-update-card.attention .mc-update-status { background: #a20814; }
  .mc-update-details { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }
  .mc-update-detail { padding: 8px 9px; border: 1px solid #303a41; border-radius: 6px; background: #0b1115; }
  .mc-update-detail.alert { border-color: #7b2028; background: #190d10; }
  .mc-update-detail span { display: block; margin-bottom: 3px; color: #84919a; font-size: .56rem; font-weight: 900; text-transform: uppercase; }
  .mc-update-detail p { margin: 0; color: #e6eaed; font-size: .7rem; line-height: 1.4; white-space: pre-wrap; }
  .mc-compact-huddle {
    display: flex; align-items: center; justify-content: space-between; gap: 14px;
    padding: 12px; border-top: 1px solid #303a41; background: #0b1115;
  }
  .mc-compact-huddle-copy { min-width: 0; }
  .mc-compact-huddle-copy strong { display: block; font-size: .78rem; }
  .mc-compact-huddle-copy small { display: block; margin-top: 3px; color: var(--mc-muted); font-size: .64rem; }

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
  .mc-empty.compact, .mc-closeout-list .mc-empty { min-height: 68px; }

  .mc-hot { border-top: 2px solid var(--mc-red); }
  .mc-hot .mc-row { grid-template-columns: 72px minmax(0, 1.5fr) minmax(80px, .7fr) auto; }
  .mc-art { border-top: 2px solid #a855f7; }
  .mc-art .mc-row { grid-template-columns: 82px minmax(0, 1.5fr) minmax(90px, .7fr) auto; }
  .mc-priority {
    display: inline-flex; justify-content: center; padding: 4px 6px; border-radius: 4px;
    color: #fff; background: #b50715; font-size: .55rem; font-weight: 900; text-transform: uppercase;
  }
  .mc-priority.quick { color: #ffd678; background: #674500; }

  .mc-bottom { display: grid; grid-template-columns: 1.15fr .85fr; gap: 8px; }
  .mc-health-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1px; background: #303940; }
  .mc-health-card {
    display: grid; grid-template-columns: 38px 1fr auto; align-items: center; gap: 10px;
    min-height: 76px; padding: 12px; border: 0; color: inherit; text-align: left;
    background: #11181d; cursor: pointer;
  }
  .mc-health-card:hover { background: #182126; }
  .mc-health-card svg { width: 22px; height: 22px; color: #aab3ba; }
  .mc-health-card span { display: block; font-size: .69rem; font-weight: 900; text-transform: uppercase; }
  .mc-health-card small { display: block; margin-top: 3px; color: #74818a; font-size: .57rem; font-weight: 500; text-transform: none; }
  .mc-health-card strong { color: var(--mc-green); font-size: 1.45rem; }
  .mc-health-card.warn strong { color: var(--mc-amber); }
  .mc-health-card.danger strong { color: var(--mc-red); }
  .mc-readiness { display: grid; grid-template-columns: repeat(3, 1fr); min-height: 100%; }
  .mc-ready-card { display: grid; place-items: center; padding: 18px 10px; border: 0; border-right: 1px solid #303940; color: inherit; background: transparent; font: inherit; text-align: center; cursor: pointer; }
  .mc-ready-card:hover { background: rgba(255,255,255,.025); }
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

  @media (max-width: 1240px) {
    .mc-topbar { overflow: visible; }
    .mc-brand { width: 100%; }
    .mc-top-actions {
      width: 100%;
      display: grid; grid-template-columns: minmax(126px, .8fr) repeat(3, minmax(120px, 1fr));
      justify-content: stretch;
    }
    .mc-top-actions > * { min-width: 0; width: 100%; }
    .mc-top-actions .mc-button { white-space: normal; line-height: 1.15; }
  }
  @media (max-width: 1180px) {
    .mc-top-actions { justify-content: start; }
    .mc-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .mc-three { grid-template-columns: 1fr; }
    .mc-huddle-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 760px) {
    .mc-operating-list { grid-template-columns: 1fr; }
    .mc-leadership-priority .mc-operating-list { grid-template-columns: 1fr; }
    .mc-exception-row { grid-template-columns: 1fr auto; gap: 6px 10px; }
    .mc-exception-issue { grid-column: 1 / -1; white-space: normal; }
    .mc-exception-owner { grid-column: 1; }
    .mc-compact-huddle { align-items: stretch; flex-direction: column; }
    .mc-brand { width: 100%; }
    .mc-logo { width: 132px; height: 40px; padding-right: 12px; }
    .mc-title-block { padding-left: 12px; }
    .mc-title-block span { font-size: .84rem; }
    .mc-title-block strong, .mc-title-block span { white-space: normal; }
    .mc-top-actions { grid-template-columns: 1fr 1fr; width: 100%; }
    .mc-clock { min-width: 0; }
    .mc-kpis, .mc-bottom { grid-template-columns: 1fr; }
    .mc-closeout-row { grid-template-columns: 1fr 1fr; }
    .mc-closeout-open { justify-self: start; }
    .mc-flow-toolbar { align-items: stretch; flex-direction: column; }
    .mc-flow-context { text-align: left; }
    .mc-update-details { grid-template-columns: 1fr; }
  }
  @media (max-width: 500px) {
    .mc-brand { align-items: center; }
    .mc-logo { width: 108px; height: 36px; padding-right: 10px; }
    .mc-title-block { padding-left: 10px; }
    .mc-title-block strong { white-space: normal; }
    .mc-title-block span { display: none; }
    .mc-top-actions { grid-template-columns: 1fr; }
    .mc-clock { grid-column: auto; }
    .mc-kpi { min-height: 82px; }
    .mc-hot .mc-row, .mc-row { grid-template-columns: 1fr; }
    .mc-tag, .mc-priority { justify-self: start; }
    .mc-readiness { grid-template-columns: 1fr; }
    .mc-health-grid { grid-template-columns: 1fr; }
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

function getDeadlineCountdown(item) {
  const rawValue = item?.deadlineAt ?? item?.dueAt ?? item?.dueDate ?? item?.sortDate;
  if (!rawValue || rawValue === Number.MAX_SAFE_INTEGER) return null;

  const target = new Date(
    typeof rawValue === "string" && /^\d{4}-\d{2}-\d{2}$/.test(rawValue)
      ? `${rawValue}T12:00:00`
      : rawValue,
  );
  if (Number.isNaN(target.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const days = Math.round((target.getTime() - today.getTime()) / 86400000);

  if (days < 0) {
    const overdueDays = Math.abs(days);
    return { label: `${overdueDays} day${overdueDays === 1 ? "" : "s"} overdue`, tone: "overdue" };
  }
  if (days === 0) return { label: "Due today", tone: "today" };
  if (days <= 3) return { label: `${days} day${days === 1 ? "" : "s"} left`, tone: "urgent" };
  if (days <= 7) return { label: `${days} days left`, tone: "warning" };
  return { label: `${days} days left`, tone: "scheduled" };
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

  const hasInstallDate = Boolean(project.install_start || project.install_date);

  if (project.install_required && !hasInstallDate) {
    return "Install Date Needed";
  }

  if (project.install_required && hasInstallDate) {
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
  const [flowMode, setFlowMode] = useState(
    () => window.localStorage.getItem("mw-dashboard-flow-mode") || "shop",
  );
  const [selectedOutsideStage, setSelectedOutsideStage] = useState("");
  const [todayView, setTodayView] = useState("All");
  const [leadershipView, setLeadershipView] = useState("Needs Attention");
  const [briefOpen, setBriefOpen] = useState(false);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefText, setBriefText] = useState("");
  const [briefCopied, setBriefCopied] = useState(false);

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

  useEffect(() => {
    window.localStorage.setItem("mw-dashboard-flow-mode", flowMode);
  }, [flowMode]);

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

  function openOutsideWorkspace(workspace) {
    window.localStorage.setItem("mw-outside-workspace", workspace);
    setPage("projects");
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

  const quotesNeededCount = Number(outsideSummary.quotesNeeded || 0);
  const approvalsPendingCount = Number(stats.approvalsPending || 0);
  const outsideProductionCount = outsideProjects.filter((project) =>
    ["Design", "Welding / Fabrication", "Finish / Corrections", "Assembly"].includes(project.workflowStage),
  ).length;
  const fieldCommitmentCount = outsideProjects.filter((project) =>
    ["Test Fit", "Install Date Needed", "Ready for Installation", "Installation"].includes(project.workflowStage),
  ).length;

  const statCards = [
    [
      "Estimates & Site Visits",
      stats.siteVisits || 0,
      `${stats.siteVisitsNeedScheduling || 0} need scheduling · ${stats.siteVisitsScheduled || 0} scheduled`,
      IconMapPin,
      () => openOutsideWorkspace("estimates"),
    ],
    [
      "Quote Workflow",
      `${quotesNeededCount} / ${approvalsPendingCount}`,
      "quotes to finish / awaiting approval",
      IconHammer,
      () => openOutsideWorkspace("approvals"),
    ],
    [
      "Open Orders",
      stats.openOrders || 0,
      "Approved customer orders",
      IconClipboardList,
      () => goToPage("customerOrders"),
    ],
    [
      "In Production",
      Number(stats.inProduction || 0) + outsideProductionCount,
      `${stats.inProduction || 0} shop jobs · ${outsideProductionCount} outside projects`,
      IconBuildingFactory2,
      () => goToPage("productionControl"),
    ],
    [
      "Field Work & Installs",
      fieldCommitmentCount,
      `${stats.installs || 0} scheduled installs · ${stats.installsNeedScheduling || 0} need dates`,
      IconTruckDelivery,
      () => openOutsideWorkspace("field"),
    ],
    [
      "Closeout & Payments",
      unifiedCloseoutCount + Number(outsideSummary.paymentsDue || 0),
      `${unifiedCloseoutCount} closeouts · ${outsideSummary.paymentsDue || 0} payment actions`,
      IconClipboardList,
      () => openOutsideWorkspace("field"),
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
      return {
        name,
        count,
        capacity,
        percentage,
        ready: Number(source.ready || 0),
        inProgress: Number(source.inProgress || 0),
        onHold: Number(source.onHold || 0),
      };
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
      "Install Date Needed",
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
  const artworkOrders = safeArray(dashboardData?.artworkOrders);
  const hotArtwork = safeArray(dashboardData?.priorityFeed?.quickCommitments);
  const hotArtworkIds = new Set(hotArtwork.map((item) => String(item.sourceId || "")).filter(Boolean));
  const hotArtworkTitles = new Set(hotArtwork.map((item) => String(item.title || "").trim().toLowerCase()).filter(Boolean));
  const regularArtwork = artworkOrders
    .filter((item) => !hotArtworkIds.has(String(item.id)) && !hotArtworkTitles.has(String(item.title || "").trim().toLowerCase()))
    .filter((item) => Number(item.businessDaysInShop || 0) < 12)
    .sort((left, right) => {
      if (left.designFeeCleared !== right.designFeeCleared) {
        return left.designFeeCleared ? -1 : 1;
      }
      if (Number(left.designComplexityTier || 5) !== Number(right.designComplexityTier || 5)) {
        return Number(left.designComplexityTier || 5) - Number(right.designComplexityTier || 5);
      }
      return Number(right.businessDaysInShop || 0) - Number(left.businessDaysInShop || 0);
    })
    .slice(0, 10);
  const agedArtwork = artworkOrders
    .filter((item) => !hotArtworkIds.has(String(item.id)) && !hotArtworkTitles.has(String(item.title || "").trim().toLowerCase()))
    .filter((item) => Number(item.businessDaysInShop || 0) >= 12)
    .map((item) => ({ ...item, priority: "Critical", tag: "12+ Business Days" }));
  const artHotItems = [...hotArtwork, ...agedArtwork].slice(0, 10);
  const wholeShopPriorities = [...hotItems, ...artHotItems].filter(
    (item, index, items) => index === items.findIndex((candidate) =>
      String(candidate.sourceType || candidate.dashboardGroup || "priority") === String(item.sourceType || item.dashboardGroup || "priority") &&
      String(candidate.sourceId || candidate.id || candidate.title) === String(item.sourceId || item.id || item.title)
    ),
  );
  const fieldItems = schedule.slice(0, 5);
  const riskItems = [
    ...safeArray(huddle.blockers),
    ...attention.filter(
      (item) => item.tag === "Overdue" || item.priority === "Critical",
    ),
  ].slice(0, 5);

  const todayGroups = {
    "Hot Today": hotItems,
    "Hot Artwork": artHotItems,
    "Artwork Orders": regularArtwork,
    "Field Work": fieldItems,
    Blockers: riskItems,
  };
  const todayTabs = ["All", ...Object.keys(todayGroups)];
  const todayItems = (
    todayView === "All"
      ? Object.entries(todayGroups).flatMap(([group, items]) =>
          items.map((item) => ({ ...item, dashboardGroup: group })),
        )
      : (todayGroups[todayView] || []).map((item) => ({
          ...item,
          dashboardGroup: todayView,
        }))
  )
    .filter(
      (item, index, items) =>
        index ===
        items.findIndex(
          (candidate) =>
            String(candidate.sourceType || candidate.dashboardGroup) ===
              String(item.sourceType || item.dashboardGroup) &&
            String(candidate.sourceId || candidate.id || candidate.title) ===
              String(item.sourceId || item.id || item.title),
        ),
    )
    .slice(0, todayView === "All" ? 12 : 10);

  const leadershipUpdates = useMemo(() => {
    const updates = safeArray(huddle.dailyUpdates);
    const latestByProject = new Map();
    updates.forEach((update) => {
      const key = String(update.project_id);
      if (!latestByProject.has(key)) latestByProject.set(key, update);
    });

    return outsideProjects
      .map((project) => ({
        project,
        update: latestByProject.get(String(project.id)) || null,
      }))
      .sort((left, right) => {
        if (!left.update) return 1;
        if (!right.update) return -1;
        return String(
          right.update.created_at || right.update.update_date || "",
        ).localeCompare(
          String(left.update.created_at || left.update.update_date || ""),
        );
      });
  }, [huddle.dailyUpdates, outsideProjects]);

  const filteredLeadershipUpdates = leadershipUpdates.filter(({ update }) => {
    const needsAttention = Boolean(
      update?.leadership_attention_required ||
      update?.blockers ||
      update?.decisions_needed ||
      update?.schedule_change ||
      update?.budget_change,
    );
    if (leadershipView === "Needs Attention") return needsAttention || !update;
    if (leadershipView === "Missing Update") return !update;
    if (leadershipView === "On Track")
      return Boolean(update) && !needsAttention;
    return true;
  });

  const leadershipExceptions = leadershipUpdates
    .map(({ project, update }) => {
      const explicitIssue =
        update?.blockers ||
        update?.decisions_needed ||
        update?.schedule_change ||
        update?.budget_change ||
        (update?.leadership_attention_required ? "Leadership review was requested in the latest project update." : "");
      const dueValue = project.next_action_date || project.target_completion_date || project.due_date;
      const dueDate = dueValue ? new Date(dueValue) : null;
      const overdue = Boolean(dueDate && !Number.isNaN(dueDate.getTime()) && dueDate < new Date().setHours(0, 0, 0, 0));
      const updateValue = update?.update_date || update?.created_at || project.updated_at || project.created_at;
      const updateDate = updateValue ? new Date(updateValue) : null;
      const updateAge = updateDate && !Number.isNaN(updateDate.getTime())
        ? Math.max(0, Math.floor((Date.now() - updateDate.getTime()) / 86400000))
        : null;
      const stale = !update && updateAge !== null && updateAge >= 3;

      if (explicitIssue) {
        return { project, update, issue: explicitIssue, reason: "Decision / Blocker", rank: 0 };
      }
      if (overdue) {
        return { project, update, issue: `Project action date passed ${new Date(dueValue).toLocaleDateString()}.`, reason: "Overdue", rank: 1 };
      }
      if (stale) {
        return { project, update, issue: `No project update has been submitted in ${updateAge} days.`, reason: "Update Needed", rank: 2 };
      }
      return null;
    })
    .filter(Boolean)
    .sort((left, right) => left.rank - right.rank);

  async function prepareLeadershipNotes() {
    setBriefOpen(true);
    setBriefLoading(true);
    setBriefCopied(false);
    try {
      const { data, error } = await supabase
        .from("project_daily_updates")
        .select("*")
        .order("update_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;

      const latestByProject = new Map();
      (data || []).forEach((update) => {
        if (!latestByProject.has(String(update.project_id))) {
          latestByProject.set(String(update.project_id), update);
        }
      });

      const lines = [
        `METAL WORX LEADERSHIP NOTES — ${new Date().toLocaleDateString()}`,
        "",
        "INSTRUCTIONS FOR CHATGPT:",
        "Turn these notes into one concise executive-summary paragraph. Then add short bullets for leadership decisions, blockers, materials or labor needed, and tomorrow's priorities. Do not invent facts.",
        "",
        "WHOLE-SHOP PRIORITIES:",
      ];

      if (wholeShopPriorities.length) {
        wholeShopPriorities.forEach((item) =>
          lines.push(
            `- ${item.title || "Priority"} | Owner: ${item.owner || "Unassigned"} | ${item.nextAction || item.detail || "Needs attention"}`,
          ),
        );
      } else {
        lines.push("- No whole-shop priority is currently recorded.");
      }

      lines.push("", "ACTIVE OUTSIDE PROJECTS:");
      outsideProjects.forEach((project) => {
        const update = latestByProject.get(String(project.id));
        lines.push(
          "",
          `${project.project_number || "Project"} — ${project.project_name || project.contact_name || "Unnamed project"}`,
        );
        lines.push(`Lead: ${project.assigned_to || "Unassigned"}`);
        lines.push(
          `Stage: ${project.workflowStage || project.status || "Not recorded"}`,
        );
        lines.push(
          `Due: ${project.target_completion_date || project.due_date || "Not set"}`,
        );
        if (!update) {
          lines.push("Latest update: NOT SUBMITTED");
          return;
        }
        const updateDate = update.update_date
          ? new Date(`${update.update_date}T12:00:00`)
          : null;
        const ageDays = updateDate
          ? Math.max(0, Math.round((new Date().setHours(12, 0, 0, 0) - updateDate.getTime()) / 86400000))
          : null;
        lines.push(`Latest update: ${update.update_date || "Date not recorded"}${ageDays === null ? "" : ageDays === 0 ? " (today)" : ` (${ageDays} day${ageDays === 1 ? "" : "s"} old)`}`);
        lines.push(`Latest status: ${update.status || "Not recorded"}`);
        if (update.work_completed)
          lines.push(`Completed: ${update.work_completed}`);
        if (update.work_in_progress)
          lines.push(`In progress: ${update.work_in_progress}`);
        if (update.next_steps) lines.push(`Next steps: ${update.next_steps}`);
        if (update.blockers) lines.push(`Blockers: ${update.blockers}`);
        if (update.materials_needed)
          lines.push(`Materials needed: ${update.materials_needed}`);
        if (update.labor_needed)
          lines.push(`Labor/help needed: ${update.labor_needed}`);
        if (update.decisions_needed)
          lines.push(`Leadership decisions: ${update.decisions_needed}`);
        if (update.schedule_change)
          lines.push(`Schedule change: ${update.schedule_change}`);
        if (update.budget_change)
          lines.push(`Budget change: ${update.budget_change}`);
      });

      lines.push("", "HOT ARTWORK:");
      if (artHotItems.length) {
        artHotItems.forEach((item) =>
          lines.push(
            `- ${item.title} | ${item.customer || "Customer not entered"} | ${item.fulfillmentMethod || "Pickup"}: ${item.dueDisplay || "Date not set"} | Lead: ${item.owner || "Unassigned"}`,
          ),
        );
      } else {
        lines.push(
          "- No artwork has been marked hot and no artwork has reached 12 business days.",
        );
      }

      lines.push("", "REGULAR ARTWORK ORDERS:");
      if (regularArtwork.length) {
        regularArtwork.forEach((item) => lines.push(`- ${item.title} | ${item.customer || "Customer not entered"} | ${item.businessDaysInShop || 0} business days | ${item.department || "Not released"} | Lead: ${item.owner || "Unassigned"}`));
      } else {
        lines.push("- No regular artwork orders are waiting outside the hot list.");
      }

      lines.push(
        "",
        `OPERATING COUNTS: ${stats.openOrders || 0} open orders; ${outsideProjects.length} active outside projects; ${stats.inProduction || 0} shop jobs in production; ${huddleSummary.blockers || 0} active blockers; ${stats.overdue || 0} overdue actions.`,
      );
      setBriefText(lines.join("\n"));
    } catch (error) {
      setBriefText(
        `Leadership notes could not be prepared.\n\n${error.message}`,
      );
    } finally {
      setBriefLoading(false);
    }
  }

  async function copyLeadershipNotes() {
    await navigator.clipboard.writeText(briefText);
    setBriefCopied(true);
  }

  const materialIssues =
    Number(outsideSummary.materialsNeedOrdered || 0) +
    Number(outsideSummary.materialsWaiting || 0);

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
            <small>Metal Worx OS</small>
            <strong>Operations Dashboard</strong>
            <span>Live priorities, workflow, field work, and closeout</span>
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
            className="mc-button"
            onClick={() => goToPage("morningHuddleTV")}
          >
            <IconDeviceTv /> TV Huddle
          </button>
          <button
            className="mc-button primary mc-executive-commitment"
            onClick={() => goToPage("quickTurnaround")}
          >
            <IconBolt /> Hot Artwork
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
              <small className="action">{subtitle}</small>
            </span>
          </button>
        ))}
      </section>

      <section className="mc-panel mc-leadership-priority">
        <PanelHead
          icon={IconFileDescription}
          title="Priority Exceptions"
          subtitle="Only overdue work, stale projects, blockers, schedule changes, or decisions needing leadership"
          action={`Open Outside Alerts (${leadershipExceptions.length})`}
          onAction={() => goToPage("projects")}
        />
        <div className="mc-exception-list">
          {leadershipExceptions.length === 0 ? (
            <Empty compact text="No outside-project exceptions currently require leadership attention." />
          ) : (
            leadershipExceptions.slice(0, 4).map(({ project, update, issue, reason }) => {
              return (
                <button className="mc-exception-row" type="button" key={`leadership-${project.id}`} onClick={() => openProjectById(project.id)}>
                  <span className="mc-priority">{reason}</span>
                  <span className="mc-exception-project">
                    <strong>{project.project_number || "Project"} — {project.project_name || project.contact_name || "Unnamed project"}</strong>
                    <small>{project.workflowStage || project.status || "Active"}</small>
                  </span>
                  <span className="mc-exception-issue">{issue}</span>
                  <span className="mc-exception-owner">Owner: {update?.project_lead || project.assigned_to || "Unassigned"}</span>
                  <span className="mc-exception-open">Open ›</span>
                </button>
              );
            })
          )}
        </div>
      </section>

      <PersonalFollowUps onOpenProject={openProjectById} />

      <section className="mc-panel">
        <PanelHead
          icon={IconBolt}
          title="Needs Action Now"
          subtitle="Priorities, dated orders, field work, and blockers requiring follow-through"
          action="Open Action Center"
          onAction={() => goToActionCenter("All")}
        />
        <div className="mc-tabbar" role="tablist" aria-label="Today filters">
          {todayTabs.map((tab) => {
            const count =
              tab === "All"
                ? Object.values(todayGroups).reduce(
                    (total, items) => total + items.length,
                    0,
                  )
                : todayGroups[tab].length;
            return (
              <button
                className={`mc-tab ${todayView === tab ? "active" : ""}`}
                type="button"
                role="tab"
                aria-selected={todayView === tab}
                key={tab}
                onClick={() => setTodayView(tab)}
              >
                {tab}
                <span className="mc-tab-count">{count}</span>
              </button>
            );
          })}
        </div>
        <div className="mc-operating-list">
          {todayItems.length === 0 ? (
            <Empty
              text={`No ${todayView === "All" ? "operating items" : todayView.toLowerCase()} need attention.`}
            />
          ) : (
            todayItems.map((item, index) => {
              const countdown = getDeadlineCountdown(item);
              return (
              <button
                className="mc-operating-card"
                type="button"
                key={`${item.dashboardGroup}-${item.id || item.sourceId || index}`}
                onClick={() => {
                  if (item.dashboardGroup === "Hot Artwork") {
                    goToPage("quickTurnaround");
                    return;
                  }
                  if (item.dashboardGroup === "Artwork Orders") {
                    if (item.sourceType === "customerOrder")
                      openOrderById(item.sourceId);
                    else goToPage("quickTurnaround");
                    return;
                  }
                  if (item.dashboardGroup === "Field Work") {
                    if (item.sourceType === "prequoteSiteVisit")
                      goToPage("quoteCenter");
                    else openProjectById(item.projectId || item.sourceId);
                    return;
                  }
                  openAction(item);
                }}
              >
                <span className="mc-operating-card-head">
                  <span className={`mc-priority ${item.priority === "Critical" ? "quick" : ""}`}>{item.dashboardGroup}</span>
                  <span className="mc-operating-card-badges">
                    {countdown && <span className={`mc-countdown ${countdown.tone}`}>{countdown.label}</span>}
                    <span className={`mc-tag ${item.isToday ? "green" : ""}`}>{item.status || item.tag || (item.isToday ? "Today" : "Open")}</span>
                  </span>
                </span>
                <strong className="mc-operating-card-title">{item.title || item.customer || item.job || "Work item"}</strong>
                <span className="mc-operating-card-detail">{item.customer || item.detail || item.issue || item.location || item.type || "Metal Worx work item"}</span>
                {item.designWorkLabel && (
                  <span
                    className="mc-operating-card-detail"
                    style={{ color: `var(--mantine-color-${item.designWorkColor || "gray"}-4)`, fontWeight: 850 }}
                  >
                    {item.designWorkLabel} · Design fee {item.designFeeStatus || "Not Required"}
                  </span>
                )}
                <span className="mc-operating-card-foot">
                  <span>Owner: {item.owner || "Unassigned"}</span>
                  <span>{item.dueDisplay || item.nextAction || item.notes || item.date || item.day || "Date not set"}</span>
                </span>
              </button>
              );
            })
          )}
        </div>
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
                  window.sessionStorage.setItem(
                    "mw-production-department",
                    item.name,
                  );
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
                  {flowMode === "shop" && item.name !== "Office Closeout"
                    ? `${item.ready || 0} ready · ${item.inProgress || 0} active`
                    : `${item.count} / ${item.capacity}`}
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

      <section className="mc-bottom">
        <section className="mc-panel">
          <PanelHead
            icon={IconShieldCheck}
            title="Readiness Snapshot"
            subtitle="Direct counts showing where follow-through is needed"
            action="Action Center"
            onAction={() => goToActionCenter("All")}
          />
          <div className="mc-health-grid">
            <button className={`mc-health-card ${Number(stats.overdue || 0) ? "danger" : ""}`} type="button" onClick={() => goToActionCenter("Overdue")}>
              <IconCalendarEvent />
              <span>Schedule<small>Overdue actions</small></span>
              <strong>{stats.overdue || 0}</strong>
            </button>
            <button className={`mc-health-card ${Number(projectHealth.blocked || 0) ? "danger" : ""}`} type="button" onClick={() => goToPage("projects")}>
              <IconClipboardList />
              <span>Projects<small>Blocked projects</small></span>
              <strong>{projectHealth.blocked || 0}</strong>
            </button>
            <button className="mc-health-card" type="button" onClick={() => goToPage("productionControl")}>
              <IconBuildingFactory2 />
              <span>Production<small>Active shop and outside work</small></span>
              <strong>{Number(stats.inProduction || 0) + outsideProductionCount}</strong>
            </button>
            <button className={`mc-health-card ${Number(huddleSummary.blockers || 0) ? "warn" : ""}`} type="button" onClick={() => goToActionCenter("Blockers")}>
              <IconAlertTriangle />
              <span>Blockers<small>Reported active blockers</small></span>
              <strong>{huddleSummary.blockers || 0}</strong>
            </button>
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
            <button className="mc-ready-card ready" type="button" onClick={() => goToPage("projects")}>
              <span>No Material Hold</span>
              <strong>
                {Math.max(0, outsideProjects.length - materialIssues)}
              </strong>
              <small>No ordering or receiving issue</small>
            </button>
            <button className="mc-ready-card order" type="button" onClick={() => goToPage("projects")}>
              <span>Need Ordering</span>
              <strong>{outsideSummary.materialsNeedOrdered || 0}</strong>
              <small>Purchase required</small>
            </button>
            <button className="mc-ready-card wait" type="button" onClick={() => goToPage("projects")}>
              <span>Waiting Material</span>
              <strong>{outsideSummary.materialsWaiting || 0}</strong>
              <small>Ordered / pending</small>
            </button>
          </div>
        </section>
      </section>

      <section className="mc-panel">
        <PanelHead
          icon={IconFileDescription}
          title="Project Update Library"
          subtitle="Latest submitted update from every active outside project"
          action="View Projects"
          onAction={() => goToPage("projects")}
        />
        <div
          className="mc-tabbar"
          role="tablist"
          aria-label="Leadership update filters"
        >
          {["Needs Attention", "Missing Update", "On Track", "All"].map(
            (tab) => {
              const count =
                tab === "All"
                  ? leadershipUpdates.length
                  : leadershipUpdates.filter(({ update }) => {
                      const needsAttention = Boolean(
                        update?.leadership_attention_required ||
                        update?.blockers ||
                        update?.decisions_needed ||
                        update?.schedule_change ||
                        update?.budget_change,
                      );
                      if (tab === "Needs Attention")
                        return needsAttention || !update;
                      if (tab === "Missing Update") return !update;
                      return Boolean(update) && !needsAttention;
                    }).length;
              return (
                <button
                  className={`mc-tab ${leadershipView === tab ? "active" : ""}`}
                  type="button"
                  role="tab"
                  aria-selected={leadershipView === tab}
                  key={tab}
                  onClick={() => setLeadershipView(tab)}
                >
                  {tab}
                  <span className="mc-tab-count">{count}</span>
                </button>
              );
            },
          )}
        </div>
        <div className="mc-leadership-updates">
          {filteredLeadershipUpdates.length === 0 ? (
            <Empty
              text={
                leadershipView === "All"
                  ? "No active outside projects are available."
                  : `No projects are in ${leadershipView.toLowerCase()}.`
              }
            />
          ) : (
            filteredLeadershipUpdates.map(({ project, update }) => {
              const details = update
                ? [
                    ["Completed", update.work_completed, false],
                    ["In Progress", update.work_in_progress, false],
                    ["Next Steps", update.next_steps, false],
                    ["Blockers", update.blockers, true],
                    ["Materials Needed", update.materials_needed, true],
                    ["Labor / Help Needed", update.labor_needed, true],
                    ["Leadership Decision", update.decisions_needed, true],
                    ["Schedule Change", update.schedule_change, true],
                    ["Budget Change", update.budget_change, true],
                  ].filter(([, value]) => String(value || "").trim())
                : [];
              const needsAttention = Boolean(
                update?.leadership_attention_required ||
                update?.blockers ||
                update?.decisions_needed ||
                update?.schedule_change ||
                update?.budget_change,
              );
              const updateDate = update?.update_date
                ? new Date(`${update.update_date}T12:00:00`).toLocaleDateString(
                    "en-US",
                    { month: "short", day: "numeric", year: "numeric" },
                  )
                : "No update submitted";
              return (
                <article
                  key={project.id}
                  className={`mc-update-card ${needsAttention ? "attention" : ""}`}
                >
                  <div className="mc-update-head">
                    <div>
                      <strong>
                        {project.project_number || "Project"} —{" "}
                        {project.project_name ||
                          project.contact_name ||
                          "Unnamed project"}
                      </strong>
                      <small>
                        {updateDate} · Lead:{" "}
                        {update?.project_lead ||
                          project.assigned_to ||
                          "Unassigned"}{" "}
                        · Stage:{" "}
                        {project.workflowStage ||
                          project.status ||
                          "Not recorded"}
                      </small>
                    </div>
                    <span className="mc-update-status">
                      {needsAttention
                        ? "Needs Leadership"
                        : update?.status || "No Update"}
                    </span>
                  </div>
                  {details.length ? (
                    <div className="mc-update-details">
                      {details.map(([label, value, alert]) => (
                        <div
                          className={`mc-update-detail ${alert ? "alert" : ""}`}
                          key={label}
                        >
                          <span>{label}</span>
                          <p>{value}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <small className="mc-flow-context">
                      {update
                        ? "No detailed notes were entered for this update."
                        : "This project has not received a daily update yet."}
                    </small>
                  )}
                </article>
              );
            })
          )}
        </div>
      </section>

      <section className="mc-panel">
        <PanelHead
          icon={IconUsers}
          title="Leadership Briefing"
          subtitle="Prepare a concise summary from today’s live operating data"
          action="Open Action Center"
          onAction={() => goToActionCenter("All")}
        />
        <div className="mc-compact-huddle">
          <div className="mc-compact-huddle-copy">
            <strong>
              {wholeShopPriorities.length} priorities · {huddleSummary.blockers || 0}{" "}
              blockers · {huddleSummary.todayFieldWork || 0} field commitments
              today
            </strong>
            <small>
              Use the live dashboard for execution, or prepare notes for a
              leadership summary.
            </small>
          </div>
          <button
            className="mc-button primary"
            type="button"
            onClick={prepareLeadershipNotes}
          >
            <IconFileDescription /> Prepare Leadership Notes
          </button>
        </div>
      </section>

      <footer className="mc-footer">
        Built by fabricators · Powered by data · Driven by purpose
      </footer>

      {briefOpen && (
        <div
          className="mc-brief-backdrop"
          role="presentation"
          onMouseDown={() => setBriefOpen(false)}
        >
          <section
            className="mc-brief-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Leadership notes"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <PanelHead
              icon={IconFileDescription}
              title="Leadership Notes for ChatGPT"
              subtitle="Review, copy, and paste into ChatGPT for the executive summary"
            />
            <textarea
              className="mc-brief-textarea"
              value={briefLoading ? "Preparing leadership notes…" : briefText}
              onChange={(event) => setBriefText(event.currentTarget.value)}
              readOnly={briefLoading}
            />
            <div className="mc-brief-actions">
              <button
                className="mc-button"
                type="button"
                onClick={() => setBriefOpen(false)}
              >
                <IconX /> Close
              </button>
              <button
                className="mc-button primary"
                type="button"
                disabled={briefLoading || !briefText}
                onClick={copyLeadershipNotes}
              >
                <IconCopy /> {briefCopied ? "Copied" : "Copy for ChatGPT"}
              </button>
            </div>
          </section>
        </div>
      )}
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

function Empty({ text, compact = false }) {
  return <div className={`mc-empty ${compact ? "compact" : ""}`}>{text}</div>;
}

export default Dashboard;
