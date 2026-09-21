import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, Group, Loader, Table, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import * as XLSX from "xlsx";
import {
  AlignmentType,
  BorderStyle,
  Document as WordDocument,
  Footer,
  Header,
  ImageRun,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table as WordTable,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

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

function safeFileName(value) {
  return String(value || "Metal-Worx-Quote")
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function imageUrlToDataUrl(url) {
  const response = await fetch(url);
  const blob = await response.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

const WORD_GRAY = "E7E7E7";
const WORD_BLACK = "111111";
const WORD_BORDERS = {
  top: { style: BorderStyle.SINGLE, size: 4, color: WORD_BLACK },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: WORD_BLACK },
  left: { style: BorderStyle.SINGLE, size: 4, color: WORD_BLACK },
  right: { style: BorderStyle.SINGLE, size: 4, color: WORD_BLACK },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: "777777" },
  insideVertical: { style: BorderStyle.SINGLE, size: 2, color: "777777" },
};

function wordRun(text, options = {}) {
  return new TextRun({
    text: String(text ?? ""),
    font: "Arial",
    size: 24,
    color: WORD_BLACK,
    ...options,
  });
}

function wordRuns(text, options = {}) {
  return String(text ?? "")
    .split("\n")
    .flatMap((line, index) => [
      ...(index ? [new TextRun({ break: 1 })] : []),
      wordRun(line, options),
    ]);
}

function wordParagraph(text, options = {}) {
  return new Paragraph({
    children: [wordRun(text, { bold: options.bold })],
    alignment: options.alignment,
    spacing: { after: options.after ?? 100, line: 276 },
    heading: options.heading,
    bullet: options.bullet,
  });
}

function wordCell(text, options = {}) {
  return new TableCell({
    shading: options.gray
      ? { fill: WORD_GRAY, type: ShadingType.CLEAR }
      : undefined,
    width: options.width
      ? { size: options.width, type: WidthType.PERCENTAGE }
      : undefined,
    margins: { top: 90, bottom: 90, left: 110, right: 110 },
    children: [
      new Paragraph({
        children: wordRuns(text, { bold: options.bold, color: options.color || WORD_BLACK }),
        alignment: options.alignment,
        spacing: { after: 0, line: 276 },
      }),
    ],
  });
}

function wordHeading(title) {
  return new Paragraph({
    children: [wordRun(title, { bold: true, size: 28 })],
    spacing: { before: 180, after: 100 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: WORD_BLACK } },
  });
}

function wordTextBlock(value) {
  return splitLines(value).map((line) => wordParagraph(line.replace(/^[-•]\s*/, ""), { after: 70 }));
}

function wordCenteredTextBlock(value) {
  return splitLines(value).map((line) => wordParagraph(line.replace(/^[-•]\s*/, ""), {
    after: 70,
    alignment: AlignmentType.CENTER,
  }));
}

function wordBulletBlock(value) {
  return splitLines(value).map((line) =>
    wordParagraph(line.replace(/^[-•]\s*/, ""), {
      bullet: { level: 0 },
      after: 50,
    })
  );
}

function QuoteTextSection({ title, value, className = "" }) {
  if (!String(value || "").trim()) return null;
  return (
    <section className={`quote-section quote-text-section ${className}`.trim()}>
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
  const taxTreatment = quote?.tax_treatment || "included";
  const taxAmount = taxTreatment === "included"
    ? contractSubtotal * Number(quote?.tax_rate || 0)
    : 0;
  const calculatedTotal = contractSubtotal + taxAmount;
  const grandTotal =
    calculatedTotal > 0 ? calculatedTotal : Number(quote?.total_amount || 0);
  const taxLabel = taxTreatment === "plus" ? "Taxes & Fees" : "Sales Tax";
  const taxDisplay = taxTreatment === "plus"
    ? "Plus applicable"
    : taxTreatment === "exempt"
      ? "Tax exempt"
      : money(taxAmount);
  const taxNotice = taxTreatment === "plus"
    ? "Applicable taxes and payment-processing fees are not included in the estimated project price and will be added when invoiced."
    : taxTreatment === "exempt"
      ? "This quote is marked tax exempt. Tax-exemption documentation may be required."
      : "";

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
  const projectLocation =
    quote?.job_site_address ||
    [
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

  const travelSummary =
    Number(quote?.travel_round_trip_miles || 0) > 0
      ? `${Number(quote.travel_round_trip_miles).toLocaleString("en-US")} round-trip miles from Metal Worx`
      : "";

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

  async function exportWord() {
    try {
      const logoBytes = await fetch(COMPANY_LOGO_URL).then((response) =>
        response.arrayBuffer()
      );
      const header = new Header({
        children: [
          new WordTable({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              ...WORD_BORDERS,
              top: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
              insideHorizontal: { style: BorderStyle.NONE },
              insideVertical: { style: BorderStyle.NONE },
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 36, type: WidthType.PERCENTAGE },
                    children: [
                      new Paragraph({
                        children: [
                          new ImageRun({
                            data: logoBytes,
                            transformation: { width: 175, height: 58 },
                            type: "png",
                          }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    width: { size: 64, type: WidthType.PERCENTAGE },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.RIGHT,
                        spacing: { after: 0 },
                        children: [
                          ...wordRuns(
                            "METAL WORX INC.\n1122 Gillespie St. | Fayetteville, NC 28306\n(910) 438-9353 | info@metalworxinc.net\nwww.metalworxinc.net | Veteran Owned",
                            { bold: true }
                          ),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      });
      const footer = new Footer({
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              wordRun("METAL WORX INC. | Veteran Owned | American Made | Page "),
              new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 24 }),
            ],
          }),
        ],
      });
      const sectionProperties = {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 850, right: 720, bottom: 720, left: 720 },
        },
      };
      const metadataTable = new WordTable({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: WORD_BORDERS,
        rows: [
          new TableRow({ children: [wordCell("Quote No.", { gray: true, bold: true, width: 18 }), wordCell(quote.quote_number || "Not set", { width: 32 }), wordCell("Date", { gray: true, bold: true, width: 18 }), wordCell(formatLongDate(quoteDate), { width: 32 })] }),
          new TableRow({ children: [wordCell("Prepared For", { gray: true, bold: true }), wordCell(projectCompany || projectPerson), wordCell("Prepared By", { gray: true, bold: true }), wordCell(quote.prepared_by || "Metal Worx Inc.") ] }),
          new TableRow({ children: [wordCell("Project", { gray: true, bold: true }), wordCell(projectItem), wordCell("Location", { gray: true, bold: true }), wordCell(projectLocation || "Not specified") ] }),
          new TableRow({ children: [wordCell("Valid Through", { gray: true, bold: true }), wordCell(formatLongDate(quote.valid_until)), wordCell("Schedule", { gray: true, bold: true }), wordCell(quote.project_schedule || "To be scheduled") ] }),
          ...(travelSummary
            ? [new TableRow({ children: [wordCell("Travel", { gray: true, bold: true }), wordCell(travelSummary), wordCell("Route Origin", { gray: true, bold: true }), wordCell("1122 Gillespie Street, Fayetteville, NC 28306") ] })]
            : []),
        ],
      });
      const pricingTable = new WordTable({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: WORD_BORDERS,
        rows: [
          new TableRow({
            children: [
              wordCell("Description", { bold: true, gray: true, width: 55 }),
              wordCell("Basis", { bold: true, gray: true, width: 25 }),
              wordCell("Amount", { bold: true, gray: true, width: 20 }),
            ],
          }),
          ...pricingRows.map((row) =>
            new TableRow({
              children: [
                wordCell([row.title, row.description].filter(Boolean).join(" — ")),
                wordCell(row.basis),
                wordCell(money(row.amount), { alignment: AlignmentType.RIGHT }),
              ],
            })
          ),
          new TableRow({ children: [wordCell("Contract Subtotal", { bold: true, gray: true }), wordCell(""), wordCell(money(contractSubtotal), { bold: true, gray: true, alignment: AlignmentType.RIGHT })] }),
          new TableRow({ children: [wordCell(taxLabel, { bold: true, gray: true }), wordCell(""), wordCell(taxDisplay, { bold: true, gray: true, alignment: AlignmentType.RIGHT })] }),
          new TableRow({ children: [wordCell("TOTAL ESTIMATED PRICE", { bold: true }), wordCell(""), wordCell(money(grandTotal), { bold: true, alignment: AlignmentType.RIGHT })] }),
        ],
      });
      const wordImageCards = [];
      for (const image of quoteImages.slice(0, 4)) {
        try {
          const response = await fetch(image.image_url);
          if (!response.ok) throw new Error("Image could not be downloaded");
          const blob = await response.blob();
          const bytes = await blob.arrayBuffer();
          const dimensions = await new Promise((resolve) => {
            const preview = new Image();
            preview.onload = () => resolve({
              width: preview.naturalWidth || 1,
              height: preview.naturalHeight || 1,
            });
            preview.onerror = () => resolve({ width: 4, height: 3 });
            preview.src = image.image_url;
          });
          const scale = Math.min(255 / dimensions.width, 170 / dimensions.height);
          wordImageCards.push({
            image,
            bytes,
            type: blob.type.includes("png") ? "png" : "jpg",
            width: Math.max(1, Math.round(dimensions.width * scale)),
            height: Math.max(1, Math.round(dimensions.height * scale)),
          });
        } catch (imageError) {
          console.warn("Quote image was skipped during Word export:", imageError);
        }
      }

      const wordImageTable = wordImageCards.length
        ? new WordTable({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: WORD_BORDERS,
            rows: Array.from(
              { length: Math.ceil(wordImageCards.length / 2) },
              (_, rowIndex) =>
                new TableRow({
                  children: [0, 1].map((columnIndex) => {
                    const card = wordImageCards[rowIndex * 2 + columnIndex];
                    return new TableCell({
                      width: { size: 50, type: WidthType.PERCENTAGE },
                      children: card
                        ? [
                            new Paragraph({
                              alignment: AlignmentType.CENTER,
                              spacing: { after: 80 },
                              children: [
                                new ImageRun({
                                  data: card.bytes,
                                  transformation: { width: card.width, height: card.height },
                                  type: card.type,
                                }),
                              ],
                            }),
                            new Paragraph({
                              alignment: AlignmentType.CENTER,
                              children: [
                                wordRun(
                                  [card.image.image_type || "Project Image", card.image.caption]
                                    .filter(Boolean)
                                    .join(" — "),
                                  { bold: true, size: 20 },
                                ),
                              ],
                            }),
                          ]
                        : [new Paragraph("")],
                    });
                  }),
                }),
            ),
          })
        : null;

      const signatureTable = new WordTable({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: WORD_BORDERS,
        rows: [
          new TableRow({ children: [wordCell("CUSTOMER AUTHORIZED SIGNATURE", { gray: true, bold: true }), wordCell("CONTRACTOR AUTHORIZED SIGNATURE", { gray: true, bold: true })] }),
          new TableRow({
            height: { value: 1900 },
            children: [
              wordCell("\n\nSignature: ______________________________\nPrinted Name: ___________________________\nDate: __________________________________"),
              wordCell("\n\nSignature: ______________________________\nPrinted Name: ___________________________\nDate: __________________________________"),
            ],
          }),
        ],
      });

      const wordDocument = new WordDocument({
        styles: {
          default: {
            document: { run: { font: "Arial", size: 24, color: WORD_BLACK } },
          },
        },
        sections: [
          {
            properties: sectionProperties,
            headers: { default: header },
            footers: { default: footer },
            children: [
              new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 70 }, children: [wordRun("PROJECT QUOTATION", { bold: true, size: 30 })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 180 }, children: [wordRun(projectItem, { bold: true, size: 28 })] }),
              metadataTable,
              wordHeading("Project Summary"),
              ...wordTextBlock(quote.scope_of_work || "Project scope to be confirmed."),
              ...(quote.specifications ? [wordHeading("Specifications"), ...wordTextBlock(quote.specifications)] : []),
              ...(quote.included_services ? [wordHeading("Included Services"), ...wordTextBlock(quote.included_services)] : []),
            ],
          },
          {
            properties: sectionProperties,
            headers: { default: header },
            footers: { default: footer },
            children: [
              wordHeading("Pricing"),
              pricingTable,
              ...(taxNotice ? wordCenteredTextBlock(taxNotice) : []),
              ...(quote.price_notes ? [wordHeading("Remarks"), ...wordTextBlock(quote.price_notes)] : []),
              ...(quote.project_schedule ? [wordHeading("Process / Work Sequence"), ...wordTextBlock(quote.project_schedule)] : []),
              ...(quote.customer_responsibilities ? [wordHeading("Customer Responsibilities"), ...wordBulletBlock(quote.customer_responsibilities)] : []),
            ],
          },
          {
            properties: sectionProperties,
            headers: { default: header },
            footers: { default: footer },
            children: [
              ...(wordImageTable ? [wordHeading("Project Images and References"), wordImageTable] : []),
              ...(quote.assumptions ? [wordHeading("Assumptions"), ...wordBulletBlock(quote.assumptions)] : []),
              ...(quote.exclusions ? [wordHeading("Exclusions and Change Conditions"), ...wordBulletBlock(quote.exclusions)] : []),
              ...(quote.safety_technical_notice ? [wordHeading("Safety and Technical Notice"), ...wordTextBlock(quote.safety_technical_notice)] : []),
              wordHeading("Payment Terms"),
              ...wordCenteredTextBlock([quote.down_payment_terms, quote.payment_terms, quote.warranty_terms, quote.disclaimer].filter(Boolean).join("\n")),
              wordHeading("Acceptance"),
              ...wordTextBlock(quote.acceptance_terms || "By signing below, the customer accepts this quotation, its scope, price, and stated terms."),
              signatureTable,
            ],
          },
        ],
      });
      const blob = await Packer.toBlob(wordDocument);
      downloadBlob(blob, `${safeFileName(quote.quote_number || projectItem)}.docx`);
    } catch (error) {
      notifications.show({
        title: "Word Export Failed",
        message: error.message || "Unable to create the Word quote.",
        color: "red",
      });
    }
  }

  function exportExcel() {
    const workbook = XLSX.utils.book_new();
    const summaryRows = [
      ["METAL WORX INC.", ""],
      ["PROJECT QUOTATION", projectItem],
      ["Quote Number", quote.quote_number || ""],
      ["Quote Date", formatLongDate(quoteDate)],
      ["Valid Through", formatLongDate(quote.valid_until)],
      ["Prepared For", projectCompany || projectPerson],
      ["Contact", projectPerson],
      ["Project Location", projectLocation || ""],
      ["Round-Trip Mileage", Number(quote.travel_round_trip_miles || 0)],
      ["Mileage Rate", Number(quote.travel_rate_per_mile || 0)],
      ["Project Reference", selectedProject?.project_number || "Standalone Quote"],
      ["Estimated Total", grandTotal],
      [],
      ["Project Summary", quote.scope_of_work || ""],
      ["Specifications", quote.specifications || ""],
      ["Included Services", quote.included_services || ""],
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
    summarySheet["!cols"] = [{ wch: 24 }, { wch: 90 }];
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Quote Summary");

    const pricingSheet = XLSX.utils.json_to_sheet(
      pricingRows.map((row) => ({
        Description: row.title,
        Details: row.description,
        Basis: row.basis,
        Amount: row.amount,
      })),
    );
    XLSX.utils.sheet_add_aoa(
      pricingSheet,
      [
        ["Contract Subtotal", contractSubtotal],
        [taxLabel, taxTreatment === "included" ? taxAmount : taxDisplay],
        ["Total Estimated Price", grandTotal],
      ],
      { origin: -1 },
    );
    pricingSheet["!cols"] = [
      { wch: 34 },
      { wch: 70 },
      { wch: 22 },
      { wch: 18 },
    ];
    XLSX.utils.book_append_sheet(workbook, pricingSheet, "Pricing");

    const termsSheet = XLSX.utils.aoa_to_sheet([
      ["Section", "Details"],
      ["Schedule", quote.project_schedule || ""],
      ["Customer Responsibilities", quote.customer_responsibilities || ""],
      ["Assumptions", quote.assumptions || ""],
      ["Exclusions / Changes", quote.exclusions || ""],
      ["Down Payment", quote.down_payment_terms || ""],
      ["Payment Terms", quote.payment_terms || ""],
      ["Warranty", quote.warranty_terms || ""],
      ["Additional Terms", quote.disclaimer || ""],
      ["Acceptance", quote.acceptance_terms || ""],
    ]);
    termsSheet["!cols"] = [{ wch: 30 }, { wch: 100 }];
    XLSX.utils.book_append_sheet(workbook, termsSheet, "Terms");
    XLSX.writeFile(workbook, `${safeFileName(quote.quote_number || projectItem)}.xlsx`);
  }

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
      <style data-metal-worx-quote>{`
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
          font-size: 12pt;
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
          border-bottom: 1px solid #111;
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
          display: block;
          border: 0;
          margin-bottom: 20px;
        }

        .quote-title-block {
          background: #fff;
          color: #111;
          padding: 10px 22px 14px;
          text-align: center;
        }

        .quote-title-block .eyebrow {
          color: #111 !important;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: .16em;
          text-transform: uppercase;
        }

        .quote-title-block h1 {
          margin: 7px 0 4px;
          color: #111 !important;
          font-size: 24px;
          line-height: 1.06;
          text-transform: uppercase;
        }

        .quote-title-block p {
          margin: 0;
          color: #111 !important;
          font-size: 15px;
        }

        .quote-meta {
          display: none;
          background: #e7e7e7;
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
          color: #111;
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
          background: #e7e7e7;
        }

        .quote-info-label {
          display: block;
          margin-bottom: 5px;
          color: #111;
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
          background: #e7e7e7;
          color: #111;
          padding: 14px 16px;
          font-weight: 900;
          letter-spacing: .06em;
        }

        .quote-price-value {
          background: #e7e7e7;
          color: #111;
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

        .quote-tax-notice {
          margin: 8px 0 16px;
          padding: 8px 12px;
          border-left: 3px solid #9c000f;
          color: #333;
          background: #f2f2f2;
          font-size: 11px;
          font-weight: 700;
          line-height: 1.4;
          text-align: center;
        }

        .quote-section {
          margin-top: 19px;
          display: flow-root;
          clear: both;
        }

        .quote-section h2 {
          margin: 0 0 10px;
          padding-bottom: 7px;
          border-bottom: 1px solid #111;
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

        .quote-table thead {
          display: table-header-group;
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
          background: #e7e7e7;
        }

        .quote-line-description {
          margin-top: 3px;
          color: #606b75;
          font-size: 11px;
          line-height: 1.35;
          white-space: pre-wrap;
        }

        .quote-total-row td {
          background: #e7e7e7 !important;
          color: #111;
          font-weight: 900;
        }

        .quote-grand-row td {
          background: #111 !important;
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

        .quote-terms-list {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          margin: 12px auto 0;
          text-align: center;
        }

        .quote-term-block {
          width: 100%;
          padding: 0 20px;
        }

        .quote-term-block h3 {
          margin: 0 0 5px;
          font-size: 13px;
          text-transform: uppercase;
        }

        .quote-term-block div {
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
          background: #e7e7e7;
          color: #111;
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
          .quote-terms-list,
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
            margin: .3in .42in .48in;
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
            width: auto;
            min-height: 0;
            height: auto;
            padding: 0;
            border-bottom: 0;
            page-break-after: auto;
            break-after: auto;
            overflow: visible;
          }

          .quote-running-header {
            margin-bottom: 11px;
            padding-bottom: 8px;
          }

          .quote-title-grid,
          .quote-info-table {
            margin-bottom: 11px;
          }

          .quote-title-block {
            padding: 6px 18px 9px;
          }

          .quote-title-block h1 {
            margin: 4px 0 2px;
            font-size: 21px;
          }

          .quote-info-cell {
            min-height: 48px;
            padding: 7px 10px;
          }

          .quote-info-label {
            margin-bottom: 2px;
          }

          .quote-info-value {
            font-size: 11px;
            line-height: 1.18;
          }

          .quote-price-band {
            margin: 10px 0 4px;
          }

          .quote-price-label,
          .quote-price-value {
            padding: 8px 12px;
          }

          .quote-price-value {
            font-size: 21px;
          }

          .quote-price-notes {
            margin-bottom: 9px;
          }

          .quote-section {
            margin-top: 12px;
            padding-top: 1px;
            display: flow-root;
            clear: both;
            overflow: visible;
          }

          .quote-section h2 {
            margin-bottom: 6px;
            padding-bottom: 4px;
            font-size: 16px;
            break-after: avoid-page;
            page-break-after: avoid;
          }

          .quote-text,
          .quote-list {
            font-size: 11px;
            line-height: 1.33;
          }

          .quote-text {
            orphans: 3;
            widows: 3;
          }

          .quote-text-section {
            break-inside: avoid-page;
            page-break-inside: avoid;
          }

          .quote-section > h2 + .quote-table,
          .quote-section > h2 + .quote-text,
          .quote-section > h2 + .quote-list,
          .quote-section > h2 + .quote-terms-list {
            break-before: avoid-page;
            page-break-before: avoid;
          }

          .quote-list li {
            margin: 2px 0;
          }

          .quote-table {
            font-size: 10px;
          }

          .quote-table th,
          .quote-table td {
            padding: 6px 7px !important;
          }

          .quote-table tr,
          .quote-price-band,
          .quote-info-table,
          .quote-term-block,
          .quote-image-card,
          .quote-signatures {
            break-inside: avoid-page;
            page-break-inside: avoid;
          }

          .quote-image-grid {
            gap: 8px;
            margin-top: 7px;
          }

          .quote-image-card img {
            height: 145px;
          }

          .quote-terms-list {
            gap: 8px;
            margin-top: 7px;
          }

          .quote-term-block {
            padding: 0 8px;
          }

          .quote-term-block h3 {
            margin-bottom: 4px;
            font-size: 11px;
          }

          .quote-term-block div {
            font-size: 10px;
            line-height: 1.3;
          }

          .quote-acceptance {
            break-inside: avoid-page;
            page-break-inside: avoid;
          }

          .quote-signature {
            min-height: 112px;
            padding: 8px;
          }

          .quote-signature h3 {
            margin: -8px -8px 34px;
            padding: 7px 8px;
          }

          .quote-signature-line {
            margin-top: 15px;
          }

          .quote-footer {
            position: static;
            margin-top: 18px;
            padding-top: 6px;
            border-top: 1px solid #aaa;
            break-inside: avoid-page;
            page-break-inside: avoid;
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
            <Button variant="light" color="gray" onClick={exportWord}>
              Export Word
            </Button>
            <Button variant="light" color="green" onClick={exportExcel}>
              Export Excel
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
              1122 Gillespie St. | Fayetteville, NC 28306
              <br />
              (910) 438-9353 | info@metalworxinc.net
              <br />
              www.metalworxinc.net | Veteran Owned
            </div>
          </header>

          <section className="quote-title-grid">
            <div className="quote-title-block">
              <div className="eyebrow">PROJECT QUOTATION</div>
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
          {taxNotice && <div className="quote-tax-notice">{taxNotice}</div>}

          <QuoteTextSection title="Scope of Work" value={quote.scope_of_work} />
          <QuoteTextSection
            title="Specifications"
            value={quote.specifications}
          />
          <QuoteTextSection
            title="Included Services"
            value={quote.included_services}
          />

          <section className="quote-section quote-pricing-section">
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
                  <Table.Td colSpan={2}>{taxLabel}</Table.Td>
                  <Table.Td>{taxDisplay}</Table.Td>
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

          <section className="quote-section">
            <h2>Payment Terms</h2>
            <div className="quote-terms-list">
              {quote.down_payment_terms && (
                <div className="quote-term-block">
                  <h3>Down Payment</h3>
                  <div>{quote.down_payment_terms}</div>
                </div>
              )}
              {quote.payment_terms && (
                <div className="quote-term-block">
                  <h3>Payment Schedule</h3>
                  <div>{quote.payment_terms}</div>
                </div>
              )}
              {quote.warranty_terms && (
                <div className="quote-term-block">
                  <h3>Warranty</h3>
                  <div>{quote.warranty_terms}</div>
                </div>
              )}
              {quote.disclaimer && (
                <div className="quote-term-block">
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
            METAL WORX INC. | Veteran Owned | American Made
          </footer>
        </article>
      </main>
    </>
  );
}

export default QuotePreview;
