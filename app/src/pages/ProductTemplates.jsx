import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Group,
  Loader,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from "@mantine/core";
import {
  IconAlertTriangle,
  IconBox,
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconPackage,
  IconRefresh,
  IconSearch,
  IconTemplate,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import MWKpiStrip from "../components/ui/MWKpiStrip";
import MWPageHeader from "../components/ui/MWPageHeader";
import MWPanel from "../components/ui/MWPanel";
import { supabase } from "../lib/supabase";

function formatMoney(value) {
  if (value === null || value === undefined || value === "") return "Not set";

  const number = Number(value);
  if (!Number.isFinite(number)) return "Not set";

  return number.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function cleanText(value) {
  return String(value || "").trim();
}

function ProductTemplates({ setPage }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [expandedIds, setExpandedIds] = useState([]);
  const refreshTimerRef = useRef(null);

  const loadTemplates = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    else setRefreshing(true);

    setErrorMessage("");

    try {
      const { data, error } = await supabase
        .from("product_templates")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error("Product template load error:", error);
      setErrorMessage(
        error?.message || "The manufacturing template library could not load."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates(true);

    const scheduleRefresh = () => {
      window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = window.setTimeout(
        () => loadTemplates(false),
        250
      );
    };

    const channel = supabase
      .channel("metal-worx-product-templates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "product_templates" },
        scheduleRefresh
      )
      .subscribe();

    return () => {
      window.clearTimeout(refreshTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [loadTemplates]);

  const categoryOptions = useMemo(() => {
    const categories = [
      ...new Set(
        templates.map((template) => cleanText(template.category)).filter(Boolean)
      ),
    ].sort((a, b) => a.localeCompare(b));

    return [
      { value: "all", label: "All Categories" },
      ...categories.map((category) => ({
        value: category,
        label: category,
      })),
    ];
  }, [templates]);

  const filteredTemplates = useMemo(() => {
    const term = search.trim().toLowerCase();

    return templates.filter((item) => {
      if (typeFilter === "stock" && !item.is_stock_item) return false;
      if (typeFilter === "build" && item.is_stock_item) return false;
      if (typeFilter === "repeat" && !item.is_repeat_item) return false;
      if (typeFilter === "online" && !item.is_online_product) return false;

      if (
        categoryFilter !== "all" &&
        cleanText(item.category) !== categoryFilter
      ) {
        return false;
      }

      if (!term) return true;

      return [
        item.name,
        item.category,
        item.default_finish,
        item.default_colors,
        item.material,
        item.size,
        item.description,
        item.sku,
        item.template_number,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [categoryFilter, search, templates, typeFilter]);

  const stockCount = templates.filter((item) => item.is_stock_item).length;
  const buildCount = templates.filter((item) => !item.is_stock_item).length;
  const repeatCount = templates.filter((item) => item.is_repeat_item).length;

  function toggleDetails(templateId) {
    setExpandedIds((current) =>
      current.includes(templateId)
        ? current.filter((id) => id !== templateId)
        : [...current, templateId]
    );
  }

  function openOrderBuilder(template) {
    try {
      sessionStorage.setItem(
        "mwPendingProductTemplate",
        JSON.stringify({
          id: template.id,
          name: template.name,
        })
      );
    } catch (error) {
      console.warn("Template handoff could not be stored:", error);
    }

    setPage("orderBuilder");
  }

  if (loading) {
    return (
      <Stack gap="xl">
        <MWPageHeader
          title="Manufacturing Templates"
          subtitle="Loading reusable Metal Worx product recipes."
          setPage={setPage}
        />
        <MWPanel>
          <Group justify="center" py={80}>
            <Loader color="red" />
            <Text c="dimmed">Loading manufacturing templates...</Text>
          </Group>
        </MWPanel>
      </Stack>
    );
  }

  return (
    <Stack gap="xl">
      <MWPageHeader
        title="Manufacturing Templates"
        subtitle="Reusable product recipes, workflows, pricing, and build information."
        buttonText="+ New Template"
        onButtonClick={() => setPage("newProductTemplate")}
        setPage={setPage}
      />

      <MWKpiStrip
        compact
        columns={{ base: 1, sm: 2, xl: 4 }}
        items={[
          {
            label: "Templates",
            value: templates.length,
            description: "Manufacturing recipes",
            icon: IconTemplate,
            color: "red",
          },
          {
            label: "Stock Items",
            value: stockCount,
            description: "Maintained inventory products",
            icon: IconPackage,
            color: "green",
          },
          {
            label: "Build Items",
            value: buildCount,
            description: "Made-to-order products",
            icon: IconBox,
            color: "orange",
          },
          {
            label: "Repeat Products",
            value: repeatCount,
            description: "Standard repeatable builds",
            icon: IconCheck,
            color: "blue",
          },
        ]}
      />

      <MWPanel
        title="Template Controls"
        subtitle={`${filteredTemplates.length} of ${templates.length} templates shown`}
        icon={IconSearch}
      >
        <Group wrap="wrap">
          <TextInput
            style={{ flex: 1, minWidth: 280 }}
            placeholder="Search name, category, size, material, finish, color, or SKU..."
            leftSection={<IconSearch size={17} />}
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
          />
          <Select
            w={205}
            value={typeFilter}
            onChange={(value) => setTypeFilter(value || "all")}
            allowDeselect={false}
            data={[
              { value: "all", label: "All Template Types" },
              { value: "stock", label: "Stock Items" },
              { value: "build", label: "Build Items" },
              { value: "repeat", label: "Repeat Products" },
              { value: "online", label: "Online Products" },
            ]}
          />
          <Select
            w={215}
            value={categoryFilter}
            onChange={(value) => setCategoryFilter(value || "all")}
            allowDeselect={false}
            searchable
            data={categoryOptions}
          />
          <Button
            variant="light"
            color="gray"
            leftSection={
              refreshing ? <Loader size={16} /> : <IconRefresh size={17} />
            }
            disabled={refreshing}
            onClick={() => loadTemplates(false)}
          >
            Refresh
          </Button>
        </Group>
      </MWPanel>

      {errorMessage && (
        <Alert
          color="red"
          icon={<IconAlertTriangle size={18} />}
          title="Template Library Warning"
        >
          {errorMessage}
        </Alert>
      )}

      <MWPanel
        title="Template Library"
        subtitle="Standardized Metal Worx product and manufacturing definitions"
        icon={IconTemplate}
      >
        {!filteredTemplates.length ? (
          <Alert color="gray" icon={<IconTemplate size={19} />}>
            No manufacturing templates match the current filters.
          </Alert>
        ) : (
          <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }} spacing="lg">
            {filteredTemplates.map((item) => {
              const expanded = expandedIds.includes(item.id);

              return (
                <Card
                  key={item.id}
                  withBorder
                  radius="lg"
                  p="lg"
                  shadow="sm"
                  style={{
                    background: "rgba(255,255,255,.025)",
                    borderColor: item.is_stock_item
                      ? "rgba(46,204,113,.24)"
                      : "rgba(255,255,255,.09)",
                  }}
                >
                  <Stack gap="md">
                    <Group justify="space-between" align="flex-start">
                      <Group gap="xs" wrap="wrap">
                        <Badge color="red" variant="light">
                          {item.category || "Template"}
                        </Badge>
                        <Badge
                          color={item.is_stock_item ? "green" : "orange"}
                          variant="light"
                        >
                          {item.is_stock_item ? "Stock" : "Build"}
                        </Badge>
                      </Group>

                      <ThemeIcon
                        color={item.is_stock_item ? "green" : "red"}
                        variant="light"
                        radius="md"
                      >
                        <IconTemplate size={18} />
                      </ThemeIcon>
                    </Group>

                    <Box>
                      <Title
                        order={3}
                        c="white"
                        style={{ lineHeight: 1.2, overflowWrap: "anywhere" }}
                      >
                        {item.name || "Unnamed Template"}
                      </Title>
                      <Text c="dimmed" size="sm" mt={5}>
                        {[item.size, item.default_finish]
                          .filter(Boolean)
                          .join(" • ") || "Size and finish not set"}
                      </Text>
                      {(item.sku || item.template_number) && (
                        <Text c="red.4" size="xs" fw={850} mt={5}>
                          {item.sku || item.template_number}
                        </Text>
                      )}
                    </Box>

                    <PaperDetails
                      material={item.material}
                      colors={item.default_colors}
                      price={item.online_price}
                    />

                    <Group gap="xs">
                      {item.is_repeat_item && (
                        <Badge color="blue" variant="light">
                          Repeat
                        </Badge>
                      )}
                      {item.is_online_product && (
                        <Badge color="grape" variant="light">
                          Online
                        </Badge>
                      )}
                      {item.has_design_formula && (
                        <Badge color="orange" variant="light">
                          Design Formula
                        </Badge>
                      )}
                      {item.has_etch_formula && (
                        <Badge color="yellow" variant="light">
                          Etch Formula
                        </Badge>
                      )}
                    </Group>

                    {expanded && (
                      <Card
                        withBorder
                        radius="md"
                        p="md"
                        style={{ background: "rgba(0,0,0,.2)" }}
                      >
                        <Stack gap="xs">
                          <Text size="xs" c="dimmed" fw={850} tt="uppercase">
                            Recipe Details
                          </Text>
                          <Text size="sm">
                            {item.description ||
                              item.production_notes ||
                              item.notes ||
                              "No additional recipe instructions are recorded."}
                          </Text>
                          <Text size="sm">
                            <strong>Workflow:</strong>{" "}
                            {item.workflow_name ||
                              item.default_workflow ||
                              "Selected when the order is built"}
                          </Text>
                        </Stack>
                      </Card>
                    )}

                    <Group grow mt="auto">
                      <Button
                        color="red"
                        onClick={() => openOrderBuilder(item)}
                      >
                        Build Order
                      </Button>
                      <Button
                        variant="light"
                        color="gray"
                        rightSection={
                          expanded ? (
                            <IconChevronUp size={16} />
                          ) : (
                            <IconChevronDown size={16} />
                          )
                        }
                        onClick={() => toggleDetails(item.id)}
                      >
                        {expanded ? "Hide Recipe" : "View Recipe"}
                      </Button>
                    </Group>
                  </Stack>
                </Card>
              );
            })}
          </SimpleGrid>
        )}
      </MWPanel>
    </Stack>
  );
}

function PaperDetails({ material, colors, price }) {
  return (
    <Card
      withBorder
      radius="md"
      p="sm"
      style={{ background: "rgba(0,0,0,.18)" }}
    >
      <SimpleGrid cols={3} spacing="xs">
        <Box>
          <Text size="xs" c="dimmed" fw={800} tt="uppercase">
            Material
          </Text>
          <Text size="sm" fw={750}>
            {material || "Not set"}
          </Text>
        </Box>
        <Box>
          <Text size="xs" c="dimmed" fw={800} tt="uppercase">
            Colors
          </Text>
          <Text size="sm" fw={750}>
            {colors || "Not set"}
          </Text>
        </Box>
        <Box>
          <Text size="xs" c="dimmed" fw={800} tt="uppercase">
            Price
          </Text>
          <Text size="sm" fw={750}>
            {formatMoney(price)}
          </Text>
        </Box>
      </SimpleGrid>
    </Card>
  );
}

export default ProductTemplates;