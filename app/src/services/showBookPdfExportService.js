import { jsPDF } from "jspdf";
import quoteFontRegular from "../assets/fonts/DejaVuSans-Quote.ttf?url";
import quoteFontBold from "../assets/fonts/DejaVuSans-Quote-Bold.ttf?url";

const PAGE = { width: 612, height: 792, left: 30, right: 30, top: 30, bottom: 30 };
const LANDSCAPE = { width: 792, height: 612, left: 24, right: 24, top: 24, bottom: 24 };
const CRATE_SHEET = { width: 576, height: 720, left: 24, right: 24, top: 24, bottom: 24 };
const COLORS = {
  red: [166, 12, 30],
  ink: [28, 31, 35],
  gray: [103, 108, 113],
  line: [196, 199, 202],
  pale: [244, 245, 246],
};

function safeName(value) {
  return String(value || "Metal-Worx-Show-Book")
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/^-+|-+$/g, "") || "Metal-Worx-Show-Book";
}

function money(value) {
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function finishFromItem(item) {
  const finishLine = String(item?.notes || "")
    .split(/\r?\n/)
    .find((line) => line.trim().toLowerCase().startsWith("finish:"));
  return finishLine?.split(":").slice(1).join(":").trim() || item?.color_name || "—";
}

async function urlToDataUrl(url) {
  if (!url) return null;
  if (String(url).startsWith("data:")) return url;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Image could not be loaded (${response.status}).`);
  const blob = await response.blob();
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let start = 0; start < bytes.length; start += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(start, start + 0x8000));
  }
  return `data:${blob.type || "image/jpeg"};base64,${btoa(binary)}`;
}

function imageFormat(dataUrl) {
  if (String(dataUrl).startsWith("data:image/jpeg")) return "JPEG";
  if (String(dataUrl).startsWith("data:image/webp")) return "WEBP";
  return "PNG";
}

async function registerFonts(doc) {
  const [regular, bold] = await Promise.all([
    urlToDataUrl(quoteFontRegular),
    urlToDataUrl(quoteFontBold),
  ]);
  doc.addFileToVFS("ShowBook-Regular.ttf", regular.split(",")[1]);
  doc.addFileToVFS("ShowBook-Bold.ttf", bold.split(",")[1]);
  doc.addFont("ShowBook-Regular.ttf", "ShowBook", "normal");
  doc.addFont("ShowBook-Bold.ttf", "ShowBook", "bold");
}

function addPageHeader(doc, event, crateLabel, pageNumber) {
  doc.setTextColor(...COLORS.ink);
  doc.setFont("ShowBook", "bold");
  doc.setFontSize(17);
  doc.text(crateLabel, PAGE.left, 44);
  doc.setFont("ShowBook", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...COLORS.gray);
  doc.text(`${event.event_name}  •  ${formatDate(event.start_date)}–${formatDate(event.end_date)}`, PAGE.left, 59);
  doc.setTextColor(...COLORS.gray);
  doc.text(`Page ${pageNumber}`, PAGE.width - PAGE.right, 44, { align: "right" });
  doc.setDrawColor(...COLORS.red);
  doc.setLineWidth(2);
  doc.line(PAGE.left, 68, PAGE.width - PAGE.right, 68);
}

function addContainedImage(doc, imageData, x, y, width, height) {
  doc.setFillColor(...COLORS.pale);
  doc.rect(x, y, width, height, "F");
  if (!imageData) {
    doc.setFont("ShowBook", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...COLORS.gray);
    doc.text("IMAGE NEEDED", x + width / 2, y + height / 2 + 4, { align: "center" });
    return;
  }
  try {
    const properties = doc.getImageProperties(imageData);
    const ratio = Math.min(width / properties.width, height / properties.height);
    const renderedWidth = properties.width * ratio;
    const renderedHeight = properties.height * ratio;
    doc.addImage(
      imageData,
      imageFormat(imageData),
      x + (width - renderedWidth) / 2,
      y + (height - renderedHeight) / 2,
      renderedWidth,
      renderedHeight,
      undefined,
      "FAST",
    );
  } catch {
    doc.setFont("ShowBook", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...COLORS.gray);
    doc.text("IMAGE NEEDED", x + width / 2, y + height / 2 + 4, { align: "center" });
  }
}

function drawSaleMarks(doc, x, y, maxWidth) {
  doc.setFont("ShowBook", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...COLORS.ink);
  doc.text("SOLD", x, y);
  doc.setDrawColor(...COLORS.gray);
  doc.setLineWidth(0.8);
  doc.line(x + 34, y + 1, x + maxWidth, y + 1);
}

function drawProductCard(doc, row, x, y, width, height) {
  doc.setDrawColor(...COLORS.line);
  doc.setLineWidth(0.8);
  doc.roundedRect(x, y, width, height, 5, 5, "S");

  const imageX = x + 9;
  const imageY = y + 9;
  const imageWidth = width - 18;
  const imageHeight = 142;
  addContainedImage(doc, row.imageData, imageX, imageY, imageWidth, imageHeight);

  const contentX = x + 11;
  let cursorY = imageY + imageHeight + 17;
  doc.setFont("ShowBook", "bold");
  doc.setFontSize(11.5);
  doc.setTextColor(...COLORS.ink);
  const nameLines = doc.splitTextToSize(row.item_name || "Unnamed item", width - 22).slice(0, 2);
  doc.text(nameLines, contentX, cursorY, { lineHeightFactor: 1.08 });
  cursorY += nameLines.length * 12 + 3;

  doc.setFont("ShowBook", "normal");
  doc.setFontSize(8.2);
  doc.setTextColor(...COLORS.gray);
  doc.text(`${row.item_number || "No item number"}  •  Finish: ${row.finish || "—"}`, contentX, cursorY);
  cursorY += 15;

  doc.setFont("ShowBook", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.ink);
  doc.text(`Price ${money(row.price)}`, contentX, cursorY);
  doc.text(`Loaded ${Number(row.starting_quantity || 0)}`, x + width - 11, cursorY, { align: "right" });
  cursorY += 18;

  drawSaleMarks(doc, contentX, cursorY, width - 22);
  cursorY += 22;
  doc.setFont("ShowBook", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...COLORS.ink);
  doc.text("Returned: ______    Damaged/Missing: ______", contentX, cursorY);
  cursorY += 18;
  doc.setTextColor(...COLORS.gray);
  doc.text("Notes: ____________________________________", contentX, cursorY);
  doc.text("__________________________________________", contentX, cursorY + 15);
}

function drawSummaryPage(doc, event, groupedRows) {
  doc.setTextColor(...COLORS.ink);
  doc.setFont("ShowBook", "bold");
  doc.setFontSize(22);
  doc.text("SHOW INVENTORY BOOK", PAGE.left, 50);
  doc.setFontSize(17);
  doc.text(event.event_name, PAGE.left, 78);
  doc.setFont("ShowBook", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.gray);
  doc.text(`${event.venue_name || "Mobile sales event"}  •  ${formatDate(event.start_date)}–${formatDate(event.end_date)}`, PAGE.left, 98);
  doc.setDrawColor(...COLORS.red);
  doc.setLineWidth(2);
  doc.line(PAGE.left, 112, PAGE.width - PAGE.right, 112);

  doc.setFont("ShowBook", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.ink);
  doc.text("CRATE CHECKLIST", PAGE.left, 143);
  let y = 168;
  groupedRows.forEach(([crate, rows]) => {
    const total = rows.reduce((sum, row) => sum + Number(row.starting_quantity || 0), 0);
    doc.setDrawColor(...COLORS.line);
    doc.line(PAGE.left, y + 8, PAGE.width - PAGE.right, y + 8);
    doc.setFont("ShowBook", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.ink);
    doc.text(crate, PAGE.left, y);
    doc.setFont("ShowBook", "normal");
    doc.text(`${rows.length} products  •  ${total} pieces`, 280, y);
    doc.text("Loaded □   Returned □", PAGE.width - PAGE.right, y, { align: "right" });
    y += 29;
    if (y > 690) {
      doc.addPage();
      y = 50;
    }
  });

  y = Math.min(y + 18, 660);
  doc.setFont("ShowBook", "bold");
  doc.text("SHOW NOTES", PAGE.left, y);
  doc.setFont("ShowBook", "normal");
  doc.setTextColor(...COLORS.gray);
  for (let index = 1; index <= 4; index += 1) {
    doc.line(PAGE.left, y + index * 22, PAGE.width - PAGE.right, y + index * 22);
  }
}

async function prepareShowRows({ snapshots, items, images, bins, loadImages = true }) {
  const itemMap = new Map((items || []).map((item) => [item.id, item]));
  const binMap = new Map((bins || []).map((bin) => [bin.id, bin]));
  const imageMap = new Map();
  (images || []).forEach((image) => {
    if (!imageMap.has(image.inventory_item_id) || image.is_primary) {
      imageMap.set(image.inventory_item_id, image.public_url);
    }
  });

  const rows = (snapshots || [])
    .filter((snapshot) => Number(snapshot.starting_quantity || 0) > 0)
    .map((snapshot) => {
    const item = itemMap.get(snapshot.inventory_item_id) || {};
    const bin = binMap.get(snapshot.bin_id) || {};
    const crateCode = bin.code || snapshot.bin_code || "";
    const crateName = bin.name || "";
    return {
      ...snapshot,
      sku: item.sku || "",
      dimensions: item.dimensions || "",
      color: item.color_name || "",
      finish: finishFromItem(item),
      price: item.show_price ?? item.selling_price ?? 0,
      isInventoryItemActive: Boolean(item.id) && item.is_active !== false,
      crateLabel: [crateCode, crateName].filter(Boolean).join(" ") || "Unassigned Crate",
      isShowCrate: /^(CR|LG)-/i.test(crateCode),
      imageUrl: item.primary_image_url || imageMap.get(snapshot.inventory_item_id) || null,
      imageData: null,
    };
  })
    .filter((row) => row.inventory_item_id && row.item_name && row.isInventoryItemActive && row.isShowCrate);

  if (loadImages) await Promise.all(rows.map(async (row) => {
    if (!row.imageUrl) return;
    try {
      row.imageData = await urlToDataUrl(row.imageUrl);
    } catch {
      row.imageData = null;
    }
  }));

  return rows;
}

function groupShowRows(rows) {
  const grouped = new Map();
  rows
    .sort((a, b) => String(a.crateLabel).localeCompare(String(b.crateLabel)) || String(a.item_name).localeCompare(String(b.item_name)))
    .forEach((row) => {
      const crate = row.crateLabel;
      if (!grouped.has(crate)) grouped.set(crate, []);
      grouped.get(crate).push(row);
    });
  return Array.from(grouped.entries());
}

function drawMasterSummaryLandscape(doc, event, groupedRows, startIndex = 0, pageNumber = 1) {
  const totalProducts = groupedRows.reduce((sum, [, rows]) => sum + rows.length, 0);
  const totalPieces = groupedRows.reduce((sum, [, rows]) => sum + rows.reduce((crateSum, row) => crateSum + Number(row.starting_quantity || 0), 0), 0);
  doc.setFont("ShowBook", "bold");
  doc.setTextColor(...COLORS.ink);
  doc.setFontSize(22);
  doc.text(startIndex === 0 ? "MASTER SHOW INVENTORY" : "MASTER CRATE SUMMARY", LANDSCAPE.left, 38);
  doc.setFontSize(14);
  doc.text(event.event_name, LANDSCAPE.left, 62);
  doc.setFont("ShowBook", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...COLORS.gray);
  doc.text(`${event.venue_name || "Mobile sales event"}  •  ${formatDate(event.start_date)}–${formatDate(event.end_date)}`, LANDSCAPE.left, 78);
  doc.setFont("ShowBook", "bold");
  doc.setTextColor(...COLORS.red);
  doc.text(`${groupedRows.length} crates  •  ${totalProducts} artwork designs  •  ${totalPieces} physical pieces`, LANDSCAPE.width - LANDSCAPE.right, 62, { align: "right" });
  doc.setFont("ShowBook", "normal");
  doc.setTextColor(...COLORS.gray);
  doc.text(`Page ${pageNumber}`, LANDSCAPE.width - LANDSCAPE.right, 38, { align: "right" });
  doc.setDrawColor(...COLORS.red);
  doc.setLineWidth(2);
  doc.line(LANDSCAPE.left, 90, LANDSCAPE.width - LANDSCAPE.right, 90);

  const columns = [
    ["CRATE", 24], ["DESCRIPTION", 150], ["ITEMS", 490], ["PIECES", 565], ["FINAL COUNT", 650],
  ];
  doc.setFillColor(...COLORS.ink);
  doc.rect(LANDSCAPE.left, 104, LANDSCAPE.width - LANDSCAPE.left - LANDSCAPE.right, 24, "F");
  doc.setFont("ShowBook", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  columns.forEach(([label, x]) => doc.text(label, x, 120));
  let y = 128;
  groupedRows.slice(startIndex, startIndex + 17).forEach(([crate, rows], index) => {
    const pieces = rows.reduce((sum, row) => sum + Number(row.starting_quantity || 0), 0);
    const firstSpace = crate.indexOf(" ");
    const code = firstSpace > 0 ? crate.slice(0, firstSpace) : crate;
    const name = firstSpace > 0 ? crate.slice(firstSpace + 1) : "";
    if (index % 2 === 0) {
      doc.setFillColor(...COLORS.pale);
      doc.rect(LANDSCAPE.left, y, LANDSCAPE.width - LANDSCAPE.left - LANDSCAPE.right, 25, "F");
    }
    doc.setFont("ShowBook", "bold");
    doc.setTextColor(...COLORS.ink);
    doc.setFontSize(8.5);
    doc.text(code, 24, y + 16);
    doc.setFont("ShowBook", "normal");
    doc.text(doc.splitTextToSize(name, 325)[0] || "—", 150, y + 16);
    doc.text(String(rows.length), 490, y + 16);
    doc.text(String(pieces), 565, y + 16);
    doc.text("__________", 650, y + 16);
    y += 25;
  });
}

function drawMasterSalesHeader(doc, event, pageNumber) {
  doc.setFont("ShowBook", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...COLORS.ink);
  doc.text("MASTER SALES TALLY", LANDSCAPE.left, 31);
  doc.setFont("ShowBook", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...COLORS.gray);
  doc.text(`${event.event_name}  •  ${formatDate(event.start_date)}–${formatDate(event.end_date)}`, LANDSCAPE.left, 48);
  doc.text(`Page ${pageNumber}`, LANDSCAPE.width - LANDSCAPE.right, 31, { align: "right" });

  const headers = [
    ["PHOTO", 24], ["ARTWORK", 84], ["FINISH", 249], ["CRATE", 314], ["QTY", 424], ["PRICE", 472], ["SOLD QTY", 530], ["LEFT", 701],
  ];
  doc.setFillColor(...COLORS.ink);
  doc.rect(LANDSCAPE.left, 60, LANDSCAPE.width - LANDSCAPE.left - LANDSCAPE.right, 24, "F");
  doc.setFont("ShowBook", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  headers.forEach(([label, x]) => doc.text(label, x, 76));
}

function drawMasterSalesRow(doc, row, y, alternate) {
  if (alternate) {
    doc.setFillColor(...COLORS.pale);
    doc.rect(LANDSCAPE.left, y, LANDSCAPE.width - LANDSCAPE.left - LANDSCAPE.right, 58, "F");
  }
  doc.setDrawColor(...COLORS.line);
  doc.line(LANDSCAPE.left, y + 58, LANDSCAPE.width - LANDSCAPE.right, y + 58);
  addContainedImage(doc, row.imageData, 28, y + 5, 48, 48);
  doc.setFont("ShowBook", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...COLORS.ink);
  const itemLines = doc.splitTextToSize(row.item_name || "Unnamed item", 155).slice(0, 2);
  doc.text(itemLines, 84, y + 15, { lineHeightFactor: 1.05 });
  doc.setFont("ShowBook", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.gray);
  doc.text(row.item_number || row.sku || "No item number", 84, y + 48);
  doc.setTextColor(...COLORS.ink);
  doc.setFontSize(8);
  doc.text(doc.splitTextToSize(row.finish || row.color || "—", 58)[0], 249, y + 28);
  doc.text(doc.splitTextToSize(row.crateLabel || "—", 102).slice(0, 2), 314, y + 20, { lineHeightFactor: 1.1 });
  doc.setFont("ShowBook", "bold");
  doc.setFontSize(10);
  doc.text(String(Number(row.starting_quantity || 0)), 424, y + 30);
  doc.text(money(row.price), 472, y + 30);
  doc.setFont("ShowBook", "normal");
  doc.setFontSize(9);
  doc.text("____________________", 530, y + 30);
  doc.text("______", 701, y + 30);
}

function drawMasterSalesPage(doc, event, rows, pageNumber) {
  drawMasterSalesHeader(doc, event, pageNumber);
  rows.forEach((row, index) => drawMasterSalesRow(doc, row, 84 + index * 62, index % 2 === 1));
  doc.setFont("ShowBook", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.gray);
  doc.text("Record sales during the show. Enter the remaining physical quantity in LEFT at the end of the show.", LANDSCAPE.left, 596);
}

export async function downloadShowBookPdf({ event, snapshots, items, images, bins }) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter", compress: true });
  await registerFonts(doc);
  const rows = await prepareShowRows({ snapshots, items, images, bins });
  const groupedRows = groupShowRows(rows);

  const summaryPageCount = Math.max(1, Math.ceil(groupedRows.length / 17));
  for (let start = 0; start < groupedRows.length; start += 17) {
    if (start > 0) doc.addPage();
    drawMasterSummaryLandscape(doc, event, groupedRows, start, Math.floor(start / 17) + 1);
  }
  const pageRows = groupedRows.flatMap(([, crateRows]) => crateRows);
  for (let start = 0; start < pageRows.length; start += 8) {
    doc.addPage();
    drawMasterSalesPage(doc, event, pageRows.slice(start, start + 8), summaryPageCount + Math.floor(start / 8) + 1);
  }

  doc.save(`${safeName(event.event_name)}-Master-Show-Inventory-Book.pdf`);
}

function drawCrateManifestRow(doc, row, y, rowHeight) {
  const left = CRATE_SHEET.left;
  const width = CRATE_SHEET.width - CRATE_SHEET.left - CRATE_SHEET.right;
  const fontSize = Math.max(4.8, Math.min(9.5, rowHeight * 0.3));
  const centerY = y + rowHeight / 2 + fontSize * 0.32;
  doc.setDrawColor(...COLORS.line);
  doc.setLineWidth(0.45);
  doc.line(left, y + rowHeight, left + width, y + rowHeight);
  const textX = left + 6;
  doc.setFont("ShowBook", "bold");
  doc.setFontSize(fontSize);
  doc.setTextColor(...COLORS.ink);
  const itemText = [row.item_name || "Unnamed item", row.item_number || row.sku, row.dimensions].filter(Boolean).join("  •  ");
  doc.text(doc.splitTextToSize(itemText, 332)[0], textX, centerY);

  doc.setFont("ShowBook", "normal");
  doc.setFontSize(fontSize);
  doc.text(doc.splitTextToSize(row.finish || row.color || "—", 112)[0], left + 350, centerY);
  doc.setFont("ShowBook", "bold");
  doc.setFontSize(Math.max(5.5, Math.min(11, rowHeight * 0.34)));
  doc.text(String(Number(row.starting_quantity || 0)), left + width - 12, centerY, { align: "right" });
}

export async function downloadCrateSheetsPdf({ event, snapshots, items, images, bins }) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: [CRATE_SHEET.width, CRATE_SHEET.height], compress: true });
  await registerFonts(doc);
  const rows = await prepareShowRows({ snapshots, items, images, bins, loadImages: false });
  const groupedRows = groupShowRows(rows);
  let firstPage = true;

  groupedRows.forEach(([crate, crateRows]) => {
    const cratePieces = crateRows.reduce((sum, row) => sum + Number(row.starting_quantity || 0), 0);
    if (!firstPage) doc.addPage();
    firstPage = false;
    doc.setFont("ShowBook", "bold");
    doc.setFontSize(18);
    doc.setTextColor(...COLORS.ink);
    doc.text(crate, CRATE_SHEET.left, 31);
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.red);
    doc.text("COMPLETE CRATE CONTENTS", CRATE_SHEET.width - CRATE_SHEET.right, 31, { align: "right" });
    doc.setFont("ShowBook", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...COLORS.gray);
    doc.text(`${event.event_name}  •  ${formatDate(event.start_date)}–${formatDate(event.end_date)}  •  ${crateRows.length} items  •  ${cratePieces} pieces`, CRATE_SHEET.left, 46);
    doc.setDrawColor(...COLORS.red);
    doc.setLineWidth(1.6);
    doc.line(CRATE_SHEET.left, 55, CRATE_SHEET.width - CRATE_SHEET.right, 55);
    doc.setFillColor(...COLORS.ink);
    doc.rect(CRATE_SHEET.left, 62, CRATE_SHEET.width - CRATE_SHEET.left - CRATE_SHEET.right, 18, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("ShowBook", "bold");
    doc.setFontSize(6.5);
    doc.text("ITEM / NUMBER / SIZE", CRATE_SHEET.left + 6, 74);
    doc.text("FINISH / COLOR", CRATE_SHEET.left + 350, 74);
    doc.text("QTY", CRATE_SHEET.width - CRATE_SHEET.right - 12, 74, { align: "right" });
    const listTop = 80;
    const availableHeight = CRATE_SHEET.height - CRATE_SHEET.bottom - listTop;
    const rowHeight = availableHeight / Math.max(1, crateRows.length);
    crateRows.forEach((row, index) => drawCrateManifestRow(doc, row, listTop + index * rowHeight, rowHeight));
  });

  doc.save(`${safeName(event.event_name)}-Individual-Crate-Sheets.pdf`);
}
