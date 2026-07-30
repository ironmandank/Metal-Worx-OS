import { useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Box,
  Button,
  Checkbox,
  FileInput,
  Group,
  Loader,
  NumberInput,
  Paper,
  Progress,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Stepper,
  Table,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconAlertTriangle,
  IconCheck,
  IconFileSpreadsheet,
  IconPhoto,
  IconPhotoCheck,
  IconPackageImport,
  IconPrinter,
  IconQrcode,
  IconUpload,
} from "@tabler/icons-react";
import JSZip from "jszip";
import * as XLSX from "xlsx";

import { supabase } from "../lib/supabase";
import MWKpiStrip from "../components/ui/MWKpiStrip";
import MWPageHeader from "../components/ui/MWPageHeader";
import MWPanel from "../components/ui/MWPanel";

const IMAGE_BUCKET = "inventory-images";

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function code(value) {
  return (
    clean(value)
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 24) || "GENERAL"
  );
}

function parseXml(xml) {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  const parserError = document.querySelector("parsererror");
  if (parserError) throw new Error("The workbook contains XML that could not be read.");
  return document;
}

function elementsByLocalName(parent, localName) {
  return [...parent.getElementsByTagName("*")].filter(
    (element) => element.localName === localName
  );
}

function firstByLocalName(parent, localName) {
  return elementsByLocalName(parent, localName)[0] || null;
}

function relationshipId(element) {
  return (
    element?.getAttribute(
      "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
      "id"
    ) ||
    element?.getAttribute("r:id") ||
    element?.getAttribute("id") ||
    ""
  );
}

function embeddedRelationshipId(element) {
  return (
    element?.getAttribute(
      "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
      "embed"
    ) ||
    element?.getAttribute("r:embed") ||
    element?.getAttribute("embed") ||
    ""
  );
}

function relationshipsPath(sourcePath) {
  const lastSlash = sourcePath.lastIndexOf("/");
  const directory = sourcePath.slice(0, lastSlash);
  const filename = sourcePath.slice(lastSlash + 1);
  return `${directory}/_rels/${filename}.rels`;
}

function resolveZipPath(sourcePath, target) {
  if (!target) return "";
  if (target.startsWith("/")) return target.replace(/^\/+/, "");

  const base = sourcePath.slice(0, sourcePath.lastIndexOf("/") + 1);
  const parts = `${base}${target}`.split("/");
  const resolved = [];

  parts.forEach((part) => {
    if (!part || part === ".") return;
    if (part === "..") resolved.pop();
    else resolved.push(part);
  });

  return resolved.join("/");
}

async function readRelationships(zip, sourcePath) {
  const relationshipFile = zip.file(relationshipsPath(sourcePath));
  if (!relationshipFile) return new Map();

  const document = parseXml(await relationshipFile.async("string"));
  return new Map(
    elementsByLocalName(document, "Relationship").map((relationship) => [
      relationship.getAttribute("Id"),
      resolveZipPath(sourcePath, relationship.getAttribute("Target")),
    ])
  );
}

function imageMimeType(extension) {
  const normalized = extension.toLowerCase();
  if (normalized === "png") return "image/png";
  if (normalized === "gif") return "image/gif";
  if (normalized === "webp") return "image/webp";
  if (normalized === "bmp") return "image/bmp";
  return "image/jpeg";
}

async function extractInventoryImages(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const workbookFile = zip.file("xl/workbook.xml");
  if (!workbookFile) throw new Error("This file is not a readable Excel workbook.");

  const workbookDocument = parseXml(await workbookFile.async("string"));
  const inventorySheet = elementsByLocalName(workbookDocument, "sheet").find(
    (sheet) => clean(sheet.getAttribute("name")).toLowerCase() === "inventory"
  );

  if (!inventorySheet) throw new Error('The workbook does not contain an "Inventory" sheet.');

  const workbookRelationships = await readRelationships(zip, "xl/workbook.xml");
  const worksheetPath = workbookRelationships.get(relationshipId(inventorySheet));
  const worksheetFile = worksheetPath ? zip.file(worksheetPath) : null;
  if (!worksheetFile) throw new Error("The Inventory worksheet could not be located.");

  const worksheetDocument = parseXml(await worksheetFile.async("string"));
  const drawingElement = firstByLocalName(worksheetDocument, "drawing");
  if (!drawingElement) return [];

  const worksheetRelationships = await readRelationships(zip, worksheetPath);
  const drawingPath = worksheetRelationships.get(relationshipId(drawingElement));
  const drawingFile = drawingPath ? zip.file(drawingPath) : null;
  if (!drawingFile) return [];

  const drawingDocument = parseXml(await drawingFile.async("string"));
  const drawingRelationships = await readRelationships(zip, drawingPath);
  const anchors = [
    ...elementsByLocalName(drawingDocument, "oneCellAnchor"),
    ...elementsByLocalName(drawingDocument, "twoCellAnchor"),
  ];
  const imagesByRow = new Map();

  for (const anchor of anchors) {
    const from = firstByLocalName(anchor, "from");
    const rowElement = from ? firstByLocalName(from, "row") : null;
    const columnElement = from ? firstByLocalName(from, "col") : null;
    const blip = firstByLocalName(anchor, "blip");

    if (!rowElement || !columnElement || !blip) continue;

    const sourceRow = Number(rowElement.textContent) + 1;
    const sourceColumn = Number(columnElement.textContent) + 1;

    // Product photos in the Metal Worx workbook are anchored in column E.
    if (sourceColumn !== 5 || imagesByRow.has(sourceRow)) continue;

    const mediaPath = drawingRelationships.get(embeddedRelationshipId(blip));
    const mediaFile = mediaPath ? zip.file(mediaPath) : null;
    if (!mediaFile) continue;

    const extension = (mediaPath.split(".").pop() || "jpg").toLowerCase();
    const bytes = await mediaFile.async("uint8array");
    const blob = new Blob([bytes], { type: imageMimeType(extension) });

    imagesByRow.set(sourceRow, {
      sourceRow,
      sourceColumn,
      mediaPath,
      extension,
      blob,
      previewUrl: URL.createObjectURL(blob),
    });
  }

  return [...imagesByRow.values()].sort((a, b) => a.sourceRow - b.sourceRow);
}

function parseMetalWorxWorkbook(workbook) {
  const rows = [];

  if (workbook.Sheets.Inventory) {
    const data = XLSX.utils.sheet_to_json(workbook.Sheets.Inventory, {
      header: 1,
      defval: null,
    });
    let category = "Showroom Inventory";
    let sequence = 1;

    data.slice(1).forEach((row, index) => {
      const group = clean(row[0]);
      const description = clean(row[1]);
      const quantity = row[2];

      if (group && !description && (quantity === null || quantity === "")) {
        category = group;
      } else if (description && Number.isFinite(Number(quantity))) {
        const itemNumber = `MW-SHW-${String(sequence++).padStart(4, "0")}`;
        rows.push({
          sourceSheet: "Inventory",
          sourceRow: index + 2,
          selected: true,
          name: description,
          category,
          quantity: numberValue(quantity),
          unit: "EA",
          itemType: "finished_good",
          itemNumber,
          sku: itemNumber,
          qrValue: itemNumber,
          barcodeValue: itemNumber,
          status: "Ready",
        });
      }
    });
  }

  if (workbook.Sheets.Ornaments) {
    const data = XLSX.utils.sheet_to_json(workbook.Sheets.Ornaments, {
      header: 1,
      defval: null,
    });
    let category = "Ornaments";
    let sequence = 1;

    data.slice(1).forEach((row, index) => {
      const group = clean(row[0]);
      const size = clean(row[1]);
      const description = clean(row[2]);
      const quantity = row[4];

      if (group && !description && (quantity === null || quantity === "")) {
        category = group;
      } else if (description && Number.isFinite(Number(quantity))) {
        const itemNumber = `MW-ORN-${String(sequence++).padStart(4, "0")}`;
        rows.push({
          sourceSheet: "Ornaments",
          sourceRow: index + 2,
          selected: true,
          name: `${size} ${description}`.trim(),
          category,
          quantity: numberValue(quantity),
          unit: "EA",
          itemType: "finished_good",
          itemNumber,
          sku: itemNumber,
          qrValue: itemNumber,
          barcodeValue: itemNumber,
          status: "Ready",
        });
      }
    });
  }

  return rows;
}

function parseStandardSheets(workbook, existingRows) {
  const usedSheets = new Set(existingRows.map((row) => row.sourceSheet));
  const aliases = {
    name: ["name", "item name", "description", "item"],
    quantity: ["quantity", "qty", "on hand", "count"],
    category: ["category", "group", "type"],
    itemNumber: ["item number", "item_number", "number"],
    sku: ["sku"],
    unit: ["unit", "uom"],
    location: ["location", "storage", "bin"],
    dimensions: ["dimensions", "size"],
  };

  workbook.SheetNames.forEach((sheetName) => {
    if (usedSheets.has(sheetName)) return;
    const records = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      defval: "",
    });

    records.forEach((record, index) => {
      const lower = Object.fromEntries(
        Object.entries(record).map(([key, value]) => [clean(key).toLowerCase(), value])
      );
      const pick = (field) => {
        const key = aliases[field].find((candidate) => candidate in lower);
        return key ? lower[key] : "";
      };
      const name = clean(pick("name"));
      if (!name) return;

      const generated = `MW-IMP-${code(sheetName).slice(0, 5)}-${String(
        index + 1
      ).padStart(4, "0")}`;

      existingRows.push({
        sourceSheet: sheetName,
        sourceRow: index + 2,
        selected: true,
        name,
        category: clean(pick("category")) || sheetName,
        quantity: numberValue(pick("quantity")),
        unit: clean(pick("unit")) || "EA",
        location: clean(pick("location")),
        dimensions: clean(pick("dimensions")),
        itemType: "consumable",
        itemNumber: clean(pick("itemNumber")) || generated,
        sku: clean(pick("sku")) || generated,
        qrValue: clean(pick("itemNumber")) || generated,
        barcodeValue: clean(pick("itemNumber")) || generated,
        status: "Ready",
      });
    });
  });

  return existingRows;
}

function InventoryImportWizard({ setPage, activeUser }) {
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState("images");
  const [file, setFile] = useState(null);
  const [rows, setRows] = useState([]);
  const [imageRows, setImageRows] = useState([]);
  const [bins, setBins] = useState([]);
  const [defaultBinId, setDefaultBinId] = useState("");
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);

  const selectedRows = rows.filter(
    (row) => row.selected && row.status !== "Duplicate"
  );
  const duplicates = rows.filter((row) => row.status === "Duplicate").length;
  const totalOpeningQuantity = selectedRows.reduce(
    (sum, row) => sum + numberValue(row.quantity),
    0
  );
  const categories = useMemo(
    () => [...new Set(rows.map((row) => row.category).filter(Boolean))],
    [rows]
  );
  const selectedImageRows = imageRows.filter(
    (row) => row.selected && row.status !== "Missing Item"
  );
  const matchedImages = imageRows.filter((row) => row.itemId).length;
  const missingImages = imageRows.filter((row) => !row.itemId).length;
  const linkedImages = imageRows.filter((row) => row.primaryImagePath).length;

  async function readWorkbook(selectedFile) {
    if (!selectedFile) return;

    imageRows.forEach((row) => {
      if (row.previewUrl) URL.revokeObjectURL(row.previewUrl);
    });
    setFile(selectedFile);
    setResult(null);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      let parsed = parseMetalWorxWorkbook(workbook);
      parsed = parseStandardSheets(workbook, parsed);

      const [existingResult, binsResult, embeddedImages] = await Promise.all([
        supabase
          .from("inventory_items")
          .select(
            "id,item_number,sku,name,legacy_excel_sheet,legacy_excel_row,primary_image_path"
          ),
        supabase
          .from("inventory_bins")
          .select("id,name,code,location_id,inventory_locations(name,code)")
          .eq("is_active", true)
          .order("name"),
        extractInventoryImages(buffer),
      ]);

      if (existingResult.error) throw existingResult.error;
      if (binsResult.error) throw binsResult.error;

      const existingItems = existingResult.data || [];
      const existingCodes = new Set(
        existingItems.flatMap((item) =>
          [item.item_number, item.sku]
            .filter(Boolean)
            .map((value) => value.toLowerCase())
        )
      );
      const existingNames = new Set(
        existingItems.map((item) => clean(item.name).toLowerCase())
      );
      const inventoryItemsByRow = new Map(
        existingItems
          .filter(
            (item) =>
              item.legacy_excel_sheet === "Inventory" &&
              Number.isFinite(Number(item.legacy_excel_row))
          )
          .map((item) => [Number(item.legacy_excel_row), item])
      );

      parsed = parsed.map((row) => {
        const duplicate =
          existingCodes.has(row.itemNumber.toLowerCase()) ||
          existingNames.has(row.name.toLowerCase());
        return {
          ...row,
          status: duplicate ? "Duplicate" : "Ready",
          selected: !duplicate,
        };
      });

      const matched = embeddedImages.map((image) => {
        const item = inventoryItemsByRow.get(image.sourceRow);
        return {
          ...image,
          itemId: item?.id || null,
          itemNumber: item?.item_number || "",
          itemName: item?.name || "No imported item found for this row",
          primaryImagePath: item?.primary_image_path || "",
          status: item ? "Matched" : "Missing Item",
          selected: Boolean(item),
        };
      });

      setRows(parsed);
      setImageRows(matched);
      setBins(binsResult.data || []);
      setDefaultBinId(binsResult.data?.[0]?.id || "");
      setMode(matched.some((image) => image.itemId) ? "images" : "items");
      setStep(1);

      notifications.show({
        title: "Workbook Read Successfully",
        message: `${parsed.length} inventory rows and ${embeddedImages.length} Inventory-sheet photos found.`,
        color: "green",
        icon: <IconCheck size={18} />,
      });
    } catch (error) {
      notifications.show({
        title: "Workbook Could Not Be Read",
        message: error.message,
        color: "red",
      });
    }
  }

  function updateRow(index, changes) {
    setRows((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...changes } : row
      )
    );
  }

  function updateImageRow(index, changes) {
    setImageRows((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...changes } : row
      )
    );
  }

  async function performImageImport() {
    if (!selectedImageRows.length) return;

    setImporting(true);
    setProgress(0);
    const imported = [];
    const failed = [];

    try {
      for (let index = 0; index < selectedImageRows.length; index += 1) {
        const row = selectedImageRows[index];
        try {
          const extension = ["jpg", "jpeg", "png", "gif", "webp", "bmp"].includes(
            row.extension
          )
            ? row.extension
            : "jpg";
          const storagePath = `showroom/${row.itemNumber.toLowerCase()}.${extension}`;

          const { error: uploadError } = await supabase.storage
            .from(IMAGE_BUCKET)
            .upload(storagePath, row.blob, {
              upsert: true,
              contentType: row.blob.type || imageMimeType(extension),
              cacheControl: "3600",
            });

          if (uploadError) throw uploadError;

          const { data: publicData } = supabase.storage
            .from(IMAGE_BUCKET)
            .getPublicUrl(storagePath);

          const { error: updateError } = await supabase
            .from("inventory_items")
            .update({
              primary_image_path: storagePath,
              primary_image_url: publicData.publicUrl,
              image_alt_text: `${row.itemName} showroom inventory`,
              legacy_image_reference: row.mediaPath,
              updated_at: new Date().toISOString(),
            })
            .eq("id", row.itemId);

          if (updateError) throw updateError;
          imported.push(row);
        } catch (error) {
          failed.push({ row, error: error.message });
        }

        setProgress(
          Math.round(((index + 1) / selectedImageRows.length) * 100)
        );
      }

      setResult({ type: "images", imported, failed });
      setStep(3);
      notifications.show({
        title: "Showroom Image Import Complete",
        message: `${imported.length} photos attached; ${failed.length} failed.`,
        color: failed.length ? "yellow" : "green",
      });
    } finally {
      setImporting(false);
    }
  }

  async function performItemImport() {
    if (!selectedRows.length || !defaultBinId) return;

    setImporting(true);
    setProgress(0);
    const imported = [];
    const failed = [];

    try {
      const [categoryResult, unitResult] = await Promise.all([
        supabase.from("inventory_categories").select("id,name,code"),
        supabase.from("inventory_units").select("id,name,abbreviation"),
      ]);
      if (categoryResult.error) throw categoryResult.error;
      if (unitResult.error) throw unitResult.error;

      const categoryMap = new Map(
        (categoryResult.data || []).map((category) => [
          category.name.toLowerCase(),
          category,
        ])
      );
      const unitMap = new Map(
        (unitResult.data || []).map((unit) => [
          unit.abbreviation.toLowerCase(),
          unit,
        ])
      );

      for (let index = 0; index < selectedRows.length; index += 1) {
        const row = selectedRows[index];
        try {
          let category = categoryMap.get(row.category.toLowerCase());
          if (!category) {
            const { data, error } = await supabase
              .from("inventory_categories")
              .insert({
                name: row.category,
                code: code(row.category),
                description: `Created by Excel import from ${row.sourceSheet}`,
                color: "gray",
                is_active: true,
              })
              .select("id,name,code")
              .single();
            if (error) throw error;
            category = data;
            categoryMap.set(row.category.toLowerCase(), category);
          }

          const unit =
            unitMap.get(clean(row.unit).toLowerCase()) ||
            unitMap.get("ea") ||
            unitResult.data?.[0];
          const payload = {
            item_number: row.itemNumber,
            sku: row.sku || row.itemNumber,
            name: row.name,
            description: row.name,
            category_id: category?.id || null,
            unit_id: unit?.id || null,
            default_bin_id: defaultBinId,
            item_type: row.itemType || "consumable",
            tracking_type: "quantity",
            barcode_value: row.barcodeValue,
            qr_code_value: row.qrValue,
            dimensions: row.dimensions || null,
            is_stock_item: true,
            is_consumable: row.itemType !== "finished_good",
            allow_negative_stock: false,
            legacy_excel_sheet: row.sourceSheet,
            legacy_excel_row: row.sourceRow,
            legacy_excel_item_name: row.name,
            is_active: true,
          };

          const { data: item, error: itemError } = await supabase
            .from("inventory_items")
            .insert(payload)
            .select("id,name,item_number")
            .single();
          if (itemError) throw itemError;

          const { error: labelError } = await supabase.rpc(
            "mw_create_inventory_item_label",
            {
              p_inventory_item_id: item.id,
              p_label_name: `${row.name} Inventory Label`,
              p_qr_token: row.qrValue,
              p_barcode_value: row.barcodeValue,
              p_label_template: "metal-worx-standard",
              p_print_width_inches: 3.5,
              p_print_height_inches: 2,
            }
          );
          if (labelError) throw labelError;

          if (numberValue(row.quantity) > 0) {
            const { error: quantityError } = await supabase.rpc(
              "mw_adjust_inventory_quantity",
              {
                p_inventory_item_id: item.id,
                p_bin_id: defaultBinId,
                p_operation: "set",
                p_quantity: numberValue(row.quantity),
                p_reason: "Opening balance",
                p_notes: `Imported from ${row.sourceSheet}, row ${row.sourceRow}`,
                p_reference_type: "Excel Import",
                p_reference_id: null,
                p_reference_number: file?.name || null,
                p_performed_by: activeUser || null,
              }
            );
            if (quantityError) throw quantityError;
          }

          imported.push(item);
        } catch (error) {
          failed.push({ row, error: error.message });
        }

        setProgress(Math.round(((index + 1) / selectedRows.length) * 100));
      }

      setResult({ type: "items", imported, failed });
      setStep(3);
      notifications.show({
        title: "Inventory Import Complete",
        message: `${imported.length} items imported; ${failed.length} failed.`,
        color: failed.length ? "yellow" : "green",
      });
    } finally {
      setImporting(false);
    }
  }

  function resetWizard() {
    imageRows.forEach((row) => {
      if (row.previewUrl) URL.revokeObjectURL(row.previewUrl);
    });
    setFile(null);
    setRows([]);
    setImageRows([]);
    setResult(null);
    setProgress(0);
    setStep(0);
  }

  const imageMode = mode === "images";
  const currentReadyCount = imageMode ? selectedImageRows.length : selectedRows.length;

  return (
    <Stack gap="xl">
      <MWPageHeader
        title="Excel Inventory Import"
        subtitle="Import inventory data or attach embedded workbook photos to existing showroom products."
        setPage={setPage}
        showBack
        backPage="inventory"
        backLabel="Inventory"
        showDashboard={false}
      />

      <MWKpiStrip
        items={
          imageMode
            ? [
                {
                  label: "Workbook Photos",
                  value: imageRows.length,
                  description: file?.name || "No workbook selected",
                  icon: IconPhoto,
                  color: "blue",
                },
                {
                  label: "Matched Products",
                  value: matchedImages,
                  description: "Matched by original Excel row",
                  icon: IconPhotoCheck,
                  color: "green",
                },
                {
                  label: "Already Linked",
                  value: linkedImages,
                  description: "Can be replaced safely",
                  icon: IconCheck,
                  color: "violet",
                },
                {
                  label: "Missing Matches",
                  value: missingImages,
                  description: "Excluded automatically",
                  icon: IconAlertTriangle,
                  color: "yellow",
                },
              ]
            : [
                {
                  label: "Workbook Rows",
                  value: rows.length,
                  description: file?.name || "No workbook selected",
                  icon: IconFileSpreadsheet,
                  color: "blue",
                },
                {
                  label: "Ready to Import",
                  value: selectedRows.length,
                  description: "Selected valid rows",
                  icon: IconCheck,
                  color: "green",
                },
                {
                  label: "Duplicates",
                  value: duplicates,
                  description: "Automatically excluded",
                  icon: IconAlertTriangle,
                  color: "yellow",
                },
                {
                  label: "Opening Quantity",
                  value: totalOpeningQuantity.toLocaleString(),
                  description: "Across selected rows",
                  icon: IconPackageImport,
                  color: "violet",
                },
              ]
        }
        columns={{ base: 1, sm: 2, xl: 4 }}
        compact
      />

      <MWPanel>
        <Stack gap="md">
          <SegmentedControl
            fullWidth
            color="red"
            value={mode}
            onChange={(value) => {
              setMode(value);
              if (step > 1) setStep(1);
              setResult(null);
            }}
            data={[
              { label: "Attach Product Images", value: "images" },
              { label: "Import New Inventory Items", value: "items" },
            ]}
          />
          <Stepper active={step} color="red">
            <Stepper.Step label="Upload" description="Choose workbook" />
            <Stepper.Step
              label="Validate"
              description={imageMode ? "Match photos" : "Review rows"}
            />
            <Stepper.Step
              label={imageMode ? "Attach" : "Import"}
              description="Confirm settings"
            />
            <Stepper.Completed>
              <Text fw={800}>Process complete</Text>
            </Stepper.Completed>
          </Stepper>
        </Stack>
      </MWPanel>

      {step === 0 && (
        <MWPanel
          title="Upload Inventory Workbook"
          subtitle="Choose the updated Metal Worx Excel workbook containing the embedded product photos"
          icon={IconUpload}
        >
          <Stack align="center" py={55} gap="lg">
            <ThemeIcon size={78} radius="xl" color="green" variant="light">
              <IconFileSpreadsheet size={38} />
            </ThemeIcon>
            <Title order={3}>Choose the updated inventory workbook</Title>
            <FileInput
              accept=".xlsx,.xls"
              value={file}
              onChange={readWorkbook}
              placeholder="Select Updated Metal Worx Inventory.xlsx"
              leftSection={<IconUpload size={18} />}
              size="lg"
              w="min(100%, 560px)"
              clearable
            />
            <Alert color="blue" maw={720}>
              Uploading only reads and previews the workbook. Nothing is changed in
              Supabase until you review the matches and approve the operation.
            </Alert>
          </Stack>
        </MWPanel>
      )}

      {step === 1 && imageMode && (
        <MWPanel
          title="Validate Embedded Product Images"
          subtitle={`${matchedImages} photos matched to existing showroom products by original Excel row`}
          icon={IconPhotoCheck}
        >
          <Stack gap="md">
            <Alert color="green" icon={<IconCheck size={20} />}>
              Image attachment mode does not change product quantities, prices, crate
              assignments, QR codes, or item numbers.
            </Alert>
            <Group>
              <Button
                variant="light"
                color="gray"
                onClick={() =>
                  setImageRows((current) =>
                    current.map((row) => ({ ...row, selected: Boolean(row.itemId) }))
                  )
                }
              >
                Select Matched Photos
              </Button>
              <Button
                variant="light"
                color="gray"
                onClick={() =>
                  setImageRows((current) =>
                    current.map((row) => ({ ...row, selected: false }))
                  )
                }
              >
                Clear Selection
              </Button>
            </Group>
            <Box style={{ overflowX: "auto", maxHeight: 620 }}>
              <Table stickyHeader verticalSpacing="sm" highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Select</Table.Th>
                    <Table.Th>Preview</Table.Th>
                    <Table.Th>Excel Row</Table.Th>
                    <Table.Th>Item Number</Table.Th>
                    <Table.Th>Product</Table.Th>
                    <Table.Th>Status</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {imageRows.map((row, index) => (
                    <Table.Tr key={`${row.sourceRow}-${row.mediaPath}`}>
                      <Table.Td>
                        <Checkbox
                          checked={row.selected}
                          disabled={!row.itemId}
                          onChange={(event) =>
                            updateImageRow(index, {
                              selected: event.currentTarget.checked,
                            })
                          }
                        />
                      </Table.Td>
                      <Table.Td>
                        <Box
                          component="img"
                          src={row.previewUrl}
                          alt={row.itemName}
                          w={62}
                          h={62}
                          style={{ objectFit: "contain", borderRadius: 8 }}
                        />
                      </Table.Td>
                      <Table.Td>{row.sourceRow}</Table.Td>
                      <Table.Td>
                        <Text fw={800}>{row.itemNumber || "—"}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text fw={700}>{row.itemName}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          color={row.itemId ? "green" : "yellow"}
                          variant="light"
                        >
                          {row.primaryImagePath
                            ? "Matched · Existing Image"
                            : row.status}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Box>
            <Group justify="space-between">
              <Button variant="light" color="gray" onClick={() => setStep(0)}>
                Back
              </Button>
              <Button
                color="red"
                disabled={!selectedImageRows.length}
                onClick={() => setStep(2)}
              >
                Continue with {selectedImageRows.length} Photos
              </Button>
            </Group>
          </Stack>
        </MWPanel>
      )}

      {step === 1 && !imageMode && (
        <MWPanel
          title="Validate Import Rows"
          subtitle={`${rows.length} rows detected across ${categories.length} categories`}
          icon={IconCheck}
        >
          <Stack gap="md">
            <Group>
              <Button
                variant="light"
                color="gray"
                onClick={() =>
                  setRows((current) =>
                    current.map((row) => ({
                      ...row,
                      selected: row.status !== "Duplicate",
                    }))
                  )
                }
              >
                Select Valid Rows
              </Button>
              <Button
                variant="light"
                color="gray"
                onClick={() =>
                  setRows((current) =>
                    current.map((row) => ({ ...row, selected: false }))
                  )
                }
              >
                Clear Selection
              </Button>
            </Group>
            <Box style={{ overflowX: "auto", maxHeight: 560 }}>
              <Table stickyHeader verticalSpacing="sm" highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Select</Table.Th>
                    <Table.Th>Source</Table.Th>
                    <Table.Th>Item Number</Table.Th>
                    <Table.Th>Item Name</Table.Th>
                    <Table.Th>Category</Table.Th>
                    <Table.Th>Qty</Table.Th>
                    <Table.Th>Status</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {rows.map((row, index) => (
                    <Table.Tr key={`${row.sourceSheet}-${row.sourceRow}`}>
                      <Table.Td>
                        <Checkbox
                          checked={row.selected}
                          disabled={row.status === "Duplicate"}
                          onChange={(event) =>
                            updateRow(index, {
                              selected: event.currentTarget.checked,
                            })
                          }
                        />
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs">
                          {row.sourceSheet} · {row.sourceRow}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text fw={800}>{row.itemNumber}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text fw={700}>{row.name}</Text>
                      </Table.Td>
                      <Table.Td>{row.category}</Table.Td>
                      <Table.Td>
                        <NumberInput
                          w={90}
                          value={row.quantity}
                          min={0}
                          onChange={(value) =>
                            updateRow(index, { quantity: numberValue(value) })
                          }
                        />
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          color={row.status === "Duplicate" ? "yellow" : "green"}
                          variant="light"
                        >
                          {row.status}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Box>
            <Group justify="space-between">
              <Button variant="light" color="gray" onClick={() => setStep(0)}>
                Back
              </Button>
              <Button
                color="red"
                disabled={!selectedRows.length}
                onClick={() => setStep(2)}
              >
                Continue with {selectedRows.length} Items
              </Button>
            </Group>
          </Stack>
        </MWPanel>
      )}

      {step === 2 && imageMode && (
        <MWPanel
          title="Confirm Product Image Attachment"
          subtitle="Upload the matched photos and connect them to the existing showroom catalog"
          icon={IconPhotoCheck}
        >
          <Stack gap="lg">
            <SimpleGrid cols={{ base: 1, sm: 3 }}>
              <Paper p="lg" withBorder>
                <Text c="dimmed" size="xs" fw={800}>
                  PHOTOS TO ATTACH
                </Text>
                <Title>{selectedImageRows.length}</Title>
              </Paper>
              <Paper p="lg" withBorder>
                <Text c="dimmed" size="xs" fw={800}>
                  STORAGE BUCKET
                </Text>
                <Title order={3}>{IMAGE_BUCKET}</Title>
              </Paper>
              <Paper p="lg" withBorder>
                <Text c="dimmed" size="xs" fw={800}>
                  INVENTORY CHANGES
                </Text>
                <Title order={3}>Images Only</Title>
              </Paper>
            </SimpleGrid>
            <Alert color="yellow" icon={<IconAlertTriangle size={20} />}>
              Existing product images with the same item number will be replaced. No
              quantities, locations, pricing, or product records will be changed.
            </Alert>
            {importing && (
              <Stack gap="xs">
                <Progress value={progress} color="red" animated />
                <Text ta="center" c="dimmed">
                  Uploading showroom images… {progress}%
                </Text>
              </Stack>
            )}
            <Group justify="space-between">
              <Button
                variant="light"
                color="gray"
                disabled={importing}
                onClick={() => setStep(1)}
              >
                Back
              </Button>
              <Button
                color="green"
                leftSection={
                  importing ? (
                    <Loader size={18} color="white" />
                  ) : (
                    <IconPhotoCheck size={19} />
                  )
                }
                disabled={!selectedImageRows.length || importing}
                onClick={performImageImport}
              >
                Attach {selectedImageRows.length} Product Images
              </Button>
            </Group>
          </Stack>
        </MWPanel>
      )}

      {step === 2 && !imageMode && (
        <MWPanel
          title="Confirm Import Settings"
          subtitle="Choose the opening storage position and begin the controlled import"
          icon={IconPackageImport}
        >
          <Stack gap="lg">
            <Select
              label="Default Opening Storage Position"
              description="All imported opening quantities will be placed here. Items can be moved later."
              data={bins.map((bin) => ({
                value: bin.id,
                label: `${bin.code} · ${bin.name} · ${
                  bin.inventory_locations?.name || ""
                }`,
              }))}
              value={defaultBinId}
              onChange={(value) => setDefaultBinId(value || "")}
              searchable
              required
            />
            <SimpleGrid cols={{ base: 1, sm: 3 }}>
              <Paper p="lg" withBorder>
                <Text c="dimmed" size="xs" fw={800}>
                  ITEMS
                </Text>
                <Title>{selectedRows.length}</Title>
              </Paper>
              <Paper p="lg" withBorder>
                <Text c="dimmed" size="xs" fw={800}>
                  CATEGORIES
                </Text>
                <Title>{categories.length}</Title>
              </Paper>
              <Paper p="lg" withBorder>
                <Text c="dimmed" size="xs" fw={800}>
                  LABELS GENERATED
                </Text>
                <Title>{selectedRows.length}</Title>
              </Paper>
            </SimpleGrid>
            <Alert color="yellow" icon={<IconAlertTriangle size={20} />}>
              Duplicate items remain excluded. Import creates items, QR/Code 128
              assignments, label records, and audited opening-balance movements.
            </Alert>
            {importing && (
              <Stack gap="xs">
                <Progress value={progress} color="red" animated />
                <Text ta="center" c="dimmed">
                  Importing inventory… {progress}%
                </Text>
              </Stack>
            )}
            <Group justify="space-between">
              <Button
                variant="light"
                color="gray"
                disabled={importing}
                onClick={() => setStep(1)}
              >
                Back
              </Button>
              <Button
                color="green"
                leftSection={
                  importing ? (
                    <Loader size={18} color="white" />
                  ) : (
                    <IconPackageImport size={19} />
                  )
                }
                disabled={!defaultBinId || importing}
                onClick={performItemImport}
              >
                Import {selectedRows.length} Items
              </Button>
            </Group>
          </Stack>
        </MWPanel>
      )}

      {step === 3 && result && (
        <MWPanel
          title={result.type === "images" ? "Image Import Complete" : "Import Complete"}
          subtitle="The workbook has been processed"
          icon={IconCheck}
        >
          <Stack align="center" py={35}>
            <ThemeIcon
              size={80}
              radius="xl"
              color={result.failed.length ? "yellow" : "green"}
              variant="light"
            >
              {result.failed.length ? (
                <IconAlertTriangle size={40} />
              ) : result.type === "images" ? (
                <IconPhotoCheck size={40} />
              ) : (
                <IconCheck size={40} />
              )}
            </ThemeIcon>
            <Title>
              {result.imported.length}{" "}
              {result.type === "images" ? "Product Images Attached" : "Items Imported"}
            </Title>
            <Text c="dimmed">
              {result.failed.length} failed
              {result.type === "items" ? ` · ${duplicates} duplicates skipped` : ""}
            </Text>
            {result.failed.length > 0 && (
              <Alert color="yellow" w="100%" title="Records Needing Review">
                {result.failed.slice(0, 20).map((failure) => (
                  <Text
                    key={`${failure.row.sourceRow}-${failure.row.itemNumber}`}
                    size="sm"
                  >
                    {failure.row.itemName || failure.row.name}: {failure.error}
                  </Text>
                ))}
              </Alert>
            )}
            <Group>
              <Button color="red" onClick={() => setPage?.("inventoryItems")}>
                View Inventory Items
              </Button>
              {result.type === "items" && (
                <Button
                  color="grape"
                  leftSection={<IconPrinter size={18} />}
                  onClick={() => setPage?.("inventoryLabels")}
                >
                  Batch Print Labels
                </Button>
              )}
              <Button
                variant="light"
                color="gray"
                leftSection={
                  result.type === "images" ? (
                    <IconPhoto size={18} />
                  ) : (
                    <IconQrcode size={18} />
                  )
                }
                onClick={resetWizard}
              >
                Process Another File
              </Button>
            </Group>
          </Stack>
        </MWPanel>
      )}

      {step > 0 && currentReadyCount === 0 && (
        <Alert color="yellow" icon={<IconAlertTriangle size={20} />}>
          No selectable {imageMode ? "matched photos" : "new inventory rows"} are
          currently available in this workbook.
        </Alert>
      )}
    </Stack>
  );
}

export default InventoryImportWizard;