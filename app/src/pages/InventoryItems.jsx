import {
  Avatar,
  Badge,
  Box,
  Button,
  Group,
  Loader,
  ScrollArea,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  ThemeIcon,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconAdjustments,
  IconAlertTriangle,
  IconBox,
  IconBuildingStore,
  IconChevronRight,
  IconCircleCheck,
  IconFilter,
  IconMapPin,
  IconPackage,
  IconPhoto,
  IconPlus,
  IconQrcode,
  IconRefresh,
  IconSearch,
  IconTool,
} from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";

import { supabase } from "../lib/supabase";

import MWKpiStrip from "../components/ui/MWKpiStrip";
import MWPageHeader from "../components/ui/MWPageHeader";
import MWPanel from "../components/ui/MWPanel";
import MWStatusBadge from "../components/ui/MWStatusBadge";

function numberValue(value) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    return 0;
  }

  return parsedValue;
}

function formatNumber(
  value,
  maximumFractionDigits = 2
) {
  return numberValue(value).toLocaleString(
    "en-US",
    {
      maximumFractionDigits,
    }
  );
}

function formatCurrency(value) {
  return numberValue(value).toLocaleString(
    "en-US",
    {
      style: "currency",
      currency: "USD",
    }
  );
}

function getStockStatusColor(status) {
  if (status === "Available") {
    return "green";
  }

  if (status === "Low Stock") {
    return "orange";
  }

  if (status === "Out of Stock") {
    return "red";
  }

  if (status === "Non-Stock") {
    return "blue";
  }

  if (status === "Inactive") {
    return "gray";
  }

  return "gray";
}

function isShowroomItem(item) {
  const category = String(
    item.category_name || ""
  ).toLowerCase();

  const binName = String(
    item.default_bin_name || ""
  ).toLowerCase();

  const binCode = String(
    item.default_bin_code || ""
  ).toLowerCase();

  return (
    category.includes("showroom") ||
    category.includes("finished") ||
    category.includes("sample") ||
    binName.includes("showroom") ||
    binName.includes("display") ||
    binName.includes("sample") ||
    binCode.includes("showroom")
  );
}

function isConsumableItem(item) {
  const category = String(
    item.category_name || ""
  ).toLowerCase();

  const itemType = String(
    item.item_type || ""
  ).toLowerCase();

  return (
    item.is_consumable === true ||
    itemType === "consumable" ||
    itemType === "paint" ||
    itemType === "powder" ||
    category.includes("consumable") ||
    category.includes("abrasive") ||
    category.includes("paint") ||
    category.includes("powder") ||
    category.includes("cleaning") ||
    category.includes("office") ||
    category.includes("packaging") ||
    category.includes("hardware")
  );
}

function getItemGroup(item) {
  if (isShowroomItem(item)) {
    return "Showroom";
  }

  if (isConsumableItem(item)) {
    return "Consumable";
  }

  return "Material";
}

function ItemImage({
  item,
}) {
  const imageUrl =
    item.primary_image_url || null;

  if (imageUrl) {
    return (
      <Avatar
        src={imageUrl}
        alt={
          item.image_alt_text ||
          item.name
        }
        size={52}
        radius="md"
      />
    );
  }

  return (
    <ThemeIcon
      size={52}
      radius="md"
      color={
        isShowroomItem(item)
          ? "violet"
          : isConsumableItem(item)
            ? "orange"
            : "blue"
      }
      variant="light"
      style={{
        flexShrink: 0,
        border:
          "1px solid rgba(255,255,255,0.08)",
      }}
    >
      {isShowroomItem(item) ? (
        <IconBuildingStore
          size={24}
          stroke={2}
        />
      ) : isConsumableItem(item) ? (
        <IconTool
          size={24}
          stroke={2}
        />
      ) : (
        <IconPackage
          size={24}
          stroke={2}
        />
      )}
    </ThemeIcon>
  );
}

function EmptyState({
  hasFilters,
  onClearFilters,
  onAddItem,
}) {
  return (
    <Stack
      align="center"
      justify="center"
      mih={340}
      gap="md"
      px="lg"
    >
      <ThemeIcon
        size={64}
        radius="xl"
        color="gray"
        variant="light"
        style={{
          border:
            "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <IconPackage size={30} />
      </ThemeIcon>

      <Box ta="center">
        <Text
          fw={850}
          size="lg"
          c="gray.2"
        >
          {hasFilters
            ? "No items match these filters"
            : "No inventory items found"}
        </Text>

        <Text
          size="sm"
          c="gray.5"
          mt={6}
          maw={460}
          style={{
            lineHeight: 1.5,
          }}
        >
          {hasFilters
            ? "Clear one or more filters to see additional showroom items, consumables, and materials."
            : "Add the first showroom item, component, consumable, or material record."}
        </Text>
      </Box>

      <Group gap="sm">
        {hasFilters && (
          <Button
            variant="light"
            color="gray"
            onClick={onClearFilters}
          >
            Clear Filters
          </Button>
        )}

        <Button
          color="red"
          leftSection={
            <IconPlus size={17} />
          }
          onClick={onAddItem}
        >
          Add Inventory Item
        </Button>
      </Group>
    </Stack>
  );
}

function clean(value) {
  return String(value ?? "").trim();
}

function InventoryItems({
  setPage,
  setSelectedInventoryItem,
}) {
  const [loading, setLoading] =
    useState(true);

  const [items, setItems] =
    useState([]);

  const [categories, setCategories] =
    useState([]);

  const [bins, setBins] =
    useState([]);

  const [labels, setLabels] =
    useState([]);

  const [search, setSearch] =
    useState("");

  const [groupFilter, setGroupFilter] =
    useState("all");

  const [
    categoryFilter,
    setCategoryFilter,
  ] = useState("all");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("all");

  const [
    storageFilter,
    setStorageFilter,
  ] = useState("all");

  useEffect(() => {
    loadInventoryItems();
  }, []);

  async function loadInventoryItems() {
    setLoading(true);

    try {
      const [
        itemsResult,
        categoriesResult,
        binsResult,
        labelsResult,
      ] = await Promise.all([
        supabase
          .from(
            "inventory_item_availability"
          )
          .select("*")
          .order("name", {
            ascending: true,
          }),

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
          .from("inventory_bins")
          .select(`
            id,
            name,
            code,
            zone,
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
          .from("inventory_labels")
          .select(`
            id,
            inventory_item_id,
            label_type,
            print_count,
            is_active
          `)
          .eq("label_type", "item")
          .eq("is_active", true),
      ]);

      const failedResult = [
        itemsResult,
        categoriesResult,
        binsResult,
        labelsResult,
      ].find(
        (result) => result.error
      );

      if (failedResult?.error) {
        throw failedResult.error;
      }

      setItems(itemsResult.data || []);
      setCategories(
        categoriesResult.data || []
      );
      setBins(binsResult.data || []);
      setLabels(labelsResult.data || []);
    } catch (error) {
      console.error(
        "Inventory items load error:",
        error
      );

      notifications.show({
        title:
          "Inventory Items Load Failed",
        message:
          error.message ||
          "Unable to load inventory items.",
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  }

  function openItem(item) {
    if (
      typeof setSelectedInventoryItem ===
      "function"
    ) {
      setSelectedInventoryItem(item);
    }

    setPage?.("inventoryItemDetails");
  }

  function updateQuantity(item) {
    if (
      typeof setSelectedInventoryItem ===
      "function"
    ) {
      setSelectedInventoryItem(item);
    }

    setPage?.("inventoryAdjustment");
  }

  function clearFilters() {
    setSearch("");
    setGroupFilter("all");
    setCategoryFilter("all");
    setStatusFilter("all");
    setStorageFilter("all");
  }

  const itemLabelMap = useMemo(() => {
    const labelMap = new Map();

    labels.forEach((label) => {
      if (label.inventory_item_id) {
        labelMap.set(
          label.inventory_item_id,
          label
        );
      }
    });

    return labelMap;
  }, [labels]);

  const categoryOptions = useMemo(
    () => [
      {
        value: "all",
        label: "All Categories",
      },
      ...categories.map(
        (category) => ({
          value: category.id,
          label: category.name,
        })
      ),
    ],
    [categories]
  );

  const storageOptions = useMemo(
    () => [
      {
        value: "all",
        label: "All Storage Positions",
      },
      {
        value: "unassigned",
        label: "Unassigned Storage",
      },
      ...bins.map((bin) => ({
        value: bin.id,
        label: [
          bin.zone,
          bin.name,
        ]
          .filter(Boolean)
          .join(" — "),
      })),
    ],
    [bins]
  );

  const filteredItems = useMemo(() => {
    const normalizedSearch = search
      .trim()
      .toLowerCase();

    return items.filter((item) => {
      if (
        groupFilter !== "all" &&
        getItemGroup(item).toLowerCase() !==
          groupFilter
      ) {
        return false;
      }

      if (
        categoryFilter !== "all" &&
        item.category_id !== categoryFilter
      ) {
        return false;
      }

      if (
        statusFilter !== "all" &&
        item.stock_status !== statusFilter
      ) {
        return false;
      }

      if (
        storageFilter === "unassigned" &&
        item.default_bin_id
      ) {
        return false;
      }

      if (
        storageFilter !== "all" &&
        storageFilter !== "unassigned" &&
        item.default_bin_id !== storageFilter
      ) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const searchableText = [
        item.name,
        item.item_number,
        item.sku,
        item.description,
        item.category_name,
        item.default_bin_name,
        item.default_bin_code,
        item.color_name,
        item.color_code,
        item.dimensions,
        item.manufacturer,
        item.manufacturer_part_number,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(
        normalizedSearch
      );
    });
  }, [
    items,
    search,
    groupFilter,
    categoryFilter,
    statusFilter,
    storageFilter,
  ]);

  const showroomCount = useMemo(
    () =>
      items.filter(
        (item) =>
          item.is_active &&
          isShowroomItem(item)
      ).length,
    [items]
  );

  const consumableCount = useMemo(
    () =>
      items.filter(
        (item) =>
          item.is_active &&
          isConsumableItem(item)
      ).length,
    [items]
  );

  const lowStockCount = useMemo(
    () =>
      items.filter(
        (item) =>
          item.stock_status ===
          "Low Stock"
      ).length,
    [items]
  );

  const outOfStockCount = useMemo(
    () =>
      items.filter(
        (item) =>
          item.stock_status ===
          "Out of Stock"
      ).length,
    [items]
  );

  const totalValue = useMemo(
    () =>
      items.reduce(
        (total, item) =>
          total +
          numberValue(
            item.inventory_value
          ),
        0
      ),
    [items]
  );

  const hasFilters =
    search.trim() !== "" ||
    groupFilter !== "all" ||
    categoryFilter !== "all" ||
    statusFilter !== "all" ||
    storageFilter !== "all";

  const kpiItems = [
    {
      key: "all-items",
      label: "Active Items",
      value: formatNumber(
        items.filter(
          (item) => item.is_active
        ).length,
        0
      ),
      description:
        "All active inventory records.",
      icon: IconPackage,
      color: "blue",
      onClick: () => {
        clearFilters();
      },
    },
    {
      key: "showroom",
      label: "Showroom Items",
      value: formatNumber(
        showroomCount,
        0
      ),
      description:
        "Samples, display pieces, and stocked components.",
      icon: IconBuildingStore,
      color: "violet",
      onClick: () => {
        clearFilters();
        setGroupFilter("showroom");
      },
    },
    {
      key: "consumables",
      label: "Consumables",
      value: formatNumber(
        consumableCount,
        0
      ),
      description:
        "Powder, abrasives, tape, hardware, and supplies.",
      icon: IconTool,
      color: "orange",
      onClick: () => {
        clearFilters();
        setGroupFilter(
          "consumable"
        );
      },
    },
    {
      key: "low-stock",
      label: "Low Stock",
      value: formatNumber(
        lowStockCount,
        0
      ),
      description:
        "Items at or below their reorder point.",
      icon: IconAlertTriangle,
      color:
        lowStockCount > 0
          ? "orange"
          : "green",
      onClick: () => {
        clearFilters();
        setStatusFilter("Low Stock");
      },
    },
    {
      key: "out-of-stock",
      label: "Out of Stock",
      value: formatNumber(
        outOfStockCount,
        0
      ),
      description:
        "Items with no available quantity.",
      icon: IconBox,
      color:
        outOfStockCount > 0
          ? "red"
          : "green",
      onClick: () => {
        clearFilters();
        setStatusFilter(
          "Out of Stock"
        );
      },
    },
    {
      key: "value",
      label: "Recorded Value",
      value: formatCurrency(
        totalValue
      ),
      description:
        "Estimated value of recorded stock.",
      icon: IconCircleCheck,
      color: "green",
    },
  ];

  if (loading) {
    return (
      <>
        <MWPageHeader
          title="Inventory Items"
          subtitle="Loading showroom items, consumables, materials, and quantities."
          setPage={setPage}
          showBack
          backPage="inventoryDashboard"
          backLabel="Materials & Inventory"
          showDashboard
        />

        <MWPanel
          title="Loading Inventory Items"
          subtitle="Retrieving item, quantity, category, storage, and QR-label information."
          icon={IconPackage}
          color="blue"
        >
          <Group
            justify="center"
            py={80}
            gap="md"
          >
            <Loader color="blue" />

            <Text c="gray.4">
              Loading inventory catalog...
            </Text>
          </Group>
        </MWPanel>
      </>
    );
  }

  return (
    <>
      <MWPageHeader
        title="Inventory Items"
        subtitle="Showroom stock, finished samples, consumables, supplies, and optionally tracked shop materials."
        buttonText="Add Item"
        onButtonClick={() =>
          setPage?.(
            "newInventoryItem"
          )
        }
        setPage={setPage}
        showBack
        backPage="inventoryDashboard"
        backLabel="Materials & Inventory"
        showDashboard
      />

      <Stack gap="lg">
        <MWKpiStrip
          items={kpiItems}
          columns={{
            base: 1,
            sm: 2,
            xl: 3,
          }}
          compact
        />

        <MWPanel
          title="Search & Filters"
          subtitle="Find items by name, item number, category, storage position, or stock status."
          icon={IconFilter}
          color="blue"
          compact
          rightSection={
            <Group gap="xs">
              {hasFilters && (
                <Button
                  size="xs"
                  variant="subtle"
                  color="gray"
                  onClick={clearFilters}
                >
                  Clear Filters
                </Button>
              )}

              <Button
                size="xs"
                variant="light"
                color="gray"
                leftSection={
                  <IconRefresh
                    size={14}
                  />
                }
                onClick={
                  loadInventoryItems
                }
              >
                Refresh
              </Button>
            </Group>
          }
        >
          <Stack gap="md">
            <TextInput
              value={search}
              onChange={(event) =>
                setSearch(
                  event.currentTarget.value
                )
              }
              placeholder="Search item name, number, category, color, size, or storage position..."
              leftSection={
                <IconSearch size={17} />
              }
              size="md"
              radius="md"
            />

            <Group
              grow
              align="flex-end"
              gap="md"
            >
              <Select
                label="Item Group"
                value={groupFilter}
                onChange={(value) =>
                  setGroupFilter(
                    value || "all"
                  )
                }
                data={[
                  {
                    value: "all",
                    label: "All Item Groups",
                  },
                  {
                    value: "showroom",
                    label: "Showroom Items",
                  },
                  {
                    value: "consumable",
                    label: "Consumables",
                  },
                  {
                    value: "material",
                    label: "Materials",
                  },
                ]}
                allowDeselect={false}
                radius="md"
              />

              <Select
                label="Category"
                value={categoryFilter}
                onChange={(value) =>
                  setCategoryFilter(
                    value || "all"
                  )
                }
                data={categoryOptions}
                searchable
                allowDeselect={false}
                radius="md"
              />

              <Select
                label="Stock Status"
                value={statusFilter}
                onChange={(value) =>
                  setStatusFilter(
                    value || "all"
                  )
                }
                data={[
                  {
                    value: "all",
                    label: "All Stock Statuses",
                  },
                  {
                    value: "Available",
                    label: "Available",
                  },
                  {
                    value: "Low Stock",
                    label: "Low Stock",
                  },
                  {
                    value: "Out of Stock",
                    label: "Out of Stock",
                  },
                  {
                    value: "Non-Stock",
                    label: "Non-Stock",
                  },
                  {
                    value: "Inactive",
                    label: "Inactive",
                  },
                ]}
                allowDeselect={false}
                radius="md"
              />

              <Select
                label="Storage Position"
                value={storageFilter}
                onChange={(value) =>
                  setStorageFilter(
                    value || "all"
                  )
                }
                data={storageOptions}
                searchable
                allowDeselect={false}
                radius="md"
              />
            </Group>

            <Group
              justify="space-between"
              align="center"
              gap="md"
              wrap="wrap"
            >
              <Text
                size="sm"
                c="gray.5"
              >
                Showing{" "}
                <Text
                  component="span"
                  fw={850}
                  c="gray.2"
                >
                  {filteredItems.length}
                </Text>{" "}
                of{" "}
                <Text
                  component="span"
                  fw={850}
                  c="gray.2"
                >
                  {items.length}
                </Text>{" "}
                inventory items
              </Text>

              <Group gap="sm">
                <Button
                  size="sm"
                  variant="light"
                  color="violet"
                  leftSection={
                    <IconQrcode size={16} />
                  }
                  onClick={() =>
                    setPage?.(
                      "inventoryScanner"
                    )
                  }
                >
                  Scan Inventory
                </Button>

                <Button
                  size="sm"
                  color="red"
                  leftSection={
                    <IconPlus size={16} />
                  }
                  onClick={() =>
                    setPage?.(
                      "newInventoryItem"
                    )
                  }
                >
                  Add Item
                </Button>
              </Group>
            </Group>
          </Stack>
        </MWPanel>

        <MWPanel
          title="Inventory Catalog"
          subtitle="Current quantities, storage positions, reorder settings, and item readiness."
          icon={IconPackage}
          color="red"
          compact
        >
          {filteredItems.length === 0 ? (
            <EmptyState
              hasFilters={hasFilters}
              onClearFilters={
                clearFilters
              }
              onAddItem={() =>
                setPage?.(
                  "newInventoryItem"
                )
              }
            />
          ) : (
            <ScrollArea
              type="auto"
              offsetScrollbars
              scrollbarSize={8}
            >
              <Table
                verticalSpacing="md"
                horizontalSpacing="md"
                highlightOnHover
                withRowBorders
                miw={1040}
                styles={{
                  table: {
                    tableLayout: "fixed",
                  },
                  th: {
                    color:
                      "var(--mantine-color-gray-5)",
                    fontSize: 11,
                    fontWeight: 850,
                    textTransform:
                      "uppercase",
                    letterSpacing:
                      "0.055em",
                    borderBottom:
                      "1px solid rgba(255,255,255,0.08)",
                    whiteSpace: "nowrap",
                  },
                  td: {
                    borderBottom:
                      "1px solid rgba(255,255,255,0.055)",
                    verticalAlign:
                      "middle",
                  },
                }}
              >
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th
                      style={{
                        width: 270,
                      }}
                    >
                      Item
                    </Table.Th>

                    <Table.Th
                      style={{
                        width: 120,
                      }}
                    >
                      Group
                    </Table.Th>

                    <Table.Th
                      style={{
                        width: 150,
                      }}
                    >
                      Category
                    </Table.Th>

                    <Table.Th
                      style={{
                        width: 90,
                      }}
                    >
                      On Hand
                    </Table.Th>

                    <Table.Th
                      style={{
                        width: 90,
                      }}
                    >
                      Available
                    </Table.Th>

                    <Table.Th
                      style={{
                        width: 145,
                      }}
                    >
                      Storage
                    </Table.Th>

                    <Table.Th
                      style={{
                        width: 120,
                      }}
                    >
                      Status
                    </Table.Th>

                    <Table.Th
                      style={{
                        width: 90,
                      }}
                    >
                      QR
                    </Table.Th>

                    <Table.Th
                      style={{
                        width: 125,
                      }}
                    >
                      Actions
                    </Table.Th>
                  </Table.Tr>
                </Table.Thead>

                <Table.Tbody>
                  {filteredItems.map(
                    (item) => {
                      const itemLabel =
                        itemLabelMap.get(
                          item.inventory_item_id
                        );

                      const hasQrLabel =
                        Boolean(itemLabel);

                      const qrPrinted =
                        numberValue(
                          itemLabel?.print_count
                        ) > 0;

                      const itemGroup =
                        getItemGroup(item);

                      return (
                        <Table.Tr
                          key={
                            item.inventory_item_id
                          }
                          style={{
                            cursor: "pointer",
                          }}
                          onClick={() =>
                            openItem(item)
                          }
                        >
                          <Table.Td>
                            <Group
                              gap="md"
                              wrap="nowrap"
                            >
                              <ItemImage
                                item={item}
                              />

                              <Box
                                style={{
                                  minWidth: 0,
                                  flex: 1,
                                }}
                              >
                                <Text
                                  fw={850}
                                  size="sm"
                                  c="gray.1"
                                  lineClamp={1}
                                >
                                  {item.name}
                                </Text>

                                <Group
                                  gap="xs"
                                  mt={5}
                                  wrap="wrap"
                                >
                                  <Text
                                    size="xs"
                                    c="gray.5"
                                  >
                                    {item.item_number}
                                  </Text>

                                  {item.sku &&
                                    clean(item.sku).toLowerCase() !==
                                      clean(item.item_number).toLowerCase() && (
                                    <>
                                      <Text
                                        size="xs"
                                        c="gray.7"
                                      >
                                        •
                                      </Text>

                                      <Text
                                        size="xs"
                                        c="gray.5"
                                      >
                                        {item.sku}
                                      </Text>
                                    </>
                                  )}
                                </Group>

                                {item.dimensions && (
                                  <Text
                                    size="xs"
                                    c="gray.6"
                                    mt={3}
                                    lineClamp={1}
                                  >
                                    {item.dimensions}
                                  </Text>
                                )}
                              </Box>
                            </Group>
                          </Table.Td>

                          <Table.Td>
                            <Badge
                              color={
                                itemGroup ===
                                "Showroom"
                                  ? "violet"
                                  : itemGroup ===
                                      "Consumable"
                                    ? "orange"
                                    : "blue"
                              }
                              variant="light"
                              radius="sm"
                            >
                              {itemGroup}
                            </Badge>
                          </Table.Td>

                          <Table.Td>
                            <Text
                              size="sm"
                              fw={700}
                              c="gray.3"
                              lineClamp={2}
                            >
                              {item.category_name ||
                                "Uncategorized"}
                            </Text>
                          </Table.Td>

                          <Table.Td>
                            <Text
                              fw={850}
                              c="gray.1"
                              style={{
                                fontVariantNumeric:
                                  "tabular-nums",
                              }}
                            >
                              {formatNumber(
                                item.quantity_on_hand
                              )}
                            </Text>

                            <Text
                              size="xs"
                              c="gray.6"
                              mt={2}
                            >
                              {item.unit_abbreviation ||
                                ""}
                            </Text>
                          </Table.Td>

                          <Table.Td>
                            <Text
                              fw={850}
                              c={
                                numberValue(
                                  item.quantity_available
                                ) > 0
                                  ? "green.3"
                                  : "red.3"
                              }
                              style={{
                                fontVariantNumeric:
                                  "tabular-nums",
                              }}
                            >
                              {formatNumber(
                                item.quantity_available
                              )}
                            </Text>

                            {numberValue(
                              item.quantity_reserved
                            ) > 0 && (
                              <Text
                                size="xs"
                                c="violet.3"
                                mt={2}
                              >
                                {formatNumber(
                                  item.quantity_reserved
                                )}{" "}
                                reserved
                              </Text>
                            )}
                          </Table.Td>

                          <Table.Td>
                            <Group
                              gap="xs"
                              wrap="nowrap"
                            >
                              <IconMapPin
                                size={15}
                                color="var(--mantine-color-gray-6)"
                                style={{
                                  flexShrink: 0,
                                }}
                              />

                              <Box
                                style={{
                                  minWidth: 0,
                                }}
                              >
                                <Text
                                  size="sm"
                                  fw={700}
                                  c="gray.3"
                                  lineClamp={1}
                                >
                                  {item.default_bin_name ||
                                    "Unassigned"}
                                </Text>

                                {item.default_bin_code && (
                                  <Text
                                    size="xs"
                                    c="gray.6"
                                    mt={2}
                                  >
                                    {item.default_bin_code}
                                  </Text>
                                )}
                              </Box>
                            </Group>
                          </Table.Td>

                          <Table.Td>
                            <MWStatusBadge
                              status={
                                item.stock_status
                              }
                              label={
                                item.stock_status
                              }
                              color={getStockStatusColor(
                                item.stock_status
                              )}
                              size="sm"
                            />
                          </Table.Td>

                          <Table.Td>
                            <Group
                              gap="xs"
                              wrap="nowrap"
                            >
                              <ThemeIcon
                                size={30}
                                radius="md"
                                color={
                                  hasQrLabel
                                    ? qrPrinted
                                      ? "green"
                                      : "violet"
                                    : "gray"
                                }
                                variant="light"
                              >
                                <IconQrcode
                                  size={15}
                                />
                              </ThemeIcon>

                              <Text
                                size="xs"
                                fw={750}
                                c={
                                  hasQrLabel
                                    ? "gray.3"
                                    : "gray.6"
                                }
                              >
                                {hasQrLabel
                                  ? qrPrinted
                                    ? "Printed"
                                    : "Ready"
                                  : "Missing"}
                              </Text>
                            </Group>
                          </Table.Td>

                          <Table.Td>
                            <Group
                              gap="xs"
                              wrap="nowrap"
                              onClick={(
                                event
                              ) => {
                                event.stopPropagation();
                              }}
                            >
                              <Button
                                size="xs"
                                variant="light"
                                color="green"
                                leftSection={
                                  <IconAdjustments
                                    size={14}
                                  />
                                }
                                onClick={() =>
                                  updateQuantity(
                                    item
                                  )
                                }
                                px={9}
                                aria-label={`Adjust quantity for ${item.name}`}
                              >
                                Qty
                              </Button>

                              <Button
                                size="xs"
                                variant="subtle"
                                color="gray"
                                px={8}
                                onClick={() =>
                                  openItem(item)
                                }
                              >
                                <IconChevronRight
                                  size={16}
                                />
                              </Button>
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      );
                    }
                  )}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          )}
        </MWPanel>
      </Stack>
    </>
  );
}

export default InventoryItems;
