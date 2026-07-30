import {
  Alert, Badge, Box, Button, Checkbox, Group, Loader, NumberInput,
  Paper, SegmentedControl, Select, SimpleGrid, Stack, Text, ThemeIcon, Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconBarcode, IconCheck, IconFileTypePdf, IconPackage, IconPrinter,
  IconQrcode, IconRefresh, IconSelectAll,
} from "@tabler/icons-react";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
import { useCallback, useEffect, useMemo, useState } from "react";

import { supabase } from "../lib/supabase";
import metalWorxLogo from "../assets/metal-worx-logo.png";
import MWKpiStrip from "../components/ui/MWKpiStrip";
import MWPageHeader from "../components/ui/MWPageHeader";
import MWPanel from "../components/ui/MWPanel";

const LOGO_PATH = metalWorxLogo;

function getItemId(item) {
  return item?.inventory_item_id || item?.id || null;
}

function safeText(value) {
  return String(value || "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character]);
}

async function createCodes(qrValue, barcodeValue) {
  const qr = await QRCode.toDataURL(qrValue, { width: 240, margin: 1, errorCorrectionLevel: "M" });
  const canvas = document.createElement("canvas");
  JsBarcode(canvas, barcodeValue, {
    format: "CODE128", displayValue: false, margin: 0, height: 62, width: 2,
  });
  return { qr, barcode: canvas.toDataURL("image/png") };
}

function LabelPreview({ item, label, mode }) {
  const [codes, setCodes] = useState(null);
  useEffect(() => {
    if (!item || !label) return;
    createCodes(label.qr_token, label.barcode_value).then(setCodes).catch(console.error);
  }, [item, label]);

  if (!item || !label) return null;
  return (
    <Paper
      p="sm"
      radius="md"
      style={{
        background: "#fff", color: "#090909", border: "1px solid #bbb",
        width: "100%", aspectRatio: mode === "letter" ? "1.75 / 1" : "2 / 1",
        overflow: "hidden",
      }}
    >
      <Box style={{ height: 36, background: "#ffffff", borderTop: "4px solid #c8102e", borderBottom: "1px solid #d5d5d5", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "2px 6px" }}>
        <img
          src={LOGO_PATH}
          alt="Metal Worx"
          style={{
            width: 84,
            height: 31,
            objectFit: "contain",
            objectPosition: "left center",
          }}
        />
        <Text size="9px" c="white" fw={900} style={{ letterSpacing: 2, background: "#101010", borderRadius: 10, padding: "4px 10px" }}>INVENTORY</Text>
      </Box>
      <Text fw={900} ta="center" mt={6} lineClamp={2} style={{ fontSize: mode === "letter" ? 13 : 12, lineHeight: 1.15 }}>{item.name}</Text>
      <Group mt={5} gap="sm" wrap="nowrap" align="center">
        {codes ? <img src={codes.qr} alt="QR" style={{ width: 60, height: 60 }} /> : <Loader size="sm" />}
        <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
          <Text size="9px" c="#555" fw={800}>{item.category_name || "METAL WORX INVENTORY"}</Text>
          <Text size="9px" c="#555">{item.default_bin_code || item.default_bin_name || "Storage position not assigned"}</Text>
          {codes && <img src={codes.barcode} alt="Barcode" style={{ width: "100%", height: 35, objectFit: "fill" }} />}
          <Text size="9px" fw={900} ta="center" style={{ letterSpacing: 1 }}>{label.barcode_value}</Text>
        </Stack>
      </Group>
    </Paper>
  );
}

function InventoryLabelPrinting({ setPage, selectedInventoryItem, activeUser }) {
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
  const [items, setItems] = useState([]);
  const [labels, setLabels] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [copies, setCopies] = useState(1);
  const [mode, setMode] = useState("letter");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [itemsResult, labelsResult] = await Promise.all([
        supabase.from("inventory_item_availability").select("*").eq("is_active", true).order("name"),
        supabase.from("inventory_labels").select("*").eq("is_active", true).not("inventory_item_id", "is", null),
      ]);
      if (itemsResult.error) throw itemsResult.error;
      if (labelsResult.error) throw labelsResult.error;
      setItems(itemsResult.data || []);
      setLabels(labelsResult.data || []);
      const startingId = getItemId(selectedInventoryItem);
      if (startingId) setSelectedIds([startingId]);
    } catch (error) {
      notifications.show({ title: "Labels Failed to Load", message: error.message, color: "red" });
    } finally {
      setLoading(false);
    }
  }, [selectedInventoryItem]);

  useEffect(() => { loadData(); }, [loadData]);

  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.includes(getItemId(item))),
    [items, selectedIds]
  );

  const labelByItem = useMemo(() => {
    const map = new Map();
    labels.forEach((label) => map.set(label.inventory_item_id, label));
    return map;
  }, [labels]);

  async function ensureLabels() {
    const ready = [];
    for (const item of selectedItems) {
      const id = getItemId(item);
      let label = labelByItem.get(id);
      if (!label) {
        const code = item.item_number || item.sku || `MW-INV-${id.slice(0, 8).toUpperCase()}`;
        const { data, error } = await supabase.rpc(
          "mw_create_inventory_item_label",
          {
            p_inventory_item_id: id,
            p_label_name: `${item.name} Inventory Label`,
            p_qr_token: code,
            p_barcode_value: code,
            p_label_template: "metal-worx-standard",
            p_print_width_inches: mode === "letter" ? 3.5 : 4,
            p_print_height_inches: 2,
          }
        );
        if (error) throw error;
        label = data;
      }
      ready.push({ item, label, codes: await createCodes(label.qr_token, label.barcode_value) });
    }
    return ready;
  }

  async function printLabels() {
    if (!selectedItems.length) return;
    setPrinting(true);
    try {
      const prepared = await ensureLabels();
      const expanded = prepared.flatMap((entry) => Array.from({ length: Math.max(1, Number(copies) || 1) }, () => entry));
      const labelWidth = mode === "letter" ? "3.5in" : "4in";
      const labelHeight = "2in";
      const pageSize = mode === "letter" ? "letter portrait" : "4in 2in";
      const body = expanded.map(({ item, label, codes }) => `
        <section class="label">
          <header><img src="${LOGO_PATH}"/><span>INVENTORY</span></header>
          <h2>${safeText(item.name)}</h2>
          <div class="content">
            <img class="qr" src="${codes.qr}"/>
            <div class="right"><small>${safeText(item.category_name || "METAL WORX INVENTORY")}</small><small>${safeText(item.default_bin_code || item.default_bin_name || "Storage position not assigned")}</small><img class="barcode" src="${codes.barcode}"/><b>${safeText(label.barcode_value)}</b></div>
          </div>
        </section>`).join("");

      const printWindow = window.open("", "_blank", "width=1100,height=850");
      if (!printWindow) throw new Error("The print window was blocked. Allow pop-ups for Metal Worx OS.");
      printWindow.document.write(`<!doctype html><html><head><title>Metal Worx Inventory Labels</title><style>
        @page{size:${pageSize};margin:${mode === "letter" ? "0.45in" : "0"}}
        *{box-sizing:border-box}body{margin:0;background:#fff;font-family:Arial,sans-serif;display:grid;grid-template-columns:repeat(${mode === "letter" ? 2 : 1},${labelWidth});gap:${mode === "letter" ? "0.08in" : "0"};justify-content:center}
        .label{width:${labelWidth};height:${labelHeight};border:1px solid #aaa;border-radius:7px;padding:.08in;break-inside:avoid;overflow:hidden;color:#080808;background:#fff}
        header{height:.36in;background:#fff;border-top:.045in solid #c8102e;border-bottom:1px solid #d5d5d5;border-radius:4px;display:flex;align-items:center;justify-content:space-between;padding:.01in .07in}header img{width:.82in;height:.29in;object-fit:contain;object-position:left center}header span{color:#fff;background:#101010;border-radius:.12in;padding:.045in .11in;font-size:7.5pt;font-weight:900;letter-spacing:2px}
        h2{text-align:center;font-size:11pt;line-height:1.1;height:.38in;margin:.07in .05in .02in;overflow:hidden}.content{display:flex;align-items:center;gap:.12in}.qr{width:.76in;height:.76in}.right{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center}.right small{width:100%;font-size:6.5pt;color:#555;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.barcode{width:100%;height:.42in;margin-top:.03in}.right b{font-size:7pt;letter-spacing:1.2px}
        @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
      </style></head><body>${body}<script>window.onload=()=>setTimeout(()=>window.print(),350)<\/script></body></html>`);
      printWindow.document.close();

      await Promise.all(prepared.map(({ label }) =>
        supabase.rpc("mw_record_inventory_label_print", {
          p_label_id: label.id,
          p_copies: Math.max(1, Number(copies) || 1),
          p_printed_by: activeUser || null,
        })
      ));
      notifications.show({ title: "Labels Ready to Print", message: `${expanded.length} label${expanded.length === 1 ? "" : "s"} opened in print preview.`, color: "green", icon: <IconCheck size={18} /> });
      await loadData();
    } catch (error) {
      notifications.show({ title: "Label Printing Failed", message: error.message, color: "red" });
    } finally { setPrinting(false); }
  }

  if (loading) return <Stack gap="xl"><MWPageHeader title="Inventory Label Printing" subtitle="Loading inventory labels." setPage={setPage} showBack backPage="inventory" backLabel="Inventory" showDashboard={false}/><MWPanel><Group justify="center" py={90}><Loader color="red"/><Text c="dimmed">Loading labels…</Text></Group></MWPanel></Stack>;

  return (
    <Stack gap="xl">
      <MWPageHeader title="Inventory Label Printing" subtitle="Print professional Metal Worx QR and Code 128 labels on letter sheets now or a thermal printer later." setPage={setPage} showBack backPage="inventory" backLabel="Inventory" showDashboard={false}/>
      <MWKpiStrip items={[
        { label: "Active Items", value: items.length, description: "Available for labels", icon: IconPackage, color: "blue" },
        { label: "Labels Assigned", value: labels.length, description: "QR and barcode ready", icon: IconQrcode, color: "green" },
        { label: "Selected", value: selectedIds.length, description: "Items in this batch", icon: IconSelectAll, color: "violet" },
        { label: "Print Quantity", value: selectedIds.length * copies, description: "Labels in print job", icon: IconPrinter, color: "red" },
      ]} columns={{ base: 1, sm: 2, xl: 4 }} compact />

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="xl">
        <MWPanel title="Build Print Batch" subtitle="Choose items, format, and number of labels" icon={IconPrinter}>
          <Stack gap="lg">
            <SegmentedControl fullWidth color="red" value={mode} onChange={setMode} data={[{ value: "letter", label: "Letter Sheet · Current Printer" }, { value: "thermal", label: "Thermal 4 × 2 · Future" }]}/>
            <Select label="Add Inventory Item" placeholder="Search item number, SKU, or name" searchable clearable data={items.filter((item) => !selectedIds.includes(getItemId(item))).map((item) => ({ value: getItemId(item), label: `${item.item_number || item.sku} · ${item.name}` }))} onChange={(value) => value && setSelectedIds((current) => [...current, value])} leftSection={<IconPackage size={18}/>}/>
            <NumberInput label="Labels Per Selected Item" value={copies} onChange={(value) => setCopies(Math.max(1, Number(value) || 1))} min={1} max={100}/>
            <Group><Button variant="light" color="gray" onClick={() => setSelectedIds(items.map(getItemId))}>Select All</Button><Button variant="light" color="gray" onClick={() => setSelectedIds([])}>Clear Batch</Button><Button variant="light" color="gray" leftSection={<IconRefresh size={17}/>} onClick={loadData}>Refresh</Button></Group>
            <Stack gap="xs">
              {selectedItems.map((item) => <Paper key={getItemId(item)} p="sm" withBorder><Group justify="space-between" wrap="nowrap"><Checkbox checked label={`${item.item_number || item.sku} · ${item.name}`} onChange={() => setSelectedIds((current) => current.filter((id) => id !== getItemId(item)))}/><Badge color={labelByItem.has(getItemId(item)) ? "green" : "yellow"} variant="light">{labelByItem.has(getItemId(item)) ? "Ready" : "Generates on Print"}</Badge></Group></Paper>)}
            </Stack>
          </Stack>
        </MWPanel>
        <MWPanel title="Label Preview" subtitle="Quantity is intentionally excluded because live counts change" icon={IconFileTypePdf}>
          <Stack gap="md">
            {selectedItems[0] && labelByItem.get(getItemId(selectedItems[0])) ? <LabelPreview item={selectedItems[0]} label={labelByItem.get(getItemId(selectedItems[0]))} mode={mode}/> : <Paper p="xl" withBorder><Stack align="center" py={35}><ThemeIcon size={58} radius="xl" color="red" variant="light"><IconBarcode size={28}/></ThemeIcon><Title order={4}>{selectedItems.length ? "Label will generate when printed" : "Select an item to preview"}</Title></Stack></Paper>}
            <Alert color="blue" icon={<IconPrinter size={19}/>}>{mode === "letter" ? "Letter mode prints 10 labels per 8.5 × 11 page. In the printer dialog, use Actual Size or 100% scale." : "Thermal mode prints one 4 × 2 label per page. Select the thermal printer when it is added later."}</Alert>
            <Button h={54} fullWidth color="red" leftSection={printing ? <Loader size={18} color="white"/> : <IconPrinter size={20}/>} disabled={!selectedIds.length || printing} onClick={printLabels}>Print {selectedIds.length * copies} Label{selectedIds.length * copies === 1 ? "" : "s"}</Button>
          </Stack>
        </MWPanel>
      </SimpleGrid>
    </Stack>
  );
}

export default InventoryLabelPrinting;