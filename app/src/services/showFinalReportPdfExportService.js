import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import metalWorxLogo from "../assets/metal-worx-official-transparent.png";
import quoteFontRegular from "../assets/fonts/DejaVuSans-Quote.ttf?url";
import quoteFontBold from "../assets/fonts/DejaVuSans-Quote-Bold.ttf?url";

const COLORS = {
  red: [166, 12, 30],
  ink: [25, 28, 32],
  gray: [96, 101, 106],
  line: [205, 208, 211],
  pale: [245, 246, 247],
  white: [255, 255, 255],
};

function safeName(value) {
  return String(value || "Metal-Worx-Show")
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/^-+|-+$/g, "") || "Metal-Worx-Show";
}

function money(value) {
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function estimatedValue(product) {
  return Number(product?.product_revenue || 0) > 0 ? money(product.product_revenue) : "Price Needed";
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

async function urlToDataUrl(url) {
  if (String(url || "").startsWith("data:")) return url;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Report asset could not be loaded (${response.status}).`);
  const blob = await response.blob();
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let start = 0; start < bytes.length; start += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(start, start + 0x8000));
  }
  return `data:${blob.type || "image/png"};base64,${btoa(binary)}`;
}

async function registerFonts(doc) {
  const [regular, bold] = await Promise.all([urlToDataUrl(quoteFontRegular), urlToDataUrl(quoteFontBold)]);
  doc.addFileToVFS("ShowReport-Regular.ttf", regular.split(",")[1]);
  doc.addFileToVFS("ShowReport-Bold.ttf", bold.split(",")[1]);
  doc.addFont("ShowReport-Regular.ttf", "ShowReport", "normal");
  doc.addFont("ShowReport-Bold.ttf", "ShowReport", "bold");
}

function addHeader(doc, logo, title, subtitle, offsetY = 0) {
  const width = doc.internal.pageSize.getWidth();
  doc.setFillColor(...COLORS.ink);
  doc.rect(0, offsetY, width, 82, "F");
  if (logo) doc.addImage(logo, "PNG", 34, 14 + offsetY, 116, 48, undefined, "FAST");
  doc.setFont("ShowReport", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...COLORS.white);
  doc.text(title, width - 34, 34 + offsetY, { align: "right" });
  doc.setFont("ShowReport", "normal");
  doc.setFontSize(9);
  doc.setTextColor(210, 214, 218);
  doc.text(subtitle, width - 34, 54 + offsetY, { align: "right" });
  doc.setFillColor(...COLORS.red);
  doc.rect(0, 82 + offsetY, width, 5, "F");
}

function addFooters(doc) {
  const count = doc.getNumberOfPages();
  for (let page = 1; page <= count; page += 1) {
    doc.setPage(page);
    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();
    doc.setDrawColor(...COLORS.line);
    doc.line(34, height - 31, width - 34, height - 31);
    doc.setFont("ShowReport", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...COLORS.gray);
    doc.text("Metal Worx Inc. | Post-Show Inventory Report", 34, height - 18);
    doc.text(`Page ${page} of ${count}`, width - 34, height - 18, { align: "right" });
  }
}

function addInventoryContinuation(doc) {
  const width = doc.internal.pageSize.getWidth();
  doc.setFont("ShowReport", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.ink);
  doc.text("Final Current Inventory by Crate - Continued", 34, 40);
  doc.setDrawColor(...COLORS.red);
  doc.setLineWidth(2);
  doc.line(34, 56, width - 34, 56);
}

function drawMetric(doc, x, y, width, label, value, accent = false) {
  doc.setFillColor(...(accent ? COLORS.red : COLORS.pale));
  doc.roundedRect(x, y, width, 54, 6, 6, "F");
  doc.setFont("ShowReport", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...(accent ? COLORS.white : COLORS.gray));
  doc.text(label.toUpperCase(), x + 12, y + 17);
  doc.setFont("ShowReport", "bold");
  doc.setFontSize(17);
  doc.setTextColor(...(accent ? COLORS.white : COLORS.ink));
  doc.text(String(value), x + 12, y + 41);
}

export async function downloadFinalShowReportPdf({ summary, products = [], inventory = [] }) {
  if (!summary) throw new Error("No finalized show report is available.");
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter", compress: true });
  await registerFonts(doc);
  const logo = await urlToDataUrl(metalWorxLogo);
  const title = "FINAL SHOW INVENTORY REPORT";
  const subtitle = `${summary.event_name} | ${formatDate(summary.start_date)} - ${formatDate(summary.end_date)}`;
  const soldProducts = products.filter((product) => Number(product.units_sold || 0) > 0);
  const topSellers = [...soldProducts]
    .sort((left, right) => Number(right.units_sold || 0) - Number(left.units_sold || 0)
      || Number(right.product_revenue || 0) - Number(left.product_revenue || 0))
    .slice(0, 15);
  const unpricedSoldProducts = soldProducts.filter((product) => Number(product.product_revenue || 0) <= 0);
  const finalPieces = inventory.reduce((sum, row) => sum + Number(row.quantity_on_hand || 0), 0);
  const crates = new Set(inventory.map((row) => row.bin_code).filter(Boolean)).size;

  addHeader(doc, logo, title, subtitle);
  doc.setFont("ShowReport", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...COLORS.ink);
  doc.text(summary.event_name, 34, 116);
  doc.setFont("ShowReport", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.gray);
  doc.text(`Audit finalized ${formatDate(summary.audit_finalized_at)} by ${summary.audit_finalized_by || "Metal Worx"}`, 34, 134);

  const metricWidth = 136;
  drawMetric(doc, 34, 153, metricWidth, "Final inventory", `${finalPieces} pieces`, true);
  drawMetric(doc, 180, 153, metricWidth, "Active crates", crates);
  drawMetric(doc, 326, 153, metricWidth, "Sold pieces", Number(summary.units_sold || 0));
  drawMetric(doc, 472, 153, metricWidth, "Sold products", soldProducts.length);
  drawMetric(doc, 618, 153, 140, "Priced-item value", money(summary.product_sales));

  doc.setFont("ShowReport", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.ink);
  doc.text("Top 15 Sellers", 34, 236);
  doc.setFont("ShowReport", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...COLORS.gray);
  doc.text(
    `Ranked by units sold. Estimated value includes priced products only; ${unpricedSoldProducts.length} sold product${unpricedSoldProducts.length === 1 ? "" : "s"} still need${unpricedSoldProducts.length === 1 ? "s" : ""} a price.`,
    34,
    251
  );

  autoTable(doc, {
    startY: 263,
    margin: { left: 34, right: 34, top: 105, bottom: 42 },
    head: [["Rank", "Item #", "Artwork Item", "Units Sold", "Est. Value", "Sell-Through"]],
    body: topSellers.map((product, index) => [
      index + 1,
      product.item_number || "-",
      product.item_name || "Unnamed item",
      Number(product.units_sold || 0),
      estimatedValue(product),
      `${Number(product.sell_through_percent || 0).toFixed(1)}%`,
    ]),
    theme: "grid",
    styles: { font: "ShowReport", fontSize: 7.5, cellPadding: 4, textColor: COLORS.ink, lineColor: COLORS.line, lineWidth: 0.35 },
    headStyles: { font: "ShowReport", fontStyle: "bold", fillColor: COLORS.red, textColor: COLORS.white, halign: "center" },
    alternateRowStyles: { fillColor: COLORS.pale },
    columnStyles: {
      0: { cellWidth: 42, halign: "center", fontStyle: "bold" },
      1: { cellWidth: 82 },
      2: { cellWidth: 344 },
      3: { cellWidth: 70, halign: "center", fontStyle: "bold" },
      4: { cellWidth: 88, halign: "right" },
      5: { cellWidth: 78, halign: "right" },
    },
    didDrawPage: ({ pageNumber }) => {
      if (pageNumber > 1) addHeader(doc, logo, title, subtitle);
    },
  });

  doc.addPage("letter", "l");
  addHeader(doc, logo, title, subtitle);
  doc.setFont("ShowReport", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...COLORS.ink);
  doc.text("Complete Sold-Item Detail", 34, 116);
  doc.setFont("ShowReport", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...COLORS.gray);
  doc.text("All sold quantities identified during the completed post-show crate audit.", 34, 132);

  autoTable(doc, {
    startY: 146,
    margin: { left: 34, right: 34, top: 105, bottom: 42 },
    head: [["Item #", "Artwork Item", "Started", "Sold", "Remaining", "Est. Value", "Sell-Through"]],
    body: soldProducts.map((product) => [
      product.item_number || "-",
      product.item_name || "Unnamed item",
      Number(product.starting_quantity || 0),
      Number(product.units_sold || 0),
      Number(product.actual_ending_quantity || 0),
      estimatedValue(product),
      `${Number(product.sell_through_percent || 0).toFixed(1)}%`,
    ]),
    theme: "grid",
    styles: { font: "ShowReport", fontSize: 8, cellPadding: 5, textColor: COLORS.ink, lineColor: COLORS.line, lineWidth: 0.35 },
    headStyles: { font: "ShowReport", fontStyle: "bold", fillColor: COLORS.red, textColor: COLORS.white, halign: "center" },
    alternateRowStyles: { fillColor: COLORS.pale },
    columnStyles: {
      0: { cellWidth: 76 },
      1: { cellWidth: 268 },
      2: { cellWidth: 58, halign: "center" },
      3: { cellWidth: 52, halign: "center", fontStyle: "bold" },
      4: { cellWidth: 64, halign: "center" },
      5: { cellWidth: 82, halign: "right" },
      6: { cellWidth: 80, halign: "right" },
    },
    didDrawPage: ({ pageNumber }) => {
      if (pageNumber > 1) addHeader(doc, logo, title, subtitle);
    },
  });

  doc.addPage("letter", "l");
  addHeader(doc, logo, title, subtitle);
  doc.setFont("ShowReport", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...COLORS.ink);
  doc.text("Final Current Inventory by Crate", 34, 116);
  doc.setFont("ShowReport", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...COLORS.gray);
  doc.text("This is the current active artwork inventory after the show audit and all newly found items were added.", 34, 132);

  autoTable(doc, {
    startY: 146,
    margin: { left: 34, right: 34, top: 105, bottom: 42 },
    head: [["Crate", "Item #", "Artwork Item", "Quantity"]],
    body: inventory.map((item) => [
      item.bin_code || "-",
      item.item_number || item.sku || "-",
      item.item_name || "Unnamed item",
      Number(item.quantity_on_hand || 0),
    ]),
    theme: "grid",
    styles: { font: "ShowReport", fontSize: 8.2, cellPadding: 5, textColor: COLORS.ink, lineColor: COLORS.line, lineWidth: 0.35 },
    headStyles: { font: "ShowReport", fontStyle: "bold", fillColor: COLORS.ink, textColor: COLORS.white },
    alternateRowStyles: { fillColor: COLORS.pale },
    columnStyles: {
      0: { cellWidth: 100, fontStyle: "bold" },
      1: { cellWidth: 105 },
      2: { cellWidth: 420 },
      3: { cellWidth: 70, halign: "center", fontStyle: "bold" },
    },
    didDrawPage: ({ pageNumber }) => {
      if (pageNumber > 1) addInventoryContinuation(doc);
    },
  });

  addFooters(doc);
  doc.save(`${safeName(summary.event_name)}-Final-Inventory-Report.pdf`);
}
