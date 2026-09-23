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
  IconRefresh,
  IconRestore,
  IconScissors,
  IconArrowBackUp,
  IconArrowForwardUp,
  IconUpload,
} from "@tabler/icons-react";

import {
  buildCorelSvg,
  buildDxf,
  inspectLaserFile,
  prepareBinaryImageData,
  traceImageData,
} from "../lib/imageToDxf";

const styles = `
  .mw-dxf-grid { display:grid; grid-template-columns:minmax(290px, 370px) minmax(0, 1fr); gap:18px; }
  .mw-dxf-preview { min-height:520px; position:relative; overflow:hidden; border:1px solid #343c43; border-radius:12px; background-color:#f7f7f5; background-image:linear-gradient(#e6e6e6 1px,transparent 1px),linear-gradient(90deg,#e6e6e6 1px,transparent 1px); background-size:20px 20px; display:grid; place-items:center; padding:24px; }
  .mw-dxf-preview img { width:100%; height:100%; max-height:620px; object-fit:contain; }
  .mw-dxf-empty { color:#68727a; text-align:center; max-width:360px; }
  .mw-dxf-drop { border:1px dashed #5a646d; border-radius:10px; padding:18px; text-align:center; background:#11171b; }
  @media (max-width:900px) { .mw-dxf-grid { grid-template-columns:1fr; } .mw-dxf-preview { min-height:390px; } }
`;

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
  const [showNodes, setShowNodes] = useState(true);
  const [markingMode, setMarkingMode] = useState("engrave");
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [showBlackPaths, setShowBlackPaths] = useState(true);
  const [showRedPaths, setShowRedPaths] = useState(true);
  const [showEngravePaths, setShowEngravePaths] = useState(true);
  const [draggingNode, setDraggingNode] = useState(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [threshold, setThreshold] = useState(160);
  const [invert, setInvert] = useState(false);
  const [speckleSize, setSpeckleSize] = useState(8);
  const [smoothing, setSmoothing] = useState("balanced");
  const [width, setWidth] = useState(24);
  const [height, setHeight] = useState(24);
  const [lockRatio, setLockRatio] = useState(true);
  const [layerName, setLayerName] = useState("CUT");

  useEffect(() => {
    if (!file) return undefined;
    const url = URL.createObjectURL(file);
    setSourceUrl(url);
    setTrace(null);
    setPathRoles([]);
    setUndoStack([]);
    setRedoStack([]);
    setError("");
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const physicalSize = useMemo(() => {
    if (!trace) return null;
    return buildDxf(trace, {
      widthInches: width,
      heightInches: height,
      keepAspect: lockRatio,
      layerName,
      pathRoles,
    });
  }, [trace, width, height, lockRatio, layerName, pathRoles]);

  const svgExport = useMemo(() => {
    if (!trace) return null;
    return buildCorelSvg(trace, {
      widthInches: width,
      heightInches: height,
      keepAspect: lockRatio,
      pathRoles,
      title: file?.name,
    });
  }, [trace, width, height, lockRatio, pathRoles, file]);

  const inspection = useMemo(() => {
    if (!trace) return null;
    return inspectLaserFile(trace, {
      widthInches: width,
      heightInches: height,
      keepAspect: lockRatio,
      pathRoles,
    });
  }, [trace, width, height, lockRatio, pathRoles]);

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
      setTrace(nextTrace);
      setPathRoles(nextTrace.paths.map(() => "engrave"));
      setUndoStack([]);
      setRedoStack([]);
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
  }

  function resetPathsToEngrave() {
    applyRoles(pathRoles.map(() => "engrave"));
    setMarkingMode("engrave");
  }

  function markAll(role) {
    applyRoles(pathRoles.map(() => role));
    setMarkingMode(role);
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

  function loadDemo() {
    setFile(createDemoArtwork());
  }

  function beginNodeDrag(event, pathIndex, nodeIndex) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
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
        {physicalSize && <Badge size="lg" color="green">{physicalSize.pathCount} closed cut paths</Badge>}
      </Group>

      <div className="mw-dxf-grid">
        <Stack gap="md">
          <Paper withBorder p="md" radius="md">
            <Stack gap="md">
              <div>
                <Text fw={900} mb={4}>1. Upload the artwork</Text>
                <Text size="sm" c="dimmed">Use a clear JPG or PNG. High contrast produces the cleanest cut file.</Text>
              </div>
              <Group grow>
                <FileButton onChange={setFile} accept="image/png,image/jpeg,image/webp,image/bmp">
                  {(props) => <Button {...props} leftSection={<IconUpload size={18} />} color="red" variant={file ? "light" : "filled"}>{file ? "Choose Different Image" : "Choose Image"}</Button>}
                </FileButton>
                <Button variant="outline" color="gray" leftSection={<IconPhoto size={18} />} onClick={loadDemo}>Load Sample Design</Button>
              </Group>
              {file && <div className="mw-dxf-drop"><IconPhoto size={25} color="#ef233c" /><Text fw={800} size="sm">{file.name}</Text><Text size="xs" c="dimmed">{(file.size / 1024 / 1024).toFixed(2)} MB</Text></div>}
            </Stack>
          </Paper>

          <Paper withBorder p="md" radius="md">
            <Stack gap="md">
              <div><Text fw={900}>2. Clean up the cut lines</Text><Text size="sm" c="dimmed">Adjust these only when the preview misses part of the design.</Text></div>
              <div><Group justify="space-between"><Text size="sm" fw={700}>Detail Threshold</Text><Text size="sm" c="dimmed">{threshold}</Text></Group><Slider value={threshold} onChange={setThreshold} min={20} max={235} color="red" /></div>
              <Checkbox checked={invert} onChange={(event) => setInvert(event.currentTarget.checked)} label="Reverse black and white" />
              <div><Group justify="space-between"><Text size="sm" fw={700}>Remove Small Specks</Text><Text size="sm" c="dimmed">{speckleSize}px</Text></Group><Slider value={speckleSize} onChange={setSpeckleSize} min={0} max={40} color="red" /></div>
              <div><Text size="sm" fw={700} mb={6}>Line Style</Text><SegmentedControl fullWidth value={smoothing} onChange={setSmoothing} data={[{ label: "Sharp", value: "sharp" }, { label: "Balanced", value: "balanced" }, { label: "Smooth", value: "smooth" }]} /></div>
              <Button onClick={convertImage} disabled={!file} loading={working} leftSection={<IconRefresh size={18} />} color="red">Create Cut-Line Preview</Button>
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
              <Checkbox checked={showNodes} onChange={(event) => setShowNodes(event.currentTarget.checked)} label="Show vector nodes in preview" />
              <Button onClick={downloadDxf} disabled={!trace} leftSection={<IconDownload size={18} />} color="green" size="md">Download CorelDRAW DXF</Button>
              <Button onClick={downloadSvg} disabled={!trace} leftSection={<IconDownload size={18} />} variant="light" color="blue">Download Blue/Black/Red SVG</Button>
              {physicalSize && <Text size="sm" ta="center" c="dimmed">Export size: {physicalSize.width.toFixed(3)} × {physicalSize.height.toFixed(3)} inches</Text>}
            </Stack>
          </Paper>
        </Stack>

        <Paper withBorder p="md" radius="md">
          <Group justify="space-between" mb="sm"><Text fw={900}>Laser Path Preview</Text><Badge variant="outline" color={trace ? "red" : "gray"}>{trace ? "Click a path to change its purpose" : "Waiting for image"}</Badge></Group>
          {trace && <Stack mb="sm" gap="xs">
            <SegmentedControl
              fullWidth
              value={markingMode}
              onChange={setMarkingMode}
              data={[
                { label: "Mark Blue — Partial Cut", value: "engrave" },
                { label: "Mark Black — Cut First", value: "intact" },
                { label: "Mark Red — Cut Second", value: "cut" },
              ]}
              color={markingMode === "cut" ? "red" : markingMode === "engrave" ? "blue" : "dark"}
            />
            <Group justify="space-between">
              <Group gap="xs">
                <Button size="compact-sm" variant="default" leftSection={<IconArrowBackUp size={15} />} disabled={!undoStack.length} onClick={undoRoles}>Undo</Button>
                <Button size="compact-sm" variant="default" leftSection={<IconArrowForwardUp size={15} />} disabled={!redoStack.length} onClick={redoRoles}>Redo</Button>
                <Button size="compact-sm" variant="subtle" color="blue" leftSection={<IconRestore size={15} />} onClick={resetPathsToEngrave}>Reset Blue</Button>
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
          </Stack>}
          {error && <Alert mb="md" color="red" icon={<IconAlertTriangle size={18} />}>{error}</Alert>}
          <div className="mw-dxf-preview">
            {trace ? <svg ref={svgRef} viewBox={`0 0 ${trace.sourceWidth} ${trace.sourceHeight}`} onPointerMove={moveNode} onPointerUp={endNodeDrag} onPointerCancel={endNodeDrag} onPointerLeave={endNodeDrag} style={{ width: "100%", height: "100%", maxHeight: 620, touchAction: "none" }} aria-label="Interactive DXF path and node editor">
              {trace.paths.map((path, pathIndex) => {
                const points = path.points.map((point) => `${point.x},${point.y}`).join(" ");
                const role = pathRoles[pathIndex];
                const color = role === "cut" ? "#ff0000" : role === "engrave" ? "#0000ff" : "#111111";
                const visible = role === "cut" ? showRedPaths : role === "engrave" ? showEngravePaths : showBlackPaths;
                if (!visible) return null;
                return <g key={pathIndex} onClick={() => markPath(pathIndex)} style={{ cursor: "pointer" }}>
                  <polyline points={points} fill="none" stroke="transparent" strokeWidth="12" vectorEffect="non-scaling-stroke" />
                  <polyline points={points} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                  {showNodes && path.points.map((point, nodeIndex) => <circle key={nodeIndex} cx={point.x} cy={point.y} r="3.2" fill="#fff" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" onPointerDown={(event) => beginNodeDrag(event, pathIndex, nodeIndex)} style={{ cursor: draggingNode?.pathIndex === pathIndex && draggingNode?.nodeIndex === nodeIndex ? "grabbing" : "grab" }} />)}
                </g>;
              })}
            </svg> : sourceUrl ? <><img src={sourceUrl} alt="Uploaded artwork" style={{ opacity: 0.55 }} /><Text pos="absolute" bottom={16} c="dark" fw={900}>Click Create Cut-Line Preview</Text></> : <div className="mw-dxf-empty"><IconPhoto size={58} stroke={1.4} /><Title order={3}>Your cut paths will appear here</Title><Text size="sm">Upload an image, adjust the cleanup controls, and create a preview before downloading the DXF.</Text></div>}
          </div>
          {inspection && <Paper mt="md" p="md" withBorder radius="md">
            <Group justify="space-between" mb="xs">
              <Text fw={900}>Pre-Cut File Inspection</Text>
              <Badge color={inspection.status === "ready" ? "green" : inspection.status === "review" ? "yellow" : "red"} size="lg">{inspection.label}</Badge>
            </Group>
            <Group gap="xs" mb="xs">
              <Badge variant="light" color="gray">{inspection.nodeCount.toLocaleString()} nodes</Badge>
              <Badge variant="light" color="blue">{inspection.engravePathCount} blue / partial</Badge>
              <Badge variant="light" color="dark">{inspection.blackPathCount} black / first</Badge>
              <Badge variant="light" color="red">{inspection.redPathCount} red / second</Badge>
              <Badge variant="light" color="blue">{inspection.width.toFixed(3)} × {inspection.height.toFixed(3)} in</Badge>
            </Group>
            {inspection.issues.length ? <Stack gap={3}>{inspection.issues.map((issue) => <Text key={issue} size="sm" c={inspection.status === "unsafe" ? "red" : "yellow"}>• {issue}</Text>)}</Stack> : <Text size="sm" c="green" fw={800}>No automatic problems detected. Complete the visual inspection before cutting.</Text>}
          </Paper>}
          <Alert mt="md" color="yellow" variant="light" icon={<IconAlertTriangle size={18} />} title="Always inspect before cutting">
            Blue paths are partial cuts that stay attached; assign the blue layer a lower-power or faster setting in the laser software so it does not cut through. Black paths cut through first and red paths cut through second for the final outside release. New traces start blue for safety. Choose a color and click a path to assign it; turn on Show vector nodes and drag any white node to edit the geometry.
          </Alert>
        </Paper>
      </div>
    </div>
  );
}

export default ImageToDxf;
