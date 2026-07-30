import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Group,
  Loader,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";

import { supabase } from "../lib/supabase";
import { generateNumber } from "../lib/generateNumber";

import MWPageHeader from "../components/ui/MWPageHeader";
import MWSection from "../components/ui/MWSection";

const TEMPLATE_FIELDS = [
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

function money(value) {
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function formatDate(value) {
  if (!value) return "Not set";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString("en-US");
}

function addDays(value, days) {
  const date = value ? new Date(`${value}T12:00:00`) : new Date();
  date.setDate(date.getDate() + Number(days || 15));
  return date.toISOString().slice(0, 10);
}

function statusColor(status) {
  if (status === "Approved") return "green";
  if (status === "Sent" || status === "Ready for Review") return "blue";
  if (status === "Declined" || status === "Cancelled" || status === "Expired")
    return "red";
  return "gray";
}

function QuoteCenter({
  setPage,
  setSelectedQuote,
  setSelectedProject,
  activeUser,
}) {
  const activeUserName =
    typeof activeUser === "string"
      ? activeUser
      : activeUser?.full_name ||
        activeUser?.name ||
        activeUser?.display_name ||
        "Dan";

  const [quotes, setQuotes] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [converting, setConverting] = useState(false);
  const [conversionQuote, setConversionQuote] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Open");
  const [typeFilter, setTypeFilter] = useState("All");
  const [conversionForm, setConversionForm] = useState({
    design_required: false,
    fabrication_required: true,
    test_fit_required: true,
    finish_required: true,
    assembly_required: false,
    install_required: true,
    down_payment_required: true,
  });
  const [form, setForm] = useState({
    customer_id: null,
    company_name: "",
    contact_name: "",
    contact_phone: "",
    contact_email: "",
    billing_address: "",
    billing_city: "",
    billing_state: "NC",
    billing_zip: "",
    project_name: "",
    assigned_to: activeUserName,
    template_id: null,
  });

  useEffect(() => {
    loadCenter();
  }, []);

  async function loadCenter() {
    setLoading(true);
    try {
      const [quoteResult, customerResult, templateResult] = await Promise.all([
        supabase
          .from("project_quotes")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("customers")
          .select("*")
          .order("company_name", { ascending: true }),
        supabase
          .from("quote_templates")
          .select("*")
          .eq("is_active", true)
          .order("template_name", { ascending: true }),
      ]);

      if (quoteResult.error) throw quoteResult.error;
      if (customerResult.error) throw customerResult.error;
      if (templateResult.error) throw templateResult.error;

      setQuotes(quoteResult.data || []);
      setCustomers(customerResult.data || []);
      setTemplates(templateResult.data || []);
    } catch (error) {
      notifications.show({
        title: "Quote Center Could Not Load",
        message: error.message,
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  }

  const customerOptions = useMemo(
    () =>
      customers.map((customer) => {
        const person =
          `${customer.first_name || ""} ${customer.last_name || ""}`.trim() ||
          customer.contact_name ||
          customer.name ||
          "";
        const company = customer.company_name || customer.business_name || "";
        return {
          value: String(customer.id),
          label:
            [company, person].filter(Boolean).join(" — ") ||
            `Customer ${customer.id}`,
        };
      }),
    [customers],
  );

  const filteredQuotes = useMemo(() => {
    const term = search.trim().toLowerCase();
    const closed = ["Declined", "Cancelled", "Expired"];

    return quotes.filter((quote) => {
      if (
        statusFilter === "Open" &&
        closed.includes(String(quote.status || ""))
      ) {
        return false;
      }
      if (
        statusFilter !== "All" &&
        statusFilter !== "Open" &&
        quote.status !== statusFilter
      ) {
        return false;
      }
      if (typeFilter !== "All" && quote.quote_type !== typeFilter) return false;

      if (!term) return true;
      return [
        quote.quote_number,
        quote.company_name,
        quote.customer_name,
        quote.contact_name,
        quote.project_name,
        quote.quote_title,
        quote.assigned_to,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [quotes, search, statusFilter, typeFilter]);

  const stats = useMemo(
    () => ({
      open: quotes.filter(
        (quote) => !["Declined", "Cancelled", "Expired"].includes(quote.status),
      ).length,
      draft: quotes.filter((quote) => quote.status === "Draft").length,
      sent: quotes.filter((quote) => quote.status === "Sent").length,
      approved: quotes.filter((quote) => quote.status === "Approved").length,
    }),
    [quotes],
  );

  function chooseCustomer(value) {
    const customer = customers.find(
      (entry) => String(entry.id) === String(value),
    );
    if (!customer) {
      setForm((current) => ({ ...current, customer_id: null }));
      return;
    }

    const contact =
      `${customer.first_name || ""} ${customer.last_name || ""}`.trim() ||
      customer.contact_name ||
      customer.name ||
      "";

    setForm((current) => ({
      ...current,
      customer_id: String(customer.id),
      company_name:
        customer.company_name || customer.business_name || current.company_name,
      contact_name: contact || current.contact_name,
      contact_phone:
        customer.phone || customer.phone_number || current.contact_phone,
      contact_email: customer.email || current.contact_email,
      billing_address:
        customer.address || customer.street_address || current.billing_address,
      billing_city: customer.city || current.billing_city,
      billing_state: customer.state || current.billing_state,
      billing_zip:
        customer.zip_code || customer.postal_code || current.billing_zip,
    }));
  }

  function updateFormField(field) {
    return (event) => {
      const value = event.currentTarget.value;
      setForm((current) => ({
        ...current,
        [field]: value,
      }));
    };
  }

  async function openQuote(quote, targetPage) {
    try {
      setSelectedQuote(quote);
      if (quote.project_id) {
        const { data, error } = await supabase
          .from("projects")
          .select("*")
          .eq("id", quote.project_id)
          .maybeSingle();
        if (error) throw error;
        setSelectedProject(data || null);
      } else {
        setSelectedProject(null);
      }
      setPage(targetPage);
    } catch (error) {
      notifications.show({
        title: "Quote Could Not Open",
        message: error.message,
        color: "red",
      });
    }
  }

  async function openProject(quote) {
    const projectId = quote.converted_project_id || quote.project_id;
    if (!projectId) return;

    try {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();
      if (error) throw error;

      setSelectedQuote(quote);
      setSelectedProject(data);
      setPage("projectDetails");
    } catch (error) {
      notifications.show({
        title: "Project Could Not Open",
        message: error.message,
        color: "red",
      });
    }
  }

  function beginConversion(quote) {
    setConversionQuote(quote);
    setConversionForm({
      design_required: false,
      fabrication_required: true,
      test_fit_required: true,
      finish_required: true,
      assembly_required: false,
      install_required: true,
      down_payment_required: Number(quote.total_amount || 0) > 0,
    });
    window.setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 0);
  }

  function updateConversionField(field) {
    return (event) => {
      const checked = event.currentTarget.checked;
      setConversionForm((current) => ({
        ...current,
        [field]: checked,
      }));
    };
  }

  async function convertQuote() {
    if (!conversionQuote) return;

    setConverting(true);
    try {
      const actor = activeUserName || "Metal Worx";

      const { data, error } = await supabase.rpc(
        "mw_convert_quote_to_project",
        {
          p_quote_id: Number(conversionQuote.id),
          p_converted_by: actor,
          p_fabrication_required: conversionForm.fabrication_required,
          p_test_fit_required: conversionForm.test_fit_required,
          p_finish_required: conversionForm.finish_required,
          p_assembly_required: conversionForm.assembly_required,
          p_install_required: conversionForm.install_required,
          p_design_required: conversionForm.design_required,
          p_down_payment_required: conversionForm.down_payment_required,
        },
      );
      if (error) throw error;

      const project = Array.isArray(data) ? data[0] : data;
      if (!project?.id) {
        throw new Error("The project was created but was not returned.");
      }

      const updatedQuote = {
        ...conversionQuote,
        project_id: project.id,
        converted_project_id: project.id,
        converted_at: new Date().toISOString(),
        converted_by: actor,
        quote_type: "Project Quote",
      };

      setQuotes((current) =>
        current.map((quote) =>
          quote.id === conversionQuote.id ? updatedQuote : quote,
        ),
      );
      setConversionQuote(null);

      notifications.show({
        title: "Outside Project Created",
        message: `${project.project_number} was created from ${conversionQuote.quote_number}.`,
        color: "green",
      });
    } catch (error) {
      notifications.show({
        title: "Quote Could Not Be Converted",
        message: error.message,
        color: "red",
      });
    } finally {
      setConverting(false);
    }
  }

  async function createStandaloneQuote() {
    if (!form.project_name.trim()) {
      notifications.show({
        title: "Quote Title Required",
        message: "Enter the product, service, or formal quote name.",
        color: "orange",
      });
      return;
    }

    if (!form.company_name.trim() && !form.contact_name.trim()) {
      notifications.show({
        title: "Customer Required",
        message: "Select a customer or enter a company/contact name.",
        color: "orange",
      });
      return;
    }

    setCreating(true);
    try {
      const template = templates.find(
        (entry) => String(entry.id) === String(form.template_id),
      );
      const quoteNumber = await generateNumber("Quote");
      const quoteDate = new Date().toISOString().slice(0, 10);

      const payload = {
        quote_number: quoteNumber,
        project_id: null,
        quote_type: "Standalone Quote",
        customer_id: form.customer_id ? Number(form.customer_id) : null,
        company_name: form.company_name.trim() || null,
        contact_name: form.contact_name.trim() || null,
        customer_name:
          form.company_name.trim() || form.contact_name.trim() || null,
        contact_phone: form.contact_phone.trim() || null,
        contact_email: form.contact_email.trim() || null,
        billing_address: form.billing_address.trim() || null,
        billing_city: form.billing_city.trim() || null,
        billing_state: form.billing_state.trim() || null,
        billing_zip: form.billing_zip.trim() || null,
        project_name: form.project_name.trim(),
        quote_title: form.project_name.trim(),
        assigned_to: form.assigned_to.trim() || activeUserName,
        prepared_by: form.assigned_to.trim() || activeUserName,
        quote_date: quoteDate,
        valid_until: addDays(quoteDate, template?.valid_for_days || 15),
        status: "Draft",
        is_active: true,
        tax_rate: 0.07,
        source_template_id: template?.id || null,
        source_template_name: template?.template_name || null,
        template_applied_at: template ? new Date().toISOString() : null,
        quote_layout: template?.quote_layout || "Detailed Fabrication",
      };

      TEMPLATE_FIELDS.forEach((field) => {
        if (field !== "quote_title") {
          payload[field] = template?.[field] || "";
        }
      });

      const { data: createdQuote, error } = await supabase
        .from("project_quotes")
        .insert([payload])
        .select()
        .single();
      if (error) throw error;

      if (template?.id) {
        const { data: templateItems, error: itemLoadError } = await supabase
          .from("quote_template_items")
          .select("*")
          .eq("template_id", template.id)
          .order("sort_order", { ascending: true });
        if (itemLoadError) throw itemLoadError;

        if ((templateItems || []).length) {
          const itemPayload = templateItems.map((item, index) => ({
            quote_id: createdQuote.id,
            item_type: item.item_type || "Service",
            title: item.title,
            description: item.description || "",
            quantity: Number(item.quantity || 0),
            unit_price: Number(item.unit_price || 0),
            line_total:
              Number(item.quantity || 0) * Number(item.unit_price || 0),
            is_optional: Boolean(item.is_optional),
            is_selected: item.is_selected !== false,
            show_on_pdf: item.show_on_pdf !== false,
            sort_order: Number(item.sort_order || index + 1),
          }));
          const { error: itemError } = await supabase
            .from("project_quote_items")
            .insert(itemPayload);
          if (itemError) throw itemError;
        }
      }

      setSelectedQuote(createdQuote);
      setSelectedProject(null);
      notifications.show({
        title: "Standalone Quote Created",
        message: `${createdQuote.quote_number} is ready to build.`,
        color: "green",
      });
      setPage("quoteBuilder");
    } catch (error) {
      notifications.show({
        title: "Quote Could Not Be Created",
        message: error.message,
        color: "red",
      });
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <>
        <MWPageHeader
          title="Quote Center"
          subtitle="Loading formal customer quotes"
          setPage={setPage}
          showDashboard={true}
        />
        <Card withBorder radius="lg" p="xl">
          <Group justify="center">
            <Loader color="red" />
            <Text c="dimmed">Loading quotes...</Text>
          </Group>
        </Card>
      </>
    );
  }

  const conversionPanel = conversionQuote ? (
    <MWSection title="Convert Approved Quote to Outside Project">
        <Stack>
          <Alert color="blue">
            Select the work required for{" "}
            <strong>
              {conversionQuote?.quote_number} —{" "}
              {conversionQuote?.project_name ||
                conversionQuote?.quote_title ||
                "Outside Project"}
            </strong>
            . These selections create the project workflow and can still be
            reviewed from the project.
          </Alert>

          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Checkbox
              label="Design"
              description="Artwork, drawings, or design approval is required"
              checked={conversionForm.design_required}
              onChange={updateConversionField("design_required")}
            />
            <Checkbox
              label="Welding / Fabrication"
              description="The project requires shop fabrication"
              checked={conversionForm.fabrication_required}
              onChange={updateConversionField("fabrication_required")}
            />
            <Checkbox
              label="Test Fit"
              description="A shop or customer-site test fit is required"
              checked={conversionForm.test_fit_required}
              onChange={updateConversionField("test_fit_required")}
            />
            <Checkbox
              label="Finish / Corrections"
              description="Paint, powder coating, or finish corrections"
              checked={conversionForm.finish_required}
              onChange={updateConversionField("finish_required")}
            />
            <Checkbox
              label="Assembly"
              description="Final assembly is required after finishing"
              checked={conversionForm.assembly_required}
              onChange={updateConversionField("assembly_required")}
            />
            <Checkbox
              label="Customer-Site Installation"
              description="The completed work must be installed at the site"
              checked={conversionForm.install_required}
              onChange={updateConversionField("install_required")}
            />
          </SimpleGrid>

          <Card withBorder radius="md" p="md">
            <Checkbox
              label="Down Payment Required"
              description={`Create the project with ${money(
                conversionQuote?.total_amount,
              )} due and make the down payment its first commercial action`}
              checked={conversionForm.down_payment_required}
              onChange={updateConversionField("down_payment_required")}
            />
          </Card>

          <Group justify="flex-end">
            <Button
              variant="light"
              color="gray"
              disabled={converting}
              onClick={() => setConversionQuote(null)}
            >
              Cancel
            </Button>
            <Button color="green" loading={converting} onClick={convertQuote}>
              Create Outside Project
            </Button>
          </Group>
        </Stack>
    </MWSection>
  ) : null;

  return (
    <>

      <MWPageHeader
        title="Quote Center"
        subtitle="Create, manage, send, and convert formal Metal Worx quotes"
        setPage={setPage}
        showDashboard={true}
      />

      <Group justify="flex-end" mb="lg">
        <Button
          color="red"
          onClick={() => setShowCreate((current) => !current)}
        >
          {showCreate ? "Close New Quote" : "New Standalone Quote"}
        </Button>
      </Group>

      {conversionPanel}

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md" mb="lg">
        {[
          ["Open Quotes", stats.open],
          ["Draft", stats.draft],
          ["Sent", stats.sent],
          ["Approved", stats.approved],
        ].map(([label, value]) => (
          <Card key={label} withBorder radius="lg" p="lg">
            <Text size="xs" c="dimmed" fw={800} tt="uppercase">
              {label}
            </Text>
            <Title order={2} c="white">
              {value}
            </Title>
          </Card>
        ))}
      </SimpleGrid>

      {showCreate && (
        <MWSection title="New Standalone Formal Quote">
          <Alert color="blue" mb="md">
            This creates a quote without creating an outside project. An
            approved quote can be converted into a project later.
          </Alert>
          <Stack>
            <SimpleGrid cols={{ base: 1, md: 2 }}>
              <Select
                label="Existing Customer"
                placeholder="Optional — search customers"
                searchable
                clearable
                data={customerOptions}
                value={form.customer_id}
                onChange={chooseCustomer}
              />
              <Select
                label="Saved Quote Template"
                placeholder="Optional — start blank"
                searchable
                clearable
                data={templates.map((template) => ({
                  value: String(template.id),
                  label: `${template.template_name} — ${template.template_category}`,
                }))}
                value={form.template_id}
                onChange={(value) =>
                  setForm((current) => ({ ...current, template_id: value }))
                }
              />
              <TextInput
                label="Company Name"
                value={form.company_name}
                onChange={updateFormField("company_name")}
              />
              <TextInput
                label="Contact Name"
                value={form.contact_name}
                onChange={updateFormField("contact_name")}
              />
              <TextInput
                label="Phone"
                value={form.contact_phone}
                onChange={updateFormField("contact_phone")}
              />
              <TextInput
                label="Email"
                value={form.contact_email}
                onChange={updateFormField("contact_email")}
              />
              <TextInput
                label="Quote / Project Name"
                required
                value={form.project_name}
                onChange={updateFormField("project_name")}
              />
              <TextInput
                label="Quote Owner"
                value={form.assigned_to}
                onChange={updateFormField("assigned_to")}
              />
              <TextInput
                label="Billing / Project Address"
                value={form.billing_address}
                onChange={updateFormField("billing_address")}
              />
              <TextInput
                label="City"
                value={form.billing_city}
                onChange={updateFormField("billing_city")}
              />
              <TextInput
                label="State"
                value={form.billing_state}
                onChange={updateFormField("billing_state")}
              />
              <TextInput
                label="ZIP"
                value={form.billing_zip}
                onChange={updateFormField("billing_zip")}
              />
            </SimpleGrid>
            <Group justify="flex-end">
              <Button
                variant="light"
                color="gray"
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </Button>
              <Button
                color="red"
                loading={creating}
                onClick={createStandaloneQuote}
              >
                Create and Build Quote
              </Button>
            </Group>
          </Stack>
        </MWSection>
      )}

      <MWSection title="All Formal Quotes">
        <SimpleGrid cols={{ base: 1, md: 3 }} mb="md">
          <TextInput
            label="Search Quotes"
            placeholder="Quote #, customer, company, project, owner..."
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
          />
          <Select
            label="Status"
            data={[
              "Open",
              "All",
              "Draft",
              "Ready for Review",
              "Sent",
              "Approved",
              "Declined",
              "Expired",
              "Cancelled",
            ]}
            value={statusFilter}
            onChange={(value) => setStatusFilter(value || "Open")}
            allowDeselect={false}
          />
          <Select
            label="Quote Type"
            data={["All", "Standalone Quote", "Project Quote"]}
            value={typeFilter}
            onChange={(value) => setTypeFilter(value || "All")}
            allowDeselect={false}
          />
        </SimpleGrid>

        <Stack gap="sm">
          {filteredQuotes.map((quote) => (
            <Card key={quote.id} withBorder radius="md" p="md">
              <SimpleGrid
                cols={{ base: 1, sm: 2, lg: 6 }}
                spacing="md"
                verticalSpacing="sm"
              >
                <div>
                  <Text size="xs" c="dimmed" fw={800} tt="uppercase">
                    Quote
                  </Text>
                  <Text fw={900}>
                    {quote.quote_number || `Quote ${quote.id}`}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {quote.project_id ? "Project Quote" : "Standalone Quote"}
                  </Text>
                </div>

                <div>
                  <Text size="xs" c="dimmed" fw={800} tt="uppercase">
                    Customer / Company
                  </Text>
                  <Text fw={700}>
                    {quote.company_name ||
                      quote.customer_name ||
                      quote.contact_name ||
                      "Not entered"}
                  </Text>
                  {quote.contact_name && quote.company_name && (
                    <Text size="xs" c="dimmed">
                      {quote.contact_name}
                    </Text>
                  )}
                </div>

                <div>
                  <Text size="xs" c="dimmed" fw={800} tt="uppercase">
                    Quote For
                  </Text>
                  <Text fw={700}>
                    {quote.project_name || quote.quote_title || "Not entered"}
                  </Text>
                  <Text size="xs" c="dimmed">
                    Owner:{" "}
                    {quote.assigned_to || quote.prepared_by || "Unassigned"}
                  </Text>
                </div>

                <div>
                  <Text size="xs" c="dimmed" fw={800} tt="uppercase" mb={4}>
                    Status
                  </Text>
                  <Badge color={statusColor(quote.status)}>
                    {quote.status || "Draft"}
                  </Badge>
                </div>

                <div>
                  <Text size="xs" c="dimmed" fw={800} tt="uppercase">
                    Total
                  </Text>
                  <Text fw={900}>{money(quote.total_amount)}</Text>
                  <Text size="xs" c="dimmed">
                    Valid through {formatDate(quote.valid_until)}
                  </Text>
                </div>

                <Group gap="xs" justify="flex-end" align="center" wrap="wrap">
                  <Button
                    size="xs"
                    variant="light"
                    color="gray"
                    onClick={() => openQuote(quote, "quoteBuilder")}
                  >
                    Edit
                  </Button>
                  <Button
                    size="xs"
                    color="red"
                    onClick={() => openQuote(quote, "quotePreview")}
                  >
                    Preview
                  </Button>
                  {(quote.converted_project_id || quote.project_id) && (
                    <Button
                      size="xs"
                      color="blue"
                      onClick={() => openProject(quote)}
                    >
                      Open Project
                    </Button>
                  )}
                  {!quote.project_id &&
                    !quote.converted_project_id &&
                    quote.status === "Approved" && (
                      <Button
                        size="xs"
                        color="green"
                        onClick={() => beginConversion(quote)}
                      >
                        Convert
                      </Button>
                    )}
                </Group>
              </SimpleGrid>
            </Card>
          ))}

          {filteredQuotes.length === 0 && (
            <Card withBorder radius="md" p="xl">
              <Text ta="center" c="dimmed">
                No quotes match the current filters.
              </Text>
            </Card>
          )}
        </Stack>
      </MWSection>
    </>
  );
}

export default QuoteCenter;
