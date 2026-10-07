import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function money(value) {
  return Number(value || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function date(value) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function safeName(value) {
  return String(value || "project").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 80);
}

export function exportProjectBillingStatement({ project, customer, quote, invoices = [], payments = [] }) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  const width = doc.internal.pageSize.getWidth();
  const projectName = project?.project_name || project?.project_number || "Outside Project";
  const customerName = customer?.company_name || [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") || project?.contact_name || "Customer";
  const contractTotal = Number(project?.contract_total || quote?.total_amount || 0);
  const amountPaid = Number(project?.amount_paid || payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0));
  const balanceDue = Number.isFinite(Number(project?.balance_due)) ? Number(project.balance_due) : Math.max(contractTotal - amountPaid, 0);

  doc.setFillColor(19, 23, 27);
  doc.rect(0, 0, width, 104, "F");
  doc.setFillColor(176, 0, 18);
  doc.rect(0, 0, 12, 104, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.text("METAL WORX", 42, 43);
  doc.setFontSize(15);
  doc.setTextColor(242, 68, 78);
  doc.text("PROJECT BILLING STATEMENT", 42, 69);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(190, 195, 200);
  doc.text(`Generated ${date(new Date())}`, 42, 88);

  doc.setTextColor(25, 25, 25);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(projectName, 42, 138);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`${customerName}${project?.project_number ? `  •  ${project.project_number}` : ""}`, 42, 157);
  const address = [customer?.address || project?.job_address, customer?.city || project?.city, customer?.state || project?.state, customer?.zip || project?.zip_code].filter(Boolean).join(", ");
  if (address) doc.text(address, 42, 174);

  autoTable(doc, {
    startY: address ? 194 : 178,
    head: [["Project Value", "Payments Received", "Balance Remaining", "Project Status"]],
    body: [[money(contractTotal), money(amountPaid), money(balanceDue), project?.status || "Active"]],
    theme: "grid",
    headStyles: { fillColor: [135, 0, 14], textColor: 255, fontStyle: "bold" },
    bodyStyles: { fontSize: 11, fontStyle: "bold", cellPadding: 10 },
  });

  let y = doc.lastAutoTable.finalY + 24;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Quotes & Invoices", 42, y);
  autoTable(doc, {
    startY: y + 9,
    head: [["Document", "Type", "Date", "Status", "Amount"]],
    body: [quote, ...invoices].filter(Boolean).map((record) => [
      record.quote_number || "—",
      record.document_type || record.quote_type || "Quote",
      date(record.quote_date || record.created_at),
      record.status || "—",
      money(record.total_amount),
    ]),
    theme: "striped",
    headStyles: { fillColor: [42, 47, 52], textColor: 255 },
    styles: { fontSize: 9, cellPadding: 7 },
  });

  y = doc.lastAutoTable.finalY + 24;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Payment History", 42, y);
  autoTable(doc, {
    startY: y + 9,
    head: [["Date", "Payment", "Method", "Reference", "Amount"]],
    body: payments.length ? payments.map((payment) => [
      date(payment.payment_date || payment.created_at),
      payment.payment_type || "Payment",
      payment.payment_method || "—",
      payment.reference_number || "—",
      money(payment.amount),
    ]) : [["—", "No payments recorded", "—", "—", money(0)]],
    theme: "grid",
    headStyles: { fillColor: [42, 47, 52], textColor: 255 },
    styles: { fontSize: 9, cellPadding: 7 },
  });

  const footerY = doc.internal.pageSize.getHeight() - 32;
  doc.setDrawColor(176, 0, 18);
  doc.setLineWidth(2);
  doc.line(42, footerY - 10, width - 42, footerY - 10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(95, 95, 95);
  doc.setFontSize(8);
  doc.text("Metal Worx Inc. • Fayetteville, North Carolina • Project billing summary", 42, footerY);

  doc.save(`Metal-Worx-${safeName(projectName)}-Billing-Statement.pdf`);
}
