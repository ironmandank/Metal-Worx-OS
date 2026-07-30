import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Checkbox,
  Divider,
  Group,
  Loader,
  Modal,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Textarea,
  ThemeIcon,
  Title,
  Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconAlertTriangle,
  IconBox,
  IconBuildingWarehouse,
  IconCheck,
  IconEdit,
  IconMapPin,
  IconPlus,
  IconQrcode,
  IconRefresh,
  IconSearch,
  IconToggleLeft,
  IconToggleRight,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { supabase } from "../lib/supabase";
import MWKpiStrip from "../components/ui/MWKpiStrip";
import MWPageHeader from "../components/ui/MWPageHeader";
import MWPanel from "../components/ui/MWPanel";

const EMPTY_LOCATION = {
  name: "",
  code: "",
  location_type: "shop",
  description: "",
  is_primary: false,
  is_active: true,
};

const EMPTY_POSITION = {
  location_id: "",
  name: "",
  code: "",
  zone: "",
  aisle: "",
  rack: "",
  shelf: "",
  position: "",
  description: "",
  is_receiving_bin: false,
  is_quarantine_bin: false,
  is_scrap_bin: false,
  is_active: true,
};

function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function cleanCode(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function InventoryStorageLocations({
  setPage,
  setSelectedInventoryBin,
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locations, setLocations] = useState([]);
  const [bins, setBins] = useState([]);
  const [balances, setBalances] = useState([]);
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState("all");
  const [scanValue, setScanValue] = useState("");
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [positionModalOpen, setPositionModalOpen] = useState(false);
  const [locationForm, setLocationForm] = useState(EMPTY_LOCATION);
  const [positionForm, setPositionForm] = useState(EMPTY_POSITION);
  const [editingLocationId, setEditingLocationId] = useState(null);
  const [editingPositionId, setEditingPositionId] = useState(null);
  const scanInputRef = useRef(null);

  const loadStorage = useCallback(async () => {
    setLoading(true);
    try {
      const [locationResult, binResult, balanceResult] = await Promise.all([
        supabase
          .from("inventory_locations")
          .select("*")
          .order("is_primary", { ascending: false })
          .order("name", { ascending: true }),
        supabase
          .from("inventory_bins")
          .select(`
            *,
            inventory_locations (id, name, code, location_type, is_active)
          `)
          .order("name", { ascending: true }),
        supabase.from("inventory_bin_balances").select("*"),
      ]);

      if (locationResult.error) throw locationResult.error;
      if (binResult.error) throw binResult.error;
      if (balanceResult.error) throw balanceResult.error;

      setLocations(locationResult.data || []);
      setBins(binResult.data || []);
      setBalances(balanceResult.data || []);
    } catch (error) {
      console.error("Storage location load error:", error);
      notifications.show({
        title: "Storage Load Failed",
        message: error.message || "Unable to load storage positions.",
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStorage();
  }, [loadStorage]);

  const binSummaries = useMemo(() => {
    return bins.map((bin) => {
      const rows = balances.filter((balance) => balance.bin_id === bin.id);
      return {
        ...bin,
        itemCount: rows.filter((row) => numberValue(row.quantity_on_hand) > 0).length,
        quantityOnHand: rows.reduce(
          (sum, row) => sum + numberValue(row.quantity_on_hand),
          0
        ),
      };
    });
  }, [balances, bins]);

  const filteredBins = useMemo(() => {
    const term = search.trim().toLowerCase();
    return binSummaries.filter((bin) => {
      if (locationFilter !== "all" && bin.location_id !== locationFilter) return false;
      if (!term) return true;
      return [
        bin.name,
        bin.code,
        bin.zone,
        bin.aisle,
        bin.rack,
        bin.shelf,
        bin.position,
        bin.inventory_locations?.name,
      ].some((value) => String(value || "").toLowerCase().includes(term));
    });
  }, [binSummaries, locationFilter, search]);

  const activeLocations = locations.filter((location) => location.is_active);
  const activeBins = binSummaries.filter((bin) => bin.is_active);
  const occupiedBins = activeBins.filter((bin) => bin.itemCount > 0);
  const totalUnits = activeBins.reduce((sum, bin) => sum + bin.quantityOnHand, 0);

  const locationOptions = activeLocations.map((location) => ({
    value: location.id,
    label: `${location.code} · ${location.name}`,
  }));

  function openNewLocation() {
    setEditingLocationId(null);
    setLocationForm(EMPTY_LOCATION);
    setLocationModalOpen(true);
  }

  function openEditLocation(location) {
    setEditingLocationId(location.id);
    setLocationForm({
      name: location.name || "",
      code: location.code || "",
      location_type: location.location_type || "shop",
      description: location.description || "",
      is_primary: Boolean(location.is_primary),
      is_active: Boolean(location.is_active),
    });
    setLocationModalOpen(true);
  }

  function openNewPosition() {
    setEditingPositionId(null);
    setPositionForm({
      ...EMPTY_POSITION,
      location_id:
        locationFilter !== "all"
          ? locationFilter
          : activeLocations[0]?.id || "",
    });
    setPositionModalOpen(true);
  }

  function openEditPosition(bin) {
    setEditingPositionId(bin.id);
    setPositionForm({
      location_id: bin.location_id || "",
      name: bin.name || "",
      code: bin.code || "",
      zone: bin.zone || "",
      aisle: bin.aisle || "",
      rack: bin.rack || "",
      shelf: bin.shelf || "",
      position: bin.position || "",
      description: bin.description || "",
      is_receiving_bin: Boolean(bin.is_receiving_bin),
      is_quarantine_bin: Boolean(bin.is_quarantine_bin),
      is_scrap_bin: Boolean(bin.is_scrap_bin),
      is_active: Boolean(bin.is_active),
    });
    setPositionModalOpen(true);
  }

  async function saveLocation() {
    if (!locationForm.name.trim() || !cleanCode(locationForm.code)) return;
    setSaving(true);
    try {
      const payload = {
        ...locationForm,
        name: locationForm.name.trim(),
        code: cleanCode(locationForm.code),
        description: locationForm.description.trim() || null,
      };

      const query = editingLocationId
        ? supabase.from("inventory_locations").update(payload).eq("id", editingLocationId)
        : supabase.from("inventory_locations").insert(payload);
      const { error } = await query;
      if (error) throw error;

      notifications.show({
        title: editingLocationId ? "Storage Area Updated" : "Storage Area Created",
        message: `${payload.name} is ready to use.`,
        color: "green",
        icon: <IconCheck size={18} />,
      });
      setLocationModalOpen(false);
      await loadStorage();
    } catch (error) {
      notifications.show({ title: "Area Save Failed", message: error.message, color: "red" });
    } finally {
      setSaving(false);
    }
  }

  async function savePosition() {
    if (!positionForm.location_id || !positionForm.name.trim() || !cleanCode(positionForm.code)) return;
    setSaving(true);
    try {
      const code = cleanCode(positionForm.code);
      const payload = {
        ...positionForm,
        name: positionForm.name.trim(),
        code,
        zone: positionForm.zone.trim() || null,
        aisle: positionForm.aisle.trim() || null,
        rack: positionForm.rack.trim() || null,
        shelf: positionForm.shelf.trim() || null,
        position: positionForm.position.trim() || null,
        description: positionForm.description.trim() || null,
        barcode_value: `MW-BIN-${code}`,
        qr_code_value: `MW-BIN-${code}`,
      };

      const query = editingPositionId
        ? supabase.from("inventory_bins").update(payload).eq("id", editingPositionId)
        : supabase.from("inventory_bins").insert(payload);
      const { error } = await query;
      if (error) throw error;

      notifications.show({
        title: editingPositionId ? "Storage Position Updated" : "Storage Position Created",
        message: `${payload.code} · ${payload.name} is ready to use.`,
        color: "green",
        icon: <IconCheck size={18} />,
      });
      setPositionModalOpen(false);
      await loadStorage();
    } catch (error) {
      notifications.show({ title: "Position Save Failed", message: error.message, color: "red" });
    } finally {
      setSaving(false);
    }
  }

  async function togglePosition(bin) {
    if (bin.is_active && bin.quantityOnHand > 0) {
      notifications.show({
        title: "Position Still Contains Inventory",
        message: `Move or remove the ${bin.quantityOnHand} recorded units before deactivating ${bin.code}.`,
        color: "yellow",
      });
      return;
    }

    const { error } = await supabase
      .from("inventory_bins")
      .update({ is_active: !bin.is_active })
      .eq("id", bin.id);

    if (error) {
      notifications.show({ title: "Status Update Failed", message: error.message, color: "red" });
      return;
    }
    await loadStorage();
  }

  function scanPosition() {
    const value = scanValue.trim().toLowerCase();
    if (!value) return;
    const matched = binSummaries.find((bin) =>
      [bin.code, bin.barcode_value, bin.qr_code_value].some(
        (candidate) => String(candidate || "").toLowerCase() === value
      )
    );

    if (!matched) {
      notifications.show({ title: "Position Not Found", message: `No storage position matched ${scanValue}.`, color: "yellow" });
      return;
    }

    setLocationFilter(matched.location_id);
    setSearch(matched.code);
    setScanValue("");
    setSelectedInventoryBin?.(matched);
    notifications.show({ title: "Storage Position Found", message: `${matched.code} · ${matched.name}`, color: "green" });
  }

  if (loading) {
    return (
      <Stack gap="xl">
        <MWPageHeader title="Storage Locations" subtitle="Loading shop areas and storage positions." setPage={setPage} showBack backPage="inventory" backLabel="Inventory" showDashboard={false} />
        <MWPanel><Group justify="center" py={90}><Loader color="red" /><Text c="dimmed">Loading storage…</Text></Group></MWPanel>
      </Stack>
    );
  }

  return (
    <Stack gap="xl">
      <MWPageHeader
        title="Storage Locations"
        subtitle="Manage the practical shop areas, shelves, racks, bins, and floor positions used by Metal Worx."
        setPage={setPage}
        showBack
        backPage="inventory"
        backLabel="Inventory"
        showDashboard={false}
      />

      <MWKpiStrip
        items={[
          { label: "Active Areas", value: activeLocations.length, description: "Shop and showroom areas", icon: IconBuildingWarehouse, color: "red" },
          { label: "Active Positions", value: activeBins.length, description: "Bins, shelves, and racks", icon: IconMapPin, color: "blue" },
          { label: "Occupied", value: occupiedBins.length, description: "Positions holding stock", icon: IconBox, color: "green" },
          { label: "Recorded Units", value: totalUnits.toLocaleString(), description: "Across active positions", icon: IconCheck, color: "violet" },
        ]}
        columns={{ base: 1, sm: 2, xl: 4 }}
        compact
      />

      <MWPanel title="Find Storage" subtitle="Search or scan a physical position label" icon={IconSearch}>
        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
          <TextInput
            placeholder="Search position, code, rack, shelf…"
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
            leftSection={<IconSearch size={18} />}
          />
          <Select
            data={[{ value: "all", label: "All Storage Areas" }, ...locationOptions]}
            value={locationFilter}
            onChange={(value) => setLocationFilter(value || "all")}
            leftSection={<IconBuildingWarehouse size={18} />}
          />
          <TextInput
            ref={scanInputRef}
            placeholder="Scan position QR/barcode"
            value={scanValue}
            onChange={(event) => setScanValue(event.currentTarget.value)}
            onKeyDown={(event) => event.key === "Enter" && scanPosition()}
            leftSection={<IconQrcode size={18} />}
          />
        </SimpleGrid>
      </MWPanel>

      <MWPanel
        title="Storage Positions"
        subtitle={`${filteredBins.length} position${filteredBins.length === 1 ? "" : "s"} shown`}
        icon={IconMapPin}
        rightSection={
          <Group>
            <Button variant="light" color="gray" leftSection={<IconRefresh size={17} />} onClick={loadStorage}>Refresh</Button>
            <Button variant="light" color="red" leftSection={<IconPlus size={17} />} onClick={openNewLocation}>New Area</Button>
            <Button color="red" leftSection={<IconPlus size={17} />} onClick={openNewPosition}>New Position</Button>
          </Group>
        }
      >
        {!filteredBins.length ? (
          <Stack align="center" py={60}>
            <ThemeIcon size={64} radius="xl" color="gray" variant="light"><IconMapPin size={30} /></ThemeIcon>
            <Title order={3}>No storage positions found</Title>
            <Text c="dimmed">Create a position or clear the current search filters.</Text>
          </Stack>
        ) : (
          <Box style={{ overflowX: "auto" }}>
            <Table verticalSpacing="md" horizontalSpacing="md" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Position</Table.Th>
                  <Table.Th>Storage Area</Table.Th>
                  <Table.Th>Physical Detail</Table.Th>
                  <Table.Th ta="center">Items</Table.Th>
                  <Table.Th ta="center">Quantity</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th ta="right">Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filteredBins.map((bin) => (
                  <Table.Tr key={bin.id}>
                    <Table.Td>
                      <Stack gap={2}>
                        <Text fw={850}>{bin.name}</Text>
                        <Text size="xs" c="red.4" fw={800}>{bin.code}</Text>
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      <Text fw={700}>{bin.inventory_locations?.name || "—"}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {[bin.zone, bin.aisle && `Aisle ${bin.aisle}`, bin.rack && `Rack ${bin.rack}`, bin.shelf && `Shelf ${bin.shelf}`, bin.position].filter(Boolean).join(" · ") || "General position"}
                      </Text>
                    </Table.Td>
                    <Table.Td ta="center"><Badge color={bin.itemCount ? "blue" : "gray"} variant="light">{bin.itemCount}</Badge></Table.Td>
                    <Table.Td ta="center"><Text fw={850}>{bin.quantityOnHand.toLocaleString()}</Text></Table.Td>
                    <Table.Td>
                      <Group gap={6}>
                        <Badge color={bin.is_active ? "green" : "gray"} variant="light">{bin.is_active ? "Active" : "Inactive"}</Badge>
                        {bin.is_receiving_bin && <Badge color="blue" variant="light">Receiving</Badge>}
                        {bin.is_quarantine_bin && <Badge color="yellow" variant="light">Quarantine</Badge>}
                        {bin.is_scrap_bin && <Badge color="red" variant="light">Scrap</Badge>}
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Group justify="flex-end" gap="xs" wrap="nowrap">
                        <Tooltip label="Edit position"><ActionIcon variant="light" color="blue" onClick={() => openEditPosition(bin)}><IconEdit size={17} /></ActionIcon></Tooltip>
                        <Tooltip label={bin.is_active ? "Deactivate position" : "Activate position"}><ActionIcon variant="light" color={bin.is_active ? "orange" : "green"} onClick={() => togglePosition(bin)}>{bin.is_active ? <IconToggleRight size={19} /> : <IconToggleLeft size={19} />}</ActionIcon></Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Box>
        )}

        <Divider my="xl" />
        <Text size="xs" c="dimmed" mb="sm" fw={800} tt="uppercase">Storage Areas</Text>
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
          {locations.map((location) => (
            <Paper key={location.id} p="md" radius="md" withBorder>
              <Group justify="space-between" wrap="nowrap">
                <Stack gap={3}>
                  <Group gap="xs"><Text fw={850}>{location.name}</Text>{location.is_primary && <Badge color="red" size="xs">Primary</Badge>}</Group>
                  <Text size="xs" c="dimmed">{location.code} · {location.location_type}</Text>
                </Stack>
                <ActionIcon variant="light" color="gray" onClick={() => openEditLocation(location)}><IconEdit size={17} /></ActionIcon>
              </Group>
            </Paper>
          ))}
        </SimpleGrid>
      </MWPanel>

      <Modal opened={locationModalOpen} onClose={() => setLocationModalOpen(false)} title={editingLocationId ? "Edit Storage Area" : "Create Storage Area"} centered>
        <Stack>
          <TextInput label="Area Name" placeholder="Example: Showroom" required value={locationForm.name} onChange={(event) => setLocationForm((current) => ({ ...current, name: event.currentTarget.value }))} />
          <TextInput label="Area Code" placeholder="Example: SHOWROOM" required value={locationForm.code} onChange={(event) => setLocationForm((current) => ({ ...current, code: cleanCode(event.currentTarget.value) }))} />
          <Select label="Area Type" data={["shop", "showroom", "production", "storage", "office", "other"]} value={locationForm.location_type} onChange={(value) => setLocationForm((current) => ({ ...current, location_type: value || "shop" }))} />
          <Textarea label="Description" value={locationForm.description} onChange={(event) => setLocationForm((current) => ({ ...current, description: event.currentTarget.value }))} />
          <Checkbox label="Primary inventory area" checked={locationForm.is_primary} onChange={(event) => setLocationForm((current) => ({ ...current, is_primary: event.currentTarget.checked }))} />
          <Checkbox label="Area is active" checked={locationForm.is_active} onChange={(event) => setLocationForm((current) => ({ ...current, is_active: event.currentTarget.checked }))} />
          <Button color="red" fullWidth loading={saving} disabled={!locationForm.name.trim() || !cleanCode(locationForm.code)} onClick={saveLocation}>Save Storage Area</Button>
        </Stack>
      </Modal>

      <Modal opened={positionModalOpen} onClose={() => setPositionModalOpen(false)} title={editingPositionId ? "Edit Storage Position" : "Create Storage Position"} centered size="lg">
        <Stack>
          <Select label="Storage Area" data={locationOptions} value={positionForm.location_id} onChange={(value) => setPositionForm((current) => ({ ...current, location_id: value || "" }))} searchable required />
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput label="Position Name" placeholder="Example: Tree Display Rack" required value={positionForm.name} onChange={(event) => setPositionForm((current) => ({ ...current, name: event.currentTarget.value }))} />
            <TextInput label="Position Code" placeholder="Example: SHW-TREES" required value={positionForm.code} onChange={(event) => setPositionForm((current) => ({ ...current, code: cleanCode(event.currentTarget.value) }))} />
            <TextInput label="Zone" placeholder="Example: Showroom" value={positionForm.zone} onChange={(event) => setPositionForm((current) => ({ ...current, zone: event.currentTarget.value }))} />
            <TextInput label="Aisle" placeholder="Optional" value={positionForm.aisle} onChange={(event) => setPositionForm((current) => ({ ...current, aisle: event.currentTarget.value }))} />
            <TextInput label="Rack" placeholder="Optional" value={positionForm.rack} onChange={(event) => setPositionForm((current) => ({ ...current, rack: event.currentTarget.value }))} />
            <TextInput label="Shelf" placeholder="Optional" value={positionForm.shelf} onChange={(event) => setPositionForm((current) => ({ ...current, shelf: event.currentTarget.value }))} />
          </SimpleGrid>
          <Textarea label="Description" placeholder="What belongs in this position?" value={positionForm.description} onChange={(event) => setPositionForm((current) => ({ ...current, description: event.currentTarget.value }))} />
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Checkbox label="Receiving position" checked={positionForm.is_receiving_bin} onChange={(event) => setPositionForm((current) => ({ ...current, is_receiving_bin: event.currentTarget.checked }))} />
            <Checkbox label="Quarantine position" checked={positionForm.is_quarantine_bin} onChange={(event) => setPositionForm((current) => ({ ...current, is_quarantine_bin: event.currentTarget.checked }))} />
            <Checkbox label="Scrap position" checked={positionForm.is_scrap_bin} onChange={(event) => setPositionForm((current) => ({ ...current, is_scrap_bin: event.currentTarget.checked }))} />
            <Checkbox label="Position is active" checked={positionForm.is_active} onChange={(event) => setPositionForm((current) => ({ ...current, is_active: event.currentTarget.checked }))} />
          </SimpleGrid>
          <Alert color="blue" icon={<IconQrcode size={19} />}>The QR and barcode value will be generated automatically as MW-BIN-{cleanCode(positionForm.code) || "CODE"}.</Alert>
          <Button color="red" fullWidth loading={saving} disabled={!positionForm.location_id || !positionForm.name.trim() || !cleanCode(positionForm.code)} onClick={savePosition}>Save Storage Position</Button>
        </Stack>
      </Modal>
    </Stack>
  );
}

export default InventoryStorageLocations;
