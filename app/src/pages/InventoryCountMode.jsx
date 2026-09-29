import { Alert, Autocomplete, Badge, Button, Group, Loader, Modal, NumberInput, Paper, Progress, Select, SimpleGrid, Stack, Text, Textarea, TextInput, ThemeIcon, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconArchive, IconBox, IconCheck, IconClipboardCheck, IconMapPin, IconPackage, IconPhoto, IconPlayerPlay } from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import InventoryImageCapture from "../components/inventory/InventoryImageCapture";
import MWKpiStrip from "../components/ui/MWKpiStrip";
import MWPageHeader from "../components/ui/MWPageHeader";
import MWPanel from "../components/ui/MWPanel";

const numberValue = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const formatNumber = (value) => numberValue(value).toLocaleString("en-US", { maximumFractionDigits: 4 });
const getItemId = (item) => item?.inventory_item_id || item?.id || null;
const displayUser = (user) => typeof user === "string" ? user : user?.full_name || user?.name || user?.email || null;

function InventoryCountMode({ setPage, activeUser }) {
  const [items, setItems] = useState([]);
  const [bins, setBins] = useState([]);
  const [primaryLocation, setPrimaryLocation] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [counts, setCounts] = useState([]);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [balances, setBalances] = useState([]);
  const [crateEntry, setCrateEntry] = useState("");
  const [countedQuantity, setCountedQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [sessionName, setSessionName] = useState(`Inventory Reset ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [itemResult, binResult, locationResult, sessionResult] = await Promise.all([
        supabase.from("inventory_item_availability").select("*").eq("is_active", true).order("name"),
        supabase.from("inventory_bins").select("id,name,code,location_id,is_active,inventory_locations(id,name,code)").eq("is_active", true).order("code"),
        supabase.from("inventory_locations").select("id,name,code,is_primary,is_active").eq("is_active", true).order("is_primary", { ascending: false }).order("name").limit(1).maybeSingle(),
        supabase.from("inventory_reset_sessions").select("id,name,status,snapshot_item_count,snapshot_position_count,started_by,created_at,completed_at").order("created_at", { ascending: false }).limit(10),
      ]);
      if (itemResult.error) throw itemResult.error;
      if (binResult.error) throw binResult.error;
      if (locationResult.error) throw locationResult.error;
      if (sessionResult.error) throw sessionResult.error;
      setItems(itemResult.data || []);
      setBins(binResult.data || []);
      setPrimaryLocation(locationResult.data || null);
      setSessions(sessionResult.data || []);
      const active = (sessionResult.data || []).find((session) => session.status === "In Progress");
      if (active) {
        const result = await supabase.from("inventory_reset_counts").select("id,session_id,inventory_item_id,bin_id,quantity,notes,counted_by,counted_at").eq("session_id", active.id).order("counted_at", { ascending: false });
        if (result.error) throw result.error;
        setCounts(result.data || []);
      } else setCounts([]);
    } catch (error) {
      notifications.show({ title: "Inventory Reset Failed to Load", message: error.message, color: "red" });
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const activeSession = sessions.find((session) => session.status === "In Progress") || null;
  const selectedItem = items.find((item) => getItemId(item) === selectedItemId) || null;
  const countedItemIds = useMemo(() => new Set(counts.map((count) => count.inventory_item_id)), [counts]);
  const progress = activeSession?.snapshot_item_count ? Math.min(100, counts.length / activeSession.snapshot_item_count * 100) : 0;
  const recordedTotal = balances.reduce((total, balance) => total + numberValue(balance.quantity_on_hand), 0);
  const itemOptions = items.map((item) => ({ value: getItemId(item), label: `${countedItemIds.has(getItemId(item)) ? "✓ " : ""}${item.name} · ${item.item_number || item.sku || "No item number"}` }));
  const crateSuggestions = bins.map((bin) => `${bin.code} ${bin.name}`.trim());

  async function selectItem(value) {
    setSelectedItemId(value || ""); setCrateEntry(""); setCountedQuantity(""); setNotes(""); setImageFile(null);
    if (!value) { setBalances([]); return; }
    try {
      const { data, error } = await supabase.from("inventory_bin_balances").select("*").eq("inventory_item_id", value);
      if (error) throw error;
      const loaded = data || [];
      const item = items.find((candidate) => getItemId(candidate) === value);
      const prior = counts.find((count) => count.inventory_item_id === value);
      setBalances(loaded);
      const startingBinId = prior?.bin_id || item?.default_bin_id || loaded[0]?.bin_id || "";
      const startingBin = bins.find((candidate) => candidate.id === startingBinId);
      setCrateEntry(startingBin ? `${startingBin.code} ${startingBin.name}`.trim() : "");
      if (prior) { setCountedQuantity(numberValue(prior.quantity)); setNotes(prior.notes || ""); }
    } catch (error) { notifications.show({ title: "Item Could Not Be Opened", message: error.message, color: "red" }); }
  }

  async function startReset() {
    if (!sessionName.trim() || saving) return;
    setSaving(true);
    try {
      const { error } = await supabase.rpc("mw_start_inventory_reset", { p_name: sessionName.trim(), p_started_by: displayUser(activeUser) });
      if (error) throw error;
      setStartOpen(false); await loadData();
      notifications.show({ title: "Backup Created", message: "Items and images were kept. Quantities and crate assignments were cleared for the fresh count.", color: "green", icon: <IconArchive size={18}/> });
    } catch (error) { notifications.show({ title: "Reset Could Not Start", message: error.message, color: "red" }); }
    finally { setSaving(false); }
  }

  async function uploadReplacementImage(item) {
    if (!imageFile) return;
    const extension = imageFile.name.split(".").pop()?.toLowerCase() || "jpg";
    const storagePath = `${getItemId(item)}/${Date.now()}-inventory-reset.${extension}`;
    const upload = await supabase.storage.from("inventory-images").upload(storagePath, imageFile, { cacheControl: "3600", upsert: false, contentType: imageFile.type || undefined });
    if (upload.error) throw upload.error;
    const publicUrl = supabase.storage.from("inventory-images").getPublicUrl(storagePath).data?.publicUrl || null;
    const demote = await supabase.from("inventory_item_images").update({ is_primary: false }).eq("inventory_item_id", getItemId(item));
    if (demote.error) throw demote.error;
    const image = await supabase.from("inventory_item_images").insert({ inventory_item_id: getItemId(item), storage_bucket: "inventory-images", storage_path: storagePath, public_url: publicUrl, file_name: imageFile.name, mime_type: imageFile.type || null, file_size_bytes: imageFile.size || null, alt_text: item.name, caption: "Verified during fresh inventory count", sort_order: 0, is_primary: true, is_active: true });
    if (image.error) throw image.error;
    const update = await supabase.from("inventory_items").update({ primary_image_url: publicUrl, primary_image_path: storagePath, image_alt_text: item.name }).eq("id", getItemId(item));
    if (update.error) throw update.error;
  }

  async function resolveCrate() {
    const entered = crateEntry.trim();
    if (!entered) throw new Error("Enter the new crate or box, such as CR-01 Animals.");
    const normalized = entered.toLowerCase();
    const existing = bins.find((bin) => [bin.code, bin.name, `${bin.code} ${bin.name}`, `${bin.code} · ${bin.name}`].some((value) => String(value || "").trim().toLowerCase() === normalized));
    if (existing) return existing;
    if (!primaryLocation?.id) throw new Error("A primary inventory location is required before a new crate can be created.");
    const parts = entered.split(/\s+/);
    const code = String(parts.shift() || "").trim().toUpperCase();
    const name = parts.join(" ").trim() || code;
    if (!code) throw new Error("Enter a crate code, such as CR-01 Animals.");
    const { data, error } = await supabase.from("inventory_bins").insert({
      location_id: primaryLocation.id,
      code,
      name,
      zone: "Inventory Reset",
      description: `Created during ${activeSession?.name || "fresh inventory count"}.`,
      barcode_value: `MW-BIN-${code}`,
      qr_code_value: `MW-BIN-${code}`,
      is_active: true,
    }).select("id,name,code,location_id,is_active,inventory_locations(id,name,code)").single();
    if (error) throw error;
    setBins((current) => [...current, data]);
    return data;
  }

  async function saveCount() {
    if (!activeSession || !selectedItem || !crateEntry.trim() || countedQuantity === "" || numberValue(countedQuantity) < 0 || saving) return;
    setSaving(true);
    try {
      const resolvedCrate = await resolveCrate();
      const { data, error } = await supabase.rpc("mw_save_inventory_reset_count", { p_session_id: activeSession.id, p_inventory_item_id: getItemId(selectedItem), p_bin_id: resolvedCrate.id, p_quantity: numberValue(countedQuantity), p_notes: notes.trim() || null, p_counted_by: displayUser(activeUser) });
      if (error) throw error;
      await uploadReplacementImage(selectedItem);
      notifications.show({ title: countedItemIds.has(getItemId(selectedItem)) ? "Count Updated" : "Item Verified", message: `${selectedItem.name} is now recorded in ${resolvedCrate.code || resolvedCrate.name} with a quantity of ${formatNumber(data?.quantity_after ?? countedQuantity)}.`, color: "green", icon: <IconCheck size={18}/> });
      setSelectedItemId(""); setBalances([]); setCrateEntry(""); setCountedQuantity(""); setNotes(""); setImageFile(null); await loadData();
    } catch (error) { notifications.show({ title: "Count Could Not Be Saved", message: error.message, color: "red" }); }
    finally { setSaving(false); }
  }

  async function completeReset() {
    if (!activeSession || saving) return;
    setSaving(true);
    try {
      const { error } = await supabase.rpc("mw_complete_inventory_reset", { p_session_id: activeSession.id });
      if (error) throw error;
      setCompleteOpen(false); await loadData();
      notifications.show({ title: "Inventory Reset Completed", message: "The fresh count is complete and the original backup remains archived.", color: "green", icon: <IconCheck size={18}/> });
    } catch (error) { notifications.show({ title: "Reset Could Not Be Completed", message: error.message, color: "red" }); }
    finally { setSaving(false); }
  }

  if (loading) return <Stack gap="xl"><MWPageHeader title="Fresh Inventory Count" subtitle="Loading inventory and backup status." setPage={setPage} showBack backPage="inventoryDashboard" backLabel="Inventory" showDashboard={false}/><MWPanel><Group justify="center" py={90}><Loader color="red"/><Text c="dimmed">Loading inventory…</Text></Group></MWPanel></Stack>;

  return <Stack gap="xl">
    <MWPageHeader title="Fresh Inventory Count" subtitle="Manually verify each item, its crate or box, quantity, photo, and notes." setPage={setPage} showBack backPage="inventoryDashboard" backLabel="Inventory" showDashboard={false}/>
    {!activeSession ? <MWPanel title="Start With a Safe Backup" subtitle="The current inventory will be archived before the new count begins." icon={IconArchive} color="red"><Stack gap="lg">
      <Alert color="blue" icon={<IconArchive size={20}/>} title="Items and images will be kept">Starting creates a dated backup, keeps every item and existing image, then clears active quantities and crate assignments. Your team can rebuild the inventory one verified item at a time. Zero-quantity items will remain until you review them later.</Alert>
      <Button size="lg" color="red" leftSection={<IconPlayerPlay size={20}/>} onClick={() => setStartOpen(true)}>Archive Current Inventory & Start Fresh</Button>
      {sessions.length > 0 && <Stack gap="xs"><Text fw={800}>Previous inventory resets</Text>{sessions.map((session) => <Paper key={session.id} withBorder p="md"><Group justify="space-between"><div><Text fw={800}>{session.name}</Text><Text size="sm" c="dimmed">Backup created {new Date(session.created_at).toLocaleString()} · {session.snapshot_item_count} items</Text></div><Badge color={session.status === "Completed" ? "green" : "gray"}>{session.status}</Badge></Group></Paper>)}</Stack>}
    </Stack></MWPanel> : <>
      <MWKpiStrip items={[{ label: "Verified", value: counts.length, description: `of ${activeSession.snapshot_item_count} archived items`, icon: IconClipboardCheck, color: "green" }, { label: "Remaining", value: Math.max(0, activeSession.snapshot_item_count - counts.length), description: "Items left to check", icon: IconPackage, color: "orange" }, { label: "Backup", value: "Saved", description: new Date(activeSession.created_at).toLocaleDateString(), icon: IconArchive, color: "blue" }, { label: "Current Step", value: selectedItem ? "Enter Details" : "Choose Item", description: selectedItem?.name || "Ready for next item", icon: IconBox, color: "red" }]} columns={{ base: 1, sm: 2, xl: 4 }} compact/>
      <MWPanel title={activeSession.name} subtitle="Progress is saved after every item." icon={IconClipboardCheck} color="green" rightSection={<Button variant="light" color="green" size="xs" onClick={() => setCompleteOpen(true)}>Finish Reset</Button>}><Stack gap="xs"><Group justify="space-between"><Text size="sm" fw={800}>{counts.length} items verified</Text><Text size="sm" c="dimmed">{Math.round(progress)}%</Text></Group><Progress value={progress} color="green" size="lg" radius="xl"/></Stack></MWPanel>
      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="xl">
        <MWPanel title="1. Choose the Item" subtitle="Search by item name, number, or SKU—no scanner required." icon={IconPackage}><Stack gap="lg">
          <Select searchable clearable size="lg" label="Inventory Item" placeholder="Search for an item" data={itemOptions} value={selectedItemId} onChange={selectItem}/>
          {!selectedItem ? <Paper p="xl" withBorder><Stack align="center" py={35}><ThemeIcon size={70} radius="xl" color="red" variant="light"><IconPackage size={34}/></ThemeIcon><Title order={3}>Choose an item to begin</Title><Text c="dimmed" ta="center">Verified items show a check mark and can be reopened if a correction is needed.</Text></Stack></Paper> : <Paper p="lg" withBorder><Group wrap="nowrap" align="flex-start">{selectedItem.primary_image_url ? <img src={selectedItem.primary_image_url} alt={selectedItem.image_alt_text || selectedItem.name} style={{ width: 110, height: 90, objectFit: "contain", borderRadius: 10, background: "white" }}/> : <ThemeIcon size={70} radius="lg" color="gray" variant="light"><IconPhoto size={32}/></ThemeIcon>}<Stack gap={4}><Title order={3}>{selectedItem.name}</Title><Text c="dimmed">{selectedItem.item_number || selectedItem.sku || "No item number"}</Text><Text size="sm">Previously recorded total: <b>{formatNumber(recordedTotal)}</b></Text>{countedItemIds.has(getItemId(selectedItem)) && <Badge color="green" w="fit-content">Already verified — editing</Badge>}</Stack></Group></Paper>}
        </Stack></MWPanel>
        <MWPanel title="2. Verify Its New Information" subtitle="Record what is physically in front of you." icon={IconClipboardCheck}>
          {!selectedItem ? <Stack align="center" py={70}><ThemeIcon size={64} radius="xl" color="gray" variant="light"><IconClipboardCheck size={30}/></ThemeIcon><Text c="dimmed">Choose an item to unlock the count form.</Text></Stack> : <Stack gap="lg">
            <Autocomplete label="New Crate or Box" description="Type the new crate directly. If it does not exist, it will be created when you save." placeholder="Example: CR-01 Animals" data={crateSuggestions} value={crateEntry} onChange={setCrateEntry} required leftSection={<IconMapPin size={18}/>}/>
            <Text size="xs" c="dimmed">Use a consistent format: crate code first, then the category name—for example, <b>CR-01 Animals</b>.</Text>
            <NumberInput label="Physical Quantity" description="Enter the quantity you can physically verify now." placeholder="Enter count" value={countedQuantity} onChange={setCountedQuantity} min={0} decimalScale={4} required size="lg"/>
            <Textarea label="Notes or Condition" placeholder="Optional: damage, missing parts, dimensions, condition, or anything that needs attention" value={notes} onChange={(event) => setNotes(event.currentTarget.value)} minRows={3}/>
            <InventoryImageCapture value={imageFile} onChange={setImageFile} label="Replace or Add Item Photo" description="Optional. The existing photo stays unless you add a better identifying photo."/>
            <Alert color="blue" icon={<IconArchive size={20}/>}>Saving assigns this existing item to the selected crate, records its physical quantity, and keeps its current image unless you upload a replacement. The pre-reset information remains in the dated backup.</Alert>
            <Button size="lg" color="green" leftSection={saving ? <Loader size={18} color="white"/> : <IconCheck size={20}/>} disabled={!crateEntry.trim() || countedQuantity === "" || numberValue(countedQuantity) < 0 || saving} onClick={saveCount}>Save & Verify Item</Button>
          </Stack>}
        </MWPanel>
      </SimpleGrid>
      {counts.length > 0 && <MWPanel title="Recently Verified" subtitle="The latest items saved in this reset." icon={IconCheck} color="green"><Stack gap="xs">{counts.slice(0, 8).map((count) => { const item = items.find((candidate) => getItemId(candidate) === count.inventory_item_id); const bin = bins.find((candidate) => candidate.id === count.bin_id); return <Paper key={count.id} withBorder p="sm"><Group justify="space-between"><div><Text fw={800}>{item?.name || "Inventory item"}</Text><Text size="xs" c="dimmed">{bin?.code || bin?.name || "Storage position"} · {new Date(count.counted_at).toLocaleString()}</Text></div><Badge color="green">Qty {formatNumber(count.quantity)}</Badge></Group></Paper>; })}</Stack></MWPanel>}
    </>}
    <Modal opened={startOpen} onClose={() => setStartOpen(false)} title="Archive Current Inventory & Start Fresh" centered><Stack><Alert color="blue" icon={<IconArchive size={20}/>}>This keeps every item and image. It creates a permanent dated backup, then clears quantities and crate assignments so you can begin fresh. Nothing will be deleted.</Alert><TextInput label="Reset Name" value={sessionName} onChange={(event) => setSessionName(event.currentTarget.value)} required/><Button color="red" loading={saving} disabled={!sessionName.trim()} onClick={startReset}>Create Backup, Clear Counts & Begin</Button><Button variant="subtle" color="gray" onClick={() => setStartOpen(false)}>Cancel</Button></Stack></Modal>
    <Modal opened={completeOpen} onClose={() => setCompleteOpen(false)} title="Finish This Inventory Reset?" centered><Stack><Alert color={counts.length < (activeSession?.snapshot_item_count || 0) ? "orange" : "green"} icon={<IconClipboardCheck size={20}/>}>{counts.length} of {activeSession?.snapshot_item_count || 0} archived items have been verified. Finishing closes this reset, but its backup and count history remain available.</Alert><Button color="green" loading={saving} onClick={completeReset}>Finish Inventory Reset</Button><Button variant="subtle" color="gray" onClick={() => setCompleteOpen(false)}>Keep Counting</Button></Stack></Modal>
  </Stack>;
}

export default InventoryCountMode;
