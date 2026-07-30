import {
  Alert,
  Badge,
  Box,
  Button,
  Divider,
  Group,
  Loader,
  NumberInput,
  Paper,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconAdjustments,
  IconAlertTriangle,
  IconArrowDown,
  IconArrowUp,
  IconBox,
  IconCalculator,
  IconCheck,
  IconClipboardCheck,
  IconMapPin,
  IconPackage,
  IconRefresh,
  IconScale,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { supabase } from "../lib/supabase";
import MWKpiStrip from "../components/ui/MWKpiStrip";
import MWPageHeader from "../components/ui/MWPageHeader";
import MWPanel from "../components/ui/MWPanel";

function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value, maximumFractionDigits = 4) {
  return numberValue(value).toLocaleString("en-US", {
    maximumFractionDigits,
  });
}

function getItemId(item) {
  return item?.inventory_item_id || item?.id || null;
}

const REASON_OPTIONS = {
  add: [
    "Found stock",
    "Returned to inventory",
    "Opening balance correction",
    "Previous count correction",
    "Other adjustment",
  ],
  remove: [
    "Used in production",
    "Damaged",
    "Scrapped",
    "Missing stock",
    "Sample or display use",
    "Previous count correction",
    "Other adjustment",
  ],
  set: [
    "Physical inventory count",
    "Cycle count",
    "Opening balance",
    "Count correction",
  ],
};

function InventoryQuantityAdjustment({
  setPage,
  selectedInventoryItem,
  setSelectedInventoryItem,
  activeUser,
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [item, setItem] = useState(selectedInventoryItem || null);
  const [bins, setBins] = useState([]);
  const [balances, setBalances] = useState([]);
  const [operation, setOperation] = useState("set");
  const [binId, setBinId] = useState("");
  const [quantity, setQuantity] = useState(0);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const itemId = getItemId(selectedInventoryItem || item);

  const loadAdjustmentData = useCallback(async () => {
    if (!itemId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const [itemResult, binsResult, balancesResult] = await Promise.all([
        supabase
          .from("inventory_item_availability")
          .select("*")
          .eq("inventory_item_id", itemId)
          .maybeSingle(),

        supabase
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
            is_active,
            inventory_locations (
              id,
              name,
              code
            )
          `)
          .eq("is_active", true)
          .order("zone", { ascending: true })
          .order("name", { ascending: true }),

        supabase
          .from("inventory_bin_balances")
          .select("*")
          .eq("inventory_item_id", itemId),
      ]);

      const failedResult = [itemResult, binsResult, balancesResult].find(
        (result) => result.error
      );

      if (failedResult?.error) throw failedResult.error;

      if (itemResult.data) setItem(itemResult.data);
      setBins(binsResult.data || []);
      setBalances(balancesResult.data || []);

      const defaultBinId =
        itemResult.data?.default_bin_id ||
        balancesResult.data?.[0]?.bin_id ||
        binsResult.data?.[0]?.id ||
        "";

      setBinId((current) => current || defaultBinId);
    } catch (error) {
      console.error("Quantity adjustment load error:", error);
      notifications.show({
        title: "Adjustment Page Load Failed",
        message: error.message || "Unable to load inventory balances.",
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useEffect(() => {
    loadAdjustmentData();
  }, [loadAdjustmentData]);

  useEffect(() => {
    setReason("");
    setQuantity(0);
  }, [operation]);

  const selectedBin = useMemo(
    () => bins.find((bin) => bin.id === binId) || null,
    [binId, bins]
  );

  const selectedBalance = useMemo(
    () => balances.find((balance) => balance.bin_id === binId) || null,
    [balances, binId]
  );

  const currentQuantity = numberValue(selectedBalance?.quantity_on_hand);
  const reservedQuantity = numberValue(selectedBalance?.quantity_reserved);
  const quarantinedQuantity = numberValue(selectedBalance?.quantity_quarantined);

  const projectedQuantity = useMemo(() => {
    const entered = numberValue(quantity);
    if (operation === "add") return currentQuantity + entered;
    if (operation === "remove") return currentQuantity - entered;
    return entered;
  }, [currentQuantity, operation, quantity]);

  const minimumAllowedQuantity = reservedQuantity + quarantinedQuantity;
  const invalidProjectedQuantity = projectedQuantity < minimumAllowedQuantity;

  const binOptions = useMemo(
    () =>
      bins.map((bin) => ({
        value: bin.id,
        label: [
          bin.code,
          bin.name,
          bin.inventory_locations?.name,
        ]
          .filter(Boolean)
          .join(" · "),
      })),
    [bins]
  );

  const reasonOptions = useMemo(
    () => REASON_OPTIONS[operation].map((value) => ({ value, label: value })),
    [operation]
  );

  const canSave =
    Boolean(itemId) &&
    Boolean(binId) &&
    Boolean(reason) &&
    !invalidProjectedQuantity &&
    (operation === "set" ? numberValue(quantity) >= 0 : numberValue(quantity) > 0) &&
    !saving;

  async function saveAdjustment() {
    if (!canSave) return;

    setSaving(true);

    try {
      const { data, error } = await supabase.rpc(
        "mw_adjust_inventory_quantity",
        {
          p_inventory_item_id: itemId,
          p_bin_id: binId,
          p_operation: operation,
          p_quantity: numberValue(quantity),
          p_reason: reason,
          p_notes: notes.trim() || null,
          p_reference_type: "Manual Inventory Adjustment",
          p_reference_id: null,
          p_reference_number: null,
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
        title: "Inventory Quantity Updated",
        message: `${item?.name || "Inventory item"} changed from ${formatNumber(
          data?.quantity_before ?? currentQuantity
        )} to ${formatNumber(data?.quantity_after ?? projectedQuantity)}.`,
        color: "green",
        icon: <IconCheck size={18} />,
      });

      setPage?.("inventoryItemDetails");
    } catch (error) {
      console.error("Quantity adjustment save error:", error);
      notifications.show({
        title: "Quantity Update Failed",
        message: error.message || "Unable to save the inventory adjustment.",
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
          title="Update Inventory Quantity"
          subtitle="Loading item and storage balances."
          setPage={setPage}
          showBack
          backPage="inventoryItemDetails"
          backLabel="Item Details"
          showDashboard={false}
        />
        <MWPanel>
          <Group justify="center" py={90}>
            <Loader color="red" />
            <Text c="dimmed">Loading quantity controls…</Text>
          </Group>
        </MWPanel>
      </Stack>
    );
  }

  if (!itemId || !item) {
    return (
      <Stack gap="xl">
        <MWPageHeader
          title="Update Inventory Quantity"
          subtitle="No inventory item is selected."
          setPage={setPage}
          showBack
          backPage="inventoryItems"
          backLabel="Inventory Items"
          showDashboard={false}
        />
        <MWPanel>
          <Stack align="center" py={70} gap="md">
            <ThemeIcon size={68} radius="xl" color="yellow" variant="light">
              <IconAlertTriangle size={32} />
            </ThemeIcon>
            <Title order={3}>Select an inventory item first</Title>
            <Button color="red" onClick={() => setPage?.("inventoryItems")}>
              Open Inventory Items
            </Button>
          </Stack>
        </MWPanel>
      </Stack>
    );
  }

  return (
    <Stack gap="xl">
      <MWPageHeader
        title="Update Inventory Quantity"
        subtitle={`${item.name} · ${item.item_number || item.sku || "Inventory item"}`}
        setPage={setPage}
        showBack
        backPage="inventoryItemDetails"
        backLabel="Item Details"
        showDashboard={false}
      />

      <MWKpiStrip
        items={[
          {
            label: "Item Total",
            value: formatNumber(item.quantity_on_hand),
            description: item.unit_abbreviation || "Across all positions",
            icon: IconPackage,
            color: "blue",
          },
          {
            label: "Selected Position",
            value: formatNumber(currentQuantity),
            description: selectedBin?.code || "Choose a position",
            icon: IconMapPin,
            color: "violet",
          },
          {
            label: "Projected Balance",
            value: formatNumber(projectedQuantity),
            description: "After this adjustment",
            icon: IconCalculator,
            color: invalidProjectedQuantity ? "red" : "green",
          },
          {
            label: "Protected Quantity",
            value: formatNumber(minimumAllowedQuantity),
            description: "Reserved + quarantined",
            icon: IconScale,
            color: minimumAllowedQuantity > 0 ? "orange" : "gray",
          },
        ]}
        columns={{ base: 1, sm: 2, xl: 4 }}
        compact
      />

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="xl">
        <MWPanel
          title="Adjustment"
          subtitle="Choose how the selected storage balance should change"
          icon={IconAdjustments}
        >
          <Stack gap="lg">
            <SegmentedControl
              value={operation}
              onChange={setOperation}
              fullWidth
              color="red"
              size="xs"
              styles={{
                root: { padding: 4 },
                label: {
                  minHeight: 38,
                  paddingInline: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  whiteSpace: "nowrap",
                  fontSize: 13,
                  fontWeight: 800,
                },
              }}
              data={[
                { value: "set", label: "Set Exact Count" },
                { value: "add", label: "Add Stock" },
                { value: "remove", label: "Remove Stock" },
              ]}
            />

            <Select
              label="Storage Position"
              description="The physical position whose balance will change"
              placeholder="Choose a storage position"
              data={binOptions}
              value={binId}
              onChange={(value) => setBinId(value || "")}
              searchable
              required
              leftSection={<IconMapPin size={18} />}
              size="md"
            />

            <NumberInput
              label={
                operation === "set"
                  ? "Counted Quantity"
                  : operation === "add"
                    ? "Quantity to Add"
                    : "Quantity to Remove"
              }
              description={
                operation === "set"
                  ? "Enter the exact physical quantity currently present"
                  : "Enter the amount of this adjustment"
              }
              value={quantity}
              onChange={(value) => setQuantity(numberValue(value))}
              min={0}
              decimalScale={4}
              allowNegative={false}
              required
              leftSection={
                operation === "add" ? (
                  <IconArrowUp size={18} />
                ) : operation === "remove" ? (
                  <IconArrowDown size={18} />
                ) : (
                  <IconClipboardCheck size={18} />
                )
              }
              size="md"
            />

            <Select
              label="Adjustment Reason"
              description="Required for inventory history and accountability"
              placeholder="Select the reason"
              data={reasonOptions}
              value={reason}
              onChange={(value) => setReason(value || "")}
              required
              size="md"
            />

            <Textarea
              label="Notes"
              description="Optional details that help explain this change"
              placeholder="Add any helpful details…"
              value={notes}
              onChange={(event) => setNotes(event.currentTarget.value)}
              autosize
              minRows={3}
              maxRows={6}
            />
          </Stack>
        </MWPanel>

        <MWPanel
          title="Review & Save"
          subtitle="Confirm the resulting balance before recording the movement"
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
                <Group justify="space-between">
                  <Text c="dimmed" fw={700}>Item</Text>
                  <Text fw={850} ta="right">{item.name}</Text>
                </Group>
                <Divider />
                <Group justify="space-between">
                  <Text c="dimmed" fw={700}>Storage Position</Text>
                  <Text fw={850} ta="right">
                    {[selectedBin?.code, selectedBin?.name].filter(Boolean).join(" · ") || "Not selected"}
                  </Text>
                </Group>
                <Divider />
                <Group justify="space-between">
                  <Text c="dimmed" fw={700}>Current Balance</Text>
                  <Text fw={850}>{formatNumber(currentQuantity)}</Text>
                </Group>
                <Group justify="space-between">
                  <Text c="dimmed" fw={700}>Operation</Text>
                  <Badge color={operation === "add" ? "green" : operation === "remove" ? "orange" : "blue"} variant="light">
                    {operation === "add" ? "Add Stock" : operation === "remove" ? "Remove Stock" : "Set Exact Count"}
                  </Badge>
                </Group>
                <Group justify="space-between">
                  <Text c="dimmed" fw={700}>Entered Quantity</Text>
                  <Text fw={850}>{formatNumber(quantity)}</Text>
                </Group>
                <Divider />
                <Group justify="space-between" align="flex-end">
                  <Box>
                    <Text size="xs" c="dimmed" fw={800} tt="uppercase">
                      New Position Balance
                    </Text>
                    <Text size="xs" c="dimmed" mt={3}>
                      Saved with a movement-history record
                    </Text>
                  </Box>
                  <Text size="2rem" fw={900} c={invalidProjectedQuantity ? "red.4" : "green.4"}>
                    {formatNumber(projectedQuantity)}
                  </Text>
                </Group>
              </Stack>
            </Paper>

            {invalidProjectedQuantity && (
              <Alert color="red" icon={<IconAlertTriangle size={20} />} title="Balance Not Allowed">
                The new balance cannot be below {formatNumber(minimumAllowedQuantity)} because this position has reserved or quarantined inventory.
              </Alert>
            )}

            {!reason && (
              <Alert color="yellow" icon={<IconAlertTriangle size={20} />}>
                Select an adjustment reason before saving.
              </Alert>
            )}

            <Alert color="blue" icon={<IconBox size={20} />}>
              Saving updates the stock balance and creates an immutable inventory movement at the same time.
            </Alert>

            <Stack gap="sm">
              <Button
                h={50}
                fullWidth
                variant="light"
                color="gray"
                onClick={() => setPage?.("inventoryItemDetails")}
              >
                Cancel
              </Button>
              <Button
                h={50}
                fullWidth
                color="red"
                leftSection={saving ? <Loader size={18} color="white" /> : <IconCheck size={19} />}
                disabled={!canSave}
                onClick={saveAdjustment}
              >
                Save Adjustment
              </Button>
            </Stack>
          </Stack>
        </MWPanel>
      </SimpleGrid>
    </Stack>
  );
}

export default InventoryQuantityAdjustment;
