import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Divider,
  Group,
  Loader,
  Modal,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Textarea,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import {
  IconArrowLeft,
  IconCalendarEvent,
  IconCash,
  IconCheck,
  IconPlus,
  IconRefresh,
  IconScan,
  IconSettings,
  IconStar,
  IconShoppingCart,
  IconTrash,
  IconTruckDelivery,
} from "@tabler/icons-react";

import { supabase } from "../lib/supabase";

const PAYMENT_METHODS = [
  "Cash",
  "Credit Card",
  "Debit Card",
  "Square",
  "Venmo",
  "PayPal",
  "Other",
];

const SHOW_CATEGORIES = [
  "Animals",
  "Flags",
  "Home Décor",
  "Ornaments",
  "Military",
  "First Responders",
  "Seasonal",
  "Signs",
  "Other",
];

function money(value) {
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function dateValue(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}

function getItemId(item) {
  return item?.inventory_item_id || item?.id || null;
}

function makeEventCode(name) {
  const prefix = String(name || "SHOW")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 18);
  return `${prefix || "SHOW"}-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
}

function ShowSales({ setPage, activeUser }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [events, setEvents] = useState([]);
  const [showSummaries, setShowSummaries] = useState([]);
  const [allProductPerformance, setAllProductPerformance] = useState([]);
  const [activeEvent, setActiveEvent] = useState(null);
  const [snapshots, setSnapshots] = useState([]);
  const [sales, setSales] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [reconcileOpen, setReconcileOpen] = useState(false);
  const [reconcileSearch, setReconcileSearch] = useState("");
  const [reconcileCounts, setReconcileCounts] = useState({});
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [selectedSummary, setSelectedSummary] = useState(null);
  const [selectedSummaryProducts, setSelectedSummaryProducts] = useState([]);
  const [selectedSummaryPayments, setSelectedSummaryPayments] = useState([]);
  const [summaryProductFilter, setSummaryProductFilter] = useState("sold");
  const [summaryProductSearch, setSummaryProductSearch] = useState("");
  const [catalogManagerOpen, setCatalogManagerOpen] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogItems, setCatalogItems] = useState([]);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState("all");
  const [catalogStatusFilter, setCatalogStatusFilter] = useState("all");
  const [catalogSavingId, setCatalogSavingId] = useState(null);
  const [selectedCatalogIds, setSelectedCatalogIds] = useState([]);
  const [bulkCatalogCategory, setBulkCatalogCategory] = useState(null);
  const [bulkCatalogSaving, setBulkCatalogSaving] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [browsePositionId, setBrowsePositionId] = useState(null);
  const [searching, setSearching] = useState(false);
  const [cart, setCart] = useState([]);
  const [eventForm, setEventForm] = useState({
    eventName: "",
    venueName: "",
    address: "",
    city: "",
    state: "NC",
    startDate: new Date(),
    endDate: new Date(),
    startingCash: 0,
    notes: "",
  });
  const [checkout, setCheckout] = useState({
    paymentMethod: "Cash",
    taxAmount: 0,
    saleDiscount: 0,
    amountTendered: "",
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    paymentReference: "",
    notes: "",
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [eventResult, summaryResult, performanceResult] = await Promise.all([
        supabase.from("show_events").select("*").order("start_date", { ascending: false }),
        supabase.from("show_event_summary").select("*").order("start_date", { ascending: false }),
        supabase.from("show_product_performance").select("*"),
      ]);
      if (eventResult.error) throw eventResult.error;
      if (summaryResult.error) throw summaryResult.error;
      if (performanceResult.error) throw performanceResult.error;
      const eventRows = eventResult.data || [];
      setShowSummaries(summaryResult.data || []);
      setAllProductPerformance(performanceResult.data || []);

      const current = (eventRows || []).find((event) => event.status === "Active") || null;
      setEvents(eventRows || []);
      setActiveEvent(current);

      if (!current) {
        setSnapshots([]);
        setSales([]);
        return;
      }

      const [snapshotResult, salesResult] = await Promise.all([
        supabase
          .from("show_inventory_snapshots")
          .select("*")
          .eq("show_event_id", current.id)
          .order("item_name"),
        supabase
          .from("show_sales")
          .select("*")
          .eq("show_event_id", current.id)
          .order("sold_at", { ascending: false })
          .limit(50),
      ]);
      if (snapshotResult.error) throw snapshotResult.error;
      if (salesResult.error) throw salesResult.error;
      setSnapshots(snapshotResult.data || []);
      setSales(salesResult.data || []);
    } catch (error) {
      notifications.show({
        title: "Unable to Load Show Sales",
        message: error.message,
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const completedSales = useMemo(
    () => sales.filter((sale) => sale.sale_status === "Completed"),
    [sales]
  );
  const salesTotal = useMemo(
    () => completedSales.reduce((sum, sale) => sum + Number(sale.total_amount || 0), 0),
    [completedSales]
  );
  const startingUnits = useMemo(
    () => snapshots.reduce((sum, row) => sum + Number(row.starting_quantity || 0), 0),
    [snapshots]
  );
  const expectedUnits = useMemo(
    () => snapshots.reduce((sum, row) => sum + Number(row.expected_quantity || 0), 0),
    [snapshots]
  );
  const cartSubtotal = useMemo(
    () =>
      cart.reduce(
        (sum, item) =>
          sum + Number(item.quantity || 0) * Number(item.unitPrice || 0) - Number(item.discountAmount || 0),
        0
      ),
    [cart]
  );
  const checkoutTotal = Math.max(
    0,
    cartSubtotal - Number(checkout.saleDiscount || 0) + Number(checkout.taxAmount || 0)
  );
  const filteredReconciliationSnapshots = useMemo(() => {
    const term = reconcileSearch.trim().toLowerCase();
    if (!term) return snapshots;
    return snapshots.filter((row) =>
      [row.item_name, row.item_number, row.bin_code]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [reconcileSearch, snapshots]);
  const reconciliationVarianceCount = useMemo(
    () =>
      snapshots.filter((row) => {
        const count = reconcileCounts[row.id];
        return count && Number(count.actualQuantity) !== Number(row.expected_quantity);
      }).length,
    [reconcileCounts, snapshots]
  );
  const productTrends = useMemo(() => {
    const grouped = new Map();
    allProductPerformance.forEach((row) => {
      const existing = grouped.get(row.inventory_item_id) || {
        inventoryItemId: row.inventory_item_id,
        itemNumber: row.item_number,
        itemName: row.item_name,
        shows: 0,
        startingQuantity: 0,
        unitsSold: 0,
        revenue: 0,
      };
      existing.shows += 1;
      existing.startingQuantity += Number(row.starting_quantity || 0);
      existing.unitsSold += Number(row.units_sold || 0);
      existing.revenue += Number(row.product_revenue || 0);
      grouped.set(row.inventory_item_id, existing);
    });
    return Array.from(grouped.values())
      .map((row) => ({
        ...row,
        sellThrough:
          row.startingQuantity > 0
            ? (row.unitsSold / row.startingQuantity) * 100
            : 0,
      }))
      .filter((row) => row.unitsSold > 0)
      .sort((a, b) => b.unitsSold - a.unitsSold || b.revenue - a.revenue);
  }, [allProductPerformance]);
  const filteredSummaryProducts = useMemo(() => {
    const term = summaryProductSearch.trim().toLowerCase();
    return selectedSummaryProducts.filter((product) => {
      const sold = Number(product.units_sold) > 0;
      if (summaryProductFilter === "sold" && !sold) return false;
      if (summaryProductFilter === "unsold" && sold) return false;
      if (!term) return true;
      return [product.item_name, product.item_number]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [selectedSummaryProducts, summaryProductFilter, summaryProductSearch]);
  const filteredCatalogItems = useMemo(() => {
    const term = catalogSearch.trim().toLowerCase();
    return catalogItems.filter((item) => {
      if (catalogCategoryFilter !== "all" && item.show_category !== catalogCategoryFilter) return false;
      if (catalogStatusFilter === "enabled" && !item.available_for_show_sales) return false;
      if (catalogStatusFilter === "disabled" && item.available_for_show_sales) return false;
      if (catalogStatusFilter === "uncategorized" && item.show_category) return false;
      if (!term) return true;
      return [item.name, item.item_number]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [catalogItems, catalogSearch, catalogCategoryFilter, catalogStatusFilter]);

  async function openCatalogManager() {
    setCatalogManagerOpen(true);
    setCatalogLoading(true);
    setCatalogSearch("");
    setCatalogCategoryFilter("all");
    setCatalogStatusFilter("all");
    setSelectedCatalogIds([]);
    setBulkCatalogCategory(null);
    try {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("id, name, item_number, selling_price, available_for_show_sales, show_category, show_price, show_display_order, show_featured")
        .order("name");
      if (error) throw error;
      setCatalogItems((data || []).map((item) => ({
        ...item,
        available_for_show_sales: Boolean(item.available_for_show_sales),
        show_featured: Boolean(item.show_featured),
        show_display_order: Number(item.show_display_order ?? 1000),
      })));
    } catch (error) {
      notifications.show({ title: "Catalog Could Not Load", message: error.message, color: "red" });
      setCatalogManagerOpen(false);
    } finally {
      setCatalogLoading(false);
    }
  }

  function updateCatalogDraft(itemId, changes) {
    setCatalogItems((current) =>
      current.map((item) => (item.id === itemId ? { ...item, ...changes } : item))
    );
  }

  function toggleCatalogSelection(itemId, checked) {
    setSelectedCatalogIds((current) =>
      checked
        ? Array.from(new Set([...current, itemId]))
        : current.filter((id) => id !== itemId)
    );
  }

  function toggleAllDisplayedCatalogItems(checked) {
    const displayedIds = filteredCatalogItems.map((item) => item.id);
    setSelectedCatalogIds((current) => {
      if (checked) return Array.from(new Set([...current, ...displayedIds]));
      const displayedSet = new Set(displayedIds);
      return current.filter((id) => !displayedSet.has(id));
    });
  }

  async function applyBulkCatalogCategory() {
    if (!selectedCatalogIds.length || !bulkCatalogCategory) {
      notifications.show({
        title: "Select Products and a Category",
        message: "Choose at least one product and the category to apply.",
        color: "orange",
      });
      return;
    }
    setBulkCatalogSaving(true);
    try {
      for (let index = 0; index < selectedCatalogIds.length; index += 100) {
        const batch = selectedCatalogIds.slice(index, index + 100);
        const { error } = await supabase
          .from("inventory_items")
          .update({ show_category: bulkCatalogCategory })
          .in("id", batch);
        if (error) throw error;
      }
      setCatalogItems((current) =>
        current.map((item) =>
          selectedCatalogIds.includes(item.id)
            ? { ...item, show_category: bulkCatalogCategory }
            : item
        )
      );
      notifications.show({
        title: "Category Applied",
        message: `${bulkCatalogCategory} was assigned to ${selectedCatalogIds.length} product${selectedCatalogIds.length === 1 ? "" : "s"}.`,
        color: "green",
      });
      setSelectedCatalogIds([]);
      setBulkCatalogCategory(null);
    } catch (error) {
      notifications.show({ title: "Category Was Not Applied", message: error.message, color: "red" });
    } finally {
      setBulkCatalogSaving(false);
    }
  }

  async function saveCatalogItem(item) {
    if (item.available_for_show_sales && !item.show_category) {
      notifications.show({
        title: "Choose a Show Category",
        message: `${item.name} needs a category before it can appear in Quick-Sell.`,
        color: "orange",
      });
      return;
    }
    setCatalogSavingId(item.id);
    try {
      const { error } = await supabase
        .from("inventory_items")
        .update({
          available_for_show_sales: Boolean(item.available_for_show_sales),
          show_category: item.show_category || null,
          show_price: item.show_price === "" || item.show_price == null
            ? null
            : Number(item.show_price),
          show_display_order: Number(item.show_display_order ?? 1000),
          show_featured: Boolean(item.show_featured),
        })
        .eq("id", item.id);
      if (error) throw error;
      notifications.show({
        title: "Catalog Product Saved",
        message: `${item.name} ${item.available_for_show_sales ? "will appear in Quick-Sell." : "is hidden from Quick-Sell."}`,
        color: "green",
      });
    } catch (error) {
      notifications.show({ title: "Product Was Not Saved", message: error.message, color: "red" });
    } finally {
      setCatalogSavingId(null);
    }
  }

  async function createEvent() {
    if (!eventForm.eventName.trim() || !eventForm.startDate || !eventForm.endDate) {
      notifications.show({ title: "Missing Information", message: "Enter the show name and dates.", color: "orange" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("show_events").insert({
        event_name: eventForm.eventName.trim(),
        event_code: makeEventCode(eventForm.eventName),
        venue_name: eventForm.venueName.trim() || null,
        address: eventForm.address.trim() || null,
        city: eventForm.city.trim() || null,
        state: eventForm.state.trim() || null,
        start_date: eventForm.startDate.toISOString().slice(0, 10),
        end_date: eventForm.endDate.toISOString().slice(0, 10),
        starting_cash: Number(eventForm.startingCash || 0),
        notes: eventForm.notes.trim() || null,
        created_by: activeUser || null,
      });
      if (error) throw error;
      notifications.show({ title: "Show Created", message: "The show is ready to start.", color: "green" });
      setCreateOpen(false);
      setEventForm({
        eventName: "",
        venueName: "",
        address: "",
        city: "",
        state: "NC",
        startDate: new Date(),
        endDate: new Date(),
        startingCash: 0,
        notes: "",
      });
      await loadData();
    } catch (error) {
      notifications.show({ title: "Show Was Not Created", message: error.message, color: "red" });
    } finally {
      setSaving(false);
    }
  }

  async function startEvent(event) {
    if (!window.confirm(`Start ${event.event_name} and capture all current inventory?`)) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc("mw_start_show_event", {
        p_show_event_id: event.id,
        p_started_by: activeUser || null,
      });
      if (error) throw error;
      notifications.show({
        title: "Show Started",
        message: `${data?.total_units || 0} units were captured for the show.`,
        color: "green",
      });
      await loadData();
    } catch (error) {
      notifications.show({ title: "Show Could Not Start", message: error.message, color: "red" });
    } finally {
      setSaving(false);
    }
  }

  function addResolvedItemToCart(item, position) {
    const itemId = getItemId(item);
    setCart((current) => {
      const existing = current.find(
        (row) => row.inventoryItemId === itemId && row.binId === position.bin_id
      );
      if (existing) {
        if (existing.quantity + 1 > Number(position.expected_quantity)) return current;
        return current.map((row) =>
          row === existing ? { ...row, quantity: row.quantity + 1 } : row
        );
      }
      return [
        ...current,
        {
          inventoryItemId: itemId,
          binId: position.bin_id,
          itemNumber: item.item_number || position.item_number,
          itemName: item.name || position.item_name,
          binCode: position.bin_code,
          availableQuantity: Number(position.expected_quantity),
          quantity: 1,
          unitPrice: Number(item.selling_price || item.retail_price || item.unit_price || 0),
          discountAmount: 0,
        },
      ];
    });
  }

  async function addBrowsedInventoryItem() {
    if (!browsePositionId) return;
    setSearching(true);
    try {
      const position = snapshots.find((row) => row.id === browsePositionId);
      if (!position || Number(position.expected_quantity) <= 0) {
        throw new Error("That product no longer has show inventory available.");
      }
      const { data: item, error } = await supabase
        .from("inventory_item_availability")
        .select("*")
        .eq("inventory_item_id", position.inventory_item_id)
        .maybeSingle();
      if (error) throw error;
      if (!item) throw new Error("The selected inventory item was not found.");
      addResolvedItemToCart(item, position);
      setBrowsePositionId(null);
    } catch (error) {
      notifications.show({ title: "Item Not Added", message: error.message, color: "red" });
    } finally {
      setSearching(false);
    }
  }

  async function findInventoryItem() {
    const value = searchValue.trim();
    if (!value || !activeEvent) return;
    setSearching(true);
    try {
      let item = null;
      const { data: label, error: labelError } = await supabase
        .from("inventory_labels")
        .select("inventory_item_id")
        .eq("is_active", true)
        .or(`qr_token.eq.${value},barcode_value.eq.${value}`)
        .limit(1)
        .maybeSingle();
      if (labelError) throw labelError;

      if (label?.inventory_item_id) {
        const result = await supabase
          .from("inventory_item_availability")
          .select("*")
          .eq("inventory_item_id", label.inventory_item_id)
          .maybeSingle();
        if (result.error) throw result.error;
        item = result.data;
      } else {
        const result = await supabase
          .from("inventory_item_availability")
          .select("*")
          .or(`item_number.eq.${value},sku.eq.${value},manufacturer_part_number.eq.${value}`)
          .limit(1)
          .maybeSingle();
        if (result.error) throw result.error;
        item = result.data;
      }

      if (!item) throw new Error("No inventory item matched that scan or item number.");
      const itemId = getItemId(item);
      const availableSnapshots = snapshots
        .filter((row) => row.inventory_item_id === itemId && Number(row.expected_quantity) > 0)
        .sort((a, b) => Number(b.expected_quantity) - Number(a.expected_quantity));
      if (!availableSnapshots.length) throw new Error(`${item.name} has no remaining show inventory.`);

      const position = availableSnapshots[0];
      addResolvedItemToCart(item, position);
      setSearchValue("");
    } catch (error) {
      notifications.show({ title: "Item Not Added", message: error.message, color: "red" });
    } finally {
      setSearching(false);
    }
  }

  function updateCart(index, patch) {
    setCart((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  async function completeSale() {
    if (!activeEvent || !cart.length) return;
    if (cart.some((item) => Number(item.unitPrice) < 0 || Number(item.quantity) <= 0)) {
      notifications.show({ title: "Review Cart", message: "Every item needs a valid quantity and price.", color: "orange" });
      return;
    }
    setSaving(true);
    try {
      const items = cart.map((item) => ({
        inventory_item_id: item.inventoryItemId,
        bin_id: item.binId,
        item_number: item.itemNumber,
        item_name: item.itemName,
        quantity: Number(item.quantity),
        unit_price: Number(item.unitPrice),
        discount_amount: Number(item.discountAmount || 0),
      }));
      const { data, error } = await supabase.rpc("mw_complete_show_sale", {
        p_show_event_id: activeEvent.id,
        p_items: items,
        p_payment_method: checkout.paymentMethod,
        p_tax_amount: Number(checkout.taxAmount || 0),
        p_sale_discount: Number(checkout.saleDiscount || 0),
        p_amount_tendered:
          checkout.amountTendered === "" ? null : Number(checkout.amountTendered),
        p_customer_name: checkout.customerName.trim() || null,
        p_customer_email: checkout.customerEmail.trim() || null,
        p_customer_phone: checkout.customerPhone.trim() || null,
        p_payment_reference: checkout.paymentReference.trim() || null,
        p_notes: checkout.notes.trim() || null,
        p_sold_by: activeUser || null,
      });
      if (error) throw error;
      notifications.show({
        title: "Sale Completed",
        message: `${data.sale_number} completed for ${money(data.total_amount)}${Number(data.change_due) > 0 ? ` · Change: ${money(data.change_due)}` : ""}.`,
        color: "green",
      });
      setCart([]);
      setCheckoutOpen(false);
      setCheckout({
        paymentMethod: "Cash",
        taxAmount: 0,
        saleDiscount: 0,
        amountTendered: "",
        customerName: "",
        customerEmail: "",
        customerPhone: "",
        paymentReference: "",
        notes: "",
      });
      await loadData();
    } catch (error) {
      notifications.show({ title: "Sale Was Not Completed", message: error.message, color: "red" });
    } finally {
      setSaving(false);
    }
  }

  function openReconciliation() {
    const initialCounts = {};
    snapshots.forEach((row) => {
      initialCounts[row.id] = {
        actualQuantity: Number(row.expected_quantity || 0),
        reason: "",
        notes: "",
      };
    });
    setReconcileCounts(initialCounts);
    setReconcileSearch("");
    setReconcileOpen(true);
  }

  function updateReconciliationCount(snapshotId, patch) {
    setReconcileCounts((current) => ({
      ...current,
      [snapshotId]: { ...current[snapshotId], ...patch },
    }));
  }

  async function closeAndReconcileShow() {
    if (!activeEvent) return;
    const missingReason = snapshots.find((row) => {
      const count = reconcileCounts[row.id];
      return (
        count &&
        Number(count.actualQuantity) !== Number(row.expected_quantity) &&
        !count.reason
      );
    });
    if (missingReason) {
      notifications.show({
        title: "Variance Reason Required",
        message: `Choose a reason for ${missingReason.item_name}.`,
        color: "orange",
      });
      return;
    }
    const message = reconciliationVarianceCount
      ? `Close ${activeEvent.event_name} with ${reconciliationVarianceCount} inventory difference(s)? Inventory will be corrected to the actual counts.`
      : `Close ${activeEvent.event_name}? All actual counts match the expected inventory.`;
    if (!window.confirm(message)) return;

    setSaving(true);
    try {
      const counts = snapshots.map((row) => ({
        snapshot_id: row.id,
        actual_quantity: Number(reconcileCounts[row.id]?.actualQuantity ?? row.expected_quantity),
        reason: reconcileCounts[row.id]?.reason || null,
        notes: reconcileCounts[row.id]?.notes?.trim() || null,
      }));
      const { data, error } = await supabase.rpc("mw_close_show_event", {
        p_show_event_id: activeEvent.id,
        p_counts: counts,
        p_closed_by: activeUser || null,
      });
      if (error) throw error;
      notifications.show({
        title: "Show Closed",
        message: `${data.event_name} closed with ${data.variance_positions || 0} inventory difference(s).`,
        color: "green",
      });
      setReconcileOpen(false);
      setCart([]);
      await loadData();
    } catch (error) {
      notifications.show({ title: "Show Could Not Close", message: error.message, color: "red" });
    } finally {
      setSaving(false);
    }
  }

  async function openShowSummary(event) {
    setSummaryOpen(true);
    setSummaryLoading(true);
    setSelectedSummary(null);
    setSelectedSummaryProducts([]);
    setSelectedSummaryPayments([]);
    setSummaryProductFilter("sold");
    setSummaryProductSearch("");
    try {
      const [summaryResult, productsResult, paymentsResult] = await Promise.all([
        supabase
          .from("show_event_summary")
          .select("*")
          .eq("show_event_id", event.id)
          .maybeSingle(),
        supabase
          .from("show_product_performance")
          .select("*")
          .eq("show_event_id", event.id)
          .order("units_sold", { ascending: false })
          .order("product_revenue", { ascending: false }),
        supabase
          .from("show_payment_summary")
          .select("*")
          .eq("show_event_id", event.id)
          .order("payment_total", { ascending: false }),
      ]);
      if (summaryResult.error) throw summaryResult.error;
      if (productsResult.error) throw productsResult.error;
      if (paymentsResult.error) throw paymentsResult.error;
      setSelectedSummary(summaryResult.data);
      setSelectedSummaryProducts(productsResult.data || []);
      setSelectedSummaryPayments(paymentsResult.data || []);
    } catch (error) {
      notifications.show({ title: "Summary Could Not Load", message: error.message, color: "red" });
      setSummaryOpen(false);
    } finally {
      setSummaryLoading(false);
    }
  }

  if (loading) {
    return (
      <Stack align="center" py={80}>
        <Loader color="red" />
        <Text c="dimmed">Loading Shows & Mobile Sales…</Text>
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start">
        <Group align="flex-start">
          <Button variant="subtle" color="gray" px="xs" onClick={() => setPage("inventoryDashboard")}>
            <IconArrowLeft size={20} />
          </Button>
          <div>
            <Text size="xs" fw={900} c="red" tt="uppercase" lts={1.2}>Inventory · Mobile Operations</Text>
            <Title order={1} c="white">Shows & Mobile Sales</Title>
            <Text c="dimmed">Sell finished inventory, record payments, and maintain exact crate counts.</Text>
          </div>
        </Group>
        <Group>
          <Button variant="light" color="gray" leftSection={<IconRefresh size={18} />} onClick={loadData}>Refresh</Button>
          <Button variant="light" color="red" leftSection={<IconSettings size={18} />} onClick={openCatalogManager}>Manage Quick-Sell Catalog</Button>
          <Button color="red" leftSection={<IconPlus size={18} />} onClick={() => setCreateOpen(true)}>Create Show</Button>
        </Group>
      </Group>

      {activeEvent ? (
        <>
          <Card withBorder radius="lg" p="xl" style={{ background: "linear-gradient(135deg, rgba(112,12,18,.32), rgba(14,18,22,.98))" }}>
            <Group justify="space-between" align="flex-start">
              <div>
                <Badge color="green" variant="light" mb="xs">Active Show</Badge>
                <Title order={2} c="white">{activeEvent.event_name}</Title>
                <Text c="dimmed">{activeEvent.venue_name || "Mobile sales event"} · {dateValue(activeEvent.start_date)}–{dateValue(activeEvent.end_date)}</Text>
              </div>
              <Stack align="flex-end" gap="sm">
                <ThemeIcon color="red" size={52} radius="lg"><IconTruckDelivery size={28} /></ThemeIcon>
                <Button color="orange" variant="light" leftSection={<IconCheck size={18} />} onClick={openReconciliation}>
                  Close & Reconcile
                </Button>
              </Stack>
            </Group>
          </Card>

          <SimpleGrid cols={{ base: 2, md: 4 }}>
            {[
              ["Starting Units", startingUnits, "blue", IconShoppingCart],
              ["Units Remaining", expectedUnits, "orange", IconScan],
              ["Completed Sales", completedSales.length, "green", IconCheck],
              ["Sales Total", money(salesTotal), "red", IconCash],
            ].map(([label, value, color, Icon]) => (
              <Card key={label} withBorder radius="lg" p="lg">
                <Group justify="space-between"><Text size="sm" c="dimmed" fw={700}>{label}</Text><ThemeIcon color={color} variant="light"><Icon size={18} /></ThemeIcon></Group>
                <Text size="xl" fw={900} mt="xs">{value}</Text>
              </Card>
            ))}
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
            <Card withBorder radius="lg" p="xl">
              <Group justify="space-between" mb="md">
                <div><Title order={3} c="white">Add Products</Title><Text size="sm" c="dimmed">Choose a product by name or scan its label.</Text></div>
                <Badge color="red" variant="light">{cart.length} cart line{cart.length === 1 ? "" : "s"}</Badge>
              </Group>
              <Group align="flex-end">
                <Select
                  label="Find product by name"
                  placeholder="Search available products"
                  searchable
                  clearable
                  value={browsePositionId}
                  onChange={setBrowsePositionId}
                  data={snapshots
                    .filter((row) => Number(row.expected_quantity) > 0)
                    .map((row) => ({
                      value: row.id,
                      label: `${row.item_name}${row.bin_code ? ` · ${row.bin_code}` : ""} · ${Number(row.expected_quantity)} available`,
                    }))}
                  style={{ flex: 1 }}
                />
                <Button color="red" loading={searching} disabled={!browsePositionId} onClick={addBrowsedInventoryItem}>Add Product</Button>
              </Group>

              <Divider my="md" label="or scan a label" />

              <Group align="flex-end">
                <TextInput
                  label="QR, barcode, or item number (optional)"
                  placeholder="Scan label here"
                  leftSection={<IconScan size={18} />}
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && findInventoryItem()}
                  style={{ flex: 1 }}
                  autoFocus
                />
                <Button variant="light" color="red" loading={searching} onClick={findInventoryItem}>Add Scan</Button>
              </Group>

              <Divider my="lg" />
              {!cart.length ? (
                <Alert color="blue" icon={<IconShoppingCart size={20} />}>The sale cart is empty. Scan the first item to begin.</Alert>
              ) : (
                <Stack gap="sm">
                  {cart.map((item, index) => (
                    <Paper key={`${item.inventoryItemId}-${item.binId}`} withBorder p="md" radius="md">
                      <Group justify="space-between" align="flex-start">
                        <div><Text fw={900}>{item.itemName}</Text><Text size="xs" c="dimmed">{item.itemNumber || "No item number"} · {item.binCode || "Assigned crate"} · {item.availableQuantity} available</Text></div>
                        <Button variant="subtle" color="red" px="xs" onClick={() => setCart((current) => current.filter((_, i) => i !== index))}><IconTrash size={18} /></Button>
                      </Group>
                      <SimpleGrid cols={3} mt="sm">
                        <NumberInput label="Quantity" min={1} max={item.availableQuantity} value={item.quantity} onChange={(value) => updateCart(index, { quantity: Number(value || 1) })} />
                        <NumberInput label="Price" min={0} decimalScale={2} fixedDecimalScale prefix="$" value={item.unitPrice} onChange={(value) => updateCart(index, { unitPrice: Number(value || 0) })} />
                        <NumberInput label="Discount" min={0} decimalScale={2} fixedDecimalScale prefix="$" value={item.discountAmount} onChange={(value) => updateCart(index, { discountAmount: Number(value || 0) })} />
                      </SimpleGrid>
                    </Paper>
                  ))}
                  <Group justify="space-between" mt="sm"><Text fw={900}>Cart subtotal</Text><Text size="xl" fw={900}>{money(cartSubtotal)}</Text></Group>
                  <Button size="lg" color="green" leftSection={<IconCash size={20} />} onClick={() => setCheckoutOpen(true)}>Checkout</Button>
                </Stack>
              )}
            </Card>

            <Card withBorder radius="lg" p="xl">
              <Group justify="space-between" mb="md"><div><Title order={3} c="white">Recent Sales</Title><Text size="sm" c="dimmed">Latest transactions for this show.</Text></div><Badge variant="outline">{sales.length}</Badge></Group>
              {!sales.length ? <Alert color="gray">No sales have been recorded yet.</Alert> : (
                <Table.ScrollContainer minWidth={560}>
                  <Table striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Sale</Table.Th>
                        <Table.Th>Time</Table.Th>
                        <Table.Th>Status</Table.Th>
                        <Table.Th>Payment</Table.Th>
                        <Table.Th ta="right">Total</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {sales.map((sale) => {
                        const voided = sale.sale_status === "Voided";
                        return (
                          <Table.Tr key={sale.id} opacity={voided ? 0.72 : 1}>
                            <Table.Td>
                              <Text fw={800} size="sm" td={voided ? "line-through" : undefined}>
                                {sale.sale_number}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              {new Date(sale.sold_at).toLocaleTimeString([], {
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </Table.Td>
                            <Table.Td>
                              <Badge
                                color={
                                  voided
                                    ? "red"
                                    : sale.sale_status === "Refunded"
                                    ? "orange"
                                    : "green"
                                }
                                variant="light"
                              >
                                {sale.sale_status}
                              </Badge>
                            </Table.Td>
                            <Table.Td>
                              <Badge variant="light" color={voided ? "gray" : "blue"}>
                                {sale.payment_method}
                              </Badge>
                            </Table.Td>
                            <Table.Td ta="right">
                              <Text fw={800} td={voided ? "line-through" : undefined} c={voided ? "dimmed" : undefined}>
                                {money(sale.total_amount)}
                              </Text>
                            </Table.Td>
                          </Table.Tr>
                        );
                      })}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              )}
            </Card>
          </SimpleGrid>
        </>
      ) : (
        <Alert color="orange" icon={<IconCalendarEvent size={22} />} title="No active show">
          Create a show below, then select Start Show to capture the current inventory in every crate.
        </Alert>
      )}

      <Card withBorder radius="lg" p="xl">
        <Group justify="space-between" mb="md"><div><Title order={3} c="white">Show Events</Title><Text size="sm" c="dimmed">Upcoming, active, and previous mobile sales events.</Text></div><Badge variant="outline">{events.length}</Badge></Group>
        {!events.length ? <Text c="dimmed">No shows have been created.</Text> : (
          <Table.ScrollContainer minWidth={760}>
            <Table striped highlightOnHover>
              <Table.Thead><Table.Tr><Table.Th>Show</Table.Th><Table.Th>Dates</Table.Th><Table.Th>Status</Table.Th><Table.Th>Created By</Table.Th><Table.Th ta="right">Action</Table.Th></Table.Tr></Table.Thead>
              <Table.Tbody>
                {events.map((event) => (
                  <Table.Tr key={event.id}>
                    <Table.Td>
                      <Text fw={900}>{event.event_name}</Text>
                      <Text size="xs" c="dimmed">{event.venue_name || event.event_code}</Text>
                    </Table.Td>
                    <Table.Td>{dateValue(event.start_date)}–{dateValue(event.end_date)}</Table.Td>
                    <Table.Td>
                      <Badge color={event.status === "Active" ? "green" : event.status === "Closed" ? "gray" : "blue"} variant="light">
                        {event.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{event.created_by || "—"}</Table.Td>
                    <Table.Td ta="right">
                      {event.status === "Draft" && (
                        <Button size="xs" color="green" loading={saving} onClick={() => startEvent(event)}>Start Show</Button>
                      )}
                      {event.status === "Closed" && (
                        <Button size="xs" color="red" variant="light" onClick={() => openShowSummary(event)}>View Summary</Button>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Card>

      <Card withBorder radius="lg" p="xl">
        <Group justify="space-between" mb="md">
          <div>
            <Title order={3} c="white">Show Performance Trends</Title>
            <Text size="sm" c="dimmed">Compare closed shows and identify repeat best sellers.</Text>
          </div>
          <Badge color="red" variant="light">
            {showSummaries.filter((row) => row.status === "Closed").length} closed show{showSummaries.filter((row) => row.status === "Closed").length === 1 ? "" : "s"}
          </Badge>
        </Group>

        <Title order={4} c="white" mb="sm">Show Comparison</Title>
        <Table.ScrollContainer minWidth={820}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Show</Table.Th>
                <Table.Th ta="right">Sales</Table.Th>
                <Table.Th ta="right">Units</Table.Th>
                <Table.Th ta="right">Average Sale</Table.Th>
                <Table.Th ta="right">Voided</Table.Th>
                <Table.Th ta="right">Sell-through</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {showSummaries.filter((row) => row.status === "Closed").map((row) => {
                const sellThrough = Number(row.starting_units) > 0
                  ? (Number(row.units_sold) / Number(row.starting_units)) * 100
                  : 0;
                return (
                  <Table.Tr key={row.show_event_id}>
                    <Table.Td><Text fw={900}>{row.event_name}</Text><Text size="xs" c="dimmed">{dateValue(row.start_date)}</Text></Table.Td>
                    <Table.Td ta="right"><Text fw={800}>{money(row.gross_sales)}</Text></Table.Td>
                    <Table.Td ta="right">{Number(row.units_sold)}</Table.Td>
                    <Table.Td ta="right">{money(row.average_sale)}</Table.Td>
                    <Table.Td ta="right">{Number(row.voided_sales)}</Table.Td>
                    <Table.Td ta="right"><Badge color={sellThrough >= 50 ? "green" : sellThrough > 0 ? "orange" : "gray"} variant="light">{sellThrough.toFixed(1)}%</Badge></Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>

        <Divider my="xl" />
        <Title order={4} c="white" mb="sm">Best Sellers Across All Shows</Title>
        {!productTrends.length ? (
          <Alert color="gray">Best-seller trends will appear after the first completed show sale.</Alert>
        ) : (
          <Table.ScrollContainer minWidth={760}>
            <Table striped highlightOnHover>
              <Table.Thead><Table.Tr><Table.Th>Product</Table.Th><Table.Th ta="right">Shows</Table.Th><Table.Th ta="right">Units Sold</Table.Th><Table.Th ta="right">Revenue</Table.Th><Table.Th ta="right">Sell-through</Table.Th></Table.Tr></Table.Thead>
              <Table.Tbody>
                {productTrends.slice(0, 20).map((row, index) => (
                  <Table.Tr key={row.inventoryItemId}>
                    <Table.Td><Group gap="sm"><Badge color={index < 3 ? "red" : "gray"} circle>{index + 1}</Badge><div><Text fw={900}>{row.itemName}</Text><Text size="xs" c="dimmed">{row.itemNumber || "No item number"}</Text></div></Group></Table.Td>
                    <Table.Td ta="right">{row.shows}</Table.Td>
                    <Table.Td ta="right"><Text fw={900}>{row.unitsSold}</Text></Table.Td>
                    <Table.Td ta="right">{money(row.revenue)}</Table.Td>
                    <Table.Td ta="right"><Badge color={row.sellThrough >= 50 ? "green" : "orange"} variant="light">{row.sellThrough.toFixed(1)}%</Badge></Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Card>

      <Modal
        opened={summaryOpen}
        onClose={() => setSummaryOpen(false)}
        title={<Text fw={900} c="white">Post-Show Performance Summary</Text>}
        fullScreen
        zIndex={10000}
        styles={{
          header: {
            background: "#17191c",
            borderBottom: "1px solid rgba(255,255,255,.12)",
          },
          body: {
            background: "#111316",
            minHeight: "calc(100vh - 60px)",
            padding: "24px",
          },
          content: {
            background: "#111316",
          },
        }}
      >
        {summaryLoading ? (
          <Stack align="center" py={60}><Loader color="red" /><Text c="dimmed">Building show summary…</Text></Stack>
        ) : selectedSummary ? (
          <Stack gap="lg">
            <Paper withBorder p="lg" radius="lg">
              <Group justify="space-between" align="flex-start">
                <div>
                  <Badge color="gray" variant="light" mb="xs">Closed Show</Badge>
                  <Title order={2} c="white">{selectedSummary.event_name}</Title>
                  <Text c="dimmed">{selectedSummary.venue_name || "Mobile sales event"} · {dateValue(selectedSummary.start_date)}–{dateValue(selectedSummary.end_date)}</Text>
                </div>
                <Text size="xl" fw={900} c="green">{money(selectedSummary.gross_sales)}</Text>
              </Group>
            </Paper>

            <SimpleGrid cols={{ base: 2, md: 4 }}>
              {[
                ["Valid Sales", Number(selectedSummary.completed_sales), "green"],
                ["Units Sold", Number(selectedSummary.units_sold), "blue"],
                ["Average Sale", money(selectedSummary.average_sale), "orange"],
                ["Voided Sales", Number(selectedSummary.voided_sales), "red"],
              ].map(([label, value, color]) => (
                <Paper key={label} withBorder p="md" radius="md">
                  <Text size="xs" c="dimmed" fw={800}>{label.toUpperCase()}</Text>
                  <Text size="xl" fw={900} c={color}>{value}</Text>
                </Paper>
              ))}
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, md: 2 }}>
              <Card withBorder radius="lg" p="lg">
                <Title order={4} c="white" mb="md">Inventory Results</Title>
                <Stack gap="xs">
                  <Group justify="space-between"><Text c="dimmed">Starting units</Text><Text fw={800}>{Number(selectedSummary.starting_units)}</Text></Group>
                  <Group justify="space-between"><Text c="dimmed">Units sold</Text><Text fw={800}>{Number(selectedSummary.units_sold)}</Text></Group>
                  <Group justify="space-between"><Text c="dimmed">Actual ending units</Text><Text fw={800}>{Number(selectedSummary.actual_ending_units)}</Text></Group>
                  <Group justify="space-between"><Text c="dimmed">Inventory variance</Text><Text fw={800} c={Number(selectedSummary.variance_units) ? "orange" : "green"}>{Number(selectedSummary.variance_units)}</Text></Group>
                  <Group justify="space-between"><Text c="dimmed">Damage</Text><Text fw={800}>{Number(selectedSummary.damaged_units)}</Text></Group>
                  <Group justify="space-between"><Text c="dimmed">Missing</Text><Text fw={800}>{Number(selectedSummary.missing_units)}</Text></Group>
                  <Group justify="space-between"><Text c="dimmed">Giveaways</Text><Text fw={800}>{Number(selectedSummary.giveaway_units)}</Text></Group>
                </Stack>
              </Card>
              <Card withBorder radius="lg" p="lg">
                <Title order={4} c="white" mb="md">Financial Results</Title>
                <Stack gap="xs">
                  <Group justify="space-between"><Text c="dimmed">Collected sales</Text><Text fw={800}>{money(selectedSummary.gross_sales)}</Text></Group>
                  <Group justify="space-between"><Text c="dimmed">Product sales</Text><Text fw={800}>{money(selectedSummary.product_sales)}</Text></Group>
                  <Group justify="space-between"><Text c="dimmed">Discounts</Text><Text fw={800}>{money(selectedSummary.discount_total)}</Text></Group>
                  <Group justify="space-between"><Text c="dimmed">Sales tax</Text><Text fw={800}>{money(selectedSummary.tax_total)}</Text></Group>
                  <Divider my="xs" />
                  {selectedSummaryPayments.length ? selectedSummaryPayments.map((payment) => (
                    <Group justify="space-between" key={payment.payment_method}>
                      <Text c="dimmed">{payment.payment_method} ({payment.payment_count})</Text>
                      <Text fw={800}>{money(payment.payment_total)}</Text>
                    </Group>
                  )) : <Text c="dimmed" size="sm">No completed payments.</Text>}
                </Stack>
              </Card>
            </SimpleGrid>

            <Card withBorder radius="lg" p="lg">
              <Group justify="space-between" mb="md" align="flex-start">
                <div><Title order={4} c="white">Product Performance</Title><Text size="sm" c="dimmed">What sold, what remained, and each product's sell-through.</Text></div>
                <Badge variant="outline">{filteredSummaryProducts.length} shown</Badge>
              </Group>
              <SimpleGrid cols={{ base: 1, md: 2 }} mb="md">
                <Select
                  label="Products to display"
                  value={summaryProductFilter}
                  onChange={(value) => setSummaryProductFilter(value || "sold")}
                  comboboxProps={{ withinPortal: true, zIndex: 11000 }}
                  data={[
                    { value: "sold", label: "Products Sold" },
                    { value: "unsold", label: "Products Not Sold" },
                    { value: "all", label: "All Products" },
                  ]}
                />
                <TextInput
                  label="Search this report"
                  placeholder="Product name or item number"
                  value={summaryProductSearch}
                  onChange={(event) => setSummaryProductSearch(event.target.value)}
                />
              </SimpleGrid>
              {!filteredSummaryProducts.length ? (
                <Alert color="gray">
                  {summaryProductFilter === "sold"
                    ? "No products were sold during this show."
                    : "No products match this report filter."}
                </Alert>
              ) : (
              <Table.ScrollContainer minWidth={680}>
                <Table striped highlightOnHover>
                  <Table.Thead><Table.Tr><Table.Th>Product</Table.Th><Table.Th ta="right">Started</Table.Th><Table.Th ta="right">Sold</Table.Th><Table.Th ta="right">Ended</Table.Th><Table.Th ta="right">Revenue</Table.Th><Table.Th ta="right">Sell-through</Table.Th></Table.Tr></Table.Thead>
                  <Table.Tbody>
                    {filteredSummaryProducts.map((product) => (
                      <Table.Tr key={product.inventory_item_id}>
                        <Table.Td><Text fw={900}>{product.item_name}</Text><Text size="xs" c="dimmed">{product.item_number || "No item number"}</Text></Table.Td>
                        <Table.Td ta="right">{Number(product.starting_quantity)}</Table.Td>
                        <Table.Td ta="right"><Text fw={900} c={Number(product.units_sold) ? "green" : "dimmed"}>{Number(product.units_sold)}</Text></Table.Td>
                        <Table.Td ta="right">{Number(product.actual_ending_quantity)}</Table.Td>
                        <Table.Td ta="right">{money(product.product_revenue)}</Table.Td>
                        <Table.Td ta="right"><Badge color={Number(product.sell_through_percent) >= 50 ? "green" : Number(product.sell_through_percent) > 0 ? "orange" : "gray"} variant="light">{Number(product.sell_through_percent).toFixed(1)}%</Badge></Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
              )}
            </Card>

            <Group justify="flex-end"><Button color="red" onClick={() => setSummaryOpen(false)}>Close Summary</Button></Group>
          </Stack>
        ) : null}
      </Modal>

      <Modal opened={createOpen} onClose={() => setCreateOpen(false)} title={<Text fw={900} c="white">Create Show Event</Text>} size="lg" centered>
        <Stack>
          <TextInput label="Show name" required value={eventForm.eventName} onChange={(event) => setEventForm((current) => ({ ...current, eventName: event.target.value }))} />
          <TextInput label="Venue" value={eventForm.venueName} onChange={(event) => setEventForm((current) => ({ ...current, venueName: event.target.value }))} />
          <TextInput label="Address" value={eventForm.address} onChange={(event) => setEventForm((current) => ({ ...current, address: event.target.value }))} />
          <Group grow><TextInput label="City" value={eventForm.city} onChange={(event) => setEventForm((current) => ({ ...current, city: event.target.value }))} /><TextInput label="State" value={eventForm.state} onChange={(event) => setEventForm((current) => ({ ...current, state: event.target.value }))} /></Group>
          <Group grow><DateInput label="Start date" required value={eventForm.startDate} onChange={(value) => setEventForm((current) => ({ ...current, startDate: value }))} /><DateInput label="End date" required value={eventForm.endDate} onChange={(value) => setEventForm((current) => ({ ...current, endDate: value }))} /></Group>
          <NumberInput label="Starting cash drawer" min={0} decimalScale={2} fixedDecimalScale prefix="$" value={eventForm.startingCash} onChange={(value) => setEventForm((current) => ({ ...current, startingCash: Number(value || 0) }))} />
          <Textarea label="Notes" minRows={3} value={eventForm.notes} onChange={(event) => setEventForm((current) => ({ ...current, notes: event.target.value }))} />
          <Group justify="flex-end"><Button variant="default" onClick={() => setCreateOpen(false)}>Cancel</Button><Button color="red" loading={saving} onClick={createEvent}>Create Show</Button></Group>
        </Stack>
      </Modal>

      <Modal
        opened={catalogManagerOpen}
        onClose={() => setCatalogManagerOpen(false)}
        title={<Text fw={900} c="white">Manage Show Quick-Sell Catalog</Text>}
        fullScreen
        zIndex={10000}
        styles={{
          header: {
            background: "#17191c",
            borderBottom: "1px solid rgba(255,255,255,.12)",
          },
          body: {
            background: "#111316",
            minHeight: "calc(100vh - 60px)",
            padding: "24px",
          },
          content: {
            background: "#111316",
          },
        }}
      >
        <Stack>
          <Alert color="blue" icon={<IconSettings size={20} />}>
            Enable only finished products that employees should sell at shows. A category is required before a product can be enabled.
          </Alert>

          <SimpleGrid cols={{ base: 1, md: 3 }}>
            <TextInput
              label="Find product"
              placeholder="Search name, item number, or SKU"
              value={catalogSearch}
              onChange={(event) => setCatalogSearch(event.target.value)}
            />
            <Select
              label="Show category"
              value={catalogCategoryFilter}
              onChange={(value) => setCatalogCategoryFilter(value || "all")}
              comboboxProps={{ withinPortal: true, zIndex: 11000 }}
              data={[
                { value: "all", label: "All categories" },
                ...SHOW_CATEGORIES.map((category) => ({ value: category, label: category })),
              ]}
            />
            <Select
              label="Catalog status"
              value={catalogStatusFilter}
              onChange={(value) => setCatalogStatusFilter(value || "all")}
              comboboxProps={{ withinPortal: true, zIndex: 11000 }}
              data={[
                { value: "all", label: "All products" },
                { value: "enabled", label: "Enabled for Quick-Sell" },
                { value: "disabled", label: "Hidden from Quick-Sell" },
                { value: "uncategorized", label: "Needs a category" },
              ]}
            />
          </SimpleGrid>

          <Group justify="space-between">
            <Group>
              <Badge color="red" variant="light">{catalogItems.filter((item) => item.available_for_show_sales).length} enabled</Badge>
              <Badge color="gray" variant="light">{filteredCatalogItems.length} displayed</Badge>
              <Badge color={selectedCatalogIds.length ? "blue" : "gray"} variant="light">{selectedCatalogIds.length} selected</Badge>
            </Group>
            <Text size="sm" c="dimmed">Show price is optional; leave it blank to use the normal selling price.</Text>
          </Group>

          <Paper withBorder p="md" radius="md">
            <Group justify="space-between" align="flex-end">
              <Group align="flex-end">
                <Button
                  variant="light"
                  color="blue"
                  disabled={!filteredCatalogItems.length}
                  onClick={() => toggleAllDisplayedCatalogItems(true)}
                >
                  Select All Displayed ({filteredCatalogItems.length})
                </Button>
                <Button
                  variant="subtle"
                  color="gray"
                  disabled={!selectedCatalogIds.length}
                  onClick={() => setSelectedCatalogIds([])}
                >
                  Clear Selection
                </Button>
              </Group>
              <Group align="flex-end">
                <Select
                  label="Assign selected products to"
                  placeholder="Choose category"
                  searchable
                  data={SHOW_CATEGORIES}
                  value={bulkCatalogCategory}
                  onChange={setBulkCatalogCategory}
                  comboboxProps={{ withinPortal: true, zIndex: 11000 }}
                  w={230}
                />
                <Button
                  color="red"
                  disabled={!selectedCatalogIds.length || !bulkCatalogCategory}
                  loading={bulkCatalogSaving}
                  onClick={applyBulkCatalogCategory}
                >
                  Apply to {selectedCatalogIds.length || 0}
                </Button>
              </Group>
            </Group>
          </Paper>

          {catalogLoading ? (
            <Stack align="center" py={60}><Loader color="red" /><Text c="dimmed">Loading inventory catalog…</Text></Stack>
          ) : !filteredCatalogItems.length ? (
            <Alert color="gray">No inventory products match these filters.</Alert>
          ) : (
            <Table.ScrollContainer minWidth={1100} style={{ maxHeight: "58vh", overflowY: "auto" }}>
              <Table striped highlightOnHover stickyHeader>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>
                      <Checkbox
                        aria-label="Select all displayed products"
                        checked={filteredCatalogItems.length > 0 && filteredCatalogItems.every((item) => selectedCatalogIds.includes(item.id))}
                        indeterminate={filteredCatalogItems.some((item) => selectedCatalogIds.includes(item.id)) && !filteredCatalogItems.every((item) => selectedCatalogIds.includes(item.id))}
                        onChange={(event) => toggleAllDisplayedCatalogItems(event.currentTarget.checked)}
                      />
                    </Table.Th>
                    <Table.Th>Product</Table.Th>
                    <Table.Th>Quick-Sell</Table.Th>
                    <Table.Th>Show Category</Table.Th>
                    <Table.Th ta="right">Regular Price</Table.Th>
                    <Table.Th>Show Price</Table.Th>
                    <Table.Th>Order</Table.Th>
                    <Table.Th>Favorite</Table.Th>
                    <Table.Th ta="right">Action</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredCatalogItems.map((item) => (
                    <Table.Tr key={item.id}>
                      <Table.Td>
                        <Checkbox
                          aria-label={`Select ${item.name}`}
                          checked={selectedCatalogIds.includes(item.id)}
                          onChange={(event) => toggleCatalogSelection(item.id, event.currentTarget.checked)}
                        />
                      </Table.Td>
                      <Table.Td>
                        <Text fw={900}>{item.name}</Text>
                        <Text size="xs" c="dimmed">{item.item_number || "No item number"}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Switch
                          checked={item.available_for_show_sales}
                          color="red"
                          aria-label={`Enable ${item.name} for Quick-Sell`}
                          onChange={(event) => updateCatalogDraft(item.id, { available_for_show_sales: event.currentTarget.checked })}
                        />
                      </Table.Td>
                      <Table.Td>
                        <Select
                          placeholder="Choose category"
                          searchable
                          clearable
                          data={SHOW_CATEGORIES}
                          value={item.show_category || null}
                          onChange={(value) => updateCatalogDraft(item.id, { show_category: value || null })}
                          comboboxProps={{ withinPortal: true, zIndex: 11000 }}
                          w={180}
                        />
                      </Table.Td>
                      <Table.Td ta="right">{money(item.selling_price || item.retail_price || item.unit_price || 0)}</Table.Td>
                      <Table.Td>
                        <NumberInput
                          placeholder="Use regular"
                          min={0}
                          decimalScale={2}
                          fixedDecimalScale
                          prefix="$"
                          value={item.show_price ?? ""}
                          onChange={(value) => updateCatalogDraft(item.id, { show_price: value })}
                          w={135}
                        />
                      </Table.Td>
                      <Table.Td>
                        <NumberInput
                          min={0}
                          value={item.show_display_order}
                          onChange={(value) => updateCatalogDraft(item.id, { show_display_order: Number(value ?? 1000) })}
                          w={90}
                        />
                      </Table.Td>
                      <Table.Td>
                        <Switch
                          checked={item.show_featured}
                          color="yellow"
                          thumbIcon={item.show_featured ? <IconStar size={12} fill="currentColor" /> : null}
                          aria-label={`Feature ${item.name}`}
                          onChange={(event) => updateCatalogDraft(item.id, { show_featured: event.currentTarget.checked })}
                        />
                      </Table.Td>
                      <Table.Td ta="right">
                        <Button
                          size="xs"
                          color="red"
                          loading={catalogSavingId === item.id}
                          onClick={() => saveCatalogItem(item)}
                        >
                          Save
                        </Button>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )}

          <Group justify="flex-end">
            <Button variant="default" onClick={() => setCatalogManagerOpen(false)}>Close Catalog Manager</Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={checkoutOpen} onClose={() => setCheckoutOpen(false)} title={<Text fw={900} c="white">Complete Show Sale</Text>} size="lg" centered>
        <Stack>
          <Paper withBorder p="md" radius="md"><Group justify="space-between"><Text fw={900}>Sale total</Text><Text size="xl" fw={900} c="green">{money(checkoutTotal)}</Text></Group></Paper>
          <Select label="Payment method" required data={PAYMENT_METHODS} value={checkout.paymentMethod} onChange={(value) => setCheckout((current) => ({ ...current, paymentMethod: value || "Cash" }))} />
          <Group grow><NumberInput label="Sale discount" min={0} decimalScale={2} fixedDecimalScale prefix="$" value={checkout.saleDiscount} onChange={(value) => setCheckout((current) => ({ ...current, saleDiscount: Number(value || 0) }))} /><NumberInput label="Sales tax" min={0} decimalScale={2} fixedDecimalScale prefix="$" value={checkout.taxAmount} onChange={(value) => setCheckout((current) => ({ ...current, taxAmount: Number(value || 0) }))} /></Group>
          {checkout.paymentMethod === "Cash" && <NumberInput label="Cash tendered" min={0} decimalScale={2} fixedDecimalScale prefix="$" value={checkout.amountTendered} onChange={(value) => setCheckout((current) => ({ ...current, amountTendered: value }))} />}
          <TextInput label="Payment reference" value={checkout.paymentReference} onChange={(event) => setCheckout((current) => ({ ...current, paymentReference: event.target.value }))} />
          <Divider label="Optional customer information" />
          <TextInput label="Customer name" value={checkout.customerName} onChange={(event) => setCheckout((current) => ({ ...current, customerName: event.target.value }))} />
          <Group grow><TextInput label="Email" value={checkout.customerEmail} onChange={(event) => setCheckout((current) => ({ ...current, customerEmail: event.target.value }))} /><TextInput label="Phone" value={checkout.customerPhone} onChange={(event) => setCheckout((current) => ({ ...current, customerPhone: event.target.value }))} /></Group>
          <Textarea label="Sale notes" value={checkout.notes} onChange={(event) => setCheckout((current) => ({ ...current, notes: event.target.value }))} />
          <Group justify="flex-end"><Button variant="default" onClick={() => setCheckoutOpen(false)}>Back to Cart</Button><Button color="green" loading={saving} leftSection={<IconCheck size={18} />} onClick={completeSale}>Complete {money(checkoutTotal)} Sale</Button></Group>
        </Stack>
      </Modal>

      <Modal
        opened={reconcileOpen}
        onClose={() => setReconcileOpen(false)}
        title={<Text fw={900} c="white">Close & Reconcile Show</Text>}
        size="xl"
        centered
      >
        <Stack>
          <Alert color="blue" icon={<IconCheck size={20} />}>
            Actual quantities default to the expected remaining inventory. Change only products whose physical count is different.
          </Alert>

          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <Paper withBorder p="md" radius="md">
              <Text size="xs" c="dimmed" fw={800}>POSITIONS TO COUNT</Text>
              <Text size="xl" fw={900}>{snapshots.length}</Text>
            </Paper>
            <Paper withBorder p="md" radius="md">
              <Text size="xs" c="dimmed" fw={800}>EXPECTED UNITS</Text>
              <Text size="xl" fw={900}>{expectedUnits}</Text>
            </Paper>
            <Paper withBorder p="md" radius="md">
              <Text size="xs" c="dimmed" fw={800}>DIFFERENCES</Text>
              <Text size="xl" fw={900} c={reconciliationVarianceCount ? "orange" : "green"}>{reconciliationVarianceCount}</Text>
            </Paper>
          </SimpleGrid>

          <TextInput
            label="Search products or crates"
            placeholder="Search by product, item number, or crate"
            value={reconcileSearch}
            onChange={(event) => setReconcileSearch(event.target.value)}
          />

          <Stack gap="sm" style={{ maxHeight: 430, overflowY: "auto", paddingRight: 6 }}>
            {filteredReconciliationSnapshots.map((row) => {
              const count = reconcileCounts[row.id] || {
                actualQuantity: Number(row.expected_quantity),
                reason: "",
                notes: "",
              };
              const variance = Number(count.actualQuantity) - Number(row.expected_quantity);
              return (
                <Paper key={row.id} withBorder p="md" radius="md">
                  <Group justify="space-between" align="flex-start" mb="sm">
                    <div>
                      <Text fw={900}>{row.item_name}</Text>
                      <Text size="xs" c="dimmed">
                        {row.item_number || "No item number"} · {row.bin_code || "Assigned crate"}
                      </Text>
                    </div>
                    <Badge color={variance === 0 ? "green" : variance < 0 ? "red" : "orange"} variant="light">
                      {variance === 0 ? "Matches" : variance < 0 ? `${Math.abs(variance)} short` : `${variance} over`}
                    </Badge>
                  </Group>
                  <SimpleGrid cols={{ base: 1, sm: variance === 0 ? 2 : 3 }}>
                    <NumberInput label="Expected" value={Number(row.expected_quantity)} disabled />
                    <NumberInput
                      label="Actual count"
                      min={0}
                      value={count.actualQuantity}
                      onChange={(value) =>
                        updateReconciliationCount(row.id, {
                          actualQuantity: Number(value ?? 0),
                        })
                      }
                    />
                    {variance !== 0 && (
                      <Select
                        label="Difference reason"
                        required
                        placeholder="Choose reason"
                        data={[
                          "Damaged",
                          "Missing",
                          "Giveaway",
                          "Unrecorded Sale",
                          "Starting Count Incorrect",
                          "Returned or Refunded",
                          "Count Correction",
                        ]}
                        value={count.reason}
                        onChange={(value) => updateReconciliationCount(row.id, { reason: value || "" })}
                      />
                    )}
                  </SimpleGrid>
                  {variance !== 0 && (
                    <TextInput
                      mt="sm"
                      label="Difference notes"
                      placeholder="Optional explanation"
                      value={count.notes}
                      onChange={(event) => updateReconciliationCount(row.id, { notes: event.target.value })}
                    />
                  )}
                </Paper>
              );
            })}
          </Stack>

          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              Closing creates permanent corrections only for inventory differences.
            </Text>
            <Group>
              <Button variant="default" onClick={() => setReconcileOpen(false)}>Keep Show Open</Button>
              <Button color="orange" loading={saving} onClick={closeAndReconcileShow}>Close & Reconcile Show</Button>
            </Group>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

export default ShowSales;
