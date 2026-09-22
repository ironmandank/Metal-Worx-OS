import { jsPDF } from "jspdf";
import metalWorxLogo from "../assets/metal-worx-logo.png";
import quoteFontRegular from "../assets/fonts/DejaVuSans-Quote.ttf?url";
import quoteFontBold from "../assets/fonts/DejaVuSans-Quote-Bold.ttf?url";

const PAGE = { width: 792, height: 612, left: 44, right: 44, top: 48, bottom: 42 };
const RED = [156, 0, 15];
const BLACK = [24, 25, 27];

function clean(value) {
  return String(value || "")
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"');
}

function safeName(value) {
  return clean(value || "Project-Story")
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/^-+|-+$/g, "") || "Project-Story";
}

async function urlToDataUrl(url) {
  if (String(url || "").startsWith("data:")) return url;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Image could not be loaded (${response.status}).`);
  const blob = await response.blob();
  if (blob.type === "image/svg+xml") {
    const svg = await blob.text();
    const embedded = svg.match(/href="(data:image\/[^;]+;base64,[^"]+)"/i)?.[1];
    if (embedded) return embedded;
  }
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let start = 0; start < bytes.length; start += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(start, start + 0x8000));
  }
  return `data:${blob.type || "application/octet-stream"};base64,${btoa(binary)}`;
}

function imageFormat(dataUrl) {
  if (String(dataUrl).startsWith("data:image/jpeg")) return "JPEG";
  if (String(dataUrl).startsWith("data:image/webp")) return "WEBP";
  return "PNG";
}

async function registerFonts(doc) {
  const [regular, bold] = await Promise.all([urlToDataUrl(quoteFontRegular), urlToDataUrl(quoteFontBold)]);
  doc.addFileToVFS("StorySans.ttf", regular.split(",")[1]);
  doc.addFileToVFS("StorySans-Bold.ttf", bold.split(",")[1]);
  doc.addFont("StorySans.ttf", "StorySans", "normal");
  doc.addFont("StorySans-Bold.ttf", "StorySans", "bold");
}

function addContainedImage(doc, data, x, y, width, height) {
  const properties = doc.getImageProperties(data);
  const ratio = Math.min(width / properties.width, height / properties.height);
  const renderedWidth = properties.width * ratio;
  const renderedHeight = properties.height * ratio;
  const imageX = x + (width - renderedWidth) / 2;
  const imageY = y + (height - renderedHeight) / 2;
  doc.setFillColor(236, 236, 236);
  doc.roundedRect(x, y, width, height, 5, 5, "F");
  doc.addImage(data, imageFormat(data), imageX, imageY, renderedWidth, renderedHeight, undefined, "FAST");
}

export async function downloadStoryBoardPdf({ project, files, imageUrls, mode = "internal", overview = "", template = "industrial" }) {
  const internal = mode === "internal";
  const theme = template === "portfolio"
    ? { accent: [156, 0, 15], dark: [238, 238, 238], coverText: [28, 29, 31], coverMuted: [85, 85, 85] }
    : template === "field"
      ? { accent: [180, 35, 45], dark: [47, 52, 57], coverText: [255, 255, 255], coverMuted: [205, 205, 205] }
      : { accent: RED, dark: BLACK, coverText: [255, 255, 255], coverMuted: [205, 205, 205] };
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter", compress: true });
  await registerFonts(doc);
  const contentWidth = PAGE.width - PAGE.left - PAGE.right;
  const prepared = [];
  for (const file of files) {
    try {
      const image = await urlToDataUrl(file.example_url || imageUrls[file.id]);
      prepared.push({ ...file, image });
    } catch {
      prepared.push({ ...file, image: null });
    }
  }

  let logo = null;
  if (internal) {
    try { logo = await urlToDataUrl(metalWorxLogo); } catch { /* The PDF remains usable without the logo image. */ }
  }

  doc.setFillColor(...theme.dark);
  doc.rect(0, 0, PAGE.width, PAGE.height, "F");
  doc.setFillColor(...theme.accent);
  doc.rect(0, 0, 12, PAGE.height, "F");
  if (logo) addContainedImage(doc, logo, PAGE.left, 44, 170, 66);
  doc.setTextColor(...theme.coverText);
  doc.setFont("StorySans", "bold");
  doc.setFontSize(internal ? 29 : 32);
  doc.text(internal ? "INTERNAL PROJECT RECORD" : "CUSTOMER PROJECT PRESENTATION", PAGE.left, internal ? 166 : 108);
  doc.setFillColor(...theme.accent);
  doc.rect(PAGE.left, internal ? 184 : 126, 96, 5, "F");
  doc.setFontSize(23);
  const projectTitle = clean(project.project_name || "Custom Metal Project");
  doc.text(doc.splitTextToSize(projectTitle, contentWidth), PAGE.left, internal ? 228 : 170);
  doc.setFont("StorySans", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...theme.coverMuted);
  const details = [project.project_number, project.contact_name].filter(Boolean).map(clean).join("  |  ");
  if (details) doc.text(details, PAGE.left, internal ? 276 : 218);
  if (overview) {
    doc.setFontSize(10.5);
    doc.setTextColor(...theme.coverText);
    doc.text(doc.splitTextToSize(clean(overview), 520), PAGE.left, internal ? 324 : 266, { lineHeightFactor: 1.45 });
  }
  doc.setFont("StorySans", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...theme.coverText);
  doc.text(internal ? "CUSTOM METAL. BUILT TO LAST." : "PROJECT PHOTOGRAPHIC PROGRESS RECORD", PAGE.left, 532);
  doc.setFont("StorySans", "normal");
  doc.setTextColor(...theme.coverMuted);
  doc.text(internal ? "Veteran Owned | American Made | Built Strong. Finished Right." : "Prepared for customer review", PAGE.left, 554);

  const stageOrder = [...new Set(prepared.map((file) => file.story_stage || "Project Progress"))];
  for (const stage of stageOrder) {
    const stageFiles = prepared.filter((file) => (file.story_stage || "Project Progress") === stage);
    doc.addPage();
    doc.setFillColor(...theme.dark);
    doc.rect(0, 0, PAGE.width, 58, "F");
    doc.setFillColor(...theme.accent);
    doc.rect(0, 0, 8, 58, "F");
    doc.setTextColor(...theme.coverText);
    doc.setFont("StorySans", "bold");
    doc.setFontSize(18);
    doc.text(clean(stage).toUpperCase(), PAGE.left, 37);
    let itemIndex = 0;
    for (const file of stageFiles) {
      if (itemIndex > 0 && itemIndex % 2 === 0) {
        doc.addPage();
        doc.setFillColor(...theme.dark);
        doc.rect(0, 0, PAGE.width, 58, "F");
        doc.setFillColor(...theme.accent);
        doc.rect(0, 0, 8, 58, "F");
        doc.setTextColor(...theme.coverText);
        doc.setFont("StorySans", "bold");
        doc.setFontSize(18);
        doc.text(clean(stage).toUpperCase(), PAGE.left, 37);
      }
      const cardWidth = (contentWidth - 18) / 2;
      const x = PAGE.left + (itemIndex % 2) * (cardWidth + 18);
      const y = 82;
      doc.setDrawColor(215, 215, 215);
      doc.setFillColor(250, 250, 250);
      doc.roundedRect(x, y, cardWidth, 448, 7, 7, "FD");
      if (file.image) addContainedImage(doc, file.image, x + 10, y + 10, cardWidth - 20, 286);
      doc.setTextColor(...BLACK);
      doc.setFont("StorySans", "bold");
      doc.setFontSize(12);
      const captionLines = doc.splitTextToSize(clean(file.description || file.file_name), cardWidth - 28);
      doc.text(captionLines, x + 14, y + 324, { lineHeightFactor: 1.4 });
      doc.setFont("StorySans", "normal");
      doc.setFontSize(8);
      doc.setTextColor(105, 105, 105);
      const meta = internal
        ? [file.file_name, file.uploaded_by].filter(Boolean).map(clean).join(" | ")
        : "Customer progress update";
      doc.text(doc.splitTextToSize(meta, cardWidth - 28), x + 14, y + 422);
      itemIndex += 1;
    }
  }

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFont("StorySans", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(page === 1 ? 175 : 110, page === 1 ? 175 : 110, page === 1 ? 175 : 110);
    doc.text(internal ? "Metal Worx Inc. | Fayetteville, NC" : clean(project.project_name || "Project Progress"), PAGE.left, 592);
    doc.text(`Page ${page} of ${pages}`, PAGE.width - PAGE.right, 592, { align: "right" });
  }

  const suffix = internal ? "Internal-Project-Record" : "Customer-Project-Presentation";
  doc.save(`${safeName(project.project_number || project.project_name)}-${suffix}.pdf`);
}
