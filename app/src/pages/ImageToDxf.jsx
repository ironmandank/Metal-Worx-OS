import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  FileButton,
  Group,
  NumberInput,
  Paper,
  Progress,
  Select,
  SegmentedControl,
  Slider,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import {
  IconAlertTriangle,
  IconDownload,
  IconEye,
  IconEyeOff,
  IconPhoto,
  IconPlus,
  IconRefresh,
  IconScissors,
  IconTrash,
  IconArrowBackUp,
  IconArrowForwardUp,
  IconUpload,
} from "@tabler/icons-react";
import JSZip from "jszip";

import {
  buildCorelSvg,
  buildDxf,
  buildAutomaticBridges,
  buildCutSequence,
  buildSmoothPathData,
  assignAutomaticCutOrder,
  analyzeSourceArtwork,
  countTraceNodes,
  findUnbridgedInteriorPaths,
  getArtworkFileSupport,
  inspectLaserFile,
  nearestPositionOnClosedPath,
  pathLabelPoint,
  pointOnClosedPath,
  prepareBinaryImageData,
  reduceTraceToNodeBudget,
  fitRoundTracePaths,
  offsetTracePaths,
  straightenTracePaths,
  traceImageData,
} from "../lib/imageToDxf";

const styles = `
  .mw-dxf-grid { display:grid; grid-template-columns:minmax(290px, 370px) minmax(0, 1fr); gap:18px; }
  .mw-dxf-preview { min-height:520px; position:relative; overflow:hidden; border:1px solid #343c43; border-radius:12px; background-color:#f7f7f5; background-image:linear-gradient(#e6e6e6 1px,transparent 1px),linear-gradient(90deg,#e6e6e6 1px,transparent 1px); background-size:20px 20px; display:grid; place-items:center; padding:24px; }
  .mw-dxf-preview img { width:100%; height:100%; max-height:620px; object-fit:contain; }
  .mw-dxf-empty { color:#68727a; text-align:center; max-width:360px; }
  .mw-dxf-drop { border:1px dashed #5a646d; border-radius:10px; padding:18px; text-align:center; background:#11171b; }
  .mw-laser-legend { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:8px; }
  .mw-laser-key { border:1px solid #3c4349; border-radius:9px; padding:9px; background:#171b1f; }
  .mw-laser-swatch { width:13px; height:13px; border-radius:50%; display:inline-block; flex:0 0 auto; }
  @media (max-width:900px) { .mw-dxf-grid { grid-template-columns:1fr; } .mw-dxf-preview { min-height:390px; } }
  @media (max-width:650px) { .mw-laser-legend { grid-template-columns:1fr 1fr; } }
`;

const ARTWORK_ACCEPT = [
  "image/png", "image/jpeg", "image/webp", "image/bmp", "image/gif", "image/svg+xml", "image/tiff",
  "application/pdf", ".dxf", ".cdr", ".ai", ".eps", ".tif", ".tiff",
].join(",");

const TRACE_PRESETS = {
  logo: { label: "Simple Logo", smoothing: "balanced", nodeReduction: "production", speckleSize: 10, curveTension: 0.82, cornerAngle: 55 },
  detailed: { label: "Detailed Artwork", smoothing: "sharp", nodeReduction: "fine", speckleSize: 5, curveTension: 0.72, cornerAngle: 62 },
  text: { label: "Text / Lettering", smoothing: "sharp", nodeReduction: "production", speckleSize: 7, curveTension: 0.62, cornerAngle: 42 },
  round: { label: "Round Emblem", smoothing: "smooth", nodeReduction: "production", speckleSize: 8, curveTension: 0.9, cornerAngle: 70 },
  photo: { label: "Photo / Complex Image", smoothing: "smooth", nodeReduction: "aggressive", speckleSize: 18, curveTension: 0.86, cornerAngle: 65 },
};

const MATERIAL_PRESETS = {
  "Mild Steel": { kerf: 0.006, bridge: 0.04 },
  "Stainless Steel": { kerf: 0.005, bridge: 0.035 },
  Aluminum: { kerf: 0.008, bridge: 0.05 },
  Custom: { kerf: 0, bridge: 0.04 },
};

const CONSTRUCTION_MODES = [
  { value: "single", label: "Single-Layer Cutout" },
  { value: "two", label: "Two-Layer Sign" },
  { value: "multi", label: "Multi-Layer Assembly" },
];

const PHYSICAL_LAYER_COLORS = ["#767f88", "#ef233c", "#f59f00"];

function subsetTraceByLayer(trace, pathRoles, physicalLayers, layerIndex, bridges) {
  const keptIndexes = trace.paths.map((_, index) => index).filter((index) => physicalLayers[index] === layerIndex);
  const indexMap = new Map(keptIndexes.map((original, next) => [original, next]));
  return {
    trace: { ...trace, paths: keptIndexes.map((index) => trace.paths[index]) },
    pathRoles: keptIndexes.map((index) => pathRoles[index]),
    bridges: bridges.filter((bridge) => indexMap.has(bridge.pathIndex)).map((bridge) => ({ ...bridge, pathIndex: indexMap.get(bridge.pathIndex) })),
  };
}

function buildBackerSvg(width, height, style = "rounded", holes = []) {
  const radius = style === "rounded" ? Math.min(width, height) * 0.035 : 0;
  const holeMarkup = holes.map((hole) => `<circle cx="${hole.xInches.toFixed(6)}" cy="${hole.yInches.toFixed(6)}" r="${(hole.diameterInches / 2).toFixed(6)}" />`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${width.toFixed(6)}in" height="${height.toFixed(6)}in" viewBox="0 0 ${width.toFixed(6)} ${height.toFixed(6)}"><g id="BACKER_CUT_FIRST_BLACK" fill="none" stroke="#000000" stroke-width="0.001">${holeMarkup}</g><g id="BACKER_CUT_LAST_RED" fill="none" stroke="#ff0000" stroke-width="0.001"><rect x="0.01" y="0.01" width="${Math.max(0.01, width - 0.02).toFixed(6)}" height="${Math.max(0.01, height - 0.02).toFixed(6)}" rx="${radius.toFixed(6)}" /></g></svg>`;
}

function buildBackerTrace(width, height, style = "rounded", holes = []) {
  const radius = style === "rounded" ? Math.min(width, height) * 0.035 : 0;
  const steps = radius ? 8 : 1;
  const points = [];
  const corners = [
    { cx: width - radius, cy: radius, start: -Math.PI / 2 },
    { cx: width - radius, cy: height - radius, start: 0 },
    { cx: radius, cy: height - radius, start: Math.PI / 2 },
    { cx: radius, cy: radius, start: Math.PI },
  ];
  if (!radius) {
    points.push({ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: height }, { x: 0, y: height });
  } else {
    corners.forEach((corner) => {
      for (let step = 0; step <= steps; step += 1) {
        const angle = corner.start + (Math.PI / 2) * (step / steps);
        points.push({ x: corner.cx + Math.cos(angle) * radius, y: corner.cy + Math.sin(angle) * radius });
      }
    });
  }
  const holePaths = holes.map((hole) => ({
    points: Array.from({ length: 24 }, (_, index) => {
      const angle = Math.PI * 2 * index / 24;
      return { x: hole.xInches + Math.cos(angle) * hole.diameterInches / 2, y: hole.yInches + Math.sin(angle) * hole.diameterInches / 2 };
    }),
  }));
  return { sourceWidth: width, sourceHeight: height, paths: [...holePaths, { points }] };
}

function safeBaseName(name = "metal-worx-cut-file") {
  return name.replace(/\.[^.]+$/, "").replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "") || "metal-worx-cut-file";
}

function downloadText(contents, filename, type) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function createDemoArtwork() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="900" height="520" viewBox="0 0 900 520">
      <rect width="900" height="520" fill="white"/>
      <rect x="45" y="45" width="810" height="430" rx="32" fill="none" stroke="black" stroke-width="28"/>
      <circle cx="185" cy="260" r="92" fill="none" stroke="black" stroke-width="25"/>
      <path d="M125 320 L160 190 L190 270 L220 190 L250 320" fill="none" stroke="black" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/>
      <text x="315" y="245" font-family="Arial Black, Arial, sans-serif" font-size="86" font-weight="900" fill="black">METAL</text>
      <text x="315" y="345" font-family="Arial Black, Arial, sans-serif" font-size="86" font-weight="900" fill="black">WORX</text>
    </svg>`;
  return new File([svg], "Metal-Worx-DXF-Demo.svg", { type: "image/svg+xml" });
}

function ImageToDxf() {
  const canvasRef = useRef(null);
  const svgRef = useRef(null);
  const [file, setFile] = useState(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [trace, setTrace] = useState(null);
  const [pathRoles, setPathRoles] = useState([]);
  const [bridges, setBridges] = useState([]);
  const [bridgeWidth, setBridgeWidth] = useState(0.04);
  const [editMode, setEditMode] = useState("role");
  const [showNodes, setShowNodes] = useState(false);
  const [markingMode, setMarkingMode] = useState("engrave");
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [showBlackPaths, setShowBlackPaths] = useState(true);
  const [showRedPaths, setShowRedPaths] = useState(true);
  const [showEngravePaths, setShowEngravePaths] = useState(true);
  const [draggingNode, setDraggingNode] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [geometryUndoStack, setGeometryUndoStack] = useState([]);
  const [geometryRedoStack, setGeometryRedoStack] = useState([]);
  const [cutPreviewStage, setCutPreviewStage] = useState("all");
  const [previewZoom, setPreviewZoom] = useState(100);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [threshold, setThreshold] = useState(160);
  const [invert, setInvert] = useState(false);
  const [speckleSize, setSpeckleSize] = useState(8);
  const [smoothing, setSmoothing] = useState("balanced");
  const [nodeReduction, setNodeReduction] = useState("production");
  const [nodeReductionResult, setNodeReductionResult] = useState(null);
  const [width, setWidth] = useState(24);
  const [height, setHeight] = useState(24);
  const [lockRatio, setLockRatio] = useState(true);
  const [layerName, setLayerName] = useState("CUT");
  const [sourceAnalysis, setSourceAnalysis] = useState(null);
  const [sourceMessage, setSourceMessage] = useState("");
  const [productionApproved, setProductionApproved] = useState(false);
  const [tracePreset, setTracePreset] = useState("logo");
  const [curveTension, setCurveTension] = useState(0.82);
  const [cornerAngle, setCornerAngle] = useState(55);
  const [fitRounds, setFitRounds] = useState(true);
  const [straightenLines, setStraightenLines] = useState(true);
  const [showOriginal, setShowOriginal] = useState(false);
  const [material, setMaterial] = useState("Mild Steel");
  const [materialThickness, setMaterialThickness] = useState(0.075);
  const [kerfCompensation, setKerfCompensation] = useState(0);
  const [revision, setRevision] = useState("R1");
  const [approvalRequired, setApprovalRequired] = useState(false);
  const [customerApproved, setCustomerApproved] = useState(false);
  const [approvedBy, setApprovedBy] = useState("");
  const [constructionMode, setConstructionMode] = useState("single");
  const [physicalLayers, setPhysicalLayers] = useState([]);
  const [activePhysicalLayer, setActivePhysicalLayer] = useState(1);
  const [backerStyle, setBackerStyle] = useState("rounded");
  const [attachmentMethod, setAttachmentMethod] = useState("plug-weld");
  const [weldPoints, setWeldPoints] = useState([]);
  const [assemblyPointType, setAssemblyPointType] = useState("weld");
  const [registrationHoleDiameter, setRegistrationHoleDiameter] = useState(0.25);

  const fileSupport = useMemo(() => getArtworkFileSupport(file || {}), [file]);

  useEffect(() => {
    if (!file) return undefined;
    let disposed = false;
    let url = "";
    async function prepareSource() {
      setSourceUrl("");
      setSourceMessage("");
      try {
        if (fileSupport.renderMode === "pdf") {
          const pdfjs = await import("pdfjs-dist");
          const workerModule = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
          pdfjs.GlobalWorkerOptions.workerSrc = workerModule.default;
          const pdfDocument = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
          const page = await pdfDocument.getPage(1);
          const baseViewport = page.getViewport({ scale: 1 });
          const scale = Math.min(2.5, 1600 / Math.max(baseViewport.width, baseViewport.height));
          const viewport = page.getViewport({ scale });
          const pdfCanvas = window.document.createElement("canvas");
          pdfCanvas.width = Math.ceil(viewport.width);
          pdfCanvas.height = Math.ceil(viewport.height);
          await page.render({ canvasContext: pdfCanvas.getContext("2d"), viewport }).promise;
          const blob = await new Promise((resolve) => pdfCanvas.toBlob(resolve, "image/png"));
          if (!blob) throw new Error("The PDF preview could not be created.");
          url = URL.createObjectURL(blob);
          if (!disposed) {
            setSourceUrl(url);
            setSourceMessage(pdfDocument.numPages > 1 ? `Showing page 1 of ${pdfDocument.numPages}. Upload or export the correct design page if needed.` : "PDF page 1 is ready for tracing.");
          }
          return;
        }
        if (fileSupport.renderMode === "image") {
          url = URL.createObjectURL(file);
          if (!disposed) setSourceUrl(url);
          return;
        }
        setSourceMessage(fileSupport.guidance);
      } catch (prepareError) {
        if (!disposed) setSourceMessage(prepareError.message || "The artwork preview could not be prepared.");
      }
    }
    prepareSource();
    setTrace(null);
    setPathRoles([]);
    setBridges([]);
    setPhysicalLayers([]);
    setWeldPoints([]);
    setUndoStack([]);
    setRedoStack([]);
    setSelectedNode(null);
    setGeometryUndoStack([]);
    setGeometryRedoStack([]);
    setError("");
    setSourceAnalysis(null);
    setNodeReductionResult(null);
    setProductionApproved(false);
    return () => {
      disposed = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [file, fileSupport]);

  const productionTrace = useMemo(() => trace ? offsetTracePaths(trace, {
    widthInches: width, heightInches: height, keepAspect: lockRatio, offsetInches: kerfCompensation / 2,
  }) : null, [trace, width, height, lockRatio, kerfCompensation]);

  const physicalSize = useMemo(() => {
    if (!productionTrace) return null;
    return buildDxf(productionTrace, {
      widthInches: width,
      heightInches: height,
      keepAspect: lockRatio,
      layerName,
      pathRoles,
      bridges,
      bridgeWidthInches: bridgeWidth,
    });
  }, [productionTrace, width, height, lockRatio, layerName, pathRoles, bridges, bridgeWidth]);

  const svgExport = useMemo(() => {
    if (!productionTrace) return null;
    return buildCorelSvg(productionTrace, {
      widthInches: width,
      heightInches: height,
      keepAspect: lockRatio,
      pathRoles,
      bridges,
      bridgeWidthInches: bridgeWidth,
      title: file?.name,
      curveTension,
      cornerAngleDegrees: cornerAngle,
    });
  }, [productionTrace, width, height, lockRatio, pathRoles, bridges, bridgeWidth, file, curveTension, cornerAngle]);

  const inspection = useMemo(() => {
    if (!productionTrace) return null;
    return inspectLaserFile(productionTrace, {
      widthInches: width,
      heightInches: height,
      keepAspect: lockRatio,
      pathRoles,
      bridges,
      sourceAnalysis,
    });
  }, [productionTrace, width, height, lockRatio, pathRoles, bridges, sourceAnalysis]);

  const cutSequence = useMemo(
    () => (trace ? buildCutSequence(trace, pathRoles) : []),
    [trace, pathRoles],
  );

  const sequenceByPath = useMemo(
    () => new Map(cutSequence.map((entry) => [entry.pathIndex, entry.sequence])),
    [cutSequence],
  );

  const unbridgedInteriorPaths = useMemo(
    () => (trace ? findUnbridgedInteriorPaths(trace, { pathRoles, bridges }) : []),
    [trace, pathRoles, bridges],
  );

  const unbridgedPathSet = useMemo(
    () => new Set(unbridgedInteriorPaths),
    [unbridgedInteriorPaths],
  );

  const laserApprovalChecks = useMemo(() => [
    { label: "Artwork uploaded", pass: Boolean(file) },
    { label: "Vector paths created", pass: Boolean(trace?.paths?.length) },
    { label: "Finished size confirmed", pass: width > 0 && height > 0 },
    { label: "Outside cut path assigned", pass: pathRoles.includes("cut") },
    { label: "Production node count under 2,000", pass: Boolean(trace) && countTraceNodes(trace) <= 2000 },
    { label: "Retained interior pieces connected", pass: Boolean(trace) && unbridgedInteriorPaths.length === 0 },
    { label: "No critical preflight errors", pass: inspection?.status !== "unsafe" },
    ...(constructionMode === "single" ? [] : [
      { label: "Face-layer paths assigned", pass: physicalLayers.some((layer) => layer === 1) },
      { label: attachmentMethod === "plug-weld" ? "Weld locations marked" : "Attachment method selected", pass: attachmentMethod !== "plug-weld" || weldPoints.some((point) => (point.type || "weld") === "weld") },
    ]),
    { label: approvalRequired ? "Customer approval recorded" : "Customer approval not required", pass: !approvalRequired || customerApproved },
  ], [file, trace, width, height, pathRoles, unbridgedInteriorPaths, inspection, constructionMode, physicalLayers, attachmentMethod, weldPoints, approvalRequired, customerApproved]);
  const canApproveForLaser = laserApprovalChecks.every((check) => check.pass);

  const physicalLayerCounts = useMemo(() => physicalLayers.reduce((counts, layer) => {
    counts[layer] = (counts[layer] || 0) + 1;
    return counts;
  }, {}), [physicalLayers]);

  const physicalLayerPreviewPaths = useMemo(() => {
    if (!trace || constructionMode === "single") return {};
    return trace.paths.reduce((layers, path, index) => {
      const layer = physicalLayers[index] || 1;
      const pathData = buildSmoothPathData(path.points, { tension: curveTension, cornerAngleDegrees: cornerAngle });
      layers[layer] = `${layers[layer] || ""} ${pathData}`.trim();
      return layers;
    }, {});
  }, [trace, constructionMode, physicalLayers, curveTension, cornerAngle]);

  useEffect(() => {
    if (!trace) return;
    setPhysicalLayers((current) => trace.paths.map((_, index) => {
      if (constructionMode === "single") return 0;
      const existing = current[index];
      if (constructionMode === "two") return 1;
      return existing === 2 ? 2 : 1;
    }));
    if (constructionMode === "single") {
      setWeldPoints([]);
      setEditMode((current) => current === "layer" || current === "weld" ? "role" : current);
    }
    setActivePhysicalLayer((current) => constructionMode === "multi" ? Math.min(2, Math.max(1, current)) : 1);
  }, [constructionMode, trace]);

  useEffect(() => {
    setProductionApproved(false);
  }, [trace, pathRoles, bridges, width, height, bridgeWidth, curveTension, cornerAngle, kerfCompensation, material, materialThickness, revision, customerApproved, approvedBy, constructionMode, physicalLayers, backerStyle, attachmentMethod, weldPoints, registrationHoleDiameter]);

  function applyTracePreset(value) {
    const preset = TRACE_PRESETS[value];
    setTracePreset(value);
    setSmoothing(preset.smoothing);
    setNodeReduction(preset.nodeReduction);
    setSpeckleSize(preset.speckleSize);
    setCurveTension(preset.curveTension);
    setCornerAngle(preset.cornerAngle);
  }

  async function convertImage() {
    if (!file || !sourceUrl) return;
    setWorking(true);
    setError("");
    try {
      const image = new Image();
      image.src = sourceUrl;
      await image.decode();
      const maxDimension = 1400;
      const reduction = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = canvasRef.current;
      canvas.width = Math.max(1, Math.round(image.naturalWidth * reduction));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * reduction));
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const source = context.getImageData(0, 0, canvas.width, canvas.height);
      setSourceAnalysis(analyzeSourceArtwork(source));
      const binary = prepareBinaryImageData(source, { threshold, invert });
      const tolerance = smoothing === "smooth" ? 2.5 : smoothing === "sharp" ? 0.35 : 1;
      const nextTrace = traceImageData(binary, {
        lineTolerance: tolerance,
        curveTolerance: tolerance,
        speckleSize,
        curveSteps: smoothing === "smooth" ? 12 : 8,
      });
      if (!nextTrace.paths.length) {
        throw new Error("No cut lines were detected. Try moving the Detail Threshold or turning on Reverse Black / White.");
      }
      const reductionSettings = {
        fine: { toleranceInches: 0.008, targetNodes: 2400, maxToleranceInches: 0.025, passes: 1, strength: 0.18, minimumFeatureInches: 0.01 },
        production: { toleranceInches: 0.015, targetNodes: 1600, maxToleranceInches: 0.05, passes: 2, strength: 0.28, minimumFeatureInches: 0.025 },
        aggressive: { toleranceInches: 0.025, targetNodes: 1000, maxToleranceInches: 0.08, passes: 3, strength: 0.34, minimumFeatureInches: 0.04 },
      }[nodeReduction];
      const reductionResult = reduceTraceToNodeBudget(nextTrace, {
        widthInches: width,
        heightInches: height,
        keepAspect: lockRatio,
        ...reductionSettings,
      });
      let cleanedTrace = reductionResult.trace;
      if (straightenLines) cleanedTrace = straightenTracePaths(cleanedTrace, { angleToleranceDegrees: 3 });
      if (fitRounds) cleanedTrace = fitRoundTracePaths(cleanedTrace, { maximumErrorRatio: 0.035 });
      setNodeReductionResult(reductionResult);
      setTrace(cleanedTrace);
      setPathRoles(assignAutomaticCutOrder(cleanedTrace));
      setPhysicalLayers(cleanedTrace.paths.map(() => constructionMode === "single" ? 0 : 1));
      setWeldPoints([]);
      setBridges([]);
      setUndoStack([]);
      setRedoStack([]);
      setSelectedNode(null);
      setGeometryUndoStack([]);
      setGeometryRedoStack([]);
      if (lockRatio) setHeight(Number((width * nextTrace.sourceHeight / nextTrace.sourceWidth).toFixed(3)));
    } catch (conversionError) {
      setError(conversionError.message || "The image could not be converted.");
    } finally {
      setWorking(false);
    }
  }

  function applyRoles(nextRoles) {
    if (nextRoles.every((role, index) => role === pathRoles[index])) return;
    setUndoStack((current) => [...current.slice(-29), pathRoles]);
    setRedoStack([]);
    setPathRoles(nextRoles);
  }

  function markPath(index) {
    applyRoles(pathRoles.map((role, roleIndex) => (
      roleIndex === index ? markingMode : role
    )));
    if (markingMode === "engrave") setBridges((current) => current.filter((bridge) => bridge.pathIndex !== index));
  }

  function svgLocation(event) {
    if (!svgRef.current) return null;
    const point = svgRef.current.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const matrix = svgRef.current.getScreenCTM();
    return matrix ? point.matrixTransform(matrix.inverse()) : null;
  }

  function handlePathClick(event, pathIndex) {
    event.stopPropagation();
    if (editMode === "layer") {
      setPhysicalLayers((current) => current.map((layer, index) => index === pathIndex ? activePhysicalLayer : layer));
      return;
    }
    if (editMode === "weld") {
      const location = svgLocation(event);
      if (location) setWeldPoints((current) => [...current, { x: location.x, y: location.y, layer: physicalLayers[pathIndex] || 1, type: assemblyPointType }]);
      return;
    }
    if (editMode === "role") {
      markPath(pathIndex);
      return;
    }
    if (editMode !== "bridge") return;
    const location = svgLocation(event);
    if (!location || pathRoles[pathIndex] === "engrave") return;
    const position = nearestPositionOnClosedPath(trace.paths[pathIndex].points, location);
    if (bridges.some((bridge) => bridge.pathIndex === pathIndex && Math.abs(bridge.position - position) < 0.01)) return;
    rememberGeometry();
    setBridges((current) => [...current, { pathIndex, position }]);
  }

  function removeBridge(bridgeIndex) {
    rememberGeometry();
    setBridges((current) => current.filter((_, index) => index !== bridgeIndex));
  }

  function cleanAllPaths() {
    rememberGeometry();
    const reductionSettings = {
      fine: { toleranceInches: 0.008, targetNodes: 2400, maxToleranceInches: 0.025, passes: 1, strength: 0.18, minimumFeatureInches: 0.01 },
      production: { toleranceInches: 0.015, targetNodes: 1600, maxToleranceInches: 0.05, passes: 2, strength: 0.28, minimumFeatureInches: 0.025 },
      aggressive: { toleranceInches: 0.025, targetNodes: 1000, maxToleranceInches: 0.08, passes: 3, strength: 0.34, minimumFeatureInches: 0.04 },
    }[nodeReduction];
    const result = reduceTraceToNodeBudget(trace, { widthInches: width, heightInches: height, keepAspect: lockRatio, ...reductionSettings });
    setTrace(result.trace);
    setPathRoles(assignAutomaticCutOrder(result.trace));
    setBridges([]);
    setNodeReductionResult(result);
    setSelectedNode(null);
  }

  function clearAllBridges() {
    if (!bridges.length) return;
    rememberGeometry();
    setBridges([]);
  }

  function applyAutomaticOrder() {
    applyRoles(assignAutomaticCutOrder(trace));
    setEditMode("role");
  }

  function markAll(role) {
    applyRoles(pathRoles.map(() => role));
    setMarkingMode(role);
    if (role === "engrave") setBridges([]);
  }

  function undoRoles() {
    if (!undoStack.length) return;
    const previous = undoStack[undoStack.length - 1];
    setRedoStack((current) => [...current, pathRoles]);
    setUndoStack((current) => current.slice(0, -1));
    setPathRoles(previous);
  }

  function redoRoles() {
    if (!redoStack.length) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((current) => [...current, pathRoles]);
    setRedoStack((current) => current.slice(0, -1));
    setPathRoles(next);
  }

  function downloadDxf() {
    if (!physicalSize) return;
    downloadText(physicalSize.dxf, `${safeBaseName(file?.name)}-${physicalSize.width.toFixed(2)}in.dxf`, "application/dxf");
  }

  function downloadSvg() {
    if (!svgExport) return;
    downloadText(svgExport.svg, `${safeBaseName(file?.name)}-${svgExport.width.toFixed(2)}in.svg`, "image/svg+xml");
  }

  async function downloadProductionPackage() {
    if (!physicalSize || !svgExport || !inspection || !productionApproved) return;
    const baseName = `${safeBaseName(file?.name)}-${physicalSize.width.toFixed(2)}in`;
    const zip = new JSZip();
    zip.file(`${baseName}.dxf`, physicalSize.dxf);
    zip.file(`${baseName}.svg`, svgExport.svg);
    const scaledWeldPoints = weldPoints.map((point, index) => ({
      number: index + 1,
      type: point.type || "weld",
      layer: point.layer + 1,
      xInches: Number((point.x / trace.sourceWidth * physicalSize.width).toFixed(4)),
      yInches: Number((point.y / trace.sourceHeight * physicalSize.height).toFixed(4)),
      diameterInches: point.type === "registration-hole" ? registrationHoleDiameter : null,
    }));
    const registrationHoles = scaledWeldPoints.filter((point) => point.type === "registration-hole");
    const layerManifest = [];
    if (constructionMode !== "single") {
      const backerTrace = buildBackerTrace(physicalSize.width, physicalSize.height, backerStyle, registrationHoles);
      const backerDxf = buildDxf(backerTrace, {
        widthInches: physicalSize.width,
        heightInches: physicalSize.height,
        keepAspect: false,
        layerName: "LAYER-1-BACKER",
        pathRoles: [...registrationHoles.map(() => "intact"), "cut"],
        bridges: [],
        bridgeWidthInches: bridgeWidth,
      });
      zip.file("LAYERS/LAYER-1-BACKER.svg", buildBackerSvg(physicalSize.width, physicalSize.height, backerStyle, registrationHoles));
      zip.file("LAYERS/LAYER-1-BACKER.dxf", backerDxf.dxf);
      layerManifest.push({ layer: 1, name: "Backer", generated: true, pathCount: 1 + registrationHoles.length, registrationHoleCount: registrationHoles.length });

      const lastLayer = constructionMode === "multi" ? 2 : 1;
      for (let layerIndex = 1; layerIndex <= lastLayer; layerIndex += 1) {
        const subset = subsetTraceByLayer(productionTrace, pathRoles, physicalLayers, layerIndex, bridges);
        if (!subset.trace.paths.length) continue;
        const number = layerIndex + 1;
        const name = layerIndex === 1 ? "FACE" : "ACCENT";
        const layerSvg = buildCorelSvg(subset.trace, {
          widthInches: width,
          heightInches: height,
          keepAspect: lockRatio,
          pathRoles: subset.pathRoles,
          bridges: subset.bridges,
          bridgeWidthInches: bridgeWidth,
          title: `${file?.name || "Artwork"} — Layer ${number} ${name}`,
          curveTension,
          cornerAngleDegrees: cornerAngle,
        });
        const layerDxf = buildDxf(subset.trace, {
          widthInches: width,
          heightInches: height,
          keepAspect: lockRatio,
          layerName: `LAYER-${number}-${name}`,
          pathRoles: subset.pathRoles,
          bridges: subset.bridges,
          bridgeWidthInches: bridgeWidth,
        });
        zip.file(`LAYERS/LAYER-${number}-${name}.svg`, layerSvg.svg);
        zip.file(`LAYERS/LAYER-${number}-${name}.dxf`, layerDxf.dxf);
        layerManifest.push({ layer: number, name, generated: false, pathCount: subset.trace.paths.length });
      }
    }
    zip.file("ASSEMBLY-PLAN.json", JSON.stringify({
      constructionMode,
      attachmentMethod,
      backerStyle: constructionMode === "single" ? null : backerStyle,
      layers: constructionMode === "single" ? [{ layer: 1, name: "Single cut piece", pathCount: trace.paths.length }] : layerManifest,
      weldOrRegistrationPoints: scaledWeldPoints,
      note: "Confirm face orientation, material, offsets, and attachment locations before cutting or welding.",
    }, null, 2));
    zip.file("PRODUCTION-INSPECTION.json", JSON.stringify({
      sourceFile: file?.name || "Untitled artwork",
      generatedAt: new Date().toISOString(),
      finishedSizeInches: { width: physicalSize.width, height: physicalSize.height },
      corelDraw: "CorelDRAW 2021 compatible DXF (R12/AC1009) and layered SVG",
      preferredLaserFile: `${baseName}.svg — fitted curves and sharp corners`,
      compatibilityFile: `${baseName}.dxf — segmented R12 fallback`,
      revision,
      material: { name: material, thicknessInches: materialThickness, kerfInches: kerfCompensation },
      approval: { required: approvalRequired, customerApproved, approvedBy: approvedBy || null },
      construction: { mode: constructionMode, attachmentMethod, backerStyle: constructionMode === "single" ? null : backerStyle, layers: layerManifest, weldOrRegistrationPoints: scaledWeldPoints },
      layerWorkflow: {
        blue: "Score or mark only",
        black: "Interior cut first; add bridges to retained pieces",
        red: "Outside perimeter cut last",
        yellow: "Preview marker for an actual uncut bridge gap",
      },
      inspection,
      cutSequence,
    }, null, 2));
    zip.file("READ-ME-FIRST.txt", [
      "METAL WORX LASER PRODUCTION PACKAGE",
      "",
      `Source: ${file?.name || "Untitled artwork"}`,
      `Finished size: ${physicalSize.width.toFixed(3)} x ${physicalSize.height.toFixed(3)} inches`,
      `Inspection: ${inspection.label}`,
      `Revision: ${revision}`,
      `Material: ${material}, ${materialThickness.toFixed(3)} inch`,
      `Kerf compensation: ${kerfCompensation.toFixed(4)} inch`,
      `Customer approval: ${approvalRequired ? (customerApproved ? `YES${approvedBy ? ` — ${approvedBy}` : ""}` : "REQUIRED — NOT RECORDED") : "NOT REQUIRED"}`,
      `Construction: ${CONSTRUCTION_MODES.find((mode) => mode.value === constructionMode)?.label}`,
      `Attachment: ${attachmentMethod}`,
      ...(constructionMode === "single" ? [] : [
        `Backer: ${backerStyle}`,
        `Assembly points: ${scaledWeldPoints.length}`,
        "Separate cut files are inside the LAYERS folder.",
      ]),
      "",
      "BLUE = score/mark only",
      "BLACK = interior cut first",
      "RED = outside perimeter cut last",
      "YELLOW = uncut bridge location shown in the app preview",
      "",
      "PREFERRED: Open the SMOOTH SVG in CorelDRAW 2021. It preserves fitted curves and intentional sharp corners.",
      "FALLBACK: The DXF is an R12 segmented compatibility file.",
      "Complete a final visual inspection before sending either file to the laser.",
      ...inspection.issues.map((issue) => `REVIEW: ${issue}`),
    ].join("\n"));
    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${baseName}-production-package.zip`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function loadDemo() {
    setFile(createDemoArtwork());
  }

  function rememberGeometry() {
    setGeometryUndoStack((current) => [
      ...current.slice(-29),
      { trace, bridges, selectedNode },
    ]);
    setGeometryRedoStack([]);
  }

  function undoGeometry() {
    if (!geometryUndoStack.length) return;
    const previous = geometryUndoStack[geometryUndoStack.length - 1];
    setGeometryRedoStack((current) => [...current, { trace, bridges, selectedNode }]);
    setGeometryUndoStack((current) => current.slice(0, -1));
    setTrace(previous.trace);
    setBridges(previous.bridges);
    setSelectedNode(previous.selectedNode);
  }

  function redoGeometry() {
    if (!geometryRedoStack.length) return;
    const next = geometryRedoStack[geometryRedoStack.length - 1];
    setGeometryUndoStack((current) => [...current, { trace, bridges, selectedNode }]);
    setGeometryRedoStack((current) => current.slice(0, -1));
    setTrace(next.trace);
    setBridges(next.bridges);
    setSelectedNode(next.selectedNode);
  }

  function updateSelectedPath(updater) {
    if (!selectedNode) return;
    rememberGeometry();
    setTrace((current) => ({
      ...current,
      paths: current.paths.map((path, pathIndex) => (
        pathIndex === selectedNode.pathIndex ? updater(path) : path
      )),
    }));
  }

  function addNodeAfterSelected() {
    if (!selectedNode) return;
    updateSelectedPath((path) => {
      const nextIndex = (selectedNode.nodeIndex + 1) % path.points.length;
      const currentPoint = path.points[selectedNode.nodeIndex];
      const nextPoint = path.points[nextIndex];
      const points = path.points.slice();
      points.splice(selectedNode.nodeIndex + 1, 0, {
        x: (currentPoint.x + nextPoint.x) / 2,
        y: (currentPoint.y + nextPoint.y) / 2,
      });
      return { ...path, points };
    });
    setSelectedNode((current) => ({ ...current, nodeIndex: current.nodeIndex + 1 }));
  }

  function deleteSelectedNode() {
    if (!selectedNode || trace.paths[selectedNode.pathIndex].points.length <= 3) return;
    updateSelectedPath((path) => ({
      ...path,
      points: path.points.filter((_, nodeIndex) => nodeIndex !== selectedNode.nodeIndex),
    }));
    setSelectedNode(null);
  }

  function deleteSelectedPath() {
    if (!selectedNode) return;
    const removedIndex = selectedNode.pathIndex;
    rememberGeometry();
    setTrace((current) => ({ ...current, paths: current.paths.filter((_, index) => index !== removedIndex) }));
    setPathRoles((current) => current.filter((_, index) => index !== removedIndex));
    setPhysicalLayers((current) => current.filter((_, index) => index !== removedIndex));
    setBridges((current) => current.filter((bridge) => bridge.pathIndex !== removedIndex).map((bridge) => ({ ...bridge, pathIndex: bridge.pathIndex > removedIndex ? bridge.pathIndex - 1 : bridge.pathIndex })));
    setSelectedNode(null);
  }

  function straightenSelectedNode(axis) {
    if (!selectedNode) return;
    updateSelectedPath((path) => {
      const previousIndex = (selectedNode.nodeIndex - 1 + path.points.length) % path.points.length;
      return {
        ...path,
        points: path.points.map((point, nodeIndex) => (
          nodeIndex !== selectedNode.nodeIndex
            ? point
            : {
              ...point,
              [axis]: path.points[previousIndex][axis],
            }
        )),
      };
    });
  }

  function addAutomaticBridges() {
    if (!trace) return;
    rememberGeometry();
    setBridges(buildAutomaticBridges(trace, {
      pathRoles,
      bridges,
      bridgesPerPath: 2,
    }));
  }

  function beginNodeDrag(event, pathIndex, nodeIndex) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    rememberGeometry();
    setSelectedNode({ pathIndex, nodeIndex });
    setDraggingNode({ pathIndex, nodeIndex });
  }

  function moveNode(event) {
    if (!draggingNode || !svgRef.current) return;
    event.preventDefault();
    const point = svgRef.current.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const matrix = svgRef.current.getScreenCTM();
    if (!matrix) return;
    const location = point.matrixTransform(matrix.inverse());
    setTrace((current) => ({
      ...current,
      paths: current.paths.map((path, pathIndex) => (
        pathIndex !== draggingNode.pathIndex
          ? path
          : {
            ...path,
            points: path.points.map((node, nodeIndex) => (
              nodeIndex === draggingNode.nodeIndex
                ? {
                  x: Math.max(0, Math.min(current.sourceWidth, location.x)),
                  y: Math.max(0, Math.min(current.sourceHeight, location.y)),
                }
                : node
            )),
          }
      )),
    }));
  }

  function endNodeDrag() {
    setDraggingNode(null);
  }

  function addWeldPoint(event) {
    if (editMode !== "weld" || !trace) return;
    const location = svgLocation(event);
    if (!location) return;
    setWeldPoints((current) => [...current, { x: location.x, y: location.y, layer: activePhysicalLayer, type: assemblyPointType }]);
  }

  return (
    <div style={{ padding: "22px", maxWidth: 1500, margin: "0 auto" }}>
      <style>{styles}</style>
      <canvas ref={canvasRef} hidden />
      <Group justify="space-between" align="flex-start" mb="lg">
        <div>
          <Group gap="xs" mb={4}><IconScissors color="#ef233c" /><Badge color="red" variant="light">Design Tool</Badge></Group>
          <Title order={1}>Image to Laser DXF</Title>
          <Text c="dimmed">Turn customer artwork into full-scale cut paths for CorelDRAW.</Text>
        </div>
        {physicalSize && <Badge size="lg" color="green">{physicalSize.pathCount} vector paths</Badge>}
      </Group>

      <Paper withBorder p="sm" radius="md" mb="md">
        <Text fw={900} mb="xs">Laser Workflow — What Each Color Means</Text>
        <div className="mw-laser-legend">
          <div className="mw-laser-key"><Group gap="xs" wrap="nowrap"><span className="mw-laser-swatch" style={{ background: "#0000ff" }} /><div><Text fw={800} size="sm">Blue</Text><Text size="xs" c="dimmed">Score or mark only</Text></div></Group></div>
          <div className="mw-laser-key"><Group gap="xs" wrap="nowrap"><span className="mw-laser-swatch" style={{ background: "#111111", border: "1px solid #777" }} /><div><Text fw={800} size="sm">Black</Text><Text size="xs" c="dimmed">Interior cut first</Text></div></Group></div>
          <div className="mw-laser-key"><Group gap="xs" wrap="nowrap"><span className="mw-laser-swatch" style={{ background: "#ff0000" }} /><div><Text fw={800} size="sm">Red</Text><Text size="xs" c="dimmed">Outside cut last</Text></div></Group></div>
          <div className="mw-laser-key"><Group gap="xs" wrap="nowrap"><span className="mw-laser-swatch" style={{ background: "#ffd43b", border: "2px solid #8a6500" }} /><div><Text fw={800} size="sm">Yellow</Text><Text size="xs" c="dimmed">Uncut bridge; stays attached</Text></div></Group></div>
        </div>
      </Paper>

      <div className="mw-dxf-grid">
        <Stack gap="md">
          <Paper withBorder p="md" radius="md">
            <Stack gap="md">
              <div><Text fw={900}>Choose how this sign is built</Text><Text size="sm" c="dimmed">This controls the cut files and assembly plan in the production package.</Text></div>
              <SegmentedControl fullWidth value={constructionMode} onChange={setConstructionMode} data={CONSTRUCTION_MODES} />
              {constructionMode === "single" ? <Alert color="gray" variant="light">One metal piece with cutouts, scoring, and bridges as needed.</Alert> : <>
                <Select label="Backer shape" value={backerStyle} onChange={(value) => setBackerStyle(value || "rounded")} data={[{ value: "rounded", label: "Rounded rectangle" }, { value: "rectangle", label: "Square-corner rectangle" }]} />
                <Select label="How the layers attach" value={attachmentMethod} onChange={(value) => setAttachmentMethod(value || "plug-weld")} data={[{ value: "plug-weld", label: "Plug weld / weld points" }, { value: "studs", label: "Studs / standoffs" }, { value: "adhesive", label: "Industrial adhesive" }, { value: "decide-later", label: "Decide during fabrication" }]} />
                <Alert color="red" variant="light">Layer 1 is the generated backer. Assign the traced artwork to the face and optional accent layers in the preview.</Alert>
              </>}
            </Stack>
          </Paper>
          <Paper withBorder p="md" radius="md">
            <Stack gap="md">
              <div>
                <Text fw={900} mb={4}>1. Upload the artwork</Text>
                <Text size="sm" c="dimmed">Accepts PDF, SVG, PNG, JPG, WebP, BMP, GIF, TIFF, DXF, AI, EPS, and CorelDRAW files.</Text>
              </div>
              <Group grow>
                <FileButton onChange={setFile} accept={ARTWORK_ACCEPT}>
                  {(props) => <Button {...props} leftSection={<IconUpload size={18} />} color="red" variant={file ? "light" : "filled"}>{file ? "Choose Different Artwork" : "Choose Artwork File"}</Button>}
                </FileButton>
                <Button variant="outline" color="gray" leftSection={<IconPhoto size={18} />} onClick={loadDemo}>Load Sample Design</Button>
              </Group>
              {file && <div className="mw-dxf-drop"><IconPhoto size={25} color="#ef233c" /><Text fw={800} size="sm">{file.name}</Text><Group justify="center" gap="xs" mt={4}><Badge variant="light" color={fileSupport.canTrace ? "green" : "yellow"}>{fileSupport.kind}</Badge><Text size="xs" c="dimmed">{(file.size / 1024 / 1024).toFixed(2)} MB</Text></Group><Text size="xs" c="dimmed" mt={6}>{sourceMessage || fileSupport.guidance}</Text></div>}
            </Stack>
          </Paper>

          <Paper withBorder p="md" radius="md">
            <Stack gap="md">
              <div><Text fw={900}>2. Clean up the cut lines</Text><Text size="sm" c="dimmed">Adjust these only when the preview misses part of the design.</Text></div>
              <Select label="Artwork type" description="Starts with settings suited to this kind of design" value={tracePreset} onChange={(value) => applyTracePreset(value || "logo")} data={Object.entries(TRACE_PRESETS).map(([value, preset]) => ({ value, label: preset.label }))} />
              <div><Group justify="space-between"><Text size="sm" fw={700}>Detail Threshold</Text><Text size="sm" c="dimmed">{threshold}</Text></Group><Slider value={threshold} onChange={setThreshold} min={20} max={235} color="red" /></div>
              <Checkbox checked={invert} onChange={(event) => setInvert(event.currentTarget.checked)} label="Reverse black and white" />
              <div><Group justify="space-between"><Text size="sm" fw={700}>Remove Small Specks</Text><Text size="sm" c="dimmed">{speckleSize}px</Text></Group><Slider value={speckleSize} onChange={setSpeckleSize} min={0} max={40} color="red" /></div>
              <div><Text size="sm" fw={700} mb={6}>Line Style</Text><SegmentedControl fullWidth value={smoothing} onChange={setSmoothing} data={[{ label: "Sharp", value: "sharp" }, { label: "Balanced", value: "balanced" }, { label: "Smooth", value: "smooth" }]} /></div>
              <div><Group justify="space-between"><Text size="sm" fw={700}>Curve Strength</Text><Text size="sm" c="dimmed">{Math.round(curveTension * 100)}%</Text></Group><Slider value={curveTension} onChange={setCurveTension} min={0.35} max={1} step={0.01} color="blue" /></div>
              <div><Group justify="space-between"><Text size="sm" fw={700}>Corner Protection</Text><Text size="sm" c="dimmed">{cornerAngle}°</Text></Group><Slider value={cornerAngle} onChange={setCornerAngle} min={30} max={80} step={1} color="red" /><Text size="xs" c="dimmed">Lower values protect more corners. Higher values allow more rounding.</Text></div>
              <Checkbox checked={straightenLines} onChange={(event) => setStraightenLines(event.currentTarget.checked)} label="Straighten nearly horizontal and vertical lines" />
              <Checkbox checked={fitRounds} onChange={(event) => setFitRounds(event.currentTarget.checked)} label="Recognize and rebuild circular contours" />
              <div>
                <Text size="sm" fw={700} mb={6}>Production Node Reduction</Text>
                <SegmentedControl fullWidth value={nodeReduction} onChange={setNodeReduction} data={[{ label: "Fine", value: "fine" }, { label: "Production", value: "production" }, { label: "Aggressive", value: "aggressive" }]} />
                <Text size="xs" c="dimmed" mt={5}>Production smooths pixel stair-steps first, then targets about 1,600 nodes. Genuine long corners are protected.</Text>
              </div>
              <Button onClick={convertImage} disabled={!file || !sourceUrl || !fileSupport.canTrace} loading={working} leftSection={<IconRefresh size={18} />} color="red">Create Cut-Line Preview</Button>
              {nodeReductionResult && <Alert color={nodeReductionResult.nodeCount <= 1600 ? "green" : nodeReductionResult.nodeCount <= 2000 ? "yellow" : "red"} variant="light">
                Node cleanup reduced {nodeReductionResult.originalNodeCount.toLocaleString()} nodes to {nodeReductionResult.nodeCount.toLocaleString()} using a {nodeReductionResult.toleranceInches.toFixed(3)}-inch tolerance.
              </Alert>}
              {file && !fileSupport.canTrace && <Alert color="yellow" variant="light" icon={<IconAlertTriangle size={18} />}>{fileSupport.guidance}</Alert>}
              {working && <Progress value={100} animated color="red" />}
            </Stack>
          </Paper>

          <Paper withBorder p="md" radius="md">
            <Stack gap="md">
              <div><Text fw={900}>3. Set finished size</Text><Text size="sm" c="dimmed">DXF exports in inches at this exact size.</Text></div>
              <Group grow align="flex-start">
                <NumberInput label="Width (in)" value={width} onChange={(value) => { setWidth(Number(value) || 0); if (lockRatio && trace) setHeight(Number(((Number(value) || 0) * trace.sourceHeight / trace.sourceWidth).toFixed(3))); }} min={0.01} decimalScale={3} />
                <NumberInput label="Height (in)" value={height} onChange={(value) => setHeight(Number(value) || 0)} min={0.01} decimalScale={3} disabled={lockRatio} />
              </Group>
              <Checkbox checked={lockRatio} onChange={(event) => setLockRatio(event.currentTarget.checked)} label="Keep the image proportions" />
              <TextInput label="CorelDRAW layer prefix" value={layerName} onChange={(event) => setLayerName(event.currentTarget.value)} />
              <NumberInput label="Bridge width (in)" description="Actual uncut connection left in the metal" value={bridgeWidth} onChange={(value) => setBridgeWidth(Math.max(0.005, Number(value) || 0.04))} min={0.005} max={0.5} step={0.005} decimalScale={3} />
              <Select label="Material" value={material} onChange={(value) => { const next = value || "Custom"; setMaterial(next); setBridgeWidth(MATERIAL_PRESETS[next].bridge); setKerfCompensation(MATERIAL_PRESETS[next].kerf); }} data={Object.keys(MATERIAL_PRESETS)} />
              <Group grow align="flex-start"><NumberInput label="Thickness (in)" value={materialThickness} onChange={(value) => setMaterialThickness(Math.max(0, Number(value) || 0))} min={0} max={2} step={0.005} decimalScale={3} /><NumberInput label="Kerf (in)" description="Offsets each contour by half this value" value={kerfCompensation} onChange={(value) => setKerfCompensation(Math.max(0, Number(value) || 0))} min={0} max={0.1} step={0.001} decimalScale={4} /></Group>
              <Group grow align="flex-start"><TextInput label="File revision" value={revision} onChange={(event) => setRevision(event.currentTarget.value)} /><TextInput label="Approved by" placeholder="Customer or reviewer" value={approvedBy} onChange={(event) => setApprovedBy(event.currentTarget.value)} /></Group>
              <Checkbox checked={approvalRequired} onChange={(event) => { setApprovalRequired(event.currentTarget.checked); if (!event.currentTarget.checked) setCustomerApproved(false); }} label="Customer approval is required" />
              {approvalRequired && <Checkbox checked={customerApproved} onChange={(event) => setCustomerApproved(event.currentTarget.checked)} label="Customer approved this exact design revision" />}
              <Checkbox checked={showNodes} onChange={(event) => setShowNodes(event.currentTarget.checked)} label="Show vector nodes while using Edit Nodes" />
              <Paper withBorder radius="md" p="sm">
                <Stack gap={6}>
                  <Group justify="space-between"><Text fw={900} size="sm">Laser Readiness Gate</Text><Badge color={productionApproved ? "green" : canApproveForLaser ? "blue" : "yellow"}>{productionApproved ? "LASER READY" : canApproveForLaser ? "READY TO APPROVE" : "IN REVIEW"}</Badge></Group>
                  {laserApprovalChecks.map((check) => <Group key={check.label} justify="space-between" gap="xs"><Text size="xs">{check.label}</Text><Badge size="xs" color={check.pass ? "green" : "gray"}>{check.pass ? "PASS" : "NEEDED"}</Badge></Group>)}
                  <Button color="green" disabled={!canApproveForLaser} onClick={() => setProductionApproved(true)}>Approve File for Laser</Button>
                  <Text size="xs" c="dimmed">Any path, bridge, size, or node change removes approval and requires another check.</Text>
                </Stack>
              </Paper>
              <Button onClick={downloadSvg} disabled={!trace} leftSection={<IconDownload size={18} />} color="blue" size="lg">Download Smooth CorelDRAW SVG</Button>
              <Button onClick={downloadDxf} disabled={!trace} leftSection={<IconDownload size={18} />} variant="light" color="gray">Download Segmented DXF Compatibility File</Button>
              <Button onClick={downloadProductionPackage} disabled={!productionApproved} leftSection={<IconDownload size={18} />} color="green">Download Laser-Ready Production Package</Button>
              {physicalSize && <Text size="sm" ta="center" c="dimmed">Export size: {physicalSize.width.toFixed(3)} × {physicalSize.height.toFixed(3)} inches</Text>}
            </Stack>
          </Paper>
        </Stack>

        <Paper withBorder p="md" radius="md">
          <Group justify="space-between" mb="sm"><Text fw={900}>Laser Path Preview</Text><Badge variant="outline" color={trace ? "red" : "gray"}>{trace ? "Click a path to change its purpose" : "Waiting for image"}</Badge></Group>
          {trace && <Stack mb="sm" gap="xs">
            <SegmentedControl
              fullWidth
              value={editMode}
              onChange={(value) => {
                setEditMode(value);
                if (value === "node") setShowNodes(true);
              }}
              data={[
                { label: "Assign Path Color", value: "role" },
                { label: "Add Yellow Bridge", value: "bridge" },
                ...(constructionMode !== "single" ? [{ label: "Assign Build Layer", value: "layer" }, { label: "Add Weld / Register", value: "weld" }] : []),
                { label: "Edit Nodes", value: "node" },
              ]}
              color={editMode === "bridge" ? "yellow" : editMode === "node" ? "blue" : editMode === "layer" ? "orange" : editMode === "weld" ? "grape" : "red"}
            />
            {constructionMode !== "single" && (editMode === "layer" || editMode === "weld") && <Paper p="sm" withBorder radius="md">
              <Stack gap="xs">
                <Group justify="space-between"><Text fw={900} size="sm">Physical Build Layers</Text><Group gap={5}><Badge color="gray">Backer generated</Badge><Badge color="red">Face {physicalLayerCounts[1] || 0}</Badge>{constructionMode === "multi" && <Badge color="orange">Accent {physicalLayerCounts[2] || 0}</Badge>}</Group></Group>
                <SegmentedControl
                  fullWidth
                  value={String(activePhysicalLayer)}
                  onChange={(value) => setActivePhysicalLayer(Number(value))}
                  data={constructionMode === "multi" ? [{ value: "1", label: "Layer 2 — Face" }, { value: "2", label: "Layer 3 — Accent" }] : [{ value: "1", label: "Layer 2 — Face" }]}
                />
                {editMode === "weld" && <>
                  <SegmentedControl fullWidth value={assemblyPointType} onChange={setAssemblyPointType} data={[{ value: "weld", label: "Weld Location" }, { value: "registration-hole", label: "Backer Registration Hole" }]} />
                  {assemblyPointType === "registration-hole" && <NumberInput label="Registration hole diameter (in)" value={registrationHoleDiameter} onChange={(value) => setRegistrationHoleDiameter(Math.max(0.03, Number(value) || 0.25))} min={0.03} max={2} step={0.01} decimalScale={3} />}
                </>}
                <Text size="xs" c="dimmed">{editMode === "layer" ? "Click each contour to place it on the selected physical layer." : "Click anywhere on the design to add an attachment or registration location. Click a marker to remove it."}</Text>
              </Stack>
            </Paper>}
            {constructionMode !== "single" && <Group gap="xs">
              <Badge color="gray" variant="filled">Off-color = backer / revealed area</Badge>
              <Badge color="gray" variant="outline" styles={{ root: { background: "#fff", color: "#222" } }}>White = retained face metal</Badge>
            </Group>}
            <SegmentedControl
              fullWidth
              value={markingMode}
              onChange={setMarkingMode}
              data={[
                { label: "Mark Blue — Score/Mark", value: "engrave" },
                { label: "Mark Black — Cut First", value: "intact" },
                { label: "Mark Red — Cut Second", value: "cut" },
              ]}
              color={markingMode === "cut" ? "red" : markingMode === "engrave" ? "blue" : "dark"}
            />
            <Group justify="space-between">
              <Group gap="xs">
                <Button size="compact-sm" variant="default" leftSection={<IconArrowBackUp size={15} />} disabled={!undoStack.length} onClick={undoRoles}>Undo</Button>
                <Button size="compact-sm" variant="default" leftSection={<IconArrowForwardUp size={15} />} disabled={!redoStack.length} onClick={redoRoles}>Redo</Button>
                <Button size="compact-sm" variant="light" color="gray" onClick={cleanAllPaths}>Clean / Straighten Nodes</Button>
                <Button size="compact-sm" variant="light" color="red" onClick={applyAutomaticOrder}>Auto Cut Order</Button>
                <Button size="compact-sm" variant="light" color="yellow" disabled={!unbridgedInteriorPaths.length} onClick={addAutomaticBridges}>Auto Add Bridges</Button>
                <Button size="compact-sm" variant="light" color="yellow" disabled={!bridges.length} onClick={clearAllBridges}>Clear Bridges</Button>
              </Group>
              <Group gap="xs">
                <Button size="compact-sm" variant="light" color="blue" onClick={() => markAll("engrave")}>All Blue</Button>
                <Button size="compact-sm" variant="light" color="dark" onClick={() => markAll("intact")}>All Black</Button>
                <Button size="compact-sm" variant="light" color="red" onClick={() => markAll("cut")}>All Red</Button>
              </Group>
            </Group>
            <Group gap="xs">
              <Button size="compact-sm" variant={showEngravePaths ? "filled" : "outline"} color="blue" leftSection={showEngravePaths ? <IconEye size={15} /> : <IconEyeOff size={15} />} onClick={() => setShowEngravePaths((value) => !value)}>Blue Layer</Button>
              <Button size="compact-sm" variant={showBlackPaths ? "filled" : "outline"} color="dark" leftSection={showBlackPaths ? <IconEye size={15} /> : <IconEyeOff size={15} />} onClick={() => setShowBlackPaths((value) => !value)}>Black Layer</Button>
              <Button size="compact-sm" variant={showRedPaths ? "filled" : "outline"} color="red" leftSection={showRedPaths ? <IconEye size={15} /> : <IconEyeOff size={15} />} onClick={() => setShowRedPaths((value) => !value)}>Red Layer</Button>
            </Group>
            {editMode === "node" && <Paper p="sm" withBorder radius="md">
              <Stack gap="xs">
                <Text size="sm" fw={900}>Node Tools</Text>
                <Text size="xs" c="dimmed">Select or drag a node, then use these controls. Horizontal and vertical alignment use the previous node on the path.</Text>
                <Group gap="xs">
                  <Button size="compact-sm" variant="light" leftSection={<IconPlus size={14} />} disabled={!selectedNode} onClick={addNodeAfterSelected}>Add Node After</Button>
                  <Button size="compact-sm" variant="light" color="red" leftSection={<IconTrash size={14} />} disabled={!selectedNode || trace.paths[selectedNode.pathIndex].points.length <= 3} onClick={deleteSelectedNode}>Delete Node</Button>
                  <Button size="compact-sm" variant="filled" color="red" leftSection={<IconTrash size={14} />} disabled={!selectedNode} onClick={deleteSelectedPath}>Delete Entire Path</Button>
                  <Button size="compact-sm" variant="light" color="blue" disabled={!selectedNode} onClick={() => straightenSelectedNode("y")}>Make Horizontal</Button>
                  <Button size="compact-sm" variant="light" color="blue" disabled={!selectedNode} onClick={() => straightenSelectedNode("x")}>Make Vertical</Button>
                  <Button size="compact-sm" variant="default" leftSection={<IconArrowBackUp size={14} />} disabled={!geometryUndoStack.length} onClick={undoGeometry}>Undo Geometry</Button>
                  <Button size="compact-sm" variant="default" leftSection={<IconArrowForwardUp size={14} />} disabled={!geometryRedoStack.length} onClick={redoGeometry}>Redo Geometry</Button>
                </Group>
              </Stack>
            </Paper>}
            <Paper p="sm" withBorder radius="md">
              <Stack gap="xs">
                <Group justify="space-between"><Text size="sm" fw={900}>Cut-Order Preview</Text><Badge variant="light">{cutSequence.length} operations</Badge></Group>
                <SegmentedControl
                  fullWidth
                  value={cutPreviewStage}
                  onChange={setCutPreviewStage}
                  data={[
                    { label: "All Paths", value: "all" },
                    { label: "1 · Blue Mark", value: "engrave" },
                    { label: "2 · Black Interior", value: "intact" },
                    { label: "3 · Red Outside", value: "cut" },
                  ]}
                />
                <div><Group justify="space-between"><Text size="xs" fw={700}>Preview Zoom</Text><Text size="xs" c="dimmed">{previewZoom}%</Text></Group><Slider value={previewZoom} onChange={setPreviewZoom} min={100} max={300} step={25} color="blue" /></div>
                <Checkbox checked={showOriginal} onChange={(event) => setShowOriginal(event.currentTarget.checked)} label="Overlay original artwork for comparison" />
              </Stack>
            </Paper>
          </Stack>}
          {error && <Alert mb="md" color="red" icon={<IconAlertTriangle size={18} />}>{error}</Alert>}
          <div className="mw-dxf-preview" style={{ overflow: previewZoom > 100 ? "auto" : "hidden" }}>
            {trace && showOriginal && sourceUrl && <img src={sourceUrl} alt="Original artwork comparison" style={{ position: "absolute", inset: 24, width: "calc(100% - 48px)", height: "calc(100% - 48px)", objectFit: "contain", opacity: 0.28, pointerEvents: "none" }} />}
            {trace ? <svg ref={svgRef} viewBox={`0 0 ${trace.sourceWidth} ${trace.sourceHeight}`} onClick={addWeldPoint} onPointerMove={moveNode} onPointerUp={endNodeDrag} onPointerCancel={endNodeDrag} onPointerLeave={endNodeDrag} style={{ width: `${previewZoom}%`, height: `${previewZoom}%`, minWidth: `${previewZoom}%`, minHeight: `${previewZoom}%`, maxHeight: previewZoom === 100 ? 620 : "none", touchAction: "none" }} aria-label="Interactive DXF path and node editor">
              {constructionMode !== "single" && <>
                <rect x="1" y="1" width={Math.max(1, trace.sourceWidth - 2)} height={Math.max(1, trace.sourceHeight - 2)} rx={backerStyle === "rounded" ? Math.min(trace.sourceWidth, trace.sourceHeight) * 0.035 : 0} fill="#aeb6bd" stroke={PHYSICAL_LAYER_COLORS[0]} strokeWidth="2" strokeDasharray="8 6" />
                {physicalLayerPreviewPaths[1] && <path d={physicalLayerPreviewPaths[1]} fill="#ffffff" fillRule="evenodd" stroke="none" />}
                {physicalLayerPreviewPaths[2] && <path d={physicalLayerPreviewPaths[2]} fill="#ffffff" fillRule="evenodd" stroke="none" opacity="0.94" />}
              </>}
              {trace.paths.map((path, pathIndex) => {
                const smoothPath = buildSmoothPathData(path.points, { tension: curveTension, cornerAngleDegrees: cornerAngle });
                const role = pathRoles[pathIndex];
                const color = role === "cut" ? "#ff0000" : role === "engrave" ? "#0000ff" : "#111111";
                const previewRank = { engrave: 0, intact: 1, cut: 2 };
                const selectedRank = cutPreviewStage === "all" ? 2 : previewRank[cutPreviewStage];
                const visibleForPreview = (previewRank[role] ?? 1) <= selectedRank;
                const visible = visibleForPreview && (role === "cut" ? showRedPaths : role === "engrave" ? showEngravePaths : showBlackPaths);
                if (!visible) return null;
                return <g key={pathIndex} onClick={(event) => handlePathClick(event, pathIndex)} style={{ cursor: editMode === "bridge" ? "crosshair" : "pointer" }}>
                  <path d={smoothPath} fill="none" stroke="transparent" strokeWidth="12" vectorEffect="non-scaling-stroke" />
                  {constructionMode !== "single" && <path d={smoothPath} fill="none" stroke={PHYSICAL_LAYER_COLORS[physicalLayers[pathIndex] || 1]} strokeWidth="7" opacity="0.3" vectorEffect="non-scaling-stroke" />}
                  <path d={smoothPath} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                  {unbridgedPathSet.has(pathIndex) && <path d={smoothPath} fill="none" stroke="#ff9f1c" strokeWidth="5" strokeDasharray="8 6" opacity="0.72" vectorEffect="non-scaling-stroke" />}
                  {showNodes && editMode === "node" && path.points.map((point, nodeIndex) => {
                    const selected = selectedNode?.pathIndex === pathIndex && selectedNode?.nodeIndex === nodeIndex;
                    return <circle key={nodeIndex} cx={point.x} cy={point.y} r={selected ? 5 : 3.2} fill={selected ? "#ffd43b" : "#fff"} stroke={selected ? "#5f4500" : color} strokeWidth={selected ? 2.5 : 1.5} vectorEffect="non-scaling-stroke" onPointerDown={(event) => beginNodeDrag(event, pathIndex, nodeIndex)} style={{ cursor: draggingNode?.pathIndex === pathIndex && draggingNode?.nodeIndex === nodeIndex ? "grabbing" : "grab" }} />;
                  })}
                  {cutPreviewStage !== "all" && (() => {
                    const labelPoint = pathLabelPoint(path);
                    return <g pointerEvents="none"><circle cx={labelPoint.x} cy={labelPoint.y} r="10" fill="#fff" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" /><text x={labelPoint.x} y={labelPoint.y + 3.5} textAnchor="middle" fontSize="10" fontWeight="900" fill="#111">{sequenceByPath.get(pathIndex)}</text></g>;
                  })()}
                </g>;
              })}
              {bridges.map((bridge, bridgeIndex) => {
                const point = pointOnClosedPath(trace.paths[bridge.pathIndex].points, bridge.position);
                return <g key={`bridge-${bridgeIndex}`} onClick={(event) => { event.stopPropagation(); removeBridge(bridgeIndex); }} style={{ cursor: "pointer" }}>
                  <circle cx={point.x} cy={point.y} r="8" fill="#ffd43b" stroke="#5f4500" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                  <line x1={point.x - 4} y1={point.y} x2={point.x + 4} y2={point.y} stroke="#5f4500" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                </g>;
              })}
              {weldPoints.map((point, pointIndex) => <g key={`weld-${pointIndex}`} onClick={(event) => { event.stopPropagation(); setWeldPoints((current) => current.filter((_, index) => index !== pointIndex)); }} style={{ cursor: "pointer" }}>
                <circle cx={point.x} cy={point.y} r="9" fill="#fff" stroke={(point.type || "weld") === "weld" ? "#9c36b5" : "#0c8599"} strokeWidth="3" vectorEffect="non-scaling-stroke" />
                <line x1={point.x - 5} y1={point.y} x2={point.x + 5} y2={point.y} stroke={(point.type || "weld") === "weld" ? "#9c36b5" : "#0c8599"} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                <line x1={point.x} y1={point.y - 5} x2={point.x} y2={point.y + 5} stroke={(point.type || "weld") === "weld" ? "#9c36b5" : "#0c8599"} strokeWidth="2" vectorEffect="non-scaling-stroke" />
              </g>)}
            </svg> : sourceUrl ? <><img src={sourceUrl} alt="Uploaded artwork" style={{ opacity: 0.55 }} /><Text pos="absolute" bottom={16} c="dark" fw={900}>Click Create Cut-Line Preview</Text></> : <div className="mw-dxf-empty"><IconPhoto size={58} stroke={1.4} /><Title order={3}>Your cut paths will appear here</Title><Text size="sm">Upload an image, adjust the cleanup controls, and create a preview before downloading the DXF.</Text></div>}
          </div>
          {inspection && <Paper mt="md" p="md" withBorder radius="md">
            <Group justify="space-between" mb="xs">
              <Text fw={900}>Pre-Cut File Inspection</Text>
              <Badge color={inspection.status === "ready" ? "green" : inspection.status === "review" ? "yellow" : "red"} size="lg">{inspection.label}</Badge>
            </Group>
            <Group gap="xs" mb="xs">
              <Badge color={inspection.artworkComplexity.color} size="lg">{inspection.artworkComplexity.label}</Badge>
              {inspection.sourceAnalysis && <Badge variant="light" color={inspection.sourceAnalysis.color}>{inspection.sourceAnalysis.label}</Badge>}
              {inspection.sourceAnalysis && <Badge variant="light" color="gray">Approx. {inspection.sourceAnalysis.colorGroupCount} source color group{inspection.sourceAnalysis.colorGroupCount === 1 ? "" : "s"}</Badge>}
              <Badge variant="light" color="gray">{inspection.pathCount.toLocaleString()} vector paths</Badge>
              <Badge variant="light" color="gray">{inspection.activeLayerCount} production layer{inspection.activeLayerCount === 1 ? "" : "s"}</Badge>
            </Group>
            <Text size="xs" c="dimmed" mb="xs">Source colors describe the uploaded artwork. Blue, black, red, and yellow below are production instructions—not the artwork's original colors.</Text>
            <Group gap="xs" mb="xs">
              <Badge variant="light" color="gray">{inspection.nodeCount.toLocaleString()} nodes</Badge>
              <Badge variant="light" color="blue">{inspection.engravePathCount} blue / score</Badge>
              <Badge variant="light" color="dark">{inspection.blackPathCount} black / first</Badge>
              <Badge variant="light" color="red">{inspection.redPathCount} red / second</Badge>
              <Badge variant="light" color="yellow">{inspection.bridgeCount} yellow bridge{inspection.bridgeCount === 1 ? "" : "s"}</Badge>
              <Badge variant="light" color="blue">{inspection.width.toFixed(3)} × {inspection.height.toFixed(3)} in</Badge>
            </Group>
            {inspection.issues.length ? <Stack gap={3}>{inspection.issues.map((issue) => <Text key={issue} size="sm" c={inspection.status === "unsafe" ? "red" : "yellow"}>• {issue}</Text>)}</Stack> : <Text size="sm" c="green" fw={800}>No automatic problems detected. Complete the visual inspection before cutting.</Text>}
          </Paper>}
          <Alert mt="md" color="yellow" variant="light" icon={<IconAlertTriangle size={18} />} title="Always inspect before cutting">
            Blue scores or marks without cutting through. Black cuts interior openings first. Red cuts the outside perimeter last. Yellow markers create real uncut gaps so a piece stays connected; click a yellow marker to remove it. Always confirm the bridge width for the material before cutting.
          </Alert>
        </Paper>
      </div>
    </div>
  );
}

export default ImageToDxf;
