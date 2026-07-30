import {
  Alert, Badge, Box, Button, Group, Loader, Pagination, Paper, Select,
  SimpleGrid, Stack, Table, Text, TextInput, ThemeIcon, Title,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import {
  IconAdjustments, IconBox, IconCalendar, IconDownload, IconFilter,
  IconHistory, IconMapPin, IconPackageImport, IconRefresh, IconSearch,
  IconUser,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { supabase } from "../lib/supabase";
import MWKpiStrip from "../components/ui/MWKpiStrip";
import MWPageHeader from "../components/ui/MWPageHeader";
import MWPanel from "../components/ui/MWPanel";

const PAGE_SIZE = 25;

function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value) {
  return numberValue(value).toLocaleString("en-US", { maximumFractionDigits: 4 });
}

function formatDateTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  });
}

function getItemId(item) {
  return item?.inventory_item_id || item?.id || null;
}

function movementColor(movement) {
  if (movement.operation === "receive" || numberValue(movement.quantity_change) > 0) return "green";
  if (movement.operation === "remove" || numberValue(movement.quantity_change) < 0) return "orange";
  if (movement.operation === "set") return "blue";
  return "gray";
}

function movementLabel(movement) {
  if (movement.operation === "receive" && movement.reason === "Produced In-House") return "Produced In-House";
  if (movement.operation === "receive") return "Stock Received";
  return movement.movement_type || movement.reason || "Inventory Movement";
}

function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function InventoryHistory({ setPage, selectedInventoryItem }) {
  const selectedItemId = getItemId(selectedInventoryItem);
  const [loading, setLoading] = useState(true);
  const [movements, setMovements] = useState([]);
  const [items, setItems] = useState([]);
  const [bins, setBins] = useState([]);
  const [search, setSearch] = useState("");
  const [itemFilter, setItemFilter] = useState(selectedItemId || "all");
  const [binFilter, setBinFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [page, setCurrentPage] = useState(1);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const [movementResult, itemResult, binResult] = await Promise.all([
        supabase
          .from("inventory_movements")
          .select(`
            *,
            inventory_items (id, name, item_number, sku),
            inventory_bins (id, name, code, inventory_locations (id, name, code))
          `)
          .order("created_at", { ascending: false }),
        supabase.from("inventory_item_availability").select("inventory_item_id,name,item_number,sku").eq("is_active", true).order("name"),
        supabase.from("inventory_bins").select("id,name,code").order("name"),
      ]);
      if (movementResult.error) throw movementResult.error;
      if (itemResult.error) throw itemResult.error;
      if (binResult.error) throw binResult.error;
      setMovements(movementResult.data || []);
      setItems(itemResult.data || []);
      setBins(binResult.data || []);
    } catch (error) {
      notifications.show({ title: "History Failed to Load", message: error.message, color: "red" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const employees = useMemo(() => [...new Set(movements.map((movement) => movement.performed_by).filter(Boolean))].sort(), [movements]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return movements.filter((movement) => {
      if (itemFilter !== "all" && movement.inventory_item_id !== itemFilter) return false;
      if (binFilter !== "all" && movement.bin_id !== binFilter) return false;
      if (typeFilter !== "all" && movement.operation !== typeFilter) return false;
      if (employeeFilter !== "all" && movement.performed_by !== employeeFilter) return false;
      const created = new Date(movement.created_at);
      if (startDate && created < new Date(new Date(startDate).setHours(0, 0, 0, 0))) return false;
      if (endDate && created > new Date(new Date(endDate).setHours(23, 59, 59, 999))) return false;
      if (!term) return true;
      return [
        movement.inventory_items?.name, movement.inventory_items?.item_number,
        movement.inventory_items?.sku, movement.inventory_bins?.name,
        movement.inventory_bins?.code, movement.reason, movement.notes,
        movement.reference_number, movement.performed_by,
      ].some((value) => String(value || "").toLowerCase().includes(term));
    });
  }, [binFilter, employeeFilter, endDate, itemFilter, movements, search, startDate, typeFilter]);

  useEffect(() => { setCurrentPage(1); }, [search, itemFilter, binFilter, typeFilter, employeeFilter, startDate, endDate]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const receipts = filtered.filter((movement) => movement.operation === "receive").length;
  const removals = filtered.filter((movement) => movement.operation === "remove").length;
  const netChange = filtered.reduce((sum, movement) => sum + numberValue(movement.quantity_change), 0);

  function clearFilters() {
    setSearch("");
    setItemFilter(selectedItemId || "all");
    setBinFilter("all");
    setTypeFilter("all");
    setEmployeeFilter("all");
    setStartDate(null);
    setEndDate(null);
  }

  function exportCsv() {
    const headers = ["Date", "Item Number", "Item", "Storage Position", "Movement", "Reason", "Before", "Change", "After", "Reference", "Employee", "Notes"];
    const rows = filtered.map((movement) => [
      new Date(movement.created_at).toLocaleString(), movement.inventory_items?.item_number,
      movement.inventory_items?.name, movement.inventory_bins?.code,
      movementLabel(movement), movement.reason, movement.quantity_before,
      movement.quantity_change, movement.quantity_after, movement.reference_number,
      movement.performed_by, movement.notes,
    ]);
    const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = `Metal_Worx_Inventory_History_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  if (loading) return <Stack gap="xl"><MWPageHeader title="Inventory History" subtitle="Loading the inventory movement ledger." setPage={setPage} showBack backPage={selectedItemId ? "inventoryItemDetails" : "inventory"} backLabel={selectedItemId ? "Item Details" : "Inventory"} showDashboard={false}/><MWPanel><Group justify="center" py={90}><Loader color="red"/><Text c="dimmed">Loading movement history…</Text></Group></MWPanel></Stack>;

  return (
    <Stack gap="xl">
      <MWPageHeader title="Inventory History" subtitle={selectedItemId ? `Complete movement history for ${selectedInventoryItem?.name}.` : "Complete, permanent record of inventory receipts, production additions, counts, adjustments, and removals."} setPage={setPage} showBack backPage={selectedItemId ? "inventoryItemDetails" : "inventory"} backLabel={selectedItemId ? "Item Details" : "Inventory"} showDashboard={false}/>
      <MWKpiStrip items={[
        { label: "Movements", value: filtered.length, description: "Matching current filters", icon: IconHistory, color: "blue" },
        { label: "Received / Added", value: receipts, description: "Incoming records", icon: IconPackageImport, color: "green" },
        { label: "Removals", value: removals, description: "Stock issued or removed", icon: IconBox, color: "orange" },
        { label: "Net Change", value: `${netChange > 0 ? "+" : ""}${formatNumber(netChange)}`, description: "Across filtered records", icon: IconAdjustments, color: netChange >= 0 ? "green" : "orange" },
      ]} columns={{ base: 1, sm: 2, xl: 4 }} compact/>

      <MWPanel title="History Filters" subtitle="Narrow the ledger to the records you need" icon={IconFilter}>
        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, md: 3 }}>
            <TextInput placeholder="Search item, reference, employee, notes…" value={search} onChange={(event) => setSearch(event.currentTarget.value)} leftSection={<IconSearch size={18}/>}/>
            <Select searchable data={[{ value: "all", label: "All Inventory Items" }, ...items.map((item) => ({ value: item.inventory_item_id, label: `${item.item_number || item.sku} · ${item.name}` }))]} value={itemFilter} onChange={(value) => setItemFilter(value || "all")} leftSection={<IconBox size={18}/>}/>
            <Select searchable data={[{ value: "all", label: "All Storage Positions" }, ...bins.map((bin) => ({ value: bin.id, label: `${bin.code} · ${bin.name}` }))]} value={binFilter} onChange={(value) => setBinFilter(value || "all")} leftSection={<IconMapPin size={18}/>}/>
            <Select data={[{ value: "all", label: "All Movement Types" }, { value: "receive", label: "Received / Produced" }, { value: "set", label: "Physical Count" }, { value: "add", label: "Adjustment Add" }, { value: "remove", label: "Removal" }]} value={typeFilter} onChange={(value) => setTypeFilter(value || "all")} leftSection={<IconAdjustments size={18}/>}/>
            <Select searchable data={[{ value: "all", label: "All Employees" }, ...employees.map((employee) => ({ value: employee, label: employee }))]} value={employeeFilter} onChange={(value) => setEmployeeFilter(value || "all")} leftSection={<IconUser size={18}/>}/>
            <Group grow><DateInput placeholder="Start date" value={startDate} onChange={setStartDate} clearable leftSection={<IconCalendar size={17}/>}/><DateInput placeholder="End date" value={endDate} onChange={setEndDate} clearable leftSection={<IconCalendar size={17}/>}/></Group>
          </SimpleGrid>
          <Group><Button variant="light" color="gray" onClick={clearFilters}>Clear Filters</Button><Button variant="light" color="gray" leftSection={<IconRefresh size={17}/>} onClick={loadHistory}>Refresh</Button><Button color="red" leftSection={<IconDownload size={17}/>} onClick={exportCsv} disabled={!filtered.length}>Export CSV</Button></Group>
        </Stack>
      </MWPanel>

      <MWPanel title="Movement Ledger" subtitle={`Showing ${visible.length} of ${filtered.length} records`} icon={IconHistory}>
        {!visible.length ? <Alert color="gray" icon={<IconHistory size={19}/>}>No inventory movements match the current filters.</Alert> : <Box style={{ overflowX: "auto" }}><Table verticalSpacing="md" horizontalSpacing="md" highlightOnHover>
          <Table.Thead><Table.Tr><Table.Th>Date</Table.Th><Table.Th>Item</Table.Th><Table.Th>Position</Table.Th><Table.Th>Movement</Table.Th><Table.Th ta="right">Before</Table.Th><Table.Th ta="right">Change</Table.Th><Table.Th ta="right">After</Table.Th><Table.Th>Reference / Employee</Table.Th><Table.Th>Notes</Table.Th></Table.Tr></Table.Thead>
          <Table.Tbody>{visible.map((movement) => { const change = numberValue(movement.quantity_change); return <Table.Tr key={movement.id}>
            <Table.Td><Text size="sm" fw={700} style={{ whiteSpace: "nowrap" }}>{formatDateTime(movement.created_at)}</Text></Table.Td>
            <Table.Td><Stack gap={2}><Text fw={850}>{movement.inventory_items?.name || "Unknown Item"}</Text><Text size="xs" c="dimmed">{movement.inventory_items?.item_number || movement.inventory_items?.sku || "—"}</Text></Stack></Table.Td>
            <Table.Td><Text fw={700}>{movement.inventory_bins?.code || "—"}</Text><Text size="xs" c="dimmed">{movement.inventory_bins?.name}</Text></Table.Td>
            <Table.Td><Stack gap={4}><Badge color={movementColor(movement)} variant="light">{movementLabel(movement)}</Badge><Text size="xs" c="dimmed">{movement.reason}</Text></Stack></Table.Td>
            <Table.Td ta="right"><Text>{formatNumber(movement.quantity_before)}</Text></Table.Td>
            <Table.Td ta="right"><Text fw={900} c={change > 0 ? "green.3" : change < 0 ? "orange.3" : "gray.3"}>{change > 0 ? "+" : ""}{formatNumber(change)}</Text></Table.Td>
            <Table.Td ta="right"><Text fw={850}>{formatNumber(movement.quantity_after)}</Text></Table.Td>
            <Table.Td><Stack gap={2}><Text size="sm" fw={700}>{movement.reference_number || "No reference"}</Text><Text size="xs" c="dimmed">{movement.performed_by || "Not recorded"}</Text></Stack></Table.Td>
            <Table.Td><Text size="sm" maw={260} lineClamp={2}>{movement.notes || "—"}</Text></Table.Td>
          </Table.Tr>; })}</Table.Tbody>
        </Table></Box>}
        {pageCount > 1 && <Group justify="center" mt="xl"><Pagination total={pageCount} value={page} onChange={setCurrentPage} color="red"/></Group>}
      </MWPanel>
    </Stack>
  );
}

export default InventoryHistory;
