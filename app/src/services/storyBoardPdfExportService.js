import { jsPDF } from "jspdf";
import metalWorxLogo from "../assets/metal-worx-official-transparent.png";
import quoteFontRegular from "../assets/fonts/DejaVuSans-Quote.ttf?url";
import quoteFontBold from "../assets/fonts/DejaVuSans-Quote-Bold.ttf?url";

const PAGE = { width: 792, height: 612, left: 42, right: 42 };
const RED = [181, 9, 27];
const BLACK = [17, 19, 21];
const CHARCOAL = [35, 38, 41];
const LIGHT = [246, 246, 244];
const GRAY = [103, 107, 111];

function clean(value) {
  return String(value || "").replace(/[–—]/g, "-").replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
}

function safeName(value) {
  return clean(value || "Project-Story").replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "") || "Project-Story";
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
  for (let start = 0; start < bytes.length; start += 0x8000) binary += String.fromCharCode(...bytes.subarray(start, start + 0x8000));
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

function addContainedImage(doc, data, x, y, width, height, border = RED) {
  doc.setFillColor(229, 230, 231);
  doc.roundedRect(x, y, width, height, 7, 7, "F");
  if (data) {
    const properties = doc.getImageProperties(data);
    const ratio = Math.min(width / properties.width, height / properties.height);
    const renderedWidth = properties.width * ratio;
    const renderedHeight = properties.height * ratio;
    doc.addImage(data, imageFormat(data), x + (width - renderedWidth) / 2, y + (height - renderedHeight) / 2, renderedWidth, renderedHeight, undefined, "FAST");
  }
  doc.setDrawColor(...border);
  doc.setLineWidth(2);
  doc.roundedRect(x, y, width, height, 7, 7, "S");
}

function addSectionHeader(doc, title, eyebrow, theme, light = false) {
  doc.setFillColor(...(light ? LIGHT : theme.dark));
  doc.rect(0, 0, PAGE.width, 90, "F");
  doc.setFillColor(...theme.accent);
  doc.rect(0, 84, PAGE.width, 6, "F");
  doc.setFont("StorySans", "bold");
  doc.setTextColor(...(light ? BLACK : [255, 255, 255]));
  doc.setFontSize(24);
  doc.text(clean(title).toUpperCase(), PAGE.left, 45);
  doc.setFont("StorySans", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...(light ? GRAY : [190, 193, 196]));
  doc.text(clean(eyebrow).toUpperCase(), PAGE.left, 66);
}

function drawCaption(doc, file, x, y, width, internal, dark = false) {
  const caption = clean(file.description || file.file_name || "Project progress");
  doc.setFont("StorySans", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...(dark ? [255, 255, 255] : BLACK));
  const lines = doc.splitTextToSize(caption, width);
  doc.text(lines.slice(0, 3), x, y, { lineHeightFactor: 1.25 });
  if (internal) {
    doc.setFont("StorySans", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...(dark ? [170, 174, 178] : GRAY));
    doc.text(clean(file.file_name || "Progress photo"), x, y + Math.min(lines.length, 3) * 12 + 8);
  }
}

function addCover(doc, { project, overview, internal, logo, cover, theme }) {
  doc.setFillColor(...BLACK);
  doc.rect(0, 0, PAGE.width, PAGE.height, "F");
  doc.setFillColor(...theme.accent);
  doc.rect(0, 0, PAGE.width, 8, "F");
  if (cover?.image) {
    addContainedImage(doc, cover.image, 426, 38, 330, 500, [58, 61, 64]);
    doc.setFillColor(...theme.accent);
    doc.rect(414, 38, 9, 500, "F");
  }
  if (internal && logo) doc.addImage(logo, imageFormat(logo), PAGE.left, 58, 300, 100, undefined, "FAST");
  else {
    doc.setFont("StorySans", "bold");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.text("PROJECT PROGRESS PRESENTATION", PAGE.left, 88);
  }
  doc.setFont("StorySans", "bold");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(31);
  doc.text(doc.splitTextToSize(clean(project.project_name || "Custom Metal Project"), 330), PAGE.left, 214, { lineHeightFactor: 1.08 });
  doc.setFillColor(...theme.accent);
  doc.rect(PAGE.left, 286, 92, 4, "F");
  doc.setFontSize(11);
  doc.setTextColor(210, 212, 214);
  doc.text(clean([project.project_number, project.contact_name].filter(Boolean).join("  |  ")), PAGE.left, 316);
  if (overview) {
    doc.setFont("StorySans", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(224, 225, 226);
    doc.text(doc.splitTextToSize(clean(overview), 335).slice(0, 7), PAGE.left, 354, { lineHeightFactor: 1.45 });
  }
  doc.setFont("StorySans", "bold");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(internal ? "CUSTOM METAL. BUILT TO LAST." : "DOCUMENTED FROM START TO COMPLETION", PAGE.left, 530);
}

function addExecutiveSummary(doc, { project, overview, prepared, stages, internal, theme }) {
  doc.addPage();
  doc.setFillColor(...LIGHT);
  doc.rect(0, 0, PAGE.width, PAGE.height, "F");
  addSectionHeader(doc, "Executive Summary", "Project position at a glance", theme);
  const featured = prepared.find((file) => file.is_cover_photo) || prepared.at(-1);
  if (featured?.image) addContainedImage(doc, featured.image, 438, 124, 310, 244, theme.accent);
  doc.setTextColor(...BLACK);
  doc.setFont("StorySans", "bold");
  doc.setFontSize(16);
  doc.text(clean(project.project_name || "Custom Metal Project"), PAGE.left, 138);
  doc.setFillColor(...theme.accent);
  doc.rect(PAGE.left, 151, 72, 4, "F");
  doc.setFont("StorySans", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...GRAY);
  doc.text(doc.splitTextToSize(clean(overview || "Project progress is being documented from the original scope through final completion."), 348).slice(0, 10), PAGE.left, 180, { lineHeightFactor: 1.45 });
  const completion = Math.min(100, Math.round((stages.length / 9) * 100));
  const stats = [["DOCUMENTED PHASES", `${stages.length}`], ["PROGRESS PHOTOS", `${prepared.length}`], ["CURRENT PHASE", clean(stages.at(-1) || "Planning")], ["STORY COMPLETION", `${completion}%`]];
  stats.forEach(([label, value], index) => {
    const x = PAGE.left + (index % 2) * 188;
    const y = 348 + Math.floor(index / 2) * 82;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(216, 217, 218);
    doc.roundedRect(x, y, 174, 64, 5, 5, "FD");
    doc.setFont("StorySans", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...GRAY);
    doc.text(label, x + 12, y + 18);
    doc.setFont("StorySans", "bold");
    doc.setFontSize(value.length > 20 ? 10 : 16);
    doc.setTextColor(...BLACK);
    doc.text(doc.splitTextToSize(value, 148).slice(0, 2), x + 12, y + 43);
  });
  doc.setFillColor(...CHARCOAL);
  doc.roundedRect(438, 392, 310, 120, 6, 6, "F");
  doc.setFont("StorySans", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...theme.accent);
  doc.text("NEXT PROJECT MILESTONE", 458, 418);
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  const next = stages.length < 9 ? "Continue documenting the next fabrication phase" : "Final review and customer closeout";
  doc.text(doc.splitTextToSize(next, 270), 458, 448, { lineHeightFactor: 1.25 });
  doc.setFont("StorySans", "normal");
  doc.setFontSize(8);
  doc.setTextColor(175, 178, 181);
  doc.text(internal ? "Internal record updates as photos and milestones are added." : "Prepared as a concise customer progress overview.", 458, 492);
}

function addTimeline(doc, stages, theme) {
  if (stages.length < 2) return;
  doc.addPage();
  doc.setFillColor(...LIGHT);
  doc.rect(0, 0, PAGE.width, PAGE.height, "F");
  addSectionHeader(doc, "How It Came Together", "Major project milestones", theme);
  const shown = stages.slice(0, 6);
  const xStart = 82;
  const xEnd = 710;
  const lineY = 294;
  doc.setDrawColor(...theme.accent);
  doc.setLineWidth(4);
  doc.line(xStart, lineY, xEnd, lineY);
  shown.forEach((stage, index) => {
    const x = xStart + ((xEnd - xStart) * index) / (shown.length - 1);
    doc.setFillColor(...theme.accent);
    doc.circle(x, lineY, 18, "F");
    doc.setFont("StorySans", "bold");
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text(String(index + 1).padStart(2, "0"), x, lineY + 3, { align: "center" });
    doc.setFontSize(9.5);
    doc.setTextColor(...BLACK);
    doc.text(doc.splitTextToSize(clean(stage).toUpperCase(), 102).slice(0, 3), x, 340, { align: "center", lineHeightFactor: 1.2 });
    doc.setFillColor(...theme.accent);
    doc.rect(x - 22, 382, 44, 3, "F");
  });
  doc.setFillColor(...CHARCOAL);
  doc.roundedRect(70, 448, 652, 54, 6, 6, "F");
  doc.setFont("StorySans", "bold");
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text("FROM ORIGINAL SCOPE TO A PURPOSE-BUILT FINISHED PROJECT", PAGE.width / 2, 480, { align: "center" });
}

function addStagePage(doc, { stage, files, pageIndex, pageCount, internal, theme, template }) {
  doc.addPage();
  const dark = ["industrial", "collage", "photojournal"].includes(template);
  doc.setFillColor(...(dark ? BLACK : LIGHT));
  doc.rect(0, 0, PAGE.width, PAGE.height, "F");
  if (template === "blueprint") {
    doc.setDrawColor(207, 218, 226);
    doc.setLineWidth(0.35);
    for (let x = 0; x <= PAGE.width; x += 24) doc.line(x, 0, x, PAGE.height);
    for (let y = 0; y <= PAGE.height; y += 24) doc.line(0, y, PAGE.width, y);
  }
  addSectionHeader(doc, stage, `Build phase ${pageIndex + 1} of ${pageCount}`, theme, template === "portfolio");
  if (template === "photojournal") {
    const feature = files[0];
    addContainedImage(doc, feature.image, 34, 112, 724, 380, theme.accent);
    doc.setFillColor(...CHARCOAL);
    doc.roundedRect(54, 462, 684, 78, 5, 5, "F");
    drawCaption(doc, feature, 72, 489, 646, internal, true);
    return;
  }
  if (files.length === 1) {
    addContainedImage(doc, files[0].image, 34, 118, 474, 416, theme.accent);
    doc.setFillColor(...theme.accent);
    doc.rect(538, 132, 58, 4, "F");
    drawCaption(doc, files[0], 538, 156, 208, internal, dark);
  } else if (files.length === 2) {
    files.forEach((file, index) => {
      const x = 42 + index * 365;
      addContainedImage(doc, file.image, x, 120, 343, 290, theme.accent);
      drawCaption(doc, file, x, 438, 343, internal, dark);
    });
  } else if (files.length === 3) {
    addContainedImage(doc, files[0].image, 38, 118, 430, 322, theme.accent);
    addContainedImage(doc, files[1].image, 490, 118, 264, 152, theme.accent);
    addContainedImage(doc, files[2].image, 490, 288, 264, 152, theme.accent);
    drawCaption(doc, files[0], 38, 466, 430, internal, dark);
    drawCaption(doc, files[1], 490, 466, 264, internal, dark);
  } else {
    files.forEach((file, index) => {
      const x = 42 + (index % 2) * 365;
      const y = 112 + Math.floor(index / 2) * 220;
      addContainedImage(doc, file.image, x, y, 343, 164, theme.accent);
      drawCaption(doc, file, x, y + 184, 343, internal, dark);
    });
  }
}

export async function downloadStoryBoardPdf({ project, files, imageUrls, mode = "internal", overview = "", template = "industrial" }) {
  const internal = mode === "internal";
  const theme = template === "portfolio"
    ? { accent: [156, 0, 15], dark: [31, 33, 35] }
    : template === "field"
      ? { accent: [190, 25, 39], dark: [49, 54, 59] }
      : template === "blueprint"
        ? { accent: [38, 86, 118], dark: [22, 45, 61] }
        : template === "collage"
          ? { accent: [213, 27, 45], dark: [12, 13, 15] }
          : template === "photojournal"
            ? { accent: [181, 9, 27], dark: [8, 9, 10] }
            : { accent: RED, dark: BLACK };
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter", compress: true });
  await registerFonts(doc);
  const prepared = [];
  for (const file of files) {
    try { prepared.push({ ...file, image: await urlToDataUrl(file.example_url || imageUrls[file.id]) }); }
    catch { prepared.push({ ...file, image: null }); }
  }
  let logo = null;
  if (internal) {
    try { logo = await urlToDataUrl(metalWorxLogo); } catch { /* Continue with a text-led cover. */ }
  }
  const stages = [...new Set(prepared.map((file) => file.story_stage || "Project Progress"))];
  addCover(doc, { project, overview, internal, logo, cover: prepared.find((file) => file.is_cover_photo) || prepared[0], theme });
  addExecutiveSummary(doc, { project, overview, prepared, stages, internal, theme });
  addTimeline(doc, stages, theme);
  for (const stage of stages) {
    const stageFiles = prepared.filter((file) => (file.story_stage || "Project Progress") === stage);
    const chunks = [];
    const photosPerPage = template === "photojournal" ? 1 : 4;
    for (let index = 0; index < stageFiles.length; index += photosPerPage) chunks.push(stageFiles.slice(index, index + photosPerPage));
    chunks.forEach((chunk, pageIndex) => addStagePage(doc, { stage, files: chunk, pageIndex, pageCount: chunks.length, internal, theme, template }));
  }
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFont("StorySans", "normal");
    doc.setFontSize(7.2);
    doc.setTextColor(page === 1 ? 175 : 105, page === 1 ? 175 : 105, page === 1 ? 175 : 105);
    doc.text(internal ? "Metal Worx Inc. | Fayetteville, NC | Veteran Owned" : clean(project.project_name || "Project Progress"), PAGE.left, 592);
    doc.text(`Page ${page} of ${pages}`, PAGE.width - PAGE.right, 592, { align: "right" });
  }
  doc.save(`${safeName(project.project_number || project.project_name)}-${internal ? "Internal-Project-Story" : "Customer-Project-Story"}.pdf`);
}
