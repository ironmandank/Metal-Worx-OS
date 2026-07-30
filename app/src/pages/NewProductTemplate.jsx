import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconAlertTriangle,
  IconCheck,
  IconDeviceFloppy,
  IconInfoCircle,
  IconTemplate,
} from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";

import MWPageHeader from "../components/ui/MWPageHeader";
import MWPanel from "../components/ui/MWPanel";
import WorkflowBuilder from "../components/productTemplates/WorkflowBuilder";
import { supabase } from "../lib/supabase";

const CATEGORIES = [
  "Flag",
  "Custom Art",
  "Sign",
  "Gate",
  "Hand Rail",
  "Fence",
  "Repair",
  "Powder Coat",
  "Sandblasting",
  "Laser Cutting",
  "Installation",
  "Custom Fabrication",
];

const INITIAL_FORM = {
  name: "",
  category: "Flag",
  default_finish: "",
  default_colors: "",
  default_quantity: 1,
  layer_count: null,
  material: "",
  material_thickness: "",
  size: "",
  is_stock_item: false,
  stock_quantity: 0,
  reorder_quantity: 0,
  is_repeat_item: false,
  has_design_formula: false,
  design_formula_notes: "",
  has_etch_formula: false,
  etch_formula_notes: "",
  default_workflow_name: "",
  workflow_steps: ["Design", "Laser", "Prep", "Paint", "QC", "Showroom"],
  is_online_product: false,
  online_sku: "",
  website_product_url: "",
  online_price: null,
  notes: "",
  is_active: true,
};

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isValidUrl(value) {
  if (!value) return true;

  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

function NewProductTemplate({ setPage }) {
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    function warnBeforeLeaving(event) {
      if (!dirty || saving) return;
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [dirty, saving]);

  const workflowSteps = useMemo(
    () =>
      (formData.workflow_steps || [])
        .map((step) => cleanText(step))
        .filter(Boolean),
    [formData.workflow_steps]
  );

  function updateField(field, value) {
    setDirty(true);
    setValidationErrors([]);
    setFormData((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function validateForm() {
    const errors = [];

    if (!cleanText(formData.name)) {
      errors.push("Product Name is required.");
    }

    if (!cleanText(formData.category)) {
      errors.push("Category is required.");
    }

    if (Number(formData.default_quantity || 0) < 1) {
      errors.push("Default Quantity must be at least 1.");
    }

    if (
      formData.layer_count !== null &&
      formData.layer_count !== "" &&
      Number(formData.layer_count) < 1
    ) {
      errors.push("Layer Count must be at least 1 when entered.");
    }

    if (formData.is_stock_item) {
      if (Number(formData.stock_quantity || 0) < 0) {
        errors.push("Stock Quantity cannot be negative.");
      }
      if (Number(formData.reorder_quantity || 0) < 0) {
        errors.push("Reorder Quantity cannot be negative.");
      }
    }

    if (!workflowSteps.length) {
      errors.push("Add at least one manufacturing workflow step.");
    }

    if (formData.has_design_formula && !cleanText(formData.design_formula_notes)) {
      errors.push("Enter the Design Formula instructions.");
    }

    if (formData.has_etch_formula && !cleanText(formData.etch_formula_notes)) {
      errors.push("Enter the Etch Formula instructions.");
    }

    if (formData.is_online_product) {
      if (!cleanText(formData.online_sku)) {
        errors.push("Online SKU is required for an online product.");
      }
      if (
        formData.online_price === null ||
        formData.online_price === "" ||
        Number(formData.online_price) < 0
      ) {
        errors.push("Enter a valid Online Price.");
      }
      if (!isValidUrl(cleanText(formData.website_product_url))) {
        errors.push("Website Product URL must be a valid http or https address.");
      }
    }

    return errors;
  }

  function buildPayload() {
    return {
      ...formData,
      name: cleanText(formData.name),
      category: cleanText(formData.category),
      default_finish: cleanText(formData.default_finish),
      default_colors: cleanText(formData.default_colors),
      material: cleanText(formData.material),
      material_thickness: cleanText(formData.material_thickness),
      size: cleanText(formData.size),
      default_quantity: Math.max(1, Number(formData.default_quantity || 1)),
      layer_count:
        formData.layer_count === null || formData.layer_count === ""
          ? null
          : Number(formData.layer_count),
      stock_quantity: formData.is_stock_item
        ? Math.max(0, Number(formData.stock_quantity || 0))
        : 0,
      reorder_quantity: formData.is_stock_item
        ? Math.max(0, Number(formData.reorder_quantity || 0))
        : 0,
      design_formula_notes: formData.has_design_formula
        ? cleanText(formData.design_formula_notes)
        : "",
      etch_formula_notes: formData.has_etch_formula
        ? cleanText(formData.etch_formula_notes)
        : "",
      default_workflow_name:
        cleanText(formData.default_workflow_name) ||
        `${cleanText(formData.name)} Workflow`,
      workflow_steps: workflowSteps,
      online_sku: formData.is_online_product
        ? cleanText(formData.online_sku).toUpperCase()
        : "",
      website_product_url: formData.is_online_product
        ? cleanText(formData.website_product_url)
        : "",
      online_price: formData.is_online_product
        ? Number(formData.online_price)
        : null,
      notes: cleanText(formData.notes),
      is_active: true,
    };
  }

  async function saveTemplate() {
    if (saving) return;

    const errors = validateForm();
    if (errors.length) {
      setValidationErrors(errors);
      notifications.show({
        title: "Template Needs Attention",
        message: "Correct the highlighted template information before saving.",
        color: "orange",
      });
      return;
    }

    setSaving(true);

    try {
      const payload = buildPayload();

      let duplicateQuery = supabase
        .from("product_templates")
        .select("id, name, online_sku")
        .ilike("name", payload.name);

      const { data: duplicateNames, error: duplicateNameError } =
        await duplicateQuery;

      if (duplicateNameError) throw duplicateNameError;

      if ((duplicateNames || []).length) {
        throw new Error(
          `A manufacturing template named “${payload.name}” already exists.`
        );
      }

      if (payload.is_online_product && payload.online_sku) {
        const { data: duplicateSku, error: duplicateSkuError } = await supabase
          .from("product_templates")
          .select("id")
          .ilike("online_sku", payload.online_sku)
          .limit(1);

        if (duplicateSkuError) throw duplicateSkuError;
        if ((duplicateSku || []).length) {
          throw new Error(
            `Online SKU ${payload.online_sku} is already assigned to another template.`
          );
        }
      }

      const { error } = await supabase
        .from("product_templates")
        .insert([payload]);

      if (error) throw error;

      setDirty(false);
      notifications.show({
        title: "Template Saved",
        message: `${payload.name} is ready for use in Metal Worx orders.`,
        color: "green",
        icon: <IconCheck size={18} />,
      });
      setPage("productTemplates");
    } catch (error) {
      notifications.show({
        title: "Template Could Not Be Saved",
        message: error.message,
        color: "red",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Stack gap="xl">
      <MWPageHeader
        title="New Manufacturing Template"
        subtitle="Create a standardized product recipe with materials, pricing, formulas, and workflow steps."
        buttonText="Back to Templates"
        onButtonClick={() => setPage("productTemplates")}
        setPage={setPage}
      />

      {validationErrors.length > 0 && (
        <Alert
          color="orange"
          icon={<IconAlertTriangle size={19} />}
          title="Complete the Required Template Information"
        >
          <Stack gap={4}>
            {validationErrors.map((error) => (
              <Text size="sm" key={error}>
                • {error}
              </Text>
            ))}
          </Stack>
        </Alert>
      )}

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
        <MWPanel
          title="General Information"
          subtitle="The standard identity and physical construction"
          icon={IconTemplate}
        >
          <Stack gap="md">
            <TextInput
              label="Product Name"
              placeholder='24" JSOC Patina Flag'
              value={formData.name}
              onChange={(event) => updateField("name", event.currentTarget.value)}
              required
              maxLength={150}
            />

            <Select
              label="Category"
              data={CATEGORIES}
              value={formData.category}
              onChange={(value) => updateField("category", value || "Flag")}
              searchable
              required
              allowDeselect={false}
            />

            <Group grow align="flex-start">
              <TextInput
                label="Size"
                placeholder="24 inch"
                value={formData.size}
                onChange={(event) => updateField("size", event.currentTarget.value)}
              />
              <NumberInput
                label="Layer Count"
                value={formData.layer_count}
                onChange={(value) => updateField("layer_count", value)}
                min={1}
                allowDecimal={false}
              />
            </Group>

            <Group grow align="flex-start">
              <TextInput
                label="Material"
                placeholder="Steel"
                value={formData.material}
                onChange={(event) =>
                  updateField("material", event.currentTarget.value)
                }
              />
              <TextInput
                label="Material Thickness"
                placeholder="14 gauge"
                value={formData.material_thickness}
                onChange={(event) =>
                  updateField("material_thickness", event.currentTarget.value)
                }
              />
            </Group>

            <TextInput
              label="Default Finish"
              placeholder="Patina"
              value={formData.default_finish}
              onChange={(event) =>
                updateField("default_finish", event.currentTarget.value)
              }
            />
            <TextInput
              label="Default Colors"
              placeholder="Copper, black, clear coat"
              value={formData.default_colors}
              onChange={(event) =>
                updateField("default_colors", event.currentTarget.value)
              }
            />
          </Stack>
        </MWPanel>

        <MWPanel
          title="Inventory & Website"
          subtitle="Stock behavior and optional online sales information"
          icon={IconInfoCircle}
        >
          <Stack gap="md">
            <NumberInput
              label="Default Order Quantity"
              value={formData.default_quantity}
              onChange={(value) => updateField("default_quantity", value)}
              min={1}
              allowDecimal={false}
              required
            />

            <Switch
              label="Stock Item"
              description="Metal Worx maintains a physical on-hand quantity"
              checked={formData.is_stock_item}
              onChange={(event) =>
                updateField("is_stock_item", event.currentTarget.checked)
              }
            />

            {formData.is_stock_item && (
              <Card withBorder radius="md" p="md">
                <Group grow align="flex-start">
                  <NumberInput
                    label="Opening Stock Quantity"
                    value={formData.stock_quantity}
                    onChange={(value) => updateField("stock_quantity", value)}
                    min={0}
                    allowDecimal={false}
                  />
                  <NumberInput
                    label="Reorder Quantity"
                    value={formData.reorder_quantity}
                    onChange={(value) => updateField("reorder_quantity", value)}
                    min={0}
                    allowDecimal={false}
                  />
                </Group>
              </Card>
            )}

            <Switch
              label="Repeat Item"
              description="This product is commonly ordered or rebuilt"
              checked={formData.is_repeat_item}
              onChange={(event) =>
                updateField("is_repeat_item", event.currentTarget.checked)
              }
            />

            <Switch
              label="Online Product"
              description="This product is sold through the Metal Worx website"
              checked={formData.is_online_product}
              onChange={(event) =>
                updateField("is_online_product", event.currentTarget.checked)
              }
            />

            {formData.is_online_product && (
              <Card withBorder radius="md" p="md">
                <Stack gap="md">
                  <Group gap="xs">
                    <Badge color="red" variant="light">
                      Online Product
                    </Badge>
                    <Text size="xs" c="dimmed">
                      SKU and price are required
                    </Text>
                  </Group>
                  <Group grow align="flex-start">
                    <TextInput
                      label="Online SKU"
                      value={formData.online_sku}
                      onChange={(event) =>
                        updateField("online_sku", event.currentTarget.value)
                      }
                      required
                    />
                    <NumberInput
                      label="Online Price"
                      prefix="$"
                      value={formData.online_price}
                      onChange={(value) => updateField("online_price", value)}
                      min={0}
                      decimalScale={2}
                      fixedDecimalScale
                      required
                    />
                  </Group>
                  <TextInput
                    label="Website Product URL"
                    placeholder="https://metalworxinc.net/..."
                    value={formData.website_product_url}
                    onChange={(event) =>
                      updateField(
                        "website_product_url",
                        event.currentTarget.value
                      )
                    }
                  />
                </Stack>
              </Card>
            )}
          </Stack>
        </MWPanel>

        <MWPanel
          title="Formulas & Notes"
          subtitle="Repeatable design, etching, and manufacturing instructions"
          icon={IconInfoCircle}
        >
          <Stack gap="md">
            <Switch
              label="Has Design Formula"
              checked={formData.has_design_formula}
              onChange={(event) =>
                updateField("has_design_formula", event.currentTarget.checked)
              }
            />
            {formData.has_design_formula && (
              <Textarea
                label="Design Formula Instructions"
                minRows={4}
                value={formData.design_formula_notes}
                onChange={(event) =>
                  updateField("design_formula_notes", event.currentTarget.value)
                }
                required
              />
            )}

            <Switch
              label="Has Etch Formula"
              checked={formData.has_etch_formula}
              onChange={(event) =>
                updateField("has_etch_formula", event.currentTarget.checked)
              }
            />
            {formData.has_etch_formula && (
              <Textarea
                label="Etch Formula Instructions"
                minRows={4}
                value={formData.etch_formula_notes}
                onChange={(event) =>
                  updateField("etch_formula_notes", event.currentTarget.value)
                }
                required
              />
            )}

            <Textarea
              label="General Manufacturing Notes"
              minRows={5}
              value={formData.notes}
              onChange={(event) => updateField("notes", event.currentTarget.value)}
            />
          </Stack>
        </MWPanel>

        <MWPanel
          title="Manufacturing Workflow"
          subtitle="The standard sequence used when this product enters production"
          icon={IconTemplate}
        >
          <Stack gap="md">
            <TextInput
              label="Workflow Name"
              placeholder="Flag Workflow"
              description="If blank, Metal Worx OS generates a name automatically"
              value={formData.default_workflow_name}
              onChange={(event) =>
                updateField(
                  "default_workflow_name",
                  event.currentTarget.value
                )
              }
            />
            <WorkflowBuilder
              steps={formData.workflow_steps}
              onChange={(steps) => updateField("workflow_steps", steps)}
            />
            <Alert color="blue" icon={<IconInfoCircle size={18} />}>
              Workflow order controls the order in which production steps are
              released to each department.
            </Alert>
          </Stack>
        </MWPanel>
      </SimpleGrid>

      <Group justify="space-between" wrap="wrap">
        <Text size="sm" c="dimmed">
          {dirty ? "Unsaved template changes" : "No unsaved changes"}
        </Text>
        <Group>
          <Button
            variant="light"
            color="gray"
            onClick={() => setPage("productTemplates")}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            color="red"
            leftSection={<IconDeviceFloppy size={18} />}
            loading={saving}
            onClick={saveTemplate}
          >
            Save Manufacturing Template
          </Button>
        </Group>
      </Group>
    </Stack>
  );
}

export default NewProductTemplate;