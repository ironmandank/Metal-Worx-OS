import ImageTracer from "imagetracerjs";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function prepareBinaryImageData(source, options = {}) {
  const {
    threshold = 160,
    invert = false,
    transparentIsWhite = true,
  } = options;
  const output = new Uint8ClampedArray(source.data.length);

  for (let index = 0; index < source.data.length; index += 4) {
    const alpha = source.data[index + 3] / 255;
    const red = source.data[index];
    const green = source.data[index + 1];
    const blue = source.data[index + 2];
    const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    const composited = transparentIsWhite
      ? luminance * alpha + 255 * (1 - alpha)
      : luminance;
    const isDark = invert ? composited >= threshold : composited < threshold;
    const value = isDark ? 0 : 255;
    output[index] = value;
    output[index + 1] = value;
    output[index + 2] = value;
    output[index + 3] = 255;
  }

  return {
    width: source.width,
    height: source.height,
    data: output,
  };
}

function segmentPoints(segment, curveSteps) {
  if (segment.type === "L") {
    return [{ x: segment.x2, y: segment.y2 }];
  }

  if (segment.type === "Q") {
    const points = [];
    for (let step = 1; step <= curveSteps; step += 1) {
      const t = step / curveSteps;
      const mt = 1 - t;
      points.push({
        x: mt * mt * segment.x1 + 2 * mt * t * segment.x2 + t * t * segment.x3,
        y: mt * mt * segment.y1 + 2 * mt * t * segment.y2 + t * t * segment.y3,
      });
    }
    return points;
  }

  return [];
}

export function traceImageData(binaryImageData, options = {}) {
  const {
    lineTolerance = 1,
    curveTolerance = 1,
    speckleSize = 8,
    curveSteps = 8,
  } = options;

  const traced = ImageTracer.imagedataToTracedata(binaryImageData, {
    ltres: lineTolerance,
    qtres: curveTolerance,
    pathomit: speckleSize,
    numberofcolors: 2,
    colorsampling: 0,
    colorquantcycles: 1,
    strokewidth: 0,
    scale: 1,
    roundcoords: 3,
    layering: 0,
    pal: [
      { r: 0, g: 0, b: 0, a: 255 },
      { r: 255, g: 255, b: 255, a: 255 },
    ],
  });

  let darkLayerIndex = 0;
  let darkest = Number.POSITIVE_INFINITY;
  traced.palette.forEach((color, index) => {
    const brightness = color.r + color.g + color.b;
    if (brightness < darkest) {
      darkest = brightness;
      darkLayerIndex = index;
    }
  });

  const paths = (traced.layers[darkLayerIndex] || [])
    .map((path) => {
      const segments = path.segments || [];
      if (!segments.length) return null;
      const first = segments[0];
      const points = [{ x: first.x1, y: first.y1 }];
      segments.forEach((segment) => points.push(...segmentPoints(segment, curveSteps)));
      return {
        hole: Boolean(path.isholepath),
        points,
      };
    })
    .filter((path) => path && path.points.length >= 3);

  return {
    sourceWidth: binaryImageData.width,
    sourceHeight: binaryImageData.height,
    paths,
  };
}

export function buildDxf(trace, options = {}) {
  const requestedWidth = Math.max(0.01, Number(options.widthInches) || 1);
  const requestedHeight = Math.max(0.01, Number(options.heightInches) || 1);
  const keepAspect = options.keepAspect !== false;
  const sourceAspect = trace.sourceWidth / trace.sourceHeight;
  const width = requestedWidth;
  const height = keepAspect ? requestedWidth / sourceAspect : requestedHeight;
  const scaleX = width / trace.sourceWidth;
  const scaleY = height / trace.sourceHeight;
  const baseLayer = String(options.layerName || "LASER").replace(/[^A-Za-z0-9_-]/g, "_");
  const cutLayer = `${baseLayer}_CUT_SECOND_RED`;
  const intactLayer = `${baseLayer}_CUT_FIRST_BLACK`;
  const pathRoles = options.pathRoles || [];
  const lines = [
    "0", "SECTION", "2", "HEADER",
    "9", "$ACADVER", "1", "AC1009",
    "9", "$INSUNITS", "70", "1",
    "9", "$MEASUREMENT", "70", "0",
    "9", "$EXTMIN", "10", "0.000000", "20", "0.000000", "30", "0.000000",
    "9", "$EXTMAX", "10", width.toFixed(6), "20", height.toFixed(6), "30", "0.000000",
    "0", "ENDSEC",
    "0", "SECTION", "2", "TABLES",
    "0", "TABLE", "2", "LAYER", "70", "2",
    "0", "LAYER", "2", cutLayer, "70", "0", "62", "1", "6", "CONTINUOUS",
    "0", "LAYER", "2", intactLayer, "70", "0", "62", "7", "6", "CONTINUOUS",
    "0", "ENDTAB", "0", "ENDSEC",
    "0", "SECTION", "2", "ENTITIES",
  ];

  trace.paths.forEach((path, pathIndex) => {
    const isCut = pathRoles[pathIndex] === "cut";
    const layer = isCut ? cutLayer : intactLayer;
    const color = isCut ? "1" : "7";
    const points = path.points.map((point) => ({
      x: clamp(point.x * scaleX, 0, width),
      y: clamp(height - point.y * scaleY, 0, height),
    }));
    lines.push("0", "POLYLINE", "8", layer, "62", color, "66", "1", "70", "1");
    points.forEach((point) => {
      lines.push(
        "0", "VERTEX", "8", layer, "62", color,
        "10", point.x.toFixed(6), "20", point.y.toFixed(6), "30", "0.000000",
        "70", "0",
      );
    });
    lines.push("0", "SEQEND", "8", layer);
  });

  lines.push("0", "ENDSEC", "0", "EOF");
  return { dxf: lines.join("\n"), width, height, pathCount: trace.paths.length };
}

function escapeXml(value) {
  return String(value).replace(/[<>&"']/g, (character) => ({
    "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;",
  })[character]);
}

export function buildCorelSvg(trace, options = {}) {
  const requestedWidth = Math.max(0.01, Number(options.widthInches) || 1);
  const requestedHeight = Math.max(0.01, Number(options.heightInches) || 1);
  const keepAspect = options.keepAspect !== false;
  const width = requestedWidth;
  const height = keepAspect
    ? requestedWidth / (trace.sourceWidth / trace.sourceHeight)
    : requestedHeight;
  const scaleX = width / trace.sourceWidth;
  const scaleY = height / trace.sourceHeight;
  const pathRoles = options.pathRoles || [];
  const title = escapeXml(options.title || "Metal Worx Laser File");
  const groups = { intact: [], cut: [] };

  trace.paths.forEach((path, pathIndex) => {
    const role = pathRoles[pathIndex] === "cut" ? "cut" : "intact";
    const [first, ...rest] = path.points;
    const commands = [
      `M ${(first.x * scaleX).toFixed(6)} ${(first.y * scaleY).toFixed(6)}`,
      ...rest.map((point) => `L ${(point.x * scaleX).toFixed(6)} ${(point.y * scaleY).toFixed(6)}`),
      "Z",
    ];
    groups[role].push(`<path d="${commands.join(" ")}" />`);
  });

  return {
    svg: [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width.toFixed(6)}in" height="${height.toFixed(6)}in" viewBox="0 0 ${width.toFixed(6)} ${height.toFixed(6)}">`,
      `<title>${title}</title>`,
      `<g id="CUT_FIRST_BLACK" fill="none" stroke="#000000" stroke-width="0.001">${groups.intact.join("")}</g>`,
      `<g id="CUT_SECOND_RED" fill="none" stroke="#ff0000" stroke-width="0.001">${groups.cut.join("")}</g>`,
      `</svg>`,
    ].join("\n"),
    width,
    height,
    pathCount: trace.paths.length,
  };
}

export function inspectLaserFile(trace, options = {}) {
  if (!trace?.paths?.length) {
    return { status: "unsafe", label: "Unsafe", issues: ["No vector paths found."], nodeCount: 0 };
  }
  const width = Math.max(0.01, Number(options.widthInches) || 1);
  const height = options.keepAspect !== false
    ? width / (trace.sourceWidth / trace.sourceHeight)
    : Math.max(0.01, Number(options.heightInches) || 1);
  const scaleX = width / trace.sourceWidth;
  const scaleY = height / trace.sourceHeight;
  const roles = options.pathRoles || [];
  let nodeCount = 0;
  let repeatedNodes = 0;
  let smallPieces = 0;
  const signatures = new Map();

  trace.paths.forEach((path, pathIndex) => {
    nodeCount += path.points.length;
    let minX = Infinity; let maxX = -Infinity; let minY = Infinity; let maxY = -Infinity;
    path.points.forEach((point, pointIndex) => {
      minX = Math.min(minX, point.x); maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y); maxY = Math.max(maxY, point.y);
      if (pointIndex > 0) {
        const previous = path.points[pointIndex - 1];
        if (Math.hypot(point.x - previous.x, point.y - previous.y) < 0.01) repeatedNodes += 1;
      }
    });
    const physicalWidth = (maxX - minX) * scaleX;
    const physicalHeight = (maxY - minY) * scaleY;
    if (roles[pathIndex] === "cut" && Math.max(physicalWidth, physicalHeight) < 0.08) smallPieces += 1;
    const normalized = path.points
      .filter((_, index) => index % Math.max(1, Math.floor(path.points.length / 12)) === 0)
      .map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`)
      .sort()
      .join("|");
    signatures.set(normalized, (signatures.get(normalized) || 0) + 1);
  });

  const duplicatePaths = [...signatures.values()].reduce((total, count) => total + Math.max(0, count - 1), 0);
  const issues = [];
  if (duplicatePaths) issues.push(`${duplicatePaths} possible duplicate path${duplicatePaths === 1 ? "" : "s"} could cut twice.`);
  if (repeatedNodes) issues.push(`${repeatedNodes} repeated node${repeatedNodes === 1 ? "" : "s"} should be reviewed.`);
  if (smallPieces) issues.push(`${smallPieces} red second-pass path${smallPieces === 1 ? " is" : "s are"} smaller than 0.08 inch.`);
  if (nodeCount > 5000) issues.push(`High node count (${nodeCount.toLocaleString()}) may cause rough or slow cutting.`);
  if (!roles.includes("cut")) issues.push("No red second-pass paths are selected.");
  const criticalCount = duplicatePaths + smallPieces;
  const status = criticalCount ? "unsafe" : issues.length ? "review" : "ready";
  return {
    status,
    label: status === "ready" ? "Ready" : status === "review" ? "Needs Review" : "Unsafe",
    issues,
    nodeCount,
    duplicatePaths,
    repeatedNodes,
    smallPieces,
    blackPathCount: roles.filter((role) => role !== "cut").length,
    redPathCount: roles.filter((role) => role === "cut").length,
    width,
    height,
  };
}

export function buildPreviewSvg(trace) {
  if (!trace?.paths?.length) return "";
  const pathMarkup = trace.paths.map((path) => {
    const [first, ...rest] = path.points;
    const commands = [`M ${first.x.toFixed(2)} ${first.y.toFixed(2)}`]
      .concat(rest.map((point) => `L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`))
      .join(" ");
    return `<path d="${commands} Z" fill="none" stroke="#ff3344" stroke-width="1" vector-effect="non-scaling-stroke" />`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${trace.sourceWidth} ${trace.sourceHeight}">${pathMarkup}</svg>`;
}
