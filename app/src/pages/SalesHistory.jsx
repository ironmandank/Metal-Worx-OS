import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Group,
  Image,
  Modal,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconArchive,
  IconEdit,
  IconEye,
  IconHistory,
  IconPhoto,
  IconSearch,
  IconRestore,
  IconTrash,
} from "@tabler/icons-react";

import MWPageHeader from "../components/ui/MWPageHeader";
import MWSection from "../components/ui/MWSection";
import { useProjectMoneyPrivacy } from "../components/ProjectMoneyPrivacy";
import { supabase } from "../lib/supabase";

function customerName(order, customersById) {
  if (order.artwork_customer_name?.trim()) return order.artwork_customer_name.trim();
  const customer = customersById[String(order.customer_id)];
  if (!customer) return "Customer not recorded";
  return (
    customer.company_name ||
    `${customer.first_name || ""} ${customer.last_name || ""}`.trim() ||
    "Customer not recorded"
  );
}

function itemNames(orderId, itemsByOrderId) {
  const names = (itemsByOrderId[String(orderId)] || [])
    .map((item) => item.item_name || item.description || item.notes)
    .filter(Boolean);
  return names.length ? [...new Set(names)].join(", ") : "Order items not described";
}

function historyDate(order) {
  return order.completed_at || order.archived_at || order.updated_at || order.order_date || order.created_at;
}

function formatDate(value) {
  if (!value) return "Date not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date not recorded";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function displayStatus(order) {
  return order.archived_at || order.status === "Archived" ? "Archived" : "Completed";
}

export default function SalesHistory({ setPage, setSelectedCustomerOrder, activeUser }) {
  const [orders, setOrders] = useState([]);
  const [customersById, setCustomersById] = useState({});
  const [itemsByOrderId, setItemsByOrderId] = useState({});
  const [imagesByOrderId, setImagesByOrderId] = useState({});
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [visibilityFilter, setVisibilityFilter] = useState("Sales History");
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [priceDraft, setPriceDraft] = useState(0);
  const [saving, setSaving] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const moneyPrivacy = useProjectMoneyPrivacy(activeUser);

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    setLoading(true);
    try {
      const { data: orderRows = [], error: orderError } = await supabase
        .from("customer_orders")
        .select("*")
        .or("status.in.(Completed,Archived),archived_at.not.is.null")
        .order("updated_at", { ascending: false });
      if (orderError) throw orderError;

      const orderIds = orderRows.map((order) => order.id).filter(Boolean);
      const customerIds = [...new Set(orderRows.map((order) => order.customer_id).filter(Boolean))];
      const [itemsResult, customersResult, imagesResult] = await Promise.all([
        orderIds.length
          ? supabase.from("customer_order_items").select("*").in("order_id", orderIds)
          : Promise.resolve({ data: [], error: null }),
        customerIds.length
          ? supabase.from("customers").select("*").in("id", customerIds)
          : Promise.resolve({ data: [], error: null }),
        orderIds.length
          ? supabase
              .from("customer_order_reference_images")
              .select("*")
              .in("customer_order_id", orderIds)
              .order("sort_order", { ascending: true })
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (itemsResult.error) throw itemsResult.error;
      if (customersResult.error) throw customersResult.error;
      if (imagesResult.error) throw imagesResult.error;

      setOrders(orderRows);
      setCustomersById(Object.fromEntries((customersResult.data || []).map((row) => [String(row.id), row])));
      setItemsByOrderId((itemsResult.data || []).reduce((groups, item) => {
        const key = String(item.order_id);
        groups[key] = groups[key] || [];
        groups[key].push(item);
        return groups;
      }, {}));
      setImagesByOrderId((imagesResult.data || []).reduce((groups, image) => {
        const key = String(image.customer_order_id);
        groups[key] = groups[key] || [];
        groups[key].push(image);
        return groups;
      }, {}));
    } catch (error) {
      notifications.show({
        title: "Sales History Could Not Load",
        message: error?.message || "Please refresh and try again.",
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  }

  const visibleOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    return orders.filter((order) => {
      const removed = Boolean(order.sales_history_hidden);
      if (visibilityFilter === "Sales History" && removed) return false;
      if (visibilityFilter === "Removed" && !removed) return false;
      if (statusFilter !== "All" && displayStatus(order) !== statusFilter) return false;
      if (!term) return true;
      return [
        customerName(order, customersById),
        itemNames(order.id, itemsByOrderId),
        order.order_number,
        order.title,
        order.description,
        order.notes,
        String(order.total_amount ?? ""),
      ].some((value) => String(value || "").toLowerCase().includes(term));
    });
  }, [customersById, itemsByOrderId, orders, search, statusFilter, visibilityFilter]);

  const recordedPriceCount = visibleOrders.filter((order) => Number(order.total_amount || 0) > 0).length;
  const visibleTotal = visibleOrders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0);

  const artworkReportEnd = new Date();
  const artworkReportStart = new Date(
    artworkReportEnd.getTime() - 30 * 24 * 60 * 60 * 1000
  );
  const artworkReportOrders = orders
    .filter((order) => {
      if (
        order.order_type !== "Custom Artwork" ||
        order.status !== "Completed" ||
        !order.fulfillment_completed ||
        !order.fulfilled_at
      ) return false;

      const fulfilledAt = new Date(order.fulfilled_at);
      return (
        !Number.isNaN(fulfilledAt.getTime()) &&
        fulfilledAt >= artworkReportStart &&
        fulfilledAt <= artworkReportEnd
      );
    })
    .sort((a, b) => new Date(b.fulfilled_at) - new Date(a.fulfilled_at));
  const artworkReportTotal = artworkReportOrders.reduce(
    (sum, order) => sum + Number(order.total_amount || 0),
    0
  );
  const artworkReportMissingPriceCount = artworkReportOrders.filter(
    (order) => Number(order.total_amount || 0) <= 0
  ).length;

  function openOrder(order) {
    setSelectedCustomerOrder(order);
    setPage("customerOrderDetails");
  }

  function beginPriceEdit(order) {
    if (!moneyPrivacy.unlocked) {
      moneyPrivacy.requestUnlock();
      return;
    }
    setEditingId(order.id);
    setPriceDraft(Number(order.total_amount || 0));
  }

  async function savePrice(order) {
    if (!moneyPrivacy.unlocked || saving) return;
    setSaving(true);
    const nextPrice = Number(priceDraft || 0);
    const { error } = await supabase
      .from("customer_orders")
      .update({ total_amount: nextPrice, updated_at: new Date().toISOString() })
      .eq("id", order.id);
    setSaving(false);
    if (error) {
      notifications.show({ title: "Price Was Not Saved", message: error.message, color: "red" });
      return;
    }
    setOrders((current) => current.map((row) => row.id === order.id ? { ...row, total_amount: nextPrice } : row));
    setEditingId(null);
    notifications.show({ title: "Final Sale Price Saved", message: "The permanent order history has been updated.", color: "green" });
  }

  async function setHistoryVisibility(orderIds, hidden) {
    if (!orderIds.length || saving) return;
    const action = hidden ? "remove" : "restore";
    const label = orderIds.length === 1 ? "this order" : `${orderIds.length} selected orders`;
    if (!window.confirm(
      hidden
        ? `Remove ${label} from Sales History? The original order will be preserved and can be restored later.`
        : `Restore ${label} to Sales History?`
    )) return;

    setSaving(true);
    const { error } = await supabase
      .from("customer_orders")
      .update({
        sales_history_hidden: hidden,
        sales_history_hidden_at: hidden ? new Date().toISOString() : null,
        sales_history_hidden_by: hidden ? (activeUser || "Employee") : null,
      })
      .in("id", orderIds);
    setSaving(false);
    if (error) {
      notifications.show({
        title: `Orders Could Not Be ${hidden ? "Removed" : "Restored"}`,
        message: error.message,
        color: "red",
      });
      return;
    }
    setOrders((current) => current.map((order) => orderIds.includes(order.id)
      ? {
          ...order,
          sales_history_hidden: hidden,
          sales_history_hidden_at: hidden ? new Date().toISOString() : null,
          sales_history_hidden_by: hidden ? (activeUser || "Employee") : null,
        }
      : order));
    setSelectedIds([]);
    notifications.show({
      title: hidden ? "Removed from Sales History" : "Restored to Sales History",
      message: `${orderIds.length} order${orderIds.length === 1 ? " was" : "s were"} ${action}d. The original order record was not deleted.`,
      color: hidden ? "orange" : "green",
    });
  }

  const allVisibleSelected = visibleOrders.length > 0 && visibleOrders.every((order) => selectedIds.includes(order.id));

  function toggleAllVisible() {
    if (allVisibleSelected) {
      const visibleIds = new Set(visibleOrders.map((order) => order.id));
      setSelectedIds((current) => current.filter((id) => !visibleIds.has(id)));
      return;
    }
    setSelectedIds((current) => [...new Set([...current, ...visibleOrders.map((order) => order.id)])]);
  }

  return (
    <Stack gap="lg">
      <MWPageHeader
        title="Sales History"
        subtitle="Find what a customer paid and review completed or archived Metal Worx orders."
        icon={IconHistory}
      />

      {moneyPrivacy.controls}

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        <Paper withBorder p="lg" radius="lg"><Text size="sm" c="dimmed" fw={750}>HISTORY RECORDS</Text><Title order={2} c="white" fw={900}>{visibleOrders.length}</Title></Paper>
        <Paper withBorder p="lg" radius="lg"><Text size="sm" c="dimmed" fw={750}>PRICES RECORDED</Text><Title order={2} c="white" fw={900}>{recordedPriceCount}</Title></Paper>
        <Paper withBorder p="lg" radius="lg"><Text size="sm" c="dimmed" fw={750}>VISIBLE SALES TOTAL</Text><Title order={2} c="white" fw={900}>{moneyPrivacy.unlocked ? visibleTotal.toLocaleString("en-US", { style: "currency", currency: "USD" }) : "$••••••"}</Title></Paper>
      </SimpleGrid>

      <Paper withBorder p="lg" radius="lg">
        <Group justify="space-between" align="flex-start" mb="md">
          <div>
            <Title order={3}>30-Day Artwork Summary</Title>
            <Text size="sm" c="dimmed" mt={4}>
              Completed and picked-up or shipped artwork from {formatDate(artworkReportStart)} through {formatDate(artworkReportEnd)}.
            </Text>
          </div>
          <Badge color="blue" variant="light" size="lg">
            {artworkReportOrders.length} sold
          </Badge>
        </Group>

        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm" mb="md">
          <Paper withBorder p="md" radius="md">
            <Text size="xs" c="dimmed" fw={800}>ARTWORK ORDERS SOLD</Text>
            <Title order={3} c="white" fw={900}>{artworkReportOrders.length}</Title>
          </Paper>
          <Paper withBorder p="md" radius="md">
            <Text size="xs" c="dimmed" fw={800}>PRICES TO VERIFY</Text>
            <Title order={3} c={artworkReportMissingPriceCount ? "orange.3" : "green.3"} fw={900}>
              {artworkReportMissingPriceCount}
            </Title>
          </Paper>
          <Paper withBorder p="md" radius="md">
            <Text size="xs" c="dimmed" fw={800}>OUT-THE-DOOR TOTAL</Text>
            <Title order={3} c="white" fw={900}>
              {moneyPrivacy.unlocked
                ? artworkReportTotal.toLocaleString("en-US", { style: "currency", currency: "USD" })
                : "$••••••"}
            </Title>
          </Paper>
        </SimpleGrid>

        {artworkReportMissingPriceCount > 0 && (
          <Alert color="orange" icon={<IconArchive size={18} />} mb="md">
            {artworkReportMissingPriceCount} completed artwork order(s) have no recorded final sale price. Add the price in Sales History so the total is complete.
          </Alert>
        )}

        {!loading && artworkReportOrders.length === 0 && (
          <Alert color="gray" icon={<IconHistory size={18} />}>
            No artwork was completed and sold during this 30-day period.
          </Alert>
        )}

        {artworkReportOrders.length > 0 && (
          <Stack gap="xs">
            {artworkReportOrders.map((order) => {
              const hasPrice = Number(order.total_amount || 0) > 0;
              return (
                <Paper key={order.id} withBorder p="sm" radius="md">
                  <Group justify="space-between" align="center" wrap="wrap">
                    <div>
                      <Text size="xs" c="dimmed" fw={800}>
                        {formatDate(order.fulfilled_at)} · {order.order_number || `ORDER ${order.id}`}
                      </Text>
                      <Text fw={800}>{customerName(order, customersById)}</Text>
                      <Text size="sm" c="dimmed">{itemNames(order.id, itemsByOrderId)}</Text>
                    </div>
                    <div>
                      <Text size="xs" c="dimmed" fw={800} ta="right">OUT-THE-DOOR PRICE</Text>
                      <Text fw={900} c={hasPrice ? "green.4" : "orange.4"} ta="right">
                        {!moneyPrivacy.unlocked
                          ? "$••••••"
                          : hasPrice
                            ? Number(order.total_amount).toLocaleString("en-US", { style: "currency", currency: "USD" })
                            : "Price not recorded"}
                      </Text>
                    </div>
                  </Group>
                </Paper>
              );
            })}
          </Stack>
        )}
      </Paper>

      <MWSection title="Completed & Archived Sales" subtitle="Search by customer, item, order number, description, date, or exact price.">
        <Stack gap="md">
          <Group align="flex-end" grow>
            <TextInput
              label="Search Sales History"
              placeholder="Customer, item, order number, or price"
              leftSection={<IconSearch size={17} />}
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
            />
            <Select
              label="Record Type"
              value={statusFilter}
              onChange={(value) => setStatusFilter(value || "All")}
              data={["All", "Completed", "Archived"]}
            />
            <Select
              label="History View"
              value={visibilityFilter}
              onChange={(value) => {
                setVisibilityFilter(value || "Sales History");
                setSelectedIds([]);
              }}
              data={["Sales History", "Removed"]}
            />
          </Group>

          <Group justify="space-between" align="center">
            <Checkbox
              label={allVisibleSelected ? "Clear visible selection" : "Select all visible orders"}
              checked={allVisibleSelected}
              indeterminate={selectedIds.length > 0 && !allVisibleSelected}
              onChange={toggleAllVisible}
            />
            {selectedIds.length > 0 && (
              <Button
                color={visibilityFilter === "Removed" ? "green" : "red"}
                variant="light"
                loading={saving}
                leftSection={visibilityFilter === "Removed" ? <IconRestore size={17} /> : <IconTrash size={17} />}
                onClick={() => setHistoryVisibility(selectedIds, visibilityFilter !== "Removed")}
              >
                {visibilityFilter === "Removed" ? "Restore" : "Remove"} Selected ({selectedIds.length})
              </Button>
            )}
          </Group>

          {!loading && visibleOrders.length === 0 && (
            <Alert color="gray" icon={<IconArchive size={19} />}>No completed or archived orders match this search.</Alert>
          )}

          <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="md">
            {visibleOrders.map((order) => (
              <Paper key={order.id} withBorder radius="lg" p="lg">
                <Stack gap="md">
                  <Group justify="space-between" align="flex-start" wrap="nowrap">
                    <Group align="flex-start" wrap="nowrap">
                      <Checkbox
                        mt={4}
                        aria-label={`Select ${order.order_number || `order ${order.id}`}`}
                        checked={selectedIds.includes(order.id)}
                        onChange={(event) => setSelectedIds((current) => event.currentTarget.checked
                          ? [...new Set([...current, order.id])]
                          : current.filter((id) => id !== order.id))}
                      />
                      {imagesByOrderId[String(order.id)]?.[0]?.image_url ? (
                        <button
                          type="button"
                          onClick={() => setPreviewImage({
                            ...imagesByOrderId[String(order.id)][0],
                            orderLabel: order.order_number || `Order ${order.id}`,
                            customerLabel: customerName(order, customersById),
                          })}
                          aria-label={`Enlarge image for ${customerName(order, customersById)}`}
                          style={{
                            width: 72,
                            height: 72,
                            padding: 0,
                            flex: "0 0 72px",
                            overflow: "hidden",
                            borderRadius: 10,
                            border: "1px solid var(--mantine-color-dark-4)",
                            background: "var(--mantine-color-dark-7)",
                            cursor: "pointer",
                          }}
                        >
                          <Image
                            src={imagesByOrderId[String(order.id)][0].image_url}
                            alt={imagesByOrderId[String(order.id)][0].caption || customerName(order, customersById)}
                            w={72}
                            h={72}
                            fit="cover"
                          />
                        </button>
                      ) : (
                        <Paper
                          w={72}
                          h={72}
                          radius="md"
                          withBorder
                          style={{ flex: "0 0 72px", display: "grid", placeItems: "center" }}
                        >
                          <Stack gap={2} align="center">
                            <IconPhoto size={20} color="gray" />
                            <Text size="9px" c="dimmed" ta="center">No image</Text>
                          </Stack>
                        </Paper>
                      )}
                      <div>
                        <Text size="xs" c="dimmed" fw={800}>{order.order_number || `ORDER ${order.id}`}</Text>
                        <Title order={4}>{customerName(order, customersById)}</Title>
                        <Text mt={3}>{itemNames(order.id, itemsByOrderId)}</Text>
                      </div>
                    </Group>
                    <Badge color={displayStatus(order) === "Archived" ? "gray" : "green"}>{displayStatus(order)}</Badge>
                  </Group>

                  <Group justify="space-between" align="flex-end" wrap="wrap" gap="md">
                    <div>
                      <Text size="xs" c="dimmed" fw={800}>COMPLETED / ARCHIVED</Text>
                      <Text fw={700}>{formatDate(historyDate(order))}</Text>
                    </div>
                    <div>
                      <Text size="xs" c="dimmed" fw={800}>FINAL SALE PRICE</Text>
                      {editingId === order.id && moneyPrivacy.unlocked ? (
                        <NumberInput
                          value={priceDraft}
                          onChange={(value) => setPriceDraft(Number(value || 0))}
                          min={0}
                          decimalScale={2}
                          fixedDecimalScale
                          prefix="$"
                          thousandSeparator=","
                          w={180}
                        />
                      ) : (
                        <Text size="xl" fw={900} c={moneyPrivacy.unlocked ? undefined : "dimmed"}>
                          {moneyPrivacy.unlocked
                            ? Number(order.total_amount || 0).toLocaleString("en-US", { style: "currency", currency: "USD" })
                            : "$•••••• — Unlock above"}
                        </Text>
                      )}
                    </div>
                  </Group>

                  <Group gap="xs" wrap="wrap">
                    {editingId === order.id ? (
                      <>
                        <Button size="sm" color="green" loading={saving} onClick={() => savePrice(order)}>Save Price</Button>
                        <Button size="sm" variant="default" onClick={() => setEditingId(null)}>Cancel</Button>
                      </>
                    ) : (
                      <Button size="sm" variant="light" leftSection={<IconEdit size={16} />} onClick={() => beginPriceEdit(order)}>Edit Price</Button>
                    )}
                    <Button size="sm" variant="light" color="gray" leftSection={<IconEye size={16} />} onClick={() => openOrder(order)}>Open Order</Button>
                    <Button
                      size="sm"
                      variant="light"
                      color={order.sales_history_hidden ? "green" : "red"}
                      leftSection={order.sales_history_hidden ? <IconRestore size={16} /> : <IconTrash size={16} />}
                      onClick={() => setHistoryVisibility([order.id], !order.sales_history_hidden)}
                    >
                      {order.sales_history_hidden ? "Restore to History" : "Remove from History"}
                    </Button>
                  </Group>
                </Stack>
              </Paper>
            ))}
          </SimpleGrid>
        </Stack>
      </MWSection>

      <Modal
        opened={Boolean(previewImage)}
        onClose={() => setPreviewImage(null)}
        title={previewImage ? `${previewImage.customerLabel} · ${previewImage.orderLabel}` : "Order Image"}
        size="xl"
        centered
      >
        {previewImage && (
          <Stack gap="sm">
            <Image
              src={previewImage.image_url}
              alt={previewImage.caption || previewImage.customerLabel || "Order image"}
              mah="70vh"
              fit="contain"
              radius="md"
            />
            {previewImage.caption && <Text size="sm" c="dimmed" ta="center">{previewImage.caption}</Text>}
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
