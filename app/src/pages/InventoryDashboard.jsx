import {
  Badge,
  Box,
  Button,
  Divider,
  Group,
  Loader,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconAdjustments,
  IconAlertTriangle,
  IconBox,
  IconBuildingStore,
  IconCash,
  IconChartBar,
  IconCircleCheck,
  IconClipboardList,
  IconDatabase,
  IconMapPin,
  IconPackage,
  IconPhoto,
  IconQrcode,
  IconRefresh,
  IconShoppingBag,
  IconStack2,
  IconTag,
  IconTool,
} from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";

import { supabase } from "../lib/supabase";

import MWKpiStrip from "../components/ui/MWKpiStrip";
import MWPageHeader from "../components/ui/MWPageHeader";
import MWPanel from "../components/ui/MWPanel";
import MWStatusBadge from "../components/ui/MWStatusBadge";

import MWInventoryActionPanel from "../components/inventory/MWInventoryActionPanel";
import MWInventoryStorageCard from "../components/inventory/MWInventoryStorageCard";
import MWInventoryTimeline from "../components/inventory/MWInventoryTimeline";

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

function getStorageAreaColor(zone) {
  const normalizedZone = String(
    zone || ""
  ).toLowerCase();

  if (
    normalizedZone.includes("showroom")
  ) {
    return "violet";
  }

  if (
    normalizedZone.includes("production")
  ) {
    return "red";
  }

  if (normalizedZone.includes("laser")) {
    return "blue";
  }

  if (normalizedZone.includes("prep")) {
    return "orange";
  }

  if (normalizedZone.includes("paint")) {
    return "red";
  }

  if (normalizedZone.includes("powder")) {
    return "violet";
  }

  if (
    normalizedZone.includes("welding")
  ) {
    return "orange";
  }

  if (
    normalizedZone.includes("shipping")
  ) {
    return "teal";
  }

  if (normalizedZone.includes("office")) {
    return "blue";
  }

  if (
    normalizedZone.includes("receiving")
  ) {
    return "green";
  }

  if (
    normalizedZone.includes("quality")
  ) {
    return "yellow";
  }

  if (normalizedZone.includes("scrap")) {
    return "gray";
  }

  return "gray";
}

function getHealthColor(score) {
  if (score >= 90) {
    return "green";
  }

  if (score >= 75) {
    return "blue";
  }

  if (score >= 50) {
    return "orange";
  }

  return "red";
}

function getHealthLabel(score) {
  if (score >= 90) {
    return "Excellent";
  }

  if (score >= 75) {
    return "Good";
  }

  if (score >= 50) {
    return "Needs Attention";
  }

  return "Setup Required";
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

  const type = String(
    item.item_type || ""
  ).toLowerCase();

  return (
    item.is_consumable === true ||
    type === "consumable" ||
    type === "paint" ||
    type === "powder" ||
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

function AlertRow({
  title,
  description,
  count,
  color,
  actionLabel = "Review",
  onClick,
  icon: Icon = IconAlertTriangle,
  showDivider = true,
}) {
  return (
    <>
      <Group
        justify="space-between"
        align="center"
        gap="lg"
        wrap="nowrap"
        py="md"
      >
        <Group
          gap="md"
          align="center"
          wrap="nowrap"
          style={{
            minWidth: 0,
            flex: 1,
          }}
        >
          <ThemeIcon
            size={40}
            radius="md"
            color={color}
            variant="light"
            style={{
              flexShrink: 0,
              border:
                "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <Icon size={20} stroke={2} />
          </ThemeIcon>

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
              style={{
                lineHeight: 1.3,
                textAlign: "left",
              }}
            >
              {title}
            </Text>

            <Text
              size="xs"
              c="gray.5"
              mt={4}
              style={{
                lineHeight: 1.4,
                textAlign: "left",
              }}
            >
              {description}
            </Text>
          </Box>
        </Group>

        <Group
          gap="sm"
          wrap="nowrap"
          style={{
            flexShrink: 0,
          }}
        >
          <Badge
            color={color}
            variant="light"
            radius="sm"
            size="lg"
            styles={{
              root: {
                minWidth: 42,
                justifyContent: "center",
                border:
                  "1px solid rgba(255,255,255,0.08)",
                fontWeight: 900,
                fontVariantNumeric:
                  "tabular-nums",
              },
            }}
          >
            {count}
          </Badge>

          <Button
            size="xs"
            variant="subtle"
            color={color}
            onClick={onClick}
          >
            {actionLabel}
          </Button>
        </Group>
      </Group>

      {showDivider && (
        <Divider color="rgba(255,255,255,0.07)" />
      )}
    </>
  );
}

function HealthRequirement({
  label,
  value,
  description,
  icon: Icon,
  color,
  complete,
}) {
  return (
    <Box
      p="md"
      style={{
        borderRadius: 12,
        border:
          "1px solid rgba(255,255,255,0.07)",
        backgroundColor:
          "rgba(255,255,255,0.022)",
      }}
    >
      <Group
        justify="space-between"
        align="center"
        gap="lg"
        wrap="nowrap"
      >
        <Group
          gap="md"
          wrap="nowrap"
          style={{
            minWidth: 0,
            flex: 1,
          }}
        >
          <ThemeIcon
            size={38}
            radius="md"
            color={complete ? "green" : color}
            variant="light"
            style={{
              flexShrink: 0,
              border:
                "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {complete ? (
              <IconCircleCheck
                size={19}
                stroke={2.2}
              />
            ) : (
              <Icon size={19} stroke={2} />
            )}
          </ThemeIcon>

          <Box
            style={{
              minWidth: 0,
              flex: 1,
            }}
          >
            <Text
              size="sm"
              fw={850}
              c="gray.1"
              style={{
                lineHeight: 1.3,
              }}
            >
              {label}
            </Text>

            <Text
              size="xs"
              c="gray.5"
              mt={3}
              style={{
                lineHeight: 1.4,
              }}
            >
              {description}
            </Text>
          </Box>
        </Group>

        <Badge
          color={complete ? "green" : color}
          variant="light"
          radius="sm"
          size="md"
          styles={{
            root: {
              flexShrink: 0,
              minWidth: 48,
              justifyContent: "center",
              border:
                "1px solid rgba(255,255,255,0.08)",
              fontWeight: 850,
            },
          }}
        >
          {complete ? "Ready" : value}
        </Badge>
      </Group>
    </Box>
  );
}

function CategoryRow({
  category,
  count,
  lowStock,
  outOfStock,
  color,
  onClick,
  showDivider,
}) {
  const hasAlert =
    numberValue(lowStock) > 0 ||
    numberValue(outOfStock) > 0;

  return (
    <>
      <Group
        justify="space-between"
        align="center"
        gap="lg"
        wrap="nowrap"
        py="md"
      >
        <Group
          gap="md"
          wrap="nowrap"
          style={{
            minWidth: 0,
            flex: 1,
          }}
        >
          <ThemeIcon
            size={38}
            radius="md"
            color={color}
            variant="light"
            style={{
              flexShrink: 0,
            }}
          >
            <IconPackage
              size={19}
              stroke={2}
            />
          </ThemeIcon>

          <Box
            style={{
              minWidth: 0,
              flex: 1,
            }}
          >
            <Text
              size="sm"
              fw={850}
              c="gray.1"
            >
              {category}
            </Text>

            <Text
              size="xs"
              c="gray.5"
              mt={3}
            >
              {count} item
              {count === 1 ? "" : "s"}
            </Text>
          </Box>
        </Group>

        <Group
          gap="sm"
          wrap="nowrap"
          style={{
            flexShrink: 0,
          }}
        >
          {hasAlert ? (
            <>
              {numberValue(outOfStock) >
                0 && (
                <Badge
                  color="red"
                  variant="light"
                >
                  {outOfStock} Out
                </Badge>
              )}

              {numberValue(lowStock) >
                0 && (
                <Badge
                  color="orange"
                  variant="light"
                >
                  {lowStock} Low
                </Badge>
              )}
            </>
          ) : (
            <MWStatusBadge
              status="Available"
              label="Good"
              color="green"
              size="sm"
            />
          )}

          <Button
            size="xs"
            variant="subtle"
            color="gray"
            onClick={onClick}
          >
            View
          </Button>
        </Group>
      </Group>

      {showDivider && (
        <Divider color="rgba(255,255,255,0.07)" />
      )}
    </>
  );
}

function ReviewItemCard({
  item,
  onClick,
}) {
  const outOfStock =
    item.stock_status === "Out of Stock";

  return (
    <Button
      variant="default"
      radius="lg"
      h="auto"
      p="md"
      onClick={onClick}
      styles={{
        root: {
          width: "100%",
          minHeight: 98,
          justifyContent: "flex-start",
          borderColor:
            "rgba(255,255,255,0.08)",
          background:
            "rgba(255,255,255,0.025)",
        },
        inner: {
          width: "100%",
        },
        label: {
          width: "100%",
          whiteSpace: "normal",
          overflow: "visible",
        },
      }}
    >
      <Group
        justify="space-between"
        align="center"
        gap="lg"
        wrap="nowrap"
        w="100%"
      >
        <Group
          gap="md"
          wrap="nowrap"
          style={{
            minWidth: 0,
            flex: 1,
          }}
        >
          <ThemeIcon
            size={40}
            radius="md"
            color={
              outOfStock
                ? "red"
                : "orange"
            }
            variant="light"
            style={{
              flexShrink: 0,
            }}
          >
            <IconBox size={20} />
          </ThemeIcon>

          <Box
            style={{
              minWidth: 0,
              flex: 1,
              textAlign: "left",
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

            <Text
              size="xs"
              c="gray.4"
              mt={5}
            >
              {formatNumber(
                item.quantity_available
              )}{" "}
              {item.unit_abbreviation || ""}
              {" "}available
            </Text>

            <Text
              size="xs"
              c="gray.6"
              mt={3}
              lineClamp={1}
            >
              {item.default_bin_name ||
                "No storage assigned"}
            </Text>
          </Box>
        </Group>

        <MWStatusBadge
          status={item.stock_status}
          label={
            outOfStock
              ? "Out of Stock"
              : "Low Stock"
          }
          color={
            outOfStock
              ? "red"
              : "orange"
          }
          size="sm"
        />
      </Group>
    </Button>
  );
}

function InventoryDashboard({
  setPage,
  setSelectedInventoryItem,
  setSelectedInventoryBin,
}) {
  const [loading, setLoading] =
    useState(true);

  const [summary, setSummary] =
    useState({
      active_items: 0,
      active_stock_items: 0,
      available_items: 0,
      low_stock_items: 0,
      out_of_stock_items: 0,
      items_with_reservations: 0,
      total_quantity_on_hand: 0,
      total_quantity_reserved: 0,
      total_quantity_quarantined: 0,
      total_quantity_available: 0,
      total_inventory_value: 0,
    });

  const [
    inventoryItems,
    setInventoryItems,
  ] = useState([]);

  const [
    lowStockItems,
    setLowStockItems,
  ] = useState([]);

  const [
    binBalances,
    setBinBalances,
  ] = useState([]);

  const [bins, setBins] =
    useState([]);

  const [labels, setLabels] =
    useState([]);

  const [images, setImages] =
    useState([]);

  useEffect(() => {
    loadInventoryDashboard();
  }, []);

  async function loadInventoryDashboard() {
    setLoading(true);

    try {
      const [
        summaryResult,
        itemsResult,
        lowStockResult,
        binBalancesResult,
        binsResult,
        labelsResult,
        imagesResult,
      ] = await Promise.all([
        supabase
          .from(
            "inventory_dashboard_summary"
          )
          .select("*")
          .maybeSingle(),

        supabase
          .from(
            "inventory_item_availability"
          )
          .select("*")
          .order("name", {
            ascending: true,
          }),

        supabase
          .from("inventory_low_stock")
          .select("*")
          .limit(20),

        supabase
          .from(
            "inventory_bin_balances"
          )
          .select("*"),

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
            description,
            barcode_value,
            qr_code_value,
            is_receiving_bin,
            is_quarantine_bin,
            is_scrap_bin,
            is_active,
            created_at,
            updated_at,
            inventory_locations (
              id,
              name,
              code
            )
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
            label_type,
            inventory_item_id,
            bin_id,
            location_id,
            qr_token,
            barcode_value,
            print_count,
            last_printed_at,
            is_active
          `)
          .eq("is_active", true),

        supabase
          .from(
            "inventory_item_images"
          )
          .select(`
            id,
            inventory_item_id,
            is_primary,
            is_active
          `)
          .eq("is_active", true),
      ]);

      const results = [
        summaryResult,
        itemsResult,
        lowStockResult,
        binBalancesResult,
        binsResult,
        labelsResult,
        imagesResult,
      ];

      const failedResult =
        results.find(
          (result) => result.error
        );

      if (failedResult?.error) {
        throw failedResult.error;
      }

      setSummary(
        summaryResult.data || {
          active_items: 0,
          active_stock_items: 0,
          available_items: 0,
          low_stock_items: 0,
          out_of_stock_items: 0,
          items_with_reservations: 0,
          total_quantity_on_hand: 0,
          total_quantity_reserved: 0,
          total_quantity_quarantined: 0,
          total_quantity_available: 0,
          total_inventory_value: 0,
        }
      );

      setInventoryItems(
        itemsResult.data || []
      );

      setLowStockItems(
        lowStockResult.data || []
      );

      setBinBalances(
        binBalancesResult.data || []
      );

      setBins(binsResult.data || []);
      setLabels(labelsResult.data || []);
      setImages(imagesResult.data || []);
    } catch (error) {
      console.error(
        "Materials and inventory dashboard load error:",
        error
      );

      notifications.show({
        title:
          "Materials & Inventory Load Failed",
        message:
          error.message ||
          "Unable to load inventory information.",
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  }

  function openInventoryItem(item) {
    if (
      typeof setSelectedInventoryItem ===
      "function"
    ) {
      setSelectedInventoryItem(item);
    }

    setPage?.("inventoryItemDetails");
  }

  function openInventoryBin(position) {
    if (
      typeof setSelectedInventoryBin ===
      "function"
    ) {
      setSelectedInventoryBin(position);
    }

    setPage?.("inventoryStorage");
  }

  const imageItemIds = useMemo(
    () =>
      new Set(
        images
          .filter(
            (image) =>
              image.inventory_item_id
          )
          .map(
            (image) =>
              image.inventory_item_id
          )
      ),
    [images]
  );

  const itemQrIds = useMemo(
    () =>
      new Set(
        labels
          .filter(
            (label) =>
              label.label_type ===
                "item" &&
              label.inventory_item_id
          )
          .map(
            (label) =>
              label.inventory_item_id
          )
      ),
    [labels]
  );

  const binQrIds = useMemo(
    () =>
      new Set(
        labels
          .filter(
            (label) =>
              label.label_type ===
                "bin" &&
              label.bin_id
          )
          .map(
            (label) => label.bin_id
          )
      ),
    [labels]
  );

  const showroomItems = useMemo(
    () =>
      inventoryItems.filter(
        (item) =>
          item.is_active &&
          isShowroomItem(item)
      ),
    [inventoryItems]
  );

  const consumableItems = useMemo(
    () =>
      inventoryItems.filter(
        (item) =>
          item.is_active &&
          isConsumableItem(item)
      ),
    [inventoryItems]
  );

  const missingImages = useMemo(
    () =>
      inventoryItems.filter(
        (item) =>
          item.is_active &&
          !item.primary_image_url &&
          !item.primary_image_path &&
          !imageItemIds.has(
            item.inventory_item_id
          )
      ).length,
    [inventoryItems, imageItemIds]
  );

  const missingStorage = useMemo(
    () =>
      inventoryItems.filter(
        (item) =>
          item.is_active &&
          item.is_stock_item &&
          !item.default_bin_id
      ).length,
    [inventoryItems]
  );

  const missingQrLabels = useMemo(
    () =>
      inventoryItems.filter(
        (item) =>
          item.is_active &&
          !itemQrIds.has(
            item.inventory_item_id
          )
      ).length,
    [inventoryItems, itemQrIds]
  );

  const missingReorderPoints =
    useMemo(
      () =>
        inventoryItems.filter(
          (item) =>
            item.is_active &&
            item.is_stock_item &&
            isConsumableItem(item) &&
            numberValue(
              item.reorder_point
            ) <= 0
        ).length,
      [inventoryItems]
    );

  const itemsNeedingAttention =
    useMemo(() => {
      const itemIds = new Set();

      inventoryItems.forEach((item) => {
        if (!item.is_active) {
          return;
        }

        const missingImage =
          !item.primary_image_url &&
          !item.primary_image_path &&
          !imageItemIds.has(
            item.inventory_item_id
          );

        const missingQr =
          !itemQrIds.has(
            item.inventory_item_id
          );

        const needsReorderPoint =
          isConsumableItem(item) &&
          numberValue(
            item.reorder_point
          ) <= 0;

        const needsAttention =
          item.stock_status ===
            "Low Stock" ||
          item.stock_status ===
            "Out of Stock" ||
          !item.default_bin_id ||
          missingImage ||
          missingQr ||
          needsReorderPoint;

        if (needsAttention) {
          itemIds.add(
            item.inventory_item_id
          );
        }
      });

      return itemIds.size;
    }, [
      inventoryItems,
      imageItemIds,
      itemQrIds,
    ]);

  const healthyItems = Math.max(
    numberValue(summary.active_items) -
      itemsNeedingAttention,
    0
  );

  const healthScore =
    numberValue(summary.active_items) >
    0
      ? Math.round(
          (healthyItems /
            numberValue(
              summary.active_items
            )) *
            100
        )
      : 100;

  const healthColor =
    getHealthColor(healthScore);

  const categorySummary = useMemo(() => {
    const categoryMap = new Map();

    inventoryItems
      .filter((item) => item.is_active)
      .forEach((item) => {
        const category =
          item.category_name ||
          "Other";

        const current =
          categoryMap.get(category) || {
            category,
            count: 0,
            lowStock: 0,
            outOfStock: 0,
          };

        current.count += 1;

        if (
          item.stock_status ===
          "Low Stock"
        ) {
          current.lowStock += 1;
        }

        if (
          item.stock_status ===
          "Out of Stock"
        ) {
          current.outOfStock += 1;
        }

        categoryMap.set(
          category,
          current
        );
      });

    return Array.from(
      categoryMap.values()
    ).sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }

      return a.category.localeCompare(
        b.category
      );
    });
  }, [inventoryItems]);

  const storageAreas = useMemo(() => {
    const balancesByBin = new Map();

    binBalances.forEach((balance) => {
      const current =
        balancesByBin.get(
          balance.bin_id
        ) || {
          itemIds: new Set(),
          quantityOnHand: 0,
          quantityReserved: 0,
          availableQuantity: 0,
          lowStockCount: 0,
          outOfStockCount: 0,
        };

      current.itemIds.add(
        balance.inventory_item_id
      );

      current.quantityOnHand +=
        numberValue(
          balance.quantity_on_hand
        );

      current.quantityReserved +=
        numberValue(
          balance.quantity_reserved
        );

      current.availableQuantity +=
        numberValue(
          balance.quantity_available
        );

      balancesByBin.set(
        balance.bin_id,
        current
      );
    });

    const zoneMap = new Map();

    bins.forEach((bin) => {
      const zone =
        bin.zone || "Other Storage";

      const zoneEntry =
        zoneMap.get(zone) || {
          id: zone,
          name: zone,
          zone,
          color:
            getStorageAreaColor(zone),
          positions: [],
        };

      const balance =
        balancesByBin.get(bin.id) || {
          itemIds: new Set(),
          quantityOnHand: 0,
          quantityReserved: 0,
          availableQuantity: 0,
          lowStockCount: 0,
          outOfStockCount: 0,
        };

      const assignedItems =
        inventoryItems.filter(
          (item) =>
            item.default_bin_id ===
            bin.id
        );

      assignedItems.forEach((item) => {
        balance.itemIds.add(
          item.inventory_item_id
        );

        if (
          item.stock_status ===
          "Low Stock"
        ) {
          balance.lowStockCount += 1;
        }

        if (
          item.stock_status ===
          "Out of Stock"
        ) {
          balance.outOfStockCount += 1;
        }
      });

      zoneEntry.positions.push({
        id: bin.id,
        locationId: bin.location_id,
        name: bin.name,
        code: bin.code,
        zone: bin.zone,
        aisle: bin.aisle,
        rack: bin.rack,
        shelf: bin.shelf,
        position: bin.position,
        description: bin.description,
        qrCodeValue:
          bin.qr_code_value,
        barcodeValue:
          bin.barcode_value,
        itemCount:
          balance.itemIds.size,
        quantityOnHand:
          balance.quantityOnHand,
        quantityReserved:
          balance.quantityReserved,
        availableQuantity:
          balance.availableQuantity,
        lowStockCount:
          balance.lowStockCount,
        outOfStockCount:
          balance.outOfStockCount,
        showUtilization: false,
      });

      zoneMap.set(zone, zoneEntry);
    });

    return Array.from(
      zoneMap.values()
    ).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [
    bins,
    binBalances,
    inventoryItems,
  ]);

  const recentActivities = useMemo(
    () =>
      inventoryItems
        .filter(
          (item) => item.updated_at
        )
        .sort(
          (a, b) =>
            new Date(b.updated_at) -
            new Date(a.updated_at)
        )
        .slice(0, 8)
        .map((item) => {
          let type = "adjusted";
          let title =
            "Inventory item updated";
          let status = "Updated";

          if (
            item.stock_status ===
            "Out of Stock"
          ) {
            title =
              "Item requires restocking";
            status = "Out of Stock";
          } else if (
            item.stock_status ===
            "Low Stock"
          ) {
            title =
              "Item reached low stock";
            status = "Low Stock";
          } else if (
            numberValue(
              item.quantity_reserved
            ) > 0
          ) {
            type = "reserved";
            title =
              "Quantity reserved";
            status = "Reserved";
          }

          return {
            id: item.inventory_item_id,
            type,
            title,
            status,
            description: `${
              item.name
            } • ${formatNumber(
              item.quantity_available
            )} ${
              item.unit_abbreviation ||
              ""
            } available`,
            itemName: item.name,
            quantity:
              item.quantity_on_hand,
            date: item.updated_at,
          };
        }),
    [inventoryItems]
  );

  const quickActions = [
    {
      key: "add-showroom-item",
      label: "Add Showroom Item",
      description:
        "Create a sample, display piece, blank, or stocked component.",
      icon: IconShoppingBag,
      color: "red",
      onClick: () =>
        setPage?.(
          "newInventoryItem"
        ),
    },
    {
      key: "add-consumable",
      label: "Add Consumable",
      description:
        "Add powder, paint, tape, hardware, abrasives, or supplies.",
      icon: IconTool,
      color: "orange",
      onClick: () =>
        setPage?.(
          "newInventoryItem"
        ),
    },
    {
      key: "adjust-stock",
      label: "Update Quantity",
      description:
        "Count, receive, add, or correct the quantity on hand.",
      icon: IconAdjustments,
      color: "green",
      onClick: () =>
        setPage?.(
          "inventoryAdjustment"
        ),
    },
    {
      key: "view-inventory",
      label: "View All Items",
      description:
        "Search items, quantities, status, and storage positions.",
      icon: IconPackage,
      color: "blue",
      onClick: () =>
        setPage?.("inventoryItems"),
    },
    {
      key: "scan",
      label: "Scan QR Code",
      description:
        "Open an item and update its quantity from a phone.",
      icon: IconQrcode,
      color: "violet",
      onClick: () =>
        setPage?.(
          "inventoryScanner"
        ),
    },
    {
      key: "labels",
      label: "Print QR Labels",
      description:
        "Print labels for items, bins, shelves, racks, and cabinets.",
      icon: IconTag,
      color: "violet",
      onClick: () =>
        setPage?.(
          "inventoryLabels"
        ),
    },
  ];

  const kpiItems = [
    {
      key: "showroom-items",
      label: "Showroom Items",
      value: formatNumber(
        showroomItems.length,
        0
      ),
      description:
        "Samples, display pieces, and stocked components.",
      icon: IconBuildingStore,
      color: "violet",
      onClick: () =>
        setPage?.("inventoryItems"),
    },
    {
      key: "consumables",
      label: "Consumables",
      value: formatNumber(
        consumableItems.length,
        0
      ),
      description:
        "Powder, abrasives, tape, hardware, paint, and supplies.",
      icon: IconTool,
      color: "orange",
      onClick: () =>
        setPage?.("inventoryItems"),
    },
    {
      key: "low-stock",
      label: "Low Stock",
      value: formatNumber(
        summary.low_stock_items,
        0
      ),
      description:
        "Items at or below their reorder point.",
      icon: IconAlertTriangle,
      color:
        numberValue(
          summary.low_stock_items
        ) > 0
          ? "orange"
          : "green",
      onClick: () =>
        setPage?.("inventoryItems"),
    },
    {
      key: "out-of-stock",
      label: "Out of Stock",
      value: formatNumber(
        summary.out_of_stock_items,
        0
      ),
      description:
        "Items with no quantity currently available.",
      icon: IconBox,
      color:
        numberValue(
          summary.out_of_stock_items
        ) > 0
          ? "red"
          : "green",
      onClick: () =>
        setPage?.("inventoryItems"),
    },
    {
      key: "storage",
      label: "Storage Positions",
      value: formatNumber(
        bins.length,
        0
      ),
      description:
        "Bins, shelves, racks, cabinets, and staging areas.",
      icon: IconMapPin,
      color: "blue",
      onClick: () =>
        setPage?.(
          "inventoryStorage"
        ),
    },
    {
      key: "inventory-value",
      label: "Inventory Value",
      value: formatCurrency(
        summary.total_inventory_value
      ),
      description:
        "Estimated value of recorded quantity on hand.",
      icon: IconCash,
      color: "green",
      onClick: () =>
        setPage?.("inventoryItems"),
    },
  ];

  if (loading) {
    return (
      <>
        <MWPageHeader
          title="Materials & Inventory"
          subtitle="Loading showroom stock, consumables, quantities, and storage positions."
          setPage={setPage}
          showDashboard
        />

        <MWPanel
          title="Loading Materials & Inventory"
          subtitle="Retrieving item, quantity, storage, image, and QR-label information."
          icon={IconDatabase}
          color="red"
        >
          <Group
            justify="center"
            py={80}
            gap="md"
          >
            <Loader color="red" />

            <Text c="gray.4">
              Loading command center...
            </Text>
          </Group>
        </MWPanel>
      </>
    );
  }

  return (
    <>
      <MWPageHeader
        title="Materials & Inventory"
        subtitle="Showroom stock, finished samples, reusable components, consumables, and shop supplies."
        buttonText="Add Item"
        onButtonClick={() =>
          setPage?.(
            "newInventoryItem"
          )
        }
        setPage={setPage}
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

        <MWInventoryActionPanel
          title="Quick Actions"
          subtitle="The most common inventory tasks for showroom items and consumables."
          icon={IconStack2}
          actions={quickActions}
        />

        <MWPanel
          title="Inventory Health"
          subtitle="Shows whether items are ready to identify, locate, scan, count, and reorder."
          icon={IconChartBar}
          color={healthColor}
          rightSection={
            <MWStatusBadge
              status={
                getHealthLabel(
                  healthScore
                )
              }
              label={
                getHealthLabel(
                  healthScore
                )
              }
              color={healthColor}
              variant="light"
              size="md"
            />
          }
        >
          <SimpleGrid
            cols={{
              base: 1,
              lg: 12,
            }}
            spacing="xl"
          >
            <Box
              style={{
                gridColumn: "span 4",
                minWidth: 0,
              }}
            >
              <Stack gap="lg">
                <Group
                  justify="space-between"
                  align="flex-end"
                  gap="lg"
                  wrap="wrap"
                >
                  <Box>
                    <Text
                      size="xs"
                      c="gray.5"
                      fw={800}
                      tt="uppercase"
                      style={{
                        letterSpacing:
                          "0.07em",
                      }}
                    >
                      Overall Score
                    </Text>

                    <Text
                      fw={900}
                      size="42px"
                      c="gray.0"
                      mt={7}
                      style={{
                        lineHeight: 1,
                        letterSpacing:
                          "-0.045em",
                        fontVariantNumeric:
                          "tabular-nums",
                      }}
                    >
                      {healthScore}%
                    </Text>
                  </Box>

                  <Box ta="right">
                    <Text
                      size="xs"
                      c="gray.5"
                    >
                      Healthy records
                    </Text>

                    <Text
                      fw={850}
                      c="gray.1"
                      mt={3}
                    >
                      {healthyItems} of{" "}
                      {
                        summary.active_items
                      }
                    </Text>
                  </Box>
                </Group>

                <Progress
                  value={healthScore}
                  color={healthColor}
                  size={18}
                  radius="xl"
                  styles={{
                    root: {
                      backgroundColor:
                        "rgba(255,255,255,0.08)",
                    },
                  }}
                />

                <Text
                  size="sm"
                  c="gray.5"
                  style={{
                    lineHeight: 1.5,
                  }}
                >
                  The health score focuses on the information your team needs
                  to actually use inventory: storage, photos, QR labels, and
                  reorder points for consumables.
                </Text>
              </Stack>
            </Box>

            <Box
              style={{
                gridColumn: "span 8",
                minWidth: 0,
              }}
            >
              <SimpleGrid
                cols={{
                  base: 1,
                  sm: 2,
                }}
                spacing="sm"
              >
                <HealthRequirement
                  label="Storage Assigned"
                  description="Item has a bin, shelf, rack, cabinet, or shop area."
                  value={missingStorage}
                  icon={IconMapPin}
                  color="orange"
                  complete={
                    missingStorage === 0
                  }
                />

                <HealthRequirement
                  label="Reference Image"
                  description="Item has a photo for quick visual identification."
                  value={missingImages}
                  icon={IconPhoto}
                  color="blue"
                  complete={
                    missingImages === 0
                  }
                />

                <HealthRequirement
                  label="QR Label"
                  description="Item can be scanned for lookup and quantity updates."
                  value={missingQrLabels}
                  icon={IconQrcode}
                  color="violet"
                  complete={
                    missingQrLabels === 0
                  }
                />

                <HealthRequirement
                  label="Reorder Point"
                  description="Consumable has a minimum quantity for restocking."
                  value={
                    missingReorderPoints
                  }
                  icon={
                    IconClipboardList
                  }
                  color="orange"
                  complete={
                    missingReorderPoints ===
                    0
                  }
                />
              </SimpleGrid>
            </Box>
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
              gridColumn: "span 7",
              minWidth: 0,
            }}
          >
            <MWPanel
              title="Priority Alerts"
              subtitle="Items that need counting, restocking, labeling, or setup."
              icon={IconAlertTriangle}
              color="orange"
              fullHeight
              rightSection={
                <Button
                  variant="light"
                  color="gray"
                  size="xs"
                  leftSection={
                    <IconRefresh
                      size={15}
                    />
                  }
                  onClick={
                    loadInventoryDashboard
                  }
                >
                  Refresh
                </Button>
              }
            >
              <Stack gap={0}>
                <AlertRow
                  title="Out of Stock"
                  description="Items with no available quantity."
                  count={numberValue(
                    summary.out_of_stock_items
                  )}
                  color={
                    numberValue(
                      summary.out_of_stock_items
                    ) > 0
                      ? "red"
                      : "green"
                  }
                  icon={IconBox}
                  onClick={() =>
                    setPage?.(
                      "inventoryItems"
                    )
                  }
                />

                <AlertRow
                  title="Low Stock"
                  description="Items at or below their reorder point."
                  count={numberValue(
                    summary.low_stock_items
                  )}
                  color={
                    numberValue(
                      summary.low_stock_items
                    ) > 0
                      ? "orange"
                      : "green"
                  }
                  onClick={() =>
                    setPage?.(
                      "inventoryItems"
                    )
                  }
                />

                <AlertRow
                  title="Missing Storage"
                  description="Items without a bin, shelf, rack, cabinet, or area."
                  count={missingStorage}
                  color={
                    missingStorage > 0
                      ? "orange"
                      : "green"
                  }
                  icon={IconMapPin}
                  actionLabel="Assign"
                  onClick={() =>
                    setPage?.(
                      "inventoryItems"
                    )
                  }
                />

                <AlertRow
                  title="Missing Images"
                  description="Items without a reference photo."
                  count={missingImages}
                  color={
                    missingImages > 0
                      ? "blue"
                      : "green"
                  }
                  icon={IconPhoto}
                  onClick={() =>
                    setPage?.(
                      "inventoryItems"
                    )
                  }
                />

                <AlertRow
                  title="Missing QR Labels"
                  description="Items not ready for phone or tablet scanning."
                  count={missingQrLabels}
                  color={
                    missingQrLabels > 0
                      ? "violet"
                      : "green"
                  }
                  icon={IconQrcode}
                  actionLabel="Print"
                  onClick={() =>
                    setPage?.(
                      "inventoryLabels"
                    )
                  }
                />

                <AlertRow
                  title="Reorder Points"
                  description="Consumables missing a restocking threshold."
                  count={
                    missingReorderPoints
                  }
                  color={
                    missingReorderPoints >
                    0
                      ? "orange"
                      : "green"
                  }
                  icon={
                    IconClipboardList
                  }
                  actionLabel="Set Up"
                  onClick={() =>
                    setPage?.(
                      "inventoryItems"
                    )
                  }
                  showDivider={false}
                />
              </Stack>
            </MWPanel>
          </Box>

          <Box
            style={{
              gridColumn: "span 5",
              minWidth: 0,
            }}
          >
            <MWPanel
              title="Items by Category"
              subtitle="Current catalog grouped by item type."
              icon={IconPackage}
              color="blue"
              fullHeight
            >
              {categorySummary.length ===
              0 ? (
                <Stack
                  align="center"
                  justify="center"
                  mih={260}
                  gap="sm"
                >
                  <ThemeIcon
                    size={52}
                    radius="xl"
                    color="gray"
                    variant="light"
                  >
                    <IconPackage
                      size={26}
                    />
                  </ThemeIcon>

                  <Text
                    fw={850}
                    c="gray.3"
                  >
                    No inventory categories
                  </Text>

                  <Text
                    size="sm"
                    c="gray.5"
                    ta="center"
                  >
                    Categories will appear after items are added.
                  </Text>
                </Stack>
              ) : (
                <Stack gap={0}>
                  {categorySummary
                    .slice(0, 8)
                    .map(
                      (
                        category,
                        index
                      ) => (
                        <CategoryRow
                          key={
                            category.category
                          }
                          category={
                            category.category
                          }
                          count={
                            category.count
                          }
                          lowStock={
                            category.lowStock
                          }
                          outOfStock={
                            category.outOfStock
                          }
                          color={
                            index % 3 ===
                            0
                              ? "blue"
                              : index % 3 ===
                                  1
                                ? "orange"
                                : "violet"
                          }
                          onClick={() =>
                            setPage?.(
                              "inventoryItems"
                            )
                          }
                          showDivider={
                            index <
                            Math.min(
                              categorySummary.length,
                              8
                            ) -
                              1
                          }
                        />
                      )
                    )}
                </Stack>
              )}
            </MWPanel>
          </Box>
        </SimpleGrid>

        {lowStockItems.length > 0 && (
          <MWPanel
            title="Items to Review"
            subtitle="The highest-priority items currently showing low or unavailable stock."
            icon={IconAlertTriangle}
            color="orange"
            actionLabel="View All Items"
            onAction={() =>
              setPage?.("inventoryItems")
            }
            compact
          >
            <SimpleGrid
              cols={{
                base: 1,
                md: 2,
              }}
              spacing="sm"
            >
              {lowStockItems
                .slice(0, 8)
                .map((item) => (
                  <ReviewItemCard
                    key={
                      item.inventory_item_id
                    }
                    item={item}
                    onClick={() =>
                      openInventoryItem(
                        item
                      )
                    }
                  />
                ))}
            </SimpleGrid>
          </MWPanel>
        )}

        <MWInventoryTimeline
          title="Recent Inventory Activity"
          subtitle="Recent item updates, quantity changes, and stock conditions."
          activities={
            recentActivities
          }
          actionLabel="Inventory History"
          onAction={() =>
            setPage?.(
              "inventoryHistory"
            )
          }
          maxHeight={500}
        />

        <MWInventoryStorageCard
          title="Inventory by Shop Area"
          subtitle="Showroom bins, department shelves, cabinets, shop racks, and storage positions."
          storageAreas={storageAreas}
          totalPositions={bins.length}
          totalItems={numberValue(
            summary.active_items
          )}
          qrEnabledPositions={
            bins.filter((bin) =>
              binQrIds.has(bin.id)
            ).length
          }
          actionLabel="Manage Storage"
          onAction={() =>
            setPage?.(
              "inventoryStorage"
            )
          }
          onSelectPosition={
            openInventoryBin
          }
        />
      </Stack>
    </>
  );
}

export default InventoryDashboard;