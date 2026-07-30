import {
  Alert, Box, Button, Center, Group, Loader, Modal, NumberInput, Paper,
  Select, SimpleGrid, Stack, Text, TextInput, ThemeIcon, Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconArrowRight, IconCamera, IconCameraOff, IconCheck, IconClipboardCheck,
  IconMapPin, IconPackage, IconQrcode, IconRefresh,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { supabase } from "../lib/supabase";
import MWKpiStrip from "../components/ui/MWKpiStrip";
import MWPageHeader from "../components/ui/MWPageHeader";
import MWPanel from "../components/ui/MWPanel";

function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value) {
  return numberValue(value).toLocaleString("en-US", { maximumFractionDigits: 4 });
}

function getItemId(item) {
  return item?.inventory_item_id || item?.id || null;
}

function InventoryCountMode({ setPage, activeUser }) {
  const [items, setItems] = useState([]);
  const [bins, setBins] = useState([]);
  const [balances, setBalances] = useState([]);
  const [item, setItem] = useState(null);
  const [binId, setBinId] = useState("");
  const [countedQuantity, setCountedQuantity] = useState(0);
  const [scanValue, setScanValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [countedItems, setCountedItems] = useState(0);
  const [totalVariance, setTotalVariance] = useState(0);
  const [lastResult, setLastResult] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const scanInputRef = useRef(null);
  const quantityInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const cameraTimerRef = useRef(null);

  const loadReferenceData = useCallback(async () => {
    setLoading(true);
    try {
      const [itemResult, binResult] = await Promise.all([
        supabase.from("inventory_item_availability").select("*").eq("is_active", true).order("name"),
        supabase.from("inventory_bins").select(`id,name,code,location_id,is_active,inventory_locations(id,name,code)`).eq("is_active", true).order("name"),
      ]);
      if (itemResult.error) throw itemResult.error;
      if (binResult.error) throw binResult.error;
      setItems(itemResult.data || []);
      setBins(binResult.data || []);
    } catch (error) {
      notifications.show({ title: "Count Mode Failed to Load", message: error.message, color: "red" });
    } finally {
      setLoading(false);
      window.setTimeout(() => scanInputRef.current?.focus(), 100);
    }
  }, []);

  useEffect(() => { loadReferenceData(); }, [loadReferenceData]);

  const selectedBalance = useMemo(() => balances.find((balance) => balance.bin_id === binId) || null, [balances, binId]);
  const currentQuantity = numberValue(selectedBalance?.quantity_on_hand);
  const variance = numberValue(countedQuantity) - currentQuantity;
  const selectedBin = bins.find((bin) => bin.id === binId) || null;
  const binOptions = bins.map((bin) => ({ value: bin.id, label: [bin.code, bin.name, bin.inventory_locations?.name].filter(Boolean).join(" · ") }));

  const selectScannedItem = useCallback(async (matchedItem) => {
    const itemId = getItemId(matchedItem);
    const { data, error } = await supabase.from("inventory_bin_balances").select("*").eq("inventory_item_id", itemId);
    if (error) throw error;
    const loadedBalances = data || [];
    const defaultBinId = matchedItem.default_bin_id || loadedBalances[0]?.bin_id || bins[0]?.id || "";
    setItem(matchedItem);
    setBalances(loadedBalances);
    setBinId(defaultBinId);
    const startingBalance = loadedBalances.find((balance) => balance.bin_id === defaultBinId);
    setCountedQuantity(numberValue(startingBalance?.quantity_on_hand));
    setScanValue("");
    window.setTimeout(() => quantityInputRef.current?.focus(), 120);
  }, [bins]);

  const scanItem = useCallback(async (rawValue) => {
    const value = String(rawValue || "").trim();
    if (!value || scanning) return;
    setScanning(true);
    try {
      const { data: label, error: labelError } = await supabase.from("inventory_labels").select("inventory_item_id").eq("is_active", true).or(`qr_token.eq.${value},barcode_value.eq.${value}`).limit(1).maybeSingle();
      if (labelError) throw labelError;
      let matched = label?.inventory_item_id ? items.find((candidate) => getItemId(candidate) === label.inventory_item_id) : null;
      if (!matched) matched = items.find((candidate) => [candidate.item_number, candidate.sku, candidate.manufacturer_part_number, candidate.barcode_value, candidate.qr_code_value].some((code) => String(code || "").trim().toLowerCase() === value.toLowerCase()));
      if (!matched) throw new Error(`No active inventory item matched ${value}.`);
      await selectScannedItem(matched);
      notifications.show({ title: "Item Ready to Count", message: matched.name, color: "green", icon: <IconCheck size={18}/> });
    } catch (error) {
      notifications.show({ title: "Scan Not Recognized", message: error.message, color: "yellow" });
      window.setTimeout(() => scanInputRef.current?.focus(), 80);
    } finally { setScanning(false); }
  }, [items, scanning, selectScannedItem]);

  function nextScan() {
    setItem(null);
    setBalances([]);
    setBinId("");
    setCountedQuantity(0);
    setScanValue("");
    window.setTimeout(() => scanInputRef.current?.focus(), 80);
  }

  async function saveCount() {
    if (!item || !binId || countedQuantity < 0 || saving) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc("mw_adjust_inventory_quantity", {
        p_inventory_item_id: getItemId(item), p_bin_id: binId, p_operation: "set",
        p_quantity: numberValue(countedQuantity), p_reason: "Cycle count",
        p_notes: "Recorded through Inventory Count Mode", p_reference_type: "Inventory Count",
        p_reference_id: null, p_reference_number: null, p_performed_by: activeUser || null,
      });
      if (error) throw error;
      const savedVariance = numberValue(data?.quantity_change ?? variance);
      setCountedItems((current) => current + 1);
      setTotalVariance((current) => current + savedVariance);
      setLastResult({ name: item.name, bin: selectedBin?.code || selectedBin?.name, before: data?.quantity_before ?? currentQuantity, after: data?.quantity_after ?? countedQuantity, variance: savedVariance });
      notifications.show({ title: "Count Saved", message: `${item.name}: ${formatNumber(data?.quantity_before ?? currentQuantity)} → ${formatNumber(data?.quantity_after ?? countedQuantity)}`, color: "green", icon: <IconCheck size={18}/> });
      nextScan();
    } catch (error) {
      notifications.show({ title: "Count Save Failed", message: error.message, color: "red" });
    } finally { setSaving(false); }
  }

  const stopCamera = useCallback(() => {
    if (cameraTimerRef.current) window.clearInterval(cameraTimerRef.current);
    cameraTimerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null; setCameraReady(false); setCameraOpen(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(""); setCameraOpen(true);
    try {
      if (!("BarcodeDetector" in window)) throw new Error("Camera scanning requires Chrome or Edge. USB scanning still works.");
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      streamRef.current = stream; await new Promise((resolve) => window.setTimeout(resolve, 100));
      if (!videoRef.current) return; videoRef.current.srcObject = stream; await videoRef.current.play(); setCameraReady(true);
      const detector = new window.BarcodeDetector({ formats: ["qr_code", "code_128", "code_39", "ean_13", "upc_a", "upc_e"] });
      let detecting = false;
      cameraTimerRef.current = window.setInterval(async () => {
        if (detecting || !videoRef.current || videoRef.current.readyState < 2) return;
        detecting = true;
        try { const codes = await detector.detect(videoRef.current); if (codes?.[0]?.rawValue) { const value = codes[0].rawValue; stopCamera(); await scanItem(value); } } catch (error) { console.warn(error); } finally { detecting = false; }
      }, 450);
    } catch (error) { setCameraError(error.message); streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null; setCameraReady(false); }
  }, [scanItem, stopCamera]);
  useEffect(() => () => stopCamera(), [stopCamera]);

  if (loading) return <Stack gap="xl"><MWPageHeader title="Inventory Count Mode" subtitle="Loading count controls." setPage={setPage} showBack backPage="inventory" backLabel="Inventory" showDashboard={false}/><MWPanel><Group justify="center" py={90}><Loader color="red"/><Text c="dimmed">Loading count mode…</Text></Group></MWPanel></Stack>;

  return <Stack gap="xl">
    <MWPageHeader title="Inventory Count Mode" subtitle="Scan, enter the physical quantity, save, and immediately continue to the next item." setPage={setPage} showBack backPage="inventory" backLabel="Inventory" showDashboard={false}/>
    <MWKpiStrip items={[
      { label: "Session Counts", value: countedItems, description: "Items counted", icon: IconClipboardCheck, color: "green" },
      { label: "Session Variance", value: `${totalVariance > 0 ? "+" : ""}${formatNumber(totalVariance)}`, description: "Net count adjustment", icon: IconRefresh, color: totalVariance === 0 ? "blue" : "orange" },
      { label: "Scanner", value: "Ready", description: "USB HID / camera", icon: IconQrcode, color: "red" },
      { label: "Current Step", value: item ? "Enter Count" : "Scan Item", description: item?.name || "Waiting for scan", icon: IconArrowRight, color: "violet" },
    ]} columns={{ base: 1, sm: 2, xl: 4 }} compact/>

    <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="xl">
      <MWPanel title="1. Scan Inventory Item" subtitle="USB scanners submit automatically when Enter is enabled" icon={IconQrcode}>
        <Stack gap="lg">
          <TextInput ref={scanInputRef} autoFocus size="xl" value={scanValue} onChange={(event) => setScanValue(event.currentTarget.value)} onKeyDown={(event) => event.key === "Enter" && scanItem(scanValue)} placeholder="Scan or enter item QR / barcode" leftSection={<IconQrcode size={23}/>} rightSection={scanning ? <Loader size={18}/> : null}/>
          <Group grow><Button h={48} color="red" leftSection={<IconQrcode size={19}/>} disabled={!scanValue.trim() || scanning} onClick={() => scanItem(scanValue)}>Find Item</Button><Button h={48} variant="light" color="gray" leftSection={<IconCamera size={19}/>} onClick={startCamera}>Camera</Button></Group>
          {lastResult && !item && <Alert color="green" icon={<IconCheck size={20}/>} title="Last Count Saved"><Text fw={800}>{lastResult.name} · {lastResult.bin}</Text><Text size="sm">{formatNumber(lastResult.before)} → {formatNumber(lastResult.after)} ({lastResult.variance > 0 ? "+" : ""}{formatNumber(lastResult.variance)})</Text></Alert>}
          {!item && <Paper p="xl" withBorder><Stack align="center" py={35}><ThemeIcon size={70} radius="xl" color="red" variant="light"><IconQrcode size={34}/></ThemeIcon><Title order={3}>Ready for next scan</Title><Text c="dimmed" ta="center">Scan any Metal Worx inventory item label to begin counting.</Text></Stack></Paper>}
          {item && <Paper p="lg" withBorder><Group wrap="nowrap"><ThemeIcon size={54} radius="lg" color="blue" variant="light"><IconPackage size={26}/></ThemeIcon><Stack gap={3}><Title order={3}>{item.name}</Title><Text c="dimmed">{item.item_number || item.sku} · {item.category_name}</Text></Stack></Group></Paper>}
        </Stack>
      </MWPanel>

      <MWPanel title="2. Enter Physical Count" subtitle="Save the exact quantity physically present" icon={IconClipboardCheck}>
        {!item ? <Center py={85}><Stack align="center"><ThemeIcon size={64} radius="xl" color="gray" variant="light"><IconClipboardCheck size={30}/></ThemeIcon><Text c="dimmed">Scan an item to unlock count entry.</Text></Stack></Center> : <Stack gap="lg">
          <Select label="Storage Position" data={binOptions} value={binId} onChange={(value) => { const next = value || ""; setBinId(next); const balance = balances.find((row) => row.bin_id === next); setCountedQuantity(numberValue(balance?.quantity_on_hand)); }} searchable required size="md" leftSection={<IconMapPin size={18}/>}/>
          <SimpleGrid cols={2}><Paper p="lg" withBorder><Text size="xs" c="dimmed" fw={800} tt="uppercase">Recorded Quantity</Text><Text size="2rem" fw={900}>{formatNumber(currentQuantity)}</Text></Paper><Paper p="lg" withBorder><Text size="xs" c="dimmed" fw={800} tt="uppercase">Variance</Text><Text size="2rem" fw={900} c={variance === 0 ? "green.4" : "orange.4"}>{variance > 0 ? "+" : ""}{formatNumber(variance)}</Text></Paper></SimpleGrid>
          <NumberInput ref={quantityInputRef} label="Physical Count" description="Enter the exact quantity you can physically verify" value={countedQuantity} onChange={(value) => setCountedQuantity(numberValue(value))} min={0} decimalScale={4} size="xl" required onKeyDown={(event) => { if (event.key === "Enter") saveCount(); }}/>
          <Alert color="blue" icon={<IconClipboardCheck size={20}/>}>Saving sets this storage position to the exact physical count and records the variance in inventory history.</Alert>
          <Button h={58} fullWidth color="green" leftSection={saving ? <Loader size={19} color="white"/> : <IconCheck size={21}/>} disabled={!binId || countedQuantity < 0 || saving} onClick={saveCount}>Save Count & Next Scan</Button>
          <Button fullWidth variant="light" color="gray" onClick={nextScan}>Cancel & Next Scan</Button>
        </Stack>}
      </MWPanel>
    </SimpleGrid>

    <Modal opened={cameraOpen} onClose={stopCamera} title="Camera Count Scanner" centered size="lg" overlayProps={{ backgroundOpacity: .72, blur: 4 }}><Stack><Box pos="relative" style={{ minHeight: 360, background: "#050505", overflow: "hidden", borderRadius: 14 }}><video ref={videoRef} muted playsInline style={{ width: "100%", minHeight: 360, objectFit: "cover" }}/>{!cameraReady && !cameraError && <Center pos="absolute" inset={0}><Loader color="red"/></Center>}{cameraReady && <Box pos="absolute" top="22%" left="12%" right="12%" bottom="22%" style={{ border: "3px solid #e03131", borderRadius: 14, boxShadow: "0 0 0 9999px rgba(0,0,0,.32)" }}/>}</Box>{cameraError ? <Alert color="red" icon={<IconCameraOff size={20}/>}>{cameraError}</Alert> : <Alert color="blue" icon={<IconCamera size={20}/>}>Center the item QR code or barcode in the red frame.</Alert>}<Button variant="light" color="gray" onClick={stopCamera}>Close Camera</Button></Stack></Modal>
  </Stack>;
}

export default InventoryCountMode;
