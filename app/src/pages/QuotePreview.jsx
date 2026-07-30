import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, Group, Loader, Table, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";

import { supabase } from "../lib/supabase";
import companyLogo from "../assets/metal-worx-official-transparent.png";

import MWPageHeader from "../components/ui/MWPageHeader";
import MWSection from "../components/ui/MWSection";

const COMPANY_LOGO_URL = companyLogo;

function money(value) {
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function formatLongDate(value) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function getCustomerMaterialPrice(request) {
  return Number(request.customer_material_price || 0);
}

function getCustomerMaterialUnitPrice(request) {
  const quantity = Number(request.quantity || 0);
  const total = getCustomerMaterialPrice(request);
  return quantity > 0 ? total / quantity : total;
}

function isMaterialPriced(request) {
  const customerPrice = getCustomerMaterialPrice(request);
  return (
    Boolean(request.quote_complete) ||
    customerPrice > 0 ||
    [
      "Waiting Customer Approval",
      "Ready to Order",
      "Ordered",
      "Partially Received",
      "Received",
    ].includes(request.status)
  );
}

function getCustomerName(customer) {
  if (!customer) return "";
  return (
    `${customer.first_name || ""} ${customer.last_name || ""}`.trim() ||
    customer.contact_name ||
    customer.name ||
    customer.company_name ||
    ""
  );
}

function getProjectPerson(project, customer, quote) {
  return (
    project?.contact_name ||
    quote?.contact_name ||
    quote?.customer_name ||
    getCustomerName(customer) ||
    "Customer"
  );
}

function getProjectCompany(project, customer, projectPerson, quote) {
  const company =
    project?.company_name ||
    quote?.company_name ||
    customer?.company_name ||
    customer?.business_name ||
    "";
  return company && company !== projectPerson ? company : "";
}

function getProjectItem(project, quote) {
  const enteredTitle = String(quote?.quote_title || "").trim();
  const genericTitles = [
    "professional quote",
    "project quote",
    "customer proposal",
  ];

  return (
    (!genericTitles.includes(enteredTitle.toLowerCase()) && enteredTitle) ||
    quote?.project_name ||
    project?.project_name ||
    project?.project_type ||
    project?.project_category ||
    project?.project_number ||
    "Custom Fabrication Project"
  );
}

function splitLines(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function QuoteTextSection({ title, value, className = "" }) {
  if (!String(value || "").trim()) return null;
  return (
    <section className={`quote-section ${className}`.trim()}>
      <h2>{title}</h2>
      <div className="quote-text">{value}</div>
    </section>
  );
}

function QuotePreview({ selectedProject, selectedQuote, setPage }) {
  const [quote, setQuote] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [items, setItems] = useState([]);
  const [quoteImages, setQuoteImages] = useState([]);
  const [materialRequests, setMaterialRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (selectedProject?.id || selectedQuote?.id) {
      loadQuotePreview();
    } else {
      setLoading(false);
    }
  }, [selectedProject, selectedQuote?.id]);

  async function loadQuotePreview() {
    setLoading(true);
    try {
      let quoteQuery = supabase.from("project_quotes").select("*");
      quoteQuery = selectedProject?.id
        ? quoteQuery.eq("project_id", selectedProject.id).eq("is_active", true)
        : quoteQuery.eq("id", selectedQuote.id);
      const quoteResult = await quoteQuery.maybeSingle();

      if (quoteResult.error) throw quoteResult.error;

      const customerId =
        selectedProject?.customer_id || quoteResult.data?.customer_id;
      const customerPromise = customerId
        ? supabase
            .from("customers")
            .select("*")
            .eq("id", customerId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null });
      const customerResult = await customerPromise;
      if (customerResult.error) {
        console.error("Quote customer load error:", customerResult.error);
      }
      setCustomer(customerResult.data || null);

      if (!quoteResult.data) {
        setQuote(null);
        return;
      }

      const activeQuote = quoteResult.data;
      setQuote(activeQuote);

      const [itemResult, imageResult, materialResult] = await Promise.all([
        supabase
          .from("project_quote_items")
          .select("*")
          .eq("quote_id", activeQuote.id)
          .eq("show_on_pdf", true)
          .order("sort_order", { ascending: true }),
        supabase
          .from("project_quote_images")
          .select("*")
          .eq("quote_id", activeQuote.id)
          .eq("show_on_pdf", true)
          .order("sort_order", { ascending: true }),
        selectedProject?.id
          ? supabase
              .from("project_material_requests")
              .select("*")
              .eq("project_id", selectedProject.id)
              .not("status", "eq", "Cancelled")
              .order("created_at", { ascending: true })
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (itemResult.error) throw itemResult.error;
      if (imageResult.error) throw imageResult.error;
      if (materialResult.error) throw materialResult.error;

      setItems(itemResult.data || []);
      setQuoteImages(imageResult.data || []);
      setMaterialRequests(materialResult.data || []);
    } catch (error) {
      console.error("Quote preview load error:", error);
      notifications.show({
        title: "Quote Load Failed",
        message: error.message || "Unable to prepare the customer proposal.",
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  }

  const baseItems = useMemo(
    () => items.filter((item) => !item.is_optional),
    [items],
  );
  const optionalItems = useMemo(
    () => items.filter((item) => item.is_optional),
    [items],
  );
  const selectedOptionalItems = useMemo(
    () => optionalItems.filter((item) => item.is_selected),
    [optionalItems],
  );
  const pricedMaterials = useMemo(
    () => materialRequests.filter(isMaterialPriced),
    [materialRequests],
  );
  const unpricedMaterials = useMemo(
    () => materialRequests.filter((request) => !isMaterialPriced(request)),
    [materialRequests],
  );

  const materialSubtotal = useMemo(
    () =>
      pricedMaterials.reduce(
        (sum, request) => sum + getCustomerMaterialPrice(request),
        0,
      ),
    [pricedMaterials],
  );
  const baseSubtotal = useMemo(
    () =>
      baseItems.reduce((sum, item) => sum + Number(item.line_total || 0), 0),
    [baseItems],
  );
  const selectedOptionsTotal = useMemo(
    () =>
      selectedOptionalItems.reduce(
        (sum, item) => sum + Number(item.line_total || 0),
        0,
      ),
    [selectedOptionalItems],
  );

  const contractSubtotal =
    materialSubtotal + baseSubtotal + selectedOptionsTotal;
  const taxAmount = contractSubtotal * Number(quote?.tax_rate || 0);
  const calculatedTotal = contractSubtotal + taxAmount;
  const grandTotal =
    calculatedTotal > 0 ? calculatedTotal : Number(quote?.total_amount || 0);

  const projectPerson = getProjectPerson(selectedProject, customer, quote);
  const projectCompany = getProjectCompany(
    selectedProject,
    customer,
    projectPerson,
    quote,
  );
  const projectItem = getProjectItem(selectedProject, quote);
  const quoteDate =
    quote?.quote_date || quote?.created_at || new Date().toISOString();
  const projectLocation = [
    selectedProject?.job_address || quote?.billing_address,
    [
      selectedProject?.city || quote?.billing_city,
      selectedProject?.state || quote?.billing_state,
      selectedProject?.zip_code || quote?.billing_zip,
    ]
      .filter(Boolean)
      .join(" "),
  ]
    .filter(Boolean)
    .join(", ");

  const pricingRows = [
    ...pricedMaterials.map((request) => ({
      id: `material-${request.id}`,
      title: request.item_name || "Material",
      description:
        [request.dimensions, request.description].filter(Boolean).join(" — ") ||
        "As required",
      basis: `${request.quantity || 1} @ ${money(
        getCustomerMaterialUnitPrice(request),
      )}`,
      amount: getCustomerMaterialPrice(request),
    })),
    ...baseItems.map((item) => ({
      id: `item-${item.id}`,
      title: item.title || "Service",
      description: item.description || "",
      basis: `${item.quantity || 0} @ ${money(item.unit_price)}`,
      amount: Number(item.line_total || 0),
    })),
    ...selectedOptionalItems.map((item) => ({
      id: `option-${item.id}`,
      title: `${item.title || "Option"} (Selected)`,
      description: item.description || "",
      basis: `${item.quantity || 0} @ ${money(item.unit_price)}`,
      amount: Number(item.line_total || 0),
    })),
  ];

  const responsibilities = splitLines(quote?.customer_responsibilities);
  const assumptions = splitLines(quote?.assumptions);
  const exclusions = splitLines(quote?.exclusions);

  if (loading) {
    return (
      <>
        <MWPageHeader
          title="Quote Preview"
          subtitle="Preparing the professional Metal Worx proposal"
          setPage={setPage}
          showBack={true}
          backPage="quoteBuilder"
          backLabel="Quote Builder"
          showDashboard={true}
        />
        <Card withBorder radius="lg" p="xl">
          <Group justify="center">
            <Loader color="red" />
            <Text c="dimmed">Preparing customer proposal...</Text>
          </Group>
        </Card>
      </>
    );
  }

  if ((!selectedProject && !selectedQuote) || !quote) {
    return (
      <>
        <MWPageHeader
          title="Quote Preview"
          subtitle="No saved quote was found"
          setPage={setPage}
          showBack={true}
          backPage="quoteBuilder"
          backLabel="Quote Builder"
          showDashboard={true}
        />
        <MWSection title="Quote Not Found">
          <Text c="dimmed">
            Return to Quote Builder and save the quote before opening Preview.
          </Text>
        </MWSection>
      </>
    );
  }

  return (
    <>
      <style>{`
        .quote-screen-controls {
          margin-bottom: 22px;
        }

        .mw-quote-document {
          width: 100%;
          max-width: 900px;
          margin: 0 auto;
          background: #fff;
          color: #17191c;
          font-family: Arial, Helvetica, sans-serif;
          box-shadow: 0 20px 55px rgba(0, 0, 0, .38);
        }

        .quote-page {
          min-height: 1110px;
          padding: 34px 42px 30px;
          background: #fff;
          position: relative;
          border-bottom: 10px solid #111;
        }

        .quote-page:last-child {
          border-bottom: 0;
        }

        .quote-running-header {
          display: grid;
          grid-template-columns: 220px 1fr;
          gap: 24px;
          align-items: center;
          padding-bottom: 12px;
          border-bottom: 3px solid #c8102e;
          margin-bottom: 20px;
        }

        .quote-logo {
          display: block;
          width: 175px;
          max-height: 58px;
          object-fit: contain;
          object-position: left center;
        }

        .quote-company {
          text-align: right;
          font-size: 12px;
          line-height: 1.35;
          font-weight: 800;
          letter-spacing: .02em;
        }

        .quote-title-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.6fr) minmax(250px, .8fr);
          border: 1px solid #17191c;
          margin-bottom: 20px;
        }

        .quote-title-block {
          background: #17191c;
          color: #fff;
          padding: 20px 22px;
        }

        .quote-title-block .eyebrow {
          color: #ff1f35 !important;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: .16em;
          text-transform: uppercase;
        }

        .quote-title-block h1 {
          margin: 7px 0 4px;
          color: #ffffff !important;
          font-size: 30px;
          line-height: 1.06;
          text-transform: uppercase;
        }

        .quote-title-block p {
          margin: 0;
          color: #e2e2e2 !important;
          font-size: 15px;
        }

        .quote-meta {
          background: #e7e9ec;
          padding: 15px 17px;
        }

        .quote-meta-row {
          display: grid;
          grid-template-columns: 98px 1fr;
          gap: 8px;
          padding: 4px 0;
          font-size: 12px;
        }

        .quote-meta-row span:first-child {
          color: #35556e;
          font-weight: 900;
          text-transform: uppercase;
        }

        .quote-meta-row strong {
          overflow-wrap: anywhere;
        }

        .quote-info-table {
          display: grid;
          grid-template-columns: 1fr 1fr;
          border: 1px solid #555;
          margin-bottom: 18px;
        }

        .quote-info-cell {
          min-height: 64px;
          padding: 10px 12px;
          border-bottom: 1px solid #8d8d8d;
        }

        .quote-info-cell:nth-child(odd) {
          border-right: 1px solid #8d8d8d;
        }

        .quote-info-cell:nth-last-child(-n + 2) {
          border-bottom: 0;
        }

        .quote-info-cell:nth-child(4n + 3),
        .quote-info-cell:nth-child(4n + 4) {
          background: #f2f4f7;
        }

        .quote-info-label {
          display: block;
          margin-bottom: 5px;
          color: #35556e;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .04em;
          text-transform: uppercase;
        }

        .quote-info-value {
          font-size: 14px;
          line-height: 1.25;
          white-space: pre-wrap;
        }

        .quote-price-band {
          display: grid;
          grid-template-columns: 1fr 220px;
          margin: 17px 0 5px;
        }

        .quote-price-label {
          background: #17191c;
          color: #fff;
          padding: 14px 16px;
          font-weight: 900;
          letter-spacing: .06em;
        }

        .quote-price-value {
          background: #b60018;
          color: #fff;
          padding: 11px 16px;
          text-align: right;
          font-size: 25px;
          font-weight: 900;
        }

        .quote-price-notes {
          margin: 0 0 18px;
          color: #69737d;
          font-size: 11px;
          line-height: 1.45;
          font-style: italic;
          white-space: pre-wrap;
        }

        .quote-section {
          margin-top: 19px;
        }

        .quote-section h2 {
          margin: 0 0 10px;
          padding-bottom: 7px;
          border-bottom: 2px solid #c8102e;
          font-size: 19px;
          line-height: 1.15;
        }

        .quote-text {
          font-size: 13px;
          line-height: 1.52;
          white-space: pre-wrap;
        }

        .quote-list {
          margin: 4px 0 0;
          padding-left: 23px;
          font-size: 13px;
          line-height: 1.48;
        }

        .quote-list li {
          margin: 4px 0;
        }

        .quote-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }

        .quote-table th {
          background: #17191c !important;
          color: #fff !important;
          padding: 10px !important;
          text-align: left;
          font-weight: 900;
        }

        .quote-table td {
          border: 1px solid #777 !important;
          padding: 9px 10px !important;
          vertical-align: top;
        }

        .quote-table tbody tr:nth-child(even) td {
          background: #f2f4f7;
        }

        .quote-line-description {
          margin-top: 3px;
          color: #606b75;
          font-size: 11px;
          line-height: 1.35;
          white-space: pre-wrap;
        }

        .quote-total-row td {
          background: #e6eef5 !important;
          color: #19384f;
          font-weight: 900;
        }

        .quote-grand-row td {
          background: #17191c !important;
          color: #fff !important;
          font-size: 14px;
          font-weight: 900;
        }

        .quote-notice {
          margin-top: 19px;
          padding: 13px 15px;
          border: 1px solid #9c8032;
          background: #fff4d6;
          color: #4f4117;
          font-size: 12px;
          line-height: 1.45;
          white-space: pre-wrap;
        }

        .quote-image-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 13px;
          margin-top: 12px;
        }

        .quote-image-card {
          border: 1px solid #aaa;
          padding: 7px;
        }

        .quote-image-card img {
          display: block;
          width: 100%;
          height: 190px;
          object-fit: contain;
          background: #f1f1f1;
        }

        .quote-image-caption {
          padding: 7px 4px 2px;
          color: #555;
          font-size: 10px;
          line-height: 1.35;
        }

        .quote-terms-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 12px;
        }

        .quote-term-card {
          border: 1px solid #777;
          padding: 12px;
          min-height: 100px;
        }

        .quote-term-card h3 {
          margin: 0 0 7px;
          font-size: 13px;
          text-transform: uppercase;
        }

        .quote-term-card div {
          font-size: 12px;
          line-height: 1.45;
          white-space: pre-wrap;
        }

        .quote-acceptance {
          margin-top: 22px;
        }

        .quote-signatures {
          display: grid;
          grid-template-columns: 1fr 1fr;
          margin-top: 14px;
          border: 1px solid #666;
        }

        .quote-signature {
          min-height: 150px;
          padding: 11px;
        }

        .quote-signature:first-child {
          border-right: 1px solid #666;
        }

        .quote-signature h3 {
          margin: -11px -11px 54px;
          padding: 9px 11px;
          background: #e7e9ec;
          color: #19384f;
          font-size: 11px;
        }

        .quote-signature-line {
          margin-top: 22px;
          padding-top: 5px;
          border-top: 1px solid #555;
          font-size: 10px;
        }

        .quote-footer {
          position: absolute;
          left: 42px;
          right: 42px;
          bottom: 17px;
          color: #777;
          font-size: 8px;
          text-align: center;
          letter-spacing: .03em;
        }

        @media (max-width: 760px) {
          .quote-page {
            min-height: 0;
            padding: 24px 18px 60px;
          }
          .quote-running-header,
          .quote-title-grid,
          .quote-info-table,
          .quote-price-band,
          .quote-terms-grid,
          .quote-signatures {
            grid-template-columns: 1fr;
          }
          .quote-company {
            text-align: left;
          }
          .quote-info-cell {
            border-right: 0 !important;
            border-bottom: 1px solid #888 !important;
          }
          .quote-price-value {
            text-align: left;
          }
        }

        @media print {
          @page {
            size: Letter;
            margin: 0;
          }

          body {
            background: #fff !important;
          }

          body * {
            visibility: hidden !important;
          }

          .mw-quote-document,
          .mw-quote-document * {
            visibility: visible !important;
          }

          .mw-quote-document {
            position: absolute;
            inset: 0;
            width: 100%;
            max-width: none;
            margin: 0;
            box-shadow: none;
          }

          .quote-page {
            width: 8.5in;
            min-height: 11in;
            height: 11in;
            padding: .32in .42in .3in;
            border-bottom: 0;
            page-break-after: always;
            break-after: page;
            overflow: hidden;
          }

          .quote-page:last-child {
            page-break-after: auto;
            break-after: auto;
          }

          .quote-running-header,
          .quote-title-block,
          .quote-meta,
          .quote-price-label,
          .quote-price-value,
          .quote-table th,
          .quote-table td,
          .quote-notice,
          .quote-signature h3 {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      <div className="quote-screen-controls">
        <MWPageHeader
          title={`${quote.quote_number || "Quote"} — ${projectItem}`}
          subtitle="Professional customer proposal and printable record"
          setPage={setPage}
          showBack={true}
          backPage="quoteBuilder"
          backLabel="Quote Builder"
          showDashboard={true}
        />

        <Group justify="space-between" mt="md">
          <Group gap="xs">
            <Badge color="red" variant="light" size="lg">
              {quote.quote_layout || "Detailed Fabrication"}
            </Badge>
            <Badge
              color={unpricedMaterials.length ? "orange" : "green"}
              variant="light"
              size="lg"
            >
              {unpricedMaterials.length
                ? `${unpricedMaterials.length} Material Price Pending`
                : "Pricing Complete"}
            </Badge>
          </Group>

          <Group>
            <Button
              variant="light"
              color="gray"
              onClick={() => setPage("quoteBuilder")}
            >
              Edit Quote
            </Button>
            <Button
              color="red"
              disabled={unpricedMaterials.length > 0}
              onClick={() => {
                setTimeout(() => {
                  window.focus();
                  window.print();
                }, 100);
              }}
            >
              Export PDF
            </Button>
          </Group>
        </Group>
      </div>

      <main className="mw-quote-document">
        <article className="quote-page">
          <header className="quote-running-header">
            <img
              src={COMPANY_LOGO_URL}
              alt="Metal Worx Inc."
              className="quote-logo"
            />
            <div className="quote-company">
              METAL WORX INC.
              <br />
              CUSTOM FABRICATION
              <br />
              1122 Gillespie St. | Fayetteville, NC 28306
            </div>
          </header>

          <section className="quote-title-grid">
            <div className="quote-title-block">
              <div className="eyebrow">Professional Quote</div>
              <h1>{projectItem}</h1>
              <p>
                {selectedProject?.project_type ||
                  selectedProject?.project_category ||
                  quote.quote_type ||
                  "Custom Metal Fabrication"}
              </p>
            </div>
            <div className="quote-meta">
              <div className="quote-meta-row">
                <span>Quote No.</span>
                <strong>{quote.quote_number || "Not set"}</strong>
              </div>
              <div className="quote-meta-row">
                <span>Date</span>
                <strong>{formatLongDate(quoteDate)}</strong>
              </div>
              <div className="quote-meta-row">
                <span>Valid Through</span>
                <strong>{formatLongDate(quote.valid_until)}</strong>
              </div>
              <div className="quote-meta-row">
                <span>Status</span>
                <strong>{quote.status || "Draft"}</strong>
              </div>
            </div>
          </section>

          <section className="quote-info-table">
            <div className="quote-info-cell">
              <span className="quote-info-label">Prepared For</span>
              <div className="quote-info-value">
                {projectCompany || projectPerson}
              </div>
            </div>
            <div className="quote-info-cell">
              <span className="quote-info-label">Prepared By</span>
              <div className="quote-info-value">Metal Worx Inc.</div>
            </div>
            <div className="quote-info-cell">
              <span className="quote-info-label">Contact</span>
              <div className="quote-info-value">
                {[
                  projectPerson,
                  selectedProject?.contact_phone || quote.contact_phone,
                  quote.contact_email,
                ]
                  .filter(Boolean)
                  .join("\n")}
              </div>
            </div>
            <div className="quote-info-cell">
              <span className="quote-info-label">Metal Worx Contact</span>
              <div className="quote-info-value">
                {[quote.prepared_by, "(910) 438-9353", "info@metalworxinc.net"]
                  .filter(Boolean)
                  .join("\n")}
              </div>
            </div>
            <div className="quote-info-cell">
              <span className="quote-info-label">Project Location</span>
              <div className="quote-info-value">
                {projectLocation || "Not specified"}
              </div>
            </div>
            <div className="quote-info-cell">
              <span className="quote-info-label">Project Reference</span>
              <div className="quote-info-value">
                {selectedProject?.project_number || "Standalone Quote"}
              </div>
            </div>
          </section>

          <section className="quote-price-band">
            <div className="quote-price-label">ESTIMATED PROJECT PRICE</div>
            <div className="quote-price-value">{money(grandTotal)}</div>
          </section>
          <p className="quote-price-notes">
            {quote.price_notes ||
              "Final pricing is subject to the scope, selections, and terms stated in this quotation."}
          </p>

          <QuoteTextSection title="Scope of Work" value={quote.scope_of_work} />
          <QuoteTextSection
            title="Specifications"
            value={quote.specifications}
          />
          <QuoteTextSection
            title="Included Services"
            value={quote.included_services}
          />

          <footer className="quote-footer">
            METAL WORX INC. | CONFIDENTIAL CUSTOMER QUOTE | {quote.quote_number}
          </footer>
        </article>

        <article className="quote-page">
          <header className="quote-running-header">
            <img
              src={COMPANY_LOGO_URL}
              alt="Metal Worx Inc."
              className="quote-logo"
            />
            <div className="quote-company">
              METAL WORX INC.
              <br />
              CUSTOM FABRICATION
              <br />
              {quote.quote_number}
            </div>
          </header>

          <section className="quote-section">
            <h2>Price Breakdown</h2>
            <Table className="quote-table">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Description</Table.Th>
                  <Table.Th>Basis</Table.Th>
                  <Table.Th>Amount</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {pricingRows.map((row) => (
                  <Table.Tr key={row.id}>
                    <Table.Td>
                      <strong>{row.title}</strong>
                      {row.description && (
                        <div className="quote-line-description">
                          {row.description}
                        </div>
                      )}
                    </Table.Td>
                    <Table.Td>{row.basis}</Table.Td>
                    <Table.Td>
                      <strong>{money(row.amount)}</strong>
                    </Table.Td>
                  </Table.Tr>
                ))}
                {pricingRows.length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={3}>
                      Pricing line items have not been entered.
                    </Table.Td>
                  </Table.Tr>
                )}
                <Table.Tr className="quote-total-row">
                  <Table.Td colSpan={2}>Contract Subtotal</Table.Td>
                  <Table.Td>{money(contractSubtotal)}</Table.Td>
                </Table.Tr>
                <Table.Tr className="quote-total-row">
                  <Table.Td colSpan={2}>Sales Tax</Table.Td>
                  <Table.Td>{money(taxAmount)}</Table.Td>
                </Table.Tr>
                <Table.Tr className="quote-grand-row">
                  <Table.Td colSpan={2}>TOTAL ESTIMATED PRICE</Table.Td>
                  <Table.Td>{money(grandTotal)}</Table.Td>
                </Table.Tr>
              </Table.Tbody>
            </Table>
          </section>

          <QuoteTextSection
            title="Schedule and Work Conditions"
            value={quote.project_schedule}
          />

          {responsibilities.length > 0 && (
            <section className="quote-section">
              <h2>Customer Responsibilities</h2>
              <ul className="quote-list">
                {responsibilities.map((line, index) => (
                  <li key={`${line}-${index}`}>
                    {line.replace(/^[-•]\s*/, "")}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {optionalItems.filter((item) => !item.is_selected).length > 0 && (
            <section className="quote-section">
              <h2>Optional Add-Ons</h2>
              <Table className="quote-table">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Option</Table.Th>
                    <Table.Th>Description</Table.Th>
                    <Table.Th>Amount</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {optionalItems
                    .filter((item) => !item.is_selected)
                    .map((item) => (
                      <Table.Tr key={item.id}>
                        <Table.Td>{item.title}</Table.Td>
                        <Table.Td>{item.description || ""}</Table.Td>
                        <Table.Td>{money(item.line_total)}</Table.Td>
                      </Table.Tr>
                    ))}
                </Table.Tbody>
              </Table>
            </section>
          )}

          <footer className="quote-footer">
            METAL WORX INC. | CONFIDENTIAL CUSTOMER QUOTE | {quote.quote_number}
          </footer>
        </article>

        <article className="quote-page">
          <header className="quote-running-header">
            <img
              src={COMPANY_LOGO_URL}
              alt="Metal Worx Inc."
              className="quote-logo"
            />
            <div className="quote-company">
              METAL WORX INC.
              <br />
              CUSTOM FABRICATION
              <br />
              {quote.quote_number}
            </div>
          </header>

          {assumptions.length > 0 && (
            <section className="quote-section">
              <h2>Assumptions</h2>
              <ul className="quote-list">
                {assumptions.map((line, index) => (
                  <li key={`${line}-${index}`}>
                    {line.replace(/^[-•]\s*/, "")}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {exclusions.length > 0 && (
            <section className="quote-section">
              <h2>Exclusions and Change Conditions</h2>
              <ul className="quote-list">
                {exclusions.map((line, index) => (
                  <li key={`${line}-${index}`}>
                    {line.replace(/^[-•]\s*/, "")}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {quote.safety_technical_notice && (
            <section className="quote-section">
              <h2>Safety and Technical Notice</h2>
              <div className="quote-notice">
                <strong>IMPORTANT: </strong>
                {quote.safety_technical_notice}
              </div>
            </section>
          )}

          {quoteImages.length > 0 && (
            <section className="quote-section">
              <h2>Project Images and References</h2>
              <div className="quote-image-grid">
                {quoteImages.slice(0, 4).map((image) => (
                  <div className="quote-image-card" key={image.id}>
                    <img
                      src={image.image_url}
                      alt={image.caption || image.image_type || "Project image"}
                    />
                    <div className="quote-image-caption">
                      <strong>{image.image_type || "Project Image"}</strong>
                      {image.caption ? ` — ${image.caption}` : ""}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {!assumptions.length &&
            !exclusions.length &&
            !quote.safety_technical_notice &&
            !quoteImages.length && (
              <section className="quote-section">
                <h2>Project Conditions</h2>
                <div className="quote-text">
                  No additional assumptions, exclusions, technical notices, or
                  project images were entered for this quotation.
                </div>
              </section>
            )}

          <footer className="quote-footer">
            METAL WORX INC. | CONFIDENTIAL CUSTOMER QUOTE | {quote.quote_number}
          </footer>
        </article>

        <article className="quote-page">
          <header className="quote-running-header">
            <img
              src={COMPANY_LOGO_URL}
              alt="Metal Worx Inc."
              className="quote-logo"
            />
            <div className="quote-company">
              METAL WORX INC.
              <br />
              CUSTOM FABRICATION
              <br />
              {quote.quote_number}
            </div>
          </header>

          <section className="quote-section">
            <h2>Payment Terms</h2>
            <div className="quote-terms-grid">
              {quote.down_payment_terms && (
                <div className="quote-term-card">
                  <h3>Down Payment</h3>
                  <div>{quote.down_payment_terms}</div>
                </div>
              )}
              {quote.payment_terms && (
                <div className="quote-term-card">
                  <h3>Payment Schedule</h3>
                  <div>{quote.payment_terms}</div>
                </div>
              )}
              {quote.warranty_terms && (
                <div className="quote-term-card">
                  <h3>Warranty</h3>
                  <div>{quote.warranty_terms}</div>
                </div>
              )}
              {quote.disclaimer && (
                <div className="quote-term-card">
                  <h3>Additional Terms</h3>
                  <div>{quote.disclaimer}</div>
                </div>
              )}
            </div>
          </section>

          <section className="quote-section quote-acceptance">
            <h2>Acceptance</h2>
            <div className="quote-text">
              {quote.acceptance_terms ||
                "By signing below, the customer accepts this quote, including its scope, price, assumptions, exclusions, payment schedule, and stated terms. Work outside the approved scope requires customer authorization."}
            </div>

            <div className="quote-signatures">
              <div className="quote-signature">
                <h3>CUSTOMER AUTHORIZED SIGNATURE</h3>
                <div className="quote-signature-line">Signature</div>
                <div className="quote-signature-line">Printed Name</div>
                <div className="quote-signature-line">Date</div>
              </div>
              <div className="quote-signature">
                <h3>CONTRACTOR AUTHORIZED SIGNATURE</h3>
                <div className="quote-signature-line">Signature</div>
                <div className="quote-signature-line">Printed Name</div>
                <div className="quote-signature-line">Date</div>
              </div>
            </div>
          </section>

          <footer className="quote-footer">
            METAL WORX INC. | 1122 GILLESPIE ST. | FAYETTEVILLE, NC 28306 |
            (910) 438-9353 | {quote.quote_number}
          </footer>
        </article>
      </main>
    </>
  );
}

export default QuotePreview;
