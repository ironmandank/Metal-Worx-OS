import {
  Alert,
  Box,
  Button,
  Checkbox,
  Group,
  Loader,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconAlertTriangle,
  IconBox,
  IconBuildingStore,
  IconCheck,
  IconDeviceFloppy,
  IconInfoCircle,
  IconPackage,
  IconPhoto,
  IconPlus,
  IconQrcode,
  IconTool,
} from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";

import { supabase } from "../lib/supabase";

import MWPageHeader from "../components/ui/MWPageHeader";
import MWPanel from "../components/ui/MWPanel";
import InventoryImageCapture from "../components/inventory/InventoryImageCapture";

const INITIAL_FORM = {
  itemGroup: "consumable",

  name: "",
  itemNumber: "",
  sku: "",
  description: "",

  categoryId: "",
  unitId: "",
  defaultBinId: "",

  itemType: "consumable",
  trackingType: "quantity",

  manufacturer: "",
  manufacturerPartNumber: "",

  colorName: "",
  colorCode: "",
  finish: "",
  dimensions: "",

  materialFamily: "",
  materialGrade: "",
  thickness: "",
  width: "",
  length: "",

  startingQuantity: 0,

  standardCost: 0,
  sellingPrice: 0,

  reorderPoint: 0,
  reorderQuantity: 0,
  minimumStock: 0,
  maximumStock: null,
  preferredStockLevel: null,

  isStockItem: true,
  isConsumable: true,
  allowNegativeStock: false,
  requiresInspection: false,

  createQrLabel: true,
  isActive: true,

  notes: "",
};

const REORDER_INPUT_STYLES = {
  label: {
    minHeight: 24,
  },
  description: {
    minHeight: 40,
    lineHeight: 1.3,
  },
};

function safeNumber(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return numericValue;
}

function cleanNullableText(value) {
  const cleanedValue = String(value || "").trim();

  return cleanedValue || null;
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function buildItemNumber(sequenceNumber, group = "consumable") {
  const prefix = group === "showroom" ? "MW-SHW" : "MW-INV";
  return `${prefix}-${String(sequenceNumber).padStart(4, "0")}`;
}

function getItemGroupConfig(group) {
  if (group === "showroom") {
    return {
      label: "Showroom Item",
      icon: IconBuildingStore,
      color: "violet",
      itemType: "showroom",
      isConsumable: false,
      description:
        "Finished samples, display pieces, blanks, reusable components, and items kept on hand.",
    };
  }

  if (group === "material") {
    return {
      label: "Shop Material",
      icon: IconBox,
      color: "blue",
      itemType: "material",
      isConsumable: false,
      description:
        "Optionally tracked steel, aluminum, sheet, tube, plate, or other production material.",
    };
  }

  return {
    label: "Consumable",
    icon: IconTool,
    color: "orange",
    itemType: "consumable",
    isConsumable: true,
    description:
      "Powder, paint, abrasives, tape, hardware, packaging, cleaning supplies, and frequently used shop items.",
  };
}

function GroupSelectionCard({
  value,
  selected,
  title,
  description,
  icon: Icon,
  color,
  onClick,
}) {
  return (
    <Box
      component="button"
      type="button"
      onClick={() => onClick(value)}
      p="lg"
      style={{
        width: "100%",
        minHeight: 150,
        borderRadius: 16,
        border: selected
          ? `1px solid var(--mantine-color-${color}-6)`
          : "1px solid rgba(255,255,255,0.08)",
        background: selected
          ? `linear-gradient(145deg, color-mix(in srgb, var(--mantine-color-${color}-9) 32%, transparent), rgba(255,255,255,0.018))`
          : "linear-gradient(145deg, rgba(255,255,255,0.04), rgba(255,255,255,0.014))",
        color: "inherit",
        font: "inherit",
        textAlign: "left",
        cursor: "pointer",
        boxShadow: selected
          ? `0 0 0 1px color-mix(in srgb, var(--mantine-color-${color}-6) 20%, transparent)`
          : "none",
      }}
    >
      <Stack gap="md">
        <Group
          justify="space-between"
          align="flex-start"
          gap="md"
          wrap="nowrap"
        >
          <ThemeIcon
            size={46}
            radius="md"
            color={color}
            variant="light"
            style={{
              border:
                "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <Icon size={23} stroke={2} />
          </ThemeIcon>

          {selected && (
            <ThemeIcon
              size={28}
              radius="xl"
              color={color}
              variant="filled"
            >
              <IconCheck size={15} stroke={2.5} />
            </ThemeIcon>
          )}
        </Group>

        <Box>
          <Text
            fw={900}
            size="md"
            c="gray.0"
          >
            {title}
          </Text>

          <Text
            size="xs"
            c="gray.5"
            mt={5}
            style={{
              lineHeight: 1.45,
            }}
          >
            {description}
          </Text>
        </Box>
      </Stack>
    </Box>
  );
}

function FormSummaryRow({
  label,
  value,
  color = "gray",
}) {
  return (
    <Group
      justify="space-between"
      align="center"
      gap="md"
      wrap="nowrap"
      py={8}
    >
      <Text
        size="sm"
        c="gray.5"
      >
        {label}
      </Text>

      <Text
        size="sm"
        fw={800}
        c={`${color}.3`}
        ta="right"
      >
        {value}
      </Text>
    </Group>
  );
}

function NewInventoryItem({
  setPage,
  setSelectedInventoryItem,
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState(INITIAL_FORM);

  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [bins, setBins] = useState([]);
  const [primaryLocation, setPrimaryLocation] = useState(null);
  const [nextNumbers, setNextNumbers] = useState({ showroom: 1, general: 1 });

  const [imageFile, setImageFile] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});
  const [createNewCrate, setCreateNewCrate] = useState(false);
  const [newCrate, setNewCrate] = useState({ code: "", name: "", type: "standard" });

  useEffect(() => {
    loadSetupData();
  }, []);

  async function loadSetupData() {
    setLoading(true);

    try {
      const [
        categoriesResult,
        unitsResult,
        binsResult,
        latestItemResult,
        latestShowroomResult,
        locationsResult,
      ] = await Promise.all([
        supabase
          .from("inventory_categories")
          .select(`
            id,
            name,
            code,
            color,
            sort_order,
            is_active
          `)
          .eq("is_active", true)
          .order("sort_order", {
            ascending: true,
          })
          .order("name", {
            ascending: true,
          }),

        supabase
          .from("inventory_units")
          .select(`
            id,
            name,
            abbreviation,
            unit_family,
            allows_decimal,
            is_active
          `)
          .eq("is_active", true)
          .order("name", {
            ascending: true,
          }),

        supabase
          .from("inventory_bins")
          .select(`
            id,
            name,
            code,
            zone,
            description,
            is_active
          `)
          .eq("is_active", true)
          .order("zone", {
            ascending: true,
          })
          .order("name", {
            ascending: true,
          }),

        supabase
          .from("inventory_items")
          .select("item_number")
          .like("item_number", "MW-INV-%")
          .order("item_number", {
            ascending: false,
          })
          .limit(1),

        supabase
          .from("inventory_items")
          .select("item_number")
          .like("item_number", "MW-SHW-%")
          .order("item_number", {
            ascending: false,
          })
          .limit(1),

        supabase
          .from("inventory_locations")
          .select("id,name,code,is_primary,is_active")
          .eq("is_active", true)
          .order("is_primary", { ascending: false })
          .limit(1),
      ]);

      const failedResult = [
        categoriesResult,
        unitsResult,
        binsResult,
        latestItemResult,
        latestShowroomResult,
        locationsResult,
      ].find((result) => result.error);

      if (failedResult?.error) {
        throw failedResult.error;
      }

      const categoryRows =
        categoriesResult.data || [];

      const unitRows =
        unitsResult.data || [];

      const binRows =
        binsResult.data || [];

      setCategories(categoryRows);
      setUnits(unitRows);
      setBins(binRows);
      setPrimaryLocation(locationsResult.data?.[0] || null);

      const latestItemNumber =
        latestItemResult.data?.[0]?.item_number || "";

      const latestSequenceMatch =
        latestItemNumber.match(/MW-INV-(\d+)/i);

      const nextSequence = latestSequenceMatch
        ? Number(latestSequenceMatch[1]) + 1
        : 1;

      const latestShowroomNumber =
        latestShowroomResult.data?.[0]?.item_number || "";

      const latestShowroomMatch =
        latestShowroomNumber.match(/MW-SHW-(\d+)/i);

      const nextShowroomSequence = latestShowroomMatch
        ? Number(latestShowroomMatch[1]) + 1
        : 1;

      setNextNumbers({
        showroom: nextShowroomSequence,
        general: nextSequence,
      });

      const defaultEachUnit =
        unitRows.find(
          (unit) => unit.abbreviation === "EA"
        ) || unitRows[0];

      const defaultConsumableCategory =
        categoryRows.find(
          (category) =>
            category.code === "CONSUMABLES"
        );

      setForm((current) => ({
        ...current,
        itemNumber: buildItemNumber(nextSequence, "consumable"),
        unitId:
          current.unitId ||
          defaultEachUnit?.id ||
          "",
        categoryId:
          current.categoryId ||
          defaultConsumableCategory?.id ||
          "",
      }));
    } catch (error) {
      console.error(
        "New inventory item setup load error:",
        error
      );

      notifications.show({
        title: "Form Setup Failed",
        message:
          error.message ||
          "Unable to load inventory categories, units, and storage positions.",
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  }

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    setValidationErrors((current) => ({
      ...current,
      [field]: null,
    }));
  }

  function selectItemGroup(group) {
    const config = getItemGroupConfig(group);

    let suggestedCategory = null;

    if (group === "showroom") {
      suggestedCategory =
        categories.find((category) =>
          [
            "SHOWROOM-CRAFT",
            "SHOWROOM",
            "FINISHED",
            "OTHER",
          ].includes(category.code)
        ) || null;
    }

    if (group === "consumable") {
      suggestedCategory =
        categories.find(
          (category) =>
            category.code === "CONSUMABLES"
        ) || null;
    }

    if (group === "material") {
      suggestedCategory =
        categories.find((category) =>
          [
            "SHEET-METAL",
            "PLATE",
            "TUBE-PIPE",
            "STRUCTURAL",
          ].includes(category.code)
        ) || null;
    }

    setForm((current) => ({
      ...current,
      itemGroup: group,
      itemType: config.itemType,
      isConsumable: config.isConsumable,
      itemNumber:
        /^MW-(INV|SHW)-\d+$/i.test(current.itemNumber) || !current.itemNumber
          ? buildItemNumber(
              group === "showroom" ? nextNumbers.showroom : nextNumbers.general,
              group
            )
          : current.itemNumber,
      categoryId:
        suggestedCategory?.id ||
        current.categoryId,
      reorderPoint:
        group === "consumable"
          ? current.reorderPoint
          : 0,
      reorderQuantity:
        group === "consumable"
          ? current.reorderQuantity
          : 0,
    }));

    if (group !== "showroom") {
      setCreateNewCrate(false);
    }
  }

  const categoryOptions = useMemo(
    () =>
      categories.map((category) => ({
        value: category.id,
        label: category.name,
      })),
    [categories]
  );

  const unitOptions = useMemo(
    () =>
      units.map((unit) => ({
        value: unit.id,
        label: `${unit.name} (${unit.abbreviation})`,
      })),
    [units]
  );

  const binOptions = useMemo(
    () =>
      bins.map((bin) => ({
        value: bin.id,
        label: [
          bin.zone,
          bin.name,
          bin.code,
        ]
          .filter(Boolean)
          .join(" — "),
      })),
    [bins]
  );

  const selectedCategory = useMemo(
    () =>
      categories.find(
        (category) =>
          category.id === form.categoryId
      ) || null,
    [categories, form.categoryId]
  );

  const selectedUnit = useMemo(
    () =>
      units.find(
        (unit) => unit.id === form.unitId
      ) || null,
    [units, form.unitId]
  );

  const selectedBin = useMemo(
    () =>
      bins.find(
        (bin) =>
          bin.id === form.defaultBinId
      ) || null,
    [bins, form.defaultBinId]
  );

  const groupConfig =
    getItemGroupConfig(form.itemGroup);

  function validateForm() {
    const errors = {};

    if (!String(form.name || "").trim()) {
      errors.name = "Item name is required.";
    }

    if (!String(form.itemNumber || "").trim()) {
      errors.itemNumber =
        "Item number is required.";
    }

    if (!form.categoryId) {
      errors.categoryId =
        "Category is required.";
    }

    if (!form.unitId) {
      errors.unitId =
        "Unit of measure is required.";
    }

    if (
      form.itemGroup === "showroom" &&
      !form.defaultBinId &&
      !createNewCrate
    ) {
      errors.defaultBinId = "A craft-show crate is required for showroom products.";
    }

    if (form.itemGroup === "showroom" && createNewCrate) {
      if (!cleanNullableText(newCrate.code)) {
        errors.newCrateCode = "New crate code is required.";
      }
      if (!cleanNullableText(newCrate.name)) {
        errors.newCrateName = "New crate name is required.";
      }
      if (!primaryLocation?.id) {
        errors.defaultBinId = "The primary inventory location could not be identified.";
      }
    }

    if (
      safeNumber(form.startingQuantity) < 0
    ) {
      errors.startingQuantity =
        "Starting quantity cannot be negative.";
    }

    if (
      safeNumber(form.standardCost) < 0
    ) {
      errors.standardCost =
        "Standard cost cannot be negative.";
    }

    if (
      safeNumber(form.sellingPrice) < 0
    ) {
      errors.sellingPrice =
        "Selling price cannot be negative.";
    }

    if (
      safeNumber(form.reorderPoint) < 0
    ) {
      errors.reorderPoint =
        "Reorder point cannot be negative.";
    }

    if (
      safeNumber(form.reorderQuantity) < 0
    ) {
      errors.reorderQuantity =
        "Reorder quantity cannot be negative.";
    }

    if (
      safeNumber(form.minimumStock) < 0
    ) {
      errors.minimumStock =
        "Minimum stock cannot be negative.";
    }

    if (
      form.maximumStock !== null &&
      form.maximumStock !== "" &&
      safeNumber(form.maximumStock) < 0
    ) {
      errors.maximumStock =
        "Maximum stock cannot be negative.";
    }

    if (
      form.preferredStockLevel !== null &&
      form.preferredStockLevel !== "" &&
      safeNumber(form.preferredStockLevel) < 0
    ) {
      errors.preferredStockLevel =
        "Preferred stock level cannot be negative.";
    }

    setValidationErrors(errors);

    return Object.keys(errors).length === 0;
  }

  async function resolveStorageBin() {
    if (!createNewCrate) {
      return form.defaultBinId || null;
    }

    const crateCode = String(newCrate.code || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9-]+/g, "-");

    const existingCrate = bins.find(
      (bin) => String(bin.code || "").toUpperCase() === crateCode
    );

    if (existingCrate) {
      return existingCrate.id;
    }

    const { data, error } = await supabase
      .from("inventory_bins")
      .insert({
        location_id: primaryLocation.id,
        name: String(newCrate.name).trim(),
        code: crateCode,
        zone: "Showroom / Craft Shows",
        description:
          newCrate.type === "large"
            ? "Large wood craft-show crate for items 20 inches and above."
            : "Standard wood craft-show crate.",
        barcode_value: `MW-BIN-${crateCode}`,
        qr_code_value: `MW-BIN-${crateCode}`,
        is_active: true,
      })
      .select("id,name,code,zone,description,is_active")
      .single();

    if (error) {
      throw error;
    }

    setBins((current) => [...current, data]);
    return data.id;
  }

  async function uploadItemImage(itemId) {
    if (!imageFile) {
      return {
        publicUrl: null,
        storagePath: null,
      };
    }

    const extension =
      imageFile.name
        .split(".")
        .pop()
        ?.toLowerCase() || "jpg";

    const safeItemName =
      slugify(form.name) || itemId;

    const storagePath =
      `${itemId}/${Date.now()}-${safeItemName}.${extension}`;

    const uploadResult = await supabase.storage
      .from("inventory-images")
      .upload(storagePath, imageFile, {
        cacheControl: "3600",
        upsert: false,
        contentType:
          imageFile.type || undefined,
      });

    if (uploadResult.error) {
      throw uploadResult.error;
    }

    const publicUrlResult = supabase.storage
      .from("inventory-images")
      .getPublicUrl(storagePath);

    const publicUrl =
      publicUrlResult.data?.publicUrl || null;

    const imageInsertResult = await supabase
      .from("inventory_item_images")
      .insert({
        inventory_item_id: itemId,
        storage_bucket:
          "inventory-images",
        storage_path: storagePath,
        public_url: publicUrl,
        file_name: imageFile.name,
        mime_type:
          imageFile.type || null,
        file_size_bytes:
          imageFile.size || null,
        alt_text:
          cleanNullableText(form.name),
        caption:
          cleanNullableText(
            form.description
          ),
        sort_order: 0,
        is_primary: true,
        is_active: true,
      });

    if (imageInsertResult.error) {
      throw imageInsertResult.error;
    }

    const updateItemResult = await supabase
      .from("inventory_items")
      .update({
        primary_image_url: publicUrl,
        primary_image_path: storagePath,
        image_alt_text:
          cleanNullableText(form.name),
      })
      .eq("id", itemId);

    if (updateItemResult.error) {
      throw updateItemResult.error;
    }

    return {
      publicUrl,
      storagePath,
    };
  }

  async function createQrLabel(item) {
    if (!form.createQrLabel) {
      return;
    }

    const qrToken =
      item.qr_code_value ||
      `mw://inventory/item/${item.item_number}`;

    const labelResult = await supabase
      .from("inventory_labels")
      .insert({
        label_type: "item",
        inventory_item_id: item.id,
        label_name: item.name,
        qr_token: qrToken,
        qr_payload: {
          type: "inventory_item",
          id: item.id,
          item_number: item.item_number,
          name: item.name,
        },
        barcode_value:
          item.barcode_value || null,
        label_template:
          "inventory-standard",
        print_width_inches: 2,
        print_height_inches: 1,
        is_active: true,
      });

    if (labelResult.error) {
      throw labelResult.error;
    }
  }

  async function createOpeningStock(itemId, binId) {
    if (!binId) {
      return;
    }

    const stockResult = await supabase.rpc("mw_adjust_inventory_quantity", {
      p_inventory_item_id: itemId,
      p_bin_id: binId,
      p_operation: "set",
      p_quantity: safeNumber(form.startingQuantity),
      p_reason: "Opening balance",
      p_notes: "Created through Add Inventory Item",
      p_reference_type: "New Inventory Item",
      p_reference_id: null,
      p_reference_number: form.itemNumber,
      p_performed_by: null,
    });

    if (stockResult.error) {
      throw stockResult.error;
    }
  }

  async function handleSubmit(addAnother = false) {
    if (!validateForm()) {
      notifications.show({
        title: "Missing Information",
        message:
          "Review the highlighted fields before saving the inventory item.",
        color: "orange",
      });

      return;
    }

    setSaving(true);

    let createdItemId = null;

    try {
      const resolvedBinId = await resolveStorageBin();

      const qrCodeValue = form.createQrLabel
        ? `mw://inventory/item/${String(
            form.itemNumber
          ).trim()}`
        : null;

      const insertPayload = {
        item_number: String(
          form.itemNumber
        ).trim(),

        sku:
          cleanNullableText(form.sku),

        name: String(form.name).trim(),

        description:
          cleanNullableText(
            form.description
          ),

        category_id: form.categoryId,
        unit_id: form.unitId,

        default_bin_id:
          resolvedBinId || null,

        item_type: form.itemType,
        tracking_type:
          form.trackingType,

        manufacturer:
          cleanNullableText(
            form.manufacturer
          ),

        manufacturer_part_number:
          cleanNullableText(
            form.manufacturerPartNumber
          ),

        qr_code_value: qrCodeValue,

        barcode_value: form.createQrLabel
          ? String(form.itemNumber).trim()
          : null,

        color_name:
          cleanNullableText(
            form.colorName
          ),

        color_code:
          cleanNullableText(
            form.colorCode
          ),

        material_family:
          cleanNullableText(
            form.materialFamily
          ),

        material_grade:
          cleanNullableText(
            form.materialGrade
          ),

        thickness:
          cleanNullableText(
            form.thickness
          ),

        width:
          cleanNullableText(form.width),

        length:
          cleanNullableText(form.length),

        dimensions:
          cleanNullableText(
            form.dimensions
          ),

        standard_cost:
          safeNumber(
            form.standardCost
          ),

        average_cost:
          safeNumber(
            form.standardCost
          ),

        last_cost:
          safeNumber(
            form.standardCost
          ),

        selling_price:
          safeNumber(
            form.sellingPrice
          ),

        reorder_point:
          safeNumber(
            form.reorderPoint
          ),

        reorder_quantity:
          safeNumber(
            form.reorderQuantity
          ),

        minimum_stock:
          safeNumber(
            form.minimumStock
          ),

        maximum_stock:
          form.maximumStock === null ||
          form.maximumStock === ""
            ? null
            : safeNumber(
                form.maximumStock
              ),

        preferred_stock_level:
          form.preferredStockLevel ===
            null ||
          form.preferredStockLevel ===
            ""
            ? null
            : safeNumber(
                form.preferredStockLevel
              ),

        allow_negative_stock:
          form.allowNegativeStock,

        is_stock_item:
          form.isStockItem,

        is_consumable:
          form.isConsumable,

        requires_inspection:
          form.requiresInspection,

        notes: cleanNullableText(
          [
            form.finish ? `Finish: ${form.finish}` : "",
            form.notes,
          ]
            .filter(Boolean)
            .join("\n")
        ),

        is_active: form.isActive,
      };

      const itemResult = await supabase
        .from("inventory_items")
        .insert(insertPayload)
        .select("*")
        .single();

      if (itemResult.error) {
        throw itemResult.error;
      }

      const createdItem = itemResult.data;
      createdItemId = createdItem.id;

      await createOpeningStock(
        createdItem.id,
        resolvedBinId
      );

      await createQrLabel(createdItem);

      const imageResult =
        await uploadItemImage(
          createdItem.id
        );

      const completeItem = {
        ...createdItem,
        primary_image_url:
          imageResult.publicUrl ||
          createdItem.primary_image_url,
        primary_image_path:
          imageResult.storagePath ||
          createdItem.primary_image_path,
        category_name:
          selectedCategory?.name ||
          null,
        unit_name:
          selectedUnit?.name || null,
        unit_abbreviation:
          selectedUnit?.abbreviation ||
          null,
        default_bin_name:
          selectedBin?.name || null,
        default_bin_code:
          selectedBin?.code || null,
        quantity_on_hand:
          safeNumber(
            form.startingQuantity
          ),
        quantity_reserved: 0,
        quantity_quarantined: 0,
        quantity_available:
          safeNumber(
            form.startingQuantity
          ),
      };

      if (
        typeof setSelectedInventoryItem ===
        "function"
      ) {
        setSelectedInventoryItem(
          completeItem
        );
      }

      notifications.show({
        title: "Inventory Item Created",
        message: `${createdItem.name} was added successfully.`,
        color: "green",
        icon: <IconCheck size={18} />,
      });

      const sequenceKey = form.itemGroup === "showroom" ? "showroom" : "general";
      const nextSequence = nextNumbers[sequenceKey] + 1;

      setNextNumbers((current) => ({
        ...current,
        [sequenceKey]: nextSequence,
      }));

      if (addAnother) {
        const currentGroup = form.itemGroup;
        const currentCategoryId = form.categoryId;
        const currentUnitId = form.unitId;
        const currentBinId = resolvedBinId || "";
        const config = getItemGroupConfig(currentGroup);

        setForm({
          ...INITIAL_FORM,
          itemGroup: currentGroup,
          itemType: config.itemType,
          isConsumable: config.isConsumable,
          itemNumber: buildItemNumber(nextSequence, currentGroup),
          categoryId: currentCategoryId,
          unitId: currentUnitId,
          defaultBinId: currentBinId,
        });
        setImageFile(null);
        setValidationErrors({});
        setCreateNewCrate(false);
        setNewCrate({ code: "", name: "", type: "standard" });
        window.scrollTo({ top: 0, behavior: "smooth" });

        notifications.show({
          title: "Ready for Another Item",
          message: "The previous item was saved and a new item number is ready.",
          color: "blue",
          icon: <IconPlus size={18} />,
        });
      } else {
        setPage?.("inventoryItems");
      }
    } catch (error) {
      console.error(
        "Inventory item save error:",
        error
      );

      if (createdItemId) {
        console.warn(
          "The inventory item record may have been created before a related setup step failed:",
          createdItemId
        );
      }

      const duplicateMessage =
        String(error.message || "")
          .toLowerCase()
          .includes("duplicate")
          ? "The item number, SKU, QR code, or another unique field is already in use."
          : null;

      notifications.show({
        title: "Unable to Save Item",
        message:
          duplicateMessage ||
          error.message ||
          "The inventory item could not be created.",
        color: "red",
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <>
        <MWPageHeader
          title="Add Inventory Item"
          subtitle="Loading categories, units, and Metal Worx storage positions."
          setPage={setPage}
          showBack
          backPage="inventoryItems"
          backLabel="Inventory Items"
          showDashboard
        />

        <MWPanel
          title="Loading Item Form"
          subtitle="Preparing inventory setup options."
          icon={IconPackage}
          color="red"
        >
          <Group
            justify="center"
            py={80}
            gap="md"
          >
            <Loader color="red" />

            <Text c="gray.4">
              Loading inventory form...
            </Text>
          </Group>
        </MWPanel>
      </>
    );
  }

  return (
    <>
      <MWPageHeader
        title="Add Inventory Item"
        subtitle="Create a showroom item, consumable, reusable component, or optionally tracked shop material."
        setPage={setPage}
        showBack
        backPage="inventoryItems"
        backLabel="Inventory Items"
        showDashboard
      />

      <Stack gap="lg">
        <MWPanel
          title="Choose Item Group"
          subtitle="Select how Metal Worx will use and track this item."
          icon={IconPackage}
          color={groupConfig.color}
        >
          <SimpleGrid
            cols={{
              base: 1,
              md: 3,
            }}
            spacing="md"
          >
            <GroupSelectionCard
              value="showroom"
              selected={
                form.itemGroup ===
                "showroom"
              }
              title="Showroom Item"
              description="Samples, finished display pieces, blanks, components, and stocked items."
              icon={IconBuildingStore}
              color="violet"
              onClick={selectItemGroup}
            />

            <GroupSelectionCard
              value="consumable"
              selected={
                form.itemGroup ===
                "consumable"
              }
              title="Consumable"
              description="Powder, abrasives, tape, hardware, paint, packaging, and supplies."
              icon={IconTool}
              color="orange"
              onClick={selectItemGroup}
            />

            <GroupSelectionCard
              value="material"
              selected={
                form.itemGroup ===
                "material"
              }
              title="Shop Material"
              description="Optional tracking for sheet, tube, plate, aluminum, and raw material."
              icon={IconBox}
              color="blue"
              onClick={selectItemGroup}
            />
          </SimpleGrid>
        </MWPanel>

        <SimpleGrid
          cols={{
            base: 1,
            xl: 12,
          }}
          spacing="lg"
        >
          <Box
            style={{
              gridColumn: "span 8",
              minWidth: 0,
            }}
          >
            <Stack gap="lg">
              <MWPanel
                title="Item Information"
                subtitle="Primary identity and classification."
                icon={groupConfig.icon}
                color={groupConfig.color}
              >
                <Stack gap="md">
                  <SimpleGrid
                    cols={{
                      base: 1,
                      md: 2,
                    }}
                    spacing="md"
                  >
                    <TextInput
                      label="Item Name"
                      placeholder="Example: 24-inch Army Flag Blank"
                      required
                      value={form.name}
                      onChange={(event) =>
                        updateField(
                          "name",
                          event.currentTarget
                            .value
                        )
                      }
                      error={
                        validationErrors.name
                      }
                    />

                    <TextInput
                      label="Item Number"
                      placeholder="MW-INV-0015"
                      required
                      value={form.itemNumber}
                      onChange={(event) =>
                        updateField(
                          "itemNumber",
                          event.currentTarget
                            .value
                        )
                      }
                      error={
                        validationErrors.itemNumber
                      }
                    />

                    <TextInput
                      label="SKU"
                      placeholder="Optional internal SKU"
                      value={form.sku}
                      onChange={(event) =>
                        updateField(
                          "sku",
                          event.currentTarget
                            .value
                        )
                      }
                    />

                    <Select
                      label="Category"
                      placeholder="Choose category"
                      required
                      searchable
                      data={categoryOptions}
                      value={form.categoryId}
                      onChange={(value) =>
                        updateField(
                          "categoryId",
                          value || ""
                        )
                      }
                      error={
                        validationErrors.categoryId
                      }
                    />
                  </SimpleGrid>

                  <Textarea
                    label="Description"
                    placeholder="Describe the item, how it is used, or what makes it different from similar items."
                    minRows={3}
                    autosize
                    value={form.description}
                    onChange={(event) =>
                      updateField(
                        "description",
                        event.currentTarget
                          .value
                      )
                    }
                  />
                </Stack>
              </MWPanel>

              <MWPanel
                title="Quantity & Storage"
                subtitle="Starting quantity, unit of measure, and where the item is kept."
                icon={IconBox}
                color="green"
              >
                <SimpleGrid
                  cols={{
                    base: 1,
                    md: 2,
                  }}
                  spacing="md"
                >
                  <Select
                    label="Unit of Measure"
                    description="How this item is counted."
                    placeholder="Choose unit"
                    required
                    searchable
                    data={unitOptions}
                    value={form.unitId}
                    onChange={(value) =>
                      updateField(
                        "unitId",
                        value || ""
                      )
                    }
                    error={
                      validationErrors.unitId
                    }
                  />

                  <NumberInput
                    label="Starting Quantity"
                    description="Current physical quantity on hand."
                    min={0}
                    decimalScale={4}
                    value={
                      form.startingQuantity
                    }
                    onChange={(value) =>
                      updateField(
                        "startingQuantity",
                        value
                      )
                    }
                    error={
                      validationErrors.startingQuantity
                    }
                  />

                  <Select
                    label="Storage Position"
                    description="Where this item is physically stored."
                    placeholder="Choose storage position"
                    searchable
                    clearable
                    data={binOptions}
                    value={
                      form.defaultBinId ||
                      null
                    }
                    onChange={(value) =>
                      updateField(
                        "defaultBinId",
                        value || ""
                      )
                    }
                    error={validationErrors.defaultBinId}
                    disabled={createNewCrate}
                  />

                  <Select
                    label="Tracking Method"
                    description="How inventory quantity is maintained."
                    data={[
                      {
                        value: "quantity",
                        label:
                          "Exact Quantity",
                      },
                      {
                        value: "weight",
                        label:
                          "Weight / Partial Quantity",
                      },
                      {
                        value: "status",
                        label:
                          "Simple Stock Status",
                      },
                    ]}
                    value={
                      form.trackingType
                    }
                    onChange={(value) =>
                      updateField(
                        "trackingType",
                        value ||
                          "quantity"
                      )
                    }
                    allowDeselect={false}
                  />
                </SimpleGrid>

                {form.itemGroup === "showroom" && (
                  <Stack gap="md" mt="md">
                    <Box
                      p="md"
                      style={{
                        borderRadius: 12,
                        border: createNewCrate
                          ? "1px solid var(--mantine-color-red-7)"
                          : "1px solid rgba(255,255,255,0.09)",
                        background: createNewCrate
                          ? "linear-gradient(135deg, rgba(120,0,0,0.22), rgba(255,255,255,0.025))"
                          : "rgba(255,255,255,0.025)",
                      }}
                    >
                      <Group justify="space-between" align="center" wrap="nowrap">
                        <Box>
                          <Text fw={800} c="gray.1">
                            Create a new craft-show crate
                          </Text>
                          <Text size="xs" c="gray.5" mt={3}>
                            Use this only when the product is going into a crate that is not already listed.
                          </Text>
                        </Box>

                        <Switch
                          aria-label="Create a new craft-show crate"
                          checked={createNewCrate}
                          onChange={(event) =>
                            setCreateNewCrate(event.currentTarget.checked)
                          }
                          color="red"
                          size="md"
                        />
                      </Group>
                    </Box>

                    {createNewCrate && (
                      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
                        <TextInput
                          label="Crate Code"
                          placeholder="CR-29 or LG-29"
                          required
                          value={newCrate.code}
                          onChange={(event) => {
                            const value = event.currentTarget.value.toUpperCase();
                            setNewCrate((current) => ({ ...current, code: value }));
                            setValidationErrors((current) => ({ ...current, newCrateCode: null }));
                          }}
                          error={validationErrors.newCrateCode}
                        />

                        <TextInput
                          label="Crate Name"
                          placeholder="Craft Show Crate CR-29"
                          required
                          value={newCrate.name}
                          onChange={(event) => {
                            setNewCrate((current) => ({
                              ...current,
                              name: event.currentTarget.value,
                            }));
                            setValidationErrors((current) => ({ ...current, newCrateName: null }));
                          }}
                          error={validationErrors.newCrateName}
                        />

                        <Select
                          label="Crate Type"
                          value={newCrate.type}
                          onChange={(value) =>
                            setNewCrate((current) => ({
                              ...current,
                              type: value || "standard",
                            }))
                          }
                          data={[
                            { value: "standard", label: "Standard Wood Crate" },
                            { value: "large", label: "Large Wood Crate (20+ in.)" },
                          ]}
                          allowDeselect={false}
                        />
                      </SimpleGrid>
                    )}
                  </Stack>
                )}

                {form.itemGroup ===
                  "material" && (
                  <Alert
                    mt="md"
                    color="blue"
                    variant="light"
                    radius="md"
                    icon={
                      <IconInfoCircle
                        size={18}
                      />
                    }
                    title="Practical material tracking"
                  >
                    Steel, aluminum, tube, and plate can use exact counts or a
                    simplified stock status. The team does not need to record
                    every cut or scrap piece.
                  </Alert>
                )}
              </MWPanel>

              <MWPanel
                title="Reorder Settings"
                subtitle="Set minimum quantities for items that should trigger restocking."
                icon={IconAlertTriangle}
                color="orange"
              >
                <SimpleGrid
                  cols={{
                    base: 1,
                    sm: 2,
                  }}
                  spacing="xl"
                  verticalSpacing="lg"
                >
                  <NumberInput
                    label="Reorder Point"
                    description="Alert when available stock reaches this amount."
                    styles={REORDER_INPUT_STYLES}
                    min={0}
                    decimalScale={4}
                    value={form.reorderPoint}
                    onChange={(value) =>
                      updateField(
                        "reorderPoint",
                        value
                      )
                    }
                    error={
                      validationErrors.reorderPoint
                    }
                  />

                  <NumberInput
                    label="Reorder Quantity"
                    description="Suggested quantity to replenish."
                    styles={REORDER_INPUT_STYLES}
                    min={0}
                    decimalScale={4}
                    value={
                      form.reorderQuantity
                    }
                    onChange={(value) =>
                      updateField(
                        "reorderQuantity",
                        value
                      )
                    }
                    error={
                      validationErrors.reorderQuantity
                    }
                  />

                  <NumberInput
                    label="Minimum Stock"
                    description="Preferred minimum quantity on hand."
                    styles={REORDER_INPUT_STYLES}
                    min={0}
                    decimalScale={4}
                    value={form.minimumStock}
                    onChange={(value) =>
                      updateField(
                        "minimumStock",
                        value
                      )
                    }
                    error={
                      validationErrors.minimumStock
                    }
                  />

                  <NumberInput
                    label="Maximum Stock"
                    description="Optional maximum quantity to keep."
                    styles={REORDER_INPUT_STYLES}
                    min={0}
                    decimalScale={4}
                    clearable
                    value={form.maximumStock}
                    onChange={(value) =>
                      updateField(
                        "maximumStock",
                        value
                      )
                    }
                    error={
                      validationErrors.maximumStock
                    }
                  />
                </SimpleGrid>

                {form.itemGroup !==
                  "consumable" && (
                  <Alert
                    mt="md"
                    color="gray"
                    variant="light"
                    radius="md"
                    icon={
                      <IconInfoCircle
                        size={18}
                      />
                    }
                  >
                    Reorder points are optional for showroom items and raw
                    materials. They are most useful for supplies the shop uses
                    regularly.
                  </Alert>
                )}
              </MWPanel>

              <MWPanel
                title="Cost & Product Details"
                subtitle="Optional pricing, manufacturer, color, size, and material details."
                icon={IconPackage}
                color="blue"
              >
                <Stack gap="md">
                  <SimpleGrid
                    cols={{
                      base: 1,
                      md: 2,
                    }}
                    spacing="md"
                  >
                    <NumberInput
                      label="Standard Cost"
                      prefix="$"
                      min={0}
                      decimalScale={4}
                      fixedDecimalScale={false}
                      value={
                        form.standardCost
                      }
                      onChange={(value) =>
                        updateField(
                          "standardCost",
                          value
                        )
                      }
                      error={
                        validationErrors.standardCost
                      }
                    />

                    <NumberInput
                      label="Selling Price"
                      prefix="$"
                      min={0}
                      decimalScale={2}
                      fixedDecimalScale={false}
                      value={
                        form.sellingPrice
                      }
                      onChange={(value) =>
                        updateField(
                          "sellingPrice",
                          value
                        )
                      }
                      error={
                        validationErrors.sellingPrice
                      }
                    />

                    <TextInput
                      label="Manufacturer"
                      value={
                        form.manufacturer
                      }
                      onChange={(event) =>
                        updateField(
                          "manufacturer",
                          event.currentTarget
                            .value
                        )
                      }
                    />

                    <TextInput
                      label="Manufacturer Part Number"
                      value={
                        form.manufacturerPartNumber
                      }
                      onChange={(event) =>
                        updateField(
                          "manufacturerPartNumber",
                          event.currentTarget
                            .value
                        )
                      }
                    />

                    <TextInput
                      label="Color Name"
                      placeholder="Example: Red, Black, Oyster White"
                      value={form.colorName}
                      onChange={(event) =>
                        updateField(
                          "colorName",
                          event.currentTarget
                            .value
                        )
                      }
                    />

                    <TextInput
                      label="Color Code"
                      placeholder="Example: PCT69118"
                      value={form.colorCode}
                      onChange={(event) =>
                        updateField(
                          "colorCode",
                          event.currentTarget
                            .value
                        )
                      }
                    />

                    <TextInput
                      label="Dimensions"
                      placeholder='Example: 24" x 12"'
                      value={form.dimensions}
                      onChange={(event) =>
                        updateField(
                          "dimensions",
                          event.currentTarget
                            .value
                        )
                      }
                    />

                    <TextInput
                      label="Finish"
                      placeholder="Patina, painted, black, copper, raw metal"
                      value={form.finish}
                      onChange={(event) =>
                        updateField(
                          "finish",
                          event.currentTarget.value
                        )
                      }
                    />

                    <NumberInput
                      label="Preferred Stock Level"
                      min={0}
                      decimalScale={4}
                      clearable
                      value={
                        form.preferredStockLevel
                      }
                      onChange={(value) =>
                        updateField(
                          "preferredStockLevel",
                          value
                        )
                      }
                      error={
                        validationErrors.preferredStockLevel
                      }
                    />
                  </SimpleGrid>

                  {form.itemGroup ===
                    "material" && (
                    <SimpleGrid
                      cols={{
                        base: 1,
                        md: 2,
                        xl: 5,
                      }}
                      spacing="md"
                    >
                      <TextInput
                        label="Material Family"
                        placeholder="Steel, Aluminum, Stainless"
                        value={
                          form.materialFamily
                        }
                        onChange={(event) =>
                          updateField(
                            "materialFamily",
                            event
                              .currentTarget
                              .value
                          )
                        }
                      />

                      <TextInput
                        label="Grade"
                        placeholder="A36, 5052, 304"
                        value={
                          form.materialGrade
                        }
                        onChange={(event) =>
                          updateField(
                            "materialGrade",
                            event
                              .currentTarget
                              .value
                          )
                        }
                      />

                      <TextInput
                        label="Thickness"
                        placeholder='1/8", 1/4", 16 ga'
                        value={
                          form.thickness
                        }
                        onChange={(event) =>
                          updateField(
                            "thickness",
                            event
                              .currentTarget
                              .value
                          )
                        }
                      />

                      <TextInput
                        label="Width"
                        value={form.width}
                        onChange={(event) =>
                          updateField(
                            "width",
                            event
                              .currentTarget
                              .value
                          )
                        }
                      />

                      <TextInput
                        label="Length"
                        value={form.length}
                        onChange={(event) =>
                          updateField(
                            "length",
                            event
                              .currentTarget
                              .value
                          )
                        }
                      />
                    </SimpleGrid>
                  )}
                </Stack>
              </MWPanel>

              <MWPanel
                title="Image & Notes"
                subtitle="Add a reference photo and any internal information needed to identify or restock the item."
                icon={IconPhoto}
                color="violet"
              >
                <Stack gap="md">
                  <InventoryImageCapture
                    value={imageFile}
                    onChange={setImageFile}
                    label="Reference Image"
                    description="Upload an existing image, take a photo with the computer or USB camera, or add the image later."
                  />

                  <Textarea
                    label="Internal Notes"
                    placeholder="Add restocking notes, identification details, preferred sizes, or other useful information."
                    minRows={4}
                    autosize
                    value={form.notes}
                    onChange={(event) =>
                      updateField(
                        "notes",
                        event.currentTarget
                          .value
                      )
                    }
                  />
                </Stack>
              </MWPanel>
            </Stack>
          </Box>

          <Box
            style={{
              gridColumn: "span 4",
              minWidth: 0,
            }}
          >
            <Stack
              gap="lg"
              style={{
                position: "sticky",
                top: 20,
              }}
            >
              <MWPanel
                title="Item Summary"
                subtitle="Review the record before saving."
                icon={groupConfig.icon}
                color={groupConfig.color}
                compact
              >
                <Stack gap={0}>
                  <FormSummaryRow
                    label="Item Group"
                    value={groupConfig.label}
                    color={groupConfig.color}
                  />

                  <FormSummaryRow
                    label="Item Number"
                    value={
                      form.itemNumber ||
                      "Not assigned"
                    }
                  />

                  <FormSummaryRow
                    label="Category"
                    value={
                      selectedCategory?.name ||
                      "Not selected"
                    }
                  />

                  <FormSummaryRow
                    label="Unit"
                    value={
                      selectedUnit
                        ? `${selectedUnit.name} (${selectedUnit.abbreviation})`
                        : "Not selected"
                    }
                  />

                  <FormSummaryRow
                    label="Starting Quantity"
                    value={`${safeNumber(
                      form.startingQuantity
                    )} ${
                      selectedUnit?.abbreviation ||
                      ""
                    }`}
                    color="green"
                  />

                  <FormSummaryRow
                    label="Storage"
                    value={
                      createNewCrate
                        ? newCrate.name || newCrate.code || "New crate not completed"
                        : selectedBin?.name || "Unassigned"
                    }
                  />

                  <FormSummaryRow
                    label="Reorder Point"
                    value={safeNumber(
                      form.reorderPoint
                    )}
                    color={
                      form.itemGroup ===
                      "consumable"
                        ? "orange"
                        : "gray"
                    }
                  />

                  <FormSummaryRow
                    label="Image"
                    value={
                      imageFile
                        ? "Selected"
                        : "Not added"
                    }
                    color={
                      imageFile
                        ? "green"
                        : "gray"
                    }
                  />

                  <FormSummaryRow
                    label="QR Label"
                    value={
                      form.createQrLabel
                        ? "Create record"
                        : "Do not create"
                    }
                    color={
                      form.createQrLabel
                        ? "violet"
                        : "gray"
                    }
                  />
                </Stack>
              </MWPanel>

              <MWPanel
                title="Item Controls"
                subtitle="Inventory behavior and availability."
                icon={IconQrcode}
                color="blue"
                compact
              >
                <Stack gap="md">
                  <Switch
                    label="Create QR label record"
                    description="Makes the item ready for future label printing and scanning."
                    checked={
                      form.createQrLabel
                    }
                    onChange={(event) =>
                      updateField(
                        "createQrLabel",
                        event.currentTarget
                          .checked
                      )
                    }
                    color="violet"
                  />

                  <Switch
                    label="Active item"
                    description="Active items appear throughout inventory."
                    checked={form.isActive}
                    onChange={(event) =>
                      updateField(
                        "isActive",
                        event.currentTarget
                          .checked
                      )
                    }
                    color="green"
                  />

                  <Switch
                    label="Stock item"
                    description="Track a quantity on hand for this item."
                    checked={
                      form.isStockItem
                    }
                    onChange={(event) =>
                      updateField(
                        "isStockItem",
                        event.currentTarget
                          .checked
                      )
                    }
                    color="blue"
                  />

                  <Switch
                    label="Consumable"
                    description="Item is regularly used and replenished."
                    checked={
                      form.isConsumable
                    }
                    onChange={(event) =>
                      updateField(
                        "isConsumable",
                        event.currentTarget
                          .checked
                      )
                    }
                    color="orange"
                  />

                  <Checkbox
                    label="Allow negative stock"
                    description="Not recommended for showroom items or consumables."
                    checked={
                      form.allowNegativeStock
                    }
                    onChange={(event) =>
                      updateField(
                        "allowNegativeStock",
                        event.currentTarget
                          .checked
                      )
                    }
                    color="red"
                  />

                  <Checkbox
                    label="Requires inspection"
                    description="Received quantities should be checked before use."
                    checked={
                      form.requiresInspection
                    }
                    onChange={(event) =>
                      updateField(
                        "requiresInspection",
                        event.currentTarget
                          .checked
                      )
                    }
                    color="orange"
                  />
                </Stack>
              </MWPanel>

              {!form.defaultBinId &&
                safeNumber(
                  form.startingQuantity
                ) > 0 && (
                  <Alert
                    color="orange"
                    variant="light"
                    radius="lg"
                    icon={
                      <IconAlertTriangle
                        size={18}
                      />
                    }
                    title="Storage position recommended"
                  >
                    The item can be saved, but its starting quantity will not
                    have a stock record until a storage position is assigned.
                  </Alert>
                )}

              <Stack gap="sm">
                <Button
                  fullWidth
                  variant="default"
                  size="md"
                  onClick={() =>
                    setPage?.(
                      "inventoryItems"
                    )
                  }
                  disabled={saving}
                >
                  Cancel
                </Button>

                <Button
                  fullWidth
                  variant="light"
                  color="gray"
                  size="md"
                  leftSection={<IconPlus size={18} />}
                  onClick={() => handleSubmit(true)}
                  disabled={saving}
                >
                  Save & Add Another
                </Button>

                <Button
                  fullWidth
                  color="red"
                  size="md"
                  leftSection={
                    saving ? (
                      <Loader
                        size={16}
                        color="white"
                      />
                    ) : (
                      <IconDeviceFloppy
                        size={18}
                      />
                    )
                  }
                  onClick={() => handleSubmit(false)}
                  loading={saving}
                >
                  Save Item
                </Button>
              </Stack>
            </Stack>
          </Box>
        </SimpleGrid>
      </Stack>
    </>
  );
}

export default NewInventoryItem;