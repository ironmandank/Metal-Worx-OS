import {
  Alert,
  Badge,
  Box,
  Button,
  Center,
  Divider,
  Group,
  Loader,
  Modal,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconAlertTriangle,
  IconBox,
  IconCamera,
  IconCameraOff,
  IconCheck,
  IconClipboardCheck,
  IconHash,
  IconMapPin,
  IconPackageImport,
  IconQrcode,
  IconReceipt,
  IconSearch,
  IconTruckDelivery,
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
  return numberValue(value).toLocaleString("en-US", {
    maximumFractionDigits: 4,
  });
}

function getItemId(item) {
  return item?.inventory_item_id || item?.id || null;
}

function InventoryReceiving({
  setPage,
  selectedInventoryItem,
  setSelectedInventoryItem,
  activeUser,
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState([]);
  const [bins, setBins] = useState([]);
  const [balances, setBalances] = useState([]);
  const [itemId, setItemId] = useState(getItemId(selectedInventoryItem) || "");
  const [binId, setBinId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [receiptType, setReceiptType] = useState("Produced In-House");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [source, setSource] = useState("");
  const [notes, setNotes] = useState("");
  const [scanValue, setScanValue] = useState("");
  const [scanning, setScanning] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");

  const scanInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const cameraTimerRef = useRef(null);

  const loadPageData = useCallback(async () => {
    setLoading(true);
    try {
      const [itemsResult, binsResult] = await Promise.all([
        supabase
          .from("inventory_item_availability")
          .select("*")
          .eq("is_active", true)
          .order("name", { ascending: true }),
        supabase
          .from("inventory_bins")
          .select(`
            id, name, code, zone, aisle, rack, shelf, position, is_active,
            inventory_locations (id, name, code)
          `)
          .eq("is_active", true)
          .order("zone", { ascending: true })
          .order("name", { ascending: true }),
      ]);

      if (itemsResult.error) throw itemsResult.error;
      if (binsResult.error) throw binsResult.error;

      const loadedItems = itemsResult.data || [];
      const loadedBins = binsResult.data || [];
      setItems(loadedItems);
      setBins(loadedBins);

      const startingItemId = itemId || getItemId(selectedInventoryItem) || "";
      if (startingItemId) {
        setItemId(startingItemId);
        const startingItem = loadedItems.find(
          (item) => getItemId(item) === startingItemId
        );
        setBinId(startingItem?.default_bin_id || loadedBins[0]?.id || "");
      }
    } catch (error) {
      console.error("Inventory receiving load error:", error);
      notifications.show({
        title: "Receiving Page Load Failed",
        message: error.message || "Unable to load inventory receiving data.",
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  }, [itemId, selectedInventoryItem]);

  useEffect(() => {
    loadPageData();
    // Page initialization should run once for the item supplied by App.jsx.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    async function loadBalances() {
      if (!itemId) {
        setBalances([]);
        return;
      }

      const { data, error } = await supabase
        .from("inventory_bin_balances")
        .select("*")
        .eq("inventory_item_id", itemId);

      if (error) {
        notifications.show({
          title: "Balance Load Failed",
          message: error.message,
          color: "red",
        });
        return;
      }

      setBalances(data || []);
    }

    loadBalances();
  }, [itemId]);

  const item = useMemo(
    () => items.find((candidate) => getItemId(candidate) === itemId) || null,
    [itemId, items]
  );

  const selectedBin = useMemo(
    () => bins.find((bin) => bin.id === binId) || null,
    [binId, bins]
  );

  const selectedBalance = useMemo(
    () => balances.find((balance) => balance.bin_id === binId) || null,
    [balances, binId]
  );

  const currentPositionQuantity = numberValue(selectedBalance?.quantity_on_hand);
  const projectedPositionQuantity = currentPositionQuantity + numberValue(quantity);
  const projectedItemQuantity = numberValue(item?.quantity_on_hand) + numberValue(quantity);

  const itemOptions = useMemo(
    () =>
      items.map((inventoryItem) => ({
        value: getItemId(inventoryItem),
        label: `${inventoryItem.item_number || inventoryItem.sku || "NO NUMBER"} · ${inventoryItem.name}`,
      })),
    [items]
  );

  const binOptions = useMemo(
    () =>
      bins.map((bin) => ({
        value: bin.id,
        label: [bin.code, bin.name, bin.inventory_locations?.name]
          .filter(Boolean)
          .join(" · "),
      })),
    [bins]
  );

  function selectItem(value) {
    const nextItemId = value || "";
    const nextItem = items.find(
      (candidate) => getItemId(candidate) === nextItemId
    );
    setItemId(nextItemId);
    setBinId(nextItem?.default_bin_id || bins[0]?.id || "");
    setSelectedInventoryItem?.(nextItem || null);
  }

  const scanItem = useCallback(async (rawValue) => {
    const value = String(rawValue || "").trim();
    if (!value || scanning) return;
    setScanning(true);

    try {
      const { data: label, error: labelError } = await supabase
        .from("inventory_labels")
        .select("inventory_item_id")
        .eq("is_active", true)
        .or(`qr_token.eq.${value},barcode_value.eq.${value}`)
        .limit(1)
        .maybeSingle();

      if (labelError) throw labelError;

      let matchedItem = label?.inventory_item_id
        ? items.find((candidate) => getItemId(candidate) === label.inventory_item_id)
        : null;

      if (!matchedItem) {
        matchedItem = items.find((candidate) =>
          [
            candidate.item_number,
            candidate.sku,
            candidate.manufacturer_part_number,
            candidate.barcode_value,
            candidate.qr_code_value,
          ].some((candidateValue) =>
            String(candidateValue || "").trim().toLowerCase() === value.toLowerCase()
          )
        );
      }

      if (!matchedItem) {
        throw new Error(`No active inventory item matched ${value}.`);
      }

      const matchedItemId = getItemId(matchedItem);
      setItemId(matchedItemId);
      setBinId(matchedItem.default_bin_id || bins[0]?.id || "");
      setSelectedInventoryItem?.(matchedItem);
      setScanValue("");

      notifications.show({
        title: "Item Scanned",
        message: `${matchedItem.name} is ready to receive.`,
        color: "green",
        icon: <IconCheck size={18} />,
      });
    } catch (error) {
      notifications.show({
        title: "Scan Not Recognized",
        message: error.message || "No inventory item matched that code.",
        color: "yellow",
      });
    } finally {
      setScanning(false);
      window.setTimeout(() => scanInputRef.current?.focus(), 80);
    }
  }, [bins, items, scanning, setSelectedInventoryItem]);

  const stopCamera = useCallback(() => {
    if (cameraTimerRef.current) {
      window.clearInterval(cameraTimerRef.current);
      cameraTimerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraReady(false);
    setCameraOpen(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError("");
    setCameraOpen(true);

    try {
      if (!("BarcodeDetector" in window)) {
        throw new Error("Camera scanning requires Chrome or Edge. The USB scanner and manual entry will still work.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      await new Promise((resolve) => window.setTimeout(resolve, 100));
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraReady(true);

      const detector = new window.BarcodeDetector({
        formats: ["qr_code", "code_128", "code_39", "ean_13", "ean_8", "upc_a", "upc_e"],
      });

      let detecting = false;
      cameraTimerRef.current = window.setInterval(async () => {
        if (detecting || !videoRef.current || videoRef.current.readyState < 2) return;
        detecting = true;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes?.[0]?.rawValue) {
            const value = codes[0].rawValue;
            stopCamera();
            await scanItem(value);
          }
        } catch (error) {
          console.warn("Receiving camera scan frame failed:", error);
        } finally {
          detecting = false;
        }
      }, 450);
    } catch (error) {
      setCameraError(error.message || "Unable to start the camera.");
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setCameraReady(false);
    }
  }, [scanItem, stopCamera]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const canSave =
    Boolean(itemId) &&
    Boolean(binId) &&
    numberValue(quantity) > 0 &&
    !saving;

  async function receiveStock() {
    if (!canSave) return;
    setSaving(true);

    try {
      const receiptNotes = [
        source.trim() ? `Source: ${source.trim()}` : "",
        notes.trim(),
      ]
        .filter(Boolean)
        .join(" | ");

      const { data, error } = await supabase.rpc(
        "mw_adjust_inventory_quantity",
        {
          p_inventory_item_id: itemId,
          p_bin_id: binId,
          p_operation: "receive",
          p_quantity: numberValue(quantity),
          p_reason: receiptType,
          p_notes: receiptNotes || null,
          p_reference_type: "Inventory Receipt",
          p_reference_id: null,
          p_reference_number: referenceNumber.trim() || null,
          p_performed_by: activeUser || null,
        }
      );

      if (error) throw error;

      const { data: refreshedItem, error: refreshError } = await supabase
        .from("inventory_item_availability")
        .select("*")
        .eq("inventory_item_id", itemId)
        .maybeSingle();

      if (refreshError) throw refreshError;
      setSelectedInventoryItem?.(refreshedItem || item);

      notifications.show({
        title: receiptType === "Produced In-House" ? "Inventory Added" : "Stock Received",
        message: `${formatNumber(quantity)} ${item?.unit_abbreviation || "units"} added to ${selectedBin?.code || selectedBin?.name || "the selected position"}. New position balance: ${formatNumber(data?.quantity_after ?? projectedPositionQuantity)}.`,
        color: "green",
        icon: <IconCheck size={18} />,
      });

      setPage?.("inventoryItemDetails");
    } catch (error) {
      console.error("Inventory receiving save error:", error);
      notifications.show({
        title: "Receiving Failed",
        message: error.message || "Unable to record the inventory receipt.",
        color: "red",
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Stack gap="xl">
        <MWPageHeader
          title="Receive Inventory"
          subtitle="Loading items and storage positions."
          setPage={setPage}
          showBack
          backPage="inventoryItems"
          backLabel="Inventory Items"
          showDashboard={false}
        />
        <MWPanel>
          <Group justify="center" py={90}>
            <Loader color="red" />
            <Text c="dimmed">Loading receiving controls…</Text>
          </Group>
        </MWPanel>
      </Stack>
    );
  }

  return (
    <Stack gap="xl">
      <MWPageHeader
        title="Add / Receive Inventory"
        subtitle="Add finished Metal Worx pieces or record supplies received from outside."
        setPage={setPage}
        showBack
        backPage={item ? "inventoryItemDetails" : "inventoryItems"}
        backLabel={item ? "Item Details" : "Inventory Items"}
        showDashboard={false}
      />

      <MWKpiStrip
        items={[
          {
            label: "Current Item Total",
            value: formatNumber(item?.quantity_on_hand),
            description: item?.unit_abbreviation || "Select an item",
            icon: IconBox,
            color: "blue",
          },
          {
            label: "Position Balance",
            value: formatNumber(currentPositionQuantity),
            description: selectedBin?.code || "Choose a position",
            icon: IconMapPin,
            color: "violet",
          },
          {
            label: "Receiving",
            value: `+${formatNumber(quantity)}`,
            description: "Incoming quantity",
            icon: IconPackageImport,
            color: "green",
          },
          {
            label: "New Item Total",
            value: formatNumber(projectedItemQuantity),
            description: "After receipt",
            icon: IconClipboardCheck,
            color: "green",
          },
        ]}
        columns={{ base: 1, sm: 2, xl: 4 }}
        compact
      />

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="xl">
        <MWPanel
          title="Receipt Details"
          subtitle="Identify what was made or received and where it will be stored"
          icon={IconTruckDelivery}
        >
          <Stack gap="lg">
            <Paper
              p="md"
              radius="lg"
              style={{
                background: "rgba(111,0,0,0.12)",
                border: "1px solid rgba(224,49,49,0.28)",
              }}
            >
              <Stack gap="sm">
                <Group justify="space-between">
                  <Group gap="sm">
                    <ThemeIcon color="red" variant="light" radius="md">
                      <IconQrcode size={19} />
                    </ThemeIcon>
                    <Stack gap={0}>
                      <Text fw={850}>Scan Item</Text>
                      <Text size="xs" c="dimmed">USB scanner, QR code, barcode, or manual code</Text>
                    </Stack>
                  </Group>
                  <Button variant="light" color="red" leftSection={<IconCamera size={17} />} onClick={startCamera}>
                    Camera
                  </Button>
                </Group>
                <TextInput
                  ref={scanInputRef}
                  value={scanValue}
                  onChange={(event) => setScanValue(event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") scanItem(scanValue);
                  }}
                  placeholder="Click here, then scan—or type a code and press Enter"
                  leftSection={<IconQrcode size={18} />}
                  rightSection={scanning ? <Loader size={17} /> : null}
                  size="md"
                />
              </Stack>
            </Paper>

            <Select
              label="Inventory Source"
              description="How this inventory became available"
              data={[
                "Produced In-House",
                "Purchased / Delivered",
                "Customer Return",
                "Internal Transfer",
              ]}
              value={receiptType}
              onChange={(value) => setReceiptType(value || "Produced In-House")}
              required
              size="md"
              leftSection={<IconTruckDelivery size={18} />}
            />

            <Select
              label="Inventory Item"
              description="Search by item number, SKU, or item name"
              placeholder="Search inventory items"
              data={itemOptions}
              value={itemId}
              onChange={selectItem}
              searchable
              required
              size="md"
              leftSection={<IconSearch size={18} />}
              nothingFoundMessage="No inventory item found"
            />

            <Select
              label="Storage Position"
              description="The physical position receiving this stock"
              placeholder="Choose a storage position"
              data={binOptions}
              value={binId}
              onChange={(value) => setBinId(value || "")}
              searchable
              required
              size="md"
              leftSection={<IconMapPin size={18} />}
            />

            <NumberInput
              label="Quantity Received"
              description="Enter the amount physically received"
              value={quantity}
              onChange={(value) => setQuantity(numberValue(value))}
              min={0.0001}
              decimalScale={4}
              allowNegative={false}
              required
              size="md"
              leftSection={<IconPackageImport size={18} />}
            />

            <TextInput
              label="Reference Number"
              description="Optional work order, purchase order, packing slip, or receipt number"
              placeholder="Example: WO-1042, PO-1042, or PS-7841"
              value={referenceNumber}
              onChange={(event) => setReferenceNumber(event.currentTarget.value)}
              leftSection={<IconHash size={18} />}
            />

            <TextInput
              label={receiptType === "Produced In-House" ? "Produced By / Department" : "Source"}
              description={receiptType === "Produced In-House" ? "Optional employee or shop department" : "Optional supplier, customer, store, or transfer source"}
              placeholder={receiptType === "Produced In-House" ? "Example: Production / Assembly" : "Example: Local supplier"}
              value={source}
              onChange={(event) => setSource(event.currentTarget.value)}
              leftSection={<IconReceipt size={18} />}
            />

            <Textarea
              label="Receiving Notes"
              description="Optional condition, package, or delivery details"
              placeholder="Add any helpful receiving details…"
              value={notes}
              onChange={(event) => setNotes(event.currentTarget.value)}
              autosize
              minRows={3}
              maxRows={6}
            />
          </Stack>
        </MWPanel>

        <MWPanel
          title="Review & Receive"
          subtitle="Confirm the receipt before updating inventory"
          icon={IconClipboardCheck}
        >
          <Stack gap="lg">
            <Paper
              p="xl"
              radius="lg"
              style={{
                background: "rgba(255,255,255,0.025)",
                border: "1px solid rgba(255,255,255,0.075)",
              }}
            >
              <Stack gap="md">
                <Group justify="space-between" align="flex-start" wrap="nowrap">
                  <Text c="dimmed" fw={700}>Item</Text>
                  <Text fw={850} ta="right">{item?.name || "Not selected"}</Text>
                </Group>
                <Divider />
                <Group justify="space-between" align="flex-start" wrap="nowrap">
                  <Text c="dimmed" fw={700}>Storage Position</Text>
                  <Text fw={850} ta="right">
                    {[selectedBin?.code, selectedBin?.name].filter(Boolean).join(" · ") || "Not selected"}
                  </Text>
                </Group>
                <Divider />
                <Group justify="space-between">
                  <Text c="dimmed" fw={700}>Inventory Source</Text>
                  <Badge color={receiptType === "Produced In-House" ? "red" : "blue"} variant="light">
                    {receiptType}
                  </Badge>
                </Group>
                <Group justify="space-between">
                  <Text c="dimmed" fw={700}>Current Balance</Text>
                  <Text fw={850}>{formatNumber(currentPositionQuantity)}</Text>
                </Group>
                <Group justify="space-between">
                  <Text c="dimmed" fw={700}>Quantity Received</Text>
                  <Badge color="green" variant="light" size="lg">
                    +{formatNumber(quantity)}
                  </Badge>
                </Group>
                <Divider />
                <Group justify="space-between" align="flex-end">
                  <Stack gap={2}>
                    <Text size="xs" c="dimmed" fw={800} tt="uppercase">
                      New Position Balance
                    </Text>
                    <Text size="xs" c="dimmed">Receipt saved to inventory history</Text>
                  </Stack>
                  <Text size="2rem" fw={900} c="green.4">
                    {formatNumber(projectedPositionQuantity)}
                  </Text>
                </Group>
              </Stack>
            </Paper>

            {!itemId || !binId ? (
              <Alert color="yellow" icon={<IconAlertTriangle size={20} />}>
                Select both an inventory item and storage position before receiving stock.
              </Alert>
            ) : null}

            <Alert color="blue" icon={<IconBox size={20} />}>
              Adding inventory increases the selected position balance and creates a permanent history entry showing how it entered stock.
            </Alert>

            <Stack gap="sm">
              <Button
                h={50}
                fullWidth
                variant="light"
                color="gray"
                onClick={() => setPage?.(item ? "inventoryItemDetails" : "inventoryItems")}
              >
                Cancel
              </Button>
              <Button
                h={52}
                fullWidth
                color="green"
                leftSection={saving ? <Loader size={18} color="white" /> : <IconCheck size={19} />}
                disabled={!canSave}
                onClick={receiveStock}
              >
                {receiptType === "Produced In-House" ? "Add Finished Inventory" : "Receive Stock"}
              </Button>
            </Stack>
          </Stack>
        </MWPanel>
      </SimpleGrid>

      {!items.length && (
        <MWPanel>
          <Stack align="center" py={50}>
            <ThemeIcon size={64} radius="xl" color="yellow" variant="light">
              <IconAlertTriangle size={30} />
            </ThemeIcon>
            <Title order={3}>No active inventory items found</Title>
            <Button color="red" onClick={() => setPage?.("newInventoryItem")}>Create Inventory Item</Button>
          </Stack>
        </MWPanel>
      )}

      <Modal
        opened={cameraOpen}
        onClose={stopCamera}
        title="Scan Item for Receiving"
        centered
        size="lg"
        overlayProps={{ backgroundOpacity: 0.72, blur: 4 }}
      >
        <Stack gap="md">
          <Box
            pos="relative"
            style={{
              overflow: "hidden",
              borderRadius: 14,
              background: "#050505",
              minHeight: 360,
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <video
              ref={videoRef}
              muted
              playsInline
              style={{ width: "100%", minHeight: 360, objectFit: "cover", display: "block" }}
            />
            {!cameraReady && !cameraError && (
              <Center pos="absolute" inset={0}>
                <Stack align="center">
                  <Loader color="red" />
                  <Text>Starting camera…</Text>
                </Stack>
              </Center>
            )}
            {cameraReady && (
              <Box
                pos="absolute"
                top="22%"
                left="12%"
                right="12%"
                bottom="22%"
                style={{
                  border: "3px solid #e03131",
                  borderRadius: 14,
                  boxShadow: "0 0 0 9999px rgba(0,0,0,0.32)",
                }}
              />
            )}
          </Box>
          {cameraError ? (
            <Alert color="red" icon={<IconCameraOff size={20} />} title="Camera Unavailable">
              {cameraError}
            </Alert>
          ) : (
            <Alert color="blue" icon={<IconCamera size={20} />}>
              Center the item QR code or barcode inside the red frame. It will select automatically.
            </Alert>
          )}
          <Button variant="light" color="gray" onClick={stopCamera}>Close Camera</Button>
        </Stack>
      </Modal>
    </Stack>
  );
}

export default InventoryReceiving;
