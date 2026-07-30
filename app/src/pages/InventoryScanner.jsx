import {
  Alert,
  Avatar,
  Badge,
  Box,
  Button,
  Center,
  Divider,
  Group,
  Loader,
  Modal,
  Paper,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconAdjustments,
  IconAlertTriangle,
  IconArrowDown,
  IconBarcode,
  IconBox,
  IconCamera,
  IconCameraOff,
  IconCheck,
  IconClock,
  IconEye,
  IconHistory,
  IconKeyboard,
  IconMapPin,
  IconPackageImport,
  IconPrinter,
  IconQrcode,
  IconRefresh,
  IconSearch,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { supabase } from "../lib/supabase";
import MWKpiStrip from "../components/ui/MWKpiStrip";
import MWPageHeader from "../components/ui/MWPageHeader";
import MWPanel from "../components/ui/MWPanel";
import MWStatusBadge from "../components/ui/MWStatusBadge";

function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeScanValue(value) {
  return String(value || "").trim();
}

function getItemId(item) {
  return item?.inventory_item_id || item?.id || null;
}

function getStatusColor(status) {
  if (status === "Available") return "green";
  if (status === "Low Stock") return "yellow";
  if (status === "Out of Stock") return "red";
  if (status === "Inactive") return "gray";
  return "blue";
}

function DetailCell({ label, value, accent = false }) {
  return (
    <Paper
      p="md"
      radius="md"
      style={{
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(255,255,255,0.075)",
      }}
    >
      <Text size="xs" c="dimmed" tt="uppercase" fw={700} mb={6}>
        {label}
      </Text>
      <Text size="lg" fw={800} c={accent ? "red.4" : "gray.1"}>
        {value ?? "—"}
      </Text>
    </Paper>
  );
}

function ActionButton({ icon: Icon, label, description, color = "gray", onClick }) {
  return (
    <Button
      h={72}
      variant="light"
      color={color}
      justify="flex-start"
      leftSection={<Icon size={23} stroke={1.8} />}
      onClick={onClick}
      styles={{
        inner: { justifyContent: "flex-start" },
        label: { width: "100%" },
      }}
    >
      <Stack gap={1} align="flex-start">
        <Text fw={800} size="sm">
          {label}
        </Text>
        <Text size="xs" c="dimmed" fw={500}>
          {description}
        </Text>
      </Stack>
    </Button>
  );
}

function InventoryScanner({
  setPage,
  setSelectedInventoryItem,
  setSelectedInventoryBin,
}) {
  const [mode, setMode] = useState("usb");
  const [manualValue, setManualValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastScan, setLastScan] = useState("");
  const [resultType, setResultType] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedBin, setSelectedBin] = useState(null);
  const [binItems, setBinItems] = useState([]);
  const [notFoundValue, setNotFoundValue] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");

  const inputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const cameraTimerRef = useRef(null);
  const keyboardBufferRef = useRef("");
  const keyboardLastKeyRef = useRef(0);

  const clearResult = useCallback(() => {
    setResultType(null);
    setSelectedItem(null);
    setSelectedBin(null);
    setBinItems([]);
    setNotFoundValue("");
  }, []);

  const loadItemById = useCallback(async (itemId) => {
    if (!itemId) return null;

    const { data, error } = await supabase
      .from("inventory_item_availability")
      .select("*")
      .eq("inventory_item_id", itemId)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  }, []);

  const loadBinById = useCallback(async (binId) => {
    if (!binId) return null;

    const { data, error } = await supabase
      .from("inventory_bins")
      .select(`
        id,
        location_id,
        name,
        code,
        zone,
        aisle,
        rack,
        shelf,
        position,
        description,
        barcode_value,
        qr_code_value,
        is_receiving_bin,
        is_quarantine_bin,
        is_scrap_bin,
        is_active,
        inventory_locations (
          id,
          name,
          code
        )
      `)
      .eq("id", binId)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  }, []);

  const loadBinItems = useCallback(async (binId) => {
    if (!binId) return [];

    const { data, error } = await supabase
      .from("inventory_bin_balances")
      .select("*")
      .eq("bin_id", binId)
      .gt("quantity_on_hand", 0);

    if (error) throw error;
    return data || [];
  }, []);

  const searchInventory = useCallback(
    async (rawValue, source = "manual") => {
      const value = normalizeScanValue(rawValue);
      if (!value || loading) return;

      setLoading(true);
      clearResult();
      setLastScan(value);

      try {
        const { data: label, error: labelError } = await supabase
          .from("inventory_labels")
          .select(`
            id,
            label_type,
            inventory_item_id,
            bin_id,
            location_id,
            qr_token,
            barcode_value,
            is_active
          `)
          .eq("is_active", true)
          .or(`qr_token.eq.${value},barcode_value.eq.${value}`)
          .limit(1)
          .maybeSingle();

        if (labelError) throw labelError;

        if (label?.inventory_item_id) {
          const item = await loadItemById(label.inventory_item_id);
          if (item) {
            setSelectedItem(item);
            setResultType("item");
            setSelectedInventoryItem?.(item);
            notifications.show({
              title: "Inventory Item Found",
              message: item.name,
              color: "green",
              icon: <IconCheck size={18} />,
            });
            return;
          }
        }

        if (label?.bin_id) {
          const [bin, items] = await Promise.all([
            loadBinById(label.bin_id),
            loadBinItems(label.bin_id),
          ]);
          if (bin) {
            setSelectedBin(bin);
            setBinItems(items);
            setResultType("bin");
            setSelectedInventoryBin?.(bin);
            return;
          }
        }

        const { data: directItem, error: itemError } = await supabase
          .from("inventory_item_availability")
          .select("*")
          .or(`item_number.eq.${value},sku.eq.${value},manufacturer_part_number.eq.${value}`)
          .limit(1)
          .maybeSingle();

        if (itemError) throw itemError;

        if (directItem) {
          setSelectedItem(directItem);
          setResultType("item");
          setSelectedInventoryItem?.(directItem);
          return;
        }

        const { data: directBin, error: binError } = await supabase
          .from("inventory_bins")
          .select(`
            id,
            location_id,
            name,
            code,
            zone,
            aisle,
            rack,
            shelf,
            position,
            description,
            barcode_value,
            qr_code_value,
            is_receiving_bin,
            is_quarantine_bin,
            is_scrap_bin,
            is_active,
            inventory_locations (id, name, code)
          `)
          .eq("is_active", true)
          .or(`code.eq.${value},qr_code_value.eq.${value},barcode_value.eq.${value}`)
          .limit(1)
          .maybeSingle();

        if (binError) throw binError;

        if (directBin) {
          const items = await loadBinItems(directBin.id);
          setSelectedBin(directBin);
          setBinItems(items);
          setResultType("bin");
          setSelectedInventoryBin?.(directBin);
          return;
        }

        setNotFoundValue(value);
        setResultType("not-found");
        notifications.show({
          title: "No Inventory Match",
          message: `Nothing matched ${value}.`,
          color: "yellow",
        });
      } catch (error) {
        console.error("Inventory scanner lookup error:", error);
        notifications.show({
          title: "Scanner Lookup Failed",
          message: error.message || "Unable to search inventory.",
          color: "red",
        });
      } finally {
        setLoading(false);
        setManualValue("");
        if (source !== "camera") {
          window.setTimeout(() => inputRef.current?.focus(), 80);
        }
      }
    },
    [
      clearResult,
      loadBinById,
      loadBinItems,
      loadItemById,
      loading,
      setSelectedInventoryBin,
      setSelectedInventoryItem,
    ]
  );

  useEffect(() => {
    function handleKeyboardScan(event) {
      if (cameraOpen || event.ctrlKey || event.altKey || event.metaKey) return;

      const activeTag = document.activeElement?.tagName?.toLowerCase();
      const isTyping = activeTag === "input" || activeTag === "textarea";
      if (isTyping) return;

      const now = Date.now();
      if (now - keyboardLastKeyRef.current > 90) {
        keyboardBufferRef.current = "";
      }
      keyboardLastKeyRef.current = now;

      if (event.key === "Enter") {
        const completedValue = keyboardBufferRef.current;
        keyboardBufferRef.current = "";
        if (completedValue.length >= 3) searchInventory(completedValue, "usb");
        return;
      }

      if (event.key.length === 1) keyboardBufferRef.current += event.key;
    }

    window.addEventListener("keydown", handleKeyboardScan);
    return () => window.removeEventListener("keydown", handleKeyboardScan);
  }, [cameraOpen, searchInventory]);

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
        throw new Error(
          "This browser does not support camera barcode detection. Use Chrome or Edge, or use the USB scanner."
        );
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
            await searchInventory(value, "camera");
          }
        } catch (error) {
          console.warn("Camera detection frame failed:", error);
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
  }, [searchInventory, stopCamera]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  function navigateItem(pageName) {
    if (!selectedItem) return;
    setSelectedInventoryItem?.(selectedItem);
    setPage?.(pageName);
  }

  function navigateBin() {
    if (!selectedBin) return;
    setSelectedInventoryBin?.(selectedBin);
    setPage?.("inventoryStorage");
  }

  const locationText = useMemo(() => {
    if (!selectedItem) return "—";
    return [selectedItem.default_bin_code, selectedItem.default_bin_name]
      .filter(Boolean)
      .join(" · ") || "Unassigned";
  }, [selectedItem]);

  return (
    <Stack gap="xl">
      <MWPageHeader
        title="Inventory Scanner"
        subtitle="Scan an item or storage position to view inventory and take action immediately."
        setPage={setPage}
        showBack
        backPage="inventoryDashboard"
        backLabel="Inventory"
        showDashboard={false}
      />

      <MWKpiStrip
        items={[
          { label: "Scanner Status", value: loading ? "Searching" : "Ready", icon: IconQrcode, color: loading ? "yellow" : "green" },
          { label: "USB Scanner", value: "HID Ready", icon: IconKeyboard, color: "blue" },
          { label: "Last Scan", value: lastScan || "—", icon: IconClock, color: "gray" },
          { label: "Result", value: resultType === "item" ? "Item Found" : resultType === "bin" ? "Storage Found" : resultType === "not-found" ? "Not Found" : "Waiting", icon: IconSearch, color: resultType === "not-found" ? "yellow" : resultType ? "green" : "gray" },
        ]}
        columns={{
          base: 1,
          sm: 2,
          xl: 4,
        }}
        compact
      />

      <MWPanel
        title="Scan Inventory"
        subtitle="USB scanners enter codes automatically. You can also use the camera or type a code manually."
        icon={IconBarcode}
      >
        <Stack gap="lg">
          <SegmentedControl
            value={mode}
            onChange={(value) => {
              setMode(value);
              if (value === "camera") startCamera();
              else if (cameraOpen) stopCamera();
            }}
            data={[
              { value: "usb", label: "USB Scanner" },
              { value: "camera", label: "Camera" },
              { value: "manual", label: "Manual Entry" },
            ]}
            fullWidth
            color="red"
          />

          <Paper
            p="xl"
            radius="lg"
            style={{
              background: "linear-gradient(135deg, rgba(200,16,46,0.12), rgba(255,255,255,0.025))",
              border: "1px solid rgba(200,16,46,0.28)",
            }}
          >
            <Group align="flex-end" wrap="nowrap">
              <TextInput
                ref={inputRef}
                label={mode === "usb" ? "USB Scanner Input" : "Item Number, QR Code or Barcode"}
                description={mode === "usb" ? "Click here once, then scan. Your scanner should submit automatically." : "Enter a code exactly as it appears on the label."}
                placeholder="Scan or enter MW-SHW-0001"
                value={manualValue}
                onChange={(event) => setManualValue(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") searchInventory(manualValue, mode);
                }}
                leftSection={<IconBarcode size={19} />}
                size="lg"
                style={{ flex: 1 }}
                autoFocus
              />
              <Button
                size="lg"
                h={50}
                color="red"
                leftSection={loading ? <Loader size={18} color="white" /> : <IconSearch size={19} />}
                onClick={() => searchInventory(manualValue, mode)}
                disabled={!normalizeScanValue(manualValue) || loading}
              >
                Search
              </Button>
              <Button
                size="lg"
                h={50}
                variant="light"
                color="gray"
                leftSection={<IconRefresh size={19} />}
                onClick={() => {
                  clearResult();
                  setManualValue("");
                  setLastScan("");
                  inputRef.current?.focus();
                }}
              >
                Clear
              </Button>
            </Group>
          </Paper>
        </Stack>
      </MWPanel>

      {loading && (
        <MWPanel>
          <Center py={50}>
            <Stack align="center" gap="sm">
              <Loader color="red" size="lg" />
              <Text fw={700}>Searching Metal Worx inventory…</Text>
            </Stack>
          </Center>
        </MWPanel>
      )}

      {!loading && resultType === "item" && selectedItem && (
        <MWPanel
          title="Inventory Item Found"
          subtitle={`Scanned ${lastScan}`}
          icon={IconCheck}
          rightSection={<MWStatusBadge status={selectedItem.stock_status || "Available"} />}
        >
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
            <Paper
              radius="lg"
              p="lg"
              style={{
                minHeight: 330,
                background: "rgba(255,255,255,0.025)",
                border: "1px solid rgba(255,255,255,0.075)",
              }}
            >
              <Stack align="center" justify="center" h="100%" gap="md">
                <Avatar
                  src={selectedItem.primary_image_url}
                  alt={selectedItem.image_alt_text || selectedItem.name}
                  radius="md"
                  size={220}
                  color="dark"
                >
                  <IconBox size={74} stroke={1.2} />
                </Avatar>
                <Badge variant="light" color={getStatusColor(selectedItem.stock_status)} size="lg">
                  {selectedItem.stock_status || "Status Not Set"}
                </Badge>
              </Stack>
            </Paper>

            <Stack gap="lg">
              <Box>
                <Text size="xs" c="red.4" fw={800} tt="uppercase" mb={5}>
                  {selectedItem.item_number || selectedItem.sku || "Inventory Item"}
                </Text>
                <Title order={2}>{selectedItem.name}</Title>
                {selectedItem.description && (
                  <Text c="dimmed" mt="xs">
                    {selectedItem.description}
                  </Text>
                )}
              </Box>

              <SimpleGrid cols={2} spacing="sm">
                <DetailCell label="Quantity On Hand" value={numberValue(selectedItem.quantity_on_hand).toLocaleString()} accent />
                <DetailCell label="Available Quantity" value={numberValue(selectedItem.quantity_available).toLocaleString()} />
                <DetailCell label="Category" value={selectedItem.category_name || "Uncategorized"} />
                <DetailCell label="Storage Location" value={locationText} />
              </SimpleGrid>

              <Divider />

              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                <ActionButton icon={IconEye} label="View Item" description="Open complete item record" color="blue" onClick={() => navigateItem("inventoryItemDetails")} />
                <ActionButton icon={IconAdjustments} label="Update Quantity" description="Correct the current balance" color="yellow" onClick={() => navigateItem("inventoryAdjustment")} />
                <ActionButton icon={IconPackageImport} label="Receive Stock" description="Add incoming inventory" color="green" onClick={() => navigateItem("inventoryReceiving")} />
                <ActionButton icon={IconArrowDown} label="Remove Stock" description="Record usage or removal" color="orange" onClick={() => navigateItem("inventoryAdjustment")} />
                <ActionButton icon={IconPrinter} label="Print Label" description="Print QR and barcode label" color="grape" onClick={() => navigateItem("inventoryLabels")} />
                <ActionButton icon={IconHistory} label="View History" description="Review all stock movements" color="gray" onClick={() => navigateItem("inventoryHistory")} />
              </SimpleGrid>
            </Stack>
          </SimpleGrid>
        </MWPanel>
      )}

      {!loading && resultType === "bin" && selectedBin && (
        <MWPanel
          title="Storage Position Found"
          subtitle={`Scanned ${lastScan}`}
          icon={IconMapPin}
          rightSection={<Badge color={selectedBin.is_active ? "green" : "gray"}>{selectedBin.is_active ? "Active" : "Inactive"}</Badge>}
        >
          <Stack gap="lg">
            <Group justify="space-between" align="flex-start">
              <Box>
                <Text size="xs" c="red.4" fw={800} tt="uppercase">
                  {selectedBin.code}
                </Text>
                <Title order={2}>{selectedBin.name}</Title>
                <Text c="dimmed" mt={4}>
                  {[selectedBin.inventory_locations?.name, selectedBin.zone, selectedBin.aisle, selectedBin.rack, selectedBin.shelf, selectedBin.position]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </Box>
              <Button color="red" leftSection={<IconEye size={18} />} onClick={navigateBin}>
                Open Storage Position
              </Button>
            </Group>

            <Divider />

            <Text fw={800}>Items stored here ({binItems.length})</Text>
            {binItems.length === 0 ? (
              <Alert color="gray" icon={<IconBox size={19} />}>
                No on-hand inventory is currently assigned to this position.
              </Alert>
            ) : (
              <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
                {binItems.map((item) => (
                  <Paper key={item.inventory_item_id || item.id} p="md" radius="md" withBorder>
                    <Group justify="space-between" wrap="nowrap">
                      <Box>
                        <Text fw={800}>{item.item_name || item.name || item.item_number}</Text>
                        <Text size="xs" c="dimmed">{item.item_number || "Inventory item"}</Text>
                      </Box>
                      <Badge color="red" variant="light" size="lg">
                        {numberValue(item.quantity_on_hand).toLocaleString()}
                      </Badge>
                    </Group>
                  </Paper>
                ))}
              </SimpleGrid>
            )}
          </Stack>
        </MWPanel>
      )}

      {!loading && resultType === "not-found" && (
        <MWPanel title="No Inventory Match" icon={IconAlertTriangle}>
          <Center py={42}>
            <Stack align="center" maw={560} gap="md">
              <ThemeIcon size={68} radius="xl" color="yellow" variant="light">
                <IconAlertTriangle size={34} />
              </ThemeIcon>
              <Title order={3}>No item or storage position matched</Title>
              <Text c="dimmed" ta="center">
                The scanned value <Text span fw={800} c="gray.2">{notFoundValue}</Text> is not assigned to an active inventory item or bin. Check the label or search by item number.
              </Text>
              <Button variant="light" color="red" leftSection={<IconRefresh size={18} />} onClick={() => {
                clearResult();
                inputRef.current?.focus();
              }}>
                Scan Again
              </Button>
            </Stack>
          </Center>
        </MWPanel>
      )}

      {!loading && !resultType && (
        <MWPanel>
          <Center py={55}>
            <Stack align="center" gap="sm">
              <ThemeIcon size={74} radius="xl" color="red" variant="light">
                <IconQrcode size={38} stroke={1.5} />
              </ThemeIcon>
              <Title order={3}>Ready for the next scan</Title>
              <Text c="dimmed" ta="center" maw={520}>
                Scan a Metal Worx QR code or Code 128 barcode. The matching item or storage position will open here with the actions employees use most.
              </Text>
            </Stack>
          </Center>
        </MWPanel>
      )}

      <Modal
        opened={cameraOpen}
        onClose={stopCamera}
        title="Camera Scanner"
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
                style={{ border: "3px solid #e03131", borderRadius: 14, boxShadow: "0 0 0 9999px rgba(0,0,0,0.32)" }}
              />
            )}
          </Box>

          {cameraError ? (
            <Alert color="red" icon={<IconCameraOff size={20} />} title="Camera Unavailable">
              {cameraError}
            </Alert>
          ) : (
            <Alert color="blue" icon={<IconCamera size={20} />}>
              Center the QR code or barcode inside the red frame. The scanner will search automatically.
            </Alert>
          )}

          <Button variant="light" color="gray" onClick={stopCamera}>
            Close Camera
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}

export default InventoryScanner;
