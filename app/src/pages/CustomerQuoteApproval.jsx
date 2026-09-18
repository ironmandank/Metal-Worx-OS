import { useEffect, useRef, useState } from "react";
import { Alert, Badge, Button, Card, Checkbox, Group, Loader, Modal, Stack, Table, Text, TextInput, Textarea, Title } from "@mantine/core";
import { supabase } from "../lib/supabase";
import companyLogo from "../assets/metal-worx-official-transparent.png";

function money(value) {
  return Number(value || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function date(value) {
  if (!value) return "Not set";
  const parsed = new Date(String(value).length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function Section({ title, value }) {
  if (!String(value || "").trim()) return null;
  return <section className="approval-section"><h2>{title}</h2><p>{value}</p></section>;
}

function SignaturePad({ onChange }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const resize = () => {
      const previous = canvas.toDataURL();
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = canvas.clientWidth * ratio;
      canvas.height = 180 * ratio;
      const context = canvas.getContext("2d");
      context.scale(ratio, ratio);
      context.lineWidth = 2.5;
      context.lineCap = "round";
      context.strokeStyle = "#111827";
      if (previous && previous.length > 200) {
        const image = new Image();
        image.onload = () => context.drawImage(image, 0, 0, canvas.clientWidth, 180);
        image.src = previous;
      }
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  function point(event) {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function start(event) {
    drawing.current = true;
    canvasRef.current.setPointerCapture(event.pointerId);
    const context = canvasRef.current.getContext("2d");
    const current = point(event);
    context.beginPath();
    context.moveTo(current.x, current.y);
  }

  function move(event) {
    if (!drawing.current) return;
    const current = point(event);
    const context = canvasRef.current.getContext("2d");
    context.lineTo(current.x, current.y);
    context.stroke();
  }

  function end() {
    if (!drawing.current) return;
    drawing.current = false;
    onChange(canvasRef.current.toDataURL("image/png"));
  }

  function clear() {
    const canvas = canvasRef.current;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    onChange("");
  }

  return (
    <div>
      <canvas ref={canvasRef} className="approval-signature-pad" onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} />
      <Group justify="space-between" mt="xs">
        <Text size="xs" c="dimmed">Sign with a mouse, stylus, or finger.</Text>
        <Button size="xs" variant="subtle" color="gray" onClick={clear}>Clear signature</Button>
      </Group>
    </div>
  );
}

export default function CustomerQuoteApproval() {
  const token = new URLSearchParams(window.location.search).get("token") || "";
  const [approval, setApproval] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState("");
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [signature, setSignature] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [changesOpen, setChangesOpen] = useState(false);
  const [changeMessage, setChangeMessage] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error: invokeError } = await supabase.functions.invoke("customer-quote-approval", { body: { action: "view", token } });
      if (invokeError || data?.error) setError(data?.error || invokeError?.message || "This quote could not be loaded.");
      else {
        setApproval(data.approval);
        setSignerEmail(data.approval?.recipient_email || data.approval?.document_snapshot?.quote?.contact_email || "");
      }
      setLoading(false);
    }
    load();
  }, [token]);

  async function approve() {
    setSubmitting(true);
    setError("");
    const { data, error: invokeError } = await supabase.functions.invoke("customer-quote-approval", {
      body: { action: "approve", token, signer_name: signerName, signer_email: signerEmail, signature_data_url: signature, accepted },
    });
    if (invokeError || data?.error) setError(data?.error || invokeError?.message || "Your approval could not be recorded.");
    else setCompleted("Approved");
    setSubmitting(false);
  }

  async function requestChanges() {
    setSubmitting(true);
    setError("");
    const { data, error: invokeError } = await supabase.functions.invoke("customer-quote-approval", {
      body: { action: "request_changes", token, signer_name: signerName, signer_email: signerEmail, customer_message: changeMessage },
    });
    if (invokeError || data?.error) setError(data?.error || invokeError?.message || "Your request could not be recorded.");
    else { setCompleted("Changes Requested"); setChangesOpen(false); }
    setSubmitting(false);
  }

  if (loading) return <main className="approval-public-shell"><Loader color="red" /><Text>Loading your Metal Worx quote…</Text></main>;
  if (error && !approval) return <main className="approval-public-shell"><img src={companyLogo} alt="Metal Worx Inc." /><Alert color="red" title="Quote Link Unavailable">{error}</Alert></main>;

  const snapshot = approval?.document_snapshot || {};
  const quote = snapshot.quote || {};
  const items = snapshot.items || [];
  const images = snapshot.images || [];
  const open = ["Sent", "Viewed"].includes(approval?.status) && !completed;

  return (
    <main className="approval-public-shell">
      <article className="approval-document">
        <header className="approval-header">
          <img src={companyLogo} alt="Metal Worx Inc." />
          <div><Title order={1}>Customer Quote Approval</Title><Text fw={700}>Metal Worx Inc. · Veteran Owned</Text><Text size="sm">1122 Gillespie Street, Fayetteville, NC 28306 · (910) 438-9353</Text></div>
        </header>

        {(completed || approval?.status === "Approved") && <Alert color="green" title="Approval received">Thank you. This quote was approved and returned to Metal Worx OS. No further action is needed.<Button ml="md" size="xs" variant="light" color="green" onClick={() => window.print()}>Print or Save a Copy</Button></Alert>}
        {(completed === "Changes Requested" || approval?.status === "Changes Requested") && <Alert color="orange" title="Changes sent to Metal Worx">Your request has been recorded. Metal Worx will review it and issue an updated quote if needed.</Alert>}
        {!["Sent", "Viewed", "Approved", "Changes Requested"].includes(approval?.status) && <Alert color="red" title={`Link ${approval?.status || "Unavailable"}`}>Contact Metal Worx at (910) 438-9353 for a current quote.</Alert>}
        {error && <Alert color="red" title="Please check the form">{error}</Alert>}

        <Card withBorder className="approval-summary-card">
          <Group justify="space-between" align="flex-start">
            <div><Text size="xs" c="dimmed" fw={800}>QUOTE</Text><Title order={2}>{quote.quote_number || `Quote ${quote.id}`}</Title><Text fw={700}>{quote.quote_title || quote.project_name || "Custom Project"}</Text></div>
            <div className="approval-total"><Text size="xs" c="dimmed" fw={800}>TOTAL</Text><Title order={2}>{money(quote.total_amount)}</Title>{quote.tax_treatment === "plus" && <Text size="xs" fw={800}>Plus applicable taxes and fees</Text>}{quote.tax_treatment === "exempt" && <Text size="xs" fw={800}>Tax exempt</Text>}<Badge color={approval?.status === "Approved" ? "green" : "blue"}>{approval?.status}</Badge></div>
          </Group>
          <div className="approval-meta-grid">
            <div><strong>Prepared for</strong><span>{quote.company_name || quote.customer_name || quote.contact_name || "Customer"}</span></div>
            <div><strong>Quote date</strong><span>{date(quote.quote_date)}</span></div>
            <div><strong>Valid through</strong><span>{date(quote.valid_until)}</span></div>
            <div><strong>Document version</strong><span>{approval?.document_version}</span></div>
          </div>
        </Card>

        {items.length > 0 && <section className="approval-section"><h2>Quote Items</h2><Table striped withTableBorder><Table.Thead><Table.Tr><Table.Th>Item</Table.Th><Table.Th>Qty.</Table.Th><Table.Th>Rate</Table.Th><Table.Th>Total</Table.Th></Table.Tr></Table.Thead><Table.Tbody>{items.map((item) => <Table.Tr key={item.id}><Table.Td><strong>{item.title}</strong>{item.description && <Text size="sm" c="dimmed">{item.description}</Text>}</Table.Td><Table.Td>{Number(item.quantity || 0)}</Table.Td><Table.Td>{money(item.unit_price)}</Table.Td><Table.Td>{money(item.line_total)}</Table.Td></Table.Tr>)}</Table.Tbody></Table></section>}

        <Section title="Project Scope" value={quote.scope_of_work} />
        <Section title="Specifications" value={quote.specifications} />
        <Section title="Included Services" value={quote.included_services} />
        <Section title="Project Schedule" value={quote.project_schedule} />
        <Section title="Customer Responsibilities" value={quote.customer_responsibilities} />
        <Section title="Exclusions" value={quote.exclusions} />
        <Section title="Payment Terms" value={[quote.down_payment_terms, quote.payment_terms].filter(Boolean).join("\n\n")} />
        <Section title="Warranty" value={quote.warranty_terms} />
        <Section title="Terms & Conditions" value={[quote.acceptance_terms, quote.disclaimer].filter(Boolean).join("\n\n")} />

        {images.length > 0 && <section className="approval-section"><h2>Project Images & Drawings</h2><div className="approval-image-grid">{images.map((image) => <figure key={image.id}><img src={image.image_url} alt={image.caption || image.image_type || "Project reference"} /><figcaption>{image.caption || image.image_type}</figcaption></figure>)}</div></section>}

        {open && <section className="approval-sign-section">
          <Title order={2}>Approve & Sign</Title>
          <Text>Review the quote above, enter your information, and sign below. Your approval is returned directly to Metal Worx OS.</Text>
          <div className="approval-form-grid"><TextInput label="Full legal name" required value={signerName} onChange={(event) => setSignerName(event.currentTarget.value)} /><TextInput label="Email address" required value={signerEmail} onChange={(event) => setSignerEmail(event.currentTarget.value)} /></div>
          <Text fw={700} mt="md" mb={6}>Signature</Text><SignaturePad onChange={setSignature} />
          <Checkbox mt="lg" checked={accepted} onChange={(event) => setAccepted(event.currentTarget.checked)} label="I have reviewed this quote, agree to its scope, pricing, payment terms, and conditions, and authorize Metal Worx Inc. to proceed." />
          <Group mt="xl"><Button color="green" size="lg" loading={submitting} onClick={approve}>Approve & Sign Quote</Button><Button variant="light" color="orange" size="lg" onClick={() => setChangesOpen(true)}>Request Changes</Button></Group>
        </section>}

        <footer>Metal Worx Inc. · info@metalworxinc.net · (910) 438-9353 · Document ID {approval?.id}</footer>
      </article>

      <Modal opened={changesOpen} onClose={() => setChangesOpen(false)} title="Request Quote Changes" centered>
        <Stack><Text>Describe what you would like Metal Worx to review or change.</Text><TextInput label="Your name" value={signerName} onChange={(event) => setSignerName(event.currentTarget.value)} /><TextInput label="Your email" value={signerEmail} onChange={(event) => setSignerEmail(event.currentTarget.value)} /><Textarea label="Requested changes" required minRows={5} value={changeMessage} onChange={(event) => setChangeMessage(event.currentTarget.value)} /><Button color="orange" loading={submitting} onClick={requestChanges}>Send Change Request</Button></Stack>
      </Modal>
    </main>
  );
}
