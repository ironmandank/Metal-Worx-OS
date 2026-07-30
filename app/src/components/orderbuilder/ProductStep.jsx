import {
  Alert,
  Badge,
  Box,
  Button,
  Group,
  Loader,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from "@mantine/core";
import {
  IconCheck,
  IconPackage,
  IconRefresh,
  IconSearch,
  IconTool,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { supabase } from "../../lib/supabase";

function formatMoney(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return "No catalog price";

  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function ProductStep({ selectedProducts = [], onAddProduct }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const loadTemplates = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    else setRefreshing(true);

    setLoadError("");

    const { data, error } = await supabase
      .from("product_templates")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      setLoadError(error.message);
    } else {
      setTemplates((data || []).filter((template) => template.is_active !== false));
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadTemplates(true);
  }, [loadTemplates]);

  const categories = useMemo(() => {
    return [
      { value: "all", label: "All Categories" },
      ...[...new Set(templates.map((template) => template.category).filter(Boolean))]
        .sort()
        .map((category) => ({ value: category, label: category })),
    ];
  }, [templates]);

  const filteredTemplates = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    return templates.filter((template) => {
      if (categoryFilter !== "all" && template.category !== categoryFilter) {
        return false;
      }

      if (!searchValue) return true;

      return [
        template.name,
        template.category,
        template.default_finish,
        template.material,
        template.size,
        template.default_colors,
        template.online_sku,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(searchValue);
    });
  }, [categoryFilter, search, templates]);

  function isSelected(templateId) {
    return selectedProducts.some((item) => item.id === templateId);
  }

  if (loading) {
    return (
      <Group justify="center" py={55}>
        <Loader color="red" />
        <Text c="dimmed">Loading product templates...</Text>
      </Group>
    );
  }

  return (
    <Stack gap="lg">
      <Group align="flex-end" wrap="wrap">
        <TextInput
          style={{ flex: 1, minWidth: 260 }}
          label="Find a Product"
          placeholder="Search name, size, finish, material, color, or SKU..."
          leftSection={<IconSearch size={17} />}
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
        />

        <Select
          w={220}
          label="Category"
          value={categoryFilter}
          onChange={(value) => setCategoryFilter(value || "all")}
          data={categories}
          allowDeselect={false}
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

      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          {filteredTemplates.length} product template
          {filteredTemplates.length === 1 ? "" : "s"} shown
        </Text>

        <Badge color={selectedProducts.length ? "green" : "gray"} variant="light">
          {selectedProducts.length} selected
        </Badge>
      </Group>

      {loadError && (
        <Alert color="red" title="Products Failed to Load">
          {loadError}
        </Alert>
      )}

      {!loadError && filteredTemplates.length === 0 ? (
        <Alert color="gray" icon={<IconPackage size={19} />}>
          No active product templates match the current search and category.
        </Alert>
      ) : (
        <Box
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
            gap: "var(--mantine-spacing-md)",
            alignItems: "stretch",
          }}
        >
          {filteredTemplates.map((template) => {
            const selected = isSelected(template.id);

            return (
              <Paper
                key={template.id}
                p="lg"
                radius="lg"
                style={{
                  minWidth: 0,
                  height: "100%",
                  background: selected
                    ? "linear-gradient(145deg, rgba(20,110,55,.18), rgba(255,255,255,.025))"
                    : "rgba(255,255,255,.025)",
                  border: `1px solid ${
                    selected
                      ? "rgba(60,190,110,.38)"
                      : "rgba(255,255,255,.09)"
                  }`,
                }}
              >
                <Stack gap="md" h="100%">
                  <Group justify="space-between" align="flex-start" wrap="nowrap">
                    <Group gap="xs" wrap="wrap">
                      <Badge color="red" variant="light">
                        {template.category || "Template"}
                      </Badge>
                      <Badge
                        color={template.is_stock_item ? "green" : "orange"}
                        variant="light"
                      >
                        {template.is_stock_item ? "Stock Item" : "Build to Order"}
                      </Badge>
                    </Group>

                    <ThemeIcon
                      size={40}
                      radius="md"
                      color={selected ? "green" : "gray"}
                      variant="light"
                      style={{ flexShrink: 0 }}
                    >
                      {selected ? <IconCheck size={21} /> : <IconTool size={21} />}
                    </ThemeIcon>
                  </Group>

                  <Box style={{ minWidth: 0 }}>
                    <Title
                      order={3}
                      c="white"
                      style={{ overflowWrap: "anywhere", lineHeight: 1.2 }}
                    >
                      {template.name || "Unnamed Product"}
                    </Title>

                    <Text c="gray.4" size="sm" mt={5}>
                      {[template.size, template.default_finish]
                        .filter(Boolean)
                        .join(" · ") || "Size and finish not set"}
                    </Text>
                  </Box>

                  <Paper
                    p="sm"
                    radius="md"
                    style={{
                      background: "rgba(0,0,0,.22)",
                      border: "1px solid rgba(255,255,255,.06)",
                    }}
                  >
                    <Stack gap={5}>
                      <Group justify="space-between" align="flex-start" wrap="nowrap">
                        <Text size="xs" c="dimmed" fw={800}>
                          MATERIAL
                        </Text>
                        <Text size="sm" fw={700} ta="right">
                          {template.material || "Not set"}
                        </Text>
                      </Group>
                      <Group justify="space-between" align="flex-start" wrap="nowrap">
                        <Text size="xs" c="dimmed" fw={800}>
                          COLORS
                        </Text>
                        <Text
                          size="sm"
                          fw={700}
                          ta="right"
                          style={{ overflowWrap: "anywhere" }}
                        >
                          {template.default_colors || "Not set"}
                        </Text>
                      </Group>
                      <Group justify="space-between" align="flex-start" wrap="nowrap">
                        <Text size="xs" c="dimmed" fw={800}>
                          PRICE
                        </Text>
                        <Text size="sm" fw={800} ta="right">
                          {formatMoney(template.online_price)}
                        </Text>
                      </Group>
                    </Stack>
                  </Paper>

                  <Button
                    fullWidth
                    mt="auto"
                    color={selected ? "green" : "red"}
                    variant={selected ? "light" : "filled"}
                    leftSection={selected ? <IconCheck size={17} /> : <IconPackage size={17} />}
                    disabled={selected}
                    onClick={() => onAddProduct(template)}
                  >
                    {selected ? "Added to Order" : "Add to Order"}
                  </Button>
                </Stack>
              </Paper>
            );
          })}
        </Box>
      )}
    </Stack>
  );
}

export default ProductStep;