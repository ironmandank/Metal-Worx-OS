import {
  Badge,
  Box,
  Divider,
  Group,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
} from "@mantine/core";
import {
  IconBuildingStore,
  IconChevronRight,
  IconMapPin,
  IconPackage,
  IconQrcode,
  IconStack2,
} from "@tabler/icons-react";

import MWPanel from "../ui/MWPanel";

function clampPercentage(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.max(0, Math.min(numericValue, 100));
}

function getStorageColor({
  itemCount = 0,
  availableQuantity = 0,
  lowStockCount = 0,
  outOfStockCount = 0,
}) {
  if (Number(outOfStockCount) > 0) {
    return "red";
  }

  if (Number(lowStockCount) > 0) {
    return "orange";
  }

  if (
    Number(itemCount) > 0 ||
    Number(availableQuantity) > 0
  ) {
    return "green";
  }

  return "gray";
}

function StorageStat({
  label,
  value,
  color = "gray",
}) {
  return (
    <Box
      p="md"
      style={{
        minWidth: 0,
        borderRadius: 12,
        border:
          "1px solid rgba(255,255,255,0.07)",
        backgroundColor:
          "rgba(255,255,255,0.022)",
      }}
    >
      <Text
        size="xs"
        c="gray.5"
        fw={750}
        style={{
          lineHeight: 1.3,
          textAlign: "left",
        }}
      >
        {label}
      </Text>

      <Text
        mt={5}
        fw={900}
        size="lg"
        c={`${color}.3`}
        style={{
          lineHeight: 1,
          textAlign: "left",
          fontVariantNumeric:
            "tabular-nums",
        }}
      >
        {value}
      </Text>
    </Box>
  );
}

function StoragePositionRow({
  position,
  onClick = null,
}) {
  const isClickable =
    typeof onClick === "function";

  const color = getStorageColor({
    itemCount: position.itemCount,
    availableQuantity:
      position.availableQuantity,
    lowStockCount:
      position.lowStockCount,
    outOfStockCount:
      position.outOfStockCount,
  });

  const utilization =
    clampPercentage(
      position.utilizationPercent
    );

  return (
    <Box
      component={
        isClickable
          ? "button"
          : "div"
      }
      type={
        isClickable
          ? "button"
          : undefined
      }
      onClick={
        isClickable
          ? onClick
          : undefined
      }
      p="md"
      style={{
        width: "100%",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 12,
        background:
          "rgba(255,255,255,0.022)",
        color: "inherit",
        font: "inherit",
        textAlign: "left",
        cursor: isClickable
          ? "pointer"
          : "default",
      }}
    >
      <Stack gap="sm">
        <Group
          justify="space-between"
          align="flex-start"
          gap="md"
          wrap="nowrap"
        >
          <Group
            gap="md"
            align="flex-start"
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
                border:
                  "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <IconMapPin
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
                fw={850}
                size="sm"
                c="gray.1"
                style={{
                  lineHeight: 1.3,
                  textAlign: "left",
                }}
              >
                {position.name}
              </Text>

              <Text
                size="xs"
                c="gray.5"
                mt={3}
                style={{
                  lineHeight: 1.4,
                  textAlign: "left",
                }}
              >
                {[
                  position.zone,
                  position.code,
                ]
                  .filter(Boolean)
                  .join(" • ")}
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
              size="sm"
              styles={{
                root: {
                  border:
                    "1px solid rgba(255,255,255,0.08)",
                  fontWeight: 800,
                },
              }}
            >
              {Number(
                position.itemCount || 0
              )} Items
            </Badge>

            {isClickable && (
              <IconChevronRight
                size={16}
                color="var(--mantine-color-gray-5)"
              />
            )}
          </Group>
        </Group>

        {position.description && (
          <Text
            size="xs"
            c="gray.5"
            style={{
              lineHeight: 1.45,
              textAlign: "left",
            }}
          >
            {position.description}
          </Text>
        )}

        <SimpleGrid
          cols={{
            base: 1,
            xs: 3,
          }}
          spacing="sm"
        >
          <StorageStat
            label="On Hand"
            value={
              position.quantityOnHand || 0
            }
            color="blue"
          />

          <StorageStat
            label="Reserved"
            value={
              position.quantityReserved ||
              0
            }
            color="violet"
          />

          <StorageStat
            label="Available"
            value={
              position.availableQuantity ||
              0
            }
            color={color}
          />
        </SimpleGrid>

        {position.showUtilization && (
          <Box>
            <Group
              justify="space-between"
              align="center"
              mb={6}
            >
              <Text
                size="xs"
                c="gray.5"
                fw={700}
              >
                Storage Utilization
              </Text>

              <Text
                size="xs"
                c="gray.3"
                fw={850}
                style={{
                  fontVariantNumeric:
                    "tabular-nums",
                }}
              >
                {utilization}%
              </Text>
            </Group>

            <Progress
              value={utilization}
              color={
                utilization >= 90
                  ? "red"
                  : utilization >= 75
                    ? "orange"
                    : "blue"
              }
              size={8}
              radius="xl"
              styles={{
                root: {
                  backgroundColor:
                    "rgba(255,255,255,0.08)",
                },
              }}
            />
          </Box>
        )}
      </Stack>
    </Box>
  );
}

function MWInventoryStorageCard({
  title = "Inventory by Shop Area",
  subtitle = "Inventory distributed across showroom storage, production-floor racks, and department storage positions.",
  icon = IconBuildingStore,
  color = "blue",
  storageAreas = [],
  totalPositions = 0,
  totalItems = 0,
  qrEnabledPositions = 0,
  actionLabel = "",
  onAction = null,
  onSelectPosition = null,
  compact = false,
}) {
  const safeStorageAreas =
    Array.isArray(storageAreas)
      ? storageAreas.filter(Boolean)
      : [];

  return (
    <MWPanel
      title={title}
      subtitle={subtitle}
      icon={icon}
      color={color}
      actionLabel={actionLabel}
      onAction={onAction}
      compact={compact}
      fullHeight
      rightSection={
        <Badge
          color={color}
          variant="light"
          radius="sm"
          size="md"
          styles={{
            root: {
              border:
                "1px solid rgba(255,255,255,0.08)",
              fontWeight: 850,
            },
          }}
        >
          {safeStorageAreas.length} Areas
        </Badge>
      }
    >
      <Stack gap="lg">
        <SimpleGrid
          cols={{
            base: 1,
            sm: 3,
          }}
          spacing="sm"
        >
          <StorageStat
            label="Storage Positions"
            value={totalPositions}
            color="blue"
          />

          <StorageStat
            label="Items Assigned"
            value={totalItems}
            color="green"
          />

          <StorageStat
            label="QR Enabled"
            value={qrEnabledPositions}
            color="violet"
          />
        </SimpleGrid>

        <Divider color="rgba(255,255,255,0.08)" />

        {safeStorageAreas.length === 0 ? (
          <Stack
            align="center"
            justify="center"
            mih={240}
            gap="sm"
          >
            <ThemeIcon
              size={52}
              radius="xl"
              color="gray"
              variant="light"
              style={{
                border:
                  "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <IconStack2 size={25} />
            </ThemeIcon>

            <Text
              fw={850}
              c="gray.3"
              ta="center"
            >
              No storage areas configured
            </Text>

            <Text
              size="sm"
              c="gray.5"
              ta="center"
              maw={420}
              style={{
                lineHeight: 1.45,
              }}
            >
              Add showroom bins, production racks, department cabinets, shelves,
              and staging locations to organize inventory.
            </Text>
          </Stack>
        ) : (
          <Stack gap="md">
            {safeStorageAreas.map(
              (area, areaIndex) => (
                <Box
                  key={
                    area.id ||
                    area.zone ||
                    `storage-area-${areaIndex}`
                  }
                >
                  <Group
                    justify="space-between"
                    align="center"
                    gap="md"
                    mb="sm"
                  >
                    <Group
                      gap="sm"
                      wrap="nowrap"
                    >
                      <ThemeIcon
                        size={32}
                        radius="md"
                        color={
                          area.color ||
                          color
                        }
                        variant="light"
                      >
                        <IconPackage
                          size={16}
                        />
                      </ThemeIcon>

                      <Box>
                        <Text
                          fw={850}
                          size="sm"
                          c="gray.1"
                        >
                          {area.name ||
                            area.zone ||
                            "Storage Area"}
                        </Text>

                        {area.description && (
                          <Text
                            size="xs"
                            c="gray.5"
                            mt={2}
                          >
                            {
                              area.description
                            }
                          </Text>
                        )}
                      </Box>
                    </Group>

                    <Badge
                      color={
                        area.color ||
                        color
                      }
                      variant="light"
                      radius="sm"
                    >
                      {Array.isArray(
                        area.positions
                      )
                        ? area.positions
                            .length
                        : 0}{" "}
                      Positions
                    </Badge>
                  </Group>

                  <SimpleGrid
                    cols={{
                      base: 1,
                      xl: 2,
                    }}
                    spacing="sm"
                  >
                    {(area.positions ||
                      []).map(
                      (
                        position,
                        positionIndex
                      ) => (
                        <StoragePositionRow
                          key={
                            position.id ||
                            position.code ||
                            `position-${positionIndex}`
                          }
                          position={
                            position
                          }
                          onClick={
                            typeof onSelectPosition ===
                            "function"
                              ? () =>
                                  onSelectPosition(
                                    position,
                                    area
                                  )
                              : null
                          }
                        />
                      )
                    )}
                  </SimpleGrid>

                  {areaIndex <
                    safeStorageAreas.length -
                      1 && (
                    <Divider
                      mt="lg"
                      color="rgba(255,255,255,0.07)"
                    />
                  )}
                </Box>
              )
            )}
          </Stack>
        )}
      </Stack>
    </MWPanel>
  );
}

export default MWInventoryStorageCard;