import { jsPDF } from "jspdf";
import quoteFontRegular from "../assets/fonts/DejaVuSans-Quote.ttf?url";
import quoteFontBold from "../assets/fonts/DejaVuSans-Quote-Bold.ttf?url";

const PAGE = { width: 612, height: 792, left: 30, right: 30, top: 30, bottom: 30 };
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

function drawSaleMarks(doc, quantity, x, y, maxWidth) {
  const units = Math.max(0, Math.round(Number(quantity || 0)));
  doc.setFont("ShowBook", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...COLORS.ink);
  doc.text("SOLD", x, y);
  const startX = x + 31;
  const boxSize = 10;
  const gap = 5;
  const maxBoxes = Math.max(1, Math.floor((maxWidth - 31) / (boxSize + gap)));
  if (units > maxBoxes) {
    doc.setFont("ShowBook", "normal");
    doc.setFontSize(9);
    doc.text(`_____ of ${units}`, startX, y);
    return;
  }
  doc.setDrawColor(...COLORS.gray);
  doc.setLineWidth(0.8);
  for (let index = 0; index < units; index += 1) {
    doc.rect(startX + index * (boxSize + gap), y - 9, boxSize, boxSize);
  }
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

  drawSaleMarks(doc, row.starting_quantity, contentX, cursorY, width - 22);
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

async function prepareShowRows({ snapshots, items, images, bins }) {
  const itemMap = new Map((items || []).map((item) => [item.id, item]));
  const binMap = new Map((bins || []).map((bin) => [bin.id, bin]));
  const imageMap = new Map();
  (images || []).forEach((image) => {
    if (!imageMap.has(image.inventory_item_id) || image.is_primary) {
      imageMap.set(image.inventory_item_id, image.public_url);
    }
  });

  const rows = (snapshots || []).map((snapshot) => {
    const item = itemMap.get(snapshot.inventory_item_id) || {};
    const bin = binMap.get(snapshot.bin_id) || {};
    const crateCode = bin.code || snapshot.bin_code || "";
    const crateName = bin.name || "";
    return {
      ...snapshot,
      finish: finishFromItem(item),
      price: item.show_price ?? item.selling_price ?? 0,
      crateLabel: [crateCode, crateName].filter(Boolean).join(" ") || "Unassigned Crate",
      imageUrl: item.primary_image_url || imageMap.get(snapshot.inventory_item_id) || null,
      imageData: null,
    };
  });

  await Promise.all(rows.map(async (row) => {
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

export async function downloadShowBookPdf({ event, snapshots, items, images, bins }) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter", compress: true });
  await registerFonts(doc);
  const rows = await prepareShowRows({ snapshots, items, images, bins });
  const groupedRows = groupShowRows(rows);

  drawSummaryPage(doc, event, groupedRows);
  let pageNumber = 1;
  const cardWidth = 267;
  const cardHeight = 322;
  const positions = [
    [30, 82],
    [315, 82],
    [30, 419],
    [315, 419],
  ];

  groupedRows.forEach(([crate, crateRows]) => {
    for (let start = 0; start < crateRows.length; start += 4) {
      doc.addPage();
      pageNumber += 1;
      addPageHeader(doc, event, crate, pageNumber);
      crateRows.slice(start, start + 4).forEach((row, index) => {
        const [x, y] = positions[index];
        drawProductCard(doc, row, x, y, cardWidth, cardHeight);
      });
    }
  });

  doc.save(`${safeName(event.event_name)}-Master-Show-Inventory-Book.pdf`);
}

function drawCrateManifestRow(doc, row, y) {
  const left = PAGE.left;
  const width = PAGE.width - PAGE.left - PAGE.right;
  const rowHeight = 101;
  doc.setDrawColor(...COLORS.line);
  doc.setLineWidth(0.7);
  doc.roundedRect(left, y, width, rowHeight, 4, 4, "S");
  addContainedImage(doc, row.imageData, left + 8, y + 8, 92, 85);

  const textX = left + 112;
  doc.setFont("ShowBook", "bold");
  doc.setFontSize(11.5);
  doc.setTextColor(...COLORS.ink);
  const nameLines = doc.splitTextToSize(row.item_name || "Unnamed item", 255).slice(0, 2);
  doc.text(nameLines, textX, y + 22, { lineHeightFactor: 1.08 });
  doc.setFont("ShowBook", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...COLORS.gray);
  doc.text(row.item_number || "No item number", textX, y + 52);
  doc.text(`Finish: ${row.finish || "—"}  •  Price: ${money(row.price)}`, textX, y + 69);

  doc.setFont("ShowBook", "bold");
  doc.setFontSize(17);
  doc.setTextColor(...COLORS.ink);
  doc.text(`QTY ${Number(row.starting_quantity || 0)}`, left + width - 12, y + 28, { align: "right" });
  doc.setFontSize(8.5);
  doc.text("LOADED  □", left + width - 12, y + 56, { align: "right" });
  doc.text("RETURNED  □", left + width - 12, y + 76, { align: "right" });
}

export async function downloadCrateSheetsPdf({ event, snapshots, items, images, bins }) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter", compress: true });
  await registerFonts(doc);
  const rows = await prepareShowRows({ snapshots, items, images, bins });
  const groupedRows = groupShowRows(rows);
  let firstPage = true;

  groupedRows.forEach(([crate, crateRows]) => {
    for (let start = 0; start < crateRows.length; start += 6) {
      if (!firstPage) doc.addPage();
      firstPage = false;
      doc.setFont("ShowBook", "bold");
      doc.setFontSize(20);
      doc.setTextColor(...COLORS.ink);
      doc.text(crate, PAGE.left, 39);
      doc.setFontSize(9);
      doc.setTextColor(...COLORS.red);
      doc.text("PLACE THIS SHEET INSIDE THE CRATE", PAGE.width - PAGE.right, 39, { align: "right" });
      doc.setFont("ShowBook", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...COLORS.gray);
      doc.text(`${event.event_name}  •  ${formatDate(event.start_date)}–${formatDate(event.end_date)}  •  Page ${Math.floor(start / 6) + 1}`, PAGE.left, 56);
      doc.setDrawColor(...COLORS.red);
      doc.setLineWidth(2);
      doc.line(PAGE.left, 67, PAGE.width - PAGE.right, 67);
      crateRows.slice(start, start + 6).forEach((row, index) => {
        drawCrateManifestRow(doc, row, 79 + index * 111);
      });
    }
  });

  doc.save(`${safeName(event.event_name)}-Individual-Crate-Sheets.pdf`);
}
