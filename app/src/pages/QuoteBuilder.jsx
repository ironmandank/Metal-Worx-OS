import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Divider,
  FileInput,
  Group,
  Image,
  Loader,
  NumberInput,
  Progress,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";

import { supabase } from "../lib/supabase";
import { generateNumber } from "../lib/generateNumber";

import MWPageHeader from "../components/ui/MWPageHeader";
import MWSection from "../components/ui/MWSection";

function money(value) {
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function formatDate(value) {
  if (!value) {
    return "Not set";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString();
}

function toDateInputValue(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function addDaysToDate(value, days) {
  const baseDate = value
    ? new Date(`${String(value).slice(0, 10)}T12:00:00`)
    : new Date();

  if (Number.isNaN(baseDate.getTime())) {
    return "";
  }

  baseDate.setDate(baseDate.getDate() + Number(days || 15));

  return baseDate.toISOString().slice(0, 10);
}

const TEMPLATE_TEXT_FIELDS = [
  "quote_title",
  "scope_of_work",
  "specifications",
  "included_services",
  "exclusions",
  "project_schedule",
  "down_payment_terms",
  "payment_terms",
  "warranty_terms",
  "disclaimer",
  "price_notes",
  "customer_responsibilities",
  "assumptions",
  "safety_technical_notice",
  "acceptance_terms",
];

function getMaterialStatus(request) {
  return (
    request.status ||
    request.request_status ||
    request.material_status ||
    "Request Submitted"
  );
}

function getMaterialQueue(request) {
  const status = getMaterialStatus(request);

  if (status === "Received" || request.received) {
    return "received";
  }

  if (
    status === "Ordered" ||
    status === "Partially Received" ||
    request.ordered
  ) {
    return "ordered";
  }

  if (status === "Ready to Order" || request.customer_approved) {
    return "ready";
  }

  if (
    status === "Waiting Customer Approval" ||
    (request.quote_complete && !request.customer_approved)
  ) {
    return "approval";
  }

  return "pricing";
}

function materialStatusColor(status) {
  if (status === "Received") {
    return "green";
  }

  if (status === "Ordered" || status === "Partially Received") {
    return "blue";
  }

  if (status === "Ready to Order") {
    return "grape";
  }

  if (status === "Waiting Customer Approval") {
    return "orange";
  }

  if (status === "Pricing Needed" || status === "Request Submitted") {
    return "red";
  }

  if (status === "Cancelled") {
    return "red";
  }

  return "gray";
}

function priorityColor(priority) {
  if (priority === "Rush") {
    return "red";
  }

  if (priority === "High") {
    return "orange";
  }

  if (priority === "Low") {
    return "gray";
  }

  return "green";
}

function QuoteBuilder({
  selectedProject,
  selectedQuote,
  setSelectedQuote,
  setPage,
}) {
  const [quote, setQuote] = useState(null);

  const [items, setItems] = useState([]);

  const [quoteImages, setQuoteImages] = useState([]);

  const [materialRequests, setMaterialRequests] = useState([]);

  const [loading, setLoading] = useState(true);

  const [materialsLoading, setMaterialsLoading] = useState(false);

  const [saving, setSaving] = useState(false);

  const [quoteTemplates, setQuoteTemplates] = useState([]);

  const [selectedTemplateId, setSelectedTemplateId] = useState(null);

  const [templateApplyMode, setTemplateApplyMode] = useState("fill");

  const [templateBusy, setTemplateBusy] = useState(false);

  const [templateValidDays, setTemplateValidDays] = useState(15);

  const [uploadingImage, setUploadingImage] = useState(false);

  const [newItem, setNewItem] = useState({
    item_type: "Base",
    title: "",
    description: "",
    quantity: 1,
    unit_price: 0,
  });

  const [imageFile, setImageFile] = useState(null);

  const [imageType, setImageType] = useState("Project Image");

  const [imageCaption, setImageCaption] = useState("");

  const [showImageOnPdf, setShowImageOnPdf] = useState(true);

  useEffect(() => {
    if (!selectedProject?.id && !selectedQuote?.id) {
      return;
    }

    initializeQuoteBuilder();
  }, [selectedProject, selectedQuote?.id]);

  async function initializeQuoteBuilder() {
    setLoading(true);

    try {
      await Promise.all([
        loadOrCreateQuote(),
        loadMaterialRequests(),
        loadQuoteTemplates(),
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function loadOrCreateQuote() {
    if (!selectedProject?.id && selectedQuote?.id) {
      const { data: standaloneQuote, error: standaloneError } = await supabase
        .from("project_quotes")
        .select("*")
        .eq("id", selectedQuote.id)
        .maybeSingle();

      if (standaloneError) {
        notifications.show({
          title: "Quote Load Failed",
          message: standaloneError.message,
          color: "red",
        });
        return;
      }

      if (!standaloneQuote) {
        setQuote(null);
        return;
      }

      setQuote(standaloneQuote);
      setSelectedQuote?.(standaloneQuote);
      setSelectedTemplateId(
        standaloneQuote.source_template_id
          ? String(standaloneQuote.source_template_id)
          : null,
      );
      await Promise.all([
        loadItems(standaloneQuote.id),
        loadQuoteImages(standaloneQuote.id),
      ]);
      return;
    }

    const { data: existingQuote, error: existingError } = await supabase
      .from("project_quotes")
      .select("*")
      .eq("project_id", selectedProject.id)
      .eq("is_active", true)
      .maybeSingle();

    if (existingError) {
      notifications.show({
        title: "Quote Load Failed",
        message: existingError.message,
        color: "red",
      });

      return;
    }

    if (existingQuote) {
      setQuote(existingQuote);
      setSelectedQuote?.(existingQuote);
      setSelectedTemplateId(
        existingQuote.source_template_id
          ? String(existingQuote.source_template_id)
          : null,
      );

      await Promise.all([
        loadItems(existingQuote.id),
        loadQuoteImages(existingQuote.id),
      ]);

      return;
    }

    try {
      const quoteNumber = await generateNumber("Quote");

      const { data: createdQuote, error } = await supabase
        .from("project_quotes")
        .insert([
          {
            quote_number: quoteNumber,

            project_id: selectedProject.id,

            quote_title: selectedProject.project_name || "Project Quote",

            customer_name: selectedProject.contact_name || "",

            project_name: selectedProject.project_name || "",

            tax_rate: 0.07,

            down_payment_terms: selectedProject.down_payment_required
              ? "50% deposit required to begin work"
              : "No deposit required unless otherwise stated.",

            payment_terms: selectedProject.down_payment_required
              ? "50% deposit required to initiate the project, with the remaining balance due upon completion."
              : "Payment is due upon completion unless otherwise stated.",

            warranty_terms:
              "Metal Worx Inc. warrants fabricated products against defects in workmanship for 90 days from completion.",

            disclaimer:
              "Due to fluctuations in material costs, Metal Worx Inc. reserves the right to update this quote. All prices are subject to final material cost verification.",

            scope_of_work: "",
            specifications: "",
            included_services: "",
            exclusions: "",
            project_schedule: "",
            price_notes: "",
            customer_responsibilities: "",
            assumptions: "",
            safety_technical_notice: "",
            acceptance_terms:
              "By signing below, the customer accepts this quote, including its scope, price, assumptions, exclusions, payment schedule, and stated terms. Work outside the approved scope requires customer authorization.",
            quote_layout: "Detailed Fabrication",
            status: "Draft",
          },
        ])
        .select()
        .single();

      if (error) {
        throw error;
      }

      setQuote(createdQuote);
      setSelectedQuote?.(createdQuote);
      setItems([]);
      setQuoteImages([]);
    } catch (error) {
      notifications.show({
        title: "Quote Creation Failed",
        message: error.message || "Unable to create the quote.",
        color: "red",
      });
    }
  }

  async function loadQuoteTemplates() {
    const { data, error } = await supabase
      .from("quote_templates")
      .select("*")
      .order("is_active", {
        ascending: false,
      })
      .order("template_category", {
        ascending: true,
      })
      .order("template_name", {
        ascending: true,
      });

    if (error) {
      notifications.show({
        title: "Template Load Failed",
        message: error.message,
        color: "red",
      });
      return;
    }

    setQuoteTemplates(data || []);
  }

  async function loadMaterialRequests() {
    if (!selectedProject?.id) {
      setMaterialRequests([]);
      return;
    }

    setMaterialsLoading(true);

    try {
      const { data, error } = await supabase
        .from("project_material_requests")
        .select("*")
        .eq("project_id", selectedProject.id)
        .not("status", "eq", "Cancelled")
        .order("created_at", {
          ascending: true,
        });

      if (error) {
        throw error;
      }

      setMaterialRequests(data || []);
    } catch (error) {
      console.error("Material pricing load error:", error);

      notifications.show({
        title: "Procurement Load Failed",
        message: error.message || "Unable to load material pricing.",
        color: "red",
      });
    } finally {
      setMaterialsLoading(false);
    }
  }

  async function loadItems(quoteId) {
    const { data, error } = await supabase
      .from("project_quote_items")
      .select("*")
      .eq("quote_id", quoteId)
      .order("sort_order", {
        ascending: true,
      });

    if (error) {
      console.error(error);
      return;
    }

    setItems(data || []);
  }

  async function loadQuoteImages(quoteId) {
    const { data, error } = await supabase
      .from("project_quote_images")
      .select("*")
      .eq("quote_id", quoteId)
      .order("sort_order", {
        ascending: true,
      });

    if (error) {
      console.error(error);
      return;
    }

    setQuoteImages(data || []);
  }

  function updateQuoteField(field, value) {
    setQuote((current) => ({
      ...current,
      [field]: value,
    }));
  }

  const procurementSummary = useMemo(() => {
    return materialRequests.reduce(
      (summary, request) => {
        const queue = getMaterialQueue(request);

        summary.total += 1;
        summary[queue] += 1;

        summary.vendorCost += Number(request.quoted_total || 0);

        summary.customerPrice += Number(request.customer_material_price || 0);

        summary.finalOrderedCost += Number(request.ordered_cost || 0);

        if (request.quote_expiration) {
          const expiration = new Date(request.quote_expiration);

          if (expiration < new Date()) {
            summary.expired += 1;
          }
        }

        return summary;
      },
      {
        total: 0,
        pricing: 0,
        approval: 0,
        ready: 0,
        ordered: 0,
        received: 0,
        expired: 0,
        vendorCost: 0,
        customerPrice: 0,
        finalOrderedCost: 0,
      },
    );
  }, [materialRequests]);

  const procurementComplete =
    procurementSummary.total === 0 || procurementSummary.pricing === 0;

  const materialProfit =
    procurementSummary.customerPrice - procurementSummary.vendorCost;

  const materialMargin =
    procurementSummary.customerPrice > 0
      ? (materialProfit / procurementSummary.customerPrice) * 100
      : 0;

  function calculateTotals(itemList = items, quoteData = quote) {
    const manualSubtotal = itemList
      .filter((item) => !item.is_optional || item.is_selected)
      .reduce((sum, item) => sum + Number(item.line_total || 0), 0);

    const materialSubtotal = procurementSummary.customerPrice;

    const subtotal = manualSubtotal + materialSubtotal;

    const taxRate = Number(quoteData?.tax_rate || 0);

    const taxAmount = subtotal * taxRate;

    const totalAmount = subtotal + taxAmount;

    return {
      manual_subtotal: manualSubtotal,

      material_subtotal: materialSubtotal,

      subtotal,

      tax_amount: taxAmount,

      total_amount: totalAmount,
    };
  }

  function quoteReadiness() {
    const missing = [];

    if (!quote?.scope_of_work?.trim()) {
      missing.push("Scope of work");
    }

    if (!procurementComplete) {
      missing.push(
        `${procurementSummary.pricing} material request${
          procurementSummary.pricing === 1 ? "" : "s"
        } still need pricing`,
      );
    }

    if (items.length === 0 && procurementSummary.total === 0) {
      missing.push("At least one quote item or priced material");
    }

    if (procurementSummary.expired > 0) {
      missing.push(
        `${procurementSummary.expired} vendor quote${
          procurementSummary.expired === 1 ? "" : "s"
        } expired`,
      );
    }

    return {
      ready: missing.length === 0,
      missing,
    };
  }

  const readiness = quoteReadiness();

  function getProjectNextAction(status) {
    if (!procurementComplete) {
      return "Complete material pricing";
    }

    if (status === "Draft") {
      return "Complete the customer quote";
    }

    if (status === "Ready for Review") {
      return "Review the customer quote";
    }

    if (status === "Sent") {
      return "Waiting for customer approval";
    }

    if (status === "Approved") {
      return selectedProject.down_payment_required
        ? "Collect the required down payment"
        : "Order approved materials";
    }

    if (status === "Declined") {
      return "Review the declined quote with the customer";
    }

    if (status === "Expired") {
      return "Update the expired quote";
    }

    return "Review quote";
  }

  function mergeTemplateValue(currentValue, templateValue, mode, field) {
    const current = String(currentValue || "").trim();
    const incoming = String(templateValue || "").trim();

    if (!incoming) {
      return currentValue || "";
    }

    if (mode === "replace") {
      return incoming;
    }

    if (mode === "append") {
      if (field === "quote_title") {
        return current || incoming;
      }

      return current ? `${current}\n\n${incoming}` : incoming;
    }

    return current ? currentValue : incoming;
  }

  async function applySelectedTemplate() {
    if (!quote?.id || !selectedTemplateId) {
      notifications.show({
        title: "Select a Template",
        message: "Choose a saved quote template before applying it.",
        color: "orange",
      });
      return;
    }

    const template = quoteTemplates.find(
      (entry) => String(entry.id) === String(selectedTemplateId),
    );

    if (!template) {
      return;
    }

    if (
      templateApplyMode === "replace" &&
      !window.confirm(
        "Replace the current standard wording and quote line items with this template?",
      )
    ) {
      return;
    }

    setTemplateBusy(true);

    try {
      const { data: templateItems, error } = await supabase
        .from("quote_template_items")
        .select("*")
        .eq("template_id", template.id)
        .order("sort_order", {
          ascending: true,
        });

      if (error) {
        throw error;
      }

      const nextQuote = {
        ...quote,
        source_template_id: template.id,
        source_template_name: template.template_name,
        template_applied_at: new Date().toISOString(),
        valid_until: addDaysToDate(
          quote.quote_date,
          template.valid_for_days || 15,
        ),
        quote_layout:
          template.quote_layout || quote.quote_layout || "Detailed Fabrication",
      };

      TEMPLATE_TEXT_FIELDS.forEach((field) => {
        nextQuote[field] = mergeTemplateValue(
          quote[field],
          template[field],
          templateApplyMode,
          field,
        );
      });

      setQuote(nextQuote);
      setTemplateValidDays(Number(template.valid_for_days || 15));

      const shouldAddItems = templateApplyMode !== "fill" || items.length === 0;

      if (templateApplyMode === "replace") {
        const { error: deleteError } = await supabase
          .from("project_quote_items")
          .delete()
          .eq("quote_id", quote.id);

        if (deleteError) {
          throw deleteError;
        }
      }

      if (shouldAddItems && (templateItems || []).length > 0) {
        const startingSort = templateApplyMode === "append" ? items.length : 0;

        const payload = templateItems.map((item, index) => ({
          quote_id: quote.id,
          item_type: item.item_type || "Service",
          title: item.title,
          description: item.description || "",
          quantity: Number(item.quantity || 0),
          unit_price: Number(item.unit_price || 0),
          line_total: Number(item.quantity || 0) * Number(item.unit_price || 0),
          is_optional: Boolean(item.is_optional),
          is_selected: item.is_selected !== false,
          show_on_pdf: item.show_on_pdf !== false,
          sort_order: startingSort + Number(item.sort_order || index + 1),
        }));

        const { error: insertError } = await supabase
          .from("project_quote_items")
          .insert(payload);

        if (insertError) {
          throw insertError;
        }
      }

      await loadItems(quote.id);

      notifications.show({
        title: "Template Applied",
        message:
          "The template was copied into this quote. Every populated field remains editable.",
        color: "green",
      });
    } catch (error) {
      notifications.show({
        title: "Template Apply Failed",
        message: error.message || "The template could not be applied.",
        color: "red",
      });
    } finally {
      setTemplateBusy(false);
    }
  }

  async function saveCurrentAsTemplate() {
    if (!quote?.id) {
      return;
    }

    const templateName = window.prompt(
      "Template name:",
      quote.quote_title || quote.project_name || "New Quote Template",
    );

    if (!templateName?.trim()) {
      return;
    }

    const templateCategory = window.prompt(
      "Template category:",
      "General Fabrication",
    );

    if (!templateCategory?.trim()) {
      return;
    }

    setTemplateBusy(true);

    try {
      const templatePayload = {
        template_name: templateName.trim(),
        template_category: templateCategory.trim(),
        template_description: `Created from quote ${
          quote.quote_number || ""
        }`.trim(),
        is_active: true,
        valid_for_days: Number(templateValidDays || 15),
        quote_layout: quote.quote_layout || "Detailed Fabrication",
      };

      TEMPLATE_TEXT_FIELDS.forEach((field) => {
        templatePayload[field] = quote[field] || "";
      });

      const { data: createdTemplate, error } = await supabase
        .from("quote_templates")
        .insert([templatePayload])
        .select()
        .single();

      if (error) {
        throw error;
      }

      if (items.length > 0) {
        const itemPayload = items.map((item, index) => ({
          template_id: createdTemplate.id,
          item_type: item.item_type || "Service",
          title: item.title,
          description: item.description || "",
          quantity: Number(item.quantity || 0),
          unit_price: Number(item.unit_price || 0),
          is_optional: Boolean(item.is_optional),
          is_selected: item.is_selected !== false,
          show_on_pdf: item.show_on_pdf !== false,
          sort_order: Number(item.sort_order || index + 1),
        }));

        const { error: itemError } = await supabase
          .from("quote_template_items")
          .insert(itemPayload);

        if (itemError) {
          throw itemError;
        }
      }

      await loadQuoteTemplates();
      setSelectedTemplateId(String(createdTemplate.id));

      notifications.show({
        title: "Template Saved",
        message:
          "The current wording and quote items are now available as a reusable template.",
        color: "green",
      });
    } catch (error) {
      notifications.show({
        title: "Template Save Failed",
        message: error.message,
        color: "red",
      });
    } finally {
      setTemplateBusy(false);
    }
  }

  async function updateSelectedTemplate() {
    if (!selectedTemplateId) {
      return;
    }

    const template = quoteTemplates.find(
      (entry) => String(entry.id) === String(selectedTemplateId),
    );

    if (
      !template ||
      !window.confirm(
        `Update "${template.template_name}" with this quote's current wording and line items? Existing quotes will not be changed.`,
      )
    ) {
      return;
    }

    setTemplateBusy(true);

    try {
      const updates = {
        valid_for_days: Number(templateValidDays || 15),
        quote_layout: quote.quote_layout || "Detailed Fabrication",
      };

      TEMPLATE_TEXT_FIELDS.forEach((field) => {
        updates[field] = quote[field] || "";
      });

      const { error } = await supabase
        .from("quote_templates")
        .update(updates)
        .eq("id", template.id);

      if (error) {
        throw error;
      }

      const { error: deleteError } = await supabase
        .from("quote_template_items")
        .delete()
        .eq("template_id", template.id);

      if (deleteError) {
        throw deleteError;
      }

      if (items.length > 0) {
        const itemPayload = items.map((item, index) => ({
          template_id: template.id,
          item_type: item.item_type || "Service",
          title: item.title,
          description: item.description || "",
          quantity: Number(item.quantity || 0),
          unit_price: Number(item.unit_price || 0),
          is_optional: Boolean(item.is_optional),
          is_selected: item.is_selected !== false,
          show_on_pdf: item.show_on_pdf !== false,
          sort_order: Number(item.sort_order || index + 1),
        }));

        const { error: itemError } = await supabase
          .from("quote_template_items")
          .insert(itemPayload);

        if (itemError) {
          throw itemError;
        }
      }

      await loadQuoteTemplates();

      notifications.show({
        title: "Template Updated",
        message:
          "Future uses of this template will receive the revised wording. Existing quotes remain unchanged.",
        color: "green",
      });
    } catch (error) {
      notifications.show({
        title: "Template Update Failed",
        message: error.message,
        color: "red",
      });
    } finally {
      setTemplateBusy(false);
    }
  }

  async function toggleSelectedTemplateActive() {
    const template = quoteTemplates.find(
      (entry) => String(entry.id) === String(selectedTemplateId),
    );

    if (!template) {
      return;
    }

    const nextActive = !template.is_active;

    if (
      !window.confirm(
        `${
          nextActive ? "Activate" : "Deactivate"
        } "${template.template_name}"?`,
      )
    ) {
      return;
    }

    setTemplateBusy(true);

    try {
      const { error } = await supabase
        .from("quote_templates")
        .update({
          is_active: nextActive,
        })
        .eq("id", template.id);

      if (error) {
        throw error;
      }

      await loadQuoteTemplates();

      notifications.show({
        title: nextActive ? "Template Activated" : "Template Deactivated",
        message: nextActive
          ? "The template is available for normal use."
          : "The template remains saved but is marked as a draft.",
        color: nextActive ? "green" : "orange",
      });
    } catch (error) {
      notifications.show({
        title: "Template Update Failed",
        message: error.message,
        color: "red",
      });
    } finally {
      setTemplateBusy(false);
    }
  }

  async function saveQuote() {
    if (!quote?.id) {
      return;
    }

    const restrictedStatuses = ["Ready for Review", "Sent", "Approved"];

    if (restrictedStatuses.includes(quote.status) && !procurementComplete) {
      notifications.show({
        title: "Material Pricing Incomplete",

        message:
          "All required material pricing must be completed before this quote can move forward.",

        color: "orange",

        autoClose: 7000,
      });

      return;
    }

    if (quote.status === "Ready for Review" && !readiness.ready) {
      notifications.show({
        title: "Quote Not Ready",

        message: readiness.missing.join(" • "),

        color: "orange",

        autoClose: 8000,
      });

      return;
    }

    setSaving(true);

    try {
      const totals = calculateTotals(items, quote);

      const updates = {
        quote_title: quote.quote_title || "",

        customer_name: quote.customer_name || "",

        project_name: quote.project_name || "",

        tax_rate: Number(quote.tax_rate || 0),

        status: quote.status || "Draft",

        down_payment_terms: quote.down_payment_terms || "",

        payment_terms: quote.payment_terms || "",

        warranty_terms: quote.warranty_terms || "",

        disclaimer: quote.disclaimer || "",

        scope_of_work: quote.scope_of_work || "",

        specifications: quote.specifications || "",

        included_services: quote.included_services || "",

        exclusions: quote.exclusions || "",

        project_schedule: quote.project_schedule || "",

        price_notes: quote.price_notes || "",

        customer_responsibilities: quote.customer_responsibilities || "",

        assumptions: quote.assumptions || "",

        safety_technical_notice: quote.safety_technical_notice || "",

        acceptance_terms: quote.acceptance_terms || "",

        quote_layout: quote.quote_layout || "Detailed Fabrication",

        valid_until: quote.valid_until || null,

        source_template_id: quote.source_template_id || null,

        source_template_name: quote.source_template_name || null,

        template_applied_at: quote.template_applied_at || null,

        subtotal: totals.subtotal,

        tax_amount: totals.tax_amount,

        total_amount: totals.total_amount,
      };

      const { error } = await supabase
        .from("project_quotes")
        .update(updates)
        .eq("id", quote.id);

      if (error) {
        throw error;
      }

      if (selectedProject?.id) {
        const projectUpdates = {
          quote_status:
            quote.status === "Ready for Review" ? "In Progress" : quote.status,
          next_action: getProjectNextAction(quote.status),
        };

        if (quote.status === "Approved") {
          projectUpdates.quote_status = "Approved";
          projectUpdates.approval_status = "Approved";
          projectUpdates.next_action = selectedProject.down_payment_required
            ? "Collect the required down payment"
            : "Order approved materials";
        }

        const { error: projectError } = await supabase
          .from("projects")
          .update(projectUpdates)
          .eq("id", selectedProject.id);
        if (projectError) throw projectError;
      }

      notifications.show({
        title: "Quote Saved",

        message: "Quote details, material pricing, and totals were saved.",

        color: "green",
      });

      await loadOrCreateQuote();
    } catch (error) {
      notifications.show({
        title: "Save Failed",
        message: error.message || "Unable to save the quote.",
        color: "red",
      });
    } finally {
      setSaving(false);
    }
  }

  async function markQuoteSent() {
    if (!procurementComplete) {
      notifications.show({
        title: "Material Pricing Incomplete",

        message:
          "Material pricing must be completed before the quote can be sent.",

        color: "orange",
      });

      return;
    }

    setSaving(true);

    try {
      const totals = calculateTotals(items, quote);

      const { error: quoteError } = await supabase
        .from("project_quotes")
        .update({
          status: "Sent",
          subtotal: totals.subtotal,
          tax_amount: totals.tax_amount,
          total_amount: totals.total_amount,
        })
        .eq("id", quote.id);

      if (quoteError) {
        throw quoteError;
      }

      if (selectedProject?.id) {
        const { error: projectError } = await supabase
          .from("projects")
          .update({
            quote_status: "Sent",
            approval_status: "Pending",
            next_action: "Waiting for customer approval",
          })
          .eq("id", selectedProject.id);
        if (projectError) throw projectError;
      }

      notifications.show({
        title: "Quote Marked Sent",
        message: "The project is now waiting for customer approval.",
        color: "green",
      });

      await loadOrCreateQuote();
    } catch (error) {
      notifications.show({
        title: "Quote Update Failed",
        message: error.message || "Unable to mark the quote as sent.",
        color: "red",
      });
    } finally {
      setSaving(false);
    }
  }

  async function markCustomerApproved() {
    setSaving(true);

    try {
      const { error: quoteError } = await supabase
        .from("project_quotes")
        .update({
          status: "Approved",
        })
        .eq("id", quote.id);

      if (quoteError) {
        throw quoteError;
      }

      if (selectedProject?.id) {
        const nextAction = selectedProject.down_payment_required
          ? "Collect the required down payment"
          : "Order approved materials";

        const { error: projectError } = await supabase
          .from("projects")
          .update({
            quote_status: "Approved",
            approval_status: "Approved",
            next_action: nextAction,
          })
          .eq("id", selectedProject.id);
        if (projectError) throw projectError;

        const { error: materialError } = await supabase
          .from("project_material_requests")
          .update({
            customer_approved: true,
            status: "Ready to Order",
          })
          .eq("project_id", selectedProject.id)
          .eq("quote_complete", true)
          .eq("customer_approved", false)
          .not(
            "status",
            "in",
            '("Ordered","Partially Received","Received","Cancelled")',
          );
        if (materialError) throw materialError;
      }

      notifications.show({
        title: "Customer Approval Recorded",

        message: selectedProject?.id
          ? selectedProject.down_payment_required
            ? "The quote was approved. Collect the down payment before ordering."
            : "The quote was approved and materials are ready to order."
          : "The standalone quote was approved and can now be converted into an outside project.",

        color: "green",

        autoClose: 7000,
      });

      await Promise.all([loadOrCreateQuote(), loadMaterialRequests()]);
    } catch (error) {
      notifications.show({
        title: "Approval Update Failed",

        message: error.message || "Unable to record customer approval.",

        color: "red",
      });
    } finally {
      setSaving(false);
    }
  }

  async function approvePreApprovedProject() {
    if (
      !selectedProject?.id ||
      selectedProject.customer_approval_required !== false
    ) {
      return;
    }

    setSaving(true);

    try {
      const { error: quoteError } = await supabase
        .from("project_quotes")
        .update({
          status: "Approved",
        })
        .eq("id", quote.id);

      if (quoteError) {
        throw quoteError;
      }

      const { error: projectError } = await supabase
        .from("projects")
        .update({
          quote_status: "Approved",

          approval_status: "Approved",

          next_action: "Order approved materials",
        })
        .eq("id", selectedProject.id);

      if (projectError) {
        throw projectError;
      }

      notifications.show({
        title: "Approved for Ordering",

        message: "The project may proceed to material ordering and production.",

        color: "green",
      });

      await loadOrCreateQuote();
    } catch (error) {
      notifications.show({
        title: "Approval Failed",

        message: error.message || "Unable to approve the project.",

        color: "red",
      });
    } finally {
      setSaving(false);
    }
  }

  async function addItem() {
    if (!newItem.title.trim()) {
      notifications.show({
        title: "Missing Item Title",
        message: "Add a title before adding this quote item.",
        color: "red",
      });

      return;
    }

    const lineTotal =
      Number(newItem.quantity || 0) * Number(newItem.unit_price || 0);

    const payload = {
      quote_id: quote.id,

      item_type: newItem.item_type,

      title: newItem.title,

      description: newItem.description,

      quantity: newItem.quantity,

      unit_price: newItem.unit_price,

      line_total: lineTotal,

      is_optional: newItem.item_type === "Optional",

      is_selected: newItem.item_type !== "Optional",

      show_on_pdf: true,

      sort_order: items.length + 1,
    };

    const { error } = await supabase
      .from("project_quote_items")
      .insert([payload]);

    if (error) {
      notifications.show({
        title: "Item Save Failed",
        message: error.message,
        color: "red",
      });

      return;
    }

    setNewItem({
      item_type: "Base",
      title: "",
      description: "",
      quantity: 1,
      unit_price: 0,
    });

    await loadItems(quote.id);
  }

  async function deleteItem(itemId) {
    const { error } = await supabase
      .from("project_quote_items")
      .delete()
      .eq("id", itemId);

    if (error) {
      notifications.show({
        title: "Delete Failed",
        message: error.message,
        color: "red",
      });

      return;
    }

    await loadItems(quote.id);
  }

  async function toggleOptionalItem(item) {
    const { error } = await supabase
      .from("project_quote_items")
      .update({
        is_selected: !item.is_selected,
      })
      .eq("id", item.id);

    if (error) {
      notifications.show({
        title: "Update Failed",
        message: error.message,
        color: "red",
      });

      return;
    }

    await loadItems(quote.id);
  }

  async function uploadQuoteImage() {
    if (!imageFile) {
      notifications.show({
        title: "No Image Selected",
        message: "Choose an image before uploading.",
        color: "red",
      });

      return;
    }

    setUploadingImage(true);

    try {
      const fileExtension = imageFile.name.split(".").pop();

      const safeFileName = imageFile.name
        .replace(/\.[^/.]+$/, "")
        .replace(/[^a-zA-Z0-9-_]/g, "-");

      const filePath = `${quote.id}/${Date.now()}-${safeFileName}.${fileExtension}`;

      const { error: uploadError } = await supabase.storage
        .from("quote-images")
        .upload(filePath, imageFile, {
          cacheControl: "3600",

          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: publicUrlData } = supabase.storage
        .from("quote-images")
        .getPublicUrl(filePath);

      const imageUrl = publicUrlData.publicUrl;

      const { error: databaseError } = await supabase
        .from("project_quote_images")
        .insert([
          {
            quote_id: quote.id,

            image_url: imageUrl,

            caption: imageCaption || "",

            image_type: imageType,

            show_on_pdf: showImageOnPdf,

            sort_order: quoteImages.length + 1,
          },
        ]);

      if (databaseError) {
        await supabase.storage.from("quote-images").remove([filePath]);

        throw databaseError;
      }

      notifications.show({
        title: "Image Uploaded",
        message: "The image was added to the quote.",
        color: "green",
      });

      setImageFile(null);
      setImageCaption("");
      setImageType("Project Image");
      setShowImageOnPdf(true);

      await loadQuoteImages(quote.id);
    } catch (error) {
      notifications.show({
        title: "Image Upload Failed",
        message: error.message || "The image could not be uploaded.",
        color: "red",
      });
    } finally {
      setUploadingImage(false);
    }
  }

  async function updateImageVisibility(image) {
    const { error } = await supabase
      .from("project_quote_images")
      .update({
        show_on_pdf: !image.show_on_pdf,
      })
      .eq("id", image.id);

    if (error) {
      notifications.show({
        title: "Update Failed",
        message: error.message,
        color: "red",
      });

      return;
    }

    await loadQuoteImages(quote.id);
  }

  async function deleteQuoteImage(image) {
    const { error: databaseError } = await supabase
      .from("project_quote_images")
      .delete()
      .eq("id", image.id);

    if (databaseError) {
      notifications.show({
        title: "Delete Failed",
        message: databaseError.message,
        color: "red",
      });

      return;
    }

    try {
      const marker = "/quote-images/";

      if (image.image_url?.includes(marker)) {
        const encodedPath = image.image_url.split(marker)[1];

        const storagePath = decodeURIComponent(encodedPath);

        await supabase.storage.from("quote-images").remove([storagePath]);
      }
    } catch (storageError) {
      console.error("Storage image cleanup failed:", storageError);
    }

    notifications.show({
      title: "Image Deleted",
      message: "The image was removed from the quote.",
      color: "green",
    });

    await loadQuoteImages(quote.id);
  }

  if (!selectedProject && !selectedQuote) {
    return (
      <MWSection title="No Quote Selected">
        <Text c="dimmed">Return to Quote Center and open a quote first.</Text>
      </MWSection>
    );
  }

  if (loading || !quote) {
    return (
      <>
        <MWPageHeader
          title="Quote Builder"
          subtitle={
            selectedProject?.project_name ||
            selectedQuote?.project_name ||
            "Preparing quote"
          }
          setPage={setPage}
          showBack={true}
          backPage={selectedProject?.id ? "projectDetails" : "quoteCenter"}
          backLabel={selectedProject?.id ? "Project Details" : "Quote Center"}
          showDashboard={true}
        />

        <Card withBorder radius="lg" p="xl">
          <Group justify="center">
            <Loader color="red" />

            <Text>Preparing quote builder...</Text>
          </Group>
        </Card>
      </>
    );
  }

  const baseItems = items.filter((item) => !item.is_optional);

  const optionalItems = items.filter((item) => item.is_optional);

  const liveTotals = calculateTotals(items, quote);

  const selectedTemplate =
    quoteTemplates.find(
      (entry) => String(entry.id) === String(selectedTemplateId),
    ) || null;

  const estimatedProfit =
    liveTotals.total_amount - procurementSummary.vendorCost;

  const estimatedMargin =
    liveTotals.total_amount > 0
      ? (estimatedProfit / liveTotals.total_amount) * 100
      : 0;

  return (
    <>
      <MWPageHeader
        title={quote.quote_number || "Quote Builder"}
        subtitle={
          quote.quote_title ||
          selectedProject?.project_name ||
          quote.project_name
        }
        setPage={setPage}
        showBack={true}
        backPage={selectedProject?.id ? "projectDetails" : "quoteCenter"}
        backLabel={selectedProject?.id ? "Project Details" : "Quote Center"}
        showDashboard={true}
      />

      <Group justify="space-between" mb="lg">
        <Group gap="xs">
          <Badge
            color={
              quote.status === "Approved"
                ? "green"
                : quote.status === "Sent"
                  ? "orange"
                  : "blue"
            }
            size="lg"
            variant="filled"
          >
            {quote.status || "Draft"}
          </Badge>

          <Badge color="orange" size="lg" variant="light">
            {selectedProject?.id
              ? selectedProject.customer_approval_required !== false
                ? "Customer Approval Required"
                : "Customer Already Approved"
              : "Standalone Formal Quote"}
          </Badge>
        </Group>

        <Group>
          <Button
            variant="light"
            color="gray"
            onClick={() =>
              setPage(selectedProject?.id ? "projectDetails" : "quoteCenter")
            }
          >
            {selectedProject?.id ? "Back to Project" : "Back to Quote Center"}
          </Button>

          <Button
            variant="light"
            color="red"
            onClick={() => setPage("quotePreview")}
          >
            Preview Quote
          </Button>

          <Button color="red" loading={saving} onClick={saveQuote}>
            Save Quote
          </Button>
        </Group>
      </Group>

      {!procurementComplete && (
        <Alert color="orange" title="Material Pricing Incomplete" mb="lg">
          <strong>{procurementSummary.pricing}</strong> material request
          {procurementSummary.pricing === 1 ? "" : "s"} still require pricing.
          The quote may remain a Draft, but it cannot be marked Ready for
          Review, Sent, or Approved until pricing is complete.
        </Alert>
      )}

      {procurementSummary.expired > 0 && (
        <Alert color="red" title="Expired Material Pricing" mb="lg">
          {procurementSummary.expired} material quote
          {procurementSummary.expired === 1 ? "" : "s"} have expired. Pricing
          should be verified before sending the customer quote.
        </Alert>
      )}

      <MWSection title="Saved Quote Templates">
        <Stack gap="lg">
          <Box>
            <Text size="xs" fw={800} c="red" tt="uppercase" mb={4}>
              Use a Template
            </Text>

            <Text size="sm" c="dimmed">
              Select standardized wording and reusable line items for this
              quote. Everything remains editable after the template is applied.
            </Text>
          </Box>

          <SimpleGrid
            cols={{
              base: 1,
              md: 2,
            }}
          >
            <Select
              label="Saved Template"
              placeholder="Select a quote template"
              searchable
              clearable
              data={quoteTemplates.map((template) => ({
                value: String(template.id),
                label: `${template.template_name} — ${
                  template.template_category
                }${template.is_active ? "" : " [DRAFT]"}`,
              }))}
              value={selectedTemplateId}
              onChange={(value) => {
                setSelectedTemplateId(value);

                const template = quoteTemplates.find(
                  (entry) => String(entry.id) === String(value),
                );

                if (template) {
                  setTemplateValidDays(Number(template.valid_for_days || 15));
                }
              }}
            />

            <Box
              p="sm"
              style={{
                border: "1px solid var(--mantine-color-dark-4)",
                borderRadius: "var(--mantine-radius-md)",
                background: "var(--mantine-color-dark-7)",
              }}
            >
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Selected Standard
              </Text>

              <Text fw={700} mt={3}>
                {selectedTemplate?.template_name || "No template selected"}
              </Text>

              <Text size="xs" c="dimmed">
                {selectedTemplate
                  ? `${selectedTemplate.template_category} • ${
                      selectedTemplate.is_active ? "Active" : "Draft"
                    }`
                  : "Choose a saved template to continue."}
              </Text>
            </Box>
          </SimpleGrid>

          <SimpleGrid
            cols={{
              base: 1,
              md: 3,
            }}
          >
            <Select
              label="How to Apply"
              data={[
                {
                  value: "fill",
                  label: "Keep Existing - Fill Blanks Only",
                },
                {
                  value: "append",
                  label: "Keep Existing - Add Template Below",
                },
                {
                  value: "replace",
                  label: "Replace Existing Quote Content",
                },
              ]}
              value={templateApplyMode}
              onChange={(value) => setTemplateApplyMode(value || "fill")}
            />

            <NumberInput
              label="Quote Valid For (Days)"
              min={1}
              max={365}
              value={templateValidDays}
              onChange={(value) => setTemplateValidDays(Number(value || 15))}
            />

            <Stack gap={5}>
              <Text size="sm" fw={500} ta="center">
                Template Action
              </Text>

              <Button
                color="red"
                fullWidth
                loading={templateBusy}
                disabled={!selectedTemplateId}
                onClick={applySelectedTemplate}
              >
                Apply Template to Quote
              </Button>
            </Stack>
          </SimpleGrid>

          {selectedTemplate && (
            <Alert
              color={selectedTemplate.is_active ? "green" : "orange"}
              title={selectedTemplate.template_name}
            >
              {selectedTemplate.template_description ||
                "No template description."}{" "}
              Applying this template copies its content into this quote; it does
              not permanently link the quote to future template changes.
            </Alert>
          )}

          <Divider />

          <Group justify="space-between" align="flex-end">
            <Box>
              <Text size="xs" fw={800} c="blue" tt="uppercase" mb={4}>
                Template Management
              </Text>

              <Text size="sm" c="dimmed">
                Create a new standard or intentionally update the selected
                standard. Existing quotes are never changed.
              </Text>
            </Box>

            <Group>
              <Button
                variant="light"
                color="green"
                loading={templateBusy}
                onClick={saveCurrentAsTemplate}
              >
                Save Quote as New Template
              </Button>

              <Button
                variant="light"
                color="blue"
                loading={templateBusy}
                disabled={!selectedTemplateId}
                onClick={updateSelectedTemplate}
              >
                Update Selected Template
              </Button>

              <Button
                variant="light"
                color={selectedTemplate?.is_active ? "orange" : "green"}
                loading={templateBusy}
                disabled={!selectedTemplateId}
                onClick={toggleSelectedTemplateActive}
              >
                {selectedTemplate?.is_active
                  ? "Mark as Draft"
                  : "Activate Template"}
              </Button>
            </Group>
          </Group>
        </Stack>
      </MWSection>

      <SimpleGrid
        cols={{
          base: 1,
          sm: 2,
          lg: 4,
        }}
        spacing="md"
        mb="lg"
      >
        <Card
          withBorder
          radius="lg"
          p="md"
          style={{
            borderLeft: "5px solid var(--mantine-color-red-6)",
          }}
        >
          <Text size="xs" c="dimmed">
            Internal Material Cost
          </Text>

          <Title order={2}>{money(procurementSummary.vendorCost)}</Title>

          <Text size="xs" c="dimmed">
            Estimated purchasing cost
          </Text>
        </Card>

        <Card
          withBorder
          radius="lg"
          p="md"
          style={{
            borderLeft: "5px solid var(--mantine-color-grape-6)",
          }}
        >
          <Text size="xs" c="dimmed">
            Customer Material Price
          </Text>

          <Title order={2}>{money(procurementSummary.customerPrice)}</Title>

          <Text size="xs" c="dimmed">
            Material margin {materialMargin.toFixed(1)}%
          </Text>
        </Card>

        <Card
          withBorder
          radius="lg"
          p="md"
          style={{
            borderLeft: "5px solid var(--mantine-color-blue-6)",
          }}
        >
          <Text size="xs" c="dimmed">
            Other Quote Items
          </Text>

          <Title order={2}>{money(liveTotals.manual_subtotal)}</Title>

          <Text size="xs" c="dimmed">
            Labor, installation, equipment, and extras
          </Text>
        </Card>

        <Card
          withBorder
          radius="lg"
          p="md"
          style={{
            borderLeft: "5px solid var(--mantine-color-green-6)",
          }}
        >
          <Text size="xs" c="dimmed">
            Quote Total
          </Text>

          <Title order={2} c="green">
            {money(liveTotals.total_amount)}
          </Title>

          <Text size="xs" c="dimmed">
            Includes estimated tax
          </Text>
        </Card>
      </SimpleGrid>

      <MWSection title="Quote Document Layout" mt="lg">
        <SimpleGrid
          cols={{
            base: 1,
            md: 2,
          }}
          spacing="lg"
        >
          <Select
            label="Printable Quote Layout"
            description="Controls how this quote is organized in Preview and PDF."
            data={[
              {
                value: "Detailed Fabrication",
                label: "Detailed Fabrication Proposal",
              },
              {
                value: "Standard Proposal",
                label: "Standard Metal Worx Proposal",
              },
            ]}
            value={quote.quote_layout || "Detailed Fabrication"}
            onChange={(value) =>
              updateQuoteField("quote_layout", value || "Detailed Fabrication")
            }
            allowDeselect={false}
          />

          <Textarea
            label="Price Notes"
            description="Tax, delivery, installation, allowances, or other notes shown below the project price."
            autosize
            minRows={3}
            maxRows={8}
            value={quote.price_notes || ""}
            onChange={(event) =>
              updateQuoteField("price_notes", event.currentTarget.value)
            }
          />
        </SimpleGrid>
      </MWSection>

      <SimpleGrid
        cols={{
          base: 1,
          lg: 3,
        }}
        spacing="lg"
      >
        <MWSection title="Quote Summary">
          <Stack>
            <Select
              label="Quote Status"
              data={[
                "Draft",
                "Ready for Review",
                "Sent",
                "Approved",
                "Declined",
                "Expired",
              ]}
              value={quote.status || "Draft"}
              onChange={(value) => updateQuoteField("status", value)}
            />

            <TextInput
              label="Quote Title"
              value={quote.quote_title || ""}
              onChange={(event) =>
                updateQuoteField("quote_title", event.currentTarget.value)
              }
            />

            <TextInput
              label="Customer Name"
              value={quote.customer_name || ""}
              onChange={(event) =>
                updateQuoteField("customer_name", event.currentTarget.value)
              }
            />

            <TextInput
              label="Project Name"
              value={quote.project_name || ""}
              onChange={(event) =>
                updateQuoteField("project_name", event.currentTarget.value)
              }
            />

            <TextInput
              type="date"
              label="Quote Expiration Date"
              description="This date can be changed for this quote without changing the template."
              value={toDateInputValue(quote.valid_until)}
              onChange={(event) =>
                updateQuoteField(
                  "valid_until",
                  event.currentTarget.value || null,
                )
              }
            />

            <NumberInput
              label="Tax Rate"
              description="Enter 0.07 for 7%"
              value={quote.tax_rate || 0}
              decimalScale={4}
              onChange={(value) => updateQuoteField("tax_rate", value || 0)}
            />

            <Divider />

            <Stack gap={6}>
              <Group justify="space-between">
                <Text>Priced Materials</Text>

                <Text fw={700}>{money(liveTotals.material_subtotal)}</Text>
              </Group>

              <Group justify="space-between">
                <Text>Other Quote Items</Text>

                <Text fw={700}>{money(liveTotals.manual_subtotal)}</Text>
              </Group>

              <Group justify="space-between">
                <Text>Subtotal</Text>

                <Text fw={700}>{money(liveTotals.subtotal)}</Text>
              </Group>

              <Group justify="space-between">
                <Text>Tax</Text>

                <Text fw={700}>{money(liveTotals.tax_amount)}</Text>
              </Group>

              <Divider />

              <Group justify="space-between">
                <Title order={3}>Total</Title>

                <Title order={3} c="red">
                  {money(liveTotals.total_amount)}
                </Title>
              </Group>
            </Stack>
          </Stack>
        </MWSection>

        <MWSection title="Add Quote Item">
          <Stack>
            <Alert color="blue" variant="light">
              Priced materials are included automatically. Add labor,
              installation, equipment, mileage, design, discounts, or optional
              work here.
            </Alert>

            <Select
              label="Item Type"
              data={[
                "Base",
                "Optional",
                "Mileage",
                "Labor",
                "Installation",
                "Design",
                "Equipment",
                "Subcontractor",
                "Permit",
                "Discount",
              ]}
              value={newItem.item_type}
              onChange={(value) =>
                setNewItem({
                  ...newItem,

                  item_type: value || "Base",
                })
              }
            />

            <TextInput
              label="Title"
              value={newItem.title}
              onChange={(event) =>
                setNewItem({
                  ...newItem,

                  title: event.currentTarget.value,
                })
              }
            />

            <Textarea
              label="Description"
              minRows={3}
              value={newItem.description}
              onChange={(event) =>
                setNewItem({
                  ...newItem,

                  description: event.currentTarget.value,
                })
              }
            />

            <Group grow>
              <NumberInput
                label="Qty"
                value={newItem.quantity}
                onChange={(value) =>
                  setNewItem({
                    ...newItem,

                    quantity: value || 0,
                  })
                }
              />

              <NumberInput
                label="Unit Price"
                prefix="$"
                value={newItem.unit_price}
                onChange={(value) =>
                  setNewItem({
                    ...newItem,

                    unit_price: value || 0,
                  })
                }
              />
            </Group>

            <Button color="red" onClick={addItem}>
              Add Quote Item
            </Button>
          </Stack>
        </MWSection>

        <MWSection title="Quote Readiness">
          <Stack>
            <Card withBorder radius="lg" p="md">
              <Group justify="space-between">
                <Group>
                  <ThemeIcon
                    color={readiness.ready ? "green" : "orange"}
                    radius="xl"
                    variant="light"
                  >
                    {readiness.ready ? "✓" : "!"}
                  </ThemeIcon>

                  <Box>
                    <Text fw={700}>
                      {readiness.ready ? "Ready for Review" : "Needs Attention"}
                    </Text>

                    <Text size="sm" c="dimmed">
                      {readiness.ready
                        ? "Quote requirements are complete."
                        : `${readiness.missing.length} item(s) still need attention.`}
                    </Text>
                  </Box>
                </Group>
              </Group>
            </Card>

            {readiness.missing.map((item) => (
              <Group key={item} gap="sm">
                <ThemeIcon color="orange" variant="light" radius="xl" size="sm">
                  !
                </ThemeIcon>

                <Text size="sm">{item}</Text>
              </Group>
            ))}

            <Divider />

            <Card withBorder radius="lg" p="md">
              <Text size="xs" c="dimmed">
                Estimated Gross Profit
              </Text>

              <Title order={3}>{money(estimatedProfit)}</Title>

              <Text size="sm" c="dimmed">
                Estimated margin: {estimatedMargin.toFixed(1)}%
              </Text>

              <Progress
                value={Math.max(Math.min(estimatedMargin, 100), 0)}
                color={
                  estimatedMargin >= 40
                    ? "green"
                    : estimatedMargin >= 25
                      ? "orange"
                      : "red"
                }
                mt="sm"
              />
            </Card>

            {!selectedProject?.id ||
            selectedProject.customer_approval_required !== false ? (
              <>
                <Button
                  color="orange"
                  variant="light"
                  disabled={!procurementComplete}
                  loading={saving}
                  onClick={markQuoteSent}
                >
                  Mark Quote Sent
                </Button>

                <Button
                  color="green"
                  disabled={quote.status !== "Sent"}
                  loading={saving}
                  onClick={markCustomerApproved}
                >
                  Record Customer Approval
                </Button>
              </>
            ) : (
              <Button
                color="green"
                disabled={!procurementComplete}
                loading={saving}
                onClick={approvePreApprovedProject}
              >
                Approve for Ordering / Production
              </Button>
            )}
          </Stack>
        </MWSection>
      </SimpleGrid>

      <Box mt="lg">
        <MWSection
          title="Material Pricing"
          subtitle="Approved material pricing included in this quote."
        >
          <Stack gap="md">
            <SimpleGrid
              cols={{
                base: 2,
                sm: 3,
                lg: 6,
              }}
              spacing="sm"
            >
              {[
                {
                  label: "Total Requests",

                  value: procurementSummary.total,

                  color: "gray",
                },
                {
                  label: "Pricing Needed",

                  value: procurementSummary.pricing,

                  color: "red",
                },
                {
                  label: "Waiting Approval",

                  value: procurementSummary.approval,

                  color: "orange",
                },
                {
                  label: "Ready to Order",

                  value: procurementSummary.ready,

                  color: "grape",
                },
                {
                  label: "Ordered",

                  value: procurementSummary.ordered,

                  color: "blue",
                },
                {
                  label: "Received",

                  value: procurementSummary.received,

                  color: "green",
                },
              ].map((card) => (
                <Card
                  key={card.label}
                  withBorder
                  radius="lg"
                  p="sm"
                  style={{
                    borderLeft: `4px solid var(--mantine-color-${card.color}-6)`,
                  }}
                >
                  <Text size="xs" c="dimmed">
                    {card.label}
                  </Text>

                  <Title order={3} c={card.color}>
                    {card.value}
                  </Title>
                </Card>
              ))}
            </SimpleGrid>

            <Group justify="space-between">
              <Group gap="lg">
                <Text size="sm">
                  <strong>Internal Cost:</strong>{" "}
                  {money(procurementSummary.vendorCost)}
                </Text>

                <Text size="sm">
                  <strong>Customer Price:</strong>{" "}
                  {money(procurementSummary.customerPrice)}
                </Text>

                <Text size="sm">
                  <strong>Material Profit:</strong> {money(materialProfit)}
                </Text>
              </Group>

              <Group>
                <Button
                  variant="light"
                  color="gray"
                  loading={materialsLoading}
                  onClick={loadMaterialRequests}
                >
                  Refresh Pricing
                </Button>

                <Button
                  variant="light"
                  color="red"
                  onClick={() => setPage("procurement")}
                >
                  Open Procurement
                </Button>
              </Group>
            </Group>

            {materialsLoading ? (
              <Card withBorder radius="lg" p="xl">
                <Group justify="center">
                  <Loader color="red" />

                  <Text>Loading material pricing...</Text>
                </Group>
              </Card>
            ) : materialRequests.length === 0 ? (
              <Card withBorder radius="lg" p="xl">
                <Stack align="center" gap="xs">
                  <Text fw={700}>No Material Requests</Text>

                  <Text size="sm" c="dimmed" ta="center">
                    This project does not currently contain material pricing.
                  </Text>

                  <Button
                    variant="light"
                    color="red"
                    onClick={() => setPage("editProject")}
                  >
                    Add Material Requests
                  </Button>
                </Stack>
              </Card>
            ) : (
              <ScrollArea>
                <Table
                  striped
                  highlightOnHover
                  withTableBorder
                  withColumnBorders
                  miw={1380}
                  verticalSpacing="sm"
                >
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Qty</Table.Th>

                      <Table.Th>Material</Table.Th>

                      <Table.Th>Vendor</Table.Th>

                      <Table.Th>Needed By</Table.Th>

                      <Table.Th>Priority</Table.Th>

                      <Table.Th>Status</Table.Th>

                      <Table.Th>Internal Cost</Table.Th>

                      <Table.Th>Customer Price</Table.Th>

                      <Table.Th>Markup</Table.Th>

                      <Table.Th>Quote Expires</Table.Th>
                    </Table.Tr>
                  </Table.Thead>

                  <Table.Tbody>
                    {materialRequests.map((request) => {
                      const status = getMaterialStatus(request);

                      const vendorCost = Number(request.quoted_total || 0);

                      const customerPrice = Number(
                        request.customer_material_price || 0,
                      );

                      const lineProfit = customerPrice - vendorCost;

                      return (
                        <Table.Tr key={request.id}>
                          <Table.Td>{request.quantity || 0}</Table.Td>

                          <Table.Td>
                            <Text fw={700} size="sm">
                              {request.item_name || "Unnamed Material"}
                            </Text>

                            <Text size="xs" c="dimmed">
                              {request.dimensions || "No dimensions"}
                            </Text>

                            {request.description && (
                              <Text size="xs" c="dimmed" mt={2}>
                                {request.description}
                              </Text>
                            )}
                          </Table.Td>

                          <Table.Td>
                            {request.vendor_name || "Not selected"}
                          </Table.Td>

                          <Table.Td>{formatDate(request.needed_by)}</Table.Td>

                          <Table.Td>
                            <Badge
                              color={priorityColor(request.priority)}
                              variant="light"
                            >
                              {request.priority || "Normal"}
                            </Badge>
                          </Table.Td>

                          <Table.Td>
                            <Badge
                              color={materialStatusColor(status)}
                              variant="filled"
                            >
                              {status}
                            </Badge>
                          </Table.Td>

                          <Table.Td>{money(vendorCost)}</Table.Td>

                          <Table.Td>
                            <Text fw={700}>{money(customerPrice)}</Text>
                          </Table.Td>

                          <Table.Td>
                            <Stack gap={0}>
                              <Text size="sm">
                                {Number(request.markup_percent || 0).toFixed(1)}
                                %
                              </Text>

                              <Text size="xs" c="dimmed">
                                {money(lineProfit)} profit
                              </Text>
                            </Stack>
                          </Table.Td>

                          <Table.Td>
                            {formatDate(request.quote_expiration)}
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            )}
          </Stack>
        </MWSection>
      </Box>

      <SimpleGrid
        cols={{
          base: 1,
          lg: 2,
        }}
        spacing="lg"
        mt="lg"
      >
        <MWSection title="Base Quote Items">
          <Stack>
            {baseItems.length === 0 ? (
              <Card withBorder radius="lg" p="xl">
                <Text c="dimmed" ta="center">
                  No labor, installation, equipment, mileage, or other quote
                  items have been added yet.
                </Text>
              </Card>
            ) : (
              baseItems.map((item) => (
                <Card key={item.id} withBorder radius="lg" p="md">
                  <Group justify="space-between">
                    <Box>
                      <Group gap="xs">
                        <Title order={4}>{item.title}</Title>

                        <Badge variant="light" color="blue">
                          {item.item_type}
                        </Badge>
                      </Group>

                      <Text size="sm" c="dimmed" mt={4}>
                        {item.description || "No description"}
                      </Text>

                      <Text size="sm" mt="xs">
                        {item.quantity} × {money(item.unit_price)}
                      </Text>
                    </Box>

                    <Stack align="flex-end">
                      <Title order={4}>{money(item.line_total)}</Title>

                      <Button
                        size="xs"
                        variant="light"
                        color="red"
                        onClick={() => deleteItem(item.id)}
                      >
                        Delete
                      </Button>
                    </Stack>
                  </Group>
                </Card>
              ))
            )}
          </Stack>
        </MWSection>

        <MWSection title="Optional Add-Ons">
          <Stack>
            {optionalItems.length === 0 ? (
              <Card withBorder radius="lg" p="xl">
                <Text c="dimmed" ta="center">
                  No optional add-ons added yet.
                </Text>
              </Card>
            ) : (
              optionalItems.map((item) => (
                <Card key={item.id} withBorder radius="lg" p="md">
                  <Group justify="space-between">
                    <Box>
                      <Title order={4}>{item.title}</Title>

                      <Text size="sm" c="dimmed">
                        {item.description || "No description"}
                      </Text>

                      <Text size="sm" mt="xs">
                        Optional Add-On: {money(item.line_total)}
                      </Text>

                      <Badge
                        mt="xs"
                        color={item.is_selected ? "green" : "gray"}
                      >
                        {item.is_selected ? "Selected" : "Not Selected"}
                      </Badge>
                    </Box>

                    <Stack>
                      <Button
                        size="xs"
                        variant="light"
                        color={item.is_selected ? "gray" : "green"}
                        onClick={() => toggleOptionalItem(item)}
                      >
                        {item.is_selected ? "Unselect" : "Select"}
                      </Button>

                      <Button
                        size="xs"
                        variant="light"
                        color="red"
                        onClick={() => deleteItem(item.id)}
                      >
                        Delete
                      </Button>
                    </Stack>
                  </Group>
                </Card>
              ))
            )}
          </Stack>
        </MWSection>
      </SimpleGrid>

      <SimpleGrid
        cols={{
          base: 1,
          lg: 2,
        }}
        spacing="lg"
        mt="lg"
      >
        <MWSection
          title="Quote Images & Drawings"
          subtitle="Upload site photos, drawings, renderings, layouts, and reference images."
        >
          <Stack>
            <FileInput
              label="Select Image"
              placeholder="Choose image file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              value={imageFile}
              onChange={setImageFile}
              clearable
            />

            <Select
              label="Image Type"
              data={[
                "Project Image",
                "Site Photo",
                "Drawing",
                "Rendering",
                "Reference Photo",
                "Layout",
                "Material Sample",
                "Finish Sample",
                "Other",
              ]}
              value={imageType}
              onChange={(value) => setImageType(value || "Project Image")}
            />

            <TextInput
              label="Caption"
              placeholder="Example: Proposed railing design"
              value={imageCaption}
              onChange={(event) => setImageCaption(event.currentTarget.value)}
            />

            <Checkbox
              label="Show this image on the PDF quote"
              checked={showImageOnPdf}
              onChange={(event) =>
                setShowImageOnPdf(event.currentTarget.checked)
              }
            />

            <Button
              color="red"
              loading={uploadingImage}
              onClick={uploadQuoteImage}
            >
              Upload Quote Image
            </Button>
          </Stack>
        </MWSection>

        <MWSection
          title="Image Gallery"
          subtitle={`${quoteImages.length} image${
            quoteImages.length === 1 ? "" : "s"
          } attached to this quote.`}
        >
          {quoteImages.length === 0 ? (
            <Text c="dimmed">No images have been added yet.</Text>
          ) : (
            <SimpleGrid
              cols={{
                base: 1,
                sm: 2,
              }}
              spacing="md"
            >
              {quoteImages.map((image) => (
                <Card key={image.id} withBorder radius="lg" p="sm">
                  <Card.Section>
                    <Image
                      src={image.image_url}
                      alt={image.caption || image.image_type || "Quote image"}
                      h={220}
                      fit="cover"
                    />
                  </Card.Section>

                  <Stack gap="xs" mt="sm">
                    <Group justify="space-between">
                      <Badge variant="light" color="red">
                        {image.image_type}
                      </Badge>

                      <Badge
                        variant="light"
                        color={image.show_on_pdf ? "green" : "gray"}
                      >
                        {image.show_on_pdf ? "PDF Visible" : "PDF Hidden"}
                      </Badge>
                    </Group>

                    <Text size="sm">{image.caption || "No caption"}</Text>

                    <Group grow>
                      <Button
                        size="xs"
                        variant="light"
                        color="gray"
                        onClick={() => updateImageVisibility(image)}
                      >
                        {image.show_on_pdf ? "Hide from PDF" : "Show on PDF"}
                      </Button>

                      <Button
                        size="xs"
                        variant="light"
                        color="red"
                        onClick={() => deleteQuoteImage(image)}
                      >
                        Delete
                      </Button>
                    </Group>
                  </Stack>
                </Card>
              ))}
            </SimpleGrid>
          )}
        </MWSection>
      </SimpleGrid>

      <SimpleGrid
        cols={{
          base: 1,
          lg: 2,
        }}
        spacing="lg"
        mt="lg"
      >
        <MWSection title="Scope of Work">
          <Stack>
            <Textarea
              label="Scope of Work"
              autosize
              minRows={8}
              maxRows={16}
              value={quote.scope_of_work || ""}
              onChange={(event) =>
                updateQuoteField("scope_of_work", event.currentTarget.value)
              }
            />

            <Textarea
              label="Specifications"
              autosize
              minRows={7}
              maxRows={14}
              value={quote.specifications || ""}
              onChange={(event) =>
                updateQuoteField("specifications", event.currentTarget.value)
              }
            />

            <Textarea
              label="Included Services"
              autosize
              minRows={7}
              maxRows={14}
              value={quote.included_services || ""}
              onChange={(event) =>
                updateQuoteField("included_services", event.currentTarget.value)
              }
            />

            <Textarea
              label="Exclusions"
              autosize
              minRows={6}
              maxRows={12}
              value={quote.exclusions || ""}
              onChange={(event) =>
                updateQuoteField("exclusions", event.currentTarget.value)
              }
            />

            <Textarea
              label="Customer Responsibilities"
              description="List customer-provided information, access, approvals, delivery, site preparation, or other prerequisites."
              autosize
              minRows={7}
              maxRows={16}
              value={quote.customer_responsibilities || ""}
              onChange={(event) =>
                updateQuoteField(
                  "customer_responsibilities",
                  event.currentTarget.value,
                )
              }
            />

            <Textarea
              label="Assumptions"
              description="List the pricing, dimensions, materials, field conditions, or project conditions assumed by this quote."
              autosize
              minRows={7}
              maxRows={16}
              value={quote.assumptions || ""}
              onChange={(event) =>
                updateQuoteField("assumptions", event.currentTarget.value)
              }
            />
          </Stack>
        </MWSection>

        <MWSection title="Terms & Schedule">
          <Stack>
            <Textarea
              label="Down Payment Terms"
              autosize
              minRows={4}
              maxRows={8}
              value={quote.down_payment_terms || ""}
              onChange={(event) =>
                updateQuoteField(
                  "down_payment_terms",
                  event.currentTarget.value,
                )
              }
            />

            <Textarea
              label="Payment Terms"
              autosize
              minRows={5}
              maxRows={10}
              value={quote.payment_terms || ""}
              onChange={(event) =>
                updateQuoteField("payment_terms", event.currentTarget.value)
              }
            />

            <Textarea
              label="Warranty Terms"
              autosize
              minRows={7}
              maxRows={14}
              value={quote.warranty_terms || ""}
              onChange={(event) =>
                updateQuoteField("warranty_terms", event.currentTarget.value)
              }
            />

            <Textarea
              label="Disclaimer"
              autosize
              minRows={7}
              maxRows={14}
              value={quote.disclaimer || ""}
              onChange={(event) =>
                updateQuoteField("disclaimer", event.currentTarget.value)
              }
            />

            <Textarea
              label="Project Schedule"
              autosize
              minRows={6}
              maxRows={12}
              value={quote.project_schedule || ""}
              onChange={(event) =>
                updateQuoteField("project_schedule", event.currentTarget.value)
              }
            />

            <Textarea
              label="Safety and Technical Notice"
              description="Project-specific safety, engineering, field-condition, certification, or technical notice."
              autosize
              minRows={7}
              maxRows={16}
              value={quote.safety_technical_notice || ""}
              onChange={(event) =>
                updateQuoteField(
                  "safety_technical_notice",
                  event.currentTarget.value,
                )
              }
            />

            <Textarea
              label="Acceptance Terms"
              description="Language printed immediately above the customer and contractor signature section."
              autosize
              minRows={6}
              maxRows={14}
              value={quote.acceptance_terms || ""}
              onChange={(event) =>
                updateQuoteField("acceptance_terms", event.currentTarget.value)
              }
            />
          </Stack>
        </MWSection>
      </SimpleGrid>

      <Group justify="flex-end" mt="xl">
        <Button
          variant="light"
          color="gray"
          onClick={() => setPage("projectDetails")}
        >
          Back to Project
        </Button>

        <Button
          variant="light"
          color="red"
          onClick={() => setPage("quotePreview")}
        >
          Preview Quote
        </Button>

        <Button color="red" loading={saving} onClick={saveQuote}>
          Save Quote
        </Button>
      </Group>
    </>
  );
}

export default QuoteBuilder;
