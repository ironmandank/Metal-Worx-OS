import {
  Alert,
  Avatar,
  Badge,
  Box,
  Button,
  Divider,
  Group,
  Loader,
  Paper,
  SimpleGrid,
  Stack,
  Table,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconAdjustments,
  IconAlertTriangle,
  IconArchive,
  IconArrowLeft,
  IconBarcode,
  IconBox,
  IconBuildingWarehouse,
  IconCalendar,
  IconCategory,
  IconCircleCheck,
  IconClock,
  IconEdit,
  IconHash,
  IconHistory,
  IconMapPin,
  IconPackage,
  IconPackageImport,
  IconPrinter,
  IconQrcode,
  IconRefresh,
  IconRestore,
  IconRulerMeasure,
  IconStar,
  IconTool,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { supabase } from "../lib/supabase";
import MWKpiStrip from "../components/ui/MWKpiStrip";
import MWPageHeader from "../components/ui/MWPageHeader";
import MWPanel from "../components/ui/MWPanel";
import MWStatusBadge from "../components/ui/MWStatusBadge";
import InventoryImageCapture from "../components/inventory/InventoryImageCapture";

function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value, maximumFractionDigits = 2) {
  return numberValue(value).toLocaleString("en-US", {
    maximumFractionDigits,
  });
}

function formatCurrency(value) {
  return numberValue(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function getItemId(item) {
  return item?.inventory_item_id || item?.id || null;
}

function getMovementType(movement) {
  return (
    movement.movement_type ||
    movement.transaction_type ||
    movement.type ||
    "Inventory Movement"
  );
}

function getMovementQuantity(movement) {
  return numberValue(
    movement.quantity_change ??
      movement.quantity ??
      movement.adjustment_quantity
  );
}

function getMovementColor(movement) {
  const type = getMovementType(movement).toLowerCase();
  const quantity = getMovementQuantity(movement);

  if (type.includes("receive") || type.includes("return") || quantity > 0) {
    return "green";
  }

  if (type.includes("remove") || type.includes("issue") || quantity < 0) {
    return "orange";
  }

  if (type.includes("count") || type.includes("adjust")) {
    return "blue";
  }

  return "gray";
}

function InformationRow({ icon: Icon, label, value }) {
  return (
    <Group justify="space-between" align="flex-start" wrap="nowrap" py={10}>
      <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
        <ThemeIcon size={32} radius="md" color="gray" variant="light">
          <Icon size={16} />
        </ThemeIcon>
        <Text size="sm" c="dimmed" fw={700}>
          {label}
        </Text>
      </Group>
      <Text size="sm" fw={800} ta="right" maw="62%">
        {value || "—"}
      </Text>
    </Group>
  );
}

function DetailField({ icon: Icon, label, value }) {
  return (
    <Paper
      p="md"
      radius="md"
      style={{
        minHeight: 92,
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      <Group gap="xs" mb={10} wrap="nowrap">
        <ThemeIcon size={28} radius="md" color="gray" variant="light">
          <Icon size={14} />
        </ThemeIcon>
        <Text size="xs" c="dimmed" fw={800} tt="uppercase">
          {label}
        </Text>
      </Group>
      <Text size="sm" fw={850} c="gray.1" style={{ overflowWrap: "anywhere" }}>
        {value || "—"}
      </Text>
    </Paper>
  );
}

function InventoryItemDetails({
  setPage,
  selectedInventoryItem,
  setSelectedInventoryItem,
  setSelectedInventoryBin,
}) {
  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState(selectedInventoryItem || null);
  const [binBalances, setBinBalances] = useState([]);
  const [labels, setLabels] = useState([]);
  const [images, setImages] = useState([]);
  const [movements, setMovements] = useState([]);
  const [pendingImage, setPendingImage] = useState(null);
  const [savingImage, setSavingImage] = useState(false);

  const itemId = getItemId(selectedInventoryItem || item);

  const loadItemDetails = useCallback(async () => {
    if (!itemId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const [
        itemResult,
        balancesResult,
        labelsResult,
        imagesResult,
        movementsResult,
      ] = await Promise.all([
        supabase
          .from("inventory_item_availability")
          .select("*")
          .eq("inventory_item_id", itemId)
          .maybeSingle(),

        supabase
          .from("inventory_bin_balances")
          .select("*")
          .eq("inventory_item_id", itemId),

        supabase
          .from("inventory_labels")
          .select("*")
          .eq("inventory_item_id", itemId)
          .eq("is_active", true),

        supabase
          .from("inventory_item_images")
          .select("*")
          .eq("inventory_item_id", itemId)
          .order("is_active", { ascending: false })
          .order("is_primary", { ascending: false })
          .order("created_at", { ascending: false }),

        supabase
          .from("inventory_movements")
          .select("*")
          .eq("inventory_item_id", itemId)
          .order("created_at", { ascending: false })
          .limit(12),
      ]);

      const requiredResults = [
        itemResult,
        balancesResult,
        labelsResult,
        imagesResult,
      ];

      const failedRequiredResult = requiredResults.find(
        (result) => result.error
      );

      if (failedRequiredResult?.error) {
        throw failedRequiredResult.error;
      }

      if (itemResult.data) {
        setItem(itemResult.data);
      }
      setBinBalances(balancesResult.data || []);
      setLabels(labelsResult.data || []);
      setImages(imagesResult.data || []);

      if (movementsResult.error) {
        console.warn(
          "Inventory movements are not available yet:",
          movementsResult.error
        );
        setMovements([]);
      } else {
        setMovements(movementsResult.data || []);
      }
    } catch (error) {
      console.error("Inventory item details load error:", error);
      notifications.show({
        title: "Inventory Item Load Failed",
        message: error.message || "Unable to load this inventory item.",
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useEffect(() => {
    loadItemDetails();
  }, [loadItemDetails]);

  const primaryImage = useMemo(() => {
    const activeImages = images.filter(
      (image) => image.is_active !== false
    );

    return (
      activeImages.find((image) => image.is_primary)?.image_url ||
      activeImages.find((image) => image.is_primary)?.url ||
      activeImages.find((image) => image.is_primary)?.public_url ||
      activeImages[0]?.image_url ||
      activeImages[0]?.url ||
      activeImages[0]?.public_url ||
      item?.primary_image_url ||
      null
    );
  }, [images, item]);

  const activeImages = useMemo(
    () =>
      images.filter(
        (image) => image.is_active !== false
      ),
    [images]
  );

  const archivedImages = useMemo(
    () =>
      images.filter(
        (image) => image.is_active === false
      ),
    [images]
  );

  function getImageUrl(image) {
    return (
      image?.image_url ||
      image?.url ||
      image?.public_url ||
      null
    );
  }

  const activeItemLabel = useMemo(() => {
    return labels.find((label) => label.label_type === "item") || labels[0] || null;
  }, [labels]);

  const locationText = useMemo(() => {
    return [item?.default_bin_code, item?.default_bin_name]
      .filter(Boolean)
      .join(" · ") || "Unassigned";
  }, [item]);

  function openAction(pageName) {
    if (!item) return;
    setSelectedInventoryItem?.(item);
    setPage?.(pageName);
  }

  function openBin(balance) {
    const bin = {
      id: balance.bin_id,
      name: balance.bin_name,
      code: balance.bin_code,
      zone: balance.zone,
    };

    setSelectedInventoryBin?.(bin);
    setPage?.("inventoryStorage");
  }

  async function saveItemImage() {
    if (!pendingImage || !itemId || savingImage) return;

    setSavingImage(true);

    try {
      const extension =
        pendingImage.name.split(".").pop()?.toLowerCase() || "jpg";
      const safeName = slugify(item?.name) || String(itemId);
      const storagePath =
        `${itemId}/${Date.now()}-${safeName}.${extension}`;

      const uploadResult = await supabase.storage
        .from("inventory-images")
        .upload(storagePath, pendingImage, {
          cacheControl: "3600",
          upsert: false,
          contentType: pendingImage.type || undefined,
        });

      if (uploadResult.error) throw uploadResult.error;

      const publicUrlResult = supabase.storage
        .from("inventory-images")
        .getPublicUrl(storagePath);
      const publicUrl = publicUrlResult.data?.publicUrl || null;

      const imageInsertResult = await supabase
        .from("inventory_item_images")
        .insert({
          inventory_item_id: itemId,
          storage_bucket: "inventory-images",
          storage_path: storagePath,
          public_url: publicUrl,
          file_name: pendingImage.name,
          mime_type: pendingImage.type || null,
          file_size_bytes: pendingImage.size || null,
          alt_text: item?.name || null,
          caption: item?.description || null,
          sort_order: 0,
          is_primary: false,
          is_active: true,
        })
        .select("*")
        .single();

      if (imageInsertResult.error) throw imageInsertResult.error;

      const archivePreviousResult = await supabase
        .from("inventory_item_images")
        .update({
          is_primary: false,
          is_active: false,
        })
        .eq("inventory_item_id", itemId)
        .eq("is_primary", true)
        .neq("id", imageInsertResult.data.id);

      if (archivePreviousResult.error) {
        throw archivePreviousResult.error;
      }

      const activateNewResult = await supabase
        .from("inventory_item_images")
        .update({
          is_primary: true,
          is_active: true,
        })
        .eq("id", imageInsertResult.data.id);

      if (activateNewResult.error) {
        throw activateNewResult.error;
      }

      const itemUpdateResult = await supabase
        .from("inventory_items")
        .update({
          primary_image_url: publicUrl,
          primary_image_path: storagePath,
          image_alt_text: item?.name || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", itemId);

      if (itemUpdateResult.error) throw itemUpdateResult.error;

      setPendingImage(null);
      notifications.show({
        title: "Inventory Image Saved",
        message:
          "The new photo is primary and the previous primary image was archived.",
        color: "green",
      });
      await loadItemDetails();
    } catch (error) {
      console.error("Inventory image save error:", error);
      notifications.show({
        title: "Image Upload Failed",
        message: error.message || "The inventory image could not be saved.",
        color: "red",
      });
    } finally {
      setSavingImage(false);
    }
  }

  async function makePrimaryImage(image) {
    const imageUrl = getImageUrl(image);

    if (!image?.id || !imageUrl || savingImage) {
      return;
    }

    setSavingImage(true);

    try {
      const clearPrimaryResult = await supabase
        .from("inventory_item_images")
        .update({ is_primary: false })
        .eq("inventory_item_id", itemId)
        .eq("is_primary", true);

      if (clearPrimaryResult.error) {
        throw clearPrimaryResult.error;
      }

      const setPrimaryResult = await supabase
        .from("inventory_item_images")
        .update({
          is_primary: true,
          is_active: true,
        })
        .eq("id", image.id);

      if (setPrimaryResult.error) {
        throw setPrimaryResult.error;
      }

      const itemUpdateResult = await supabase
        .from("inventory_items")
        .update({
          primary_image_url: imageUrl,
          primary_image_path:
            image.storage_path || null,
          image_alt_text:
            image.alt_text ||
            item?.name ||
            null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", itemId);

      if (itemUpdateResult.error) {
        throw itemUpdateResult.error;
      }

      notifications.show({
        title: "Primary Image Updated",
        message:
          "This photo is now displayed as the item's primary image.",
        color: "green",
      });

      await loadItemDetails();
    } catch (error) {
      console.error(
        "Primary inventory image update error:",
        error
      );

      notifications.show({
        title: "Primary Image Update Failed",
        message:
          error.message ||
          "The primary inventory image could not be changed.",
        color: "red",
      });
    } finally {
      setSavingImage(false);
    }
  }

  async function archiveImage(image) {
    if (!image?.id || savingImage) {
      return;
    }

    setSavingImage(true);

    try {
      const remainingImages = activeImages.filter(
        (candidate) =>
          candidate.id !== image.id
      );

      const nextPrimary =
        remainingImages.find(
          (candidate) => candidate.is_primary
        ) ||
        remainingImages[0] ||
        null;

      const archiveResult = await supabase
        .from("inventory_item_images")
        .update({
          is_active: false,
          is_primary: false,
        })
        .eq("id", image.id);

      if (archiveResult.error) {
        throw archiveResult.error;
      }

      if (image.is_primary && nextPrimary) {
        const nextImageUrl =
          getImageUrl(nextPrimary);

        const nextPrimaryResult =
          await supabase
            .from("inventory_item_images")
            .update({
              is_active: true,
              is_primary: true,
            })
            .eq("id", nextPrimary.id);

        if (nextPrimaryResult.error) {
          throw nextPrimaryResult.error;
        }

        const itemUpdateResult = await supabase
          .from("inventory_items")
          .update({
            primary_image_url:
              nextImageUrl,
            primary_image_path:
              nextPrimary.storage_path ||
              null,
            image_alt_text:
              nextPrimary.alt_text ||
              item?.name ||
              null,
            updated_at:
              new Date().toISOString(),
          })
          .eq("id", itemId);

        if (itemUpdateResult.error) {
          throw itemUpdateResult.error;
        }
      } else if (
        image.is_primary &&
        !nextPrimary
      ) {
        const itemUpdateResult = await supabase
          .from("inventory_items")
          .update({
            primary_image_url: null,
            primary_image_path: null,
            image_alt_text: null,
            updated_at:
              new Date().toISOString(),
          })
          .eq("id", itemId);

        if (itemUpdateResult.error) {
          throw itemUpdateResult.error;
        }
      }

      notifications.show({
        title: "Image Archived",
        message:
          "The photo was removed from active use but remains available for restoration.",
        color: "orange",
      });

      await loadItemDetails();
    } catch (error) {
      console.error(
        "Inventory image archive error:",
        error
      );

      notifications.show({
        title: "Image Archive Failed",
        message:
          error.message ||
          "The inventory image could not be archived.",
        color: "red",
      });
    } finally {
      setSavingImage(false);
    }
  }

  async function restoreImage(image) {
    if (!image?.id || savingImage) {
      return;
    }

    setSavingImage(true);

    try {
      const restoreResult = await supabase
        .from("inventory_item_images")
        .update({
          is_active: true,
          is_primary: false,
        })
        .eq("id", image.id);

      if (restoreResult.error) {
        throw restoreResult.error;
      }

      notifications.show({
        title: "Image Restored",
        message:
          "The photo is active again. You can make it the primary image if needed.",
        color: "green",
      });

      await loadItemDetails();
    } catch (error) {
      console.error(
        "Inventory image restore error:",
        error
      );

      notifications.show({
        title: "Image Restore Failed",
        message:
          error.message ||
          "The inventory image could not be restored.",
        color: "red",
      });
    } finally {
      setSavingImage(false);
    }
  }

  if (loading) {
    return (
      <Stack gap="xl">
        <MWPageHeader
          title="Inventory Item"
          subtitle="Loading item availability, storage, labels, and history."
          setPage={setPage}
          showBack
          backPage="inventoryItems"
          backLabel="Inventory Items"
          showDashboard={false}
        />

        <MWPanel>
          <Group justify="center" py={90}>
            <Loader color="red" />
            <Text c="dimmed">Loading inventory item…</Text>
          </Group>
        </MWPanel>
      </Stack>
    );
  }

  if (!itemId || !item) {
    return (
      <Stack gap="xl">
        <MWPageHeader
          title="Inventory Item"
          subtitle="No inventory item is currently selected."
          setPage={setPage}
          showBack
          backPage="inventoryItems"
          backLabel="Inventory Items"
          showDashboard={false}
        />

        <MWPanel>
          <Stack align="center" py={70} gap="md">
            <ThemeIcon size={70} radius="xl" color="yellow" variant="light">
              <IconAlertTriangle size={34} />
            </ThemeIcon>
            <Title order={3}>Select or scan an inventory item</Title>
            <Text c="dimmed" ta="center" maw={520}>
              Open an item from the Inventory Items catalog or scan its Metal Worx label.
            </Text>
            <Group>
              <Button
                variant="light"
                color="gray"
                leftSection={<IconArrowLeft size={18} />}
                onClick={() => setPage?.("inventoryItems")}
              >
                Inventory Items
              </Button>
              <Button
                color="red"
                leftSection={<IconQrcode size={18} />}
                onClick={() => setPage?.("inventoryScanner")}
              >
                Scan Inventory
              </Button>
            </Group>
          </Stack>
        </MWPanel>
      </Stack>
    );
  }

  return (
    <Stack gap="xl">
      <MWPageHeader
        title={item.name || "Inventory Item"}
        subtitle={`${item.item_number || item.sku || "No item number"} · ${item.category_name || "Uncategorized"}`}
        setPage={setPage}
        showBack
        backPage="inventoryItems"
        backLabel="Inventory Items"
        showDashboard={false}
      />

      <MWKpiStrip
        items={[
          {
            label: "On Hand",
            value: formatNumber(item.quantity_on_hand),
            description: item.unit_abbreviation || "Current quantity",
            icon: IconBox,
            color: "blue",
          },
          {
            label: "Available",
            value: formatNumber(item.quantity_available),
            description: "Ready to use",
            icon: IconCircleCheck,
            color: numberValue(item.quantity_available) > 0 ? "green" : "red",
          },
          {
            label: "Reserved",
            value: formatNumber(item.quantity_reserved),
            description: "Committed quantity",
            icon: IconPackage,
            color: "violet",
          },
          {
            label: "Recorded Value",
            value: formatCurrency(item.inventory_value),
            description: "Current recorded stock",
            icon: IconTool,
            color: "orange",
          },
        ]}
        columns={{ base: 1, sm: 2, xl: 4 }}
        compact
      />

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="xl">
        <MWPanel
          title="Item Overview"
          subtitle="Identification and primary image"
          icon={IconPackage}
        >
          <Stack gap="lg">
            <Paper
              radius="lg"
              p="lg"
              style={{
                minHeight: 280,
                background: "rgba(255,255,255,0.025)",
                border: "1px solid rgba(255,255,255,0.075)",
              }}
            >
              <Stack align="center" justify="center" h="100%" gap="md">
                <Avatar
                  src={primaryImage}
                  alt={item.image_alt_text || item.name}
                  radius="md"
                  size={210}
                  color="dark"
                >
                  <IconBox size={72} stroke={1.2} />
                </Avatar>
                <MWStatusBadge
                  status={item.stock_status || (item.is_active ? "Available" : "Inactive")}
                  label={item.stock_status || (item.is_active ? "Available" : "Inactive")}
                />
              </Stack>
            </Paper>

            <InventoryImageCapture
              value={pendingImage}
              onChange={setPendingImage}
              label={primaryImage ? "Replace Item Image" : "Add Item Image"}
              description="Upload a file or take a photo with the computer or connected USB camera."
            />

            {pendingImage && (
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                <Button
                  fullWidth
                  variant="default"
                  disabled={savingImage}
                  onClick={() => setPendingImage(null)}
                >
                  Cancel New Image
                </Button>
                <Button
                  fullWidth
                  color="red"
                  loading={savingImage}
                  onClick={saveItemImage}
                >
                  Save as Primary Image
                </Button>
              </SimpleGrid>
            )}

            {images.length > 0 && (
              <Stack gap="md">
                <Divider
                  label="Image Library"
                  labelPosition="center"
                />

                {activeImages.length > 0 && (
                  <Box>
                    <Group
                      justify="space-between"
                      mb="sm"
                    >
                      <Text
                        size="xs"
                        fw={900}
                        tt="uppercase"
                        c="gray.4"
                      >
                        Active Images
                      </Text>

                      <Badge
                        color="green"
                        variant="light"
                      >
                        {activeImages.length}
                      </Badge>
                    </Group>

                    <SimpleGrid
                      cols={{
                        base: 1,
                        sm: 2,
                      }}
                      spacing="sm"
                    >
                      {activeImages.map(
                        (image) => (
                          <Paper
                            key={image.id}
                            p="sm"
                            radius="md"
                            style={{
                              border: image.is_primary
                                ? "1px solid rgba(34, 197, 94, 0.55)"
                                : "1px solid rgba(255,255,255,0.08)",
                              background:
                                "rgba(255,255,255,0.025)",
                            }}
                          >
                            <Stack gap="sm">
                              <Box
                                component="img"
                                src={getImageUrl(
                                  image
                                )}
                                alt={
                                  image.alt_text ||
                                  item.name
                                }
                                style={{
                                  width: "100%",
                                  aspectRatio:
                                    "4 / 3",
                                  objectFit:
                                    "contain",
                                  borderRadius: 8,
                                  background:
                                    "#090b0d",
                                }}
                              />

                              <Group
                                justify="space-between"
                                gap="xs"
                              >
                                <Box
                                  style={{
                                    minWidth: 0,
                                  }}
                                >
                                  <Text
                                    size="xs"
                                    fw={800}
                                    truncate
                                  >
                                    {image.file_name ||
                                      "Inventory image"}
                                  </Text>

                                  <Text
                                    size="xs"
                                    c="dimmed"
                                  >
                                    {formatDateTime(
                                      image.created_at
                                    )}
                                  </Text>
                                </Box>

                                {image.is_primary && (
                                  <Badge
                                    color="green"
                                    variant="light"
                                    leftSection={
                                      <IconStar
                                        size={11}
                                      />
                                    }
                                  >
                                    Primary
                                  </Badge>
                                )}
                              </Group>

                              <SimpleGrid
                                cols={
                                  image.is_primary
                                    ? 1
                                    : 2
                                }
                                spacing="xs"
                              >
                                {!image.is_primary && (
                                  <Button
                                    size="xs"
                                    color="green"
                                    variant="light"
                                    leftSection={
                                      <IconStar
                                        size={15}
                                      />
                                    }
                                    loading={
                                      savingImage
                                    }
                                    onClick={() =>
                                      makePrimaryImage(
                                        image
                                      )
                                    }
                                  >
                                    Make Primary
                                  </Button>
                                )}

                                <Button
                                  size="xs"
                                  color="orange"
                                  variant="light"
                                  leftSection={
                                    <IconArchive
                                      size={15}
                                    />
                                  }
                                  loading={
                                    savingImage
                                  }
                                  onClick={() =>
                                    archiveImage(
                                      image
                                    )
                                  }
                                >
                                  Archive
                                </Button>
                              </SimpleGrid>
                            </Stack>
                          </Paper>
                        )
                      )}
                    </SimpleGrid>
                  </Box>
                )}

                {archivedImages.length > 0 && (
                  <Box>
                    <Group
                      justify="space-between"
                      mb="sm"
                    >
                      <Text
                        size="xs"
                        fw={900}
                        tt="uppercase"
                        c="gray.5"
                      >
                        Archived Images
                      </Text>

                      <Badge
                        color="gray"
                        variant="light"
                      >
                        {archivedImages.length}
                      </Badge>
                    </Group>

                    <SimpleGrid
                      cols={{
                        base: 1,
                        sm: 2,
                      }}
                      spacing="sm"
                    >
                      {archivedImages.map(
                        (image) => (
                          <Paper
                            key={image.id}
                            p="sm"
                            radius="md"
                            style={{
                              border:
                                "1px solid rgba(255,255,255,0.065)",
                              background:
                                "rgba(255,255,255,0.018)",
                              opacity: 0.78,
                            }}
                          >
                            <Stack gap="sm">
                              <Box
                                component="img"
                                src={getImageUrl(
                                  image
                                )}
                                alt={
                                  image.alt_text ||
                                  item.name
                                }
                                style={{
                                  width: "100%",
                                  aspectRatio:
                                    "4 / 3",
                                  objectFit:
                                    "contain",
                                  borderRadius: 8,
                                  background:
                                    "#090b0d",
                                  filter:
                                    "grayscale(0.35)",
                                }}
                              />

                              <Text
                                size="xs"
                                fw={800}
                                truncate
                              >
                                {image.file_name ||
                                  "Archived image"}
                              </Text>

                              <Button
                                size="xs"
                                color="blue"
                                variant="light"
                                leftSection={
                                  <IconRestore
                                    size={15}
                                  />
                                }
                                loading={
                                  savingImage
                                }
                                onClick={() =>
                                  restoreImage(
                                    image
                                  )
                                }
                              >
                                Restore Image
                              </Button>
                            </Stack>
                          </Paper>
                        )
                      )}
                    </SimpleGrid>
                  </Box>
                )}
              </Stack>
            )}

            <Group grow>
              <Button
                variant="light"
                color="gray"
                leftSection={<IconEdit size={18} />}
                onClick={() => openAction("editInventoryItem")}
              >
                Edit Item
              </Button>
              <Button
                color="red"
                leftSection={<IconRefresh size={18} />}
                onClick={loadItemDetails}
              >
                Refresh
              </Button>
            </Group>
          </Stack>
        </MWPanel>

        <Box>
          <MWPanel
            title="Inventory Control"
            subtitle="Live item information and common actions"
            icon={IconAdjustments}
          >
            <Stack gap="lg">
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
                <DetailField icon={IconHash} label="Item Number" value={item.item_number} />
                <DetailField icon={IconBarcode} label="SKU" value={item.sku} />
                <DetailField icon={IconCategory} label="Category" value={item.category_name} />
                <DetailField icon={IconMapPin} label="Default Storage" value={locationText} />
                {item.dimensions && (
                  <DetailField icon={IconRulerMeasure} label="Dimensions" value={item.dimensions} />
                )}
                {item.manufacturer && (
                  <DetailField icon={IconTool} label="Manufacturer" value={item.manufacturer} />
                )}
                {item.manufacturer_part_number && (
                  <DetailField
                    icon={IconBarcode}
                    label="Manufacturer Part"
                    value={item.manufacturer_part_number}
                  />
                )}
                <DetailField icon={IconCalendar} label="Updated" value={formatDateTime(item.updated_at)} />
              </SimpleGrid>

              {item.description && (
                <>
                  <Divider />
                  <Box>
                    <Text size="xs" c="dimmed" fw={800} tt="uppercase" mb={6}>
                      Description
                    </Text>
                    <Text>{item.description}</Text>
                  </Box>
                </>
              )}

              <Divider />

              <SimpleGrid cols={1} spacing="sm">
                <Button
                  h={54}
                  fullWidth
                  color="yellow"
                  variant="light"
                  leftSection={<IconAdjustments size={20} />}
                  onClick={() => openAction("inventoryAdjustment")}
                >
                  Update Quantity
                </Button>
                <Button
                  h={54}
                  fullWidth
                  color="green"
                  variant="light"
                  leftSection={<IconPackageImport size={20} />}
                  onClick={() => openAction("inventoryReceiving")}
                >
                  Receive Stock
                </Button>
                <Button
                  h={54}
                  fullWidth
                  color="grape"
                  variant="light"
                  leftSection={<IconPrinter size={20} />}
                  onClick={() => openAction("inventoryLabels")}
                >
                  Print Label
                </Button>
                <Button
                  h={54}
                  fullWidth
                  color="gray"
                  variant="light"
                  leftSection={<IconHistory size={20} />}
                  onClick={() => openAction("inventoryHistory")}
                >
                  Full History
                </Button>
              </SimpleGrid>
            </Stack>
          </MWPanel>
        </Box>
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="xl">
        <MWPanel
          title="Storage Positions"
          subtitle="Current on-hand balances by physical location"
          icon={IconBuildingWarehouse}
        >
          {binBalances.length === 0 ? (
            <Alert color="gray" icon={<IconMapPin size={19} />}>
              This item does not currently have a recorded storage balance.
            </Alert>
          ) : (
            <Stack gap="sm">
              {binBalances.map((balance) => (
                <Paper
                  key={balance.bin_id || balance.id}
                  p="md"
                  radius="md"
                  withBorder
                  style={{ cursor: balance.bin_id ? "pointer" : "default" }}
                  onClick={() => balance.bin_id && openBin(balance)}
                >
                  <Group justify="space-between" wrap="nowrap">
                    <Group gap="sm" wrap="nowrap">
                      <ThemeIcon color="red" variant="light" radius="md">
                        <IconMapPin size={18} />
                      </ThemeIcon>
                      <Box>
                        <Text fw={800}>
                          {balance.bin_name || balance.storage_name || "Storage Position"}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {[balance.bin_code, balance.zone].filter(Boolean).join(" · ") || "No position code"}
                        </Text>
                      </Box>
                    </Group>
                    <Badge color="red" variant="light" size="lg">
                      {formatNumber(balance.quantity_on_hand)}
                    </Badge>
                  </Group>
                </Paper>
              ))}
            </Stack>
          )}
        </MWPanel>

        <MWPanel
          title="Label Information"
          subtitle="QR and barcode assignment for this item"
          icon={IconQrcode}
        >
          {activeItemLabel ? (
            <Stack gap="sm">
              <InformationRow icon={IconQrcode} label="QR Value" value={activeItemLabel.qr_token} />
              <Divider />
              <InformationRow icon={IconBarcode} label="Barcode Value" value={activeItemLabel.barcode_value} />
              <Divider />
              <InformationRow icon={IconPrinter} label="Print Count" value={formatNumber(activeItemLabel.print_count, 0)} />
              <Divider />
              <InformationRow icon={IconClock} label="Last Printed" value={formatDateTime(activeItemLabel.last_printed_at)} />
              <Button
                mt="sm"
                color="red"
                leftSection={<IconPrinter size={18} />}
                onClick={() => openAction("inventoryLabels")}
              >
                Print Item Label
              </Button>
            </Stack>
          ) : (
            <Stack align="center" py={25} gap="md">
              <ThemeIcon size={58} radius="xl" color="yellow" variant="light">
                <IconAlertTriangle size={28} />
              </ThemeIcon>
              <Text fw={800}>No active item label</Text>
              <Text size="sm" c="dimmed" ta="center">
                Generate a QR and Code 128 label before using the physical scanner.
              </Text>
              <Button
                color="red"
                leftSection={<IconPrinter size={18} />}
                onClick={() => openAction("inventoryLabels")}
              >
                Create Label
              </Button>
            </Stack>
          )}
        </MWPanel>
      </SimpleGrid>

      <MWPanel
        title="Recent Inventory Activity"
        subtitle="The latest receipts, removals, transfers, adjustments, and counts"
        icon={IconHistory}
      >
        {movements.length === 0 ? (
          <Alert color="gray" icon={<IconHistory size={19} />}>
            No inventory movement history is available for this item yet.
          </Alert>
        ) : (
          <Table verticalSpacing="sm" horizontalSpacing="md" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Date</Table.Th>
                <Table.Th>Movement</Table.Th>
                <Table.Th>Quantity</Table.Th>
                <Table.Th>Reference</Table.Th>
                <Table.Th>Notes</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {movements.map((movement) => {
                const quantity = getMovementQuantity(movement);
                return (
                  <Table.Tr key={movement.id}>
                    <Table.Td>
                      <Text size="sm" fw={700}>
                        {formatDateTime(movement.created_at)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={getMovementColor(movement)} variant="light">
                        {getMovementType(movement)}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text fw={850} c={quantity > 0 ? "green.3" : quantity < 0 ? "orange.3" : "gray.3"}>
                        {quantity > 0 ? "+" : ""}{formatNumber(quantity)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {movement.reference_number || movement.reference_type || "—"}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed" lineClamp={2}>
                        {movement.notes || movement.reason || "—"}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        )}
      </MWPanel>
    </Stack>
  );
}

export default InventoryItemDetails;