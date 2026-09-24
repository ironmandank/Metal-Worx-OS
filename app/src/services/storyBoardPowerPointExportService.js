import pptxgen from "pptxgenjs";
import metalWorxLogo from "../assets/metal-worx-official-transparent.png";

const COLORS = {
  black: "0C0D0F",
  charcoal: "1C1E21",
  red: "C20E24",
  white: "F7F7F5",
  gray: "9A9DA1",
  line: "35383C",
};

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
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function imageDimensions(data) {
  return new Promise((resolve) => {
    const image = new window.Image();
    image.onload = () => resolve({ width: image.naturalWidth || 1, height: image.naturalHeight || 1 });
    image.onerror = () => resolve({ width: 1, height: 1 });
    image.src = data;
  });
}

function containImage(image, x, y, w, h) {
  const imageRatio = image.width / image.height;
  const boxRatio = w / h;
  if (imageRatio > boxRatio) {
    const renderedHeight = w / imageRatio;
    return { data: image.data, x, y: y + (h - renderedHeight) / 2, w, h: renderedHeight };
  }
  const renderedWidth = h * imageRatio;
  return { data: image.data, x: x + (w - renderedWidth) / 2, y, w: renderedWidth, h };
}

function addText(slide, text, options = {}) {
  slide.addText(clean(text), {
    fontFace: "Arial",
    color: COLORS.white,
    margin: 0,
    breakLine: false,
    valign: "mid",
    ...options,
  });
}

function addFooter(slide, title, page, total) {
  slide.addShape("line", { x: 0.52, y: 7.08, w: 12.3, h: 0, line: { color: COLORS.red, width: 1 } });
  addText(slide, "METAL WORX, INC.", { x: 0.52, y: 7.14, w: 2.4, h: 0.16, fontSize: 7, bold: true, charSpacing: 1.1, color: COLORS.gray });
  addText(slide, title.toUpperCase(), { x: 4.55, y: 7.14, w: 4.3, h: 0.16, fontSize: 7, bold: true, align: "center", charSpacing: 1, color: COLORS.gray });
  addText(slide, `${String(page).padStart(2, "0")} / ${String(total).padStart(2, "0")}`, { x: 11.6, y: 7.14, w: 1.2, h: 0.16, fontSize: 7, bold: true, align: "right", color: COLORS.gray });
}

function addEyebrow(slide, text, x = 0.62, y = 0.4, w = 5.5) {
  addText(slide, text.toUpperCase(), { x, y, w, h: 0.2, fontSize: 8, bold: true, charSpacing: 1.7, color: COLORS.red });
}

function addPhotoFrame(slide, image, x, y, w, h, accent = false) {
  slide.addShape("rect", { x, y, w, h, fill: { color: COLORS.black }, line: { color: accent ? COLORS.red : COLORS.line, width: accent ? 1.5 : 0.6 } });
  if (image?.data) slide.addImage(containImage(image, x + 0.03, y + 0.03, w - 0.06, h - 0.06));
}

function captionTitle(file) {
  return clean(file.description || file.file_name || "Project progress").split(/\s+-\s+|\s+—\s+/)[0];
}

function captionBody(file) {
  const value = clean(file.description || file.file_name || "Project progress");
  const parts = value.split(/\s+-\s+|\s+—\s+/);
  return parts.length > 1 ? parts.slice(1).join(" - ") : value;
}

function addCover(pptx, context) {
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.black };
  const cover = context.prepared.find((file) => file.is_cover_photo) || context.prepared[0];
  if (cover) {
    addPhotoFrame(slide, cover, 7.7, 0, 5.63, 7.5);
    slide.addShape("rect", { x: 7.55, y: 0, w: 0.18, h: 7.5, fill: { color: COLORS.red }, line: { color: COLORS.red } });
  }
  if (context.internal && context.logo) slide.addImage({ data: context.logo, x: 0.6, y: 0.35, w: 2.6, h: 0.88, transparency: 0 });
  else addText(slide, "PROJECT STORYBOARD", { x: 0.65, y: 0.55, w: 3.3, h: 0.3, fontSize: 10, bold: true, charSpacing: 2, color: COLORS.gray });
  slide.addShape("line", { x: 0.65, y: 1.35, w: 6.25, h: 0, line: { color: COLORS.red, width: 1.5 } });
  addText(slide, context.project.project_name || "Custom Metal Project", { x: 0.65, y: 1.58, w: 6.25, h: 1.42, fontSize: 36, bold: true, breakLine: true, valign: "top", fit: "shrink" });
  addText(slide, "PROJECT STORYBOARD / CASE STUDY", { x: 0.67, y: 3.17, w: 5.2, h: 0.28, fontSize: 10, bold: true, charSpacing: 2.3, color: COLORS.gray });
  addText(slide, context.project.project_number || context.project.contact_name || "Metal Worx Fabrication Project", { x: 0.67, y: 3.6, w: 5.7, h: 0.42, fontSize: 16, bold: true, color: COLORS.red });
  addText(slide, "Fayetteville, North Carolina", { x: 0.67, y: 4.14, w: 4, h: 0.28, fontSize: 10, color: COLORS.gray });
  addText(slide, "VETERAN OWNED  /  AMERICAN MADE", { x: 0.67, y: 6.82, w: 3.9, h: 0.22, fontSize: 8, bold: true, charSpacing: 1.2, color: COLORS.gray });
  addText(slide, "BUILT STRONG. FINISHED RIGHT.", { x: 4.4, y: 6.82, w: 2.7, h: 0.22, fontSize: 8, bold: true, align: "right" });
}

function addExecutiveSummary(pptx, context) {
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.black };
  addEyebrow(slide, "Section 01 / Executive Summary");
  addText(slide, context.project.project_name || "Project Executive Summary", { x: 0.62, y: 0.8, w: 7.1, h: 0.95, fontSize: 29, bold: true, fit: "shrink" });
  slide.addShape("line", { x: 0.62, y: 1.9, w: 7, h: 0, line: { color: COLORS.red, width: 1.2 } });
  addText(slide, "PROJECT OVERVIEW", { x: 0.65, y: 2.15, w: 2.1, h: 0.2, fontSize: 8, bold: true, charSpacing: 1.5, color: COLORS.red });
  addText(slide, context.overview, { x: 0.65, y: 2.45, w: 6.85, h: 1.2, fontSize: 14, color: "D6D7D8", valign: "top", breakLine: true, fit: "shrink" });
  const featured = context.prepared.find((file) => file.is_cover_photo) || context.prepared.at(-1);
  addPhotoFrame(slide, featured, 0.65, 4.15, 6.85, 2.22, true);
  slide.addShape("rect", { x: 8.05, y: 0, w: 5.28, h: 7.5, fill: { color: COLORS.charcoal }, line: { color: COLORS.charcoal } });
  addText(slide, "PROJECT FACTS", { x: 8.55, y: 0.75, w: 3.8, h: 0.28, fontSize: 12, bold: true, charSpacing: 1.4 });
  const facts = [
    ["CLIENT", context.project.contact_name || context.project.customer_name || "Project customer"],
    ["PROJECT", context.project.project_number || context.project.project_name || "Custom fabrication"],
    ["DOCUMENTED PHASES", String(context.stages.length)],
    ["PROGRESS PHOTOS", String(context.prepared.length)],
    ["CURRENT PHASE", context.stages.at(-1) || "Planning"],
  ];
  facts.forEach(([label, value], index) => {
    const y = 1.35 + index * 0.85;
    addText(slide, label, { x: 8.55, y, w: 3.75, h: 0.16, fontSize: 7.5, bold: true, charSpacing: 1.2, color: COLORS.red });
    addText(slide, value, { x: 8.55, y: y + 0.23, w: 3.9, h: 0.35, fontSize: 12, bold: true, fit: "shrink" });
    slide.addShape("line", { x: 8.55, y: y + 0.7, w: 3.72, h: 0, line: { color: COLORS.line, width: 0.7 } });
  });
  addFooter(slide, "Executive Summary", 2, context.totalSlides);
}

function addTimeline(pptx, context) {
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.black };
  addEyebrow(slide, "Section 02 / Project Timeline");
  addText(slide, "How the project came together", { x: 0.62, y: 0.8, w: 7.4, h: 0.7, fontSize: 30, bold: true });
  const stages = context.stages.slice(0, 8);
  slide.addShape("line", { x: 0.9, y: 3.55, w: 11.55, h: 0, line: { color: COLORS.red, width: 2.5 } });
  stages.forEach((stage, index) => {
    const x = stages.length === 1 ? 6.4 : 0.9 + (11.55 * index) / (stages.length - 1);
    slide.addShape("ellipse", { x: x - 0.16, y: 3.39, w: 0.32, h: 0.32, fill: { color: COLORS.red }, line: { color: COLORS.red } });
    addText(slide, String(index + 1).padStart(2, "0"), { x: x - 0.25, y: 2.72, w: 0.5, h: 0.3, fontSize: 11, bold: true, align: "center", color: COLORS.red });
    addText(slide, stage.toUpperCase(), { x: x - 0.63, y: 3.92, w: 1.26, h: 0.75, fontSize: 8, bold: true, align: "center", valign: "top", fit: "shrink" });
  });
  addText(slide, `${context.prepared.length} project photographs document ${context.stages.length} major phases.`, { x: 0.9, y: 5.48, w: 7.3, h: 0.4, fontSize: 14, color: COLORS.gray });
  addFooter(slide, "Project Timeline", 3, context.totalSlides);
}

function addPhaseDivider(pptx, context, stage, stageIndex, firstFile, page) {
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.black };
  if (firstFile) addPhotoFrame(slide, firstFile, 6.75, 0, 6.58, 7.5);
  slide.addShape("rect", { x: 0, y: 0, w: 6.95, h: 7.5, fill: { color: COLORS.black, transparency: 2 }, line: { color: COLORS.black } });
  addText(slide, "PHASE", { x: 0.62, y: 0.65, w: 1.4, h: 0.25, fontSize: 10, bold: true, charSpacing: 2, color: COLORS.red });
  addText(slide, String(stageIndex + 1).padStart(2, "0"), { x: 0.58, y: 1.2, w: 2.3, h: 1.55, fontSize: 78, bold: true, color: COLORS.red });
  addText(slide, stage, { x: 0.67, y: 3.0, w: 5.45, h: 1.1, fontSize: 27, bold: true, fit: "shrink" });
  addText(slide, firstFile ? captionBody(firstFile) : "Project progress documented by the Metal Worx team.", { x: 0.67, y: 4.35, w: 5.25, h: 1.05, fontSize: 13, color: "CDCFD1", valign: "top", fit: "shrink" });
  addFooter(slide, `Phase ${stageIndex + 1} / ${stage}`, page, context.totalSlides);
}

function addPhotoSpread(pptx, context, stage, files, page) {
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.white };
  addEyebrow(slide, stage, 0.58, 0.32, 7);
  addText(slide, captionTitle(files[0]), { x: 0.58, y: 0.65, w: 9.4, h: 0.62, fontSize: 25, bold: true, color: COLORS.black, fit: "shrink" });
  slide.addShape("line", { x: 0.58, y: 1.37, w: 12.15, h: 0, line: { color: COLORS.red, width: 1.3 } });
  if (files.length === 1) {
    addPhotoFrame(slide, files[0], 0.58, 1.65, 8.05, 4.95, true);
    addText(slide, captionBody(files[0]), { x: 9.05, y: 2.0, w: 3.55, h: 2.25, fontSize: 15, bold: true, color: COLORS.black, valign: "top", fit: "shrink" });
    addText(slide, context.internal ? files[0].file_name : "Project milestone", { x: 9.05, y: 5.55, w: 3.55, h: 0.28, fontSize: 8, color: COLORS.gray });
  } else if (files.length === 2) {
    addPhotoFrame(slide, files[0], 0.58, 1.65, 7.45, 4.95, true);
    addPhotoFrame(slide, files[1], 8.35, 1.65, 4.38, 2.95, false);
    addText(slide, captionBody(files[0]), { x: 8.35, y: 4.92, w: 4.35, h: 1.1, fontSize: 12, bold: true, color: COLORS.black, valign: "top", fit: "shrink" });
  } else {
    addPhotoFrame(slide, files[0], 0.58, 1.65, 7.1, 4.95, true);
    addPhotoFrame(slide, files[1], 8.0, 1.65, 4.72, 2.32, false);
    addPhotoFrame(slide, files[2], 8.0, 4.25, 2.24, 2.35, false);
    if (files[3]) addPhotoFrame(slide, files[3], 10.48, 4.25, 2.24, 2.35, false);
    else addText(slide, captionBody(files[0]), { x: 10.42, y: 4.25, w: 2.3, h: 2.2, fontSize: 11, bold: true, color: COLORS.black, valign: "top", fit: "shrink" });
  }
  addFooter(slide, stage, page, context.totalSlides);
}

function addClosing(pptx, context) {
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.black };
  slide.addShape("rect", { x: 0, y: 0, w: 5.3, h: 7.5, fill: { color: COLORS.red }, line: { color: COLORS.red } });
  addText(slide, "PROJECT DELIVERED", { x: 0.65, y: 0.65, w: 3.6, h: 0.28, fontSize: 9, bold: true, charSpacing: 2 });
  addText(slide, "Custom Metal.\nBuilt to Last.", { x: 0.65, y: 1.35, w: 3.9, h: 1.75, fontSize: 34, bold: true, breakLine: true, valign: "top" });
  addText(slide, context.project.project_name || "Completed Metal Worx Project", { x: 0.65, y: 3.55, w: 3.85, h: 0.95, fontSize: 17, bold: true, fit: "shrink" });
  addText(slide, "Veteran Owned  /  American Made\nBuilt Strong. Finished Right.", { x: 0.65, y: 5.65, w: 3.9, h: 0.7, fontSize: 10, bold: true, breakLine: true });
  const completion = [...context.prepared].reverse().find((file) => file.story_stage === "Completed Project") || context.prepared.at(-1);
  if (completion) addPhotoFrame(slide, completion, 5.72, 0.62, 6.95, 5.85, true);
  addText(slide, "METAL WORX, INC.  /  FAYETTEVILLE, NORTH CAROLINA", { x: 5.75, y: 6.78, w: 6.9, h: 0.24, fontSize: 8, bold: true, charSpacing: 1.2, color: COLORS.gray, align: "center" });
}

export async function downloadStoryBoardPowerPoint({ project, files, imageUrls, mode = "internal", overview = "" }) {
  const internal = mode === "internal";
  const prepared = [];
  for (const file of files) {
    try {
      const data = await urlToDataUrl(file.example_url || imageUrls[file.id]);
      const dimensions = await imageDimensions(data);
      prepared.push({ ...file, data, ...dimensions });
    } catch {
      prepared.push({ ...file, data: null, width: 1, height: 1 });
    }
  }
  let logo = null;
  if (internal) {
    try { logo = await urlToDataUrl(metalWorxLogo); } catch { /* Use a text-only cover. */ }
  }
  const stages = [...new Set(prepared.map((file) => file.story_stage || "Project Progress"))];
  const contentPages = stages.reduce((count, stage) => count + Math.ceil(prepared.filter((file) => (file.story_stage || "Project Progress") === stage).length / 4), 0);
  const totalSlides = 4 + stages.length + contentPages;
  const context = { project, prepared, stages, overview, internal, logo, totalSlides };
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Metal Worx Inc.";
  pptx.company = "Metal Worx Inc.";
  pptx.subject = "Project Storyboard";
  pptx.title = `${project.project_name || "Project"} Storyboard`;
  pptx.lang = "en-US";
  pptx.theme = { headFontFace: "Arial", bodyFontFace: "Arial", lang: "en-US" };
  addCover(pptx, context);
  addExecutiveSummary(pptx, context);
  addTimeline(pptx, context);
  let page = 4;
  stages.forEach((stage, stageIndex) => {
    const stageFiles = prepared.filter((file) => (file.story_stage || "Project Progress") === stage);
    addPhaseDivider(pptx, context, stage, stageIndex, stageFiles[0], page);
    page += 1;
    for (let index = 0; index < stageFiles.length; index += 4) {
      addPhotoSpread(pptx, context, stage, stageFiles.slice(index, index + 4), page);
      page += 1;
    }
  });
  addClosing(pptx, context);
  await pptx.writeFile({ fileName: `${safeName(project.project_number || project.project_name)}-${internal ? "Internal" : "Customer"}-Project-Story.pptx` });
}
