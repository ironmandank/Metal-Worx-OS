import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const PAGE = { width: 612, height: 792, left: 42, right: 42, top: 94, bottom: 54 };
const COLORS = { black: [22, 24, 27], gray: [232, 232, 232], red: [156, 0, 15], text: [28, 31, 35] };

function safeName(value) {
  return String(value || "Metal-Worx-Quote")
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/^-+|-+$/g, "") || "Metal-Worx-Quote";
}

function asLines(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-•]\s*/, "").trim())
    .filter(Boolean);
}

function money(value) {
  return Number(value || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

async function urlToDataUrl(url) {
  if (String(url || "").startsWith("data:")) return url;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Image could not be loaded (${response.status}).`);
  const blob = await response.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function imageFormat(dataUrl) {
  if (String(dataUrl).startsWith("data:image/jpeg")) return "JPEG";
  if (String(dataUrl).startsWith("data:image/webp")) return "WEBP";
  return "PNG";
}

export async function buildQuotePdf(model) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter", compress: true });
  const contentWidth = PAGE.width - PAGE.left - PAGE.right;
  let y = PAGE.top;

  const ensureSpace = (needed = 70) => {
    if (y + needed <= PAGE.height - PAGE.bottom) return;
    doc.addPage();
    y = PAGE.top;
  };

  const heading = (title) => {
    ensureSpace(42);
    doc.setFillColor(...COLORS.red);
    doc.rect(PAGE.left, y + 1, 4, 14, "F");
    doc.setTextColor(...COLORS.black);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(String(title).toUpperCase(), PAGE.left + 11, y + 12);
    doc.setDrawColor(90, 90, 90);
    doc.setLineWidth(0.55);
    doc.line(PAGE.left, y + 20, PAGE.width - PAGE.right, y + 20);
    y += 30;
  };

  const paragraph = (value, options = {}) => {
    const text = String(value || "").trim();
    if (!text) return;
    doc.setFont("helvetica", options.bold ? "bold" : "normal");
    doc.setFontSize(options.size || 9.5);
    doc.setTextColor(...COLORS.text);
    const lines = doc.splitTextToSize(text, options.width || contentWidth);
    const lineHeight = options.lineHeight || 13;
    for (const line of lines) {
      ensureSpace(lineHeight + 3);
      doc.text(line, options.x || PAGE.left, y);
      y += lineHeight;
    }
    y += options.after ?? 7;
  };

  const paragraphSection = (title, value, options = {}) => {
    const text = String(value || "").trim();
    if (!text) return;
    const lineHeight = options.lineHeight || 13;
    const lines = doc.splitTextToSize(text, options.width || contentWidth);
    // A short narrative section should stay together. If it cannot fit on the
    // current page, start it on the next page rather than leaving a heading or
    // a single trailing line by itself.
    const sectionHeight = 30 + lines.length * lineHeight + (options.after ?? 7);
    if (sectionHeight <= PAGE.height - PAGE.top - PAGE.bottom) ensureSpace(sectionHeight);
    heading(title);
    paragraph(text, options);
  };

  const bullets = (value) => {
    for (const line of asLines(value)) {
      const wrapped = doc.splitTextToSize(line, contentWidth - 18);
      ensureSpace(wrapped.length * 13 + 7);
      doc.setFillColor(...COLORS.red);
      doc.circle(PAGE.left + 3, y - 3, 1.8, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(...COLORS.text);
      doc.text(wrapped, PAGE.left + 13, y);
      y += wrapped.length * 13 + 6;
    }
  };

  const table = (options) => {
    autoTable(doc, {
      margin: { left: PAGE.left, right: PAGE.right, top: PAGE.top, bottom: PAGE.bottom },
      startY: y,
      theme: "grid",
      styles: { font: "helvetica", fontSize: 9, cellPadding: 5, lineColor: [120, 120, 120], lineWidth: 0.45, textColor: COLORS.text, overflow: "linebreak", valign: "top" },
      headStyles: { fillColor: COLORS.black, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8.5, cellPadding: 5 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      ...options,
    });
    y = doc.lastAutoTable.finalY + 13;
  };

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.black);
  doc.setFontSize(8.5);
  doc.text("PROJECT QUOTATION", PAGE.width / 2, y, { align: "center" });
  y += 18;
  doc.setFontSize(17);
  doc.text(String(model.projectItem || "Custom Fabrication Project"), PAGE.width / 2, y, { align: "center", maxWidth: contentWidth });
  y += 17;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text(String(model.quoteType || "Custom Metal Fabrication"), PAGE.width / 2, y, { align: "center" });
  y += 18;

  const metaRows = [
    ["Quote No.", model.quoteNumber || "Not set", "Date", model.quoteDate || "Not set"],
    ["Prepared For", model.preparedFor || "Customer", "Prepared By", model.preparedBy || "Metal Worx Inc."],
    ["Project", model.projectItem || "Not specified", "Location", model.projectLocation || "Not specified"],
    ["Valid Through", model.validThrough || "Not set", "Status", model.status || "Draft"],
  ];
  if (model.contact) metaRows.push(["Customer Contact", model.contact, "Metal Worx Contact", "(910) 438-9353\ninfo@metalworxinc.net"]);
  table({
    head: [],
    body: metaRows,
    columnStyles: {
      0: { cellWidth: 72, fontStyle: "bold", fillColor: COLORS.gray },
      1: { cellWidth: 192 },
      2: { cellWidth: 76, fontStyle: "bold", fillColor: COLORS.gray },
      3: { cellWidth: 188 },
    },
  });

  paragraphSection("Project Summary", model.scopeOfWork || "Project scope will be completed as stated in the approved quotation.");

  const scopeRows = [
    ["Scope of Work", model.scopeOfWork],
    ["Specifications", model.specifications],
    ["Included Services", model.includedServices],
  ].filter((row) => String(row[1] || "").trim());
  if (scopeRows.length) {
    heading("Scope of Work");
    table({
      head: [["Item", "Description"]],
      body: scopeRows,
      columnStyles: { 0: { cellWidth: 118, fontStyle: "bold", fillColor: COLORS.gray }, 1: { cellWidth: contentWidth - 118 } },
    });
  }

  const pricingBody = (model.pricingRows || []).map((row) => [
    row.title || "Quoted Work",
    row.description || "",
    row.basis || "",
    money(row.amount),
  ]);
  pricingBody.push(["", "", "Contract Subtotal", money(model.contractSubtotal)]);
  pricingBody.push(["", "", model.taxLabel || "Sales Tax", model.taxDisplay || money(model.taxAmount)]);
  pricingBody.push(["", "", "PROJECT TOTAL", money(model.grandTotal)]);
  // Keep the pricing heading with the table header and at least the first row,
  // but let the table use the remaining page before continuing on the next one.
  // Reserving the entire estimated table height created large blank areas when
  // the full section would not fit even though several rows could.
  ensureSpace(92);
  heading("Pricing");
  table({
    head: [["Item", "Description", "Basis", "Amount"]],
    body: pricingBody,
    rowPageBreak: "avoid",
    showHead: "everyPage",
    columnStyles: { 0: { cellWidth: 118, fontStyle: "bold" }, 1: { cellWidth: 220 }, 2: { cellWidth: 104 }, 3: { cellWidth: 86, halign: "right", fontStyle: "bold" } },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const label = String(data.row.raw?.[2] || "");
      if (["Contract Subtotal", model.taxLabel || "Sales Tax"].includes(label)) data.cell.styles.fillColor = COLORS.gray;
      if (label === "PROJECT TOTAL") {
        data.cell.styles.fillColor = COLORS.black;
        data.cell.styles.textColor = [255, 255, 255];
        data.cell.styles.fontStyle = "bold";
      }
    },
  });
  if (model.taxNotice) paragraph(model.taxNotice, { size: 8.5, after: 4 });
  if (model.priceNotes) paragraph(model.priceNotes, { size: 8.5, after: 4 });

  if (model.schedule) {
    paragraphSection("Schedule and Work Conditions", model.schedule);
  }
  if (model.customerResponsibilities) {
    heading("Customer Responsibilities");
    bullets(model.customerResponsibilities);
  }
  if (model.assumptions) {
    heading("Assumptions");
    bullets(model.assumptions);
  }
  if (model.exclusions) {
    heading("Exclusions and Change Conditions");
    bullets(model.exclusions);
  }
  if (model.safetyNotice) {
    paragraphSection("Safety and Technical Notice", model.safetyNotice);
  }

  const terms = [
    ["Down Payment", model.downPaymentTerms],
    ["Payment Schedule", model.paymentTerms],
    ["Warranty", model.warrantyTerms],
    ["Additional Terms", model.disclaimer],
  ].filter((row) => String(row[1] || "").trim());
  if (terms.length) {
    heading("Payment Terms");
    table({
      head: [["Term", "Details"]],
      body: terms,
      columnStyles: { 0: { cellWidth: 122, fontStyle: "bold", fillColor: COLORS.gray }, 1: { cellWidth: contentWidth - 122 } },
    });
  }

  const images = (model.images || []).slice(0, 4);
  if (images.length) {
    heading("Project Images and References");
    const cardWidth = (contentWidth - 12) / 2;
    const cardHeight = 164;
    for (let index = 0; index < images.length; index += 1) {
      if (index % 2 === 0) ensureSpace(cardHeight + 18);
      const image = images[index];
      const x = PAGE.left + (index % 2) * (cardWidth + 12);
      try {
        const dataUrl = await urlToDataUrl(image.image_url);
        doc.setDrawColor(150, 150, 150);
        doc.rect(x, y, cardWidth, cardHeight);
        doc.addImage(dataUrl, imageFormat(dataUrl), x + 6, y + 6, cardWidth - 12, 130, undefined, "FAST");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...COLORS.text);
        doc.text(String(image.caption || image.image_type || "Project Image"), x + 6, y + 149, { maxWidth: cardWidth - 12 });
      } catch {
        doc.setDrawColor(150, 150, 150);
        doc.rect(x, y, cardWidth, cardHeight);
        doc.setFontSize(8);
        doc.text("Image could not be embedded.", x + 8, y + 20);
      }
      if (index % 2 === 1 || index === images.length - 1) y += cardHeight + 12;
    }
  }

  ensureSpace(180);
  heading("Acceptance");
  paragraph(model.acceptanceTerms || "By signing below, the customer accepts this quotation, including its scope, pricing, assumptions, exclusions, payment schedule, and stated terms.");
  ensureSpace(145);
  doc.setDrawColor(70, 70, 70);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const half = (contentWidth - 20) / 2;
  doc.line(PAGE.left, y + 28, PAGE.left + half, y + 28);
  doc.line(PAGE.left + half + 20, y + 28, PAGE.width - PAGE.right, y + 28);
  doc.text("Customer Authorized Signature", PAGE.left, y + 41);
  doc.text("Date", PAGE.left + half + 20, y + 41);
  doc.line(PAGE.left, y + 74, PAGE.left + half, y + 74);
  doc.line(PAGE.left + half + 20, y + 74, PAGE.width - PAGE.right, y + 74);
  doc.text("Printed Name / Title", PAGE.left, y + 87);
  doc.text("Purchase Order No.", PAGE.left + half + 20, y + 87);
  doc.line(PAGE.left, y + 120, PAGE.left + half, y + 120);
  doc.line(PAGE.left + half + 20, y + 120, PAGE.width - PAGE.right, y + 120);
  doc.text("Metal Worx Inc. Representative", PAGE.left, y + 133);
  doc.text("Date", PAGE.left + half + 20, y + 133);
  y += 146;

  let logoData = null;
  try { logoData = model.logoUrl ? await urlToDataUrl(model.logoUrl) : null; } catch { logoData = null; }
  const pageCount = doc.getNumberOfPages();
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    doc.setPage(pageNumber);
    if (logoData) doc.addImage(logoData, imageFormat(logoData), PAGE.left, 24, 142, 42, undefined, "FAST");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.2);
    doc.setTextColor(...COLORS.black);
    doc.text("METAL WORX INC.", PAGE.width - PAGE.right, 28, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text("1122 Gillespie St. | Fayetteville, NC 28306", PAGE.width - PAGE.right, 40, { align: "right" });
    doc.text("(910) 438-9353 | info@metalworxinc.net", PAGE.width - PAGE.right, 51, { align: "right" });
    doc.text("www.metalworxinc.net | Veteran Owned", PAGE.width - PAGE.right, 62, { align: "right" });
    doc.setDrawColor(70, 70, 70);
    doc.line(PAGE.left, 74, PAGE.width - PAGE.right, 74);
    doc.line(PAGE.left, PAGE.height - 35, PAGE.width - PAGE.right, PAGE.height - 35);
    doc.setFontSize(7.3);
    doc.text("METAL WORX INC. | Veteran Owned | American Made", PAGE.left, PAGE.height - 22);
    doc.text(`Page ${pageNumber} of ${pageCount}`, PAGE.width - PAGE.right, PAGE.height - 22, { align: "right" });
  }

  return doc;
}

export async function downloadQuotePdf(model) {
  const doc = await buildQuotePdf(model);
  doc.save(`${safeName(model.quoteNumber || model.projectItem)}.pdf`);
}
