import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function money(value) {
  return Number(value || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function dateTime(value) {
  if (!value) return "Not recorded";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" });
}

function safeName(value) {
  return String(value || "signed-quote").replace(/[^a-z0-9_-]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function addWrappedText(doc, title, value, y) {
  if (!String(value || "").trim()) return y;
  if (y > 245) { doc.addPage(); y = 20; }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(title, 16, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  const lines = doc.splitTextToSize(String(value), 178);
  for (const line of lines) {
    if (y > 276) { doc.addPage(); y = 20; }
    doc.text(line, 16, y);
    y += 4.5;
  }
  return y + 4;
}

export function downloadSignedApprovalPdf(approval) {
  const snapshot = approval.document_snapshot || {};
  const quote = snapshot.quote || {};
  const items = snapshot.items || [];
  const doc = new jsPDF({ unit: "mm", format: "letter" });

  doc.setFillColor(185, 0, 20);
  doc.rect(0, 0, 216, 12, "F");
  doc.setFont("helvetica", "bold");
  doc.setTextColor(25, 25, 25);
  doc.setFontSize(20);
  doc.text("METAL WORX INC.", 16, 25);
  doc.setFontSize(13);
  doc.text("SIGNED CUSTOMER QUOTE APPROVAL", 16, 33);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("1122 Gillespie Street | Fayetteville, NC 28306 | (910) 438-9353 | info@metalworxinc.net", 16, 39);

  autoTable(doc, {
    startY: 46,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: [35, 39, 44], textColor: 255 },
    head: [["Quote", "Customer", "Project", "Approved Total"]],
    body: [[quote.quote_number || `Quote ${quote.id}`, quote.company_name || quote.customer_name || quote.contact_name || "Customer", quote.project_name || quote.quote_title || "Custom Project", money(quote.total_amount)]],
  });

  let y = doc.lastAutoTable.finalY + 8;
  if (items.length) {
    autoTable(doc, {
      startY: y,
      theme: "striped",
      styles: { fontSize: 8.5, cellPadding: 2.2 },
      headStyles: { fillColor: [185, 0, 20], textColor: 255 },
      head: [["Item", "Description", "Qty.", "Rate", "Total"]],
      body: items.map((item) => [item.title || "Item", item.description || "", Number(item.quantity || 0), money(item.unit_price), money(item.line_total)]),
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  y = addWrappedText(doc, "Project Scope", quote.scope_of_work, y);
  y = addWrappedText(doc, "Specifications", quote.specifications, y);
  y = addWrappedText(doc, "Included Services", quote.included_services, y);
  y = addWrappedText(doc, "Exclusions", quote.exclusions, y);
  y = addWrappedText(doc, "Schedule", quote.project_schedule, y);
  y = addWrappedText(doc, "Payment Terms", [quote.down_payment_terms, quote.payment_terms].filter(Boolean).join("\n\n"), y);
  y = addWrappedText(doc, "Warranty", quote.warranty_terms, y);
  y = addWrappedText(doc, "Terms & Conditions", [quote.acceptance_terms, quote.disclaimer].filter(Boolean).join("\n\n"), y);

  if (y > 205) { doc.addPage(); y = 20; }
  doc.setDrawColor(185, 0, 20);
  doc.setLineWidth(0.7);
  doc.roundedRect(14, y, 188, 65, 2, 2);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Customer Approval Record", 19, y + 9);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Approved by: ${approval.signer_name || "Not recorded"}`, 19, y + 17);
  doc.text(`Signer email: ${approval.signer_email || "Not recorded"}`, 19, y + 23);
  doc.text(`Approved on: ${dateTime(approval.approved_at)}`, 19, y + 29);
  doc.text(`Document version: ${approval.document_version}`, 19, y + 35);
  doc.text(`Document hash: ${approval.document_hash}`, 19, y + 41, { maxWidth: 176 });
  doc.text(`Approval record: ${approval.id}`, 19, y + 47);
  if (approval.signature_data_url?.startsWith("data:image/png")) {
    try {
      doc.addImage(approval.signature_data_url, "PNG", 136, y + 9, 57, 29, undefined, "FAST");
      doc.setDrawColor(80, 80, 80);
      doc.line(136, y + 40, 193, y + 40);
      doc.text("Customer signature", 136, y + 45);
    } catch (error) {
      console.error("Signature could not be added to signed PDF", error);
    }
  }
  doc.setFontSize(7.5);
  doc.setTextColor(85, 85, 85);
  doc.text("This record preserves the exact quote version accepted by the customer and the electronic signature captured by Metal Worx OS.", 19, y + 58, { maxWidth: 176 });

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFontSize(7.5);
    doc.setTextColor(110, 110, 110);
    doc.text(`METAL WORX INC. | Signed Agreement | Page ${page} of ${pages}`, 108, 273, { align: "center" });
  }

  doc.save(`${safeName(quote.quote_number || `quote-${quote.id}`)}-signed-agreement.pdf`);
}
