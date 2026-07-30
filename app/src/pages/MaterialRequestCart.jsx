import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import {
  IconAlertTriangle,
  IconBarcode,
  IconCheck,
  IconClock,
  IconFlame,
  IconPackage,
  IconPlus,
  IconQrcode,
  IconRefresh,
  IconSearch,
  IconSend,
  IconShoppingCart,
  IconTrash,
  IconUser,
} from "@tabler/icons-react";

import MWKpiStrip from "../components/ui/MWKpiStrip";
import MWPageHeader from "../components/ui/MWPageHeader";
import MWPanel from "../components/ui/MWPanel";
import {
  MATERIAL_REQUEST_PRIORITIES,
  MATERIAL_REQUEST_SOURCE_TYPES,
  buildCartItem,
  finalizeCartSummary,
  findInventoryItemByScan,
  getInventoryBrowseItems,
  getMaterialRequestSourceRecords,
  mergeCartItem,
  submitMaterialRequestCart,
  updateCartItemQuantity,
} from "../services/materialRequestCartService";

const SOURCE_TYPE_OPTIONS = [
  {
    value: MATERIAL_REQUEST_SOURCE_TYPES.PROJECT,
    label: "Project",
  },
  {
    value: MATERIAL_REQUEST_SOURCE_TYPES.CUSTOMER_ORDER,
    label: "Customer Order",
  },
  {
    value: MATERIAL_REQUEST_SOURCE_TYPES.PRODUCTION_JOB,
    label: "Production Job",
  },
  {
    value: MATERIAL_REQUEST_SOURCE_TYPES.SHOP_SUPPLY,
    label: "Shop Supply / Restock",
  },
];

const PRIORITY_OPTIONS = [
  {
    value: MATERIAL_REQUEST_PRIORITIES.CRITICAL,
    label: "Critical",
  },
  {
    value: MATERIAL_REQUEST_PRIORITIES.HIGH,
    label: "High",
  },
  {
    value: MATERIAL_REQUEST_PRIORITIES.NORMAL,
    label: "Normal",
  },
];

const DEPARTMENTS = [
  "Office",
  "Design",
  "Laser",
  "Prep",
  "Welding",
  "Paint",
  "Powder",
  "Assembly",
  "QC",
  "Showroom",
  "Field / Installation",
];

function quantity(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function stockColor(status) {
  if (status === "Available") return "green";
  if (status === "Low Stock") return "yellow";
  if (status === "Out of Stock") return "red";
  return "gray";
}

function MaterialRequestCart({
  setPage,
  activeUser = "",
}) {
  const [sourceType, setSourceType] = useState(
    MATERIAL_REQUEST_SOURCE_TYPES.SHOP_SUPPLY
  );

  const [sourceRecords, setSourceRecords] = useState([]);
  const [selectedSourceId, setSelectedSourceId] = useState("");
  const [loadingSources, setLoadingSources] = useState(false);

  const [inventoryBrowseItems, setInventoryBrowseItems] =
    useState([]);

  const [selectedBrowseItemId, setSelectedBrowseItemId] =
    useState("");

  const [loadingInventory, setLoadingInventory] =
    useState(false);

  const [scanValue, setScanValue] = useState("");
  const [searching, setSearching] = useState(false);
  const [pendingItem, setPendingItem] = useState(null);
  const [pendingQuantity, setPendingQuantity] = useState(1);
  const [cartItems, setCartItems] = useState([]);

  const [department, setDepartment] = useState("");

  const [priority, setPriority] = useState(
    MATERIAL_REQUEST_PRIORITIES.NORMAL
  );

  const [isPriorityWork, setIsPriorityWork] = useState(false);
  const [blockedWork, setBlockedWork] = useState(false);
  const [neededBy, setNeededBy] = useState(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successRequest, setSuccessRequest] = useState(null);

  const scanInputRef = useRef(null);
  const keyboardBufferRef = useRef("");
  const keyboardLastKeyRef = useRef(0);

  const selectedSource = useMemo(
    () =>
      sourceRecords.find(
        (record) => record.id === selectedSourceId
      ) || null,
    [selectedSourceId, sourceRecords]
  );

  const sourceSelectData = useMemo(
    () =>
      sourceRecords.map((record) => ({
        value: record.id,
        label: record.label,
      })),
    [sourceRecords]
  );

  const inventoryBrowseData = useMemo(
    () =>
      inventoryBrowseItems.map((item) => ({
        value: String(
          item.inventory_item_id || item.id
        ),
        label: item.browse_label || item.name,
      })),
    [inventoryBrowseItems]
  );

  const summary = useMemo(
    () => finalizeCartSummary(cartItems),
    [cartItems]
  );

  const loadSources = useCallback(async (nextSourceType) => {
    try {
      setLoadingSources(true);

      const records =
        await getMaterialRequestSourceRecords(
          nextSourceType
        );

      setSourceRecords(records);

      if (
        nextSourceType ===
          MATERIAL_REQUEST_SOURCE_TYPES.SHOP_SUPPLY &&
        records[0]
      ) {
        setSelectedSourceId(records[0].id);
      }
    } catch (error) {
      setSourceRecords([]);

      notifications.show({
        title: "Work Records Failed to Load",
        message: error.message,
        color: "red",
      });
    } finally {
      setLoadingSources(false);
    }
  }, []);

  useEffect(() => {
    loadSources(sourceType);
  }, [loadSources, sourceType]);

  useEffect(() => {
    async function loadInventory() {
      try {
        setLoadingInventory(true);

        const items =
          await getInventoryBrowseItems();

        setInventoryBrowseItems(items);
      } catch (error) {
        notifications.show({
          title: "Inventory Failed to Load",
          message: error.message,
          color: "red",
        });
      } finally {
        setLoadingInventory(false);
      }
    }

    loadInventory();
  }, []);

  useEffect(() => {
    if (!selectedSource) {
      return;
    }

    if (
      selectedSource.department &&
      DEPARTMENTS.includes(
        selectedSource.department
      )
    ) {
      setDepartment(
        selectedSource.department
      );
    }
  }, [selectedSource]);

  const searchScan = useCallback(
    async (rawValue) => {
      const value = String(
        rawValue || ""
      ).trim();

      if (!value || searching) {
        return;
      }

      try {
        setSearching(true);
        setPendingItem(null);

        const result =
          await findInventoryItemByScan(
            value
          );

        if (!result.item) {
          notifications.show({
            title:
              "Inventory Item Not Found",
            message: `No active inventory item matched ${value}.`,
            color: "yellow",
            icon: (
              <IconAlertTriangle
                size={18}
              />
            ),
          });

          return;
        }

        const item = buildCartItem(
          result.item,
          1,
          result.scanValue
        );

        setPendingItem(item);
        setPendingQuantity(1);

        notifications.show({
          title: "Inventory Item Found",
          message: item.itemName,
          color: item.shortage
            ? "red"
            : item.lowStock
              ? "yellow"
              : "green",
          icon: <IconCheck size={18} />,
        });
      } catch (error) {
        notifications.show({
          title: "Inventory Scan Failed",
          message: error.message,
          color: "red",
        });
      } finally {
        setSearching(false);
        setScanValue("");
      }
    },
    [searching]
  );

  useEffect(() => {
    function handleUsbScanner(event) {
      if (
        event.ctrlKey ||
        event.altKey ||
        event.metaKey
      ) {
        return;
      }

      const activeTag =
        document.activeElement?.tagName?.toLowerCase();

      const typing =
        activeTag === "input" ||
        activeTag === "textarea";

      if (typing) {
        return;
      }

      const now = Date.now();

      if (
        now -
          keyboardLastKeyRef.current >
        90
      ) {
        keyboardBufferRef.current = "";
      }

      keyboardLastKeyRef.current = now;

      if (event.key === "Enter") {
        const completedValue =
          keyboardBufferRef.current;

        keyboardBufferRef.current = "";

        if (completedValue.length >= 3) {
          searchScan(completedValue);
        }

        return;
      }

      if (event.key.length === 1) {
        keyboardBufferRef.current +=
          event.key;
      }
    }

    window.addEventListener(
      "keydown",
      handleUsbScanner
    );

    return () =>
      window.removeEventListener(
        "keydown",
        handleUsbScanner
      );
  }, [searchScan]);

  function changeSourceType(value) {
    const nextType =
      value ||
      MATERIAL_REQUEST_SOURCE_TYPES.PROJECT;

    setSourceType(nextType);
    setSelectedSourceId("");
    setSourceRecords([]);
    setDepartment("");
  }

  function chooseInventoryItem(value) {
    setSelectedBrowseItemId(
      value || ""
    );

    if (!value) {
      setPendingItem(null);
      return;
    }

    const inventoryItem =
      inventoryBrowseItems.find(
        (item) =>
          String(
            item.inventory_item_id ||
              item.id
          ) === String(value)
      );

    if (!inventoryItem) {
      return;
    }

    setPendingItem(
      buildCartItem(
        inventoryItem,
        1,
        "inventory_browse"
      )
    );

    setPendingQuantity(1);
  }

  function addPendingItem() {
    if (!pendingItem) {
      return;
    }

    const requestedQuantity =
      quantity(pendingQuantity);

    if (requestedQuantity <= 0) {
      notifications.show({
        title: "Quantity Required",
        message:
          "Enter a quantity greater than zero.",
        color: "yellow",
      });

      return;
    }

    const shortageQuantity = Math.max(
      requestedQuantity -
        quantity(
          pendingItem.quantityAvailable
        ),
      0
    );

    const itemToAdd = {
      ...pendingItem,
      quantity: requestedQuantity,
      shortageQuantity,
      shortage:
        shortageQuantity > 0,
      lowStock:
        pendingItem.lowStock ||
        shortageQuantity > 0,
    };

    setCartItems((current) =>
      mergeCartItem(
        current,
        itemToAdd
      )
    );

    setPendingItem(null);
    setPendingQuantity(1);
    setScanValue("");
    setSelectedBrowseItemId("");

    window.setTimeout(
      () =>
        scanInputRef.current?.focus(),
      80
    );

    notifications.show({
      title:
        "Added to Material Cart",
      message: `${requestedQuantity} × ${itemToAdd.itemName}`,
      color: itemToAdd.shortage
        ? "red"
        : "green",
      icon: (
        <IconShoppingCart size={18} />
      ),
    });
  }

  function changeCartQuantity(
    inventoryItemId,
    nextQuantity
  ) {
    setCartItems((current) =>
      updateCartItemQuantity(
        current,
        inventoryItemId,
        nextQuantity
      )
    );
  }

  function removeCartItem(
    inventoryItemId
  ) {
    setCartItems((current) =>
      current.filter(
        (item) =>
          String(
            item.inventoryItemId
          ) !==
          String(inventoryItemId)
      )
    );
  }

  function resetCart() {
    setCartItems([]);
    setPendingItem(null);
    setScanValue("");
    setSelectedBrowseItemId("");
    setPendingQuantity(1);

    setSelectedSourceId(
      sourceType ===
        MATERIAL_REQUEST_SOURCE_TYPES.SHOP_SUPPLY
        ? "SHOP-STOCK"
        : ""
    );

    setDepartment("");

    setPriority(
      MATERIAL_REQUEST_PRIORITIES.NORMAL
    );

    setIsPriorityWork(false);
    setBlockedWork(false);
    setNeededBy(null);
    setNotes("");

    window.setTimeout(
      () =>
        scanInputRef.current?.focus(),
      80
    );
  }

  async function submitRequest() {
    if (!selectedSource) {
      notifications.show({
        title:
          "Work Record Required",
        message:
          "Select the project, customer order, production job, or Shop Supply request.",
        color: "yellow",
      });

      return;
    }

    if (!department) {
      notifications.show({
        title:
          "Department Required",
        message:
          "Select the department requesting these materials or supplies.",
        color: "yellow",
      });

      return;
    }

    if (!cartItems.length) {
      notifications.show({
        title:
          "Material Cart Is Empty",
        message:
          "Browse, scan, and add at least one inventory item.",
        color: "yellow",
      });

      return;
    }

    try {
      setSubmitting(true);

      const request =
        await submitMaterialRequestCart({
          source: selectedSource,
          requestedBy: activeUser,
          department,
          priority,

          isPriorityWork:
            isPriorityWork ||
            priority !==
              MATERIAL_REQUEST_PRIORITIES.NORMAL,

          blockedWork:
            blockedWork ||
            summary.hasShortage,

          neededBy,
          notes,
          items: cartItems,
        });

      setSuccessRequest(request);
      resetCart();

      notifications.show({
        title:
          "Material Request Submitted",
        message: `${request.request_number} was sent successfully.`,
        color:
          request.status === "blocked"
            ? "orange"
            : "green",
        icon: <IconCheck size={18} />,
      });
    } catch (error) {
      notifications.show({
        title:
          "Material Request Failed",
        message: error.message,
        color: "red",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Stack gap="xl">
      <MWPageHeader
        title="Material Request Cart"
        subtitle="Request job materials or general shop supplies, check inventory availability, and identify shortages before production is blocked."
        setPage={setPage}
        showBack
        backPage="inventoryDashboard"
        backLabel="Inventory"
        showDashboard={false}
      />

      <MWKpiStrip
        items={[
          {
            label: "Cart Items",
            value: summary.itemCount,
            description: `${summary.totalQuantity} total units`,
            icon: IconShoppingCart,
            color: "red",
          },
          {
            label: "Low Stock",
            value:
              summary.lowStockCount,
            description:
              "Lines needing attention",
            icon: IconPackage,
            color: "yellow",
          },
          {
            label: "Shortages",
            value:
              summary.shortageCount,
            description: `${summary.shortageQuantity} units short`,
            icon:
              IconAlertTriangle,
            color: "red",
          },
          {
            label: "Requested By",
            value:
              activeUser ||
              "Not selected",
            description:
              department ||
              "Department not selected",
            icon: IconUser,
            color: "blue",
          },
        ]}
        columns={{
          base: 1,
          sm: 2,
          xl: 4,
        }}
        compact
      />

      <MWPanel
        title="1. Choose the Request Type"
        subtitle="Connect job materials to active work, or request general shop supplies and restock"
        icon={IconPackage}
      >
        <SimpleGrid
          cols={{
            base: 1,
            md: 2,
          }}
          spacing="md"
        >
          <Select
            label="Request Type"
            value={sourceType}
            onChange={
              changeSourceType
            }
            data={
              SOURCE_TYPE_OPTIONS
            }
            allowDeselect={false}
          />

          {sourceType ===
          MATERIAL_REQUEST_SOURCE_TYPES.SHOP_SUPPLY ? (
            <TextInput
              label="Request Destination"
              value="General Shop Supply / Restock"
              readOnly
              leftSection={
                <IconPackage
                  size={17}
                />
              }
            />
          ) : (
            <Select
              label="Project, Customer Order or Production Job"
              placeholder={
                loadingSources
                  ? "Loading work..."
                  : "Search existing work"
              }
              value={
                selectedSourceId
              }
              onChange={(value) =>
                setSelectedSourceId(
                  value || ""
                )
              }
              data={
                sourceSelectData
              }
              searchable
              clearable
              disabled={
                loadingSources
              }
              rightSection={
                loadingSources ? (
                  <Loader
                    size={16}
                  />
                ) : null
              }
            />
          )}
        </SimpleGrid>

        {selectedSource && (
          <Paper
            p="md"
            mt="md"
            radius="md"
            withBorder
          >
            <Group
              justify="space-between"
              align="flex-start"
            >
              <Box>
                <Text
                  size="xs"
                  c="red.4"
                  fw={800}
                  tt="uppercase"
                >
                  {selectedSource.number ||
                    selectedSource.sourceType.replaceAll(
                      "_",
                      " "
                    )}
                </Text>

                <Text
                  fw={850}
                  size="lg"
                >
                  {
                    selectedSource.title
                  }
                </Text>

                <Text
                  size="sm"
                  c="dimmed"
                >
                  {sourceType ===
                  MATERIAL_REQUEST_SOURCE_TYPES.SHOP_SUPPLY
                    ? "For paint, powder, tape, gloves, abrasives, cleaning supplies, office supplies, and other general shop needs"
                    : selectedSource.customerName ||
                      "Metal Worx work record"}
                </Text>
              </Box>

              <Badge
                color="green"
                variant="light"
                size="lg"
              >
                Connected
              </Badge>
            </Group>
          </Paper>
        )}
      </MWPanel>

      <MWPanel
        title="2. Find Inventory"
        subtitle="Browse by item name, scan with the USB scanner, or enter a QR/barcode value"
        icon={IconQrcode}
      >
        <SimpleGrid
          cols={{
            base: 1,
            md: 2,
          }}
          spacing="md"
        >
          <Select
            label="Browse Inventory by Name"
            placeholder={
              loadingInventory
                ? "Loading inventory..."
                : "Search paint, tape, gloves, powder..."
            }
            value={
              selectedBrowseItemId
            }
            onChange={
              chooseInventoryItem
            }
            data={
              inventoryBrowseData
            }
            searchable
            clearable
            disabled={
              loadingInventory
            }
            rightSection={
              loadingInventory ? (
                <Loader size={16} />
              ) : null
            }
            size="lg"
          />

          <Group
            align="flex-end"
            wrap="nowrap"
          >
            <TextInput
              ref={scanInputRef}
              label="QR Code, Barcode or Item Number"
              placeholder="Scan MW-SHW-0001"
              value={scanValue}
              onChange={(event) =>
                setScanValue(
                  event.currentTarget
                    .value
                )
              }
              onKeyDown={(event) => {
                if (
                  event.key ===
                  "Enter"
                ) {
                  searchScan(
                    scanValue
                  );
                }
              }}
              leftSection={
                <IconBarcode
                  size={19}
                />
              }
              size="lg"
              style={{
                flex: 1,
              }}
            />

            <Button
              size="lg"
              h={50}
              color="red"
              leftSection={
                searching ? (
                  <Loader
                    size={18}
                    color="white"
                  />
                ) : (
                  <IconSearch
                    size={19}
                  />
                )
              }
              disabled={
                !scanValue.trim() ||
                searching
              }
              onClick={() =>
                searchScan(
                  scanValue
                )
              }
            >
              Find Item
            </Button>
          </Group>
        </SimpleGrid>

        {pendingItem && (
          <Paper
            p="lg"
            mt="lg"
            radius="lg"
            style={{
              background:
                pendingItem.shortage
                  ? "rgba(250,82,82,.09)"
                  : "rgba(64,192,87,.06)",

              border: `1px solid ${
                pendingItem.shortage
                  ? "rgba(250,82,82,.38)"
                  : "rgba(64,192,87,.28)"
              }`,
            }}
          >
            <Group
              justify="space-between"
              align="center"
              wrap="wrap"
            >
              <Group wrap="nowrap">
                <Avatar
                  src={
                    pendingItem.primaryImageUrl
                  }
                  size={72}
                  radius="md"
                  color="dark"
                >
                  <IconPackage
                    size={34}
                  />
                </Avatar>

                <Box>
                  <Group gap="xs">
                    <Text
                      fw={900}
                      size="xl"
                    >
                      {
                        pendingItem.itemName
                      }
                    </Text>

                    <Badge
                      color={stockColor(
                        pendingItem.stockStatus
                      )}
                    >
                      {
                        pendingItem.stockStatus
                      }
                    </Badge>
                  </Group>

                  <Text c="dimmed">
                    {pendingItem.itemNumber ||
                      "Inventory item"}
                  </Text>

                  <Text
                    size="sm"
                    mt={4}
                  >
                    Available:{" "}
                    <Text
                      span
                      fw={900}
                    >
                      {
                        pendingItem.quantityAvailable
                      }
                    </Text>

                    {pendingItem.defaultBinCode
                      ? ` · ${pendingItem.defaultBinCode}`
                      : ""}
                  </Text>
                </Box>
              </Group>

              <Group align="flex-end">
                <NumberInput
                  label="Quantity Needed"
                  value={
                    pendingQuantity
                  }
                  onChange={
                    setPendingQuantity
                  }
                  min={0.0001}
                  decimalScale={4}
                  w={155}
                />

                <Button
                  color="red"
                  leftSection={
                    <IconPlus
                      size={18}
                    />
                  }
                  onClick={
                    addPendingItem
                  }
                >
                  Add to Cart
                </Button>
              </Group>
            </Group>

            {quantity(
              pendingQuantity
            ) >
              quantity(
                pendingItem.quantityAvailable
              ) && (
              <Alert
                mt="md"
                color="red"
                icon={
                  <IconAlertTriangle
                    size={19}
                  />
                }
              >
                This request is
                short by{" "}
                {Math.max(
                  quantity(
                    pendingQuantity
                  ) -
                    quantity(
                      pendingItem.quantityAvailable
                    ),
                  0
                )}{" "}
                units and will flag
                the work as blocked.
              </Alert>
            )}
          </Paper>
        )}
      </MWPanel>

      <MWPanel
        title="3. Material Cart"
        subtitle={`${summary.itemCount} inventory item${
          summary.itemCount === 1
            ? ""
            : "s"
        } ready for request`}
        icon={IconShoppingCart}
      >
        {!cartItems.length ? (
          <Center py={48}>
            <Stack
              align="center"
              gap="sm"
            >
              <ThemeIcon
                size={66}
                radius="xl"
                color="gray"
                variant="light"
              >
                <IconShoppingCart
                  size={34}
                />
              </ThemeIcon>

              <Title order={4}>
                The material cart is
                empty
              </Title>

              <Text c="dimmed">
                Browse or scan an
                inventory item and
                enter the quantity
                needed.
              </Text>
            </Stack>
          </Center>
        ) : (
          <Stack gap="sm">
            {cartItems.map(
              (item) => (
                <Paper
                  key={
                    item.inventoryItemId
                  }
                  p="md"
                  radius="md"
                  withBorder
                >
                  <Group
                    justify="space-between"
                    align="center"
                    wrap="nowrap"
                  >
                    <Group
                      wrap="nowrap"
                      style={{
                        flex: 1,
                      }}
                    >
                      <Avatar
                        src={
                          item.primaryImageUrl
                        }
                        size={54}
                        radius="md"
                        color="dark"
                      >
                        <IconPackage
                          size={27}
                        />
                      </Avatar>

                      <Box
                        style={{
                          flex: 1,
                        }}
                      >
                        <Group gap="xs">
                          <Text
                            fw={850}
                          >
                            {
                              item.itemName
                            }
                          </Text>

                          {item.shortage && (
                            <Badge color="red">
                              Shortage
                            </Badge>
                          )}

                          {!item.shortage &&
                            item.lowStock && (
                              <Badge color="yellow">
                                Low
                                Stock
                              </Badge>
                            )}
                        </Group>

                        <Text
                          size="xs"
                          c="dimmed"
                        >
                          {item.itemNumber ||
                            "Inventory item"}{" "}
                          ·{" "}
                          {
                            item.quantityAvailable
                          }{" "}
                          available
                        </Text>
                      </Box>
                    </Group>

                    <Group wrap="nowrap">
                      <NumberInput
                        value={
                          item.quantity
                        }
                        onChange={(
                          value
                        ) =>
                          changeCartQuantity(
                            item.inventoryItemId,
                            value
                          )
                        }
                        min={0}
                        decimalScale={
                          4
                        }
                        w={125}
                      />

                      <Box w={125}>
                        <Text
                          size="xs"
                          c="dimmed"
                          fw={800}
                        >
                          RESULT
                        </Text>

                        <Text
                          fw={850}
                          c={
                            item.shortage
                              ? "red.4"
                              : "green.4"
                          }
                        >
                          {item.shortage
                            ? `${item.shortageQuantity} short`
                            : "Available"}
                        </Text>
                      </Box>

                      <Button
                        variant="subtle"
                        color="red"
                        px="sm"
                        onClick={() =>
                          removeCartItem(
                            item.inventoryItemId
                          )
                        }
                      >
                        <IconTrash
                          size={18}
                        />
                      </Button>
                    </Group>
                  </Group>
                </Paper>
              )
            )}

            <Group
              justify="space-between"
              mt="sm"
            >
              <Button
                variant="light"
                color="gray"
                leftSection={
                  <IconPlus
                    size={18}
                  />
                }
                onClick={() =>
                  scanInputRef.current?.focus()
                }
              >
                Scan Another Item
              </Button>

              <Button
                variant="subtle"
                color="red"
                leftSection={
                  <IconRefresh
                    size={18}
                  />
                }
                onClick={resetCart}
              >
                Clear Cart
              </Button>
            </Group>
          </Stack>
        )}
      </MWPanel>

      <MWPanel
        title="4. Request Details"
        subtitle="Set responsibility, timing, and production impact"
        icon={IconSend}
      >
        <SimpleGrid
          cols={{
            base: 1,
            md: 2,
          }}
          spacing="md"
        >
          <Select
            label="Requesting Department"
            placeholder="Select department"
            value={department}
            onChange={(value) =>
              setDepartment(
                value || ""
              )
            }
            data={DEPARTMENTS}
            searchable
            clearable
          />

          <Select
            label="Priority"
            value={priority}
            onChange={(value) =>
              setPriority(
                value ||
                  MATERIAL_REQUEST_PRIORITIES.NORMAL
              )
            }
            data={
              PRIORITY_OPTIONS
            }
            allowDeselect={false}
          />

          <DateTimePicker
            label="Needed By"
            value={neededBy}
            onChange={setNeededBy}
            minDate={new Date()}
            clearable
            leftSection={
              <IconClock
                size={17}
              />
            }
          />

          <TextInput
            label="Requested By"
            value={
              activeUser ||
              "Not selected"
            }
            readOnly
            leftSection={
              <IconUser
                size={17}
              />
            }
          />
        </SimpleGrid>

        <Divider my="lg" />

        <SimpleGrid
          cols={{
            base: 1,
            md: 2,
          }}
          spacing="md"
        >
          <Switch
            label="Priority Work"
            description="Flag this request for management-priority work"
            checked={
              isPriorityWork
            }
            onChange={(event) =>
              setIsPriorityWork(
                event.currentTarget
                  .checked
              )
            }
            color="red"
            size="md"
            thumbIcon={
              isPriorityWork ? (
                <IconFlame
                  size={13}
                />
              ) : null
            }
          />

          <Switch
            label="Work Is Blocked"
            description="Production cannot continue until materials are available"
            checked={
              blockedWork ||
              summary.hasShortage
            }
            onChange={(event) =>
              setBlockedWork(
                event.currentTarget
                  .checked
              )
            }
            disabled={
              summary.hasShortage
            }
            color="red"
            size="md"
            thumbIcon={
              blockedWork ||
              summary.hasShortage ? (
                <IconAlertTriangle
                  size={13}
                />
              ) : null
            }
          />
        </SimpleGrid>

        <Textarea
          label="Request Notes"
          placeholder="Add dimensions, usage instructions, or other information"
          value={notes}
          onChange={(event) =>
            setNotes(
              event.currentTarget
                .value
            )
          }
          minRows={3}
          mt="lg"
        />

        {summary.hasShortage && (
          <Alert
            mt="lg"
            color="red"
            title="Inventory Shortage"
            icon={
              <IconAlertTriangle
                size={20}
              />
            }
          >
            {summary.shortageCount}{" "}
            cart line
            {summary.shortageCount ===
            1
              ? " is"
              : "s are"}{" "}
            short. The submitted
            request will automatically
            be marked blocked for
            purchasing or replenishment
            follow-up.
          </Alert>
        )}

        <Button
          mt="xl"
          h={54}
          fullWidth
          color="red"
          leftSection={
            submitting ? (
              <Loader
                size={19}
                color="white"
              />
            ) : (
              <IconSend
                size={20}
              />
            )
          }
          disabled={
            !selectedSource ||
            !cartItems.length ||
            submitting
          }
          onClick={
            submitRequest
          }
        >
          Submit Material Request
        </Button>
      </MWPanel>

      <Modal
        opened={Boolean(
          successRequest
        )}
        onClose={() =>
          setSuccessRequest(null)
        }
        centered
        title="Material Request Submitted"
      >
        <Stack
          align="center"
          gap="md"
          py="md"
        >
          <ThemeIcon
            size={68}
            radius="xl"
            color={
              successRequest?.status ===
              "blocked"
                ? "orange"
                : "green"
            }
            variant="light"
          >
            {successRequest?.status ===
            "blocked" ? (
              <IconAlertTriangle
                size={34}
              />
            ) : (
              <IconCheck
                size={34}
              />
            )}
          </ThemeIcon>

          <Title order={3}>
            {
              successRequest?.request_number
            }
          </Title>

          <Badge
            size="lg"
            color={
              successRequest?.status ===
              "blocked"
                ? "orange"
                : "green"
            }
          >
            {String(
              successRequest?.status ||
                "submitted"
            ).replaceAll(
              "_",
              " "
            )}
          </Badge>

          <Text
            c="dimmed"
            ta="center"
          >
            The material request and
            its inventory availability
            snapshot were saved
            successfully.
          </Text>

          <Button
            fullWidth
            color="red"
            onClick={() =>
              setSuccessRequest(null)
            }
          >
            Start Another Request
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}

export default MaterialRequestCart;