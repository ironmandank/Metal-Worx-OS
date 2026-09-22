import { jsPDF } from "jspdf";
import metalWorxLogo from "../assets/metal-worx-logo.png";
import quoteFontRegular from "../assets/fonts/DejaVuSans-Quote.ttf?url";
import quoteFontBold from "../assets/fonts/DejaVuSans-Quote-Bold.ttf?url";

const PAGE = { width: 612, height: 792, left: 42, right: 42, top: 54, bottom: 48 };
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

export async function downloadStoryBoardPdf({ project, files, imageUrls, mode = "internal", overview = "" }) {
  const internal = mode === "internal";
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter", compress: true });
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

  doc.setFillColor(...BLACK);
  doc.rect(0, 0, PAGE.width, PAGE.height, "F");
  doc.setFillColor(...RED);
  doc.rect(0, 0, 12, PAGE.height, "F");
  if (logo) addContainedImage(doc, logo, PAGE.left, 56, 180, 70);
  doc.setTextColor(255, 255, 255);
  doc.setFont("StorySans", "bold");
  doc.setFontSize(internal ? 28 : 31);
  doc.text(internal ? "PROJECT STORY BOARD" : "PROJECT PROGRESS STORY", PAGE.left, internal ? 180 : 120);
  doc.setFillColor(...RED);
  doc.rect(PAGE.left, internal ? 198 : 138, 88, 5, "F");
  doc.setFontSize(20);
  const projectTitle = clean(project.project_name || "Custom Metal Project");
  doc.text(doc.splitTextToSize(projectTitle, contentWidth), PAGE.left, internal ? 242 : 182);
  doc.setFont("StorySans", "normal");
  doc.setFontSize(11);
  doc.setTextColor(205, 205, 205);
  const details = [project.project_number, project.contact_name].filter(Boolean).map(clean).join("  |  ");
  if (details) doc.text(details, PAGE.left, internal ? 292 : 232);
  if (overview) {
    doc.setFontSize(10.5);
    doc.setTextColor(232, 232, 232);
    doc.text(doc.splitTextToSize(clean(overview), contentWidth), PAGE.left, internal ? 344 : 286, { lineHeightFactor: 1.45 });
  }
  doc.setFont("StorySans", "bold");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(internal ? "CUSTOM METAL. BUILT TO LAST." : "PROJECT PHOTOGRAPHIC PROGRESS RECORD", PAGE.left, 700);
  doc.setFont("StorySans", "normal");
  doc.setTextColor(180, 180, 180);
  doc.text(internal ? "Veteran Owned | American Made | Built Strong. Finished Right." : "Prepared for customer review", PAGE.left, 722);

  const stageOrder = [...new Set(prepared.map((file) => file.story_stage || "Project Progress"))];
  for (const stage of stageOrder) {
    const stageFiles = prepared.filter((file) => (file.story_stage || "Project Progress") === stage);
    doc.addPage();
    doc.setFillColor(...BLACK);
    doc.rect(0, 0, PAGE.width, 58, "F");
    doc.setFillColor(...RED);
    doc.rect(0, 0, 8, 58, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("StorySans", "bold");
    doc.setFontSize(18);
    doc.text(clean(stage).toUpperCase(), PAGE.left, 37);
    let y = 82;
    for (const file of stageFiles) {
      if (y + 184 > PAGE.height - PAGE.bottom) {
        doc.addPage();
        y = PAGE.top;
      }
      doc.setDrawColor(215, 215, 215);
      doc.setFillColor(250, 250, 250);
      doc.roundedRect(PAGE.left, y, contentWidth, 172, 7, 7, "FD");
      if (file.image) addContainedImage(doc, file.image, PAGE.left + 10, y + 10, 212, 152);
      doc.setTextColor(...BLACK);
      doc.setFont("StorySans", "bold");
      doc.setFontSize(11);
      const captionLines = doc.splitTextToSize(clean(file.description || file.file_name), contentWidth - 248);
      doc.text(captionLines, PAGE.left + 238, y + 27, { lineHeightFactor: 1.35 });
      doc.setFont("StorySans", "normal");
      doc.setFontSize(8);
      doc.setTextColor(105, 105, 105);
      const meta = internal
        ? [file.file_name, file.uploaded_by].filter(Boolean).map(clean).join(" | ")
        : "Customer progress update";
      doc.text(doc.splitTextToSize(meta, contentWidth - 248), PAGE.left + 238, y + 145);
      y += 188;
    }
  }

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFont("StorySans", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(page === 1 ? 175 : 110, page === 1 ? 175 : 110, page === 1 ? 175 : 110);
    doc.text(internal ? "Metal Worx Inc. | Fayetteville, NC" : clean(project.project_name || "Project Progress"), PAGE.left, 770);
    doc.text(`Page ${page} of ${pages}`, PAGE.width - PAGE.right, 770, { align: "right" });
  }

  const suffix = internal ? "Internal-Story-Board" : "Customer-Progress-Story";
  doc.save(`${safeName(project.project_number || project.project_name)}-${suffix}.pdf`);
}
