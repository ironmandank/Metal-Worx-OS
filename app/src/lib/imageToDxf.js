import ImageTracer from "imagetracerjs";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

function normalizedClosedPoints(points) {
  if (points.length > 2 && distance(points[0], points[points.length - 1]) < 0.0001) {
    return points.slice(0, -1);
  }
  return points.slice();
}

function pointLineDistance(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (!dx && !dy) return distance(point, start);
  const t = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy), 0, 1);
  return distance(point, { x: start.x + t * dx, y: start.y + t * dy });
}

function simplifyOpenPoints(points, tolerance) {
  if (points.length <= 2) return points.slice();
  let farthestIndex = 0;
  let farthestDistance = 0;
  for (let index = 1; index < points.length - 1; index += 1) {
    const currentDistance = pointLineDistance(points[index], points[0], points[points.length - 1]);
    if (currentDistance > farthestDistance) {
      farthestDistance = currentDistance;
      farthestIndex = index;
    }
  }
  if (farthestDistance <= tolerance) return [points[0], points[points.length - 1]];
  const left = simplifyOpenPoints(points.slice(0, farthestIndex + 1), tolerance);
  const right = simplifyOpenPoints(points.slice(farthestIndex), tolerance);
  return [...left.slice(0, -1), ...right];
}

export function cleanTracePaths(trace, options = {}) {
  const width = Math.max(0.01, Number(options.widthInches) || 1);
  const height = options.keepAspect !== false
    ? width / (trace.sourceWidth / trace.sourceHeight)
    : Math.max(0.01, Number(options.heightInches) || 1);
  const toleranceInches = Math.max(0.0001, Number(options.toleranceInches) || 0.01);
  const tolerance = toleranceInches / ((width / trace.sourceWidth + height / trace.sourceHeight) / 2);
  const paths = trace.paths.map((path) => {
    const points = normalizedClosedPoints(path.points).filter((point, index, source) => (
      index === 0 || distance(point, source[index - 1]) > tolerance * 0.08
    ));
    if (points.length < 4) return { ...path, points };
    const anchorIndex = points.reduce((best, point, index) => (
      point.x < points[best].x || (point.x === points[best].x && point.y < points[best].y) ? index : best
    ), 0);
    const rotated = [...points.slice(anchorIndex), ...points.slice(0, anchorIndex), points[anchorIndex]];
    const simplified = simplifyOpenPoints(rotated, tolerance);
    return { ...path, points: simplified.slice(0, -1) };
  }).filter((path) => path.points.length >= 3);
  return { ...trace, paths };
}

function polygonArea(points) {
  return points.reduce((total, point, index) => {
    const next = points[(index + 1) % points.length];
    return total + point.x * next.y - next.x * point.y;
  }, 0) / 2;
}

function polygonCenter(points) {
  const area = polygonArea(points);
  if (Math.abs(area) < 0.0001) {
    return points.reduce((center, point) => ({ x: center.x + point.x / points.length, y: center.y + point.y / points.length }), { x: 0, y: 0 });
  }
  return points.reduce((center, point, index) => {
    const next = points[(index + 1) % points.length];
    const cross = point.x * next.y - next.x * point.y;
    return { x: center.x + (point.x + next.x) * cross / (6 * area), y: center.y + (point.y + next.y) * cross / (6 * area) };
  }, { x: 0, y: 0 });
}

function pointInPolygon(point, points) {
  let inside = false;
  for (let current = 0, previous = points.length - 1; current < points.length; previous = current, current += 1) {
    const a = points[current];
    const b = points[previous];
    if (((a.y > point.y) !== (b.y > point.y))
      && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y || Number.EPSILON) + a.x) inside = !inside;
  }
  return inside;
}

export function assignAutomaticCutOrder(trace) {
  const areas = trace.paths.map((path) => Math.abs(polygonArea(normalizedClosedPoints(path.points))));
  return trace.paths.map((path, pathIndex) => {
    const points = normalizedClosedPoints(path.points);
    const center = polygonCenter(points);
    const containers = trace.paths.filter((candidate, candidateIndex) => (
      candidateIndex !== pathIndex
      && areas[candidateIndex] > areas[pathIndex]
      && pointInPolygon(center, normalizedClosedPoints(candidate.points))
    )).length;
    return containers === 0 ? "cut" : "intact";
  });
}

export function buildCutSequence(trace, pathRoles = []) {
  const rank = { engrave: 0, intact: 1, cut: 2 };
  return trace.paths
    .map((path, pathIndex) => ({
      pathIndex,
      role: pathRoles[pathIndex] || "intact",
      area: Math.abs(polygonArea(normalizedClosedPoints(path.points))),
    }))
    .sort((a, b) => {
      const roleDifference = (rank[a.role] ?? 1) - (rank[b.role] ?? 1);
      if (roleDifference) return roleDifference;
      return a.area - b.area;
    })
    .map((entry, sequenceIndex) => ({ ...entry, sequence: sequenceIndex + 1 }));
}

export function buildAutomaticBridges(trace, options = {}) {
  const pathRoles = options.pathRoles || [];
  const existingBridges = options.bridges || [];
  const bridgesPerPath = Math.max(1, Math.min(4, Number(options.bridgesPerPath) || 2));
  const bridgedPaths = new Set(existingBridges.map((bridge) => bridge.pathIndex));
  const additions = [];

  trace.paths.forEach((_, pathIndex) => {
    if (pathRoles[pathIndex] !== "intact" || bridgedPaths.has(pathIndex)) return;
    for (let bridgeIndex = 0; bridgeIndex < bridgesPerPath; bridgeIndex += 1) {
      additions.push({
        pathIndex,
        position: (bridgeIndex + 0.5) / bridgesPerPath,
        automatic: true,
      });
    }
  });

  return [...existingBridges, ...additions];
}

export function findUnbridgedInteriorPaths(trace, options = {}) {
  const pathRoles = options.pathRoles || [];
  const bridgedPaths = new Set((options.bridges || []).map((bridge) => bridge.pathIndex));
  return trace.paths
    .map((_, pathIndex) => pathIndex)
    .filter((pathIndex) => pathRoles[pathIndex] === "intact" && !bridgedPaths.has(pathIndex));
}

export function pathLabelPoint(path) {
  return polygonCenter(normalizedClosedPoints(path.points));
}

function pathMetric(points) {
  const clean = normalizedClosedPoints(points);
  const edges = clean.map((point, index) => ({ start: point, end: clean[(index + 1) % clean.length] }));
  let total = 0;
  const cumulative = edges.map((edge) => {
    const startDistance = total;
    total += distance(edge.start, edge.end);
    return startDistance;
  });
  return { points: clean, edges, cumulative, total };
}

function pointAtDistance(metric, requestedDistance) {
  const target = clamp(requestedDistance, 0, metric.total);
  let edgeIndex = metric.edges.length - 1;
  for (let index = 0; index < metric.edges.length; index += 1) {
    if (target <= metric.cumulative[index] + distance(metric.edges[index].start, metric.edges[index].end)) {
      edgeIndex = index;
      break;
    }
  }
  const edge = metric.edges[edgeIndex];
  const edgeLength = distance(edge.start, edge.end) || 1;
  const t = clamp((target - metric.cumulative[edgeIndex]) / edgeLength, 0, 1);
  return { x: edge.start.x + (edge.end.x - edge.start.x) * t, y: edge.start.y + (edge.end.y - edge.start.y) * t };
}

export function pointOnClosedPath(points, position) {
  const metric = pathMetric(points);
  return pointAtDistance(metric, clamp(Number(position) || 0, 0, 1) * metric.total);
}

export function nearestPositionOnClosedPath(points, target) {
  const metric = pathMetric(points);
  let best = { position: 0, distance: Infinity };
  metric.edges.forEach((edge, edgeIndex) => {
    const dx = edge.end.x - edge.start.x;
    const dy = edge.end.y - edge.start.y;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared ? clamp(((target.x - edge.start.x) * dx + (target.y - edge.start.y) * dy) / lengthSquared, 0, 1) : 0;
    const candidate = { x: edge.start.x + dx * t, y: edge.start.y + dy * t };
    const candidateDistance = distance(candidate, target);
    if (candidateDistance < best.distance) {
      best = {
        distance: candidateDistance,
        position: (metric.cumulative[edgeIndex] + distance(edge.start, candidate)) / metric.total,
      };
    }
  });
  return best.position;
}

function mergeIntervals(intervals) {
  return intervals.sort((a, b) => a[0] - b[0]).reduce((merged, interval) => {
    const previous = merged[merged.length - 1];
    if (!previous || interval[0] > previous[1]) merged.push(interval.slice());
    else previous[1] = Math.max(previous[1], interval[1]);
    return merged;
  }, []);
}

function splitPathForBridges(points, positions, bridgeWidth) {
  const metric = pathMetric(points);
  if (!positions.length || bridgeWidth <= 0 || metric.total <= bridgeWidth) return [{ points: metric.points, closed: true }];
  const blocked = [];
  positions.forEach((position) => {
    const center = clamp(position, 0, 1) * metric.total;
    const start = center - bridgeWidth / 2;
    const end = center + bridgeWidth / 2;
    if (start < 0) blocked.push([0, end], [metric.total + start, metric.total]);
    else if (end > metric.total) blocked.push([start, metric.total], [0, end - metric.total]);
    else blocked.push([start, end]);
  });
  const merged = mergeIntervals(blocked);
  const kept = [];
  let cursor = 0;
  merged.forEach(([start, end]) => {
    if (start > cursor) kept.push([cursor, start]);
    cursor = Math.max(cursor, end);
  });
  if (cursor < metric.total) kept.push([cursor, metric.total]);
  return kept.filter(([start, end]) => end - start > 0.00001).map(([start, end]) => {
    const segmentPoints = [pointAtDistance(metric, start)];
    metric.cumulative.forEach((vertexDistance, index) => {
      if (vertexDistance > start && vertexDistance < end) segmentPoints.push(metric.points[index]);
    });
    segmentPoints.push(pointAtDistance(metric, end));
    return { points: segmentPoints, closed: false };
  });
}

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
  const scoreLayer = `${baseLayer}_SCORE_MARK_BLUE`;
  const cutLayer = `${baseLayer}_CUT_SECOND_RED`;
  const intactLayer = `${baseLayer}_CUT_FIRST_BLACK`;
  const pathRoles = options.pathRoles || [];
  const bridges = options.bridges || [];
  const bridgeWidth = Math.max(0, Number(options.bridgeWidthInches) || 0);
  const lines = [
    "0", "SECTION", "2", "HEADER",
    "9", "$ACADVER", "1", "AC1009",
    "9", "$INSUNITS", "70", "1",
    "9", "$MEASUREMENT", "70", "0",
    "9", "$EXTMIN", "10", "0.000000", "20", "0.000000", "30", "0.000000",
    "9", "$EXTMAX", "10", width.toFixed(6), "20", height.toFixed(6), "30", "0.000000",
    "0", "ENDSEC",
    "0", "SECTION", "2", "TABLES",
    "0", "TABLE", "2", "LAYER", "70", "3",
    "0", "LAYER", "2", scoreLayer, "70", "0", "62", "5", "6", "CONTINUOUS",
    "0", "LAYER", "2", cutLayer, "70", "0", "62", "1", "6", "CONTINUOUS",
    "0", "LAYER", "2", intactLayer, "70", "0", "62", "7", "6", "CONTINUOUS",
    "0", "ENDTAB", "0", "ENDSEC",
    "0", "SECTION", "2", "ENTITIES",
  ];

  trace.paths.forEach((path, pathIndex) => {
    const role = pathRoles[pathIndex];
    const layer = role === "cut" ? cutLayer : role === "engrave" ? scoreLayer : intactLayer;
    const color = role === "cut" ? "1" : role === "engrave" ? "5" : "7";
    const points = path.points.map((point) => ({
      x: clamp(point.x * scaleX, 0, width),
      y: clamp(height - point.y * scaleY, 0, height),
    }));
    const pathBridges = bridges.filter((bridge) => bridge.pathIndex === pathIndex).map((bridge) => bridge.position);
    const pieces = role === "engrave" ? [{ points, closed: true }] : splitPathForBridges(points, pathBridges, bridgeWidth);
    pieces.forEach((piece) => {
      lines.push("0", "POLYLINE", "8", layer, "62", color, "66", "1", "70", piece.closed ? "1" : "0");
      piece.points.forEach((point) => {
        lines.push(
          "0", "VERTEX", "8", layer, "62", color,
          "10", point.x.toFixed(6), "20", point.y.toFixed(6), "30", "0.000000",
          "70", "0",
        );
      });
      lines.push("0", "SEQEND", "8", layer);
    });
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
  const bridges = options.bridges || [];
  const bridgeWidth = Math.max(0, Number(options.bridgeWidthInches) || 0);
  const title = escapeXml(options.title || "Metal Worx Laser File");
  const groups = { engrave: [], intact: [], cut: [] };

  trace.paths.forEach((path, pathIndex) => {
    const requestedRole = pathRoles[pathIndex];
    const role = requestedRole === "cut" || requestedRole === "engrave" ? requestedRole : "intact";
    const points = path.points.map((point) => ({ x: point.x * scaleX, y: point.y * scaleY }));
    const pathBridges = bridges.filter((bridge) => bridge.pathIndex === pathIndex).map((bridge) => bridge.position);
    const pieces = role === "engrave" ? [{ points, closed: true }] : splitPathForBridges(points, pathBridges, bridgeWidth);
    pieces.forEach((piece) => {
      const [first, ...rest] = piece.points;
      const commands = [
        `M ${first.x.toFixed(6)} ${first.y.toFixed(6)}`,
        ...rest.map((point) => `L ${point.x.toFixed(6)} ${point.y.toFixed(6)}`),
        ...(piece.closed ? ["Z"] : []),
      ];
      groups[role].push(`<path d="${commands.join(" ")}" />`);
    });
  });

  return {
    svg: [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width.toFixed(6)}in" height="${height.toFixed(6)}in" viewBox="0 0 ${width.toFixed(6)} ${height.toFixed(6)}">`,
      `<title>${title}</title>`,
      `<g id="SCORE_MARK_BLUE" fill="none" stroke="#0000ff" stroke-width="0.001">${groups.engrave.join("")}</g>`,
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
  const bridges = options.bridges || [];
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
  const bridgedPathCount = new Set(bridges.map((bridge) => bridge.pathIndex)).size;
  const unbridgedInteriorPaths = findUnbridgedInteriorPaths(trace, { pathRoles: roles, bridges });
  if (unbridgedInteriorPaths.length) {
    issues.push(`${unbridgedInteriorPaths.length} black interior path${unbridgedInteriorPaths.length === 1 ? " has" : "s have"} no bridge. Confirm each one is intended scrap or add yellow bridges.`);
  }
  if (!bridges.length && roles.some((role) => role !== "engrave")) issues.push("No yellow bridges are placed; every black and red contour will cut completely free.");
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
    bridgeCount: bridges.length,
    bridgedPathCount,
    unbridgedInteriorPaths,
    engravePathCount: roles.filter((role) => role === "engrave").length,
    blackPathCount: roles.filter((role) => role === "intact").length,
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
