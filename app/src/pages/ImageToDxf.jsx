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
  IconPhoto,
  IconRefresh,
  IconScissors,
  IconUpload,
} from "@tabler/icons-react";

import {
  buildDxf,
  buildPreviewSvg,
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

function ImageToDxf() {
  const canvasRef = useRef(null);
  const [file, setFile] = useState(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [trace, setTrace] = useState(null);
  const [previewSvg, setPreviewSvg] = useState("");
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
    setPreviewSvg("");
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
    });
  }, [trace, width, height, lockRatio, layerName]);

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
      setPreviewSvg(buildPreviewSvg(nextTrace));
      if (lockRatio) setHeight(Number((width * nextTrace.sourceHeight / nextTrace.sourceWidth).toFixed(3)));
    } catch (conversionError) {
      setError(conversionError.message || "The image could not be converted.");
    } finally {
      setWorking(false);
    }
  }

  function downloadDxf() {
    if (!physicalSize) return;
    downloadText(physicalSize.dxf, `${safeBaseName(file?.name)}-${physicalSize.width.toFixed(2)}in.dxf`, "application/dxf");
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
              <FileButton onChange={setFile} accept="image/png,image/jpeg,image/webp,image/bmp">
                {(props) => <Button {...props} leftSection={<IconUpload size={18} />} color="red" variant={file ? "light" : "filled"}>{file ? "Choose Different Image" : "Choose Image"}</Button>}
              </FileButton>
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
              <TextInput label="CorelDRAW layer name" value={layerName} onChange={(event) => setLayerName(event.currentTarget.value)} />
              <Button onClick={downloadDxf} disabled={!trace} leftSection={<IconDownload size={18} />} color="green" size="md">Download CorelDRAW DXF</Button>
              {physicalSize && <Text size="sm" ta="center" c="dimmed">Export size: {physicalSize.width.toFixed(3)} × {physicalSize.height.toFixed(3)} inches</Text>}
            </Stack>
          </Paper>
        </Stack>

        <Paper withBorder p="md" radius="md">
          <Group justify="space-between" mb="sm"><Text fw={900}>Laser Cut-Line Preview</Text><Badge variant="outline" color={trace ? "red" : "gray"}>{trace ? "Red lines will export" : "Waiting for image"}</Badge></Group>
          {error && <Alert mb="md" color="red" icon={<IconAlertTriangle size={18} />}>{error}</Alert>}
          <div className="mw-dxf-preview">
            {previewSvg ? <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(previewSvg)}`} alt="DXF cut-line preview" /> : sourceUrl ? <><img src={sourceUrl} alt="Uploaded artwork" style={{ opacity: 0.55 }} /><Text pos="absolute" bottom={16} c="dark" fw={900}>Click Create Cut-Line Preview</Text></> : <div className="mw-dxf-empty"><IconPhoto size={58} stroke={1.4} /><Title order={3}>Your cut paths will appear here</Title><Text size="sm">Upload an image, adjust the cleanup controls, and create a preview before downloading the DXF.</Text></div>}
          </div>
          <Alert mt="md" color="yellow" variant="light" icon={<IconAlertTriangle size={18} />} title="Always inspect before cutting">
            Open the DXF in CorelDRAW, confirm the finished dimensions, check for loose center pieces, and verify there are no unwanted overlapping lines.
          </Alert>
        </Paper>
      </div>
    </div>
  );
}

export default ImageToDxf;

