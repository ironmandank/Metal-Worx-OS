import { ActionIcon, Badge, Button, Drawer, Group, Loader, Paper, ScrollArea, Stack, Text, Textarea, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconBolt, IconClipboardList, IconFileSpreadsheet, IconPhotoPlus, IconSend, IconTrash, IconUsers, IconX } from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState } from "react";

import sparkyImage from "../assets/sparky-assistant.png";
import { supabase } from "../lib/supabase";

const STARTER_MESSAGE = {
  role: "assistant",
  content: "Hey, I’m Sparky. Ask me about projects, orders, production, inventory locations, manuals, or what needs attention today. I can review and recommend, but I won’t change shop records without confirmation.",
};

const PAGE_PROMPTS = {
  inventoryCount: ["Where is this item stored?", "Show unverified inventory items", "Help standardize an item name"],
  inventoryDashboard: ["What inventory needs attention?", "Find an item and all its crates", "Which items are low or out?"],
  projects: ["What outside project should we work next?", "Which projects are blocked?", "What installs are coming up?"],
  productionControl: ["What is due soon?", "Which department is backed up?", "Show blocked production work"],
  departmentQueue: ["What should this department work next?", "Which jobs are overdue?", "Summarize this queue"],
  knowledgeCenter: ["Find the right equipment manual", "What manuals are available?", "Help me troubleshoot safely"],
};

const DEFAULT_PROMPTS = [
  "What do I need to complete?",
  "Where is an inventory item stored?",
  "What job should we work next?",
];

function suggestedAction(question) {
  const value = String(question || "").toLowerCase();
  if (/quote|estimate|pricing/.test(value)) return { page: "quoteCenter", label: "Open Quote Drafts", icon: IconFileSpreadsheet };
  if (/artwork|design|photo|image|logo|proof/.test(value)) return { page: "designQueue", label: "Add Artwork & Images", icon: IconPhotoPlus, intake: true };
  if (/morning huddle|huddle|shop meeting/.test(value)) return { page: "morningHuddleTV", label: "Open Updated Huddle", icon: IconUsers };
  if (/my task|my work|need to complete|assigned to me|follow[- ]?up/.test(value)) return { page: "dashboard", label: "Open My Tasks", icon: IconClipboardList, anchor: "personal-followups" };
  return null;
}

const SPARKY_STYLES = `
  .sparky-launcher {
    position: fixed;
    right: 22px;
    bottom: 22px;
    z-index: 220;
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 58px;
    padding: 6px 16px 6px 7px;
    border: 1px solid rgba(232, 44, 44, 0.7);
    border-radius: 999px;
    color: white;
    background: linear-gradient(135deg, #7d0d0d, #d41f26);
    box-shadow: 0 14px 35px rgba(0, 0, 0, 0.44), 0 0 24px rgba(212, 31, 38, 0.22);
    cursor: pointer;
    font: inherit;
    font-weight: 900;
    overflow: visible;
  }
  .sparky-launcher::before, .sparky-launcher::after {
    content: "";
    position: absolute;
    width: 5px;
    height: 5px;
    left: 42px;
    top: 6px;
    border-radius: 50%;
    background: #ffd45a;
    box-shadow: 7px 5px 0 #ff6a21, -5px 8px 0 #fff0a0;
    animation: sparky-sparks 1.6s ease-out infinite;
    pointer-events: none;
  }
  .sparky-launcher::after { animation-delay: .8s; }
  .sparky-launcher img {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    object-fit: cover;
    object-position: 50% 18%;
    background: #151719;
    animation: sparky-idle 2.4s ease-in-out infinite;
  }
  .sparky-launcher:hover img { animation-duration: .8s; }
  .sparky-launcher svg { animation: sparky-glow 1.8s ease-in-out infinite; }
  .sparky-avatar-wrap { position: relative; width: 74px; height: 74px; flex: 0 0 74px; }
  .sparky-avatar-wrap::before, .sparky-avatar-wrap::after { content:""; position:absolute; z-index:2; width:6px; height:6px; right:3px; top:8px; border-radius:50%; background:#ffd45a; box-shadow:8px 6px 0 #ff6421,-4px 11px 0 #fff4b2; animation:sparky-sparks 1.6s ease-out infinite; pointer-events:none; }
  .sparky-avatar-wrap::after { animation-delay:.8s; }
  .sparky-avatar {
    width: 74px;
    height: 74px;
    display: block;
    border-radius: 18px;
    object-fit: cover;
    object-position: 50% 20%;
    background: radial-gradient(circle, #3d1113, #0e1012 70%);
    border: 1px solid rgba(255,255,255,0.12);
    animation: sparky-breathe 3.4s ease-in-out infinite;
  }
  .sparky-thinking { animation: sparky-thinking .72s ease-in-out infinite alternate; }
  .sparky-message { white-space: pre-wrap; line-height: 1.52; }
  @keyframes sparky-idle { 0%,100% { transform: translateY(0) rotate(0); } 45% { transform: translateY(-7px) rotate(-3deg); } 55% { transform: translateY(-7px) rotate(3deg); } }
  @keyframes sparky-glow { 0%,100% { filter: drop-shadow(0 0 2px rgba(255,190,60,.25)); transform: scale(1); } 50% { filter: drop-shadow(0 0 7px rgba(255,190,60,.9)); transform: scale(1.08); } }
  @keyframes sparky-breathe { 0%,100% { box-shadow: 0 0 0 rgba(212,31,38,0); transform: translateY(0); } 50% { box-shadow: 0 0 22px rgba(212,31,38,.24); transform: translateY(-2px); } }
  @keyframes sparky-thinking { from { transform: translateY(0) rotate(-1deg); } to { transform: translateY(-4px) rotate(1deg); } }
  @keyframes sparky-sparks { 0% { opacity:0; transform:translate(0,7px) scale(.4); } 30% { opacity:1; } 100% { opacity:0; transform:translate(14px,-15px) scale(1.1); } }
  @media (max-width: 650px) {
    .sparky-launcher { right: 14px; bottom: 14px; min-height: 52px; padding-right: 13px; }
    .sparky-launcher img { width: 39px; height: 39px; }
    .sparky-launcher span { display: none; }
  }
  @media (prefers-reduced-motion: reduce) {
    .sparky-launcher img, .sparky-launcher svg, .sparky-avatar, .sparky-thinking, .sparky-launcher::before, .sparky-launcher::after, .sparky-avatar-wrap::before, .sparky-avatar-wrap::after { animation: none !important; }
  }
`;

function cleanMessage(value) {
  return String(value || "").trim().slice(0, 2000);
}

export default function SparkyAssistant({ currentPage, activeUser, authenticatedProfile, setPage }) {
  const [opened, setOpened] = useState(false);
  const [question, setQuestion] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState([STARTER_MESSAGE]);
  const [pendingAction, setPendingAction] = useState(null);
  const viewport = useRef(null);

  const prompts = useMemo(() => PAGE_PROMPTS[currentPage] || DEFAULT_PROMPTS, [currentPage]);
  const latestQuestion = [...messages].reverse().find((message) => message.role === "user")?.content || "";
  const action = useMemo(() => suggestedAction(latestQuestion), [latestQuestion]);

  useEffect(() => {
    if (!opened) return;
    window.setTimeout(() => viewport.current?.scrollTo({ top: viewport.current.scrollHeight, behavior: "smooth" }), 60);
  }, [messages, opened, sending]);

  async function askSparky(suggestedQuestion) {
    const message = cleanMessage(suggestedQuestion ?? question);
    if (!message || sending) return;

    const nextMessages = [...messages, { role: "user", content: message }];
    setMessages(nextMessages);
    setQuestion("");
    setSending(true);

    try {
      const { data, error } = await supabase.functions.invoke("sparky-assistant", {
        body: {
          question: message,
          page: currentPage,
          history: nextMessages.slice(-8),
        },
      });
      if (error) throw error;
      if (!data?.answer) throw new Error(data?.error || "Sparky could not prepare an answer.");
      setMessages((current) => [...current, { role: "assistant", content: data.answer }]);
      setPendingAction(data.proposed_action || null);
    } catch (error) {
      const messageText = error?.context?.body?.error || error.message || "Sparky is temporarily unavailable.";
      setMessages((current) => [...current, { role: "assistant", content: `I couldn’t complete that request. ${messageText}` }]);
      notifications.show({ title: "Sparky Could Not Answer", message: messageText, color: "red" });
    } finally {
      setSending(false);
    }
  }

  function clearConversation() {
    setMessages([STARTER_MESSAGE]);
    setQuestion("");
    setPendingAction(null);
  }

  async function confirmPendingAction() {
    if (!pendingAction || sending) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("sparky-assistant", {
        body: { action: pendingAction, confirmed: true, page: currentPage },
      });
      if (error) throw error;
      if (!data?.answer) throw new Error(data?.error || "Sparky could not complete the action.");
      setMessages((current) => [...current, { role: "assistant", content: data.answer }]);
      setPendingAction(null);
      notifications.show({ title: "Sparky Completed the Action", message: data.answer, color: "green" });
    } catch (error) {
      let messageText = error?.message || "Sparky could not complete the action.";
      if (error?.context?.clone) {
        try { messageText = (await error.context.clone().json())?.error || messageText; } catch { /* Response was not JSON. */ }
      }
      setMessages((current) => [...current, { role: "assistant", content: `I couldn’t complete that action. ${messageText}` }]);
      notifications.show({ title: "Sparky Could Not Complete It", message: messageText, color: "red" });
    } finally {
      setSending(false);
    }
  }

  function openAction() {
    if (!action || !setPage) return;
    if (action.intake) sessionStorage.setItem("mwSparkyOpenDesignIntake", "true");
    setOpened(false);
    setPage(action.page);
    if (action.anchor) window.setTimeout(() => document.getElementById(action.anchor)?.scrollIntoView({ behavior: "smooth", block: "start" }), 250);
  }

  return <>
    <style>{SPARKY_STYLES}</style>
    <button type="button" className="sparky-launcher" onClick={() => setOpened(true)} aria-label="Ask Sparky">
      <img src={sparkyImage} alt="Sparky, the Metal Worx shop assistant"/>
      <span>Ask Sparky</span>
      <IconBolt size={19}/>
    </button>

    <Drawer opened={opened} onClose={() => setOpened(false)} position="right" size="min(470px, 100vw)" withCloseButton={false} padding={0}>
      <Stack h="100dvh" gap={0} bg="#0b0d0f">
        <Paper radius={0} p="md" style={{ borderBottom: "1px solid rgba(255,255,255,0.09)", background: "linear-gradient(135deg, #160809, #171a1d)" }}>
          <Group wrap="nowrap" align="center">
            <div className="sparky-avatar-wrap"><img className={`sparky-avatar ${sending ? "sparky-thinking" : ""}`} src={sparkyImage} alt="Sparky"/></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Group gap="xs"><Title order={2}>Sparky</Title><Badge color="green" variant="light">Online</Badge></Group>
              <Text size="sm" c="dimmed">Metal Worx Shop Assistant</Text>
              <Text size="xs" c="gray.6">{activeUser || authenticatedProfile?.display_name || "Employee"} · {authenticatedProfile?.department || currentPage || "Metal Worx OS"}</Text>
            </div>
            <ActionIcon variant="subtle" color="gray" onClick={() => setOpened(false)} aria-label="Close Sparky"><IconX/></ActionIcon>
          </Group>
        </Paper>

        <ScrollArea viewportRef={viewport} style={{ flex: 1 }} p="md">
          <Stack gap="md" pb="md">
            {messages.map((message, index) => <Paper key={`${message.role}-${index}`} p="md" radius="lg" ml={message.role === "user" ? 42 : 0} mr={message.role === "assistant" ? 28 : 0} style={{ background: message.role === "user" ? "linear-gradient(135deg, #761012, #aa181d)" : "#181b1f", border: "1px solid rgba(255,255,255,0.08)" }}>
              <Text size="xs" fw={900} c={message.role === "user" ? "red.1" : "red.4"} mb={5}>{message.role === "user" ? "YOU" : "SPARKY"}</Text>
              <Text size="sm" className="sparky-message">{message.content}</Text>
            </Paper>)}
            {sending && <Paper p="md" radius="lg" mr={28} style={{ background: "#181b1f", border: "1px solid rgba(255,255,255,0.08)" }}><Group gap="sm"><Loader size="sm" color="red"/><Text size="sm" c="dimmed">Sparky is checking Metal Worx OS…</Text></Group></Paper>}
          </Stack>
        </ScrollArea>

        <Paper radius={0} p="md" style={{ borderTop: "1px solid rgba(255,255,255,0.09)", background: "#101215" }}>
          <Stack gap="sm">
            {messages.length === 1 && <Group gap="xs">{prompts.map((prompt) => <Button key={prompt} size="compact-xs" variant="light" color="gray" onClick={() => askSparky(prompt)}>{prompt}</Button>)}</Group>}
            {pendingAction && <Paper p="sm" radius="md" style={{ border: "1px solid #9f2028", background: "#22090c" }}><Stack gap="xs"><Text size="xs" fw={900} c="red.3">{pendingAction.type === "create_quote_draft" ? "CONFIRM NEW QUOTE DRAFT" : "CONFIRM SHOP RECORD CHANGE"}</Text><Text size="sm">{pendingAction.label}</Text><Group grow><Button variant="default" onClick={() => setPendingAction(null)} disabled={sending}>Cancel</Button><Button color="red" leftSection={<IconBolt size={16}/>} onClick={confirmPendingAction} loading={sending}>{pendingAction.type === "create_quote_draft" ? "Create Draft" : "Confirm Move"}</Button></Group></Stack></Paper>}
            {!pendingAction && action && messages.length > 1 && (() => { const ActionIconComponent = action.icon; return <Button variant="light" color="red" leftSection={<ActionIconComponent size={17}/>} onClick={openAction}>{action.label}</Button>; })()}
            <Textarea value={question} onChange={(event) => setQuestion(event.currentTarget.value)} placeholder="Ask about a job, create a quote draft, find an item, or check today's priorities…" minRows={2} maxRows={8} autosize disabled={sending} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); askSparky(); } }}/>
            <Group justify="space-between">
              <Button size="xs" variant="subtle" color="gray" leftSection={<IconTrash size={15}/>} onClick={clearConversation} disabled={sending || messages.length === 1}>Clear</Button>
              <Button color="red" rightSection={sending ? <Loader size={15} color="white"/> : <IconSend size={16}/>} onClick={() => askSparky()} disabled={!question.trim() || sending}>Ask Sparky</Button>
            </Group>
            <Text size="xs" c="gray.6" ta="center">Sparky can make mistakes. Verify safety instructions, measurements, quantities, and customer commitments.</Text>
          </Stack>
        </Paper>
      </Stack>
    </Drawer>
  </>;
}
